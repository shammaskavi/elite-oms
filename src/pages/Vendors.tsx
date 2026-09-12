import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Scissors,
  Plus,
  Search,
  ExternalLink,
  MessageSquare,
  Copy,
  Clock,
  AlertCircle,
  CheckCircle2,
  Users,
  Eye,
  Edit2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useDocumentTitle } from "@/hooks/use-document-title";

function generateToken() {
  return "v_" + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 6);
}

export default function Vendors() {
  useDocumentTitle("Karigars & Vendors");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Initialize filters & search from sessionStorage if returning from VendorDetail
  const [searchQuery, setSearchQuery] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem("vendorsUIState");
      if (saved) return JSON.parse(saved).searchQuery || "";
    } catch { }
    return "";
  });

  const [selectedStageFilter, setSelectedStageFilter] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem("vendorsUIState");
      if (saved) return JSON.parse(saved).selectedStageFilter || "all";
    } catch { }
    return "all";
  });

  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(() => {
    try {
      const saved = sessionStorage.getItem("vendorsUIState");
      if (saved) return JSON.parse(saved).statusFilter || "active";
    } catch { }
    return "active";
  });

  // Sync state to sessionStorage whenever filters or search query change
  useEffect(() => {
    sessionStorage.setItem(
      "vendorsUIState",
      JSON.stringify({
        searchQuery,
        selectedStageFilter,
        statusFilter,
      })
    );
  }, [searchQuery, selectedStageFilter, statusFilter]);

  // Modal states
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<any | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  // Form states
  const [formName, setFormName] = useState("");
  const [formStageId, setFormStageId] = useState<string>("none");
  const [formPortalEnabled, setFormPortalEnabled] = useState(true);
  const [formActive, setFormActive] = useState(true);

  // 1. Fetch all stages
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

  // 2. Fetch all vendors
  const { data: vendors = [], isLoading: vendorsLoading } = useQuery({
    queryKey: ["vendors-admin-list"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("vendors")
        .select("*, stages(id, name, order_index)")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // 3. Fetch all orders with their stages to calculate live workload & overdue counts per vendor
  const { data: allOrders = [] } = useQuery({
    queryKey: ["vendors-all-orders-workload"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("orders")
        .select(`
          id,
          order_code,
          order_status,
          metadata,
          created_at,
          invoices (
            id,
            invoice_number,
            date,
            raw_payload
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
  });

  // Restore scroll position when navigating back from VendorDetail
  useEffect(() => {
    if (vendorsLoading) return;
    const savedScrollY = sessionStorage.getItem("vendorsScrollY");
    if (savedScrollY !== null) {
      const scrollY = parseInt(savedScrollY, 10);
      requestAnimationFrame(() => {
        setTimeout(() => {
          window.scrollTo({ top: scrollY, behavior: "instant" as any });
        }, 50);
      });
      sessionStorage.removeItem("vendorsScrollY");
    }
  }, [vendorsLoading]);

  const handleNavigateToVendor = (vendorId: string) => {
    sessionStorage.setItem("vendorsScrollY", window.scrollY.toString());
    navigate(`/vendors/${vendorId}`);
  };

  // Process live workload per vendor strictly using the latest stage per product
  const vendorWorkloadStats = useMemo(() => {
    const stats: Record<
      string,
      {
        activeCount: number;
        dueSoonCount: number;
        overdueCount: number;
      }
    > = {};

    const now = new Date();
    const in48Hours = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Build fast lookup maps for vendors by ID and lowercase name
    const vendorById = new Map<string, any>();
    const vendorsByNameLower = new Map<string, any[]>();

    vendors.forEach((v: any) => {
      if (v.id) vendorById.set(v.id, v);
      if (v.name) {
        const key = v.name.trim().toLowerCase();
        if (!vendorsByNameLower.has(key)) vendorsByNameLower.set(key, []);
        vendorsByNameLower.get(key)!.push(v);
      }
    });

    allOrders.forEach((order: any) => {
      const orderStatusLower = (order.order_status || "").toLowerCase();
      const isOrderDeliveredOrCancelled =
        orderStatusLower === "delivered" || orderStatusLower === "cancelled";

      // If the overall order is delivered or cancelled, skip active workload
      if (isOrderDeliveredOrCancelled) return;

      const stages = order.order_stages || [];
      if (!stages.length) return;

      const productMap = new Map<string, any[]>();
      stages.forEach((st: any) => {
        const pNum = String(st.metadata?.product_number || "1");
        if (!productMap.has(pNum)) productMap.set(pNum, []);
        productMap.get(pNum)!.push(st);
      });

      productMap.forEach((pStages) => {
        const sortedStages = [...pStages].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        );
        const latestStage = sortedStages[sortedStages.length - 1];

        const stageNameLower = (latestStage?.stage_name || "").toLowerCase();
        const isLatestStageDone =
          stageNameLower === "delivered" ||
          stageNameLower === "cancelled" ||
          latestStage?.status === "completed";

        if (isLatestStageDone) return;

        // Match vendor by ID OR by vendor_name (with specialty stage disambiguation)
        let matchedVendor: any = null;
        if (latestStage?.vendor_id && vendorById.has(latestStage.vendor_id)) {
          matchedVendor = vendorById.get(latestStage.vendor_id);
        } else if (latestStage?.vendor_name) {
          const candidates = vendorsByNameLower.get(latestStage.vendor_name.trim().toLowerCase()) || [];
          if (candidates.length === 1) {
            matchedVendor = candidates[0];
          } else if (candidates.length > 1) {
            // Pick candidate whose specialty stage matches the current stage
            matchedVendor =
              candidates.find((c: any) => {
                const spec = c.stages?.name?.trim().toLowerCase();
                return spec && (stageNameLower.includes(spec) || spec.includes(stageNameLower));
              }) || candidates[0];
          }
        }

        if (!matchedVendor?.id) return;

        const vId = matchedVendor.id;
        if (!stats[vId]) {
          stats[vId] = { activeCount: 0, dueSoonCount: 0, overdueCount: 0 };
        }

        stats[vId].activeCount += 1;

        const rawDelivery =
          order?.metadata?.delivery_date ||
          order?.invoices?.raw_payload?.delivery_date;

        if (rawDelivery) {
          const dueDate = new Date(rawDelivery);
          if (!isNaN(dueDate.getTime())) {
            if (dueDate < now) {
              stats[vId].overdueCount += 1;
            } else if (dueDate <= in48Hours) {
              stats[vId].dueSoonCount += 1;
            }
          }
        }
      });
    });

    return stats;
  }, [allOrders, vendors]);

  // Overall workshop metrics
  const totalActiveGarments = useMemo(() => {
    return Object.values(vendorWorkloadStats).reduce((sum, s) => sum + s.activeCount, 0);
  }, [vendorWorkloadStats]);

  const totalOverdue = useMemo(() => {
    return Object.values(vendorWorkloadStats).reduce((sum, s) => sum + s.overdueCount, 0);
  }, [vendorWorkloadStats]);

  // Filtered vendors list
  const filteredVendors = useMemo(() => {
    return vendors.filter((v: any) => {
      // Search filter
      const q = searchQuery.toLowerCase();
      const nameMatch = v.name?.toLowerCase().includes(q);
      const stageMatch = v.stages?.name?.toLowerCase().includes(q);
      if (searchQuery && !nameMatch && !stageMatch) return false;

      // Status filter
      if (statusFilter === "active" && v.active === false) return false;
      if (statusFilter === "inactive" && v.active !== false) return false;

      // Stage filter
      if (selectedStageFilter !== "all") {
        if (v.stage_id !== selectedStageFilter) return false;
      }

      return true;
    });
  }, [vendors, searchQuery, statusFilter, selectedStageFilter]);

  // Add Vendor Mutation
  const addMutation = useMutation({
    mutationFn: async (payload: any) => {
      const { data, error } = await (supabase as any)
        .from("vendors")
        .insert([payload])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Karigar / Vendor added successfully");
      queryClient.invalidateQueries({ queryKey: ["vendors-admin-list"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setAddModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add vendor");
    },
  });

  // Edit Vendor Mutation
  const editMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
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
      toast.success("Vendor details updated");
      queryClient.invalidateQueries({ queryKey: ["vendors-admin-list"] });
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
      setEditModalOpen(false);
      setEditingVendor(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update vendor");
    },
  });

  const resetForm = () => {
    setFormName("");
    setFormStageId("none");
    setFormPortalEnabled(true);
    setFormActive(true);
  };

  const handleOpenAdd = () => {
    resetForm();
    setAddModalOpen(true);
  };

  const handleOpenEdit = (v: any) => {
    setEditingVendor(v);
    setFormName(v.name || "");
    setFormStageId(v.stage_id || "none");
    setFormPortalEnabled(v.portal_enabled ?? true);
    setFormActive(v.active ?? true);
    setEditModalOpen(true);
  };

  const handleSaveAdd = () => {
    if (!formName.trim()) {
      toast.error("Please enter a Karigar / Vendor name");
      return;
    }
    const token = generateToken();
    addMutation.mutate({
      name: formName.trim(),
      stage_id: formStageId === "none" ? null : formStageId,
      portal_enabled: formPortalEnabled,
      active: formActive,
      access_token: token,
    });
  };

  const handleSaveEdit = () => {
    if (!editingVendor) return;
    if (!formName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    editMutation.mutate({
      id: editingVendor.id,
      updates: {
        name: formName.trim(),
        stage_id: formStageId === "none" ? null : formStageId,
        portal_enabled: formPortalEnabled,
        active: formActive,
      },
    });
  };

  const copyPortalLink = (token: string, name: string) => {
    if (!token) {
      toast.error("No access token generated for this karigar");
      return;
    }
    const url = `${window.location.origin}/karigar/${token}`;
    navigator.clipboard.writeText(url);
    toast.success(`Copied portal link for ${name}!`);
  };

  const shareViaWhatsApp = (v: any) => {
    if (!v.access_token) {
      toast.error("No access token found for this vendor");
      return;
    }
    const stats = vendorWorkloadStats[v.id] || { activeCount: 0 };
    const portalUrl = `${window.location.origin}/karigar/${v.access_token}`;
    const text = `Hello ${v.name},\n\nHere is your live Karigar Work Portal link for Saree Palce Elite:\n🔗 ${portalUrl}\n\nYou currently have ${stats.activeCount} active garment(s) in progress.\n\nThank you!`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, "_blank");
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Karigars & Workshop Vendors</h1>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              Workshop Hub
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage artisans, job-work units, live workloads, and magic portal links
          </p>
        </div>
        <Button onClick={handleOpenAdd} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          Add Karigar / Vendor
        </Button>
      </div>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border bg-card shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">
              Active Karigars
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {vendors.filter((v: any) => v.active !== false).length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Registered workshop artisans
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">
              Garments In Workshop
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-primary">
              {totalActiveGarments}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Active in production stages
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">
              Urgent / Overdue
            </CardDescription>
            <CardTitle className={`text-2xl font-bold ${totalOverdue > 0 ? "text-destructive" : "text-emerald-600"}`}>
              {totalOverdue}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            {totalOverdue > 0 ? "Requires immediate follow-up" : "All orders on track"}
          </CardContent>
        </Card>

        <Card className="border bg-card shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs font-semibold uppercase tracking-wider">
              Portal Enabled
            </CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {vendors.filter((v: any) => v.portal_enabled !== false).length}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            With digital live work link
          </CardContent>
        </Card>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search karigar by name or specialty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Stage Specialization Filter */}
          <Select value={selectedStageFilter} onValueChange={setSelectedStageFilter}>
            <SelectTrigger className="w-[170px] h-10">
              <SelectValue placeholder="Specialty Stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Specialties</SelectItem>
              {stages.map((st: any) => (
                <SelectItem key={st.id} value={st.id}>
                  {st.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <div className="flex rounded-lg border bg-muted p-0.5">
            <button
              type="button"
              onClick={() => setStatusFilter("active")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${statusFilter === "active" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${statusFilter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter("inactive")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${statusFilter === "inactive" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Inactive
            </button>
          </div>
        </div>
      </div>

      {/* Vendors Grid */}
      {vendorsLoading ? (
        <div className="py-16 text-center text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-primary" />
          Loading workshop artisans & vendors...
        </div>
      ) : filteredVendors.length === 0 ? (
        <Card className="border-dashed p-12 text-center">
          <Scissors className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="font-semibold text-lg">No Karigars Found</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No vendors match "${searchQuery}". Try clearing your search.`
              : "Get started by adding your first Karigar, Masterji, or external workshop vendor."}
          </p>
          {!searchQuery && (
            <Button onClick={handleOpenAdd} className="mt-4 gap-2">
              <Plus className="h-4 w-4" /> Add Karigar
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVendors.map((v: any) => {
            const stats = vendorWorkloadStats[v.id] || {
              activeCount: 0,
              dueSoonCount: 0,
              overdueCount: 0,
              completedCount: 0,
            };

            const isInactive = v.active === false;

            return (
              <Card
                key={v.id}
                className={`border transition-all duration-200 hover:shadow-md ${isInactive ? "opacity-60 bg-muted/30" : "bg-card hover:border-primary/40"
                  }`}
              >
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className="min-w-0 flex-1 cursor-pointer group"
                      onClick={() => handleNavigateToVendor(v.id)}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-base truncate group-hover:text-primary transition-colors">
                          {v.name}
                        </h3>
                        {isInactive ? (
                          <Badge variant="secondary" className="text-[10px]">Inactive</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                            Active
                          </Badge>
                        )}
                      </div>

                      {/* Stage specialty */}
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <Scissors className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                        <span className="font-medium text-foreground">
                          {v.stages?.name || "General Workshop / Sourcing"}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
                      onClick={() => handleOpenEdit(v)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-4">
                  {/* Workload Status Pill Box */}
                  <div
                    className="grid grid-cols-3 gap-2 bg-muted/50 rounded-lg p-2.5 text-center cursor-pointer hover:bg-muted/70 transition-colors"
                    onClick={() => handleNavigateToVendor(v.id)}
                  >
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">In-Hand</p>
                      <p className={`text-base font-bold ${stats.activeCount > 0 ? "text-primary" : "text-muted-foreground"}`}>
                        {stats.activeCount}
                      </p>
                    </div>

                    <div className="border-x">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Due Soon</p>
                      <p className={`text-base font-bold ${stats.dueSoonCount > 0 ? "text-amber-600" : "text-muted-foreground"}`}>
                        {stats.dueSoonCount}
                      </p>
                    </div>

                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">Overdue</p>
                      <p className={`text-base font-bold ${stats.overdueCount > 0 ? "text-destructive" : "text-emerald-600"}`}>
                        {stats.overdueCount}
                      </p>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs gap-1.5 h-9"
                      onClick={() => handleNavigateToVendor(v.id)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Queue
                    </Button>

                    {v.portal_enabled !== false && v.access_token && (
                      <>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200 shrink-0"
                          title="Share Portal via WhatsApp"
                          onClick={() => shareViaWhatsApp(v)}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 text-muted-foreground hover:text-foreground shrink-0"
                          title="Copy Portal Link"
                          onClick={() => copyPortalLink(v.access_token, v.name)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Vendor Dialog */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5 text-primary" />
              Add Karigar / Vendor
            </DialogTitle>
            <DialogDescription>
              Register an artisan, masterji, or external vendor to assign garments and manage production.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="vname">Karigar / Vendor Name *</Label>
              <Input
                id="vname"
                placeholder="e.g. Master Rafiq (Stitching), Altaf (Aari)"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="vstage">Default Production Stage / Specialty</Label>
              <Select value={formStageId} onValueChange={setFormStageId}>
                <SelectTrigger id="vstage">
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
              <p className="text-[11px] text-muted-foreground">
                Orders moving to this stage will highlight this artisan for quick assignment.
              </p>
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="vportal" className="text-sm font-medium">Digital Portal Access</Label>
                <p className="text-[11px] text-muted-foreground">
                  Generates a magic link for the karigar to view assigned garments & measurements on mobile.
                </p>
              </div>
              <Switch
                id="vportal"
                checked={formPortalEnabled}
                onCheckedChange={setFormPortalEnabled}
              />
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="vactive" className="text-sm font-medium">Active Status</Label>
                <p className="text-[11px] text-muted-foreground">
                  Active karigars appear in Kanban assignment dropdowns.
                </p>
              </div>
              <Switch
                id="vactive"
                checked={formActive}
                onCheckedChange={setFormActive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAddModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveAdd} disabled={addMutation.isPending}>
              {addMutation.isPending ? "Adding..." : "Add Karigar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Vendor Dialog */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="h-5 w-5 text-primary" />
              Edit Karigar Details
            </DialogTitle>
            <DialogDescription>
              Update name, stage assignment, or portal access for this artisan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label htmlFor="edit-vname">Karigar / Vendor Name *</Label>
              <Input
                id="edit-vname"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-vstage">Default Production Stage / Specialty</Label>
              <Select value={formStageId} onValueChange={setFormStageId}>
                <SelectTrigger id="edit-vstage">
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
                <Label htmlFor="edit-vportal" className="text-sm font-medium">Digital Portal Access</Label>
                <p className="text-[11px] text-muted-foreground">
                  Allow artisan to view live jobs and measurements via their magic link.
                </p>
              </div>
              <Switch
                id="edit-vportal"
                checked={formPortalEnabled}
                onCheckedChange={setFormPortalEnabled}
              />
            </div>

            <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/30">
              <div className="space-y-0.5">
                <Label htmlFor="edit-vactive" className="text-sm font-medium">Active Status</Label>
                <p className="text-[11px] text-muted-foreground">
                  Inactive vendors are hidden from Kanban assignment lists.
                </p>
              </div>
              <Switch
                id="edit-vactive"
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
