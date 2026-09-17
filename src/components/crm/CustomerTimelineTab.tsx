import { useMemo, useState } from "react";
import {
  FileText,
  CreditCard,
  ShoppingBag,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Clock,
  Heart,
  Calendar,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TimelineEvent, CustomerNote, CrmTask } from "@/services/crm/crmTypes";

interface CustomerTimelineTabProps {
  customerId: string;
  invoices: any[];
  orders: any[];
  customerPayments: any[];
  notes: CustomerNote[];
  tasks: CrmTask[];
  crmEvents: TimelineEvent[];
}

export function CustomerTimelineTab({
  invoices = [],
  orders = [],
  customerPayments = [],
  notes = [],
  tasks = [],
  crmEvents = [],
}: CustomerTimelineTabProps) {
  const [filterType, setFilterType] = useState<"all" | "billing" | "whatsapp" | "crm">("all");

  // Merge live Supabase events with CRM events into a unified chronological stream
  const unifiedEvents = useMemo(() => {
    const list: Array<{
      id: string;
      category: "billing" | "order" | "payment" | "whatsapp" | "note" | "task" | "preference";
      title: string;
      description?: string;
      timestamp: string;
      badgeText: string;
      icon: any;
      iconBg: string;
      iconColor: string;
    }> = [];

    // 1. Live Invoices
    for (const inv of invoices) {
      list.push({
        id: `inv_${inv.id}`,
        category: "billing",
        title: `Invoice Generated: #${inv.invoice_number}`,
        description: `Billed Amount: ₹${Number(inv.total || 0).toLocaleString("en-IN")} • Status: ${inv.payment_status || "draft"}`,
        timestamp: inv.created_at || inv.date,
        badgeText: "Invoice",
        icon: FileText,
        iconBg: "bg-purple-100",
        iconColor: "text-purple-700",
      });
    }

    // 2. Live Customer Payments / Receipts
    for (const p of customerPayments) {
      list.push({
        id: `pay_${p.id}`,
        category: "payment",
        title: `Payment Receipt: ₹${Number(p.amount || 0).toLocaleString("en-IN")}`,
        description: `Method: ${p.payment_method || "N/A"} ${p.reference ? `• Ref: ${p.reference}` : ""}`,
        timestamp: p.received_at || p.created_at,
        badgeText: "Receipt",
        icon: CreditCard,
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-700",
      });
    }

    // 3. Live Orders
    for (const o of orders) {
      const itemName = o.metadata?.item_name || "Boutique Order";
      list.push({
        id: `ord_${o.id}`,
        category: "order",
        title: `Production Order: ${itemName}`,
        description: `Delivery Target: ${o.metadata?.delivery_date || "Not set"} • Status: ${o.status || "In production"}`,
        timestamp: o.created_at,
        badgeText: "Order",
        icon: ShoppingBag,
        iconBg: "bg-blue-100",
        iconColor: "text-blue-700",
      });
    }

    // 4. Clienteling Notes
    for (const n of notes) {
      list.push({
        id: `note_${n.id}`,
        category: "note",
        title: `Clienteling Note Added`,
        description: n.note,
        timestamp: n.createdAt,
        badgeText: n.isPinned ? "Pinned Note" : "Note",
        icon: Sparkles,
        iconBg: "bg-amber-100",
        iconColor: "text-amber-700",
      });
    }

    // 5. Tasks
    for (const t of tasks) {
      list.push({
        id: `task_${t.id}`,
        category: "task",
        title: t.status === "completed" ? `Task Completed: ${t.title}` : `Follow-up Task: ${t.title}`,
        description: `Assigned: ${t.assignedToName} • Priority: ${t.priority.toUpperCase()}`,
        timestamp: t.completedAt || t.createdAt,
        badgeText: t.status === "completed" ? "Completed Task" : "Task",
        icon: t.status === "completed" ? CheckCircle2 : Clock,
        iconBg: t.status === "completed" ? "bg-emerald-100" : "bg-orange-100",
        iconColor: t.status === "completed" ? "text-emerald-700" : "text-orange-700",
      });
    }

    // 6. CRM Events (WhatsApp messages, preference updates)
    for (const ev of crmEvents) {
      list.push({
        id: `crm_ev_${ev.id}`,
        category: ev.eventType.includes("whatsapp") ? "whatsapp" : "preference",
        title: ev.title,
        description: ev.description,
        timestamp: ev.timestamp,
        badgeText: ev.eventType.includes("whatsapp") ? "WhatsApp" : "Activity",
        icon: ev.eventType.includes("whatsapp") ? MessageSquare : Heart,
        iconBg: "bg-emerald-100",
        iconColor: "text-emerald-700",
      });
    }

    // Sort newest first
    return list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [invoices, orders, customerPayments, notes, tasks, crmEvents]);

  const filteredEvents = unifiedEvents.filter((ev) => {
    if (filterType === "billing") return ev.category === "billing" || ev.category === "payment" || ev.category === "order";
    if (filterType === "whatsapp") return ev.category === "whatsapp";
    if (filterType === "crm") return ev.category === "note" || ev.category === "task" || ev.category === "preference";
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header & Filter Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Unified Relationship Timeline</h3>
          <p className="text-xs text-slate-500">
            Chronological audit log across invoices, payments, production orders, notes, and messages
          </p>
        </div>

        <div className="flex rounded-lg border bg-slate-50 p-0.5 text-xs font-medium">
          <button
            type="button"
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              filterType === "all" ? "bg-white shadow-2xs font-semibold text-slate-900" : "text-slate-500"
            }`}
            onClick={() => setFilterType("all")}
          >
            All Activity ({unifiedEvents.length})
          </button>
          <button
            type="button"
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              filterType === "billing" ? "bg-white shadow-2xs font-semibold text-slate-900" : "text-slate-500"
            }`}
            onClick={() => setFilterType("billing")}
          >
            Orders & Billing
          </button>
          <button
            type="button"
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              filterType === "whatsapp" ? "bg-white shadow-2xs font-semibold text-slate-900" : "text-slate-500"
            }`}
            onClick={() => setFilterType("whatsapp")}
          >
            WhatsApp
          </button>
          <button
            type="button"
            className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
              filterType === "crm" ? "bg-white shadow-2xs font-semibold text-slate-900" : "text-slate-500"
            }`}
            onClick={() => setFilterType("crm")}
          >
            Notes & Tasks
          </button>
        </div>
      </div>

      {/* Timeline Stream */}
      <div className="relative pl-6 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
        {filteredEvents.length > 0 ? (
          filteredEvents.map((ev) => {
            const Icon = ev.icon;
            return (
              <div key={ev.id} className="relative group">
                {/* Timeline node icon */}
                <div
                  className={`absolute -left-6 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white shadow-xs ${ev.iconBg} ${ev.iconColor}`}
                >
                  <Icon className="h-3 w-3" />
                </div>

                <Card className="border bg-white shadow-xs hover:border-slate-300 transition-colors">
                  <CardContent className="p-4 space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs md:text-sm font-semibold text-slate-900">{ev.title}</h4>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase font-medium bg-slate-50">
                          {ev.badgeText}
                        </Badge>
                      </div>

                      <span className="text-[11px] text-slate-400 font-mono">
                        {new Date(ev.timestamp).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {ev.description && (
                      <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">
                        {ev.description}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })
        ) : (
          <div className="py-12 text-center text-xs text-slate-500 border border-dashed rounded-xl bg-slate-50 ml-2">
            <p>No activity records found in this category.</p>
          </div>
        )}
      </div>
    </div>
  );
}
