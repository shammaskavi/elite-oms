import { supabase } from "@/integrations/supabase/client";

export const customersService = {
  /**
   * Fetch customer list
   */
  async fetchCustomers(options?: { signal?: AbortSignal }) {
    let query = (supabase as any)
      .from("customers")
      .select("id, name, phone, email, address")
      .order("name", { ascending: true });

    if (options?.signal) {
      query = query.abortSignal(options.signal);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch customers with joined invoices for customer ledger & analytics
   */
  async fetchCustomersWithInvoices(options?: { signal?: AbortSignal }) {
    let query = (supabase as any)
      .from("customers")
      .select(
        `
        *,
        invoices (
          id,
          status,
          total,
          payment_status,
          settled,
          raw_payload,
          invoice_payments (
            id,
            amount
          )
        )
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
   * Fetch customer by ID with full relations
   */
  async fetchCustomerById(id: string, signal?: AbortSignal) {
    let query = (supabase as any)
      .from("customers")
      .select("*")
      .eq("id", id);

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  },

  /**
   * Create a new customer
   */
  async createCustomer(payload: any) {
    const { data, error } = await (supabase as any)
      .from("customers")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update customer profile
   */
  async updateCustomer(id: string, payload: any) {
    const { data, error } = await (supabase as any)
      .from("customers")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete customer (validates related invoices first)
   */
  async deleteCustomer(id: string) {
    const { data: relatedInvoices, error: checkError } = await (
      supabase as any
    )
      .from("invoices")
      .select("id")
      .eq("customer_id", id);

    if (checkError) throw checkError;

    if (relatedInvoices && relatedInvoices.length > 0) {
      throw new Error(
        `Cannot delete: customer has ${relatedInvoices.length} existing invoice(s).`
      );
    }

    const { error } = await (supabase as any)
      .from("customers")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};

export default customersService;
