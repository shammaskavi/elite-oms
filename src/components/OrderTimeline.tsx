import React, { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Dialog,
    DialogHeader,
    DialogTitle,
    DialogContent,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { toast } from "sonner";
import {
    CheckCircle2,
    MoveRight,
    Loader2,
    Edit2,
    Info,
    ChevronDown,
    ChevronUp,
    ClipboardList,
    History
} from "lucide-react";
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
    const [isExpanded, setIsExpanded] = useState(false);
    const [selectedStage, setSelectedStage] = useState("");
    const [selectedVendor, setSelectedVendor] = useState("");

    const [editingNotes, setEditingNotes] = useState(false);
    const [productNotes, setProductNotes] = useState(order.metadata?.product_notes?.[productNumber] || "");

    const [editingProductName, setEditingProductName] = useState(false);
    const [localProductName, setLocalProductName] = useState(productName || "");

    // Sync localProductName with metadata change
    useEffect(() => {
        const updated = order.metadata?.product_names?.[productNumber] || productName || "";
        setLocalProductName(updated);
    }, [order.metadata, productName, productNumber]);

    // Sync notes
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

    const selectedStageRow = canonicalStageRows.find((s) => s.name === selectedStage);
    const selectedStageId = selectedStageRow?.id || null;

    // Calculate Progress Percentage
    const currentIdx = canonicalStages.findIndex(s => s === currentStageName);
    const progressValue = currentStageName
        ? ((currentIdx + 1) / canonicalStages.length) * 100
        : 0;

    /* ---------------- Vendors for stage ---------------- */
    const { data: stageVendors = [] } = useQuery({
        queryKey: ["vendors-by-stage", selectedStageId],
        queryFn: async () => {
            if (!selectedStageId) return [];
            const { data, error } = await (supabase as any)
                .from("vendors")
                .select("*")
                .eq("stage_id", selectedStageId)
                .order("name", { ascending: true });
            if (error) throw error;
            return data || [];
        },
        enabled: !!selectedStageId,
    });

    /* ---------------- Mutations ---------------- */
    const moveToStageMutation = useMutation({
        mutationFn: async () => {
            const currentIndex = currentStageName != null ? stageOrderIndexMap[currentStageName] : -1;
            const selectedIndex = stageOrderIndexMap[selectedStage];

            if (selectedIndex <= currentIndex) {
                throw new Error("Can only move forward to a later stage.");
            }

            if (currentStage) {
                await supabase
                    .from("order_stages")
                    .update({ status: "done", end_ts: new Date().toISOString() })
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
                    metadata: { product_number: productNumber, product_name: localProductName },
                },
            ]);

            if (selectedStage.toLowerCase() === "delivered") {
                await supabase.from("orders").update({ order_status: "delivered" }).eq("id", order.id);
            }
        },
        onSuccess: () => {
            toast.success(`Moved to ${selectedStage}`);
            queryClient.invalidateQueries({ queryKey: ["orders"] });
            queryClient.invalidateQueries({ queryKey: ["order-stages", order.id] });
            queryClient.invalidateQueries({ queryKey: ["order-stages-log", order.id, productNumber] });
            onStageUpdate?.();
            setOpen(false);
        },
    });

    const updateProductNotesMutation = useMutation({
        mutationFn: async (notes: string) => {
            const current = order.metadata?.product_notes || {};
            await supabase.from("orders").update({
                metadata: { ...order.metadata, product_notes: { ...current, [productNumber]: notes } }
            }).eq("id", order.id);
        },
        onSuccess: () => {
            toast.success("Product notes updated");
            setEditingNotes(false);
            queryClient.invalidateQueries({ queryKey: ["order", order.id] });
        },
    });

    const updateProductNameMutation = useMutation({
        mutationFn: async (newName: string) => {
            const currentNames = order.metadata?.product_names || {};
            await supabase.from("orders").update({
                metadata: { ...order.metadata, product_names: { ...currentNames, [productNumber]: newName } }
            }).eq("id", order.id);
        },
        onSuccess: (_, newName) => {
            toast.success("Product name updated");
            setLocalProductName(newName);
            queryClient.invalidateQueries({ queryKey: ["order", order.id] });
            setEditingProductName(false);
        },
    });

    const currentVendor = currentStage?.vendor_name;
    const currentStageDate = currentStage?.start_ts
        ? new Date(currentStage.start_ts).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
        : null;

    const isSameStageSelected = selectedStage === currentStageName;

    return (
        <Card className="overflow-hidden  shadow-sm transition-all">
            {/* 1. COMPACT HEADER */}
            <div className="p-4 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            {editingProductName ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        className="border rounded px-2 py-0.5 text-sm w-40"
                                        value={localProductName}
                                        onChange={(e) => setLocalProductName(e.target.value)}
                                        autoFocus
                                    />
                                    <Button size="sm" className="h-7 px-2" onClick={() => updateProductNameMutation.mutate(localProductName)}>Save</Button>
                                    <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setEditingProductName(false)}>Cancel</Button>
                                </div>
                            ) : (
                                <>
                                    <h3 className="font-bold text-base">{localProductName || "Product"}</h3>
                                    <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground" onClick={() => setEditingProductName(true)}>
                                        <Edit2 className="h-3 w-3" />
                                    </Button>
                                </>
                            )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            <Badge variant={currentStageName ? "default" : "secondary"} className="h-5 text-[10px] px-1.5">
                                {currentStageName || "Not Started"}
                            </Badge>
                            {currentVendor && <span>Vendor: <b className="text-foreground">{currentVendor}</b></span>}
                            {currentStageDate && <span>Updated {currentStageDate}</span>}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <Dialog open={open} onOpenChange={setOpen}>
                            <DialogTrigger asChild>
                                <Button size="sm" variant="outline" className="h-8 text-xs">
                                    <MoveRight className="h-3.5 w-3.5 mr-1.5" /> Move Stage
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader><DialogTitle>Move Product to Another Stage</DialogTitle></DialogHeader>
                                <div className="space-y-4 pt-4">
                                    <div className="space-y-2">
                                        <Label>Stage</Label>
                                        <select className="w-full border rounded-md px-3 py-2" value={selectedStage} onChange={(e) => { setSelectedStage(e.target.value); setSelectedVendor(""); }}>
                                            <option value="">Select stage...</option>
                                            {canonicalStages.map((stageName) => <option key={stageName} value={stageName}>{stageName}</option>)}
                                        </select>
                                    </div>
                                    {selectedStage && stageVendors?.length > 0 && (
                                        <div className="space-y-2">
                                            <Label>Vendor</Label>
                                            <select className="w-full border rounded-md px-3 py-2" value={selectedVendor} onChange={(e) => setSelectedVendor(e.target.value)}>
                                                <option value="">Select vendor...</option>
                                                {stageVendors.map((v) => <option key={v.id} value={v.name}>{v.name}</option>)}
                                            </select>
                                        </div>
                                    )}
                                    <Button className="w-full" disabled={!selectedStage || moveToStageMutation.isPending || isSameStageSelected} onClick={() => moveToStageMutation.mutate()}>
                                        {moveToStageMutation.isPending ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                                        {isSameStageSelected ? "Already in this stage" : "Confirm Move"}
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => setIsExpanded(!isExpanded)}
                        >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                    </div>
                </div>

                {/* SLIM PROGRESS BAR */}
                <div className="space-y-1">
                    <Progress value={progressValue} className="h-1.5" />
                    <div className="flex justify-between text-[9px] uppercase tracking-tighter text-muted-foreground font-semibold">
                        <span>{canonicalStages[0]}</span>
                        <span>{canonicalStages[canonicalStages.length - 1]}</span>
                    </div>
                </div>
            </div>

            {/* 2. COLLAPSIBLE CONTENT */}
            <Collapsible open={isExpanded}>
                <CollapsibleContent className="border-t bg-muted/20 p-4 space-y-6 animate-in fade-in slide-in-from-top-1">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Notes Section */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                    <ClipboardList className="h-4 w-4 text-primary" />
                                    <h4>Product Notes</h4>
                                </div>
                                {!editingNotes && (
                                    <Button variant="ghost" size="sm" onClick={() => setEditingNotes(true)} className="h-7 text-xs">
                                        <Edit2 className="h-3 w-3 mr-1" /> Edit
                                    </Button>
                                )}
                            </div>
                            {!editingNotes ? (
                                <p className="text-xs text-muted-foreground leading-relaxed italic">
                                    {productNotes || "No specific notes for this product item."}
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    <Textarea value={productNotes} onChange={(e) => setProductNotes(e.target.value)} placeholder="Add notes..." className="text-xs min-h-[80px]" />
                                    <div className="flex gap-2">
                                        <Button size="sm" className="h-7 text-xs" onClick={() => updateProductNotesMutation.mutate(productNotes)}>Save</Button>
                                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingNotes(false)}>Cancel</Button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Activity Log */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                                <History className="h-4 w-4 text-primary" />
                                <h4>Recent Activity</h4>
                            </div>
                            <ActivityLog orderId={order.id} productNumber={productNumber} />
                        </div>
                    </div>

                    {/* Detailed Stage Workflow */}
                    <div className="pt-4 border-t">
                        <Label className="text-[10px] uppercase text-muted-foreground mb-3 block tracking-widest">Full Workflow Progress</Label>
                        <div className="flex flex-wrap gap-2">
                            {canonicalStages.map((stage) => {
                                const isDone = completedStages.includes(stage);
                                const isActive = currentStageName === stage;
                                return (
                                    <Badge
                                        key={stage}
                                        variant={isActive ? "default" : "outline"}
                                        className={`text-[10px] font-normal transition-colors ${isDone ? "border-green-500/50 text-green-600 bg-green-50" :
                                            isActive ? "" : "text-muted-foreground opacity-60"
                                            }`}
                                    >
                                        {isDone && "✓ "}{stage}
                                    </Badge>
                                );
                            })}
                        </div>
                    </div>
                </CollapsibleContent>
            </Collapsible>
        </Card>
    );
}