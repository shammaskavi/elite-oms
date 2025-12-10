// functions/notify-order-deadlines/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")!;
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;

// Initialize Supabase client inside Edge Function
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log("⚡️ Edge Function loaded: notify-order-deadlines");

serve(async (req) => {
    try {
        console.log("🚀 Starting Order Deadline Notification job...");

        // 1️⃣ Fetch overdue orders
        const { data: overdueOrders, error: orderError } = await supabase
            .from("orders")
            .select("invoice_no, product_name")
            .eq("status", "pending"); // Change if needed

        if (orderError) throw orderError;

        // 2️⃣ Fetch registered push device tokens
        const { data: devices, error: deviceError } = await supabase
            .from("user_push_devices")
            .select("player_id");

        if (deviceError) throw deviceError;

        if (!devices.length) {
            console.log("⚠️ No devices registered for push notifications");
            return new Response("No devices", { status: 200 });
        }

        for (const order of overdueOrders ?? []) {
            const message = `❌ ${order.invoice_no} is overdue — ${order.product_name}`;

            console.log("📤 Sending push:", message);

            // 3️⃣ Send push via OneSignal REST API
            await fetch("https://api.onesignal.com/notification", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${ONESIGNAL_REST_API_KEY}`,
                },
                body: JSON.stringify({
                    app_id: ONESIGNAL_APP_ID,
                    include_player_ids: devices.map((d) => d.player_id),
                    contents: { en: message },
                }),
            });
        }

        console.log("🎉 Notifications sent!");
        return new Response("Done", { status: 200 });

    } catch (err) {
        console.error("❌ ERROR:", err);
        return new Response(err.message, { status: 500 });
    }
});