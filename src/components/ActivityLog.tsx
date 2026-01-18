import { Card } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ActivityLogProps {
    orderId: string;
    productNumber?: number;
}

export function ActivityLog({ orderId, productNumber }: ActivityLogProps) {
    const { data: rawStages } = useQuery({
        queryKey: ["order-stages-log", orderId, productNumber],
        queryFn: async () => {
            let query = (supabase as any)
                .from("order_stages")
                .select("*")
                .eq("order_id", orderId)
                .order("start_ts", { ascending: true });

            // Filter by product number if applicable
            if (productNumber) {
                query = query.eq("metadata->>product_number", productNumber);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
    });

    if (!rawStages) return null;

    const activities: any[] = [];

    for (let i = 0; i < rawStages.length; i++) {
        const s = rawStages[i];
        const prev = rawStages[i - 1];

        const stageName = s.stage_name;
        const vendor = s.vendor_name ? ` (Vendor: ${s.vendor_name})` : "";

        // 1) STARTED OR MOVED TO
        if (s.start_ts) {
            if (prev) {
                activities.push({
                    date: new Date(s.start_ts),
                    type: "start",
                    message: `Moved from ${prev.stage_name} → ${stageName}${vendor}`,
                });
            } else {
                activities.push({
                    date: new Date(s.start_ts),
                    type: "start",
                    message: `Started at ${stageName}${vendor}`,
                });
            }
        }

        // 2) COMPLETED
        if (s.status === "done" && s.end_ts) {
            activities.push({
                date: new Date(s.end_ts),
                type: "complete",
                message: `Completed ${stageName}${vendor}`,
            });
        }

        // 3) DELIVERED STATE
        if (stageName === "Delivered" && s.status === "in_progress") {
            activities.push({
                date: new Date(s.start_ts),
                type: "delivered",
                message: `Order marked Delivered`,
            });
        }
    }

    // Sort newest first
    const sorted = activities.sort((a, b) => b.date.getTime() - a.date.getTime());

    if (sorted.length === 0) return null;

    return (
        <Card className="p-4 bg-muted/20">
            <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium text-sm">Activity Log</h4>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto">
                {sorted.slice(0, 12).map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                        <div
                            className={`w-1.5 h-1.5 rounded-full mt-1.5 ${item.type === "complete"
                                ? "bg-green-500"
                                : item.type === "delivered"
                                    ? "bg-blue-500"
                                    : "bg-orange-500"
                                }`}
                        />

                        <div className="flex-1">
                            <p className="text-foreground">{item.message}</p>
                            <p className="text-muted-foreground">
                                {item.date.toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    year: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}