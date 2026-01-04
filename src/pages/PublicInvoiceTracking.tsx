import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Pulsar } from 'ldrs/react'
import 'ldrs/react/Pulsar.css'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import Logo from "../assets/logo-full.png"
import { derivePaymentStatus } from "@/lib/derivePaymentStatus";

export default function PublicInvoiceTracking() {
    const { token } = useParams<{ token: string }>();

    const { data: invoice, isLoading, error } = useQuery({
        queryKey: ["public-invoice", token],
        queryFn: async () => {
            if (!token) throw new Error("Missing tracking token");

            const { data, error } = await (supabase as any)
                .from("invoices")
                .select(
                    `
                    id,
                    invoice_number,
                    date,
                    total,
                    file_url,
                    raw_payload,
                    customers ( name ),
                    invoice_payments (amount, created_at)
                    `
                )
                .eq("tracking_token", token)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!token,
    });

    const { data: paymentInfo, isLoading: paymentLoading } = useQuery({
        queryKey: ["public-invoice-payment-status", invoice?.id],
        queryFn: () => derivePaymentStatus(invoice),
        enabled: !!invoice,
    });

    const paidAmount =
        paymentInfo?.paid ??
        Number(invoice?.raw_payload?.paid_amount || 0);

    const remaining =
        paymentInfo?.remaining ??
        Math.max(0, Number(invoice?.total || 0) - paidAmount);

    const status =
        paymentInfo?.status ??
        invoice?.raw_payload?.payment_status ??
        "unpaid";

    // const totalPaid = useMemo(() => {
    //     if (!invoice?.invoice_payments) return 0;

    //     return invoice.invoice_payments.reduce(
    //         (sum, p) => sum + Number(p.amount || 0),
    //         0
    //     );
    // }, [invoice?.invoice_payments]);

    // const dueAmount = Math.max(
    //     0,
    //     Number(invoice?.total || 0) - totalPaid
    // );

    const formatCurrency = (value: any) =>
        `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;


    const STORE_UPI_ID = "9925041003@okbizaxis";
    const STORE_NAME = "SAREE PALACE ELITE";
    const WHATSAPP_NUMBER = "919274741003";

    const upiPaymentUrl = useMemo(() => {
        if (!invoice || remaining <= 0) return null;

        const params = new URLSearchParams({
            pa: STORE_UPI_ID,
            pn: STORE_NAME,
            am: remaining.toFixed(2),
            cu: "INR",
            tn: `${invoice.customers.name} ${invoice.invoice_number}`,

        });

        return `upi://pay?${params.toString()}`;
    }, [invoice, remaining]);

    const whatsappUrl = useMemo(() => {
        if (!invoice) return "#";
        const text = `Hello Saree Palace Elite, I need help with Invoice ${invoice.invoice_number}.`;
        return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
    }, [invoice]);

    const { data: orders = [] } = useQuery({
        queryKey: ["public-invoice-orders", invoice?.id],
        queryFn: async () => {
            if (!invoice?.id) return [];

            const { data, error } = await (supabase as any)
                .from("orders")
                .select(`
  id,
  metadata,
  order_stages (
    stage_name,
    vendor_name,
    created_at
  )
`)
                .eq("invoice_id", invoice.id);

            if (error) throw error;
            return data || [];
        },
        enabled: !!invoice?.id,
    });

    // Helper to normalize strings for matching (same as your InvoiceView)
    const normalize = (v?: string) => v?.trim().toLowerCase() ?? "";

    const getPublicStageLabel = (stage?: string) => {
        if (!stage) return "Ordered";

        switch (stage.toLowerCase()) {
            case "packed":
                return "Ready to pickup";
            case "ordered":
                return "Order Received";
            default:
                return stage;
        }
    };

    // Map stages using the same logic as the admin view
    const { orderIndexMap, orderNameMap } = useMemo(() => {
        const indexMap = new Map<number, any>();
        const nameMap = new Map<string, any>();

        orders.forEach((order: any) => {
            const stages = [...(order.order_stages || [])].sort(
                (a, b) =>
                    new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime()
            );

            const latest = stages[stages.length - 1];
            const stageData = {
                stage: getPublicStageLabel(latest?.stage_name),
                vendor: latest?.vendor_name ?? null,
                updatedAt: latest?.created_at ?? null,
            };

            if (typeof order.metadata?.item_index === "number") {
                indexMap.set(order.metadata.item_index, stageData);
            }
            if (order.metadata?.item_name) {
                nameMap.set(normalize(order.metadata.item_name), stageData);
            }
        });
        return { orderIndexMap: indexMap, orderNameMap: nameMap };
    }, [orders]);

    if (isLoading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center">
                <Pulsar size="200" speed="1" color="pink" />
                <h1 className="mt-4">Loading tracking details…</h1>
            </div>
        );
    }

    if (error || !invoice) {
        return (
            <div className="min-h-screen flex items-center justify-center text-center">
                <div>
                    <h2 className="text-xl font-semibold mb-2">
                        Invalid or expired link
                    </h2>
                    <p className="text-muted-foreground">
                        Please contact the store for assistance.
                    </p>
                    <Button
                        className="w-full mt-6"
                        variant="outline"
                        size="sm"
                        onClick={() => window.open("https://wa.me/+919274741003?text=Hello%2C%20I%20need%20help%20with%20my%20order%20%23", "_blank")}
                    >
                        Need Help? Contact Store on WhatsApp
                    </Button>

                </div>
            </div>
        );
    }

    const items = invoice.raw_payload?.items || [];

    const overallLastUpdated = (() => {
        const timestamps = orders
            .flatMap((order: any) =>
                (order.order_stages || []).map((s: any) =>
                    s.created_at ? new Date(s.created_at).getTime() : null
                )
            )
            .filter(Boolean) as number[];

        if (!timestamps.length) return null;
        return new Date(Math.max(...timestamps));
    })();

    return (
        <div className="min-h-screen bg-background p-6">
            <div className="max-w-3xl mx-auto space-y-6">
                {/* Branding */}
                <div className="text-center space-y-2">
                    <img
                        src={Logo}
                        alt="Saree Palace Elite"
                        className="max-h-60 w-auto mx-auto p-61"
                    />
                    <h1 className="text-2xl font-bold">
                        Invoice #{invoice.invoice_number}
                    </h1>
                    <p>
                        Order Date:{" "}
                        {new Date(invoice.date).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                        })}
                    </p>
                    <p className="text-muted-foreground">
                        Hello {invoice.customers?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Order status updates automatically as your items progress.
                    </p>
                    {overallLastUpdated && (
                        <p className="text-xs text-muted-foreground">
                            Last updated:{" "}
                            {overallLastUpdated.toLocaleString("en-IN", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                hour12: true,
                            })}
                        </p>
                    )}
                </div>

                {/* <p className="bg-muted px-4 py-2 font-semibold">
                    <strong>Order Date:</strong>{" "}
                    {new Date(invoice.date).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                    })}
                </p> */}

                {/* Items */}
                <div className="border rounded-lg overflow-hidden">
                    <div className="bg-muted px-4 py-2 font-semibold">
                        Order Items
                    </div>

                    <div className="divide-y">
                        {items.map((item: any, idx: number) => {
                            // Find linked order using Index first, then fall back to Name matching
                            const linked = typeof item.item_index === "number"
                                ? orderIndexMap.get(item.item_index)
                                : orderNameMap.get(normalize(item.name));

                            return (
                                <div
                                    key={idx}
                                    className="flex justify-between items-center px-4 py-3"
                                >
                                    <div>
                                        <p className="font-medium">{item.name}</p>
                                        <p className="text-sm text-muted-foreground">
                                            Qty: {item.qty}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            Estimated delivery:{" "}
                                            {item.delivery_date
                                                ? new Date(
                                                    item.delivery_date
                                                ).toLocaleDateString("en-IN", {
                                                    day: "2-digit",
                                                    month: "short",
                                                    year: "numeric",
                                                })
                                                : "—"}
                                        </p>
                                        <p className="font-medium">{formatCurrency(item.unit_price)}</p>
                                    </div>

                                    {linked ? (
                                        <Badge
                                            variant="secondary"
                                        >
                                            {linked.stage}
                                        </Badge>

                                    ) : (
                                        <Badge variant="outline">N/A</Badge>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Payment Summary */}
                <div className="border rounded-lg p-4 bg-muted/40 space-y-2">

                    <div className="flex justify-between text-sm">
                        <span>Order Total</span>
                        <span className="font-medium">
                            ₹{Number(invoice.total).toLocaleString("en-IN")}
                        </span>
                    </div>

                    <div className="flex justify-between text-sm">
                        <span>Amount Received</span>
                        <span className="font-medium text-emerald-600">
                            ₹{paidAmount.toLocaleString("en-IN")}
                        </span>
                    </div>

                    <div className="flex justify-between text-base font-semibold pt-1 border-t pb-6">
                        <span>Balance Due</span>
                        <span className={remaining > 0 ? "text-destructive" : "text-emerald-600"}>
                            ₹{remaining.toLocaleString("en-IN")}
                        </span>
                    </div>

                    {remaining > 0 ? (
                        <Button
                            className="w-full mt-3 "
                            onClick={() => {
                                if (upiPaymentUrl) {
                                    window.location.href = upiPaymentUrl;
                                }
                            }}
                        >
                            Pay ₹{remaining.toLocaleString("en-IN")} via UPI
                        </Button>
                    ) : (
                        <div className="mt-3 text-center text-sm font-medium text-emerald-600">
                            Paid in full ✓
                        </div>
                    )}
                </div>

                <div className="flex justify-end">
                    <Button
                        className="mr-2 w-full"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (invoice.file_url) {
                                window.open(invoice.file_url, "_blank");
                            }
                        }}
                        disabled={!invoice.file_url}
                    >
                        View Full Invoice PDF
                    </Button>
                    <Button
                        className="w-full"
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(whatsappUrl, "_blank")}
                    >
                        Need Help? Contact Store on WhatsApp
                    </Button>
                </div>

                {/* Footer */}
                <p className="text-xs text-center text-muted-foreground">
                    © 2025 Saree Palace Elite. Designed with love. Worn with pride.
                </p>
            </div>
        </div>
    );
}