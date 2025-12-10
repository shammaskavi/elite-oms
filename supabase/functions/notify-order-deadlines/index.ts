import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID")!;
const ONESIGNAL_REST_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY")!;

serve(async () => {
    console.log("🔔 Starting Order Deadline Notification job...");

    const { data: devices } = await supabase
        .from("user_push_devices")
        .select("player_id");

    if (!devices || devices.length === 0) {
        console.log("⚠️ No user devices found — exiting.");
        return new Response("No devices", { status: 200 });
    }

    for (const device of devices) {
        console.log(`📤 Sending push → Player: ${device.player_id}`);

        const payload = {
            app_id: ONESIGNAL_APP_ID,
            include_subscription_ids: [device.player_id],
            headings: { en: "Order Overdue" },
            contents: { en: `Invoice is overdue.` },
            url: "https://elite-oms.vercel.app/orders",
        };

        // Make the request
        const res = await fetch("https://api.onesignal.com/notifications", {
            method: "POST",
            headers: {
                Authorization: `Basic ${ONESIGNAL_REST_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const json = await res.json();

        console.log("📬 OneSignal Response:", JSON.stringify(json, null, 2));
    }

    console.log("🎉 Notifications sent!");
    return new Response("ok", { status: 200 });
});