import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAuth } from "@/lib/auth";
import {
  ArrowLeft,
  Search,
  Camera,
  Plus,
  Minus,
  Trash2,
  Calendar,
  User,
  Phone,
  Tag,
  Check,
  ChevronsUpDown,
  UserPlus,
  CreditCard,
  QrCode,
  Receipt,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  Sparkles,
  Package,
  ShoppingBag,
  Scissors,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MobileBarcodeScanner } from "@/components/MobileBarcodeScanner";
import { MobileInvoiceReceiptModal } from "@/components/invoices/MobileInvoiceReceiptModal";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface InvoiceItem {
  name: string;
  qty: string;
  unit_price: string;
  num_products: string;
  delivery_date: string;
  reference_name: string;
  sku: string;
  product_id: string | null;
  unit_codes: string[];
}

const CATEGORIES = [
  "All",
  "Sarees",
  "Lehengas",
  "Suits",
  "Fabrics",
  "Custom Tailoring",
  "Alterations",
];

export default function QuickPosBilling() {
  useDocumentTitle("Create Invoice • Touch Optimized");
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const todayStr = useMemo(() => new Date().toISOString().split("T")[0], []);

  // Form State
  const [formData, setFormData] = useState({
    invoice_number: "",
    customer_id: "",
    date: todayStr,
    delivery_date: todayStr,
    subtotal: "0",
    tax: "0",
    discount: "0",
    discount_type: "fixed",
    coupon_code: "",
    offer_description: "",
    total: "0",
    payment_method: "upi",
    payment_status: "unpaid",
    paid_amount: "",
    remarks: "",
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    {
      name: "",
      qty: "1",
      unit_price: "",
      num_products: "1",
      delivery_date: todayStr,
      reference_name: "",
      sku: "",
      product_id: null,
      unit_codes: [],
    },
  ]);

  // Touch Pickers & Modals
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
  });

  // Touch Product Picker Sheet
  const [productPickerOpen, setProductPickerOpen] = useState(false);
  const [targetItemIndex, setTargetItemIndex] = useState<number | null>(null);
  const [pickerSearchQuery, setPickerSearchQuery] = useState("");
  const [pickerCategory, setPickerCategory] = useState("All");

  // Barcode & Camera Scanner
  const [barcodeInput, setBarcodeInput] = useState("");
  const [isScanningCamera, setIsScanningCamera] = useState(false);
  const [showDiscount, setShowDiscount] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Success Receipt Modal
  const [createdInvoice, setCreatedInvoice] = useState<any>(null);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // ---------------------------------------------------------------------------
  // DATA FETCHING: Customers & Products
  // ---------------------------------------------------------------------------
  const { data: customers = [] } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, email, address")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60 * 1000,
  });

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, sku, price, purchase_price, category, stock")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    staleTime: 60 * 1000,
  });

  // Auto-generate invoice number
  const generateInvoiceNumber = async () => {
    try {
      const { data } = await supabase
        .from("invoices")
        .select("invoice_number")
        .order("created_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const last = data[0].invoice_number;
        const match = last?.match(/INV-(\d+)/);
        const nextNum = match ? parseInt(match[1]) + 1 : 1;
        setFormData((prev) => ({
          ...prev,
          invoice_number: `INV-${String(nextNum).padStart(3, "0")}`,
        }));
      } else {
        setFormData((prev) => ({ ...prev, invoice_number: "INV-001" }));
      }
    } catch (e) {
      setFormData((prev) => ({ ...prev, invoice_number: "INV-001" }));
    }
  };

  useEffect(() => {
    generateInvoiceNumber();
  }, []);

  // ---------------------------------------------------------------------------
  // TOTALS & FINANCIAL CALCULATIONS
  // ---------------------------------------------------------------------------
  const updateTotals = (
    updatedItems: InvoiceItem[],
    discountVal?: string,
    discountTypeVal?: string
  ) => {
    const subtotal = updatedItems.reduce((sum, item) => {
      const q = parseFloat(item.qty || "0");
      const p = parseFloat(item.unit_price || "0");
      return sum + (isNaN(q) || isNaN(p) ? 0 : q * p);
    }, 0);

    const discount = parseFloat(discountVal ?? formData.discount ?? "0") || 0;
    const type = discountTypeVal ?? formData.discount_type;

    let discAmount = 0;
    if (type === "percentage") {
      discAmount = (subtotal * discount) / 100;
    } else {
      discAmount = discount;
    }

    const total = Math.max(0, subtotal - discAmount);

    setFormData((prev) => ({
      ...prev,
      subtotal: subtotal.toFixed(2),
      total: total.toFixed(2),
    }));
  };

  // ---------------------------------------------------------------------------
  // CART ITEM ACTIONS
  // ---------------------------------------------------------------------------
  const addNewBlankItem = () => {
    const newItems = [
      ...items,
      {
        name: "",
        qty: "1",
        unit_price: "",
        num_products: "1",
        delivery_date: formData.delivery_date,
        reference_name: "",
        sku: "",
        product_id: null,
        unit_codes: [],
      },
    ];
    setItems(newItems);
  };

  const openProductPickerForItem = (index: number | null) => {
    setTargetItemIndex(index);
    setPickerSearchQuery("");
    setPickerCategory("All");
    setProductPickerOpen(true);
  };

  const handleSelectProductFromPicker = (product: {
    id: string | null;
    name: string;
    price: number | string;
    sku?: string;
  }) => {
    if (targetItemIndex !== null && targetItemIndex < items.length) {
      // Replace existing row
      const newItems = [...items];
      newItems[targetItemIndex] = {
        ...newItems[targetItemIndex],
        name: product.name,
        unit_price: product.price ? product.price.toString() : "0",
        sku: product.sku || "",
        product_id: product.id,
      };
      setItems(newItems);
      updateTotals(newItems);
    } else {
      // If first row is empty, replace it
      if (items.length === 1 && !items[0].name.trim()) {
        const newItems = [
          {
            name: product.name,
            qty: "1",
            unit_price: product.price ? product.price.toString() : "0",
            num_products: "1",
            delivery_date: formData.delivery_date,
            reference_name: "",
            sku: product.sku || "",
            product_id: product.id,
            unit_codes: [],
          },
        ];
        setItems(newItems);
        updateTotals(newItems);
      } else {
        // Append as new line item
        const newItems = [
          ...items,
          {
            name: product.name,
            qty: "1",
            unit_price: product.price ? product.price.toString() : "0",
            num_products: "1",
            delivery_date: formData.delivery_date,
            reference_name: "",
            sku: product.sku || "",
            product_id: product.id,
            unit_codes: [],
          },
        ];
        setItems(newItems);
        updateTotals(newItems);
      }
    }

    setProductPickerOpen(false);
    toast.success(`Added "${product.name}"`);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      const reset = [
        {
          name: "",
          qty: "1",
          unit_price: "",
          num_products: "1",
          delivery_date: formData.delivery_date,
          reference_name: "",
          sku: "",
          product_id: null,
          unit_codes: [],
        },
      ];
      setItems(reset);
      updateTotals(reset);
    } else {
      const newItems = items.filter((_, i) => i !== index);
      setItems(newItems);
      updateTotals(newItems);
    }
  };

  const updateItem = (index: number, field: keyof InvoiceItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
    updateTotals(newItems);
  };

  const incrementItemQty = (index: number) => {
    const current = parseInt(items[index].qty || "1");
    updateItem(index, "qty", (current + 1).toString());
  };

  const decrementItemQty = (index: number) => {
    const current = parseInt(items[index].qty || "1");
    if (current > 1) {
      updateItem(index, "qty", (current - 1).toString());
    } else {
      removeItem(index);
    }
  };

  // ---------------------------------------------------------------------------
  // BARCODE & CAMERA SCANNER
  // ---------------------------------------------------------------------------
  const processBarcodeScan = async (scannedCode: string) => {
    if (!scannedCode) return;

    try {
      const { data: unit } = await supabase
        .from("stock_units")
        .select("*, product:products(*)")
        .eq("unit_code", scannedCode)
        .maybeSingle();

      let product = unit?.product;
      let unitCodes: string[] = [];

      if (unit) {
        unitCodes = [unit.unit_code];
      } else {
        let { data: dbProduct } = await supabase
          .from("products")
          .select("*")
          .eq("sku", scannedCode)
          .maybeSingle();

        if (!dbProduct) {
          const { data: altProduct } = await supabase
            .from("products")
            .select("*")
            .eq("company_barcode", scannedCode)
            .maybeSingle();
          dbProduct = altProduct;
        }
        product = dbProduct;
      }

      if (!product) {
        toast.error(`Barcode "${scannedCode}" not found.`);
        return;
      }

      handleSelectProductFromPicker({
        id: product.id,
        name: product.name,
        price: product.price || 0,
        sku: product.sku || scannedCode,
      });

      setBarcodeInput("");
    } catch (err) {
      toast.error("Error processing barcode scan");
    }
  };

  // ---------------------------------------------------------------------------
  // QUICK ADD CUSTOMER MUTATION
  // ---------------------------------------------------------------------------
  const createCustomerMutation = useMutation({
    mutationFn: async (payload: typeof newCustomer) => {
      const { data, error } = await supabase
        .from("customers")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (cust) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      setFormData((prev) => ({ ...prev, customer_id: cust.id }));
      setCustomerDialogOpen(false);
      setCustomerPickerOpen(false);
      setNewCustomer({ name: "", phone: "", email: "", address: "" });
      toast.success(`Customer "${cust.name}" registered & selected`);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add customer");
    },
  });

  // ---------------------------------------------------------------------------
  // CREATE / FINALIZE INVOICE MUTATION
  // ---------------------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: async ({ isDraft }: { isDraft: boolean }) => {
      if (!formData.customer_id) {
        throw new Error("Please select a customer before creating the invoice.");
      }

      const validItems = items.filter((it) => it.name.trim().length > 0);
      if (validItems.length === 0) {
        throw new Error("Please enter at least one item.");
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user?.id)
        .maybeSingle();

      const paid = parseFloat(formData.paid_amount || "0") || 0;
      const total = parseFloat(formData.total || "0") || 0;
      const payment_status = isDraft
        ? "unpaid"
        : paid >= total && total > 0
        ? "paid"
        : paid > 0
        ? "partial"
        : "unpaid";

      // 1. Insert Invoices table
      const { data: newInvoice, error: invError } = await supabase
        .from("invoices")
        .insert([
          {
            invoice_number: formData.invoice_number,
            customer_id: formData.customer_id,
            date: formData.date,
            subtotal: parseFloat(formData.subtotal || "0"),
            tax: 0,
            total: total,
            payment_method: formData.payment_method,
            payment_status: payment_status,
            uploaded_by: profile?.id || null,
            raw_payload: {
              items: validItems,
              discount: formData.discount,
              discount_type: formData.discount_type,
              coupon_code: formData.coupon_code,
              offer_description: formData.offer_description,
              paid_amount: formData.paid_amount || "0",
              delivery_date: formData.delivery_date,
              remarks: formData.remarks || "",
            },
            status: isDraft ? "draft" : "finalized",
          },
        ])
        .select(`
          *,
          customers(id, name, phone, email, address)
        `)
        .single();

      if (invError) throw invError;

      // 2. Insert Invoice Items table
      const itemsToInsert = validItems.map((item) => ({
        invoice_id: newInvoice.id,
        sku: item.sku || item.name,
        name: item.name,
        qty: parseFloat(item.qty || "1"),
        unit_price: parseFloat(item.unit_price || "0"),
        total: parseFloat(item.qty || "1") * parseFloat(item.unit_price || "0"),
        reference_name: item.reference_name || null,
        product_id: item.product_id || null,
      }));

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      // 3. Create Orders and Stages if finalized
      if (!isDraft) {
        const ordersToInsert: any[] = [];
        validItems.forEach((item, itemIdx) => {
          const orderCode = `${newInvoice.invoice_number}-${item.name
            .substring(0, 3)
            .toUpperCase()}-${itemIdx + 1}`;

          ordersToInsert.push({
            order_code: orderCode,
            invoice_id: newInvoice.id,
            customer_id: formData.customer_id,
            total_amount:
              parseFloat(item.qty || "1") * parseFloat(item.unit_price || "0"),
            order_status: "pending",
            payment_status: payment_status,
            created_by: profile?.id || null,
            metadata: {
              item_name: item.name,
              item_index: itemIdx,
              qty: parseFloat(item.qty || "1"),
              num_products: parseInt(item.num_products || "1"),
              unit_price: item.unit_price,
              delivery_date: item.delivery_date || formData.delivery_date,
              reference_name: item.reference_name || "",
              product_id: item.product_id || null,
              unit_codes: item.unit_codes || [],
            },
          });
        });

        const { data: newOrders, error: ordersError } = await supabase
          .from("orders")
          .insert(ordersToInsert)
          .select();

        if (ordersError) throw ordersError;

        // 4. Create Order Stages for each garment piece
        const stagesToInsert: any[] = [];
        (newOrders || []).forEach((order: any) => {
          const pieces = parseInt(order.metadata?.num_products || 1);
          for (let p = 1; p <= pieces; p++) {
            stagesToInsert.push({
              order_id: order.id,
              stage_name: "Ordered",
              status: "done",
              start_ts: new Date().toISOString(),
              end_ts: new Date().toISOString(),
              metadata: {
                product_number: p,
                product_name: `${order.metadata?.item_name} - Piece ${p}`,
                auto_created: true,
              },
            });
          }
        });

        if (stagesToInsert.length > 0) {
          await supabase.from("order_stages").insert(stagesToInsert);
        }

        // 5. Advance Payment Logging
        if (paid > 0) {
          await supabase.from("invoice_payments").insert([
            {
              invoice_id: newInvoice.id,
              amount: paid,
              payment_method: formData.payment_method,
              payment_date: formData.date,
              notes: `Initial advance collected at invoice creation (${formData.payment_method.toUpperCase()})`,
            },
          ]);
        }
      }

      return newInvoice;
    },
    onSuccess: (invoice, variables) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });

      if (variables.isDraft) {
        toast.success(`Invoice ${invoice.invoice_number} saved as draft`);
        navigate("/invoices");
      } else {
        toast.success(`Invoice ${invoice.invoice_number} finalized successfully!`);
        setCreatedInvoice(invoice);
        setReceiptModalOpen(true);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to create invoice");
    },
  });

  const handleResetForm = () => {
    generateInvoiceNumber();
    setFormData({
      invoice_number: "",
      customer_id: "",
      date: todayStr,
      delivery_date: todayStr,
      subtotal: "0",
      tax: "0",
      discount: "0",
      discount_type: "fixed",
      coupon_code: "",
      offer_description: "",
      total: "0",
      payment_method: "upi",
      payment_status: "unpaid",
      paid_amount: "",
      remarks: "",
    });
    setItems([
      {
        name: "",
        qty: "1",
        unit_price: "",
        num_products: "1",
        delivery_date: todayStr,
        reference_name: "",
        sku: "",
        product_id: null,
        unit_codes: [],
      },
    ]);
  };

  const selectedCustomer = useMemo(() => {
    return customers.find((c) => c.id === formData.customer_id);
  }, [customers, formData.customer_id]);

  const totalNum = parseFloat(formData.total || "0") || 0;
  const paidNum = parseFloat(formData.paid_amount || "0") || 0;
  const balanceDue = Math.max(0, totalNum - paidNum);

  // Filtered products inside the touch product picker
  const filteredPickerProducts = useMemo(() => {
    return products.filter((p: any) => {
      if (
        pickerCategory !== "All" &&
        p.category?.toLowerCase() !== pickerCategory.toLowerCase()
      ) {
        return false;
      }
      if (pickerSearchQuery.trim()) {
        const q = pickerSearchQuery.toLowerCase();
        return (
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.category?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [products, pickerCategory, pickerSearchQuery]);

  return (
    <div className="space-y-5 max-w-3xl mx-auto pb-36 px-2 sm:px-4">
      {/* ================= Header Bar ================= */}
      <div className="flex items-center justify-between gap-3 border-b pb-3">
        <div className="flex items-center gap-2.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/invoices")}
            className="h-10 w-10 rounded-full shrink-0 hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Create Invoice
              </h1>
              <Badge className="bg-primary/10 text-primary border-primary/20 text-[11px] font-bold">
                Touch Mode
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">
              {formData.invoice_number || "INV-XXX"} • {formData.date}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleResetForm}
          className="text-xs h-9 gap-1.5 shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </Button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (isSubmitting) return;
          setIsSubmitting(true);
          createMutation.mutate(
            { isDraft: false },
            { onSettled: () => setIsSubmitting(false) }
          );
        }}
        className="space-y-4"
      >
        {/* ================= 1. CUSTOMER SELECTION CARD (TOUCH READY) ================= */}
        <Card className="border shadow-2xs bg-card">
          <CardHeader className="p-3.5 pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <User className="h-4 w-4 text-primary" />
              Customer Information *
            </CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCustomerDialogOpen(true)}
              className="text-xs h-7.5 gap-1 text-primary border-primary/30 hover:bg-primary/5"
            >
              <UserPlus className="h-3.5 w-3.5" />
              + New Client
            </Button>
          </CardHeader>
          <CardContent className="p-3.5 pt-1">
            <div
              onClick={() => {
                setCustomerSearchQuery("");
                setCustomerPickerOpen(true);
              }}
              className="p-3 rounded-xl border bg-muted/40 hover:bg-muted/70 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-between"
            >
              <div className="min-w-0 flex-1">
                {selectedCustomer ? (
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-full bg-primary/15 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                      {selectedCustomer.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground truncate">
                        {selectedCustomer.name}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {selectedCustomer.phone || "No phone registered"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Search className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-xs font-medium">Tap to search & select customer...</span>
                  </div>
                )}
              </div>

              <Badge variant="outline" className="text-[11px] h-7 px-2.5 font-semibold text-primary border-primary/30 shrink-0 ml-2">
                {selectedCustomer ? "Change" : "Browse"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* ================= 2. DATES & SCHEDULE ================= */}
        <Card className="border shadow-2xs bg-card p-3.5 space-y-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-semibold block mb-1">Invoice Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="h-10 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold block mb-1">Master Delivery Date *</Label>
              <Input
                type="date"
                value={formData.delivery_date}
                onChange={(e) => {
                  const newDate = e.target.value;
                  setFormData({ ...formData, delivery_date: newDate });
                  setItems(items.map((it) => ({ ...it, delivery_date: newDate })));
                }}
                required
                className="h-10 text-xs"
              />
            </div>

            <div className="col-span-2 sm:col-span-1">
              <Label className="text-xs font-semibold block mb-1">Invoice #</Label>
              <Input
                value={formData.invoice_number}
                disabled
                className="h-10 text-xs bg-muted font-bold font-mono"
              />
            </div>
          </div>
        </Card>

        {/* ================= 3. SCAN BARCODE BAR ================= */}
        <Card className="border shadow-2xs bg-card p-3">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <QrCode className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Scan / Enter barcode & press Enter..."
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && barcodeInput.trim()) {
                    e.preventDefault();
                    await processBarcodeScan(barcodeInput.trim());
                  }
                }}
                className="pl-9 h-10 text-xs"
              />
            </div>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0 text-primary border-primary/30 hover:bg-primary/5"
              onClick={() => setIsScanningCamera(true)}
              title="Camera Scan"
            >
              <Camera className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        <MobileBarcodeScanner
          open={isScanningCamera}
          onOpenChange={setIsScanningCamera}
          onScan={processBarcodeScan}
        />

        {/* ================= 4. LINE ITEMS SECTION ================= */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-1">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Package className="h-4 w-4 text-primary" />
              Line Items ({items.length})
            </Label>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openProductPickerForItem(null)}
              className="text-xs h-7.5 gap-1.5 text-primary border-primary/30 hover:bg-primary/5 font-semibold"
            >
              <Search className="h-3.5 w-3.5" />
              + Browse Catalog
            </Button>
          </div>

          {/* Line Item Cards */}
          <div className="space-y-3">
            {items.map((item, index) => {
              const qty = parseFloat(item.qty || "1");
              const price = parseFloat(item.unit_price || "0");
              const lineTotal = isNaN(qty) || isNaN(price) ? 0 : qty * price;

              return (
                <Card key={index} className="border shadow-2xs bg-card p-3.5 space-y-3 relative">
                  {/* Top Bar: Item Header + Select Product Button + Delete */}
                  <div className="flex items-center justify-between border-b pb-2 gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-primary shrink-0">
                      Item #{index + 1}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => openProductPickerForItem(index)}
                        className="h-7 text-[11px] gap-1 px-2.5 text-primary border-primary/20 hover:bg-primary/5 font-semibold"
                      >
                        <Search className="h-3 w-3" />
                        {item.name ? "Change Product" : "Select from Catalog"}
                      </Button>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Item Description Input */}
                  <div>
                    <Label className="text-xs font-semibold mb-1 block">
                      Item Name / Description *
                    </Label>
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(index, "name", e.target.value)}
                      required
                      placeholder="e.g. Pure Banarasi Silk Saree or Custom Blouse"
                      className="h-10 text-xs font-semibold"
                    />
                  </div>

                  {/* Quantity Stepper + Unit Price + Line Total */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 items-end">
                    {/* Quantity Stepper */}
                    <div>
                      <Label className="text-xs font-semibold mb-1 block">Qty</Label>
                      <div className="flex items-center rounded-lg border bg-muted/40 h-10 p-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => decrementItemQty(index)}
                          className="h-8 w-8 rounded hover:bg-background"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="flex-1 text-center text-xs font-bold font-mono">
                          {item.qty || 1}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => incrementItemQty(index)}
                          className="h-8 w-8 rounded hover:bg-background"
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Unit Price */}
                    <div>
                      <Label className="text-xs font-semibold mb-1 block">Unit Price (₹) *</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={item.unit_price}
                        onChange={(e) =>
                          updateItem(index, "unit_price", e.target.value.replace(/[^\d.]/g, ""))
                        }
                        required
                        placeholder="0.00"
                        className="h-10 text-xs font-mono font-bold"
                      />
                    </div>

                    {/* Garment Stage Pieces */}
                    <div>
                      <Label className="text-xs font-semibold mb-1 block">Pieces (Stages)</Label>
                      <Select
                        value={item.num_products}
                        onValueChange={(val) => updateItem(index, "num_products", val)}
                      >
                        <SelectTrigger className="h-10 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Piece (Standard)</SelectItem>
                          <SelectItem value="2">2 Pcs (Suit / Set)</SelectItem>
                          <SelectItem value="3">3 Pcs (Lehenga Set)</SelectItem>
                          <SelectItem value="4">4 Pieces</SelectItem>
                          <SelectItem value="5">5 Pieces</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Line Total */}
                    <div>
                      <Label className="text-xs font-semibold mb-1 block">Item Total</Label>
                      <Input
                        value={`₹${lineTotal.toFixed(2)}`}
                        disabled
                        className="h-10 text-xs bg-muted font-bold font-mono text-foreground"
                      />
                    </div>
                  </div>

                  {/* Customer Reference & Item Delivery Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 border-t">
                    <div>
                      <Label className="text-xs font-semibold mb-1 block">
                        Customer Reference / Style Note
                      </Label>
                      <Input
                        value={item.reference_name}
                        onChange={(e) => updateItem(index, "reference_name", e.target.value)}
                        placeholder="e.g. Master Rafiq (Stitching), Bride fitting"
                        className="h-9 text-xs"
                      />
                    </div>

                    <div>
                      <Label className="text-xs font-semibold mb-1 block">
                        Item Delivery Date *
                      </Label>
                      <Input
                        type="date"
                        value={item.delivery_date}
                        onChange={(e) => updateItem(index, "delivery_date", e.target.value)}
                        required
                        className="h-9 text-xs"
                      />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => openProductPickerForItem(null)}
              className="h-10 text-xs font-bold gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
            >
              <Search className="w-4 h-4" /> Browse & Add Item
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={addNewBlankItem}
              className="h-10 text-xs font-semibold gap-1.5 border-dashed"
            >
              <Plus className="w-4 h-4" /> Add Blank Row
            </Button>
          </div>
        </div>

        {/* ================= 5. DISCOUNT & OFFERS (COLLAPSIBLE) ================= */}
        <Card className="border shadow-2xs bg-card">
          <CardContent className="p-3.5">
            <Collapsible open={showDiscount} onOpenChange={setShowDiscount}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="link" className="p-0 h-auto text-xs font-bold text-primary">
                  {showDiscount ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                  {showDiscount ? "Hide Discount Options" : "+ Add Discount / Coupon Code"}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs font-semibold">Coupon Code</Label>
                    <Input
                      value={formData.coupon_code}
                      onChange={(e) => setFormData({ ...formData, coupon_code: e.target.value })}
                      placeholder="e.g. FESTIVE10"
                      className="h-9 text-xs mt-1"
                    />
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Discount Type</Label>
                    <Select
                      value={formData.discount_type}
                      onValueChange={(val) => {
                        setFormData({ ...formData, discount_type: val });
                        updateTotals(items, formData.discount, val);
                      }}
                    >
                      <SelectTrigger className="h-9 text-xs mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">₹ Fixed Amount</SelectItem>
                        <SelectItem value="percentage">% Percentage</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs font-semibold">Discount Value</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.discount}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormData({ ...formData, discount: val });
                        updateTotals(items, val, formData.discount_type);
                      }}
                      placeholder="0.00"
                      className="h-9 text-xs mt-1 font-mono font-bold"
                    />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>

        {/* ================= 6. ADVANCE PAYMENT & TENDER (ACTIVE) ================= */}
        <Card className="border shadow-2xs bg-card p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-primary" />
              Advance Deposit Collection
            </Label>
            <span className="text-[11px] text-muted-foreground">Select tender method</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold mb-1 block">Payment Mode</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(val) => setFormData({ ...formData, payment_method: val })}
              >
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upi">UPI / GPay / PhonePe</SelectItem>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Debit / Credit Card</SelectItem>
                  <SelectItem value="other">Bank Transfer / Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs font-semibold mb-1 block">Advance Received (₹)</Label>
              <Input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={formData.paid_amount}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^\d.]/g, "");
                  setFormData({ ...formData, paid_amount: val });
                }}
                className="h-10 text-xs font-bold font-mono"
              />
            </div>
          </div>

          {/* Quick Tender Shortcuts */}
          <div className="flex items-center gap-1.5 flex-wrap pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFormData({ ...formData, paid_amount: formData.total })}
              className="text-[11px] h-7 px-2.5 text-emerald-700 border-emerald-300 hover:bg-emerald-50 font-semibold"
            >
              Full Pay (₹{totalNum.toFixed(0)})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFormData({ ...formData, paid_amount: (totalNum / 2).toFixed(0) })}
              className="text-[11px] h-7 px-2.5 text-amber-700 border-amber-300 hover:bg-amber-50 font-semibold"
            >
              50% Advance (₹{(totalNum / 2).toFixed(0)})
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFormData({ ...formData, paid_amount: "" })}
              className="text-[11px] h-7 px-2.5"
            >
              No Advance
            </Button>
          </div>
        </Card>

        {/* ================= 7. REMARKS / INSTRUCTIONS ================= */}
        <div>
          <Label className="text-xs font-semibold mb-1 block">
            Remarks & Special Instructions (optional)
          </Label>
          <Textarea
            rows={2}
            value={formData.remarks}
            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
            placeholder="Add notes on alterations, karigar workshop instructions..."
            className="text-xs resize-none"
          />
        </div>

        {/* ================= 8. TOTALS SUMMARY CARD ================= */}
        <Card className="border shadow-2xs bg-card p-3.5 space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subtotal:</span>
            <span className="font-semibold text-foreground font-mono">
              ₹{parseFloat(formData.subtotal || "0").toFixed(2)}
            </span>
          </div>

          {parseFloat(formData.discount || "0") > 0 && (
            <div className="flex justify-between text-xs text-emerald-600 font-medium">
              <span>
                Discount ({formData.discount_type === "percentage" ? `${formData.discount}%` : `Fixed`}):
              </span>
              <span className="font-mono">
                -₹{formData.discount_type === "percentage"
                  ? ((parseFloat(formData.subtotal || "0") * parseFloat(formData.discount)) / 100).toFixed(2)
                  : parseFloat(formData.discount).toFixed(2)}
              </span>
            </div>
          )}

          <div className="flex justify-between text-base font-bold text-foreground pt-1.5 border-t">
            <span>Total Bill:</span>
            <span className="font-mono">₹{totalNum.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-xs text-emerald-700 font-semibold pt-0.5">
            <span>Paid / Advance:</span>
            <span className="font-mono">₹{paidNum.toFixed(2)}</span>
          </div>

          {balanceDue > 0 && (
            <div className="flex justify-between text-sm font-bold text-destructive pt-1.5 border-t">
              <span>Balance Due:</span>
              <span className="font-mono">₹{balanceDue.toFixed(2)}</span>
            </div>
          )}
        </Card>

        {/* ================= 9. STICKY BOTTOM CHECKOUT BAR ================= */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-card border-t p-3 sm:p-4 shadow-lg">
          <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">Total Bill</p>
              <p className="text-xl font-bold font-mono text-foreground">
                ₹{totalNum.toFixed(2)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => createMutation.mutate({ isDraft: true })}
                disabled={createMutation.isPending || isSubmitting}
                className="h-11 text-xs px-4"
              >
                Save Draft
              </Button>

              <Button
                type="submit"
                disabled={createMutation.isPending || isSubmitting}
                className="h-11 px-5 text-xs font-bold gap-1.5 bg-primary text-primary-foreground shadow-md"
              >
                <Receipt className="h-4 w-4" />
                {createMutation.isPending ? "Creating..." : "Create Invoice & Order"}
              </Button>
            </div>
          </div>
        </div>
      </form>

      {/* ========================================================================= */}
      {/* 📱 MODAL: TOUCH PRODUCT PICKER SHEET (NO POPUP BLUR ISSUES)                */}
      {/* ========================================================================= */}
      <Dialog open={productPickerOpen} onOpenChange={setProductPickerOpen}>
        <DialogContent className="max-w-md w-full p-0 overflow-hidden flex flex-col max-h-[85vh] bg-background">
          <DialogHeader className="p-4 pb-2 border-b">
            <DialogTitle className="flex items-center justify-between text-base font-bold">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <span>Select Catalog Product</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Search Bar & Category Chips */}
          <div className="p-3 border-b space-y-2.5 bg-muted/20 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products by name, SKU..."
                value={pickerSearchQuery}
                onChange={(e) => setPickerSearchQuery(e.target.value)}
                className="pl-9 h-10 text-xs bg-background"
                autoFocus
              />
              {pickerSearchQuery && (
                <button
                  type="button"
                  onClick={() => setPickerSearchQuery("")}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5 scrollbar-none">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setPickerCategory(cat)}
                  className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap transition-colors cursor-pointer ${
                    pickerCategory === cat
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Scrollable Product List */}
          <div className="flex-1 overflow-y-auto divide-y p-2 space-y-1">
            {filteredPickerProducts.length > 0 ? (
              filteredPickerProducts.map((prod: any) => (
                <div
                  key={prod.id}
                  onClick={() =>
                    handleSelectProductFromPicker({
                      id: prod.id,
                      name: prod.name,
                      price: prod.price || 0,
                      sku: prod.sku || "",
                    })
                  }
                  className="p-3 rounded-xl hover:bg-muted/70 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-between gap-2 border border-transparent hover:border-border"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-xs sm:text-sm text-foreground truncate">
                      {prod.name}
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                      <span>{prod.sku || "No SKU"}</span>
                      <span>•</span>
                      <span>{prod.category || "General"}</span>
                      {prod.stock !== undefined && (
                        <>
                          <span>•</span>
                          <span className="font-mono">Stock: {prod.stock}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <Badge className="bg-primary/10 text-primary border-primary/20 font-bold text-xs font-mono">
                      ₹{prod.price || 0}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6 text-center space-y-3">
                <p className="text-xs text-muted-foreground">
                  No catalog products match "{pickerSearchQuery}"
                </p>
                {pickerSearchQuery.trim() && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() =>
                      handleSelectProductFromPicker({
                        id: null,
                        name: pickerSearchQuery.trim(),
                        price: "0",
                        sku: "CUSTOM",
                      })
                    }
                    className="text-xs font-bold gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    Use "{pickerSearchQuery}" as Custom Item
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* 📱 MODAL: TOUCH CUSTOMER PICKER SHEET                                     */}
      {/* ========================================================================= */}
      <Dialog open={customerPickerOpen} onOpenChange={setCustomerPickerOpen}>
        <DialogContent className="max-w-md w-full p-0 overflow-hidden flex flex-col max-h-[85vh] bg-background">
          <DialogHeader className="p-4 pb-2 border-b">
            <DialogTitle className="flex items-center justify-between text-base font-bold">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span>Select Customer</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCustomerPickerOpen(false);
                  setNewCustomer((prev) => ({ ...prev, name: customerSearchQuery }));
                  setCustomerDialogOpen(true);
                }}
                className="text-xs h-7.5 gap-1 text-primary border-primary/30"
              >
                <UserPlus className="h-3.5 w-3.5" />
                + New
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="p-3 border-b bg-muted/20 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by customer name or phone..."
                value={customerSearchQuery}
                onChange={(e) => setCustomerSearchQuery(e.target.value)}
                className="pl-9 h-10 text-xs bg-background"
                autoFocus
              />
              {customerSearchQuery && (
                <button
                  type="button"
                  onClick={() => setCustomerSearchQuery("")}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y p-2 space-y-1">
            {customers
              .filter((c) =>
                `${c.name} ${c.phone || ""}`
                  .toLowerCase()
                  .includes(customerSearchQuery.toLowerCase())
              )
              .map((c) => {
                const isSelected = formData.customer_id === c.id;
                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, customer_id: c.id }));
                      setCustomerPickerOpen(false);
                      toast.success(`Selected customer: ${c.name}`);
                    }}
                    className={`p-3 rounded-xl hover:bg-muted/70 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-between gap-2 border ${
                      isSelected ? "border-primary/40 bg-primary/5" : "border-transparent"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                        {c.name.substring(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs sm:text-sm text-foreground truncate">{c.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {c.phone || "No phone registered"}
                        </p>
                      </div>
                    </div>

                    {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                  </div>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: Quick Add New Customer ================= */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <UserPlus className="h-4 w-4 text-primary" />
              Register New Customer
            </DialogTitle>
          </DialogHeader>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newCustomer.name.trim()) {
                toast.error("Customer name is required");
                return;
              }
              createCustomerMutation.mutate(newCustomer);
            }}
            className="space-y-3.5 pt-2 text-xs"
          >
            <div className="space-y-1">
              <Label className="text-xs">Full Name *</Label>
              <Input
                placeholder="e.g. Sangeeta Gupta"
                value={newCustomer.name}
                onChange={(e) => setNewCustomer({ ...newCustomer, name: e.target.value })}
                required
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">WhatsApp / Mobile Number</Label>
              <Input
                placeholder="10-digit mobile number"
                value={newCustomer.phone}
                onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                className="text-xs h-9 font-mono"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Email Address</Label>
              <Input
                type="email"
                placeholder="e.g. client@example.com"
                value={newCustomer.email}
                onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                className="text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">City / Address</Label>
              <Input
                placeholder="e.g. Banjara Hills, Hyderabad"
                value={newCustomer.address}
                onChange={(e) => setNewCustomer({ ...newCustomer, address: e.target.value })}
                className="text-xs h-9"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setCustomerDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={createCustomerMutation.isPending}
                className="font-bold"
              >
                {createCustomerMutation.isPending ? "Saving..." : "Save Customer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ================= MODAL: Mobile Receipt View & WhatsApp Share ================= */}
      <MobileInvoiceReceiptModal
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        invoice={createdInvoice}
        onNewSale={handleResetForm}
      />
    </div>
  );
}
