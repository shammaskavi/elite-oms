import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/services/api/queryKeys";
import { customersService } from "@/services/customersService";
import { useAuth } from "@/lib/auth";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { useDataTableSort } from "@/hooks/use-data-table-sort";
import { SortableTableHead } from "@/components/ui/sortable-table-head";
import { DateRangeFilter, DateFilterValue } from "@/components/ui/date-range-filter";
import { FloatingTableFooter, SummaryMetric } from "@/components/ui/floating-table-footer";
import { derivePaymentStatusFromData } from "@/lib/derivePaymentStatus";
import { deriveInvoiceState } from "@/lib/deriveInvoiceState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Plus, Pencil, Trash2, Search, Users as UsersIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { LoadingState, EmptyState, ErrorState } from "@/components/states";
import { TableSkeleton } from "@/components/skeletons";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { customerSchema } from "@/lib/validators";

const INITIAL_FORM = {
  name: "",
  phone: "",
  email: "",
  address: "",
  dob: "",
  anniversary: "",
};

type CustomerSortField = "name" | "orders_count" | "total_spent" | "pending_due" | "created_at";

export default function Customers() {
  useDocumentTitle("Customers");

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAdmin } = useAuth();

  // Enable Realtime Synchronization for Invoices & Customer Ledger updates
  useRealtimeSync({ enableInvoices: true });

  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);

  // Sync tab filter & search query directly with URL params
  const filterType = searchParams.get("tab") || "all";
  const searchQuery = searchParams.get("q") || "";

  // Date Range Filter state
  const [dateFilterValue, setDateFilterValue] = useState<DateFilterValue>({
    type: "all",
  });

  // 3-State Column Sorting
  const {
    sortKey,
    sortDirection,
    handleSort,
    clearSort,
  } = useDataTableSort<CustomerSortField>({
    defaultKey: null,
    defaultDirection: null,
  });

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const setFilterType = useCallback((tab: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (tab === "all") next.delete("tab");
        else next.set("tab", tab);
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  const setSearchQuery = useCallback((q: string) => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (!q) next.delete("q");
        else next.set("q", q);
        return next;
      },
      { replace: true }
    );
  }, [setSearchParams]);

  // Restore scroll position when navigating back from Customer Detail
  useEffect(() => {
    const savedScrollY = sessionStorage.getItem("customers_scroll_y");
    if (savedScrollY !== null) {
      const scrollY = parseInt(savedScrollY, 10);
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.scrollTo({ top: scrollY, behavior: "instant" as any });
        }, 30);
      });
      sessionStorage.removeItem("customers_scroll_y");
    }
  }, []);

  const queryClient = useQueryClient();

  const { data: customers, isLoading, isError, refetch } = useQuery({
    queryKey: queryKeys.customers.withInvoices(),
    queryFn: async ({ signal }) => {
      return customersService.fetchCustomersWithInvoices({ signal });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      return customersService.createCustomer(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      toast.success("Customer created");
      setOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: any) => {
      return customersService.updateCustomer(id, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      toast.success("Customer updated");
      setOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return customersService.deleteCustomer(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customers.all });
      toast.success("Customer deleted");
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to delete customer");
      setDeleteDialogOpen(false);
      setCustomerToDelete(null);
    },
  });

  const resetForm = useCallback(() => {
    setFormData(INITIAL_FORM);
    setFormErrors({});
    setEditingCustomer(null);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const parsed = customerSchema.safeParse(formData);
      if (!parsed.success) {
        const errs: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const key = String(issue.path[0] ?? "form");
          if (!errs[key]) errs[key] = issue.message;
        }
        setFormErrors(errs);
        toast.error("Please fix the highlighted fields.");
        return;
      }

      const v = parsed.data;
      const payload = {
        name: v.name,
        phone: v.phone || null,
        email: v.email || null,
        address: v.address || null,
        dob: v.dob || null,
        anniversary: v.anniversary || null,
      };

      if (editingCustomer) {
        updateMutation.mutate({ id: editingCustomer.id, data: payload });
      } else {
        createMutation.mutate(payload);
      }
    },
    [formData, editingCustomer, createMutation, updateMutation]
  );

  const handleEdit = useCallback((customer: any) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      dob: customer.dob || "",
      anniversary: customer.anniversary || "",
    });
    setFormErrors({});
    setOpen(true);
  }, []);

  // Compute true customer metrics (Lifetime Value & Ledger Balance)
  const customersWithMetrics = useMemo(() => {
    if (!customers) return [];
    return customers.map((c: any) => {
      let totalSpent = 0;
      let totalDue = 0;
      const invoices = c.invoices || [];
      const totalInvoices = invoices.length;

      for (const inv of invoices) {
        const invTotal = parseFloat(String(inv.total ?? 0)) || 0;
        totalSpent += invTotal;

        if (inv.settled === true) {
          continue;
        }

        const payment = derivePaymentStatusFromData(inv, inv.invoice_payments || []);
        const state = deriveInvoiceState(inv, payment);
        totalDue += (state.collectibleDue || 0);
      }

      const hasInvoices = totalInvoices > 0;
      const hasPendingDue = totalDue > 0;
      const allPaid = hasInvoices && totalDue === 0;

      return {
        ...c,
        __metrics: {
          totalInvoices,
          totalSpent,
          totalDue,
          hasPendingDue,
          hasInvoices,
          allPaid,
        },
      };
    });
  }, [customers]);

  // Filter customers by search query, payment tabs, and date / date-range filters
  const filteredCustomers = useMemo(() => {
    if (!customersWithMetrics) return [];
    const q = searchQuery.trim().toLowerCase();

    return customersWithMetrics.filter((c: any) => {
      // 1. Search Query
      const matchesSearch =
        !q ||
        c.name?.toLowerCase().includes(q) ||
        c.phone?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      // 2. Tab Filter (Pending, Paid, No Invoices, All)
      const { hasInvoices, hasPendingDue, allPaid } = c.__metrics;

      if (filterType === "pending" && !hasPendingDue) return false;
      if (filterType === "paid" && !allPaid) return false;
      if (filterType === "no-invoices" && hasInvoices) return false;

      // 3. Date & Date-Range Filter (Customer Registration / Created Date)
      if (dateFilterValue.type === "all") {
        return true;
      }

      const createdDateStr = c.created_at
        ? new Date(c.created_at).toISOString().split("T")[0]
        : null;

      if (!createdDateStr) return false;

      if (dateFilterValue.type === "single" && dateFilterValue.singleDate) {
        return createdDateStr === dateFilterValue.singleDate;
      }

      if (dateFilterValue.startDate && dateFilterValue.endDate) {
        return (
          createdDateStr >= dateFilterValue.startDate &&
          createdDateStr <= dateFilterValue.endDate
        );
      }

      if (dateFilterValue.startDate) {
        return createdDateStr >= dateFilterValue.startDate;
      }

      if (dateFilterValue.endDate) {
        return createdDateStr <= dateFilterValue.endDate;
      }

      return true;
    });
  }, [customersWithMetrics, searchQuery, filterType, dateFilterValue]);

  // Sort customers based on active table header sort
  const sortedCustomers = useMemo(() => {
    if (!filteredCustomers || filteredCustomers.length === 0) return [];
    if (!sortKey || !sortDirection) {
      return [...filteredCustomers].sort((a: any, b: any) =>
        (a.name || "").localeCompare(b.name || "")
      );
    }

    return [...filteredCustomers].sort((a: any, b: any) => {
      let result = 0;
      if (sortKey === "name") {
        result = (a.name || "").localeCompare(b.name || "");
      } else if (sortKey === "orders_count") {
        result = (a.__metrics.totalInvoices || 0) - (b.__metrics.totalInvoices || 0);
      } else if (sortKey === "total_spent") {
        result = (a.__metrics.totalSpent || 0) - (b.__metrics.totalSpent || 0);
      } else if (sortKey === "pending_due") {
        result = (a.__metrics.totalDue || 0) - (b.__metrics.totalDue || 0);
      } else if (sortKey === "created_at") {
        const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
        result = timeA - timeB;
      }
      return sortDirection === "asc" ? result : -result;
    });
  }, [filteredCustomers, sortKey, sortDirection]);

  // Aggregate totals for the sticky floating summary footer
  const aggregateTotals = useMemo(() => {
    let totalSpent = 0;
    let totalDue = 0;

    for (const c of sortedCustomers) {
      totalSpent += c.__metrics.totalSpent;
      totalDue += c.__metrics.totalDue;
    }

    return { totalSpent, totalDue };
  }, [sortedCustomers]);

  const footerMetrics: SummaryMetric[] = useMemo(() => {
    return [
      {
        label: "Total Lifetime Value",
        value: `₹${aggregateTotals.totalSpent.toLocaleString("en-IN")}`,
      },
      {
        label: "Outstanding Receivables",
        value: `₹${aggregateTotals.totalDue.toLocaleString("en-IN")}`,
        colorClass:
          aggregateTotals.totalDue > 0
            ? "text-destructive font-bold"
            : "text-emerald-600",
      },
    ];
  }, [aggregateTotals]);

  const hasActiveFilters =
    searchQuery !== "" ||
    filterType !== "all" ||
    dateFilterValue.type !== "all" ||
    sortKey !== null;

  const handleResetAllFilters = useCallback(() => {
    setSearchQuery("");
    setFilterType("all");
    setDateFilterValue({ type: "all" });
    clearSort();
  }, [setSearchQuery, setFilterType, clearSort]);

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Customers</h1>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add customer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCustomer ? "Edit customer" : "Add customer"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-2">
                <Label htmlFor="name">
                  Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  aria-invalid={!!formErrors.name}
                  aria-describedby={formErrors.name ? "err-name" : undefined}
                  required
                />
                {formErrors.name && (
                  <p id="err-name" className="text-xs text-destructive">
                    {formErrors.name}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  aria-invalid={!!formErrors.phone}
                  aria-describedby={formErrors.phone ? "err-phone" : undefined}
                />
                {formErrors.phone && (
                  <p id="err-phone" className="text-xs text-destructive">
                    {formErrors.phone}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  aria-invalid={!!formErrors.email}
                  aria-describedby={formErrors.email ? "err-email" : undefined}
                />
                {formErrors.email && (
                  <p id="err-email" className="text-xs text-destructive">
                    {formErrors.email}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="dob">Date of birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    value={formData.dob}
                    onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="anniversary">Anniversary</Label>
                  <Input
                    id="anniversary"
                    type="date"
                    value={formData.anniversary}
                    onChange={(e) => setFormData({ ...formData, anniversary: e.target.value })}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isMutating}>
                {isMutating ? "Saving…" : editingCustomer ? "Update" : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="p-4 sm:p-5">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-lg sm:text-xl font-semibold">Search customers</h2>
          </div>

          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <Input
              placeholder="Search by name, phone, or email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search customers"
              className="flex-1"
            />

            <div className="flex flex-wrap items-center gap-2">
              <DateRangeFilter
                value={dateFilterValue}
                onChange={setDateFilterValue}
                className="w-full sm:w-auto"
              />

              <Tabs
                value={filterType}
                onValueChange={setFilterType}
                className="w-full sm:w-auto"
              >
                <TabsList className="grid w-full grid-cols-4 sm:w-auto">
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="pending">Pending</TabsTrigger>
                  <TabsTrigger value="paid">Paid</TabsTrigger>
                  <TabsTrigger value="no-invoices">No invoices</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <TableSkeleton
            columns={["Customer", "Contact", "Orders", "Lifetime Value", "Receivables", "Joined", "Actions"]}
            rows={6}
          />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : sortedCustomers.length === 0 ? (
          <EmptyState
            icon={<UsersIcon className="h-7 w-7" />}
            title={
              hasActiveFilters ? "No matching customers" : "No customers yet"
            }
            description={
              hasActiveFilters
                ? "Try adjusting your search, tab filters, or date range."
                : "Add your first customer to start tracking orders and invoices."
            }
            action={
              hasActiveFilters
                ? {
                    label: "Reset filters",
                    onClick: handleResetAllFilters,
                  }
                : {
                    label: "Add customer",
                    icon: <Plus className="mr-2 h-4 w-4" />,
                    onClick: () => setOpen(true),
                  }
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHead
                    sortKey="name"
                    currentSortKey={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                  >
                    Customer
                  </SortableTableHead>
                  <TableHead>Contact</TableHead>
                  <SortableTableHead
                    sortKey="orders_count"
                    currentSortKey={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    align="center"
                  >
                    Orders / Invoices
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="total_spent"
                    currentSortKey={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    align="right"
                  >
                    Lifetime Value
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="pending_due"
                    currentSortKey={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    align="right"
                  >
                    Receivables / Due
                  </SortableTableHead>
                  <SortableTableHead
                    sortKey="created_at"
                    currentSortKey={sortKey}
                    currentDirection={sortDirection}
                    onSort={handleSort}
                    align="center"
                  >
                    Joined
                  </SortableTableHead>
                  <TableHead className="w-[90px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedCustomers.map((customer: any) => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer transition-colors hover:bg-muted/50"
                    onClick={() => {
                      sessionStorage.setItem("customers_scroll_y", window.scrollY.toString());
                      navigate(`/customers/${customer.id}`, {
                        state: {
                          from: "customers",
                          scrollY: window.scrollY,
                          searchQuery,
                          filterType,
                        },
                      });
                    }}
                  >
                    {/* Customer Name & Address */}
                    <TableCell className="font-medium">
                      <div className="font-semibold text-foreground hover:text-primary transition-colors">
                        {customer.name}
                      </div>
                      {customer.address && (
                        <div className="text-xs text-muted-foreground truncate max-w-[220px]">
                          {customer.address}
                        </div>
                      )}
                    </TableCell>

                    {/* Contact Phone & Email */}
                    <TableCell>
                      <div className="text-xs font-mono font-medium text-foreground">
                        {customer.phone || "—"}
                      </div>
                      {customer.email && (
                        <div className="text-[11px] text-muted-foreground truncate max-w-[180px]">
                          {customer.email}
                        </div>
                      )}
                    </TableCell>

                    {/* Total Invoices Count */}
                    <TableCell className="text-center">
                      {customer.__metrics.totalInvoices > 0 ? (
                        <Badge variant="outline" className="font-medium text-xs">
                          {customer.__metrics.totalInvoices} {customer.__metrics.totalInvoices === 1 ? "invoice" : "invoices"}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">0</span>
                      )}
                    </TableCell>

                    {/* Lifetime Value (Total Billed) */}
                    <TableCell className="text-right font-medium text-sm">
                      ₹{customer.__metrics.totalSpent.toLocaleString("en-IN")}
                    </TableCell>

                    {/* Outstanding Balance Due / Paid State */}
                    <TableCell className="text-right">
                      {customer.__metrics.totalDue > 0 ? (
                        <Badge
                          variant="outline"
                          className="font-semibold text-xs text-destructive border-destructive/30 bg-destructive/10"
                        >
                          ₹{customer.__metrics.totalDue.toLocaleString("en-IN")} Due
                        </Badge>
                      ) : customer.__metrics.totalInvoices > 0 ? (
                        <Badge variant="success" className="font-medium text-xs">
                          All Paid
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Joined Date */}
                    <TableCell className="text-center text-xs text-muted-foreground whitespace-nowrap">
                      {customer.created_at
                        ? format(new Date(customer.created_at), "dd MMM yyyy")
                        : "—"}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${customer.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(customer);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${customer.name}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomerToDelete(customer);
                            setDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Floating Sticky Summary Footer */}
      <FloatingTableFooter
        totalCount={sortedCustomers.length}
        itemName="Customers"
        metrics={footerMetrics}
        showFinancials={isAdmin}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetAllFilters}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{customerToDelete?.name}</span>?
              <br />
              This action cannot be undone. If this customer has invoices,
              deletion will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => customerToDelete && deleteMutation.mutate(customerToDelete.id)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
