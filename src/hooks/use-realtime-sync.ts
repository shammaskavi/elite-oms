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

  const debounceInvalidate = (key: readonly any[], delayMs = 300) => {
    const keyString = JSON.stringify(key);
    if (debounceTimerRef.current[keyString]) {
      clearTimeout(debounceTimerRef.current[keyString]);
    }

    debounceTimerRef.current[keyString] = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: key });
      delete debounceTimerRef.current[keyString];
    }, delayMs);
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
    };
  }, [enableOrders, enableInvoices, enableStock, orderId, invoiceId, queryClient]);
}

export default useRealtimeSync;
