export type DerivedInvoiceState = {
    label: "paid" | "unpaid" | "partial" | "settled";
    isPaid: boolean;
    isUnpaid: boolean;
    isPartial: boolean;
    isSettled: boolean;
};

export function deriveInvoiceState(invoice: any): DerivedInvoiceState {
    const paymentStatus = invoice?.payment_status;
    const settled = invoice?.settled === true;

    // 🔒 Settlement overrides workflow visibility
    if (settled) {
        return {
            label: "settled",
            isPaid: false,
            isUnpaid: false,
            isPartial: false,
            isSettled: true,
        };
    }

    return {
        label: paymentStatus,
        isPaid: paymentStatus === "paid",
        isPartial: paymentStatus === "partial",
        isUnpaid: paymentStatus === "unpaid",
        isSettled: false,
    };
}