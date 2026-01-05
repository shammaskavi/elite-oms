import { useState, useMemo, useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Send,
  DollarSign,
  Printer,
  Loader2,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { derivePaymentStatus } from "@/lib/derivePaymentStatus";
import { toast } from "sonner";
import { usePDF, pdf } from "@react-pdf/renderer";
import { PrintableInvoice } from "./PrintableInvoice";
// import axios from "axios";


const WA_WEBHOOK_URL =
  "https://app.wanotifier.com/api/v1/notifications/PNZmRBoX2G?key=A9DK378ZaegHsE4ER7r9LQNC0IdbpH";

interface InvoiceViewProps {
  invoice: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEditDraft?: (invoice: any) => void;
}


const formatCurrency = (value: any) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

export function InvoiceView({
  invoice,
  open,
  onOpenChange,
  onEditDraft,
}: InvoiceViewProps) {
  const queryClient = useQueryClient();
  const [isSending, setIsSending] = useState(false);
  const [sendProgress, setSendProgress] = useState("");
  const [isEditingPayment, setIsEditingPayment] = useState(false);
  const [partialPaymentAmount, setPartialPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [isSettling, setIsSettling] = useState(false);
  const [settlementReason, setSettlementReason] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  // helper to normalize strings
  const normalize = (v?: string) =>
    v?.trim().toLowerCase() ?? "";

  // Fetch orders linked to this invoice (with stages)
  const { data: invoiceOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["invoice-orders-with-stages", invoice.id],
    queryFn: async () => {
      if (!invoice?.id) return [];

      const { data, error } = await (supabase as any)
        .from("orders")
        .select(`
        id,
        order_code,
        metadata,
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

  // Determine current stage for each order
  const ordersWithCurrentStage = useMemo(() => {
    return invoiceOrders.map((order: any) => {
      const stages = [...(order.order_stages || [])].sort(
        (a, b) =>
          new Date(a.created_at).getTime() -
          new Date(b.created_at).getTime()
      );

      const currentStage =
        stages.length > 0
          ? stages[stages.length - 1].stage_name
          : "Ordered";

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

  // Map of itemIndex to order for quick lookup
  const orderByItemName = useMemo(() => {
    const map = new Map<string, any>();
    ordersWithCurrentStage.forEach((order: any) => {
      if (order.metadata?.item_name) {
        map.set(
          normalize(order.metadata.item_name),
          order
        );
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

  const { data: paymentInfo, isLoading: statusLoading } = useQuery({
    queryKey: ["invoice-payment-status", invoice.id],
    queryFn: () => derivePaymentStatus(invoice),
  });

  const paidAmount =
    paymentInfo?.paid ??
    parseFloat(invoice.raw_payload?.paid_amount || 0);

  const remaining =
    paymentInfo?.remaining ??
    Math.max(0, invoice.total - paidAmount);

  const status =
    paymentInfo?.status ??
    (invoice.raw_payload?.payment_status || "unpaid");
  const isSettled = invoice.settled === true;

  // const isPaid =
  //   invoice.raw_payload?.payment_status === "paid" ||
  //   parseFloat(invoice.raw_payload?.paid_amount || 0) >= parseFloat(invoice.total);
  // const isDraft = invoice.status === "draft";
  const isPaid = status === "paid";
  const isDraft = invoice.status === "draft"; // ✅ RESTOREDF

  // const remainingBalance = useMemo(() => {
  //   const total = parseFloat(invoice.total || 0);
  //   const paidAmount = parseFloat(invoice.raw_payload?.paid_amount || 0);
  //   return Math.max(0, total - paidAmount);
  // }, [invoice]);
  const remainingBalance = remaining;

  // const invoiceDocument = useMemo(() => {
  //   const pdfData = {
  //     ...invoice,
  //     delivery_date: invoice.raw_payload?.delivery_date,
  //     isPaid: isPaid || remainingBalance === 0,
  //     remainingBalance,
  //   };
  //   return <PrintableInvoice data={pdfData} />;
  // }, [invoice, isPaid, remainingBalance]);

  const { data: invoicePayments = [] } = useQuery({
    queryKey: ["invoice-payments-for-invoice", invoice.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoice_payments")
        .select("*")
        .eq("invoice_id", invoice.id)
        .order("date", { ascending: true });

      if (error) throw error;
      return data || [];
    },
    enabled: !!invoice?.id,   // only run when invoice.id exists
  });


  const invoiceDocument = useMemo(() => {
    const pdfData = {
      ...invoice,
      delivery_date: invoice.raw_payload?.delivery_date,
      isPaid: status === "paid",
      paidAmount,              // already there
      remainingBalance: remaining,
    };
    return (
      <PrintableInvoice
        data={pdfData}
        payments={invoicePayments}   // 👈 pass payments here
      />
    );
  }, [invoice, status, paidAmount, remaining, invoicePayments]);

  const [instance, updateInstance] = usePDF({ document: invoiceDocument });
  useEffect(() => {
    updateInstance(invoiceDocument);
  }, [invoiceDocument, invoicePayments]);

  useEffect(() => {
    if (ordersWithCurrentStage.length) {
      console.log("Invoice Orders →", ordersWithCurrentStage);
    }
  }, [ordersWithCurrentStage]);

  // Print (opens PDF and triggers print dialog)
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
        }, 1000);
      } else {
        toast.error("Pop-up blocked. Please allow pop-ups to print.");
      }
    } else {
      toast.info("Generating invoice PDF...");
    }
  };

  // Ensure tracking token exists
  async function ensureTrackingToken(invoiceId: string) {
    const { data, error } = await supabase
      .from("invoices")
      .select("tracking_token")
      .eq("id", invoiceId)
      .single();

    if (error) throw error;

    // ✅ Token already exists → reuse
    if (data?.tracking_token) {
      return data.tracking_token;
    }

    // ✅ Generate new token
    const token = uuidv4();

    const { error: updateError } = await supabase
      .from("invoices")
      .update({ tracking_token: token })
      .eq("id", invoiceId);

    if (updateError) throw updateError;

    return token;
  }

  // WhatsApp send (generate PDF blob -> upload -> call WA Notifier)
  // const handleSend = async () => {
  //   try {
  //     setIsSending(true);
  //     setSendProgress("Generating PDF...");

  //     const blob = await pdf(invoiceDocument).toBlob();
  //     const fileName = `invoice-${invoice.invoice_number}-${Date.now()}.pdf`;

  //     const { data: upload, error } = await supabase.storage
  //       .from("invoices")
  //       .upload(fileName, blob, {
  //         contentType: "application/pdf",
  //         upsert: true,
  //       });
  //     if (error) throw error;

  //     const publicUrl = supabase.storage
  //       .from("invoices")
  //       .getPublicUrl(upload.path).data.publicUrl;

  //     await supabase
  //       .from("invoices")
  //       .update({
  //         raw_payload: {
  //           ...invoice.raw_payload,
  //           invoice_file_url: publicUrl,
  //         },
  //       })
  //       .eq("id", invoice.id);

  //     const customerPhone = String(invoice.customers?.phone || "").replace(
  //       /\D/g,
  //       ""
  //     );
  //     if (!customerPhone) {
  //       toast.error("Customer phone number is missing.");
  //       setIsSending(false);
  //       return;
  //     }
  //     const trackingToken = await ensureTrackingToken(invoice.id);
  //     console.log("Tracking token:", trackingToken);

  //     const message = `
  //     Hello ${invoice.customers?.name || ""}!
  //     👋Here is your Saree Palace Elite invoice.
  //     💰 Total: ₹${invoice.total.toLocaleString()}
  //     🧾 Invoice No: ${invoice.invoice_number}
  //     `;

  //     setSendProgress("Sending via WhatsApp...");
  //     await axios.post(WA_WEBHOOK_URL, {
  //       to: `91${customerPhone}`,
  //       message,
  //       invoice_number: invoice.invoice_number,
  //       total: `₹${invoice.total.toLocaleString()}`,
  //       invoice_url: publicUrl,
  //     });

  //     toast.success(`Invoice sent to ${invoice.customers?.name} via WhatsApp`);
  //   } catch (err: any) {
  //     console.error("❌ WhatsApp send failed:", err);
  //     toast.error(err.message || "Failed to send invoice via WhatsApp");
  //   } finally {
  //     setIsSending(false);
  //     setSendProgress("");
  //   }
  // };

  const getExpectedDeliveryDate = () => {
    const items = invoice.raw_payload?.items || [];

    // Collect all valid item delivery dates
    const itemDates = items
      .map((item: any) => item.delivery_date)
      .filter(Boolean)
      .map((d: string) => new Date(d).getTime());

    if (itemDates.length > 0) {
      // Return the LATEST delivery date (safe promise)
      return new Date(Math.max(...itemDates));
    }

    // Fallback to invoice-level delivery date
    if (invoice.raw_payload?.delivery_date) {
      return new Date(invoice.raw_payload.delivery_date);
    }

    return null;
  };

  const normalizePhoneForWhatsApp = (rawPhone?: string) => {
    if (!rawPhone) return null;

    const trimmed = rawPhone.trim();

    // If number starts with +, keep country code
    if (trimmed.startsWith("+")) {
      return trimmed.replace(/\D/g, "");
    }

    // Otherwise assume India
    const digits = trimmed.replace(/\D/g, "");
    return digits ? `91${digits}` : null;
  };

  const handleSend = async () => {
    try {
      // const phone = String(invoice.customers?.phone || "").replace(/\D/g, "");
      const phone = normalizePhoneForWhatsApp(invoice.customers?.phone);
      if (!phone) {
        toast.error("Customer phone number is missing.");
        return;
      }

      const trackingToken = await ensureTrackingToken(invoice.id);
      const trackingUrl = `${window.location.origin}/track/${trackingToken}`;
      const expectedDelivery = getExpectedDeliveryDate();
      const formattedDelivery = expectedDelivery
        ? expectedDelivery.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        })
        : null;
      const message = `
Hello ${invoice.customers?.name || ""}! 👋

Here is your Saree Palace Elite invoice.

🧾 Invoice No: ${invoice.invoice_number}
💰 Total Invoice Amount: ₹${invoice.total.toLocaleString("en-IN")}
${formattedDelivery ? `📅 Expected Delivery: ${formattedDelivery}` : ""}


📦 To know the status of your oder click below:
${trackingUrl}
    `.trim();

      // const waUrl = `https://wa.me/91${phone}?text=${encodeURIComponent(message)}`;
      const waUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
      window.open(waUrl, "_blank");
    } catch (err) {
      console.error("WhatsApp redirect failed:", err);
      toast.error("Failed to open WhatsApp");

    }
  };

  // Mark paid/unpaid
  const updatePaymentMutation = useMutation({
    mutationFn: async (status: "paid" | "unpaid") => {
      const newPaidAmount = status === "paid" ? parseFloat(invoice.total) : 0;

      // Update all orders linked to this invoice
      const { error: orderError } = await supabase
        .from("orders")
        .update({ payment_status: status })
        .eq("invoice_id", invoice.id);
      if (orderError) throw orderError;

      // Update invoice (both top-level + raw_payload)
      const { error: invoiceError } = await supabase
        .from("invoices")
        .update({
          payment_status: status, // ✅ top-level status update
          raw_payload: {
            ...invoice.raw_payload,
            payment_status: status,
            paid_amount: newPaidAmount,
          },
        })
        .eq("id", invoice.id);

      if (invoiceError) throw invoiceError;
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(
        status === "paid" ? "Marked as Paid successfully" : "Marked as Unpaid successfully"
      );
    },
    onError: (error) => {
      console.error("Error updating payment status:", error);
      toast.error("Failed to update payment status. Check console for details.");
    },
  });


  // Partial payment mutation
  // const updatePartialPaymentMutation = useMutation({
  //   mutationFn: async (amount: number) => {
  //     const total = parseFloat(invoice.total);
  //     const newPaidAmount = Math.min(amount, total);
  //     const newStatus =
  //       newPaidAmount >= total ? "paid" : newPaidAmount > 0 ? "partial" : "unpaid";

  //     const { error: invoiceError } = await supabase
  //       .from("invoices")
  //       .update({
  //         raw_payload: {
  //           ...invoice.raw_payload,
  //           payment_status: newStatus,
  //           paid_amount: newPaidAmount,
  //         },
  //       })
  //       .eq("id", invoice.id);
  //     if (invoiceError) throw invoiceError;

  //     const { error: ordersError } = await supabase
  //       .from("orders")
  //       .update({ payment_status: newStatus === "paid" ? "paid" : "unpaid" })
  //       .eq("invoice_id", invoice.id);
  //     if (ordersError) throw ordersError;
  //   },
  //   onSuccess: () => {
  //     queryClient.invalidateQueries({ queryKey: ["invoices"] });
  //     setIsEditingPayment(false);
  //     setPartialPaymentAmount("");
  //     toast.success("Partial payment updated successfully");
  //   },
  // });

  // updated
  // NEW — Add Payment Mutation

  const addPaymentMutation = useMutation({
    mutationFn: async (amount: number) => {
      if (!invoice.id) throw new Error("Missing invoice id");

      // 1️⃣ Insert new payment record
      const { error: insertErr } = await (supabase as any)
        .from("invoice_payments")
        .insert({
          invoice_id: invoice.id,
          amount,
          method: paymentMethod,
          date: paymentDate,
        });

      if (insertErr) throw insertErr;

      // 2️⃣ Do NOT update raw_payload anymore — legacy stays for reference only
      // derivePaymentStatus will now pick up DB payments

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["invoice-payments"] });
      toast.success("Payment added successfully");
      setIsEditingPayment(false);
      setPartialPaymentAmount("");
    },
    onError: (err) => {
      console.error("Payment insert failed:", err);
      toast.error("Failed to add payment");
    },
  });

  const settleInvoiceMutation = useMutation({
    mutationFn: async () => {
      if (!invoice.id) throw new Error("Missing invoice id");
      if (!settlementReason.trim()) throw new Error("Settlement reason required");

      const { error } = await supabase
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
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Invoice settled successfully");
      setIsSettling(false);
      setSettlementReason("");
    },
    onError: (err: any) => {
      console.error("Settlement failed:", err);
      toast.error(err.message || "Failed to settle invoice");
    },
  });

  return (
    <TooltipProvider delayDuration={200}>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl">
              {isDraft ? "Draft Invoice" : "Invoice Details"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-3xl font-bold">{invoice.invoice_number}</h2>
                <p className="text-muted-foreground mt-1">
                  {new Date(invoice.date).toLocaleDateString()}
                </p>
              </div>
              <Badge
                variant={
                  isSettled
                    ? "secondary"
                    : status === "paid"
                      ? "success"
                      : status === "partial"
                        ? "warning"
                        : "destructive"
                }
                className="text-lg px-4 py-2"
              >
                {isSettled
                  ? "SETTLED"
                  : status === "paid"
                    ? "PAID"
                    : status === "partial"
                      ? "PARTIALLY PAID"
                      : "UNPAID"}
              </Badge>
            </div>

            {/* Customer */}
            <div className="border rounded-lg p-4 bg-muted/50">
              <h3 className="font-semibold mb-2">Customer Details</h3>
              <p className="text-lg font-medium">
                {invoice.customers?.name || "N/A"}
              </p>
              <p className="text-sm mt-1">📞 {invoice.customers?.phone || "N/A"}</p>
              <p className="text-sm mt-1">📍 {invoice.customers?.address || "N/A"}</p>
              <p className="text-sm mt-1">🗓️ {new Date(invoice.raw_payload.delivery_date).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: '2-digit',
              }) || "N/A"}</p>
            </div>

            {/* Items (restored) */}
            <div>
              <h3 className="font-semibold mb-3">Items</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3">Item</th>
                      <th className="text-right p-3">Products</th>
                      <th className="text-right p-3">Qty</th>
                      <th className="text-right p-3">Price</th>
                      <th className="text-right p-3">Total</th>
                      <th className="text-left p-3">Production</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(invoice.raw_payload?.items || []).map((item: any, i: number) => {
                      // const linkedOrder = orderByItemName.get(
                      //   normalize(item.name)
                      // );

                      // const linkedOrder =
                      //   orderByItemIndex.get(i + 1) ??
                      //   orderByItemName.get(normalize(item.name));

                      const linkedOrder =
                        typeof item.item_index === "number"
                          ? orderByItemIndex.get(item.item_index)
                          : orderByItemName.get(normalize(item.name));

                      return (
                        <tr key={i} className="border-t cursor-pointer hover:bg-muted/50"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!linkedOrder?.id) return;
                            const returnTo =
                              (location.state as any)?.returnTo || location.pathname;

                            navigate(`/orders/${linkedOrder.id}`, {
                              state: {
                                returnTo,
                                openInvoiceId: invoice.id,
                              },
                            });
                          }}
                        >
                          <td className="p-3">{item.name}</td>
                          <td className="p-3 text-right">{item.num_products || 1}</td>
                          <td className="p-3 text-right">{item.qty}</td>
                          <td className="p-3 text-right">{formatCurrency(item.unit_price)}</td>
                          <td className="p-3 text-right font-medium">
                            {formatCurrency(item.qty * item.unit_price)}
                          </td>
                          <td className="p-3">
                            {linkedOrder ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="inline-block">
                                    <Badge variant="secondary" className="cursor-help"
                                    >
                                      {linkedOrder.currentStage}
                                    </Badge>
                                  </div>
                                </TooltipTrigger>

                                <TooltipContent
                                  side="left"
                                  className="text-xs space-y-1"
                                >
                                  <div>
                                    <span className="font-medium">Vendor:</span>{" "}
                                    {linkedOrder.currentVendor || "N/A"}
                                  </div>

                                  <div>
                                    <span className="font-medium">Delivery date:</span>{" "}
                                    {item.delivery_date
                                      ? new Date(item.delivery_date).toLocaleDateString("en-IN", {
                                        day: "2-digit",
                                        month: "short",
                                        year: "numeric",
                                      })
                                      : invoice.raw_payload?.delivery_date
                                        ? new Date(invoice.raw_payload.delivery_date).toLocaleDateString(
                                          "en-IN",
                                          {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                          }
                                        )
                                        : "—"}
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            ) : (
                              <span className="text-xs text-muted-foreground">—N/A</span>
                            )}
                          </td>
                        </tr>
                      )

                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="border rounded-lg p-4 space-y-2 bg-muted/50">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span className="font-medium">{formatCurrency(invoice.subtotal)}</span>
              </div>

              {invoice.raw_payload?.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>
                    Discount (
                    {invoice.raw_payload?.discount_type === "percentage"
                      ? `${invoice.raw_payload?.discount}%`
                      : `₹${invoice.raw_payload?.discount}`}
                    ):
                  </span>
                  <span className="font-medium">
                    -{formatCurrency(
                      invoice.raw_payload?.discount_type === "percentage"
                        ? (parseFloat(invoice.subtotal) *
                          parseFloat(invoice.raw_payload?.discount)) /
                        100
                        : parseFloat(invoice.raw_payload?.discount || 0)
                    )}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-lg font-bold border-t pt-2">
                <span>Total:</span>
                <span>{formatCurrency(invoice.total)}</span>
              </div>

              {!invoice.settled && remainingBalance > 0 && (
                <>
                  <div className="flex justify-between text-success border-t pt-2">
                    <span>Paid Amount:</span>
                    <span className="font-medium">{formatCurrency(paidAmount)}</span>
                  </div>
                  <div className="flex justify-between text-destructive font-semibold">
                    <span>Remaining:</span>
                    <span>{formatCurrency(remainingBalance)}</span>
                  </div>
                </>
              )}
              {invoice.settled && (
                <>
                  <div className="flex justify-between text-success border-t pt-2">
                    <span>Paid Amount:</span>
                    <span className="font-medium">{formatCurrency(paidAmount)}</span>
                  </div>
                  <div className="flex justify-between text-amber-700 font-semibold">
                    <span>Settled Amount:</span>
                    <span>{formatCurrency(remainingBalance)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Unpaid amount of {formatCurrency(remainingBalance)} has been settled manually.
                  </p>
                  {invoice.settlement_reason && (
                    <p className="text-sm italic text-muted-foreground">
                      Reason: {invoice.settlement_reason}
                    </p>
                  )}
                </>
              )}

              {invoice.raw_payload?.coupon_code && (
                <div className="flex justify-between text-muted-foreground text-sm border-t pt-2">
                  <span>Coupon Code:</span>
                  <span className="font-mono">{invoice.raw_payload.coupon_code}</span>
                </div>
              )}
              {invoice.raw_payload?.offer_description && (
                <div className="text-sm text-muted-foreground border-t pt-2">
                  <span className="font-medium">Offer: </span>
                  {invoice.raw_payload.offer_description}
                </div>
              )}
            </div>

            {/* Remarks */}
            {invoice.raw_payload?.remarks && invoice.raw_payload.remarks.trim() !== "" && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <h3 className="font-semibold mb-2">Remarks</h3>
                <p className="text-sm whitespace-pre-line text-muted-foreground">
                  {invoice.raw_payload.remarks}
                </p>
              </div>
            )}

            {/* Partial Payment Section */}
            {!isDraft && !isPaid && !invoice.settled && remainingBalance > 0 && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <h3 className="font-semibold mb-3">Update Payment</h3>
                {!isEditingPayment ? (
                  <div className="flex gap-2">
                    <Button onClick={() => setIsEditingPayment(true)} variant="outline" size="sm">
                      <DollarSign className="w-4 h-4 mr-2" />
                      Add Payment
                    </Button>
                    {!invoice.settled && (
                      <Button
                        onClick={() => setIsSettling(true)}
                        variant="destructive"
                        size="sm"
                      >
                        Settle Invoice
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="partial_payment">Amount to Add</Label>
                      <Input
                        id="partial_payment"
                        type="number"
                        step="0.01"
                        min="0"
                        max={parseFloat(invoice.total) - paidAmount}
                        value={partialPaymentAmount}
                        onChange={(e) => setPartialPaymentAmount(e.target.value)}
                        placeholder="Enter amount"
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        Current: {formatCurrency(paidAmount)} | Remaining: {formatCurrency(remainingBalance)}
                      </p>
                    </div>
                    {/* date section & payment type */}
                    <div>
                      <Label className="text-sm">Payment Method</Label>
                      <Select
                        value={paymentMethod}
                        onValueChange={setPaymentMethod}
                      >
                        <SelectTrigger className="h-9 mt-1">
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
                    <div>
                      <Label htmlFor="payment_date" className="text-sm">Payment Date</Label>
                      <Input
                        id="payment_date"
                        type="date"
                        className="h-9 mt-1"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          const amount = parseFloat(partialPaymentAmount);
                          // ensure valid amount and does not exceed remaining
                          if (isNaN(amount) || amount <= 0) {
                            toast.error("Enter a valid amount");
                            return;
                          }
                          if (amount > remainingBalance) {
                            toast.error("Amount exceeds remaining balance");
                            return;
                          }
                          addPaymentMutation.mutate(amount);
                        }}
                        disabled={!partialPaymentAmount || parseFloat(partialPaymentAmount) <= 0}
                        size="sm"
                      >
                        Add Payment
                      </Button>
                      <Button onClick={() => { setIsEditingPayment(false); setPartialPaymentAmount(""); }} variant="outline" size="sm">
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3">
              {isDraft ? (
                <>
                  <div className="w-full bg-muted/50 border border-muted-foreground/20 rounded-lg p-4">
                    <p className="text-sm font-medium mb-2">
                      This invoice is currently a draft. You can continue editing it before finalizing.
                    </p>
                    <Button onClick={() => onEditDraft?.(invoice)} className="mr-2" >
                      <Pencil className="w-4 h-4 mr-2" />
                      Continue Editing
                    </Button>

                    <Button onClick={handlePrint} variant="outline">
                      <Printer className="w-4 h-4 mr-2" />
                      Print Invoice
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <Button onClick={handlePrint} variant="outline">
                    <Printer className="w-4 h-4 mr-2" />
                    Print Invoice
                  </Button>

                  <Button onClick={handleSend} disabled={isSending}>
                    {isSending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {sendProgress || "Sending..."}
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send via WhatsApp
                      </>
                    )}
                  </Button>

                  {/* <Button
                  onClick={() => updatePaymentMutation.mutate(isPaid ? "unpaid" : "paid")}
                  variant={isPaid ? "outline" : "default"}
                >
                  <DollarSign className="w-4 h-4 mr-2" />
                  Mark as {isPaid ? "Unpaid" : "Paid"}
                </Button> */}
                </>
              )}
            </div>

          </div>
          {/* Settlement Confirmation Dialog */}
          <Dialog open={isSettling} onOpenChange={setIsSettling}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Settle Invoice</DialogTitle>
              </DialogHeader>

              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  This will permanently settle the invoice even if some balance remains.
                  This action cannot be undone.
                </p>

                <div>
                  <Label htmlFor="settlement_reason">Settlement Reason</Label>
                  <Input
                    id="settlement_reason"
                    value={settlementReason}
                    onChange={(e) => setSettlementReason(e.target.value)}
                    placeholder="Enter reason for settling invoice"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setIsSettling(false);
                      setSettlementReason("");
                    }}
                  >
                    Cancel
                  </Button>

                  <Button
                    variant="destructive"
                    onClick={() => settleInvoiceMutation.mutate()}
                    disabled={!settlementReason.trim() || settleInvoiceMutation.isLoading}
                  >
                    {settleInvoiceMutation.isLoading ? "Settling..." : "Confirm Settlement"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}