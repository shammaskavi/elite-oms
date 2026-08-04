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
    PostgrestVersion: "13.0.5"
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
      locations: {
        Row: {
          id: string
          code: string
          label: string
          location_type: string
          parent_id: string | null
          barcode: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          code: string
          label: string
          location_type: string
          parent_id?: string | null
          barcode: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          code?: string
          label?: string
          location_type?: string
          parent_id?: string | null
          barcode?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          }
        ]
      }
      stock_units: {
        Row: {
          id: string
          unit_code: string
          product_id: string
          current_location_id: string | null
          status: string
          source_type: string
          cost_price: number | null
          date_received: string
          date_sold: string | null
          last_moved_at: string
          last_counted_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          unit_code: string
          product_id: string
          current_location_id?: string | null
          status?: string
          source_type?: string
          cost_price?: number | null
          date_received?: string
          date_sold?: string | null
          last_moved_at?: string
          last_counted_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          unit_code?: string
          product_id?: string
          current_location_id?: string | null
          status?: string
          source_type?: string
          cost_price?: number | null
          date_received?: string
          date_sold?: string | null
          last_moved_at?: string
          last_counted_at?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_units_current_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          }
        ]
      }
      stock_movements: {
        Row: {
          id: string
          unit_id: string
          movement_type: string
          from_location_id: string | null
          to_location_id: string | null
          old_status: string | null
          new_status: string
          actor_profile_id: string | null
          order_id: string | null
          moved_at: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          unit_id: string
          movement_type: string
          from_location_id?: string | null
          to_location_id?: string | null
          old_status?: string | null
          new_status: string
          actor_profile_id?: string | null
          order_id?: string | null
          moved_at?: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          unit_id?: string
          movement_type?: string
          from_location_id?: string | null
          to_location_id?: string | null
          old_status?: string | null
          new_status?: string
          actor_profile_id?: string | null
          order_id?: string | null
          moved_at?: string
          notes?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "stock_units"
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
            foreignKeyName: "stock_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          }
        ]
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
      customers: {
        Row: {
          address: string | null
          anniversary: string | null
          created_at: string
          dob: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          anniversary?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          anniversary?: string | null
          created_at?: string
          dob?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
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
    }
    Views: {
      v_stock_units_deadstock: {
        Row: {
          unit_id: string | null
          unit_code: string | null
          product_id: string | null
          current_location_id: string | null
          status: string | null
          cost_price: number | null
          date_received: string | null
          last_moved_at: string | null
          product_name: string | null
          product_category: string | null
          product_mrp: number | null
          location_label: string | null
          location_code: string | null
          age_days: number | null
          age_bucket: string | null
        }
        Relationships: []
      }
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
    }
    Functions: {
      relocate: {
        Args: {
          p_unit_code: string
          p_location_code: string
          p_notes?: string
        }
        Returns: string
      }
      recount_product_stock: {
        Args: {
          p_product_id: string
        }
        Returns: unknown
      }
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "staff"],
    },
  },
} as const
