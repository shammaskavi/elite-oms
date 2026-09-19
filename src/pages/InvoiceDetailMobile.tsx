import React, { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { derivePaymentStatus } from "@/lib/derivePaymentStatus";
import { ensureInvoiceTrackingToken, openWhatsApp, normalizeWhatsAppPhone } from "@/lib/whatsapp";
import { usePDF } from "@react-pdf/renderer";
import { PrintableInvoice } from "@/components/PrintableInvoice";
import { format } from "date-fns";
import { toast } from "sonner";

// Lucide Icons
import {
  ArrowLeft,
  Calendar,
  Phone,
  MapPin,
  User,
  ExternalLink,
  Send,
  Printer,
  PlusCircle,
  CheckCircle2,
  AlertCircle,
  Clock,
  Scissors,
  Check,
  ChevronRight,
  Sparkles,
  DollarSign,
  CreditCard,
  Building2,
  FileText,
  BadgeAlert,
  Share2,
  RefreshCw,
  Eye,
  Percent,
  Tag,
  ShieldCheck,
  Loader2,
  ChevronDown,
  Info,
} from "lucide-react";

// UI Components
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingState } from "@/components/states";

const formatCurrency = (value: any) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export default function InvoiceDetailMobile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const navState = location.state as any;
  const returnTo = navState?.returnTo || "/invoices";

  // State for Add Payment & Settle Dialogs
  const [isPaymentSheetOpen, setIsPaymentSheetOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [paymentNote, setPaymentNote] = useState("");

  const [isSettlingOpen, setIsSettlingOpen] = useState(false);
  const [settlementReason, setSettlementReason] = useState("");
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);

  // 1. Fetch Main Invoice Data (with Customer)
  const {
    data: invoice,
    isLoading: invoiceLoading,
    error: invoiceError,
    refetch: refetchInvoice,
  } = useQuery({
    queryKey: ["invoice-detail-mobile", id],
    queryFn: async () => {
      if (!id) throw new Error("Invoice ID is required");

      const { data, error } = await (supabase as any)
        .from("invoices")
        .select("*, customers(*)")
        .eq("id", id)
        .single();

      if (error) {
        // Fallback: try searching by invoice_number if id is not a UUID
        const { data: invByNumber, error: err2 } = await (supabase as any)
          .from("invoices")
          .select("*, customers(*)")
          .eq("invoice_number", id)
          .single();

        if (err2) throw error;
        return invByNumber;
      }
      return data;
    },
    enabled: !!id,
  });

  // Helper string normalizer
  const normalize = (v?: string) => v?.trim().toLowerCase() ?? "";

  // 2. Fetch Orders linked to this invoice with Stages & Vendor Info
  const { data: invoiceOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["invoice-orders-with-stages", invoice?.id],
    queryFn: async () => {
      if (!invoice?.id) return [];

      const { data, error } = await (supabase as any)
        .from("orders")
        .select(`
          id,
          order_code,
          metadata,
          payment_status,
          order_stages (
            stage_name,
            created_at,
            vendor_name
          )
        `)
        .eq("invoice_id", invoice.id);

      if (error) throw error;
      return data || [];
    },
    enabled: !!invoice?.id,
  });

  // Map latest stage and vendor for each order
  const ordersWithCurrentStage = useMemo(() => {
    return invoiceOrders.map((order: any) => {
      const stages = [...(order.order_stages || [])].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );

      const currentStage =
        stages.length > 0 ? stages[stages.length - 1].stage_name : "Ordered";
      const currentVendor =
        stages.length > 0 ? stages[stages.length - 1].vendor_name : null;

      return {
        ...order,
        currentStage,
        currentVendor,
        itemIndex: order.metadata?.item_index,
      };
    });
  }, [invoiceOrders]);

  // Lookup maps for linking line items to orders
  const orderByItemName = useMemo(() => {
    const map = new Map<string, any>();
    ordersWithCurrentStage.forEach((order: any) => {
      if (order.metadata?.item_name) {
        map.set(normalize(order.metadata.item_name), order);
      }
    });
    return map;
  }, [ordersWithCurrentStage]);

  const orderByItemIndex = useMemo(() => {
    const map = new Map<number, any>();
    ordersWithCurrentStage.forEach((order: any) => {
      if (typeof order.metadata?.item_index === "number") {
        map.set(order.metadata.item_index, order);
      }
    });
    return map;
  }, [ordersWithCurrentStage]);

  // 3. Fetch Payments history
  const { data: invoicePayments = [], refetch: refetchPayments } = useQuery({
    queryKey: ["invoice-payments-for-invoice", invoice?.id],
    queryFn: async () => {
      if (!invoice?.id) return [];
      const { data, error } = await (supabase as any)
        .from("invoice_payments")
        .select("*")
        .eq("invoice_id", invoice.id)
        .order("date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!invoice?.id,
  });

  // 4. Payment status derivation
  const { data: paymentInfo } = useQuery({
    queryKey: ["invoice-payment-status", invoice?.id],
    queryFn: () => (invoice ? derivePaymentStatus(invoice) : null),
    enabled: !!invoice?.id,
  });

  const paidAmount =
    paymentInfo?.paid ?? parseFloat(invoice?.raw_payload?.paid_amount || 0);
  const remainingBalance =
    paymentInfo?.remaining ?? Math.max(0, (invoice?.total || 0) - paidAmount);
  const derivedStatus =
    paymentInfo?.status ?? (invoice?.raw_payload?.payment_status || "unpaid");

  const isDraft = invoice?.status === "draft";
  const isSettled = invoice?.settled === true;
  const isPaid = derivedStatus === "paid" || remainingBalance === 0;

  // Calculation percentage
  const totalAmount = parseFloat(invoice?.total || 0);
  const paymentPercentage = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;

  // Expected Delivery Date calculation
  const getExpectedDeliveryDate = () => {
    if (!invoice) return null;
    const items = invoice.raw_payload?.items || [];
    const itemDates = items
      .map((item: any) => item.delivery_date)
      .filter(Boolean)
      .map((d: string) => new Date(d).getTime());

    if (itemDates.length > 0) {
      return new Date(Math.max(...itemDates));
    }
    if (invoice.raw_payload?.delivery_date) {
      return new Date(invoice.raw_payload.delivery_date);
    }
    return null;
  };

  const expectedDelivery = getExpectedDeliveryDate();

  // 5. Printable Invoice PDF Hook
  const invoiceDocument = useMemo(() => {
    if (!invoice) return null;
    const pdfData = {
      ...invoice,
      delivery_date: invoice.raw_payload?.delivery_date,
      isPaid: derivedStatus === "paid",
      paidAmount,
      remainingBalance,
    };
    return <PrintableInvoice data={pdfData} payments={invoicePayments} />;
  }, [invoice, derivedStatus, paidAmount, remainingBalance, invoicePayments]);

  const [instance, updateInstance] = usePDF({
    document: invoiceDocument || <></>,
  });

  useEffect(() => {
    if (invoiceDocument) {
      updateInstance(invoiceDocument);
    }
  }, [invoiceDocument, invoicePayments]);

  // Handle PDF Print
  const handlePrint = () => {
    if (instance.error) {
      toast.error("Failed to generate PDF for printing");
      return;
    }
    if (instance.url) {
      const printWindow = window.open(instance.url);
      if (printWindow) {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 800);
      } else {
        toast.error("Pop-up blocked. Please allow pop-ups to print.");
      }
    } else {
      toast.info("Generating invoice PDF, please try again in a moment...");
    }
  };

  // WhatsApp Share with Live Tracking Link
  const handleSendWhatsApp = async () => {
    if (!invoice) return;
    try {
      setIsSendingWhatsApp(true);
      const customerPhone = invoice.customers?.phone;
      if (!customerPhone) {
        toast.error("Customer phone number is missing.");
        return;
      }

      const trackingToken = await ensureInvoiceTrackingToken(invoice.id);
      const trackingUrl = `${window.location.origin}/track/${trackingToken}`;
      const formattedDelivery = expectedDelivery
        ? expectedDelivery.toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })
        : null;

      const message = `
Hello ${invoice.customers?.name || "Valued Customer"} ✨

Thank you for choosing Saree Palace Elite.
We're delighted to be creating this bespoke piece for you.

Here are your invoice details:
🧾 Invoice No: ${invoice.invoice_number}
💰 Total Amount: ₹${Number(invoice.total).toLocaleString("en-IN")}
💳 Paid: ₹${Number(paidAmount).toLocaleString("en-IN")}
${remainingBalance > 0 ? `⏳ Balance Due: ₹${Number(remainingBalance).toLocaleString("en-IN")}\n` : ""}
${formattedDelivery ? `📅 Target Delivery: ${formattedDelivery}\n` : ""}
📦 You can track real-time tailoring & karigar progress anytime here:
${trackingUrl}

Warm regards,
Saree Palace Elite
      `.trim();

      openWhatsApp(customerPhone, message);
      toast.success("WhatsApp opened with tracking message");
    } catch (err: any) {
      console.error("WhatsApp dispatch failed:", err);
      toast.error(err.message || "Failed to launch WhatsApp");
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // 6. Mutations: Add Payment
  const addPaymentMutation = useMutation({
    mutationFn: async ({ amount, method, date }: { amount: number; method: string; date: string }) => {
      if (!invoice?.id) throw new Error("Missing invoice ID");
      const safeAmount = Number(amount);
      if (isNaN(safeAmount) || safeAmount <= 0) {
        throw new Error("Please enter a valid payment amount");
      }

      const safeDate = date ? new Date(date).toISOString() : new Date().toISOString();

      const { error } = await (supabase as any).from("invoice_payments").insert({
        invoice_id: invoice.id,
        amount: safeAmount,
        method: method || "cash",
        date: safeDate,
      });

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-detail-mobile", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-payments-for-invoice", invoice?.id] });
      queryClient.invalidateQueries({ queryKey: ["invoice-payment-status", invoice?.id] });
      toast.success("Payment recorded successfully! 🎉");
      setIsPaymentSheetOpen(false);
      setPaymentAmount("");
      setPaymentNote("");
    },
    onError: (err: any) => {
      console.error("Payment insert failed:", err);
      toast.error(err.message || "Failed to record payment");
    },
  });

  // 7. Mutations: Settle Invoice
  const settleInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!invoice?.id) throw new Error("Missing invoice ID");
      if (!settlementReason.trim()) throw new Error("Settlement reason required");

      const { error } = await (supabase as any)
        .from("invoices")
        .update({
          settled: true,
          settlement_reason: settlementReason.trim(),
        })
        .eq("id", invoice.id);

      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-detail-mobile", id] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Invoice settled successfully");
      setIsSettlingOpen(false);
      setSettlementReason("");
    },
    onError: (err: any) => {
      console.error("Settlement failed:", err);
      toast.error(err.message || "Failed to settle invoice");
    },
  });

  if (invoiceLoading) {
    return <LoadingState fullScreen message="Loading invoice details..." />;
  }

  if (invoiceError || !invoice) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Invoice Not Found</h2>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          We couldn't load the requested invoice. It might have been deleted or the link is invalid.
        </p>
        <div className="flex gap-3 mt-6">
          <Button variant="outline" onClick={() => navigate("/invoices")}>
            Back to Invoices
          </Button>
          <Button onClick={() => refetchInvoice()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const items: any[] = invoice.raw_payload?.items || [];

  return (
    <div className="min-h-screen bg-muted/20 pb-28 sm:pb-20">
      {/* Top Mobile App Bar */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border/80 px-4 py-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full shrink-0 -ml-1 text-muted-foreground hover:text-foreground"
              onClick={() => {
                if (navState?.returnTo) {
                  navigate(navState.returnTo, { state: navState });
                } else {
                  navigate("/invoices");
                }
              }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg sm:text-xl tracking-tight text-foreground flex items-center gap-1.5">
                  #{invoice.invoice_number}
                </h1>
                <Badge
                  variant={
                    isDraft
                      ? "outline"
                      : isSettled
                      ? "secondary"
                      : derivedStatus === "paid"
                      ? "default"
                      : derivedStatus === "partial"
                      ? "outline"
                      : "destructive"
                  }
                  className={`text-xs px-2 py-0.5 uppercase tracking-wider font-semibold ${
                    isDraft
                      ? "border-amber-500 text-amber-600 bg-amber-50 dark:bg-amber-950/30"
                      : isSettled
                      ? "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-300"
                      : derivedStatus === "paid"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-300"
                      : derivedStatus === "partial"
                      ? "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300 border-sky-300"
                      : "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-300"
                  }`}
                >
                  {isDraft
                    ? "Draft"
                    : isSettled
                    ? "Settled"
                    : derivedStatus === "paid"
                    ? "Paid"
                    : derivedStatus === "partial"
                    ? "Partial"
                    : "Unpaid"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Created on {format(new Date(invoice.date || invoice.created_at), "dd MMM yyyy")}
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs gap-1.5 hidden sm:inline-flex"
              onClick={handlePrint}
            >
              <Printer className="h-3.5 w-3.5" />
              Print
            </Button>
            <Button
              variant="default"
              size="sm"
              className="h-9 px-3 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white hidden sm:inline-flex"
              onClick={handleSendWhatsApp}
              disabled={isSendingWhatsApp}
            >
              {isSendingWhatsApp ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              WhatsApp
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full sm:hidden"
              onClick={handlePrint}
              title="Print Invoice"
            >
              <Printer className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-4 space-y-4">
        {/* Draft Notice Banner */}
        {isDraft && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-sm text-amber-900 dark:text-amber-200">
                Draft Invoice
              </h4>
              <p className="text-xs text-amber-700 dark:text-amber-300/90 mt-0.5">
                This invoice has not been finalized yet. Payment recording will be unlocked once finalized.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400 text-amber-800 hover:bg-amber-100 dark:text-amber-200 text-xs shrink-0"
              onClick={() => navigate(`/pos?draftId=${invoice.id}`)}
            >
              Edit Draft
            </Button>
          </div>
        )}

        {/* 1. FINANCIAL HERO CARD */}
        <Card className="shadow-sm border-border/80 overflow-hidden">
          <div className="p-5 sm:p-6 bg-gradient-to-br from-card via-card to-muted/30">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Grand Total Bill
                </span>
                <div className="text-3xl sm:text-4xl font-extrabold tracking-tight text-foreground mt-1">
                  {formatCurrency(invoice.total)}
                </div>
              </div>

              {/* Balance Summary Pills */}
              <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-4">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 min-w-[120px]">
                  <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 block uppercase">
                    Paid Amount
                  </span>
                  <span className="text-lg font-bold text-emerald-800 dark:text-emerald-300">
                    {formatCurrency(paidAmount)}
                  </span>
                </div>

                <div
                  className={`rounded-xl p-3 min-w-[120px] border ${
                    isSettled
                      ? "bg-purple-500/10 border-purple-500/20"
                      : remainingBalance > 0
                      ? "bg-rose-500/10 border-rose-500/20"
                      : "bg-muted border-border"
                  }`}
                >
                  <span
                    className={`text-[11px] font-medium block uppercase ${
                      isSettled
                        ? "text-purple-700 dark:text-purple-400"
                        : remainingBalance > 0
                        ? "text-rose-700 dark:text-rose-400"
                        : "text-muted-foreground"
                    }`}
                  >
                    {isSettled ? "Settled Balance" : "Balance Due"}
                  </span>
                  <span
                    className={`text-lg font-bold ${
                      isSettled
                        ? "text-purple-800 dark:text-purple-300"
                        : remainingBalance > 0
                        ? "text-rose-800 dark:text-rose-300"
                        : "text-muted-foreground"
                    }`}
                  >
                    {formatCurrency(remainingBalance)}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Progress Bar */}
            {!isDraft && (
              <div className="mt-5 pt-4 border-t border-border/60">
                <div className="flex justify-between items-center text-xs text-muted-foreground mb-2">
                  <span className="font-medium">Payment Fulfillment</span>
                  <span className="font-semibold text-foreground">{paymentPercentage}% Collected</span>
                </div>
                <Progress value={paymentPercentage} className="h-2 rounded-full" />
              </div>
            )}
          </div>

          {/* Settled Details Banner */}
          {isSettled && (
            <div className="bg-purple-500/10 border-t border-purple-500/20 px-5 py-3 flex items-center justify-between text-xs text-purple-900 dark:text-purple-200">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-purple-600" />
                <span>
                  Remaining balance of <strong>{formatCurrency(remainingBalance)}</strong> settled manually.
                  {invoice.settlement_reason && (
                    <span className="italic ml-1">("{invoice.settlement_reason}")</span>
                  )}
                </span>
              </div>
            </div>
          )}
        </Card>

        {/* 2. CUSTOMER & DELIVERY CARD */}
        <Card className="shadow-sm border-border/80">
          <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                <User className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Customer Profile
                </CardTitle>
                <h3 className="font-bold text-base text-foreground">
                  {invoice.customers?.name || "Walk-in Guest"}
                </h3>
              </div>
            </div>

            {invoice.customer_id && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-primary gap-1 h-8 px-2"
                onClick={() => {
                  navigate(`/customers/${invoice.customer_id}`, {
                    state: { returnTo: `${location.pathname}${location.search}` },
                  });
                }}
              >
                Full Profile
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            {/* Phone & Contact */}
            <div className="flex items-center justify-between bg-muted/40 rounded-lg p-2.5 border border-border/50">
              <div className="flex items-center gap-2.5 min-w-0">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium text-foreground truncate">
                  {invoice.customers?.phone || "No phone recorded"}
                </span>
              </div>
              {invoice.customers?.phone && (
                <div className="flex items-center gap-1 shrink-0">
                  <a
                    href={`tel:${invoice.customers.phone}`}
                    className="h-7 w-7 rounded-md bg-background border flex items-center justify-center text-muted-foreground hover:text-foreground"
                    title="Call"
                  >
                    <Phone className="h-3.5 w-3.5" />
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      const clean = normalizeWhatsAppPhone(invoice.customers?.phone);
                      if (clean) {
                        window.open(`https://wa.me/${clean}`, "_blank");
                      }
                    }}
                    className="h-7 w-7 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center hover:bg-emerald-500/20"
                    title="Direct WhatsApp"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Target Delivery Date */}
            <div className="flex items-center gap-2.5 bg-muted/40 rounded-lg p-2.5 border border-border/50">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <span className="text-xs text-muted-foreground block">Target Delivery</span>
                <span className="font-medium text-foreground">
                  {expectedDelivery
                    ? format(expectedDelivery, "dd MMM yyyy (EEEE)")
                    : "Not specified"}
                </span>
              </div>
            </div>

            {/* Address */}
            {invoice.customers?.address && (
              <div className="sm:col-span-2 flex items-start gap-2.5 bg-muted/40 rounded-lg p-2.5 border border-border/50">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span className="text-xs text-muted-foreground leading-relaxed">
                  {invoice.customers.address}
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. ORDER ITEMS & LIVE PRODUCTION STATUS */}
        <Card className="shadow-sm border-border/80">
          <CardHeader className="pb-3 pt-4 px-5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground">
                  Garments & Tailoring Items
                </CardTitle>
                <CardDescription className="text-xs">
                  {items.length} {items.length === 1 ? "garment piece" : "garment pieces"} in this order
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {ordersWithCurrentStage.length} Active Orders
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="px-5 pb-5 pt-0 space-y-3">
            {items.map((item: any, i: number) => {
              const linkedOrder =
                item.item_index !== undefined && item.item_index !== null
                  ? orderByItemIndex.get(item.item_index)
                  : orderByItemName.get(normalize(item.name));

              const stageName = linkedOrder?.currentStage || "Ordered";
              const vendorName = linkedOrder?.currentVendor;

              return (
                <div
                  key={i}
                  onClick={() => {
                    if (linkedOrder?.id) {
                      navigate(`/orders/${linkedOrder.id}`, {
                        state: {
                          returnTo: `${location.pathname}${location.search}`,
                          openInvoiceId: invoice.id,
                        },
                      });
                    }
                  }}
                  className={`border rounded-xl p-3.5 transition-all bg-card/60 hover:bg-muted/40 ${
                    linkedOrder?.id ? "cursor-pointer group hover:border-primary/40" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center font-bold text-xs shrink-0 text-muted-foreground">
                        {i + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
                          <span className="truncate">{item.name || "Custom Tailoring Item"}</span>
                          {linkedOrder?.id && (
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          )}
                        </div>

                        {/* Products split count / details */}
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                          {item.num_products > 1 && (
                            <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                              {item.num_products} Pieces Split
                            </Badge>
                          )}
                          <span>Qty: {item.qty || 1}</span>
                          <span>•</span>
                          <span>Unit: {formatCurrency(item.unit_price)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Total Price */}
                    <div className="text-right shrink-0">
                      <span className="font-bold text-sm text-foreground block">
                        {formatCurrency((item.qty || 1) * (item.unit_price || 0))}
                      </span>
                    </div>
                  </div>

                  {/* Stage Tracker & Karigar Pill */}
                  <div className="mt-3 pt-2.5 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="font-medium bg-primary/10 text-primary border-primary/20 text-[11px] py-0.5 px-2"
                      >
                        <Scissors className="h-3 w-3 mr-1" />
                        {stageName}
                      </Badge>
                      {vendorName && (
                        <span className="text-muted-foreground text-[11px]">
                          Karigar: <strong className="text-foreground">{vendorName}</strong>
                        </span>
                      )}
                    </div>

                    {item.delivery_date && (
                      <span className="text-[11px] text-muted-foreground">
                        Target: {format(new Date(item.delivery_date), "dd MMM yyyy")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* 4. BILL BREAKDOWN & NOTES */}
        <Card className="shadow-sm border-border/80">
          <CardHeader className="pb-3 pt-4 px-5">
            <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Bill Breakdown & Discounts
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5 pt-0 space-y-2.5 text-sm">
            <div className="flex justify-between items-center text-muted-foreground">
              <span>Subtotal</span>
              <span className="font-medium text-foreground">{formatCurrency(invoice.subtotal)}</span>
            </div>

            {/* Discount Section */}
            {invoice.raw_payload?.discount > 0 && (
              <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                <span className="flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5" />
                  Discount (
                  {invoice.raw_payload?.discount_type === "percentage"
                    ? `${invoice.raw_payload?.discount}%`
                    : `₹${invoice.raw_payload?.discount}`}
                  )
                </span>
                <span className="font-semibold">
                  -
                  {formatCurrency(
                    invoice.raw_payload?.discount_type === "percentage"
                      ? (parseFloat(invoice.subtotal) *
                          parseFloat(invoice.raw_payload?.discount)) /
                          100
                      : parseFloat(invoice.raw_payload?.discount || 0)
                  )}
                </span>
              </div>
            )}

            {invoice.raw_payload?.coupon_code && (
              <div className="flex justify-between items-center text-xs text-muted-foreground">
                <span>Coupon Applied</span>
                <Badge variant="outline" className="font-mono text-[11px]">
                  {invoice.raw_payload.coupon_code}
                </Badge>
              </div>
            )}

            {invoice.raw_payload?.offer_description && (
              <div className="text-xs text-muted-foreground bg-muted/40 p-2 rounded-lg border">
                <strong>Offer: </strong> {invoice.raw_payload.offer_description}
              </div>
            )}

            <Separator className="my-2" />

            <div className="flex justify-between items-center text-base font-bold text-foreground">
              <span>Net Total</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>

            {/* Remarks note */}
            {invoice.raw_payload?.remarks && invoice.raw_payload.remarks.trim() !== "" && (
              <div className="mt-4 pt-3 border-t border-border/60">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                  Remarks / Tailoring Notes
                </span>
                <p className="text-xs text-muted-foreground whitespace-pre-line bg-muted/30 p-3 rounded-lg border">
                  {invoice.raw_payload.remarks}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 5. PAYMENT TRANSACTIONS & RECORD PAYMENT */}
        <Card className="shadow-sm border-border/80">
          <CardHeader className="pb-3 pt-4 px-5 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-bold text-foreground">
                Payment History
              </CardTitle>
              <CardDescription className="text-xs">
                {invoicePayments.length} recorded {invoicePayments.length === 1 ? "transaction" : "transactions"}
              </CardDescription>
            </div>

            {!isDraft && remainingBalance > 0 && !isSettled && (
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={() => {
                  setPaymentAmount(remainingBalance.toString());
                  setIsPaymentSheetOpen(true);
                }}
              >
                <PlusCircle className="h-3.5 w-3.5" />
                Add Payment
              </Button>
            )}
          </CardHeader>

          <CardContent className="px-5 pb-5 pt-0">
            {invoicePayments.length === 0 ? (
              <div className="py-6 text-center text-muted-foreground text-xs bg-muted/20 rounded-xl border border-dashed">
                <DollarSign className="h-6 w-6 mx-auto mb-1.5 opacity-40" />
                No payment entries logged yet.
              </div>
            ) : (
              <div className="space-y-2">
                {invoicePayments.map((p: any, idx: number) => (
                  <div
                    key={p.id || idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/50 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center font-bold">
                        <Check className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-semibold text-foreground text-sm">
                          {formatCurrency(p.amount)}
                        </div>
                        <div className="text-muted-foreground flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 uppercase">
                            {p.method || "Cash"}
                          </Badge>
                          <span>
                            {p.date ? format(new Date(p.date), "dd MMM yyyy, hh:mm a") : "—"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Settle Trigger */}
            {!isDraft && !isPaid && !isSettled && remainingBalance > 0 && (
              <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  Uncollectible or waived balance?
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs h-8 px-2"
                  onClick={() => setIsSettlingOpen(true)}
                >
                  Settle Balance
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* 6. STICKY MOBILE BOTTOM BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-md border-t border-border p-3 sm:px-6">
        <div className="max-w-4xl mx-auto flex items-center gap-2 sm:gap-3">
          <Button
            variant="outline"
            size="lg"
            className="flex-1 text-xs sm:text-sm font-semibold gap-2 h-11"
            onClick={handlePrint}
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </Button>

          <Button
            variant="default"
            size="lg"
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold gap-2 h-11 shadow-sm"
            onClick={handleSendWhatsApp}
            disabled={isSendingWhatsApp}
          >
            {isSendingWhatsApp ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            WhatsApp Link
          </Button>

          {!isDraft && remainingBalance > 0 && !isSettled && (
            <Button
              variant="default"
              size="lg"
              className="flex-1 text-xs sm:text-sm font-semibold gap-2 h-11"
              onClick={() => {
                setPaymentAmount(remainingBalance.toString());
                setIsPaymentSheetOpen(true);
              }}
            >
              <DollarSign className="h-4 w-4" />
              Pay (₹{Math.round(remainingBalance)})
            </Button>
          )}
        </div>
      </div>

      {/* 7. ADD PAYMENT SHEET / DIALOG */}
      <Sheet open={isPaymentSheetOpen} onOpenChange={setIsPaymentSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] overflow-y-auto px-6 py-5">
          <SheetHeader className="text-left pb-3">
            <SheetTitle className="text-lg font-bold">Record Payment</SheetTitle>
            <SheetDescription className="text-xs">
              Collect full or partial balance against Invoice #{invoice.invoice_number}.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 py-2">
            {/* Quick Amount Presets */}
            <div>
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                Quick Select Amount
              </Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs font-semibold h-9"
                  onClick={() => setPaymentAmount(remainingBalance.toString())}
                >
                  Full ({formatCurrency(remainingBalance)})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs font-semibold h-9"
                  onClick={() => setPaymentAmount(Math.round(remainingBalance / 2).toString())}
                >
                  50% ({formatCurrency(Math.round(remainingBalance / 2))})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs font-semibold h-9"
                  onClick={() => setPaymentAmount("1000")}
                >
                  ₹1,000
                </Button>
              </div>
            </div>

            {/* Amount Input */}
            <div>
              <Label htmlFor="payment-amount" className="text-xs font-medium">
                Payment Amount (₹)
              </Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold">
                  ₹
                </span>
                <Input
                  id="payment-amount"
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  max={remainingBalance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  className="pl-7 h-11 text-lg font-bold"
                />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Remaining collectible balance: {formatCurrency(remainingBalance)}
              </p>
            </div>

            {/* Payment Method Pills */}
            <div>
              <Label className="text-xs font-medium mb-1.5 block">Payment Method</Label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: "cash", label: "Cash", icon: DollarSign },
                  { id: "upi", label: "UPI / GPay", icon: Sparkles },
                  { id: "card", label: "Card", icon: CreditCard },
                  { id: "other", label: "Bank/Other", icon: Building2 },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-xs font-medium transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/40 hover:bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      <Icon className="h-4 w-4 mb-1" />
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payment Date */}
            <div>
              <Label htmlFor="payment-date" className="text-xs font-medium">
                Transaction Date
              </Label>
              <Input
                id="payment-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="h-10 mt-1"
              />
            </div>
          </div>

          <SheetFooter className="mt-4 pt-3 border-t gap-2 flex-col sm:flex-row">
            <Button
              className="w-full h-11 text-sm font-semibold"
              disabled={
                !paymentAmount ||
                parseFloat(paymentAmount) <= 0 ||
                parseFloat(paymentAmount) > remainingBalance + 0.01 ||
                addPaymentMutation.isLoading
              }
              onClick={() => {
                const num = parseFloat(paymentAmount);
                if (isNaN(num) || num <= 0) {
                  toast.error("Please enter a valid amount");
                  return;
                }
                if (num > remainingBalance + 0.01) {
                  toast.error("Amount cannot exceed balance due");
                  return;
                }
                addPaymentMutation.mutate({
                  amount: num,
                  method: paymentMethod,
                  date: paymentDate,
                });
              }}
            >
              {addPaymentMutation.isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Recording...
                </>
              ) : (
                `Confirm Payment of ${formatCurrency(paymentAmount || 0)}`
              )}
            </Button>
            <Button
              variant="outline"
              className="w-full h-10"
              onClick={() => setIsPaymentSheetOpen(false)}
            >
              Cancel
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* 8. SETTLE INVOICE DIALOG */}
      <Dialog open={isSettlingOpen} onOpenChange={setIsSettlingOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <BadgeAlert className="h-5 w-5" />
              Settle Invoice Balance
            </DialogTitle>
            <DialogDescription className="text-xs">
              This will waive the outstanding balance of <strong>{formatCurrency(remainingBalance)}</strong> and mark this invoice as settled. This action is irreversible.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label htmlFor="settlement-reason" className="text-xs font-semibold">
                Reason for Settlement <span className="text-destructive">*</span>
              </Label>
              <Input
                id="settlement-reason"
                value={settlementReason}
                onChange={(e) => setSettlementReason(e.target.value)}
                placeholder="e.g. Customer approved round-off / Goodwill waiver"
                className="mt-1 text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setIsSettlingOpen(false);
                setSettlementReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={!settlementReason.trim() || settleInvoiceMutation.isLoading}
              onClick={() => settleInvoiceMutation.mutate()}
            >
              {settleInvoiceMutation.isLoading ? "Settling..." : "Confirm Settlement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
