import { supabase } from "@/integrations/supabase/client";
import {
  SareePreferences,
  CustomerNote,
  CrmTask,
  TimelineEvent,
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppTemplate,
  CannedResponse,
  CrmLead,
  CrmSegment,
  CrmCampaign,
  CustomerCrmProfile,
  NextBestAction,
  EliteCircleLevel,
  CustomerLifecycleStatus,
} from "./crmTypes";
import {
  loadCustomerPreferences,
  saveCustomerPreferences,
  loadCustomerMeta,
  saveCustomerMeta,
  loadCustomerNotes,
  addCustomerNote,
  togglePinNote,
  deleteCustomerNote,
  loadCustomerTasks,
  loadAllTasks,
  createCrmTask,
  updateCrmTaskStatus,
  loadCustomerTimeline,
  addTimelineEvent,
  loadWhatsAppConversations,
  loadWhatsAppMessages,
  sendWhatsAppMockMessage,
  addInternalNoteToConversation,
  loadCannedResponses,
  loadAllLeads,
  createCrmLead,
  updateCrmLeadStatus,
  loadAllWhatsAppTemplates,
  saveCustomWhatsAppTemplate,
  loadCrmCampaigns,
  saveCrmCampaign,
  updateCrmCampaign,
  DEFAULT_WHATSAPP_TEMPLATES,
  DEFAULT_SEGMENTS,
} from "./crmStorage";

export const crmService = {
  // -------------------------------------------------------------
  // Profile & Relationship 360
  // -------------------------------------------------------------
  getCrmProfile(customerId: string, customerData?: any): CustomerCrmProfile {
    const meta = loadCustomerMeta(customerId);
    const prefs = loadCustomerPreferences(customerId);
    const notes = loadCustomerNotes(customerId);
    const tasks = loadCustomerTasks(customerId);
    const openTasks = tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled");

    const nextAction = this.deriveNextBestAction(customerId, customerData, prefs, notes, tasks);

    return {
      id: customerId,
      lifecycleStatus: (customerData?.lifecycle_status as CustomerLifecycleStatus) || meta.lifecycleStatus,
      eliteCircleLevel: (customerData?.elite_circle_level as EliteCircleLevel) || meta.eliteCircleLevel,
      relationshipOwnerName: meta.relationshipOwnerName,
      preferences: prefs,
      nextBestAction: nextAction,
      notesCount: notes.length,
      tasksCount: tasks.length,
      openTasksCount: openTasks.length,
    };
  },

  updateCustomerMeta(
    customerId: string,
    meta: {
      lifecycleStatus?: CustomerLifecycleStatus;
      eliteCircleLevel?: EliteCircleLevel;
      relationshipOwnerName?: string;
    }
  ) {
    saveCustomerMeta(customerId, meta);

    // Sync to Supabase in background
    if (customerId) {
      const updatePayload: Record<string, any> = {};
      if (meta.lifecycleStatus) updatePayload.lifecycle_status = meta.lifecycleStatus;
      if (meta.eliteCircleLevel) updatePayload.elite_circle_level = meta.eliteCircleLevel;

      if (Object.keys(updatePayload).length > 0) {
        supabase
          .from("customers")
          .update(updatePayload)
          .eq("id", customerId)
          .then(({ error }) => {
            if (error) console.warn("Supabase customer meta sync note:", error.message);
          });
      }
    }
  },

  deriveNextBestAction(
    customerId: string,
    customerData?: any,
    prefs?: SareePreferences,
    notes?: CustomerNote[],
    tasks?: CrmTask[]
  ): NextBestAction {
    const preferences = prefs || loadCustomerPreferences(customerId);

    // Rule 1: Outstanding Balance Reminder
    const outstanding = customerData?.outstandingBalance || 0;
    if (outstanding > 0) {
      return {
        id: "nba_payment",
        type: "payment_reminder",
        title: "Payment Follow-up Due",
        description: `Customer has an outstanding balance of ₹${outstanding.toLocaleString("en-IN")}.`,
        reason: "Active balance pending for past orders/invoices.",
        suggestedAction: "Send WhatsApp Payment Reminder",
        suggestedTemplateName: "Payment Settle Reminder",
        urgency: "high",
      };
    }

    // Rule 2: Birthday / Anniversary coming up
    const dob = customerData?.dob;
    if (dob) {
      const bday = new Date(dob);
      const now = new Date();
      bday.setFullYear(now.getFullYear());
      const diffDays = Math.ceil((bday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays >= 0 && diffDays <= 7) {
        return {
          id: "nba_birthday",
          type: "birthday_greeting",
          title: `Birthday in ${diffDays === 0 ? "Today! 🎉" : `${diffDays} days 🌸`}`,
          description: "Cherished boutique customer with an upcoming birthday celebration.",
          reason: `Birthday recorded on ${new Date(dob).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}.`,
          suggestedAction: "Send Celebratory Wishes & Styling Privilege",
          suggestedTemplateName: "Birthday Wishes & Privilege",
          urgency: "high",
        };
      }
    }

    // Rule 3: Personalized Saree Preference Match (if preferences are recorded)
    const favColour = preferences?.colours?.[0];
    const favFabric = preferences?.fabrics?.[0];

    if (favColour || favFabric) {
      const label = [favColour, favFabric].filter(Boolean).join(" ");
      return {
        id: "nba_collection",
        type: "collection_preview",
        title: `Curate ${label} Preview`,
        description: `Customer prefers ${label}. Match boutique arrivals to this profile.`,
        reason: `Recorded preference: ${preferences.colours?.slice(0, 2).join(", ") || "Handloom"} in ${preferences.fabrics?.slice(0, 2).join(", ") || "Silk"}.`,
        suggestedAction: "Send Personalized Collection Preview",
        suggestedTemplateName: "New Collection Preview",
        urgency: "medium",
      };
    }

    // Default: Prompt staff to record styling nuances
    return {
      id: "nba_profile",
      type: "preference_collection",
      title: "Complete Saree & Styling Profile",
      description: "No styling preferences recorded yet for this boutique customer.",
      reason: "Recording favorite fabrics, weaves, and blouse nuances unlocks personalized recommendations.",
      suggestedAction: "Open Preferences Tab to Record Details",
      urgency: "low",
    };
  },

  // -------------------------------------------------------------
  // Saree Preferences
  // -------------------------------------------------------------
  getPreferences(customerId: string): SareePreferences {
    return loadCustomerPreferences(customerId);
  },

  async fetchPreferencesFromSupabase(customerId: string): Promise<SareePreferences | null> {
    try {
      const { data, error } = await supabase
        .from("customer_preferences")
        .select("*")
        .eq("customer_id", customerId)
        .maybeSingle();

      if (error || !data) return null;

      const prefs: SareePreferences = {
        colours: data.favorite_colors || [],
        fabrics: data.favorite_fabrics || [],
        weaves: data.favorite_weaves || [],
        occasions: data.favorite_occasions || [],
        dislikedColours: data.disliked_colors || [],
        budgetRange: data.budget_min && data.budget_max ? `₹${data.budget_min} - ₹${data.budget_max}` : "",
        budgetMin: Number(data.budget_min) || undefined,
        budgetMax: Number(data.budget_max) || undefined,
        preferredContactChannel: "whatsapp",
        blouseNeckPreference: data.blouse_neck_preference || "",
        blouseSleevePreference: data.blouse_sleeve_preference || "",
        blouseNotes: data.blouse_notes || "",
        generalNotes: data.general_notes || "",
        updatedAt: data.updated_at,
      };

      saveCustomerPreferences(customerId, prefs);
      return prefs;
    } catch (e) {
      return null;
    }
  },

  updatePreferences(customerId: string, prefs: SareePreferences): SareePreferences {
    saveCustomerPreferences(customerId, prefs);
    addTimelineEvent(customerId, {
      eventType: "preference_updated",
      title: "Saree Preferences Updated",
      description: `Colours: ${prefs.colours.slice(0, 3).join(", ") || "None"} • Fabrics: ${prefs.fabrics.slice(0, 2).join(", ") || "None"}`,
      authorName: "Staff",
      badgeVariant: "secondary",
    });

    // Background sync to Supabase customer_preferences
    if (customerId) {
      supabase
        .from("customer_preferences")
        .upsert({
          customer_id: customerId,
          favorite_fabrics: prefs.fabrics,
          favorite_colors: prefs.colours,
          favorite_weaves: prefs.weaves,
          favorite_occasions: prefs.occasions,
          disliked_colors: prefs.dislikedColours,
          budget_min: prefs.budgetMin || 0,
          budget_max: prefs.budgetMax || 0,
          blouse_neck_preference: prefs.blouseNeckPreference || null,
          blouse_sleeve_preference: prefs.blouseSleevePreference || null,
          blouse_notes: prefs.blouseNotes || null,
          general_notes: prefs.generalNotes || null,
          updated_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) console.warn("Supabase preference upsert note:", error.message);
        });
    }

    return prefs;
  },

  // -------------------------------------------------------------
  // Notes
  // -------------------------------------------------------------
  getNotes(customerId: string): CustomerNote[] {
    return loadCustomerNotes(customerId);
  },

  async fetchNotesFromSupabase(customerId: string): Promise<CustomerNote[]> {
    try {
      const { data, error } = await supabase
        .from("customer_notes")
        .select("*")
        .eq("customer_id", customerId)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error || !data) return loadCustomerNotes(customerId);

      return data.map((n) => ({
        id: n.id,
        customerId: n.customer_id,
        authorName: n.author_name,
        createdAt: n.created_at,
        content: n.content,
        pinned: n.pinned ?? false,
        tags: n.tags || [],
        noteType: (n.note_type as any) || "general",
      }));
    } catch {
      return loadCustomerNotes(customerId);
    }
  },

  addNote(
    customerId: string,
    note: string,
    authorName = "Staff",
    tags: string[] = [],
    isPinned = false
  ): CustomerNote {
    const saved = addCustomerNote(customerId, note, authorName, tags, isPinned);

    // Sync to Supabase
    if (customerId) {
      supabase
        .from("customer_notes")
        .insert({
          id: saved.id,
          customer_id: customerId,
          author_name: authorName,
          content: note,
          pinned: isPinned,
          tags: tags,
          note_type: "general",
        })
        .then(({ error }) => {
          if (error) console.warn("Supabase note insert note:", error.message);
        });
    }

    return saved;
  },

  togglePinNote(customerId: string, noteId: string): CustomerNote[] {
    const notes = togglePinNote(customerId, noteId);
    const target = notes.find((n) => n.id === noteId);
    if (target) {
      supabase
        .from("customer_notes")
        .update({ pinned: target.pinned })
        .eq("id", noteId)
        .then(({ error }) => {
          if (error) console.warn("Supabase note pin update note:", error.message);
        });
    }
    return notes;
  },

  deleteNote(customerId: string, noteId: string): CustomerNote[] {
    const notes = deleteCustomerNote(customerId, noteId);
    supabase
      .from("customer_notes")
      .delete()
      .eq("id", noteId)
      .then(({ error }) => {
        if (error) console.warn("Supabase note delete note:", error.message);
      });
    return notes;
  },

  // -------------------------------------------------------------
  // Tasks
  // -------------------------------------------------------------
  getCustomerTasks(customerId: string): CrmTask[] {
    return loadCustomerTasks(customerId);
  },

  getAllTasks(): CrmTask[] {
    return loadAllTasks();
  },

  async fetchAllTasksFromSupabase(): Promise<CrmTask[]> {
    try {
      const { data, error } = await supabase
        .from("crm_tasks")
        .select(`
          *,
          customers(name, phone)
        `)
        .order("due_at", { ascending: true });

      if (error || !data) return loadAllTasks();

      return data.map((t: any) => ({
        id: t.id,
        customerId: t.customer_id,
        customerName: t.customers?.name || "Boutique Customer",
        customerPhone: t.customers?.phone || "",
        title: t.title,
        description: t.description || "",
        dueAt: t.due_at,
        priority: t.priority as any,
        status: t.status as any,
        assignedToName: t.assigned_to_name || "Staff",
        taskType: (t.task_type as any) || "follow_up",
        createdAt: t.created_at,
        completedAt: t.completed_at || undefined,
      }));
    } catch {
      return loadAllTasks();
    }
  },

  createTask(task: Omit<CrmTask, "id" | "createdAt">): CrmTask {
    const created = createCrmTask(task);

    // Sync to Supabase
    if (task.customerId) {
      supabase
        .from("crm_tasks")
        .insert({
          id: created.id,
          customer_id: task.customerId,
          title: task.title,
          description: task.description || null,
          due_at: task.dueAt,
          priority: task.priority,
          status: task.status,
          assigned_to_name: task.assignedToName || "Staff",
          task_type: task.taskType as any,
        })
        .then(({ error }) => {
          if (error) console.warn("Supabase task insert note:", error.message);
        });
    }

    return created;
  },

  updateTaskStatus(taskId: string, status: CrmTask["status"]): CrmTask[] {
    const tasks = updateCrmTaskStatus(taskId, status);

    supabase
      .from("crm_tasks")
      .update({
        status: status,
        completed_at: status === "completed" ? new Date().toISOString() : null,
      })
      .eq("id", taskId)
      .then(({ error }) => {
        if (error) console.warn("Supabase task status update note:", error.message);
      });

    return tasks;
  },

  // -------------------------------------------------------------
  // Timeline
  // -------------------------------------------------------------
  getTimeline(customerId: string): TimelineEvent[] {
    return loadCustomerTimeline(customerId);
  },

  // -------------------------------------------------------------
  // WhatsApp
  // -------------------------------------------------------------
  getWhatsAppConversations(): WhatsAppConversation[] {
    return loadWhatsAppConversations();
  },

  async fetchWhatsAppConversationsFromSupabase(): Promise<WhatsAppConversation[]> {
    try {
      const { data, error } = await supabase
        .from("whatsapp_conversations")
        .select(`
          *,
          customers(name)
        `)
        .order("last_message_at", { ascending: false });

      if (error || !data || data.length === 0) return loadWhatsAppConversations();

      return data.map((c: any) => ({
        id: c.id,
        customerId: c.customer_id,
        customerName: c.customers?.name || "Boutique Customer",
        customerPhone: c.phone_number,
        lastMessage: "",
        lastMessageAt: c.last_message_at,
        lastCustomerMessageAt: c.last_customer_message_at,
        unreadCount: c.unread_count || 0,
        status: c.unread_count > 0 ? "waiting_staff" : "waiting_customer",
        assignedStaffName: "Staff",
      }));
    } catch {
      return loadWhatsAppConversations();
    }
  },

  getWhatsAppMessages(conversationId: string): WhatsAppMessage[] {
    return loadWhatsAppMessages(conversationId);
  },

  async fetchWhatsAppMessagesFromSupabase(conversationId: string): Promise<WhatsAppMessage[]> {
    try {
      const { data, error } = await supabase
        .from("whatsapp_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("sent_at", { ascending: true });

      if (error || !data || data.length === 0) return loadWhatsAppMessages(conversationId);

      return data.map((m: any) => ({
        id: m.id,
        conversationId: m.conversation_id,
        direction: m.direction,
        type: m.message_type,
        content: m.text_body || "",
        timestamp: m.sent_at,
        status: m.status,
        senderName: m.sender_name || undefined,
        isInternalNote: m.is_internal_note || false,
        templateName: m.template_name || undefined,
      }));
    } catch {
      return loadWhatsAppMessages(conversationId);
    }
  },

  getWhatsAppTemplates(): WhatsAppTemplate[] {
    return loadAllWhatsAppTemplates();
  },

  async createCustomTemplate(
    template: Omit<WhatsAppTemplate, "id" | "createdAt">
  ): Promise<WhatsAppTemplate> {
    const created = saveCustomWhatsAppTemplate(template);

    // Sync to Supabase in background
    supabase
      .from("whatsapp_templates")
      .insert({
        name: template.name,
        category: template.category,
        language: template.language || "en",
        body_text: template.bodyTemplate,
        variables: template.variables || [],
        status: "APPROVED",
      })
      .then(({ error }) => {
        if (error) console.warn("Supabase custom template insert note:", error.message);
      });

    return created;
  },

  getCampaigns(): CrmCampaign[] {
    return loadCrmCampaigns();
  },

  createCampaign(
    campaign: Omit<CrmCampaign, "id" | "createdAt">
  ): CrmCampaign {
    return saveCrmCampaign(campaign);
  },

  updateCampaign(
    campaignId: string,
    patch: Partial<CrmCampaign>
  ): CrmCampaign[] {
    return updateCrmCampaign(campaignId, patch);
  },

  async fetchWhatsAppTemplatesFromSupabase(): Promise<WhatsAppTemplate[]> {
    try {
      const { data, error } = await supabase
        .from("whatsapp_templates")
        .select("*")
        .eq("status", "APPROVED");

      if (error || !data || data.length === 0) return loadAllWhatsAppTemplates();

      const dbTemplates: WhatsAppTemplate[] = data.map((t) => ({
        id: t.id,
        name: t.name,
        category: t.category as any,
        language: t.language || "en",
        bodyTemplate: t.body_text,
        variables: t.variables || [],
        previewSample: t.body_text,
        status: (t.status as any) || "APPROVED",
      }));

      return [...loadAllWhatsAppTemplates(), ...dbTemplates.filter(d => !loadAllWhatsAppTemplates().some(l => l.name === d.name))];
    } catch {
      return loadAllWhatsAppTemplates();
    }
  },

  getCannedResponses(): CannedResponse[] {
    return loadCannedResponses();
  },

  async fetchCannedResponsesFromSupabase(): Promise<CannedResponse[]> {
    try {
      const { data, error } = await supabase
        .from("canned_responses")
        .select("*")
        .order("shortcut", { ascending: true });

      if (error || !data || data.length === 0) return loadCannedResponses();

      return data.map((r) => ({
        id: r.id,
        shortcut: r.shortcut,
        title: r.title,
        content: r.content,
        category: r.category || "info",
      }));
    } catch {
      return loadCannedResponses();
    }
  },

  sendMessage(
    conversationId: string,
    content: string,
    sentByName = "Staff",
    customerId?: string
  ): WhatsAppMessage {
    const msg = sendWhatsAppMockMessage(conversationId, content, sentByName, customerId);

    // Sync to Supabase
    if (customerId && conversationId) {
      supabase
        .from("whatsapp_messages")
        .insert({
          id: msg.id,
          conversation_id: conversationId,
          customer_id: customerId,
          direction: "outbound",
          message_type: "text",
          text_body: content,
          sender_name: sentByName,
          status: "sent",
        })
        .then(({ error }) => {
          if (error) console.warn("Supabase whatsapp message insert note:", error.message);
        });

      supabase
        .from("whatsapp_conversations")
        .update({
          last_message_at: new Date().toISOString(),
          unread_count: 0,
        })
        .eq("id", conversationId)
        .then(({ error }) => {
          if (error) console.warn("Supabase conversation update note:", error.message);
        });
    }

    return msg;
  },

  addInternalNote(
    conversationId: string,
    note: string,
    sentByName = "Staff",
    customerId?: string
  ): WhatsAppMessage {
    const msg = addInternalNoteToConversation(conversationId, note, sentByName, customerId);

    // Sync to Supabase
    if (customerId && conversationId) {
      supabase
        .from("whatsapp_messages")
        .insert({
          id: msg.id,
          conversation_id: conversationId,
          customer_id: customerId,
          direction: "outbound",
          message_type: "internal_note",
          text_body: note,
          is_internal_note: true,
          sender_name: sentByName,
          status: "sent",
        })
        .then(({ error }) => {
          if (error) console.warn("Supabase whatsapp internal note insert note:", error.message);
        });
    }

    return msg;
  },

  // -------------------------------------------------------------
  // Leads & Pipeline
  // -------------------------------------------------------------
  getLeads(): CrmLead[] {
    return loadAllLeads();
  },

  async fetchLeadsFromSupabase(): Promise<CrmLead[]> {
    try {
      const { data, error } = await supabase
        .from("crm_leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data || data.length === 0) return loadAllLeads();

      return data.map((l: any) => ({
        id: l.id,
        name: l.name,
        phone: l.phone,
        email: l.email || undefined,
        source: l.source as any,
        status: l.stage as any,
        budgetRange: l.budget_range || undefined,
        occasion: l.occasion || undefined,
        notes: l.notes || undefined,
        assignedStaffName: "Staff",
        createdAt: l.created_at,
      }));
    } catch {
      return loadAllLeads();
    }
  },

  createLead(lead: Omit<CrmLead, "id" | "createdAt">): CrmLead {
    const created = createCrmLead(lead);

    // Sync to Supabase
    supabase
      .from("crm_leads")
      .insert({
        id: created.id,
        name: lead.name,
        phone: lead.phone,
        email: lead.email || null,
        source: (lead.source as any) || "walk_in",
        stage: (lead.status as any) || "new_inquiry",
        budget_range: lead.budgetRange || null,
        occasion: lead.occasion || null,
        notes: lead.notes || null,
      })
      .then(({ error }) => {
        if (error) console.warn("Supabase lead insert note:", error.message);
      });

    return created;
  },

  updateLeadStatus(leadId: string, status: CrmLead["status"]): CrmLead[] {
    const leads = updateCrmLeadStatus(leadId, status);

    supabase
      .from("crm_leads")
      .update({ stage: status as any })
      .eq("id", leadId)
      .then(({ error }) => {
        if (error) console.warn("Supabase lead stage update note:", error.message);
      });

    return leads;
  },

  // -------------------------------------------------------------
  // Segments
  // -------------------------------------------------------------
  getSegments(): CrmSegment[] {
    return DEFAULT_SEGMENTS;
  },

  async fetchSegmentsFromSupabase(): Promise<CrmSegment[]> {
    try {
      const { data, error } = await supabase
        .from("crm_segments")
        .select("*")
        .order("created_at", { ascending: true });

      if (error || !data || data.length === 0) return DEFAULT_SEGMENTS;

      return data.map((s: any) => ({
        id: s.id,
        name: s.name,
        description: s.description || "",
        filterCriteria: s.filter_criteria || {},
        estimatedCount: 0,
      }));
    } catch {
      return DEFAULT_SEGMENTS;
    }
  },

  // -------------------------------------------------------------
  // Today Dashboard Aggregations
  // -------------------------------------------------------------
  getTodayDashboardStats() {
    const tasks = loadAllTasks();
    const leads = loadAllLeads();
    const convos = loadWhatsAppConversations();

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    const overdueTasks = tasks.filter(
      (t) => t.status !== "completed" && t.status !== "cancelled" && new Date(t.dueAt) < now
    );
    const dueTodayTasks = tasks.filter(
      (t) =>
        t.status !== "completed" &&
        t.status !== "cancelled" &&
        t.dueAt.startsWith(todayStr)
    );
    const completedToday = tasks.filter(
      (t) => t.status === "completed" && t.completedAt?.startsWith(todayStr)
    );
    const unansweredConvos = convos.filter(
      (c) => c.status === "waiting_staff" || c.unreadCount > 0
    );
    const activeLeads = leads.filter((l) => l.status !== "converted" && l.status !== "lost");

    return {
      overdueTasksCount: overdueTasks.length,
      dueTodayTasksCount: dueTodayTasks.length,
      completedTodayCount: completedToday.length,
      unansweredConvosCount: unansweredConvos.length,
      activeLeadsCount: activeLeads.length,
      overdueTasks,
      dueTodayTasks,
      unansweredConvos,
      recentLeads: leads.slice(0, 5),
    };
  },
};

