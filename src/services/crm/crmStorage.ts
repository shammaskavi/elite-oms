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
  EliteCircleLevel,
  CustomerLifecycleStatus,
} from "./crmTypes";

const STORAGE_KEYS = {
  PREFERENCES: "spe_crm_preferences_v2",
  NOTES: "spe_crm_notes_v2",
  TASKS: "spe_crm_tasks_v2",
  TIMELINE: "spe_crm_timeline_v2",
  WHATSAPP_CONVERSATIONS: "spe_crm_wa_convos_v2",
  WHATSAPP_MESSAGES: "spe_crm_wa_messages_v2",
  CANNED_RESPONSES: "spe_crm_canned_v2",
  LEADS: "spe_crm_leads_v2",
  CUSTOMER_META: "spe_crm_customer_meta_v2",
  CUSTOM_TEMPLATES: "spe_crm_custom_templates_v2",
  CAMPAIGNS: "spe_crm_campaigns_v2",
};

// Purge legacy mock data from browser localStorage once
if (typeof window !== "undefined") {
  try {
    const legacyKeys = [
      "spe_crm_preferences_v1",
      "spe_crm_notes_v1",
      "spe_crm_tasks_v1",
      "spe_crm_timeline_v1",
      "spe_crm_wa_convos_v1",
      "spe_crm_wa_messages_v1",
      "spe_crm_leads_v1",
      "spe_crm_customer_meta_v1",
    ];
    legacyKeys.forEach((k) => window.localStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

// Helper to safely read from localStorage
function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Helper to safely write to localStorage
function saveJson(key: string, data: any): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* ignore storage quota errors */
  }
}

// Boutique Canned WhatsApp Responses
export const DEFAULT_CANNED_RESPONSES: CannedResponse[] = [
  {
    id: "canned_loc",
    title: "Store Location & Timings",
    shortcut: "/location",
    category: "location",
    content:
      "📍 *Saree Palace Elite Boutique*\nShowroom No. 4–6, Heritage Silk Avenue, Near City Centre.\n⏰ Open 10:30 AM – 9:00 PM (All 7 Days).\n🗺️ Google Maps: https://maps.google.com/?q=Saree+Palace+Elite",
  },
  {
    id: "canned_bank",
    title: "Bank & UPI Details",
    shortcut: "/bank",
    category: "payments",
    content:
      "💳 *Saree Palace Elite — Payment Details*\n• Account Name: Saree Palace Elite Pvt Ltd\n• Bank: HDFC Bank\n• Account No: 50200012345678\n• IFSC: HDFC0001234\n• UPI ID: sareepalaceelite@hdfcbank\n\nPlease share transaction screenshot / UTR once done.",
  },
  {
    id: "canned_delivery",
    title: "Shipping & Dispatch Update",
    shortcut: "/shipping",
    category: "shipping",
    content:
      "🚚 Your package has been securely packed with insured boutique courier. You will receive a tracking link via SMS/WhatsApp once the consignment is scanned by the logistics partner.",
  },
  {
    id: "canned_alteration",
    title: "Fitting & Alterations Lead Time",
    shortcut: "/alteration",
    category: "alterations",
    content:
      "🧵 Our in-house master karigar will complete your custom blouse and fall-pico finishing within 3–4 business days. We will notify you the moment it is ready for trial / pickup!",
  },
];

// Standard Boutique WhatsApp Templates
export const DEFAULT_WHATSAPP_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: "tpl_new_collection",
    name: "new_collection_preview",
    category: "MARKETING",
    language: "en_IN",
    headerType: "TEXT",
    headerContent: "✨ Exclusive New Arrival",
    bodyTemplate:
      "Hello {{1}} ✨\n\nWe thought of you! Our exclusive new {{2}} collection has just arrived at Saree Palace Elite, featuring beautiful {{3}} pieces in your favourite palette.\n\nWould you like us to share a private catalog or reserve a personal styling slot for you?",
    footerText: "Saree Palace Elite • Luxury Indian Weaves",
    buttons: [
      { type: "QUICK_REPLY", text: "👗 View Catalog" },
      { type: "QUICK_REPLY", text: "📅 Book Styling Slot" },
    ],
    variables: ["customer_name", "collection_name", "fabric"],
    previewSample:
      "✨ Exclusive New Arrival\n\nHello Sunita ji ✨\n\nWe thought of you! Our exclusive new Royal Kanjeevaram collection has just arrived at Saree Palace Elite, featuring beautiful Pure Silk pieces in your favourite palette.\n\nWould you like us to share a private catalog or reserve a personal styling slot for you?\n\nSaree Palace Elite • Luxury Indian Weaves",
    status: "APPROVED",
  },
  {
    id: "tpl_bridal_vip_invite",
    name: "bridal_private_preview",
    category: "MARKETING",
    language: "en_IN",
    headerType: "TEXT",
    headerContent: "💍 Private Bridal Trunk Show",
    bodyTemplate:
      "Namaste {{1}} 🌸\n\nYou are cordially invited to an exclusive private bridal viewing at Saree Palace Elite. Explore our handcrafted bridal lehengas, pure zari Banarasis, and heirloom silks curated especially for the wedding season.\n\nEnjoy complimentary trial fittings with our Master Stylist and exclusive bridal privileges.",
    footerText: "By Private Appointment Only • Saree Palace Elite",
    buttons: [
      { type: "QUICK_REPLY", text: "✨ Reserve VIP Slot" },
      { type: "PHONE_NUMBER", text: "📞 Call Stylist", phoneNumber: "+919274741003" },
    ],
    variables: ["customer_name"],
    previewSample:
      "💍 Private Bridal Trunk Show\n\nNamaste Priya ji 🌸\n\nYou are cordially invited to an exclusive private bridal viewing at Saree Palace Elite.",
    status: "APPROVED",
  },
  {
    id: "tpl_birthday_greeting",
    name: "birthday_wishes_privilege",
    category: "MARKETING",
    language: "en_IN",
    headerType: "TEXT",
    headerContent: "🎂 Happy Birthday Wishes",
    bodyTemplate:
      "Dearest {{1}} 🌸\n\nWarmest birthday wishes from the entire family at Saree Palace Elite! May your year ahead be filled with joy, grace, and celebrations.\n\nAs our cherished {{2}} member, we invite you to enjoy a complimentary personal styling consultation and an exclusive celebratory gift voucher on your next boutique visit.",
    footerText: "Valid for 30 days from your birthday",
    buttons: [
      { type: "QUICK_REPLY", text: "🎁 Claim Gift Voucher" },
      { type: "QUICK_REPLY", text: "👗 Browse New Arrivals" },
    ],
    variables: ["customer_name", "tier"],
    previewSample:
      "🎂 Happy Birthday Wishes\n\nDearest Ananya ji 🌸\n\nWarmest birthday wishes from the entire family at Saree Palace Elite! Enjoy an exclusive celebratory gift voucher on your next visit.",
    status: "APPROVED",
  },
  {
    id: "tpl_anniversary_wishes",
    name: "anniversary_milestone_wishes",
    category: "MARKETING",
    language: "en_IN",
    headerType: "TEXT",
    headerContent: "🥂 Happy Anniversary",
    bodyTemplate:
      "Warm greetings {{1}} ✨\n\nWishing you and your family a wonderful anniversary filled with love, laughter, and cherished memories! We look forward to celebrating many more special milestones with you at Saree Palace Elite.",
    footerText: "With warm regards, Saree Palace Elite",
    buttons: [
      { type: "QUICK_REPLY", text: "🌸 Thank you!" },
      { type: "QUICK_REPLY", text: "🛍️ Visit Boutique" },
    ],
    variables: ["customer_name"],
    previewSample:
      "🥂 Happy Anniversary\n\nWarm greetings Meera ji ✨\n\nWishing you and your family a wonderful anniversary filled with love and cherished memories!",
    status: "APPROVED",
  },
  {
    id: "tpl_festive_private_sale",
    name: "vip_festive_private_sale",
    category: "MARKETING",
    language: "en_IN",
    headerType: "TEXT",
    headerContent: "🎉 Festive Privilege Access",
    bodyTemplate:
      "Hello {{1}} 🪔\n\nAhead of the upcoming festive season, Saree Palace Elite is hosting a Private VIP Preview from {{2}}. Explore our newly unveiled handwoven Paithanis, Organzas, and Bandhanis with exclusive early-bird privileges.\n\nWe would love to welcome you in-store!",
    footerText: "Exclusive to Elite Circle & Privé Members",
    buttons: [
      { type: "QUICK_REPLY", text: "✨ I'll be visiting" },
      { type: "QUICK_REPLY", text: "📱 Send Digital Lookbook" },
    ],
    variables: ["customer_name", "dates"],
    previewSample:
      "🎉 Festive Privilege Access\n\nHello Sunita ji 🪔\n\nAhead of the upcoming festive season, Saree Palace Elite is hosting a Private VIP Preview from Friday to Sunday.",
    status: "APPROVED",
  },
  {
    id: "tpl_dormant_reconnect",
    name: "vip_client_reconnect",
    category: "MARKETING",
    language: "en_IN",
    headerType: "TEXT",
    headerContent: "✨ We Miss Seeing You!",
    bodyTemplate:
      "Hello {{1}} ✨\n\nIt has been a while since your last visit to Saree Palace Elite! Our new season silk edit has just landed with breathtaking pure zari weaves. We have saved a complimentary ₹{{2}} welcome-back credit on your customer profile.\n\nReply to view the lookbook or visit us this week!",
    footerText: "Valid on any purchase above ₹5,000",
    buttons: [
      { type: "QUICK_REPLY", text: "👗 View Silk Lookbook" },
      { type: "QUICK_REPLY", text: "💬 Chat with Stylist" },
    ],
    variables: ["customer_name", "credit_amount"],
    previewSample:
      "✨ We Miss Seeing You!\n\nHello Kavita ji ✨\n\nIt has been a while since your last visit to Saree Palace Elite! We have saved a complimentary ₹1,000 credit on your profile.",
    status: "APPROVED",
  },
  {
    id: "tpl_payment_reminder",
    name: "payment_settle_reminder",
    category: "UTILITY",
    language: "en_IN",
    headerType: "TEXT",
    headerContent: "💳 Payment Reminder",
    bodyTemplate:
      "Hello {{1}} ✨\n\nGreetings from Saree Palace Elite. This is a gentle reminder regarding your pending balance of ₹{{2}} for Invoice #{{3}}.\n\nYou may settle this via UPI or during your next store visit. Thank you for choosing us!",
    footerText: "UPI ID: sareepalaceelite@hdfcbank",
    buttons: [
      { type: "QUICK_REPLY", text: "💳 Pay via UPI" },
      { type: "QUICK_REPLY", text: "📞 Contact Accounts" },
    ],
    variables: ["customer_name", "amount", "invoice_number"],
    previewSample:
      "💳 Payment Reminder\n\nHello Sunita ji ✨\n\nGreetings from Saree Palace Elite. This is a gentle reminder regarding your pending balance of ₹4,500 for Invoice #INV-2026-089.",
    status: "APPROVED",
  },
  {
    id: "tpl_order_ready",
    name: "order_packed_ready",
    category: "UTILITY",
    language: "en_IN",
    headerType: "TEXT",
    headerContent: "🛍️ Your Order is Ready!",
    bodyTemplate:
      "Hello {{1}} 🛍️\n\nGreat news! Your {{2}} (Invoice #{{3}}) has been custom finished by our master karigar and is packed and ready for collection at our boutique.\n\nBalance due at pickup: ₹{{4}}.\n\nWe look forward to seeing you soon!",
    footerText: "Store Hours: 10:30 AM - 9:00 PM Daily",
    buttons: [
      { type: "QUICK_REPLY", text: "📍 Store Directions" },
      { type: "QUICK_REPLY", text: "🚚 Request Home Delivery" },
    ],
    variables: ["customer_name", "item_name", "invoice_number", "balance"],
    previewSample:
      "🛍️ Your Order is Ready!\n\nHello Priya ji 🛍️\n\nGreat news! Your Bespoke Silk Blouse & Saree (Invoice #INV-2026-042) is packed and ready for collection at our boutique.",
    status: "APPROVED",
  },
];

// Pre-configured dynamic segments calculated from real customer invoices and dates
export const DEFAULT_SEGMENTS: CrmSegment[] = [
  {
    id: "seg_bridal",
    name: "Bridal & Wedding Clients",
    description: "High-intent customers interested in Bridal, Reception, and Heavy Zari sarees.",
    count: 0,
    tags: ["Bridal", "Wedding", "High Value"],
    iconName: "Sparkles",
    filterRules: {
      occasions: ["Bridal / Wedding", "Reception", "Engagement"],
      minLtv: 35000,
    },
  },
  {
    id: "seg_silk_lovers",
    name: "Silk Connoisseurs",
    description: "Frequent buyers of Pure Kanjeevaram, Banarasi, and Paithani handlooms.",
    count: 0,
    tags: ["Kanjeevaram", "Banarasi", "Pure Silk"],
    iconName: "Heart",
    filterRules: {
      fabrics: ["Pure Kanjeevaram Silk", "Banarasi Katan Silk", "Pure Paithani Silk"],
    },
  },
  {
    id: "seg_elite_prive",
    name: "Elite Privé VIP Circle",
    description: "Top boutique relationships with lifetime spend above ₹75,000.",
    count: 0,
    tags: ["VIP", "Privé", "Priority"],
    iconName: "Crown",
    filterRules: {
      eliteCircleLevels: ["Elite Privé"],
      minLtv: 75000,
    },
  },
  {
    id: "seg_dormant_reactivation",
    name: "Dormant (> 120 Days)",
    description: "Valued customers who have not visited or purchased in over 4 months.",
    count: 0,
    tags: ["Reactivation", "Follow-up"],
    iconName: "Clock",
    filterRules: {
      minDaysSincePurchase: 120,
    },
  },
  {
    id: "seg_upcoming_events",
    name: "Upcoming Celebrations (30 Days)",
    description: "Customers with birthdays or anniversaries arriving within the next 30 days.",
    count: 0,
    tags: ["Birthday", "Anniversary", "Celebration"],
    iconName: "Gift",
    filterRules: {
      upcomingEventDays: 30,
    },
  },
];


// -------------------------------------------------------------
// Preferences
// -------------------------------------------------------------
export function loadCustomerPreferences(customerId: string): SareePreferences {
  const allPrefs = loadJson<Record<string, SareePreferences>>(STORAGE_KEYS.PREFERENCES, {});
  if (allPrefs[customerId]) return allPrefs[customerId];

  const defaultPref: SareePreferences = {
    colours: [],
    fabrics: [],
    weaves: [],
    occasions: [],
    budgetRange: "",
    blousePreferences: "",
    stylingNotes: "",
    preferredLanguage: "English / Hindi",
    preferredContactChannel: "whatsapp",
  };

  return defaultPref;
}

export function saveCustomerPreferences(customerId: string, prefs: SareePreferences): void {
  const allPrefs = loadJson<Record<string, SareePreferences>>(STORAGE_KEYS.PREFERENCES, {});
  allPrefs[customerId] = prefs;
  saveJson(STORAGE_KEYS.PREFERENCES, allPrefs);
}

// -------------------------------------------------------------
// Customer Metadata (Tier & Lifecycle Status)
// -------------------------------------------------------------
export interface CustomerMeta {
  lifecycleStatus: CustomerLifecycleStatus;
  eliteCircleLevel: EliteCircleLevel;
  relationshipOwnerName: string;
}

export function loadCustomerMeta(customerId: string): CustomerMeta {
  const allMeta = loadJson<Record<string, CustomerMeta>>(STORAGE_KEYS.CUSTOMER_META, {});
  if (allMeta[customerId]) return allMeta[customerId];

  const defaultMeta: CustomerMeta = {
    lifecycleStatus: "Active",
    eliteCircleLevel: "Elite Preferred",
    relationshipOwnerName: "Staff",
  };

  return defaultMeta;
}

export function saveCustomerMeta(customerId: string, meta: Partial<CustomerMeta>): void {
  const allMeta = loadJson<Record<string, CustomerMeta>>(STORAGE_KEYS.CUSTOMER_META, {});
  const existing = loadCustomerMeta(customerId);
  allMeta[customerId] = { ...existing, ...meta };
  saveJson(STORAGE_KEYS.CUSTOMER_META, allMeta);
}

// -------------------------------------------------------------
// Notes
// -------------------------------------------------------------
export function loadCustomerNotes(customerId: string): CustomerNote[] {
  const allNotes = loadJson<Record<string, CustomerNote[]>>(STORAGE_KEYS.NOTES, {});
  return allNotes[customerId] || [];
}

export function addCustomerNote(
  customerId: string,
  noteText: string,
  authorName = "Staff",
  tags: string[] = [],
  isPinned = false
): CustomerNote {
  const allNotes = loadJson<Record<string, CustomerNote[]>>(STORAGE_KEYS.NOTES, {});
  const list = allNotes[customerId] || [];

  const newNote: CustomerNote = {
    id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    customerId,
    note: noteText.trim(),
    isPinned,
    tags,
    authorName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  list.unshift(newNote);
  allNotes[customerId] = list;
  saveJson(STORAGE_KEYS.NOTES, allNotes);

  // Also log to timeline
  addTimelineEvent(customerId, {
    eventType: "note_added",
    title: `Clienteling Note Added`,
    description: noteText.substring(0, 90) + (noteText.length > 90 ? "…" : ""),
    authorName,
    badgeVariant: "secondary",
  });

  return newNote;
}

export function togglePinNote(customerId: string, noteId: string): CustomerNote[] {
  const allNotes = loadJson<Record<string, CustomerNote[]>>(STORAGE_KEYS.NOTES, {});
  const list = allNotes[customerId] || [];
  const updated = list.map((n) => (n.id === noteId ? { ...n, isPinned: !n.isPinned } : n));
  allNotes[customerId] = updated;
  saveJson(STORAGE_KEYS.NOTES, allNotes);
  return updated;
}

export function deleteCustomerNote(customerId: string, noteId: string): CustomerNote[] {
  const allNotes = loadJson<Record<string, CustomerNote[]>>(STORAGE_KEYS.NOTES, {});
  const list = allNotes[customerId] || [];
  const updated = list.filter((n) => n.id !== noteId);
  allNotes[customerId] = updated;
  saveJson(STORAGE_KEYS.NOTES, allNotes);
  return updated;
}

// -------------------------------------------------------------
// Tasks & Follow-ups
// -------------------------------------------------------------
export function loadAllTasks(): CrmTask[] {
  return loadJson<CrmTask[]>(STORAGE_KEYS.TASKS, []);
}

export function loadCustomerTasks(customerId: string): CrmTask[] {
  const all = loadAllTasks();
  return all.filter((t) => t.customerId === customerId);
}

export function createCrmTask(task: Omit<CrmTask, "id" | "createdAt">): CrmTask {
  const all = loadAllTasks();
  const newTask: CrmTask = {
    ...task,
    id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  all.unshift(newTask);
  saveJson(STORAGE_KEYS.TASKS, all);

  if (task.customerId) {
    addTimelineEvent(task.customerId, {
      eventType: "task_created",
      title: `Follow-up Task Created: ${task.title}`,
      description: `Assigned to ${task.assignedToName} • Due ${new Date(task.dueAt).toLocaleDateString("en-IN")}`,
      authorName: task.assignedToName,
      badgeVariant: "warning",
    });
  }

  return newTask;
}

export function updateCrmTaskStatus(taskId: string, status: CrmTask["status"]): CrmTask[] {
  const all = loadAllTasks();
  const updated = all.map((t) => {
    if (t.id === taskId) {
      return {
        ...t,
        status,
        completedAt: status === "completed" ? new Date().toISOString() : undefined,
      };
    }
    return t;
  });

  saveJson(STORAGE_KEYS.TASKS, updated);
  return updated;
}

// -------------------------------------------------------------
// Timeline Events
// -------------------------------------------------------------
export function loadCustomerTimeline(customerId: string): TimelineEvent[] {
  const allTimeline = loadJson<Record<string, TimelineEvent[]>>(STORAGE_KEYS.TIMELINE, {});
  return allTimeline[customerId] || [];
}

export function addTimelineEvent(
  customerId: string,
  event: Omit<TimelineEvent, "id" | "customerId" | "timestamp">
): TimelineEvent {
  const allTimeline = loadJson<Record<string, TimelineEvent[]>>(STORAGE_KEYS.TIMELINE, {});
  const list = allTimeline[customerId] || [];

  const newEvent: TimelineEvent = {
    ...event,
    id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    customerId,
    timestamp: new Date().toISOString(),
  };

  list.unshift(newEvent);
  allTimeline[customerId] = list;
  saveJson(STORAGE_KEYS.TIMELINE, allTimeline);
  return newEvent;
}

// -------------------------------------------------------------
// WhatsApp Inbox & Messages
// -------------------------------------------------------------
export function loadWhatsAppConversations(): WhatsAppConversation[] {
  return loadJson<WhatsAppConversation[]>(STORAGE_KEYS.WHATSAPP_CONVERSATIONS, []);
}

export function loadWhatsAppMessages(conversationId: string): WhatsAppMessage[] {
  const allMessages = loadJson<Record<string, WhatsAppMessage[]>>(STORAGE_KEYS.WHATSAPP_MESSAGES, {});
  return allMessages[conversationId] || [];
}

export function sendWhatsAppMockMessage(
  conversationId: string,
  content: string,
  sentByName = "Staff",
  customerId?: string
): WhatsAppMessage {
  const allMessages = loadJson<Record<string, WhatsAppMessage[]>>(STORAGE_KEYS.WHATSAPP_MESSAGES, {});
  const list = allMessages[conversationId] || [];

  const newMsg: WhatsAppMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    conversationId,
    customerId,
    direction: "outbound",
    messageType: "text",
    content,
    status: "sent",
    sentByName,
    timestamp: new Date().toISOString(),
  };

  list.push(newMsg);
  allMessages[conversationId] = list;
  saveJson(STORAGE_KEYS.WHATSAPP_MESSAGES, allMessages);

  // Update conversation last message
  const allConvos = loadWhatsAppConversations();
  const updatedConvos = allConvos.map((c) =>
    c.id === conversationId
      ? {
          ...c,
          lastMessagePreview: content.substring(0, 60),
          lastMessageAt: new Date().toISOString(),
          status: "waiting_customer" as const,
        }
      : c
  );
  saveJson(STORAGE_KEYS.WHATSAPP_CONVERSATIONS, updatedConvos);

  if (customerId) {
    addTimelineEvent(customerId, {
      eventType: "whatsapp_sent",
      title: "Outbound WhatsApp Message Sent",
      description: content.substring(0, 90) + (content.length > 90 ? "…" : ""),
      authorName: sentByName,
      badgeVariant: "info",
    });
  }

  return newMsg;
}

export function addInternalNoteToConversation(
  conversationId: string,
  noteText: string,
  authorName = "Staff",
  customerId?: string
): WhatsAppMessage {
  const allMessages = loadJson<Record<string, WhatsAppMessage[]>>(STORAGE_KEYS.WHATSAPP_MESSAGES, {});
  const list = allMessages[conversationId] || [];

  const internalNoteMsg: WhatsAppMessage = {
    id: `note_msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    conversationId,
    customerId,
    direction: "outbound",
    messageType: "internal_note",
    content: noteText.trim(),
    isInternalNote: true,
    status: "delivered",
    sentByName: authorName,
    timestamp: new Date().toISOString(),
  };

  list.push(internalNoteMsg);
  allMessages[conversationId] = list;
  saveJson(STORAGE_KEYS.WHATSAPP_MESSAGES, allMessages);

  if (customerId) {
    addTimelineEvent(customerId, {
      eventType: "note_added",
      title: "Internal Team Note in Chat",
      description: noteText.substring(0, 90) + (noteText.length > 90 ? "…" : ""),
      authorName,
      badgeVariant: "warning",
    });
  }

  return internalNoteMsg;
}

export function loadCannedResponses(): CannedResponse[] {
  const custom = loadJson<CannedResponse[]>(STORAGE_KEYS.CANNED_RESPONSES, []);
  return [...DEFAULT_CANNED_RESPONSES, ...custom];
}

// -------------------------------------------------------------
// Leads & Prospects
// -------------------------------------------------------------
export function loadAllLeads(): CrmLead[] {
  return loadJson<CrmLead[]>(STORAGE_KEYS.LEADS, []);
}

export function createCrmLead(lead: Omit<CrmLead, "id" | "createdAt">): CrmLead {
  const all = loadAllLeads();
  const newLead: CrmLead = {
    ...lead,
    id: `lead_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  all.unshift(newLead);
  saveJson(STORAGE_KEYS.LEADS, all);
  return newLead;
}

export function updateCrmLeadStatus(leadId: string, status: CrmLead["status"]): CrmLead[] {
  const all = loadAllLeads();
  const updated = all.map((l) =>
    l.id === leadId
      ? {
          ...l,
          status,
          convertedAt: status === "converted" ? new Date().toISOString() : l.convertedAt,
        }
      : l
  );

  saveJson(STORAGE_KEYS.LEADS, updated);
  return updated;
}

// -------------------------------------------------------------
// Custom Templates & Campaign Storage
// -------------------------------------------------------------
export function loadAllWhatsAppTemplates(): WhatsAppTemplate[] {
  const custom = loadJson<WhatsAppTemplate[]>(STORAGE_KEYS.CUSTOM_TEMPLATES, []);
  return [...DEFAULT_WHATSAPP_TEMPLATES, ...custom];
}

export function saveCustomWhatsAppTemplate(template: Omit<WhatsAppTemplate, "id" | "createdAt">): WhatsAppTemplate {
  const custom = loadJson<WhatsAppTemplate[]>(STORAGE_KEYS.CUSTOM_TEMPLATES, []);
  const newTemplate: WhatsAppTemplate = {
    ...template,
    id: `tpl_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
    status: "APPROVED",
  };

  custom.unshift(newTemplate);
  saveJson(STORAGE_KEYS.CUSTOM_TEMPLATES, custom);
  return newTemplate;
}

export function loadCrmCampaigns(): import("./crmTypes").CrmCampaign[] {
  return loadJson<import("./crmTypes").CrmCampaign[]>(STORAGE_KEYS.CAMPAIGNS, []);
}

export function saveCrmCampaign(
  campaign: Omit<import("./crmTypes").CrmCampaign, "id" | "createdAt">
): import("./crmTypes").CrmCampaign {
  const all = loadCrmCampaigns();
  const newCamp: import("./crmTypes").CrmCampaign = {
    ...campaign,
    id: `camp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
  };

  all.unshift(newCamp);
  saveJson(STORAGE_KEYS.CAMPAIGNS, all);
  return newCamp;
}

export function updateCrmCampaign(
  campaignId: string,
  patch: Partial<import("./crmTypes").CrmCampaign>
): import("./crmTypes").CrmCampaign[] {
  const all = loadCrmCampaigns();
  const updated = all.map((c) => (c.id === campaignId ? { ...c, ...patch } : c));
  saveJson(STORAGE_KEYS.CAMPAIGNS, updated);
  return updated;
}

