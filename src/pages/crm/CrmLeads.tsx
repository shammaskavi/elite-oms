import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Users,
  Plus,
  Search,
  ArrowRight,
  Sparkles,
  Phone,
  MessageSquare,
  CheckCircle2,
  XCircle,
  Tag,
  UserCheck,
  Kanban,
  LayoutGrid,
  ChevronRight,
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
import { CrmLead, LeadStatus } from "@/services/crm/crmTypes";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CrmSubNav } from "@/components/crm/CrmSubNav";

const STAGES: { key: LeadStatus; label: string; color: string; border: string }[] = [
  { key: "new", label: "New Inquiry", color: "bg-blue-100 text-blue-800", border: "border-blue-200" },
  { key: "contacted", label: "Contacted", color: "bg-purple-100 text-purple-800", border: "border-purple-200" },
  { key: "interested", label: "Interested", color: "bg-amber-100 text-amber-800", border: "border-amber-200" },
  { key: "visit_planned", label: "Store Visit Planned", color: "bg-indigo-100 text-indigo-800", border: "border-indigo-200" },
  { key: "selection", label: "Trial / Selection", color: "bg-orange-100 text-orange-800", border: "border-orange-200" },
  { key: "converted", label: "Converted Client", color: "bg-emerald-100 text-emerald-800", border: "border-emerald-200" },
];

const SOURCES = ["Instagram", "Walk-in", "Referral", "WhatsApp", "Website", "Exhibition", "Phone"];
const STAFF = ["Ananya", "Maaz", "Bablu", "Shammas", "Sohel"];

export default function CrmLeads() {
  useDocumentTitle("CRM • Boutique Prospects & Leads");
  const navigate = useNavigate();

  const [refreshKey, setRefreshKey] = useState(0);
  const [viewMode, setViewMode] = useState<"kanban" | "grid">("kanban");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStage, setSelectedStage] = useState<string>("all");
  const [openModal, setOpenModal] = useState(false);

  // Form states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState<CrmLead["source"]>("Instagram");
  const [assignedToName, setAssignedToName] = useState("Ananya");
  const [occasion, setOccasion] = useState("");
  const [budgetRange, setBudgetRange] = useState("₹25,000 – ₹50,000");
  const [category, setCategory] = useState("Bridal Kanjeevaram");
  const [notes, setNotes] = useState("");
  const [leadsList, setLeadsList] = useState<CrmLead[]>(() => crmService.getLeads());

  useEffect(() => {
    crmService.fetchLeadsFromSupabase().then((data) => {
      setLeadsList(data);
    });
  }, [refreshKey]);

  const allLeads = leadsList;

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !phone.trim()) {
      toast.error("Please enter prospect name and phone");
      return;
    }

    try {
      crmService.createLead({
        name: name.trim(),
        phone: phone.trim(),
        whatsappNumber: phone.trim(),
        source,
        status: "new",
        assignedToName,
        interestedCategories: [category],
        occasion: occasion.trim() || undefined,
        budgetRange,
        notes: notes.trim() || undefined,
      });

      setRefreshKey((k) => k + 1);
      setOpenModal(false);
      setName("");
      setPhone("");
      setOccasion("");
      setNotes("");
      toast.success("Prospect added to clienteling pipeline");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create lead");
    }
  };

  const handleUpdateStatus = (leadId: string, nextStatus: LeadStatus) => {
    crmService.updateLeadStatus(leadId, nextStatus);
    setRefreshKey((k) => k + 1);
    toast.success(`Moved to ${nextStatus.replace("_", " ")}`);
  };

  // 1-Click Convert Lead to Real Customer in Supabase
  const handleConvertToCustomer = async (lead: CrmLead) => {
    try {
      const { data: existing } = await supabase
        .from("customers")
        .select("id, name")
        .eq("phone", lead.phone)
        .maybeSingle();

      let targetCustomerId = existing?.id;

      if (!targetCustomerId) {
        const { data: newCust, error } = await supabase
          .from("customers")
          .insert({
            name: lead.name,
            phone: lead.phone,
          })
          .select()
          .single();

        if (error) throw error;
        targetCustomerId = newCust.id;
      }

      crmService.updateLeadStatus(lead.id, "converted");
      setRefreshKey((k) => k + 1);
      toast.success(`${lead.name} successfully converted to boutique client!`);
      navigate(`/customers/${targetCustomerId}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to convert prospect");
    }
  };

  const filteredLeads = useMemo(() => {
    return allLeads.filter((l) => {
      if (selectedStage !== "all" && l.status !== selectedStage) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          l.name.toLowerCase().includes(q) ||
          l.phone.includes(q) ||
          (l.occasion && l.occasion.toLowerCase().includes(q)) ||
          l.interestedCategories.some((c) => c.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [allLeads, selectedStage, searchQuery]);

  return (
    <div className="space-y-6">
      <CrmSubNav />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Boutique Prospects & Sales Pipeline
          </h1>
          <p className="text-sm text-muted-foreground">
            Track inquiries from Instagram, walk-ins, and referrals through to customer conversion
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode toggle: Kanban vs Grid */}
          <div className="flex rounded-lg border bg-muted p-0.5 text-xs font-medium">
            <button
              type="button"
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === "kanban" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setViewMode("kanban")}
            >
              <Kanban className="h-3.5 w-3.5" /> Pipeline Kanban
            </button>
            <button
              type="button"
              className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === "grid" ? "bg-background text-foreground shadow-xs font-semibold" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setViewMode("grid")}
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Cards
            </button>
          </div>

          <Dialog open={openModal} onOpenChange={setOpenModal}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 text-xs font-semibold shadow-sm">
                <Plus className="h-4 w-4" /> Add Prospect
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="text-base font-semibold">New Boutique Prospect</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateLead} className="space-y-3.5 pt-2 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Prospect Name *</Label>
                    <Input
                      placeholder="e.g. Ritu Desai"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="text-xs h-9"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Phone / WhatsApp *</Label>
                    <Input
                      placeholder="e.g. 9876543210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="text-xs h-9 font-mono"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Lead Source</Label>
                    <Select value={source} onValueChange={(val: any) => setSource(val)}>
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCES.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Assigned Staff</Label>
                    <Select value={assignedToName} onValueChange={setAssignedToName}>
                      <SelectTrigger className="text-xs h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAFF.map((s) => (
                          <SelectItem key={s} value={s} className="text-xs">
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Occasion / Event</Label>
                    <Input
                      placeholder="e.g. Brother's Wedding (Nov)"
                      value={occasion}
                      onChange={(e) => setOccasion(e.target.value)}
                      className="text-xs h-9"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs">Interested Category</Label>
                    <Input
                      placeholder="e.g. Pure Kanjeevaram"
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="text-xs h-9"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Initial Notes & Context</Label>
                  <Textarea
                    placeholder="Details of inquiry, style requirements…"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="text-xs resize-none"
                  />
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
                    Add to Pipeline
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filter toolbar */}
      <Card className="border shadow-2xs">
        <CardContent className="p-3 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            <button
              type="button"
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                selectedStage === "all" ? "bg-primary text-primary-foreground font-semibold shadow-xs" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
              }`}
              onClick={() => setSelectedStage("all")}
            >
              All Leads ({allLeads.length})
            </button>
            {STAGES.map((st) => (
              <button
                type="button"
                key={st.key}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                  selectedStage === st.key ? "bg-primary text-primary-foreground font-semibold shadow-xs" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
                onClick={() => setSelectedStage(st.key)}
              >
                {st.label} ({allLeads.filter((l) => l.status === st.key).length})
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-64">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
            <Input
              placeholder="Search leads by name or phone…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 text-xs h-8.5"
            />
          </div>
        </CardContent>
      </Card>

      {/* ================= 1. KANBAN PIPELINE VIEW (wacrm style) ================= */}
      {viewMode === "kanban" ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3.5 overflow-x-auto pb-4 items-start">
          {STAGES.map((stage, sIdx) => {
            const stageLeads = filteredLeads.filter((l) => l.status === stage.key);
            const nextStage = STAGES[sIdx + 1]?.key;

            return (
              <div key={stage.key} className="bg-slate-50/80 rounded-xl border border-slate-200 p-2.5 flex flex-col gap-2 min-w-[200px]">
                <div className="flex items-center justify-between pb-1 px-1 border-b border-slate-200">
                  <span className="font-bold text-xs text-slate-800">{stage.label}</span>
                  <Badge variant="secondary" className="text-[10px] font-bold h-5 px-1.5">
                    {stageLeads.length}
                  </Badge>
                </div>

                <div className="space-y-2.5">
                  {stageLeads.map((lead) => (
                    <Card key={lead.id} className="border bg-white shadow-2xs p-3 space-y-2 text-xs">
                      <div>
                        <h4 className="font-semibold text-slate-900 line-clamp-1">{lead.name}</h4>
                        <p className="text-[11px] text-slate-500 font-mono">{lead.phone}</p>
                      </div>

                      {lead.occasion && (
                        <Badge variant="outline" className="text-[9px] bg-purple-50 text-purple-800 border-purple-200 truncate max-w-full">
                          {lead.occasion}
                        </Badge>
                      )}

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t">
                        <span>via {lead.source}</span>
                        <span>{lead.assignedToName}</span>
                      </div>

                      {/* Advance Pipeline or Convert Button */}
                      <div className="pt-1">
                        {lead.status !== "converted" ? (
                          <div className="flex items-center gap-1">
                            {nextStage && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] flex-1 px-1 text-slate-700"
                                onClick={() => handleUpdateStatus(lead.id, nextStage)}
                              >
                                Advance <ChevronRight className="h-3 w-3" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              className="h-6 text-[10px] bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-1.5"
                              onClick={() => handleConvertToCustomer(lead)}
                              title="Convert to client"
                            >
                              Convert
                            </Button>
                          </div>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold w-full justify-center">
                            Converted Client ✅
                          </Badge>
                        )}
                      </div>
                    </Card>
                  ))}

                  {stageLeads.length === 0 && (
                    <div className="py-8 text-center text-[11px] text-slate-400 italic">
                      Empty
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* ================= 2. GRID / CARDS VIEW ================= */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.length > 0 ? (
            filteredLeads.map((lead) => {
              const currentStageObj = STAGES.find((s) => s.key === lead.status) || STAGES[0];

              return (
                <Card key={lead.id} className="border shadow-xs hover:border-slate-300 transition-colors flex flex-col justify-between">
                  <CardHeader className="pb-2.5 pt-4 px-4 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-sm text-slate-900">{lead.name}</h3>
                        <p className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-0.5">
                          <Phone className="h-3 w-3 text-emerald-600" /> {lead.phone}
                        </p>
                      </div>

                      <Badge className={`text-[10px] font-bold px-2 py-0.5 uppercase ${currentStageObj.color}`}>
                        {currentStageObj.label}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      <Badge variant="outline" className="text-[10px] bg-slate-50">
                        via {lead.source}
                      </Badge>
                      {lead.occasion && (
                        <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-800 border-purple-200">
                          {lead.occasion}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>

                  <CardContent className="px-4 pb-4 pt-1 space-y-3 text-xs">
                    {lead.notes && (
                      <p className="text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border text-[11px] line-clamp-2">
                        {lead.notes}
                      </p>
                    )}

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Owner: <strong className="text-slate-700">{lead.assignedToName}</strong></span>
                      <span>{lead.budgetRange}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t">
                      <Select
                        value={lead.status}
                        onValueChange={(val: LeadStatus) => handleUpdateStatus(lead.id, val)}
                      >
                        <SelectTrigger className="text-[11px] h-7.5 flex-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {STAGES.map((s) => (
                            <SelectItem key={s.key} value={s.key} className="text-xs">
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      {lead.status !== "converted" ? (
                        <Button
                          size="sm"
                          className="h-7.5 text-xs bg-emerald-700 hover:bg-emerald-800 text-white font-semibold gap-1 px-2.5"
                          onClick={() => handleConvertToCustomer(lead)}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Convert
                        </Button>
                      ) : (
                        <Badge className="bg-emerald-100 text-emerald-800 text-[10px] font-bold h-7.5 px-2 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Converted
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="col-span-full py-16 text-center text-xs text-slate-400 border border-dashed rounded-xl bg-slate-50">
              <Users className="h-6 w-6 mx-auto mb-1.5 text-slate-300" />
              <p className="font-semibold text-slate-700">No prospects in this filter</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
