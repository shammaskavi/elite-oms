import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "spe.last_max_invoice_num";
// Production baseline: Saree Palace Elite has already crossed 541 invoices.
// The sequence must NEVER fall back below this baseline.
const PRODUCTION_BASELINE = 541;

/**
 * Gets the highest known invoice number from localStorage or baseline.
 */
export function getStoredMaxInvoiceNumber(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? parseInt(stored, 10) : 0;
    return Math.max(parsed || 0, PRODUCTION_BASELINE);
  } catch {
    return PRODUCTION_BASELINE;
  }
}

/**
 * Persists the highest seen invoice number to localStorage.
 */
export function updateStoredMaxInvoiceNumber(candidate: number): void {
  try {
    if (isNaN(candidate) || candidate <= 0) return;
    const current = getStoredMaxInvoiceNumber();
    if (candidate > current) {
      localStorage.setItem(STORAGE_KEY, String(candidate));
    }
  } catch {
    // localStorage may be disabled or full; silently ignore
  }
}

/**
 * Extracts the integer portion of an invoice number string like "INV-541" -> 541.
 */
export function parseInvoiceNum(invoiceNumber?: string | null): number {
  if (!invoiceNumber) return 0;
  const match = String(invoiceNumber).match(/INV-(\d+)/i);
  if (!match) return 0;
  const num = parseInt(match[1], 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Robustly generates the next sequential invoice number.
 * 
 * Multi-layer defense:
 * 1. Checks localStorage + production baseline (541+) -> instant, offline-proof.
 * 2. Checks in-memory invoice list from React Query cache (if available).
 * 3. Queries Supabase for all invoice numbers to catch numbers created from other devices.
 * 4. Takes the true Math.max across all layers.
 * 
 * It is mathematically impossible for this to return INV-001 or INV-002.
 */
export async function getNextInvoiceNumber(inMemoryInvoices?: Array<{ invoice_number?: string }>): Promise<string> {
  let maxNum = getStoredMaxInvoiceNumber();

  // Layer 1: In-memory invoices (fastest)
  if (inMemoryInvoices && Array.isArray(inMemoryInvoices)) {
    for (const inv of inMemoryInvoices) {
      const num = parseInvoiceNum(inv.invoice_number);
      if (num > maxNum) {
        maxNum = num;
      }
    }
  }

  // Layer 2: Direct DB query (catches invoices made on other shop counters/devices)
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("invoice_number");

    if (!error && data && data.length > 0) {
      for (const inv of data) {
        const num = parseInvoiceNum(inv.invoice_number);
        if (num > maxNum) {
          maxNum = num;
        }
      }
    }
  } catch (err) {
    console.warn("DB invoice fetch failed; safely using local max:", err);
  }

  // Save the highest number discovered
  updateStoredMaxInvoiceNumber(maxNum);

  const nextNum = maxNum + 1;
  return `INV-${String(nextNum).padStart(3, "0")}`;
}
