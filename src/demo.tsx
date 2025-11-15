import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InvoiceView } from "@/components/InvoiceView";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Search, Eye, UserPlus, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export default function Invoices() {
    const [open, setOpen] = useState(false);
    const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [invoiceToDelete, setInvoiceToDelete] = useState<any>(null);
    const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [paymentFilter, setPaymentFilter] = useState<string>("all");
    const [dateFilter, setDateFilter] = useState<string>("");
    const [customerComboboxOpen, setCustomerComboboxOpen] = useState(false);
    const navigate = useNavigate();
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        invoice_number: "",
        customer_id: "",
        date: new Date().toISOString().split("T")[0],
        subtotal: "0",
        tax: "0",
        discount: "0",
        discount_type: "fixed",
        coupon_code: "",
        offer_description: "",
        total: "0",
        payment_method: "cash",
        payment_status: "unpaid",
        paid_amount: "0",
    });
    const [newCustomer, setNewCustomer] = useState({
        name: "",
        phone: "",
        email: "",
        address: "",
    });
    const [items, setItems] = useState<any[]>([
        { name: "", qty: "1", unit_price: "0", num_products: "1" },
    ]);
    const queryClient = useQueryClient();

    // Auto-generate invoice number when dialog opens
    useEffect(() => {
        if (open) {
            generateInvoiceNumber();
        }
    }, [open]);

    const generateInvoiceNumber = async () => {
        const { data } = await supabase
            .from("invoices")
            .select("invoice_number")
            .order("created_at", { ascending: false })
            .limit(1);

        if (data && data.length > 0) {
            const lastNumber = data[0].invoice_number;
            const match = lastNumber.match(/INV-(\d+)/);
            if (match) {
                const nextNum = parseInt(match[1]) + 1;
                setFormData(prev => ({
                    ...prev,
                    invoice_number: `INV-${nextNum.toString().padStart(3, '0')}`
                }));
            } else {
                setFormData(prev => ({ ...prev, invoice_number: "INV-001" }));
            }
        } else {
            setFormData(prev => ({ ...prev, invoice_number: "INV-001" }));
        }
    };

    const { data: invoices, isLoading } = useQuery({
        queryKey: ["invoices"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("invoices")
                .select(`
          *, 
          customers(name),
          orders(payment_status)
        `)
                .order("created_at", { ascending: false });
            if (error) throw error;
            return data;
        },
    });

    const { data: customers } = useQuery({
        queryKey: ["customers"],
        queryFn: async () => {
            const { data, error } = await supabase.from("customers").select("*");
            if (error) throw error;
            return data;
        },
    });

    const { data: products } = useQuery({
        queryKey: ["products"],
        queryFn: async () => {
            const { data, error } = await supabase.from("products").select("*");
            if (error) throw error;
            return data;
        },
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const { data: profile } = await supabase
                .from("profiles")
                .select("id")
                .eq("user_id", user?.id)
                .single();

            const { data: invoice, error: invoiceError } = await supabase
                .from("invoices")
                .insert([{
                    invoice_number: data.invoice_number,
                    customer_id: data.customer_id,
                    date: data.date,
                    subtotal: parseFloat(data.subtotal),
                    tax: parseFloat(data.tax),
                    total: parseFloat(data.total),
                    payment_method: data.payment_method,
                    uploaded_by: profile?.id,
                    raw_payload: {
                        items: data.items,
                        discount: data.discount,
                        discount_type: data.discount_type,
                        coupon_code: data.coupon_code,
                        offer_description: data.offer_description,
                        payment_status: data.payment_status,
                        paid_amount: data.paid_amount,
                    },
                }])
                .select()
                .single();

            if (invoiceError) throw invoiceError;

            const itemsData = data.items.map((item: any) => ({
                invoice_id: invoice.id,
                sku: item.name, // Using name as identifier since SKU is removed
                name: item.name,
                qty: parseFloat(item.qty),
                unit_price: parseFloat(item.unit_price),
                total: parseFloat(item.qty) * parseFloat(item.unit_price),
            }));

            const { error: itemsError } = await supabase
                .from("invoice_items")
                .insert(itemsData);

            if (itemsError) throw itemsError;

            // Create orders based on num_products per item
            const ordersToInsert: any[] = [];
            data.items.forEach((item: any) => {
                const numProducts = parseInt(item.num_products) || 1;
                for (let i = 0; i < numProducts; i++) {
                    const orderCode = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    ordersToInsert.push({
                        order_code: orderCode,
                        invoice_id: invoice.id,
                        customer_id: data.customer_id,
                        total_amount: (parseFloat(item.qty) * parseFloat(item.unit_price)) / numProducts,
                        order_status: "pending",
                        payment_status: data.payment_status,
                        created_by: profile?.id,
                        metadata: {
                            item,
                            product_index: i + 1,
                            total_products: numProducts,
                        },
                    });
                }
            });

            const { data: newOrders, error: orderError } = await supabase
                .from("orders")
                .insert(ordersToInsert)
                .select();

            if (orderError) throw orderError;

            // Create initial "Ordered" stage for each order
            if (newOrders) {
                const stagesToInsert = newOrders.map(order => ({
                    order_id: order.id,
                    stage_name: "Ordered",
                    status: "done",
                    start_ts: data.date,
                    end_ts: data.date,
                }));

                await supabase.from("order_stages").insert(stagesToInsert);
            }

            return invoice;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            toast.success("Invoice and order created");
            setOpen(false);
            resetForm();
        },
    });

    const createCustomerMutation = useMutation({
        mutationFn: async (data: typeof newCustomer) => {
            const { data: customer, error } = await supabase
                .from("customers")
                .insert([data])
                .select()
                .single();
            if (error) throw error;
            return customer;
        },
        onSuccess: (customer) => {
            queryClient.invalidateQueries({ queryKey: ["customers"] });
            setFormData({ ...formData, customer_id: customer.id });
            setCustomerDialogOpen(false);
            setNewCustomer({ name: "", phone: "", email: "", address: "" });
            toast.success("Customer added successfully");
        },
        onError: () => {
            toast.error("Failed to add customer");
        },
    });

    const handleAddCustomer = (e: React.FormEvent) => {
        e.preventDefault();
        createCustomerMutation.mutate(newCustomer);
    };

    const resetForm = () => {
        setFormData({
            invoice_number: "",
            customer_id: "",
            date: new Date().toISOString().split("T")[0],
            subtotal: "0",
            tax: "0",
            discount: "0",
            discount_type: "fixed",
            coupon_code: "",
            offer_description: "",
            total: "0",
            payment_method: "cash",
            payment_status: "unpaid",
            paid_amount: "0",
        });
        setItems([{ name: "", qty: "1", unit_price: "0", num_products: "1" }]);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createMutation.mutate({ ...formData, items });
    };

    const updateTotals = (updatedItems: any[], discountValue?: string, discountTypeValue?: string) => {
        const subtotal = updatedItems.reduce(
            (sum, item) => sum + parseFloat(item.qty || 0) * parseFloat(item.unit_price || 0),
            0
        );
        const tax = subtotal * 0; // No tax for now

        const discount = parseFloat(discountValue || formData.discount || "0");
        const discountType = discountTypeValue || formData.discount_type;

        let discountAmount = 0;
        if (discountType === "percentage") {
            discountAmount = (subtotal * discount) / 100;
        } else {
            discountAmount = discount;
        }

        const total = subtotal + tax - discountAmount;

        setFormData(prev => ({
            ...prev,
            subtotal: subtotal.toString(),
            tax: tax.toString(),
            total: Math.max(0, total).toString()
        }));
    };

    const addItem = () => {
        setItems([...items, { name: "", qty: "1", unit_price: "0", num_products: "1" }]);
    };

    const removeItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
        updateTotals(newItems);
    };

    const updateItem = (index: number, field: string, value: string) => {
        const newItems = [...items];
        newItems[index][field] = value;

        setItems(newItems);
        updateTotals(newItems);
    };

    // Filter invoices
    const filteredInvoices = invoices?.filter(invoice => {
        const matchesSearch =
            invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            invoice.customers?.name.toLowerCase().includes(searchQuery.toLowerCase());

        const matchesPayment =
            paymentFilter === "all" ||
            (paymentFilter === "paid" && invoice.orders?.every((o: any) => o.payment_status === "paid")) ||
            (paymentFilter === "unpaid" && invoice.orders?.some((o: any) => o.payment_status !== "paid"));

        const matchesDate = !dateFilter ||
            new Date(invoice.date).toISOString().split("T")[0] === dateFilter;

        return matchesSearch && matchesPayment && matchesDate;
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            // First delete related invoice items
            const { error: itemsError } = await supabase
                .from("invoice_items")
                .delete()
                .eq("invoice_id", id);

            if (itemsError) throw itemsError;

            // Then delete related orders and their stages
            const { data: relatedOrders } = await supabase
                .from("orders")
                .select("id")
                .eq("invoice_id", id);

            if (relatedOrders && relatedOrders.length > 0) {
                // Delete order stages first
                for (const order of relatedOrders) {
                    await supabase
                        .from("order_stages")
                        .delete()
                        .eq("order_id", order.id);
                }

                // Then delete orders
                const { error: ordersError } = await supabase
                    .from("orders")
                    .delete()
                    .eq("invoice_id", id);

                if (ordersError) throw ordersError;
            }

            // Finally delete the invoice
            const { error } = await supabase.from("invoices").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["invoices"] });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            toast.success("Invoice and related data deleted successfully");
            setDeleteDialogOpen(false);
            setInvoiceToDelete(null);
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to delete invoice");
            setDeleteDialogOpen(false);
            setInvoiceToDelete(null);
        },
    });

    return (
        <div className="space-y-6 p-4 md:p-0">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <h1 className="text-3xl font-bold">Invoices</h1>
                <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) resetForm(); }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="w-4 h-4 mr-2" />
                            Create Invoice
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Create Invoice</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="invoice_number">Invoice Number *</Label>
                                    <Input
                                        id="invoice_number"
                                        value={formData.invoice_number}
                                        onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                                        required
                                        disabled
                                        className="bg-muted"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <Label htmlFor="customer_id">Customer *</Label>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => setCustomerDialogOpen(true)}
                                            className="h-auto py-1 px-2"
                                        >
                                            <UserPlus className="w-3 h-3 mr-1" />
                                            Add New
                                        </Button>
                                    </div>
                                    <Popover open={customerComboboxOpen} onOpenChange={setCustomerComboboxOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={customerComboboxOpen}
                                                className="w-full justify-between"
                                            >
                                                {formData.customer_id
                                                    ? customers?.find((customer) => customer.id === formData.customer_id)?.name
                                                    : "Select customer..."}
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[400px] p-0" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search customers..." />
                                                <CommandList>
                                                    <CommandEmpty>No customer found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {customers?.map((customer) => (
                                                            <CommandItem
                                                                key={customer.id}
                                                                value={`${customer.name} ${customer.phone || ""}`}
                                                                onSelect={() => {
                                                                    setFormData({ ...formData, customer_id: customer.id });
                                                                    setCustomerComboboxOpen(false);
                                                                }}
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "mr-2 h-4 w-4",
                                                                        formData.customer_id === customer.id ? "opacity-100" : "opacity-0"
                                                                    )}
                                                                />
                                                                {customer.name} {customer.phone && `(${customer.phone})`}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div>
                                    <Label htmlFor="date">Date *</Label>
                                    <Input
                                        id="date"
                                        type="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                        required
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="payment_method">Payment Method</Label>
                                    <Select
                                        value={formData.payment_method}
                                        onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="cash">Cash</SelectItem>
                                            <SelectItem value="card">Card</SelectItem>
                                            <SelectItem value="upi">UPI</SelectItem>
                                            <SelectItem value="other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <div className="flex justify-between items-center">
                                    <Label>Items</Label>
                                    <Button type="button" size="sm" onClick={addItem}>
                                        <Plus className="w-4 h-4 mr-1" />
                                        Add Item
                                    </Button>
                                </div>
                                {items.map((item, index) => (
                                    <div key={index} className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end border p-3 rounded-lg">
                                        <div className="sm:col-span-1">
                                            <Label className="text-xs sm:text-sm">Name *</Label>
                                            <Input
                                                value={item.name}
                                                onChange={(e) => updateItem(index, "name", e.target.value)}
                                                required
                                                className="text-sm"
                                            />
                                        </div>
                                        <div className="sm:col-span-1">
                                            <Label className="text-xs sm:text-sm">Qty *</Label>
                                            <Input
                                                type="number"
                                                value={item.qty}
                                                onChange={(e) => updateItem(index, "qty", e.target.value)}
                                                required
                                                className="text-sm"
                                            />
                                        </div>
                                        <div className="sm:col-span-1">
                                            <Label className="text-xs sm:text-sm">Price *</Label>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                value={item.unit_price}
                                                onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                                                required
                                                className="text-sm"
                                            />
                                        </div>
                                        <div className="sm:col-span-1">
                                            <Label className="text-xs sm:text-sm">Products *</Label>
                                            <Select
                                                value={item.num_products}
                                                onValueChange={(value) => updateItem(index, "num_products", value)}
                                            >
                                                <SelectTrigger className="text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="1">1</SelectItem>
                                                    <SelectItem value="2">2</SelectItem>
                                                    <SelectItem value="3">3</SelectItem>
                                                    <SelectItem value="4">4</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="sm:col-span-1">
                                            <Label className="text-xs sm:text-sm">Total</Label>
                                            <Input
                                                value={`₹${(parseFloat(item.qty || 0) * parseFloat(item.unit_price || 0)).toFixed(2)}`}
                                                disabled
                                                className="bg-muted text-sm"
                                            />
                                        </div>
                                        <div className="sm:col-span-1 flex justify-end">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeItem(index)}
                                                disabled={items.length === 1}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Discounts & Offers */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t pt-4">
                                <div>
                                    <Label htmlFor="coupon_code">Coupon Code</Label>
                                    <Input
                                        id="coupon_code"
                                        value={formData.coupon_code}
                                        onChange={(e) => setFormData({ ...formData, coupon_code: e.target.value })}
                                        placeholder="Enter coupon code"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="offer_description">Offer/Promotion</Label>
                                    <Input
                                        id="offer_description"
                                        value={formData.offer_description}
                                        onChange={(e) => setFormData({ ...formData, offer_description: e.target.value })}
                                        placeholder="e.g. Buy 1 Get 1 Free"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="sm:col-span-2">
                                    <Label htmlFor="discount">Discount Amount</Label>
                                    <Input
                                        id="discount"
                                        type="number"
                                        step="0.01"
                                        value={formData.discount}
                                        onChange={(e) => {
                                            setFormData({ ...formData, discount: e.target.value });
                                            updateTotals(items, e.target.value, formData.discount_type);
                                        }}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="discount_type">Type</Label>
                                    <Select
                                        value={formData.discount_type}
                                        onValueChange={(value) => {
                                            setFormData({ ...formData, discount_type: value });
                                            updateTotals(items, formData.discount, value);
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="fixed">₹ Fixed</SelectItem>
                                            <SelectItem value="percentage">% Percentage</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="border-t pt-4 space-y-2">
                                <div className="flex justify-between">
                                    <span>Subtotal:</span>
                                    <span className="font-medium">₹{parseFloat(formData.subtotal).toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Tax:</span>
                                    <span className="font-medium">₹{parseFloat(formData.tax).toFixed(2)}</span>
                                </div>
                                {parseFloat(formData.discount) > 0 && (
                                    <div className="flex justify-between text-green-600">
                                        <span>Discount ({formData.discount_type === "percentage" ? `${formData.discount}%` : `₹${formData.discount}`}):</span>
                                        <span className="font-medium">
                                            -₹{(formData.discount_type === "percentage"
                                                ? (parseFloat(formData.subtotal) * parseFloat(formData.discount)) / 100
                                                : parseFloat(formData.discount)).toFixed(2)}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total:</span>
                                    <span>₹{parseFloat(formData.total).toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Payment Section */}
                            <div className="border-t pt-4 space-y-4">
                                <div>
                                    <Label htmlFor="payment_status">Payment Status *</Label>
                                    <Select
                                        value={formData.payment_status}
                                        onValueChange={(value) => setFormData({ ...formData, payment_status: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="unpaid">Unpaid</SelectItem>
                                            <SelectItem value="partial">Partial Payment</SelectItem>
                                            <SelectItem value="paid">Fully Paid</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {(formData.payment_status === "partial" || formData.payment_status === "paid") && (
                                    <div>
                                        <Label htmlFor="paid_amount">Paid Amount *</Label>
                                        <Input
                                            id="paid_amount"
                                            type="number"
                                            step="0.01"
                                            value={formData.paid_amount}
                                            onChange={(e) => setFormData({ ...formData, paid_amount: e.target.value })}
                                            required
                                        />
                                    </div>
                                )}

                                {formData.payment_status === "partial" && parseFloat(formData.paid_amount) > 0 && (
                                    <div className="flex justify-between text-amber-600 font-semibold">
                                        <span>Remaining Amount:</span>
                                        <span>₹{Math.max(0, parseFloat(formData.total) - parseFloat(formData.paid_amount)).toFixed(2)}</span>
                                    </div>
                                )}
                            </div>

                            <Button type="submit" className="w-full">
                                Create Invoice & Order
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>

                {/* Add Customer Dialog */}
                <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Add New Customer</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleAddCustomer} className="space-y-4">
                            <div>
                                <Label htmlFor="new_customer_name">Name *</Label>
                                <Input
                                    id="new_customer_name"
                                    value={newCustomer.name}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <Label htmlFor="new_customer_phone">Phone</Label>
                                <Input
                                    id="new_customer_phone"
                                    value={newCustomer.phone}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="new_customer_email">Email</Label>
                                <Input
                                    id="new_customer_email"
                                    type="email"
                                    value={newCustomer.email}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="new_customer_address">Address</Label>
                                <Input
                                    id="new_customer_address"
                                    value={newCustomer.address}
                                    onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                                />
                            </div>
                            <div className="flex justify-end gap-2">
                                <Button type="button" variant="outline" onClick={() => setCustomerDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button type="submit">Add Customer</Button>
                            </div>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search & Filter */}
            <Card className="p-6">
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Search className="h-5 w-5 text-muted-foreground" />
                        <h2 className="text-xl font-semibold">Search & Filter Invoices</h2>
                    </div>

                    <div className="flex flex-col md:flex-row gap-4">
                        <Input
                            placeholder="Search by invoice number or customer..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="flex-1"
                        />

                        <Input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            className="w-full md:w-auto"
                        />

                        <Tabs value={paymentFilter} onValueChange={setPaymentFilter} className="w-full md:w-auto">
                            <TabsList className="grid grid-cols-3 w-full md:w-auto">
                                <TabsTrigger value="all">All</TabsTrigger>
                                <TabsTrigger value="paid">Paid</TabsTrigger>
                                <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>
            </Card>

            <Card>
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Invoice #</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Total</TableHead>
                                <TableHead>Status</TableHead>
                                <TableHead>Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center">Loading...</TableCell>
                                </TableRow>
                            ) : filteredInvoices?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center">No invoices found</TableCell>
                                </TableRow>
                            ) : (
                                filteredInvoices?.map((invoice: any) => {
                                    const isPaid = invoice.orders?.every((o: any) => o.payment_status === "paid");
                                    return (
                                        <TableRow
                                            key={invoice.id}
                                            className="cursor-pointer hover:bg-muted/50"
                                            onClick={() => setSelectedInvoice(invoice)}
                                        >
                                            <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                                            <TableCell>{invoice.customers?.name || "-"}</TableCell>
                                            <TableCell>{new Date(invoice.date).toLocaleDateString()}</TableCell>
                                            <TableCell>₹{invoice.total}</TableCell>
                                            <TableCell>
                                                <Badge variant={isPaid ? "success" : "warning"}>
                                                    {isPaid ? "Paid" : "Unpaid"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell onClick={(e) => e.stopPropagation()}>
                                                <div className="flex gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            if (invoice.orders?.[0]?.id) {
                                                                navigate(`/orders/${invoice.orders[0].id}`);
                                                            }
                                                        }}
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => {
                                                            setInvoiceToDelete(invoice);
                                                            setDeleteDialogOpen(true);
                                                        }}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            )}
                        </TableBody>
                    </Table>
                </div>
            </Card>

            {selectedInvoice && (
                <InvoiceView
                    invoice={selectedInvoice}
                    open={!!selectedInvoice}
                    onOpenChange={(open) => !open && setSelectedInvoice(null)}
                />
            )}

            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete invoice <strong>{invoiceToDelete?.invoice_number}</strong>?
                            This will also delete all related orders and items. This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setInvoiceToDelete(null)}>
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => invoiceToDelete && deleteMutation.mutate(invoiceToDelete.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
