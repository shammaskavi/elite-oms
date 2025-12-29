import React, { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";
import {
    Table,
    TableHeader,
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from "@/components/ui/table";

type OrdersInvoiceTableProps = {
    groupedInvoices: Array<{
        invoice_id: string;
        invoice_number: string;
        customer_name: string;
        earliest_delivery_date: Date | null;
        orders: any[];
    }>;
    onOrderClick: (orderId: string) => void;
};

const getCurrentStage = (order: any) => {
    const stages = (order.order_stages || []).sort(
        (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
    );

    return stages.length
        ? stages[stages.length - 1].stage_name
        : "Ordered";
};

const getProductsFromOrder = (order: any) => {
    const stages = order.order_stages || [];

    const productMap = new Map<number, any[]>();

    stages.forEach((stage: any) => {
        const productNumber = stage.metadata?.product_number;
        if (!productNumber) return;

        if (!productMap.has(productNumber)) {
            productMap.set(productNumber, []);
        }
        productMap.get(productNumber)!.push(stage);
    });

    return Array.from(productMap.entries()).map(([productNumber, stages]) => {
        const sortedStages = [...stages].sort(
            (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
        );

        const latest = sortedStages[sortedStages.length - 1];

        return {
            productNumber,
            productName: latest?.metadata?.product_name,
            stage: latest?.stage_name ?? "Ordered",
            vendor: latest?.vendor_name ?? null,
        };
    });
};

export default function OrdersInvoiceTable({
    groupedInvoices,
    onOrderClick,
}: OrdersInvoiceTableProps) {
    const [sortBy, setSortBy] = useState<"invoice" | "delivery">("invoice");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

    if (!groupedInvoices.length) {
        return (
            <Card className="p-6 text-center text-muted-foreground">
                Still looking for orders....
            </Card>
        );
    }

    const sortedInvoices = [...groupedInvoices].sort((a, b) => {
        if (sortBy === "invoice") {
            const aNum = a.invoice_number;
            const bNum = b.invoice_number;
            return sortDir === "asc"
                ? aNum.localeCompare(bNum)
                : bNum.localeCompare(aNum);
        }

        const aDate = a.earliest_delivery_date
            ? new Date(a.earliest_delivery_date).getTime()
            : Infinity;
        const bDate = b.earliest_delivery_date
            ? new Date(b.earliest_delivery_date).getTime()
            : Infinity;

        return sortDir === "asc" ? aDate - bDate : bDate - aDate;
    });

    return (
        <Card className="p-4 md:p-6 overflow-x-auto">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/50">
                        <TableHead
                            className="cursor-pointer select-none text-xs uppercase tracking-wide text-muted-foreground px-3 py-2 text-left"
                            onClick={() => {
                                if (sortBy === "invoice") {
                                    setSortDir(sortDir === "asc" ? "desc" : "asc");
                                } else {
                                    setSortBy("invoice");
                                    setSortDir("desc");
                                }
                            }}
                        >
                            Invoice {sortBy === "invoice" && (sortDir === "asc" ? "▲" : "▼")}
                        </TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-muted-foreground px-3 py-2 text-left">Customer</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-muted-foreground px-3 py-2 text-left">Order Item</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-muted-foreground px-3 py-2 text-left">Stage</TableHead>
                        <TableHead
                            className="cursor-pointer select-none text-xs uppercase tracking-wide text-muted-foreground px-3 py-2 text-left"
                            onClick={() => {
                                if (sortBy === "delivery") {
                                    setSortDir(sortDir === "asc" ? "desc" : "asc");
                                } else {
                                    setSortBy("delivery");
                                    setSortDir("asc");
                                }
                            }}
                        >
                            Delivery {sortBy === "delivery" && (sortDir === "asc" ? "▲" : "▼")}
                        </TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-muted-foreground px-3 py-2 text-right">Amount</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-muted-foreground px-3 py-2"></TableHead>
                    </TableRow>
                </TableHeader>

                <TableBody>
                    {sortedInvoices.map((invoice) => {
                        return invoice.orders.map((order, idx) => {
                            const deliveryDate = order.metadata?.delivery_date
                                ? new Date(order.metadata.delivery_date)
                                : null;

                            return (
                                <TableRow
                                    key={order.id}
                                    className="hover:bg-muted/40 cursor-pointer"
                                    onClick={() => onOrderClick(order.id)}
                                >
                                    {/* Invoice */}
                                    <TableCell className="px-3 py-3 align-top">
                                        {idx === 0 && (
                                            <div className="font-semibold">
                                                {invoice.invoice_number}
                                            </div>
                                        )}
                                    </TableCell>

                                    {/* Customer */}
                                    <TableCell className="px-3 py-3 align-top">
                                        {idx === 0 && (
                                            <div className="font-medium">
                                                {invoice.customer_name}
                                            </div>
                                        )}
                                    </TableCell>

                                    {/* Order item */}
                                    {/* <TableCell className="px-3 py-3">
                                        <div className="font-medium">
                                            {order.metadata?.item_name || "Order Item"}
                                        </div>
                                        {order.metadata?.reference_name && (
                                            <div className="text-xs text-muted-foreground">
                                                Ref: {order.metadata.reference_name}
                                            </div>
                                        )}
                                    </TableCell> */}

                                    <TableCell className="px-3 py-3">
                                        <div className="font-medium">
                                            {order.metadata?.item_name || "Order Item"}
                                        </div>

                                        {order.metadata?.reference_name && (
                                            <div className="text-xs text-muted-foreground">
                                                Ref: {order.metadata.reference_name}
                                            </div>
                                        )}

                                        {/* Products */}
                                        {order.metadata?.num_products > 1 && (
                                            <div className="mt-2 space-y-2 pl-4 border-l">
                                                {getProductsFromOrder(order).map((product) => (
                                                    <div
                                                        key={product.productNumber}
                                                        className="flex items-start justify-between gap-2"
                                                    >
                                                        <div className="flex flex-col">
                                                            <span className="text-sm text-foreground">
                                                                {product.productName}
                                                            </span>
                                                            {product.vendor && (
                                                                <span className="text-xs text-muted-foreground">
                                                                    Vendor: {product.vendor}
                                                                </span>
                                                            )}
                                                        </div>

                                                        <Badge
                                                            variant="outline"
                                                            className="text-[11px] shrink-0"
                                                        >
                                                            {product.stage}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </TableCell>

                                    {/* Stage */}
                                    <TableCell className="px-3 py-3">
                                        <Badge variant="outline" className="text-xs">
                                            {getCurrentStage(order)}
                                        </Badge>
                                    </TableCell>

                                    {/* Delivery */}
                                    <TableCell className="px-3 py-3">
                                        {deliveryDate
                                            ? deliveryDate.toLocaleDateString("en-IN", {
                                                day: "2-digit",
                                                month: "short",
                                                year: "numeric",
                                            })
                                            : "—"}
                                    </TableCell>

                                    {/* Amount */}
                                    <TableCell className="px-3 py-3 text-right font-medium">
                                        ₹{order.total_amount?.toLocaleString("en-IN") || 0}
                                    </TableCell>

                                    {/* Arrow */}
                                    <TableCell className="px-3 py-3 text-right">
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    </TableCell>
                                </TableRow>
                            );
                        });
                    })}
                </TableBody>
            </Table>
        </Card>
    );
}