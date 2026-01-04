import { supabase } from "@/integrations/supabase/client";

export type DerivedPaymentStatus = {
    status: "paid" | "partial" | "unpaid";
    paid: number;
    remaining: number;
};

function safeParsePayload(raw: any): any {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try {
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

// ✅ PURE VERSION (no DB calls)
export function derivePaymentStatusFromData(
    invoice: any,
    payments: { amount: number }[]
): DerivedPaymentStatus {
    const total = parseFloat(String(invoice.total ?? 0)) || 0;

    const payload =
        typeof invoice.raw_payload === "object"
            ? invoice.raw_payload
            : (() => {
                try {
                    return JSON.parse(invoice.raw_payload || "{}");
                } catch {
                    return {};
                }
            })();

    // 1️⃣ Legacy paid (stored in raw_payload)
    const legacyPaid = parseFloat(String(payload?.paid_amount ?? 0)) || 0;

    // 2️⃣ Payments from DB (passed in)
    const dbPaid = (payments || []).reduce((sum, p) => {
        const n = parseFloat(String(p.amount ?? 0));
        return sum + (isNaN(n) ? 0 : n);
    }, 0);

    // 3️⃣ Combine both
    let paid = legacyPaid + dbPaid;
    if (!isFinite(paid)) paid = 0;
    paid = Math.max(0, Math.min(paid, total));

    const remaining = Math.max(0, total - paid);

    let status: "paid" | "partial" | "unpaid" = "unpaid";
    if (total === 0) status = "paid";
    else if (paid >= total - 0.5) status = "paid";
    else if (paid > 0) status = "partial";

    return { status, paid, remaining };
}

export async function derivePaymentStatus(invoice: any): Promise<DerivedPaymentStatus> {
    const total = parseFloat(String(invoice.total ?? 0)) || 0;
    const payload = safeParsePayload(invoice.raw_payload);

    /** -------------------------
     * 1️⃣ LEGACY PAID FIELDS
     --------------------------*/
    const legacyPaid = parseFloat(String(payload?.paid_amount ?? 0)) || 0;

    /** -------------------------
     * 2️⃣ DB PAYMENTS
     --------------------------*/
    let payments: { amount: number }[] = [];

    try {
        const { data } = await (supabase as any)
            .from("invoice_payments")
            .select("amount")
            .eq("invoice_id", invoice.id);

        payments = data || [];
    } catch (err) {
        console.warn("Invoice payment fetch failed:", err);
    }

    const dbPaid = payments.reduce((sum, p) => {
        const n = parseFloat(String(p.amount ?? 0));
        return sum + (isNaN(n) ? 0 : n);
    }, 0);

    /** -------------------------
     * 3️⃣ RECONCILED SOURCE OF TRUTH
     * Combine legacy + dbPaid
     --------------------------*/
    let paid = legacyPaid + dbPaid;

    // Clamp to valid range
    if (!isFinite(paid)) paid = 0;
    paid = Math.max(0, Math.min(paid, total));

    /** -------------------------
     * 4️⃣ STATUS DERIVATION
     --------------------------*/
    const remaining = Math.max(0, total - paid);

    let status: "paid" | "partial" | "unpaid" = "unpaid";
    if (total === 0) status = "paid";
    else if (paid >= total - 0.5) status = "paid";
    else if (paid > 0) status = "partial";

    return { status, paid, remaining };
}