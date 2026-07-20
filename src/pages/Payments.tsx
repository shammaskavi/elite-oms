import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Search, ChevronRight, ChevronLeft, Receipt } from "lucide-react";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { useDocumentTitle } from "@/hooks/use-document-title";

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

const PAGE_SIZE = 20;

export default function Payments() {
    useDocumentTitle("Payments");

    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);

    const { data: payments, isLoading, isError, refetch } = useQuery({
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

    const filteredPayments = useMemo(() => {
        if (!payments) return [];
        const q = searchQuery.trim().toLowerCase();
        if (!q) return payments;

        return payments.filter((p: any) => {
            return (
                p.customer_name?.toLowerCase().includes(q) ||
                p.invoice_number?.toLowerCase().includes(q) ||
                p.method?.toLowerCase().includes(q) ||
                p.reference?.toLowerCase().includes(q)
            );
        });
    }, [payments, searchQuery]);

    const totalPages = Math.max(1, Math.ceil(filteredPayments.length / PAGE_SIZE));

    const paginatedPayments = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filteredPayments.slice(start, start + PAGE_SIZE);
    }, [filteredPayments, page]);

    const totalAmount = useMemo(
        () => filteredPayments.reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0),
        [filteredPayments]
    );

    useEffect(() => {
        setPage(1);
    }, [searchQuery]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
                <h1 className="text-3xl font-bold">Payments</h1>
                {!isLoading && filteredPayments.length > 0 && (
                    <div className="text-right">
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                        <p className="text-lg font-semibold">{formatMoney(totalAmount)}</p>
                    </div>
                )}
            </div>

            <Card className="p-6">
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                        <h2 className="text-xl font-semibold">Search payments</h2>
                    </div>
                    <Input
                        placeholder="Search by customer, invoice number, method, or reference…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        aria-label="Search payments"
                    />
                </div>
            </Card>

            <Card className="overflow-hidden p-0">
                {isLoading ? (
                    <LoadingState message="Loading payments…" />
                ) : isError ? (
                    <ErrorState onRetry={() => refetch()} />
                ) : paginatedPayments.length === 0 ? (
                    <EmptyState
                        icon={<Receipt className="h-7 w-7" />}
                        title={searchQuery ? "No matching payments" : "No payments yet"}
                        description={
                            searchQuery
                                ? "Try clearing the search."
                                : "Recorded payments will appear here."
                        }
                    />
                ) : (
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
                            {paginatedPayments.map((p: any) => (
                                <TableRow key={p.id} className="hover:bg-muted/50">
                                    <TableCell className="py-3">{formatDate(p.date)}</TableCell>
                                    <TableCell className="py-3 font-medium">{p.customer_name}</TableCell>
                                    <TableCell className="py-3">{p.invoice_number}</TableCell>
                                    <TableCell className="py-3 text-right font-semibold">
                                        {formatMoney(p.amount)}
                                    </TableCell>
                                    <TableCell className="py-3 capitalize">
                                        {p.method?.replace?.("_", " ") ?? "—"}
                                    </TableCell>
                                    <TableCell className="py-3">{p.reference || "—"}</TableCell>
                                    <TableCell className="py-3">{p.remarks || "—"}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </Card>

            {!isLoading && filteredPayments.length > PAGE_SIZE && (
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <div>
                        Page {page} of {totalPages}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="icon"
                            aria-label="Previous page"
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            size="icon"
                            aria-label="Next page"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page === totalPages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
