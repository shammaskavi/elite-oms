import { supabase } from "@/integrations/supabase/client";

export const invoicesService = {
  /**
   * Fetch all invoices with customer and order relations
   */
  async fetchInvoices(options?: { signal?: AbortSignal }) {
    let query = (supabase as any)
      .from("invoices")
      .select(
        `
        *, 
        customers(id, name, phone, email, address),
        orders(payment_status),
        invoice_payments(amount)
      `
      )
      .order("created_at", { ascending: false });

    if (options?.signal) {
      query = query.abortSignal(options.signal);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch single invoice by ID with complete relations
   */
  async fetchInvoiceById(id: string, signal?: AbortSignal) {
    let query = (supabase as any)
      .from("invoices")
      .select(
        `
        *,
        customers(id, name, phone, email, address),
        invoice_items(*),
        orders(*),
        invoice_payments(*)
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
   * Fetch payments for an invoice
   */
  async fetchInvoicePayments(invoiceId: string, signal?: AbortSignal) {
    let query = (supabase as any)
      .from("invoice_payments")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("created_at", { ascending: true });

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch orders and order_stages for a specific invoice
   */
  async fetchInvoiceOrdersWithStages(invoiceId: string, signal?: AbortSignal) {
    let query = (supabase as any)
      .from("orders")
      .select(
        `
        id,
        order_code,
        metadata,
        order_stages (
          id,
          stage_name,
          status,
          start_ts,
          end_ts,
          vendor_name,
          metadata
        )
      `
      )
      .eq("invoice_id", invoiceId);

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Settle an invoice with reason
   */
  async settleInvoice(id: string, reason: string) {
    const { error } = await (supabase as any)
      .from("invoices")
      .update({
        settled: true,
        settlement_reason: reason || "Manual settlement",
      })
      .eq("id", id);

    if (error) throw error;
  },

  /**
   * Fetch complete payments register (with customer and invoice relations)
   */
  async fetchPaymentsRegister(options?: { signal?: AbortSignal }) {
    let query = (supabase as any)
      .from("invoice_payments")
      .select(
        `
        id,
        amount,
        method,
        reference_id,
        remarks,
        date,
        invoices (
          id,
          invoice_number,
          customers (
            id,
            name
          )
        )
      `
      )
      .order("date", { ascending: false });

    if (options?.signal) {
      query = query.abortSignal(options.signal);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((p: any) => ({
      id: p.id,
      date: p.date,
      amount: Number(p.amount || 0),
      method: p.method || "cash",
      reference: p.reference_id || "",
      remarks: p.remarks || "",
      invoice_id: p.invoices?.id,
      invoice_number: p.invoices?.invoice_number ?? "—",
      customer_id: p.invoices?.customers?.id,
      customer_name: p.invoices?.customers?.name ?? "—",
    }));
  },

  /**
   * Delete an invoice and associated records
   */
  async deleteInvoice(id: string) {
    const { error } = await (supabase as any)
      .from("invoices")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};

export default invoicesService;
