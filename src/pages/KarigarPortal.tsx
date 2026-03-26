import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Clock, Package } from "lucide-react";

type WorkItem = {
    vendor_name: string;
    order_id: string;
    invoice_number: string;
    customer_name: string;
    item_name: string;
    delivery_date: string;
    stage_name: string;
};

export default function KarigarPortal() {
    const { token } = useParams();
    const [work, setWork] = useState<WorkItem[]>([]);
    const [loading, setLoading] = useState(true);
    const vendorName = work[0]?.vendor_name || "Karigar";


    useEffect(() => {
        async function loadWork() {
            const { data, error } = await supabase.rpc("get_vendor_work", {
                p_token: token,
            });

            if (error) {
                console.error(error);
                setWork([]);
            } else {
                setWork(data || []);
            }
            setLoading(false);
        }
        if (token) loadWork();
    }, [token]);

    const getStageStyles = (stage: string) => {
        const s = stage.toLowerCase();
        if (s.includes("packed")) return "border-emerald-500 bg-emerald-50 text-emerald-700";
        if (s.includes("embroidery") || s.includes("dyeing")) return "border-blue-500 bg-blue-50 text-blue-700";
        return "border-amber-500 bg-amber-50 text-amber-700";
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen text-slate-400 text-sm">
            Loading tasks...
        </div>
    );

    return (
        <div className="min-h-screen bg-white">
            {/* Minimal Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between sticky top-0 bg-white/80 backdrop-blur-md z-20">
                <h1 className="text-sm font-bold uppercase tracking-tight text-slate-500">
                    {vendorName} Task List ({work.length})
                </h1>
                <Package className="h-4 w-4 text-slate-400" />
            </div>

            <div className="divide-y">
                {work.length === 0 ? (
                    <div className="p-10 text-center text-slate-400 text-xs">No pending work.</div>
                ) : (
                    work.map((item) => {
                        const isDone = item.stage_name.toLowerCase().includes("packed");

                        return (
                            <div
                                key={item.order_id}
                                className="flex items-start gap-3 p-3 active:bg-slate-50 transition-colors cursor-pointer"
                            >
                                {/* Checklist Circle */}
                                <div className="mt-0.5 shrink-0">
                                    {isDone ? (
                                        <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                                    ) : (
                                        <Circle className="h-5 w-5 text-slate-300" />
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <h2 className={`text-[15px] font-semibold leading-tight truncate ${isDone ? 'text-slate-400 line-through' : 'text-slate-900'}`}>
                                            {item.item_name}
                                        </h2>
                                        <Badge className={`text-[9px] px-1.5 py-0 h-4 uppercase font-bold border rounded-sm shrink-0 ${getStageStyles(item.stage_name)}`}>
                                            {item.stage_name}
                                        </Badge>
                                    </div>

                                    <p className={`text-xs mt-0.5 ${isDone ? 'text-slate-300' : 'text-slate-500'}`}>
                                        {item.customer_name}
                                    </p>

                                    {/* Muted Metadata Footer */}
                                    <div className="flex items-center gap-3 mt-2 text-[10px] text-slate-400 font-medium">
                                        <span className="bg-slate-100 px-1 rounded">#{item.invoice_number}</span>
                                        <span className="flex items-center gap-1">
                                            <Clock className="h-2.5 w-2.5" />
                                            {new Date(item.delivery_date).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}