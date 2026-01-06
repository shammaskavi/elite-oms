export type DerivedInvoiceState = {
    label: "paid" | "unpaid" | "partial" | "settled";
    isPaid: boolean;
    isUnpaid: boolean;
    isPartial: boolean;
    isSettled: boolean;

    /**
     * Business-collectible due amount.
     * - For settled invoices → always 0
     * - For others → remaining amount
     */
    collectibleDue: number;
};

export function deriveInvoiceState(
    invoice: any,
    paymentStatus: {
        paid: number;
        remaining: number;
        status: "paid" | "partial" | "unpaid";
    }
): DerivedInvoiceState {
    const settled = invoice?.settled === true;

    // 🔒 Settlement overrides business collectibility
    if (settled) {
        return {
            label: "settled",
            isPaid: false,
            isUnpaid: false,
            isPartial: false,
            isSettled: true,
            collectibleDue: 0,
        };
    }

    const status = paymentStatus.status;

    return {
        label: status,
        isPaid: status === "paid",
        isPartial: status === "partial",
        isUnpaid: status === "unpaid",
        isSettled: false,
        collectibleDue: paymentStatus.remaining,
    };
}