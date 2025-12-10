// supabase/functions/notify-order-deadlines/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.33.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ONESIGNAL_API_KEY = Deno.env.get("ONESIGNAL_API_KEY")!;
const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;

// OWNER — receives deadline alerts
const OWNER_ID = "09e15129-716b-4ba2-b39f-0e0c34dc2791";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

serve(async () => {
    console.log("🔔 Starting Order Deadline Notification job...");

    // 1️⃣ Fetch devices for Owner
    const { data: devices, error: deviceErr } = await supabase
        .from("user_push_devices")
        .select("player_id")
        .eq("user_id", OWNER_ID);

    if (deviceErr) {
        console.error("❌ Error fetching devices:", deviceErr);
        return new Response("error fetching devices", { status: 500 });
    }

    if (!devices?.length) {
        console.warn("⚠️ No devices registered for owner");
        return new Response("no devices", { status: 200 });
    }

    const playerIds = devices.map((d: { player_id: string }) => d.player_id);
    console.log("📌 Sending notifications to:", playerIds);

    // 2️⃣ Fetch order groups by deadline status
    const { data: dueToday, error: errToday } = await supabase.rpc("orders_due_today");
    const { data: dueTomorrow, error: errTomorrow } = await supabase.rpc("orders_due_tomorrow");
    const { data: overdue, error: errOver } = await supabase.rpc("orders_overdue");

    if (errToday) console.error("❌ Error orders due today:", errToday);
    if (errTomorrow) console.error("❌ Error orders due tomorrow:", errTomorrow);
    if (errOver) console.error("❌ Error overdue orders:", errOver);

    const promises: Promise<any>[] = [];

    const push = (msg: string) => {
        console.log("📤 Sending push:", msg);
        promises.push(
            fetch("https://api.onesignal.com/notifications", {
                method: "POST",
                headers: {
                    "Authorization": `Basic ${ONESIGNAL_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    app_id: ONESIGNAL_APP_ID,
                    include_player_ids: playerIds, // 🟢 FIXED KEY
                    headings: { en: "Order Deadline Alert" },
                    contents: { en: msg },
                }),
            })
        );
    };

    // 3️⃣ Build notifications
    for (const order of dueToday ?? []) {
        push(`⏰ ${order.order_code} is due today — ${order.metadata.item_name}`);
    }

    for (const order of dueTomorrow ?? []) {
        push(`⏳ ${order.order_code} is due tomorrow — ${order.metadata.item_name}`);
    }

    for (const order of overdue ?? []) {
        push(`❌ ${order.order_code} is overdue — ${order.metadata.item_name}`);
    }

    // 4️⃣ Execute all push requests
    if (promises.length > 0) {
        await Promise.all(promises);
        console.log("🎉 Notifications sent!");
    } else {
        console.log("ℹ️ No orders requiring notification");
    }

    return new Response("ok", { status: 200 });
});