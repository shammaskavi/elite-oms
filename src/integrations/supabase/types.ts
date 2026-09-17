export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action_type: string
          actor_profile_id: string | null
          created_at: string
          id: string
          payload: Json | null
          resource_id: string | null
          resource_type: string
        }
        Insert: {
          action_type: string
          actor_profile_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          resource_id?: string | null
          resource_type: string
        }
        Update: {
          action_type?: string
          actor_profile_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          resource_id?: string | null
          resource_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      canned_responses: {
        Row: {
          category: string | null
          content: string
          created_at: string
          id: string
          shortcut: string
          title: string
        }
        Insert: {
          category?: string | null
          content: string
          created_at?: string
          id?: string
          shortcut: string
          title: string
        }
        Update: {
          category?: string | null
          content?: string
          created_at?: string
          id?: string
          shortcut?: string
          title?: string
        }
        Relationships: []
      }
      consents: {
        Row: {
          channel: string
          customer_id: string
          granted: boolean
          granted_at: string
          id: string
          revoked_at: string | null
        }
        Insert: {
          channel: string
          customer_id: string
          granted?: boolean
          granted_at?: string
          id?: string
          revoked_at?: string | null
        }
        Update: {
          channel?: string
          customer_id?: string
          granted?: boolean
          granted_at?: string
          id?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activity_events: {
        Row: {
          actor_name: string | null
          created_at: string
          customer_id: string
          description: string | null
          event_type: string
          id: string
          metadata: Json | null
          title: string
        }
        Insert: {
          actor_name?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          title: string
        }
        Update: {
          actor_name?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activity_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          assigned_to: string | null
          budget_range: string | null
          converted_customer_id: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          occasion: string | null
          phone: string
          source: string | null
          stage: string | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          budget_range?: string | null
          converted_customer_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          occasion?: string | null
          phone: string
          source?: string | null
          stage?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          budget_range?: string | null
          converted_customer_id?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          occasion?: string | null
          phone?: string
          source?: string | null
          stage?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_converted_customer_id_fkey"
            columns: ["converted_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_segments: {
        Row: {
          created_at: string
          description: string | null
          filter_criteria: Json
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          filter_criteria?: Json
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          filter_criteria?: Json
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      crm_tasks: {
        Row: {
          assigned_to: string | null
          assigned_to_name: string | null
          completed_at: string | null
          completed_by: string | null
          created_at: string
          customer_id: string
          description: string | null
          due_at: string
          id: string
          priority: string | null
          status: string | null
          task_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          assigned_to_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          customer_id: string
          description?: string | null
          due_at: string
          id?: string
          priority?: string | null
          status?: string | null
          task_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          assigned_to_name?: string | null
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string
          customer_id?: string
          description?: string | null
          due_at?: string
          id?: string
          priority?: string | null
          status?: string | null
          task_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_measurements: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          name: string | null
          source: string | null
          status: string | null
          template_id: string | null
          updated_at: string | null
          values: Json | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          name?: string | null
          source?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
          values?: Json | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          name?: string | null
          source?: string | null
          status?: string | null
          template_id?: string | null
          updated_at?: string | null
          values?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_measurements_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_measurements_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "measurement_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_notes: {
        Row: {
          author_id: string | null
          author_name: string
          content: string
          created_at: string
          customer_id: string
          id: string
          note_type: string | null
          pinned: boolean | null
          tags: string[] | null
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          author_name: string
          content: string
          created_at?: string
          customer_id: string
          id?: string
          note_type?: string | null
          pinned?: boolean | null
          tags?: string[] | null
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          content?: string
          created_at?: string
          customer_id?: string
          id?: string
          note_type?: string | null
          pinned?: boolean | null
          tags?: string[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_notes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payments: {
        Row: {
          amount: number
          created_by: string | null
          customer_id: string
          id: string
          notes: string | null
          payment_method: string
          received_at: string
          reference: string | null
        }
        Insert: {
          amount: number
          created_by?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          payment_method: string
          received_at?: string
          reference?: string | null
        }
        Update: {
          amount?: number
          created_by?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          payment_method?: string
          received_at?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_preferences: {
        Row: {
          blouse_neck_preference: string | null
          blouse_notes: string | null
          blouse_sleeve_preference: string | null
          budget_max: number | null
          budget_min: number | null
          created_at: string
          customer_id: string
          disliked_colors: string[] | null
          favorite_colors: string[] | null
          favorite_fabrics: string[] | null
          favorite_occasions: string[] | null
          favorite_weaves: string[] | null
          general_notes: string | null
          updated_at: string
        }
        Insert: {
          blouse_neck_preference?: string | null
          blouse_notes?: string | null
          blouse_sleeve_preference?: string | null
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          customer_id: string
          disliked_colors?: string[] | null
          favorite_colors?: string[] | null
          favorite_fabrics?: string[] | null
          favorite_occasions?: string[] | null
          favorite_weaves?: string[] | null
          general_notes?: string | null
          updated_at?: string
        }
        Update: {
          blouse_neck_preference?: string | null
          blouse_notes?: string | null
          blouse_sleeve_preference?: string | null
          budget_max?: number | null
          budget_min?: number | null
          created_at?: string
          customer_id?: string
          disliked_colors?: string[] | null
          favorite_colors?: string[] | null
          favorite_fabrics?: string[] | null
          favorite_occasions?: string[] | null
          favorite_weaves?: string[] | null
          general_notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_preferences_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tag_assignments: {
        Row: {
          created_at: string
          customer_id: string
          tag_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          tag_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_tag_assignments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_tag_assignments_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "customer_tags"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_tags: {
        Row: {
          color: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          anniversary: string | null
          created_at: string
          dob: string | null
          elite_circle_level: string | null
          email: string | null
          id: string
          lifecycle_status: string | null
          name: string
          phone: string | null
          preferred_contact_channel: string | null
          preferred_language: string | null
          promotional_consent: boolean | null
          relationship_owner_id: string | null
          transactional_consent: boolean | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          anniversary?: string | null
          created_at?: string
          dob?: string | null
          elite_circle_level?: string | null
          email?: string | null
          id?: string
          lifecycle_status?: string | null
          name: string
          phone?: string | null
          preferred_contact_channel?: string | null
          preferred_language?: string | null
          promotional_consent?: boolean | null
          relationship_owner_id?: string | null
          transactional_consent?: boolean | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          anniversary?: string | null
          created_at?: string
          dob?: string | null
          elite_circle_level?: string | null
          email?: string | null
          id?: string
          lifecycle_status?: string | null
          name?: string
          phone?: string | null
          preferred_contact_channel?: string | null
          preferred_language?: string | null
          promotional_consent?: boolean | null
          relationship_owner_id?: string | null
          transactional_consent?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_items: {
        Row: {
          barcode: string
          brand: string | null
          category: string | null
          created_at: string
          erp_batch: string | null
          erp_code: string | null
          id: string
          metadata: Json | null
          price: number
          product_name: string
          status: string
        }
        Insert: {
          barcode: string
          brand?: string | null
          category?: string | null
          created_at?: string
          erp_batch?: string | null
          erp_code?: string | null
          id?: string
          metadata?: Json | null
          price?: number
          product_name: string
          status?: string
        }
        Update: {
          barcode?: string
          brand?: string | null
          category?: string | null
          created_at?: string
          erp_batch?: string | null
          erp_code?: string | null
          id?: string
          metadata?: Json | null
          price?: number
          product_name?: string
          status?: string
        }
        Relationships: []
      }
      invoice_items: {
        Row: {
          id: string
          invoice_id: string
          name: string
          product_id: string | null
          qty: number
          reference_name: string | null
          sku: string | null
          total: number
          unit_price: number
        }
        Insert: {
          id?: string
          invoice_id: string
          name: string
          product_id?: string | null
          qty?: number
          reference_name?: string | null
          sku?: string | null
          total?: number
          unit_price?: number
        }
        Update: {
          id?: string
          invoice_id?: string
          name?: string
          product_id?: string | null
          qty?: number
          reference_name?: string | null
          sku?: string | null
          total?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_payments: {
        Row: {
          amount: number
          created_at: string
          customer_payment_id: string | null
          date: string
          id: string
          invoice_id: string
          method: string
          reference_id: string | null
          remarks: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          customer_payment_id?: string | null
          date?: string
          id?: string
          invoice_id: string
          method: string
          reference_id?: string | null
          remarks?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          customer_payment_id?: string | null
          date?: string
          id?: string
          invoice_id?: string
          method?: string
          reference_id?: string | null
          remarks?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_payments_customer_payment_id_fkey"
            columns: ["customer_payment_id"]
            isOneToOne: false
            referencedRelation: "customer_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          created_at: string
          customer_id: string | null
          date: string
          file_url: string | null
          id: string
          invoice_number: string
          payment_method: string | null
          payment_status: string
          raw_payload: Json | null
          settled: boolean
          settlement_reason: string | null
          status: string
          subtotal: number | null
          tax: number | null
          total: number
          tracking_token: string | null
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          date?: string
          file_url?: string | null
          id?: string
          invoice_number: string
          payment_method?: string | null
          payment_status?: string
          raw_payload?: Json | null
          settled?: boolean
          settlement_reason?: string | null
          status?: string
          subtotal?: number | null
          tax?: number | null
          total?: number
          tracking_token?: string | null
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          date?: string
          file_url?: string | null
          id?: string
          invoice_number?: string
          payment_method?: string | null
          payment_status?: string
          raw_payload?: Json | null
          settled?: boolean
          settlement_reason?: string | null
          status?: string
          subtotal?: number | null
          tax?: number | null
          total?: number
          tracking_token?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          barcode: string
          code: string
          created_at: string
          id: string
          is_active: boolean
          label: string
          location_type: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          barcode: string
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          label: string
          location_type: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string
          location_type?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_events: {
        Row: {
          created_at: string
          customer_id: string
          data: Json | null
          event_type: string
          id: string
          scheduled_date: string
          status: string
          template: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          data?: Json | null
          event_type: string
          id?: string
          scheduled_date: string
          status?: string
          template?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          data?: Json | null
          event_type?: string
          id?: string
          scheduled_date?: string
          status?: string
          template?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_fields: {
        Row: {
          created_at: string | null
          field_key: string
          id: string
          input_type: string
          label: string
          options: Json | null
          order_index: number | null
          required: boolean | null
          template_id: string | null
          unit: string | null
        }
        Insert: {
          created_at?: string | null
          field_key: string
          id?: string
          input_type: string
          label: string
          options?: Json | null
          order_index?: number | null
          required?: boolean | null
          template_id?: string | null
          unit?: string | null
        }
        Update: {
          created_at?: string | null
          field_key?: string
          id?: string
          input_type?: string
          label?: string
          options?: Json | null
          order_index?: number | null
          required?: boolean | null
          template_id?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "measurement_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "measurement_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_links: {
        Row: {
          created_at: string | null
          customer_id: string | null
          expires_at: string | null
          id: string
          status: string | null
          template_id: string | null
          token: string
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          status?: string | null
          template_id?: string | null
          token: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          expires_at?: string | null
          id?: string
          status?: string | null
          template_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "measurement_links_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_links_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "measurement_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_profile_values: {
        Row: {
          created_at: string | null
          field_key: string
          id: string
          profile_id: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          field_key: string
          id?: string
          profile_id?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          field_key?: string
          id?: string
          profile_id?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "measurement_profile_values_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "measurement_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_profiles: {
        Row: {
          created_at: string | null
          customer_id: string | null
          id: string
          name: string | null
          notes: string | null
          template_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          template_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          id?: string
          name?: string | null
          notes?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "measurement_profiles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "measurement_profiles_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "measurement_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      measurement_templates: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      order_measurements: {
        Row: {
          created_at: string | null
          field_key: string
          id: string
          order_id: string | null
          template_id: string | null
          value: string | null
        }
        Insert: {
          created_at?: string | null
          field_key: string
          id?: string
          order_id?: string | null
          template_id?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string | null
          field_key?: string
          id?: string
          order_id?: string | null
          template_id?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_measurements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_items_calendar_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_measurements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_measurements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_details"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_measurements_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "measurement_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      order_stages: {
        Row: {
          assigned_employee: string | null
          created_at: string
          end_ts: string | null
          id: string
          metadata: Json | null
          new_stage_id: string | null
          new_vendor_id: string | null
          notes: string | null
          order_id: string
          stage_name: string
          start_ts: string | null
          status: string
          vendor_id: string | null
          vendor_name: string | null
        }
        Insert: {
          assigned_employee?: string | null
          created_at?: string
          end_ts?: string | null
          id?: string
          metadata?: Json | null
          new_stage_id?: string | null
          new_vendor_id?: string | null
          notes?: string | null
          order_id: string
          stage_name: string
          start_ts?: string | null
          status?: string
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Update: {
          assigned_employee?: string | null
          created_at?: string
          end_ts?: string | null
          id?: string
          metadata?: Json | null
          new_stage_id?: string | null
          new_vendor_id?: string | null
          notes?: string | null
          order_id?: string
          stage_name?: string
          start_ts?: string | null
          status?: string
          vendor_id?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_stages_new_stage_id_fkey"
            columns: ["new_stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_stages_new_vendor_id_fkey"
            columns: ["new_vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_stages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_items_calendar_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_stages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_stages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_details"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "order_stages_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          invoice_id: string | null
          metadata: Json | null
          order_code: string
          order_status: string
          payment_status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          order_code: string
          order_status?: string
          payment_status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          invoice_id?: string | null
          metadata?: Json | null
          order_code?: string
          order_status?: string
          payment_status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          allocated_amount: number
          created_at: string
          customer_payment_id: string
          id: string
          invoice_id: string
        }
        Insert: {
          allocated_amount: number
          created_at?: string
          customer_payment_id: string
          id?: string
          invoice_id: string
        }
        Update: {
          allocated_amount?: number
          created_at?: string
          customer_payment_id?: string
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_customer_payment_id_fkey"
            columns: ["customer_payment_id"]
            isOneToOne: false
            referencedRelation: "customer_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_allocations_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          category: string | null
          color: string | null
          company_barcode: string | null
          created_at: string
          hsn_code: string | null
          id: string
          inward_date: string | null
          item_code: string | null
          mrp: number | null
          name: string
          price: number | null
          purchase_date: string | null
          purchase_price: number | null
          size: string | null
          sku: string | null
          status: string | null
          stock: number | null
          supplier_name: string | null
        }
        Insert: {
          category?: string | null
          color?: string | null
          company_barcode?: string | null
          created_at?: string
          hsn_code?: string | null
          id?: string
          inward_date?: string | null
          item_code?: string | null
          mrp?: number | null
          name: string
          price?: number | null
          purchase_date?: string | null
          purchase_price?: number | null
          size?: string | null
          sku?: string | null
          status?: string | null
          stock?: number | null
          supplier_name?: string | null
        }
        Update: {
          category?: string | null
          color?: string | null
          company_barcode?: string | null
          created_at?: string
          hsn_code?: string | null
          id?: string
          inward_date?: string | null
          item_code?: string | null
          mrp?: number | null
          name?: string
          price?: number | null
          purchase_date?: string | null
          purchase_price?: number | null
          size?: string | null
          sku?: string | null
          status?: string | null
          stock?: number | null
          supplier_name?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      stages: {
        Row: {
          active: boolean | null
          id: string
          name: string
          order_index: number
        }
        Insert: {
          active?: boolean | null
          id?: string
          name: string
          order_index: number
        }
        Update: {
          active?: boolean | null
          id?: string
          name?: string
          order_index?: number
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          actor_profile_id: string | null
          created_at: string
          from_location_id: string | null
          id: string
          moved_at: string
          movement_type: string
          new_status: string
          notes: string | null
          old_status: string | null
          order_id: string | null
          to_location_id: string | null
          unit_id: string
        }
        Insert: {
          actor_profile_id?: string | null
          created_at?: string
          from_location_id?: string | null
          id?: string
          moved_at?: string
          movement_type: string
          new_status: string
          notes?: string | null
          old_status?: string | null
          order_id?: string | null
          to_location_id?: string | null
          unit_id: string
        }
        Update: {
          actor_profile_id?: string | null
          created_at?: string
          from_location_id?: string | null
          id?: string
          moved_at?: string
          movement_type?: string
          new_status?: string
          notes?: string | null
          old_status?: string | null
          order_id?: string | null
          to_location_id?: string | null
          unit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "order_items_calendar_view"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders_with_details"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "stock_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "stock_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "v_stock_units_deadstock"
            referencedColumns: ["unit_id"]
          },
        ]
      }
      stock_units: {
        Row: {
          cost_price: number | null
          created_at: string
          current_location_id: string | null
          date_received: string
          date_sold: string | null
          id: string
          last_counted_at: string | null
          last_moved_at: string
          notes: string | null
          product_id: string
          source_type: string
          status: string
          unit_code: string
          updated_at: string
        }
        Insert: {
          cost_price?: number | null
          created_at?: string
          current_location_id?: string | null
          date_received?: string
          date_sold?: string | null
          id?: string
          last_counted_at?: string | null
          last_moved_at?: string
          notes?: string | null
          product_id: string
          source_type?: string
          status?: string
          unit_code: string
          updated_at?: string
        }
        Update: {
          cost_price?: number | null
          created_at?: string
          current_location_id?: string | null
          date_received?: string
          date_sold?: string | null
          id?: string
          last_counted_at?: string | null
          last_moved_at?: string
          notes?: string | null
          product_id?: string
          source_type?: string
          status?: string
          unit_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_units_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_push_devices: {
        Row: {
          created_at: string | null
          id: string
          player_id: string
          provider: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          player_id: string
          provider?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          player_id?: string
          provider?: string
          user_id?: string | null
        }
        Relationships: []
      }
      vendors: {
        Row: {
          access_token: string | null
          active: boolean | null
          id: string
          name: string
          portal_enabled: boolean | null
          stage_id: string | null
        }
        Insert: {
          access_token?: string | null
          active?: boolean | null
          id?: string
          name: string
          portal_enabled?: boolean | null
          stage_id?: string | null
        }
        Update: {
          access_token?: string | null
          active?: boolean | null
          id?: string
          name?: string
          portal_enabled?: boolean | null
          stage_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendors_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          assigned_to: string | null
          created_at: string
          customer_id: string
          id: string
          last_customer_message_at: string | null
          last_message_at: string
          phone_number: string
          status: string | null
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          customer_id: string
          id?: string
          last_customer_message_at?: string | null
          last_message_at?: string
          phone_number: string
          status?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          last_customer_message_at?: string | null
          last_message_at?: string
          phone_number?: string
          status?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          conversation_id: string
          created_at: string
          customer_id: string
          direction: string
          error_message: string | null
          id: string
          is_internal_note: boolean | null
          media_type: string | null
          media_url: string | null
          message_type: string
          sender_name: string | null
          sent_at: string
          status: string | null
          template_name: string | null
          text_body: string | null
          wamid: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          customer_id: string
          direction: string
          error_message?: string | null
          id?: string
          is_internal_note?: boolean | null
          media_type?: string | null
          media_url?: string | null
          message_type: string
          sender_name?: string | null
          sent_at?: string
          status?: string | null
          template_name?: string | null
          text_body?: string | null
          wamid?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          customer_id?: string
          direction?: string
          error_message?: string | null
          id?: string
          is_internal_note?: boolean | null
          media_type?: string | null
          media_url?: string | null
          message_type?: string
          sender_name?: string | null
          sent_at?: string
          status?: string | null
          template_name?: string | null
          text_body?: string | null
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          body_text: string
          category: string
          created_at: string
          id: string
          language: string | null
          name: string
          status: string | null
          variables: string[] | null
        }
        Insert: {
          body_text: string
          category: string
          created_at?: string
          id?: string
          language?: string | null
          name: string
          status?: string | null
          variables?: string[] | null
        }
        Update: {
          body_text?: string
          category?: string
          created_at?: string
          id?: string
          language?: string | null
          name?: string
          status?: string | null
          variables?: string[] | null
        }
        Relationships: []
      }
    }
    Views: {
      order_items_calendar_view: {
        Row: {
          created_at: string | null
          customer_name: string | null
          customer_phone: string | null
          delivery_date: string | null
          invoice_id: string | null
          invoice_number: string | null
          item_index: number | null
          item_name: string | null
          order_id: string | null
          stage: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      orders_with_details: {
        Row: {
          customer_name: string | null
          delivery_date: string | null
          invoice_id: string | null
          invoice_number: string | null
          item_name: string | null
          order_id: string | null
          stage_name: string | null
          vendor_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      v_stock_units_deadstock: {
        Row: {
          age_bucket: string | null
          age_days: number | null
          cost_price: number | null
          current_location_id: string | null
          date_received: string | null
          last_moved_at: string | null
          location_code: string | null
          location_label: string | null
          product_category: string | null
          product_id: string | null
          product_mrp: number | null
          product_name: string | null
          status: string | null
          unit_code: string | null
          unit_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_units_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      execute_sql: { Args: { sql: string }; Returns: Json }
      get_cash_inflow_daily:
        | {
            Args: never
            Returns: {
              date: string
              total: number
            }[]
          }
        | {
            Args: { from_date: string; to_date: string }
            Returns: {
              date: string
              total: number
            }[]
          }
      get_delivery_risk: {
        Args: never
        Returns: {
          risk: string
          total_orders: number
        }[]
      }
      get_monthly_owner_summary:
        | { Args: { month_start?: string }; Returns: Json }
        | { Args: { p_month: number; p_year: number }; Returns: Json }
      get_order_stats: { Args: never; Returns: Json }
      get_owner_insights:
        | { Args: never; Returns: Json }
        | { Args: { from_date: string; to_date: string }; Returns: Json }
      get_owner_summary: {
        Args: { from_date: string; to_date: string }
        Returns: Json
      }
      get_process_breakdown: {
        Args: never
        Returns: {
          stage_name: string
          total_orders: number
        }[]
      }
      get_revenue_trend:
        | {
            Args: never
            Returns: {
              booked_revenue: number
              confirmed_revenue: number
              date: string
            }[]
          }
        | {
            Args: { from_date: string; to_date: string }
            Returns: {
              booked_revenue: number
              confirmed_revenue: number
              date: string
            }[]
          }
      get_vendor_load: {
        Args: never
        Returns: {
          active_orders: number
          vendor_id: string
          vendor_name: string
        }[]
      }
      get_vendor_work: {
        Args: { p_token: string }
        Returns: {
          customer_name: string
          delivery_date: string
          invoice_number: string
          item_name: string
          order_id: string
          stage_name: string
          vendor_name: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated_user: { Args: never; Returns: boolean }
      orders_due_today: {
        Args: never
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          invoice_id: string | null
          metadata: Json | null
          order_code: string
          order_status: string
          payment_status: string
          total_amount: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      orders_due_tomorrow: {
        Args: never
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          invoice_id: string | null
          metadata: Json | null
          order_code: string
          order_status: string
          payment_status: string
          total_amount: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      orders_overdue: {
        Args: never
        Returns: {
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          invoice_id: string | null
          metadata: Json | null
          order_code: string
          order_status: string
          payment_status: string
          total_amount: number
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      recalculate_invoice_payment_status: {
        Args: { p_invoice_id: string }
        Returns: undefined
      }
      recount_product_stock: {
        Args: { p_product_id: string }
        Returns: undefined
      }
      relocate: {
        Args: { p_location_code: string; p_notes?: string; p_unit_code: string }
        Returns: string
      }
      update_order_delivery_date: {
        Args: {
          p_actor_profile_id?: string
          p_new_date: string
          p_order_id: string
          p_reason?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "staff"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["admin", "staff"],
    },
  },
} as const
