import { useEffect, useMemo, useState } from "react";
import { allocatePaymentFIFO } from "@/lib/allocatePaymentFIFO";
import { derivePaymentStatus, derivePaymentStatusFromData } from "@/lib/derivePaymentStatus";
import { deriveInvoiceState } from "@/lib/deriveInvoiceState";
import { useParams, Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  FileText,
  ShoppingBag,
  DollarSign,
  AlertCircle,
  Send,
  Copy,
  MessageSquare,
  Sparkles,
  Heart,
  Clock,
  Crown,
  UserCheck,
  Plus,
  History,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";
import { InvoiceView } from "@/components/InvoiceView";
import { allocateCustomerPayment } from "@/lib/allocateCustomerPayment";
import { ReceiptView } from "@/components/ReceiptView";
import { buildCustomerPaymentReminder, openWhatsApp } from "@/lib/whatsapp";
import { crmService } from "@/services/crm/crmService";
import { CustomerCrmProfile, CustomerNote, CrmTask, SareePreferences, EliteCircleLevel, CustomerLifecycleStatus } from "@/services/crm/crmTypes";
import { Customer360OverviewTab } from "@/components/crm/Customer360OverviewTab";
import { CustomerPreferencesTab } from "@/components/crm/CustomerPreferencesTab";
import { CustomerNotesTab } from "@/components/crm/CustomerNotesTab";
import { CustomerTasksTab } from "@/components/crm/CustomerTasksTab";
import { CustomerTimelineTab } from "@/components/crm/CustomerTimelineTab";
import { CustomerWhatsAppTab } from "@/components/crm/CustomerWhatsAppTab";

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const navState = location.state as any;
  const returnTo = navState?.returnTo;
  const openInvoiceId = navState?.openInvoiceId;
  const ordersView = navState?.ordersView;
  const anchorDate = navState?.anchorDate;

  const { toast } = useToast();
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedReceiptId, setSelectedReceiptId] = useState<string | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [reminderMessage, setReminderMessage] = useState("");
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [collectPaymentOpen, setCollectPaymentOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // CRM Active Tab & State
  const [activeTab, setActiveTab] = useState<string>("overview");
  const [selectedTemplateForWhatsApp, setSelectedTemplateForWhatsApp] = useState<string | undefined>();
  const [crmRefreshCount, setCrmRefreshCount] = useState(0);

  const queryClient = useQueryClient();

  // ---- customer ----
  const { data: customer } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // ---- invoices ----
  const { data: invoices } = useQuery({
    queryKey: ["customer-invoices", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(name,phone,address)")
        .eq("customer_id", id)
        .order("date", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // ---- invoice payments ----
  const { data: invoicePayments } = useQuery({
    queryKey: ["invoice-payments", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("invoice_payments")
        .select(
          `
          id,
          date,
          amount,
          method,
          invoice_id,
          invoices!inner (
            id,
            invoice_number,
            customer_id
          )
          `
        )
        .eq("invoices.customer_id", id)
        .order("date", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  // ---- customer payments ----
  const { data: customerPayments } = useQuery({
    queryKey: ["customer-payments", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("customer_payments")
        .select("*")
        .eq("customer_id", id)
        .order("received_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!id,
  });

  // ---- orders ----
  const { data: orders } = useQuery({
    queryKey: ["customer-orders", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // ---- summary stats ----
  const totalInvoices = invoices?.length || 0;
  const totalOrders = orders?.length || 0;

  const totalBilled = (invoices || []).reduce((sum, inv) => {
    const n = parseFloat(String(inv.total ?? 0));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);

  const paymentsByInvoice: Record<string, any[]> = useMemo(() => {
    return (invoicePayments || []).reduce((acc: any, p: any) => {
      const invId = p.invoice_id || p.invoices?.id;
      if (invId) {
        (acc[invId] ||= []).push(p);
      }
      return acc;
    }, {});
  }, [invoicePayments]);

  const invoicesWithStatus = useMemo(() => {
    if (!invoices) return [];
    return invoices.map((inv) => {
      const paymentsForThisInv = paymentsByInvoice[inv.id] || [];
      const payment = derivePaymentStatusFromData(inv, paymentsForThisInv);
      const state = deriveInvoiceState(inv, payment);
      return {
        ...inv,
        __payment: payment,
        __state: state,
      };
    });
  }, [invoices, paymentsByInvoice]);

  const totalPaid = invoicesWithStatus.reduce((sum, inv) => sum + (inv.__payment?.paid ?? 0), 0);
  const outstandingBalance = invoicesWithStatus.reduce(
    (sum, inv) => sum + (inv.__state?.collectibleDue ?? 0),
    0
  );
  const hasUnpaidInvoices = invoicesWithStatus.some(
    (inv) => (inv.__state?.collectibleDue ?? 0) > 0
  );

  const payments = (invoicePayments || []).map((p: any) => ({
    id: p.id,
    date: p.date,
    invoice_number: p.invoices?.invoice_number || "N/A",
    method: p.method || "N/A",
    amount: parseFloat(String(p.amount || 0)),
  }));

  const receipts = (customerPayments || []).map((r: any) => ({
    id: r.id,
    date: r.received_at,
    method: r.payment_method,
    amount: parseFloat(String(r.amount || 0)),
    reference: r.reference,
    notes: r.notes,
  }));

  // ---- CRM Domain Layer Data ----
  const crmProfile = useMemo(() => {
    if (!id) return null;
    return crmService.getCrmProfile(id, {
      outstandingBalance,
      dob: customer?.dob,
      anniversary: customer?.anniversary,
      totalBilled,
      totalOrders,
    });
  }, [id, customer, outstandingBalance, totalBilled, totalOrders, crmRefreshCount]);

  const crmNotes = useMemo(() => {
    if (!id) return [];
    return crmService.getNotes(id);
  }, [id, crmRefreshCount]);

  const crmTasks = useMemo(() => {
    if (!id) return [];
    return crmService.getCustomerTasks(id);
  }, [id, crmRefreshCount]);

  const crmTimelineEvents = useMemo(() => {
    if (!id) return [];
    return crmService.getTimeline(id);
  }, [id, crmRefreshCount]);

  const refreshCrm = () => setCrmRefreshCount((c) => c + 1);

  // Hydrate Supabase CRM records when mounting or id changes
  useEffect(() => {
    if (!id) return;
    Promise.all([
      crmService.fetchPreferencesFromSupabase(id),
      crmService.fetchNotesFromSupabase(id),
    ]).then(() => {
      refreshCrm();
    });
  }, [id]);

  const getPaymentStatusBadge = (invoice: any) => {
    const state = invoice.__state?.label;
    if (state === "settled") {
      return <Badge variant="success">SETTLED</Badge>;
    }
    switch (invoice.__payment.status) {
      case "paid":
        return <Badge variant="success">PAID</Badge>;
      case "partial":
        return <Badge variant="info">PARTIAL</Badge>;
      default:
        return <Badge variant="warning">UNPAID</Badge>;
    }
  };

  const getOrderStatusBadge = (status: string) => {
    const variants: any = {
      pending: "warning",
      processing: "info",
      ready: "success",
      dispatched: "info",
      delivered: "success",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{(status || "").toUpperCase()}</Badge>;
  };

  const unpaidInvoicesList = invoicesWithStatus
    .filter((inv) => (inv.__state?.collectibleDue ?? 0) > 0)
    .map((inv) => ({
      invoice_number: inv.invoice_number,
      date: inv.date,
      collectibleDue: inv.__state?.collectibleDue ?? 0,
    }));

  const handleOpenReminderDialog = (open: boolean) => {
    if (open) {
      const msg = buildCustomerPaymentReminder({
        customerName: customer?.name || "Customer",
        totalOutstanding: outstandingBalance,
        unpaidInvoices: unpaidInvoicesList,
      });
      setReminderMessage(msg);
    }
    setReminderDialogOpen(open);
  };

  const handleSendReminder = () => {
    if (!customer?.phone) {
      toast({
        title: "Phone Number Missing",
        description: "Customer does not have a phone number saved.",
        variant: "destructive",
      });
      return;
    }
    try {
      openWhatsApp(customer.phone, reminderMessage);
      toast({
        title: "WhatsApp Opened",
        description: `Payment reminder ready to send to ${customer.name || "customer"}`,
      });
      setReminderDialogOpen(false);
    } catch (err: any) {
      toast({
        title: "Failed to Open WhatsApp",
        description: err.message || "Invalid phone number format",
        variant: "destructive",
      });
    }
  };

  const handleCopyReminder = () => {
    if (!reminderMessage) return;
    navigator.clipboard.writeText(reminderMessage);
    toast({
      title: "Copied",
      description: "Reminder message copied to clipboard",
    });
  };

  // --- Save Payment Mutation (FIFO) ---
  const savePaymentMutation = useMutation({
    mutationFn: async (payload: {
      customer_id: string;
      amount: number;
      payment_method: string;
      reference?: string;
      notes?: string;
    }) => {
      const { customer_id, amount, payment_method, reference, notes } = payload;
      const { data, error } = await (supabase as any)
        .from("customer_payments")
        .insert([
          {
            customer_id,
            amount,
            payment_method,
            reference,
            notes,
            received_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      try {
        if (!data?.id) {
          throw new Error("Customer payment ID missing");
        }

        await allocateCustomerPayment({
          customerPaymentId: data.id,
          customerId: data.customer_id,
          amount: Number(data.amount),
        });

        setCollectPaymentOpen(false);
        setPaymentAmount("");
        setPaymentMethod("");
        setPaymentReference("");
        setPaymentNotes("");

        queryClient.invalidateQueries({ queryKey: ["invoice-payments", id] });
        queryClient.invalidateQueries({ queryKey: ["customer-invoices", id] });
        queryClient.invalidateQueries({ queryKey: ["customer", id] });

        toast({
          title: "Payment Collected",
          description: "Payment received and allocated to invoices.",
        });
      } catch (err: any) {
        console.error("Allocation failed", err);
        toast({
          title: "Payment Saved (Allocation Pending)",
          description: "Payment saved but could not be allocated automatically.",
        });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Error Saving Payment",
        description: err?.message || "Could not save payment.",
        variant: "destructive",
      });
    },
  });

  const handleSavePayment = () => {
    if (!id) return;
    if (!paymentAmount || isNaN(Number(paymentAmount)) || Number(paymentAmount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid payment amount.",
        variant: "destructive",
      });
      return;
    }
    if (!paymentMethod) {
      toast({
        title: "Payment Method Required",
        description: "Please enter a payment method.",
        variant: "destructive",
      });
      return;
    }
    savePaymentMutation.mutate({
      customer_id: id,
      amount: Number(paymentAmount),
      payment_method: paymentMethod,
      reference: paymentReference,
      notes: paymentNotes,
    });
  };

  if (!customer || !crmProfile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="text-xs text-muted-foreground">Loading Customer 360 profile…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invoice Modal */}
      {selectedInvoice && (
        <InvoiceView
          invoice={selectedInvoice}
          open={invoiceDialogOpen}
          onOpenChange={(open) => {
            setInvoiceDialogOpen(open);
            if (!open) setSelectedInvoice(null);
          }}
        />
      )}

      {/* Receipt Modal */}
      {selectedReceiptId && (
        <ReceiptView
          receiptId={selectedReceiptId}
          open={receiptDialogOpen}
          onOpenChange={(open) => {
            setReceiptDialogOpen(open);
            if (!open) setSelectedReceiptId(null);
          }}
        />
      )}

      {/* ========================================================================= */}
      {/* 👑 CLIENTELING 360 HEADER                                                 */}
      {/* ========================================================================= */}
      <div className="p-5 rounded-2xl border bg-card shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          {/* Customer Main Identity */}
          <div className="flex items-start sm:items-center gap-3.5 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (returnTo) {
                  navigate(returnTo, {
                    state: { openInvoiceId, ordersView, anchorDate },
                  });
                } else {
                  navigate(-1);
                }
              }}
              className="shrink-0 h-9 w-9 rounded-full hover:bg-muted"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="space-y-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate text-foreground">
                  {customer.name}
                </h1>

                {/* Elite Circle Tier Badge */}
                <Badge
                  className={`text-[11px] px-2.5 py-0.5 font-bold uppercase tracking-wider flex items-center gap-1 ${
                    crmProfile.eliteCircleLevel === "Elite Privé"
                      ? "bg-purple-900 text-purple-100 border-purple-700"
                      : crmProfile.eliteCircleLevel === "Elite Preferred"
                      ? "bg-purple-100 text-purple-900 border-purple-300"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  <Crown className="h-3 w-3" />
                  {crmProfile.eliteCircleLevel}
                </Badge>

                {/* Lifecycle Status */}
                <Badge variant="outline" className="text-[11px] bg-muted/40 font-medium">
                  {crmProfile.lifecycleStatus}
                </Badge>
              </div>

              {/* Contact Information & Relationship Owner */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {customer.phone && (
                  <div className="flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                    <span className="font-mono text-foreground font-medium">{customer.phone}</span>
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span>{customer.email}</span>
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate max-w-[200px]">{customer.address}</span>
                  </div>
                )}
                <div className="flex items-center gap-1 text-purple-700 font-medium">
                  <UserCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>Owner: {crmProfile.relationshipOwnerName}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Quick WhatsApp tab opener */}
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-9 font-medium gap-1.5 text-emerald-800 border-emerald-300 bg-emerald-50/50 hover:bg-emerald-100/60"
              onClick={() => setActiveTab("whatsapp")}
            >
              <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
              WhatsApp
            </Button>

            {/* Quick Note tab opener */}
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-9 font-medium gap-1.5 text-purple-800 border-purple-200 bg-purple-50/40 hover:bg-purple-100/50"
              onClick={() => setActiveTab("notes")}
            >
              <Plus className="h-3.5 w-3.5 text-purple-600" />
              Add Note
            </Button>

            {/* Collect Payment Dialog Trigger */}
            {hasUnpaidInvoices && (
              <Button
                variant="default"
                size="sm"
                className="h-9 text-xs font-semibold gap-1.5 shadow-sm"
                onClick={() => setCollectPaymentOpen(true)}
              >
                <DollarSign className="h-3.5 w-3.5" />
                Collect Payment
              </Button>
            )}

            {/* Payment Reminder Dialog Trigger */}
            {hasUnpaidInvoices && (
              <Dialog open={reminderDialogOpen} onOpenChange={handleOpenReminderDialog}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 text-xs font-medium text-amber-900 border-amber-300 bg-amber-50/50 hover:bg-amber-100/50"
                  >
                    <AlertCircle className="mr-1.5 h-3.5 w-3.5 text-amber-600" />
                    Reminder
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-lg w-full max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-base">
                      <MessageSquare className="h-5 w-5 text-emerald-600" />
                      Send Payment Reminder
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2 text-xs">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="text-muted-foreground text-xs">Total Outstanding</p>
                        <p className="font-bold text-base text-destructive">
                          ₹{outstandingBalance.toLocaleString("en-IN")}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-muted-foreground text-xs">Recipient Phone</p>
                        <p className="font-medium">
                          {customer?.phone ? (
                            <span className="text-foreground">{customer.phone}</span>
                          ) : (
                            <span className="text-destructive font-semibold">No phone number</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <Label className="text-xs">WhatsApp Message Preview</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          onClick={handleCopyReminder}
                        >
                          <Copy className="h-3.5 w-3.5 mr-1" /> Copy Text
                        </Button>
                      </div>
                      <Textarea
                        placeholder="Enter reminder message..."
                        value={reminderMessage}
                        onChange={(e) => setReminderMessage(e.target.value)}
                        rows={8}
                        className="text-xs font-mono bg-muted/20 resize-none"
                      />
                      <p className="text-[11px] text-muted-foreground mt-1">
                        You can edit this message before launching WhatsApp.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <Button
                        variant="outline"
                        className="flex-1 text-xs"
                        onClick={() => setReminderDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleSendReminder}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                        disabled={!customer?.phone}
                      >
                        <Send className="mr-2 h-3.5 w-3.5" />
                        Send via WhatsApp
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Collect Payment Modal */}
        <Dialog open={collectPaymentOpen} onOpenChange={setCollectPaymentOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Collect Customer Payment</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2 text-xs">
              <div className="p-3 bg-muted/50 rounded-lg flex items-center justify-between">
                <div>
                  <p className="text-muted-foreground">Total Collectible Balance</p>
                  <p className="text-lg font-bold text-destructive">
                    ₹{outstandingBalance.toLocaleString("en-IN")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs h-7"
                  onClick={() => setPaymentAmount(String(outstandingBalance))}
                >
                  Pay Full
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Amount (₹) *</Label>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="text-xs h-9 font-mono"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Payment Method *</Label>
                <Input
                  placeholder="UPI / Cash / Card / Bank Transfer"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Reference Number / Transaction ID</Label>
                <Input
                  placeholder="Optional UPI UTR or receipt number"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  className="text-xs h-9 font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Internal Notes</Label>
                <Textarea
                  placeholder="Optional notes for accounting…"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                  className="text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setCollectPaymentOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="text-xs font-semibold"
                  onClick={handleSavePayment}
                  disabled={savePaymentMutation.isPending}
                >
                  {savePaymentMutation.isPending ? "Allocating…" : "Confirm Receipt"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* ================= Summary KPI Cards ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card className="shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-3.5 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Lifetime Value</CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-xl sm:text-2xl font-bold tracking-tight">
              ₹{totalBilled.toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-3.5 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total Paid</CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-xl sm:text-2xl font-bold tracking-tight text-emerald-600">
              ₹{totalPaid.toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-3.5 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Outstanding</CardTitle>
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div
              className={`text-xl sm:text-2xl font-bold tracking-tight ${
                outstandingBalance > 0 ? "text-amber-600" : "text-slate-700"
              }`}
            >
              ₹{outstandingBalance.toLocaleString("en-IN")}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-3.5 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Orders</CardTitle>
            <ShoppingBag className="h-3.5 w-3.5 text-blue-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-xl sm:text-2xl font-bold tracking-tight">{totalOrders}</div>
          </CardContent>
        </Card>

        <Card className="shadow-2xs col-span-2 sm:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-1.5 pt-3.5 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground">Invoices</CardTitle>
            <FileText className="h-3.5 w-3.5 text-purple-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-xl sm:text-2xl font-bold tracking-tight">{totalInvoices}</div>
          </CardContent>
        </Card>
      </div>

      {/* ========================================================================= */}
      {/* 🚀 CLIENTELING & BILLING UNIFIED TABS                                     */}
      {/* ========================================================================= */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <TabsList className="w-full flex flex-wrap h-auto p-1 bg-slate-100 rounded-xl gap-1">
          <TabsTrigger value="overview" className="text-xs font-medium gap-1.5 py-2 px-3">
            <Sparkles className="h-3.5 w-3.5 text-amber-600" /> 360 Overview
          </TabsTrigger>
          <TabsTrigger value="preferences" className="text-xs font-medium gap-1.5 py-2 px-3">
            <Heart className="h-3.5 w-3.5 text-rose-500" /> Saree Preferences
          </TabsTrigger>
          <TabsTrigger value="notes" className="text-xs font-medium gap-1.5 py-2 px-3">
            <Sparkles className="h-3.5 w-3.5 text-purple-600" /> Notes ({crmNotes.length})
          </TabsTrigger>
          <TabsTrigger value="tasks" className="text-xs font-medium gap-1.5 py-2 px-3">
            <Clock className="h-3.5 w-3.5 text-orange-600" /> Tasks ({crmTasks.filter((t) => t.status !== "completed").length})
          </TabsTrigger>
          <TabsTrigger value="timeline" className="text-xs font-medium gap-1.5 py-2 px-3">
            <History className="h-3.5 w-3.5 text-blue-600" /> Timeline
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs font-medium gap-1.5 py-2 px-3">
            <MessageSquare className="h-3.5 w-3.5 text-emerald-600" /> WhatsApp
          </TabsTrigger>
          <TabsTrigger value="invoices" className="text-xs font-medium gap-1.5 py-2 px-3">
            <FileText className="h-3.5 w-3.5" /> Invoices ({totalInvoices})
          </TabsTrigger>
          <TabsTrigger value="orders" className="text-xs font-medium gap-1.5 py-2 px-3">
            <ShoppingBag className="h-3.5 w-3.5" /> Orders ({totalOrders})
          </TabsTrigger>
          <TabsTrigger value="receipts" className="text-xs font-medium gap-1.5 py-2 px-3">
            <DollarSign className="h-3.5 w-3.5" /> Receipts ({receipts.length})
          </TabsTrigger>
          <TabsTrigger value="payments" className="text-xs font-medium gap-1.5 py-2 px-3">
            Payment Allocations
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: 360 Overview */}
        <TabsContent value="overview">
          <Customer360OverviewTab
            customer={customer}
            profile={crmProfile}
            notes={crmNotes}
            tasks={crmTasks}
            onOpenTab={setActiveTab}
            onOpenWhatsAppTemplate={(tplName) => {
              setSelectedTemplateForWhatsApp(tplName);
              setActiveTab("whatsapp");
            }}
            onOpenCreateTask={() => setActiveTab("tasks")}
          />
        </TabsContent>

        {/* Tab 2: Saree Preferences */}
        <TabsContent value="preferences">
          <CustomerPreferencesTab
            customerId={id!}
            preferences={crmProfile.preferences}
            onPreferencesUpdated={() => refreshCrm()}
          />
        </TabsContent>

        {/* Tab 3: Notes */}
        <TabsContent value="notes">
          <CustomerNotesTab
            customerId={id!}
            notes={crmNotes}
            onNotesUpdated={() => refreshCrm()}
          />
        </TabsContent>

        {/* Tab 4: Tasks */}
        <TabsContent value="tasks">
          <CustomerTasksTab
            customerId={id!}
            customerName={customer.name}
            customerPhone={customer.phone}
            tasks={crmTasks}
            onTasksUpdated={() => refreshCrm()}
          />
        </TabsContent>

        {/* Tab 5: Timeline */}
        <TabsContent value="timeline">
          <CustomerTimelineTab
            customerId={id!}
            invoices={invoicesWithStatus}
            orders={orders || []}
            customerPayments={receipts}
            notes={crmNotes}
            tasks={crmTasks}
            crmEvents={crmTimelineEvents}
          />
        </TabsContent>

        {/* Tab 6: WhatsApp */}
        <TabsContent value="whatsapp">
          <CustomerWhatsAppTab
            customerId={id!}
            customerName={customer.name}
            customerPhone={customer.phone}
            preferences={crmProfile.preferences}
            outstandingBalance={outstandingBalance}
            selectedTemplateName={selectedTemplateForWhatsApp}
          />
        </TabsContent>

        {/* Tab 7: Invoices (Existing code preserved 100%) */}
        <TabsContent value="invoices" className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base font-semibold">Invoice History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Invoice Number</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-right">Amount Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoicesWithStatus.map((invoice) => {
                      const { paid } = invoice.__payment;
                      const remaining =
                        invoice.__state?.collectibleDue ?? invoice.__payment.remaining;
                      const total = parseFloat(String(invoice.total ?? 0)) || 0;
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>
                            {invoice.date ? new Date(invoice.date).toLocaleDateString("en-IN") : "-"}
                          </TableCell>
                          <TableCell>{getPaymentStatusBadge(invoice)}</TableCell>
                          <TableCell className="text-right">₹{total.toFixed(2)}</TableCell>
                          <TableCell className="text-right">₹{paid.toFixed(2)}</TableCell>
                          <TableCell className="text-right">₹{remaining.toFixed(2)}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedInvoice(invoice);
                                setInvoiceDialogOpen(true);
                              }}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {(!invoices || invoices.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8 text-xs">
                          No invoices found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 8: Orders (Existing code preserved 100%) */}
        <TabsContent value="orders" className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base font-semibold">Production Order History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders?.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_code}</TableCell>
                        <TableCell>
                          {order.created_at
                            ? new Date(order.created_at).toLocaleDateString("en-IN")
                            : "-"}
                        </TableCell>
                        <TableCell>{getOrderStatusBadge(order.order_status)}</TableCell>
                        <TableCell className="text-right">
                          ₹{(parseFloat(String(order.total_amount || 0)) || 0).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Link
                            to={`/orders/${order.id}`}
                            state={{ returnTo: `${location.pathname}${location.search}` }}
                          >
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!orders || orders.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-xs">
                          No orders found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 9: Receipts (Existing code preserved 100%) */}
        <TabsContent value="receipts" className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base font-semibold">Customer Receipts</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Receipt ID</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receipts.length > 0 ? (
                      receipts.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell>
                            {r.date ? new Date(r.date).toLocaleDateString("en-IN") : "-"}
                          </TableCell>
                          <TableCell className="font-medium font-mono text-xs">
                            {r.id.slice(0, 8).toUpperCase()}
                          </TableCell>
                          <TableCell>{r.method}</TableCell>
                          <TableCell className="text-right font-medium">
                            ₹{r.amount.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedReceiptId(r.id);
                                setReceiptDialogOpen(true);
                              }}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8 text-xs">
                          No receipts found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 10: Payments Register (Existing code preserved 100%) */}
        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader className="py-4">
              <CardTitle className="text-base font-semibold">Invoice Payment Allocations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length > 0 ? (
                      payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            {payment.date ? new Date(payment.date).toLocaleDateString("en-IN") : "-"}
                          </TableCell>
                          <TableCell className="font-medium">{payment.invoice_number}</TableCell>
                          <TableCell>{payment.method}</TableCell>
                          <TableCell className="text-right font-medium">
                            ₹{payment.amount.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-xs">
                          No payments found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}