import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { SortDirection } from "@/hooks/use-data-table-sort";
import { cn } from "@/lib/utils";

export interface SortableTableHeadProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortKey: string;
  currentSortKey?: string | null;
  currentDirection?: SortDirection;
  onSort: (key: string) => void;
  children: React.ReactNode;
  align?: "left" | "center" | "right";
}

export function SortableTableHead({
  sortKey,
  currentSortKey,
  currentDirection,
  onSort,
  children,
  className,
  align = "left",
  ...props
}: SortableTableHeadProps) {
  const isCurrent = currentSortKey === sortKey && currentDirection !== null;

  const nextActionLabel = !isCurrent
    ? `Sort ${children} ascending`
    : currentDirection === "asc"
    ? `Sort ${children} descending`
    : `Clear sorting on ${children}`;

  return (
    <TableHead
      className={cn(
        "cursor-pointer select-none transition-colors hover:bg-muted/60",
        isCurrent && "text-foreground font-semibold",
        className
      )}
      onClick={() => onSort(sortKey)}
      title={nextActionLabel}
      aria-sort={
        isCurrent
          ? currentDirection === "asc"
            ? "ascending"
            : "descending"
          : "none"
      }
      {...props}
    >
      <div
        className={cn(
          "flex items-center gap-1.5 py-1",
          align === "center" && "justify-center",
          align === "right" && "justify-end"
        )}
      >
        <span>{children}</span>
        <span
          className={cn(
            "flex h-4 w-4 items-center justify-center rounded transition-all",
            isCurrent
              ? "bg-primary/10 text-primary font-bold"
              : "text-muted-foreground/40 group-hover:text-muted-foreground"
          )}
        >
          {isCurrent ? (
            currentDirection === "asc" ? (
              <ArrowUp className="h-3.5 w-3.5 stroke-[2.5]" />
            ) : (
              <ArrowDown className="h-3.5 w-3.5 stroke-[2.5]" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-60" />
          )}
        </span>
      </div>
    </TableHead>
  );
}

export default SortableTableHead;
