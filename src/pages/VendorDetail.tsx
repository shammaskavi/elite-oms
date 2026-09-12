import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Scissors,
  MessageSquare,
  Copy,
  ExternalLink,
  Clock,
  AlertCircle,
  CheckCircle2,
  Edit2,
  RefreshCw,
  Package,
  Calendar,
  User,
  FileText,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useDocumentTitle } from "@/hooks/use-document-title";

function generateToken() {
  return "v_" + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6);
}

export default function VendorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [formName, setFormName] = useState("");
  const [formStageId, setFormStageId] = useState<string>("none");
  const [formPortalEnabled, setFormPortalEnabled] = useState(true);
  const [formActive, setFormActive] = useState(true);

  // 1. Fetch Vendor details
  const { data: vendor, isLoading: vendorLoading } = useQuery({
    queryKey: ["vendor-detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await (supabase as any)
        .from("vendors")
        .select("*, stages(id, name, order_index)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  useDocumentTitle(vendor?.name ? `${vendor.name} · Karigar Profile` : "Karigar Profile");

  // 2. Fetch all stages
  const { data: stages = [] } = useQuery({
    queryKey: ["stages"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("stages")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // 3. Fetch all orders with all stages to calculate live workload & completed history
  const { data: allOrders = [], isLoading: stagesLoading } = useQuery({
    queryKey: ["vendor-all-orders-detail", id, vendor?.name],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await (supabase as any)
        .from("orders")
        .select(`
          id,
          order_code,
          order_status,
          created_at,
          metadata,
          invoices (
            id,
            invoice_number,
            date,
            raw_payload,
            customers (
              id,
              name,
              phone
            )
          ),
          order_stages (
            id,
            stage_name,
            vendor_id,
            vendor_name,
            status,
            metadata,
            created_at
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Split into Active Queue (strictly currently sitting with this artisan) vs Completed History
  const { activeItems, completedItems, stats } = useMemo(() => {
    const active: any[] = [];
    const completed: any[] = [];

    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    let dueSoon = 0;
    let overdue = 0;

    allOrders.forEach((order: any) => {
      const orderStatusLower = (order.order_status || "").toLowerCase();
      const isOrderDeliveredOrCancelled =
        orderStatusLower === "delivered" || orderStatusLower === "cancelled";

      const stages = order.order_stages || [];
      if (!stages.length) return;

      // Group stages by product_number
      const productMap = new Map<string, any[]>();
      stages.forEach((st: any) => {
        const pNum = String(st.metadata?.product_number || "1");
        if (!productMap.has(pNum)) productMap.set(pNum, []);
        productMap.get(pNum)!.push(st);
      });

      productMap.forEach((pStages, pNum) => {
        // Sort stages chronologically
        const sortedStages = [...pStages].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const latestStage = sortedStages[sortedStages.length - 1];

        const stageNameLower = (latestStage?.stage_name || "").toLowerCase();
        const isLatestStageDone =
          stageNameLower === "delivered" ||
          stageNameLower === "cancelled" ||
          latestStage?.status === "completed";

        const vendorNameLower = vendor?.name?.trim().toLowerCase();
        const latestVendorNameLower = latestStage?.vendor_name?.trim().toLowerCase();
        const vendorSpecialtyLower = vendor?.stages?.name?.trim().toLowerCase();

        let isLatestVendorMatch = false;
        if (latestStage?.vendor_id && latestStage.vendor_id === id) {
          isLatestVendorMatch = true;
        } else if (vendorNameLower && latestVendorNameLower && vendorNameLower === latestVendorNameLower) {
          if (vendorSpecialtyLower && stageNameLower) {
            isLatestVendorMatch =
              stageNameLower.includes(vendorSpecialtyLower) ||
              vendorSpecialtyLower.includes(stageNameLower);
          } else {
            isLatestVendorMatch = true;
          }
        }

        const isCurrentlyWithThisVendor =
          !isOrderDeliveredOrCancelled &&
          !isLatestStageDone &&
          Boolean(isLatestVendorMatch);

        const deliveryDateRaw =
          order?.metadata?.delivery_date ||
          order?.invoices?.raw_payload?.delivery_date;

        let urgency: "normal" | "dueSoon" | "overdue" = "normal";
        let daysRemaining: number | null = null;

        if (deliveryDateRaw) {
          const dueDate = new Date(deliveryDateRaw);
          if (!isNaN(dueDate.getTime())) {
            const diffMs = dueDate.getTime() - now.getTime();
            daysRemaining = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

            if (dueDate < now) {
              urgency = "overdue";
            } else if (dueDate <= in48Hours) {
              urgency = "dueSoon";
            }
          }
        }

        const customerName = order?.invoices?.customers?.name || order?.metadata?.customer_name || "Customer";
        const customerPhone = order?.invoices?.customers?.phone || order?.metadata?.customer_phone || "";
        const invoiceNumber = order?.invoices?.invoice_number || "—";
        const orderCode = order?.order_code || "—";

        // Active In-Hand Item
        if (isCurrentlyWithThisVendor) {
          active.push({
            id: `${order.id}-${pNum}-${latestStage.id}`,
            order_id: order.id,
            productNumber: pNum,
            stage_name: latestStage.stage_name,
            deliveryDate: deliveryDateRaw,
            urgency,
            daysRemaining,
            customerName,
            customerPhone,
            invoiceNumber,
            orderCode,
            itemName: latestStage.metadata?.product_name || order.metadata?.item_name || "Custom Garment",
            created_at: latestStage.created_at,
          });

          if (urgency === "overdue") overdue += 1;
          if (urgency === "dueSoon") dueSoon += 1;
        }

        // Completed History: check every stage worked on by this vendor that is now finished / moved forward
        sortedStages.forEach((st: any) => {
          const stStageNameLower = (st.stage_name || "").toLowerCase();
          const stVendorNameLower = st.vendor_name?.trim().toLowerCase();

          let isVendorMatch = false;
          if (st.vendor_id && st.vendor_id === id) {
            isVendorMatch = true;
          } else if (vendorNameLower && stVendorNameLower && vendorNameLower === stVendorNameLower) {
            if (vendorSpecialtyLower && stStageNameLower) {
              isVendorMatch =
                stStageNameLower.includes(vendorSpecialtyLower) ||
                vendorSpecialtyLower.includes(stStageNameLower);
            } else {
              isVendorMatch = true;
            }
          }

          if (!isVendorMatch) return;

          // Skip if this is the currently active in-hand stage
          if (isCurrentlyWithThisVendor && st.id === latestStage.id) return;

          completed.push({
            id: `${order.id}-${pNum}-${st.id}`,
            order_id: order.id,
            productNumber: pNum,
            stage_name: st.stage_name,
            deliveryDate: deliveryDateRaw,
            customerName,
            customerPhone,
            invoiceNumber,
            orderCode,
            itemName: st.metadata?.product_name || order.metadata?.item_name || "Custom Garment",
            created_at: st.created_at,
            currentStatus: isOrderDeliveredOrCancelled ? order.order_status : (latestStage?.stage_name || "Completed"),
          });
        });
      });
    });

    return {
      activeItems: active,
      completedItems: completed,
      stats: {
        activeCount: active.length,
        dueSoonCount: dueSoon,
        overdueCount: overdue,
        completedCount: completed.length,
      },
    };
  }, [allOrders, id, vendor?.name]);

  // Edit Vendor Mutation
  const editMutation = useMutation({
    mutationFn: async (updates: any) => {
      if (!id) return;
      const { data, error } = await (supabase as any)
        .from("vendors")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Karigar details updated");
      queryClient.invalidateQueries({ queryKey: ["vendor-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["vendors-admin-list"] });
      setEditModalOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update vendor");
    },
  });

  // Regenerate Token Mutation
  const regenerateTokenMutation = useMutation({
    mutationFn: async () => {
      if (!id) return;
      const newToken = generateToken();
      const { data, error } = await (supabase as any)
        .from("vendors")
        .update({ access_token: newToken })
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("New magic link generated!");
      queryClient.invalidateQueries({ queryKey: ["vendor-detail", id] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to regenerate token");
    },
  });

  const handleOpenEdit = () => {
    if (!vendor) return;
    setFormName(vendor.name || "");
    setFormStageId(vendor.stage_id || "none");
    setFormPortalEnabled(vendor.portal_enabled ?? true);
    setFormActive(vendor.active ?? true);
    setEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    if (!formName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    editMutation.mutate({
      name: formName.trim(),
      stage_id: formStageId === "none" ? null : formStageId,
      portal_enabled: formPortalEnabled,
      active: formActive,
    });
  };

  const portalUrl = vendor?.access_token
    ? `${window.location.origin}/karigar/${vendor.access_token}`
    : "";

  const copyPortalLink = () => {
    if (!portalUrl) return;
    navigator.clipboard.writeText(portalUrl);
    toast.success("Copied Karigar Portal link to clipboard!");
  };

  const shareViaWhatsApp = () => {
    if (!portalUrl || !vendor) return;
    const text = `Hello ${vendor.name},\n\nHere is your live Karigar Work Portal link for Saree Palace Elite:\n🔗 ${portalUrl}\n\nYou currently have ${stats.activeCount} active garment(s) in progress.\n\nThank you!`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  if (vendorLoading) {
    return (
      <div className="py-24 text-center text-muted-foreground">
        <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
        Loading Karigar profile...
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="p-6 text-center space-y-4">
        <h2 className="text-xl font-bold">Karigar Not Found</h2>
        <Button onClick={() => navigate("/vendors")}>← Back to Karigars & Vendors</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Top Breadcrumb / Back Button */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/vendors")}
          className="gap-1.5 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Karigars & Vendors
        </Button>
      </div>

      {/* Main Profile Header Card */}
      <Card className="border bg-card shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  {vendor.name}
                </h1>
                {vendor.active !== false ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                    🟢 Active Artisan
                  </Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
                {vendor.portal_enabled !== false ? (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                    📱 Portal Enabled
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    Portal Disabled
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Scissors className="h-4 w-4 text-primary" />
                <span className="font-medium text-foreground">
                  {vendor.stages?.name || "General Workshop & Sourcing"}
                </span>
                <span>·</span>
                <span>Registered Artisan</span>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {vendor.portal_enabled !== false && portalUrl && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200 h-9"
                    onClick={shareViaWhatsApp}
                  >
                    <MessageSquare className="h-4 w-4" />
                    Share WhatsApp Link
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-9"
                    onClick={copyPortalLink}
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Copy Portal Link
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 h-9"
                    onClick={() => window.open(portalUrl, "_blank")}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open Portal
                  </Button>
                </>
              )}

              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 h-9"
                onClick={handleOpenEdit}
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit Profile
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border bg-card shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">
              Active In-Hand
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-primary">
              {stats.activeCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Garments currently in production
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">
              Due in 48 Hours
            </CardDescription>
            <CardTitle className={`text-2xl font-bold ${stats.dueSoonCount > 0 ? "text-amber-600" : "text-foreground"}`}>
              {stats.dueSoonCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Upcoming urgent deliveries
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">
              Overdue
            </CardDescription>
            <CardTitle className={`text-2xl font-bold ${stats.overdueCount > 0 ? "text-destructive" : "text-emerald-600"}`}>
              {stats.overdueCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            {stats.overdueCount > 0 ? "Past delivery due date" : "No overdue items"}
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-sm">
          <CardHeader className="p-4 pb-1">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">
              Completed Orders
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {stats.completedCount}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Delivered garments archive
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Active Queue / History / Portal Settings */}
      <Tabs defaultValue="active-queue" className="space-y-4">
        <TabsList className="bg-muted p-1 rounded-lg">
          <TabsTrigger value="active-queue" className="gap-2">
            <Package className="h-4 w-4" />
            Active Queue ({activeItems.length})
          </TabsTrigger>
          <TabsTrigger value="completed-history" className="gap-2">
            <CheckCircle2 className="h-4 w-4" />
            Completed History ({completedItems.length})
          </TabsTrigger>
          <TabsTrigger value="portal-settings" className="gap-2">
            <Sparkles className="h-4 w-4" />
            Magic Link & Portal
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Active Queue */}
        <TabsContent value="active-queue">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6 pb-3">
              <CardTitle className="text-lg">Live Work Queue</CardTitle>
              <CardDescription>
                Garments currently assigned to {vendor.name}. Sorted by delivery urgency.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              {stagesLoading ? (
                <div className="py-12 text-center text-muted-foreground">
                  <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                  Loading assigned garments...
                </div>
              ) : activeItems.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <CheckCircle2 className="h-10 w-10 text-emerald-500/50 mx-auto mb-2" />
                  <p className="font-medium text-foreground">No Active Work In-Hand</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    This artisan is currently free. Assign new garments from the Kanban or Order Timeline.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Garment Item</TableHead>
                        <TableHead>Current Stage</TableHead>
                        <TableHead>Delivery Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeItems.map((item) => (
                        <TableRow key={item.id} className="hover:bg-muted/50">
                          <TableCell className="font-semibold">
                            <span className="text-primary">{item.invoiceNumber}</span>
                          </TableCell>

                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="font-medium text-sm">{item.customerName}</p>
                              {item.customerPhone && (
                                <p className="text-xs text-muted-foreground">📞 {item.customerPhone}</p>
                              )}
                            </div>
                          </TableCell>

                          <TableCell>
                            <div className="font-medium text-sm">{item.itemName}</div>
                          </TableCell>

                          <TableCell>
                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
                              {item.stage_name}
                            </Badge>
                          </TableCell>

                          <TableCell>
                            {item.deliveryDate ? (
                              <div className="space-y-1">
                                <div className="text-xs font-medium">
                                  {new Date(item.deliveryDate).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "2-digit",
                                  })}
                                </div>
                                {item.urgency === "overdue" ? (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                    🚨 Overdue
                                  </Badge>
                                ) : item.urgency === "dueSoon" ? (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-50 text-amber-700 border-amber-300">
                                    ⏳ Due in {item.daysRemaining}d
                                  </Badge>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">
                                    In {item.daysRemaining} days
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>

                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs gap-1 h-8"
                              onClick={() => navigate(`/orders/${item.order_id}`)}
                            >
                              View Order
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Completed History */}
        <TabsContent value="completed-history">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6 pb-3">
              <CardTitle className="text-lg">Completed Work History</CardTitle>
              <CardDescription>
                Archive of all garments delivered or finished by {vendor.name}.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-6 sm:pt-0">
              {completedItems.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="font-medium text-foreground">No Completed Orders Yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Delivered items completed by this artisan will automatically archive here.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Garment Item</TableHead>
                        <TableHead>Stage Completed</TableHead>
                        <TableHead>Finished Date</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {completedItems.map((item) => (
                        <TableRow key={item.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium text-muted-foreground">
                            {item.invoiceNumber}
                          </TableCell>
                          <TableCell>{item.customerName}</TableCell>
                          <TableCell>{item.itemName}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              {item.stage_name}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(item.created_at).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "2-digit",
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs gap-1 h-8"
                              onClick={() => navigate(`/orders/${item.order_id}`)}
                            >
                              View
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Portal & Magic Link */}
        <TabsContent value="portal-settings">
          <Card className="border shadow-sm">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg">Karigar Digital Magic Link</CardTitle>
              <CardDescription>
                Artisans can open this mobile-friendly portal without a password to view their live job queue, design instructions, and customer measurements.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-6">
              {vendor.portal_enabled !== false ? (
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Personalized Magic Portal URL
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        readOnly
                        value={portalUrl}
                        className="font-mono text-xs bg-muted/50 select-all"
                      />
                      <Button variant="outline" onClick={copyPortalLink} className="gap-1.5 shrink-0">
                        <Copy className="h-4 w-4" />
                        Copy
                      </Button>
                      <Button
                        variant="default"
                        onClick={shareViaWhatsApp}
                        className="gap-1.5 shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                      >
                        <MessageSquare className="h-4 w-4" />
                        WhatsApp
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-primary" />
                      What can the Karigar see on this link?
                    </h4>
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                      <li>Their real-time assigned garments and delivery due dates.</li>
                      <li>Customer body measurements and blouse/lehenga sketches.</li>
                      <li>Special workshop notes, lining specs, and styling instructions.</li>
                      <li>Zero access to financial invoices or customer pricing.</li>
                    </ul>
                  </div>

                  <div className="pt-2 border-t flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Regenerate Access Token</p>
                      <p className="text-xs text-muted-foreground">
                        If the old link was shared by mistake, create a new secure link. The previous link will stop working.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => regenerateTokenMutation.mutate()}
                      disabled={regenerateTokenMutation.isPending}
                      className="gap-1.5 text-destructive hover:bg-destructive/10"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      {regenerateTokenMutation.isPending ? "Generating..." : "Regenerate Token"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="py-8 text-center space-y-3">
                  <AlertCircle className="h-10 w-10 text-amber-500 mx-auto" />
                  <p className="font-semibold">Digital Portal Access Disabled</p>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    Portal access is currently switched off for this vendor. Enable it in profile settings to generate a magic link.
                  </p>
                  <Button variant="outline" size="sm" onClick={handleOpenEdit}>
                    Enable Portal Access
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Vendor Dialog */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              Edit Karigar Details
            </DialogTitle>
            <DialogDescription>
              Update name, stage specialty, or portal access for {vendor.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="detail-vname">Karigar / Vendor Name *</Label>
              <Input
                id="detail-vname"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="detail-vstage">Default Production Stage / Specialty</Label>
              <Select value={formStageId} onValueChange={setFormStageId}>
                <SelectTrigger id="detail-vstage">
                  <SelectValue placeholder="Select specialty stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General Workshop / Sourcing</SelectItem>
                  {stages.map((st: any) => (
                    <SelectItem key={st.id} value={st.id}>
                      {st.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="detail-vportal" className="text-sm font-medium">Digital Portal Access</Label>
                <p className="text-[11px] text-muted-foreground">
                  Allow artisan to view live jobs and measurements via their magic link.
                </p>
              </div>
              <Switch
                id="detail-vportal"
                checked={formPortalEnabled}
                onCheckedChange={setFormPortalEnabled}
              />
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="detail-vactive" className="text-sm font-medium">Active Status</Label>
                <p className="text-[11px] text-muted-foreground">
                  Inactive vendors are hidden from Kanban assignment lists.
                </p>
              </div>
              <Switch
                id="detail-vactive"
                checked={formActive}
                onCheckedChange={setFormActive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={editMutation.isPending}>
              {editMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
