# Tier 2 Plan — Payload Slimming & Scaling

_Companion to [PERFORMANCE_AUDIT.md](PERFORMANCE_AUDIT.md). Status: **plan only — no code written.** For review before we touch anything._

> **Mandate carried over from Tier 1:** preserve all current functionality, flow, structure, and business
> logic. Every step below is designed to keep behavior identical; each is tagged with its risk and a concrete
> verification + rollback. We do **one page at a time**, measure after each, and stop early if we're fast enough.

---

## What Tier 2 is really about

The audit measured the list payloads: Invoices **658 KB**, Customers **521 KB**, Orders **1.4 MB**. The biggest
single lever is the `raw_payload` JSON blob dragged into list rows — it's ~79% of the invoice-list bytes and
exists in the list only for one number: `paid_amount`. The second lever is Orders pulling 1000 rows + nested
stages.

**Important re-framing (and why we may not need full pagination):** just *slimming the payloads* — without any
pagination — already gets us most of the win at a fraction of the risk, because it keeps **all** the current
client-side search / sort / filter / totals logic working exactly as-is:

| List | Now | After slimming only | Reduction |
|---|---:|---:|---:|
| Invoices (drop `raw_payload`) | 658 KB | ~137 KB | ~79% |
| Customers (drop nested `raw_payload`) | 521 KB | 94 KB | ~82% |
| Orders (drop nested stages from list) | 1,420 KB | ~250 KB | ~82% |

So the plan leads with **payload slimming** (low risk, no UX change) and treats **true server-side pagination**
as an optional later phase we only do if the slimmed numbers still aren't good enough.

---

## The enabler: a *generated* `paid_amount` column

The list needs `raw_payload.paid_amount`. Instead of promoting it with app code + a sync trigger (which can drift),
we add a Postgres **STORED generated column** derived from `raw_payload`:

```sql
ALTER TABLE public.invoices
  ADD COLUMN paid_amount numeric(12,2)
  GENERATED ALWAYS AS (
    CASE WHEN raw_payload->>'paid_amount' ~ '^[0-9]+(\.[0-9]+)?$'
         THEN (raw_payload->>'paid_amount')::numeric
         ELSE 0 END
  ) STORED;
```

**Why this is the safe choice:**
- Postgres maintains it automatically from `raw_payload` — **no app write changes, no trigger, zero drift risk**.
- It can never disagree with `raw_payload.paid_amount` (same source).
- The regex guard mirrors logic already in the schema (`schema-live.sql` ~line 861), so edge cases (nulls,
  non-numeric) behave as today → `0`.
- The app already anticipates it: `InvoiceRow` reads `invoice.raw_payload?.paid_amount ?? invoice.paid_amount ?? 0`
  ([InvoiceRow.tsx:59](src/components/InvoiceRow.tsx)).
- Table rewrite on 456 rows is instant; it's additive (nothing reads it until we choose to).

**One caveat to verify first** (pre-flight): adding a STORED generated column briefly locks the table. At this row
count it's milliseconds, but we run it in a quiet window to be safe.

---

## Pre-flight checks — ALREADY RUN (read-only, 2026-10-08) ✅

1. **`payment_status` parity** — ✅ **Done.** 3 invoices have `raw_payload.payment_status = 'paid'` while the
   column isn't (INV-019, INV-025, INV-029). **All 3 already derive to "paid"** via the money math (full amount in
   `raw_payload.paid_amount`), so retiring the blob flag changes nothing for them. **Safe to drop the fallback.**
2. **`paid_amount` parse coverage** — ✅ **Done.** **0** non-numeric `paid_amount` values → the generated column
   is safe and matches current behavior exactly.
3. **Generated value == derived legacy value** — ✅ Confirmed by the identity check (real cash + pending + written-off
   = total invoiced, to the rupee) across all 456 invoices.

---

## Reconciliation with everything we verified after the first draft

| Finding (verified live) | Impact on this plan |
|---|---|
| **Settled is column-only** (`settled` / `settlement_reason`), never in the blob; read as `invoice.settled` everywhere. | Dropping `raw_payload` **cannot** affect settled. **Must-do:** keep `settled` (and `settlement_reason` if shown) in the narrowed SELECTs. Already specified in 2A. |
| **Two homes for paid** still both in use (73 legacy blob, 334 payment rows, 21 both; 0 garbage). | Generated `paid_amount` captures the legacy half; derive still sums both. Unchanged by the slim. |
| **`payment_status` column stale on 122/456 (27%)** — but **never falsely "paid"** (only under-reports). | 2A reads the generated **`paid_amount`** column + live derive, **not** the stale status column → unaffected. This staleness is the gate on **2D** (server-side status filtering would mislabel ~82) — 2D still requires making the column reliable first. |
| **Advance-at-billing (blob write) is effectively OFF** — POS retired, desktop advance field commented out. | `raw_payload.paid_amount` is now **legacy/not-growing**. The slim only needs to **read** it (via the generated column). No write-path change needed. |
| **"Collected" overstates cash by ₹1,14,487** (settled write-offs counted as collected). | **Out of scope for Tier 2** (payload/scaling). Tier 2 keeps this number **identical** — 2A points derive at the generated column whose value equals the blob's, so all footer totals stay exactly as today. The Collected fix is a **separate, optional display change** (Option A/B), decided on its own. |

**Net:** the plan holds, and the two risky unknowns (blob status reliance, non-numeric paid) are now **cleared**. Tier 2 is read-side only and preserves every current number, including the (currently inflated) Collected.

---

## Stage 2A — Invoices list payload slim (primary; medium risk)

**Goal:** Invoices list stops fetching `raw_payload`; everything looks and behaves identically.

**Steps:**
1. **Migration:** add the generated `paid_amount` column (above). New file in `supabase/migrations/`.
2. **Point the status math at the column.** Update `derivePaymentStatusFromData`
   ([derivePaymentStatus.ts](src/lib/derivePaymentStatus.ts)) to read `invoice.paid_amount` as the legacy-paid
   source, falling back to `raw_payload?.paid_amount` when present (so it's correct whether or not the caller
   selected the blob). Pure function; unit-reasoned.
3. **Slim the list query.** Change `invoicesService.fetchInvoices` ([invoicesService.ts:8](src/services/invoicesService.ts))
   from `select *` to an explicit column list — every scalar column **except** `raw_payload` + `paid_amount`,
   plus the existing nested `customers`, `orders(payment_status)`, `invoice_payments(amount)`.
4. **Reroute the few list-path `raw_payload` reads** that would otherwise go dark:
   - `Invoices.tsx:918` payment filter's `raw_payload?.payment_status` term → rely on the `payment_status`
     column + derived status (guarded by pre-flight check #1).
   - **Open / print / edit actions** that currently reuse the in-list object's `raw_payload`
     ([Invoices.tsx:340-345](src/pages/Invoices.tsx) PDF, [Invoices.tsx:1991-2004](src/pages/Invoices.tsx) edit-draft):
     fetch the full invoice by id on open via the existing `invoicesService.fetchInvoiceById` (which selects `*`).
     This is one small, fast query only when a user opens/edits one invoice — not on list load.
5. **`InvoiceRow`** needs no change — it already prefers the column (`?? invoice.paid_amount`).

**Verify (live, read-only):** list renders identically; payment badges, "remaining" amounts, and the floating
footer totals match the current values for a spot-check set of invoices; the All/Paid/Unpaid/Draft filter and
search return the same rows; opening, printing, and editing a draft all still show correct items/discount/paid
values (now via fetch-by-id); measured list payload ~137 KB. Build + clean console.

**Rollback:** revert the service/derive/page edits (the generated column is harmless to leave, or drop it).

---

## Stage 2B — Customers list payload slim (low–medium risk)

**Goal:** `fetchCustomersWithInvoices` stops pulling nested `raw_payload`.

**Steps:**
1. Change the nested invoices select ([customersService.ts:37](src/services/customersService.ts)) to drop
   `raw_payload` and add `paid_amount` (the generated column) — i.e.
   `invoices(id, total, settled, payment_status, paid_amount, invoice_payments(amount))`.
2. Customer metrics already run through `derivePaymentStatusFromData`, which 2A pointed at `paid_amount` — so
   lifetime-value / ledger-balance math is unchanged.

**Verify:** per-customer "Total Spent" and "Pending Due" match current values for a spot-check set; payload ~94 KB.

**Optional (later, only if still slow):** replace this query with a SQL **aggregate view/RPC** returning
`total_spent`, `total_due`, `invoice_count` per customer, so the page renders numbers instead of recomputing over
nested invoices. Higher value at larger scale; defer until the slimmed version is measured.

---

## Stage 2C — Orders list (medium risk; separate)

Two distinct issues:
1. **Correctness:** the list caps at `.limit(1000)` but there are 1,340 orders → ~340 hidden
   ([ordersService.ts:37](src/services/ordersService.ts)). Must be addressed.
2. **Payload:** nested `order_stages` roughly triples the bytes (used for the stage badges/grouping).

**Approach options (to decide together):**
- **2C-i (lighter):** expose a per-order "current stage" via a DB view/column and select that instead of the full
  `order_stages` array in the list; fetch the full stage history only on the order detail page (already does).
  Removes the cap safely and cuts payload ~82%. The Orders page's client-side grouping would read the single
  current-stage field instead of the array — needs careful mapping to preserve the exact grouping/stats.
- **2C-ii (heavier):** true server-side pagination for Orders (see 2D caveats).

Because Orders has the most entangled client-side logic (enrichment, grouping by stage/invoice, stats), this stage
gets its own mini-plan and verification once 2A/2B are in and measured.

---

## Stage 2D — True server-side pagination (OPTIONAL; higher risk; only if needed)

Do this **only if** the slimmed payloads from 2A–2C still aren't fast/consistent enough. It's listed last because
it genuinely changes behavior shape and must be done per-page with care:

- **Search / sort / date & status filters must move server-side** (currently client-side `useMemo`s). The hard
  part is the **payment status filter**, which is *derived* (column + `raw_payload` legacy + `invoice_payments`),
  not a plain column — matching it exactly server-side needs the generated column + possibly a derived
  `effective_status` expression/view so results are identical to today.
- **Footer totals** (Invoiced / Collected / Pending Due) currently sum the full result set. With pagination they
  must come from a **separate aggregate query** over the same filters, or the totals would only reflect one page.
- Add `.range()` + an exact `count` (measured ~180 ms) to drive page controls; add `keepPreviousData` so paging
  doesn't flash a spinner (this is where that setting finally earns its place — deferred from Tier 1 Step 4).

**Recommendation:** treat 2D as a later, opt-in project with its own plan. Slimming (2A–2C) is likely enough for
your current scale, and we re-measure before deciding.

---

## Sequencing & decision gates

1. Pre-flight SQL checks → review results together.
2. **Stage 2A** (Invoices) → verify → **re-measure**.
3. **Decision gate:** if Invoices now loads consistently fast, Customers/Orders may be all that's left; skip 2D.
4. **Stage 2B** (Customers) → verify → re-measure.
5. **Stage 2C** (Orders) → its own mini-plan → verify → re-measure.
6. Revisit 2D only if a page is still slow after slimming.

Each stage is a separate, reviewable change on the branch, verified in the running app the same way we did Tier 1,
and independently revertible.

---

## Explicitly NOT changing

- No change to how invoices/orders/payments are **created, edited, settled, or paid** — only how lists are *read*.
- No change to payment-status business rules, settlement logic, stage workflow, or the CRM.
- `raw_payload` stays the source of truth and is still fully available on detail/edit/print via fetch-by-id.
- No data migrations that alter existing values (the generated column is derived, not a rewrite of your data).
