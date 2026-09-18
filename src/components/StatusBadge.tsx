import React from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusType = "order" | "payment" | "urgency" | "role" | "measurement" | "general";

interface StatusBadgeProps {
  type?: StatusType;
  status: string;
  className?: string;
  label?: string;
}

export function StatusBadge({
  type = "general",
  status,
  className,
  label,
}: StatusBadgeProps) {
  const norm = (status || "").trim().toLowerCase();
  const displayLabel = label || status;

  let colorClasses = "bg-muted text-muted-foreground border-border";

  if (type === "payment") {
    switch (norm) {
      case "paid":
        colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200";
        break;
      case "partial":
        colorClasses = "bg-amber-50 text-amber-700 border-amber-200";
        break;
      case "unpaid":
      case "due":
        colorClasses = "bg-rose-50 text-rose-700 border-rose-200";
        break;
    }
  } else if (type === "order" || type === "general") {
    switch (norm) {
      case "delivered":
      case "completed":
      case "done":
        colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200";
        break;
      case "processing":
      case "in_progress":
      case "cutting":
      case "stitching":
      case "finishing":
        colorClasses = "bg-blue-50 text-blue-700 border-blue-200";
        break;
      case "ready":
      case "packed":
        colorClasses = "bg-indigo-50 text-indigo-700 border-indigo-200";
        break;
      case "pending":
      case "ordered":
        colorClasses = "bg-amber-50 text-amber-700 border-amber-200";
        break;
      case "cancelled":
        colorClasses = "bg-rose-50 text-rose-700 border-rose-200";
        break;
    }
  } else if (type === "urgency") {
    switch (norm) {
      case "overdue":
        colorClasses = "bg-rose-50 text-rose-700 border-rose-200";
        break;
      case "duesoon":
      case "due_soon":
        colorClasses = "bg-amber-50 text-amber-700 border-amber-200";
        break;
      case "normal":
      case "ontrack":
      case "on_track":
        colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200";
        break;
    }
  } else if (type === "role") {
    switch (norm) {
      case "admin":
      case "owner":
        colorClasses = "bg-purple-50 text-purple-700 border-purple-200";
        break;
      case "staff":
        colorClasses = "bg-blue-50 text-blue-700 border-blue-200";
        break;
    }
  } else if (type === "measurement") {
    switch (norm) {
      case "verified":
        colorClasses = "bg-emerald-50 text-emerald-700 border-emerald-200";
        break;
      case "pending":
        colorClasses = "bg-amber-50 text-amber-700 border-amber-200";
        break;
    }
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium text-xs px-2 py-0.5 rounded-full capitalize border transition-colors",
        colorClasses,
        className
      )}
    >
      {displayLabel}
    </Badge>
  );
}

export default StatusBadge;
