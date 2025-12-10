import { useEffect } from "react";
import OneSignal from "react-onesignal";
import { supabase } from "./integrations/supabase/client";

async function savePlayerId() {
    const id = await OneSignal.User.getId();
    if (!id) return;

    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
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
            console.log("🚀 OneSignal init starting...");

            await OneSignal.init({
                appId: import.meta.env.VITE_ONESIGNAL_APP_ID!,
                allowLocalhostAsSecureOrigin: false,
            });

            await OneSignal.Slidedown.promptPush();
            console.log("⏳ Waiting for OneSignal Player ID...");

            const poll = setInterval(async () => {
                const id = await OneSignal.User.getId();
                const subscribed = OneSignal.User.PushSubscription.optedIn;

                if (id && subscribed) {
                    clearInterval(poll);
                    console.log("🆔 OneSignal Player ID detected:", id);
                    await savePlayerId();
                }
            }, 500);

            OneSignal.User.PushSubscription.addEventListener("change", async (e: any) => {
                if (e?.current?.optedIn) {
                    console.log("🆕 Subscription changed — saving Player ID");
                    await savePlayerId();
                }
            });
        }

        init();
    }, []);

    return null;
}