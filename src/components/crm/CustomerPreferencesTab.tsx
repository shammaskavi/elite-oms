import { useState } from "react";
import { Check, Plus, Save, Sparkles, X, Heart, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { SareePreferences, ContactChannel } from "@/services/crm/crmTypes";
import { crmService } from "@/services/crm/crmService";

interface CustomerPreferencesTabProps {
  customerId: string;
  preferences: SareePreferences;
  onPreferencesUpdated: (newPrefs: SareePreferences) => void;
}

const PRESET_COLOURS = [
  "Royal Blue",
  "Rani Pink",
  "Deep Wine / Maroon",
  "Peacock Green",
  "Mustard Yellow",
  "Pastel Peach",
  "Lavender",
  "Ivory & Gold",
  "Emerald Green",
  "Crimson Red",
  "Teal Blue",
  "Dusty Rose",
];

const PRESET_FABRICS = [
  "Pure Kanjeevaram Silk",
  "Banarasi Katan Silk",
  "Pure Paithani Silk",
  "Organza Embroidery",
  "Pure Chiffon",
  "Georgette Handwork",
  "Tussar Handloom",
  "Raw Silk / Matka",
  "Linen Zari",
  "Chanderi Silk",
];

const PRESET_WEAVES = [
  "Zari Brocade",
  "Korvai Border",
  "Ikat / Patola",
  "Chikankari Handwork",
  "Bandhani / Bandhej",
  "Jamdani",
  "Temple Border",
  "Meenakari",
];

const PRESET_OCCASIONS = [
  "Bridal / Wedding",
  "Reception",
  "Engagement",
  "Sangeet / Mehendi",
  "Festive / Puja",
  "Cocktail / Evening",
  "Daily Luxury",
];

const BUDGET_OPTIONS = [
  "Under ₹15,000",
  "₹15,000 – ₹25,000",
  "₹25,000 – ₹50,000",
  "₹50,000 – ₹1,00,000",
  "₹1,00,000+",
  "Flexible / High Value",
];

export function CustomerPreferencesTab({
  customerId,
  preferences,
  onPreferencesUpdated,
}: CustomerPreferencesTabProps) {
  const [form, setForm] = useState<SareePreferences>({
    colours: preferences?.colours || [],
    fabrics: preferences?.fabrics || [],
    weaves: preferences?.weaves || [],
    occasions: preferences?.occasions || [],
    budgetRange: preferences?.budgetRange || "₹25,000 – ₹50,000",
    blousePreferences: preferences?.blousePreferences || "",
    stylingNotes: preferences?.stylingNotes || "",
    dislikedAttributes: preferences?.dislikedAttributes || "",
    preferredLanguage: preferences?.preferredLanguage || "Hindi / Gujarati",
    preferredContactChannel: preferences?.preferredContactChannel || "whatsapp",
  });

  const [customColour, setCustomColour] = useState("");
  const [customFabric, setCustomFabric] = useState("");
  const [customWeave, setCustomWeave] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleArrayItem = (key: "colours" | "fabrics" | "weaves" | "occasions", item: string) => {
    setForm((prev) => {
      const exists = prev[key].includes(item);
      const updated = exists ? prev[key].filter((i) => i !== item) : [...prev[key], item];
      return { ...prev, [key]: updated };
    });
  };

  const addCustomItem = (key: "colours" | "fabrics" | "weaves", value: string, clearInput: () => void) => {
    if (!value.trim()) return;
    setForm((prev) => {
      if (prev[key].includes(value.trim())) return prev;
      return { ...prev, [key]: [...prev[key], value.trim()] };
    });
    clearInput();
  };

  const handleSave = () => {
    setSaving(true);
    try {
      const saved = crmService.updatePreferences(customerId, form);
      onPreferencesUpdated(saved);
      toast.success("Saree styling preferences updated successfully");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header action */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Saree & Clienteling Preferences</h3>
          <p className="text-xs text-slate-500">
            Structured styling criteria to match new collections and craft personalized follow-ups
          </p>
        </div>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving}
          className="bg-primary hover:bg-primary/90 text-xs font-semibold gap-1.5 shadow-sm"
        >
          <Save className="h-4 w-4" />
          {saving ? "Saving…" : "Save Preferences"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ================= 1. Preferred Colours ================= */}
        <Card className="border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
              Preferred Palette & Colours
            </CardTitle>
            <CardDescription className="text-xs">
              Select colours the customer enjoys or wears often
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {PRESET_COLOURS.map((c) => {
                const isSelected = form.colours.includes(c);
                return (
                  <button
                    type="button"
                    key={c}
                    onClick={() => toggleArrayItem("colours", c)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-rose-50 border-rose-300 text-rose-800 font-semibold shadow-2xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-rose-600" />}
                    {c}
                  </button>
                );
              })}
            </div>

            {/* Custom Colour Input */}
            <div className="flex items-center gap-2 pt-1">
              <Input
                placeholder="Add custom shade (e.g. Muted Sage)"
                value={customColour}
                onChange={(e) => setCustomColour(e.target.value)}
                className="text-xs h-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomItem("colours", customColour, () => setCustomColour(""));
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs shrink-0"
                onClick={() => addCustomItem("colours", customColour, () => setCustomColour(""))}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ================= 2. Preferred Fabrics ================= */}
        <Card className="border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              Favoured Fabrics & Materials
            </CardTitle>
            <CardDescription className="text-xs">
              Handloom types and saree base fabrics
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {PRESET_FABRICS.map((f) => {
                const isSelected = form.fabrics.includes(f);
                return (
                  <button
                    type="button"
                    key={f}
                    onClick={() => toggleArrayItem("fabrics", f)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-blue-50 border-blue-300 text-blue-800 font-semibold shadow-2xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-blue-600" />}
                    {f}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Input
                placeholder="Add custom fabric (e.g. Mulberry Silk)"
                value={customFabric}
                onChange={(e) => setCustomFabric(e.target.value)}
                className="text-xs h-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomItem("fabrics", customFabric, () => setCustomFabric(""));
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs shrink-0"
                onClick={() => addCustomItem("fabrics", customFabric, () => setCustomFabric(""))}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ================= 3. Weaves & Traditions ================= */}
        <Card className="border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-purple-500" />
              Weaves & Craft Traditions
            </CardTitle>
            <CardDescription className="text-xs">
              Specialized weaving techniques, zari styles, and border types
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {PRESET_WEAVES.map((w) => {
                const isSelected = form.weaves.includes(w);
                return (
                  <button
                    type="button"
                    key={w}
                    onClick={() => toggleArrayItem("weaves", w)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-purple-50 border-purple-300 text-purple-800 font-semibold shadow-2xs"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {isSelected && <Check className="h-3 w-3 text-purple-600" />}
                    {w}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <Input
                placeholder="Add custom weave (e.g. Tissue Zari)"
                value={customWeave}
                onChange={(e) => setCustomWeave(e.target.value)}
                className="text-xs h-8"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomItem("weaves", customWeave, () => setCustomWeave(""));
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs shrink-0"
                onClick={() => addCustomItem("weaves", customWeave, () => setCustomWeave(""))}
              >
                <Plus className="h-3.5 w-3.5 mr-1" /> Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ================= 4. Occasions & Budget ================= */}
        <Card className="border shadow-xs">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              Occasions & Typical Budget Range
            </CardTitle>
            <CardDescription className="text-xs">
              Events for which the customer shops and spend envelope
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs text-slate-600">Shopping Occasions</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_OCCASIONS.map((o) => {
                  const isSelected = form.occasions.includes(o);
                  return (
                    <button
                      type="button"
                      key={o}
                      onClick={() => toggleArrayItem("occasions", o)}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all cursor-pointer ${
                        isSelected
                          ? "bg-amber-50 border-amber-300 text-amber-800 font-semibold shadow-2xs"
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      {isSelected && <Check className="h-3 w-3 text-amber-600" />}
                      {o}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-2 pt-1">
              <Label className="text-xs text-slate-600">Estimated Price Range per Outfit</Label>
              <Select
                value={form.budgetRange}
                onValueChange={(val) => setForm((prev) => ({ ...prev, budgetRange: val }))}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder="Select budget range" />
                </SelectTrigger>
                <SelectContent>
                  {BUDGET_OPTIONS.map((b) => (
                    <SelectItem key={b} value={b} className="text-xs">
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ================= 5. Styling Notes & Custom Nuances ================= */}
      <Card className="border shadow-xs">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-600" />
            Custom Styling & Tailoring Nuances
          </CardTitle>
          <CardDescription className="text-xs">
            Blouse cuts, zari preferences, length specifications, and communication channels
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Blouse & Border Preferences</Label>
              <Textarea
                placeholder="e.g. Prefers elbow sleeve blouses with heavy aari work; likes wide contrast borders."
                rows={3}
                className="text-xs resize-none"
                value={form.blousePreferences || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, blousePreferences: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Styling & Collection Notes</Label>
              <Textarea
                placeholder="e.g. Loves antique gold zari, avoids overly shiny synthetic shine; daughter likes matching mini-sarees."
                rows={3}
                className="text-xs resize-none"
                value={form.stylingNotes || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, stylingNotes: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-rose-700 flex items-center gap-1">
                <ShieldAlert className="h-3.5 w-3.5" /> Dislikes / What to Avoid
              </Label>
              <Input
                placeholder="e.g. No dark black or synthetic polyester"
                className="text-xs h-9"
                value={form.dislikedAttributes || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, dislikedAttributes: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Preferred Language</Label>
              <Input
                placeholder="e.g. Gujarati, Hindi, English"
                className="text-xs h-9"
                value={form.preferredLanguage || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, preferredLanguage: e.target.value }))}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-700">Preferred Outreach Channel</Label>
              <Select
                value={form.preferredContactChannel || "whatsapp"}
                onValueChange={(val: ContactChannel) =>
                  setForm((prev) => ({ ...prev, preferredContactChannel: val }))
                }
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp" className="text-xs">
                    💬 WhatsApp (Recommended)
                  </SelectItem>
                  <SelectItem value="phone" className="text-xs">
                    📞 Direct Phone Call
                  </SelectItem>
                  <SelectItem value="in_store" className="text-xs">
                    🛍️ In-store Only
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-xs font-semibold gap-1.5 shadow-sm"
            >
              <Save className="h-4 w-4" />
              {saving ? "Saving…" : "Save Preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
