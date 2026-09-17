import { useState } from "react";
import { CheckCircle2, Circle, Clock, Plus, AlertCircle, Calendar, User, Check, Tag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CrmTask, TaskPriority } from "@/services/crm/crmTypes";
import { crmService } from "@/services/crm/crmService";

interface CustomerTasksTabProps {
  customerId: string;
  customerName: string;
  customerPhone?: string;
  tasks: CrmTask[];
  onTasksUpdated: (newTasks: CrmTask[]) => void;
}

const STAFF_MEMBERS = ["Ananya (Clienteling)", "Maaz", "Bablu", "Shammas", "Sohel"];

export function CustomerTasksTab({
  customerId,
  customerName,
  customerPhone,
  tasks,
  onTasksUpdated,
}: CustomerTasksTabProps) {
  const [openModal, setOpenModal] = useState(false);
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("pending");

  // New task form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedToName, setAssignedToName] = useState(STAFF_MEMBERS[0]);
  const [priority, setPriority] = useState<TaskPriority>("high");
  const [dueDays, setDueDays] = useState("1"); // days from now

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please provide a task title");
      return;
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + parseInt(dueDays, 10));

    try {
      crmService.createTask({
        customerId,
        customerName,
        customerPhone,
        title: title.trim(),
        description: description.trim() || undefined,
        assignedToName,
        priority,
        status: "pending",
        dueAt: dueDate.toISOString(),
        source: "manual",
      });

      const updated = crmService.getCustomerTasks(customerId);
      onTasksUpdated(updated);
      setOpenModal(false);
      setTitle("");
      setDescription("");
      toast.success("Follow-up task created");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create task");
    }
  };

  const handleToggleStatus = (taskId: string, currentStatus: CrmTask["status"]) => {
    const nextStatus = currentStatus === "completed" ? "pending" : "completed";
    const updated = crmService.updateTaskStatus(taskId, nextStatus);
    const customerSpecific = updated.filter(
      (t) => t.customerId === customerId || t.customerId === "seed_customer_1"
    );
    onTasksUpdated(customerSpecific);
    toast.success(nextStatus === "completed" ? "Task marked completed" : "Task marked pending");
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === "pending") return t.status !== "completed" && t.status !== "cancelled";
    if (filter === "completed") return t.status === "completed";
    return true;
  });

  const getPriorityBadge = (p: TaskPriority) => {
    switch (p) {
      case "urgent":
        return <Badge className="bg-red-50 text-red-700 border-red-200 text-[10px] uppercase font-bold">Urgent</Badge>;
      case "high":
        return <Badge className="bg-orange-50 text-orange-700 border-orange-200 text-[10px] uppercase font-bold">High</Badge>;
      case "normal":
        return <Badge variant="secondary" className="text-[10px] uppercase font-medium">Normal</Badge>;
      case "low":
        return <Badge variant="outline" className="text-[10px] uppercase text-slate-500">Low</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Follow-up Tasks & Reminders</h3>
          <p className="text-xs text-slate-500">
            Action items assigned to boutique staff to maintain client relationship continuity
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border bg-slate-50 p-0.5 text-xs font-medium">
            <button
              type="button"
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                filter === "pending" ? "bg-white shadow-2xs font-semibold text-slate-900" : "text-slate-500"
              }`}
              onClick={() => setFilter("pending")}
            >
              Pending ({tasks.filter((t) => t.status !== "completed").length})
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                filter === "completed" ? "bg-white shadow-2xs font-semibold text-slate-900" : "text-slate-500"
              }`}
              onClick={() => setFilter("completed")}
            >
              Completed ({tasks.filter((t) => t.status === "completed").length})
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded-md transition-colors cursor-pointer ${
                filter === "all" ? "bg-white shadow-2xs font-semibold text-slate-900" : "text-slate-500"
              }`}
              onClick={() => setFilter("all")}
            >
              All ({tasks.length})
            </button>
          </div>

          <Dialog open={openModal} onOpenChange={setOpenModal}>
            <DialogTrigger asChild>
              <Button size="sm" className="text-xs font-semibold gap-1.5 shadow-sm">
                <Plus className="h-4 w-4" /> New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">Create Follow-up Task</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateTask} className="space-y-4 pt-2 text-xs">
                <div className="space-y-1.5">
                  <Label className="text-xs">Task Title *</Label>
                  <Input
                    placeholder="e.g. Call regarding bridal saree trial date"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="text-xs h-9"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Description / Instructions</Label>
                  <Textarea
                    placeholder="Provide context on what needs to be discussed or sent…"
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
                        {STAFF_MEMBERS.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Priority</Label>
                    <Select value={priority} onValueChange={(val: TaskPriority) => setPriority(val)}>
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="urgent" className="text-xs text-red-700 font-semibold">🚨 Urgent (Today)</SelectItem>
                        <SelectItem value="high" className="text-xs text-orange-700 font-semibold">🔥 High (Tomorrow)</SelectItem>
                        <SelectItem value="normal" className="text-xs">Normal</SelectItem>
                        <SelectItem value="low" className="text-xs">Low</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Due Timeline</Label>
                  <Select value={dueDays} onValueChange={setDueDays}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0" className="text-xs">Due Today</SelectItem>
                      <SelectItem value="1" className="text-xs">Due Tomorrow</SelectItem>
                      <SelectItem value="3" className="text-xs">In 3 Days</SelectItem>
                      <SelectItem value="7" className="text-xs">In 1 Week</SelectItem>
                      <SelectItem value="14" className="text-xs">In 2 Weeks</SelectItem>
                      <SelectItem value="30" className="text-xs">In 1 Month</SelectItem>
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
                    Create Task
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Task List */}
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
                    ? "border-red-200 bg-red-50/20 shadow-xs ring-1 ring-red-100"
                    : "bg-white shadow-xs"
                }`}
              >
                <CardContent className="p-4 flex items-start gap-3.5">
                  <button
                    type="button"
                    onClick={() => handleToggleStatus(task.id, task.status)}
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
                    <div className="flex flex-wrap items-center gap-2">
                      <h4
                        className={`text-xs md:text-sm font-semibold text-slate-900 ${
                          isCompleted ? "line-through text-slate-500" : ""
                        }`}
                      >
                        {task.title}
                      </h4>
                      {getPriorityBadge(task.priority)}
                      {isOverdue && (
                        <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300 text-[9px] uppercase font-bold gap-1">
                          <AlertCircle className="h-2.5 w-2.5" /> Overdue
                        </Badge>
                      )}
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
                      {task.relatedInvoiceNumber && (
                        <span className="font-mono text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-100">
                          #{task.relatedInvoiceNumber}
                        </span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })
        ) : (
          <div className="py-12 text-center text-xs text-slate-500 border border-dashed rounded-xl bg-slate-50">
            <Check className="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
            <p className="font-medium text-slate-700">No {filter} tasks</p>
            <p className="text-slate-400 mt-0.5">All customer relationship follow-ups are up to date.</p>
          </div>
        )}
      </div>
    </div>
  );
}
