-- ============================================================================
-- Saree Palace Elite - Clienteling CRM & WhatsApp Suite
-- Migration: 20260916_crm_clienteling_v1.sql
-- Description: Additive-only schema for Customer 360, Preferences, Clienteling
--              Notes, Tasks, Leads Pipeline, Segments, and WhatsApp Messaging.
-- Safety: Guaranteed zero modifications or drops to existing core tables/columns.
-- ============================================================================

-- 1. EXTENSIONS TO EXISTING `customers` TABLE (100% ADDITIVE & NON-BREAKING)
-- ----------------------------------------------------------------------------
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS elite_circle_level TEXT DEFAULT 'bronze',
  ADD COLUMN IF NOT EXISTS relationship_owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS preferred_contact_channel TEXT DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS promotional_consent BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS transactional_consent BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_customers_lifecycle_status ON public.customers(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_customers_elite_circle_level ON public.customers(elite_circle_level);
CREATE INDEX IF NOT EXISTS idx_customers_relationship_owner ON public.customers(relationship_owner_id);


-- 2. CUSTOMER PREFERENCES (1-to-1 WITH `customers`)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_preferences (
  customer_id UUID PRIMARY KEY REFERENCES public.customers(id) ON DELETE CASCADE,
  favorite_fabrics TEXT[] DEFAULT ARRAY[]::TEXT[],
  favorite_colors TEXT[] DEFAULT ARRAY[]::TEXT[],
  favorite_weaves TEXT[] DEFAULT ARRAY[]::TEXT[],
  favorite_occasions TEXT[] DEFAULT ARRAY[]::TEXT[],
  disliked_colors TEXT[] DEFAULT ARRAY[]::TEXT[],
  budget_min NUMERIC DEFAULT 0,
  budget_max NUMERIC DEFAULT 0,
  blouse_neck_preference TEXT,
  blouse_sleeve_preference TEXT,
  blouse_notes TEXT,
  general_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.customer_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage customer_preferences"
    ON public.customer_preferences FOR ALL
    USING (public.is_authenticated_user())
    WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 3. CUSTOMER CLIENTELING & STYLING NOTES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  note_type TEXT DEFAULT 'general' CHECK (note_type IN ('general', 'styling', 'fabric_preference', 'family_occasion', 'complaint')),
  content TEXT NOT NULL,
  pinned BOOLEAN DEFAULT FALSE,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_customer_notes_customer_id ON public.customer_notes(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_notes_pinned ON public.customer_notes(pinned);

ALTER TABLE public.customer_notes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage customer_notes"
    ON public.customer_notes FOR ALL
    USING (public.is_authenticated_user())
    WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 4. CRM TASKS & FOLLOW-UPS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  due_at TIMESTAMPTZ NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_to_name TEXT,
  task_type TEXT DEFAULT 'follow_up' CHECK (task_type IN ('follow_up', 'fitting', 'birthday_call', 'anniversary_call', 'bridal_consultation')),
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_tasks_customer_id ON public.crm_tasks(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due_at ON public.crm_tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON public.crm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned_to ON public.crm_tasks(assigned_to);

ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage crm_tasks"
    ON public.crm_tasks FOR ALL
    USING (public.is_authenticated_user())
    WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 5. CRM ACTIVITY STREAM EVENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_activity_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('invoice_created', 'order_placed', 'order_delivered', 'payment_received', 'note_added', 'task_completed', 'whatsapp_sent', 'whatsapp_received')),
  title TEXT NOT NULL,
  description TEXT,
  actor_name TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_activity_customer_id ON public.crm_activity_events(customer_id);
CREATE INDEX IF NOT EXISTS idx_crm_activity_created_at ON public.crm_activity_events(created_at DESC);

ALTER TABLE public.crm_activity_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage crm_activity_events"
    ON public.crm_activity_events FOR ALL
    USING (public.is_authenticated_user())
    WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 6. BOUTIQUE LEADS PIPELINE
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  source TEXT DEFAULT 'walk_in' CHECK (source IN ('walk_in', 'instagram', 'whatsapp', 'referral', 'exhibition', 'website')),
  stage TEXT DEFAULT 'new_inquiry' CHECK (stage IN ('new_inquiry', 'requirement_collected', 'curation_shared', 'trial_scheduled', 'converted', 'lost')),
  budget_range TEXT,
  occasion TEXT,
  notes TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_stage ON public.crm_leads(stage);
CREATE INDEX IF NOT EXISTS idx_crm_leads_phone ON public.crm_leads(phone);

ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage crm_leads"
    ON public.crm_leads FOR ALL
    USING (public.is_authenticated_user())
    WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 7. AUDIENCE SEGMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  filter_criteria JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.crm_segments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage crm_segments"
    ON public.crm_segments FOR ALL
    USING (public.is_authenticated_user())
    WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 8. WHATSAPP CONVERSATIONS (META CLOUD API INTEGRATION)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  phone_number TEXT NOT NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_customer_message_at TIMESTAMPTZ,
  unread_count INT DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'snoozed')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_conversations_customer ON public.whatsapp_conversations(customer_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_phone ON public.whatsapp_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_last_msg ON public.whatsapp_conversations(last_message_at DESC);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage whatsapp_conversations"
    ON public.whatsapp_conversations FOR ALL
    USING (public.is_authenticated_user())
    WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 9. WHATSAPP MESSAGES & DUAL-MODE INTERNAL NOTES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  wamid TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'document', 'template', 'internal_note')),
  text_body TEXT,
  media_url TEXT,
  media_type TEXT,
  template_name TEXT,
  is_internal_note BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  error_message TEXT,
  sender_name TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_conversation_id ON public.whatsapp_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_customer_id ON public.whatsapp_messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sent_at ON public.whatsapp_messages(sent_at ASC);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage whatsapp_messages"
    ON public.whatsapp_messages FOR ALL
    USING (public.is_authenticated_user())
    WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 10. WHATSAPP TEMPLATES (APPROVED META TEMPLATES)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  body_text TEXT NOT NULL,
  variables TEXT[] DEFAULT ARRAY[]::TEXT[],
  status TEXT DEFAULT 'APPROVED',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage whatsapp_templates"
    ON public.whatsapp_templates FOR ALL
    USING (public.is_authenticated_user())
    WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 11. CANNED RESPONSES (BOUTIQUE QUICK-REPLY SHORTCUTS)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.canned_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE public.canned_responses ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage canned_responses"
    ON public.canned_responses FOR ALL
    USING (public.is_authenticated_user())
    WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 12. CUSTOMER TAGS & ASSIGNMENTS
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#E11D48',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.customer_tag_assignments (
  customer_id UUID NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.customer_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (customer_id, tag_id)
);

ALTER TABLE public.customer_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_tag_assignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage customer_tags"
    ON public.customer_tags FOR ALL
    USING (public.is_authenticated_user())
    WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can manage customer_tag_assignments"
    ON public.customer_tag_assignments FOR ALL
    USING (public.is_authenticated_user())
    WITH CHECK (public.is_authenticated_user());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- 13. SEED DEFAULT TEMPLATES & CANNED RESPONSES (IF NOT ALREADY PRESENT)
-- ----------------------------------------------------------------------------
INSERT INTO public.whatsapp_templates (name, category, language, body_text, variables, status)
VALUES
  (
    'order_ready_fitting',
    'UTILITY',
    'en',
    'Namaste {{1}}, your bespoke outfit for Order #{{2}} is beautifully prepared and ready for final trial at Saree Palace Elite. Please let us know what time suits you to visit! ✨',
    ARRAY['Customer Name', 'Order Number'],
    'APPROVED'
  ),
  (
    'payment_settle_reminder',
    'UTILITY',
    'en',
    'Namaste {{1}}, greeting from Saree Palace Elite. A gentle reminder regarding the pending invoice balance of {{2}}. Click here to pay securely: {{3}}',
    ARRAY['Customer Name', 'Amount', 'Payment Link'],
    'APPROVED'
  ),
  (
    'curation_showcase',
    'MARKETING',
    'en',
    'Namaste {{1}}, we have handpicked an exclusive selection of {{2}} sarees matching your bespoke taste. Reply to view the private digital lookbook! 🌸',
    ARRAY['Customer Name', 'Weave/Fabric Type'],
    'APPROVED'
  ),
  (
    'birthday_privilege_greet',
    'MARKETING',
    'en',
    'Wishing you a very happy birthday {{1}}! 🎉 May your year be as radiant as our finest weaves. Enjoy an exclusive Elite Circle privilege on your next visit.',
    ARRAY['Customer Name'],
    'APPROVED'
  )
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.canned_responses (shortcut, title, content, category)
VALUES
  ('/location', 'Store Location & Hours', '📍 Saree Palace Elite, Commercial Street Flagship. Open daily from 10:30 AM to 8:30 PM. Valet parking available.', 'info'),
  ('/bank', 'Bank Transfer / UPI Details', '🏦 Account Name: Saree Palace Elite\nUPI ID: sareepalace@upi\nBank: HDFC Bank, Commercial Street Branch\nIFSC: HDFC0001234', 'billing'),
  ('/shipping', 'Insured Courier & Delivery Tracking', '📦 All bespoke dispatches are insured with tamper-proof packaging and tracked via BlueDart Express. Tracking link shared via SMS.', 'shipping'),
  ('/alteration', 'Fitting & Alteration Policy', '✂️ All minor blouse and saree fall-pico alterations include complimentary styling adjustments within 14 days of delivery.', 'service')
ON CONFLICT (shortcut) DO NOTHING;
