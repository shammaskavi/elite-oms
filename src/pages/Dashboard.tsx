import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileText,
  Package,
  DollarSign,
  HandCoins,
  TrendingDown,
  Truck,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InvoiceView } from "@/components/InvoiceView";
import { derivePaymentStatusFromData } from "@/lib/derivePaymentStatus";
import { EmptyState, LoadingState } from "@/components/states";
import { MetricCardSkeleton } from "@/components/skeletons";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useAuth } from "@/lib/auth";

interface OverdueOrderItem {
  order_id: string;
  order_code: string;
  invoice_number?: string;
  item_name: string;
  reference_name?: string;
  customer_name: string;
  customer_phone?: string;
  delivery_date: string;
  days_overdue: number;
  stage: string;
  vendor_name?: string;
}

const getLocalDateString = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function Dashboard() {
  useDocumentTitle("Dashboard");
  const { isAdmin } = useAuth();

  const [timePeriod, setTimePeriod] = useState<string>("today");

  const navigate = useNavigate();
  const location = useLocation();
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const openInvoiceId = (location.state as any)?.openInvoiceId;

  const getDateRange = useCallback(() => {
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
        startDate = new Date(
          now.getFullYear(),
          Math.floor(now.getMonth() / 3) * 3,
          1
        );
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        startDate = new Date(0); // All time
    }

    return startDate.toISOString();
  }, [timePeriod]);

  // Unified high-performance dashboard query with instant in-memory cache
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ["dashboard-data", timePeriod, isAdmin],
    placeholderData: (prev) => prev,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const selectedStartDate = getDateRange();
      const localTodayStr = getLocalDateString(new Date());
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Run independent queries in parallel
      const [
        totalOrdersRes,
        pendingOrdersRes,
        paymentsDataRes,
        ordersDataRes,
        invoicesRes,
        activeOrdersRes,
        deliveriesRes,
      ] = await Promise.all([
        (supabase as any)
          .from("orders")
          .select("*", { count: "exact", head: true })
          .gte("created_at", selectedStartDate),
        (supabase as any)
          .from("orders")
          .select("*", { count: "exact", head: true })
          .neq("order_status", "delivered")
          .neq("order_status", "cancelled")
          .gte("created_at", selectedStartDate),
        isAdmin
          ? (supabase as any)
              .from("invoice_payments")
              .select("amount, date")
              .gte("date", selectedStartDate)
          : Promise.resolve({ data: [] }),
        isAdmin
          ? (supabase as any)
              .from("orders")
              .select("total_amount")
              .gte("created_at", selectedStartDate)
          : Promise.resolve({ data: [] }),
        (supabase as any)
          .from("invoices")
          .select(`
            id,
            invoice_number,
            total,
            status,
            payment_status,
            settled,
            created_at,
            customers (
              name,
              phone,
              address
            ),
            invoice_payments (
              amount,
              date
            )
          `)
          .order("created_at", { ascending: false })
          .limit(30),
        (supabase as any)
          .from("orders")
          .select(`
            id,
            order_code,
            metadata,
            order_status,
            created_at,
            customers(name, phone),
            invoices(invoice_number),
            order_stages(stage_name, vendor_name, created_at)
          `)
          .neq("order_status", "delivered")
          .neq("order_status", "cancelled")
          .order("created_at", { ascending: false })
          .limit(200),
        (supabase as any)
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
          .eq("delivery_date", localTodayStr)
          .neq("stage", "Delivered")
          .order("invoice_number"),
      ]);

      // Calculate Stats
      const stats = {
        totalOrders: totalOrdersRes?.count || 0,
        pendingOrders: pendingOrdersRes?.count || 0,
        cashInflow:
          paymentsDataRes?.data?.reduce((sum: number, p: any) => sum + Number(p.amount), 0) || 0,
        revenue:
          ordersDataRes?.data?.reduce((sum: number, order: any) => sum + Number(order.total_amount), 0) || 0,
      };

      // Enrich Invoices with Payments (directly from joined relation)
      const invoicesData = invoicesRes?.data || [];
      const enrichedInvoices = invoicesData.map((inv: any) => ({
        ...inv,
        __payment: derivePaymentStatusFromData(
          inv,
          inv.invoice_payments || []
        ),
      }));

      const pendingInvoices = enrichedInvoices
        .filter((inv: any) => inv.__payment?.status !== "paid")
        .slice(0, 10);

      // Process Active & Overdue Orders
      const allActive = activeOrdersRes?.data || [];
      const pendingOrders = allActive.slice(0, 10);

      const overdueOrders: OverdueOrderItem[] = allActive
        .filter((order: any) => {
          const deliveryDateStr = order.metadata?.delivery_date;
          if (!deliveryDateStr) return false;
          return deliveryDateStr < localTodayStr;
        })
        .map((order: any) => {
          const stages = [...(order.order_stages || [])].sort(
            (a, b) =>
              new Date(b.created_at).getTime() -
              new Date(a.created_at).getTime()
          );
          const latestStage = stages[0];
          const deliveryDate = new Date(order.metadata.delivery_date);
          deliveryDate.setHours(0, 0, 0, 0);
          const diffTime = todayStart.getTime() - deliveryDate.getTime();
          const diffDays = Math.max(
            1,
            Math.round(diffTime / (1000 * 60 * 60 * 24))
          );

          return {
            order_id: order.id,
            order_code: order.order_code,
            invoice_number: order.invoices?.invoice_number,
            item_name: order.metadata?.item_name || "Order Item",
            reference_name: order.metadata?.reference_name,
            customer_name: order.customers?.name || "Customer",
            customer_phone: order.customers?.phone,
            delivery_date: order.metadata.delivery_date,
            days_overdue: diffDays,
            stage:
              latestStage?.stage_name ||
              (order.order_status
                ? order.order_status.charAt(0).toUpperCase() +
                  order.order_status.slice(1)
                : "In Progress"),
            vendor_name: latestStage?.vendor_name,
          };
        })
        .sort(
          (a, b) =>
            new Date(a.delivery_date).getTime() -
            new Date(b.delivery_date).getTime()
        );

      const deliveriesToday = deliveriesRes?.data || [];

      return {
        stats,
        pendingInvoices,
        pendingOrders,
        overdueOrders,
        deliveriesToday,
      };
    },
  });

  const stats = dashboardData?.stats || {
    totalOrders: 0,
    pendingOrders: 0,
    cashInflow: 0,
    revenue: 0,
  };
  const overdueOrders = dashboardData?.overdueOrders || [];
  const pendingInvoices = dashboardData?.pendingInvoices || [];
  const pendingOrders = dashboardData?.pendingOrders || [];
  const deliveriesToday = dashboardData?.deliveriesToday || [];

  useEffect(() => {
    if (!openInvoiceId || pendingInvoices.length === 0) return;

    const invoice = pendingInvoices.find((inv: any) => inv.id === openInvoiceId);

    if (invoice) {
      setSelectedInvoice(invoice);
      setInvoiceModalOpen(true);
    }
  }, [openInvoiceId, pendingInvoices]);

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
      case "today":
        return "Today";
      case "week":
        return "This week";
      case "month":
        return "This month";
      case "quarter":
        return "This quarter";
      case "year":
        return "This year";
      default:
        return "All time";
    }
  }, [timePeriod]);

  const activeGreeting = useMemo(() => {
    const greetings: Record<
      string,
      { title: string; subtitle: string; icon: string }
    > = {
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
    <div className="space-y-6 sm:space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
      </div>

      {/* Greeting Summary Card */}
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold mb-1 sm:mb-2 truncate">
              {activeGreeting.title} <span>{activeGreeting.icon}</span>
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {/* {activeGreeting.subtitle} */}
              Timely delivery insights at your fingertips!
            </p>
          </div>
          <div className="shrink-0">
            <FileText className="h-9 w-9 sm:h-12 sm:w-12 text-primary" />
          </div>
        </div>
      </Card>

      {/* Time Period Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs sm:text-sm font-medium">Time Period:</span>
        <Select value={timePeriod} onValueChange={setTimePeriod}>
          <SelectTrigger className="w-[140px] sm:w-[150px] h-9 text-xs sm:text-sm">
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

      {/* Stats Cards (Role-Aware: Financials for Admin, Operations for Staff) */}
      {isLoading ? (
        <MetricCardSkeleton count={4} />
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
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
          {isAdmin ? (
            <>
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
            </>
          ) : (
            <>
              <StatCard
                label="Deliveries today"
                value={deliveriesToday.length}
                icon={<Truck className="h-6 w-6 text-emerald-600" />}
                hint="Scheduled for pickup"
              />
              <StatCard
                label="Overdue orders"
                value={overdueOrders.length}
                icon={<AlertTriangle className="h-6 w-6 text-rose-500" />}
                hint="Requires attention"
              />
            </>
          )}
        </div>
      )}

      {/* Activity Grid (4 panels) */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        {/* Overdue Orders Panel */}
        <Card
          className={
            overdueOrders.length > 0
              ? "border-destructive/40 bg-destructive/[0.02]"
              : ""
          }
        >
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">
                Overdue Orders
              </CardTitle>
              {overdueOrders.length > 0 && (
                <Badge variant="destructive" className="text-xs px-2 py-0.5">
                  {overdueOrders.length}
                </Badge>
              )}
            </div>
            {overdueOrders.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
                onClick={() =>
                  navigate("/orders", {
                    state: { quickFilter: "overdue", statusFilter: "active" },
                  })
                }
              >
                View all
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {overdueOrders.map((item) => (
                  <div
                    key={item.order_id}
                    className="flex items-start justify-between p-2.5 rounded-lg cursor-pointer hover:bg-muted/80 border border-border/50 hover:border-border transition"
                    onClick={() => navigate(`/orders/${item.order_id}`)}
                  >
                    <div className="space-y-1 min-w-0 pr-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="font-semibold text-sm">
                          {item.invoice_number
                            ? `#${item.invoice_number}`
                            : item.order_code}
                        </p>
                        <Badge
                          variant="destructive"
                          className="text-[10px] px-1.5 py-0 h-4"
                        >
                          {item.days_overdue}d late
                        </Badge>
                      </div>

                      <p className="text-sm font-medium text-foreground truncate">
                        {item.item_name}
                      </p>

                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className="truncate">{item.customer_name}</span>
                        {item.delivery_date && (
                          <>
                            <span>•</span>
                            <span className="text-destructive font-medium whitespace-nowrap">
                              Due{" "}
                              {new Date(
                                item.delivery_date
                              ).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                              })}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="text-right space-y-1 shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {item.stage}
                      </Badge>

                      {item.vendor_name && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-[100px]">
                          {item.vendor_name}
                        </p>
                      )}
                    </div>
                  </div>
                ))}

                {overdueOrders.length === 0 && (
                  <EmptyState
                    compact
                    title="No overdue orders"
                    description="All orders are on schedule. Great job!"
                  />
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Deliveries Today Panel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">
                Deliveries Today
              </CardTitle>
              {deliveriesToday.length > 0 && (
                <Badge variant="outline" className="text-xs px-2 py-0.5">
                  {deliveriesToday.length}
                </Badge>
              )}
            </div>
            {deliveriesToday.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
                onClick={() =>
                  navigate("/orders", {
                    state: { dateFilter: "today", statusFilter: "active" },
                  })
                }
              >
                View all
              </Button>
            )}
          </CardHeader>

          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {deliveriesToday.map((item) => (
                  <div
                    key={`${item.order_id}-${item.item_name}`}
                    className="flex items-start justify-between p-2.5 rounded-lg cursor-pointer hover:bg-muted/80 border border-border/50 hover:border-border transition"
                    onClick={() => navigate(`/orders/${item.order_id}`)}
                  >
                    <div className="space-y-1 min-w-0 pr-2">
                      <p className="font-semibold text-sm">
                        {item.invoice_number
                          ? `#${item.invoice_number}`
                          : "Order"}
                      </p>

                      <p className="text-sm font-medium text-foreground truncate">
                        {item.item_name}
                      </p>

                      <p className="text-xs text-muted-foreground truncate">
                        {item.customer_name}
                      </p>
                    </div>

                    <div className="text-right space-y-1 shrink-0">
                      <Badge variant="outline" className="text-xs">
                        {item.stage}
                      </Badge>

                      {item.vendor_name && (
                        <p className="text-[11px] text-muted-foreground truncate max-w-[100px]">
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
                    description="You're all clear for today."
                  />
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Pending Orders Panel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">
                Pending Orders
              </CardTitle>
              {pendingOrders.length > 0 && (
                <Badge variant="outline" className="text-xs px-2 py-0.5">
                  {stats.pendingOrders || pendingOrders.length}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
              onClick={() =>
                navigate("/orders", { state: { statusFilter: "active" } })
              }
            >
              View all
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {pendingOrders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-2.5 rounded-lg cursor-pointer hover:bg-muted/80 border border-border/50 hover:border-border transition"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <div className="min-w-0 pr-2 space-y-0.5">
                      <p className="font-semibold text-sm">
                        {order.invoices?.invoice_number
                          ? `#${order.invoices.invoice_number}`
                          : order.order_code}
                      </p>
                      <p className="text-xs text-foreground truncate">
                        {order.metadata?.item_name || order.order_code}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {order.customers?.name}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {getStatusBadge(order.order_status)}
                    </div>
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

        {/* Pending Invoices Panel */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base font-semibold">
                Pending Invoices
              </CardTitle>
              {pendingInvoices.length > 0 && (
                <Badge variant="outline" className="text-xs px-2 py-0.5">
                  {pendingInvoices.length}
                </Badge>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
              onClick={() => navigate("/invoices")}
            >
              View all
            </Button>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {pendingInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between p-2.5 rounded-lg cursor-pointer hover:bg-muted/80 border border-border/50 hover:border-border transition"
                    onClick={() => {
                      setSelectedInvoice(invoice);
                      setInvoiceModalOpen(true);
                    }}
                  >
                    <div className="min-w-0 pr-2 space-y-0.5">
                      <p className="font-semibold text-sm">
                        #{invoice.invoice_number}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {invoice.customers?.name}
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <p className="font-semibold text-sm">
                        ₹{Number(invoice.total || 0).toLocaleString()}
                      </p>
                      <Badge
                        variant={
                          invoice.payment_status === "partial"
                            ? "info"
                            : "warning"
                        }
                        className="text-[10px] px-1.5 py-0"
                      >
                        {invoice.payment_status === "partial"
                          ? "Partial"
                          : "Unpaid"}
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
