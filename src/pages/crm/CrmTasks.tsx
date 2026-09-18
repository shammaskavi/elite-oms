import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Circle,
  AlertCircle,
  User,
  Calendar,
  Check,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { crmService } from "@/services/crm/crmService";
import { CrmTask, TaskPriority } from "@/services/crm/crmTypes";
import { toast } from "sonner";
import { CrmSubNav } from "@/components/crm/CrmSubNav";

const STAFF_MEMBERS = ["All Staff", "Ananya", "Maaz", "Bablu", "Shammas", "Sohel"];

export default function CrmTasks() {
  useDocumentTitle("CRM • Tasks & Follow-ups");

  const [refreshKey, setRefreshKey] = useState(0);
  const [filterTab, setFilterTab] = useState<"pending" | "due_today" | "overdue" | "completed" | "all">("pending");
  const [selectedStaff, setSelectedStaff] = useState("All Staff");
  const [searchQuery, setSearchQuery] = useState("");
  const [openModal, setOpenModal] = useState(false);

  // New task form fields
  const [customerName, setCustomerName] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToName, setAssignedToName] = useState("Ananya");
  const [priority, setPriority] = useState<TaskPriority>("high");
  const [dueDays, setDueDays] = useState("1");
  const [tasksList, setTasksList] = useState<CrmTask[]>(() => crmService.getAllTasks());

  useEffect(() => {
    crmService.fetchAllTasksFromSupabase().then((data) => {
      setTasksList(data);
    });
  }, [refreshKey]);

  const allTasks = tasksList;

  const handleToggleTask = (taskId: string, currentStatus: CrmTask["status"]) => {
    const nextStatus = currentStatus === "completed" ? "pending" : "completed";
    crmService.updateTaskStatus(taskId, nextStatus);
    setRefreshKey((k) => k + 1);
    toast.success(nextStatus === "completed" ? "Task completed" : "Task marked pending");
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !customerName.trim()) {
      toast.error("Please provide both customer name and task title");
      return;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + parseInt(dueDays, 10));

    try {
      crmService.createTask({
        customerId: `cust_${Date.now()}`,
        customerName: customerName.trim(),
        title: title.trim(),
        description: description.trim() || undefined,
        assignedToName,
        priority,
        status: "pending",
        dueAt: dueDate.toISOString(),
        source: "manual",
      });

      setRefreshKey((k) => k + 1);
      setOpenModal(false);
      setCustomerName("");
      setTitle("");
      setDescription("");
      toast.success("Task added to boutique follow-up queue");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create task");
    }
  };

  const filteredTasks = useMemo(() => {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    return allTasks.filter((t) => {
      // Staff filter
      if (selectedStaff !== "All Staff" && !t.assignedToName.includes(selectedStaff)) {
        return false;
      }

      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          t.title.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Tab status filter
      if (filterTab === "pending") return t.status !== "completed" && t.status !== "cancelled";
      if (filterTab === "due_today") {
        return (
          t.status !== "completed" &&
          t.status !== "cancelled" &&
          t.dueAt.startsWith(todayStr)
        );
      }
      if (filterTab === "overdue") {
        return (
          t.status !== "completed" &&
          t.status !== "cancelled" &&
          new Date(t.dueAt) < now
        );
      }
      if (filterTab === "completed") return t.status === "completed";
      return true;
    });
  }, [allTasks, filterTab, selectedStaff, searchQuery]);

  return (
    <div className="space-y-6">
      <CrmSubNav />

      {/* ================= Header ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Follow-up Tasks & Reminders
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage team clienteling assignments, occasion follow-ups, and payment reminders
          </p>
        </div>

        <Dialog open={openModal} onOpenChange={setOpenModal}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 text-xs font-semibold shadow-sm">
              <Plus className="h-4 w-4" /> Create Follow-up Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">New Clienteling Task</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateTask} className="space-y-4 pt-2 text-xs">
              <div className="space-y-1.5">
                <Label className="text-xs">Customer Name *</Label>
                <Input
                  placeholder="e.g. Asha Rao"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="text-xs h-9"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Task Objective / Title *</Label>
                <Input
                  placeholder="e.g. Send Kanjeevaram preview for wedding"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="text-xs h-9"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Instructions & Details</Label>
                <Textarea
                  placeholder="Notes on client preferences, phone call timing, etc."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Assigned Staff</Label>
                  <Select value={assignedToName} onValueChange={setAssignedToName}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAFF_MEMBERS.filter((s) => s !== "All Staff").map((s) => (
                        <SelectItem key={s} value={s} className="text-xs">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Priority</Label>
                  <Select value={priority} onValueChange={(val) => setPriority(val as TaskPriority)}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="urgent" className="text-xs text-red-600 font-semibold">🔴 Urgent</SelectItem>
                      <SelectItem value="high" className="text-xs text-amber-600 font-semibold">🟠 High</SelectItem>
                      <SelectItem value="medium" className="text-xs">🟡 Medium</SelectItem>
                      <SelectItem value="low" className="text-xs">⚪ Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Due Timing</Label>
                <Select value={dueDays} onValueChange={setDueDays}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0" className="text-xs font-semibold text-red-600">Today</SelectItem>
                    <SelectItem value="1" className="text-xs font-medium">Tomorrow</SelectItem>
                    <SelectItem value="3" className="text-xs">In 3 Days</SelectItem>
                    <SelectItem value="7" className="text-xs">In 1 Week</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setOpenModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="text-xs font-semibold">
                  Add Task
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ================= Filter Toolbar ================= */}
      <Card className="border shadow-2xs">
        <CardContent className="p-3 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filterTab === "pending" ? "bg-primary text-primary-foreground font-semibold shadow-xs" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
              onClick={() => setFilterTab("pending")}
            >
              Pending ({allTasks.filter((t) => t.status !== "completed").length})
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filterTab === "due_today" ? "bg-amber-600 text-white font-semibold shadow-xs" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
              onClick={() => setFilterTab("due_today")}
            >
              Due Today
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filterTab === "overdue" ? "bg-destructive text-destructive-foreground font-semibold shadow-xs" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
              onClick={() => setFilterTab("overdue")}
            >
              Overdue
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filterTab === "completed" ? "bg-emerald-600 text-white font-semibold shadow-xs" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
              onClick={() => setFilterTab("completed")}
            >
              Completed
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                filterTab === "all" ? "bg-primary text-primary-foreground font-semibold shadow-xs" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
              onClick={() => setFilterTab("all")}
            >
              All ({allTasks.length})
            </button>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            {/* Staff dropdown */}
            <Select value={selectedStaff} onValueChange={setSelectedStaff}>
              <SelectTrigger className="text-xs h-8.5 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAFF_MEMBERS.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Search Input */}
            <div className="relative flex-1 md:w-56">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <Input
                placeholder="Search tasks or clients…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8.5"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ================= Task List ================= */}
      <div className="space-y-3">
        {filteredTasks.length > 0 ? (
          filteredTasks.map((task) => {
            const isCompleted = task.status === "completed";
            const isOverdue = !isCompleted && new Date(task.dueAt) < new Date();

            return (
              <Card
                key={task.id}
                className={`border transition-all ${
                  isCompleted
                    ? "bg-slate-50/70 border-slate-200 opacity-80"
                    : isOverdue
                    ? "border-red-200 bg-red-50/20 shadow-xs"
                    : "bg-white shadow-xs hover:border-slate-300"
                }`}
              >
                <CardContent className="p-4 flex items-start gap-3.5">
                  <button
                    type="button"
                    onClick={() => handleToggleTask(task.id, task.status)}
                    className="mt-0.5 text-slate-400 hover:text-primary transition-colors cursor-pointer shrink-0"
                    title={isCompleted ? "Mark incomplete" : "Mark as completed"}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 fill-emerald-100" />
                    ) : (
                      <Circle className="h-5 w-5 text-slate-300 hover:text-slate-500" />
                    )}
                  </button>

                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/customers/${task.customerId}`}
                          className={`font-semibold text-xs md:text-sm text-slate-900 hover:text-primary ${
                            isCompleted ? "line-through text-slate-500" : ""
                          }`}
                        >
                          {task.customerName}
                        </Link>
                        <span className="text-slate-400">•</span>
                        <span className={`text-xs md:text-sm ${isCompleted ? "line-through text-slate-500" : "text-slate-800"}`}>
                          {task.title}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className={`text-[9px] uppercase font-bold px-1.5 py-0 ${
                            task.priority === "urgent"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : task.priority === "high"
                              ? "bg-orange-50 text-orange-700 border-orange-200"
                              : "bg-slate-50 text-slate-600"
                          }`}
                        >
                          {task.priority}
                        </Badge>
                        {isOverdue && (
                          <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-[9px] uppercase font-bold">
                            Overdue
                          </Badge>
                        )}
                      </div>
                    </div>

                    {task.description && (
                      <p className="text-xs text-slate-600 leading-relaxed">{task.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" /> Assigned: <strong className="text-slate-700 font-medium">{task.assignedToName}</strong>
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Due: <span className={isOverdue ? "text-red-700 font-semibold" : ""}>
                          {new Date(task.dueAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="py-16 text-center text-xs text-slate-500 border border-dashed rounded-xl bg-slate-50">
            <Check className="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
            <p className="font-semibold text-slate-700">No tasks in this view</p>
            <p className="text-slate-400 mt-0.5">All staff follow-up items are clear.</p>
          </div>
        )}
      </div>
    </div>
  );
}
