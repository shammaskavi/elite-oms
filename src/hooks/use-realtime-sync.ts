import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/services/api/queryKeys";

export interface RealtimeSyncOptions {
  enableOrders?: boolean;
  enableInvoices?: boolean;
  enableStock?: boolean;
  orderId?: string;
  invoiceId?: string;
}

/**
 * Enterprise Realtime Sync Hook
 * Subscribes to Supabase PostgreSQL changes across core ERP tables
 * and invalidates matching TanStack Query caches with debouncing.
 */
export function useRealtimeSync(options: RealtimeSyncOptions = {}) {
  const {
    enableOrders = true,
    enableInvoices = true,
    enableStock = false,
    orderId,
    invoiceId,
  } = options;

  const queryClient = useQueryClient();
  const debounceTimerRef = useRef<Record<string, any>>({});
  const firstScheduledRef = useRef<Record<string, number>>({});

  // Coalesce bursts of realtime events into a single cache invalidation.
  // DEBOUNCE_MS waits for a short quiet gap before refetching; MAX_WAIT_MS
  // guarantees a refetch still happens within a bounded window even under a
  // continuous stream of writes, so lists never appear frozen during busy
  // billing. This only affects how quickly OTHER devices' changes appear — the
  // current user's own actions refresh immediately via each page's mutation
  // onSuccess invalidation, which is independent of this hook.
  const DEBOUNCE_MS = 1000;
  const MAX_WAIT_MS = 4000;

  const debounceInvalidate = (key: readonly any[], delayMs = DEBOUNCE_MS) => {
    const keyString = JSON.stringify(key);
    const now = Date.now();

    if (firstScheduledRef.current[keyString] == null) {
      firstScheduledRef.current[keyString] = now;
    }

    const fire = () => {
      clearTimeout(debounceTimerRef.current[keyString]);
      delete debounceTimerRef.current[keyString];
      delete firstScheduledRef.current[keyString];
      queryClient.invalidateQueries({ queryKey: key });
    };

    // Guarantee a refresh within MAX_WAIT_MS of the first pending event.
    const waited = now - firstScheduledRef.current[keyString];
    if (waited >= MAX_WAIT_MS) {
      fire();
      return;
    }

    if (debounceTimerRef.current[keyString]) {
      clearTimeout(debounceTimerRef.current[keyString]);
    }
    const wait = Math.min(delayMs, MAX_WAIT_MS - waited);
    debounceTimerRef.current[keyString] = setTimeout(fire, wait);
  };

  useEffect(() => {
    const channels: any[] = [];

    // 1. Orders & Order Stages Channel
    if (enableOrders) {
      const ordersChannel = supabase
        .channel(`erp-realtime-orders-${orderId || "global"}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "orders",
            ...(orderId ? { filter: `id=eq.${orderId}` } : {}),
          },
          (payload) => {
            debounceInvalidate(queryKeys.orders.all);
            debounceInvalidate(queryKeys.orders.stats());
            if (payload.new && (payload.new as any).id) {
              debounceInvalidate(
                queryKeys.orders.detail((payload.new as any).id)
              );
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "order_stages",
            ...(orderId ? { filter: `order_id=eq.${orderId}` } : {}),
          },
          (payload) => {
            debounceInvalidate(queryKeys.orders.all);
            const targetOrderId =
              (payload.new as any)?.order_id ||
              (payload.old as any)?.order_id ||
              orderId;
            if (targetOrderId) {
              debounceInvalidate(queryKeys.orders.stages(targetOrderId));
              debounceInvalidate(queryKeys.orders.detail(targetOrderId));
            }
          }
        )
        .subscribe();

      channels.push(ordersChannel);
    }

    // 2. Invoices & Payments Channel
    if (enableInvoices) {
      const invoicesChannel = supabase
        .channel(`erp-realtime-invoices-${invoiceId || "global"}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "invoices",
            ...(invoiceId ? { filter: `id=eq.${invoiceId}` } : {}),
          },
          (payload) => {
            debounceInvalidate(queryKeys.invoices.all);
            if (payload.new && (payload.new as any).id) {
              debounceInvalidate(
                queryKeys.invoices.detail((payload.new as any).id)
              );
            }
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "invoice_payments",
            ...(invoiceId ? { filter: `invoice_id=eq.${invoiceId}` } : {}),
          },
          (payload) => {
            debounceInvalidate(queryKeys.invoices.all);
            debounceInvalidate(queryKeys.customers.all);
            const targetInvoiceId =
              (payload.new as any)?.invoice_id ||
              (payload.old as any)?.invoice_id ||
              invoiceId;
            if (targetInvoiceId) {
              debounceInvalidate(
                queryKeys.invoices.payments(targetInvoiceId)
              );
              debounceInvalidate(
                queryKeys.invoices.detail(targetInvoiceId)
              );
            }
          }
        )
        .subscribe();

      channels.push(invoicesChannel);
    }

    // 3. Stock & Inventory Units Channel
    if (enableStock) {
      const stockChannel = supabase
        .channel("erp-realtime-stock")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "stock_units",
          },
          () => {
            debounceInvalidate(queryKeys.products.all);
          }
        )
        .subscribe();

      channels.push(stockChannel);
    }

    // Cleanup channels on unmount
    return () => {
      channels.forEach((channel) => {
        supabase.removeChannel(channel);
      });
      // Clear all active debounce timers
      Object.values(debounceTimerRef.current).forEach((timer) =>
        clearTimeout(timer)
      );
      debounceTimerRef.current = {};
      firstScheduledRef.current = {};
    };
  }, [enableOrders, enableInvoices, enableStock, orderId, invoiceId, queryClient]);
}

export default useRealtimeSync;
