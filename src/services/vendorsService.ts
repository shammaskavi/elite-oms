import { supabase } from "@/integrations/supabase/client";

export const vendorsService = {
  /**
   * Fetch active vendors
   */
  async fetchVendors(options?: { activeOnly?: boolean; signal?: AbortSignal }) {
    let query = (supabase as any)
      .from("vendors")
      .select("*")
      .order("name", { ascending: true });

    if (options?.activeOnly !== false) {
      query = query.eq("active", true);
    }

    if (options?.signal) {
      query = query.abortSignal(options.signal);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch vendors by stage ID
   */
  async fetchVendorsByStage(stageId: string | null, signal?: AbortSignal) {
    if (!stageId) return [];

    let query = (supabase as any)
      .from("vendors")
      .select("*")
      .eq("stage_id", stageId)
      .order("name", { ascending: true });

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  /**
   * Fetch vendor by ID
   */
  async fetchVendorById(id: string, signal?: AbortSignal) {
    let query = (supabase as any)
      .from("vendors")
      .select("*")
      .eq("id", id);

    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error } = await query.maybeSingle();
    if (error) throw error;
    return data;
  },
};

export default vendorsService;
