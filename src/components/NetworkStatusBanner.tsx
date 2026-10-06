import { useState, useEffect } from "react";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNetworkStatus } from "@/hooks/use-network-status";
import { cn } from "@/lib/utils";

export function NetworkStatusBanner() {
  const { isOnline, wasOffline, offlineSince, checkConnection } =
    useNetworkStatus();
  const [isChecking, setIsChecking] = useState(false);
  const [showReconnectedPill, setShowReconnectedPill] = useState(false);

  // When coming back online after an outage, show reconnected notice temporarily
  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnectedPill(true);
      const timer = setTimeout(() => {
        setShowReconnectedPill(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, wasOffline]);

  const handleManualRetry = async () => {
    setIsChecking(true);
    try {
      await checkConnection();
    } finally {
      setTimeout(() => setIsChecking(false), 500);
    }
  };

  if (isOnline && !showReconnectedPill) {
    return null;
  }

  if (showReconnectedPill && isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="sticky top-0 z-[100] flex w-full items-center justify-center bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white shadow-md transition-all duration-300 animate-in slide-in-from-top"
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>Connection restored. All systems synchronized.</span>
        </div>
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="sticky top-0 z-[100] flex w-full items-center justify-between border-b border-amber-600/30 bg-gradient-to-r from-amber-600 via-amber-700 to-amber-600 px-4 py-2 text-xs text-white shadow-lg transition-all duration-300 animate-in slide-in-from-top"
    >
      <div className="flex items-center gap-2.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white/20 text-white animate-pulse">
          <WifiOff className="h-3.5 w-3.5" />
        </span>
        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
          <span className="font-semibold tracking-wide">
            You are currently working offline.
          </span>
          <span className="text-white/80">
            {offlineSince
              ? `Disconnected since ${offlineSince.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}.`
              : "Network connection is unavailable."}{" "}
            New actions will retry once reconnected.
          </span>
        </div>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={handleManualRetry}
        disabled={isChecking}
        className="h-7 bg-white/10 px-2.5 text-xs font-medium text-white hover:bg-white/20 hover:text-white"
      >
        <RefreshCw
          className={cn("mr-1.5 h-3 w-3", isChecking && "animate-spin")}
        />
        {isChecking ? "Checking..." : "Retry"}
      </Button>
    </div>
  );
}

export default NetworkStatusBanner;
