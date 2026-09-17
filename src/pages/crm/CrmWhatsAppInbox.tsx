import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  MessageSquare,
  Search,
  Send,
  ExternalLink,
  CheckCheck,
  Check,
  Clock,
  Sparkles,
  Crown,
  User,
  Phone,
  ArrowRight,
  Lock,
  Zap,
  MapPin,
  CreditCard,
  Truck,
  Scissors,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { crmService } from "@/services/crm/crmService";
import { WhatsAppConversation, WhatsAppMessage, WhatsAppTemplate, CannedResponse } from "@/services/crm/crmTypes";
import { openWhatsApp, normalizeWhatsAppPhone } from "@/lib/whatsapp";
import { CrmSubNav } from "@/components/crm/CrmSubNav";
import { toast } from "sonner";

export default function CrmWhatsAppInbox() {
  useDocumentTitle("CRM • WhatsApp Inbox");

  const [conversations, setConversations] = useState<WhatsAppConversation[]>(() =>
    crmService.getWhatsAppConversations()
  );
  const [activeConversationId, setActiveConversationId] = useState<string>(() => {
    return conversations[0]?.id || "wa_conv_1";
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "unread" | "waiting_staff" | "open">("all");

  const activeConversation = conversations.find((c) => c.id === activeConversationId);
  const [messages, setMessages] = useState<WhatsAppMessage[]>(() => {
    return crmService.getWhatsAppMessages(activeConversationId);
  });

  const [templates, setTemplates] = useState<WhatsAppTemplate[]>(() => crmService.getWhatsAppTemplates());
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>(() => crmService.getCannedResponses());

  useEffect(() => {
    crmService.fetchWhatsAppConversationsFromSupabase().then((data) => {
      setConversations(data);
    });
    crmService.fetchWhatsAppTemplatesFromSupabase().then((tpls) => {
      if (tpls && tpls.length > 0) setTemplates(tpls);
    });
    crmService.fetchCannedResponsesFromSupabase().then((responses) => {
      if (responses && responses.length > 0) setCannedResponses(responses);
    });
  }, []);

  const [composerMode, setComposerMode] = useState<"whatsapp" | "internal_note">("whatsapp");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [composerText, setComposerText] = useState("");
  const [sending, setSending] = useState(false);

  const handleSelectConversation = (convoId: string) => {
    setActiveConversationId(convoId);
    setMessages(crmService.getWhatsAppMessages(convoId));
    setSelectedTemplateId("");
    setComposerText("");
  };

  const handleTemplateChange = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const match = templates.find((t) => t.id === tplId);
    if (match && activeConversation) {
      let populated = match.bodyTemplate;
      populated = populated.replace(/\{\{customer_name\}\}/g, activeConversation.customerName);
      populated = populated.replace(/\{\{collection_name\}\}/g, "Royal Kanjeevaram");
      populated = populated.replace(/\{\{fabric\}\}/g, "Pure Silk");
      populated = populated.replace(/\{\{tier\}\}/g, activeConversation.eliteCircleLevel || "Elite Member");
      populated = populated.replace(/\{\{amount\}\}/g, "12,500");
      populated = populated.replace(/\{\{invoice_number\}\}/g, "INV-1042");
      populated = populated.replace(/\{\{item_name\}\}/g, "Bridal Saree");
      populated = populated.replace(/\{\{balance\}\}/g, "Paid in full");
      setComposerText(populated);
    }
  };

  const handleInsertCanned = (canned: CannedResponse) => {
    setComposerText((prev) => (prev ? `${prev}\n\n${canned.content}` : canned.content));
    toast.success(`Inserted ${canned.title}`);
  };

  const handleSend = () => {
    if (!composerText.trim() || !activeConversation) {
      toast.error("Please enter text before sending");
      return;
    }

    setSending(true);
    try {
      if (composerMode === "internal_note") {
        crmService.addInternalNote(
          activeConversation.id,
          composerText.trim(),
          "Ananya (Staff)",
          activeConversation.customerId
        );
        toast.success("Internal note logged in chat");
      } else {
        crmService.sendMessage(
          activeConversation.id,
          composerText.trim(),
          "Ananya (Staff)",
          activeConversation.customerId
        );
        toast.success("Message dispatched via Official Meta Cloud API");
      }

      setMessages(crmService.getWhatsAppMessages(activeConversation.id));
      setConversations(crmService.getWhatsAppConversations());
      setComposerText("");
      setSelectedTemplateId("");
    } catch (err: any) {
      toast.error(err?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  };

  const handleOpenDirect = () => {
    if (!activeConversation?.customerPhone) {
      toast.error("Phone number missing");
      return;
    }
    try {
      openWhatsApp(activeConversation.customerPhone, composerText || "Hello ✨");
      toast.success("Opened in WhatsApp Web / App");
    } catch (err: any) {
      toast.error(err?.message || "Failed to open");
    }
  };

  const filteredConversations = useMemo(() => {
    return conversations.filter((c) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!c.customerName.toLowerCase().includes(q) && !c.customerPhone.includes(q)) {
          return false;
        }
      }
      if (filterTab === "unread") return c.unreadCount > 0;
      if (filterTab === "waiting_staff") return c.status === "waiting_staff";
      if (filterTab === "open") return c.status === "open";
      return true;
    });
  }, [conversations, searchQuery, filterTab]);

  return (
    <div className="space-y-4">
      {/* Consolidated CRM Sub Navigation */}
      <CrmSubNav />

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            WhatsApp Clienteling Inbox
          </h1>
          <p className="text-xs text-muted-foreground">
            Official Meta WhatsApp Business Cloud API shared multi-staff communication console
          </p>
        </div>

        <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-xs font-semibold gap-1.5 py-1 px-3 w-fit">
          <CheckCheck className="h-4 w-4 text-emerald-600" />
          Official Cloud API Connected
        </Badge>
      </div>

      {/* Main Inbox Window */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[750px] max-h-[84vh]">
        {/* ================= Left 4-5 Cols: Conversations List ================= */}
        <Card className="lg:col-span-5 flex flex-col border shadow-xs overflow-hidden">
          {/* Search & Filters */}
          <div className="p-3 border-b space-y-2.5 bg-slate-50/70">
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <Input
                placeholder="Search chats by name or phone…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-8.5 bg-white"
              />
            </div>

            <div className="flex rounded-lg border bg-white p-0.5 text-xs font-medium">
              <button
                type="button"
                className={`flex-1 py-1 text-center rounded-md transition-colors cursor-pointer ${
                  filterTab === "all" ? "bg-slate-900 text-white font-semibold" : "text-slate-600"
                }`}
                onClick={() => setFilterTab("all")}
              >
                All
              </button>
              <button
                type="button"
                className={`flex-1 py-1 text-center rounded-md transition-colors cursor-pointer ${
                  filterTab === "waiting_staff" ? "bg-emerald-700 text-white font-semibold" : "text-slate-600"
                }`}
                onClick={() => setFilterTab("waiting_staff")}
              >
                Waiting
              </button>
              <button
                type="button"
                className={`flex-1 py-1 text-center rounded-md transition-colors cursor-pointer ${
                  filterTab === "unread" ? "bg-emerald-700 text-white font-semibold" : "text-slate-600"
                }`}
                onClick={() => setFilterTab("unread")}
              >
                Unread
              </button>
            </div>
          </div>

          {/* Conversation items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
            {filteredConversations.length > 0 ? (
              filteredConversations.map((c) => {
                const isActive = c.id === activeConversationId;
                return (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => handleSelectConversation(c.id)}
                    className={`w-full text-left p-3 flex items-start gap-3 transition-colors cursor-pointer ${
                      isActive ? "bg-emerald-50/70 border-l-4 border-l-emerald-600" : "hover:bg-slate-50"
                    }`}
                  >
                    <div className="h-9 w-9 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0 border border-emerald-200">
                      {c.customerName[0]}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-semibold text-xs text-slate-900 truncate">
                          {c.customerName}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {new Date(c.lastMessageAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 line-clamp-1 italic">
                        {c.lastMessagePreview}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-slate-400 pt-0.5">
                        <span className="truncate">Assigned: {c.assignedToName || "Unassigned"}</span>
                        {c.unreadCount > 0 && (
                          <Badge className="bg-emerald-600 text-white text-[9px] h-4 px-1.5 font-bold">
                            {c.unreadCount} new
                          </Badge>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-8 text-center text-xs text-slate-400">
                <p>No conversations found.</p>
              </div>
            )}
          </div>
        </Card>

        {/* ================= Right 7-8 Cols: Active Chat & Composer ================= */}
        <Card className="lg:col-span-7 flex flex-col border shadow-xs overflow-hidden">
          {activeConversation ? (
            <>
              {/* Header with Quick 360 link and 24h Window Badge */}
              <div className="py-2.5 px-4 border-b bg-white flex items-center justify-between">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs flex items-center justify-center shrink-0">
                    {activeConversation.customerName[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-xs sm:text-sm text-slate-900 truncate">
                        {activeConversation.customerName}
                      </h3>
                      {activeConversation.eliteCircleLevel && (
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 uppercase bg-purple-50 text-purple-800 border-purple-200 font-bold">
                          {activeConversation.eliteCircleLevel}
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-mono">
                      +{normalizeWhatsAppPhone(activeConversation.customerPhone)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-[10px] font-bold">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                    24h Session Active
                  </Badge>

                  {activeConversation.customerId && (
                    <Link to={`/customers/${activeConversation.customerId}`}>
                      <Button variant="outline" size="sm" className="text-xs h-7.5 gap-1 text-slate-700">
                        Open 360 <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

              {/* Chat Stream with Internal Note formatting */}
              <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-slate-50/40">
                {messages.map((m) => {
                  const isInternal = m.isInternalNote || m.messageType === "internal_note";
                  const isOutbound = m.direction === "outbound";

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
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs shadow-2xs leading-relaxed whitespace-pre-wrap ${
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

                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 px-1">
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
                            ) : (
                              <Check className="h-3 w-3 text-slate-400 inline" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Quick Canned Responses Bar */}
              <div className="px-3 py-1.5 bg-slate-50 border-t flex flex-wrap gap-1.5 items-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
                  <Zap className="h-3 w-3 text-amber-500" /> Canned:
                </span>
                {cannedResponses.map((c) => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => handleInsertCanned(c)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-white hover:bg-slate-100 text-slate-700 transition-colors cursor-pointer border border-slate-200"
                  >
                    <span>{c.shortcut}</span>
                  </button>
                ))}
              </div>

              {/* Composer */}
              <div className={`p-3 border-t space-y-2.5 ${composerMode === "internal_note" ? "bg-amber-50/40" : "bg-white"}`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex rounded-lg border bg-slate-100 p-0.5 text-xs font-medium w-fit">
                    <button
                      type="button"
                      className={`px-2.5 py-0.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 text-xs ${
                        composerMode === "whatsapp" ? "bg-white text-emerald-800 shadow-2xs font-semibold" : "text-slate-600"
                      }`}
                      onClick={() => setComposerMode("whatsapp")}
                    >
                      <MessageSquare className="h-3 w-3" /> WhatsApp
                    </button>
                    <button
                      type="button"
                      className={`px-2.5 py-0.5 rounded-md transition-colors cursor-pointer flex items-center gap-1 text-xs ${
                        composerMode === "internal_note" ? "bg-amber-500 text-white shadow-2xs font-semibold" : "text-slate-600"
                      }`}
                      onClick={() => setComposerMode("internal_note")}
                    >
                      <Lock className="h-3 w-3" /> Team Note
                    </button>
                  </div>

                  {composerMode === "whatsapp" && (
                    <div className="w-52">
                      <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                        <SelectTrigger className="text-xs h-7">
                          <SelectValue placeholder="Meta template…" />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id} className="text-xs">
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                <Textarea
                  placeholder={
                    composerMode === "internal_note"
                      ? "Add internal team note…"
                      : "Type message or select template…"
                  }
                  value={composerText}
                  onChange={(e) => setComposerText(e.target.value)}
                  rows={2}
                  className="text-xs resize-none bg-white"
                />

                <div className="flex items-center justify-between">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7.5 text-emerald-800 hover:bg-emerald-50 gap-1"
                    onClick={handleOpenDirect}
                  >
                    <ExternalLink className="h-3 w-3" /> Direct wa.me
                  </Button>

                  <Button
                    size="sm"
                    className={`text-xs font-semibold h-7.5 gap-1.5 shadow-sm text-white ${
                      composerMode === "internal_note"
                        ? "bg-amber-600 hover:bg-amber-700"
                        : "bg-emerald-700 hover:bg-emerald-800"
                    }`}
                    onClick={handleSend}
                    disabled={sending || !composerText.trim()}
                  >
                    {composerMode === "internal_note" ? (
                      <>
                        <Lock className="h-3 w-3" /> Save Note
                      </>
                    ) : (
                      <>
                        <Send className="h-3 w-3" /> {sending ? "Sending…" : "Send Message"}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-xs text-slate-400">
              Select a conversation to start messaging
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
