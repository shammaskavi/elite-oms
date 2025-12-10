import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")!;
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

console.log("⚡ notify-order-deadlines loaded");

serve(async () => {
    try {
        console.log("🚀 Checking overdue orders...");

        const { data: overdueOrders, error: orderError } = await supabase
            .from("orders")
            .select("order_code, metadata->>item_name")
            .eq("order_status", "pending");

        if (orderError) throw orderError;

        if (!overdueOrders?.length) {
            console.log("ℹ️ No pending orders");
            return new Response("No orders", { status: 200 });
        }

        const { data: devices, error: deviceError } = await supabase
            .from("user_push_devices")
            .select("player_id");

        if (deviceError) throw deviceError;

        if (!devices?.length) {
            console.log("⚠️ No registered devices");
            return new Response("No devices", { status: 200 });
        }

        const playerIds = devices.map((d) => d.player_id);

        for (const order of overdueOrders) {
            const message = `❌ ${order.order_code} is overdue — ${order["metadata->>item_name"]}`;
            console.log("📤 Sending push:", message);

            const res = await fetch("https://api.onesignal.com/v1/notifications", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json; charset=utf-8",
                    Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
                },
                body: JSON.stringify({
                    app_id: ONESIGNAL_APP_ID,
                    include_player_ids: playerIds,
                    contents: { en: message },
                }),
            });

            const result = await res.json();
            console.log("📨 OneSignal Response:", result);
        }

        console.log("🎉 Notifications sent!");
        return new Response("Done", { status: 200 });
    } catch (err) {
        console.error("❌ ERROR:", err);
        return new Response(err.message, { status: 500 });
    }
});