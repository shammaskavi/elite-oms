import { Card } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ActivityLogProps {
    orderId: string;
    productNumber?: number;
}

export function ActivityLog({ orderId, productNumber }: ActivityLogProps) {
    const { data: stages } = useQuery({
        queryKey: ["order-stages-log", orderId, productNumber],
        queryFn: async () => {
            let query = (supabase as any)
                .from("order_stages")
                .select("*")
                .eq("order_id", orderId)
                .order("created_at", { ascending: false });

            if (productNumber) {
                query = query.eq("metadata->>product_number", productNumber);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        },
    });

    const activities = stages?.map((stage: any) => {
        const activities = [];

        if (stage.status === "done" && stage.end_ts) {
            activities.push({
                date: new Date(stage.end_ts),
                message: `Completed ${stage.stage_name}`,
                type: "complete"
            });
        }

        if (stage.start_ts) {
            activities.push({
                date: new Date(stage.start_ts),
                message: stage.status === "in_progress"
                    ? `Started ${stage.stage_name}`
                    : `Moved to ${stage.stage_name}`,
                type: "start"
            });
        }

        return activities;
    }).flat().sort((a, b) => b.date.getTime() - a.date.getTime()) || [];

    if (activities.length === 0) return null;

    return (
        <Card className="p-4 bg-muted/20">
            <div className="flex items-center gap-2 mb-3">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h4 className="font-medium text-sm">Activity Log</h4>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
                {activities.slice(0, 10).map((activity, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                        <div className={`w-1.5 h-1.5 rounded-full mt-1.5 ${activity.type === "complete" ? "bg-success" : "bg-info"
                            }`} />
                        <div className="flex-1">
                            <p className="text-foreground">{activity.message}</p>
                            <p className="text-muted-foreground">
                                {activity.date.toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
}