# Saree Palace Elite Project Handoff

Last updated: 2026-07-20

This document is for another AI agent or engineer taking over this project. It summarizes the app, the live Supabase context, the main workflows, current verification state, and important cautions.

## Production Safety Notes

- The linked Supabase project is production-like and should be treated carefully.
- Do not run `supabase db push`, deploy edge functions, or execute SQL against the remote project unless the owner explicitly approves the exact change.
- During context gathering, the following were done:
  - `supabase login`
  - `supabase link --project-ref sqjigpdsxdqfkunyuqes`
  - `supabase migration repair --status applied 20251009194624`
  - `supabase gen types typescript --linked --schema public > src/integrations/supabase/types.ts`
  - `supabase db dump --linked --schema public --file supabase/schema-live.sql`
- The only remote write was `supabase migration repair`, which updates Supabase migration-history metadata only. It should not change application tables, data, functions, triggers, RLS policies, or edge function behavior.
- No production data mutations, function deployments, database pushes, or policy/function edits were performed.

## Repo Overview

- Path: `/Users/shammaskavi/Downloads/stageflow-invoicing-main`
- App: internal boutique management system for Saree Palace Elite.
- Stack:
  - Vite
  - React 18
  - TypeScript
  - Tailwind CSS
  - shadcn/Radix UI
  - React Router
  - TanStack Query
  - Supabase
  - React PDF, jsPDF, Recharts
- Primary package scripts:
  - `npm run dev`
  - `npm run build`
  - `npm run lint`
  - `npm run preview`

## Supabase Context

- Correct linked project: `demo-crm`
- Project ref: `sqjigpdsxdqfkunyuqes`
- Other Supabase project in account: `aamir jamal` with ref `pwdadqeyjansfkmxzgtu`; do not use it for this repo unless instructed.
- `supabase/config.toml` was updated locally to `project_id = "sqjigpdsxdqfkunyuqes"`.
- `supabase/.temp/project-ref` also points to `sqjigpdsxdqfkunyuqes`.
- Full live public-schema SQL snapshot is stored at `supabase/schema-live.sql`.
- Live generated TS types are stored at `src/integrations/supabase/types.ts`.
- The checked-in original migration is `supabase/migrations/20251009194624_5fd87a31-fa0a-4ddd-8f97-7cc9d5d748d4.sql`.

### Supabase CLI Caveat

`supabase db pull` currently fails after creating a shadow database:

```text
error running container: exit 1
StorageBackendError: Migration optimize-existing-functions-again not found
```

This appears to be a Supabase CLI/local Docker image issue, not an app schema problem. The installed CLI is `2.51.0`. Docker is available, but the internal local container migration fails. Direct schema dump works and was used instead:

```bash
supabase db dump --linked --schema public --file supabase/schema-live.sql
supabase gen types typescript --linked --schema public > src/integrations/supabase/types.ts
```

## Key Files

- App routes: `src/App.tsx`
- Supabase client: `src/integrations/supabase/client.ts`
- Supabase generated types: `src/integrations/supabase/types.ts`
- Live schema dump: `supabase/schema-live.sql`
- Auth context: `src/lib/auth.tsx`
- Protected route wrapper: `src/components/ProtectedRoute.tsx`
- App layout/sidebar: `src/components/Layout.tsx`
- Invoice creation: `src/pages/Invoices.tsx`
- Invoice modal/PDF/payment actions: `src/components/InvoiceView.tsx`
- Printable invoice: `src/components/PrintableInvoice.tsx`
- Orders list/table/kanban/calendar: `src/pages/OrdersNew.tsx`
- Order detail/product timelines: `src/pages/OrderDetailNew.tsx`
- Product stage component: `src/components/OrderTimeline.tsx`
- Customer detail/payment collection: `src/pages/CustomerDetail.tsx`
- Payment allocation logic: `src/lib/allocateCustomerPayment.ts`
- Payment status derivation: `src/lib/derivePaymentStatus.ts`
- Invoice business state derivation: `src/lib/deriveInvoiceState.ts`
- Measurements list/admin edit: `src/pages/Measurements.tsx`
- Measurement creation: `src/pages/CreateMeasurement.tsx`
- Public measurement form: `src/pages/PublicMeasurementForm.tsx`
- Public invoice tracking: `src/pages/PublicInvoiceTracking.tsx`
- Karigar portal: `src/pages/KarigarPortal.tsx`
- Karigar order detail: `src/pages/KarigarOrderDetail.tsx`
- Dashboard: `src/pages/Dashboard.tsx`
- Reports: `src/pages/Reports.tsx`
- Edge functions: `supabase/functions/*/index.ts`

## Routes And Modules

Public routes:

- `/track/:token`: public invoice/order/payment tracking.
- `/m/:token`: public customer measurement form.
- `/karigar/:token`: karigar work portal.
- `/karigar/order/:id`: karigar order detail, expects `?token=...`.
- `/auth`: sign-in page.

Protected internal routes:

- `/`: dashboard.
- `/products`: product CRUD and barcode/SKU UI.
- `/customers`: customer list/CRUD.
- `/customers/:id`: customer financial and order history.
- `/measurements`: measurement management.
- `/measurements/new`: admin measurement entry.
- `/invoices`: invoice creation, draft/finalized list, invoice modal.
- `/orders`: order operations views.
- `/orders/:id`: single order detail/product timelines.
- `/payments`: invoice payment register.
- `/reports`: analytics and PDF reports.
- `/reports-dusra`: alternate report page.

## Current Live Schema Summary

Core live tables from `supabase/schema-live.sql` and generated types:

- `profiles`: app users mapped to Supabase auth users, role enum `admin | staff`.
- `customers`: customer master data.
- `products`: product master data. Live schema includes extra inventory fields such as `color`, `size`, `purchase_price`, `mrp`, `item_code`, `company_barcode`, `hsn_code`, `supplier_name`, `status`, `inward_date`, `purchase_date`.
- `inventory_items`: barcode-level inventory table with `available | reserved | sold | returned` status.
- `invoices`: invoice header. Important fields include `invoice_number`, `customer_id`, `total`, `payment_status`, `status` (`draft` or `finalized`), `tracking_token`, `settled`, `settlement_reason`, `raw_payload`, `file_url`.
- `invoice_items`: invoice line items. Includes `reference_name`.
- `orders`: production/order records generated from invoices.
- `order_stages`: product/stage history. Important fields: `stage_name`, `vendor_id`, `vendor_name`, `status`, timestamps, `metadata.product_number`, `new_stage_id`, `new_vendor_id`.
- `stages`: canonical workflow stages ordered by `order_index`.
- `vendors`: karigar/vendor records scoped to stages; includes `access_token` and `portal_enabled`.
- `invoice_payments`: invoice-level payments, with `customer_payment_id` for allocations.
- `customer_payments`: customer-level receipts.
- `payment_allocations`: allocation table exists, but app currently inserts allocations into `invoice_payments` directly.
- `measurement_templates`, `measurement_fields`, `measurement_links`, `customer_measurements`, `measurement_profiles`, `measurement_profile_values`, `order_measurements`: measurement system.
- `user_push_devices`: OneSignal device IDs.
- `consents`, `marketing_events`, `audit_logs`: supporting/compliance tables.

Important live views:

- `order_items_calendar_view`: order item calendar source. Reads order metadata item/delivery fields and latest order stage.
- `orders_with_details`: operational report source for active/non-delivered orders.

Important live RPC/functions:

- `get_order_stats`
- `get_owner_summary(from_date, to_date)`
- `get_owner_insights(from_date, to_date)`
- `get_cash_inflow_daily(from_date, to_date)`
- `get_revenue_trend(from_date, to_date)`
- `get_process_breakdown`
- `get_vendor_load`
- `get_delivery_risk`
- `get_vendor_work(p_token)`
- `orders_due_today`
- `orders_due_tomorrow`
- `orders_overdue`
- `recalculate_invoice_payment_status(p_invoice_id)`
- `update_order_delivery_date(...)`
- `execute_sql(sql)`

Important trigger:

- `after_payment_insert` on `invoice_payments` calls `trigger_recalculate_status`, which calls `recalculate_invoice_payment_status`.

## Main Business Workflows

### 1. Invoice To Production Order

The invoice module is the central workflow.

1. Staff creates an invoice in `src/pages/Invoices.tsx`.
2. Invoice can be saved as `draft`.
3. Finalized invoice writes:
   - one `invoices` row
   - multiple `invoice_items` rows
   - one `orders` row per invoice item
   - one initial `order_stages` row per physical product count
4. Each invoice item stores operational details in `raw_payload.items`, including:
   - `name`
   - `qty`
   - `unit_price`
   - `num_products`
   - `delivery_date`
   - `reference_name`
5. Each generated order stores item-level production fields in `orders.metadata`, including:
   - `item_name`
   - `item_index`
   - `qty`
   - `num_products`
   - `unit_price`
   - `delivery_date`
   - `reference_name`
6. Initial stage is inserted as `Ordered` with `status = done` and `metadata.product_number`.

Important: per-product tracking depends on `order_stages.metadata.product_number`. Do not remove or rename that metadata key.

### 2. Order Operations

`src/pages/OrdersNew.tsx` provides multiple views:

- invoice-grouped table view
- list view
- kanban view
- calendar view

The order workflow uses canonical stage names from `stages`, not hardcoded stage arrays in the main view. Vendor assignment uses `vendors` filtered by stage.

`src/pages/OrderDetailNew.tsx` shows one order at a time. It renders one `OrderTimeline` for each product number in `orders.metadata.num_products`.

`src/components/OrderTimeline.tsx`:

- identifies current stage by `status = in_progress`.
- computes completed stages from `status = done`.
- moves a product forward by marking the current stage done and inserting a new `order_stages` row.
- stores product-specific notes and product display-name overrides in `orders.metadata.product_notes` and `orders.metadata.product_names`.

Potential issue to watch: some query invalidation keys still refer to old names like `all-order-stages` or `invoice-orders`; verify refresh behavior when changing order details.

### 3. Payments And Receipts

There are two payment layers:

- `customer_payments`: a customer-level receipt.
- `invoice_payments`: invoice-level allocations/payments.

The customer detail page can collect a payment:

1. Insert into `customer_payments`.
2. Call `allocateCustomerPayment`.
3. `allocateCustomerPayment` fetches that customer's invoices oldest-first.
4. It derives collectible due per invoice.
5. It allocates FIFO into `invoice_payments`.

Payment status is not only a column read. Use the helpers:

- `derivePaymentStatus`: combines legacy `raw_payload.paid_amount` plus `invoice_payments`.
- `deriveInvoiceState`: applies business overrides such as `settled`.

Manual invoice settlement:

- `invoices.settled = true`
- `invoices.settlement_reason`
- settled invoices have no collectible due even if unpaid balance remains.

### 4. Public Invoice Tracking And Razorpay

`src/components/InvoiceView.tsx` generates a tracking token when sending WhatsApp if one does not exist. Customer tracking URL:

```text
/track/:tracking_token
```

`src/pages/PublicInvoiceTracking.tsx` shows:

- invoice summary
- order items
- latest stage for each item
- balance due
- Razorpay payment button

Razorpay flow:

- `supabase/functions/create-razorpay-order/index.ts` creates a Razorpay order.
- `supabase/functions/razorpay-webhook/index.ts` handles captured payment events and inserts `invoice_payments`.
- The live DB trigger recalculates invoice payment status after payment insert.

### 5. Measurements

Measurements are template-driven:

- `measurement_templates`: garment/template names.
- `measurement_fields`: fields per template.
- `measurement_links`: public links and optional customer/template linkage.
- `customer_measurements`: JSON measurement submissions.

Admin routes:

- `/measurements`
- `/measurements/new`

Public route:

- `/m/:token`

Potential issue to watch: the public measurement form validates token existence, but currently appears to allow selecting any template and does not visibly enforce `expires_at` or `measurement_links.template_id` in frontend logic. Confirm backend/RLS expectations before relying on expiry/template restrictions.

### 6. Karigar Portal

Public karigar flow:

- `/karigar/:token` calls `get_vendor_work(p_token)`.
- `/karigar/order/:id?token=...` verifies that the latest stage's `vendor_id` matches the token's vendor.

Vendor records live in `vendors`, with `access_token` and `portal_enabled`.

### 7. Dashboard And Reports

Dashboard:

- Queries recent invoices, invoice payments, orders, and `order_items_calendar_view`.
- Derives pending invoice status using `derivePaymentStatusFromData`.

Reports:

- Uses RPCs such as `get_owner_summary`, `get_owner_insights`, `get_cash_inflow_daily`, `get_revenue_trend`, `get_process_breakdown`, `get_vendor_load`, `get_delivery_risk`.
- Generates PDF reports using `jsPDF` and `jspdf-autotable`.

## Edge Functions

Existing edge functions:

- `create-razorpay-order`
- `razorpay-webhook`
- `payments-register`
- `delivery-reminder`
- `notify-order-deadlines`

Do not deploy or change these without explicit production approval.

Function notes:

- `delivery-reminder` uses AiSensy and hardcoded recipients.
- `notify-order-deadlines` uses OneSignal and `user_push_devices`.
- `payments-register` calls `execute_sql`.

## RLS And Public Access Notes

Live schema includes RLS policies for the core app and public flows.

Notable policies:

- Authenticated users can view/insert/update most core internal objects.
- Staff/admin delete access exists for several operational tables.
- Public tracking token policies allow invoice/order/order stage reads when `tracking_token` exists.
- Measurement tables currently have permissive read/insert/update policies in the live schema.

Any security-sensitive feature should inspect `supabase/schema-live.sql` before implementation.

## Current Verification State

Passing:

```bash
npm run build
```

Known warnings:

- Baseline/browserlist data is stale.
- Some build chunks are large, especially `InvoiceView` and PDF/chart dependencies.

Not passing:

```bash
npm run lint
```

Current lint failure is broad and pre-existing:

- many `@typescript-eslint/no-explicit-any` errors
- fast-refresh warnings
- one parse error in `src/utils/sendInvoiceWhatsApp.ts`
- `tailwind.config.ts` uses `require()`

Do not treat current lint failure as caused by schema sync.

## Current Git/Workspace Caution

The working tree was already dirty before schema/context work began. Do not revert broad changes. Preserve user changes unless explicitly instructed.

Schema/context-related local changes made during handoff prep:

- `src/integrations/supabase/types.ts` regenerated from linked `demo-crm`.
- `supabase/schema-live.sql` added as live schema snapshot.
- `supabase/config.toml` project id set to `sqjigpdsxdqfkunyuqes`.
- `.gitignore` ignores Supabase temp metadata.

There are many other modified files that pre-existed in the working tree. Treat them as user-owned unless proven otherwise.

## Recommended Workflow For Future Agents

1. Read this file first.
2. Inspect `git status --short` and avoid reverting user changes.
3. For DB shape, use:
   - `src/integrations/supabase/types.ts` for TypeScript-facing table/view/RPC types.
   - `supabase/schema-live.sql` for full SQL details, RLS, triggers, grants, and functions.
4. For production schema changes, create explicit SQL migration files and get user approval before applying anything remotely.
5. For frontend changes, prefer existing patterns:
   - TanStack Query for data fetch/mutations.
   - shadcn/Radix UI components.
   - `toast` from `sonner` or local toast patterns already in the target file.
   - Route-level lazy imports in `src/App.tsx`.
6. Verify with `npm run build`.
7. Run lint only if working on lint cleanup; it currently fails on existing codebase issues.

## High-Risk Areas To Be Careful With

- Invoice finalization: creates invoice items, orders, and initial order stages.
- Payment status: column values, legacy `raw_payload.paid_amount`, `invoice_payments`, settlement, and trigger-based recalculation all interact.
- Order stage movement: per-product stages depend on `metadata.product_number`.
- Public tracking: token policies and Razorpay payments touch production customer-facing flows.
- Measurement public links: current frontend behavior may be more permissive than expected.
- Edge functions: deploys would affect production behavior.

## Useful Commands

Read linked project:

```bash
supabase projects list
supabase migration list
```

Refresh local read-only schema context:

```bash
supabase db dump --linked --schema public --file supabase/schema-live.sql
supabase gen types typescript --linked --schema public > src/integrations/supabase/types.ts
```

Build:

```bash
npm run build
```

Start dev server:

```bash
npm run dev
```

