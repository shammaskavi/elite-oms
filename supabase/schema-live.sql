


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'staff'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."execute_sql"("sql" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  result json;
begin
  execute format('select json_agg(t) from (%s) t', sql) into result;
  return coalesce(result, '[]'::json);
end;
$$;


ALTER FUNCTION "public"."execute_sql"("sql" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_cash_inflow_daily"() RETURNS TABLE("date" "date", "total" numeric)
    LANGUAGE "sql"
    AS $$
  select
    (date at time zone 'Asia/Kolkata')::date as date,
    sum(amount) as total
  from invoice_payments
  group by 1
  order by 1;
$$;


ALTER FUNCTION "public"."get_cash_inflow_daily"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_cash_inflow_daily"("from_date" "date", "to_date" "date") RETURNS TABLE("date" "date", "total" numeric)
    LANGUAGE "sql"
    AS $$
select
  (ip.date at time zone 'Asia/Kolkata')::date as date,
  sum(ip.amount) as total
from invoice_payments ip

where (ip.date at time zone 'Asia/Kolkata')::date
      between from_date and to_date

group by 1
order by 1;
$$;


ALTER FUNCTION "public"."get_cash_inflow_daily"("from_date" "date", "to_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_delivery_risk"() RETURNS TABLE("risk" "text", "total_orders" bigint)
    LANGUAGE "sql"
    AS $$
select
    case
        when delivery_date::date < current_date
            and stage_name != 'Delivered'
            then 'Delayed'

        when delivery_date::date <= current_date + interval '3 days'
            and stage_name != 'Delivered'
            then 'Due Soon'

        when stage_name != 'Delivered'
            then 'On Track'

        else 'Delivered'
    end as risk,
    count(*) as total_orders
from orders_with_details
where delivery_date is not null
group by risk
order by total_orders desc;
$$;


ALTER FUNCTION "public"."get_delivery_risk"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_owner_summary"("month_start" "date" DEFAULT ("date_trunc"('month'::"text", "now"()))::"date") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
declare
  month_end date := (month_start + interval '1 month')::date;

  total_invoiced numeric := 0;
  total_collected numeric := 0;
  outstanding_due numeric := 0;
  waived_amount numeric := 0;

  total_invoices int := 0;
  paid_invoices int := 0;
  partial_invoices int := 0;
  unpaid_invoices int := 0;
  settled_invoices int := 0;
begin
  /* Total invoiced */
  select coalesce(sum(total), 0)
  into total_invoiced
  from invoices
  where date >= month_start
    and date < month_end;

  /* Total collected (real money) */
  select coalesce(sum(ip.amount), 0)
  into total_collected
  from invoice_payments ip
  join invoices i on i.id = ip.invoice_id
  where i.date >= month_start
    and i.date < month_end;

  /* Outstanding collectible due (exclude settled) */
  select coalesce(sum(i.total - coalesce(p.total_paid, 0)), 0)
  into outstanding_due
  from invoices i
  left join (
    select invoice_id, sum(amount) as total_paid
    from invoice_payments
    group by invoice_id
  ) p on p.invoice_id = i.id
  where i.settled = false
    and i.date >= month_start
    and i.date < month_end
    and (i.total - coalesce(p.total_paid, 0)) > 0;

  /* Waived amount (settled invoices) */
  select
    coalesce(sum(i.total - coalesce(p.total_paid, 0)), 0),
    count(*)
  into waived_amount, settled_invoices
  from invoices i
  left join (
    select invoice_id, sum(amount) as total_paid
    from invoice_payments
    group by invoice_id
  ) p on p.invoice_id = i.id
  where i.settled = true
    and i.date >= month_start
    and i.date < month_end;

  /* Invoice counts */
  select
    count(*),
    count(*) filter (where payment_status = 'paid'),
    count(*) filter (where payment_status = 'partial'),
    count(*) filter (where payment_status = 'unpaid' and settled = false)
  into
    total_invoices,
    paid_invoices,
    partial_invoices,
    unpaid_invoices
  from invoices
  where date >= month_start
    and date < month_end;

  return json_build_object(
    'period', to_char(month_start, 'Mon YYYY'),
    'money', json_build_object(
      'total_invoiced', total_invoiced,
      'total_collected', total_collected,
      'outstanding_due', outstanding_due,
      'waived_amount', waived_amount
    ),
    'invoices', json_build_object(
      'total', total_invoices,
      'paid', paid_invoices,
      'partial', partial_invoices,
      'unpaid_collectible', unpaid_invoices,
      'settled', settled_invoices
    )
  );
end;
$$;


ALTER FUNCTION "public"."get_monthly_owner_summary"("month_start" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_monthly_owner_summary"("p_year" integer, "p_month" integer) RETURNS json
    LANGUAGE "plpgsql"
    AS $$
declare
  period_start date := make_date(p_year, p_month, 1);
  period_end date := (make_date(p_year, p_month, 1) + interval '1 month')::date;
begin
  return json_build_object(
    'period', to_char(period_start, 'Mon YYYY'),

    'money', json_build_object(
      'total_invoiced', (
        select coalesce(sum(total), 0)
        from invoices
        where date >= period_start
          and date < period_end
      ),

      'total_collected', (
        select coalesce(sum(ip.amount), 0)
        from invoice_payments ip
        join invoices i on i.id = ip.invoice_id
        where ip.date >= period_start
          and ip.date < period_end
      ),

      'outstanding_due', (
        select coalesce(sum(
          i.total -
          coalesce((
            select sum(ip.amount)
            from invoice_payments ip
            where ip.invoice_id = i.id
          ), 0)
        ), 0)
        from invoices i
        where i.date >= period_start
          and i.date < period_end
          and i.settled = false
          and i.payment_status in ('unpaid', 'partial')
      ),

      'waived_amount', (
        select coalesce(sum(
          i.total -
          coalesce((
            select sum(ip.amount)
            from invoice_payments ip
            where ip.invoice_id = i.id
          ), 0)
        ), 0)
        from invoices i
        where i.date >= period_start
          and i.date < period_end
          and i.settled = true
      )
    ),

    'invoices', json_build_object(
      'total', (
        select count(*)
        from invoices
        where date >= period_start
          and date < period_end
      ),

      'paid', (
        select count(*)
        from invoices
        where date >= period_start
          and date < period_end
          and payment_status = 'paid'
      ),

      'partial', (
        select count(*)
        from invoices
        where date >= period_start
          and date < period_end
          and payment_status = 'partial'
      ),

      'unpaid_collectible', (
        select count(*)
        from invoices
        where date >= period_start
          and date < period_end
          and payment_status = 'unpaid'
          and settled = false
      ),

      'settled', (
        select count(*)
        from invoices
        where date >= period_start
          and date < period_end
          and settled = true
      )
    )
  );
end;
$$;


ALTER FUNCTION "public"."get_monthly_owner_summary"("p_year" integer, "p_month" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_order_stats"() RETURNS json
    LANGUAGE "sql"
    AS $$
select json_build_object(
  'total', count(*),

  'active', count(*) filter (
    where order_status not in ('delivered','cancelled')
  ),

  'completed', count(*) filter (
    where order_status = 'delivered'
  ),

  'overdue', count(*) filter (
    where order_status not in ('delivered','cancelled')
    and (metadata->>'delivery_date')::date < current_date
  ),

  'dueSoon', count(*) filter (
    where order_status not in ('delivered','cancelled')
    and (metadata->>'delivery_date')::date >= current_date
    and (metadata->>'delivery_date')::date <= current_date + interval '3 days'
  )
)
from orders;
$$;


ALTER FUNCTION "public"."get_order_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_owner_insights"() RETURNS json
    LANGUAGE "plpgsql"
    AS $$
declare
    v_total_invoiced numeric;
    v_total_collected numeric;
    v_outstanding numeric;
    v_collection_eff numeric;
begin

    select
        sum(total),
        (
          select coalesce(sum(amount),0)
          from invoice_payments
          where date >= date_trunc('month', current_date)
        )
    into v_total_invoiced, v_total_collected
    from invoices
    where date >= date_trunc('month', current_date);

    v_outstanding := v_total_invoiced - v_total_collected;

    v_collection_eff :=
        case
            when v_total_invoiced = 0 then 0
            else round((v_total_collected / v_total_invoiced) * 100, 1)
        end;

    return json_build_object(
        'collection_efficiency', v_collection_eff,
        'outstanding_due', v_outstanding,
        'total_collected', v_total_collected
    );
end;
$$;


ALTER FUNCTION "public"."get_owner_insights"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_owner_insights"("from_date" "date", "to_date" "date") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
declare
    v_total_invoiced numeric;
    v_total_collected numeric;
    v_outstanding numeric;
    v_collection_eff numeric;
begin

    -- invoices created in period
    select coalesce(sum(total),0)
    into v_total_invoiced
    from invoices
    where date::date between from_date and to_date;

    -- cash actually received in period
    select coalesce(sum(amount),0)
    into v_total_collected
    from invoice_payments
    where (date at time zone 'Asia/Kolkata')::date
          between from_date and to_date;

    v_outstanding := v_total_invoiced - v_total_collected;

    v_collection_eff :=
        case
            when v_total_invoiced = 0 then 0
            else round((v_total_collected / v_total_invoiced) * 100, 1)
        end;

    return json_build_object(
        'collection_efficiency', v_collection_eff,
        'outstanding_due', v_outstanding,
        'total_collected', v_total_collected
    );
end;
$$;


ALTER FUNCTION "public"."get_owner_insights"("from_date" "date", "to_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_owner_summary"("from_date" "date", "to_date" "date") RETURNS json
    LANGUAGE "plpgsql"
    AS $$
declare
    v_total_invoiced numeric := 0;
    v_total_collected numeric := 0;
    v_outstanding numeric := 0;
    v_waived numeric := 0;
begin

    /*
    ===============================
    1️⃣ TOTAL INVOICED
    ===============================
    */

    select coalesce(sum(i.total),0)
    into v_total_invoiced
    from invoices i
    where i.date >= from_date
      and i.date <= to_date;


    /*
    ===============================
    2️⃣ TOTAL COLLECTED
    Payments belonging to those invoices
    ===============================
    */

    select coalesce(sum(ip.amount),0)
    into v_total_collected
    from invoice_payments ip
    join invoices i on i.id = ip.invoice_id
    where i.date >= from_date
      and i.date <= to_date;


    /*
    ===============================
    3️⃣ OUTSTANDING DUE
    Remaining collectible balance
    ===============================
    */

    select coalesce(sum(
        i.total -
        coalesce((
            select sum(ip.amount)
            from invoice_payments ip
            where ip.invoice_id = i.id
        ),0)
    ),0)
    into v_outstanding
    from invoices i
    where i.date >= from_date
      and i.date <= to_date
      and i.settled = false;


    /*
    ===============================
    4️⃣ WAIVED AMOUNT
    ===============================
    */

    select coalesce(sum(
        i.total -
        coalesce((
            select sum(ip.amount)
            from invoice_payments ip
            where ip.invoice_id = i.id
        ),0)
    ),0)
    into v_waived
    from invoices i
    where i.date >= from_date
      and i.date <= to_date
      and i.settled = true;


    /*
    ===============================
    RETURN JSON
    ===============================
    */

    return json_build_object(
        'period',
        to_char(from_date,'DD Mon YYYY') || ' → ' ||
        to_char(to_date,'DD Mon YYYY'),

        'money', json_build_object(
            'total_invoiced', v_total_invoiced,
            'total_collected', v_total_collected,
            'outstanding_due', v_outstanding,
            'waived_amount', v_waived
        ),

        'invoices', json_build_object(
            'total', (
                select count(*)
                from invoices
                where date >= from_date
                  and date <= to_date
            ),

            'paid', (
                select count(*)
                from invoices
                where date >= from_date
                  and date <= to_date
                  and payment_status = 'paid'
            ),

            'partial', (
                select count(*)
                from invoices
                where date >= from_date
                  and date <= to_date
                  and payment_status = 'partial'
            ),

            'unpaid_collectible', (
                select count(*)
                from invoices
                where date >= from_date
                  and date <= to_date
                  and payment_status = 'unpaid'
                  and settled = false
            ),

            'settled', (
                select count(*)
                from invoices
                where date >= from_date
                  and date <= to_date
                  and settled = true
            )
        )
    );

end;
$$;


ALTER FUNCTION "public"."get_owner_summary"("from_date" "date", "to_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_process_breakdown"() RETURNS TABLE("stage_name" "text", "total_orders" bigint)
    LANGUAGE "sql"
    AS $$
  select
    os.stage_name,
    count(*) as total_orders
  from order_stages os
  join orders o on o.id = os.order_id
  where os.status != 'done'
    and o.order_status not in ('delivered', 'cancelled')
  group by os.stage_name
  order by total_orders desc;
$$;


ALTER FUNCTION "public"."get_process_breakdown"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_revenue_trend"() RETURNS TABLE("date" "date", "booked_revenue" numeric, "confirmed_revenue" numeric)
    LANGUAGE "sql"
    AS $$
SELECT
  date_trunc('day', date)::date AS date,

  -- Draft + Finalized
  SUM(total) AS booked_revenue,

  -- Only finalized
  SUM(
    CASE
      WHEN status = 'finalized' THEN total
      ELSE 0
    END
  ) AS confirmed_revenue

FROM invoices
GROUP BY 1
ORDER BY 1;
$$;


ALTER FUNCTION "public"."get_revenue_trend"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_revenue_trend"("from_date" "date", "to_date" "date") RETURNS TABLE("date" "date", "booked_revenue" numeric, "confirmed_revenue" numeric)
    LANGUAGE "sql"
    AS $$
SELECT
  date_trunc('day', i.date)::date AS date,

  -- Draft + Finalized invoices
  SUM(i.total) AS booked_revenue,

  -- Only finalized invoices
  SUM(
    CASE
      WHEN i.status = 'finalized' THEN i.total
      ELSE 0
    END
  ) AS confirmed_revenue

FROM invoices i

WHERE i.date::date BETWEEN from_date AND to_date

GROUP BY 1
ORDER BY 1;
$$;


ALTER FUNCTION "public"."get_revenue_trend"("from_date" "date", "to_date" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_vendor_load"() RETURNS TABLE("vendor_id" "uuid", "vendor_name" "text", "active_orders" bigint)
    LANGUAGE "sql"
    AS $$
with latest_stage as (
    select distinct on (os.order_id)
        os.order_id,
        os.vendor_id,
        os.vendor_name,
        os.stage_name
    from order_stages os
    order by os.order_id, os.created_at desc
)

select
    vendor_id,
    coalesce(vendor_name, 'Unassigned') as vendor_name,
    count(*) as active_orders
from latest_stage
where stage_name not in ('Delivered', 'Cancelled')
group by vendor_id, vendor_name
order by active_orders desc;
$$;


ALTER FUNCTION "public"."get_vendor_load"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_vendor_work"("p_token" "text") RETURNS TABLE("vendor_name" "text", "order_id" "uuid", "invoice_number" "text", "customer_name" "text", "item_name" "text", "delivery_date" "date", "stage_name" "text")
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  select
    v.name as vendor_name,

    o.id,
    i.invoice_number,
    c.name as customer_name,

    coalesce(
      s.metadata->>'product_name',
      o.metadata->>'item_name'
    ) as item_name,

    (o.metadata->>'delivery_date')::date as delivery_date,
    s.stage_name

  from vendors v

  join order_stages s
    on s.vendor_id = v.id

  join orders o
    on o.id = s.order_id

  join invoices i
    on i.id = o.invoice_id

  join customers c
    on c.id = o.customer_id

  where v.access_token = p_token
    and o.order_status <> 'delivered'

  order by delivery_date asc;
$$;


ALTER FUNCTION "public"."get_vendor_work"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, role)
  VALUES (
    NEW.id,
    coalesce(NEW.raw_user_meta_data->>'full_name', NEW.email),
    'staff'::app_role
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id AND role = _role
  );
$$;


ALTER FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_authenticated_user"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_authenticated_user"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."orders" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_code" "text" NOT NULL,
    "invoice_id" "uuid",
    "customer_id" "uuid",
    "order_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "payment_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "total_amount" numeric(12,2) DEFAULT 0 NOT NULL,
    "metadata" "jsonb",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "orders_order_status_check" CHECK (("order_status" = ANY (ARRAY['pending'::"text", 'processing'::"text", 'ready'::"text", 'dispatched'::"text", 'delivered'::"text", 'cancelled'::"text"]))),
    CONSTRAINT "orders_payment_status_check" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'paid'::"text", 'partial'::"text"])))
);


ALTER TABLE "public"."orders" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."orders_due_today"() RETURNS SETOF "public"."orders"
    LANGUAGE "sql"
    AS $$
  select *
  from orders
  where order_status != 'delivered'
    and (metadata->>'delivery_date')::date = current_date;
$$;


ALTER FUNCTION "public"."orders_due_today"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."orders_due_tomorrow"() RETURNS SETOF "public"."orders"
    LANGUAGE "sql"
    AS $$
  select *
  from orders
  where order_status != 'delivered'
    and (metadata->>'delivery_date')::date = current_date + interval '1 day';
$$;


ALTER FUNCTION "public"."orders_due_tomorrow"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."orders_overdue"() RETURNS SETOF "public"."orders"
    LANGUAGE "sql"
    AS $$
  select *
  from orders
  where order_status != 'delivered'
    and (metadata->>'delivery_date')::date < current_date;
$$;


ALTER FUNCTION "public"."orders_overdue"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."recalculate_invoice_payment_status"("p_invoice_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $_$
DECLARE
  v_total NUMERIC;
  v_legacy_paid NUMERIC;
  v_db_paid NUMERIC;
  v_final_paid NUMERIC;
BEGIN
  SELECT 
    total,
    CASE 
      WHEN raw_payload->>'paid_amount' ~ '^[0-9]+(\.[0-9]+)?$'
      THEN (raw_payload->>'paid_amount')::numeric
      ELSE 0
    END
  INTO v_total, v_legacy_paid
  FROM invoices
  WHERE id = p_invoice_id;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_db_paid
  FROM invoice_payments
  WHERE invoice_id = p_invoice_id;

  v_final_paid := GREATEST(0, LEAST(v_legacy_paid + v_db_paid, v_total));

  UPDATE invoices SET 
    payment_status = CASE 
      WHEN v_total = 0 OR v_final_paid >= (v_total - 0.5) THEN 'paid' 
      WHEN v_final_paid > 0 THEN 'partial' 
      ELSE 'unpaid' 
    END
  WHERE id = p_invoice_id;
END;
$_$;


ALTER FUNCTION "public"."recalculate_invoice_payment_status"("p_invoice_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trigger_recalculate_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  PERFORM recalculate_invoice_payment_status(NEW.invoice_id);
  RETURN NEW;
END; $$;


ALTER FUNCTION "public"."trigger_recalculate_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_order_delivery_date"("p_order_id" "uuid", "p_new_date" "text", "p_actor_profile_id" "uuid" DEFAULT NULL::"uuid", "p_reason" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  old_date text;
begin
  -- Get old date (if exists)
  select metadata->>'delivery_date'
  into old_date
  from orders
  where id = p_order_id;

  -- Update delivery date safely
  update orders
  set
    metadata = jsonb_set(
      coalesce(metadata, '{}'::jsonb),
      '{delivery_date}',
      to_jsonb(p_new_date),
      true
    ),
    updated_at = now()
  where id = p_order_id;

  -- Optional audit log (non-blocking)
  if p_actor_profile_id is not null then
    insert into audit_logs (
      actor_profile_id,
      action_type,
      resource_type,
      resource_id,
      payload
    )
    values (
      p_actor_profile_id,
      'delivery_date_updated',
      'order',
      p_order_id,
      jsonb_build_object(
        'old_date', old_date,
        'new_date', p_new_date,
        'reason', p_reason
      )
    );
  end if;
end;
$$;


ALTER FUNCTION "public"."update_order_delivery_date"("p_order_id" "uuid", "p_new_date" "text", "p_actor_profile_id" "uuid", "p_reason" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "actor_profile_id" "uuid",
    "action_type" "text" NOT NULL,
    "resource_type" "text" NOT NULL,
    "resource_id" "uuid",
    "payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "channel" "text" NOT NULL,
    "granted" boolean DEFAULT true NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    CONSTRAINT "consents_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'sms'::"text", 'email'::"text"])))
);


ALTER TABLE "public"."consents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_measurements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "template_id" "uuid",
    "values" "jsonb",
    "source" "text" DEFAULT 'admin'::"text",
    "status" "text" DEFAULT 'verified'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "name" "text"
);


ALTER TABLE "public"."customer_measurements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customer_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "amount" numeric NOT NULL,
    "payment_method" "text" NOT NULL,
    "reference" "text",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "notes" "text"
);


ALTER TABLE "public"."customer_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "phone" "text",
    "email" "text",
    "address" "text",
    "dob" "date",
    "anniversary" "date",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."customers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inventory_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "barcode" "text" NOT NULL,
    "product_name" "text" NOT NULL,
    "category" "text",
    "brand" "text",
    "price" numeric(12,2) DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'available'::"text" NOT NULL,
    "erp_code" "text",
    "erp_batch" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "inventory_items_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'reserved'::"text", 'sold'::"text", 'returned'::"text"])))
);


ALTER TABLE "public"."inventory_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "product_id" "uuid",
    "sku" "text",
    "name" "text" NOT NULL,
    "qty" numeric(12,2) DEFAULT 1 NOT NULL,
    "unit_price" numeric(12,2) DEFAULT 0 NOT NULL,
    "total" numeric(12,2) DEFAULT 0 NOT NULL,
    "reference_name" "text"
);


ALTER TABLE "public"."invoice_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoice_payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "method" "text" NOT NULL,
    "date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "remarks" "text",
    "reference_id" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "customer_payment_id" "uuid",
    CONSTRAINT "invoice_payments_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."invoice_payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invoices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "invoice_number" "text" NOT NULL,
    "customer_id" "uuid",
    "date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "subtotal" numeric(12,2) DEFAULT 0,
    "tax" numeric(12,2) DEFAULT 0,
    "total" numeric(12,2) DEFAULT 0 NOT NULL,
    "payment_method" "text",
    "uploaded_by" "uuid",
    "file_url" "text",
    "raw_payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "payment_status" "text" DEFAULT 'unpaid'::"text" NOT NULL,
    "status" "text" DEFAULT 'finalized'::"text" NOT NULL,
    "tracking_token" "text",
    "settled" boolean DEFAULT false NOT NULL,
    "settlement_reason" "text",
    CONSTRAINT "invoices_valid_payment_status" CHECK (("payment_status" = ANY (ARRAY['unpaid'::"text", 'partial'::"text", 'paid'::"text"])))
);


ALTER TABLE "public"."invoices" OWNER TO "postgres";


COMMENT ON COLUMN "public"."invoices"."status" IS 'Invoice status: draft or finalized';



CREATE TABLE IF NOT EXISTS "public"."marketing_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "scheduled_date" "date" NOT NULL,
    "template" "text",
    "data" "jsonb",
    "status" "text" DEFAULT 'scheduled'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "marketing_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['birthday'::"text", 'anniversary'::"text", 'custom'::"text"]))),
    CONSTRAINT "marketing_events_status_check" CHECK (("status" = ANY (ARRAY['scheduled'::"text", 'sent'::"text", 'skipped'::"text"])))
);


ALTER TABLE "public"."marketing_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."measurement_fields" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid",
    "label" "text" NOT NULL,
    "field_key" "text" NOT NULL,
    "input_type" "text" NOT NULL,
    "unit" "text",
    "options" "jsonb",
    "required" boolean DEFAULT false,
    "order_index" integer,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."measurement_fields" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."measurement_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "customer_id" "uuid",
    "template_id" "uuid",
    "status" "text" DEFAULT 'active'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "expires_at" timestamp with time zone
);


ALTER TABLE "public"."measurement_links" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."measurement_profile_values" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "profile_id" "uuid",
    "field_key" "text" NOT NULL,
    "value" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."measurement_profile_values" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."measurement_profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_id" "uuid",
    "template_id" "uuid",
    "name" "text",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."measurement_profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."measurement_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."measurement_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid" NOT NULL,
    "stage_name" "text" NOT NULL,
    "vendor_id" "uuid",
    "vendor_name" "text",
    "assigned_employee" "text",
    "start_ts" timestamp with time zone,
    "end_ts" timestamp with time zone,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "notes" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "new_stage_id" "uuid",
    "new_vendor_id" "uuid",
    CONSTRAINT "order_stages_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'done'::"text"])))
);


ALTER TABLE "public"."order_stages" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."order_items_calendar_view" AS
 SELECT "o"."id" AS "order_id",
    "o"."invoice_id",
    "i"."invoice_number",
    ("o"."metadata" ->> 'item_name'::"text") AS "item_name",
    (("o"."metadata" ->> 'item_index'::"text"))::integer AS "item_index",
    (("o"."metadata" ->> 'delivery_date'::"text"))::"date" AS "delivery_date",
    "c"."name" AS "customer_name",
    "c"."phone" AS "customer_phone",
    "os"."stage_name" AS "stage",
    "os"."vendor_name",
    "o"."created_at"
   FROM ((("public"."orders" "o"
     LEFT JOIN "public"."invoices" "i" ON (("i"."id" = "o"."invoice_id")))
     LEFT JOIN "public"."customers" "c" ON (("c"."id" = "o"."customer_id")))
     LEFT JOIN LATERAL ( SELECT "order_stages"."stage_name",
            "order_stages"."vendor_name"
           FROM "public"."order_stages"
          WHERE ("order_stages"."order_id" = "o"."id")
          ORDER BY "order_stages"."created_at" DESC
         LIMIT 1) "os" ON (true))
  WHERE (("o"."metadata" ->> 'delivery_date'::"text") IS NOT NULL);


ALTER VIEW "public"."order_items_calendar_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."order_measurements" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "order_id" "uuid",
    "template_id" "uuid",
    "field_key" "text" NOT NULL,
    "value" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."order_measurements" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."orders_with_details" AS
 SELECT "o"."id" AS "order_id",
    "o"."invoice_id",
    "i"."invoice_number",
    "c"."name" AS "customer_name",
    ("o"."metadata" ->> 'item_name'::"text") AS "item_name",
    ("o"."metadata" ->> 'delivery_date'::"text") AS "delivery_date",
    "s"."stage_name",
    "s"."vendor_name"
   FROM ((("public"."orders" "o"
     JOIN "public"."invoices" "i" ON (("i"."id" = "o"."invoice_id")))
     JOIN "public"."customers" "c" ON (("c"."id" = "i"."customer_id")))
     LEFT JOIN LATERAL ( SELECT "order_stages"."stage_name",
            "order_stages"."vendor_name"
           FROM "public"."order_stages"
          WHERE ("order_stages"."order_id" = "o"."id")
          ORDER BY "order_stages"."created_at" DESC
         LIMIT 1) "s" ON (true))
  WHERE (("s"."stage_name" IS NULL) OR ("s"."stage_name" <> 'Delivered'::"text"));


ALTER VIEW "public"."orders_with_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payment_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "customer_payment_id" "uuid" NOT NULL,
    "invoice_id" "uuid" NOT NULL,
    "allocated_amount" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."payment_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."products" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "sku" "text",
    "price" numeric(12,2),
    "stock" integer DEFAULT 0,
    "category" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "color" "text",
    "size" "text",
    "purchase_price" numeric(12,2),
    "mrp" numeric(12,2),
    "item_code" "text",
    "company_barcode" "text",
    "hsn_code" "text",
    "supplier_name" "text",
    "status" "text" DEFAULT 'available'::"text",
    "inward_date" "date",
    "purchase_date" "date",
    CONSTRAINT "products_status_check" CHECK (("status" = ANY (ARRAY['available'::"text", 'sold'::"text", 'reserved'::"text"])))
);


ALTER TABLE "public"."products" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "full_name" "text",
    "role" "public"."app_role" DEFAULT 'staff'::"public"."app_role" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "order_index" integer NOT NULL,
    "active" boolean DEFAULT true
);


ALTER TABLE "public"."stages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_push_devices" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "provider" "text" DEFAULT 'onesignal'::"text" NOT NULL,
    "player_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."user_push_devices" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."vendors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "stage_id" "uuid",
    "active" boolean DEFAULT true,
    "access_token" "text",
    "portal_enabled" boolean DEFAULT true
);


ALTER TABLE "public"."vendors" OWNER TO "postgres";


ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consents"
    ADD CONSTRAINT "consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_measurements"
    ADD CONSTRAINT "customer_measurements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customer_payments"
    ADD CONSTRAINT "customer_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."customers"
    ADD CONSTRAINT "customers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_barcode_key" UNIQUE ("barcode");



ALTER TABLE ONLY "public"."inventory_items"
    ADD CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_invoice_number_key" UNIQUE ("invoice_number");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_tracking_token_key" UNIQUE ("tracking_token");



ALTER TABLE ONLY "public"."marketing_events"
    ADD CONSTRAINT "marketing_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."measurement_fields"
    ADD CONSTRAINT "measurement_fields_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."measurement_links"
    ADD CONSTRAINT "measurement_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."measurement_links"
    ADD CONSTRAINT "measurement_links_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."measurement_profile_values"
    ADD CONSTRAINT "measurement_profile_values_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."measurement_profiles"
    ADD CONSTRAINT "measurement_profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."measurement_templates"
    ADD CONSTRAINT "measurement_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_measurements"
    ADD CONSTRAINT "order_measurements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."order_stages"
    ADD CONSTRAINT "order_stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_order_code_key" UNIQUE ("order_code");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payment_allocations"
    ADD CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."products"
    ADD CONSTRAINT "products_sku_key" UNIQUE ("sku");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."stages"
    ADD CONSTRAINT "stages_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."stages"
    ADD CONSTRAINT "stages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_push_devices"
    ADD CONSTRAINT "unique_player" UNIQUE ("player_id");



ALTER TABLE ONLY "public"."user_push_devices"
    ADD CONSTRAINT "user_push_devices_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_push_devices"
    ADD CONSTRAINT "user_push_devices_user_id_player_id_key" UNIQUE ("user_id", "player_id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_access_token_key" UNIQUE ("access_token");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_unique" UNIQUE ("name", "stage_id");



CREATE INDEX "idx_customers_email" ON "public"."customers" USING "btree" ("email");



CREATE INDEX "idx_customers_phone" ON "public"."customers" USING "btree" ("phone");



CREATE INDEX "idx_inventory_barcode" ON "public"."inventory_items" USING "btree" ("barcode");



CREATE INDEX "idx_inventory_status" ON "public"."inventory_items" USING "btree" ("status");



CREATE INDEX "idx_invoices_payment_status" ON "public"."invoices" USING "btree" ("payment_status");



CREATE INDEX "idx_order_stages_created_at" ON "public"."order_stages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_order_stages_order_id" ON "public"."order_stages" USING "btree" ("order_id");



CREATE INDEX "idx_orders_created_at" ON "public"."orders" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_orders_status" ON "public"."orders" USING "btree" ("order_status");



CREATE INDEX "idx_products_sku" ON "public"."products" USING "btree" ("sku");



CREATE INDEX "idx_products_status" ON "public"."products" USING "btree" ("status");



CREATE INDEX "invoice_payments_invoice_idx" ON "public"."invoice_payments" USING "btree" ("invoice_id");



CREATE OR REPLACE TRIGGER "after_payment_insert" AFTER INSERT ON "public"."invoice_payments" FOR EACH ROW EXECUTE FUNCTION "public"."trigger_recalculate_status"();



CREATE OR REPLACE TRIGGER "update_customers_updated_at" BEFORE UPDATE ON "public"."customers" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_orders_updated_at" BEFORE UPDATE ON "public"."orders" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_actor_profile_id_fkey" FOREIGN KEY ("actor_profile_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."consents"
    ADD CONSTRAINT "consents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_measurements"
    ADD CONSTRAINT "customer_measurements_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."customer_measurements"
    ADD CONSTRAINT "customer_measurements_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."measurement_templates"("id");



ALTER TABLE ONLY "public"."customer_payments"
    ADD CONSTRAINT "customer_payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id");



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoice_items"
    ADD CONSTRAINT "invoice_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_customer_payment_id_fkey" FOREIGN KEY ("customer_payment_id") REFERENCES "public"."customer_payments"("id");



ALTER TABLE ONLY "public"."invoice_payments"
    ADD CONSTRAINT "invoice_payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invoices"
    ADD CONSTRAINT "invoices_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."marketing_events"
    ADD CONSTRAINT "marketing_events_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."measurement_fields"
    ADD CONSTRAINT "measurement_fields_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."measurement_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."measurement_links"
    ADD CONSTRAINT "measurement_links_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."measurement_links"
    ADD CONSTRAINT "measurement_links_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."measurement_templates"("id");



ALTER TABLE ONLY "public"."measurement_profile_values"
    ADD CONSTRAINT "measurement_profile_values_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."measurement_profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."measurement_profiles"
    ADD CONSTRAINT "measurement_profiles_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."measurement_profiles"
    ADD CONSTRAINT "measurement_profiles_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."measurement_templates"("id");



ALTER TABLE ONLY "public"."order_measurements"
    ADD CONSTRAINT "order_measurements_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_measurements"
    ADD CONSTRAINT "order_measurements_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."measurement_templates"("id");



ALTER TABLE ONLY "public"."order_stages"
    ADD CONSTRAINT "order_stages_new_stage_id_fkey" FOREIGN KEY ("new_stage_id") REFERENCES "public"."stages"("id");



ALTER TABLE ONLY "public"."order_stages"
    ADD CONSTRAINT "order_stages_new_vendor_id_fkey" FOREIGN KEY ("new_vendor_id") REFERENCES "public"."vendors"("id");



ALTER TABLE ONLY "public"."order_stages"
    ADD CONSTRAINT "order_stages_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."order_stages"
    ADD CONSTRAINT "order_stages_vendor_id_fkey" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."orders"
    ADD CONSTRAINT "orders_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payment_allocations"
    ADD CONSTRAINT "payment_allocations_customer_payment_id_fkey" FOREIGN KEY ("customer_payment_id") REFERENCES "public"."customer_payments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payment_allocations"
    ADD CONSTRAINT "payment_allocations_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_push_devices"
    ADD CONSTRAINT "user_push_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."vendors"
    ADD CONSTRAINT "vendors_stage_id_fkey" FOREIGN KEY ("stage_id") REFERENCES "public"."stages"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can delete customers" ON "public"."customers" FOR DELETE USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role")));



CREATE POLICY "Admins can delete invoice items" ON "public"."invoice_items" FOR DELETE USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role")));



CREATE POLICY "Admins can delete invoices" ON "public"."invoices" FOR DELETE USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role")));



CREATE POLICY "Admins can delete order stages" ON "public"."order_stages" FOR DELETE USING (("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role") OR "public"."has_role"("auth"."uid"(), 'staff'::"public"."app_role")));



CREATE POLICY "Admins can delete products" ON "public"."products" FOR DELETE USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can delete profiles" ON "public"."profiles" FOR DELETE USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can manage marketing events" ON "public"."marketing_events" USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can update any profile" ON "public"."profiles" FOR UPDATE USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view all profiles" ON "public"."profiles" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Admins can view audit logs" ON "public"."audit_logs" FOR SELECT USING ("public"."has_role"("auth"."uid"(), 'admin'::"public"."app_role"));



CREATE POLICY "Authenticated users can view consents" ON "public"."consents" FOR SELECT USING ("public"."is_authenticated_user"());



CREATE POLICY "Authenticated users can view customers" ON "public"."customers" FOR SELECT USING ("public"."is_authenticated_user"());



CREATE POLICY "Authenticated users can view invoice items" ON "public"."invoice_items" FOR SELECT USING ("public"."is_authenticated_user"());



CREATE POLICY "Authenticated users can view invoices" ON "public"."invoices" FOR SELECT USING ("public"."is_authenticated_user"());



CREATE POLICY "Authenticated users can view marketing events" ON "public"."marketing_events" FOR SELECT USING ("public"."is_authenticated_user"());



CREATE POLICY "Authenticated users can view order stages" ON "public"."order_stages" FOR SELECT USING ("public"."is_authenticated_user"());



CREATE POLICY "Authenticated users can view orders" ON "public"."orders" FOR SELECT USING ("public"."is_authenticated_user"());



CREATE POLICY "Authenticated users can view products" ON "public"."products" FOR SELECT USING ("public"."is_authenticated_user"());



CREATE POLICY "Public read customer name via invoice tracking" ON "public"."customers" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."invoices"
  WHERE (("invoices"."customer_id" = "customers"."id") AND ("invoices"."tracking_token" IS NOT NULL)))));



CREATE POLICY "Public read invoice via tracking token" ON "public"."invoices" FOR SELECT USING (("tracking_token" IS NOT NULL));



CREATE POLICY "Public read order stages via invoice tracking token" ON "public"."order_stages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."orders"
     JOIN "public"."invoices" ON (("invoices"."id" = "orders"."invoice_id")))
  WHERE (("orders"."id" = "order_stages"."order_id") AND ("invoices"."tracking_token" IS NOT NULL)))));



CREATE POLICY "Public read orders via invoice tracking token" ON "public"."orders" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."invoices"
  WHERE (("invoices"."id" = "orders"."invoice_id") AND ("invoices"."tracking_token" IS NOT NULL)))));



CREATE POLICY "Staff and admins can delete orders" ON "public"."orders" FOR DELETE USING ("public"."is_authenticated_user"());



CREATE POLICY "Staff and admins can insert customers" ON "public"."customers" FOR INSERT WITH CHECK ("public"."is_authenticated_user"());



CREATE POLICY "Staff and admins can insert invoice items" ON "public"."invoice_items" FOR INSERT WITH CHECK ("public"."is_authenticated_user"());



CREATE POLICY "Staff and admins can insert invoices" ON "public"."invoices" FOR INSERT WITH CHECK ("public"."is_authenticated_user"());



CREATE POLICY "Staff and admins can insert order stages" ON "public"."order_stages" FOR INSERT WITH CHECK ("public"."is_authenticated_user"());



CREATE POLICY "Staff and admins can insert orders" ON "public"."orders" FOR INSERT WITH CHECK ("public"."is_authenticated_user"());



CREATE POLICY "Staff and admins can insert products" ON "public"."products" FOR INSERT WITH CHECK ("public"."is_authenticated_user"());



CREATE POLICY "Staff and admins can manage consents" ON "public"."consents" USING ("public"."is_authenticated_user"());



CREATE POLICY "Staff and admins can update customers" ON "public"."customers" FOR UPDATE USING ("public"."is_authenticated_user"());



CREATE POLICY "Staff and admins can update invoice items" ON "public"."invoice_items" FOR UPDATE USING ("public"."is_authenticated_user"());



CREATE POLICY "Staff and admins can update invoices" ON "public"."invoices" FOR UPDATE USING ("public"."is_authenticated_user"());



CREATE POLICY "Staff and admins can update order stages" ON "public"."order_stages" FOR UPDATE USING ("public"."is_authenticated_user"());



CREATE POLICY "Staff and admins can update orders" ON "public"."orders" FOR UPDATE USING ("public"."is_authenticated_user"());



CREATE POLICY "Staff and admins can update products" ON "public"."products" FOR UPDATE USING ("public"."is_authenticated_user"());



CREATE POLICY "System can insert audit logs" ON "public"."audit_logs" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "allow insert customer_measurements" ON "public"."customer_measurements" FOR INSERT WITH CHECK (true);



CREATE POLICY "allow insert measurement_links" ON "public"."measurement_links" FOR INSERT WITH CHECK (true);



CREATE POLICY "allow read customer_measurements" ON "public"."customer_measurements" FOR SELECT USING (true);



CREATE POLICY "allow read measurement_fields" ON "public"."measurement_fields" FOR SELECT USING (true);



CREATE POLICY "allow read measurement_links" ON "public"."measurement_links" FOR SELECT USING (true);



CREATE POLICY "allow read measurement_templates" ON "public"."measurement_templates" FOR SELECT USING (true);



CREATE POLICY "allow update customer_measurements" ON "public"."customer_measurements" FOR UPDATE USING (true);



CREATE POLICY "allow update measurement_links" ON "public"."measurement_links" FOR UPDATE USING (true);



ALTER TABLE "public"."audit_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customer_measurements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."customers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoice_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."invoices" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."marketing_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."measurement_fields" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."measurement_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."measurement_profile_values" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."measurement_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."measurement_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_measurements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."order_stages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."orders" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."products" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."execute_sql"("sql" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."execute_sql"("sql" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."execute_sql"("sql" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_cash_inflow_daily"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_cash_inflow_daily"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cash_inflow_daily"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_cash_inflow_daily"("from_date" "date", "to_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_cash_inflow_daily"("from_date" "date", "to_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_cash_inflow_daily"("from_date" "date", "to_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_delivery_risk"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_delivery_risk"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_delivery_risk"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_owner_summary"("month_start" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_owner_summary"("month_start" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_owner_summary"("month_start" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_monthly_owner_summary"("p_year" integer, "p_month" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_monthly_owner_summary"("p_year" integer, "p_month" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_monthly_owner_summary"("p_year" integer, "p_month" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_order_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_order_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_order_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_owner_insights"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_owner_insights"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_owner_insights"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_owner_insights"("from_date" "date", "to_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_owner_insights"("from_date" "date", "to_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_owner_insights"("from_date" "date", "to_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_owner_summary"("from_date" "date", "to_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_owner_summary"("from_date" "date", "to_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_owner_summary"("from_date" "date", "to_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_process_breakdown"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_process_breakdown"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_process_breakdown"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_revenue_trend"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_revenue_trend"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_revenue_trend"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_revenue_trend"("from_date" "date", "to_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."get_revenue_trend"("from_date" "date", "to_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_revenue_trend"("from_date" "date", "to_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_vendor_load"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_vendor_load"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_vendor_load"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_vendor_work"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_vendor_work"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_vendor_work"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "anon";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_role"("_user_id" "uuid", "_role" "public"."app_role") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_authenticated_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_authenticated_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_authenticated_user"() TO "service_role";



GRANT ALL ON TABLE "public"."orders" TO "anon";
GRANT ALL ON TABLE "public"."orders" TO "authenticated";
GRANT ALL ON TABLE "public"."orders" TO "service_role";



GRANT ALL ON FUNCTION "public"."orders_due_today"() TO "anon";
GRANT ALL ON FUNCTION "public"."orders_due_today"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."orders_due_today"() TO "service_role";



GRANT ALL ON FUNCTION "public"."orders_due_tomorrow"() TO "anon";
GRANT ALL ON FUNCTION "public"."orders_due_tomorrow"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."orders_due_tomorrow"() TO "service_role";



GRANT ALL ON FUNCTION "public"."orders_overdue"() TO "anon";
GRANT ALL ON FUNCTION "public"."orders_overdue"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."orders_overdue"() TO "service_role";



GRANT ALL ON FUNCTION "public"."recalculate_invoice_payment_status"("p_invoice_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."recalculate_invoice_payment_status"("p_invoice_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."recalculate_invoice_payment_status"("p_invoice_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."trigger_recalculate_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."trigger_recalculate_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trigger_recalculate_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_order_delivery_date"("p_order_id" "uuid", "p_new_date" "text", "p_actor_profile_id" "uuid", "p_reason" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."update_order_delivery_date"("p_order_id" "uuid", "p_new_date" "text", "p_actor_profile_id" "uuid", "p_reason" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_order_delivery_date"("p_order_id" "uuid", "p_new_date" "text", "p_actor_profile_id" "uuid", "p_reason" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON TABLE "public"."consents" TO "anon";
GRANT ALL ON TABLE "public"."consents" TO "authenticated";
GRANT ALL ON TABLE "public"."consents" TO "service_role";



GRANT ALL ON TABLE "public"."customer_measurements" TO "anon";
GRANT ALL ON TABLE "public"."customer_measurements" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_measurements" TO "service_role";



GRANT ALL ON TABLE "public"."customer_payments" TO "anon";
GRANT ALL ON TABLE "public"."customer_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."customer_payments" TO "service_role";



GRANT ALL ON TABLE "public"."customers" TO "anon";
GRANT ALL ON TABLE "public"."customers" TO "authenticated";
GRANT ALL ON TABLE "public"."customers" TO "service_role";



GRANT ALL ON TABLE "public"."inventory_items" TO "anon";
GRANT ALL ON TABLE "public"."inventory_items" TO "authenticated";
GRANT ALL ON TABLE "public"."inventory_items" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_items" TO "anon";
GRANT ALL ON TABLE "public"."invoice_items" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_items" TO "service_role";



GRANT ALL ON TABLE "public"."invoice_payments" TO "anon";
GRANT ALL ON TABLE "public"."invoice_payments" TO "authenticated";
GRANT ALL ON TABLE "public"."invoice_payments" TO "service_role";



GRANT ALL ON TABLE "public"."invoices" TO "anon";
GRANT ALL ON TABLE "public"."invoices" TO "authenticated";
GRANT ALL ON TABLE "public"."invoices" TO "service_role";



GRANT ALL ON TABLE "public"."marketing_events" TO "anon";
GRANT ALL ON TABLE "public"."marketing_events" TO "authenticated";
GRANT ALL ON TABLE "public"."marketing_events" TO "service_role";



GRANT ALL ON TABLE "public"."measurement_fields" TO "anon";
GRANT ALL ON TABLE "public"."measurement_fields" TO "authenticated";
GRANT ALL ON TABLE "public"."measurement_fields" TO "service_role";



GRANT ALL ON TABLE "public"."measurement_links" TO "anon";
GRANT ALL ON TABLE "public"."measurement_links" TO "authenticated";
GRANT ALL ON TABLE "public"."measurement_links" TO "service_role";



GRANT ALL ON TABLE "public"."measurement_profile_values" TO "anon";
GRANT ALL ON TABLE "public"."measurement_profile_values" TO "authenticated";
GRANT ALL ON TABLE "public"."measurement_profile_values" TO "service_role";



GRANT ALL ON TABLE "public"."measurement_profiles" TO "anon";
GRANT ALL ON TABLE "public"."measurement_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."measurement_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."measurement_templates" TO "anon";
GRANT ALL ON TABLE "public"."measurement_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."measurement_templates" TO "service_role";



GRANT ALL ON TABLE "public"."order_stages" TO "anon";
GRANT ALL ON TABLE "public"."order_stages" TO "authenticated";
GRANT ALL ON TABLE "public"."order_stages" TO "service_role";



GRANT ALL ON TABLE "public"."order_items_calendar_view" TO "anon";
GRANT ALL ON TABLE "public"."order_items_calendar_view" TO "authenticated";
GRANT ALL ON TABLE "public"."order_items_calendar_view" TO "service_role";



GRANT ALL ON TABLE "public"."order_measurements" TO "anon";
GRANT ALL ON TABLE "public"."order_measurements" TO "authenticated";
GRANT ALL ON TABLE "public"."order_measurements" TO "service_role";



GRANT ALL ON TABLE "public"."orders_with_details" TO "anon";
GRANT ALL ON TABLE "public"."orders_with_details" TO "authenticated";
GRANT ALL ON TABLE "public"."orders_with_details" TO "service_role";



GRANT ALL ON TABLE "public"."payment_allocations" TO "anon";
GRANT ALL ON TABLE "public"."payment_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."payment_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."products" TO "anon";
GRANT ALL ON TABLE "public"."products" TO "authenticated";
GRANT ALL ON TABLE "public"."products" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."stages" TO "anon";
GRANT ALL ON TABLE "public"."stages" TO "authenticated";
GRANT ALL ON TABLE "public"."stages" TO "service_role";



GRANT ALL ON TABLE "public"."user_push_devices" TO "anon";
GRANT ALL ON TABLE "public"."user_push_devices" TO "authenticated";
GRANT ALL ON TABLE "public"."user_push_devices" TO "service_role";



GRANT ALL ON TABLE "public"."vendors" TO "anon";
GRANT ALL ON TABLE "public"."vendors" TO "authenticated";
GRANT ALL ON TABLE "public"."vendors" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







RESET ALL;
