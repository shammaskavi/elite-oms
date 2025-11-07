import { pdf } from "@react-pdf/renderer";
import axios from "axios";
import { supabase } from "@/lib/supabaseClient";
import { PrintableInvoice } from "@/components/PrintableInvoice";

const WA_WEBHOOK_URL =
    "https://app.wanotifier.com/api/v1/notifications/PNZmRBoX2G?key=A9DK378ZaegHsE4ER7r9LQNC0IdbpH";

/**
 * Generates PDF -> uploads to Supabase -> sends via WA Notifier
 */
export async function sendInvoiceWhatsApp(data) {
    try {
        const customerPhone = String(data.customers?.mobile || "").replace(/\D/g, "");
        if (!customerPhone) throw new Error("Missing customer phone number");

        // 1️⃣ Generate invoice PDF
        const blob = await pdf(<PrintableInvoice data={ data } />).toBlob();

        // 2️⃣ Upload to Supabase Storage
        const fileName = `invoice-${data.invoice_number}.pdf`;
        const { data: upload, error } = await supabase.storage
            .from("invoices")
            .upload(fileName, blob, {
                contentType: "application/pdf",
                upsert: true,
            });
        if (error) throw error;

        const publicUrl = supabase.storage
            .from("invoices")
            .getPublicUrl(upload.path).data.publicUrl;

        // 3️⃣ Send to WA Notifier
        const message = `Hello ${data.customers?.name || ""}! 👋
Here is your Saree Palace Elite invoice.
💰 Total: ₹${data.total.toLocaleString()}
🧾 Invoice No: ${data.invoice_number}`;

        await axios.post(WA_WEBHOOK_URL, {
            to: `91${customerPhone}`,     // full international format
            message,
            invoice_number: data.invoice_number,
            total: `₹${data.total.toLocaleString()}`,
            invoice_url: publicUrl,       // mapped to Header document url in WA Notifier
        });

        return { success: true, url: publicUrl };
    } catch (err) {
        console.error("❌ WhatsApp send failed:", err);
        return { success: false, error: err.message };
    }
}
