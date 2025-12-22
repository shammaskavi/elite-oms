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
                    raw_payload,
                    customers ( name )
        `
                )
                .eq("tracking_token", token)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!token,
    });

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
                stage: latest?.stage_name ?? "Ordered",
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
        <TooltipProvider delayDuration={200}>
            <div className="min-h-screen bg-background p-6">
                <div className="max-w-3xl mx-auto space-y-6">
                    {/* Branding */}
                    <div className="text-center space-y-2">
                        <img
                            src={Logo}
                            alt="Saree Palace Elite"
                            className="max-h-fit mx-auto"
                        />
                        <h1 className="text-2xl font-bold">
                            Invoice #{invoice.invoice_number}
                        </h1>
                        <p className="text-muted-foreground">
                            Hello {invoice.customers?.name}
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

                    {/* Summary */}
                    <div className="border rounded-lg p-4 bg-muted/40 space-y-1">
                        <p>
                            <strong>Order date:</strong>{" "}
                            {new Date(invoice.date).toLocaleDateString("en-IN")}
                        </p>
                        <p>
                            <strong>Total:</strong> ₹
                            {Number(invoice.total).toLocaleString("en-IN")}
                        </p>
                    </div>

                    <div className="flex justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                                const url = invoice.raw_payload?.invoice_pdf_url;
                                if (url) window.open(url, "_blank");
                            }}
                            disabled={!invoice.raw_payload?.invoice_pdf_url}
                        >
                            Download Invoice PDF
                        </Button>
                    </div>

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
                                                Expected delivery:{" "}
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

                    {/* Footer */}
                    <p className="text-xs text-center text-muted-foreground">
                        © 2025 Saree Palace Elite. Designed with love. Worn with pride.
                    </p>
                </div>
            </div>
        </TooltipProvider>
    );
}