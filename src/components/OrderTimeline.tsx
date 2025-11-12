import React, { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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

const STAGES = [
    "Ordered",
    "Dyeing",
    "Polishing",
    "Embroidery",
    "Stitching",
    "Dangling",
    "Fall & Beading",
    "Packed",
    "Dispatched",
    "Delivered",
];

const VENDORS_BY_STAGE: Record<string, string[]> = {
    "Ordered": ["Sri Om Fabrics", "Hariom Fabrics", "Jhalak", "Others"],
    "Dyeing": ["Vijay", "Ali"],
    "Polishing": ["Sobi", "Nadeem"],
    "Embroidery": ["Bashar", "Jawed", "Sajjad", "Manish"],
    "Stitching": ["Master", "Rajni", "Jayesh", "Chetan", "Shoaib", "Anees"],
    "Dangling": ["Home", "Chachi"],
    "Fall & Beading": ["Chachi", "Munni"],
    "Dispatched": ["Tirupati", "Par Courier", "Charotar"],
};

export function OrderTimeline({ order, stages, productNumber, productName, onStageUpdate }: any) {
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

    const currentStage = stages?.find((s) => s.status === "in_progress");
    const completedStages = stages?.filter((s) => s.status === "done").map((s) => s.stage_name) || [];
    const currentStageName = currentStage?.stage_name;

    // --- Move to Stage Mutation ---
    const moveToStageMutation = useMutation({
        mutationFn: async () => {
            if (currentStage) {
                await supabase
                    .from("order_stages")
                    .update({ status: "done", end_ts: new Date().toISOString() })
                    .eq("id", currentStage.id);
            }

            const { error } = await supabase.from("order_stages").insert([
                {
                    order_id: order.id,
                    stage_name: selectedStage,
                    vendor_name: selectedVendor || null,
                    status: "in_progress",
                    start_ts: new Date().toISOString(),
                    metadata: { product_number: productNumber, product_name: productName },
                },
            ]);
            if (error) throw error;

            if (selectedStage === "Delivered") {
                await supabase.from("orders").update({ order_status: "delivered" }).eq("id", order.id);
            }
        },
        onSuccess: () => {
            toast.success(`Moved to ${selectedStage}`);
            queryClient.invalidateQueries({ queryKey: ["order-stages", order.id] });
            onStageUpdate?.();
            setOpen(false);
            setSelectedStage("");
            setSelectedVendor("");
        },
        onError: (err) => {
            toast.error("Failed to move stage");
            console.error(err);
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

    return (
        <Card className="p-6 space-y-6 border-l-4 border-primary/40 shadow-sm">
            {/* --- Product Stage Summary --- */}
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

                {/* Move Stage Button */}
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
                            {/* Stage Select */}
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
                                    {STAGES.map((stage) => (
                                        <option key={stage} value={stage}>
                                            {stage}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Vendor Select */}
                            {selectedStage && VENDORS_BY_STAGE[selectedStage] && (
                                <div>
                                    <Label>Vendor</Label>
                                    <select
                                        className="w-full border rounded-md px-3 py-2"
                                        value={selectedVendor}
                                        onChange={(e) => setSelectedVendor(e.target.value)}
                                    >
                                        <option value="">Select vendor...</option>
                                        {VENDORS_BY_STAGE[selectedStage].map((v) => (
                                            <option key={v} value={v}>
                                                {v}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Confirm Button */}
                            <Button
                                className="w-full mt-2"
                                disabled={
                                    !selectedStage ||
                                    moveToStageMutation.isPending ||
                                    isSameStageSelected
                                }
                                onClick={() => moveToStageMutation.mutate()}
                            >
                                {isSameStageSelected ? (
                                    <>
                                        <Info className="h-4 w-4 mr-2" /> Already in this stage
                                    </>
                                ) : moveToStageMutation.isPending ? (
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

            {/* --- Progress Tracker --- */}
            <div className="flex items-center gap-2 flex-wrap">
                {STAGES.map((stage, i) => {
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
                            {i < STAGES.length - 1 && <span className="mx-2 text-muted-foreground">›</span>}
                        </div>
                    );
                })}
            </div>

            {/* --- Product Notes --- */}
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

            {/* --- Activity Log --- */}
            <div className="pt-2 border-t">
                <ActivityLog orderId={order.id} productNumber={productNumber} />
            </div>
        </Card>
    );
}
