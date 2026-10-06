import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  offlineSince: Date | null;
  reconnectedAt: Date | null;
  checkConnection: () => Promise<boolean>;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
      ? navigator.onLine
      : true
  );
  const [wasOffline, setWasOffline] = useState(false);
  const [offlineSince, setOfflineSince] = useState<Date | null>(null);
  const [reconnectedAt, setReconnectedAt] = useState<Date | null>(null);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === "undefined" || !navigator.onLine) {
      setIsOnline(false);
      return false;
    }

    try {
      // Light ping to verify true internet accessibility (avoid false positives on captive portals)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`,
        {
          method: "GET",
          signal: controller.signal,
          cache: "no-store",
        }
      );
      clearTimeout(timeoutId);

      const online = response.ok || response.status < 500;
      setIsOnline(online);
      return online;
    } catch {
      // If the ping fails or times out, fallback to navigator.onLine
      const online = navigator.onLine;
      setIsOnline(online);
      return online;
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleOnline = () => {
      setIsOnline(true);
      setWasOffline(true);
      const now = new Date();
      setReconnectedAt(now);
      setOfflineSince(null);

      toast.success("Connection restored", {
        description: "You are back online. Synchronizing latest updates...",
        duration: 4000,
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setOfflineSince(new Date());

      toast.error("Network connection lost", {
        description:
          "You are currently offline. Changes will be saved once connection is restored.",
        duration: 6000,
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return {
    isOnline,
    wasOffline,
    offlineSince,
    reconnectedAt,
    checkConnection,
  };
}

export default useNetworkStatus;
