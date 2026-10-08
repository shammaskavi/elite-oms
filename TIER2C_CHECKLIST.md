# Stage 2C — Execution Checklist (Orders list slim)

_Living checklist. Each step: edit → build/type-check → verify in running app → tick → next._
_Branch: `perf/tier2-payload`. Rule: nothing breaks in Orders, Order detail, Karigar portal, or Public invoice._

## Confirmed out of scope (cannot be affected — separate queries)
- Karigar portal (`get_vendor_work` RPC), Karigar order detail, Public invoice tracking, Order detail, Dashboard.

## Step 0 — View (DB) ✅ DONE
- [x] **0.** Amended `order_stage_summary` with `vendors` array. (applied to prod)
- [x] Re-verified vs current derivation for all 1,340 orders: current_stage / products / vendors → **0 diffs**.

## Step-by-step code (each verified before the next)
- [x] **1. `ordersService`** — slimmed `fetchOrders` (dropped `order_stages`, paginates ALL), added
  `fetchOrderStageSummaries()`. _Verified: all 1,340 fetched._
- [x] **2. `OrdersNew` enrichment** — summaries query + `summaryMap`; `enrichedOrders` reads
  `currentStage` / `products` / `allVendors` (+ `vendorRaw`) from the summary; single-product fallback kept.
  _Verified: view matched history 0 diffs for all 1,340._
- [x] **3. Vendor filter** — uses `order.allVendors`. _Verified: 0 count diffs across all 23 vendors._
- [x] **4. Kanban vendor** — derives current-stage vendor from `order.products[].vendorRaw` (null-preserving).
- [x] **5. Optimistic stage-move** — re-targets `order-stage-summaries` (current_stage) + `order_status` on
  orders cache; rolls back both on error. _CODE done; live stage-move is a prod write → user to confirm._
- [x] **6. Invalidations** — `order-stage-summaries` added to deliver/cancel mutation `onSuccess`, stage-move
  `onSettled`, and `use-realtime-sync` (order_stages channel).

## Final verification
- [x] Orders list renders all 1,340; stats correct (Total 1340); stage grouping renders; vendor filter exact.
- [ ] **Stage-move (advance / deliver / cancel)** — not exercised by me (would write to prod). **USER to do one
  real stage-move and confirm it jumps stage instantly + persists.**
- [x] Karigar portal / Public invoice / Order detail — unchanged (separate queries; not touched).
- [x] `npm run build` clean; fresh-tab console clean.

## Payload reality (measured)
- Orders 764 KB (1,340 rows; `metadata` jsonb is the weight) + summaries 341 KB = **~1.1 MB**, vs old **1.4 MB**
  (1,000 rows w/ history). ~21% smaller AND all 1,340 shown. Bigger win is structural: payload is now **bounded**
  (current stage only) instead of growing with every stage transition.

## Cross-connections & follow-ups discovered (add as found)
- `use-realtime-sync.ts` invalidates `queryKeys.orders.all` on `order_stages` changes but **not** the new
  `order-stage-summaries` key → must add it (Step 6). Also note: the summaries key isn't scoped per-order, so a
  stage change invalidates the whole summaries list (acceptable; coalesced by the Tier-1 debounce).
- (future) Orders list now renders ~1,340 rows with no virtualization/pagination → candidate for a later
  virtualization/pagination pass if the shop PC feels heavy. **[follow-up, not 2C]**
