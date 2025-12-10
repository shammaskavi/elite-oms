// src/pages/OrderDetailNew.tsx  (or wherever you keep it)
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { ArrowLeft, ChevronDown, Trash2 } from "lucide-react";
import { OrderTimeline } from "@/components/OrderTimeline";

export default function OrderDetailNew() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; action: "delivered" | "cancelled" | "delete" }>({ open: false, action: "delivered" });
    const queryClient = useQueryClient();

    // --- get current order by id ---
    const { data: currentOrder } = useQuery({
        queryKey: ["order", id],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("orders")
                .select("*")
                .eq("id", id)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    // --- invoice (by order id) --- new 
    const { data: invoice } = useQuery({
        queryKey: ["invoice-by-order", currentOrder?.invoice_id],
        queryFn: async () => {
            if (!currentOrder?.invoice_id) return null;

            const { data, error } = await (supabase as any)
                .from("invoices")
                .select("*, customers(name)")
                .eq("id", currentOrder.invoice_id)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!currentOrder?.invoice_id,
    });
    // --- invoice (by order id) --- old 
    // const { data: invoice } = useQuery({
    //     queryKey: ["invoice-by-order", id],
    //     queryFn: async () => {
    //         const { data: order } = await (supabase as any)
    //             .from("orders")
    //             .select("invoice_id")
    //             .eq("id", id)
    //             .single();

    //         if (!order?.invoice_id) return null;

    //         const { data, error } = await (supabase as any)
    //             .from("invoices")
    //             .select("*, customers(name)")
    //             .eq("id", order.invoice_id)
    //             .single();
    //         if (error) throw error;
    //         return data;
    //     },
    // });

    // --- orders for invoice --- old 
    // const { data: orders } = useQuery({
    //     queryKey: ["invoice-orders", invoice?.id],
    //     queryFn: async () => {
    //         if (!invoice?.id) return [];
    //         const { data, error } = await (supabase as any)
    //             .from("orders")
    //             .select("*")
    //             .eq("invoice_id", invoice.id)
    //             .order("created_at", { ascending: true });
    //         if (error) throw error;
    //         return data;
    //     },
    //     enabled: !!invoice?.id,
    // });

    // --- orders for invoice --- new 
    // --- orders for this page (just the current order) ---
    const orders = currentOrder ? [currentOrder] : [];

    // --- all order_stages for these orders ---
    // const { data: allStages } = useQuery({
    //     queryKey: ["all-order-stages", invoice?.id],
    //     queryFn: async () => {
    //         if (!invoice?.id || !orders) return [];
    //         const orderIds = orders.map((o: any) => o.id);
    //         const { data, error } = await (supabase as any)
    //             .from("order_stages")
    //             .select("*")
    //             .in("order_id", orderIds)
    //             .order("created_at", { ascending: true });
    //         if (error) throw error;
    //         return data;
    //     },
    //     enabled: !!invoice?.id && !!orders,
    // });
    // --- order_stages for this single order ---
    // --- order_stages for this single order ---
    const { data: allStages } = useQuery({
        queryKey: ["order-stages", id],
        queryFn: async () => {
            if (!id) return [];
            const { data, error } = await (supabase as any)
                .from("order_stages")
                .select("*")
                .eq("order_id", id)
                .order("created_at", { ascending: true });

            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    // --- NEW: fetch canonical workflow stages from DB (ordered by order_index) ---
    const { data: stagesList } = useQuery({
        queryKey: ["workflow-stages"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("stages")
                .select("*")
                .order("order_index", { ascending: true });
            if (error) throw error;
            return data || [];
        },
    });

    // Real-time subscriptions (same as before)
    useEffect(() => {
        if (!invoice?.id || !orders) return;

        const orderIds = orders.map(o => o.id);

        const ordersChannel = supabase
            .channel('orders-detail-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'orders',
                    filter: `id=in.(${orderIds.join(',')})`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["invoice-orders"] });
                }
            )
            .subscribe();

        const stagesChannel = supabase
            .channel('stages-detail-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'order_stages',
                    filter: `order_id=in.(${orderIds.join(',')})`
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ["all-order-stages"] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(ordersChannel);
            supabase.removeChannel(stagesChannel);
        };
    }, [invoice?.id, orders, queryClient]);

    // --- update status / delete logic unchanged, except we keep using DB stages for missing stage inserts ---
    const updateOrderStatusMutation = useMutation({
        mutationFn: async (status: "delivered" | "cancelled") => {
            if (!orders) return;

            for (const order of orders) {
                const { error: orderError } = await (supabase as any)
                    .from("orders")
                    .update({ order_status: status })
                    .eq("id", order.id);
                if (orderError) throw orderError;

                if (status === "delivered") {
                    const { data: existingStages } = await (supabase as any)
                        .from("order_stages")
                        .select("stage_name")
                        .eq("order_id", order.id);

                    const existingStageNames = existingStages?.map((s: any) => s.stage_name) || [];

                    const { error: updateError } = await (supabase as any)
                        .from("order_stages")
                        .update({
                            status: "done",
                            end_ts: new Date().toISOString()
                        })
                        .eq("order_id", order.id)
                        .neq("status", "done");
                    if (updateError) throw updateError;

                    // Use stagesList from DB (if available) otherwise fall back to previous hardcoded set
                    const canonicalStageNames = (stagesList || []).map((s: any) => s.name);
                    const fallback = ["Fabric", "Dyeing", "Polishing", "Embroidery", "Stitching", "Dangling / Jhalar", "Fall & Beading", "Packed", "Dispatched", "Delivered"];
                    const referenceStages = canonicalStageNames.length ? canonicalStageNames : fallback;

                    const missingStages = referenceStages.filter(stage => !existingStageNames.includes(stage));
                    if (missingStages.length > 0) {
                        const stagesToInsert = missingStages.map(stageName => ({
                            order_id: order.id,
                            stage_name: stageName,
                            status: "done",
                            start_ts: new Date().toISOString(),
                            end_ts: new Date().toISOString(),
                        }));
                        const { error: insertError } = await (supabase as any).from("order_stages").insert(stagesToInsert);
                        if (insertError) throw insertError;
                    }
                }
            }
        },
        onSuccess: (_, status) => {
            queryClient.invalidateQueries({ queryKey: ["all-order-stages"] });
            queryClient.invalidateQueries({ queryKey: ["invoice-orders"] });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            toast.success(`All orders marked as ${status === "delivered" ? "delivered" : "cancelled"}!`);
            setConfirmDialog({ open: false, action: "delivered" });
        },
        onError: () => {
            toast.error("Failed to update order status");
        },
    });

    const deleteAllOrdersMutation = useMutation({
        mutationFn: async () => {
            if (!orders) return;

            for (const order of orders) {
                const { error: stagesError } = await (supabase as any)
                    .from("order_stages")
                    .delete()
                    .eq("order_id", order.id);

                if (stagesError) throw stagesError;

                const { error } = await (supabase as any)
                    .from("orders")
                    .delete()
                    .eq("id", order.id);

                if (error) throw error;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            toast.success("All orders deleted successfully");
            navigate("/orders");
        },
        onError: (error: any) => {
            toast.error(error.message || "Failed to delete orders. You may not have permission.");
            console.error("Delete error:", error);
        },
    });

    const getStatusVariant = (status: string) => {
        switch (status) {
            case "delivered":
                return "success";
            case "cancelled":
                return "destructive";
            case "processing":
                return "warning";
            default:
                return "default";
        }
    };

    const mainOrder = orders?.[0];

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={() => navigate("/orders")}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Orders jao bhai
                </Button>
                {/* <div className="flex gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline">
                                Change Status <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setConfirmDialog({ open: true, action: "delivered" })}>
                                Mark All as Delivered
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setConfirmDialog({ open: true, action: "cancelled" })}>
                                Mark All as Cancelled
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setConfirmDialog({ open: true, action: "delete" })}
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete All Orders
                    </Button>
                </div> */}
            </div>

            <div>
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-bold">Invoice: {invoice?.invoice_number}</h1>
                    {mainOrder && (
                        <Badge variant={getStatusVariant(mainOrder.order_status)} className="text-sm">
                            {mainOrder.order_status}
                        </Badge>
                    )}
                </div>
                <p className="text-muted-foreground mt-1">
                    Created on {invoice?.date ? new Date(invoice.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6">
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Customer</p>
                        <p className="font-medium">{invoice?.customers?.name}</p>
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Total Products</p>
                        <p className="font-medium text-2xl">
                            {orders?.reduce((sum, order) => sum + parseInt(order.metadata?.num_products || 1), 0) || 0}
                        </p>
                    </div>
                </Card>
                <Card className="p-6">
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">Total Amount</p>
                        <p className="font-medium text-2xl">₹{invoice?.total}</p>
                    </div>
                </Card>
            </div>

            <div className="space-y-4">
                <h2 className="text-xl font-semibold">Product Timelines</h2>
                <p className="text-sm text-muted-foreground">
                    Track the progress of each product individually. Click on the timeline name to customize it.
                </p>
                <div className={`grid gap-4 ${(() => {
                    const totalTimelines = orders?.reduce((sum, order) => {
                        return sum + parseInt(order.metadata?.num_products || 1);
                    }, 0) || 0;
                    return totalTimelines > 3 ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1';
                })()}`}>
                    {orders?.map((order) => {
                        const orderStages = allStages?.filter((s: any) => s.order_id === order.id) || [];
                        const numProducts = parseInt(order.metadata?.num_products || 1);

                        // Create timeline for each product
                        const productTimelines = [];
                        for (let i = 1; i <= numProducts; i++) {
                            const productStages = orderStages.filter(
                                (s: any) => s.metadata?.product_number === i
                            );
                            const itemName = order.metadata?.item_name || "Order Item";
                            const displayName = numProducts > 1 ? `${itemName} - Product ${i}` : itemName;

                            productTimelines.push(
                                <OrderTimeline
                                    key={`${order.id}-${i}`}
                                    order={order}
                                    stages={productStages}
                                    stagesList={stagesList || []}     // <-- pass DB stages here
                                    productNumber={i}
                                    productName={displayName}
                                    onStageUpdate={() => {
                                        queryClient.invalidateQueries({ queryKey: ["all-order-stages"] });
                                        queryClient.invalidateQueries({ queryKey: ["invoice-orders"] });
                                    }}
                                />
                            );
                        }
                        return productTimelines;
                    })}
                </div>
            </div>

            <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, action: "delivered" })}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {confirmDialog.action === "delivered"
                                ? "Mark All Orders as Delivered?"
                                : confirmDialog.action === "cancelled"
                                    ? "Cancel All Orders?"
                                    : "Delete All Orders?"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {confirmDialog.action === "delivered"
                                ? "This will mark all orders in this invoice as delivered and complete all their stages."
                                : confirmDialog.action === "cancelled"
                                    ? "This will cancel all orders in this invoice. This action can be reversed by changing the order status again."
                                    : "This will permanently delete all orders and their stages from this invoice. This action cannot be undone."}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                if (confirmDialog.action === "delete") {
                                    deleteAllOrdersMutation.mutate();
                                } else {
                                    updateOrderStatusMutation.mutate(confirmDialog.action);
                                }
                            }}
                        >
                            Confirm
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}