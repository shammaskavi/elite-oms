import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { pdf } from "@react-pdf/renderer";
import { PrintableReceipt } from "@/components/PrintableReceipt";



interface ReceiptViewProps {
    receiptId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}


export async function printPdf(document: JSX.Element) {
    const blob = await pdf(document).toBlob();
    const url = URL.createObjectURL(blob);

    const win = window.open(url);
    if (!win) {
        alert("Popup blocked. Please allow popups to print.");
        return;
    }

    win.onload = () => {
        win.focus();
        win.print();
    };
}
export function ReceiptView({ receiptId, open, onOpenChange }: ReceiptViewProps) {
    // Fetch receipt (customer_payment)
    const { data: receipt } = useQuery({
        queryKey: ["receipt", receiptId],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("customer_payments")
                .select(`
          id,
          amount,
          payment_method,
          reference,
          notes,
          received_at,
          customers ( name, phone )
        `)
                .eq("id", receiptId)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!receiptId && open,
    });

    // Fetch allocations (invoice_payments linked to this receipt)
    const { data: allocations } = useQuery({
        queryKey: ["receipt-allocations", receiptId],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("invoice_payments")
                .select(`
          id,
          amount,
          invoices (
            invoice_number,
            created_at,
            total,
            settled,
            invoice_payments ( amount )
          )
        `)
                .eq("customer_payment_id", receiptId);

            if (error) throw error;
            return data || [];
        },
        enabled: !!receiptId && open,
    });

    const safeAllocations = useMemo(() => {
        return Array.isArray(allocations) ? allocations : [];
    }, [allocations]);

    const receiptVM = useMemo(() => {
        if (!receipt) return null;

        const customer = {
            name: receipt.customers?.name || "",
            phone: receipt.customers?.phone || "",
        };

        const method = receipt.payment_method || "";

        const allocationsVM = safeAllocations.map((a: any) => {
            const invoice = a.invoices || {};
            const invoicePayments = Array.isArray(invoice.invoice_payments) ? invoice.invoice_payments : [];
            const totalAllocated = invoicePayments.reduce((sum, ip) => sum + Number(ip.amount || 0), 0);
            const total = Number(invoice.total || 0);
            const settled = invoice.settled;
            const remainingDue = settled ? 0 : Math.max(total - totalAllocated, 0);

            return {
                invoiceNumber: invoice.invoice_number || "",
                invoiceDate: invoice.created_at
                    ? new Date(invoice.created_at).toISOString()
                    : "",
                invoiceTotal: total,
                applied: Number(a.amount || 0),
                remainingDue,
            };
        });

        return {
            id: receipt.id,
            amount: Number(receipt.amount || 0),
            reference: receipt.reference || "",
            notes: receipt.notes || "",
            receivedAt: receipt.received_at ? new Date(receipt.received_at).toISOString() : "",
            customer,
            method,
            allocations: allocationsVM,
        };
    }, [receipt, safeAllocations]);

    if (!receipt) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg receipt-print">
                <DialogHeader>
                    <DialogTitle className="font-bold" >Receipt</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Header */}
                    <div className="flex justify-between text-sm">
                        <div>
                            <div className="font-semibold mb-2">Customer Details</div>
                            <div className="mt-1">{receipt.customer?.name ?? receipt.customers?.name}</div>
                            <div className="mt-1">📞 {receipt.customer?.phone ?? receipt.customers?.phone}</div>
                            <div className="mt-1">🗓️ {new Date(receipt.received_at).toLocaleDateString()}</div>
                        </div>
                    </div>

                    {/* Payment Summary */}
                    <Card>
                        <CardContent className="pt-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>Amount Received</span>
                                <span className="font-medium">₹{Number(receipt.amount).toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Payment Method</span>
                                <span>{receipt.payment_method}</span>
                            </div>
                            {receipt.reference && (
                                <div className="flex justify-between">
                                    <span>Reference</span>
                                    <span>{receipt.reference}</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Allocation */}
                    <div className="space-y-2">
                        <div className="font-medium text-sm">Applied to Invoices</div>
                        <Card>
                            <CardContent className="pt-4 space-y-2 text-sm">
                                {safeAllocations.length > 0 ? (
                                    safeAllocations.map((a: any) => (
                                        <div key={a.id} className="flex justify-between">
                                            <span>{a.invoices?.invoice_number}</span>
                                            <span>₹{Number(a.amount).toFixed(2)}</span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-muted-foreground">No allocations</div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-between items-center pt-2">
                        <Button
                            onClick={async () => {
                                if (!receiptVM) return;
                                await printPdf(
                                    <PrintableReceipt
                                        receipt={receiptVM}
                                    />
                                );
                            }}
                            disabled={!receiptVM}
                        >
                            Print Receipt
                        </Button>
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>
                            Close
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
