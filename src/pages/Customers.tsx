import { useState, useMemo, useEffect } from "react";
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
import { Plus, Pencil, Trash2, Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export default function Customers() {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<any>(null);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    dob: "",
    anniversary: "",
  });

  useEffect(() => {
    const state = location.state as any;
    if (!state) return;

    if (state.searchQuery !== undefined) {
      setSearchQuery(state.searchQuery);
    }

    if (state.filterType) {
      setFilterType(state.filterType);
    }

    if (state.scrollY !== undefined) {
      requestAnimationFrame(() => {
        window.scrollTo(0, state.scrollY);
      });
    }

    // ✅ clear navigation state
    navigate(location.pathname, { replace: true });
  }, []);

  const queryClient = useQueryClient();

  // 🧭 Fetch customers with related invoices
  const { data: customers, isLoading } = useQuery({
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

  // ➕ Create customer
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

  // ✏️ Update customer
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

  // ❌ Delete customer with dependency check
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: relatedInvoices, error } = await supabase
        .from("invoices")
        .select("id")
        .eq("customer_id", id);

      if (error) throw error;

      if (relatedInvoices?.length > 0) {
        throw new Error(`Cannot delete: Customer has ${relatedInvoices.length} invoice(s).`);
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

  // 🧹 Reset form
  const resetForm = () => {
    setFormData({ name: "", phone: "", email: "", address: "", dob: "", anniversary: "" });
    setEditingCustomer(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      name: formData.name,
      phone: formData.phone || null,
      email: formData.email || null,
      address: formData.address || null,
      dob: formData.dob || null,
      anniversary: formData.anniversary || null,
    };

    if (editingCustomer) {
      updateMutation.mutate({ id: editingCustomer.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (customer: any) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      phone: customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
      dob: customer.dob || "",
      anniversary: customer.anniversary || "",
    });
    setOpen(true);
  };

  // 🧮 Filter & search customers
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.toLowerCase();

    return customers
      ?.filter((c: any) => {
        const matchesSearch =
          c.name?.toLowerCase().includes(q) || c.phone?.toLowerCase().includes(q);

        const hasInvoices = c.invoices && c.invoices.length > 0;
        const hasPending = c.invoices?.some((inv: any) => inv.payment_status !== "paid");
        const allPaid =
          hasInvoices && c.invoices.every((inv: any) => inv.payment_status === "paid");

        if (filterType === "pending") return hasPending && matchesSearch;
        if (filterType === "paid") return allPaid && matchesSearch;
        if (filterType === "no-invoices") return !hasInvoices && matchesSearch;

        return matchesSearch; // "all"
      })
      .sort((a: any, b: any) => a.name.localeCompare(b.name));
  }, [customers, searchQuery, filterType]);

  return (
    <div className="space-y-6">
      {/* 🧾 Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Customers</h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Customer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingCustomer ? "Edit Customer" : "Add Customer"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="anniversary">Anniversary</Label>
                <Input
                  id="anniversary"
                  type="date"
                  value={formData.anniversary}
                  onChange={(e) => setFormData({ ...formData, anniversary: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full">
                {editingCustomer ? "Update" : "Create"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 🔍 Search & Filter (Tabs Style) */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-xl font-semibold">Search & Filter Customers</h2>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <Input
              placeholder="Search by name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />

            <Tabs value={filterType} onValueChange={setFilterType} className="w-full md:w-auto">
              <TabsList className="grid grid-cols-4 w-full md:w-auto">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="no-invoices">No Invoices</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </Card>

      {/* 🧍 Customers Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Address</TableHead>
              {/* <TableHead>Invoices</TableHead> */}
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">Loading...</TableCell>
              </TableRow>
            ) : filteredCustomers?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">No customers found</TableCell>
              </TableRow>
            ) : (
              filteredCustomers?.map((customer: any) => (
                <TableRow key={customer.id} className="cursor-pointer"
                  // onClick={() => navigate(`/customers/${customer.id}`)}
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
                  <TableCell>{customer.phone || "-"}</TableCell>
                  <TableCell>{customer.email || "-"}</TableCell>
                  <TableCell>{customer.address || "-"}</TableCell>
                  {/* <TableCell>
                    {customer.invoices?.length > 0
                      ? `${customer.invoices.length} invoice(s)`
                      : "—"}
                  </TableCell> */}
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();           // ⛔ don't trigger row click
                          handleEdit(customer);
                        }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();           // ⛔ don't trigger row click
                          setCustomerToDelete(customer);
                          setDeleteDialogOpen(true);
                        }}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* ⚠️ Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Customer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-semibold">{customerToDelete?.name}</span>?<br />
              This action cannot be undone. If this customer has invoices, deletion will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white"
              onClick={() => deleteMutation.mutate(customerToDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
