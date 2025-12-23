import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InvoiceView } from "@/components/InvoiceView";
import { pdf } from "@react-pdf/renderer";
import { PrintableInvoice } from "@/components/PrintableInvoice";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Search, Eye, UserPlus, ChevronDown, ChevronUp, Check, ChevronsUpDown } from "lucide-react";
import { Command } from "@/components/ui/command";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { format } from "date-fns";
import { PopoverContent, Popover, PopoverTrigger } from "@/components/ui/popover";
import { CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

import { cn } from "@/lib/utils";
import { InvoiceRow } from "@/components/InvoiceRow";


export default function Invoices() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  // const [openInvoice, setOpenInvoice] = useState<any>(null);
  const [customerComboboxOpen, setCustomerComboboxOpen] = useState(false);
  const [customerInput, setCustomerInput] = useState("");
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<any>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [showDiscount, setShowDiscount] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    invoice_number: "",
    customer_id: "",
    date: new Date().toISOString().split("T")[0],
    delivery_date: new Date().toISOString().split("T")[0],
    subtotal: "0",
    tax: "0",
    discount: "0",
    discount_type: "fixed",
    coupon_code: "",
    offer_description: "",
    total: "0",
    payment_method: "cash",
    payment_status: "unpaid",
    paid_amount: "",
    remarks: "",
  });
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });
  const [items, setItems] = useState<any[]>([
    { name: "", qty: "1", unit_price: "", num_products: "1", delivery_date: new Date().toISOString().split("T")[0], reference_name: "" },
  ]);
  const queryClient = useQueryClient();

  // Auto-generate invoice number when dialog opens
  useEffect(() => {
    // ✅ Only auto-generate invoice number for NEW invoices
    if (open && !editingDraftId) {
      generateInvoiceNumber();
    }
  }, [open, editingDraftId]);


  // const generateInvoiceNumber = async () => {
  //   const { data } = await (supabase as any)
  //     .from("invoices")
  //     .select("invoice_number")
  //     .order("created_at", { ascending: false });

  //   if (data && data.length > 0) {
  //     // Extract numbers like 001, 002, 021
  //     const numbers = data
  //       .map(inv => {
  //         const match = inv.invoice_number?.match(/INV-(\d+)/);
  //         return match ? parseInt(match[1]) : null;
  //       })
  //       .filter(n => n !== null);

  //     const maxNum = Math.max(...numbers);
  //     const nextNum = maxNum + 1;

  //     setFormData(prev => ({
  //       ...prev,
  //       invoice_number: `INV-${String(nextNum).padStart(3, "0")}`,
  //     }));
  //   } else {
  //     setFormData(prev => ({ ...prev, invoice_number: "INV-001" }));
  //   }
  // };

  const generateInvoiceNumber = async () => {
    const { data, error } = await supabase
      .from("invoices")
      .select("invoice_number")
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Invoice number fetch error:", error);
      setFormData(prev => ({ ...prev, invoice_number: "INV-001" }));
      return;
    }

    if (data && data.length > 0) {
      const last = data[0].invoice_number;
      const match = last.match(/INV-(\d+)/);

      const nextNum = match ? parseInt(match[1]) + 1 : 1;
      setFormData(prev => ({
        ...prev,
        invoice_number: `INV-${String(nextNum).padStart(3, "0")}`,
      }));
    } else {
      setFormData(prev => ({ ...prev, invoice_number: "INV-001" }));
    }
  };


  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoices")
        .select(`
          *, 
          customers(id, name, phone, email, address),
          orders(payment_status)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // useEffect(() => {
  //   const invoiceId = location.state?.openInvoiceId;
  //   if (!invoiceId) return;

  //   const invoice = invoices.find((i) => i.id === invoiceId);
  //   if (invoice) {
  //     // setOpenInvoice(invoice);
  //     setSelectedInvoice(invoice);
  //   }
  //   // Clean up state so refresh doesn't reopen
  //   // window.history.replaceState({}, "");
  //   // Instead of replaceState (which is low-level)
  //   navigate(location.pathname, { replace: true });
  // }, [location.state, invoices]);

  const { data: customers } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("customers").select("*");
      if (error) throw error;
      return data;
    },
  });

  const { data: products } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("products").select("*");
      if (error) throw error;
      return data;
    },
  });

  const generateAndStoreInvoicePDF = async (invoice: any) => {
    // Safety: don't regenerate
    if (invoice.file_url) return invoice.file_url;

    const blob = await pdf(
      <PrintableInvoice
        data={{
          ...invoice,
          delivery_date: invoice.raw_payload?.delivery_date,
          isPaid: invoice.payment_status === "paid",
          paidAmount: parseFloat(invoice.raw_payload?.paid_amount || 0),
          remainingBalance:
            parseFloat(invoice.total) -
            parseFloat(invoice.raw_payload?.paid_amount || 0),
        }}
        payments={[]} // optional, safe default
      />
    ).toBlob();

    const fileName = `invoice-${invoice.invoice_number}.pdf`;

    const { data: upload, error: uploadError } = await supabase.storage
      .from("invoices")
      .upload(fileName, blob, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      console.error("PDF upload failed:", uploadError);
      throw uploadError;
    }
    const publicUrl = supabase.storage
      .from("invoices")
      .getPublicUrl(upload.path).data.publicUrl;

    const { error: updateError } = await (supabase as any)
      .from("invoices")
      .update({ file_url: publicUrl })
      .eq("id", invoice.id);

    if (updateError) {
      console.error("PDF URL save failed:", updateError);
      throw updateError;
    }
    console.log("Generating invoice PDF for:", invoice.invoice_number);
    return publicUrl;
  };

  const saveDraftMutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      if (editingDraftId) {
        // Update existing draft
        const { data: invoice, error: invoiceError } = await (supabase as any)
          .from("invoices")
          .update({
            customer_id: data.customer_id,
            date: data.date,
            subtotal: parseFloat(data.subtotal),
            tax: parseFloat(data.tax),
            total: parseFloat(data.total),
            payment_method: data.payment_method,
            payment_status: data.payment_status,
            raw_payload: {
              items: data.items,
              discount: data.discount,
              discount_type: data.discount_type,
              coupon_code: data.coupon_code,
              offer_description: data.offer_description,
              paid_amount: data.paid_amount,
              delivery_date: data.delivery_date,
              remarks: data.remarks || "",
            },
            status: "draft",
          })
          .eq("id", editingDraftId)
          .select()
          .single();

        if (invoiceError) throw invoiceError;

        // Delete existing items and re-insert
        await (supabase as any)
          .from("invoice_items")
          .delete()
          .eq("invoice_id", editingDraftId);

        const itemsData = data.items.map((item: any) => ({
          invoice_id: invoice.id,
          sku: item.name,
          name: item.name,
          qty: parseFloat(item.qty),
          unit_price: parseFloat(item.unit_price),
          total: parseFloat(item.qty) * parseFloat(item.unit_price),
          reference_name: item.reference_name ?? null, // ← added
        }));

        const { error: itemsError } = await (supabase as any)
          .from("invoice_items")
          .insert(itemsData);

        if (itemsError) throw itemsError;

        return invoice;
      } else {
        // Create new draft
        const { data: invoice, error: invoiceError } = await (supabase as any)
          .from("invoices")
          .insert([{
            invoice_number: data.invoice_number,
            customer_id: data.customer_id,
            date: data.date,
            subtotal: parseFloat(data.subtotal),
            tax: parseFloat(data.tax),
            total: parseFloat(data.total),
            payment_method: data.payment_method,
            payment_status: data.payment_status,
            uploaded_by: profile?.id,
            raw_payload: {
              items: data.items,
              discount: data.discount,
              discount_type: data.discount_type,
              coupon_code: data.coupon_code,
              offer_description: data.offer_description,
              paid_amount: data.paid_amount,
              delivery_date: data.delivery_date,
              remarks: data.remarks || "",
            },
            status: "draft",
          }])
          .select()
          .single();

        if (invoiceError) throw invoiceError;

        const itemsData = data.items.map((item: any) => ({
          invoice_id: invoice.id,
          sku: item.name,
          name: item.name,
          qty: parseFloat(item.qty),
          unit_price: parseFloat(item.unit_price),
          total: parseFloat(item.qty) * parseFloat(item.unit_price),
          reference_name: item.reference_name ?? null, // ✅ added

        }));

        const { error: itemsError } = await (supabase as any)
          .from("invoice_items")
          .insert(itemsData);

        if (itemsError) throw itemsError;

        return invoice;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(editingDraftId ? "Draft updated" : "Invoice saved as draft");
      setOpen(false);
      setEditingDraftId(null);
      resetForm();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      // fetch profile
      const { data: profile } = await (supabase as any)
        .from("profiles")
        .select("id")
        .eq("user_id", user?.id)
        .single();

      let invoice;

      // ------- CREATE or FINALIZE INVOICE -------
      if (editingDraftId) {
        // Finalize existing draft invoice
        const { data: updatedInvoice, error: invoiceError } = await (supabase as any)
          .from("invoices")
          .update({
            customer_id: data.customer_id,
            date: data.date,
            subtotal: parseFloat(data.subtotal),
            tax: parseFloat(data.tax),
            total: parseFloat(data.total),
            payment_method: data.payment_method,
            payment_status: data.payment_status || "unpaid",
            raw_payload: {
              items: data.items,
              discount: data.discount,
              discount_type: data.discount_type,
              coupon_code: data.coupon_code,
              offer_description: data.offer_description,
              paid_amount: data.paid_amount,
              delivery_date: data.delivery_date,
              remarks: data.remarks || "",
            },
            status: "finalized",
          })
          .eq("id", editingDraftId)
          .select()
          .single();

        if (invoiceError) {
          console.error("Invoice update error:", invoiceError);
          throw invoiceError;
        }
        invoice = updatedInvoice;

        // Delete and re-insert invoice_items for the draft (keeps items in sync)
        const { error: delItemsError } = await (supabase as any)
          .from("invoice_items")
          .delete()
          .eq("invoice_id", editingDraftId);

        if (delItemsError) {
          console.error("Failed to delete previous invoice_items:", delItemsError);
          throw delItemsError;
        }
      } else {
        // Create new invoice
        const { data: newInvoice, error: invoiceError } = await (supabase as any)
          .from("invoices")
          .insert([{
            invoice_number: data.invoice_number,
            customer_id: data.customer_id,
            date: data.date,
            subtotal: parseFloat(data.subtotal),
            tax: parseFloat(data.tax),
            total: parseFloat(data.total),
            payment_method: data.payment_method,
            payment_status: data.payment_status || "unpaid",
            uploaded_by: profile?.id,
            raw_payload: {
              items: data.items,
              discount: data.discount,
              discount_type: data.discount_type,
              coupon_code: data.coupon_code,
              offer_description: data.offer_description,
              paid_amount: data.paid_amount,
              delivery_date: data.delivery_date,
              remarks: data.remarks || "",
            },
            status: "finalized",
          }])
          .select()
          .single();

        if (invoiceError) {
          console.error("Invoice create error:", invoiceError);
          throw invoiceError;
        }
        invoice = newInvoice;
      }

      // Sanity check: invoice must exist
      if (!invoice || !invoice.id) {
        console.error("Invoice creation/update returned no id. invoice:", invoice);
        throw new Error("Invoice not created — aborting order creation.");
      }

      // ------- INSERT invoice_items -------
      const itemsData = data.items.map((item: any) => ({
        invoice_id: invoice.id,
        sku: item.name,
        name: item.name,
        qty: parseFloat(item.qty),
        unit_price: parseFloat(item.unit_price),
        total: parseFloat(item.qty) * parseFloat(item.unit_price),
        reference_name: item.reference_name ?? null,
      }));

      const { error: itemsError } = await (supabase as any)
        .from("invoice_items")
        .insert(itemsData);

      if (itemsError) {
        console.error("invoice_items insert error:", itemsError);
        throw itemsError;
      }

      // ------- ORDERS: avoid duplicates when finalizing a draft -------
      // If we are finalizing a draft (editingDraftId) then check if orders already exist.
      const { data: existingOrders, error: existingOrdersError } = await (supabase as any)
        .from("orders")
        .select("id")
        .eq("invoice_id", invoice.id)
        .limit(1);

      if (existingOrdersError) {
        console.error("Error checking existing orders:", existingOrdersError);
        throw existingOrdersError;
      }

      const shouldCreateOrders = !existingOrders || existingOrders.length === 0;

      if (!shouldCreateOrders) {
        // Orders already exist for this invoice — skip creating them again.
        console.info("Orders already exist for invoice, skipping orders creation. invoice.id=", invoice.id);
        return invoice;
      }

      // ------- CREATE ORDERS -------
      const ordersToInsert: any[] = [];
      data.items.forEach((item: any, itemIndex: number) => {
        const orderCode = `${data.invoice_number}-${item.name.substring(0, 3).toUpperCase()}-${itemIndex + 1}`;

        ordersToInsert.push({
          order_code: orderCode,
          invoice_id: invoice.id,
          customer_id: data.customer_id,
          total_amount: parseFloat(item.qty) * parseFloat(item.unit_price),
          order_status: "pending",
          payment_status: data.payment_status,
          created_by: profile?.id,
          metadata: {
            item_name: item.name,
            item_index: itemIndex,
            qty: parseFloat(item.qty),
            num_products: parseInt(item.num_products || 1),
            unit_price: item.unit_price,
            delivery_date: item.delivery_date,
            reference_name: item.reference_name,
          },
        });
      });

      const { data: newOrders, error: orderError } = await (supabase as any)
        .from("orders")
        .insert(ordersToInsert)
        .select();

      if (orderError) {
        console.error("orders insert error:", orderError);
        throw orderError;
      }

      // ------- CREATE order_stages for each product in each order -------
      const stagesToInsert: any[] = [];
      (newOrders || []).forEach((order: any) => {
        const numProducts = parseInt(order.metadata?.num_products || 1);
        for (let productNum = 1; productNum <= numProducts; productNum++) {
          stagesToInsert.push({
            order_id: order.id,
            stage_name: "Ordered",
            status: "done",
            start_ts: new Date().toISOString(),
            end_ts: new Date().toISOString(),
            metadata: {
              product_number: productNum,
              product_name: `${order.metadata?.item_name} - Product ${productNum}`,
              auto_created: true,
            }
          });
        }
      });

      if (stagesToInsert.length > 0) {
        const { error: stagesError } = await (supabase as any)
          .from("order_stages")
          .insert(stagesToInsert);

        if (stagesError) {
          console.error("order_stages insert error:", stagesError);
          throw stagesError;
        }
      }

      // ------- GENERATE & STORE PDF (FINALIZED ONLY) -------
      try {
        const { data: freshInvoice, error } = await supabase
          .from("invoices")
          .select(`
      *,
      customers(*),
      invoice_items(*)
    `)
          .eq("id", invoice.id)
          .single();

        if (error) throw error;

        await generateAndStoreInvoicePDF(freshInvoice);
      } catch (err) {
        console.error("PDF generation failed (non-blocking):", err);
      }
      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(editingDraftId ? "Invoice finalized and order created" : "Invoice and order created");
      setOpen(false);
      setEditingDraftId(null);
      resetForm();
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (data: typeof newCustomer) => {
      const { data: customer, error } = await (supabase as any)
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
      delivery_date: new Date().toISOString().split("T")[0],
      subtotal: "0",
      tax: "0",
      discount: "0",
      discount_type: "fixed",
      coupon_code: "",
      offer_description: "",
      total: "0",
      payment_method: "cash",
      payment_status: "unpaid",
      paid_amount: "",
      remarks: "",
    });
    setItems([{ name: "", qty: "1", unit_price: "", num_products: "1", delivery_date: new Date().toISOString().split("T")[0], reference_name: "" }]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Require a customer before finalizing invoice
    if (!formData.customer_id) {
      toast.error("Please select a customer before creating the invoice.");
      return;
    }
    createMutation.mutate({ ...formData, items });
  };

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Recalculate payment status before saving
    const paidAmount = parseFloat(formData.paid_amount || "0");
    const total = parseFloat(formData.total || "0");

    const payment_status =
      paidAmount >= total
        ? "paid"
        : paidAmount > 0
          ? "partial"
          : "unpaid";

    // Correct mutation (THIS WAS WRONG BEFORE)
    saveDraftMutation.mutate({ ...formData, items, payment_status });
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
    setItems([...items, { name: "", qty: "1", unit_price: "", num_products: "1", delivery_date: formData.delivery_date, reference_name: "" }]);
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

    const isDraft = invoice.status === "draft";

    // Determine payment status
    const paymentStatus =
      invoice.payment_status ||
      invoice.raw_payload?.payment_status ||
      (invoice.orders?.every((o: any) => o.payment_status === "paid") ? "paid" : "unpaid");

    // Derived flags
    const isPaid = paymentStatus === "paid";
    const isPartial = paymentStatus === "partial";
    const isUnpaid = paymentStatus === "unpaid";



    const matchesPayment =
      paymentFilter === "all" ||
      (paymentFilter === "draft" && isDraft) ||
      (paymentFilter === "paid" && !isDraft && isPaid) ||
      (paymentFilter === "unpaid" && !isDraft && !isPaid);

    const matchesDate = !dateFilter ||
      new Date(invoice.date).toISOString().split("T")[0] === dateFilter;

    return matchesSearch && matchesPayment && matchesDate;
  });

  const deleteMutation = useMutation({
    mutationFn: async (invoiceId: string) => {
      const toastId = toast.loading("Deleting invoice and related data...");

      try {
        // Fetch related orders
        const { data: relatedOrders, error: ordersFetchError } = await supabase
          .from("orders")
          .select("id")
          .eq("invoice_id", invoiceId);

        if (ordersFetchError) {
          toast.error(`Fetch error on orders: ${ordersFetchError.message}`);
          throw ordersFetchError;
        }

        console.log("Related orders:", relatedOrders);

        // Delete order stages if any
        if (relatedOrders?.length) {
          const orderIds = relatedOrders.map((o) => o.id);

          const { error: stageError } = await supabase
            .from("order_stages")
            .delete()
            .in("order_id", orderIds);

          if (stageError) {
            toast.error(`RLS or delete error on order_stages: ${stageError.message}`);
            console.error("Stage delete failed:", stageError);
            throw stageError;
          }

          // Delete orders
          const { error: ordersError } = await supabase
            .from("orders")
            .delete()
            .in("id", orderIds);

          if (ordersError) {
            toast.error(`RLS or delete error on orders: ${ordersError.message}`);
            console.error("Orders delete failed:", ordersError);
            throw ordersError;
          }
        }

        // Delete invoice items
        const { error: itemsError } = await supabase
          .from("invoice_items")
          .delete()
          .eq("invoice_id", invoiceId);

        if (itemsError) {
          toast.error(`RLS or delete error on invoice_items: ${itemsError.message}`);
          console.error("Invoice items delete failed:", itemsError);
          throw itemsError;
        }

        // Delete invoice
        const { error: invoiceError } = await supabase
          .from("invoices")
          .delete()
          .eq("id", invoiceId);

        if (invoiceError) {
          toast.error(`RLS or delete error on invoices: ${invoiceError.message}`);
          console.error("Invoice delete failed:", invoiceError);
          throw invoiceError;
        }

        toast.success("Invoice and related data deleted successfully");
      } catch (error: any) {
        console.error("Full delete trace:", error);
        toast.error(error.message || "Delete failed - check console for details");
        throw error;
      } finally {
        toast.dismiss(toastId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    },
  });


  return (
    <div className="space-y-6 p-4 md:p-0">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
        <h1 className="text-3xl font-bold">Invoices</h1>
        <Dialog open={open} onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            resetForm();
            setEditingDraftId(null);
          }
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[100vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingDraftId ? "Edit Draft Invoice" : "Create Invoice"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              {/* Row 1: Invoice Number, Invoice Date, Delivery Date */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label htmlFor="invoice_number" className="text-xs">Invoice Number *</Label>
                  <Input
                    id="invoice_number"
                    value={formData.invoice_number}
                    onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                    required
                    disabled
                    className="bg-muted h-9"
                  />
                </div>
                <div>
                  <Label htmlFor="date" className="text-xs">Invoice Date *</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                    className="h-9"
                  />
                </div>
                <div>
                  <Label htmlFor="delivery_date" className="text-xs">Delivery Date *</Label>
                  <Input
                    id="delivery_date"
                    type="date"
                    value={formData.delivery_date}
                    onChange={(e) => {
                      const newDeliveryDate = e.target.value;
                      setFormData({ ...formData, delivery_date: newDeliveryDate });
                      setItems(items.map(item => ({ ...item, delivery_date: newDeliveryDate })));
                    }}
                    required
                    className="h-9"
                  />
                </div>
              </div>

              {/* Row 2: Customer dropdown with inline Add New */}
              {/* CUSTOMER FIELD */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label htmlFor="customer_id">Customer *</Label>

                  {/* Add New Customer Button */}
                  {/* <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setNewCustomer({ name: customerInput, phone: "", email: "", address: "" });
                      setCustomerDialogOpen(true);
                    }}
                    className="h-auto py-1 px-2"
                  >
                    <UserPlus className="w-3 h-3 mr-1" />
                    Add New
                  </Button> */}
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
                        ? (() => {
                          const c = customers?.find((x) => x.id === formData.customer_id);
                          return c ? `${c.name}${c.phone ? ` (${c.phone})` : ""}` : "Select customer...";
                        })()
                        : "Select customer..."}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>

                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search customers..."
                        value={customerInput}
                        onValueChange={(value) => {
                          setCustomerInput(value);
                          setFormData((prev) => ({ ...prev, customer_id: "" }));
                        }}
                      />

                      <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>

                        <CommandGroup>
                          {/* MATCHING CUSTOMERS */}
                          {customers
                            ?.filter((customer) =>
                              `${customer.name} ${customer.phone || ""}`
                                .toLowerCase()
                                .includes(customerInput.toLowerCase())
                            )
                            .map((customer) => (
                              <CommandItem
                                key={customer.id}
                                value={`${customer.name} ${customer.phone || ""}`}
                                onSelect={() => {
                                  setFormData({ ...formData, customer_id: customer.id });
                                  setCustomerInput(customer.name);
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

                          {/* CREATE NEW CUSTOMER IF NO MATCHING ITEM */}
                          {customers?.filter((c) =>
                            `${c.name} ${c.phone}`.toLowerCase().includes(customerInput.toLowerCase())
                          ).length === 0 && customerInput.length > 0 && (
                              <CommandItem
                                value={`Create ${customerInput}`}
                                onSelect={() => {
                                  setNewCustomer({ name: customerInput, phone: "", email: "", address: "" });
                                  setCustomerDialogOpen(true);
                                }}
                                className="text-blue-600 font-medium"
                              >
                                + Create new customer “{customerInput}”
                              </CommandItem>
                            )}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>



              {/* Items Table */}
              <div className="space-y-2">
                <Label className="text-xs">Items</Label>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="h-8 text-xs">Name *</TableHead>
                        <TableHead className="h-8 text-xs w-20">Qty *</TableHead>
                        <TableHead className="h-8 text-xs w-24">Price *</TableHead>
                        <TableHead className="h-8 text-xs w-24">Product *</TableHead>
                        <TableHead className="h-8 text-xs w-24">Total</TableHead>
                        <TableHead className="h-8 text-xs">Customer Ref</TableHead>
                        <TableHead className="h-8 text-xs w-32">Delivery Date *</TableHead>
                        <TableHead className="h-8 text-xs w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell className="p-2">
                            <Input
                              value={item.name}
                              onChange={(e) => updateItem(index, "name", e.target.value)}
                              required
                              placeholder="Item name"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="number"
                              value={item.qty}
                              onChange={(e) => updateItem(index, "qty", e.target.value)}
                              required
                              min="1"
                              className="h-8"
                            />
                            {/* updated with no zersos */}
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={item.unit_price}
                              onChange={(e) => updateItem(index, "unit_price", e.target.value.replace(/[^\d.]/g, ""))}
                              required
                              placeholder="Enter Price"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Select
                              value={item.num_products}
                              onValueChange={(value) => updateItem(index, "num_products", value)}
                            >
                              <SelectTrigger className="h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="1">1</SelectItem>
                                <SelectItem value="2">2</SelectItem>
                                <SelectItem value="3">3</SelectItem>
                                <SelectItem value="4">4</SelectItem>
                                <SelectItem value="5">5</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={`₹${(parseFloat(item.qty || 0) * parseFloat(item.unit_price || 0)).toFixed(2)}`}
                              disabled
                              className="bg-muted h-8 font-medium"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              value={item.reference_name}
                              onChange={(e) => updateItem(index, "reference_name", e.target.value)}
                              placeholder="Reference"
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Input
                              type="date"
                              value={item.delivery_date}
                              onChange={(e) => updateItem(index, "delivery_date", e.target.value)}
                              required
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell className="p-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeItem(index)}
                              disabled={items.length === 1}
                              className="h-8 w-8"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={addItem} className="w-full h-8">
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>

              {/* Collapsible Discount Section */}
              <Collapsible open={showDiscount} onOpenChange={setShowDiscount} className="border-t pt-3">
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="link" className="h-auto p-0 text-sm">
                    {showDiscount ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                    Add Discount / Coupon
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="coupon_code" className="text-xs">Coupon Code</Label>
                      <Input
                        id="coupon_code"
                        value={formData.coupon_code}
                        onChange={(e) => setFormData({ ...formData, coupon_code: e.target.value })}
                        placeholder="Enter code"
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label htmlFor="discount_type" className="text-xs">Discount Type</Label>
                      <Select
                        value={formData.discount_type}
                        onValueChange={(value) => {
                          setFormData({ ...formData, discount_type: value });
                          updateTotals(items, formData.discount, value);
                        }}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fixed">₹ Fixed</SelectItem>
                          <SelectItem value="percentage">% Percentage</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="discount" className="text-xs">Amount</Label>
                      <Input
                        id="discount"
                        type="number"
                        step="0.01"
                        value={formData.discount}
                        onChange={(e) => {
                          setFormData({ ...formData, discount: e.target.value });
                          updateTotals(items, e.target.value, formData.discount_type);
                        }}
                        placeholder="0.00"
                        className="h-9"
                      />
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>

              {/* Remarks Section */}
              <div>
                <Label htmlFor="remarks" className="text-xs">Remarks (optional)</Label>
                <textarea
                  id="remarks"
                  rows={3}
                  value={formData.remarks}
                  onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                  placeholder="Add any notes or special instructions..."
                  className="w-full border rounded-md p-2 text-sm"
                />
              </div>

              {/* Totals Section */}
              <div className="border-t pt-3 space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Subtotal:</span>
                  <span className="font-medium">₹{parseFloat(formData.subtotal).toFixed(2)}</span>
                </div>
                {parseFloat(formData.discount) > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount ({formData.discount_type === "percentage" ? `${formData.discount}%` : `₹${formData.discount}`}):</span>
                    <span className="font-medium">
                      -₹{(formData.discount_type === "percentage"
                        ? (parseFloat(formData.subtotal) * parseFloat(formData.discount)) / 100
                        : parseFloat(formData.discount)).toFixed(2)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold pt-1.5 border-t">
                  <span>Total:</span>
                  <span>₹{parseFloat(formData.total).toFixed(2)}</span>
                </div>

                {/* Advance Payment Row */}
                <div className="flex justify-between items-center pt-1.5">
                  <span className="text-sm">Advance:</span>
                  <div className="flex items-center gap-2">
                    <Select
                      value={formData.payment_method}
                      onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
                    >
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue placeholder="Mode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="card">Card</SelectItem>
                        <SelectItem value="upi">UPI</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      type="text"
                      inputMode="decimal"
                      value={formData.paid_amount}
                      onChange={(e) => {
                        // Allow only numbers and decimal points
                        const rawValue = e.target.value.replace(/[^\d.]/g, "");

                        // Convert empty string safely to 0 for calculation
                        const paidAmount = parseFloat(rawValue || "0");
                        const total = parseFloat(formData.total || "0");

                        const status =
                          paidAmount >= total
                            ? "paid"
                            : paidAmount > 0
                              ? "partial"
                              : "unpaid";

                        setFormData({
                          ...formData,
                          paid_amount: rawValue, // keep actual typed value (even "")
                          payment_status: status,
                        });
                      }}
                      placeholder="Enter Advance"
                      className="h-8 w-32 text-right"
                    />
                    <span className="font-medium min-w-[100px] text-right">₹{parseFloat(formData.paid_amount || "0").toFixed(2)}</span>
                  </div>
                </div>

                {/* Due Amount Row */}
                <div className="flex justify-between text-lg font-semibold pt-1">
                  <span>Due Amount:</span>
                  <span className="text-destructive">₹{Math.max(0, parseFloat(formData.total) - parseFloat(formData.paid_amount || "0")).toFixed(2)}</span>
                </div>
              </div>


              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleSaveDraft}
                >
                  {editingDraftId ? "Update Draft" : "Save as Draft"}
                </Button>
                <Button type="submit" className="flex-1">
                  {editingDraftId ? "Finalize & Create Order" : "Create Invoice & Order"}
                </Button>
              </div>
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
              <TabsList className="grid grid-cols-4 w-full md:w-auto">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="unpaid">Unpaid</TabsTrigger>
                <TabsTrigger value="draft">Draft</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </Card>

      <Card>
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
              filteredInvoices?.map((invoice: any) => (
                <InvoiceRow
                  key={invoice.id}
                  invoice={invoice}
                  onRowClick={() => setSelectedInvoice(invoice)}
                  onViewOrder={
                    // !invoice.status === "draft" && invoice.orders?.[0]?.id
                    invoice.status !== "draft" && invoice.orders?.[0]?.id
                      ? () => navigate(`/orders/${invoice.orders[0].id}`)
                      : undefined
                  }
                  onDelete={() => {
                    setInvoiceToDelete(invoice);
                    setDeleteDialogOpen(true);
                  }}
                />
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* 🔥 Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Invoice</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete invoice{" "}
              <b>{invoiceToDelete?.invoice_number}</b>? <br />
              This will also permanently delete related{" "}
              <b>orders</b>, <b>order stages</b>, and <b>invoice items</b>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => {
                if (invoiceToDelete) {
                  deleteMutation.mutate(invoiceToDelete.id);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      {selectedInvoice && (
        <InvoiceView
          invoice={selectedInvoice}
          open={!!selectedInvoice}
          onOpenChange={(open) => !open && setSelectedInvoice(null)}
          onEditDraft={(invoice) => {
            // Load draft data into form
            setEditingDraftId(invoice.id);
            setFormData({
              invoice_number: invoice.invoice_number,
              customer_id: invoice.customer_id,
              date: new Date(invoice.date).toISOString().split("T")[0],
              delivery_date: invoice.raw_payload?.delivery_date || new Date().toISOString().split("T")[0],
              subtotal: invoice.subtotal.toString(),
              tax: invoice.tax.toString(),
              discount: invoice.raw_payload?.discount || "0",
              discount_type: invoice.raw_payload?.discount_type || "fixed",
              coupon_code: invoice.raw_payload?.coupon_code || "",
              offer_description: invoice.raw_payload?.offer_description || "",
              total: invoice.total.toString(),
              payment_method: invoice.payment_method || "cash",
              payment_status: invoice.payment_status || "unpaid",
              paid_amount: invoice.raw_payload?.paid_amount || "0",
              remarks: invoice.raw_payload?.remarks || "",
            });
            setItems(invoice.raw_payload?.items || [{ name: "", qty: "1", unit_price: "", num_products: "1", delivery_date: new Date().toISOString().split("T")[0], reference_name: "" }]);
            setSelectedInvoice(null);
            setOpen(true);
          }}
        />
      )}
    </div>
  );
}
