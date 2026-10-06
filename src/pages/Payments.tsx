import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { queryKeys } from "@/services/api/queryKeys";
import { invoicesService } from "@/services/invoicesService";
import { useAuth } from "@/lib/auth";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { useDataTableSort } from "@/hooks/use-data-table-sort";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { DateRangeFilter, DateFilterValue } from "@/components/ui/date-range-filter";
import { FloatingTableFooter, SummaryMetric } from "@/components/ui/floating-table-footer";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, ChevronRight, ChevronLeft, Receipt, ArrowRight } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/states";
import { TableSkeleton } from "@/components/skeletons";
import { useDocumentTitle } from "@/hooks/use-document-title";

function formatDate(date: string) {
  if (!date) return "—";
  try {
    return format(new Date(date.includes("T") ? date : `${date}T00:00:00`), "dd MMM yyyy");
  } catch {
    return date;
  }
}

function formatMoney(amount: number) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

const PAGE_SIZE = 25;

type PaymentSortField = "date" | "customer_name" | "invoice_number" | "amount" | "method";

export default function Payments() {
  useDocumentTitle("Payments Register");
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  // Enable Realtime Synchronization for Payments and Invoices
  useRealtimeSync({ enableInvoices: true });

  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  // Date Range Filter
  const [dateFilterValue, setDateFilterValue] = useState<DateFilterValue>({
    type: "all",
  });

  // 3-State Column Sorting
  const {
    sortKey,
    sortDirection,
    handleSort,
    clearSort,
  } = useDataTableSort<PaymentSortField>({
    defaultKey: null,
    defaultDirection: null,
  });

  const { data: payments, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.invoices.paymentsRegister(),
    queryFn: async ({ signal }) => {
      return invoicesService.fetchPaymentsRegister({ signal });
    },
  });

  // Filter payments by search query, method, and date / date-range
  const filteredPayments = useMemo(() => {
    if (!payments) return [];
    const q = searchQuery.trim().toLowerCase();

    return payments.filter((p: any) => {
      // 1. Search Query
      const matchesSearch =
        !q ||
        p.customer_name?.toLowerCase().includes(q) ||
        p.invoice_number?.toLowerCase().includes(q) ||
        p.method?.toLowerCase().includes(q) ||
        p.reference?.toLowerCase().includes(q) ||
        p.remarks?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // 2. Payment Method Filter
      if (methodFilter !== "all") {
        const normalizedMethod = (p.method || "").toLowerCase().replace(/[\s_-]+/g, "");
        const targetMethod = methodFilter.toLowerCase().replace(/[\s_-]+/g, "");
        if (!normalizedMethod.includes(targetMethod)) {
          return false;
        }
      }

      // 3. Date & Date-Range Filter
      if (dateFilterValue.type === "all") {
        return true;
      }

      const paymentDateStr = p.date
        ? new Date(p.date.includes("T") ? p.date : `${p.date}T00:00:00`)
            .toISOString()
            .split("T")[0]
        : null;

      if (!paymentDateStr) return false;

      if (dateFilterValue.type === "single" && dateFilterValue.singleDate) {
        return paymentDateStr === dateFilterValue.singleDate;
      }

      if (dateFilterValue.startDate && dateFilterValue.endDate) {
        return (
          paymentDateStr >= dateFilterValue.startDate &&
          paymentDateStr <= dateFilterValue.endDate
        );
      }

      if (dateFilterValue.startDate) {
        return paymentDateStr >= dateFilterValue.startDate;
      }

      if (dateFilterValue.endDate) {
        return paymentDateStr <= dateFilterValue.endDate;
      }

      return true;
    });
  }, [payments, searchQuery, methodFilter, dateFilterValue]);

  // Sort payments based on active table header sort (or fallback to date descending)
  const sortedPayments = useMemo(() => {
    if (!filteredPayments || filteredPayments.length === 0) return [];
    if (!sortKey || !sortDirection) {
      // Default: Most recent transaction first
      return [...filteredPayments].sort((a: any, b: any) => {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        return timeB - timeA;
      });
    }

    return [...filteredPayments].sort((a: any, b: any) => {
      let result = 0;

      if (sortKey === "date") {
        const timeA = a.date ? new Date(a.date).getTime() : 0;
        const timeB = b.date ? new Date(b.date).getTime() : 0;
        result = timeA - timeB;
      } else if (sortKey === "customer_name") {
        result = (a.customer_name || "").localeCompare(b.customer_name || "");
      } else if (sortKey === "invoice_number") {
        const numA = parseInt(String(a.invoice_number || "").replace(/\D/g, ""), 10);
        const numB = parseInt(String(b.invoice_number || "").replace(/\D/g, ""), 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          result = numA - numB;
        } else {
          result = (a.invoice_number || "").localeCompare(b.invoice_number || "");
        }
      } else if (sortKey === "amount") {
        result = (Number(a.amount) || 0) - (Number(b.amount) || 0);
      } else if (sortKey === "method") {
        result = (a.method || "").localeCompare(b.method || "");
      }

      return sortDirection === "asc" ? result : -result;
    });
  }, [filteredPayments, sortKey, sortDirection]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedPayments.length / PAGE_SIZE));

  const paginatedPayments = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return sortedPayments.slice(start, start + PAGE_SIZE);
  }, [sortedPayments, page]);

  // Financial aggregates across filtered payments
  const aggregateTotals = useMemo(() => {
    let totalAmount = 0;
    let cashAmount = 0;
    let upiAmount = 0;
    let cardAmount = 0;

    for (const p of sortedPayments) {
      const amt = Number(p.amount) || 0;
      totalAmount += amt;

      const m = (p.method || "").toLowerCase();
      if (m.includes("cash")) cashAmount += amt;
      else if (m.includes("upi")) upiAmount += amt;
      else if (m.includes("card")) cardAmount += amt;
    }

    return {
      totalAmount,
      cashAmount,
      upiAmount,
      cardAmount,
    };
  }, [sortedPayments]);

  const footerMetrics: SummaryMetric[] = useMemo(() => {
    return [
      {
        label: "Total Collected",
        value: formatMoney(aggregateTotals.totalAmount),
        colorClass: "text-emerald-600 dark:text-emerald-400 font-bold",
      },
      ...(aggregateTotals.upiAmount > 0
        ? [
            {
              label: "UPI",
              value: formatMoney(aggregateTotals.upiAmount),
            },
          ]
        : []),
      ...(aggregateTotals.cashAmount > 0
        ? [
            {
              label: "Cash",
              value: formatMoney(aggregateTotals.cashAmount),
            },
          ]
        : []),
      ...(aggregateTotals.cardAmount > 0
        ? [
            {
              label: "Card",
              value: formatMoney(aggregateTotals.cardAmount),
            },
          ]
        : []),
    ];
  }, [aggregateTotals]);

  const hasActiveFilters =
    searchQuery !== "" ||
    methodFilter !== "all" ||
    dateFilterValue.type !== "all" ||
    sortKey !== null;

  const handleResetAllFilters = useCallback(() => {
    setSearchQuery("");
    setMethodFilter("all");
    setDateFilterValue({ type: "all" });
    clearSort();
    setPage(1);
  }, [clearSort]);

  // Reset page to 1 whenever filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, methodFilter, dateFilterValue, sortKey, sortDirection]);

  const getMethodBadge = (method: string) => {
    const m = (method || "").toLowerCase();
    if (m.includes("cash")) {
      return (
        <Badge variant="outline" className="border-emerald-300 bg-emerald-50/50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-medium">
          Cash
        </Badge>
      );
    }
    if (m.includes("upi")) {
      return (
        <Badge variant="outline" className="border-purple-300 bg-purple-50/50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 text-xs font-medium">
          UPI
        </Badge>
      );
    }
    if (m.includes("card")) {
      return (
        <Badge variant="outline" className="border-blue-300 bg-blue-50/50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 text-xs font-medium">
          Card
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="capitalize text-xs font-medium">
        {method?.replace?.("_", " ") || "Other"}
      </Badge>
    );
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payments Register</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Audit trail of all received and allocated customer payments
          </p>
        </div>

        {!isLoading && sortedPayments.length > 0 && (
          <div className="flex items-center gap-3 bg-muted/40 px-4 py-2 rounded-xl border">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                Total Inflow
              </p>
              <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatMoney(aggregateTotals.totalAmount)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Search & Filter Toolbar */}
      <Card className="p-4 sm:p-5">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-lg sm:text-xl font-semibold">Search payments</h2>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Input
              placeholder="Search by customer, invoice #, reference ID, or remarks…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search payments"
              className="flex-1"
            />

            <div className="flex flex-wrap items-center gap-2">
              <DateRangeFilter
                value={dateFilterValue}
                onChange={setDateFilterValue}
                className="w-full sm:w-auto"
              />

              <Tabs
                value={methodFilter}
                onValueChange={setMethodFilter}
                className="w-full sm:w-auto"
              >
                <TabsList className="grid w-full grid-cols-4 sm:w-auto">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="cash">Cash</TabsTrigger>
                  <TabsTrigger value="upi">UPI</TabsTrigger>
                  <TabsTrigger value="card">Card</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Payments Table */}
      <Card className="overflow-hidden p-0">
        {isLoading ? (
          <TableSkeleton
            columns={["Date", "Customer", "Invoice", "Amount", "Method", "Reference", "Notes"]}
            rows={8}
          />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : sortedPayments.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-7 w-7" />}
            title={hasActiveFilters ? "No matching payments" : "No payments yet"}
            description={
              hasActiveFilters
                ? "Try adjusting your search, payment method, or date range."
                : "Recorded payments will appear here."
            }
            action={
              hasActiveFilters
                ? {
                    label: "Reset filters",
                    onClick: handleResetAllFilters,
                  }
                : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    sortKey="date"
                    currentSortKey={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                  >
                    Date
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="customer_name"
                    currentSortKey={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                  >
                    Customer
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="invoice_number"
                    currentSortKey={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                  >
                    Invoice #
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="amount"
                    currentSortKey={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    align="right"
                  >
                    Amount
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="method"
                    currentSortKey={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    align="center"
                  >
                    Method
                  </SortableTableHead>
                  <TableHead>Reference ID</TableHead>
                  <TableHead>Notes / Remarks</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPayments.map((p: any) => (
                  <TableRow key={p.id} className="transition-colors hover:bg-muted/50">
                    <TableCell className="py-3 whitespace-nowrap text-xs font-medium">
                      {formatDate(p.date)}
                    </TableCell>

                    <TableCell className="py-3">
                      {p.customer_id ? (
                        <Link
                          to={`/customers/${p.customer_id}`}
                          className="font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
                        >
                          {p.customer_name}
                        </Link>
                      ) : (
                        <span className="font-medium text-foreground">{p.customer_name}</span>
                      )}
                    </TableCell>

                    <TableCell className="py-3 font-mono text-xs">
                      {p.invoice_id ? (
                        <Link
                          to={`/invoices`}
                          state={{ openInvoiceId: p.invoice_id }}
                          className="text-primary hover:underline font-semibold"
                        >
                          {p.invoice_number}
                        </Link>
                      ) : (
                        <span>{p.invoice_number}</span>
                      )}
                    </TableCell>

                    <TableCell className="py-3 text-right font-semibold text-sm text-foreground">
                      {formatMoney(p.amount)}
                    </TableCell>

                    <TableCell className="py-3 text-center">
                      {getMethodBadge(p.method)}
                    </TableCell>

                    <TableCell className="py-3 font-mono text-xs text-muted-foreground">
                      {p.reference ? (
                        <span className="bg-muted px-2 py-0.5 rounded text-[11px] font-medium text-foreground">
                          {p.reference}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>

                    <TableCell className="py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                      {p.remarks || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Pagination Controls */}
      {!isLoading && sortedPayments.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
          <div>
            Showing {(page - 1) * PAGE_SIZE + 1} to{" "}
            {Math.min(page * PAGE_SIZE, sortedPayments.length)} of {sortedPayments.length} records
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs">
              Page {page} of {totalPages}
            </span>
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

      {/* Sticky Floating Summary Footer */}
      <FloatingTableFooter
        totalCount={sortedPayments.length}
        itemName="Payments"
        metrics={footerMetrics}
        showFinancials={isAdmin}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetAllFilters}
      />
    </div>
  );
}
