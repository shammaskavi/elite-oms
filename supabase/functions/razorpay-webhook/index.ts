import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import crypto from "node:crypto";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const signature = req.headers.get("x-razorpay-signature");
  const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");
  const body = await req.text();

  if (!signature || !secret) return new Response("Unauthorized", { status: 401 });

  const expectedSignature = crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (expectedSignature !== signature) return new Response("Invalid signature", { status: 401 });

  const event = JSON.parse(body);
  if (event.event !== "payment.captured") return new Response("Ignored", { status: 200 });

  const payment = event.payload.payment.entity;
  const invoiceId = payment.notes?.invoice_id;

  // FORCE CONVERSION: Ensures we send a number, not a string ""
  // Razorpay sends amount in paise (200), we need 2.00
  const amountInRupees = Number(payment.amount) / 100;

  console.log(`Final Database Values - Invoice: ${invoiceId}, Amount: ${amountInRupees}`);

  if (!invoiceId || isNaN(amountInRupees)) {
    console.error("Missing Data Error: Invoice ID or Amount is invalid.");
    return new Response("Invalid Data", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // DATABASE INSERT
  const { error: insertErr } = await supabase
    .from("invoice_payments")
    .insert({
      invoice_id: invoiceId,
      amount: amountInRupees, // Passed as raw number to match numeric(10,2)
      method: "online_razorpay",
      reference_id: payment.id,
      date: new Date().toISOString(),
      remarks: `Razorpay Payment: ${payment.order_id}`
    });

  if (insertErr) {
    console.error("PostgreSQL Insert Error Details:", insertErr);
    return new Response(JSON.stringify(insertErr), { status: 500 });
  }

  // RECALCULATION: Triggered by your SQL Trigger automatically, 
  // but we call RPC as a fallback to ensure status column updates.
  await supabase.rpc("recalculate_invoice_payment_status", {
    p_invoice_id: invoiceId
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});