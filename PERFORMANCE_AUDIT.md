# Performance Audit — Saree Palace Elite

_Date: 2026-10-08 · Scope: load-time & scalability audit · ~500 invoices, ~1000+ orders, ~1 year in production_

> **Read me first.** This is a findings + recommendations document. **No application code has been changed.**
> Every recommendation is designed to preserve current functionality. Each is tagged with a risk level so you
> can decide what (if anything) to pick up later. Nothing here needs to be done all at once.

---

## TL;DR

Your slow, *inconsistent* page loads are **not** a frontend/bundle problem — the JS is well code-split and the
initial download is small (150 KB gzipped entry chunk). The problem is in the **data layer**: the main list
pages fetch **the entire table every time** (all invoices, all customers *with every invoice nested*, up to 1000
orders with nested stages), including a heavy `raw_payload` JSON blob per invoice. On top of that, **global
realtime subscriptions re-trigger those full fetches whenever anyone on the team saves anything.**

- When the shop is quiet → the big fetch finishes → page feels OK.
- When billing/karigar activity is happening → every save invalidates the cache → the big fetches re-run over and
  over on every open device → "it takes forever."

That "sometimes fast, sometimes forever" pattern is the signature of #1 and #2 below.

**The three changes with the highest impact-to-risk ratio:**
1. Scope / throttle the realtime subscriptions + stop the auth profile-refetch loop (fixes most of the *inconsistency*). — low risk
2. Server-side pagination + narrowed column selects on the list pages (fixes the *scaling*). — medium risk
3. Replace the "all customers with all invoices" query with a SQL aggregate. — medium risk

---

## Measured baseline (live, against production, 2026-10-08)

I ran the app's **actual queries** against your live database (read-only, no writes) and measured only
timing + payload size — no customer data was copied anywhere. Two runs each; data as of today (456 invoices,
1,340 orders, 288 customers, 396 payments).

| Page / query | Rows pulled | Payload | Time (run1 / run2) |
|---|---:|---:|---:|
| **Invoices** list (`select *` + joins) | 456 | **658 KB** | 725 / 597 ms |
| **Customers** (every customer + every invoice incl. `raw_payload`) | 288 | **521 KB** | 386 / 446 ms |
| **Orders** list (limit 1000 + nested stages) | 1000 | **1,420 KB** | 873 / 482 ms |
| **Payments** register | 396 | 125 KB | 416 / 223 ms |

Note the **run-to-run variance even in a quiet single-user test** (Orders 873 → 482 ms, Invoices 725 → 597 ms).
That is the "inconsistency" in miniature; under real multi-user load it is amplified by the refetch issues below.

**Projected after** narrowing columns + first-page pagination (same queries, measured live):

| Query | Before | After | Reduction |
|---|---:|---:|---:|
| Invoices, first 50, drop `raw_payload` | 658 KB | **15 KB** | ~98% |
| Orders, first 50, keep stages | 1,420 KB | **79 KB** | ~94% |
| Orders, first 50, no nested stages | 1,420 KB | **28 KB** | ~98% |
| Customers, drop nested `raw_payload` (no pagination yet) | 521 KB | **94 KB** | ~82% |

Supporting measurements:
- `raw_payload` is ~**79% of the invoice-list bytes** (50 rows: 71 KB → 15 KB once removed). It's the single biggest
  lever, and it's only there for `paid_amount` (see Tier-2 #6).
- Nested `order_stages` roughly **triples** the orders payload (50 rows: 28 KB → 79 KB).
- An **exact count** query (needed to drive paginated UI) costs only **~180 ms** — server-side pagination is cheap.

---

## How the app is built (context)

| Area | Detail |
|---|---|
| Frontend | Vite + React 18 + TypeScript, SWC. Routes are **already lazy-loaded** via `React.lazy` ([src/App.tsx](src/App.tsx)). |
| Data | TanStack Query (React Query) over Supabase JS client ([src/integrations/supabase/client.ts](src/integrations/supabase/client.ts)). |
| Query defaults | `staleTime: 60s`, `gcTime: 5m`, `retry: 1`, `refetchOnWindowFocus: false` — **sensible** ([src/App.tsx](src/App.tsx)). |
| Hosting | Vercel static SPA (`vercel.json` rewrites all to `/`). |
| DB indexes | Actually **good** — see `supabase/schema-live.sql` lines ~1559–1622. Created-at, customer_id, invoice_id, payment_status, order_stages composite, etc. are all indexed. |

**What this means:** the usual suspects (missing indexes, no code splitting, giant bundle, refetch-on-focus storms)
are mostly already handled. The remaining cost is in *how much data each page pulls and how often*.

---

## Root causes, ranked

### 🔴 1. List pages fetch the whole table, every time (no server-side pagination)

| Page | Query | What it pulls |
|---|---|---|
| Invoices | `invoicesService.fetchInvoices` ([src/services/invoicesService.ts:8](src/services/invoicesService.ts)) | `select *` on **all** invoices (incl. `raw_payload` jsonb) + nested `customers`, `orders`, `invoice_payments`. **No `.limit()`.** |
| Customers | `customersService.fetchCustomersWithInvoices` ([src/services/customersService.ts:23](src/services/customersService.ts)) | **Every customer** with **every nested invoice** (incl. `raw_payload`) + nested `invoice_payments`. This is effectively your whole invoices table nested under customers — **the single heaviest query in the app.** |
| Orders | `ordersService.fetchOrders` ([src/services/ordersService.ts:11](src/services/ordersService.ts)) | Up to **1000** orders, each with nested `order_stages`, `customers`, `invoices`. |
| Payments | `invoicesService.fetchPaymentsRegister` ([src/services/invoicesService.ts:118](src/services/invoicesService.ts)) | **All** payments with nested invoice → customer. (This page at least paginates *in the browser* afterward.) |

The pages then filter/sort/slice **client-side** in `useMemo` (e.g. `filteredInvoices` → `sortedInvoices` in
[src/pages/Invoices.tsx:895](src/pages/Invoices.tsx); `customersWithMetrics` in [src/pages/Customers.tsx:248](src/pages/Customers.tsx)).

**Why it got slower over a year:** cost grows linearly with rows. At launch (a handful of invoices) it was
instant; at 500 invoices / 1000 orders each payload is now large, and it will keep degrading as you grow.

> **Correctness side-note (found while measuring):** the live orders table has **1,340 rows** but
> `fetchOrders` caps at `.limit(1000)` ([src/services/ordersService.ts:37](src/services/ordersService.ts) and
> [src/pages/OrdersNew.tsx:211](src/pages/OrdersNew.tsx)). So the Orders page is **silently omitting ~340 of your
> oldest orders today**, and the gap widens as you grow. Server-side pagination (Tier 2) removes the cap *and* makes
> each page fast — so it fixes a hidden data-completeness bug at the same time.

---

### 🔴 1b. The auth layer refetches your profile every ~6 seconds, forever

Measured live: `profiles?select=*` was fetched **29 times in a ~4.6-minute mostly-idle session** (one taking
**1.2 s**), on a steady **~6-second cadence**. I confirmed the trigger directly: `supabase.auth.onAuthStateChange`
emits a `SIGNED_IN` event roughly every 6 seconds, and the handler in
[src/lib/auth.tsx:152](src/lib/auth.tsx) calls `fetchProfile` on **every** such event
([src/lib/auth.tsx:162](src/lib/auth.tsx)). The access-token lifetime is a normal 3600 s, so this is **not** token
refresh — the handler is simply re-running on repeated `SIGNED_IN` emissions.

**Impact:** a constant background trickle of DB round-trips on every open device, each competing with your real
page queries for the same connection — a steady contributor to the "random slowness." It's wasted work even when
nobody is doing anything.

**Fix (behavior-preserving):** in the `onAuthStateChange` handler, only call `fetchProfile` when the user
**actually changes** (e.g. guard on `currentUser?.id !== previousUserId`, or react only to real `SIGNED_OUT`/
sign-in transitions). The existing realtime `profiles` channel ([src/lib/auth.tsx:187](src/lib/auth.tsx)) already
keeps role/kill-switch state fresh, so role changes still propagate. Low risk.

---

### 🔴 2. Global realtime subscriptions re-run those heavy fetches on every save

`useRealtimeSync` ([src/hooks/use-realtime-sync.ts](src/hooks/use-realtime-sync.ts)) is mounted on
**Invoices, Customers, Payments, and Orders** — each with a **global** subscription (no row filter):

- [src/pages/OrdersNew.tsx:54](src/pages/OrdersNew.tsx) → `useRealtimeSync({ enableOrders: true })`
- [src/pages/Payments.tsx:54](src/pages/Payments.tsx) → `useRealtimeSync({ enableInvoices: true })`
- [src/pages/Invoices.tsx](src/pages/Invoices.tsx) and [src/pages/Customers.tsx](src/pages/Customers.tsx) likewise.

On **any** change to `orders`, `order_stages`, `invoices`, or `invoice_payments` — anywhere, by anyone — the hook
(debounced only 300 ms) calls `invalidateQueries(["invoices"])` / `["orders"]` / etc., which forces the
**full table fetch from #1 to re-run**, on **every connected device**.

**This is the main driver of the inconsistency.** Quiet shop = few invalidations = fast. Busy billing counter +
karigars updating stages = a storm of invalidations = the big queries never settle = "forever."

> Bonus correctness note (not perf): the Customers list reads under key `["customers-with-invoices"]`
> ([src/pages/Customers.tsx:145](src/pages/Customers.tsx)) but both its mutations and the realtime hook invalidate
> `["customers"]` ([src/hooks/use-realtime-sync.ts:124](src/hooks/use-realtime-sync.ts)). **These keys don't
> match**, so the customer list can show stale totals after a payment until a hard reload. Worth a look, but out
> of scope for "don't change functionality."

---

### 🟠 3. `raw_payload` JSON blob is dragged into every list row

`invoices.raw_payload` is a `jsonb` column (schema line ~1105) holding the full original invoice (line items,
delivery info, etc.). `select *` and the nested customer→invoices select both pull it for **every** row, but the
lists only display a handful of fields.

**Caveat (important):** `raw_payload.paid_amount` is genuinely *read* for payment status in
[src/lib/derivePaymentStatus.ts](src/lib/derivePaymentStatus.ts) and [src/components/InvoiceRow.tsx](src/components/InvoiceRow.tsx),
so you can't just drop `raw_payload` from the select without first promoting `paid_amount` to a real column (see
Tier 2). I'm flagging this so the fix is done safely, not naively.

---

### 🟡 4. All rows render to the DOM — no pagination or virtualization

- Invoices renders **every** `sortedInvoices` row ([src/pages/Invoices.tsx:1906](src/pages/Invoices.tsx)); Orders
  renders all groups. No `react-window`/virtualization anywhere.
- `InvoiceRow` ([src/components/InvoiceRow.tsx](src/components/InvoiceRow.tsx)) is **not** `memo`-ized, so a single
  keystroke in the search box or one realtime invalidation re-renders all ~500 rows.
- Good news: `InvoiceRow` is correctly written to **avoid an N+1** — it uses the joined `invoice_payments` and only
  falls back to a per-row query when payments weren't joined (which they always are). So there's no 500-query storm
  here; the cost is pure DOM/render.

This is secondary to the network cost but adds visible jank on the shop's Windows PC.

---

### 🟡 5. Heavy client-side computation grows with data

- Customers computes lifetime-value + ledger balance for every customer across all their invoices on the client
  ([src/pages/Customers.tsx:248](src/pages/Customers.tsx)).
- Orders runs long `useMemo` enrichment/group chains over up to 1000 orders
  ([src/pages/OrdersNew.tsx:245](src/pages/OrdersNew.tsx) onward).

Fine today; both are better done in SQL as you scale.

---

### 🟢 6. Bundle & first paint — already healthy (not your problem)

- 130 chunks, routes code-split. Entry chunk **494 KB raw / ~150 KB gzipped** — fine.
- Heaviest chunk `PrintableInvoice` (1.4 MB / 486 KB gz = jsPDF + react-pdf + html2canvas) is **lazy-loaded** only
  when printing. Good.
- Minor: no `manualChunks` vendor splitting and no CDN/compression tuning, but this is noise next to #1–#2.

**Conclusion:** don't spend effort on the bundle right now.

---

## Recommendations (prioritized, functionality-preserving)

### Tier 1 — High impact, low risk (mechanical, no business-logic change)

1. **Tame realtime.** Biggest *inconsistency* win. Options, cheapest first:
   - Raise the debounce from 300 ms to ~2–5 s in [use-realtime-sync.ts](src/hooks/use-realtime-sync.ts).
   - Only enable realtime on **detail** pages (where a row filter like `orderId`/`invoiceId` already exists), not
     the global list pages. List pages already have `staleTime` + manual refetch on mutate.
   - Keep list auto-refresh but have realtime update just the changed row in cache instead of invalidating the
     whole list.
2. **Stop the ~6 s profile refetch loop** (see 1b): guard `fetchProfile` so it only runs when the user id changes.
   Eliminates a constant background DB round-trip on every device.
3. **Add `placeholderData: keepPreviousData`** to the list queries (Invoices query has none,
   [src/pages/Invoices.tsx:272](src/pages/Invoices.tsx)). Navigating back to a list then shows cached data instantly
   while it revalidates, instead of a full-screen spinner.
4. **`memo` the row components** (`InvoiceRow`, order row cards) so typing in search doesn't re-render 500 rows.
5. **Build config:** add `build.rollupOptions.output.manualChunks` for vendor splitting in
   [vite.config.ts](vite.config.ts). Nice-to-have.

### Tier 2 — High impact, medium risk (same features, needs testing)

5. **Server-side pagination + narrowed selects** on Invoices / Orders / Payments / Customers. Replace `select *` and
   no-limit fetches with explicit columns + `.range(from, to)`, and push search/filter/sort to Postgres (your
   indexes already support `created_at`, `customer_id`, `payment_status`, etc.). Keep the exact same table UI — just
   feed it a page at a time. This is the real *scalability* fix.
6. **Promote `paid_amount` (and/or a definitive `payment_status`) out of `raw_payload`** into a real/generated
   column, backfilled once. Then list queries can stop selecting `raw_payload` entirely → much smaller payloads.
   Must be paired with #3-caveat above so payment status stays correct.
7. **Replace `fetchCustomersWithInvoices` with a SQL aggregate** (an RPC or a view returning per-customer
   `total_spent`, `total_due`, `invoice_count`). Removes the heaviest query in the app; the Customers page just
   renders the numbers instead of recomputing them over nested invoices.

### Tier 3 — Scale & infra

8. **Confirm the Supabase plan / connection pooling.** Random multi-second "forever" loads with otherwise-fine
   queries often mean cold starts or pooler saturation. Check the Supabase dashboard (plan tier, compute add-on,
   pooler mode). This may explain the worst outliers independent of the code.
9. **Virtualize** long tables (`@tanstack/react-virtual`) *if* you keep showing hundreds of rows after pagination.
10. **Pre-aggregate dashboards/reports** with SQL views or a nightly materialized view as data grows. (The
    Dashboard is already well-built — count/`head` queries + `limit(30/200)` + parallel fetches in
    [src/pages/Dashboard.tsx:97](src/pages/Dashboard.tsx) — so it's a later concern.)

---

## How to measure (before / after)

So improvements are provable, not guesswork:

1. **Browser DevTools → Network**, filtered to your Supabase domain, on each list page. Note the response **size**
   and **time** for the big queries (`invoices?select=*...`, `customers?select=*,invoices(...)`). These are the
   numbers to beat.
2. **React Query Devtools** (dev only) to *watch the refetch storm* described in #2 while someone saves on another
   device — you'll see the list queries flip to `fetching` repeatedly.
3. **Supabase dashboard → Query Performance / `pg_stat_statements`** to see which SQL is slowest server-side.
4. **Vercel Analytics / Speed Insights** for real-user first-load timing (expected to already be fine).

✅ **Baseline already captured** — see the "Measured baseline" section near the top of this document. Re-run the
same measurements after any change to prove the improvement.

---

## What I deliberately did **not** recommend

- No rewrite, no framework change, no schema redesign, no change to business rules (payment derivation, settlement
  logic, stage workflow). Everything above keeps your hard-won behavior intact.
- Nothing requires touching production data or adding test/dummy data.
