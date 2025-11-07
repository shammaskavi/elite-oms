# 🧾 Saree Palace Elite – Smart Invoice System

A modern **Invoice Management System** built with **React + Supabase**, featuring:

- 📄 Automated PDF invoice generation
- 💬 Seamless WhatsApp invoice delivery
- 💰 Partial payment tracking
- ✏️ Draft invoice editing
- 🖨️ Wireless printing (Android tablet–ready)

---

## 🚀 Overview

This app helps manage customer invoices, payments, and WhatsApp sharing directly from your browser.  
It’s optimized for **tablet use**, supports **Supabase Storage for PDFs**, and **WhatsApp integration** using [WA Notifier](https://app.wanotifier.com).

---

## 🧩 Features

- **PDF Invoice Generation** — via `@react-pdf/renderer`
- **WhatsApp Send** — auto-uploads invoice to Supabase and sends it through WA Notifier
- **Draft Mode** — save invoices as drafts and resume editing later
- **Partial Payments** — update paid amounts incrementally
- **Payment Tracking** — status updates (`paid`, `partial`, `unpaid`) reflected instantly
- **Wireless Printing** — print invoices from any Android tablet
- **Supabase Storage** — securely stores PDFs under `/invoices` bucket
- **Order Tracking** - Track Orders

👨‍💻 Author
Shammas Kavi
📧 shammaskavi@gmail.com
🌐 github.com/shammaskavi

Perfect ✅ — here’s a **ready-to-paste `README.md`** version for your repo.
It’s formatted, self-contained, and GitHub-friendly — no edits needed.
Just copy it as is and drop it in your project root (`README.md`).

---

````markdown
# 🧾 Saree Palace Elite – Smart Invoice System

A modern **Invoice Management System** built with **React + Supabase**, featuring:

- 📄 Automated PDF invoice generation
- 💬 Seamless WhatsApp invoice delivery
- 💰 Partial payment tracking
- ✏️ Draft invoice editing
- 🖨️ Wireless printing (Android tablet–ready)

---

## 🚀 Overview

This app helps manage customer invoices, payments, and WhatsApp sharing directly from your browser.  
It’s optimized for **tablet use**, supports **Supabase Storage for PDFs**, and **WhatsApp integration** using [WA Notifier](https://app.wanotifier.com).

---

## 🧩 Features

- **PDF Invoice Generation** — via `@react-pdf/renderer`
- **WhatsApp Send** — auto-uploads invoice to Supabase and sends it through WA Notifier
- **Draft Mode** — save invoices as drafts and resume editing later
- **Partial Payments** — update paid amounts incrementally
- **Payment Tracking** — status updates (`paid`, `partial`, `unpaid`) reflected instantly
- **Wireless Printing** — print invoices from any Android tablet
- **Supabase Storage** — securely stores PDFs under `/invoices` bucket

---

## 🏗️ Tech Stack

| Layer         | Technology                            |
| ------------- | ------------------------------------- |
| Frontend      | React + Vite                          |
| UI            | shadcn/ui, Tailwind CSS, Lucide Icons |
| Data          | TanStack Query + Supabase             |
| PDF           | `@react-pdf/renderer`                 |
| Notifications | WA Notifier API                       |
| Toasts        | Sonner                                |

---

## 🗄️ Supabase Setup

### Tables

#### `invoices`

| Column         | Type            | Description                      |
| -------------- | --------------- | -------------------------------- |
| id             | UUID            | Primary key                      |
| invoice_number | Text            | Invoice identifier               |
| customers      | JSON / Relation | Customer details                 |
| raw_payload    | JSON            | Invoice content, payments, items |
| subtotal       | Numeric         | Invoice subtotal                 |
| total          | Numeric         | Invoice total                    |
| status         | Text            | `"draft"` or `"final"`           |
| date           | Timestamp       | Invoice date                     |

#### `orders`

| Column         | Type | Description                          |
| -------------- | ---- | ------------------------------------ |
| id             | UUID | Primary key                          |
| invoice_id     | UUID | Linked invoice                       |
| payment_status | Text | `"paid"`, `"unpaid"`, or `"partial"` |

---

### Storage Bucket

Create a bucket named **`invoices`** under Supabase → Storage.

Run this SQL to enable access:

```sql
create policy "Public read for invoices"
on storage.objects for select
using (bucket_id = 'invoices');

create policy "Allow authenticated upload to invoices"
on storage.objects for insert
with check (bucket_id = 'invoices');
```

---

## 💬 WhatsApp Integration (WA Notifier)

1. Sign up on [WA Notifier](https://app.wanotifier.com).
2. Create a new Notification Project.
3. Copy your Webhook URL — looks like:

   ```
   https://app.wanotifier.com/api/v1/notifications/<ID>?key=<API_KEY>
   ```

4. Paste it in your code (`InvoiceView.tsx`):

   ```ts
   const WA_WEBHOOK_URL =
     "https://app.wanotifier.com/api/v1/notifications/<ID>?key=<API_KEY>";
   ```

---

## 🧾 Draft Workflow

1. Save invoice with `status = "draft"`.
2. Opening a draft invoice shows a banner + **Continue Editing** button.
3. Editing resumes via `onEditDraft(invoice)`.
4. Once finalized (`status = "final"`), all payment, print, and WhatsApp features become active.

---

## 🖨️ Printing (Android Tablet)

1. Connect your tablet and printer to the same Wi-Fi network.
2. Tap **Print Invoice**.
3. Chrome or the system print dialog will appear.
4. Select your printer and print.

> Works seamlessly with wireless printers and Chrome browser.

---

## 💻 Development

| Command           | Description                      |
| ----------------- | -------------------------------- |
| `npm run dev`     | Start local development server   |
| `npm run build`   | Build production version         |
| `npm run preview` | Preview production build locally |

---

## 👨‍💻 Author

**Shammas Kavi**
📧 [shammaskavi@gmail.com](mailto:shammaskavi@gmail.com)
🌐 [github.com/shammaskavi](https://github.com/shammaskavi)

---

## 📄 License

This project is licensed under the **MIT License** — feel free to modify and reuse with credit.
````
