import { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  className?: string;
  /** Compact variant for use inside small cards/lists. */
  compact?: boolean;
}

/**
 * Consistent empty state for lists, tables, and cards.
 * Always provide a `title`; description and CTA are optional.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "py-8 px-4" : "py-12 px-6",
        className
      )}
    >
      <div
        className={cn(
          "mb-4 flex items-center justify-center rounded-full bg-muted text-muted-foreground",
          compact ? "h-10 w-10" : "h-14 w-14"
        )}
        aria-hidden="true"
      >
        {icon ?? <Inbox className={compact ? "h-5 w-5" : "h-7 w-7"} />}
      </div>
      <h3
        className={cn(
          "font-semibold text-foreground",
          compact ? "text-sm" : "text-base"
        )}
      >
        {title}
      </h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}
      {action ? (
        <Button onClick={action.onClick} className="mt-4" size={compact ? "sm" : "default"}>
          {action.icon}
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}

export default EmptyState;
