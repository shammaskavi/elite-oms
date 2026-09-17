import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const verifyToken = Deno.env.get("WHATSAPP_VERIFY_TOKEN") || "spe_boutique_crm_verify_2026";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // --------------------------------------------------------------------------
  // 1. GET Request: Meta Webhook Verification Challenge
  // --------------------------------------------------------------------------
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token === verifyToken) {
      console.log("Meta WhatsApp Webhook successfully verified.");
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    } else {
      console.warn("Meta WhatsApp Webhook verification failed. Token mismatch.");
      return new Response("Forbidden", { status: 403 });
    }
  }

  // --------------------------------------------------------------------------
  // 2. POST Request: Incoming Message / Status Receipt
  // --------------------------------------------------------------------------
  if (req.method === "POST") {
    try {
      const body = await req.json();

      // Case A: Meta WhatsApp Cloud API Payload
      if (body.object === "whatsapp_business_account" && Array.isArray(body.entry)) {
        for (const entry of body.entry) {
          for (const change of entry.changes || []) {
            const value = change.value;
            if (!value) continue;

            // Handle Message Status Updates (sent, delivered, read, failed)
            if (Array.isArray(value.statuses)) {
              for (const status of value.statuses) {
                const wamid = status.id;
                const statusName = status.status; // 'sent' | 'delivered' | 'read' | 'failed'
                const errorMessage = status.errors?.[0]?.message || null;

                console.log(`WhatsApp Status Update: ${wamid} -> ${statusName}`);

                await supabase
                  .from("whatsapp_messages")
                  .update({
                    status: statusName,
                    error_message: errorMessage,
                  })
                  .eq("wamid", wamid);
              }
            }

            // Handle Incoming Messages
            if (Array.isArray(value.messages)) {
              for (const message of value.messages) {
                const senderPhone = message.from; // e.g. "919876543210"
                const wamid = message.id;
                const timestamp = new Date(parseInt(message.timestamp, 10) * 1000).toISOString();
                const contactProfile = (value.contacts || []).find((c: any) => c.wa_id === senderPhone);
                const senderName = contactProfile?.profile?.name || `Customer ${senderPhone.slice(-4)}`;

                let messageType = "text";
                let textBody = "";
                let mediaUrl: string | null = null;
                let mediaType: string | null = null;

                if (message.type === "text") {
                  textBody = message.text?.body || "";
                } else if (message.type === "image") {
                  messageType = "image";
                  mediaUrl = message.image?.id || null;
                  textBody = message.image?.caption || "[Image]";
                } else if (message.type === "document") {
                  messageType = "document";
                  mediaUrl = message.document?.id || null;
                  textBody = message.document?.caption || message.document?.filename || "[Document]";
                } else if (message.type === "interactive") {
                  textBody = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || "[Interactive Selection]";
                } else {
                  textBody = `[${message.type || "Media"}]`;
                }

                console.log(`Incoming WhatsApp Message from ${senderPhone} (${senderName}): ${textBody}`);

                // Step 1: Look up or auto-link Customer by phone
                let customerId: string | null = null;
                const cleanLast10 = senderPhone.replace(/\D/g, "").slice(-10);

                const { data: existingCustomer } = await supabase
                  .from("customers")
                  .select("id, name")
                  .or(`phone.ilike.%${cleanLast10}%,phone.eq.${senderPhone}`)
                  .limit(1)
                  .maybeSingle();

                if (existingCustomer) {
                  customerId = existingCustomer.id;
                } else {
                  // Auto-create prospective boutique customer
                  const { data: newCustomer } = await supabase
                    .from("customers")
                    .insert({
                      name: senderName,
                      phone: senderPhone,
                      lifecycle_status: "prospect",
                      elite_circle_level: "bronze",
                    })
                    .select("id")
                    .single();

                  if (newCustomer) {
                    customerId = newCustomer.id;
                  }
                }

                if (!customerId) continue;

                // Step 2: Get or create WhatsApp Conversation
                let conversationId: string | null = null;
                const { data: existingConvo } = await supabase
                  .from("whatsapp_conversations")
                  .select("id, unread_count")
                  .eq("customer_id", customerId)
                  .maybeSingle();

                if (existingConvo) {
                  conversationId = existingConvo.id;
                  await supabase
                    .from("whatsapp_conversations")
                    .update({
                      phone_number: senderPhone,
                      last_message_at: timestamp,
                      last_customer_message_at: timestamp,
                      unread_count: (existingConvo.unread_count || 0) + 1,
                      status: "open",
                    })
                    .eq("id", conversationId);
                } else {
                  const { data: newConvo } = await supabase
                    .from("whatsapp_conversations")
                    .insert({
                      customer_id: customerId,
                      phone_number: senderPhone,
                      last_message_at: timestamp,
                      last_customer_message_at: timestamp,
                      unread_count: 1,
                      status: "open",
                    })
                    .select("id")
                    .single();

                  if (newConvo) conversationId = newConvo.id;
                }

                if (!conversationId) continue;

                // Step 3: Insert message into database
                await supabase
                  .from("whatsapp_messages")
                  .insert({
                    conversation_id: conversationId,
                    customer_id: customerId,
                    wamid: wamid,
                    direction: "inbound",
                    message_type: messageType,
                    text_body: textBody,
                    media_url: mediaUrl,
                    media_type: mediaType,
                    sender_name: senderName,
                    status: "delivered",
                    sent_at: timestamp,
                  });

                // Step 4: Add to CRM Activity stream
                await supabase
                  .from("crm_activity_events")
                  .insert({
                    customer_id: customerId,
                    event_type: "whatsapp_received",
                    title: "Incoming WhatsApp Message",
                    description: textBody.substring(0, 100),
                    actor_name: senderName,
                  });
              }
            }
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Case B: AiSensy Webhook Payload
      if (body.topic === "message" || body.incoming_message || body.data?.message) {
        const msgData = body.data || body;
        const senderPhone = String(msgData.phone || msgData.user_number || "").replace(/\D/g, "");
        const senderName = msgData.user_name || msgData.name || `Customer ${senderPhone.slice(-4)}`;
        const textBody = msgData.message || msgData.text || msgData.content || "";
        const cleanLast10 = senderPhone.slice(-10);

        if (senderPhone && textBody) {
          // Look up customer
          let customerId: string | null = null;
          const { data: existingCustomer } = await supabase
            .from("customers")
            .select("id")
            .or(`phone.ilike.%${cleanLast10}%,phone.eq.${senderPhone}`)
            .limit(1)
            .maybeSingle();

          if (existingCustomer) {
            customerId = existingCustomer.id;
          } else {
            const { data: newCustomer } = await supabase
              .from("customers")
              .insert({
                name: senderName,
                phone: senderPhone,
                lifecycle_status: "prospect",
              })
              .select("id")
              .single();
            if (newCustomer) customerId = newCustomer.id;
          }

          if (customerId) {
            // Upsert conversation
            const { data: convo } = await supabase
              .from("whatsapp_conversations")
              .upsert(
                {
                  customer_id: customerId,
                  phone_number: senderPhone,
                  last_message_at: new Date().toISOString(),
                  last_customer_message_at: new Date().toISOString(),
                  status: "open",
                },
                { onConflict: "customer_id" }
              )
              .select("id")
              .single();

            if (convo) {
              await supabase.from("whatsapp_messages").insert({
                conversation_id: convo.id,
                customer_id: customerId,
                direction: "inbound",
                message_type: "text",
                text_body: textBody,
                sender_name: senderName,
                status: "delivered",
                sent_at: new Date().toISOString(),
              });
            }
          }
        }

        return new Response(JSON.stringify({ success: true, provider: "aisensy" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ received: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (err: any) {
      console.error("WhatsApp Webhook processing error:", err);
      return new Response(JSON.stringify({ error: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  return new Response("Method not allowed", { status: 405 });
});
