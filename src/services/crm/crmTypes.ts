export type EliteCircleLevel = "Elite Circle" | "Elite Preferred" | "Elite Privé";

export type CustomerLifecycleStatus =
  | "Lead"
  | "New"
  | "Active"
  | "Repeat"
  | "VIP / Privé"
  | "Dormant"
  | "Reactivation";

export type TaskPriority = "urgent" | "high" | "normal" | "low";
export type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";

export type ContactChannel = "whatsapp" | "phone" | "email" | "in_store";

export interface SareePreferences {
  colours: string[];
  fabrics: string[];
  weaves: string[];
  occasions: string[];
  budgetRange: string;
  blousePreferences?: string;
  stylingNotes?: string;
  dislikedAttributes?: string;
  preferredLanguage?: string;
  preferredContactChannel?: ContactChannel;
}

export interface CustomerNote {
  id: string;
  customerId: string;
  note: string;
  isPinned: boolean;
  tags?: string[];
  authorName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmTask {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone?: string;
  title: string;
  description?: string;
  assignedToName: string;
  assignedToId?: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueAt: string;
  completedAt?: string;
  source?: "manual" | "birthday" | "anniversary" | "payment" | "reactivation" | "order_completion";
  relatedInvoiceNumber?: string;
  relatedOrderId?: string;
  createdAt: string;
}

export type TimelineEventType =
  | "invoice_created"
  | "payment_received"
  | "order_created"
  | "stage_moved"
  | "note_added"
  | "task_created"
  | "task_completed"
  | "whatsapp_sent"
  | "whatsapp_received"
  | "preference_updated"
  | "lifecycle_changed"
  | "lead_converted";

export interface TimelineEvent {
  id: string;
  customerId: string;
  eventType: TimelineEventType;
  title: string;
  description?: string;
  timestamp: string;
  authorName?: string;
  metadata?: Record<string, any>;
  badgeVariant?: "default" | "secondary" | "outline" | "destructive" | "success" | "warning" | "info";
}

export interface WhatsAppMessage {
  id: string;
  conversationId: string;
  customerId?: string;
  direction: "inbound" | "outbound";
  messageType: "text" | "image" | "document" | "audio" | "template" | "internal_note";
  content: string;
  mediaUrl?: string;
  mediaCaption?: string;
  templateName?: string;
  status: "queued" | "sent" | "delivered" | "read" | "failed";
  sentByName?: string;
  isInternalNote?: boolean;
  timestamp: string;
}

export interface CannedResponse {
  id: string;
  title: string;
  shortcut: string;
  content: string;
  category: "location" | "payments" | "shipping" | "alterations" | "general";
}

export interface WhatsAppConversation {
  id: string;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  lastMessagePreview: string;
  lastMessageAt: string;
  lastInboundAt?: string;
  unreadCount: number;
  status: "open" | "waiting_customer" | "waiting_staff" | "closed";
  assignedToName?: string;
  eliteCircleLevel?: EliteCircleLevel;
  avatarUrl?: string;
  isSessionWindowActive?: boolean;
  sessionExpiresAt?: string;
}

export interface WhatsAppTemplateButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
  text: string;
  url?: string;
  phoneNumber?: string;
}

export interface WhatsAppTemplate {
  id: string;
  name: string;
  category: "MARKETING" | "UTILITY" | "SERVICE";
  language: string;
  headerType?: "NONE" | "TEXT" | "IMAGE" | "DOCUMENT";
  headerContent?: string;
  bodyTemplate: string;
  footerText?: string;
  buttons?: WhatsAppTemplateButton[];
  variables: string[];
  previewSample: string;
  status?: "APPROVED" | "PENDING" | "REJECTED" | "DRAFT";
  createdAt?: string;
}

export interface CrmCampaign {
  id: string;
  name: string;
  segmentId: string;
  segmentName: string;
  templateId: string;
  templateName: string;
  totalAudience: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  status: "draft" | "scheduled" | "sending" | "completed";
  scheduledFor?: string;
  createdAt: string;
  variableMappings?: Record<string, string>;
}

export type LeadStatus =
  | "new"
  | "contacted"
  | "interested"
  | "visit_planned"
  | "selection"
  | "converted"
  | "lost";

export interface CrmLead {
  id: string;
  customerId?: string;
  name: string;
  phone: string;
  whatsappNumber?: string;
  source: "Instagram" | "Walk-in" | "Referral" | "WhatsApp" | "Website" | "Exhibition" | "Phone";
  status: LeadStatus;
  assignedToName: string;
  interestedCategories: string[];
  occasion?: string;
  budgetRange?: string;
  expectedPurchaseDate?: string;
  notes?: string;
  createdAt: string;
  convertedAt?: string;
}

export interface CrmSegment {
  id: string;
  name: string;
  description: string;
  count: number;
  tags: string[];
  iconName: string;
  filterRules: {
    minLtv?: number;
    maxDaysSincePurchase?: number;
    minDaysSincePurchase?: number;
    lifecycleStatus?: CustomerLifecycleStatus[];
    eliteCircleLevels?: EliteCircleLevel[];
    fabrics?: string[];
    occasions?: string[];
    hasOutstanding?: boolean;
    upcomingEventDays?: number;
  };
}

export interface NextBestAction {
  id: string;
  type: "birthday_greeting" | "anniversary_greeting" | "reactivation" | "collection_preview" | "payment_reminder" | "order_feedback";
  title: string;
  description: string;
  reason: string;
  suggestedAction: string;
  suggestedTemplateName?: string;
  urgency: "high" | "medium" | "low";
}

export interface CustomerCrmProfile {
  id: string; // matches customers.id
  lifecycleStatus: CustomerLifecycleStatus;
  eliteCircleLevel: EliteCircleLevel;
  relationshipOwnerName: string;
  relationshipOwnerId?: string;
  preferences: SareePreferences;
  nextBestAction?: NextBestAction;
  notesCount: number;
  tasksCount: number;
  openTasksCount: number;
}
