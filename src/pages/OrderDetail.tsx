// obselete

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, Circle, ArrowLeft, ChevronDown } from "lucide-react";

const STAGES = [
  "Ordered",
  "Dyeing",
  "Polishing",
  "Embroidery",
  "Stitching",
  "Dangling",
  "Inward",
  "Packed",
  "Dispatched",
  "Delivered",
];

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; action: "delivered" | "cancelled" }>({ open: false, action: "delivered" });
  const [stageData, setStageData] = useState({
    stage_name: "",
    vendor_name: "",
    assigned_employee: "",
    notes: "",
    start_ts: new Date().toISOString().split("T")[0],
  });
  const queryClient = useQueryClient();

  const { data: order } = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select("*, customers(name), invoices(invoice_number)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: stages } = useQuery({
    queryKey: ["order-stages", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("order_stages")
        .select("*")
        .eq("order_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const createStageMutation = useMutation({
    mutationFn: async (data: any) => {
      const { error } = await (supabase as any).from("order_stages").insert([{
        order_id: id,
        stage_name: data.stage_name,
        vendor_name: data.vendor_name || null,
        assigned_employee: data.assigned_employee || null,
        notes: data.notes || null,
        start_ts: data.start_ts,
        status: "in_progress",
      }]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-stages", id] });
      toast.success("Stage started");
      setOpen(false);
      setStageData({
        stage_name: "",
        vendor_name: "",
        assigned_employee: "",
        notes: "",
        start_ts: new Date().toISOString().split("T")[0],
      });
    },
  });

  const completeStageMutation = useMutation({
    mutationFn: async (stageId: string) => {
      // Get the stage being completed
      const { data: stage } = await (supabase as any)
        .from("order_stages")
        .select("*")
        .eq("id", stageId)
        .single();

      const { error } = await (supabase as any)
        .from("order_stages")
        .update({
          status: "done",
          end_ts: new Date().toISOString(),
        })
        .eq("id", stageId);
      if (error) throw error;

      // If completing "Delivered" stage, update order status
      if (stage?.stage_name === "Delivered") {
        const { error: orderError } = await (supabase as any)
          .from("orders")
          .update({ order_status: "delivered" })
          .eq("id", id);
        if (orderError) throw orderError;

        queryClient.invalidateQueries({ queryKey: ["orders"] });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["order-stages", id] });
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      toast.success("Stage completed");
    },
  });

  const updateOrderStatusMutation = useMutation({
    mutationFn: async (status: "delivered" | "cancelled") => {
      // Update order status
      const { error: orderError } = await (supabase as any)
        .from("orders")
        .update({ order_status: status })
        .eq("id", id);
      if (orderError) throw orderError;

      // If marking as delivered, mark all stages as done
      if (status === "delivered") {
        // Get all existing stages for this order
        const { data: existingStages } = await (supabase as any)
          .from("order_stages")
          .select("stage_name")
          .eq("order_id", id);

        const existingStageNames = existingStages?.map(s => s.stage_name) || [];

        // Mark all existing stages as done
        const { error: updateError } = await (supabase as any)
          .from("order_stages")
          .update({
            status: "done",
            end_ts: new Date().toISOString()
          })
          .eq("order_id", id)
          .neq("status", "done");
        if (updateError) throw updateError;

        // Insert any missing stages as done
        const missingStages = STAGES.filter(stage => !existingStageNames.includes(stage));
        if (missingStages.length > 0) {
          const stagesToInsert = missingStages.map(stageName => ({
            order_id: id,
            stage_name: stageName,
            status: "done",
            start_ts: new Date().toISOString(),
            end_ts: new Date().toISOString(),
          }));
          const { error: insertError } = await (supabase as any).from("order_stages").insert(stagesToInsert);
          if (insertError) throw insertError;
        }
      }
    },
    onSuccess: (_, status) => {
      queryClient.invalidateQueries({ queryKey: ["order-stages", id] });
      queryClient.invalidateQueries({ queryKey: ["order", id] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(`Order marked as ${status === "delivered" ? "delivered" : "cancelled"}!`);
      setConfirmDialog({ open: false, action: "delivered" });
    },
    onError: () => {
      toast.error("Failed to update order status");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createStageMutation.mutate(stageData);
  };

  const getStageStatus = (stageName: string) => {
    const stage = stages?.find((s) => s.stage_name === stageName);
    if (!stage) return "pending";
    return stage.status;
  };

  const getStageIcon = (stageName: string) => {
    const status = getStageStatus(stageName);
    if (status === "done") return <CheckCircle2 className="w-6 h-6 text-success" />;
    if (status === "in_progress") return <Clock className="w-6 h-6 text-info" />;
    return <Circle className="w-6 h-6 text-muted" />;
  };

  const completedStages = stages?.filter(s => s.status === "done").map(s => s.stage_name) || [];
  const availableStages = STAGES.filter(s => !completedStages.includes(s));

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "delivered":
        return "success";
      case "cancelled":
        return "destructive";
      case "processing":
        return "warning";
      default:
        return "default";
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate("/orders")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Orders
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              Change Status <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setConfirmDialog({ open: true, action: "delivered" })}>
              Mark as Delivered
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setConfirmDialog({ open: true, action: "cancelled" })}>
              Mark as Cancelled
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{order?.order_code}</h1>
          <Badge variant={getStatusVariant(order?.order_status || "")} className="text-sm">
            {order?.order_status}
          </Badge>
        </div>
        <p className="text-muted-foreground mt-1">
          Created on {order?.created_at ? new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '-'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Customer</p>
            <p className="font-medium">{order?.customers?.name}</p>
          </div>
        </Card>
        <Card className="p-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Invoice</p>
            <p className="font-medium">{order?.invoices?.invoice_number}</p>
          </div>
        </Card>
        <Card className="p-6">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Total Amount</p>
            <p className="font-medium text-2xl">₹{order?.total_amount}</p>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 mb-6">
          <h2 className="text-xl font-semibold">Order Timeline</h2>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                Start Stage
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Start New Stage nigga</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="stage_name">Stage *</Label>
                  <select
                    id="stage_name"
                    value={stageData.stage_name}
                    onChange={(e) => setStageData({ ...stageData, stage_name: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                    required
                  >
                    <option value="">Select a stage...</option>
                    {availableStages.map(stage => (
                      <option key={stage} value={stage}>{stage}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="vendor_name">Vendor Name</Label>
                  <Input
                    id="vendor_name"
                    value={stageData.vendor_name}
                    onChange={(e) => setStageData({ ...stageData, vendor_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="assigned_employee">Assigned Employee</Label>
                  <Input
                    id="assigned_employee"
                    value={stageData.assigned_employee}
                    onChange={(e) => setStageData({ ...stageData, assigned_employee: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="start_ts">Start Date</Label>
                  <Input
                    id="start_ts"
                    type="date"
                    value={stageData.start_ts}
                    onChange={(e) => setStageData({ ...stageData, start_ts: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={stageData.notes}
                    onChange={(e) => setStageData({ ...stageData, notes: e.target.value })}
                  />
                </div>
                <Button type="submit" className="w-full">
                  Start Stage
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="space-y-4">
          {STAGES.map((stageName, index) => {
            const stage = stages?.find((s) => s.stage_name === stageName);
            const status = getStageStatus(stageName);

            return (
              <div key={stageName} className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  {getStageIcon(stageName)}
                  {index < STAGES.length - 1 && (
                    <div className={`w-0.5 h-16 ${status === "done" ? "bg-success" : "bg-muted"}`} />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{stageName}</h3>
                      {stage && (
                        <div className="text-sm text-muted-foreground mt-1">
                          {stage.vendor_name && <p>Vendor: {stage.vendor_name}</p>}
                          {stage.assigned_employee && <p>Employee: {stage.assigned_employee}</p>}
                          {stage.start_ts && (
                            <p>Started: {new Date(stage.start_ts).toLocaleDateString()}</p>
                          )}
                          {stage.end_ts && (
                            <p>Completed: {new Date(stage.end_ts).toLocaleDateString()}</p>
                          )}
                          {stage.notes && <p className="mt-1">{stage.notes}</p>}
                        </div>
                      )}
                    </div>
                    {stage && status === "in_progress" && (
                      <Button
                        size="sm"
                        onClick={() => completeStageMutation.mutate(stage.id)}
                      >
                        Mark Complete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => !open && setConfirmDialog({ open: false, action: "delivered" })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === "delivered" ? "Mark Order as Delivered?" : "Cancel Order?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === "delivered"
                ? "This will mark the order as delivered and complete all stages. The order will be moved to the completed section."
                : "This will cancel the order. This action can be reversed by changing the order status again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => updateOrderStatusMutation.mutate(confirmDialog.action)}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
