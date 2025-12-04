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

export function OrderTimeline({
    order,
    stages,
    stagesList = [],
    productNumber,
    productName,
    onStageUpdate
}: any) {
    const queryClient = useQueryClient();

    const [open, setOpen] = useState(false);
    const [selectedStage, setSelectedStage] = useState("");
    const [selectedVendor, setSelectedVendor] = useState("");

    const [editingNotes, setEditingNotes] = useState(false);
    const [productNotes, setProductNotes] = useState(order.metadata?.product_notes?.[productNumber] || "");

    const [editingProductName, setEditingProductName] = useState(false);
    const [localProductName, setLocalProductName] = useState(productName || "");

    /* -----------------------------------------------------------
       🔥 FIX #1 — Sync localProductName with metadata change
       ----------------------------------------------------------- */
    useEffect(() => {
        const updated =
            order.metadata?.product_names?.[productNumber] ||
            productName ||
            "";

        setLocalProductName(updated);
    }, [order.metadata, productName, productNumber]);

    // Sync notes too
    useEffect(() => {
        setProductNotes(order.metadata?.product_notes?.[productNumber] || "");
    }, [order.metadata, productNumber]);

    /* --------- Fetch stages if not provided ----------- */
    const { data: stagesFromDb = [] } = useQuery({
        queryKey: ["stages-list"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("stages")
                .select("*")
                .order("order_index", { ascending: true });
            if (error) throw error;
            return data || [];
        },
        enabled: stagesList.length === 0,
    });

    const canonicalStageRows =
        stagesList.length > 0
            ? [...stagesList].sort((a, b) => a.order_index - b.order_index)
            : [...stagesFromDb].sort((a, b) => a.order_index - b.order_index);

    const canonicalStages = canonicalStageRows.map((s) => s.name);

    const stageOrderIndexMap: Record<string, number> = {};
    canonicalStageRows.forEach((s) => {
        stageOrderIndexMap[s.name] = s.order_index;
    });

    const currentStage = stages?.find((s: any) => s.status === "in_progress");
    const completedStages = (stages || [])
        .filter((s: any) => s.status === "done")
        .map((s: any) => s.stage_name);

    const currentStageName = currentStage?.stage_name;

    const selectedStageRow = canonicalStageRows.find(
        (s) => s.name === selectedStage
    );
    const selectedStageId = selectedStageRow?.id || null;

    /* ---------------- Vendors for stage ---------------- */
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

    /* ---------------- Move to Stage Mutation ------------- */
    const moveToStageMutation = useMutation({
        mutationFn: async () => {
            const currentIndex =
                currentStageName != null
                    ? stageOrderIndexMap[currentStageName]
                    : -1;

            const selectedIndex = stageOrderIndexMap[selectedStage];

            if (selectedIndex <= currentIndex) {
                throw new Error("Can only move forward to a later stage.");
            }

            // mark current stage as done
            if (currentStage) {
                await supabase
                    .from("order_stages")
                    .update({
                        status: "done",
                        end_ts: new Date().toISOString(),
                    })
                    .eq("id", currentStage.id);
            }

            let vendor_id = null;
            if (selectedVendor && stageVendors.length) {
                const found = stageVendors.find((v) => v.name === selectedVendor);
                if (found) vendor_id = found.id;
            }

            await supabase.from("order_stages").insert([
                {
                    order_id: order.id,
                    stage_name: selectedStage,
                    vendor_id,
                    vendor_name: selectedVendor || null,
                    status: "in_progress",
                    start_ts: new Date().toISOString(),
                    metadata: {
                        product_number: productNumber,
                        product_name: localProductName,
                    },
                },
            ]);

            if (selectedStage.toLowerCase() === "delivered") {
                await supabase
                    .from("orders")
                    .update({ order_status: "delivered" })
                    .eq("id", order.id);
            }
        },
        onSuccess: () => {
            toast.success(`Moved to ${selectedStage}`);
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            queryClient.invalidateQueries({ queryKey: ["order-stages", order.id] });
            queryClient.invalidateQueries({
                queryKey: ["order-stages-log", order.id, productNumber],
            });
            onStageUpdate?.();
            setOpen(false);
        },
    });

    /* ---------------- Update Product Notes ------------- */
    const updateProductNotesMutation = useMutation({
        mutationFn: async (notes: string) => {
            const current = order.metadata?.product_notes || {};

            await supabase
                .from("orders")
                .update({
                    metadata: {
                        ...order.metadata,
                        product_notes: {
                            ...current,
                            [productNumber]: notes,
                        },
                    },
                })
                .eq("id", order.id);
        },
        onSuccess: () => {
            toast.success("Product notes updated");
            setEditingNotes(false);
            queryClient.invalidateQueries({ queryKey: ["order", order.id] });
        },
    });

    /* ---------------- Update Product Name (FIXED) ------------- */
    const updateProductNameMutation = useMutation({
        mutationFn: async (newName: string) => {
            const currentNames = order.metadata?.product_names || {};

            await supabase
                .from("orders")
                .update({
                    metadata: {
                        ...order.metadata,
                        product_names: {
                            ...currentNames,
                            [productNumber]: newName,
                        },
                    },
                })
                .eq("id", order.id);
        },

        onSuccess: (_, newName) => {
            toast.success("Product name updated");

            // Update local UI instantly
            setLocalProductName(newName);

            // Refresh order
            queryClient.invalidateQueries({ queryKey: ["order", order.id] });

            setEditingProductName(false);
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

    /* -------------------- RENDER ----------------------- */
    return (
        <Card className="p-6 space-y-6 border-l-4 border-primary/40 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div>
                    {/* ------------ PRODUCT NAME (EDITABLE) ----------- */}
                    <div className="flex items-center gap-2 mb-1">
                        {editingProductName ? (
                            <>
                                <input
                                    className="border rounded px-2 py-1 text-sm"
                                    value={localProductName}
                                    onChange={(e) =>
                                        setLocalProductName(e.target.value)
                                    }
                                    autoFocus
                                />
                                <Button
                                    size="sm"
                                    onClick={() =>
                                        updateProductNameMutation.mutate(localProductName)
                                    }
                                >
                                    Save
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                        setEditingProductName(false);
                                        // restore last saved value
                                        setLocalProductName(
                                            order.metadata?.product_names?.[productNumber] ||
                                            productName ||
                                            ""
                                        );
                                    }}
                                >
                                    Cancel
                                </Button>
                            </>
                        ) : (
                            <>
                                <h3 className="text-lg font-semibold">
                                    {localProductName || "Product"}
                                </h3>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6"
                                    onClick={() => setEditingProductName(true)}
                                >
                                    <Edit2 className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                    </div>

                    {currentStageName ? (
                        <span className="text-primary text-sm">
                            {currentStageName}
                        </span>
                    ) : (
                        <span className="text-muted-foreground italic text-sm">
                            Not started
                        </span>
                    )}

                    {currentVendor && (
                        <p className="text-sm text-muted-foreground">
                            Vendor:{" "}
                            <span className="font-medium text-foreground">
                                {currentVendor}
                            </span>
                        </p>
                    )}

                    {currentStageDate && (
                        <p className="text-xs text-muted-foreground">
                            Started on {currentStageDate}
                        </p>
                    )}
                </div>

                {/* ----------- Move to Stage Button -------------- */}
                <Dialog open={open} onOpenChange={setOpen}>
                    <DialogTrigger asChild>
                        <Button
                            size="sm"
                            variant="outline"
                            className="mt-3 sm:mt-0"
                        >
                            <MoveRight className="h-4 w-4 mr-1" /> Move to Stage
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                Move Product to Another Stage
                            </DialogTitle>
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
                                    {canonicalStages.map((stageName) => (
                                        <option key={stageName} value={stageName}>
                                            {stageName}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* Vendor list if available */}
                            {selectedStage &&
                                stageVendors &&
                                stageVendors.length > 0 && (
                                    <div>
                                        <Label>Vendor</Label>
                                        <select
                                            className="w-full border rounded-md px-3 py-2"
                                            value={selectedVendor}
                                            onChange={(e) =>
                                                setSelectedVendor(
                                                    e.target.value
                                                )
                                            }
                                        >
                                            <option value="">
                                                Select vendor...
                                            </option>
                                            {stageVendors.map((v) => (
                                                <option
                                                    key={v.id}
                                                    value={v.name}
                                                >
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
                                onClick={() =>
                                    moveToStageMutation.mutate()
                                }
                            >
                                {moveToStageMutation.isLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />{" "}
                                        Moving...
                                    </>
                                ) : isSameStageSelected ? (
                                    <>
                                        <Info className="h-4 w-4 mr-2" /> Already
                                        in this stage
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4 mr-2" />{" "}
                                        Confirm Move
                                    </>
                                )}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* ---------- Stage Pills Row ---------- */}
            <div className="flex items-center gap-2 flex-wrap">
                {canonicalStages.map((stage, i) => {
                    const isDone = completedStages.includes(stage);
                    const isActive = currentStageName === stage;
                    return (
                        <div key={stage} className="flex items-center">
                            <div
                                className={`w-3 h-3 rounded-full mr-1 ${isDone
                                    ? "bg-green-500"
                                    : isActive
                                        ? "bg-blue-500"
                                        : "bg-gray-300"
                                    }`}
                            />
                            <span
                                className={`text-xs ${isActive
                                    ? "text-primary font-semibold"
                                    : "text-muted-foreground"
                                    }`}
                            >
                                {stage}
                            </span>
                            {i < canonicalStages.length - 1 && (
                                <span className="mx-2 text-muted-foreground">
                                    ›
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ---------- Notes ---------- */}
            <div className="pt-3 border-t">
                <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-medium">
                        Product Notes
                    </Label>
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
                        {productNotes ||
                            "No notes added yet. Click Edit to add notes about this product."}
                    </p>
                ) : (
                    <div className="space-y-2">
                        <Textarea
                            value={productNotes}
                            onChange={(e) =>
                                setProductNotes(e.target.value)
                            }
                            placeholder="Add notes about this product..."
                            className="min-h-[80px]"
                            autoFocus
                        />
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={() =>
                                    updateProductNotesMutation.mutate(
                                        productNotes
                                    )
                                }
                            >
                                Save
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    setEditingNotes(false);
                                    setProductNotes(
                                        order.metadata?.product_notes?.[
                                        productNumber
                                        ] || ""
                                    );
                                }}
                            >
                                Cancel
                            </Button>
                        </div>
                    </div>
                )}
            </div>

            {/* ---------- Activity Log ---------- */}
            <div className="pt-2 border-t">
                <ActivityLog
                    orderId={order.id}
                    productNumber={productNumber}
                />
            </div>
        </Card>
    );
}