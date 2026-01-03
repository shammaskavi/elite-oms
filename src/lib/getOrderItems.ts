import { supabase } from "@/integrations/supabase/client";

export async function getOrderItems() {
  const { data, error } = await supabase
    .from("orders")
    .select(`
      id,
      created_at,
      invoice_id,
      metadata,

      invoices (
        id,
        invoice_number,
        customers (
          name,
          phone
        )
      ),

      order_stages (
        stage_name,
        vendor_name,
        created_at
      )
    `)
    .neq("order_status", "cancelled");

  if (error) throw error;

  return (data || []).map((order: any) => {
    // 1️⃣ Determine latest stage
    const stages = [...(order.order_stages || [])].sort(
      (a, b) =>
        new Date(a.created_at).getTime() -
        new Date(b.created_at).getTime()
    );

    const latestStage = stages[stages.length - 1];

    // 2️⃣ Normalize delivery date
    const deliveryDate =
      order.metadata?.delivery_date ??
      null;

    return {
      order_id: order.id,
      created_at: order.created_at,

      invoice_id: order.invoice_id,
      invoice_number: order.invoices?.invoice_number ?? "—",

      customer_name: order.invoices?.customers?.name ?? "—",
      customer_phone: order.invoices?.customers?.phone ?? null,

      item_name: order.metadata?.item_name ?? "—",
      item_index: order.metadata?.item_index ?? 0,
      delivery_date: deliveryDate,

      stage: latestStage?.stage_name ?? "Ordered",
      vendor_name: latestStage?.vendor_name ?? null,
    };
  });
}