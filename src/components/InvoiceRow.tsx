import { useQuery } from "@tanstack/react-query";
import { derivePaymentStatus, derivePaymentStatusFromData } from "@/lib/derivePaymentStatus";
import { TableCell, TableRow } from "./ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "./ui/button";
import { Eye, Trash2 } from "lucide-react";

import { StatusBadge } from "./StatusBadge";

export function InvoiceRow({
    invoice,
    onRowClick,
    onViewOrder,
    onDelete,
}: {
    invoice: any;
    onRowClick: () => void;
    onViewOrder?: () => void;
    onDelete: () => void;
}) {
    const isDraft = invoice.status === "draft";
    const isSettled = invoice.settled === true;

    // Use synchronous in-memory calculation if invoice_payments is already joined (0 network calls)
    const synchronousStatus = invoice.invoice_payments
        ? derivePaymentStatusFromData(invoice, invoice.invoice_payments)
        : null;

    // Only fire network query as fallback if invoice_payments was NOT joined by parent
    const { data: fallbackPaymentInfo } = useQuery({
        queryKey: ["invoice-payment-status", invoice.id],
        queryFn: () => derivePaymentStatus(invoice),
        enabled: !invoice.invoice_payments,
        staleTime: 5 * 60 * 1000,
    });

    const paymentInfo = synchronousStatus || fallbackPaymentInfo;

    // Reconcile status respecting explicit paid fields, orders, or reconciled payments
    const rawStatus =
        (invoice.payment_status === "paid" ? "paid" : null) ??
        (invoice.raw_payload?.payment_status === "paid" ? "paid" : null) ??
        (invoice.orders && invoice.orders.length > 0 && invoice.orders.every((o: any) => o.payment_status === "paid") ? "paid" : null) ??
        paymentInfo?.status ??
        (invoice.invoice_payments
            ? derivePaymentStatusFromData(invoice, invoice.invoice_payments).status
            : (invoice.payment_status ?? invoice.raw_payload?.payment_status ?? "unpaid"));

    const isPaid = rawStatus === "paid";
    const isPartial = rawStatus === "partial";
    const isUnpaid = rawStatus === "unpaid";

    const total = Number(invoice.total || 0);
    const paidAmount = Number(
        invoice.raw_payload?.paid_amount ??
        invoice.paid_amount ??
        0
    );
    const remaining = isSettled || isPaid
        ? 0
        : (paymentInfo?.remaining ?? Math.max(0, invoice.total - paidAmount));

    return (
        <TableRow
            className="cursor-pointer hover:bg-muted/50"
            onClick={onRowClick}
        >
            <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                    {invoice.invoice_number}
                    {isDraft && (
                        <Badge variant="outline" className="text-xs">
                            Draft
                        </Badge>
                    )}
                </div>
            </TableCell>

            <TableCell>{invoice.customers?.name || "-"}</TableCell>
            <TableCell>{format(new Date(invoice.date), "dd/MM/yyyy")}</TableCell>

            <TableCell className="font-medium">
                ₹{total.toLocaleString()}
            </TableCell>
            <TableCell>
                <span
                    className="font-medium"
                >
                    ₹{remaining.toLocaleString()}
                </span>
            </TableCell>

            <TableCell>
                {isSettled ? (
                    <StatusBadge type="payment" status="paid" label="Settled" />
                ) : isDraft ? (
                    <StatusBadge type="payment" status="draft" label="Draft" />
                ) : (
                    <StatusBadge type="payment" status={rawStatus || "unpaid"} />
                )}
            </TableCell>

            <TableCell onClick={(e) => e.stopPropagation()}>
                <div className="flex gap-2">
                    {!isDraft && invoice.orders?.[0]?.id && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={onViewOrder}
                        >
                            <Eye className="w-4 h-4" />
                        </Button>
                    )}

                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={onDelete}
                    >
                        <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
}