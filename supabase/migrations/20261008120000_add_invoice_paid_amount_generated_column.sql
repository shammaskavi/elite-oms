-- Tier 2 / Stage 2A enabler.
--
-- Adds a STORED generated column `paid_amount` on invoices, derived from
-- raw_payload->>'paid_amount' using the SAME regex/cast guard already used by
-- the recalculate_invoice_payment_status() function. This lets list queries
-- read the billing-time advance via a plain column instead of fetching the
-- whole raw_payload JSON blob.
--
-- Safety:
--   * Additive and fully derived — no existing row data is modified.
--   * Postgres maintains it automatically from raw_payload (no trigger, no drift).
--   * Handles NULL / missing / non-numeric values as 0, matching current app + DB behavior.
--   * Fully reversible: DROP COLUMN public.invoices.paid_amount;
--
-- Note: adding a STORED generated column rewrites the table once (instant at this
-- row count). Prefer running during a quiet moment.

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS paid_amount numeric(12,2)
  GENERATED ALWAYS AS (
    CASE
      WHEN raw_payload->>'paid_amount' ~ '^[0-9]+(\.[0-9]+)?$'
      THEN (raw_payload->>'paid_amount')::numeric
      ELSE 0
    END
  ) STORED;
