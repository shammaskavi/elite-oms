// src/lib/allocatePayment.ts

export type InvoiceDue = {
    invoice_id: string;
    due: number;
};

export type PaymentAllocation = {
    invoice_id: string;
    amount: number;
};

/**
 * Allocates a lump-sum payment across invoices
 * using FIFO (oldest invoice first).
 *
 * - Pure function
 * - No side effects
 * - Deterministic
 */
export function allocatePayment(
    paymentAmount: number,
    invoices: InvoiceDue[]
): PaymentAllocation[] {
    let remaining = paymentAmount;
    const allocations: PaymentAllocation[] = [];

    for (const invoice of invoices) {
        if (remaining <= 0) break;
        if (invoice.due <= 0) continue;

        const allocated = Math.min(invoice.due, remaining);

        allocations.push({
            invoice_id: invoice.invoice_id,
            amount: allocated,
        });

        remaining -= allocated;
    }

    return allocations;
}