import { Sparkles, Heart, Gift, MessageSquare, Plus, Clock, Crown, AlertTriangle, Calendar, UserCheck, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CustomerCrmProfile, CustomerNote, CrmTask } from "@/services/crm/crmTypes";

interface Customer360OverviewTabProps {
  customer: any;
  profile: CustomerCrmProfile;
  notes: CustomerNote[];
  tasks: CrmTask[];
  onOpenTab: (tabKey: string) => void;
  onOpenWhatsAppTemplate?: (templateName: string) => void;
  onOpenCreateTask?: () => void;
}

export function Customer360OverviewTab({
  customer,
  profile,
  notes,
  tasks,
  onOpenTab,
  onOpenWhatsAppTemplate,
  onOpenCreateTask,
}: Customer360OverviewTabProps) {
  const pinnedNotes = notes.filter((n) => n.isPinned);
  const openTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");
  const nba = profile.nextBestAction;

  const formatDate = (dStr?: string | null) => {
    if (!dStr) return "Not provided";
    try {
      return new Date(dStr).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dStr;
    }
  };

  return (
    <div className="space-y-6">
      {/* ================= Next Best Action Recommendation Banner ================= */}
      {nba && (
        <Card className="border-amber-200 bg-gradient-to-r from-amber-50/80 via-orange-50/40 to-amber-50/80 shadow-sm">
          <CardContent className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-200 shrink-0 mt-0.5">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold uppercase tracking-wider">
                    Next Best Action
                  </Badge>
                  <h4 className="font-semibold text-slate-900 text-sm md:text-base">{nba.title}</h4>
                </div>
                <p className="text-xs md:text-sm text-slate-600">{nba.description}</p>
                <p className="text-[11px] text-amber-800 font-medium">💡 Reason: {nba.reason}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              {nba.suggestedTemplateName ? (
                <Button
                  size="sm"
                  className="bg-amber-600 hover:bg-amber-700 text-white font-medium text-xs shadow-sm gap-1.5"
                  onClick={() => {
                    onOpenTab("whatsapp");
                    if (onOpenWhatsAppTemplate && nba.suggestedTemplateName) {
                      onOpenWhatsAppTemplate(nba.suggestedTemplateName);
                    }
                  }}
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  {nba.suggestedAction}
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-white border-amber-300 text-amber-900 text-xs font-medium hover:bg-amber-100/50"
                  onClick={() => onOpenTab("tasks")}
                >
                  View Action
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================= 2-Column Grid ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Preferences & Notes */}
        <div className="lg:col-span-2 space-y-6">
          {/* Saree Preferences Summary Card */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Heart className="h-4 w-4 text-rose-500" />
                  Saree & Styling Preferences
                </CardTitle>
                <CardDescription className="text-xs">
                  Boutique clienteling taste profile & aesthetic criteria
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs font-medium"
                onClick={() => onOpenTab("preferences")}
              >
                Edit Preferences
              </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Preferred Colours */}
                <div className="p-3 rounded-lg bg-slate-50 border space-y-1.5">
                  <span className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
                    Favourite Colours
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {profile.preferences.colours.length > 0 ? (
                      profile.preferences.colours.map((c) => (
                        <Badge key={c} variant="secondary" className="bg-white text-slate-800 border text-[11px]">
                          {c}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">No colours specified</span>
                    )}
                  </div>
                </div>

                {/* Preferred Fabrics */}
                <div className="p-3 rounded-lg bg-slate-50 border space-y-1.5">
                  <span className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
                    Preferred Fabrics
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {profile.preferences.fabrics.length > 0 ? (
                      profile.preferences.fabrics.map((f) => (
                        <Badge key={f} variant="secondary" className="bg-white text-slate-800 border text-[11px]">
                          {f}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">No fabrics specified</span>
                    )}
                  </div>
                </div>

                {/* Weaves & Traditions */}
                <div className="p-3 rounded-lg bg-slate-50 border space-y-1.5">
                  <span className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
                    Weaving Traditions
                  </span>
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {profile.preferences.weaves.length > 0 ? (
                      profile.preferences.weaves.map((w) => (
                        <Badge key={w} variant="secondary" className="bg-white text-slate-800 border text-[11px]">
                          {w}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-slate-400 italic">None recorded</span>
                    )}
                  </div>
                </div>

                {/* Budget Range & Occasion */}
                <div className="p-3 rounded-lg bg-slate-50 border space-y-1.5">
                  <span className="font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
                    Budget & Occasions
                  </span>
                  <div className="space-y-1">
                    <p className="text-slate-800 font-medium">💰 {profile.preferences.budgetRange || "Flexible"}</p>
                    <p className="text-slate-600 truncate">
                      🎉 {profile.preferences.occasions.join(", ") || "General"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Styling Notes */}
              {profile.preferences.stylingNotes && (
                <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-100 text-xs text-slate-700">
                  <p className="font-semibold text-amber-900 text-[11px] uppercase tracking-wider mb-0.5">
                    Boutique Styling Notes:
                  </p>
                  <p className="italic">{profile.preferences.stylingNotes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pinned Clienteling Notes Card */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  Pinned Relationship Notes
                </CardTitle>
                <CardDescription className="text-xs">
                  Important nuances staff must remember during interactions
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs font-medium text-purple-700 hover:text-purple-800 hover:bg-purple-50"
                onClick={() => onOpenTab("notes")}
              >
                View All ({notes.length})
              </Button>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {pinnedNotes.length > 0 ? (
                pinnedNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-3.5 rounded-lg border border-purple-100 bg-purple-50/40 space-y-2 text-xs"
                  >
                    <p className="text-slate-800 font-medium leading-relaxed">{note.note}</p>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-purple-100">
                      <span>By {note.authorName}</span>
                      <span>{new Date(note.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-6 text-center text-xs text-slate-500 border border-dashed rounded-lg bg-slate-50">
                  <p>No pinned notes yet.</p>
                  <Button
                    variant="link"
                    size="sm"
                    className="text-xs text-purple-700 h-auto p-0 mt-1"
                    onClick={() => onOpenTab("notes")}
                  >
                    Add a client note
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right 1 Col: Relationship Owner, Important Dates & Open Tasks */}
        <div className="space-y-6">
          {/* Relationship & Tier Card */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Crown className="h-4 w-4 text-purple-600" />
                Relationship Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b">
                <span className="text-slate-500">Tier Status</span>
                <Badge
                  className={`text-[11px] px-2 py-0.5 font-bold uppercase ${
                    profile.eliteCircleLevel === "Elite Privé"
                      ? "bg-purple-700 text-white"
                      : profile.eliteCircleLevel === "Elite Preferred"
                      ? "bg-purple-100 text-purple-800 border-purple-300"
                      : "bg-slate-100 text-slate-700"
                  }`}
                >
                  {profile.eliteCircleLevel}
                </Badge>
              </div>

              <div className="flex items-center justify-between py-1 border-b">
                <span className="text-slate-500">Lifecycle</span>
                <Badge variant="outline" className="text-xs bg-slate-50 font-medium">
                  {profile.lifecycleStatus}
                </Badge>
              </div>

              <div className="flex items-center justify-between py-1 border-b">
                <span className="text-slate-500">Relationship Owner</span>
                <span className="font-semibold text-slate-800">{profile.relationshipOwnerName}</span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500">Preferred Contact</span>
                <span className="font-medium text-slate-800 capitalize">
                  {profile.preferences.preferredContactChannel || "WhatsApp"}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Important Dates */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-rose-500" />
                Important Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="p-2.5 rounded-lg bg-slate-50 border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gift className="h-4 w-4 text-rose-500" />
                  <span className="font-medium text-slate-700">Birthday</span>
                </div>
                <span className="font-semibold text-slate-900">{formatDate(customer?.dob)}</span>
              </div>

              <div className="p-2.5 rounded-lg bg-slate-50 border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-pink-500" />
                  <span className="font-medium text-slate-700">Anniversary</span>
                </div>
                <span className="font-semibold text-slate-900">{formatDate(customer?.anniversary)}</span>
              </div>
            </CardContent>
          </Card>

          {/* Active Tasks Widget */}
          <Card className="border shadow-xs">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                Pending Follow-ups ({openTasks.length})
              </CardTitle>
              {onOpenCreateTask && (
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onOpenCreateTask}>
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {openTasks.length > 0 ? (
                openTasks.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className="p-2.5 rounded-lg border bg-white hover:bg-slate-50/80 transition-colors space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-800 line-clamp-1">{t.title}</p>
                      <Badge
                        variant="outline"
                        className={`text-[9px] px-1 py-0 uppercase shrink-0 font-bold ${
                          t.priority === "urgent"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : t.priority === "high"
                            ? "bg-orange-50 text-orange-700 border-orange-200"
                            : "bg-slate-50 text-slate-600"
                        }`}
                      >
                        {t.priority}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Assigned: {t.assignedToName}</span>
                      <span>Due: {new Date(t.dueAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-4 text-center text-slate-400">
                  <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-emerald-500 opacity-80" />
                  <p>No pending follow-ups</p>
                </div>
              )}

              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8 mt-2"
                onClick={() => onOpenTab("tasks")}
              >
                Manage Tasks & Reminders
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
