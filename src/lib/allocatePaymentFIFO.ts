export type InvoiceForAllocation = {
    invoice_id: string;
    invoice_number: string;
    collectibleDue: number;
};

export type InvoiceAllocation = {
    invoice_id: string;
    invoice_number: string;
    allocated: number;
};

export function allocatePaymentFIFO(
    invoices: InvoiceForAllocation[],
    paymentAmount: number
): InvoiceAllocation[] {
    let remaining = paymentAmount;
    const allocations: InvoiceAllocation[] = [];

    for (const invoice of invoices) {
        if (remaining <= 0) break;
        if (invoice.collectibleDue <= 0) continue;

        const allocated = Math.min(invoice.collectibleDue, remaining);

        allocations.push({
            invoice_id: invoice.invoice_id,
            invoice_number: invoice.invoice_number,
            allocated,
        });

        remaining -= allocated;
    }

    return allocations;
}