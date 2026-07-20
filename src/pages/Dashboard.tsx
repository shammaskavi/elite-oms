import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Package, DollarSign, HandCoins, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InvoiceView } from "@/components/InvoiceView";
import { derivePaymentStatusFromData } from "@/lib/derivePaymentStatus";
import { EmptyState } from "@/components/states";
import { useDocumentTitle } from "@/hooks/use-document-title";


export default function Dashboard() {
  useDocumentTitle("Dashboard");

  const [timePeriod, setTimePeriod] = useState<string>("today");
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    cashInflow: 0,
    revenue: 0,
  });
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [deliveriesToday, setDeliveriesToday] = useState<any[]>([]);

  const navigate = useNavigate();
  const location = useLocation();
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const openInvoiceId = (location.state as any)?.openInvoiceId;


  useEffect(() => {
    if (!openInvoiceId || pendingInvoices.length === 0) return;

    const invoice = pendingInvoices.find(
      (inv) => inv.id === openInvoiceId
    );

    if (invoice) {
      setSelectedInvoice(invoice);
      setInvoiceModalOpen(true);
    }
  }, [openInvoiceId, pendingInvoices]);


  const getDateRange = () => {
    const now = new Date();
    let startDate: Date;

    switch (timePeriod) {
      case "today":
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "quarter":
        startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(0); // All time
    }

    return startDate.toISOString();
  };
  const fetchStatsForRange = async (startDate: string) => {
    const [
      { count: totalOrders },
      { count: pendingOrders },
      { data: paymentsData },
      { data: ordersData },
    ] = await Promise.all([
      (supabase as any).from("orders").select("*", { count: "exact", head: true }).gte("created_at", startDate),
      (supabase as any).from("orders").select("*", { count: "exact", head: true }).neq("order_status", "delivered").neq("order_status", "cancelled").gte("created_at", startDate),
      (supabase as any).from("invoice_payments").select("amount, date").gte("date", startDate),
      (supabase as any).from("orders").select("total_amount").gte("created_at", startDate),
    ]);

    return {
      totalOrders: totalOrders || 0,
      pendingOrders: pendingOrders || 0,
      cashInflow: paymentsData?.reduce((sum, p: any) => sum + Number(p.amount), 0) || 0,
      revenue: ordersData?.reduce((sum, order: any) => sum + Number(order.total_amount), 0) || 0,
    };
  };

  const loadDashboardData = useCallback(async () => {
    try {
      const selectedStartDate = getDateRange();

      const periodStats = await fetchStatsForRange(selectedStartDate);
      setStats(periodStats);

      const { data: invoicesData } = await (supabase as any)
        .from("invoices")
        .select(`
      *,
      customers (
        name,
        phone,
        address
      )
    `)
        .order("created_at", { ascending: false })
        .limit(30);

      const invoiceIds = invoicesData?.map((i: any) => i.id) || [];

      const { data: invoicePayments } = invoiceIds.length
        ? await (supabase as any)
          .from("invoice_payments")
          .select("*")
          .in("invoice_id", invoiceIds)
        : { data: [] };

      // groupBy is supported in modern browsers; fall back if missing.
      const paymentsByInvoice: Record<string, any[]> =
        typeof (Object as any).groupBy === "function"
          ? (Object as any).groupBy(invoicePayments || [], (p: any) => p.invoice_id)
          : (invoicePayments || []).reduce((acc: any, p: any) => {
              (acc[p.invoice_id] ||= []).push(p);
              return acc;
            }, {});

      const enrichedInvoices = (invoicesData && invoicesData.length > 0)
        ? invoicesData.map((inv: any) => ({
            ...inv,
            __payment: derivePaymentStatusFromData(inv, paymentsByInvoice[inv.id] || []),
          }))
        : [];

      const pending = enrichedInvoices.filter(
        (inv: any) => inv.__payment?.status !== "paid"
      );
      setPendingInvoices(pending.slice(0, 10));

      const { data: ordersDataPending } = await (supabase as any)
        .from("orders")
        .select("*, customers(name)")
        .neq("order_status", "delivered")
        .neq("order_status", "cancelled")
        .order("created_at", { ascending: false })
        .limit(10);
      setPendingOrders(ordersDataPending || []);

      const { data: deliveries } = await (supabase as any)
        .from("order_items_calendar_view")
        .select(`
      order_id,
      invoice_number,
      item_name,
      delivery_date,
      customer_name,
      stage,
      vendor_name
    `)
        .eq("delivery_date", new Date().toISOString().slice(0, 10))
        .neq("stage", "Delivered")
        .order("invoice_number");
      setDeliveriesToday(deliveries || []);
    } catch (err) {
      // Errors will be surfaced by the global onError handler / toasts.
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.error("[Dashboard] failed to load:", err);
      }
    }
  }, [timePeriod]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const getStatusBadge = useCallback((status: string) => {
    const variants: Record<string, any> = {
      pending: "warning",
      processing: "info",
      ready: "success",
      dispatched: "info",
      delivered: "success",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  }, []);

  const context = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
  }, []);

  const periodLabel = useMemo(() => {
    switch (timePeriod) {
      case "today": return "Today";
      case "week": return "This week";
      case "month": return "This month";
      case "quarter": return "This quarter";
      case "year": return "This year";
      default: return "All time";
    }
  }, [timePeriod]);

  const activeGreeting = useMemo(() => {
    const greetings: Record<string, { title: string; subtitle: string; icon: string }> = {
      morning: {
        title: "Good morning!",
        subtitle: `You have ${stats.pendingOrders} pending orders today.`,
        icon: "☕️",
      },
      afternoon: {
        title: "Good afternoon!",
        subtitle: `You've processed ${stats.totalOrders} orders so far.`,
        icon: "🌤️",
      },
      evening: {
        title: "Great work today!",
        subtitle: `₹${stats.cashInflow.toLocaleString()} in cash inflow today.`,
        icon: "🌙",
      },
    };
    return greetings[context];
  }, [stats, context]);


  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
      </div>
      {/* add a summary card below that shows greetings and stats in it */}
      <Card className="p-6 ">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">
              {activeGreeting.title} <span>{activeGreeting.icon}</span>
            </h2>
            <p className="text-sm text-muted-foreground">
              {/* {activeGreeting.subtitle} */}
              Timeley delivery insights at your fingertips!
              <br />
              Hang tight as we prepare your personalized dashboard.
            </p>
          </div>
          <div>
            <FileText className="h-12 w-12 text-primary" />
          </div>
        </div>
      </Card>


      {/* Time Period Filter */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Time Period:</span>
        <Select value={timePeriod} onValueChange={setTimePeriod}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="week">This Week</SelectItem>
            <SelectItem value="month">This Month</SelectItem>
            <SelectItem value="quarter">This Quarter</SelectItem>
            <SelectItem value="year">This Year</SelectItem>
            <SelectItem value="all">All Time</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total orders"
          value={stats.totalOrders}
          icon={<Package className="h-6 w-6 text-primary" />}
          hint={periodLabel}
        />
        <StatCard
          label={`Pending · ${periodLabel}`}
          value={stats.pendingOrders}
          icon={<TrendingDown className="h-6 w-6 text-primary" />}
          hint="Active orders"
        />
        <StatCard
          label="Cash inflow"
          value={`₹${stats.cashInflow.toLocaleString()}`}
          icon={<HandCoins className="h-6 w-6 text-primary" />}
          hint={periodLabel}
        />
        <StatCard
          label={`Revenue · ${periodLabel}`}
          value={`₹${stats.revenue.toLocaleString()}`}
          icon={<DollarSign className="h-6 w-6 text-primary" />}
          hint={periodLabel}
        />
      </div>

      {/* Pending Activity */}
      <div className="grid gap-4 md:grid-cols-3">
        {/*  Deliveries Today */}
        <Card>
          <CardHeader>
            <CardTitle>Deliveries Today</CardTitle>
          </CardHeader>

          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {deliveriesToday.map((item) => (
                  <div
                    key={`${item.order_id}-${item.item_name}`}
                    className="flex items-start justify-between p-2 rounded-lg cursor-pointer hover:bg-muted transition"
                    onClick={() => navigate(`/orders/${item.order_id}`)}
                  >
                    <div className="space-y-0.5">
                      <p className="font-medium text-sm">
                        {item.invoice_number}
                      </p>

                      <p className="text-sm">
                        {item.item_name}
                      </p>

                      <p className="text-xs text-muted-foreground">
                        {item.customer_name}
                      </p>
                    </div>

                    <div className="text-right space-y-1">
                      <Badge variant="outline" className="text-xs">
                        {item.stage}
                      </Badge>

                      {item.vendor_name && (
                        <p className="text-[11px] text-muted-foreground">
                          {item.vendor_name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {deliveriesToday.length === 0 && (
                  <EmptyState
                    compact
                    title="No deliveries today"
                    description="You're all clear for the day."
                  />
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Pending invoices */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Invoices</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {pendingInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-muted transition"
                    onClick={() => {
                      setSelectedInvoice(invoice);
                      setInvoiceModalOpen(true);
                    }}
                  >
                    <div>
                      <p className="font-medium">{invoice.invoice_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {invoice.customers?.name}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">₹{invoice.total.toLocaleString()}</p>
                      <Badge
                        variant={invoice.payment_status === "partial" ? "info" : "warning"}
                        className="text-xs"
                      >
                        {invoice.payment_status === "partial" ? "Partial" : "Unpaid"}
                      </Badge>
                    </div>
                  </div>
                ))}
                {pendingInvoices.length === 0 && (
                  <EmptyState
                    compact
                    title="No pending invoices"
                    description="Everything is paid up."
                  />
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Pending Orders */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {pendingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-2 rounded-lg cursor-pointer hover:bg-muted transition"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <div>
                      <p className="font-medium">{order.order_code}</p>
                      <p className="text-sm text-muted-foreground">{order.customers?.name}</p>
                    </div>
                    <div className="text-right">{getStatusBadge(order.order_status)}</div>
                  </div>
                ))}
                {pendingOrders.length === 0 && (
                  <EmptyState
                    compact
                    title="No pending orders"
                    description="Nothing in the queue right now."
                  />
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {selectedInvoice && (
        <InvoiceView
          invoice={selectedInvoice}
          open={invoiceModalOpen}
          onOpenChange={(open) => {
            setInvoiceModalOpen(open);
            if (!open) setSelectedInvoice(null);
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  hint,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <h3 className="mt-2 text-3xl font-bold">{value}</h3>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
          {icon}
        </div>
      </div>
    </Card>
  );
}
