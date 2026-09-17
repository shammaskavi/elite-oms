import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Notebook, Ruler, Copy, Check, Scissors } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";

export default function KarigarOrderDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");
    const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

    // 🔹 Data Fetching (Keep existing logic as it works perfectly)
    const { data: vendor } = useQuery({
        queryKey: ["vendor-by-token", token],
        queryFn: async () => {
            if (!token) return null;
            const { data, error } = await supabase.from("vendors").select("*").eq("access_token", token).single();
            if (error) throw error;
            return data;
        },
        enabled: !!token,
    });

    const { data: currentOrder } = useQuery({
        queryKey: ["order", id],
        queryFn: async () => {
            const { data, error } = await supabase.from("orders").select("*").eq("id", id).single();
            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    const { data: invoice } = useQuery({
        queryKey: ["invoice-by-order", currentOrder?.invoice_id],
        queryFn: async () => {
            if (!currentOrder?.invoice_id) return null;
            const { data, error } = await supabase.from("invoices").select("*, customers(name)").eq("id", currentOrder.invoice_id).single();
            if (error) throw error;
            return data;
        },
        enabled: !!currentOrder?.invoice_id,
    });

    const { data: allStages } = useQuery({
        queryKey: ["order-stages", id],
        queryFn: async () => {
            if (!id) return [];
            const { data, error } = await supabase.from("order_stages").select("*").eq("order_id", id).order("created_at", { ascending: true });
            if (error) throw error;
            return data;
        },
        enabled: !!id,
    });

    const { data: stagesList } = useQuery({
        queryKey: ["workflow-stages"],
        queryFn: async () => {
            const { data, error } = await supabase.from("stages").select("*").order("order_index", { ascending: true });
            if (error) throw error;
            return data || [];
        },
    });

    // 🔐 Security & Loading
    if (!currentOrder) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-slate-400 text-sm gap-2">
                <div className="h-6 w-6 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin" />
                <span>Loading order details...</span>
            </div>
        );
    }

    // Check if this vendor is assigned to any stage for this order
    const isVendorAssigned = !vendor || !allStages || allStages.length === 0 || allStages.some((s: any) => s.vendor_id === vendor.id);

    if (token && vendor && allStages && allStages.length > 0 && !isVendorAssigned) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 max-w-sm w-full space-y-3">
                    <div className="h-12 w-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">
                        ⚠️
                    </div>
                    <h2 className="text-base font-bold text-slate-900">Task Not Assigned</h2>
                    <p className="text-xs text-slate-500">
                        This order is not currently assigned to your account.
                    </p>
                    <button
                        onClick={() => navigate(`/karigar/${token}`)}
                        className="w-full mt-2 py-2 px-4 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition-colors"
                    >
                        Return to Tasks
                    </button>
                </div>
            </div>
        );
    }

    const numProducts = parseInt(currentOrder.metadata?.num_products || "1");

    const handleCopyMeasurements = (productNumber: number, productName: string, meas: any) => {
        if (!meas?.values) return;
        const lines = Object.entries(meas.values)
            .map(([k, v]) => `• ${k.replace(/_/g, " ")}: ${v}"`)
            .join("\n");
        const fullText = `📐 ${productName} (${meas.template_name || "Garment"})\nCustomer: ${invoice?.customers?.name || "Client"}\n\n${lines}${meas.notes ? `\n\nNotes: ${meas.notes}` : ""}`;

        navigator.clipboard.writeText(fullText);
        setCopiedIndex(productNumber);
        toast.success(`Copied cutting specs for ${productName}`);
        setTimeout(() => setCopiedIndex(null), 2000);
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-10">
            {/* 📍 Header: Sticky & Compact */}
            <div className="bg-white border-b sticky top-0 z-20 px-4 py-3 shadow-sm">
                <div className="max-w-md mx-auto flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition-colors"
                    >
                        <ArrowLeft className="h-5 w-5 text-slate-600" />
                    </button>
                    <div className="min-w-0">
                        <h1 className="text-sm font-bold text-slate-400 uppercase tracking-wider leading-none">
                            Invoice {invoice?.invoice_number}
                        </h1>
                        <p className="text-lg font-bold text-slate-900 truncate">
                            {invoice?.customers?.name || "No Customer"}
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-4 max-w-md mx-auto space-y-4">
                {/* 🧵 Work Instructions */}
                <div className="space-y-4">
                    {Array.from({ length: numProducts }, (_, i) => {
                        const productNumber = i + 1;

                        const productName =
                            currentOrder.metadata?.product_names?.[productNumber] ||
                            currentOrder.metadata?.item_name ||
                            `Item ${productNumber}`;

                        const productNotes =
                            currentOrder.metadata?.product_notes?.[productNumber] ||
                            currentOrder.notes ||
                            null;

                        const attachedMeasurement = currentOrder.metadata?.product_measurements?.[productNumber];

                        return (
                            <div
                                key={productNumber}
                                className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3.5"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Notebook className="h-4 w-4 text-slate-400" />
                                        <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wide">
                                            Item {productNumber}
                                        </h2>
                                    </div>

                                    {attachedMeasurement && (
                                        <Badge className="bg-purple-100 text-purple-900 hover:bg-purple-100 border border-purple-200 text-[10px] font-bold gap-1">
                                            <Ruler className="h-3 w-3 text-purple-700" />
                                            {attachedMeasurement.template_name || "Specs"}
                                        </Badge>
                                    )}
                                </div>

                                <p className="text-lg font-bold text-slate-900 leading-snug">
                                    {productName}
                                </p>

                                {/* 📐 Attached Measurements for Karigar */}
                                {attachedMeasurement && attachedMeasurement.values && Object.keys(attachedMeasurement.values).length > 0 ? (
                                    <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/90 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <Scissors className="h-3.5 w-3.5 text-purple-700" />
                                                <span className="text-xs font-bold text-purple-950 uppercase tracking-wider">
                                                    Garment Cutting Dimensions
                                                </span>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleCopyMeasurements(productNumber, productName, attachedMeasurement)}
                                                className="text-[11px] font-semibold text-purple-800 bg-white hover:bg-purple-100 px-2 py-0.5 rounded border border-purple-200 flex items-center gap-1 transition-colors"
                                            >
                                                {copiedIndex === productNumber ? (
                                                    <>
                                                        <Check className="h-3 w-3 text-emerald-600" /> Copied
                                                    </>
                                                ) : (
                                                    <>
                                                        <Copy className="h-3 w-3 text-purple-600" /> Copy Specs
                                                    </>
                                                )}
                                            </button>
                                        </div>

                                        {/* Grid of Measurements */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {Object.entries(attachedMeasurement.values).map(([key, val]) => (
                                                <div
                                                    key={key}
                                                    className="p-2 bg-white rounded-lg border border-purple-100/90 text-left shadow-2xs"
                                                >
                                                    <span className="text-[10px] uppercase text-slate-400 block font-semibold truncate">
                                                        {key.replace(/_/g, " ")}
                                                    </span>
                                                    <span className="font-extrabold text-slate-900 text-sm">
                                                        {String(val)}"
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {attachedMeasurement.notes && (
                                            <div className="text-xs bg-white p-2.5 rounded-lg border border-purple-100 text-slate-700 leading-relaxed">
                                                <span className="font-bold text-purple-900">Artisan Note: </span>
                                                {attachedMeasurement.notes}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="p-2.5 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-slate-500 text-xs flex items-center gap-2">
                                        <Ruler className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                        <span>No body measurements attached for this piece.</span>
                                    </div>
                                )}

                                {productNotes && (
                                    <div className="space-y-1">
                                        <p className="text-[10px] uppercase text-slate-400 font-semibold">
                                            Work Instructions & Notes
                                        </p>
                                        <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-700 border border-slate-200 whitespace-pre-wrap leading-relaxed">
                                            {productNotes}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}