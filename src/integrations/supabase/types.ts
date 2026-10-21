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
  public: {
    Tables: {
      ad_conversion_log: {
        Row: {
          consent_record_id: string | null
          event_id: string
          event_name: string
          http_status: number | null
          lead_id: string | null
          occurred_at: string
          recorded_at: string
          status: string
        }
        Insert: {
          consent_record_id?: string | null
          event_id: string
          event_name: string
          http_status?: number | null
          lead_id?: string | null
          occurred_at: string
          recorded_at?: string
          status?: string
        }
        Update: {
          consent_record_id?: string | null
          event_id?: string
          event_name?: string
          http_status?: number | null
          lead_id?: string | null
          occurred_at?: string
          recorded_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_conversion_log_consent_record_id_fkey"
            columns: ["consent_record_id"]
            isOneToOne: false
            referencedRelation: "advertising_consent_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ad_conversion_log_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      advertising_consent_records: {
        Row: {
          advertising: boolean
          analytics: boolean
          captured_at: string
          id: string
          notice_text: string
          notice_version: string
          region: string
          visitor_token: string
        }
        Insert: {
          advertising: boolean
          analytics?: boolean
          captured_at?: string
          id?: string
          notice_text: string
          notice_version: string
          region?: string
          visitor_token: string
        }
        Update: {
          advertising?: boolean
          analytics?: boolean
          captured_at?: string
          id?: string
          notice_text?: string
          notice_version?: string
          region?: string
          visitor_token?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          metadata: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          metadata?: Json | null
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          author_id: string | null
          auto_generated: boolean
          body_md: string
          category: string | null
          cover_alt: string | null
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          gen_notes: string | null
          id: string
          published_at: string | null
          reading_minutes: number
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: string
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          auto_generated?: boolean
          body_md?: string
          category?: string | null
          cover_alt?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          gen_notes?: string | null
          id?: string
          published_at?: string | null
          reading_minutes?: number
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          auto_generated?: boolean
          body_md?: string
          category?: string | null
          cover_alt?: string | null
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          gen_notes?: string | null
          id?: string
          published_at?: string | null
          reading_minutes?: number
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      brand_assets: {
        Row: {
          created_at: string
          created_by: string | null
          data_base64: string
          height: number | null
          id: string
          kind: string
          label: string
          metadata: Json | null
          mime: string
          pair_id: string | null
          pair_mode: string | null
          palette: string | null
          platform: string | null
          prompt: string | null
          variant: string | null
          width: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_base64: string
          height?: number | null
          id?: string
          kind: string
          label: string
          metadata?: Json | null
          mime?: string
          pair_id?: string | null
          pair_mode?: string | null
          palette?: string | null
          platform?: string | null
          prompt?: string | null
          variant?: string | null
          width?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_base64?: string
          height?: number | null
          id?: string
          kind?: string
          label?: string
          metadata?: Json | null
          mime?: string
          pair_id?: string | null
          pair_mode?: string | null
          palette?: string | null
          platform?: string | null
          prompt?: string | null
          variant?: string | null
          width?: number | null
        }
        Relationships: []
      }
      consent_records: {
        Row: {
          captured_at: string
          consent_accuracy: boolean
          consent_contact: boolean
          consent_credit_check: boolean
          consent_not_guarantee: boolean
          id: string
          ip_address: string | null
          lead_id: string
          marketing_opt_in: boolean
          policy_version: string
          user_agent: string | null
        }
        Insert: {
          captured_at?: string
          consent_accuracy?: boolean
          consent_contact?: boolean
          consent_credit_check?: boolean
          consent_not_guarantee?: boolean
          id?: string
          ip_address?: string | null
          lead_id: string
          marketing_opt_in?: boolean
          policy_version: string
          user_agent?: string | null
        }
        Update: {
          captured_at?: string
          consent_accuracy?: boolean
          consent_contact?: boolean
          consent_credit_check?: boolean
          consent_not_guarantee?: boolean
          id?: string
          ip_address?: string | null
          lead_id?: string
          marketing_opt_in?: boolean
          policy_version?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          is_read: boolean
          message: string
          name: string
          read_at: string | null
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          is_read?: boolean
          message: string
          name: string
          read_at?: string | null
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          is_read?: boolean
          message?: string
          name?: string
          read_at?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      crm_contacts: {
        Row: {
          company: string | null
          created_at: string
          created_by: string | null
          email: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      distribution_lists: {
        Row: {
          cities: string[]
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          last_assigned_contact_id: string | null
          marks_contacted: boolean
          mode: string
          name: string
          next_contact_id: string | null
          priority: number
          provinces: string[]
          updated_at: string
        }
        Insert: {
          cities?: string[]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_assigned_contact_id?: string | null
          marks_contacted?: boolean
          mode?: string
          name: string
          next_contact_id?: string | null
          priority?: number
          provinces?: string[]
          updated_at?: string
        }
        Update: {
          cities?: string[]
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_assigned_contact_id?: string | null
          marks_contacted?: boolean
          mode?: string
          name?: string
          next_contact_id?: string | null
          priority?: number
          provinces?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribution_lists_next_contact_id_fkey"
            columns: ["next_contact_id"]
            isOneToOne: false
            referencedRelation: "lead_delivery_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      happy_clients: {
        Row: {
          accent_color: string | null
          client_name: string
          created_at: string
          created_by: string | null
          display_order: number
          id: string
          is_active: boolean
          location: string | null
          photo_url: string
          quote: string
          updated_at: string
          vehicle: string | null
        }
        Insert: {
          accent_color?: string | null
          client_name: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          location?: string | null
          photo_url: string
          quote: string
          updated_at?: string
          vehicle?: string | null
        }
        Update: {
          accent_color?: string | null
          client_name?: string
          created_at?: string
          created_by?: string | null
          display_order?: number
          id?: string
          is_active?: boolean
          location?: string | null
          photo_url?: string
          quote?: string
          updated_at?: string
          vehicle?: string | null
        }
        Relationships: []
      }
      intake_rate_limits: {
        Row: {
          attempts: number
          bucket_key: string
          expires_at: string
        }
        Insert: {
          attempts?: number
          bucket_key: string
          expires_at: string
        }
        Update: {
          attempts?: number
          bucket_key?: string
          expires_at?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          input: Json
          kind: string
          label: string
          progress: number
          result: Json | null
          started_at: string | null
          status: string
          trigger_token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          kind: string
          label: string
          progress?: number
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_token?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          kind?: string
          label?: string
          progress?: number
          result?: Json | null
          started_at?: string | null
          status?: string
          trigger_token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_delivery_contacts: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          id: string
          is_active: boolean
          is_first_contact: boolean
          kind: string
          list_id: string | null
          name: string | null
          rotation_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          id?: string
          is_active?: boolean
          is_first_contact?: boolean
          kind?: string
          list_id?: string | null
          name?: string | null
          rotation_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          id?: string
          is_active?: boolean
          is_first_contact?: boolean
          kind?: string
          list_id?: string | null
          name?: string | null
          rotation_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_delivery_contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "distribution_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_distribution_assignments: {
        Row: {
          contact_id: string
          created_at: string
          id: string
          lead_id: string
          list_id: string
        }
        Insert: {
          contact_id: string
          created_at?: string
          id?: string
          lead_id: string
          list_id: string
        }
        Update: {
          contact_id?: string
          created_at?: string
          id?: string
          lead_id?: string
          list_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_distribution_assignments_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "lead_delivery_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distribution_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_distribution_assignments_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "distribution_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          lead_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          lead_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          lead_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sends: {
        Row: {
          excluded_from_count: boolean
          exclusion_reason: string | null
          id: string
          lead_id: string
          recipient_email: string
          recipient_name: string | null
          sent_at: string
          sent_by: string | null
        }
        Insert: {
          excluded_from_count?: boolean
          exclusion_reason?: string | null
          id?: string
          lead_id: string
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string
          sent_by?: string | null
        }
        Update: {
          excluded_from_count?: boolean
          exclusion_reason?: string | null
          id?: string
          lead_id?: string
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string
          sent_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_sends_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_status_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: string
          lead_id: string
          new_status: string
          old_status: string | null
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          lead_id: string
          new_status: string
          old_status?: string | null
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: string
          lead_id?: string
          new_status?: string
          old_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_status_history_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          additional_income: string | null
          additional_income_amount: string | null
          additional_income_source: string | null
          address_length: string | null
          address_months: string | null
          address_years: string | null
          advertising_consent_id: string | null
          assigned_to: string | null
          attribution_channel: string | null
          best_time_to_contact: string | null
          business_name: string | null
          business_type: string | null
          city: string | null
          completion_pct: number
          consent_accuracy: boolean
          consent_contact: boolean
          consent_contact_captured_at: string | null
          consent_credit_check: boolean
          consent_ip: string | null
          consent_marketing: boolean
          consent_not_guarantee: boolean
          consent_policy_version: string | null
          consent_timestamp: string | null
          consent_user_agent: string | null
          created_at: string
          credit_rating: string | null
          current_step: string | null
          date_of_birth: string | null
          device: string | null
          down_payment: string | null
          duplicate_detected_at: string | null
          duplicate_of: string | null
          email: string | null
          email_notified_at: string | null
          employer_name: string | null
          employer_phone: string | null
          employment_length: string | null
          employment_status: string | null
          extra: Json | null
          fbclid: string | null
          first_contact_by: string | null
          first_contact_source: string | null
          first_contacted_at: string | null
          first_name: string | null
          follow_up_date: string | null
          funnel_variant: string | null
          gclid: string | null
          has_drivers_licence: string | null
          has_trade_in: string | null
          id: string
          income_amount: string | null
          income_months: string | null
          income_type: string | null
          income_years: string | null
          industry: string | null
          ip_address: string | null
          is_canadian_resident: string | null
          is_test: boolean
          job_title: string | null
          landing_page: string | null
          last_activity_at: string
          last_name: string | null
          last_reminder_at: string | null
          lead_score: number
          licence_class: string | null
          licence_province: string | null
          monthly_budget: string | null
          monthly_housing_payment: string | null
          msclkid: string | null
          notes_summary: string | null
          notes_summary_at: string | null
          pay_frequency: string | null
          phone: string | null
          postal_code: string | null
          preferred_contact: string | null
          prev_city: string | null
          prev_postal_code: string | null
          prev_province: string | null
          prev_street_address: string | null
          province: string | null
          purchase_timeline: string | null
          referrer: string | null
          reminders_sent: number
          residence_status: string | null
          resume_token: string | null
          source: string | null
          status: Database["public"]["Enums"]["lead_status"]
          street_address: string | null
          submitted_at: string | null
          trade_in_amount_owing: string | null
          trade_in_condition: string | null
          trade_in_loan_owing: string | null
          trade_in_make: string | null
          trade_in_mileage: string | null
          trade_in_model: string | null
          trade_in_trim: string | null
          trade_in_year: string | null
          updated_at: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          vehicle_condition: string | null
          vehicle_type: string | null
          years_in_business: string | null
        }
        Insert: {
          additional_income?: string | null
          additional_income_amount?: string | null
          additional_income_source?: string | null
          address_length?: string | null
          address_months?: string | null
          address_years?: string | null
          advertising_consent_id?: string | null
          assigned_to?: string | null
          attribution_channel?: string | null
          best_time_to_contact?: string | null
          business_name?: string | null
          business_type?: string | null
          city?: string | null
          completion_pct?: number
          consent_accuracy?: boolean
          consent_contact?: boolean
          consent_contact_captured_at?: string | null
          consent_credit_check?: boolean
          consent_ip?: string | null
          consent_marketing?: boolean
          consent_not_guarantee?: boolean
          consent_policy_version?: string | null
          consent_timestamp?: string | null
          consent_user_agent?: string | null
          created_at?: string
          credit_rating?: string | null
          current_step?: string | null
          date_of_birth?: string | null
          device?: string | null
          down_payment?: string | null
          duplicate_detected_at?: string | null
          duplicate_of?: string | null
          email?: string | null
          email_notified_at?: string | null
          employer_name?: string | null
          employer_phone?: string | null
          employment_length?: string | null
          employment_status?: string | null
          extra?: Json | null
          fbclid?: string | null
          first_contact_by?: string | null
          first_contact_source?: string | null
          first_contacted_at?: string | null
          first_name?: string | null
          follow_up_date?: string | null
          funnel_variant?: string | null
          gclid?: string | null
          has_drivers_licence?: string | null
          has_trade_in?: string | null
          id?: string
          income_amount?: string | null
          income_months?: string | null
          income_type?: string | null
          income_years?: string | null
          industry?: string | null
          ip_address?: string | null
          is_canadian_resident?: string | null
          is_test?: boolean
          job_title?: string | null
          landing_page?: string | null
          last_activity_at?: string
          last_name?: string | null
          last_reminder_at?: string | null
          lead_score?: number
          licence_class?: string | null
          licence_province?: string | null
          monthly_budget?: string | null
          monthly_housing_payment?: string | null
          msclkid?: string | null
          notes_summary?: string | null
          notes_summary_at?: string | null
          pay_frequency?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_contact?: string | null
          prev_city?: string | null
          prev_postal_code?: string | null
          prev_province?: string | null
          prev_street_address?: string | null
          province?: string | null
          purchase_timeline?: string | null
          referrer?: string | null
          reminders_sent?: number
          residence_status?: string | null
          resume_token?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          street_address?: string | null
          submitted_at?: string | null
          trade_in_amount_owing?: string | null
          trade_in_condition?: string | null
          trade_in_loan_owing?: string | null
          trade_in_make?: string | null
          trade_in_mileage?: string | null
          trade_in_model?: string | null
          trade_in_trim?: string | null
          trade_in_year?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          vehicle_condition?: string | null
          vehicle_type?: string | null
          years_in_business?: string | null
        }
        Update: {
          additional_income?: string | null
          additional_income_amount?: string | null
          additional_income_source?: string | null
          address_length?: string | null
          address_months?: string | null
          address_years?: string | null
          advertising_consent_id?: string | null
          assigned_to?: string | null
          attribution_channel?: string | null
          best_time_to_contact?: string | null
          business_name?: string | null
          business_type?: string | null
          city?: string | null
          completion_pct?: number
          consent_accuracy?: boolean
          consent_contact?: boolean
          consent_contact_captured_at?: string | null
          consent_credit_check?: boolean
          consent_ip?: string | null
          consent_marketing?: boolean
          consent_not_guarantee?: boolean
          consent_policy_version?: string | null
          consent_timestamp?: string | null
          consent_user_agent?: string | null
          created_at?: string
          credit_rating?: string | null
          current_step?: string | null
          date_of_birth?: string | null
          device?: string | null
          down_payment?: string | null
          duplicate_detected_at?: string | null
          duplicate_of?: string | null
          email?: string | null
          email_notified_at?: string | null
          employer_name?: string | null
          employer_phone?: string | null
          employment_length?: string | null
          employment_status?: string | null
          extra?: Json | null
          fbclid?: string | null
          first_contact_by?: string | null
          first_contact_source?: string | null
          first_contacted_at?: string | null
          first_name?: string | null
          follow_up_date?: string | null
          funnel_variant?: string | null
          gclid?: string | null
          has_drivers_licence?: string | null
          has_trade_in?: string | null
          id?: string
          income_amount?: string | null
          income_months?: string | null
          income_type?: string | null
          income_years?: string | null
          industry?: string | null
          ip_address?: string | null
          is_canadian_resident?: string | null
          is_test?: boolean
          job_title?: string | null
          landing_page?: string | null
          last_activity_at?: string
          last_name?: string | null
          last_reminder_at?: string | null
          lead_score?: number
          licence_class?: string | null
          licence_province?: string | null
          monthly_budget?: string | null
          monthly_housing_payment?: string | null
          msclkid?: string | null
          notes_summary?: string | null
          notes_summary_at?: string | null
          pay_frequency?: string | null
          phone?: string | null
          postal_code?: string | null
          preferred_contact?: string | null
          prev_city?: string | null
          prev_postal_code?: string | null
          prev_province?: string | null
          prev_street_address?: string | null
          province?: string | null
          purchase_timeline?: string | null
          referrer?: string | null
          reminders_sent?: number
          residence_status?: string | null
          resume_token?: string | null
          source?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          street_address?: string | null
          submitted_at?: string | null
          trade_in_amount_owing?: string | null
          trade_in_condition?: string | null
          trade_in_loan_owing?: string | null
          trade_in_make?: string | null
          trade_in_mileage?: string | null
          trade_in_model?: string | null
          trade_in_trim?: string | null
          trade_in_year?: string | null
          updated_at?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          vehicle_condition?: string | null
          vehicle_type?: string | null
          years_in_business?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_advertising_consent_id_fkey"
            columns: ["advertising_consent_id"]
            isOneToOne: false
            referencedRelation: "advertising_consent_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_duplicate_of_fkey"
            columns: ["duplicate_of"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          body_md: string
          created_at: string
          effective_date: string
          id: string
          slug: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_md?: string
          created_at?: string
          effective_date?: string
          id?: string
          slug: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_md?: string
          created_at?: string
          effective_date?: string
          id?: string
          slug?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notification_log: {
        Row: {
          created_at: string
          error: string | null
          id: string
          kind: string
          lead_id: string | null
          recipient: string
          status: string
          subject: string | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          kind: string
          lead_id?: string | null
          recipient: string
          status: string
          subject?: string | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          kind?: string
          lead_id?: string | null
          recipient?: string
          status?: string
          subject?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      site_content: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_rotation_contact: {
        Args: { _lead_id: string; _list_id: string }
        Returns: string
      }
      claim_intake_rate_limit: {
        Args: { _bucket_key: string }
        Returns: boolean
      }
      compute_lead_score: {
        Args: { l: Database["public"]["Tables"]["leads"]["Row"] }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      next_rotation_contact: { Args: { _list_id: string }; Returns: string }
      purge_anonymous_drafts: { Args: never; Returns: number }
      reap_stuck_jobs: { Args: never; Returns: undefined }
    }
    Enums: {
      app_role: "superadmin" | "admin" | "agent" | "viewer"
      lead_status:
        | "draft"
        | "partial"
        | "new"
        | "submitted"
        | "contacted"
        | "qualified"
        | "sent_to_dealer"
        | "approved"
        | "sold"
        | "not_qualified"
        | "duplicate"
        | "archived"
        | "contact_attempted"
        | "not_proceeding"
        | "closed"
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
  public: {
    Enums: {
      app_role: ["superadmin", "admin", "agent", "viewer"],
      lead_status: [
        "draft",
        "partial",
        "new",
        "submitted",
        "contacted",
        "qualified",
        "sent_to_dealer",
        "approved",
        "sold",
        "not_qualified",
        "duplicate",
        "archived",
        "contact_attempted",
        "not_proceeding",
        "closed",
      ],
    },
  },
} as const
