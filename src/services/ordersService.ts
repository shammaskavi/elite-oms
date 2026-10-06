import { supabase } from "@/integrations/supabase/client";

export interface FetchOrdersOptions {
  limit?: number;
  signal?: AbortSignal;
}

export const ordersService = {
  /**
   * Fetch orders with related customer, invoice, and stage history
   */
  async fetchOrders(options?: FetchOrdersOptions) {
    let query = (supabase as any)
      .from("orders")
      .select(
        `
        id,
        order_code,
        invoice_id,
        customer_id,
        order_status,
        payment_status,
        total_amount,
        metadata,
        created_at,
        customers(name),
        invoices(invoice_number),
        order_stages(id, stage_name, vendor_name, metadata, created_at)
      `
      )
      .order("created_at", { ascending: false });

    if (options?.limit) {
      query = query.limit(options.limit);
    } else {
      query = query.limit(1000);
    }

    if (options?.signal) {
      query = query.abortSignal(options.signal);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch single order by ID with complete relations
   */
  async fetchOrderById(id: string, signal?: AbortSignal) {
    let query = (supabase as any)
      .from("orders")
      .select(
        `
        *,
        customers(id, name, phone, email, address),
        invoices(id, invoice_number, total, payment_status, tracking_token, settled, raw_payload)
      `
      )
      .eq("id", id);

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  },

  /**
   * Fetch all stages for a specific order
   */
  async fetchOrderStages(orderId: string, signal?: AbortSignal) {
    let query = (supabase as any)
      .from("order_stages")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch canonical workflow stages ordered by order_index
   */
  async fetchStages(signal?: AbortSignal) {
    let query = (supabase as any)
      .from("stages")
      .select("*")
      .order("order_index", { ascending: true });

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch aggregated order stats via RPC
   */
  async fetchOrderStats(signal?: AbortSignal) {
    let query = (supabase as any).rpc("get_order_stats");
    if (signal) {
      query = query.abortSignal(signal);
    }
    const { data, error } = await query;
    if (error) throw error;

    return Array.isArray(data)
      ? data[0]?.get_order_stats || data[0]
      : data?.get_order_stats || data;
  },

  /**
   * Advance a product piece to next stage
   */
  async moveToStage(params: {
    orderId: string;
    currentStageId?: string | null;
    targetStage: string;
    vendorId?: string | null;
    vendorName?: string | null;
    productNumber: number;
    productName?: string;
  }) {
    // 1. Mark current stage done
    if (params.currentStageId) {
      const { error: updateError } = await (supabase as any)
        .from("order_stages")
        .update({ status: "done", end_ts: new Date().toISOString() })
        .eq("id", params.currentStageId);

      if (updateError) throw updateError;
    }

    // 2. Insert next stage in_progress
    const { data: newStage, error: insertError } = await (supabase as any)
      .from("order_stages")
      .insert([
        {
          order_id: params.orderId,
          stage_name: params.targetStage,
          vendor_id: params.vendorId || null,
          vendor_name: params.vendorName || null,
          status: "in_progress",
          start_ts: new Date().toISOString(),
          metadata: {
            product_number: params.productNumber,
            product_name: params.productName,
          },
        },
      ])
      .select()
      .single();

    if (insertError) throw insertError;

    // 3. If delivered, update order status
    if (params.targetStage.toLowerCase() === "delivered") {
      await (supabase as any)
        .from("orders")
        .update({ order_status: "delivered" })
        .eq("id", params.orderId);
    }

    return newStage;
  },

  /**
   * Update order status
   */
  async updateOrderStatus(orderId: string, status: string) {
    const { error } = await (supabase as any)
      .from("orders")
      .update({ order_status: status })
      .eq("id", orderId);
    if (error) throw error;
  },
};

export default ordersService;
