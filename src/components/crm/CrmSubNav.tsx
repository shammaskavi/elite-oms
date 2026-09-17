import { Link, useLocation } from "react-router-dom";
import { Sparkles, Clock, MessageSquare, UserCheck, Crown } from "lucide-react";

const CRM_TABS = [
  { name: "Today Actions", href: "/crm", icon: Sparkles },
  { name: "Follow-up Tasks", href: "/crm/tasks", icon: Clock },
  { name: "WhatsApp Inbox", href: "/crm/inbox", icon: MessageSquare },
  { name: "Leads & Prospects", href: "/crm/leads", icon: UserCheck },
  { name: "Segments & Campaigns", href: "/crm/segments", icon: Crown },
];

export function CrmSubNav() {
  const location = useLocation();

  return (
    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200/80 mb-6 scrollbar-none">
      {CRM_TABS.map((tab) => {
        const isActive =
          tab.href === "/crm"
            ? location.pathname === "/crm"
            : location.pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.name}
            to={tab.href}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              isActive
                ? "bg-purple-900 text-white shadow-xs"
                : "bg-slate-100/80 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            }`}
          >
            <tab.icon className={`h-3.5 w-3.5 ${isActive ? "text-purple-200" : "text-slate-500"}`} />
            <span>{tab.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
