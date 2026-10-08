# Tier 2 · Stage 2C — Orders list (mini-plan)

_Plan only — no code written. Companion to [TIER2_PLAN.md](TIER2_PLAN.md)._

> Goal: cut the Orders list payload and fix the hidden-orders bug **without** changing how the Orders page,
> Karigar portal, Karigar order detail, Public invoice tracking, or Order detail behave or what they show.

---

## Scope & safety — what 2C touches (and, crucially, what it does NOT)

`ordersService.fetchOrders` (the list query 2C slims) is used by **only one place**: `OrdersNew.tsx`. Verified that
every other order surface runs its **own, separate** query and is therefore **untouched** by 2C:

| Surface | How it gets data | Affected by 2C? |
|---|---|---|
| **Orders page** (`OrdersNew.tsx`) | `ordersService.fetchOrders` | ✅ the only thing we change |
| **Karigar portal** (`KarigarPortal.tsx`) | `rpc("get_vendor_work")` + `vendors` query | ❌ no |
| **Karigar order detail** (`KarigarOrderDetail.tsx`) | own `orders` + `order_stages` by id | ❌ no |
| **Public invoice tracking** (`PublicInvoiceTracking.tsx`) | own token-scoped `orders(...order_stages)` query | ❌ no |
| **Order detail** (`OrderDetailNew.tsx`) | `fetchOrderById` + `fetchOrderStages` + `fetchStages` | ❌ no |
| **Dashboard** | own `orders` query + `order_items_calendar_view` | ❌ no |

So nothing in the karigar flow, the public screen, or any detail page can break from 2C.

---

## The two problems

1. **Payload ~1.4 MB.** `fetchOrders` embeds the **full `order_stages` history** for every order
   (`order_stages(id, stage_name, vendor_name, metadata, created_at)`). A product that moved through 5 stages
   carries 5 rows. The bloat is the **number of history rows**, not the columns — so trimming columns barely helps.
2. **`limit(1000)` hides data.** There are **1,340** orders; the list caps at 1,000, silently omitting ~340 of the
   oldest. Removing the cap *without* slimming would make the payload **bigger**, so the cap fix must ship together
   with the row-count reduction.

---

## Exactly what OrdersNew needs from the stages (the contract to preserve)

From `enrichedOrders` ([OrdersNew.tsx:245-346](src/pages/OrdersNew.tsx)), per order it derives only the **current**
state, never the history:

- **`currentStage`** = `stage_name` of the globally-latest stage row (by `created_at`).
- **`products[]`** = stages grouped by `metadata.product_number`, each taking its **latest** row →
  `{ productNumber, productName (metadata.product_name), stage (stage_name), vendor (vendor_name) }`.
- **Fallback** for older orders with no per-product metadata: a single product from `order.metadata.item_name` +
  `currentStage`. **Must be preserved.**

Confirmed it needs **nothing else** from stages:
- `order_stages.id` is **not** used by the list (the advance-stage action works off stage **names**, not ids).
- **Stats** already come from the server RPC `get_order_stats` (`statsData`); the client stage math is only a fallback.
- `ordersByStage` groups on the derived `order.currentStage` — i.e. on current state, not history.

**Conclusion:** the list only needs the **current stage per product** (one row per product), plus the order's own
columns + `customers(name)` + `invoices(invoice_number)`. The full history is dead weight here.

---

## Recommended approach — a "current stage per product" view

1. **New DB view** `order_product_current_stage` (migration; you apply it, like 2A):
   for each `(order_id, product_number)`, the latest stage via `DISTINCT ON` / LATERAL (same pattern the existing
   `orders_with_details` view already uses, just keyed by product too):
   `order_id, product_number, product_name, stage_name, vendor_name`.
   Plus the order-level latest stage (for `currentStage`) — either a second tiny view or derivable from the above.
   Additive, read-only, reversible (DROP VIEW); no data changes.
2. **Slim `fetchOrders`:** drop the nested `order_stages(...)` history; instead fetch the compact current-stage
   rows (either embedded via a PostgREST relationship on the view, or a second keyed query merged client-side by
   `order_id` — decide during impl based on what PostgREST detects). Remove `.limit(1000)` so all 1,340 load
   (now cheap, because each order carries a few current-stage rows instead of full history).
3. **Rewire `enrichedOrders`:** build `products[]` and `currentStage` directly from the current-stage rows instead
   of sorting history. **Keep the older-order fallback exactly.** Output shape (`products`, `currentStage`,
   everything else on the order) stays **identical**, so `ordersByStage`, filters, stats, counts, and the table/list
   rendering are unchanged.

**Expected:** payload well under ~300 KB for all 1,340 orders (vs 1.4 MB for 1,000 today), and the hidden-orders
bug fixed at the same time.

---

## Open questions to resolve during implementation (not blockers)

- **PostgREST embedding:** can `orders` embed the new view as a nested relationship, or do we fetch it as one extra
  keyed query and merge by `order_id`? Either works; pick the one that keeps the code simplest.
- **Order-level `currentStage`** when products sit at different stages: replicate today's rule exactly (the
  globally-latest stage row), not a new interpretation.
- **Orders with zero stage rows:** confirm the fallback path still triggers (older orders).

---

## Verification plan (before vs after, read-only)

For **all 1,340** orders, prove byte-for-byte equivalence of the derived data:
- Per order: `currentStage` identical; `products[]` identical (same productNumber → productName/stage/vendor).
- `ordersByStage` group membership identical; `stats` identical; active/completed/cancelled partition identical.
- The newly-surfaced ~340 orders appear correctly (they were simply missing before).
- Spot-check in the running app: Orders list renders, stage grouping/columns look right, the **advance-stage**
  action still works, and (re-confirmed) Karigar portal, Public tracking, and Order detail are unchanged.

---

## Risk & recommendation

This is the **most intricate** stage — it rewires the Orders page's core enrichment — so unlike 2A/2B it is a
medium-risk change, not a near-mechanical one. Recommendation: **commit 2A + 2B first** as a clean, verified
checkpoint, then do 2C on its own with the before/after harness. If the rewire ever looks shaky, the fallback
position is to **at least fix the `limit(1000)` bug** (correctness) and accept a smaller payload win.

## Explicitly NOT changing

- No change to the stage **workflow**, how stages are advanced, or the `order_stages` table itself.
- No change to Karigar portal/detail, Public invoice tracking, Order detail, or Dashboard.
- No change to order creation, payment, or settlement.
- The full stage history stays fully available on the Order detail and Karigar/Public screens (they query it directly).
