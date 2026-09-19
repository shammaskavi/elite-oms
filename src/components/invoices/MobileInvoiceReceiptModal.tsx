import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  MessageSquare,
  Printer,
  Download,
  CheckCircle2,
  Clock,
  Scissors,
  Share2,
  Calendar,
  User,
  Phone,
  Receipt,
  Sparkles,
  ExternalLink,
  Check,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { openWhatsApp, ensureInvoiceTrackingToken } from "@/lib/whatsapp";
import { pdf } from "@react-pdf/renderer";
import { PrintableInvoice } from "@/components/PrintableInvoice";

interface MobileInvoiceReceiptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: any;
  onNewSale?: () => void;
}

export function MobileInvoiceReceiptModal({
  open,
  onOpenChange,
  invoice,
  onNewSale,
}: MobileInvoiceReceiptModalProps) {
  const navigate = useNavigate();
  const [copiedLink, setCopiedLink] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  if (!invoice) return null;

  const raw = invoice.raw_payload || {};
  const items = raw.items || invoice.invoice_items || [];
  const customer = invoice.customers || invoice.customer || {};
  const isPaid = invoice.payment_status === "paid";
  const isPartial = invoice.payment_status === "partial";
  const paidAmount = parseFloat(raw.paid_amount || invoice.paid_amount || 0);
  const totalAmount = parseFloat(invoice.total || 0);
  const balanceDue = Math.max(0, totalAmount - paidAmount);

  const handleShareWhatsApp = async () => {
    if (!customer.phone) {
      toast.error("Customer does not have a registered phone number");
      return;
    }

    try {
      let trackingUrl = "";
      try {
        const token = await ensureInvoiceTrackingToken(invoice.id);
        trackingUrl = `${window.location.origin}/track/${token}`;
      } catch (e) {
        trackingUrl = window.location.origin;
      }

      const greeting = `Hello ${customer.name || "Valued Customer"},\n\nThank you for choosing *Saree Palace Elite*! ✨\n\n📄 *Invoice #${invoice.invoice_number}*\n💰 Total: ₹${totalAmount.toFixed(2)}\n💵 Paid: ₹${paidAmount.toFixed(2)}${
        balanceDue > 0 ? `\n⏳ Balance Due: ₹${balanceDue.toFixed(2)}` : ""
      }\n📅 Expected Delivery: ${raw.delivery_date || invoice.date || "As scheduled"}\n\n🔍 Track live garment workshop & tailoring status here:\n🔗 ${trackingUrl}\n\nThank you!`;

      openWhatsApp(customer.phone, greeting);
      toast.success("WhatsApp opened for invoice sharing");
    } catch (err: any) {
      toast.error(err.message || "Failed to open WhatsApp");
    }
  };

  const handleCopyTrackLink = async () => {
    try {
      const token = await ensureInvoiceTrackingToken(invoice.id);
      const url = `${window.location.origin}/track/${token}`;
      await navigator.clipboard.writeText(url);
      setCopiedLink(true);
      toast.success("Tracking link copied to clipboard");
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err: any) {
      toast.error("Failed to copy tracking link");
    }
  };

  const handlePrintPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      if (invoice.file_url) {
        window.open(invoice.file_url, "_blank");
        return;
      }

      const blob = await pdf(
        <PrintableInvoice
          data={{
            ...invoice,
            delivery_date: raw.delivery_date,
            isPaid: isPaid,
            paidAmount: paidAmount,
            remainingBalance: balanceDue,
          }}
          payments={[]}
        />
      ).toBlob();

      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, "_blank");
    } catch (err: any) {
      toast.error("Failed to generate PDF for printing");
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg w-full p-0 overflow-hidden max-h-[92vh] flex flex-col bg-background">
        {/* Header Ribbon */}
        <div className="bg-primary text-primary-foreground p-5 pb-4 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 opacity-90" />
              <span className="font-bold text-sm tracking-wide uppercase">Boutique Invoice Receipt</span>
            </div>
            <Badge
              variant="outline"
              className={`text-xs px-2.5 py-0.5 font-bold ${
                isPaid
                  ? "bg-emerald-500/20 text-emerald-100 border-emerald-400/40"
                  : isPartial
                  ? "bg-amber-500/20 text-amber-100 border-amber-400/40"
                  : "bg-red-500/20 text-red-100 border-red-400/40"
              }`}
            >
              {isPaid ? "PAID IN FULL" : isPartial ? "PARTIAL ADVANCE" : "UNPAID"}
            </Badge>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <p className="text-xs text-primary-foreground/70">Invoice Number</p>
              <h2 className="text-2xl font-bold font-mono tracking-tight">{invoice.invoice_number}</h2>
            </div>
            <div className="text-right">
              <p className="text-xs text-primary-foreground/70">Total Amount</p>
              <p className="text-2xl font-bold">₹{totalAmount.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Scrollable Receipt Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Customer Card */}
          <div className="bg-muted/40 rounded-xl p-3 border space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-semibold text-foreground text-sm">
                <User className="h-4 w-4 text-primary" />
                <span>{customer.name || "Walk-in Customer"}</span>
              </div>
              {customer.phone && (
                <div className="flex items-center gap-1 text-muted-foreground font-mono">
                  <Phone className="h-3.5 w-3.5" />
                  <span>{customer.phone}</span>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 border-t">
              <span>Date: {invoice.date || new Date().toISOString().split("T")[0]}</span>
              {raw.delivery_date && (
                <span className="font-semibold text-primary">
                  Delivery: {raw.delivery_date}
                </span>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground px-1">
              <span>Item Description</span>
              <span>Amount</span>
            </div>

            <div className="divide-y border rounded-xl overflow-hidden bg-card">
              {items.map((item: any, idx: number) => {
                const qty = parseFloat(item.qty || 1);
                const price = parseFloat(item.unit_price || 0);
                const lineTotal = qty * price;
                const numPieces = parseInt(item.num_products || 1);

                return (
                  <div key={idx} className="p-3 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground text-xs truncate">{item.name}</p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                          <span>{qty} × ₹{price.toFixed(2)}</span>
                          {numPieces > 1 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-primary/5 text-primary border-primary/20">
                              {numPieces} Pieces
                            </Badge>
                          )}
                        </div>
                      </div>
                      <span className="font-bold text-foreground text-sm shrink-0">
                        ₹{lineTotal.toFixed(2)}
                      </span>
                    </div>

                    {item.reference_name && (
                      <p className="text-[10px] bg-muted/60 text-muted-foreground px-2 py-0.5 rounded w-fit italic">
                        Note: {item.reference_name}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pricing Calculations */}
          <div className="bg-muted/30 rounded-xl p-3 border space-y-1.5">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal:</span>
              <span className="font-medium text-foreground">₹{parseFloat(invoice.subtotal || totalAmount).toFixed(2)}</span>
            </div>

            {parseFloat(raw.discount || 0) > 0 && (
              <div className="flex justify-between text-emerald-600 font-medium">
                <span>
                  Discount {raw.discount_type === "percentage" ? `(${raw.discount}%)` : `(Fixed)`}:
                </span>
                <span>
                  -₹{raw.discount_type === "percentage"
                    ? ((parseFloat(invoice.subtotal || 0) * parseFloat(raw.discount)) / 100).toFixed(2)
                    : parseFloat(raw.discount).toFixed(2)}
                </span>
              </div>
            )}

            <div className="flex justify-between text-sm font-bold text-foreground pt-1.5 border-t">
              <span>Net Total:</span>
              <span>₹{totalAmount.toFixed(2)}</span>
            </div>

            <div className="flex justify-between text-xs pt-1 text-muted-foreground">
              <span>Paid / Advance Received:</span>
              <span className="font-semibold text-emerald-700">₹{paidAmount.toFixed(2)}</span>
            </div>

            {balanceDue > 0 && (
              <div className="flex justify-between text-sm font-bold text-destructive pt-1 bg-destructive/5 -mx-3 -mb-3 p-3 rounded-b-xl border-t border-destructive/20">
                <span>Balance Due:</span>
                <span>₹{balanceDue.toFixed(2)}</span>
              </div>
            )}
          </div>

          {raw.remarks && (
            <div className="bg-muted/20 p-2.5 rounded-lg border text-[11px] text-muted-foreground">
              <span className="font-semibold text-foreground">Special Instructions:</span> {raw.remarks}
            </div>
          )}
        </div>

        {/* Action Footer Buttons */}
        <div className="p-4 border-t bg-card space-y-2 shrink-0">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-10 border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
              onClick={handleShareWhatsApp}
            >
              <MessageSquare className="h-4 w-4 text-emerald-600" />
              WhatsApp Share
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-10"
              onClick={handleCopyTrackLink}
            >
              {copiedLink ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copiedLink ? "Link Copied!" : "Copy Track Link"}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-10"
              onClick={handlePrintPdf}
              disabled={isGeneratingPdf}
            >
              <Printer className="h-4 w-4" />
              {isGeneratingPdf ? "Generating..." : "Print / PDF"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-10 text-primary border-primary/30 hover:bg-primary/5"
              onClick={() => {
                onOpenChange(false);
                navigate(`/invoices/view/${invoice.id}`);
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Open Mobile View
            </Button>
          </div>

          <div className="pt-1">
            {onNewSale ? (
              <Button
                size="sm"
                className="w-full gap-1.5 text-xs h-10 font-bold bg-primary text-primary-foreground"
                onClick={() => {
                  onOpenChange(false);
                  onNewSale();
                }}
              >
                <Sparkles className="h-4 w-4" />
                Create New Sale
              </Button>
            ) : (
              <Button
                size="sm"
                className="w-full gap-1.5 text-xs h-10"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
