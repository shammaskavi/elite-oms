import { useQuery } from "@tanstack/react-query";
import { derivePaymentStatus } from "@/lib/derivePaymentStatus";
import { TableCell, TableRow } from "./ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Button } from "./ui/button";
import { Eye, Trash2 } from "lucide-react";

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

    // ✅ use the unified resolver
    const { data: paymentInfo } = useQuery({
        queryKey: ["invoice-payment-status", invoice.id],
        queryFn: () => derivePaymentStatus(invoice),
    });

    // Fallback to legacy if resolver not ready yet
    const status =
        paymentInfo?.status ??
        invoice.payment_status ??
        invoice.raw_payload?.payment_status ??
        "unpaid";

    const isPaid = status === "paid";
    const isPartial = status === "partial";
    const isUnpaid = status === "unpaid";

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
            <TableCell>₹{invoice.total}</TableCell>

            <TableCell>
                {isDraft ? (
                    <Badge variant="secondary">Draft</Badge>
                ) : isPaid ? (
                    <Badge variant="success">Paid</Badge>
                ) : isPartial ? (
                    <Badge variant="info">Partial</Badge>
                ) : (
                    <Badge variant="warning">Unpaid</Badge>
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