import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Calendar, User, ShoppingBag, ArrowUp, ArrowDown, ChevronLeft } from "lucide-react";
import {
    Table,
    TableBody,
    TableRow,
    TableCell,
    TableHeader,
    TableHead,
} from "@/components/ui/table";

// --- Helpers ---

const getStageColor = (stage: string) => {
    const s = stage.toLowerCase();
    if (s.includes("packed")) return "bg-emerald-100 text-emerald-700 border-emerald-200";
    if (s.includes("embroidery") || s.includes("dyeing")) return "bg-blue-100 text-blue-700 border-blue-200";
    if (s.includes("stitching")) return "bg-purple-100 text-purple-700 border-purple-200";
    if (s.includes("ordered")) return "bg-slate-100 text-slate-600 border-slate-200";
    return "bg-amber-100 text-amber-700 border-amber-200";
};

const simplifyProductName = (fullName: string, orderName: string) => {
    if (!fullName || !orderName) return fullName;
    const clean = fullName.replace(orderName, "").replace(/^-/, "").trim();
    // Logic to remove "Standard Component" or exact duplicates of item name
    return clean && clean.toLowerCase() !== "standard component" ? clean : null;
};

const getProductsFromOrder = (order: any) => {
    const stages = order.order_stages || [];
    const productMap = new Map<number, any[]>();

    stages.forEach((stage: any) => {
        const productNumber = stage.metadata?.product_number;
        if (!productNumber) return;
        if (!productMap.has(productNumber)) productMap.set(productNumber, []);
        productMap.get(productNumber)!.push(stage);
    });

    return Array.from(productMap.entries()).map(([productNumber, stages]) => {
        const sortedStages = [...stages].sort(
            (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const latest = sortedStages[sortedStages.length - 1];
        return {
            productNumber,
            productName: latest?.metadata?.product_name,
            stage: latest?.stage_name ?? "Ordered",
            vendor: latest?.vendor_name ?? "In-house",
        };
    });
};

// --- Component ---
export default function OrdersInvoiceTable({
    groupedInvoices,
    onOrderClick,
    invoiceSortKey,
    invoiceSortDirection,
    onChangeSort,
}: {
    groupedInvoices: any[];
    onOrderClick: (id: number) => void;
    invoiceSortKey: "invoice" | "delivery" | "amount";
    invoiceSortDirection: "asc" | "desc";
    onChangeSort: (key: "invoice" | "delivery" | "amount") => void;
}) {
    const renderSortIcon = (key: "invoice" | "delivery" | "amount") => {
        if (key !== invoiceSortKey) return null;
        const iconClass = "h-4 w-4 text-primary shrink-0";
        return invoiceSortDirection === "asc" ? (
            <ArrowUp className={iconClass} />
        ) : (
            <ArrowDown className={iconClass} />
        );
    };

    if (!groupedInvoices.length) {
        return <Card className="p-8 text-center text-muted-foreground">No orders found.</Card>;
    }

    console.log("SORT DEBUG:", { invoiceSortKey, invoiceSortDirection });

    return (
        <Card className="overflow-hidden shadow-sm">
            <Table>
                {/* <TableHeader className="bg-slate-50/50">
                    <TableRow>
                        <TableHead className="w-[90px] h-10 py-2 font-semibold text-slate-900 text-xs">
                            <button
                                type="button"
                                onClick={() => onChangeSort("invoice")}
                                className={`inline-flex items-center gap-1 text-xs font-semibold ${sortKey === "invoice" ? "text-primary" : "text-slate-900"
                                    }`}
                            >
                                <span>Invoice</span>
                                {renderSortIcon("invoice")}
                            </button>
                        </TableHead>
                        <TableHead className="w-[150px] h-10 py-2 font-semibold text-slate-900 text-xs">Customer</TableHead>
                        <TableHead className="h-10 py-2 font-semibold text-slate-900 text-xs">Order Item</TableHead>
                        <TableHead className="w-[120px] h-10 py-2 font-semibold text-slate-900 text-xs">Stage</TableHead>
                        <TableHead className="w-[120px] h-10 py-2 font-semibold text-slate-900 text-xs">Vendor</TableHead>
                        <TableHead className="w-[100px] h-10 py-2 font-semibold text-slate-900 text-xs">
                            <button
                                type="button"
                                onClick={() => onChangeSort("delivery")}
                                className={`inline-flex items-center gap-1 text-xs font-semibold ${sortKey === "delivery" ? "text-primary" : "text-slate-900"
                                    }`}
                            >
                                <span>Delivery</span>
                                {renderSortIcon("delivery")}
                            </button>
                        </TableHead>
                        <TableHead className="w-[90px] h-10 py-2 text-right font-semibold text-slate-900 text-xs">
                            <button
                                type="button"
                                onClick={() => onChangeSort("amount")}
                                className={`inline-flex items-center gap-1 text-xs font-semibold ${sortKey === "amount" ? "text-primary" : "text-slate-900"
                                    }`}
                            >
                                <span>Amount</span>
                                {renderSortIcon("amount")}
                            </button>
                        </TableHead>
                        <TableHead className="w-[30px] h-10 py-2"></TableHead>
                    </TableRow>
                </TableHeader> */}
                <TableHeader className="bg-slate-50/50">
                    <TableRow>
                        {/* Invoice Header */}
                        <TableHead className="w-[100px] h-10 p-0 font-semibold text-slate-900 text-xs">
                            <button
                                type="button"
                                onClick={() => onChangeSort("invoice")}
                                className={`flex items-center gap-1 w-full h-full px-2 hover:bg-slate-100/50 transition-colors ${invoiceSortKey === "invoice" ? "text-primary" : "text-slate-600"
                                    }`}
                            >
                                <span className="truncate">Invoice</span>
                                <span className="flex-shrink-0 w-4">
                                    {renderSortIcon("invoice")}
                                </span>
                            </button>
                        </TableHead>

                        <TableHead className="w-[150px] px-2 font-semibold text-slate-900 text-xs text-left">Customer</TableHead>
                        <TableHead className="px-2 font-semibold text-slate-900 text-xs text-left">Order Item</TableHead>
                        <TableHead className="w-[120px] px-2 font-semibold text-slate-900 text-xs text-left">Stage</TableHead>
                        <TableHead className="w-[120px] px-2 font-semibold text-slate-900 text-xs text-left">Vendor</TableHead>

                        {/* Delivery Header */}
                        <TableHead className="w-[110px] h-10 p-0 font-semibold text-slate-900 text-xs">
                            <button
                                type="button"
                                onClick={() => onChangeSort("delivery")}
                                className={`flex items-center gap-1 w-full h-full px-2 hover:bg-slate-100/50 transition-colors ${invoiceSortKey === "delivery" ? "text-primary" : "text-slate-600"
                                    }`}
                            >
                                <span className="truncate">Delivery</span>
                                <span className="flex-shrink-0 w-4">
                                    {renderSortIcon("delivery")}
                                </span>
                            </button>
                        </TableHead>

                        {/* Amount Header (Right Aligned) */}
                        <TableHead className="w-[100px] h-10 p-0 font-semibold text-slate-900 text-xs">
                            <button
                                type="button"
                                onClick={() => onChangeSort("amount")}
                                className={`flex items-center justify-end gap-1 w-full h-full px-2 hover:bg-slate-100/50 transition-colors ${invoiceSortKey === "amount" ? "text-primary" : "text-slate-600"
                                    }`}
                            >
                                <span className="flex-shrink-0 w-4">
                                    {renderSortIcon("amount")}
                                </span>
                                <span className="truncate">Amount</span>
                            </button>
                        </TableHead>
                        <TableHead className="w-[30px] p-0"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {groupedInvoices.map((invoice: any) => (
                        <React.Fragment key={invoice.invoice_id}>
                            {invoice.orders.map((order: any, orderIdx: number) => {
                                const deliveryDate = order.metadata?.delivery_date ? new Date(order.metadata.delivery_date) : null;
                                // const products = getProductsFromOrder(order);
                                const products = order.visibleProducts || [];
                                const orderName = order.metadata?.item_name || "Order Item";
                                const isMultiProduct = products.length > 1;

                                return (
                                    <TableRow
                                        key={order.id}
                                        className="group cursor-pointer hover:bg-slate-50/50 transition-colors border-t"
                                        // onClick={() => onOrderClick(order.id)}
                                        onClick={() => {
                                            sessionStorage.setItem("ordersScrollY", window.scrollY.toString());
                                            onOrderClick(order.id);
                                        }}
                                    >
                                        {/* Invoice Number */}
                                        <TableCell className="align-top py-2 font-bold text-blue-600 text-[13px]">
                                            {orderIdx === 0 ? invoice.invoice_number : ""}
                                        </TableCell>

                                        {/* Customer Name */}
                                        <TableCell className="align-top py-2">
                                            {orderIdx === 0 && (
                                                <div className="flex items-center gap-1.5 text-[13px] font-medium text-slate-700">
                                                    <User className="h-3 w-3 text-muted-foreground shrink-0" />
                                                    <span className="truncate">{invoice.customer_name}</span>
                                                </div>
                                            )}
                                        </TableCell>

                                        {/* Item & Sub-products */}
                                        <TableCell className="py-2 align-top">
                                            <div className="font-semibold text-slate-800 text-[13px] flex items-center gap-1.5 leading-tight">
                                                <ShoppingBag className="h-3 w-3 text-slate-400" />
                                                {orderName}
                                            </div>

                                            {isMultiProduct && (
                                                <div className="mt-1 space-y-1">
                                                    {products.map((p) => (
                                                        <div key={p.productNumber} className="h-5 flex items-center text-[11px] font-medium text-slate-500 pl-4 border-l-2 border-slate-100">
                                                            {simplifyProductName(p.productName, orderName) || "Component"}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </TableCell>

                                        {/* Stage Badge */}
                                        <TableCell className="py-2 align-top">
                                            <div className={isMultiProduct ? "mt-5 space-y-1" : "mt-0"}>
                                                {products.map((p) => (
                                                    <div key={p.productNumber} className="h-5 flex items-center">
                                                        <Badge className={`${getStageColor(p.stage)} text-[10px] px-1.5 py-0 h-4 shadow-none border font-medium`}>
                                                            {p.stage}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </TableCell>

                                        {/* Vendor Name */}
                                        <TableCell className="py-2 align-top">
                                            <div className={isMultiProduct ? "mt-5 space-y-1" : "mt-0"}>
                                                {products.map((p) => (
                                                    <div key={p.productNumber} className="h-5 flex items-center text-[11px] text-slate-500 italic">
                                                        {p.vendor}
                                                    </div>
                                                ))}
                                            </div>
                                        </TableCell>

                                        {/* Delivery Date */}
                                        <TableCell className="align-top py-2 text-[12px] text-slate-600">
                                            <div className="flex items-center gap-1.5 pt-0.5">
                                                <Calendar className="h-3 w-3 text-muted-foreground" />
                                                {deliveryDate ? deliveryDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                                            </div>
                                        </TableCell>

                                        {/* Total Amount */}
                                        <TableCell className="align-top py-2 text-right font-bold text-slate-900 text-[13px]">
                                            ₹{order.total_amount?.toLocaleString("en-IN")}
                                        </TableCell>

                                        {/* Action Icon */}
                                        <TableCell className="align-top py-2">
                                            <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-primary transition-colors mt-0.5" />
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </React.Fragment>
                    ))}
                </TableBody>
            </Table>
        </Card>
    );
}