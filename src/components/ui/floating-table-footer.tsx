import * as React from "react";
import { FileText, IndianRupee, Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface SummaryMetric {
  label: string;
  value: string | number;
  highlight?: boolean;
  colorClass?: string;
}

export interface FloatingTableFooterProps {
  totalCount: number;
  itemName?: string;
  metrics?: SummaryMetric[];
  showFinancials?: boolean;
  hasActiveFilters?: boolean;
  onResetFilters?: () => void;
  className?: string;
}

export function FloatingTableFooter({
  totalCount,
  itemName = "Records",
  metrics = [],
  showFinancials = true,
  hasActiveFilters = false,
  onResetFilters,
  className,
}: FloatingTableFooterProps) {
  if (totalCount === 0 && !hasActiveFilters) {
    return null;
  }

  return (
    <div
      aria-label="Table Summary Footer"
      className={cn(
        "sticky bottom-4 z-30 mx-auto mt-6 w-full max-w-5xl px-3 animate-in fade-in slide-in-from-bottom-3 duration-300",
        className
      )}
    >
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-border/80 bg-card/95 p-3 sm:px-5 sm:py-3 shadow-2xl backdrop-blur-md">
        {/* Left: Count & Filter reset */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-4 w-4" />
            </span>
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Filtered View
              </span>
              <span className="text-sm font-bold text-foreground">
                {totalCount} {totalCount === 1 ? itemName.replace(/s$/, "") : itemName}
              </span>
            </div>
          </div>

          {hasActiveFilters && onResetFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResetFilters}
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="mr-1.5 h-3 w-3" />
              Reset Filters
            </Button>
          )}
        </div>

        {/* Right: Role-Aware Metrics Summary */}
        {showFinancials && metrics.length > 0 && (
          <div className="flex flex-wrap items-center gap-3 sm:gap-6 border-t sm:border-t-0 pt-2 sm:pt-0 w-full sm:w-auto justify-end">
            {metrics.map((m, idx) => (
              <div
                key={idx}
                className="flex items-baseline gap-2 bg-muted/40 sm:bg-transparent px-3 py-1.5 sm:p-0 rounded-lg"
              >
                <span className="text-xs text-muted-foreground font-medium">
                  {m.label}:
                </span>
                <span
                  className={cn(
                    "text-sm font-bold tracking-tight text-foreground",
                    m.colorClass
                  )}
                >
                  {m.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default FloatingTableFooter;
