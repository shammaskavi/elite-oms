import { useMemo, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, isSameDay, startOfDay } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import clsx from "clsx";

interface WeekCalendarProps {
  dates: Date[];
  anchorDate: Date;
  onItemClick: (orderId: string) => void;
}

type CalendarItem = {
  order_id: string;
  invoice_id?: string;
  invoice_number: string;
  order_code: string;
  item_name: string;
  delivery_date: string; // YYYY-MM-DD
  customer_name: string;
  stage: string;
  vendor_name?: string | null;
};

function WeekCalendarComponent({
  dates,
  anchorDate,
  onItemClick,
}: WeekCalendarProps) {
  /* -----------------------------
     1️⃣ Fetch all delivery calendar items from DB view
  ------------------------------ */
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["calendar-items"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("order_items_calendar_view")
        .select("*")
        .neq("stage", "Delivered");

      if (error) throw error;
      return (data || []) as CalendarItem[];
    },
    staleTime: 60 * 1000,
  });

  /* -----------------------------
     2️⃣ Group items by date (YYYY-MM-DD)
  ------------------------------ */
  const itemsByDate = useMemo(() => {
    const map: Record<string, CalendarItem[]> = {};
    items.forEach((item) => {
      if (!item.delivery_date) return;
      // normalize date to YYYY-MM-DD
      const key = item.delivery_date.split("T")[0];
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [items]);

  if (isLoading) {
    return (
      <div className="p-12 text-center text-muted-foreground animate-pulse">
        Loading delivery calendar…
      </div>
    );
  }

  /* -----------------------------
     3️⃣ Render Week View
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
                "rounded-lg border p-2 space-y-2 h-[540px] overflow-y-scroll scrollbar-thin scrollbar-thumb-muted-foreground/40 scrollbar-track-transparent",
                isToday
                  ? "border-primary bg-primary/5"
                  : "bg-background"
              )}
            >
              {dayItems.length === 0 && (
                <div className="text-xs text-muted-foreground text-center mt-4">
                  No items
                </div>
              )}

              {dayItems.map((item, idx) => {
                const displayStage =
                  item.stage === "Packed"
                    ? "Ready to Pickup"
                    : item.stage || "Ordered";

                return (
                  <Card
                    key={`${item.order_id}-${item.item_name}-${idx}`}
                    className="p-2.5 hover:shadow-md transition-all cursor-pointer bg-card"
                    onClick={() => onItemClick(item.order_id)}
                  >
                    <div className="text-xs font-semibold leading-snug break-words text-foreground">
                      {item.invoice_number || item.order_code}
                    </div>
                    <div className="text-xs font-medium leading-snug break-words mt-0.5">
                      {item.item_name}
                    </div>

                    <div className="text-[11px] text-muted-foreground leading-snug break-words mt-1">
                      {item.customer_name}
                    </div>

                    {item.vendor_name && (
                      <div className="text-[10px] text-muted-foreground leading-snug mt-0.5">
                        Vendor: {item.vendor_name}
                      </div>
                    )}

                    <div className="mt-1.5 flex flex-wrap gap-1">
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 py-0 h-4 font-normal"
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

export const WeekCalendar = memo(WeekCalendarComponent);
export default WeekCalendar;