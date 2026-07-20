import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
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

export default function Customers() {
  useDocumentTitle("Customers");

  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Restore the last-known scroll/search/filter state if the user came back
  // from a customer detail page.
  useEffect(() => {
    const state = location.state as any;
    if (!state) return;

    if (state.searchQuery !== undefined) setSearchQuery(state.searchQuery);
    if (state.filterType) setFilterType(state.filterType);
    if (state.scrollY !== undefined) {
      requestAnimationFrame(() => window.scrollTo(0, state.scrollY));
    }
    navigate(location.pathname, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const queryClient = useQueryClient();

  const { data: customers, isLoading, isError, refetch } = useQuery({
    queryKey: ["customers-with-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select(`
          *,
          invoices (
            id,
            total,
            payment_status
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await supabase.from("customers").insert([data]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers-with-invoices"] });
      toast.success("Customer created");
      setOpen(false);
      resetForm();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: any) => {
      const { error } = await supabase.from("customers").update(data).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers-with-invoices"] });
      toast.success("Customer updated");
      setOpen(false);
      resetForm();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: relatedInvoices, error } = await supabase
        .from("invoices")
        .select("id")
        .eq("customer_id", id);

      if (error) throw error;

      if (relatedInvoices?.length > 0) {
        throw new Error(`Cannot delete: customer has ${relatedInvoices.length} invoice(s).`);
      }

      const { error: deleteError } = await supabase.from("customers").delete().eq("id", id);
      if (deleteError) throw deleteError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers-with-invoices"] });
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

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    const q = searchQuery.trim().toLowerCase();

    return customers
      .filter((c: any) => {
        const matchesSearch =
          !q ||
          c.name?.toLowerCase().includes(q) ||
          c.phone?.toLowerCase().includes(q);

        const hasInvoices = c.invoices && c.invoices.length > 0;
        const hasPending = c.invoices?.some((inv: any) => inv.payment_status !== "paid");
        const allPaid =
          hasInvoices && c.invoices.every((inv: any) => inv.payment_status === "paid");

        if (filterType === "pending") return hasPending && matchesSearch;
        if (filterType === "paid") return allPaid && matchesSearch;
        if (filterType === "no-invoices") return !hasInvoices && matchesSearch;
        return matchesSearch;
      })
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [customers, searchQuery, filterType]);

  const isMutating = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
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

      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            <h2 className="text-xl font-semibold">Search customers</h2>
          </div>

          <div className="flex flex-col gap-4 md:flex-row">
            <Input
              placeholder="Search by name or phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search customers"
              className="flex-1"
            />

            <Tabs
              value={filterType}
              onValueChange={setFilterType}
              className="w-full md:w-auto"
            >
              <TabsList className="grid w-full grid-cols-4 md:w-auto">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="no-invoices">No invoices</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </Card>

      <Card>
        {isLoading ? (
          <LoadingState message="Loading customers…" />
        ) : isError ? (
          <ErrorState onRetry={() => refetch()} />
        ) : filteredCustomers.length === 0 ? (
          <EmptyState
            icon={<UsersIcon className="h-7 w-7" />}
            title={searchQuery || filterType !== "all" ? "No matching customers" : "No customers yet"}
            description={
              searchQuery || filterType !== "all"
                ? "Try clearing the search or switching the filter."
                : "Add your first customer to start tracking orders and invoices."
            }
            action={
              !searchQuery && filterType === "all"
                ? {
                    label: "Add customer",
                    icon: <Plus className="mr-2 h-4 w-4" />,
                    onClick: () => setOpen(true),
                  }
                : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Address</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCustomers.map((customer: any) => (
                <TableRow
                  key={customer.id}
                  className="cursor-pointer"
                  onClick={() =>
                    navigate(`/customers/${customer.id}`, {
                      state: {
                        from: "customers",
                        scrollY: window.scrollY,
                        searchQuery,
                        filterType,
                      },
                    })
                  }
                >
                  <TableCell className="font-medium">{customer.name}</TableCell>
                  <TableCell>{customer.phone || "—"}</TableCell>
                  <TableCell>{customer.email || "—"}</TableCell>
                  <TableCell className="max-w-[300px] truncate">{customer.address || "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
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
        )}
      </Card>

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
