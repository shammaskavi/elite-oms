# Maintenance & Evolution Playbook — Saree Palace Elite

_A practical guide for keeping this app healthy and improving it over time, tuned for a small team on a budget.
Almost everything here is **free**._

The guiding idea: this is a **working production system that took a year to build**. The goal of maintenance isn't
to chase shiny rewrites — it's to **not lose data, not break what works, and improve deliberately.**

---

## 0. The workflow that's already working (keep doing this)

The way we've been making changes *is* the good practice — make it the standard:

1. **Never edit `master`/production directly.** Branch for every change.
2. **Small, isolated changes**, one concern at a time.
3. **Verify in the running app** before shipping — not just "it builds."
4. **For anything touching data or money, prove it's unchanged** (the before/after check: compute the numbers
   the old way and the new way, confirm 0 differences). This caught real issues during the perf work.
5. **Multi-part changes get a checklist** (like `TIER2C_CHECKLIST.md`) — tick each step after it's verified.
6. **Commit per verified phase** with a clear message, so history is revertible.
7. **Definition of done:** builds clean · verified in the app · no behavior/number regression · migration recorded
   in `supabase/migrations/` · committed.

---

## 1. Safety nets — do these first (cheap, highest value)

- [ ] **Backups.** Free-tier Supabase has none. Set up a scheduled `pg_dump` (GitHub Action → a free 10 GB bucket).
  Your DB is ~40 MB, so this is tiny and effectively free forever. **This is the single most important item** —
  a year of business data with no recovery point is the biggest risk you have.
- [ ] **A staging Supabase project (free).** The free plan allows a second project. Clone the schema there and
  **test every migration / risky change on staging first**, then apply to production. This is how you stop a bad
  migration from hitting live data.
- [ ] **Manual snapshot before anything risky.** Before a migration, bulk edit, or import, take a fresh dump first.
- [ ] **Keep migrations in the repo.** Every schema change goes in `supabase/migrations/` as a file (even if you
  run it via the SQL editor), so there's always a written record of how the DB got to its current shape.

## 2. Guardrails — know when something breaks (free, high value)

- [ ] **Error monitoring (Sentry free tier).** Right now, front-end errors fail silently (remember the POS payment
  insert that errored for months with nobody knowing). Sentry emails you when a real user hits an error. For a
  small team with no QA, this is the cheapest way to "have eyes."
- [ ] **Uptime monitoring (UptimeRobot free).** Pings your app URL every few minutes, alerts if it's down.
- [ ] **A tiny CI check (GitHub Actions).** On every push/PR, run `npm run build` (and lint). It won't fix the
  existing type errors, but it **stops a new change that breaks the build from reaching production.**
- [ ] **Check Supabase observability monthly** (CPU, memory/swap, connections) — the way we did. Upgrade compute
  only when the data actually shows pressure, not on a hunch.

## 2b. Known systemic pitfall — the 1,000-row response cap ⚠️

The Supabase data API (**PostgREST**) returns **at most ~1,000 rows per request** by default. A query that reads a
table bigger than that **without pagination or a narrowing filter** silently returns only the **newest ~1,000
rows** — the oldest records just disappear, **with no error**. This has already bitten us twice (the Orders screen
hiding old orders; the Vendor detail page undercounting a karigar's orders).

**The rule:** never "fetch all" of a table that can exceed ~1,000 rows. Instead:
- **Filter** to what the screen needs (e.g. active orders only, or one vendor's / one customer's / one invoice's
  rows) so the result stays well under the cap; **or**
- **Paginate** with a `.range(from, to)` loop until a short page (see `ordersService.fetchOrders` /
  `fetchOrderStageSummaries`); **or**
- **Compute server-side** with an RPC/view (e.g. `get_vendor_work`, `get_order_stats`) — the industry-standard way.

**Tables already over the cap:** `orders` (~1,350), `order_stages` (several thousand). **On the clock:** `invoices`
(~460) and `customers` (~290) are safe *today* but will hit the exact same silent truncation once they cross ~1,000
— so any "fetch all invoices/customers" code is a future bug. When reviewing a query on a growing table, ask:
*"could this table ever exceed 1,000 rows, and if so, is this filtered or paginated?"*

---

## 3. Code health — pay down the known debt slowly

These are the tangles we found. None are urgent; chip away one at a time, each verified:

- **Payment model cleanup** (the "two homes for paid"). See the model write-up and brainstorm (moves ①②③):
  one canonical place to compute paid/due, retire the near-dead `raw_payload.payment_status` flag, and (already
  largely done) keep advances out of the blob. Reduces the scattered logic that makes payments confusing.
- **Dead code removal** (zero risk): the retired POS page and the commented-out "Advance Payment" block — delete
  them to reduce confusion.
- **TypeScript errors.** `tsc` doesn't pass cleanly (pre-existing). Don't boil the ocean — just **don't add new
  ones**, and fix a few each time you're in a file.
- **The "Collected" accounting choice** (settled write-offs inflate Collected by ~₹1.1 L) — decide Option A/B when
  you care to.

## 4. Scaling — as you grow (the perf discipline)

- Keep the **measure-before/after** habit. Don't optimize on vibes; measure payloads/timings first.
- **Deferred perf items** (do when a page actually feels heavy): Orders list virtualization/pagination (it now
  renders ~1,340 rows), true server-side pagination for the big lists (Tier 2D), and making the `payment_status`
  column reliable if you ever move filtering server-side.
- **Watch the free-tier ceiling.** Memory is the tight resource on the current `nano` instance. When the shop grows
  (more concurrent users, more data), the honest upgrade path is a bigger Supabase compute — but only when the
  metrics justify it. Region (Singapore → Mumbai) is the biggest latency win for India, but it's a migration.

## 5. Keep the knowledge alive (so it's not all in one head)

- **Document the gotchas**, not the obvious. The payment model (two paid-homes, settled override, the stale
  status column, the manual-migration process) is exactly the kind of thing to write down — it's non-obvious and
  took real digging. Future-you (and any dev) will thank you.
- Keep the existing docs current: `AGENT_HANDOFF.md`, `INVENTORY_MODULE.md`, `PERFORMANCE_AUDIT.md`, the Tier-2
  plans/checklists. A short `docs/` folder beats tribal knowledge.

## 6. Dependency hygiene (cautious, not aggressive)

- **Security patches matter** — enable GitHub **Dependabot** (free) for alerts; apply security updates promptly.
- **Don't auto-upgrade majors.** React/Vite/Supabase major versions are deliberate, tested upgrades on a branch.
- Run `npm audit` occasionally; fix high-severity issues.
- Pin versions; test after any dependency bump (build + click-through).

---

## A simple cadence

| When | Do |
|---|---|
| **Before any risky change** | Manual DB snapshot; work on a branch; test on staging |
| **Daily (automatic)** | Scheduled backup runs; Sentry/UptimeRobot watch for errors/downtime |
| **Weekly (5 min)** | Glance at Sentry errors + confirm last backup succeeded |
| **Monthly (15 min)** | Supabase observability check (CPU/memory/connections); review Dependabot alerts |
| **Quarterly** | Pick one tech-debt item to pay down; review the deferred perf/backlog list |

---

## What this costs

Essentially **₹0 / $0**: backups (`pg_dump` + free bucket), staging (2nd free Supabase project), Sentry (free
tier), UptimeRobot (free), GitHub Actions CI + Dependabot (free). The only paid step is a Supabase compute upgrade
**if and when** the metrics genuinely demand it — and the data today says you're not there yet.

---

## Priority order if you only do a few things

1. **Backups** (non-negotiable).
2. **Error monitoring (Sentry)** — so failures stop being invisible.
3. **A staging project** — so migrations never surprise production.
4. **CI build check** — so a broken change can't ship.
5. Everything else, slowly, one verified step at a time.
