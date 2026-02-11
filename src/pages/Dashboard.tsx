import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Package, DollarSign, Plus, HandCoins, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { InvoiceView } from "@/components/InvoiceView";
import { derivePaymentStatusFromData } from "@/lib/derivePaymentStatus";


export default function Dashboard() {
  const [timePeriod, setTimePeriod] = useState<string>("today");
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    cashInflow: 0,
    revenue: 0,
  });
  const [dailyStats, setDailyStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    cashInflow: 0,
    revenue: 0,
  });
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([]);
  // const [payments, setPayments] = useState<any[]>([]);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const openInvoiceId = (location.state as any)?.openInvoiceId;
  const [deliveriesToday, setDeliveriesToday] = useState<any[]>([]);


  useEffect(() => {
    loadDashboardData();
  }, [timePeriod]);


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
      (supabase as any).from("invoice_payments").select("amount").gte("created_at", startDate),
      (supabase as any).from("orders").select("total_amount").gte("created_at", startDate),
    ]);

    return {
      totalOrders: totalOrders || 0,
      pendingOrders: pendingOrders || 0,
      cashInflow: paymentsData?.reduce((sum, p: any) => sum + Number(p.amount), 0) || 0,
      revenue: ordersData?.reduce((sum, order: any) => sum + Number(order.total_amount), 0) || 0,
    };
  };

  const loadDashboardData = async () => {
    const selectedStartDate = getDateRange();

    // Hardcoded date for "Today" to keep the summary card consistent
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const [
      periodStats,
      todayStatsData
    ] = await Promise.all([
      // FETCH 1: Data for the selected dropdown (Today, Week, Month, etc.)
      fetchStatsForRange(selectedStartDate),

      // FETCH 2: Data specifically for the Summary Card (Always Today)
      fetchStatsForRange(todayISO)
    ]);

    setStats(periodStats);
    setDailyStats(todayStatsData);
    const startDate = getDateRange();

    // Load stats based on selected time period (parallelized)
    const [
      { count: totalOrders },
      { count: pendingOrders },
      { data: paymentsData },
      { data: ordersData },
    ] = await Promise.all([
      (supabase as any)
        .from("orders")
        .select("*", { count: "exact", head: true })
        .gte("created_at", startDate),

      (supabase as any)
        .from("orders")
        .select("*", { count: "exact", head: true })
        .neq("order_status", "delivered")
        .neq("order_status", "cancelled")
        .gte("created_at", startDate),

      (supabase as any)
        .from("invoice_payments")
        .select("amount")
        .gte("created_at", startDate),

      (supabase as any)
        .from("orders")
        .select("total_amount")
        .gte("created_at", startDate),
    ]);

    const cashInflow =
      paymentsData?.reduce(
        (sum: number, p: any) => sum + Number(p.amount),
        0
      ) || 0;

    const revenue =
      ordersData?.reduce(
        (sum: number, order: any) => sum + Number(order.total_amount),
        0
      ) || 0;

    setStats({
      totalOrders: totalOrders || 0,
      pendingOrders: pendingOrders || 0,
      cashInflow,
      // dispatchedOrders: dispatchedOrders || 0,
      revenue,
    });

    // Load recent invoices (we'll derive pending status from payments)
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


    const invoiceIds = invoicesData?.map(i => i.id) || [];

    const { data: invoicePayments } = invoiceIds.length
      ? await (supabase as any)
        .from("invoice_payments")
        .select("*")
        .in("invoice_id", invoiceIds)
      : { data: [] };


    const paymentsByInvoice = Object.groupBy(
      invoicePayments || [],
      p => p.invoice_id
    );

    const enrichedInvoices =
      (invoicesData && invoicesData.length > 0)
        ? await Promise.all(
          invoicesData.map(async (inv: any) => ({
            ...inv,
            __payment: derivePaymentStatusFromData(
              inv,
              paymentsByInvoice[inv.id] || []
            )
          }))
        )
        : [];


    // Only keep invoices that are NOT fully paid
    const pending = enrichedInvoices.filter(
      (inv: any) => inv.__payment?.status !== "paid"
    );

    // Optional: keep newest 10
    setPendingInvoices(pending.slice(0, 10));

    // Load pending orders (not delivered or cancelled)
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

    setDeliveriesToday(deliveries || []); ƒ
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: "warning",
      processing: "info",
      ready: "success",
      dispatched: "info",
      delivered: "success",
      cancelled: "destructive",
    };
    return <Badge variant={variants[status] || "default"}>{status}</Badge>;
  };

  const getTimeContext = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    return "evening";
  };

  const context = getTimeContext();

  const activeGreeting = useMemo(() => {
    const greetings = {
      morning: {
        title: "Good morning, Bablu!",
        subtitle: `Today, you have ${stats.pendingOrders} deliveries to handle. Total revenue for this period is ₹${stats.revenue?.toLocaleString()}.`,
        icon: "☕️",
      },
      afternoon: {
        title: "Good afternoon!",
        subtitle: `You've already processed ${stats.totalOrders} orders. You're at 60% of your daily goal!`,
        icon: "🌤️",
      },
      evening: {
        title: "Great work today!",
        subtitle: `You served ${stats.totalOrders} customers. ₹${stats.cashInflow.toLocaleString()} hit your bank account.`,
        icon: "🌙"
      }
    };
    return greetings[context];
  }, [stats, context]); // This ensures it updates when stats are fetched


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
        {/* Total Orders Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <h3 className="text-3xl font-bold mt-2">{stats.totalOrders}</h3>
            </div>
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>
        {/* Pending Orders Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending{timePeriod === "today" ? "Today" :
                timePeriod === "week" ? "This week" :
                  timePeriod === "month" ? "This month" :
                    timePeriod === "quarter" ? "This quarter" :
                      timePeriod === "year" ? "This year" : "All time"}</p>
              <h3 className="text-3xl font-bold mt-2">{stats.pendingOrders}</h3>
              <p className="text-xs text-muted-foreground mt-1">Active orders {timePeriod === "today" ? "Today" :
                timePeriod === "week" ? "This week" :
                  timePeriod === "month" ? "This month" :
                    timePeriod === "quarter" ? "This quarter" :
                      timePeriod === "year" ? "This year" : "All time"}</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingDown className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>
        {/* Dispatched Orders Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Cash Inflow</p>
              <h3 className="text-3xl font-bold mt-2">₹{stats.cashInflow.toLocaleString()}</h3>
            </div>
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <HandCoins className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>
        {/* Revenue Card */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Revenue {timePeriod === "today" ? "Today" :
                timePeriod === "week" ? "This week" :
                  timePeriod === "month" ? "This month" :
                    timePeriod === "quarter" ? "This quarter" :
                      timePeriod === "year" ? "This year" : "All time"}</p>
              <h3 className="text-3xl font-bold mt-2">₹{stats.revenue.toLocaleString()}</h3>
              <p className="text-xs text-muted-foreground mt-1">{timePeriod === "today" ? "Today" :
                timePeriod === "week" ? "This week" :
                  timePeriod === "month" ? "This month" :
                    timePeriod === "quarter" ? "This quarter" :
                      timePeriod === "year" ? "This year" : "All time"}</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>
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
                  <p className="text-sm text-muted-foreground">
                    No deliveries scheduled for today
                  </p>
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
                  <p className="text-sm text-muted-foreground">No pending invoices</p>
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
                  <p className="text-sm text-muted-foreground">No pending orders</p>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {
        selectedInvoice && (
          <InvoiceView
            invoice={selectedInvoice}
            open={invoiceModalOpen}
            onOpenChange={(open) => {
              setInvoiceModalOpen(open);
              if (!open) setSelectedInvoice(null);
            }}
          />
        )
      }
    </div >
  );
}
