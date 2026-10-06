// Orders page - in use
import { useState, useEffect, useRef, useMemo, useDeferredValue } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/services/api/queryKeys";
import { ordersService } from "@/services/ordersService";
import { vendorsService } from "@/services/vendorsService";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { useNavigate, useLocation } from "react-router-dom";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Package,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  Search,
  LayoutGrid,
  List,
  Table2,
  AlertTriangle,
  CalendarDays,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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
  useDocumentTitle("Orders");
  useRealtimeSync({ enableOrders: true });
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [viewMode, setViewMode] =
    useState<"list" | "kanban" | "calendar" | "table">("table");

  // Calendar anchor date (controls visible week/month)
  const [anchorDate, setAnchorDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [stageFilter, setStageFilter] = useState<string | null>(null);
  const [vendorFilter, setVendorFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [quickFilter, setQuickFilter] = useState<"overdue" | "dueSoon" | null>(null);

  // Sorting for invoices in table view
  type InvoiceSortKey = "delivery" | "invoice" | "amount";
  type SortDirection = "asc" | "desc";
  const [invoiceSortKey, setInvoiceSortKey] = useState<InvoiceSortKey>("delivery");
  const [invoiceSortDirection, setInvoiceSortDirection] = useState<SortDirection>("asc");

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    orderId: string;
    action: "delivered" | "cancelled";
  }>({
    open: false,
    orderId: "",
    action: "delivered",
  });

  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const kanbanScrollRef = useRef<HTMLDivElement | null>(null);

  const weekDates = useMemo(() => {
    const start = startOfWeek(anchorDate, { weekStartsOn: 1 }); // Monday
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [anchorDate]);

  const saveCurrentUIState = () => {
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
  };

  const goToOrder = (orderId: string) => {
    saveCurrentUIState();
    navigate(`/orders/${orderId}`, {
      state: {
        returnTo: "/orders",
        ordersView: viewMode,
        anchorDate: anchorDate.toISOString(),
      },
    });
  };

  // restore view mode, anchor date, filters from navigation state
  useEffect(() => {
    const state = location.state as any;
    if (!state) return;

    if (state.ordersView) setViewMode(state.ordersView);
    if (state.anchorDate) {
      const d = new Date(state.anchorDate);
      d.setHours(0, 0, 0, 0);
      setAnchorDate(d);
    }
    if (state.quickFilter !== undefined) {
      setQuickFilter(state.quickFilter);
    }
    if (state.statusFilter !== undefined) {
      setStatusFilter(state.statusFilter);
    }
  }, [location.state]);

  // store and restore UI state (search, filters, view mode) from sessionStorage
  useEffect(() => {
    const saved = sessionStorage.getItem("ordersUIState");
    if (!saved) return;

    try {
      const state = JSON.parse(saved);

      if (state.stageFilter !== undefined) setStageFilter(state.stageFilter);
      if (state.vendorFilter !== undefined) setVendorFilter(state.vendorFilter);
      if (state.invoiceSortKey) setInvoiceSortKey(state.invoiceSortKey);
      if (state.invoiceSortDirection) setInvoiceSortDirection(state.invoiceSortDirection);

      setSearchQuery(state.searchQuery ?? "");
      setStatusFilter(state.statusFilter ?? "active");
      setViewMode(state.viewMode ?? "table");
      setDateFilter(state.dateFilter ?? "");
      setQuickFilter(state.quickFilter ?? null);

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
  const { data: rawOrders, isLoading } = useQuery({
    queryKey: queryKeys.orders.all,
    queryFn: async ({ signal }) => {
      return ordersService.fetchOrders({ limit: 1000, signal });
    },
  });

  // --- Fetch stages from DB (order by order_index) ---
  const { data: stagesData } = useQuery({
    queryKey: queryKeys.stages.all,
    queryFn: async ({ signal }) => {
      return ordersService.fetchStages(signal);
    },
  });

  const STAGES: string[] = useMemo(
    () => (stagesData || []).map((s: any) => s.name),
    [stagesData]
  );

  // --- Fetch vendors ---
  const { data: vendors } = useQuery({
    queryKey: queryKeys.vendors.all,
    queryFn: async ({ signal }) => {
      return vendorsService.fetchVendors({ signal });
    },
  });

  // --- Fetch RPC Stats ---
  const { data: statsData } = useQuery({
    queryKey: queryKeys.orders.stats(),
    queryFn: async ({ signal }) => {
      return ordersService.fetchOrderStats(signal);
    },
  });

  // --- Single-pass Enrichment & Pre-computation ---
  const enrichedOrders = useMemo(() => {
    if (!rawOrders || rawOrders.length === 0) return [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();
    const threeDaysLaterTime = todayTime + 3 * 24 * 60 * 60 * 1000;
    const defaultStage = STAGES.length > 0 ? STAGES[0] : "Ordered";

    return rawOrders.map((order: any) => {
      const stages = order.order_stages || [];
      const stagesSorted = stages.length > 1
        ? [...stages].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        : stages;

      const latestStageEntry = stagesSorted[stagesSorted.length - 1];
      const currentStage = latestStageEntry?.stage_name || defaultStage;

      // Extract products once per order
      const productMap = new Map<number, any[]>();
      stages.forEach((stage: any) => {
        const productNumber = stage.metadata?.product_number;
        if (!productNumber) return;
        if (!productMap.has(productNumber)) productMap.set(productNumber, []);
        productMap.get(productNumber)!.push(stage);
      });

      let products = Array.from(productMap.entries()).map(([productNumber, pStages]) => {
        const sortedPStages = pStages.length > 1
          ? [...pStages].sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          : pStages;
        const latest = sortedPStages[sortedPStages.length - 1];
        return {
          productNumber,
          productName: latest?.metadata?.product_name || null,
          stage: latest?.stage_name ?? "Ordered",
          vendor: latest?.vendor_name ?? "In-house",
        };
      });

      // Fallback for older orders created before multi-product metadata was introduced
      if (products.length === 0) {
        products = [
          {
            productNumber: 1,
            productName: order.metadata?.item_name || "Order Item",
            stage: currentStage,
            vendor: latestStageEntry?.vendor_name ?? "In-house",
          },
        ];
      }

      // Delivery date & overdue calculations
      let deliveryDateObj: Date | null = null;
      let deliveryDateFormatted: string | null = null;
      let isOverdue = false;
      let isDueSoon = false;

      if (order.metadata?.delivery_date) {
        deliveryDateObj = new Date(order.metadata.delivery_date);
        deliveryDateObj.setHours(0, 0, 0, 0);
        const delTime = deliveryDateObj.getTime();

        deliveryDateFormatted = deliveryDateObj.toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        });

        if (!["delivered", "cancelled"].includes(order.order_status)) {
          if (delTime < todayTime) {
            isOverdue = true;
          } else if (delTime >= todayTime && delTime <= threeDaysLaterTime) {
            isDueSoon = true;
          }
        }
      }

      // Pre-format created date
      const createdDate = new Date(order.created_at);
      const createdDateFormatted = createdDate.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
      const createdDateYMD = order.created_at.split("T")[0];

      return {
        ...order,
        currentStage,
        products,
        isOverdue,
        isDueSoon,
        deliveryDateObj,
        deliveryDateFormatted,
        createdDateFormatted,
        createdDateYMD,
        customerName: order.customers?.name || "",
        invoiceNumber: order.invoices?.invoice_number || "",
      };
    });
  }, [rawOrders, STAGES]);

  // --- Fast Computed Stats (fallback if RPC not available) ---
  const stats = useMemo(() => {
    if (statsData) return statsData;

    let activeCount = 0;
    let completedCount = 0;
    let overdueCount = 0;
    let dueSoonCount = 0;

    enrichedOrders.forEach((o) => {
      if (o.order_status === "delivered") completedCount++;
      else if (o.order_status !== "cancelled") {
        activeCount++;
        if (o.isOverdue) overdueCount++;
        else if (o.isDueSoon) dueSoonCount++;
      }
    });

    return {
      total: enrichedOrders.length,
      active: activeCount,
      completed: completedCount,
      overdue: overdueCount,
      dueSoon: dueSoonCount,
    };
  }, [statsData, enrichedOrders]);

  // --- Partitioned Orders by Status ---
  const { activeOrders, completedOrders, cancelledOrders } = useMemo(() => {
    const active: any[] = [];
    const completed: any[] = [];
    const cancelled: any[] = [];

    enrichedOrders.forEach((order) => {
      if (order.order_status === "delivered") completed.push(order);
      else if (order.order_status === "cancelled") cancelled.push(order);
      else active.push(order);
    });

    return { activeOrders: active, completedOrders: completed, cancelledOrders: cancelled };
  }, [enrichedOrders]);

  // --- Filtered Orders (for List & Table views) ---
  const filteredOrders = useMemo(() => {
    const base =
      statusFilter === "completed"
        ? completedOrders
        : statusFilter === "cancelled"
        ? cancelledOrders
        : statusFilter === "active"
        ? activeOrders
        : enrichedOrders;

    const query = deferredSearchQuery.trim().toLowerCase();

    return base.filter((order) => {
      // Quick filter
      if (quickFilter === "overdue" && !order.isOverdue) return false;
      if (quickFilter === "dueSoon" && !order.isDueSoon) return false;

      // Date filter (YYYY-MM-DD)
      if (dateFilter && order.createdDateYMD !== dateFilter) return false;

      // Search query (order code, customer name, item name)
      if (query) {
        const matchesCode = order.order_code?.toLowerCase().includes(query);
        const matchesCustomer = order.customerName.toLowerCase().includes(query);
        const matchesItem = order.metadata?.item_name?.toLowerCase().includes(query);
        if (!matchesCode && !matchesCustomer && !matchesItem) return false;
      }

      return true;
    });
  }, [statusFilter, activeOrders, completedOrders, cancelledOrders, enrichedOrders, quickFilter, dateFilter, deferredSearchQuery]);

  // --- Filter Products within Orders (Stage & Vendor) ---
  const ordersWithVisibleProducts = useMemo(() => {
    if (!filteredOrders.length) return [];

    const hasStageFilter = !!stageFilter;
    const hasVendorFilter = !!vendorFilter;
    const stageLower = stageFilter ? stageFilter.toLowerCase() : null;

    if (!hasStageFilter && !hasVendorFilter) {
      return filteredOrders.map((order) => ({
        ...order,
        visibleProducts: order.products,
      }));
    }

    return filteredOrders
      .map((order) => {
        const visibleProducts = order.products.filter((p: any) => {
          if (hasStageFilter && p.stage?.toLowerCase() !== stageLower) return false;
          if (hasVendorFilter && p.vendor !== vendorFilter) return false;
          return true;
        });

        if (visibleProducts.length === 0) return null;

        return {
          ...order,
          visibleProducts,
        };
      })
      .filter(Boolean);
  }, [filteredOrders, stageFilter, vendorFilter]);

  // --- Kanban Stage Grouping (Shows active production orders partitioned by stage) ---
  const ordersByStage = useMemo(() => {
    const map: Record<string, any[]> = {};
    STAGES.forEach((s) => {
      map[s] = [];
    });

    const query = deferredSearchQuery.trim().toLowerCase();

    activeOrders.forEach((order) => {
      // Optional search filter
      if (query) {
        const matchesCode = order.order_code?.toLowerCase().includes(query);
        const matchesCustomer = order.customerName?.toLowerCase().includes(query);
        const matchesItem = order.metadata?.item_name?.toLowerCase().includes(query);
        if (!matchesCode && !matchesCustomer && !matchesItem) return;
      }

      // Optional vendor filter
      if (vendorFilter) {
        const hasVendor = (order.order_stages || []).some((s: any) => s.vendor_name === vendorFilter);
        if (!hasVendor) return;
      }

      // Optional stage filter
      if (stageFilter && order.currentStage?.toLowerCase() !== stageFilter.toLowerCase()) {
        return;
      }

      const stage = order.currentStage;
      if (!map[stage]) map[stage] = [];
      map[stage].push(order);
    });

    return map;
  }, [activeOrders, STAGES, deferredSearchQuery, vendorFilter, stageFilter]);

  // --- Group Orders by Invoice for Table View (Memoized & Sorted) ---
  const ordersGroupedByInvoice = useMemo(() => {
    if (!ordersWithVisibleProducts.length) return [];

    const map = new Map<string, any>();

    ordersWithVisibleProducts.forEach((order: any) => {
      const invoiceId = order.invoice_id || "no-invoice";

      if (!map.has(invoiceId)) {
        map.set(invoiceId, {
          invoice_id: invoiceId,
          invoice_number: order.invoiceNumber || "—",
          customer_name: order.customerName || "—",
          orders: [],
          earliest_delivery_date: order.deliveryDateObj,
          total_amount: 0,
        });
      }

      const group = map.get(invoiceId);

      if (order.deliveryDateObj) {
        if (!group.earliest_delivery_date || order.deliveryDateObj < group.earliest_delivery_date) {
          group.earliest_delivery_date = order.deliveryDateObj;
        }
      }

      group.orders.push(order);
      group.total_amount += Number(order.total_amount || 0);
    });

    const sortedInvoices = Array.from(map.values()).sort((a, b) => {
      let result = 0;
      if (invoiceSortKey === "delivery") {
        if (!a.earliest_delivery_date) return 1;
        if (!b.earliest_delivery_date) return -1;
        result = a.earliest_delivery_date.getTime() - b.earliest_delivery_date.getTime();
      } else if (invoiceSortKey === "invoice") {
        const aNum = parseInt(a.invoice_number.replace(/\D/g, "")) || 0;
        const bNum = parseInt(b.invoice_number.replace(/\D/g, "")) || 0;
        result = aNum - bNum;
      } else if (invoiceSortKey === "amount") {
        result = a.total_amount - b.total_amount;
      }
      return invoiceSortDirection === "asc" ? result : -result;
    });

    return sortedInvoices;
  }, [ordersWithVisibleProducts, invoiceSortKey, invoiceSortDirection]);

  const handleInvoiceSortChange = (key: InvoiceSortKey) => {
    if (invoiceSortKey === key) {
      setInvoiceSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setInvoiceSortKey(key);
      setInvoiceSortDirection(key === "delivery" ? "asc" : "desc");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "delivered":
        return "bg-success/10 text-success border border-success/20";
      case "cancelled":
        return "bg-muted text-muted-foreground border border-border";
      default:
        return "bg-warning/10 text-warning border border-warning/20";
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

  // --- Mutations ---
  const updateStageMutation = useMutation({
    mutationFn: async ({ orderId, newStage }: { orderId: string; newStage: string }) => {
      const stageNames = STAGES;
      if (!stageNames.length) throw new Error("No stages defined in DB");

      const { data: latestStageRows, error: latestErr } = await (supabase as any)
        .from("order_stages")
        .select("*")
        .eq("order_id", orderId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (latestErr) throw latestErr;

      const currentStageName =
        latestStageRows && latestStageRows.length ? latestStageRows[0].stage_name : stageNames[0];

      const currentStageIndex = stageNames.indexOf(currentStageName);
      const newStageIndex = stageNames.indexOf(newStage);

      if (newStageIndex === -1) throw new Error("Unknown stage");
      if (newStageIndex <= currentStageIndex) {
        throw new Error("Cannot move to a previous stage");
      }

      const stagesToComplete = stageNames.slice(currentStageIndex + 1, newStageIndex + 1);
      const isMovingToDelivered = stageNames[newStageIndex] === "Delivered";
      const now = new Date().toISOString();

      const stagesToInsert = stagesToComplete.map((stageName) => ({
        order_id: orderId,
        stage_name: stageName,
        vendor_name: null,
        status: isMovingToDelivered ? "done" : stageName === newStage ? "in_progress" : "done",
        start_ts: now,
        end_ts: isMovingToDelivered ? now : stageName === newStage ? null : now,
        metadata: null,
      }));

      if (stagesToInsert.length > 0) {
        const { error: insertError } = await (supabase as any).from("order_stages").insert(stagesToInsert);
        if (insertError) throw insertError;
      }

      if (isMovingToDelivered) {
        const { error: orderError } = await (supabase as any)
          .from("orders")
          .update({ order_status: "delivered" })
          .eq("id", orderId);
        if (orderError) throw orderError;
      }
    },
    onMutate: async ({ orderId, newStage }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.orders.all });
      const previousOrders = queryClient.getQueryData(queryKeys.orders.all);

      queryClient.setQueryData(queryKeys.orders.all, (old: any[] = []) => {
        return old.map((order) => {
          if (order.id !== orderId) return order;

          const now = new Date().toISOString();
          const existingStages = order.order_stages || [];
          const updatedStages = [
            ...existingStages.map((s: any) =>
              s.status === "in_progress"
                ? { ...s, status: "done", end_ts: now }
                : s
            ),
            {
              id: "temp-" + Date.now(),
              stage_name: newStage,
              vendor_name: null,
              status: newStage === "Delivered" ? "done" : "in_progress",
              created_at: now,
              start_ts: now,
              end_ts: newStage === "Delivered" ? now : null,
              metadata: null,
            },
          ];

          return {
            ...order,
            order_status:
              newStage === "Delivered" ? "delivered" : order.order_status,
            order_stages: updatedStages,
          };
        });
      });

      return { previousOrders };
    },
    onSuccess: () => {
      toast.success("Order stage updated successfully!");
    },
    onError: (err: any, _vars, context: any) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(queryKeys.orders.all, context.previousOrders);
      }
      console.error("updateStageMutation error:", err);
      toast.error(err?.message || "Failed to update order stage");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.stats() });
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: "delivered" | "cancelled" }) => {
      const { error: orderError } = await (supabase as any)
        .from("orders")
        .update({ order_status: status })
        .eq("id", orderId);
      if (orderError) throw orderError;

      if (status === "delivered") {
        const { data: existingStages } = await (supabase as any)
          .from("order_stages")
          .select("stage_name")
          .eq("order_id", orderId);

        const existingStageNames = (existingStages || []).map((s: any) => s.stage_name);

        const { error: updateError } = await (supabase as any)
          .from("order_stages")
          .update({ status: "done", end_ts: new Date().toISOString() })
          .eq("order_id", orderId)
          .neq("status", "done");
        if (updateError) throw updateError;

        const missingStages = STAGES.filter((stage) => !existingStageNames.includes(stage));
        if (missingStages.length > 0) {
          const now = new Date().toISOString();
          const toInsert = missingStages.map((stageName) => ({
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
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.stats() });
      toast.success(`Order marked as ${status === "delivered" ? "delivered" : "cancelled"}!`);
      setConfirmDialog({ open: false, orderId: "", action: "delivered" });
    },
    onError: (err: any) => {
      console.error("updateOrderStatusMutation error", err);
      toast.error(err?.message || "Failed to update order status");
    },
  });

  const OrdersSkeleton = () => {
    return (
      <div className="space-y-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="p-4 border rounded-xl animate-pulse">
            <div className="h-4 w-1/4 bg-muted rounded mb-2"></div>
            <div className="h-3 w-1/2 bg-muted rounded mb-2"></div>
            <div className="h-3 w-1/3 bg-muted rounded"></div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
      </div>

      {/* Stats Cards with Active Filter Ring Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card
          className={`p-3.5 sm:p-5 cursor-pointer transition-all hover:shadow-md ${
            statusFilter === "all" && !quickFilter ? "ring-2 ring-primary bg-primary/5" : ""
          }`}
          onClick={() => {
            setStatusFilter("all");
            setQuickFilter(null);
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Total Orders</p>
              <h3 className="text-xl sm:text-3xl font-bold mt-1 sm:mt-2">{stats.total}</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">All in system</p>
            </div>
            <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
            </div>
          </div>
        </Card>

        <Card
          className={`p-3.5 sm:p-5 cursor-pointer transition-all hover:shadow-md ${
            statusFilter === "completed" && !quickFilter ? "ring-2 ring-success bg-success/5" : ""
          }`}
          onClick={() => {
            setStatusFilter("completed");
            setQuickFilter(null);
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Completed</p>
              <h3 className="text-xl sm:text-3xl font-bold mt-1 sm:mt-2 text-success">{stats.completed}</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">Delivered</p>
            </div>
            <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-4 w-4 sm:h-6 sm:w-6 text-success" />
            </div>
          </div>
        </Card>

        <Card
          className={`p-3.5 sm:p-5 cursor-pointer transition-all hover:shadow-md ${
            statusFilter === "active" && !quickFilter ? "ring-2 ring-warning bg-warning/5" : ""
          }`}
          onClick={() => {
            setStatusFilter("active");
            setQuickFilter(null);
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Active</p>
              <h3 className="text-xl sm:text-3xl font-bold mt-1 sm:mt-2 text-warning">{stats.active}</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">In progress</p>
            </div>
            <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 sm:h-6 sm:w-6 text-warning" />
            </div>
          </div>
        </Card>

        <Card
          className={`p-3.5 sm:p-5 cursor-pointer transition-all hover:shadow-md ${
            quickFilter === "overdue"
              ? "ring-2 ring-destructive bg-destructive/10 border-destructive"
              : "border-destructive/40 bg-destructive/5"
          }`}
          onClick={() => {
            setStatusFilter("active");
            setQuickFilter("overdue");
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Overdue</p>
              <h3 className="text-xl sm:text-3xl font-bold mt-1 sm:mt-2 text-destructive">
                {stats.overdue}
              </h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                Past delivery
              </p>
            </div>
            <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-lg bg-destructive/15 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-4 w-4 sm:h-6 sm:w-6 text-destructive" />
            </div>
          </div>
        </Card>

        <Card
          className={`p-3.5 sm:p-5 cursor-pointer transition-all hover:shadow-md col-span-2 sm:col-span-1 ${
            quickFilter === "dueSoon"
              ? "ring-2 ring-amber-500 bg-amber-500/10"
              : ""
          }`}
          onClick={() => {
            setStatusFilter("active");
            setQuickFilter("dueSoon");
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">Due Soon</p>
              <h3 className="text-xl sm:text-3xl font-bold mt-1 sm:mt-2">{stats.dueSoon}</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">Within 3 days</p>
            </div>
            <div className="h-9 w-9 sm:h-12 sm:w-12 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
              <AlertCircle className="h-4 w-4 sm:h-6 sm:w-6 text-amber-600" />
            </div>
          </div>
        </Card>
      </div>

      {/* Search & Filter Toolbar */}
      <Card className="p-4 sm:p-5 shadow-sm border-border/80">
        <div className="space-y-3.5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-base sm:text-lg font-semibold">Search & Filter</h2>
            </div>
            <div className="flex gap-1 sm:gap-1.5 bg-muted/60 p-0.5 rounded-lg border border-border/50">
              <Button
                variant={viewMode === "list" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-xs gap-1.5"
                onClick={() => setViewMode("list")}
              >
                <List className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">List</span>
              </Button>
              <Button
                variant={viewMode === "kanban" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-xs gap-1.5"
                onClick={() => setViewMode("kanban")}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Kanban</span>
              </Button>
              <Button
                variant={viewMode === "calendar" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-xs gap-1.5"
                onClick={() => setViewMode("calendar")}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Calendar</span>
              </Button>
              <Button
                variant={viewMode === "table" ? "default" : "ghost"}
                size="sm"
                className="h-7 px-2.5 text-xs gap-1.5"
                onClick={() => setViewMode("table")}
              >
                <Table2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Table</span>
              </Button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap gap-2.5 items-stretch sm:items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Input
                placeholder="Search by order #, customer, item..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 pr-8"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full sm:w-auto h-9 text-xs"
            />

            {/* Stage Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="min-w-[130px] justify-between h-9 text-xs">
                  <span className="truncate">
                    {stageFilter ? `Stage: ${stageFilter}` : "All Stages"}
                  </span>
                  <SlidersHorizontal className="h-3.5 w-3.5 ml-2 opacity-50 shrink-0" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="w-56 max-h-[280px] overflow-y-auto">
                <DropdownMenuItem
                  onClick={() => setStageFilter(null)}
                  className={!stageFilter ? "font-semibold text-primary" : ""}
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
                  className="min-w-[130px] justify-between h-9 text-xs"
                >
                  <span className="truncate">
                    {vendorFilter ? `Vendor: ${vendorFilter}` : "All Vendors"}
                  </span>
                  <SlidersHorizontal className="h-3.5 w-3.5 ml-2 opacity-50 shrink-0" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="start" className="w-56 max-h-[280px] overflow-y-auto">
                <DropdownMenuItem
                  onClick={() => setVendorFilter(null)}
                  className={!vendorFilter ? "font-semibold text-primary" : ""}
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

            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full sm:w-auto">
              <TabsList className="grid grid-cols-3 w-full sm:w-auto h-9">
                <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                <TabsTrigger value="active" className="text-xs">Active</TabsTrigger>
                <TabsTrigger value="completed" className="text-xs">Completed</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Active Filters Pill Badges */}
        {(statusFilter !== "all" || quickFilter || stageFilter || vendorFilter || dateFilter || searchQuery) && (
          <div className="flex flex-wrap items-center gap-1.5 pt-3 mt-1 border-t border-border/40">
            <span className="text-xs text-muted-foreground mr-1">Active filters:</span>

            {searchQuery && (
              <Badge
                variant="secondary"
                className="cursor-pointer text-[11px] gap-1 hover:bg-muted"
                onClick={() => setSearchQuery("")}
              >
                Query: "{searchQuery}" <X className="h-3 w-3" />
              </Badge>
            )}

            {dateFilter && (
              <Badge
                variant="secondary"
                className="cursor-pointer text-[11px] gap-1 hover:bg-muted"
                onClick={() => setDateFilter("")}
              >
                Date: {dateFilter} <X className="h-3 w-3" />
              </Badge>
            )}

            {stageFilter && (
              <Badge
                variant="secondary"
                className="cursor-pointer text-[11px] gap-1 hover:bg-muted"
                onClick={() => setStageFilter(null)}
              >
                Stage: {stageFilter} <X className="h-3 w-3" />
              </Badge>
            )}

            {statusFilter !== "all" && (
              <Badge
                variant="secondary"
                className="cursor-pointer text-[11px] gap-1 hover:bg-muted"
                onClick={() => setStatusFilter("all")}
              >
                Status: {statusFilter} <X className="h-3 w-3" />
              </Badge>
            )}

            {quickFilter === "overdue" && (
              <Badge
                variant="destructive"
                className="cursor-pointer text-[11px] gap-1"
                onClick={() => setQuickFilter(null)}
              >
                Overdue <X className="h-3 w-3" />
              </Badge>
            )}

            {quickFilter === "dueSoon" && (
              <Badge
                variant="secondary"
                className="cursor-pointer text-[11px] gap-1 bg-amber-500/15 text-amber-800 border-amber-300 hover:bg-amber-500/25"
                onClick={() => setQuickFilter(null)}
              >
                Due Soon <X className="h-3 w-3" />
              </Badge>
            )}

            {vendorFilter && (
              <Badge
                variant="secondary"
                className="cursor-pointer text-[11px] gap-1 hover:bg-muted"
                onClick={() => setVendorFilter(null)}
              >
                Vendor: {vendorFilter} <X className="h-3 w-3" />
              </Badge>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-6 px-2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSearchQuery("");
                setDateFilter("");
                setStageFilter(null);
                setVendorFilter(null);
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
          <div className="flex items-center gap-2 mb-6">
            <Package className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">
              Orders ({filteredOrders.length})
            </h2>
          </div>

          {isLoading ? (
            <OrdersSkeleton />
          ) : filteredOrders.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground border rounded-xl border-dashed">
              No orders found matching your active filters.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredOrders.map((order: any) => {
                const currentStage = order.currentStage;

                return (
                  <Card
                    key={order.id}
                    className={`p-4 rounded-xl border-l-4 hover:shadow-md transition-all cursor-pointer ${
                      getCardClassName(order.order_status)
                    } ${
                      order.isOverdue
                        ? "border-destructive bg-destructive/5 ring-1 ring-destructive/30"
                        : ""
                    }`}
                    onClick={() => goToOrder(order.id)}
                    style={{
                      borderLeftColor: order.isOverdue
                        ? "hsl(var(--destructive))"
                        : order.order_status === "delivered"
                        ? "hsl(var(--success))"
                        : "hsl(var(--warning))",
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <h3 className="font-semibold text-base sm:text-lg leading-snug break-words">
                            #{order.order_code}
                          </h3>
                          <Badge
                            className={`${getStatusColor(
                              order.order_status
                            )} text-[10px] px-2 py-0.5`}
                          >
                            {order.order_status}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                            {currentStage}
                          </Badge>
                          {order.isOverdue && (
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
                          <p className="text-xs text-muted-foreground">
                            Ref: {order.metadata.reference_name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap justify-between text-sm text-muted-foreground">
                      <div className="flex flex-col">
                        <span className="text-[11px] uppercase tracking-wide">Customer</span>
                        <span className="font-semibold text-foreground">
                          {order.customerName || "-"}
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
                      <span>🗓️ {order.createdDateFormatted}</span>
                      <span>📦 {order.deliveryDateFormatted || "-"}</span>
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
                              className={`h-1.5 rounded-full flex-1 transition-colors ${
                                isCompleted ? "bg-success" : "bg-muted"
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

      {/* Kanban Board View — Clean & Accurate to Workshop Floor */}
      {viewMode === "kanban" && (
        <div ref={kanbanScrollRef} className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-max">
            {STAGES.map((stage) => {
              const stageOrders = ordersByStage[stage] || [];

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
                      <div className="space-y-2 p-1">
                        <Skeleton className="h-20 w-full rounded-lg" />
                        <Skeleton className="h-20 w-full rounded-lg" />
                      </div>
                    ) : stageOrders.length === 0 ? (
                      <div className="text-sm text-muted-foreground text-center py-4">
                        No orders in this stage
                      </div>
                    ) : (
                      stageOrders.map((order: any) => {
                        // Find the vendor assigned to this specific stage
                        const currentKanbanStageEntry = (order.order_stages || []).find(
                          (s: any) => s.stage_name === stage
                        );
                        const vendorName = currentKanbanStageEntry?.vendor_name;

                        return (
                          <Card
                            key={order.id}
                            className={`p-3 hover:shadow-md transition-all cursor-pointer ${getCardClassName(
                              order.order_status
                            )}`}
                            onClick={() => goToOrder(order.id)}
                          >
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
                                  <span className="font-medium">Customer:</span> {order.customerName || "-"}
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

      {/* Calendar View */}
      {viewMode === "calendar" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setAnchorDate((d) => addDays(d, -7))}
              >
                ← Prev Week
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  const d = new Date();
                  d.setHours(0, 0, 0, 0);
                  setAnchorDate(d);
                }}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => setAnchorDate((d) => addDays(d, 7))}
              >
                Next Week →
              </Button>
            </div>

            <div className="text-sm font-semibold flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-primary" />
              <span>
                {weekDates[0].toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                })}{" "}
                –{" "}
                {weekDates[6].toLocaleDateString("en-IN", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
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

      {/* Table View */}
      {viewMode === "table" && (
        <OrdersInvoiceTable
          groupedInvoices={ordersGroupedByInvoice}
          invoiceSortKey={invoiceSortKey}
          invoiceSortDirection={invoiceSortDirection}
          onChangeSort={handleInvoiceSortChange}
          isLoading={isLoading}
          onOrderClick={(orderId) => {
            goToOrder(orderId);
          }}
        />
      )}

      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) =>
          !open && setConfirmDialog({ open: false, orderId: "", action: "delivered" })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === "delivered"
                ? "Mark Order as Delivered?"
                : "Cancel Order?"}
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
              onClick={() =>
                updateOrderStatusMutation.mutate({
                  orderId: confirmDialog.orderId,
                  status: confirmDialog.action,
                })
              }
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}