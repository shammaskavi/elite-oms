import * as React from "react";
import { useState } from "react";
import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Calendar as CalendarIcon, ChevronDown, X, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface DateFilterValue {
  type: "all" | "single" | "range" | "preset";
  singleDate?: string; // YYYY-MM-DD
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;    // YYYY-MM-DD
  presetLabel?: string;
}

export interface DateRangeFilterProps {
  value: DateFilterValue;
  onChange: (value: DateFilterValue) => void;
  className?: string;
}

export function DateRangeFilter({
  value,
  onChange,
  className,
}: DateRangeFilterProps) {
  const [open, setOpen] = useState(false);
  const [customStart, setCustomStart] = useState(value.startDate || "");
  const [customEnd, setCustomEnd] = useState(value.endDate || "");

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const applyPreset = (preset: "today" | "yesterday" | "last7" | "thisWeek" | "thisMonth" | "lastMonth") => {
    const today = new Date();
    let start = "";
    let end = "";
    let label = "";

    switch (preset) {
      case "today":
        start = todayStr;
        end = todayStr;
        label = "Today";
        break;
      case "yesterday":
        const yest = subDays(today, 1);
        start = format(yest, "yyyy-MM-dd");
        end = format(yest, "yyyy-MM-dd");
        label = "Yesterday";
        break;
      case "last7":
        start = format(subDays(today, 6), "yyyy-MM-dd");
        end = todayStr;
        label = "Last 7 Days";
        break;
      case "thisWeek":
        start = format(startOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
        end = format(endOfWeek(today, { weekStartsOn: 1 }), "yyyy-MM-dd");
        label = "This Week";
        break;
      case "thisMonth":
        start = format(startOfMonth(today), "yyyy-MM-dd");
        end = format(endOfMonth(today), "yyyy-MM-dd");
        label = "This Month";
        break;
      case "lastMonth":
        const prevMonth = subMonths(today, 1);
        start = format(startOfMonth(prevMonth), "yyyy-MM-dd");
        end = format(endOfMonth(prevMonth), "yyyy-MM-dd");
        label = "Last Month";
        break;
    }

    onChange({
      type: "preset",
      startDate: start,
      endDate: end,
      presetLabel: label,
    });
    setOpen(false);
  };

  const applyCustomRange = () => {
    if (!customStart && !customEnd) {
      clearFilter();
      return;
    }

    if (customStart && customEnd && customStart === customEnd) {
      onChange({
        type: "single",
        singleDate: customStart,
      });
    } else {
      onChange({
        type: "range",
        startDate: customStart || undefined,
        endDate: customEnd || undefined,
      });
    }
    setOpen(false);
  };

  const clearFilter = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    onChange({ type: "all" });
    setCustomStart("");
    setCustomEnd("");
    setOpen(false);
  };

  // Determine label to display on the trigger button
  const getDisplayLabel = () => {
    if (value.type === "all") {
      return "Date Filter";
    }
    if (value.type === "preset" && value.presetLabel) {
      return value.presetLabel;
    }
    if (value.type === "single" && value.singleDate) {
      try {
        return format(new Date(value.singleDate + "T00:00:00"), "dd MMM yyyy");
      } catch {
        return value.singleDate;
      }
    }
    if (value.startDate && value.endDate) {
      try {
        const s = format(new Date(value.startDate + "T00:00:00"), "dd MMM");
        const e = format(new Date(value.endDate + "T00:00:00"), "dd MMM yyyy");
        return `${s} – ${e}`;
      } catch {
        return `${value.startDate} – ${value.endDate}`;
      }
    }
    if (value.startDate) {
      return `From ${value.startDate}`;
    }
    if (value.endDate) {
      return `Until ${value.endDate}`;
    }
    return "Date Filter";
  };

  const isActive = value.type !== "all";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isActive ? "secondary" : "outline"}
          className={cn(
            "h-10 justify-between gap-2 border text-sm font-normal transition-all",
            isActive && "border-primary/40 bg-primary/5 text-primary font-medium",
            className
          )}
        >
          <div className="flex items-center gap-2">
            <CalendarIcon
              className={cn(
                "h-4 w-4 shrink-0",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            />
            <span className="truncate">{getDisplayLabel()}</span>
          </div>

          <div className="flex items-center gap-1">
            {isActive ? (
              <span
                role="button"
                tabIndex={0}
                aria-label="Clear date filter"
                onClick={clearFilter}
                className="rounded-full p-0.5 hover:bg-muted-foreground/20 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-4 shadow-xl" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="font-semibold text-sm">Filter by Date</h4>
            {isActive && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilter}
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
              >
                Clear
              </Button>
            )}
          </div>

          {/* Quick Preset Buttons */}
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("today")}
              className={cn(
                "justify-start text-xs h-8",
                value.presetLabel === "Today" && "border-primary bg-primary/10 text-primary font-semibold"
              )}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("yesterday")}
              className={cn(
                "justify-start text-xs h-8",
                value.presetLabel === "Yesterday" && "border-primary bg-primary/10 text-primary font-semibold"
              )}
            >
              Yesterday
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("thisWeek")}
              className={cn(
                "justify-start text-xs h-8",
                value.presetLabel === "This Week" && "border-primary bg-primary/10 text-primary font-semibold"
              )}
            >
              This Week
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("last7")}
              className={cn(
                "justify-start text-xs h-8",
                value.presetLabel === "Last 7 Days" && "border-primary bg-primary/10 text-primary font-semibold"
              )}
            >
              Last 7 Days
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("thisMonth")}
              className={cn(
                "justify-start text-xs h-8",
                value.presetLabel === "This Month" && "border-primary bg-primary/10 text-primary font-semibold"
              )}
            >
              This Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => applyPreset("lastMonth")}
              className={cn(
                "justify-start text-xs h-8",
                value.presetLabel === "Last Month" && "border-primary bg-primary/10 text-primary font-semibold"
              )}
            >
              Last Month
            </Button>
          </div>

          {/* Custom Date Inputs */}
          <div className="space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground">Custom Range</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">From Date</Label>
                <Input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground">To Date</Label>
                <Input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <Button
              size="sm"
              onClick={applyCustomRange}
              className="w-full h-8 mt-2 text-xs"
            >
              Apply Range
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DateRangeFilter;
