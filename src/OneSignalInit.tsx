import { useEffect } from "react";
import OneSignal from "react-onesignal";
import { supabase } from "./integrations/supabase/client";


async function savePlayerId() {
    const id = OneSignal.User?.onesignalId;
    if (!id) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await (supabase as any)
        .from("user_push_devices")
        .upsert(
            {
                user_id: user.id,
                player_id: id,
                provider: "onesignal",
            },
            { onConflict: "player_id" }
        );

    console.log("📌 Player ID saved to Supabase:", id);
}

export function OneSignalInit() {
    useEffect(() => {
        async function init() {
            // OneSignal.getUserId().then(id => console.log("📌 Existing ID:", id));
            // OneSignal.User.getId().then(id => console.log("📌 Existing Player ID:", id));
            console.log("Existing ID:", OneSignal.User.onesignalId)
            console.log("🚀 OneSignal init starting...");

            await OneSignal.init({
                appId: import.meta.env.VITE_ONESIGNAL_APP_ID!,
                allowLocalhostAsSecureOrigin: false,
            });

            // Always show permission prompt (OneSignal handles dedupe)
            await OneSignal.Slidedown.promptPush();

            console.log("⏳ Waiting for OneSignal ID...");

            // 🔁 Poll until SDK exposes the onesignalId
            const poll = setInterval(async () => {
                const id = OneSignal.User?.onesignalId;
                const subscribed = OneSignal.User?.PushSubscription?.optedIn;

                if (id && subscribed) {
                    clearInterval(poll);
                    console.log("🆔 OneSignal ID detected:", id);
                    await savePlayerId();
                }
            }, 500);

            // 🔄 Detect subscription change after first load
            OneSignal.User?.PushSubscription?.addEventListener("change", async (e: any) => {
                if (e?.current?.optedIn) {
                    console.log("🆕 Subscription changed — saving ID");
                    await savePlayerId();
                }
            });
        }

        init();
    }, []);

    return null;
}