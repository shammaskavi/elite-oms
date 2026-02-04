import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Search, ChevronRight, ChevronLeft } from "lucide-react";

/* ---------------------------------------------
   Helpers
--------------------------------------------- */
function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

function formatMoney(amount: number) {
    return `₹${amount.toLocaleString("en-IN")}`;
}

export default function Payments() {
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const pageSize = 20;

    /* ---------------------------------------------
       Fetch payments (DIRECT SUPABASE QUERY)
    --------------------------------------------- */
    const { data: payments, isLoading } = useQuery({
        queryKey: ["payments-register"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("invoice_payments")
                .select(`
          id,
          amount,
          method,
          reference_id,
          remarks,
          date,
          invoices (
            invoice_number,
            customers (
              name
            )
          )
        `)
                .order("date", { ascending: false });

            if (error) throw error;

            // Normalize shape for UI
            return (data ?? []).map((p: any) => ({
                id: p.id,
                date: p.date,
                amount: Number(p.amount),
                method: p.method,
                reference: p.reference_id,
                remarks: p.remarks,
                invoice_number: p.invoices?.invoice_number ?? "—",
                customer_name: p.invoices?.customers?.name ?? "—",
            }));
        },
    });

    /* ---------------------------------------------
       Search filter
    --------------------------------------------- */
    const filteredPayments = useMemo(() => {
        const q = searchQuery.toLowerCase();

        return payments?.filter((p: any) => {
            return (
                p.customer_name?.toLowerCase().includes(q) ||
                p.invoice_number?.toLowerCase().includes(q) ||
                p.method?.toLowerCase().includes(q) ||
                p.reference?.toLowerCase().includes(q)
            );
        });
    }, [payments, searchQuery]);

    const totalPages = filteredPayments ? Math.max(1, Math.ceil(filteredPayments.length / pageSize)) : 1;

    const paginatedPayments = useMemo(() => {
        if (!filteredPayments) return [];
        const start = (page - 1) * pageSize;
        return filteredPayments.slice(start, start + pageSize);
    }, [filteredPayments, page, pageSize]);

    useEffect(() => {
        setPage(1);
    }, [searchQuery]);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Payments</h1>
            </div>

            {/* Search */}
            <Card className="p-6">
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-muted-foreground" />
                        <h2 className="text-xl font-semibold">Search Payments</h2>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                        <Input
                            placeholder="Search by customer, invoice number, method, or reference..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1"
                        />
                    </div>
                </div>
            </Card>

            {/* Payments Table */}
            <Card className="p-0 overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Customer</TableHead>
                            <TableHead>Invoice</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Method</TableHead>
                            <TableHead>Reference</TableHead>
                            <TableHead>Notes</TableHead>
                        </TableRow>
                    </TableHeader>

                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center">
                                    Loading payments…
                                </TableCell>
                            </TableRow>
                        ) : paginatedPayments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center">
                                    No payments found
                                </TableCell>
                            </TableRow>
                        ) : (
                            paginatedPayments.map((p: any) => (
                                <TableRow key={p.id} className="hover:bg-muted/50">
                                    <TableCell className="py-3">{formatDate(p.date)}</TableCell>
                                    <TableCell className="py-3 font-medium">
                                        {p.customer_name}
                                    </TableCell>
                                    <TableCell className="py-3">{p.invoice_number}</TableCell>
                                    <TableCell className="py-3 text-right font-semibold">
                                        {formatMoney(p.amount)}
                                    </TableCell>
                                    <TableCell className="py-3 capitalize">
                                        {p.method.replace("_", " ")}
                                    </TableCell>
                                    <TableCell className="py-3">{p.reference || "—"}</TableCell>
                                    <TableCell className="py-3">{p.remarks || "—"}</TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </Card>

            {/* Pagination Footer */}
            <Card className="p-4 flex items-center justify-between text-muted-foreground">
                <div>Page {page} of {totalPages}</div>
                <div className="flex gap-2">
                    <button
                        className="btn btn-sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        <ChevronLeft />
                    </button>
                    <button
                        className="btn btn-sm"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                    >
                        <ChevronRight />
                    </button>
                </div>
            </Card>
        </div>
    );
}