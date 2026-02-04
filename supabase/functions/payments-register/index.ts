import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get("PROJECT_URL")!;
  const serviceKey = Deno.env.get("SERVICE_ROLE_KEY")!;

  const sql = `
    select
      cp.id as payment_id,
      cp.date as payment_date,
      c.name as customer_name,
      cp.amount,
      cp.payment_method,
      cp.reference,
      cp.notes,

      coalesce(sum(ip.amount), 0) as allocated_amount,

      case
        when coalesce(sum(ip.amount), 0) = 0 then 'unallocated'
        when coalesce(sum(ip.amount), 0) < cp.amount then 'partial'
        else 'allocated'
      end as allocation_status

    from customer_payments cp
    left join customers c on c.id = cp.customer_id
    left join invoice_payments ip on ip.customer_payment_id = cp.id

    group by
      cp.id,
      c.name

    order by cp.date desc
  `

  const res = await fetch(
    `${supabaseUrl}/rest/v1/rpc/execute_sql`,
    {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sql }),
    }
  );

  const rows = await res.json();

  return new Response(
    JSON.stringify({
      count: rows.length,
      payments: rows,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
});