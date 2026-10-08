-- Tier 2 / Stage 2C enabler.
--
-- Read-only view giving, per order, the "current state" the Orders LIST needs
-- without fetching the full order_stages history:
--   * current_stage : the globally-latest stage name (by created_at)
--   * products       : latest stage per product_number, as a compact jsonb array
--                      [{ product_number, product_name, stage, vendor }, ...]
--
-- Mirrors the "latest stage via LATERAL / DISTINCT ON" pattern already used by
-- the existing orders_with_details and order_items_calendar_view views.
--
-- Safety:
--   * Read-only VIEW; the order_stages table and all stage history are UNTOUCHED.
--   * Additive; nothing reads it until the app is wired to. Reversible: DROP VIEW.
--   * Only orders whose stage metadata has a numeric product_number contribute to
--     `products`; orders without it yield an empty array (the app keeps its
--     existing single-product fallback for those).
--   * `vendors` is the distinct set of vendor_names ever assigned on the order's
--     stages, so the Orders page vendor filter keeps its "ever assigned to this
--     vendor" behavior without the full history.

CREATE OR REPLACE VIEW public.order_stage_summary AS
SELECT
  o.id AS order_id,
  (
    SELECT os.stage_name
    FROM public.order_stages os
    WHERE os.order_id = o.id
    ORDER BY os.created_at DESC
    LIMIT 1
  ) AS current_stage,
  (
    SELECT COALESCE(jsonb_agg(p ORDER BY p.product_number), '[]'::jsonb)
    FROM (
      SELECT DISTINCT ON ((os.metadata->>'product_number')::int)
        (os.metadata->>'product_number')::int AS product_number,
        (os.metadata->>'product_name')        AS product_name,
        os.stage_name                          AS stage,
        os.vendor_name                         AS vendor
      FROM public.order_stages os
      WHERE os.order_id = o.id
        AND os.metadata->>'product_number' ~ '^[0-9]+$'
      ORDER BY (os.metadata->>'product_number')::int, os.created_at DESC
    ) p
  ) AS products,
  (
    SELECT COALESCE(jsonb_agg(DISTINCT os.vendor_name), '[]'::jsonb)
    FROM public.order_stages os
    WHERE os.order_id = o.id
      AND os.vendor_name IS NOT NULL
  ) AS vendors
FROM public.orders o;

ALTER VIEW public.order_stage_summary OWNER TO postgres;
GRANT ALL ON public.order_stage_summary TO anon, authenticated, service_role;
