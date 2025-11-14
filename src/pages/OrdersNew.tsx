import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, Package, TrendingUp, CheckCircle2, AlertCircle, Search, LayoutGrid, List, MoreVertical } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

const STAGES = [
  "Ordered",
  "Fabric",
  "Dyeing",
  "Polishing",
  "Embroidery",
  "Stitching",
  "Dangling / Jhalar",
  "Fall & beading",
  "Packed",
  "Dispatched",
  "Delivered"
];

export default function OrdersNew() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; orderId: string; action: "delivered" | "cancelled" }>({
    open: false,
    orderId: "",
    action: "delivered"
  });
  const queryClient = useQueryClient();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("orders")
        // add delivery date 
        .select(`
          *,
          customers(name),
          invoices(invoice_number),
          order_stages(stage_name, status)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Calculate stats
  const stats = {
    total: orders?.length || 0,
    active: orders?.filter((o: any) => !["delivered", "cancelled"].includes(o.order_status)).length || 0,
    completed: orders?.filter((o: any) => o.order_status === "delivered").length || 0,
    dueSoon: orders?.filter((o: any) => {
      // Calculate if order is due within 3 days
      return !["delivered", "cancelled"].includes(o.order_status);
    }).length || 0,
  };

  // Separate active and completed orders
  const activeOrders = orders?.filter((o: any) => !["delivered", "cancelled"].includes(o.order_status)) || [];
  const completedOrders = orders?.filter((o: any) => o.order_status === "delivered") || [];

  // Filter orders based on selected tab
  const filteredOrders = (statusFilter === "completed" ? completedOrders :
    statusFilter === "cancelled" ? orders?.filter((o: any) => o.order_status === "cancelled") :
      statusFilter === "active" ? activeOrders :
        orders)?.filter((order: any) => {
          const matchesSearch =
            order.order_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
            order.customers?.name.toLowerCase().includes(searchQuery.toLowerCase());

          const matchesDate = !dateFilter ||
            new Date(order.created_at).toISOString().split("T")[0] === dateFilter;

          return matchesSearch && matchesDate;
        });

  const getOrdersByStage = (stageName: string) => {
    // Only show active orders in kanban (exclude delivered orders)
    return activeOrders?.filter(order => {
      const latestStage = order.order_stages?.[order.order_stages.length - 1];
      const currentStageName = latestStage?.stage_name || "Ordered";
      return currentStageName === stageName;
    }) || [];
  };

  const getCurrentStage = (order: any) => {
    return order.order_stages?.[order.order_stages.length - 1]?.stage_name || "Ordered";
  };

  const getStatusVariant = (status: string) => {
    const variants: Record<string, "default" | "success" | "warning" | "info"> = {
      pending: "warning",
      processing: "info",
      ready: "info",
      dispatched: "info",
      delivered: "success",
      cancelled: "default",
    };
    return variants[status] || "default";
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

  // Update stage mutation for kanban drag/click
  const updateStageMutation = useMutation({
    mutationFn: async ({ orderId, newStage }: { orderId: string; newStage: string }) => {
      const currentStageIndex = STAGES.indexOf(getCurrentStage(orderId));
      const newStageIndex = STAGES.indexOf(newStage);

      if (newStageIndex <= currentStageIndex) {
        throw new Error("Cannot move to a previous stage");
      }

      // Mark all stages between current and new as done
      const stagesToComplete = STAGES.slice(currentStageIndex + 1, newStageIndex + 1);

      // If moving to Delivered, mark all stages including Delivered as done
      const isMovingToDelivered = newStage === "Delivered";

      // Insert all missing stages
      const stagesToInsert = stagesToComplete.map(stageName => ({
        order_id: orderId,
        stage_name: stageName,
        status: isMovingToDelivered ? "done" : (stageName === newStage ? "in_progress" : "done"),
        start_ts: new Date().toISOString(),
        end_ts: isMovingToDelivered ? new Date().toISOString() : (stageName === newStage ? null : new Date().toISOString()),
      }));

      if (stagesToInsert.length > 0) {
        const { error } = await (supabase as any).from("order_stages").insert(stagesToInsert);
        if (error) throw error;
      }

      // If the new stage is "Delivered", update order status
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
      toast.success("Order stage updated successfully!");
    },
    onError: () => {
      toast.error("Failed to update order stage");
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: "delivered" | "cancelled" }) => {
      // Update order status
      const { error: orderError } = await (supabase as any)
        .from("orders")
        .update({ order_status: status })
        .eq("id", orderId);
      if (orderError) throw orderError;

      // If marking as delivered, mark all stages as done
      if (status === "delivered") {
        // Get all existing stages for this order
        const { data: existingStages } = await (supabase as any)
          .from("order_stages")
          .select("stage_name")
          .eq("order_id", orderId);

        const existingStageNames = existingStages?.map((s: any) => s.stage_name) || [];

        // Mark all existing stages as done
        const { error: updateError } = await (supabase as any)
          .from("order_stages")
          .update({
            status: "done",
            end_ts: new Date().toISOString()
          })
          .eq("order_id", orderId)
          .neq("status", "done");
        if (updateError) throw updateError;

        // Insert any missing stages as done
        const missingStages = STAGES.filter(stage => !existingStageNames.includes(stage));
        if (missingStages.length > 0) {
          const stagesToInsert = missingStages.map(stageName => ({
            order_id: orderId,
            stage_name: stageName,
            status: "done",
            start_ts: new Date().toISOString(),
            end_ts: new Date().toISOString(),
          }));
          const { error: insertError } = await (supabase as any).from("order_stages").insert(stagesToInsert);
          if (insertError) throw insertError;
        }
      }
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Order marked as ${status === "delivered" ? "delivered" : "cancelled"}!`);
      setConfirmDialog({ open: false, orderId: "", action: "delivered" });
    },
    onError: () => {
      toast.error("Failed to update order status");
    },
  });

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

        <Card className="p-6">
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

        <Card className="p-6">
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

        <Card className="p-6">
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
                <List className="h-4 w-4 mr-2" />
                List
              </Button>
              <Button
                variant={viewMode === "kanban" ? "default" : "outline"}
                size="sm"
                onClick={() => setViewMode("kanban")}
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                Kanban
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

            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full md:w-auto">
              <TabsList className="grid grid-cols-4 w-full md:w-auto">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </Card>

      {/* Orders View */}
      {viewMode === "list" ? (
        <Card className="p-4 md:p-6">
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
                const daysOld = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

                return (
                  // this is the start of order card
                  <Card
                    key={order.id}
                    className={`p-4 rounded-xl border-l-4 hover:shadow-md transition-all ${getCardClassName(order.order_status)}`}
                    style={{
                      borderLeftColor:
                        order.order_status === "delivered"
                          ? "hsl(var(--success))"
                          : "hsl(var(--warning))",
                    }}
                  >
                    {/* --- Top Row --- */}
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center flex-wrap gap-2">
                          <h3 className="font-semibold text-base sm:text-lg">#{order.order_code}</h3>
                          <Badge
                            className={`${getStatusColor(order.order_status)} text-[10px] px-2 py-0.5`}
                          >
                            {order.order_status}
                          </Badge>
                          <Badge variant="outline" className="text-[10px] px-2 py-0.5">
                            {currentStage}
                          </Badge>
                        </div>

                        <p className="text-sm font-medium text-foreground truncate">
                          {order.metadata?.item_name || "Order Item"}
                        </p>
                        {order.metadata?.reference_name && (
                          <p className="text-xs text-muted-foreground">Ref: {order.metadata.reference_name}</p>
                        )}
                      </div>

                      <DropdownMenu>
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
                      </DropdownMenu>
                    </div>

                    {/* --- Compact Info Row --- */}
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

                    {/* --- Date Row --- */}
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

                    {/* --- Progress Indicator --- */}
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

                  // this is the end of order card
                );
              })}
            </div>
          )}
        </Card>
      ) : (
        <div className="overflow-x-auto pb-4">
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
                        // get vendor name
                        const currentKanbanStageEntry = order.order_stages?.find((s: any) => s.stage_name === stage);
                        const vendorName = currentKanbanStageEntry?.vendor_name;

                        return (
                          <Card key={order.id} className={`p-3 hover:shadow-md transition-shadow ${getCardClassName(order.order_status)}`}>
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

                              {/* DISPLAY VENDOR NAME using the stage entry */}
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

                              <div className="flex gap-1">
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
