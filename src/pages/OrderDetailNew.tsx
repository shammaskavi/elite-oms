// src/pages/OrderDetailNew.tsx  (or wherever you keep it)
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
import { ArrowLeft, ChevronDown, Trash2, MessageSquare, Send, Copy, Calendar } from "lucide-react";
import { OrderTimeline } from "@/components/OrderTimeline";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { buildStageNotificationMessage, openWhatsApp, ensureInvoiceTrackingToken } from "@/lib/whatsapp";

export default function OrderDetailNew() {
    const { id } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const navState = location.state as any;

    const returnTo = navState?.returnTo;
    const openInvoiceId = navState?.openInvoiceId;
    const ordersView = navState?.ordersView;
    const anchorDate = navState?.anchorDate;
    // const returnTo = location.state?.returnTo as string | undefined;
    // const openInvoiceId = location.state?.openInvoiceId as string | undefined;

    const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; action: "delivered" | "cancelled" | "delete" }>({ open: false, action: "delivered" });
    const [rescheduleOpen, setRescheduleOpen] = useState(false);
    const [newDeliveryDate, setNewDeliveryDate] = useState("");
    const [headerWaOpen, setHeaderWaOpen] = useState(false);
    const [headerWaStage, setHeaderWaStage] = useState("Packed");
    const [headerWaMessage, setHeaderWaMessage] = useState("");
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
                .select("*, customers(id, name, phone, address)")
                .eq("id", currentOrder.invoice_id)
                .single();

            if (error) throw error;
            return data;
        },
        enabled: !!currentOrder?.invoice_id,
    });

    const openHeaderWhatsApp = async (stageTarget: string) => {
        try {
            let token = invoice?.tracking_token;
            if (!token && invoice?.id) {
                try {
                    token = await ensureInvoiceTrackingToken(invoice.id);
                } catch (e) {
                    console.warn("Could not ensure tracking token:", e);
                }
            }
            const trackingUrl = token ? `${window.location.origin}/track/${token}` : undefined;

            const customerName = invoice?.customers?.name || currentOrder?.metadata?.customer_name || "Customer";
            const invoiceNumber = invoice?.invoice_number;
            const itemName = currentOrder?.metadata?.item_name || "Custom Garment";
            const isSettled = invoice?.settled === true;
            const balanceDue = isSettled ? 0 : (parseFloat(String(invoice?.total ?? 0)) || 0);

            const msg = buildStageNotificationMessage({
                stage: stageTarget,
                customerName,
                invoiceNumber,
                itemName,
                balanceDue,
                isSettled,
                trackingUrl,
            });

            setHeaderWaStage(stageTarget);
            setHeaderWaMessage(msg);
            setHeaderWaOpen(true);
        } catch (err) {
            console.error("Failed to prepare WhatsApp message", err);
        }
    };
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
            .channel(`orders-detail-${invoice.id}`)
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
            .channel(`stages-detail-${invoice.id}`)
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

            if (status === "delivered") {
                openHeaderWhatsApp("Delivered");
            }
        },
        onError: () => {
            toast.error("Failed to update order status");
        },
    });

    const rescheduleDeliveryMutation = useMutation({
        mutationFn: async () => {
            if (!id || !newDeliveryDate) return;

            const { error } = await (supabase as any)
                .from("orders")
                .update({
                    metadata: {
                        ...currentOrder?.metadata,
                        delivery_date: newDeliveryDate,
                    },
                })
                .eq("id", id);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["order", id] });
            queryClient.invalidateQueries({ queryKey: ["calendar-items"] });
            toast.success("Delivery date updated");
            setRescheduleOpen(false);
        },
        onError: () => {
            toast.error("Failed to update delivery date");
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
        <div className="space-y-6 p-3 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-9"
                    onClick={() => {
                        if (!returnTo) {
                            navigate(-1);
                            return;
                        }
                        navigate(returnTo, {
                            state: { openInvoiceId, ordersView, anchorDate },
                        });
                    }}
                >
                    ← Back
                </Button>

                <div className="flex flex-wrap items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-9 text-xs sm:text-sm text-emerald-600 border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                            >
                                <MessageSquare className="mr-1.5 h-4 w-4 text-emerald-600" />
                                <span className="hidden sm:inline">Notify Customer</span>
                                <span className="sm:hidden">Notify</span>
                                <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-60" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem onClick={() => openHeaderWhatsApp("Packed")}>
                                🛍️ Packed & Ready for Pickup
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openHeaderWhatsApp("Dispatched")}>
                                🚚 Dispatched for Delivery
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openHeaderWhatsApp("Delivered")}>
                                🎉 Delivered Successfully
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        variant="outline"
                        size="sm"
                        className="h-9 text-xs sm:text-sm"
                        onClick={() => {
                            setNewDeliveryDate(currentOrder?.metadata?.delivery_date || "");
                            setRescheduleOpen(true);
                        }}
                    >
                        <Calendar className="mr-1.5 h-4 w-4" />
                        <span className="hidden sm:inline">Change delivery date</span>
                        <span className="sm:hidden">Reschedule</span>
                    </Button>
                </div>
            </div>

            <div>
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h1 className="text-2xl sm:text-3xl font-bold truncate">Invoice: {invoice?.invoice_number}</h1>
                    {mainOrder && (
                        <Badge variant={getStatusVariant(mainOrder.order_status)} className="text-xs sm:text-sm">
                            {mainOrder.order_status}
                        </Badge>
                    )}
                </div>
                <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
                    Created on {invoice?.date ? new Date(invoice.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
                <Card className="p-4 sm:p-6">
                    <div className="space-y-1 sm:space-y-2">
                        <p className="text-xs sm:text-sm text-muted-foreground">Customer</p>
                        <p className="font-medium text-sm sm:text-base truncate">{invoice?.customers?.name || "-"}</p>
                    </div>
                </Card>
                <Card className="p-4 sm:p-6">
                    <div className="space-y-1 sm:space-y-2">
                        <p className="text-xs sm:text-sm text-muted-foreground">Total Products</p>
                        <p className="font-medium text-xl sm:text-2xl">
                            {orders?.reduce((sum, order) => sum + parseInt(order.metadata?.num_products || 1), 0) || 0}
                        </p>
                    </div>
                </Card>
                <Card className="p-4 sm:p-6">
                    <div className="space-y-1 sm:space-y-2">
                        <p className="text-xs sm:text-sm text-muted-foreground">Total Amount</p>
                        <p className="font-medium text-xl sm:text-2xl">₹{invoice?.total}</p>
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
                                    invoice={invoice}
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

            <AlertDialog open={rescheduleOpen} onOpenChange={setRescheduleOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Change delivery date</AlertDialogTitle>
                        <AlertDialogDescription>
                            Update the delivery date for this order. This will reflect everywhere in the system.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <input
                        type="date"
                        className="border rounded-md px-3 py-2 text-sm"
                        value={newDeliveryDate}
                        onChange={(e) => setNewDeliveryDate(e.target.value)}
                    />

                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => rescheduleDeliveryMutation.mutate()}
                            disabled={!newDeliveryDate}
                        >
                            Save
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Header WhatsApp Notification Modal */}
            <Dialog open={headerWaOpen} onOpenChange={setHeaderWaOpen}>
                <DialogContent className="max-w-[95vw] sm:max-w-lg w-full max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <MessageSquare className="h-5 w-5 text-emerald-600" />
                            Notify Customer: {headerWaStage}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 pt-2">
                        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg text-sm">
                            <div>
                                <p className="text-muted-foreground text-xs">Customer</p>
                                <p className="font-semibold text-sm">{invoice?.customers?.name || "Customer"}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-muted-foreground text-xs">Phone</p>
                                <p className="font-medium text-xs">
                                    {invoice?.customers?.phone ? (
                                        <span className="text-foreground">{invoice.customers.phone}</span>
                                    ) : (
                                        <span className="text-destructive font-semibold">No phone number</span>
                                    )}
                                </p>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-1.5">
                                <Label>WhatsApp Message Preview</Label>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-xs text-muted-foreground hover:text-foreground"
                                    onClick={() => {
                                        navigator.clipboard.writeText(headerWaMessage);
                                        toast.success("Message copied to clipboard");
                                    }}
                                >
                                    <Copy className="h-3.5 w-3.5 mr-1" /> Copy Text
                                </Button>
                            </div>
                            <Textarea
                                value={headerWaMessage}
                                onChange={(e) => setHeaderWaMessage(e.target.value)}
                                rows={8}
                                className="text-xs font-mono bg-muted/20"
                            />
                            <p className="text-[11px] text-muted-foreground mt-1">
                                You can customize this message before sending.
                            </p>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => setHeaderWaOpen(false)}
                            >
                                Skip / Close
                            </Button>
                            <Button
                                onClick={() => {
                                    const phone = invoice?.customers?.phone;
                                    if (!phone) {
                                        toast.error("Customer phone number is missing.");
                                        return;
                                    }
                                    try {
                                        openWhatsApp(phone, headerWaMessage);
                                        toast.success("Opened in WhatsApp!");
                                        setHeaderWaOpen(false);
                                    } catch (err: any) {
                                        toast.error(err.message || "Failed to open WhatsApp");
                                    }
                                }}
                                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={!invoice?.customers?.phone}
                            >
                                <Send className="mr-2 h-4 w-4" />
                                Send via WhatsApp
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}