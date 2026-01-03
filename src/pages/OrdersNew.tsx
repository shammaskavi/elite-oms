// Orders page - in use
import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Package, TrendingUp, CheckCircle2, AlertCircle, Search, LayoutGrid, List, Sheet, AlertTriangle, CalendarDays, SlidersHorizontal } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { startOfWeek, addDays } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { toast } from "sonner";
import WeekCalendar from "@/components/calendar/WeekCalendar";
import OrdersInvoiceTable from "@/components/orders/OrdersInvoiceTable";

export default function OrdersNew() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [viewMode, setViewMode] =
    useState<"list" | "kanban" | "calendar" | "table">("list");
  // Calendar anchor date (controls visible week/month)
  const [anchorDate, setAnchorDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [vendorFilter, setVendorFilter] = useState<string | null>(null);


  const weekDates = useMemo(() => {
    const start = startOfWeek(anchorDate, { weekStartsOn: 1 }); // Monday
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchorDate]);

  function getWeekDates(anchor: Date) {
    const start = new Date(anchor);
    const day = start.getDay(); // 0 = Sun, 1 = Mon
    const diff = day === 0 ? -6 : 1 - day; // make Monday start
    start.setDate(start.getDate() + diff);

    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }
  const visibleWeekDates = getWeekDates(anchorDate);
  // Calendar view mode
  const [calendarView, setCalendarView] =
    useState<"week" | "month">("week");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; orderId: string; action: "delivered" | "cancelled" }>({
    open: false,
    orderId: "",
    action: "delivered"
  });
  const [quickFilter, setQuickFilter] = useState<"overdue" | "dueSoon" | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const kanbanScrollRef = useRef<HTMLDivElement | null>(null);

  const goToOrder = (orderId: string) => {
    navigate(`/orders/${orderId}`, {
      state: {
        returnTo: "/orders",
        ordersView: viewMode,
        anchorDate: anchorDate.toISOString(),
      },
    });
  };

  // restore view mode and anchor date from navigation state
  useEffect(() => {
    const state = location.state as any;
    if (!state) return;

    if (state.ordersView) setViewMode(state.ordersView);
    if (state.anchorDate) {
      const d = new Date(state.anchorDate);
      d.setHours(0, 0, 0, 0);
      setAnchorDate(d);
    }
  }, [location.state]);

  // store and restore UI state (search, filters, view mode) from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem("ordersUIState");
    if (!saved) return;

    try {
      const state = JSON.parse(saved);

      if (state.stageFilter !== undefined) {
        setStageFilter(state.stageFilter);
      }

      if (state.vendorFilter !== undefined) {
        setVendorFilter(state.vendorFilter);
      }

      if (state.invoiceSortKey) {
        setInvoiceSortKey(state.invoiceSortKey);
      }

      if (state.invoiceSortDirection) {
        setInvoiceSortDirection(state.invoiceSortDirection);
      }

      setSearchQuery(state.searchQuery ?? "");
      setStatusFilter(state.statusFilter ?? "active");
      setViewMode(state.viewMode ?? "list");
      setDateFilter(state.dateFilter ?? "");
      setQuickFilter(state.quickFilter ?? null);
      // Restore anchorDate if present
      if (state.anchorDate) {
        const restoredDate = new Date(state.anchorDate);
        restoredDate.setHours(0, 0, 0, 0);
        setAnchorDate(restoredDate);
      }
    } catch {
      console.warn("Failed to restore orders UI state");
    }
  }, []);

  // Restore scroll position when coming back from order details
  useEffect(() => {
    const savedScrollY = sessionStorage.getItem("ordersScrollY");
    if (!savedScrollY) return;
    requestAnimationFrame(() => {
      window.scrollTo(0, Number(savedScrollY));
    });
    sessionStorage.removeItem("ordersScrollY");
  }, []);

  // Restore kanban scroll position
  useEffect(() => {
    if (viewMode !== "kanban") return;

    const savedX = sessionStorage.getItem("ordersKanbanScrollX");
    if (!savedX || !kanbanScrollRef.current) return;

    requestAnimationFrame(() => {
      kanbanScrollRef.current!.scrollLeft = Number(savedX);
    });

    sessionStorage.removeItem("ordersKanbanScrollX");
  }, [viewMode]);


  // --- Fetch orders (with relations) ---
  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select(`
          *,
          customers(name),
          invoices(invoice_number),
          order_stages(*)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const getProductsFromOrder = (order: any) => {
    const stages = order.order_stages || [];
    const productMap = new Map<number, any[]>();

    stages.forEach((stage: any) => {
      const productNumber = stage.metadata?.product_number;
      if (!productNumber) return;
      if (!productMap.has(productNumber)) productMap.set(productNumber, []);
      productMap.get(productNumber)!.push(stage);
    });

    return Array.from(productMap.entries()).map(([productNumber, stages]) => {
      const sortedStages = [...stages].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const latest = sortedStages[sortedStages.length - 1];
      return {
        productNumber,
        productName: latest?.metadata?.product_name,
        stage: latest?.stage_name ?? "Ordered",
        vendor: latest?.vendor_name ?? "In-house",
      };
    });
  };

  const filterProducts = (products: any[]) => {
    return products.filter((p) => {
      if (
        stageFilter &&
        p.stage?.toLowerCase() !== stageFilter.toLowerCase()
      ) return false;
      // ⚠️ normalize vendor casing too
      if (vendorFilter && p.vendor !== vendorFilter) return false;
      return true;
    });
  };

  // --- Fetch stages from DB (order by order_index) ---
  const { data: stagesData } = useQuery({
    queryKey: ["stages"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("stages")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // --- Fetch vendors (optional, handy later) ---
  const { data: vendors } = useQuery({
    queryKey: ["vendors"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vendors")
        .select("*")
        .eq("active", true);
      if (error) throw error;
      return data || [];
    },
  });

  // --- Fetch calendar order items (per-item, per-delivery-date) ---
  const { data: calendarItems = [], isLoading: calendarLoading } = useQuery({
    queryKey: ["calendar-order-items"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("order_items_calendar_view")
        .select("*");

      if (error) throw error;
      return data || [];
    },
    enabled: viewMode === "calendar",
  });

  // --- Group calendar items by delivery date (YYYY-MM-DD) ---
  const calendarItemsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};

    calendarItems.forEach((item: any) => {
      if (!item.delivery_date) return;

      const key = item.delivery_date; // already YYYY-MM-DD from DB
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(item);
    });

    return map;
  }, [calendarItems]);

  // build stage names array used across component
  const STAGES = (stagesData || []).map((s: any) => s.name);

  // --- Date helpers ---
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const isOverdue = (order: any) => {
    if (["delivered", "cancelled"].includes(order.order_status)) return false;
    if (!order.metadata?.delivery_date) return false;

    const deliveryDate = new Date(order.metadata.delivery_date);
    return deliveryDate < todayStart;
  };


  // Calculate stats
  const stats = {
    total: orders?.length || 0,
    active: orders?.filter((o: any) => !["delivered", "cancelled"].includes(o.order_status)).length || 0,
    completed: orders?.filter((o: any) => o.order_status === "delivered").length || 0,
    overdue: orders?.filter(isOverdue).length || 0,
    dueSoon:
      orders?.filter((o: any) => {
        if (["delivered", "cancelled"].includes(o.order_status)) return false;
        if (!o.metadata?.delivery_date) return false;

        const deliveryDate = new Date(o.metadata.delivery_date);
        deliveryDate.setHours(0, 0, 0, 0);

        const diffDays =
          (deliveryDate.getTime() - todayStart.getTime()) /
          (1000 * 60 * 60 * 24);

        return diffDays >= 0 && diffDays <= 3 && !isOverdue(o);
      }).length || 0,
  };

  const upcoming = orders?.filter(o => {
    if (["delivered", "cancelled"].includes(o.order_status)) return false;
    if (!o.metadata?.delivery_date) return true;

    const d = new Date(o.metadata.delivery_date);
    d.setHours(0, 0, 0, 0);

    const diff =
      (d.getTime() - todayStart.getTime()) /
      (1000 * 60 * 60 * 24);

    return diff > 3;
  });

  console.log("Upcoming orders:", upcoming?.length);

  // Separate active and completed orders
  const activeOrders = orders?.filter((o: any) => !["delivered", "cancelled"].includes(o.order_status)) || [];
  const completedOrders = orders?.filter((o: any) => o.order_status === "delivered") || [];

  // Filter orders based on selected tab + search + date + quickFilter
  const baseOrders =
    statusFilter === "completed"
      ? completedOrders
      : statusFilter === "cancelled"
        ? orders?.filter((o: any) => o.order_status === "cancelled")
        : statusFilter === "active"
          ? activeOrders
          : orders;

  const filteredOrders = baseOrders
    ?.filter((order: any) => {
      if (quickFilter === "overdue") return isOverdue(order);
      if (quickFilter === "dueSoon") {
        if (["delivered", "cancelled"].includes(order.order_status)) return false;
        if (!order.metadata?.delivery_date) return false;

        const deliveryDate = new Date(order.metadata.delivery_date);
        deliveryDate.setHours(0, 0, 0, 0);

        const diffDays =
          (deliveryDate.getTime() - todayStart.getTime()) /
          (1000 * 60 * 60 * 24);

        return diffDays >= 0 && diffDays <= 3 && !isOverdue(order);
      }
      return true;
    })
    .filter((order: any) => {
      const matchesSearch =
        order.order_code?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        order.customers?.name?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesDate =
        !dateFilter ||
        new Date(order.created_at).toISOString().split("T")[0] === dateFilter;

      return matchesSearch && matchesDate;
    });


  const ordersWithVisibleProducts = useMemo(() => {
    if (!filteredOrders) return [];

    return filteredOrders
      .map((order: any) => {
        const allProducts = getProductsFromOrder(order);
        const visibleProducts = filterProducts(allProducts);

        if (visibleProducts.length === 0) return null;

        return {
          ...order,
          visibleProducts,
        };
      })
      .filter(Boolean);
  }, [filteredOrders, stageFilter, vendorFilter]);

  // --- Sorting for invoices in table view ---
  type InvoiceSortKey = "delivery" | "invoice" | "amount";
  type SortDirection = "asc" | "desc";
  const [invoiceSortKey, setInvoiceSortKey] =
    useState<InvoiceSortKey>("delivery");
  const [invoiceSortDirection, setInvoiceSortDirection] =
    useState<SortDirection>("asc"); // earliest first


  const handleInvoiceSortChange = (key: InvoiceSortKey) => {
    if (invoiceSortKey === key) {
      // toggle direction
      setInvoiceSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      // new key → default direction
      setInvoiceSortKey(key);
      setInvoiceSortDirection(key === "delivery" ? "asc" : "desc");
    }
  };

  // Group orders by invoice for table view
  const ordersGroupedByInvoice = useMemo(() => {
    if (!ordersWithVisibleProducts) return [];

    const map = new Map<string, any>();

    ordersWithVisibleProducts.forEach((order: any) => {
      const invoiceId = order.invoice_id || "no-invoice";

      if (!map.has(invoiceId)) {
        map.set(invoiceId, {
          invoice_id: invoiceId,
          invoice_number: order.invoices?.invoice_number || "—",
          customer_name: order.customers?.name || "—",
          orders: [],
          earliest_delivery_date: order.metadata?.delivery_date
            ? new Date(order.metadata.delivery_date)
            : null,
          total_amount: 0, // 👈 ADD
        });
      }

      const group = map.get(invoiceId);

      // track earliest delivery date
      if (order.metadata?.delivery_date) {
        const d = new Date(order.metadata.delivery_date);
        if (
          !group.earliest_delivery_date ||
          d < group.earliest_delivery_date
        ) {
          group.earliest_delivery_date = d;
        }
      }

      group.orders.push(order);
      group.total_amount += Number(order.total_amount || 0);
    });

    // --- SORTING BASED ON SELECTED KEY ---
    const sortedInvoices = Array.from(map.values()).sort((a, b) => {
      let result = 0;
      if (invoiceSortKey === "delivery") {
        if (!a.earliest_delivery_date) return 1;
        if (!b.earliest_delivery_date) return -1;
        result =
          a.earliest_delivery_date.getTime() -
          b.earliest_delivery_date.getTime();
      }
      if (invoiceSortKey === "invoice") {
        const aNum = parseInt(a.invoice_number.replace(/\D/g, "")) || 0;
        const bNum = parseInt(b.invoice_number.replace(/\D/g, "")) || 0;
        result = aNum - bNum;
      }
      if (invoiceSortKey === "amount") {
        result = a.total_amount - b.total_amount;
      }
      return invoiceSortDirection === "asc" ? result : -result;
    });
    return sortedInvoices;
  }, [filteredOrders, invoiceSortKey, invoiceSortDirection]);


  // get orders for a given stage name (kanban)
  const getOrdersByStage = (stageName: string) => {
    return activeOrders?.filter(order => {
      // latest stage entry by created_at (we fetched order_stages already)
      const stagesForOrder = (order.order_stages || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const latestStage = stagesForOrder[stagesForOrder.length - 1];
      const currentStageName = latestStage?.stage_name || (STAGES.length ? STAGES[0] : "Ordered");
      return currentStageName === stageName;
    }) || [];
  };

  // get the current stage name for an order object
  const getCurrentStage = (order: any) => {
    const stagesForOrder = (order.order_stages || []).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    return stagesForOrder[stagesForOrder.length - 1]?.stage_name || (STAGES.length ? STAGES[0] : "Ordered");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered": return "bg-success/10 text-success border border-success/20";
      case "cancelled": return "bg-muted text-muted-foreground border border-border";
      default: return "bg-warning/10 text-warning border border-warning/20";
    }
  };

  const getCardClassName = (status: string) => {
    switch (status) {
      case "delivered":
        return "border-success/50 bg-success/5";
      case "cancelled":
        return "border-destructive/50 bg-destructive/5";
      default:
        return "";
    }
  };

  // --- Move to stage / update logic ---
  // Important: read current stage from DB (single source of truth), then compute the stages to insert/mark done
  const updateStageMutation = useMutation({
    mutationFn: async ({ orderId, newStage }: { orderId: string; newStage: string }) => {
      // ensure stages are available
      const stageNames = STAGES;
      if (!stageNames.length) throw new Error("No stages defined in DB");

      // fetch latest stage for this order from DB (single source)
      const { data: latestStageRows, error: latestErr } = await (supabase as any)
        .from("order_stages")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (latestErr) throw latestErr;

      const currentStageName = latestStageRows && latestStageRows.length ? latestStageRows[0].stage_name : stageNames[0];

      const currentStageIndex = stageNames.indexOf(currentStageName);
      const newStageIndex = stageNames.indexOf(newStage);

      if (newStageIndex === -1) throw new Error("Unknown stage");
      if (newStageIndex <= currentStageIndex) {
        throw new Error("Cannot move to a previous stage");
      }

      // stages to create between current and new (inclusive newStage)
      const stagesToComplete = stageNames.slice(currentStageIndex + 1, newStageIndex + 1);
      const isMovingToDelivered = stageNames[newStageIndex] === "Delivered";

      const now = new Date().toISOString();

      // Build inserts
      const stagesToInsert = stagesToComplete.map(stageName => ({
        order_id: orderId,
        stage_name: stageName,
        vendor_name: null,
        status: isMovingToDelivered ? "done" : (stageName === newStage ? "in_progress" : "done"),
        start_ts: now,
        end_ts: isMovingToDelivered ? now : (stageName === newStage ? null : now),
        metadata: null,
      }));

      if (stagesToInsert.length > 0) {
        const { error: insertError } = await (supabase as any).from("order_stages").insert(stagesToInsert);
        if (insertError) throw insertError;
      }

      // if it's delivered, set order_status
      if (isMovingToDelivered) {
        const { error: orderError } = await (supabase as any)
          .from("orders")
          .update({ order_status: "delivered" })
          .eq("id", orderId);
        if (orderError) throw orderError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["all-order-stages"] });
      toast.success("Order stage updated successfully!");
    },
    onError: (err: any) => {
      console.error("updateStageMutation error:", err);
      toast.error(err?.message || "Failed to update order stage");
    },
  });

  // update single order status (delivered/cancelled)
  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: "delivered" | "cancelled" }) => {
      // Update order status
      const { error: orderError } = await (supabase as any)
        .from("orders")
        .update({ order_status: status })
        .eq("id", orderId);
      if (orderError) throw orderError;

      // If delivering, mark existing stages done and insert missing ones
      if (status === "delivered") {
        // existing stages for this order
        const { data: existingStages } = await (supabase as any)
          .from("order_stages")
          .select("stage_name")
          .eq("order_id", orderId);

        const existingStageNames = (existingStages || []).map((s: any) => s.stage_name);

        // mark existing not-done stages as done
        const { error: updateError } = await (supabase as any)
          .from("order_stages")
          .update({ status: "done", end_ts: new Date().toISOString() })
          .eq("order_id", orderId)
          .neq("status", "done");
        if (updateError) throw updateError;

        // insert missing stages as done
        const missingStages = STAGES.filter(stage => !existingStageNames.includes(stage));
        if (missingStages.length > 0) {
          const now = new Date().toISOString();
          const toInsert = missingStages.map(stageName => ({
            order_id: orderId,
            stage_name: stageName,
            status: "done",
            start_ts: now,
            end_ts: now,
            vendor_name: null,
          }));
          const { error: insertError } = await (supabase as any).from("order_stages").insert(toInsert);
          if (insertError) throw insertError;
        }
      }
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Order marked as ${status === "delivered" ? "delivered" : "cancelled"}!`);
      setConfirmDialog({ open: false, orderId: "", action: "delivered" });
    },
    onError: (err: any) => {
      console.error("updateOrderStatusMutation error", err);
      toast.error(err?.message || "Failed to update order status");
    },
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Orders</p>
              <h3 className="text-3xl font-bold mt-2">{stats.total}</h3>
              <p className="text-xs text-muted-foreground mt-1">All orders in system</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-6 w-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card
          className="p-6 cursor-pointer hover:shadow-md"
          onClick={() => {
            setStatusFilter("completed");
            setQuickFilter(null);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Completed</p>
              <h3 className="text-3xl font-bold mt-2">{stats.completed}</h3>
              <p className="text-xs text-muted-foreground mt-1">Successfully delivered</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-success" />
            </div>
          </div>
        </Card>

        <Card
          className="p-6 cursor-pointer hover:shadow-md"
          onClick={() => {
            setStatusFilter("active");
            setQuickFilter(null);
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Orders</p>
              <h3 className="text-3xl font-bold mt-2">{stats.active}</h3>
              <p className="text-xs text-muted-foreground mt-1">Currently in progress</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-warning/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-warning" />
            </div>
          </div>
        </Card>

        <Card
          className="p-6 border border-destructive/40  cursor-pointer hover:shadow-md"
          // bg-destructive/5
          onClick={() => {
            setStatusFilter("active");
            setQuickFilter("overdue");
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Overdue</p>
              <h3 className="text-3xl font-bold mt-2 text-destructive">
                {stats.overdue}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Past delivery date
              </p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-destructive/15 flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
          </div>
        </Card>

        <Card
          className="p-6 cursor-pointer hover:shadow-md"
          onClick={() => {
            setStatusFilter("active");
            setQuickFilter("dueSoon");
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Due Soon</p>
              <h3 className="text-3xl font-bold mt-2">{stats.dueSoon}</h3>
              <p className="text-xs text-muted-foreground mt-1">Due within 3 days</p>
            </div>
            <div className="h-12 w-12 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
          </div>
        </Card>
      </div>

      {/* Search & Filter */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-xl font-semibold">Search & Filter Orders</h2>
            </div>
            <div className="flex gap-2">
              <Button
                variant={viewMode === "list" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
                {/* List */}
              </Button>
              <Button
                variant={viewMode === "kanban" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("kanban")}
              >
                <LayoutGrid className="h-4 w-4" />
                {/* Kanban */}
              </Button>
              <Button
                variant={viewMode === "calendar" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("calendar")}
              >
                <CalendarDays className="h-4 w-4" />
                {/* Calendar */}
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("table")}
              >
                <Sheet className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-col md:flex-row gap-4">
            <Input
              placeholder="Search by order number, customer name, or item..."
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
            {/* Stage Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="min-w-[140px] justify-between">
                  <span className="truncate">
                    {stageFilter ? `Stage: ${stageFilter}` : <div>All Stages</div>}
                  </span>
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="w-56 max-h-[280px] overflow-y-auto">
                <DropdownMenuItem
                  onClick={() => setStageFilter(null)}
                  className={!stageFilter ? "font-semibold" : ""}
                >
                  All Stages
                </DropdownMenuItem>

                {STAGES.map((stage) => (
                  <DropdownMenuItem
                    key={stage}
                    onClick={() => setStageFilter(stage)}
                    className={stageFilter === stage ? "font-semibold text-primary" : ""}
                  >
                    {stage}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Vendor Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="min-w-[160px] justify-between"
                >
                  <span className="truncate">
                    {vendorFilter ? `Vendor: ${vendorFilter}` : "All Vendors"}
                  </span>
                  <SlidersHorizontal className="h-4 w-4 ml-2 opacity-50" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="w-56 max-h-[280px] overflow-y-auto">
                <DropdownMenuItem
                  onClick={() => setVendorFilter(null)}
                  className={!vendorFilter ? "font-semibold" : ""}
                >
                  All Vendors
                </DropdownMenuItem>

                {(vendors || []).map((vendor: any) => (
                  <DropdownMenuItem
                    key={vendor.id}
                    onClick={() => setVendorFilter(vendor.name)}
                    className={
                      vendorFilter === vendor.name
                        ? "font-semibold text-primary"
                        : ""
                    }
                  >
                    {vendor.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-auto md:w-auto">
              <TabsList className="grid grid-cols-4 w-full md:w-auto">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
              </TabsList>
            </Tabs>

          </div>
        </div>
        {/* Active Filters */}
        {(statusFilter !== "all" || quickFilter) && (
          <div className="flex flex-wrap items-center gap-2 pt-2">
            <span className="text-xs text-muted-foreground">Active filters:</span>

            {stageFilter && (
              <Badge
                variant="secondary"
                className="cursor-pointer"
                onClick={() => setStageFilter(null)}
              >
                Stage: {stageFilter} ✕
              </Badge>
            )}

            {statusFilter !== "all" && (
              <Badge
                variant="secondary"
                className="cursor-pointer"
                onClick={() => setStatusFilter("all")}
              >
                Status: {statusFilter} ✕
              </Badge>
            )}

            {quickFilter === "overdue" && (
              <Badge
                variant="destructive"
                className="cursor-pointer"
                onClick={() => setQuickFilter(null)}
              >
                Overdue ✕
              </Badge>
            )}

            {quickFilter === "dueSoon" && (
              <Badge
                variant="secondary"
                className="cursor-pointer"
                onClick={() => setQuickFilter(null)}
              >
                Due Soon ✕
              </Badge>
            )}
            {vendorFilter && (
              <Badge
                variant="secondary"
                className="cursor-pointer"
                onClick={() => setVendorFilter(null)}
              >
                Vendor: {vendorFilter} ✕
              </Badge>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setStatusFilter("all");
                setQuickFilter(null);
              }}
            >
              Clear all
            </Button>
          </div>
        )}
      </Card>

      {/* Orders View */}
      {viewMode === "list" && (
        <Card className="p-4 md:p-6 bg-transparent shadow-none border-none">
          {/* idhar color dekhlo zara  */}
          <div className="flex items-center gap-2 mb-6">
            <Package className="h-5 w-5" />
            <h2 className="text-xl font-semibold">Orders ({filteredOrders?.length || 0})</h2>
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filteredOrders?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No orders yet. Create your first order!
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders?.map((order: any) => {
                const currentStage = getCurrentStage(order);
                const createdDate = new Date(order.created_at);

                return (
                  <Card
                    key={order.id}
                    className={`p-4 rounded-xl border-l-4 hover:shadow-md transition-all cursor-pointer
                      ${getCardClassName(order.order_status)}
                      ${isOverdue(order) ? "border-destructive bg-destructive/5 ring-1 ring-destructive/30" : ""}
                    `}
                    // onClick={() => window.location.href = `/orders/${order.id}`}
                    onClick={() => {
                      sessionStorage.setItem("ordersScrollY", window.scrollY.toString());
                      if (viewMode === "kanban" && kanbanScrollRef.current) {
                        sessionStorage.setItem(
                          "ordersKanbanScrollX",
                          kanbanScrollRef.current.scrollLeft.toString()
                        );
                      }
                      sessionStorage.setItem(
                        "ordersUIState",
                        JSON.stringify({
                          searchQuery,
                          statusFilter,
                          viewMode,
                          dateFilter,
                          quickFilter,
                          anchorDate: anchorDate.toISOString(),
                          stageFilter,
                          vendorFilter,
                          invoiceSortKey,
                          invoiceSortDirection,
                        })
                      );
                      goToOrder(order.id);
                    }}
                    style={{
                      borderLeftColor: isOverdue(order)
                        ? "hsl(var(--destructive))"
                        : order.order_status === "delivered"
                          ? "hsl(var(--success))"
                          : "hsl(var(--warning))",
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <h3 className="font-semibold text-base sm:text-lg leading-snug break-words">#{order.order_code}</h3>
                          <Badge
                            className={`${getStatusColor(order.order_status)} text-[10px] px-2 py-0.5`}
                          >
                            {order.order_status}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                            {currentStage}
                          </Badge>
                          {isOverdue(order) && (
                            <Badge
                              variant="destructive"
                              className="text-[10px] px-2 py-0.5"
                            >
                              Overdue
                            </Badge>
                          )}
                        </div>

                        <p className="text-sm font-medium text-foreground leading-snug break-words">
                          {order.metadata?.item_name || "Order Item"}
                        </p>
                        {order.metadata?.reference_name && (
                          <p className="text-xs text-muted-foreground">Ref: {order.metadata.reference_name}</p>
                        )}
                      </div>

                      {/* <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/orders/${order.id}`} className="w-full">
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setConfirmDialog({
                                open: true,
                                orderId: order.id,
                                action: "delivered",
                              })
                            }
                          >
                            Mark as Delivered
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() =>
                              setConfirmDialog({
                                open: true,
                                orderId: order.id,
                                action: "cancelled",
                              })
                            }
                          >
                            Mark as Cancelled
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu> */}
                    </div>

                    <div className="mt-3 flex flex-wrap justify-between text-sm text-muted-foreground">
                      <div className="flex flex-col">
                        <span className="text-[11px] uppercase tracking-wide">Customer</span>
                        <span className="font-semibold text-foreground">
                          {order.customers?.name || "-"}
                        </span>
                      </div>
                      <div className="flex flex-col text-right">
                        <span className="text-[11px] uppercase tracking-wide">Amount</span>
                        <span className="font-semibold text-foreground">
                          ₹{order.total_amount?.toLocaleString("en-IN") || 0}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex justify-between text-xs sm:text-sm text-muted-foreground">
                      <span>
                        🗓️{" "}
                        {createdDate.toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      <span>
                        📦{" "}
                        {order.metadata?.delivery_date
                          ? new Date(order.metadata.delivery_date).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                          : "-"}
                      </span>
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex gap-[2px] flex-1">
                        {STAGES.map((stage, idx) => {
                          const currentIdx = STAGES.indexOf(currentStage);
                          const isDelivered = order.order_status === "delivered";
                          const isCompleted = isDelivered ? true : idx <= currentIdx;
                          return (
                            <div
                              key={stage}
                              className={`h-1.5 rounded-full flex-1 transition-colors ${isCompleted ? "bg-success" : "bg-muted"
                                }`}
                            />
                          );
                        })}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {order.order_status === "delivered"
                          ? STAGES.length
                          : STAGES.indexOf(currentStage) + 1}
                        /{STAGES.length}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </Card>
      )}
      {viewMode === "kanban" && (
        <div ref={kanbanScrollRef} className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {STAGES.map((stage) => {
              const stageOrders = getOrdersByStage(stage);

              return (
                <Card key={stage} className="w-80 flex-shrink-0 p-4">
                  <div className="mb-4">
                    <h3 className="font-semibold text-lg">{stage}</h3>
                    <Badge variant="secondary" className="mt-1">
                      {stageOrders.length} orders
                    </Badge>
                  </div>

                  <div className="space-y-3 max-h-[600px] overflow-y-auto">
                    {isLoading ? (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        Loading...
                      </div>
                    ) : stageOrders.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        No orders in this stage
                      </div>
                    ) : (
                      stageOrders.map((order: any) => {
                        const currentStageIndex = STAGES.indexOf(stage);
                        const nextStage = STAGES[currentStageIndex + 1];
                        // get vendor name from the matching order_stage entry (if any)
                        const currentKanbanStageEntry = (order.order_stages || []).find((s: any) => s.stage_name === stage);
                        const vendorName = currentKanbanStageEntry?.vendor_name;

                        return (
                          // kanban card
                          <Card key={order.id} className={`p-3 hover:shadow-md transition-all cursor-pointer ${getCardClassName(order.order_status)}`}
                            onClick={() => {
                              sessionStorage.setItem("ordersScrollY", window.scrollY.toString());
                              if (viewMode === "kanban" && kanbanScrollRef.current) {
                                sessionStorage.setItem(
                                  "ordersKanbanScrollX",
                                  kanbanScrollRef.current.scrollLeft.toString()
                                );
                              }
                              sessionStorage.setItem(
                                "ordersUIState",
                                JSON.stringify({
                                  searchQuery,
                                  statusFilter,
                                  viewMode,
                                  dateFilter,
                                  quickFilter,
                                  anchorDate: anchorDate.toISOString(),
                                  stageFilter,
                                  vendorFilter,
                                  invoiceSortKey,
                                  invoiceSortDirection,
                                })
                              );
                              // navigate(`/orders/${order.id}`);
                              goToOrder(order.id);
                            }}>
                            <div className="space-y-2">
                              <div className="flex items-start justify-between">
                                <h4 className="font-semibold text-sm">
                                  #{order.order_code}
                                </h4>
                                <Badge className={`${getStatusColor(order.order_status)} text-xs`}>
                                  {order.order_status}
                                </Badge>
                              </div>

                              <p className="text-xs font-medium truncate">
                                {order.metadata?.item_name || "Order Item"}
                              </p>

                              {vendorName && (
                                <p className="text-sm font-semibold text-primary/80">
                                  <span className="font-medium text-muted-foreground">Vendor:</span> {vendorName}
                                </p>
                              )}
                              <div className="text-xs space-y-1">
                                <p className="text-muted-foreground">
                                  <span className="font-medium">Customer:</span> {order.customers?.name || "-"}
                                </p>
                                <p className="text-muted-foreground">
                                  <span className="font-medium">Amount:</span> ₹{order.total_amount}
                                </p>
                              </div>
                              <div className="text-xs space-y-1">
                                <span>
                                  📦{" "}
                                  {order.metadata?.delivery_date
                                    ? new Date(order.metadata.delivery_date).toLocaleDateString("en-IN", {
                                      day: "numeric",
                                      month: "short",
                                      year: "numeric",
                                    })
                                    : "-"}
                                </span>
                              </div>


                              {/* <div className="flex gap-1">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="w-full">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem asChild>
                                      <Link to={`/orders/${order.id}`} className="w-full">
                                        View Details
                                      </Link>
                                    </DropdownMenuItem>
                                    {nextStage && (
                                      <DropdownMenuItem
                                        onClick={() => updateStageMutation.mutate({
                                          orderId: order.id,
                                          newStage: nextStage
                                        })}
                                      >
                                        Move to Next Stage
                                      </DropdownMenuItem>
                                    )}
                                    <DropdownMenuItem onClick={() => setConfirmDialog({ open: true, orderId: order.id, action: "delivered" })}>
                                      Mark as Delivered
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => setConfirmDialog({ open: true, orderId: order.id, action: "cancelled" })}>
                                      Mark as Cancelled
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div> */}
                            </div>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === "calendar" && (
        <div className="space-y-4">
          {/* Week Navigation — STEP 3d */}
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnchorDate(d => addDays(d, -7))}
            >
              ← Previous
            </Button>

            <div className="text-sm font-medium">
              Week of{" "}
              {weekDates[0].toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnchorDate(d => addDays(d, 7))}
            >
              Next →
            </Button>
          </div>

          <WeekCalendar
            dates={weekDates}
            anchorDate={anchorDate}
            onItemClick={(orderId) => {
              goToOrder(orderId);
            }}
          />
        </div>
      )}

      {viewMode === "table" && (
        <OrdersInvoiceTable
          groupedInvoices={ordersGroupedByInvoice}
          invoiceSortKey={invoiceSortKey}
          invoiceSortDirection={invoiceSortDirection}
          onChangeSort={handleInvoiceSortChange}
          onOrderClick={(orderId) => {
            sessionStorage.setItem(
              "ordersUIState",
              JSON.stringify({
                searchQuery,
                statusFilter,
                viewMode,
                dateFilter,
                quickFilter,
                anchorDate: anchorDate.toISOString(),
                stageFilter,
                vendorFilter,
                invoiceSortKey,
                invoiceSortDirection,
              })
            );
            goToOrder(orderId);
          }}
        />

      )}

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, orderId: "", action: "delivered" })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === "delivered" ? "Mark Order as Delivered?" : "Cancel Order?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === "delivered"
                ? "This will mark the order as delivered and complete all stages. The order will be moved to the completed section."
                : "This will cancel the order. This action can be reversed by changing the order status again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => updateOrderStatusMutation.mutate({ orderId: confirmDialog.orderId, status: confirmDialog.action })}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}