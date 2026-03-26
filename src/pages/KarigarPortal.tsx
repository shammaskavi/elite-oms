import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Hash, ChevronRight, Package, Clock } from "lucide-react";

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
    const vendorName = work[0]?.vendor_name || "Karigar";
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function loadWork() {
            const { data, error } = await supabase.rpc("get_vendor_work", {
                p_token: token,
            });
            const vendorName = work[0]?.vendor_name || "Karigar";


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

    const getStageColor = (stage: string) => {
        const s = stage.toLowerCase();
        if (s.includes("packed")) return "bg-emerald-100 text-emerald-700 border-emerald-200";
        if (s.includes("embroidery") || s.includes("dyeing")) return "bg-blue-100 text-blue-700 border-blue-200";
        if (s.includes("stitching")) return "bg-purple-100 text-purple-700 border-purple-200";
        return "bg-amber-100 text-amber-700 border-amber-200";
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
                <p className="text-slate-500 font-medium">Loading your assignments...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50 pb-10">
            {/* Header Area */}
            <div className="bg-white border-b px-4 py-6 sticky top-0 z-10 shadow-sm">
                <div className="max-w-md mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-slate-900">Work Portal</h1>
                        <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                            {vendorName} - {work.length} Active Tasks
                        </p>
                    </div>
                    <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
                        <Package className="h-5 w-5 text-primary" />
                    </div>
                </div>
            </div>

            <div className="p-4 max-w-md mx-auto space-y-4">
                {work.length === 0 ? (
                    <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-slate-300">
                        <Clock className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                        <p className="text-slate-500 font-medium">No work assigned right now.</p>
                    </div>
                ) : (
                    work.map((item) => (
                        <Card key={item.order_id} className="overflow-hidden border-none shadow-md active:scale-[0.98] transition-transform cursor-pointer">
                            <CardContent className="p-0">
                                {/* Top colored bar based on stage */}
                                <div className={`h-1.5 w-full ${getStageColor(item.stage_name).split(' ')[0]}`} />

                                <div className="p-4">
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            <Hash className="h-3 w-3" />
                                            {item.invoice_number}
                                        </div>
                                        <Badge className={`${getStageColor(item.stage_name)} shadow-none border text-[11px] px-2 py-0`}>
                                            {item.stage_name}
                                        </Badge>
                                    </div>

                                    <h2 className="text-lg font-bold text-slate-900 leading-tight mb-4">
                                        {item.item_name}
                                    </h2>

                                    <div className="grid grid-cols-2 gap-4 border-t pt-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                                                <User className="h-3 w-3" />
                                                Customer
                                            </div>
                                            <p className="text-sm font-semibold text-slate-700 truncate">
                                                {item.customer_name}
                                            </p>
                                        </div>

                                        <div className="space-y-1 text-right">
                                            <div className="flex items-center justify-end gap-1.5 text-[10px] font-bold text-slate-400 uppercase">
                                                <Calendar className="h-3 w-3" />
                                                Due Date
                                            </div>
                                            <p className="text-sm font-bold text-slate-900">
                                                {new Date(item.delivery_date).toLocaleDateString("en-IN", {
                                                    day: "2-digit",
                                                    month: "short",
                                                })}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-4 flex items-center justify-center text-primary text-xs font-bold border-t pt-3 gap-1 opacity-70">
                                        Tap to view details <ChevronRight className="h-3 w-3" />
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}