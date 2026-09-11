import { supabase } from "@/integrations/supabase/client";

/**
 * Normalizes phone numbers for WhatsApp URL (wa.me/{phone})
 * Handles +91, 10-digit Indian numbers, leading zeros, and international numbers with +.
 */
export function normalizeWhatsAppPhone(rawPhone?: string | null): string | null {
    if (!rawPhone) return null;
    let trimmed = String(rawPhone).trim().replace(/[^\d+]/g, "");
    if (!trimmed) return null;

    // If starts with +, strip + and keep country code
    if (trimmed.startsWith("+")) {
        return trimmed.replace(/\D/g, "");
    }

    // Strip leading zeroes (e.g., 09876543210 -> 9876543210)
    trimmed = trimmed.replace(/^0+/, "");

    // 10 digits -> Indian mobile number, prefix with 91
    if (trimmed.length === 10) {
        return `91${trimmed}`;
    }

    // 12 digits starting with 91 -> keep as is
    if (trimmed.length === 12 && trimmed.startsWith("91")) {
        return trimmed;
    }

    // If length > 10 (e.g. international format), return raw digits
    return trimmed;
}

/**
 * Open WhatsApp URL in a new window/tab
 */
export function openWhatsApp(phone: string, text: string): void {
    const cleanPhone = normalizeWhatsAppPhone(phone);
    if (!cleanPhone) {
        throw new Error("Invalid or missing customer phone number");
    }
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
}

/**
 * Ensures a unique tracking token exists for an invoice, generating one if needed
 */
export async function ensureInvoiceTrackingToken(invoiceId: string): Promise<string> {
    const { data, error } = await supabase
        .from("invoices")
        .select("tracking_token")
        .eq("id", invoiceId)
        .single();

    if (error) throw error;

    if (data?.tracking_token) {
        return data.tracking_token;
    }

    const token = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2) + Date.now().toString(36);

    const { error: updateError } = await supabase
        .from("invoices")
        .update({ tracking_token: token })
        .eq("id", invoiceId);

    if (updateError) throw updateError;

    return token;
}

/**
 * Build settlement-aware customer payment reminder message
 */
export function buildCustomerPaymentReminder({
    customerName,
    totalOutstanding,
    unpaidInvoices = [],
}: {
    customerName: string;
    totalOutstanding: number;
    unpaidInvoices: Array<{
        invoice_number: string;
        date?: string;
        collectibleDue: number;
    }>;
}): string {
    const formattedTotal = totalOutstanding.toLocaleString("en-IN");
    
    let invoiceList = "";
    if (unpaidInvoices.length > 0) {
        invoiceList = unpaidInvoices
            .map((inv) => {
                const dateStr = inv.date
                    ? ` (${new Date(inv.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })})`
                    : "";
                return `• Invoice #${inv.invoice_number}${dateStr}: ₹${inv.collectibleDue.toLocaleString("en-IN")}`;
            })
            .join("\n");
    }

    return `
Hello ${customerName || "Customer"} ✨

Greetings from *Saree Palace Elite*!

This is a gentle reminder regarding your outstanding balance of *₹${formattedTotal}*.

${invoiceList ? `📋 *Pending Invoices:*\n${invoiceList}\n` : ""}
You may settle this balance via UPI or at our boutique upon your visit. If you have already made this payment or have any queries, please let us know.

Warm regards,
*Saree Palace Elite*
`.trim();
}

/**
 * Build stage notification message (Packed, Dispatched, Delivered)
 */
export function buildStageNotificationMessage({
    stage,
    customerName,
    invoiceNumber,
    itemName,
    balanceDue = 0,
    isSettled = false,
    trackingUrl,
}: {
    stage: string;
    customerName: string;
    invoiceNumber?: string;
    itemName?: string;
    balanceDue?: number;
    isSettled?: boolean;
    trackingUrl?: string;
}): string {
    const normalizedStage = (stage || "").toLowerCase();
    const itemLabel = itemName ? `*${itemName}*` : "Your order";
    const invoiceLabel = invoiceNumber ? ` (Invoice: *#${invoiceNumber}*)` : "";
    
    // Balance due text
    let balanceText = "Paid in full ✅";
    if (isSettled) {
        balanceText = "Settled ✅";
    } else if (balanceDue > 0) {
        balanceText = `₹${balanceDue.toLocaleString("en-IN")}`;
    }

    if (normalizedStage.includes("pack") || normalizedStage.includes("ready")) {
        return `
Hello ${customerName || ""} ✨

Great news! ${itemLabel}${invoiceLabel} is completed, quality-checked, and *packed ready for pickup* at Saree Palace Elite! 🛍️

📋 *Order Details:*
• Status: *Ready for Pickup / Packed*
• Balance Due at Pickup: *${balanceText}*

📍 *Store Address:* Saree Palace Elite
${trackingUrl ? `\n📦 *Track your order anytime:*\n${trackingUrl}\n` : ""}
We look forward to welcoming you soon!

Warm regards,
*Saree Palace Elite*
`.trim();
    }

    if (normalizedStage.includes("dispatch")) {
        return `
Hello ${customerName || ""} ✨

Your order ${itemLabel}${invoiceLabel} has been *dispatched for delivery*! 🚚

${balanceDue > 0 && !isSettled ? `💰 *Balance Due on Delivery:* ₹${balanceDue.toLocaleString("en-IN")}\n` : ""}
${trackingUrl ? `📦 *Track live status here:*\n${trackingUrl}\n` : ""}
Please reach out to us if you need any assistance with your delivery.

Warm regards,
*Saree Palace Elite*
`.trim();
    }

    if (normalizedStage.includes("deliver")) {
        return `
Hello ${customerName || ""} ✨

Your order ${itemLabel}${invoiceLabel} has been *successfully delivered*! 🎉

Thank you for choosing *Saree Palace Elite*. We hope you love your outfit! If you need any alterations or styling assistance, please don't hesitate to reach out.

Warm regards,
*Saree Palace Elite*
`.trim();
    }

    // Default stage fallback
    return `
Hello ${customerName || ""} ✨

Your order ${itemLabel}${invoiceLabel} is now in stage: *${stage}*.

${trackingUrl ? `📦 *Track live progress:*\n${trackingUrl}\n` : ""}
Warm regards,
*Saree Palace Elite*
`.trim();
}
