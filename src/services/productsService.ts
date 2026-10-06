import { supabase } from "@/integrations/supabase/client";

export const productsService = {
  /**
   * Fetch all products with stock_units count
   */
  async fetchProducts(options?: { signal?: AbortSignal }) {
    let query = (supabase as any)
      .from("products")
      .select("*, stock_units(count)")
      .order("created_at", { ascending: false });

    if (options?.signal) {
      query = query.abortSignal(options.signal);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch product by ID
   */
  async fetchProductById(id: string, signal?: AbortSignal) {
    let query = (supabase as any)
      .from("products")
      .select("*, stock_units(*)")
      .eq("id", id);

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  },

  /**
   * Fetch stock units
   */
  async fetchStockUnits(productId?: string, signal?: AbortSignal) {
    let query = (supabase as any)
      .from("stock_units")
      .select("*, location:locations(*), product:products(*)")
      .order("date_received", { ascending: false });

    if (productId) {
      query = query.eq("product_id", productId);
    }

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Create a new product
   */
  async createProduct(payload: any) {
    const { data, error } = await (supabase as any)
      .from("products")
      .insert([payload])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update product
   */
  async updateProduct(id: string, payload: any) {
    const { data, error } = await (supabase as any)
      .from("products")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete product
   */
  async deleteProduct(id: string) {
    const { error } = await (supabase as any)
      .from("products")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },
};

export default productsService;
