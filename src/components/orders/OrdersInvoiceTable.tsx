import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Calendar, User, ShoppingBag } from "lucide-react";
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
    // Return null or empty if it matches the order name exactly or is "Standard Component"
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

export default function OrdersInvoiceTable({ groupedInvoices, onOrderClick }: any) {
    if (!groupedInvoices.length) {
        return <Card className="p-12 text-center text-muted-foreground">No orders found.</Card>;
    }

    return (
        <Card className="overflow-hidden border-none shadow-sm">
            <Table>
                <TableHeader className="bg-slate-50/50">
                    <TableRow>
                        <TableHead className="w-[100px] font-semibold text-slate-900">Invoice</TableHead>
                        <TableHead className="w-[160px] font-semibold text-slate-900">Customer</TableHead>
                        <TableHead className="font-semibold text-slate-900">Order Item</TableHead>
                        <TableHead className="w-[130px] font-semibold text-slate-900">Stage</TableHead>
                        <TableHead className="w-[130px] font-semibold text-slate-900">Vendor</TableHead>
                        <TableHead className="w-[110px] font-semibold text-slate-900">Delivery</TableHead>
                        <TableHead className="w-[100px] text-right font-semibold text-slate-900">Amount</TableHead>
                        <TableHead className="w-[40px]"></TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {groupedInvoices.map((invoice: any) => (
                        <React.Fragment key={invoice.invoice_id}>
                            {invoice.orders.map((order: any, orderIdx: number) => {
                                const deliveryDate = order.metadata?.delivery_date ? new Date(order.metadata.delivery_date) : null;
                                const products = getProductsFromOrder(order);
                                const orderName = order.metadata?.item_name || "Order Item";
                                const isMultiProduct = products.length > 1;

                                return (
                                    <TableRow
                                        key={order.id}
                                        className="group cursor-pointer hover:bg-slate-50/50 transition-colors border-t"
                                        onClick={() => onOrderClick(order.id)}
                                    >
                                        <TableCell className="align-top py-4 font-bold text-blue-600 text-sm">
                                            {orderIdx === 0 ? invoice.invoice_number : ""}
                                        </TableCell>

                                        <TableCell className="align-top py-4">
                                            {orderIdx === 0 && (
                                                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                                    <User className="h-3 w-3 text-muted-foreground shrink-0" />
                                                    <span className="truncate">{invoice.customer_name}</span>
                                                </div>
                                            )}
                                        </TableCell>

                                        <TableCell className="py-4 align-top">
                                            <div className="font-semibold text-slate-800 flex items-center gap-2 mb-1">
                                                <ShoppingBag className="h-3.5 w-3.5 text-slate-400" />
                                                {orderName}
                                            </div>

                                            {/* Sub-components only if more than 1 product */}
                                            {isMultiProduct && (
                                                <div className="mt-3 space-y-3">
                                                    {products.map((p) => (
                                                        <div key={p.productNumber} className="h-6 flex items-center text-xs font-medium text-slate-500 pl-6 border-l-2 border-slate-100">
                                                            {simplifyProductName(p.productName, orderName) || "Component"}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </TableCell>

                                        <TableCell className="py-4 align-top">
                                            <div className={isMultiProduct ? "mt-7 space-y-3" : "mt-0"}>
                                                {products.map((p) => (
                                                    <div key={p.productNumber} className="h-6 flex items-center">
                                                        <Badge className={`${getStageColor(p.stage)} text-[10px] px-2 py-0 h-5 shadow-none border font-medium`}>
                                                            {p.stage}
                                                        </Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </TableCell>

                                        <TableCell className="py-4 align-top">
                                            <div className={isMultiProduct ? "mt-7 space-y-3" : "mt-0"}>
                                                {products.map((p) => (
                                                    <div key={p.productNumber} className="h-6 flex items-center text-xs text-slate-500 italic">
                                                        {p.vendor}
                                                    </div>
                                                ))}
                                            </div>
                                        </TableCell>

                                        <TableCell className="align-top py-4 text-sm text-slate-600">
                                            <div className="flex items-center gap-1.5 pt-0.5">
                                                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                                                {deliveryDate ? deliveryDate.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}
                                            </div>
                                        </TableCell>

                                        <TableCell className="align-top py-4 text-right font-bold text-slate-900">
                                            ₹{order.total_amount?.toLocaleString("en-IN")}
                                        </TableCell>

                                        <TableCell className="align-top py-4">
                                            <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-primary transition-colors mt-0.5" />
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