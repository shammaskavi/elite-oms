import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const metaAccessToken = Deno.env.get("WHATSAPP_ACCESS_TOKEN");
    const metaPhoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
    const aisensyApiKey = Deno.env.get("AISENSY_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { to, type = "text", text, template, customerId, conversationId, senderName = "Staff" } = body;

    if (!to) {
      return new Response(JSON.stringify({ error: "Missing recipient phone number ('to')" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPhone = String(to).replace(/\D/g, "");
    let wamid: string | null = null;
    let outboundStatus = "sent";
    let errorMessage: string | null = null;

    // ------------------------------------------------------------------------
    // Mode 1: Meta WhatsApp Cloud API (Primary & Direct)
    // ------------------------------------------------------------------------
    if (metaAccessToken && metaPhoneNumberId) {
      let metaPayload: any = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
      };

      if (type === "template" && template?.name) {
        metaPayload.type = "template";
        metaPayload.template = {
          name: template.name,
          language: { code: template.languageCode || "en" },
          components: template.components || [],
        };
      } else {
        metaPayload.type = "text";
        metaPayload.text = { preview_url: false, body: text };
      }

      console.log(`Dispatching via Meta Cloud API to ${cleanPhone}...`);

      const metaRes = await fetch(
        `https://graph.facebook.com/v19.0/${metaPhoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${metaAccessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(metaPayload),
        }
      );

      const metaData = await metaRes.json();
      if (!metaRes.ok) {
        console.error("Meta Graph API error:", metaData);
        outboundStatus = "failed";
        errorMessage = metaData?.error?.message || "Meta API error";
      } else {
        wamid = metaData?.messages?.[0]?.id || null;
      }
    }
    // ------------------------------------------------------------------------
    // Mode 2: AiSensy API (Fallback)
    // ------------------------------------------------------------------------
    else if (aisensyApiKey) {
      console.log(`Dispatching via AiSensy API to ${cleanPhone}...`);

      const aiRes = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          apiKey: aisensyApiKey,
          campaignName: template?.name || "Boutique_Notification",
          destination: cleanPhone,
          userName: senderName,
          templateParams: template?.params || [text],
        }),
      });

      const aiData = await aiRes.json();
      if (!aiRes.ok || aiData.success === false) {
        outboundStatus = "failed";
        errorMessage = aiData?.message || "AiSensy API error";
      } else {
        wamid = aiData?.messageId || `aisensy_${Date.now()}`;
      }
    }
    // ------------------------------------------------------------------------
    // Mode 3: Local Simulation (When credentials are pending)
    // ------------------------------------------------------------------------
    else {
      console.log(`No active Meta or AiSensy keys found. Logging message locally for ${cleanPhone}.`);
      wamid = `wamid.HBgL${Date.now()}`;
    }

    // Persist to database
    let resolvedConvoId = conversationId;
    if (!resolvedConvoId && customerId) {
      const { data: convo } = await supabase
        .from("whatsapp_conversations")
        .upsert(
          {
            customer_id: customerId,
            phone_number: cleanPhone,
            last_message_at: new Date().toISOString(),
            unread_count: 0,
            status: "open",
          },
          { onConflict: "customer_id" }
        )
        .select("id")
        .single();
      if (convo) resolvedConvoId = convo.id;
    }

    if (resolvedConvoId && customerId) {
      await supabase.from("whatsapp_messages").insert({
        conversation_id: resolvedConvoId,
        customer_id: customerId,
        wamid: wamid,
        direction: "outbound",
        message_type: type === "template" ? "template" : "text",
        text_body: text || `[Template: ${template?.name}]`,
        template_name: template?.name || null,
        sender_name: senderName,
        status: outboundStatus,
        error_message: errorMessage,
        sent_at: new Date().toISOString(),
      });

      await supabase
        .from("whatsapp_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          unread_count: 0,
        })
        .eq("id", resolvedConvoId);
    }

    return new Response(
      JSON.stringify({
        success: outboundStatus !== "failed",
        wamid,
        status: outboundStatus,
        error: errorMessage,
      }),
      {
        status: outboundStatus === "failed" ? 400 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("whatsapp-send error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
