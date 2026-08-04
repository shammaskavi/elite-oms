# Advanced Physical Inventory Tracking Module

Saree Palace Elite OMS now features a location-aware, deadstock-aware physical stock module built on top of the legacy catalog inventory count. It allows physical item location tracking, chronological movement logs, intake label tag printing, shelf stock audits, and deadstock age reports.

---

## 1. Unified Hybrid Data Model

The data layer models inventory as three nested levels:
```
Category ──> Style / Variant (Products table) ──> Stock Unit (Individual garment piece)
```

* **Legacy Compatibility**: Products with `0` stock units remain under manual control. The trigger updates legacy stock automatically if any pieces are registered.
* **Hybrid tag barcodes**:
  * For styles with **Stock = 1** (one-of-a-kind bespoke sarees), the unique `unit_code` **reuses the existing SKU barcode**. No re-tagging of catalog lines is required.
  * For styles with **Stock > 1** (bulk items), the system auto-generates suffixed barcodes (e.g. `SKU-01`, `SKU-02`, etc.) which must be printed and attached.

### Core Tables
1. **`locations`**: A physical map supporting parent-child hierarchy (Area -> Rack -> Shelf -> Bin).
2. **`stock_units`**: Unique records representing one physical garment (status, cost, date received, location, and barcode tag).
3. **`stock_movements`**: Append-only transaction ledger log. Inserting a movement triggers updates to the corresponding `stock_units` status and location.

---

## 2. Inventory Workflows & Operations

### A. Intake / Receive (`/receive`)
To receive new supplier deliveries or in-house workshops run:
1. Search catalog variant product and select the target zone (e.g., `GF_ZONE` / `INTAKE`).
2. Input Cost Price, MRP, Inward Date, and Quantity.
3. On submission, the system generates unique `stock_units` (adding suffixes if quantity > 1) and receive movements.
4. Generates standard 2" x 1" thermal tags ready to print. The MRP is clearly displayed alongside the vector Code 39 barcode, human-readable SKU, and the encoded vendor code (format: `Mmyycpvendor-name` e.g., `11262800VKFAB`).

### B. Showroom Reshelving (`/reshelve`)
To place garments on the floor:
1. Scan the shelf/rack barcode (e.g., `RACK-B-S1`).
2. Scan garment tags sequentially as they are placed on the shelf.
3. The system executes `relocate(unit_code, location_code)` under the hood, updating physical coordinates and logging history.

### C. Tag Scan & Lookup (`/scan`)
Scan any tag at any time to:
* View item attributes (Category, Size, Color, Fabric, Supplier).
* Show the active physical coordinates.
* Display the **Age Badge** (Fresh `<180d` / Slow `180-365d` / Aging `365-730d` / Deadstock `>730d`).
* Audit trail list of all previous relocations and transactions.

### D. Billing Checkout Crossover (`/invoices`)
Billing has two crossover pathways:
1. **Scan-at-billing**: The cashier scans the exact garment tag. The checkout associates it with `orders.metadata.unit_codes` and marks that exact physical unit as `sold` at the virtual `SOLD_OUT` location.
2. **Auto-FIFO Fallback**: If no specific tag is scanned, checkout queries sellable units of that product variant, picking the oldest `date_received` first, and sells it to clear deadstock.
* **Oversell Warning**: If checkout exceeds available units, it processes checkout normally (never crash the cash register), raises a soft notice warning, and flags the order `stock_warning=true`.

### E. Shelf Audits (`/stock-count`)
To verify counts periodically:
1. Scan the shelf barcode target.
2. Scan every physical garment currently on it.
3. Displays dynamic indicators: Verified (expected on this shelf), Missing (expected but not scanned), Misplaced (scanned but expected on another shelf).
4. Submitting reconciles location drift: pulls misplaced items to this shelf in the database automatically.

---

## 3. Database Functions & Triggers

* **`relocate(unit_code, location_code, notes)`**: RPC executing movements and checking validation rules (blocks relocating sold/lost items).
* **`recount_product_stock(product_id)`**: Trigger on `stock_units` recalculating variants count automatically on status change.
* **`handle_order_inventory_adjustment()`**: Trigger function on `orders` (reconstructed crossover) allocating FIFO sales or restoring units on order cancellation/deletion.
