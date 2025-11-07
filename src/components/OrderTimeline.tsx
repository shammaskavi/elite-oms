import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { CheckCircle2, Edit2, ArrowRight, StickyNote, ChevronDown, ChevronUp } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { OrderSummary } from "./OrderSummary";
import { ActivityLog } from "./ActivityLog";

const STAGES = [
    "Ordered",
    "Dyeing",
    "Polishing",
    "Embroidery",
    "Stitching",
    "Dangling",
    "Inward",
    "Packed",
    "Dispatched",
    "Delivered",
];

interface OrderTimelineProps {
    order: any;
    stages: any[];
    productNumber?: number;
    productName?: string;
    onStageUpdate?: () => void;
}

export function OrderTimeline({ order, stages, productNumber, productName, onStageUpdate }: OrderTimelineProps) {
    const [open, setOpen] = useState(false);
    const [editingName, setEditingName] = useState(false);
    const [editingNotes, setEditingNotes] = useState(false);
    const [activityLogOpen, setActivityLogOpen] = useState(true);

    const defaultName = productName || order.metadata?.timeline_name || order.metadata?.item_name || `Timeline ${order.order_code}`;
    const [timelineName, setTimelineName] = useState(defaultName);
    const [productNotes, setProductNotes] = useState(order.metadata?.product_notes?.[productNumber || 0] || "");

    // Update local state when order data changes
    React.useEffect(() => {
        if (order.metadata?.timeline_name) {
            setTimelineName(order.metadata.timeline_name);
        }
        if (order.metadata?.product_notes?.[productNumber || 0]) {
            setProductNotes(order.metadata.product_notes[productNumber || 0]);
        }
    }, [order.metadata, productNumber]);
    const [stageData, setStageData] = useState({
        stage_name: "",
        vendor_name: "",
        assigned_employee: "",
        notes: "",
        start_ts: new Date().toISOString().split("T")[0],
    });
    const queryClient = useQueryClient();

    const updateTimelineNameMutation = useMutation({
        mutationFn: async (name: string) => {
            const { error } = await (supabase as any)
                .from("orders")
                .update({
                    metadata: {
                        ...order.metadata,
                        timeline_name: name
                    }
                })
                .eq("id", order.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["order", order.id] });
            setEditingName(false);
            toast.success("Timeline name updated");
            onStageUpdate?.();
        },
    });

    const updateProductNotesMutation = useMutation({
        mutationFn: async (notes: string) => {
            const currentProductNotes = order.metadata?.product_notes || {};
            const { error } = await (supabase as any)
                .from("orders")
                .update({
                    metadata: {
                        ...order.metadata,
                        product_notes: {
                            ...currentProductNotes,
                            [productNumber || 0]: notes
                        }
                    }
                })
                .eq("id", order.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["order", order.id] });
            setEditingNotes(false);
            toast.success("Product notes updated");
            onStageUpdate?.();
        },
    });

    const createStageMutation = useMutation({
        mutationFn: async (data: any) => {
            const { error } = await (supabase as any).from("order_stages").insert([{
                order_id: order.id,
                stage_name: data.stage_name,
                vendor_name: data.vendor_name || null,
                assigned_employee: data.assigned_employee || null,
                notes: data.notes || null,
                start_ts: data.start_ts,
                status: "in_progress",
                metadata: {
                    product_number: productNumber,
                    product_name: productName,
                }
            }]);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["order-stages", order.id] });
            toast.success("Stage started");
            setOpen(false);
            setStageData({
                stage_name: "",
                vendor_name: "",
                assigned_employee: "",
                notes: "",
                start_ts: new Date().toISOString().split("T")[0],
            });
            onStageUpdate?.();
        },
    });

    const completeStageMutation = useMutation({
        mutationFn: async (stageId: string) => {
            const { data: stage } = await (supabase as any)
                .from("order_stages")
                .select("*")
                .eq("id", stageId)
                .single();

            const { error } = await (supabase as any)
                .from("order_stages")
                .update({
                    status: "done",
                    end_ts: new Date().toISOString(),
                })
                .eq("id", stageId);
            if (error) throw error;

            if (stage?.stage_name === "Delivered") {
                const { error: orderError } = await (supabase as any)
                    .from("orders")
                    .update({ order_status: "delivered" })
                    .eq("id", order.id);
                if (orderError) throw orderError;
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["order-stages", order.id] });
            queryClient.invalidateQueries({ queryKey: ["order", order.id] });
            toast.success("Stage completed");
            onStageUpdate?.();
        },
    });

    const moveToNextStageMutation = useMutation({
        mutationFn: async () => {
            const currentStageObj = stages?.find((s) => s.status === "in_progress");
            if (!currentStageObj) throw new Error("No active stage found");

            const currentIndex = STAGES.indexOf(currentStageObj.stage_name);
            if (currentIndex === -1 || currentIndex >= STAGES.length - 1) {
                throw new Error("Already at final stage");
            }

            const nextStageName = STAGES[currentIndex + 1];

            // Complete current stage
            await (supabase as any)
                .from("order_stages")
                .update({
                    status: "done",
                    end_ts: new Date().toISOString(),
                })
                .eq("id", currentStageObj.id);

            // Start next stage
            await (supabase as any).from("order_stages").insert([{
                order_id: order.id,
                stage_name: nextStageName,
                start_ts: new Date().toISOString(),
                status: "in_progress",
                metadata: {
                    product_number: productNumber,
                    product_name: productName,
                }
            }]);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["order-stages", order.id] });
            queryClient.invalidateQueries({ queryKey: ["order", order.id] });
            toast.success("Moved to next stage");
            onStageUpdate?.();
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        createStageMutation.mutate(stageData);
    };


    const completedStages = stages?.filter(s => s.status === "done").map(s => s.stage_name) || [];
    const availableStages = STAGES.filter(s => !completedStages.includes(s));
    const currentStage = stages?.find((s) => s.status === "in_progress");
    const hasNextStage = currentStage && STAGES.indexOf(currentStage.stage_name) < STAGES.length - 1;

    return (
        <Card className="p-6">
            {/* Stage Summary with Product Title */}
            <div className="mb-4">
                <OrderSummary
                    order={order}
                    stages={stages || []}
                    totalStages={STAGES.length}
                    timelineName={timelineName}
                    editingName={editingName}
                    onNameChange={setTimelineName}
                    onStartEdit={() => setEditingName(true)}
                    onSaveName={() => updateTimelineNameMutation.mutate(timelineName)}
                    onCancelEdit={() => {
                        setEditingName(false);
                        setTimelineName(defaultName);
                    }}
                />
            </div>

            {/* Quick Actions */}
            <div className="flex justify-end gap-2 mb-6">
                {hasNextStage && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => moveToNextStageMutation.mutate()}
                    >
                        <ArrowRight className="h-4 w-4 mr-1" />
                        Next Stage
                    </Button>
                )}
                {currentStage && (
                    <Button
                        size="sm"
                        onClick={() => completeStageMutation.mutate(currentStage.id)}
                    >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Mark Complete
                    </Button>
                )}
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm">
                            <StickyNote className="h-4 w-4 mr-1" />
                            Add Stage
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Start New Stage</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <Label htmlFor="stage_name">Stage *</Label>
                                <select
                                    id="stage_name"
                                    value={stageData.stage_name}
                                    onChange={(e) => setStageData({ ...stageData, stage_name: e.target.value })}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                                    required
                                >
                                    <option value="">Select a stage...</option>
                                    {availableStages.map(stage => (
                                        <option key={stage} value={stage}>{stage}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label htmlFor="vendor_name">Vendor Name</Label>
                                <Input
                                    id="vendor_name"
                                    value={stageData.vendor_name}
                                    onChange={(e) => setStageData({ ...stageData, vendor_name: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="assigned_employee">Assigned Employee</Label>
                                <Input
                                    id="assigned_employee"
                                    value={stageData.assigned_employee}
                                    onChange={(e) => setStageData({ ...stageData, assigned_employee: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="start_ts">Start Date</Label>
                                <Input
                                    id="start_ts"
                                    type="date"
                                    value={stageData.start_ts}
                                    onChange={(e) => setStageData({ ...stageData, start_ts: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label htmlFor="notes">Notes</Label>
                                <Textarea
                                    id="notes"
                                    value={stageData.notes}
                                    onChange={(e) => setStageData({ ...stageData, notes: e.target.value })}
                                />
                            </div>
                            <Button type="submit" className="w-full">
                                Start Stage
                            </Button>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Product Notes Section */}
            <div className="mb-4">
                <div className="p-4 bg-muted/30 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <Label className="text-sm font-medium">Product Notes</Label>
                        {!editingNotes && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingNotes(true)}
                                className="h-7 text-xs"
                            >
                                <Edit2 className="h-3 w-3 mr-1" />
                                Edit
                            </Button>
                        )}
                    </div>
                    {!editingNotes ? (
                        <p className="text-sm text-muted-foreground">
                            {productNotes || "No notes added yet. Click Edit to add notes about this product."}
                        </p>
                    ) : (
                        <div className="space-y-2">
                            <Textarea
                                value={productNotes}
                                onChange={(e) => setProductNotes(e.target.value)}
                                placeholder="Add notes about this product..."
                                className="min-h-[80px]"
                                autoFocus
                            />
                            <div className="flex gap-2">
                                <Button
                                    size="sm"
                                    onClick={() => updateProductNotesMutation.mutate(productNotes)}
                                >
                                    Save Notes
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setEditingNotes(false);
                                        setProductNotes(order.metadata?.product_notes?.[productNumber || 0] || "");
                                    }}
                                >
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Collapsible Activity Log */}
            <Collapsible open={activityLogOpen} onOpenChange={setActivityLogOpen}>
                <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-semibold">Activity Log</h4>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            {activityLogOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                    <ActivityLog orderId={order.id} productNumber={productNumber} />
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}
