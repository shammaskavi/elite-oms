import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const RECIPIENTS = [
  { name: "Shammas", phone: "917698810804" },
  { name: "Maaz", phone: "918980937903" },
  { name: "Bablu", phone: "919925041003" },
  { name: "Sohel", phone: "919924657201" },
];

async function sendWhatsappViaAiSensy(
  to: string,
  userName: string,
  templateParams: string[]
) {
  const apiKey = Deno.env.get("AISENSY_API_KEY")!;

  const payload = {
    apiKey,
    campaignName: "delivery_summary_campaign",
    destination: `+${to}`,
    userName,
    templateParams,
    source: "delivery-reminder"
  };

  const res = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json();

  // Always log full response for debugging
  console.log("AiSensy API response:", JSON.stringify(data, null, 2));

  if (!res.ok) {
    console.error("AiSensy send failed with status", res.status);
    console.error("AiSensy error body:", data);
    throw new Error(data?.message || "AiSensy send failed");
  }

  return data;
}

function formatDateHuman(dateStr: string) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
}

function buildWhatsappMessage(dateStr: string, invoices: any[], totalItems: number) {
  const humanDate = formatDateHuman(dateStr);

  if (invoices.length === 0) {
    return `📦 Delivery Summary\n🗓 ${humanDate}\n\nNo deliveries scheduled for this day ✅`;
  }

  let msg = `📦 Delivery Summary\n🗓 ${humanDate}\n\n`;
  msg += `Total Invoices: ${invoices.length}\n`;
  msg += `Total Items: ${totalItems}\n\n`;

  for (const inv of invoices) {
    msg += `${inv.invoice_number} | ${inv.customer_name}\n`;
    for (const item of inv.items) {
      if (item.vendor_name) {
        msg += `${item.item_name} - ${item.stage_name} - ${item.vendor_name}\n`;
      } else {
        msg += `${item.item_name} - ${item.stage_name}\n`;
      }
    }
    msg += `\n`;
  }

  return msg.trim();
}

function buildTemplateParams(dateStr: string, invoices: any[], totalItems: number) {
  const humanDate = formatDateHuman(dateStr);

  if (invoices.length === 0) {
    return [humanDate, "0", "0", "No deliveries scheduled for this day ✅"];
  }

  let body = "";

  for (const inv of invoices) {
    body += `${inv.invoice_number} | ${inv.customer_name}\n`;

    for (const item of inv.items) {
      if (item.vendor_name) {
        body += `${item.item_name} - ${item.stage_name} - ${item.vendor_name}\n`;
      } else {
        body += `${item.item_name} - ${item.stage_name}\n`;
      }
    }

    body += `\n`;
  }

  return [
    humanDate,                     // {{1}}
    String(invoices.length),       // {{2}}
    String(totalItems),            // {{3}}
    body.trim(),                   // {{4}}
  ];
}

function getISTDate(offsetDays = 0) {
  const now = new Date();

  // Convert current time to IST
  const ist = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  ist.setDate(ist.getDate() + offsetDays);

  return ist.toISOString().split("T")[0];
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  let mode = url.searchParams.get("mode"); // today | tomorrow

  // If not provided in query params, try reading from POST body (cron uses body)
  if (!mode && req.method === "POST") {
    try {
      const body = await req.json();
      if (body?.mode) {
        mode = body.mode;
      }
    } catch (_) {
      // ignore invalid / empty JSON body
    }
  }

  // Default fallback
  if (mode !== "tomorrow") {
    mode = "today";
  }

  const targetDate = mode === "tomorrow" ? getISTDate(1) : getISTDate(0);

  const supabaseUrl = Deno.env.get("PROJECT_URL")!;
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY")!;

  const sql = `
    select
      o.id as order_id,
      i.id as invoice_id,
      i.invoice_number,
      c.name as customer_name,
      o.metadata->>'item_name' as item_name,
      o.metadata->>'delivery_date' as delivery_date,
      s.stage_name,
      s.vendor_name
    from orders o
    join invoices i on i.id = o.invoice_id
    join customers c on c.id = i.customer_id
    left join lateral (
      select stage_name, vendor_name
      from order_stages
      where order_id = o.id
      order by created_at desc
      limit 1
    ) s on true
    where o.metadata->>'delivery_date' = '${targetDate}'
      and (s.stage_name is null or s.stage_name != 'Delivered')
  `;

  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_sql`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ sql }),
  });

  const rows = await res.json();

  const grouped: Record<string, any> = {};

  for (const r of rows) {
    if (!grouped[r.invoice_number]) {
      grouped[r.invoice_number] = {
        invoice_number: r.invoice_number,
        customer_name: r.customer_name,
        items: [],
      };
    }

    grouped[r.invoice_number].items.push({
      item_name: r.item_name,
      stage_name: r.stage_name || "Ordered",
      vendor_name: r.vendor_name,
    });
  }

  const invoices = Object.values(grouped);
  const templateParams = buildTemplateParams(targetDate, invoices, rows.length);

  const whatsappResults = [];

  for (const user of RECIPIENTS) {
    try {
      const r = await sendWhatsappViaAiSensy(
        user.phone,
        user.name,
        templateParams
      );
      whatsappResults.push({ user: user.name, status: "sent", response: r });
    } catch (err) {
      console.error("Failed to send to", user.name, err);
      whatsappResults.push({ user: user.name, status: "failed" });
    }
  }

  return new Response(
    JSON.stringify({
      mode,
      date: targetDate,
      total_items: rows.length,
      invoices,
      template_params: templateParams,
      whatsapp_results: whatsappResults,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});