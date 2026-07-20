import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LoadingStateProps {
  message?: string;
  fullScreen?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Consistent loading indicator used across the app.
 * - Use `fullScreen` for route-level / page-level loading.
 * - Use the default centered variant inside cards/sections.
 */
export function LoadingState({
  message = "Loading…",
  fullScreen = false,
  className,
  size = "md",
}: LoadingStateProps) {
  const sizeClass =
    size === "sm" ? "h-4 w-4" : size === "lg" ? "h-10 w-10" : "h-7 w-7";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "flex flex-col items-center justify-center gap-3 text-muted-foreground",
        fullScreen ? "min-h-screen" : "py-12",
        className
      )}
    >
      <Loader2 className={cn(sizeClass, "animate-spin text-primary")} />
      {message ? <p className="text-sm">{message}</p> : null}
      <span className="sr-only">{message}</span>
    </div>
  );
}

export default LoadingState;
