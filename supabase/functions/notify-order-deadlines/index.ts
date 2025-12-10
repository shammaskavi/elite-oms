// functions/notify-order-deadlines/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")!;
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;

// Initialize Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log("⚡ Edge Function Loaded: notify-order-deadlines");

serve(async () => {
    try {
        console.log("🚀 Starting Order Deadline Notification job...");

        // 1️⃣ Fetch pending orders
        const { data: overdueOrders, error: orderError } = await supabase
            .from("orders")
            .select("order_code, metadata->>item_name")
            .eq("order_status", "pending"); // <-- your confirmed condition

        if (orderError) throw orderError;

        if (!overdueOrders?.length) {
            console.log("✔️ No pending orders found");
            return new Response("No pending orders", { status: 200 });
        }

        // 2️⃣ Fetch OneSignal device tokens
        const { data: devices, error: deviceError } = await supabase
            .from("user_push_devices")
            .select("player_id");

        if (deviceError) throw deviceError;

        if (!devices?.length) {
            console.log("⚠️ No users registered for push notifications");
            return new Response("No devices", { status: 200 });
        }

        const playerIds = devices.map((d) => d.player_id);

        // 3️⃣ Send notifications
        for (const order of overdueOrders) {
            const productName = order["metadata->>item_name"];
            const msg = `❌ ${order.order_code} is overdue — ${productName}`;

            console.log("📤 Sending push:", msg);

            await fetch("https://api.onesignal.com/v1/notifications", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
                },
                body: JSON.stringify({
                    app_id: ONESIGNAL_APP_ID,
                    include_player_ids: playerIds,
                    contents: { en: msg },
                }),
            });
        }

        console.log("🎉 Notifications sent successfully!");
        return new Response("Done", { status: 200 });

    } catch (err) {
        console.error("❌ ERROR:", err);
        return new Response(err.message ?? "Internal Error", { status: 500 });
    }
});