import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Sparkles,
  AlertCircle,
  Clock,
  MessageSquare,
  Gift,
  Heart,
  Crown,
  Search,
  CheckCircle2,
  Circle,
  ArrowRight,
  TrendingUp,
  UserCheck,
  Plus,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { crmService } from "@/services/crm/crmService";
import { CrmTask, WhatsAppConversation } from "@/services/crm/crmTypes";
import { toast } from "sonner";

import { CrmSubNav } from "@/components/crm/CrmSubNav";

export default function CrmDashboard() {
  useDocumentTitle("CRM • Today's Actions");
  const navigate = useNavigate();

  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [tasksRefreshKey, setTasksRefreshKey] = useState(0);

  // Fetch real customers from Supabase
  const { data: realCustomers } = useQuery({
    queryKey: ["crm-dashboard-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, phone, email, dob, anniversary, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Load CRM Today Aggregations
  const stats = useMemo(() => {
    return crmService.getTodayDashboardStats();
  }, [tasksRefreshKey]);

  const convos = useMemo(() => {
    return crmService.getWhatsAppConversations();
  }, []);

  const segments = useMemo(() => {
    return crmService.getSegments();
  }, []);

  // Compute upcoming birthdays & anniversaries from real customers
  const upcomingCelebrations = useMemo(() => {
    if (!realCustomers) return [];
    const list: Array<{
      customerId: string;
      customerName: string;
      customerPhone?: string | null;
      type: "birthday" | "anniversary";
      dateStr: string;
      daysRemaining: number;
    }> = [];

    const now = new Date();
    const currentYear = now.getFullYear();

    for (const c of realCustomers) {
      if (c.dob) {
        const bday = new Date(c.dob);
        bday.setFullYear(currentYear);
        const diff = Math.ceil((bday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diff >= 0 && diff <= 30) {
          list.push({
            customerId: c.id,
            customerName: c.name,
            customerPhone: c.phone,
            type: "birthday",
            dateStr: c.dob,
            daysRemaining: diff,
          });
        }
      }

      if (c.anniversary) {
        const anv = new Date(c.anniversary);
        anv.setFullYear(currentYear);
        const diff = Math.ceil((anv.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (diff >= 0 && diff <= 30) {
          list.push({
            customerId: c.id,
            customerName: c.name,
            customerPhone: c.phone,
            type: "anniversary",
            dateStr: c.anniversary,
            daysRemaining: diff,
          });
        }
      }
    }

    return list.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }, [realCustomers]);

  const handleToggleTask = (taskId: string, currentStatus: CrmTask["status"]) => {
    const nextStatus = currentStatus === "completed" ? "pending" : "completed";
    crmService.updateTaskStatus(taskId, nextStatus);
    setTasksRefreshKey((k) => k + 1);
    toast.success(nextStatus === "completed" ? "Task completed" : "Task marked pending");
  };

  // Filtered customer search preview
  const searchResults = useMemo(() => {
    if (!customerSearchQuery.trim() || !realCustomers) return [];
    const q = customerSearchQuery.toLowerCase();
    return realCustomers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q)) ||
          (c.email && c.email.toLowerCase().includes(q))
      )
      .slice(0, 5);
  }, [customerSearchQuery, realCustomers]);

  return (
    <div className="space-y-4">
      <CrmSubNav />

      {/* ================= Header with Quick Search ================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Clienteling & Relationship Desk
            </h1>
            <Badge className="bg-purple-100 text-purple-900 border-purple-300 text-[10px] font-bold uppercase">
              SPE CRM
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily relationship tasks, clienteling follow-ups, and upcoming boutique celebrations
          </p>
        </div>

        {/* Fast Customer 360 Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-2.5" />
          <Input
            placeholder="Search customer 360 profile…"
            value={customerSearchQuery}
            onChange={(e) => setCustomerSearchQuery(e.target.value)}
            className="pl-9 text-xs h-9 bg-card shadow-2xs"
          />

          {/* Quick Dropdown Results */}
          {searchResults.length > 0 && (
            <div className="absolute left-0 right-0 top-10 z-50 rounded-xl border bg-card p-1.5 shadow-lg space-y-1">
              {searchResults.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => {
                    navigate(`/customers/${c.id}`);
                    setCustomerSearchQuery("");
                  }}
                  className="w-full text-left p-2 rounded-lg hover:bg-muted/70 flex items-center justify-between text-xs transition-colors cursor-pointer"
                >
                  <div>
                    <p className="font-semibold text-foreground">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono">{c.phone || "No phone"}</p>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ================= Key Action KPI Metric Cards ================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Overdue Follow-ups */}
        <Card className={`shadow-2xs ${stats.overdueTasksCount > 0 ? "border-red-200 bg-red-50/20" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-semibold text-slate-700">Overdue Follow-ups</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold text-red-600">{stats.overdueTasksCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Require immediate outreach</p>
          </CardContent>
        </Card>

        {/* Due Today Follow-ups */}
        <Card className="shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-semibold text-slate-700">Due Today</CardTitle>
            <Clock className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold text-amber-600">{stats.dueTodayTasksCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Scheduled for today</p>
          </CardContent>
        </Card>

        {/* Unanswered WhatsApp */}
        <Card className={`shadow-2xs ${stats.unansweredConvosCount > 0 ? "border-emerald-200 bg-emerald-50/20" : ""}`}>
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-semibold text-slate-700">Unanswered WhatsApp</CardTitle>
            <MessageSquare className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold text-emerald-700">{stats.unansweredConvosCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Waiting for boutique response</p>
          </CardContent>
        </Card>

        {/* Active Prospects / Leads */}
        <Card className="shadow-2xs">
          <CardHeader className="flex flex-row items-center justify-between pb-1 pt-3.5 px-4">
            <CardTitle className="text-xs font-semibold text-slate-700">Active Leads</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent className="px-4 pb-3.5">
            <div className="text-2xl font-bold text-purple-700">{stats.activeLeadsCount}</div>
            <p className="text-[11px] text-slate-500 mt-0.5">Inquiry & trial pipeline</p>
          </CardContent>
        </Card>
      </div>

      {/* ================= 2-Column Main Workspace ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Today's Priorities & Actionable Tasks */}
        <div className="lg:col-span-2 space-y-6">
          {/* Action Tasks Card */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500" />
                  Today&apos;s Follow-up Queue
                </CardTitle>
                <CardDescription className="text-xs">
                  Prioritized clienteling calls, previews, and payment reminders
                </CardDescription>
              </div>
              <Link to="/crm/tasks">
                <Button variant="outline" size="sm" className="h-8 text-xs font-medium">
                  View All Tasks ({crmService.getAllTasks().length})
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...stats.overdueTasks, ...stats.dueTodayTasks].length > 0 ? (
                [...stats.overdueTasks, ...stats.dueTodayTasks].slice(0, 5).map((task) => {
                  const isOverdue = new Date(task.dueAt) < new Date();
                  return (
                    <div
                      key={task.id}
                      className={`p-3.5 rounded-xl border flex items-start gap-3 transition-colors ${
                        isOverdue
                          ? "border-red-200 bg-red-50/30"
                          : "border-slate-200 bg-white hover:bg-slate-50/80"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleTask(task.id, task.status)}
                        className="mt-0.5 text-slate-400 hover:text-primary transition-colors cursor-pointer shrink-0"
                      >
                        <Circle className="h-4 w-4 text-slate-300 hover:text-slate-500" />
                      </button>

                      <div className="space-y-1 flex-1 min-w-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Link
                            to={`/customers/${task.customerId}`}
                            className="font-semibold text-xs md:text-sm text-slate-900 hover:text-primary transition-colors truncate"
                          >
                            {task.customerName}: {task.title}
                          </Link>
                          <Badge
                            variant="outline"
                            className={`text-[9px] uppercase font-bold px-1.5 py-0 ${
                              task.priority === "urgent"
                                ? "bg-red-100 text-red-800 border-red-200"
                                : "bg-orange-100 text-orange-800 border-orange-200"
                            }`}
                          >
                            {task.priority}
                          </Badge>
                        </div>

                        {task.description && (
                          <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                            {task.description}
                          </p>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                          <span>Assigned: <strong className="text-slate-600 font-medium">{task.assignedToName}</strong></span>
                          <span className={isOverdue ? "text-red-600 font-semibold" : ""}>
                            {isOverdue ? "🚨 Overdue" : "Due Today"}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-8 text-center text-xs text-slate-400 border border-dashed rounded-xl bg-slate-50">
                  <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
                  <p className="font-semibold text-slate-700">All follow-ups completed for today!</p>
                  <p className="text-slate-400 mt-0.5">Check upcoming celebrations or manage segments.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Relationship Opportunities & Dynamic Segments */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  Clienteling Segments & Outreach Opportunities
                </CardTitle>
                <CardDescription className="text-xs">
                  Automated customer cohorts ready for targeted collection previews & reactivation
                </CardDescription>
              </div>
              <Link to="/crm/segments">
                <Button variant="ghost" size="sm" className="h-8 text-xs font-medium text-purple-700">
                  All Segments
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {segments.slice(0, 4).map((seg) => (
                <div
                  key={seg.id}
                  className="p-3.5 rounded-xl border bg-slate-50/50 hover:bg-slate-50 transition-colors space-y-2 flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-xs text-slate-900">{seg.name}</h4>
                      <Badge variant="secondary" className="text-[10px] font-bold bg-purple-100 text-purple-800">
                        {seg.count} clients
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                      {seg.description}
                    </p>
                  </div>

                  <Link to={`/crm/segments?id=${seg.id}`}>
                    <Button variant="outline" size="sm" className="w-full text-xs h-7.5 mt-1 text-slate-700">
                      Explore Segment <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  </Link>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Upcoming Celebrations & Unanswered WhatsApp */}
        <div className="space-y-6">
          {/* Upcoming Birthdays & Anniversaries */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Gift className="h-4 w-4 text-rose-500" />
                Upcoming Celebrations
              </CardTitle>
              <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-800 border-rose-200">
                Next 30 Days
              </Badge>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {upcomingCelebrations.length > 0 ? (
                upcomingCelebrations.slice(0, 4).map((item, idx) => (
                  <div
                    key={`${item.customerId}_${item.type}_${idx}`}
                    className="p-3 rounded-lg border bg-rose-50/30 border-rose-100 space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <Link
                        to={`/customers/${item.customerId}`}
                        className="font-semibold text-slate-900 hover:text-primary"
                      >
                        {item.customerName}
                      </Link>
                      <Badge className="bg-rose-100 text-rose-900 text-[10px] font-bold px-1.5 py-0 capitalize">
                        {item.daysRemaining === 0 ? "Today! 🎉" : `In ${item.daysRemaining} days`}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-slate-500 flex items-center gap-1">
                      {item.type === "birthday" ? (
                        <>
                          <Gift className="h-3 w-3 text-rose-500" /> Birthday on{" "}
                          {new Date(item.dateStr).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </>
                      ) : (
                        <>
                          <Heart className="h-3 w-3 text-pink-500" /> Anniversary on{" "}
                          {new Date(item.dateStr).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                          })}
                        </>
                      )}
                    </p>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-400">
                  <p>No celebrations in the next 30 days.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Unanswered WhatsApp Conversations */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-emerald-600" />
                WhatsApp Inbox Queue
              </CardTitle>
              <Link to="/crm/inbox">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-emerald-700 hover:bg-emerald-50">
                  Open Inbox
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {convos.slice(0, 3).map((conv) => (
                <Link
                  key={conv.id}
                  to="/crm/inbox"
                  className="p-3 rounded-lg border bg-white hover:bg-slate-50 transition-colors block space-y-1 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{conv.customerName}</span>
                    {conv.unreadCount > 0 && (
                      <Badge className="bg-emerald-600 text-white text-[10px] h-4 px-1.5">
                        {conv.unreadCount} new
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-1 italic">
                    &ldquo;{conv.lastMessagePreview}&rdquo;
                  </p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
