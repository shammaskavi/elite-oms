import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Ruler,
  CheckCircle2,
  Sparkles,
  Plus,
  Trash2,
  Scissors,
  Bookmark,
  FileSpreadsheet,
  AlertCircle,
  Copy,
} from "lucide-react";
import { toast } from "sonner";

interface OrderMeasurementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderMetadata: any;
  productNumber: number;
  productName: string;
  customerId?: string;
  customerName?: string;
  currentMeasurement?: {
    measurement_id?: string;
    template_name?: string;
    profile_name?: string;
    values?: Record<string, any>;
    notes?: string;
    attached_at?: string;
  };
  onSaveSuccess?: () => void;
}

// Standard fallback fields for Indian boutique garments if not defined in database
const FALLBACK_GARMENT_FIELDS: Record<string, Array<{ key: string; label: string; unit: string }>> = {
  Blouse: [
    { key: "bust", label: "Bust / Chest", unit: "in" },
    { key: "waist", label: "Underbust / Waist", unit: "in" },
    { key: "length", label: "Blouse Length", unit: "in" },
    { key: "shoulder", label: "Shoulder", unit: "in" },
    { key: "armhole", label: "Armhole", unit: "in" },
    { key: "sleeve_length", label: "Sleeve Length", unit: "in" },
    { key: "sleeve_round", label: "Sleeve Round / Bicep", unit: "in" },
    { key: "front_neck", label: "Front Neck Depth", unit: "in" },
    { key: "back_neck", label: "Back Neck Depth", unit: "in" },
    { key: "cross_front", label: "Cross Front", unit: "in" },
    { key: "cross_back", label: "Cross Back", unit: "in" },
    { key: "cup_point", label: "Apex / Cup Point", unit: "in" },
  ],
  Lehenga: [
    { key: "waist", label: "Lehenga Waist", unit: "in" },
    { key: "hip", label: "Hip", unit: "in" },
    { key: "length", label: "Lehenga Length", unit: "in" },
    { key: "flare", label: "Flare / Ghera", unit: "m" },
    { key: "cancan", label: "Cancan Layers", unit: "" },
  ],
  Kurti: [
    { key: "bust", label: "Bust", unit: "in" },
    { key: "waist", label: "Waist", unit: "in" },
    { key: "hip", label: "Hip", unit: "in" },
    { key: "length", label: "Kurti Length", unit: "in" },
    { key: "shoulder", label: "Shoulder", unit: "in" },
    { key: "sleeve_length", label: "Sleeve Length", unit: "in" },
    { key: "slit_opening", label: "Side Slit Opening", unit: "in" },
  ],
  Salwar: [
    { key: "waist", label: "Salwar Waist", unit: "in" },
    { key: "hip", label: "Hip", unit: "in" },
    { key: "length", label: "Salwar Length", unit: "in" },
    { key: "bottom_opening", label: "Mori / Bottom Opening", unit: "in" },
    { key: "thigh", label: "Thigh Round", unit: "in" },
  ],
  Gown: [
    { key: "bust", label: "Bust", unit: "in" },
    { key: "waist", label: "Waist", unit: "in" },
    { key: "hip", label: "Hip", unit: "in" },
    { key: "shoulder_to_waist", label: "Shoulder to Waist", unit: "in" },
    { key: "full_length", label: "Full Length (Heels Included)", unit: "in" },
    { key: "shoulder", label: "Shoulder", unit: "in" },
    { key: "sleeve_length", label: "Sleeve Length", unit: "in" },
  ],
};

export default function OrderMeasurementModal({
  open,
  onOpenChange,
  orderId,
  orderMetadata,
  productNumber,
  productName,
  customerId,
  customerName,
  currentMeasurement,
  onSaveSuccess,
}: OrderMeasurementModalProps) {
  const queryClient = useQueryClient();

  // Tab: 'saved' (pick from customer history) or 'new' (enter/customize numbers)
  const [activeTab, setActiveTab] = useState<"saved" | "custom">("saved");

  // State for selected saved profile
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");

  // State for custom/editable template
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [selectedTemplateName, setSelectedTemplateName] = useState<string>("Blouse");
  const [customProfileName, setCustomProfileName] = useState<string>("");
  const [formValues, setFormValues] = useState<Record<string, any>>({});
  const [measurementNotes, setMeasurementNotes] = useState<string>("");
  const [saveToCustomerProfile, setSaveToCustomerProfile] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // 1. Fetch existing saved measurement profiles for this customer
  const { data: customerMeasurements = [], isLoading: isLoadingCustomerMeasurements } = useQuery({
    queryKey: ["customer-measurements-for-order", customerId],
    queryFn: async () => {
      if (!customerId) return [];
      const { data, error } = await supabase
        .from("customer_measurements")
        .select(`
          id,
          name,
          template_id,
          values,
          status,
          created_at,
          measurement_templates(id, name)
        `)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((m: any) => ({
        ...m,
        template_name: m.measurement_templates?.name || "Garment",
      }));
    },
    enabled: !!customerId && open,
  });

  // 2. Fetch all measurement templates from DB
  const { data: dbTemplates = [] } = useQuery({
    queryKey: ["measurement-templates-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurement_templates")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: open,
  });

  // 3. Fetch measurement fields if template is selected
  const { data: dbFields = [] } = useQuery({
    queryKey: ["measurement-fields-for-template", selectedTemplateId],
    queryFn: async () => {
      if (!selectedTemplateId) return [];
      const { data, error } = await supabase
        .from("measurement_fields")
        .select("*")
        .eq("template_id", selectedTemplateId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedTemplateId && open,
  });

  // Determine active fields (DB fields or fallback fields)
  const activeFields = useMemo(() => {
    if (dbFields.length > 0) {
      return dbFields.map((f: any) => ({
        key: f.field_key,
        label: f.label || f.field_name || f.field_key,
        unit: f.unit || "in",
      }));
    }

    const fallback = FALLBACK_GARMENT_FIELDS[selectedTemplateName] || FALLBACK_GARMENT_FIELDS["Blouse"];
    return fallback;
  }, [dbFields, selectedTemplateName]);

  // Hydrate form when opening or currentMeasurement changes
  useEffect(() => {
    if (!open) return;

    if (currentMeasurement) {
      setSelectedProfileId(currentMeasurement.measurement_id || "");
      setSelectedTemplateName(currentMeasurement.template_name || "Blouse");
      setCustomProfileName(currentMeasurement.profile_name || "");
      setFormValues(currentMeasurement.values || {});
      setMeasurementNotes(currentMeasurement.notes || "");

      // If existing measurement matches one of customer's saved, default to 'saved'
      if (currentMeasurement.measurement_id) {
        setActiveTab("saved");
      } else {
        setActiveTab("custom");
      }
    } else {
      // Intelligent guessing based on item name (e.g. if item is "Bridal Blouse", auto-select Blouse)
      const lower = (productName || "").toLowerCase();
      let guess = "Blouse";
      if (lower.includes("lehenga") || lower.includes("skirt")) guess = "Lehenga";
      else if (lower.includes("kurti") || lower.includes("tunic")) guess = "Kurti";
      else if (lower.includes("salwar") || lower.includes("pant") || lower.includes("trouser")) guess = "Salwar";
      else if (lower.includes("gown") || lower.includes("dress")) guess = "Gown";

      setSelectedTemplateName(guess);
      setSelectedProfileId("");
      setFormValues({});
      setMeasurementNotes("");
      setActiveTab(customerMeasurements.length > 0 ? "saved" : "custom");
    }
  }, [open, currentMeasurement, productName, customerMeasurements.length]);

  // When picking a saved profile from list
  const handleSelectSavedProfile = (profile: any) => {
    setSelectedProfileId(profile.id);
    setSelectedTemplateName(profile.template_name || "Garment");
    setCustomProfileName(profile.name || profile.template_name || "Saved Profile");
    setFormValues(profile.values || {});
  };

  // Handle Save Attachment
  const handleSave = async () => {
    setIsSaving(true);
    try {
      let finalValues = { ...formValues };
      let finalTemplateName = selectedTemplateName;
      let finalProfileName = customProfileName;
      let finalMeasurementId: string | null = selectedProfileId || null;

      if (activeTab === "saved") {
        const profile = customerMeasurements.find((m: any) => m.id === selectedProfileId);
        if (!profile) {
          toast.error("Please select a saved measurement profile");
          setIsSaving(false);
          return;
        }
        finalValues = profile.values || {};
        finalTemplateName = profile.template_name || "Garment";
        finalProfileName = profile.name || profile.template_name;
        finalMeasurementId = profile.id;
      } else {
        // Custom values mode
        if (Object.keys(finalValues).length === 0) {
          toast.error("Please fill in at least one measurement value");
          setIsSaving(false);
          return;
        }

        // Optionally save to customer's permanent record in customer_measurements
        if (saveToCustomerProfile && customerId) {
          try {
            const { data: inserted, error: insertErr } = await supabase
              .from("customer_measurements")
              .insert({
                customer_id: customerId,
                template_id: selectedTemplateId || null,
                name: finalProfileName || `${finalTemplateName} (${productName})`,
                values: finalValues,
                status: "verified",
                source: "order_attachment",
              })
              .select()
              .single();

            if (!insertErr && inserted) {
              finalMeasurementId = inserted.id;
            }
          } catch (e) {
            console.warn("Could not save to customer profile table:", e);
          }
        }
      }

      // Update orders table metadata.product_measurements
      const currentMeasurements = orderMetadata?.product_measurements || {};
      const updatedMeasurements = {
        ...currentMeasurements,
        [productNumber]: {
          measurement_id: finalMeasurementId,
          template_name: finalTemplateName,
          profile_name: finalProfileName || finalTemplateName,
          values: finalValues,
          notes: measurementNotes.trim() || null,
          attached_at: new Date().toISOString(),
        },
      };

      const { error } = await (supabase as any)
        .from("orders")
        .update({
          metadata: {
            ...orderMetadata,
            product_measurements: updatedMeasurements,
          },
        })
        .eq("id", orderId);

      if (error) throw error;

      toast.success(`Measurements attached to ${productName}! Visible to Karigars.`);
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["invoice-orders"] });
      queryClient.invalidateQueries({ queryKey: ["customer-orders"] });
      onSaveSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to attach measurements");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Detach / Remove
  const handleDetach = async () => {
    if (!confirm(`Are you sure you want to remove the attached measurements from ${productName}?`)) {
      return;
    }

    setIsSaving(true);
    try {
      const currentMeasurements = { ...(orderMetadata?.product_measurements || {}) };
      delete currentMeasurements[productNumber];

      const { error } = await (supabase as any)
        .from("orders")
        .update({
          metadata: {
            ...orderMetadata,
            product_measurements: currentMeasurements,
          },
        })
        .eq("id", orderId);

      if (error) throw error;

      toast.success("Measurements detached from item");
      queryClient.invalidateQueries({ queryKey: ["order", orderId] });
      queryClient.invalidateQueries({ queryKey: ["invoice-orders"] });
      onSaveSuccess?.();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to detach measurements");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-purple-100 text-purple-900 rounded-lg">
                <Ruler className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-slate-900">
                  Attach Garment Measurements • {productName}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  Customer: <span className="font-semibold text-slate-800">{customerName || "Customer"}</span> • Item #{productNumber}
                </DialogDescription>
              </div>
            </div>

            {currentMeasurement && (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] font-bold">
                ✓ Currently Attached
              </Badge>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Top Tab Switcher */}
          <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="saved" className="text-xs font-semibold gap-1.5">
                <Bookmark className="h-3.5 w-3.5" />
                Customer's Saved Profiles ({customerMeasurements.length})
              </TabsTrigger>
              <TabsTrigger value="custom" className="text-xs font-semibold gap-1.5">
                <Scissors className="h-3.5 w-3.5" />
                Enter / Customize Values
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Pick from Customer's Saved Measurement Profiles */}
            <TabsContent value="saved" className="space-y-3 pt-2">
              {isLoadingCustomerMeasurements ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading customer measurements…</div>
              ) : customerMeasurements.length === 0 ? (
                <div className="p-6 text-center rounded-xl bg-slate-50 border space-y-2">
                  <p className="text-xs font-medium text-slate-700">No saved measurements found for this customer</p>
                  <p className="text-[11px] text-slate-500">
                    Switch to the "Enter / Customize Values" tab to fill in measurements for this piece.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-8 text-purple-700 border-purple-200"
                    onClick={() => setActiveTab("custom")}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Enter Measurements for this Garment
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-slate-700">Select a Saved Profile:</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto p-1">
                    {customerMeasurements.map((m: any) => {
                      const isSelected = selectedProfileId === m.id;
                      const valCount = Object.keys(m.values || {}).length;
                      return (
                        <div
                          key={m.id}
                          onClick={() => handleSelectSavedProfile(m)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer space-y-1.5 ${
                            isSelected
                              ? "bg-purple-50 border-purple-400 ring-2 ring-purple-200 shadow-xs"
                              : "bg-white border-slate-200 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-xs text-slate-900 truncate">
                              {m.name || m.template_name}
                            </span>
                            <Badge variant="outline" className="text-[10px] bg-white font-medium">
                              {m.template_name}
                            </Badge>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>{valCount} measurements recorded</span>
                            {isSelected && <CheckCircle2 className="h-3.5 w-3.5 text-purple-700" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Preview Selected Values */}
                  {selectedProfileId && (
                    <div className="p-3.5 rounded-xl bg-slate-50 border space-y-2 mt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Ruler className="h-3.5 w-3.5 text-slate-600" />
                          Specs Preview for Workshop:
                        </span>
                        <Badge className="bg-purple-900 text-white text-[10px]">
                          {selectedTemplateName}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
                        {Object.entries(formValues).map(([key, val]) => (
                          <div key={key} className="p-2 bg-white rounded-lg border border-slate-200">
                            <span className="text-[10px] uppercase text-slate-400 block font-medium">
                              {key.replace(/_/g, " ")}
                            </span>
                            <span className="font-bold text-slate-900 text-sm">
                              {String(val)}"
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </TabsContent>

            {/* TAB 2: Custom / New Measurement Values */}
            <TabsContent value="custom" className="space-y-4 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Garment Type / Template</Label>
                  <select
                    value={selectedTemplateName}
                    onChange={(e) => {
                      const name = e.target.value;
                      setSelectedTemplateName(name);
                      const matchingDb = dbTemplates.find((t: any) => t.name.toLowerCase() === name.toLowerCase());
                      setSelectedTemplateId(matchingDb?.id || "");
                    }}
                    className="w-full h-9 rounded-md border border-input bg-white px-3 py-1 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                  >
                    <option value="Blouse">Blouse (Choli / Top)</option>
                    <option value="Lehenga">Lehenga (Skirt / Ghera)</option>
                    <option value="Kurti">Kurti / Kameez</option>
                    <option value="Salwar">Salwar / Pant</option>
                    <option value="Gown">Gown / Anarkali</option>
                    {dbTemplates.map((t: any) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-slate-700">Profile / Fitting Note (Optional)</Label>
                  <Input
                    className="text-xs h-9 bg-white"
                    placeholder="e.g. Wedding Deep Neck, Padded Fit"
                    value={customProfileName}
                    onChange={(e) => setCustomProfileName(e.target.value)}
                  />
                </div>
              </div>

              {/* Dynamic Measurement Grid */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {selectedTemplateName} Dimensions (Inches)
                  </Label>
                  <span className="text-[10px] text-slate-500">Visible directly to Karigar</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto p-1">
                  {activeFields.map((field) => (
                    <div key={field.key} className="space-y-1 bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <Label className="text-[11px] font-medium text-slate-700 block truncate">
                        {field.label} {field.unit && <span className="text-slate-400 text-[10px]">({field.unit})</span>}
                      </Label>
                      <Input
                        type="text"
                        placeholder="0.0"
                        className="h-8 text-xs bg-white font-mono font-bold"
                        value={formValues[field.key] || ""}
                        onChange={(e) =>
                          setFormValues({
                            ...formValues,
                            [field.key]: e.target.value,
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Save to customer profile checkbox */}
              {customerId && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-purple-50/50 border border-purple-100 text-xs text-purple-900">
                  <input
                    type="checkbox"
                    id="save_profile_chk"
                    checked={saveToCustomerProfile}
                    onChange={(e) => setSaveToCustomerProfile(e.target.checked)}
                    className="rounded border-purple-300 text-purple-900 focus:ring-purple-500"
                  />
                  <label htmlFor="save_profile_chk" className="cursor-pointer font-medium">
                    Save this measurement to {customerName}'s permanent profile for future orders
                  </label>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Artisan Notes */}
          <div className="space-y-1 pt-1">
            <Label className="text-xs font-semibold text-slate-700">Special Karigar / Cutting Notes (Optional)</Label>
            <Textarea
              rows={2}
              className="text-xs bg-white"
              placeholder="e.g. Leave 2-inch side margin for future alteration, padded cups required, princess cut…"
              value={measurementNotes}
              onChange={(e) => setMeasurementNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-2 border-t pt-3">
          <div>
            {currentMeasurement && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 gap-1"
                onClick={handleDetach}
                disabled={isSaving}
              >
                <Trash2 className="h-3.5 w-3.5" /> Detach Measurements
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-purple-900 hover:bg-purple-950 text-white text-xs font-semibold gap-1.5 shadow-sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {isSaving ? "Attaching…" : "Attach to Garment"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
