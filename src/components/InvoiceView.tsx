import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Send,
  DollarSign,
  Printer,
  Loader2,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { usePDF, pdf } from "@react-pdf/renderer";
import { PrintableInvoice } from "./PrintableInvoice";
import axios from "axios";

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

  const isPaid = invoice.payment_status === "paid";
  const isDraft = invoice.status === "draft";

  const remainingBalance = useMemo(() => {
    const total = parseFloat(invoice.total || 0);
    const paidAmount = parseFloat(invoice.raw_payload?.paid_amount || 0);
    return Math.max(0, total - paidAmount);
  }, [invoice]);

  const invoiceDocument = useMemo(() => {
    const pdfData = {
      ...invoice,
      delivery_date: invoice.raw_payload?.delivery_date,
      isPaid: isPaid || remainingBalance === 0,
      remainingBalance,
    };
    return <PrintableInvoice data={pdfData} />;
  }, [invoice, isPaid, remainingBalance]);

  const [instance, updateInstance] = usePDF({ document: invoiceDocument });

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

  // WhatsApp send (generate PDF blob -> upload -> call WA Notifier)
  const handleSend = async () => {
    try {
      setIsSending(true);
      setSendProgress("Generating PDF...");

      const blob = await pdf(invoiceDocument).toBlob();
      const fileName = `invoice-${invoice.invoice_number}-${Date.now()}.pdf`;

      const { data: upload, error } = await supabase.storage
        .from("invoices")
        .upload(fileName, blob, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (error) throw error;

      const publicUrl = supabase.storage
        .from("invoices")
        .getPublicUrl(upload.path).data.publicUrl;

      const customerPhone = String(invoice.customers?.phone || "").replace(
        /\D/g,
        ""
      );
      if (!customerPhone) {
        toast.error("Customer phone number is missing.");
        setIsSending(false);
        return;
      }

      const message = `Hello ${invoice.customers?.name || ""}! 👋
Here is your Saree Palace Elite invoice.
💰 Total: ₹${invoice.total.toLocaleString()}
🧾 Invoice No: ${invoice.invoice_number}`;

      setSendProgress("Sending via WhatsApp...");
      await axios.post(WA_WEBHOOK_URL, {
        to: `91${customerPhone}`,
        message,
        invoice_number: invoice.invoice_number,
        total: `₹${invoice.total.toLocaleString()}`,
        invoice_url: publicUrl,
      });

      toast.success(`Invoice sent to ${invoice.customers?.name} via WhatsApp`);
    } catch (err: any) {
      console.error("❌ WhatsApp send failed:", err);
      toast.error(err.message || "Failed to send invoice via WhatsApp");
    } finally {
      setIsSending(false);
      setSendProgress("");
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
  const updatePartialPaymentMutation = useMutation({
    mutationFn: async (amount: number) => {
      const total = parseFloat(invoice.total);
      const newPaidAmount = Math.min(amount, total);
      const newStatus =
        newPaidAmount >= total ? "paid" : newPaidAmount > 0 ? "partial" : "unpaid";

      const { error: invoiceError } = await supabase
        .from("invoices")
        .update({
          raw_payload: {
            ...invoice.raw_payload,
            payment_status: newStatus,
            paid_amount: newPaidAmount,
          },
        })
        .eq("id", invoice.id);
      if (invoiceError) throw invoiceError;

      const { error: ordersError } = await supabase
        .from("orders")
        .update({ payment_status: newStatus === "paid" ? "paid" : "unpaid" })
        .eq("invoice_id", invoice.id);
      if (ordersError) throw ordersError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setIsEditingPayment(false);
      setPartialPaymentAmount("");
      toast.success("Partial payment updated successfully");
    },
  });

  return (
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
                isPaid
                  ? "success"
                  : invoice.raw_payload?.payment_status === "partial"
                    ? "warning"
                    : "destructive"
              }
              className="text-lg px-4 py-2"
            >
              {isPaid
                ? "PAID"
                : invoice.raw_payload?.payment_status === "partial"
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
                  </tr>
                </thead>
                <tbody>
                  {(invoice.raw_payload?.items || []).map((item: any, i: number) => (
                    <tr key={i} className="border-t">
                      <td className="p-3">{item.name}</td>
                      <td className="p-3 text-right">{item.num_products || 1}</td>
                      <td className="p-3 text-right">{item.qty}</td>
                      <td className="p-3 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="p-3 text-right font-medium">
                        {formatCurrency(item.qty * item.unit_price)}
                      </td>
                    </tr>
                  ))}
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

            {remainingBalance > 0 && (
              <>
                <div className="flex justify-between text-success border-t pt-2">
                  <span>Paid Amount:</span>
                  <span className="font-medium">
                    {formatCurrency(invoice.raw_payload?.paid_amount || 0)}
                  </span>
                </div>
                <div className="flex justify-between text-destructive font-semibold">
                  <span>Remaining:</span>
                  <span>{formatCurrency(remainingBalance)}</span>
                </div>
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
          {!isPaid && (
            <div className="border rounded-lg p-4 bg-muted/30">
              <h3 className="font-semibold mb-3">Update Payment</h3>
              {!isEditingPayment ? (
                <Button onClick={() => setIsEditingPayment(true)} variant="outline" size="sm">
                  <DollarSign className="w-4 h-4 mr-2" />
                  Update Partial Payment
                </Button>
              ) : (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="partial_payment">Amount to Add</Label>
                    <Input
                      id="partial_payment"
                      type="number"
                      step="0.01"
                      min="0"
                      max={parseFloat(invoice.total) - parseFloat(invoice.raw_payload?.paid_amount || 0)}
                      value={partialPaymentAmount}
                      onChange={(e) => setPartialPaymentAmount(e.target.value)}
                      placeholder="Enter amount"
                    />
                    <p className="text-sm text-muted-foreground mt-1">
                      Current: {formatCurrency(invoice.raw_payload?.paid_amount || 0)} | Remaining: {formatCurrency(remainingBalance)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        const currentPaid = parseFloat(invoice.raw_payload?.paid_amount || 0);
                        const additionalAmount = parseFloat(partialPaymentAmount);
                        if (additionalAmount > 0) {
                          updatePartialPaymentMutation.mutate(currentPaid + additionalAmount);
                        }
                      }}
                      disabled={!partialPaymentAmount || parseFloat(partialPaymentAmount) <= 0}
                      size="sm"
                    >
                      Update Payment
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
      </DialogContent>
    </Dialog>
  );
}
