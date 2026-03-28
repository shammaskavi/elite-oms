import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Notebook } from "lucide-react";

export default function KarigarOrderDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const token = searchParams.get("token");

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
    if (!currentOrder) return <div className="p-10 text-center text-slate-400 animate-pulse">Loading job details...</div>;

    const latestStage = allStages?.[allStages.length - 1];
    if (vendor && latestStage && latestStage.vendor_id !== vendor.id) {
        return <div className="p-10 text-center text-red-500 font-bold">Unauthorized Access</div>;
    }

    const numProducts = parseInt(currentOrder.metadata?.num_products || "1");

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

                        return (
                            <div
                                key={productNumber}
                                className="bg-white rounded-xl shadow-sm border border-slate-100 p-4"
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <Notebook className="h-4 w-4 text-slate-400" />
                                    <h2 className="text-xs font-semibold uppercase text-slate-500 tracking-wide">
                                        Item {productNumber}
                                    </h2>
                                </div>

                                <p className="text-lg font-semibold text-slate-900 leading-snug">
                                    {productName}
                                </p>

                                {productNotes && (
                                    <div className="mt-3">
                                        <p className="text-[10px] uppercase text-slate-400 mb-1 font-semibold">
                                            Notes
                                        </p>
                                        <div className="p-3 bg-slate-50 rounded-lg text-sm text-slate-700 border">
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