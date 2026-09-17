import { useState, useEffect } from "react";
import {
  Send,
  Sparkles,
  ExternalLink,
  CheckCheck,
  Check,
  Clock,
  AlertCircle,
  FileText,
  Heart,
  MessageSquare,
  Lock,
  Zap,
  MapPin,
  CreditCard,
  Truck,
  Scissors,
  Image as ImageIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { openWhatsApp, normalizeWhatsAppPhone } from "@/lib/whatsapp";
import { WhatsAppMessage, WhatsAppTemplate, SareePreferences, CannedResponse } from "@/services/crm/crmTypes";
import { crmService } from "@/services/crm/crmService";

interface CustomerWhatsAppTabProps {
  customerId: string;
  customerName: string;
  customerPhone?: string | null;
  preferences: SareePreferences;
  outstandingBalance?: number;
  selectedTemplateName?: string;
}

export function CustomerWhatsAppTab({
  customerId,
  customerName,
  customerPhone,
  preferences,
  outstandingBalance = 0,
  selectedTemplateName,
}: CustomerWhatsAppTabProps) {
  const conversationId = `conv_${customerId}`;
  const [messages, setMessages] = useState<WhatsAppMessage[]>(() =>
    crmService.getWhatsAppMessages(conversationId)
  );

  const templates = crmService.getWhatsAppTemplates();
  const cannedResponses = crmService.getCannedResponses();

  // Mode: customer message vs internal team note
  const [composerMode, setComposerMode] = useState<"whatsapp" | "internal_note">("whatsapp");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [composerText, setComposerText] = useState("");
  const [sending, setSending] = useState(false);

  // Meta 24-hour customer service window status
  // If last inbound message was within 24h, window is active
  const is24hWindowActive = true; // In live, derived from Date.now() - lastInboundAt < 24h

  // If a template name was requested from Next Best Action, auto-populate
  useEffect(() => {
    if (selectedTemplateName) {
      const match = templates.find(
        (t) => t.name.toLowerCase() === selectedTemplateName.toLowerCase()
      );
      if (match) {
        setSelectedTemplateId(match.id);
        populateTemplateText(match);
      }
    }
  }, [selectedTemplateName]);

  const populateTemplateText = (tpl: WhatsAppTemplate) => {
    let populated = tpl.bodyTemplate;
    populated = populated.replace(/\{\{customer_name\}\}/g, customerName || "Customer");
    populated = populated.replace(/\{\{collection_name\}\}/g, "Royal Kanjeevaram Silk");
    populated = populated.replace(
      /\{\{fabric\}\}/g,
      preferences.fabrics[0] || "Pure Kanjeevaram Silk"
    );
    populated = populated.replace(/\{\{tier\}\}/g, "Elite Preferred");
    populated = populated.replace(
      /\{\{amount\}\}/g,
      outstandingBalance > 0 ? outstandingBalance.toLocaleString("en-IN") : "0"
    );
    populated = populated.replace(/\{\{invoice_number\}\}/g, "INV-1042");
    populated = populated.replace(/\{\{item_name\}\}/g, "Bridal Silk Saree");
    populated = populated.replace(
      /\{\{balance\}\}/g,
      outstandingBalance > 0 ? `₹${outstandingBalance.toLocaleString("en-IN")}` : "Paid in full"
    );

    setComposerText(populated);
  };

  const handleTemplateChange = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const match = templates.find((t) => t.id === tplId);
    if (match) {
      populateTemplateText(match);
    }
  };

  const handleInsertCannedResponse = (canned: CannedResponse) => {
    setComposerText((prev) => (prev ? `${prev}\n\n${canned.content}` : canned.content));
    toast.success(`Inserted ${canned.title}`);
  };

  const handleSend = () => {
    if (!composerText.trim()) {
      toast.error("Please enter text before submitting");
      return;
    }

    setSending(true);
    try {
      if (composerMode === "internal_note") {
        crmService.addInternalNote(
          conversationId,
          composerText.trim(),
          "Ananya (Staff)",
          customerId
        );
        toast.success("Internal note added to conversation history");
      } else {
        crmService.sendMessage(
          conversationId,
          composerText.trim(),
          "Ananya (Staff)",
          customerId
        );
        toast.success("Message dispatched via Official Meta Cloud API");
      }

      setMessages(crmService.getWhatsAppMessages(conversationId));
      setComposerText("");
      setSelectedTemplateId("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleOpenWhatsAppDirect = () => {
    if (!customerPhone) {
      toast.error("Customer phone number is missing");
      return;
    }

    try {
      openWhatsApp(customerPhone, composerText || `Hello ${customerName || ""} ✨`);
      toast.success("Opened in WhatsApp Web / App");
    } catch (err: any) {
      toast.error(err?.message || "Failed to launch WhatsApp");
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ================= Left 2 Cols: Chat History & Composer ================= */}
        <div className="lg:col-span-2 space-y-4">
          {/* Conversation Stream */}
          <Card className="border shadow-xs bg-slate-50/40">
            <CardHeader className="py-3 px-4 border-b bg-white flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-800 font-bold text-xs">
                  {customerName ? customerName[0] : "C"}
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-slate-900">{customerName}</h4>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {customerPhone ? `+${normalizeWhatsAppPhone(customerPhone) || customerPhone}` : "No phone registered"}
                  </p>
                </div>
              </div>

              {/* 24-hour Session Window Indicator from wacrm */}
              <div className="flex items-center gap-2">
                {is24hWindowActive ? (
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-bold gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    24h Session Active (Freeform text allowed)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] font-bold gap-1">
                    <Clock className="h-3 w-3 text-amber-600" />
                    24h Expired (Meta Template Required)
                  </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
              {messages.length > 0 ? (
                messages.map((m) => {
                  const isInternal = m.isInternalNote || m.messageType === "internal_note";
                  const isOutbound = m.direction === "outbound";

                  // Render Internal Note differently (wacrm pattern: yellow/amber box)
                  if (isInternal) {
                    return (
                      <div key={m.id} className="flex justify-center my-1.5">
                        <div className="max-w-[90%] rounded-xl bg-amber-50/90 border border-amber-200 p-2.5 shadow-2xs space-y-1 text-xs">
                          <div className="flex items-center justify-between gap-3 text-[10px] font-bold text-amber-900 uppercase">
                            <span className="flex items-center gap-1">
                              <Lock className="h-3 w-3 text-amber-700" /> Internal Staff Note ({m.sentByName || "Staff"})
                            </span>
                            <span className="font-mono font-normal text-amber-700">
                              {new Date(m.timestamp).toLocaleTimeString("en-IN", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-slate-800 font-normal leading-relaxed">{m.content}</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={m.id}
                      className={`flex flex-col ${isOutbound ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-2xs whitespace-pre-wrap leading-relaxed ${
                          isOutbound
                            ? "bg-emerald-700 text-white rounded-tr-xs"
                            : "bg-white text-slate-800 border border-slate-200 rounded-tl-xs"
                        }`}
                      >
                        {m.templateName && (
                          <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider mb-1 border-b border-emerald-600 pb-0.5">
                            📋 {m.templateName}
                          </p>
                        )}
                        <p>{m.content}</p>
                      </div>

                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-1 px-1">
                        {isOutbound && m.sentByName && <span>{m.sentByName} • </span>}
                        <span>
                          {new Date(m.timestamp).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        {isOutbound && (
                          <span>
                            {m.status === "read" ? (
                              <CheckCheck className="h-3 w-3 text-blue-500 inline" />
                            ) : m.status === "delivered" ? (
                              <CheckCheck className="h-3 w-3 text-slate-400 inline" />
                            ) : (
                              <Check className="h-3 w-3 text-slate-400 inline" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="py-12 text-center text-xs text-slate-400">
                  <MessageSquare className="h-6 w-6 mx-auto mb-1 text-slate-300" />
                  <p>No messages recorded for this customer yet.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Canned Responses Bar (Borrowed from wacrm) */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Zap className="h-3 w-3 text-amber-500" /> Quick Boutique Canned Responses:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {cannedResponses.map((c) => (
                <button
                  type="button"
                  key={c.id}
                  onClick={() => handleInsertCannedResponse(c)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer border border-slate-200"
                >
                  {c.category === "location" && <MapPin className="h-3 w-3 text-rose-500" />}
                  {c.category === "payments" && <CreditCard className="h-3 w-3 text-blue-500" />}
                  {c.category === "shipping" && <Truck className="h-3 w-3 text-amber-500" />}
                  {c.category === "alterations" && <Scissors className="h-3 w-3 text-purple-500" />}
                  <span>{c.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Message / Internal Note Composer Card */}
          <Card className={`border shadow-xs ${composerMode === "internal_note" ? "bg-amber-50/30 border-amber-200" : ""}`}>
            <CardHeader className="pb-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                {/* Composer Mode Toggle (wacrm pattern) */}
                <div className="flex rounded-lg border bg-slate-100 p-0.5 text-xs font-medium w-fit">
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                      composerMode === "whatsapp" ? "bg-white text-emerald-800 shadow-2xs font-semibold" : "text-slate-600"
                    }`}
                    onClick={() => setComposerMode("whatsapp")}
                  >
                    <MessageSquare className="h-3.5 w-3.5" /> WhatsApp Message
                  </button>
                  <button
                    type="button"
                    className={`px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                      composerMode === "internal_note" ? "bg-amber-500 text-white shadow-2xs font-semibold" : "text-slate-600"
                    }`}
                    onClick={() => setComposerMode("internal_note")}
                  >
                    <Lock className="h-3.5 w-3.5" /> Internal Staff Note
                  </button>
                </div>

                {/* Template picker (if in WhatsApp mode) */}
                {composerMode === "whatsapp" && (
                  <div className="w-56">
                    <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                      <SelectTrigger className="text-xs h-7.5">
                        <SelectValue placeholder="Select Meta template…" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((tpl) => (
                          <SelectItem key={tpl.id} value={tpl.id} className="text-xs">
                            {tpl.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              <Textarea
                placeholder={
                  composerMode === "internal_note"
                    ? "Add an internal note visible only to your team (e.g. customer wants trial at 5 PM on Saturday)…"
                    : "Type message to customer or choose an approved Meta template above…"
                }
                rows={3}
                className={`text-xs resize-none ${composerMode === "internal_note" ? "bg-white border-amber-200" : ""}`}
                value={composerText}
                onChange={(e) => setComposerText(e.target.value)}
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <p className="text-[11px] text-slate-400">
                  {composerMode === "internal_note"
                    ? "🔒 Visible internally only. Customer cannot see this."
                    : "💡 Staff can edit variables before sending."}
                </p>

                <div className="flex items-center gap-2">
                  {composerMode === "whatsapp" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-8 gap-1.5 text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                      onClick={handleOpenWhatsAppDirect}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open wa.me
                    </Button>
                  )}

                  <Button
                    type="button"
                    size="sm"
                    className={`text-xs font-semibold h-8 gap-1.5 shadow-sm text-white ${
                      composerMode === "internal_note"
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-emerald-700 hover:bg-emerald-800"
                    }`}
                    onClick={handleSend}
                    disabled={sending || !composerText.trim()}
                  >
                    {composerMode === "internal_note" ? (
                      <>
                        <Lock className="h-3.5 w-3.5" /> Save Internal Note
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" /> {sending ? "Sending…" : "Send via Cloud API"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ================= Right 1 Col: Customer Context Drawer ================= */}
        <div className="space-y-4">
          <Card className="border shadow-xs bg-slate-50/60">
            <CardHeader className="pb-2.5">
              <CardTitle className="text-xs font-semibold flex items-center gap-2 text-slate-800">
                <Heart className="h-3.5 w-3.5 text-rose-500" />
                Live Customer Context
              </CardTitle>
              <CardDescription className="text-[11px]">
                Essential styling criteria while speaking with client
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <div className="p-2.5 rounded-lg bg-white border space-y-1">
                <span className="font-semibold text-slate-500 text-[10px] uppercase">
                  Top Saree Colours:
                </span>
                <p className="font-medium text-slate-900">
                  {preferences.colours.slice(0, 3).join(", ") || "Not set"}
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-white border space-y-1">
                <span className="font-semibold text-slate-500 text-[10px] uppercase">
                  Preferred Fabrics:
                </span>
                <p className="font-medium text-slate-900">
                  {preferences.fabrics.slice(0, 2).join(", ") || "Not set"}
                </p>
              </div>

              <div className="p-2.5 rounded-lg bg-white border space-y-1">
                <span className="font-semibold text-slate-500 text-[10px] uppercase">
                  Budget Envelope:
                </span>
                <p className="font-medium text-slate-900">{preferences.budgetRange || "Flexible"}</p>
              </div>

              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 space-y-1">
                <span className="font-semibold text-amber-800 text-[10px] uppercase">
                  Outstanding Balance:
                </span>
                <p className="font-bold text-amber-950">
                  {outstandingBalance > 0
                    ? `₹${outstandingBalance.toLocaleString("en-IN")}`
                    : "No pending balance ✅"}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
