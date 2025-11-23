import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogHeader,
    DialogTitle,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { CheckCircle2, MoveRight, Loader2, Edit2, Info } from "lucide-react";
import { ActivityLog } from "./ActivityLog";

/**
 * OrderTimeline (DB-driven)
 *
 * - Uses `stages` table (id, name, order_index, active)
 * - Uses `vendors` table (id, name, stage_id, active)
 * - Only allows moving forward in the canonical stage order (no backward moves)
 *
 * Props:
 * - order: order row
 * - stages: order_stages rows for this product (array)
 * - stagesList: optional array of stage rows passed from parent (prefer parent to fetch all stages)
 * - productNumber, productName
 * - onStageUpdate callback
 */

export function OrderTimeline({ order, stages, stagesList = [], productNumber, productName, onStageUpdate }: any) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [selectedStage, setSelectedStage] = useState("");
    const [selectedVendor, setSelectedVendor] = useState("");
    const [editingNotes, setEditingNotes] = useState(false);
    const [productNotes, setProductNotes] = useState(
        order.metadata?.product_notes?.[productNumber || 0] || ""
    );

    useEffect(() => {
        setProductNotes(order.metadata?.product_notes?.[productNumber || 0] || "");
    }, [order.metadata, productNumber]);

    // Fetch canonical stages from DB if parent didn't pass them
    const { data: stagesFromDb = [], isLoading: stagesLoading } = useQuery({
        queryKey: ["stages-list"],
        queryFn: async () => {
            // select active stages ordered by order_index
            const { data, error } = await supabase
                .from("stages")
                .select("*")
                .order("order_index", { ascending: true });
            if (error) throw error;
            return data || [];
        },
        enabled: stagesList.length === 0, // only if parent didn't provide
    });

    // Use parent stagesList if provided, otherwise DB result
    const canonicalStageRows = (stagesList && stagesList.length > 0) ? stagesList.slice().sort((a: any, b: any) => {
        return Number(a.order_index ?? 0) - Number(b.order_index ?? 0);
    }) : (stagesFromDb || []).slice().sort((a: any, b: any) => {
        return Number(a.order_index ?? 0) - Number(b.order_index ?? 0);
    });

    // Map of stage name -> order_index for quick lookups
    const stageOrderIndexMap: Record<string, number> = {};
    canonicalStageRows.forEach((s: any) => {
        stageOrderIndexMap[s.name] = Number(s.order_index ?? 0);
    });

    const canonicalStages = canonicalStageRows.map((s: any) => s.name);

    // current & completed for this product (these come from order_stages rows passed as 'stages' prop)
    const currentStage = (stages || []).find((s: any) => s.status === "in_progress");
    const completedStages = (stages || []).filter((s: any) => s.status === "done").map((s: any) => s.stage_name) || [];
    const currentStageName = currentStage?.stage_name;

    // selected stage row and id (to fetch vendors)
    const selectedStageRow = canonicalStageRows.find((s: any) => s.name === selectedStage);
    const selectedStageId = selectedStageRow?.id || null;

    // vendors for the selected stage (fetched live)
    const { data: stageVendors = [] } = useQuery({
        queryKey: ["vendors-by-stage", selectedStageId],
        queryFn: async () => {
            if (!selectedStageId) return [];
            const { data, error } = await supabase
                .from("vendors")
                .select("*")
                .eq("stage_id", selectedStageId)
                .order("name", { ascending: true });
            if (error) throw error;
            return data || [];
        },
        enabled: !!selectedStageId,
    });

    // --- Move to Stage Mutation (forward-only) ---
    const moveToStageMutation = useMutation({
        mutationFn: async () => {
            // Validate forward move
            const currentIndex = currentStageName ? (stageOrderIndexMap[currentStageName] ?? -1) : -1;
            const selectedIndex = stageOrderIndexMap[selectedStage] ?? null;

            if (selectedIndex === null || selectedIndex === undefined) {
                throw new Error("Selected stage is not recognized in canonical stages.");
            }

            if (selectedIndex <= currentIndex) {
                // disallow moving backward or to same stage
                throw new Error("Can only move forward to later stages.");
            }

            // If there is a current in_progress stage for this product, mark it done
            if (currentStage) {
                const { error: markDoneErr } = await supabase
                    .from("order_stages")
                    .update({ status: "done", end_ts: new Date().toISOString() })
                    .eq("id", currentStage.id);
                if (markDoneErr) throw markDoneErr;
            }

            // prefer storing vendor_id if vendor exists in vendors table
            let vendor_id = null;
            if (selectedVendor && stageVendors && stageVendors.length) {
                const found = stageVendors.find((v: any) => v.name === selectedVendor);
                if (found) vendor_id = found.id;
            }

            // Insert the new in_progress stage row
            const { error: insertErr } = await supabase.from("order_stages").insert([
                {
                    order_id: order.id,
                    stage_name: selectedStage,
                    vendor_name: selectedVendor || null,
                    vendor_id: vendor_id,
                    status: "in_progress",
                    start_ts: new Date().toISOString(),
                    metadata: { product_number: productNumber, product_name: productName },
                },
            ]);
            if (insertErr) throw insertErr;

            // If the selected stage is the final "Delivered" stage, update order status as well
            // We treat "Delivered" by name; if your DB has a different final stage name, adapt accordingly.
            if (selectedStage.toLowerCase() === "delivered") {
                const { error: orderErr } = await supabase
                    .from("orders")
                    .update({ order_status: "delivered" })
                    .eq("id", order.id);
                if (orderErr) throw orderErr;
            }
        },
        onSuccess: () => {
            toast.success(`Moved to ${selectedStage}`);
            queryClient.invalidateQueries({ queryKey: ["order-stages", order.id] });
            queryClient.invalidateQueries({ queryKey: ["all-order-stages"] });
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            queryClient.invalidateQueries({
                queryKey: ["order-stages-log", order.id, productNumber]
            });
            onStageUpdate?.();
            setOpen(false);
            setSelectedStage("");
            setSelectedVendor("");
        },
        onError: (err: any) => {
            console.error("Move stage failed:", err);
            toast.error(err?.message || "Failed to move stage. Make sure you're moving forward only.");
        },
    });

    // --- Product Notes Mutation ---
    const updateProductNotesMutation = useMutation({
        mutationFn: async (notes: string) => {
            const currentProductNotes = order.metadata?.product_notes || {};
            const { error } = await supabase
                .from("orders")
                .update({
                    metadata: {
                        ...order.metadata,
                        product_notes: {
                            ...currentProductNotes,
                            [productNumber || 0]: notes,
                        },
                    },
                })
                .eq("id", order.id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["order", order.id] });
            toast.success("Product notes updated");
            setEditingNotes(false);
            onStageUpdate?.();
        },
        onError: (err: any) => {
            console.error("Failed to update product notes:", err);
            toast.error("Failed to update product notes");
        },
    });

    const currentVendor = currentStage?.vendor_name;
    const currentStageDate = currentStage?.start_ts
        ? new Date(currentStage.start_ts).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "short",
            year: "numeric",
        })
        : null;

    const isSameStageSelected = selectedStage === currentStageName;

    // Render
    return (
        <Card className="p-6 space-y-6 border-l-4 border-primary/40 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-lg font-semibold mb-1">
                        {productName || "Product"} —{" "}
                        {currentStageName ? (
                            <span className="text-primary">{currentStageName}</span>
                        ) : (
                            <span className="text-muted-foreground italic">Not started</span>
                        )}
                    </h3>
                    {currentVendor && (
                        <p className="text-sm text-muted-foreground">
                            Vendor: <span className="font-medium text-foreground">{currentVendor}</span>
                        </p>
                    )}
                    {currentStageDate && (
                        <p className="text-xs text-muted-foreground">Started on {currentStageDate}</p>
                    )}
                </div>

                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="mt-3 sm:mt-0">
                            <MoveRight className="h-4 w-4 mr-1" /> Move to Stage
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Move Product to Another Stage</DialogTitle>
                        </DialogHeader>

                        <div className="space-y-3 mt-2">
                            <div>
                                <Label>Stage</Label>
                                <select
                                    className="w-full border rounded-md px-3 py-2"
                                    value={selectedStage}
                                    onChange={(e) => {
                                        setSelectedStage(e.target.value);
                                        setSelectedVendor("");
                                    }}
                                >
                                    <option value="">Select stage...</option>
                                    {canonicalStages.map((stageName: string) => (
                                        <option key={stageName} value={stageName}>
                                            {stageName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {selectedStage && stageVendors && stageVendors.length > 0 && (
                                <div>
                                    <Label>Vendor</Label>
                                    <select
                                        className="w-full border rounded-md px-3 py-2"
                                        value={selectedVendor}
                                        onChange={(e) => setSelectedVendor(e.target.value)}
                                    >
                                        <option value="">Select vendor...</option>
                                        {stageVendors.map((v: any) => (
                                            <option key={v.id} value={v.name}>
                                                {v.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <Button
                                className="w-full mt-2"
                                disabled={
                                    !selectedStage ||
                                    moveToStageMutation.isLoading ||
                                    isSameStageSelected
                                }
                                onClick={() => moveToStageMutation.mutate()}
                            >
                                {isSameStageSelected ? (
                                    <>
                                        <Info className="h-4 w-4 mr-2" /> Already in this stage
                                    </>
                                ) : moveToStageMutation.isLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Moving...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4 mr-2" /> Confirm Move
                                    </>
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
                {(canonicalStages.length ? canonicalStages : [
                    "Fabric", "Dyeing", "Polishing", "Embroidery", "Stitching", "Dangling", "Fall & Beading", "Packed", "Dispatched", "Delivered"
                ]).map((stage: string, i: number) => {
                    const isDone = completedStages.includes(stage);
                    const isActive = currentStageName === stage;
                    return (
                        <div key={stage} className="flex items-center">
                            <div
                                className={`w-3 h-3 rounded-full mr-1 ${isDone ? "bg-green-500" : isActive ? "bg-blue-500" : "bg-gray-300"
                                    }`}
                                title={stage}
                            />
                            <span
                                className={`text-xs ${isActive ? "text-primary font-semibold" : "text-muted-foreground"
                                    }`}
                            >
                                {stage}
                            </span>
                            {i < (canonicalStages.length ? canonicalStages.length : 10) - 1 && <span className="mx-2 text-muted-foreground">›</span>}
                        </div>
                    );
                })}
            </div>

            <div className="pt-3 border-t">
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
                            <Button size="sm" onClick={() => updateProductNotesMutation.mutate(productNotes)}>
                                Save
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

            <div className="pt-2 border-t">
                <ActivityLog orderId={order.id} productNumber={productNumber} />
            </div>
        </Card>
    );
}