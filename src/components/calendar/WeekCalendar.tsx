import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { format, isSameDay, startOfDay } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import clsx from "clsx";

interface WeekCalendarProps {
    dates: Date[];
    anchorDate: Date;
}

type CalendarItem = {
    order_id: string;
    invoice_number: string;
    item_name: string;
    delivery_date: string; // YYYY-MM-DD
    customer_name: string;
    stage: string;
    vendor_name?: string | null;
};

export default function WeekCalendar({
    dates,
    anchorDate,
}: WeekCalendarProps) {
    const navigate = useNavigate();
    /* -----------------------------
       1️⃣ Fetch calendar items
    ------------------------------ */
    const { data: items = [], isLoading } = useQuery({
        queryKey: ["calendar-items"],
        queryFn: async () => {
            const { data, error } = await (supabase as any)
                .from("order_items_calendar_view")
                .select("*")
                .neq("stage", "Delivered");

            if (error) throw error;
            return data as CalendarItem[];
        },
    });

    /* -----------------------------
       3️⃣ Group items by date
    ------------------------------ */
    const itemsByDate = useMemo(() => {
        const map: Record<string, CalendarItem[]> = {};
        items.forEach((item) => {
            if (!item.delivery_date) return;
            if (!map[item.delivery_date]) map[item.delivery_date] = [];
            map[item.delivery_date].push(item);
        });
        return map;
    }, [items]);

    if (isLoading) {
        return (
            <div className="p-6 text-muted-foreground">
                Loading calendar…
            </div>
        );
    }

    /* -----------------------------
       4️⃣ Render Week View
    ------------------------------ */
    return (
        <div className="grid grid-cols-7 gap-3">
            {dates.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd");
                const dayItems = itemsByDate[dateKey] || [];
                const isToday = isSameDay(day, startOfDay(new Date()));

                return (
                    <div key={dateKey} className="flex flex-col">
                        {/* Day Header */}
                        <div
                            className={clsx(
                                "text-sm font-semibold mb-2 flex items-center justify-between px-1",
                                isToday && "text-primary"
                            )}
                        >
                            <div className="text-center flex-1">
                                <div>{format(day, "EEE")}</div>
                                <div className="text-xs text-muted-foreground">
                                    {format(day, "dd MMM")}
                                </div>
                            </div>

                            {dayItems.length > 0 && (
                                <span className="text-xs font-medium text-muted-foreground">
                                    ({dayItems.length})
                                </span>
                            )}
                        </div>

                        {/* Day Column */}
                        <div
                            className={clsx(
                                "flex-1 rounded-lg border p-2 space-y-2 min-h-[120px] overflow-y-auto",
                                isToday
                                    ? "border-primary bg-primary/5"
                                    : "bg-background"
                            )}
                        >
                            {dayItems.length === 0 && (
                                <div className="text-xs text-muted-foreground text-center mt-4">
                                    —
                                </div>
                            )}

                            {dayItems.map((item) => {
                                const displayStage =
                                    item.stage === "Packed"
                                        ? "Ready to Pickup"
                                        : item.stage;

                                return (
                                    <Card
                                        key={item.order_id + item.item_name}
                                        className="p-2 cursor-pointer hover:shadow-sm transition"
                                        onClick={() =>
                                            navigate(`/orders/${item.order_id}`)
                                        }
                                    >
                                        <div className="text-xs font-medium leading-snug break-words">
                                            {item.item_name}
                                        </div>

                                        <div className="text-[11px] text-muted-foreground leading-snug break-words">
                                            {item.customer_name}
                                        </div>
                                        {item.vendor_name && (
                                            <div className="text-[10px] text-muted-foreground leading-snug">
                                                Vendor: {item.vendor_name}
                                            </div>
                                        )}
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            <Badge
                                                variant="secondary"
                                                className="text-[10px]"
                                            >
                                                {displayStage}
                                            </Badge>
                                        </div>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}