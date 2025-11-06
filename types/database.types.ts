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
      bans: {
        Row: {
          admin_notes: string | null
          ban_reason: string
          banned_by: string | null
          banned_device_id: string | null
          banned_email: string | null
          banned_phone_hash: string | null
          banned_profile_id: string | null
          banned_user_id: string | null
          created_at: string | null
          expires_at: string | null
          id: string
          is_permanent: boolean | null
          report_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          ban_reason: string
          banned_by?: string | null
          banned_device_id?: string | null
          banned_email?: string | null
          banned_phone_hash?: string | null
          banned_profile_id?: string | null
          banned_user_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_permanent?: boolean | null
          report_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          ban_reason?: string
          banned_by?: string | null
          banned_device_id?: string | null
          banned_email?: string | null
          banned_phone_hash?: string | null
          banned_profile_id?: string | null
          banned_user_id?: string | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_permanent?: boolean | null
          report_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bans_banned_by_fkey"
            columns: ["banned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bans_banned_profile_id_fkey"
            columns: ["banned_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bans_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "reports"
            referencedColumns: ["id"]
          },
        ]
      }
      blocks: {
        Row: {
          blocked_profile_id: string
          blocker_profile_id: string
          created_at: string | null
          id: string
        }
        Insert: {
          blocked_profile_id: string
          blocker_profile_id: string
          created_at?: string | null
          id?: string
        }
        Update: {
          blocked_profile_id?: string
          blocker_profile_id?: string
          created_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_profile_id_fkey"
            columns: ["blocked_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_profile_id_fkey"
            columns: ["blocker_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      boosts: {
        Row: {
          boost_type: string | null
          created_at: string | null
          duration_minutes: number | null
          expires_at: string
          id: string
          is_active: boolean | null
          profile_id: string
          started_at: string | null
        }
        Insert: {
          boost_type?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          expires_at: string
          id?: string
          is_active?: boolean | null
          profile_id: string
          started_at?: string | null
        }
        Update: {
          boost_type?: string | null
          created_at?: string | null
          duration_minutes?: number | null
          expires_at?: string
          id?: string
          is_active?: boolean | null
          profile_id?: string
          started_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "boosts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_blocks: {
        Row: {
          blocked_at: string | null
          created_at: string | null
          id: string
          phone_number: string
          profile_id: string
        }
        Insert: {
          blocked_at?: string | null
          created_at?: string | null
          id?: string
          phone_number: string
          profile_id: string
        }
        Update: {
          blocked_at?: string | null
          created_at?: string | null
          id?: string
          phone_number?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_blocks_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_alerts: {
        Row: {
          alert_message: string
          alert_type: string
          created_at: string | null
          current_value: number
          id: string
          threshold_value: number
        }
        Insert: {
          alert_message: string
          alert_type: string
          created_at?: string | null
          current_value: number
          id?: string
          threshold_value: number
        }
        Update: {
          alert_message?: string
          alert_type?: string
          created_at?: string | null
          current_value?: number
          id?: string
          threshold_value?: number
        }
        Relationships: []
      }
      likes: {
        Row: {
          created_at: string | null
          id: string
          like_type: string | null
          liked_profile_id: string
          liker_profile_id: string
          message: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          like_type?: string | null
          liked_profile_id: string
          liker_profile_id: string
          message?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          like_type?: string | null
          liked_profile_id?: string
          liker_profile_id?: string
          message?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "likes_liked_profile_id_fkey"
            columns: ["liked_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "likes_liker_profile_id_fkey"
            columns: ["liker_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          compatibility_score: number | null
          id: string
          initiated_by: string | null
          is_archived: boolean | null
          is_muted: boolean | null
          is_pinned: boolean | null
          matched_at: string | null
          profile1_id: string
          profile2_id: string
          status: string | null
          unmatch_reason: string | null
          unmatched_at: string | null
          unmatched_by: string | null
        }
        Insert: {
          compatibility_score?: number | null
          id?: string
          initiated_by?: string | null
          is_archived?: boolean | null
          is_muted?: boolean | null
          is_pinned?: boolean | null
          matched_at?: string | null
          profile1_id: string
          profile2_id: string
          status?: string | null
          unmatch_reason?: string | null
          unmatched_at?: string | null
          unmatched_by?: string | null
        }
        Update: {
          compatibility_score?: number | null
          id?: string
          initiated_by?: string | null
          is_archived?: boolean | null
          is_muted?: boolean | null
          is_pinned?: boolean | null
          matched_at?: string | null
          profile1_id?: string
          profile2_id?: string
          status?: string | null
          unmatch_reason?: string | null
          unmatched_at?: string | null
          unmatched_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_initiated_by_fkey"
            columns: ["initiated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_profile1_id_fkey"
            columns: ["profile1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_profile2_id_fkey"
            columns: ["profile2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_unmatched_by_fkey"
            columns: ["unmatched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content_type: string | null
          created_at: string | null
          encrypted_content: string
          id: string
          match_id: string
          media_url: string | null
          read_at: string | null
          receiver_profile_id: string
          sender_profile_id: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string | null
          encrypted_content: string
          id?: string
          match_id: string
          media_url?: string | null
          read_at?: string | null
          receiver_profile_id: string
          sender_profile_id: string
        }
        Update: {
          content_type?: string | null
          created_at?: string | null
          encrypted_content?: string
          id?: string
          match_id?: string
          media_url?: string | null
          read_at?: string | null
          receiver_profile_id?: string
          sender_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_receiver_profile_id_fkey"
            columns: ["receiver_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_queue: {
        Row: {
          attempts: number | null
          body: string
          created_at: string | null
          data: Json | null
          error: string | null
          id: string
          notification_type: string
          processed_at: string | null
          recipient_profile_id: string | null
          status: string | null
          title: string
        }
        Insert: {
          attempts?: number | null
          body: string
          created_at?: string | null
          data?: Json | null
          error?: string | null
          id?: string
          notification_type: string
          processed_at?: string | null
          recipient_profile_id?: string | null
          status?: string | null
          title: string
        }
        Update: {
          attempts?: number | null
          body?: string
          created_at?: string | null
          data?: Json | null
          error?: string | null
          id?: string
          notification_type?: string
          processed_at?: string | null
          recipient_profile_id?: string | null
          status?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_queue_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      passes: {
        Row: {
          created_at: string | null
          id: string
          passed_profile_id: string
          passer_profile_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          passed_profile_id: string
          passer_profile_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          passed_profile_id?: string
          passer_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "passes_passed_profile_id_fkey"
            columns: ["passed_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "passes_passer_profile_id_fkey"
            columns: ["passer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_reveals: {
        Row: {
          created_at: string | null
          id: string
          match_id: string | null
          revealed_at: string | null
          revealed_to_profile_id: string
          revealer_profile_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          match_id?: string | null
          revealed_at?: string | null
          revealed_to_profile_id: string
          revealer_profile_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          match_id?: string | null
          revealed_at?: string | null
          revealed_to_profile_id?: string
          revealer_profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_reveals_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_reveals_revealed_to_profile_id_fkey"
            columns: ["revealed_to_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photo_reveals_revealer_profile_id_fkey"
            columns: ["revealer_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          created_at: string | null
          display_order: number
          id: string
          is_primary: boolean | null
          moderation_status: string | null
          profile_id: string
          storage_path: string
          url: string
        }
        Insert: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_primary?: boolean | null
          moderation_status?: string | null
          profile_id: string
          storage_path: string
          url: string
        }
        Update: {
          created_at?: string | null
          display_order?: number
          id?: string
          is_primary?: boolean | null
          moderation_status?: string | null
          profile_id?: string
          storage_path?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "photos_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      preferences: {
        Row: {
          age_max: number | null
          age_min: number | null
          children_arrangement: string[] | null
          created_at: string | null
          dealbreakers: string[] | null
          financial_arrangement: string[] | null
          gender_preference: string[] | null
          housing_preference: string[] | null
          id: string
          lifestyle_preferences: Json | null
          max_distance_miles: number | null
          must_haves: string[] | null
          preferred_cities: string[] | null
          primary_reason: string
          profile_id: string
          relationship_type: string
          search_globally: boolean | null
          updated_at: string | null
          wants_children: boolean | null
          willing_to_relocate: boolean | null
        }
        Insert: {
          age_max?: number | null
          age_min?: number | null
          children_arrangement?: string[] | null
          created_at?: string | null
          dealbreakers?: string[] | null
          financial_arrangement?: string[] | null
          gender_preference?: string[] | null
          housing_preference?: string[] | null
          id?: string
          lifestyle_preferences?: Json | null
          max_distance_miles?: number | null
          must_haves?: string[] | null
          preferred_cities?: string[] | null
          primary_reason: string
          profile_id: string
          relationship_type: string
          search_globally?: boolean | null
          updated_at?: string | null
          wants_children?: boolean | null
          willing_to_relocate?: boolean | null
        }
        Update: {
          age_max?: number | null
          age_min?: number | null
          children_arrangement?: string[] | null
          created_at?: string | null
          dealbreakers?: string[] | null
          financial_arrangement?: string[] | null
          gender_preference?: string[] | null
          housing_preference?: string[] | null
          id?: string
          lifestyle_preferences?: Json | null
          max_distance_miles?: number | null
          must_haves?: string[] | null
          preferred_cities?: string[] | null
          primary_reason?: string
          profile_id?: string
          relationship_type?: string
          search_globally?: boolean | null
          updated_at?: string | null
          wants_children?: boolean | null
          willing_to_relocate?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "preferences_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_review_settings: {
        Row: {
          allow_new_reviews: boolean
          auto_disabled_by_location: boolean
          created_at: string
          disabled_reason: string | null
          id: string
          minimum_reviews_threshold: number
          profile_id: string
          reviews_enabled: boolean
          show_aggregate_publicly: boolean
          show_detailed_after_match: boolean
          updated_at: string
        }
        Insert: {
          allow_new_reviews?: boolean
          auto_disabled_by_location?: boolean
          created_at?: string
          disabled_reason?: string | null
          id?: string
          minimum_reviews_threshold?: number
          profile_id: string
          reviews_enabled?: boolean
          show_aggregate_publicly?: boolean
          show_detailed_after_match?: boolean
          updated_at?: string
        }
        Update: {
          allow_new_reviews?: boolean
          auto_disabled_by_location?: boolean
          created_at?: string
          disabled_reason?: string | null
          id?: string
          minimum_reviews_threshold?: number
          profile_id?: string
          reviews_enabled?: boolean
          show_aggregate_publicly?: boolean
          show_detailed_after_match?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_review_settings_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          age: number
          ban_reason: string | null
          bio: string | null
          birth_date: string | null
          boost_count: number | null
          created_at: string | null
          device_id: string | null
          display_name: string
          education: string | null
          encryption_public_key: string | null
          ethnicity: string[] | null
          gender: string[]
          height_inches: number | null
          hide_distance: boolean | null
          hide_last_active: boolean | null
          hobbies: string[] | null
          id: string
          incognito_mode: boolean | null
          interests: Json | null
          is_active: boolean | null
          is_admin: boolean | null
          is_platinum: boolean | null
          is_premium: boolean | null
          is_verified: boolean | null
          languages_spoken: string[] | null
          last_active_at: string | null
          last_boost_at: string | null
          latitude: number | null
          location_city: string | null
          location_country: string | null
          location_state: string | null
          longitude: number | null
          love_language: string[] | null
          my_story: string | null
          occupation: string | null
          onboarding_step: number | null
          personality_type: string | null
          photo_blur_enabled: boolean | null
          political_views: string | null
          profile_complete: boolean | null
          prompt_answers: Json | null
          pronouns: string | null
          public_key: string | null
          push_enabled: boolean | null
          push_token: string | null
          religion: string | null
          review_aggregate_score: number | null
          review_count: number
          sexual_orientation: string[]
          show_reviews: boolean
          super_likes_count: number | null
          super_likes_reset_date: string | null
          updated_at: string | null
          user_id: string
          verification_status: string | null
          voice_intro_duration: number | null
          voice_intro_url: string | null
          zodiac_sign: string | null
        }
        Insert: {
          age: number
          ban_reason?: string | null
          bio?: string | null
          birth_date?: string | null
          boost_count?: number | null
          created_at?: string | null
          device_id?: string | null
          display_name: string
          education?: string | null
          encryption_public_key?: string | null
          ethnicity?: string[] | null
          gender: string[]
          height_inches?: number | null
          hide_distance?: boolean | null
          hide_last_active?: boolean | null
          hobbies?: string[] | null
          id?: string
          incognito_mode?: boolean | null
          interests?: Json | null
          is_active?: boolean | null
          is_admin?: boolean | null
          is_platinum?: boolean | null
          is_premium?: boolean | null
          is_verified?: boolean | null
          languages_spoken?: string[] | null
          last_active_at?: string | null
          last_boost_at?: string | null
          latitude?: number | null
          location_city?: string | null
          location_country?: string | null
          location_state?: string | null
          longitude?: number | null
          love_language?: string[] | null
          my_story?: string | null
          occupation?: string | null
          onboarding_step?: number | null
          personality_type?: string | null
          photo_blur_enabled?: boolean | null
          political_views?: string | null
          profile_complete?: boolean | null
          prompt_answers?: Json | null
          pronouns?: string | null
          public_key?: string | null
          push_enabled?: boolean | null
          push_token?: string | null
          religion?: string | null
          review_aggregate_score?: number | null
          review_count?: number
          sexual_orientation: string[]
          show_reviews?: boolean
          super_likes_count?: number | null
          super_likes_reset_date?: string | null
          updated_at?: string | null
          user_id: string
          verification_status?: string | null
          voice_intro_duration?: number | null
          voice_intro_url?: string | null
          zodiac_sign?: string | null
        }
        Update: {
          age?: number
          ban_reason?: string | null
          bio?: string | null
          birth_date?: string | null
          boost_count?: number | null
          created_at?: string | null
          device_id?: string | null
          display_name?: string
          education?: string | null
          encryption_public_key?: string | null
          ethnicity?: string[] | null
          gender?: string[]
          height_inches?: number | null
          hide_distance?: boolean | null
          hide_last_active?: boolean | null
          hobbies?: string[] | null
          id?: string
          incognito_mode?: boolean | null
          interests?: Json | null
          is_active?: boolean | null
          is_admin?: boolean | null
          is_platinum?: boolean | null
          is_premium?: boolean | null
          is_verified?: boolean | null
          languages_spoken?: string[] | null
          last_active_at?: string | null
          last_boost_at?: string | null
          latitude?: number | null
          location_city?: string | null
          location_country?: string | null
          location_state?: string | null
          longitude?: number | null
          love_language?: string[] | null
          my_story?: string | null
          occupation?: string | null
          onboarding_step?: number | null
          personality_type?: string | null
          photo_blur_enabled?: boolean | null
          political_views?: string | null
          profile_complete?: boolean | null
          prompt_answers?: Json | null
          pronouns?: string | null
          public_key?: string | null
          push_enabled?: boolean | null
          push_token?: string | null
          religion?: string | null
          review_aggregate_score?: number | null
          review_count?: number
          sexual_orientation?: string[]
          show_reviews?: boolean
          super_likes_count?: number | null
          super_likes_reset_date?: string | null
          updated_at?: string | null
          user_id?: string
          verification_status?: string | null
          voice_intro_duration?: number | null
          voice_intro_url?: string | null
          zodiac_sign?: string | null
        }
        Relationships: []
      }
      push_notifications: {
        Row: {
          body: string
          created_at: string | null
          data: Json | null
          id: string
          is_read: boolean | null
          notification_type: string
          profile_id: string | null
          read_at: string | null
          sent_at: string | null
          title: string
        }
        Insert: {
          body: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          notification_type: string
          profile_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          title: string
        }
        Update: {
          body?: string
          created_at?: string | null
          data?: Json | null
          id?: string
          is_read?: boolean | null
          notification_type?: string
          profile_id?: string | null
          read_at?: string | null
          sent_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string | null
          details: string | null
          id: string
          reason: string
          reported_profile_id: string
          reporter_profile_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          details?: string | null
          id?: string
          reason: string
          reported_profile_id: string
          reporter_profile_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          details?: string | null
          id?: string
          reason?: string
          reported_profile_id?: string
          reporter_profile_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_profile_id_fkey"
            columns: ["reported_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_profile_id_fkey"
            columns: ["reporter_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_prompts: {
        Row: {
          created_at: string
          id: string
          match_id: string
          profile1_id: string
          profile1_notified: boolean
          profile1_reviewed: boolean
          profile2_id: string
          profile2_notified: boolean
          profile2_reviewed: boolean
          reminder_sent: boolean
          reviews_revealed: boolean
          trigger_date: string
          window_expires_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          match_id: string
          profile1_id: string
          profile1_notified?: boolean
          profile1_reviewed?: boolean
          profile2_id: string
          profile2_notified?: boolean
          profile2_reviewed?: boolean
          reminder_sent?: boolean
          reviews_revealed?: boolean
          trigger_date: string
          window_expires_at: string
        }
        Update: {
          created_at?: string
          id?: string
          match_id?: string
          profile1_id?: string
          profile1_notified?: boolean
          profile1_reviewed?: boolean
          profile2_id?: string
          profile2_notified?: boolean
          profile2_reviewed?: boolean
          reminder_sent?: boolean
          reviews_revealed?: boolean
          trigger_date?: string
          window_expires_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_prompts_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: true
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_prompts_profile1_id_fkey"
            columns: ["profile1_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_prompts_profile2_id_fkey"
            columns: ["profile2_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          communication_responsiveness: number
          compatibility_intent: number
          created_at: string
          feedback_text: string | null
          flag_reason: string | null
          honesty_authenticity: number
          id: string
          is_flagged: boolean
          is_revealed: boolean
          is_visible: boolean
          match_id: string
          overall_rating: number
          reliability_followthrough: number
          respect_boundaries: number
          revealed_at: string | null
          review_window_expires_at: string
          reviewee_id: string
          reviewer_id: string
        }
        Insert: {
          communication_responsiveness: number
          compatibility_intent: number
          created_at?: string
          feedback_text?: string | null
          flag_reason?: string | null
          honesty_authenticity: number
          id?: string
          is_flagged?: boolean
          is_revealed?: boolean
          is_visible?: boolean
          match_id: string
          overall_rating: number
          reliability_followthrough: number
          respect_boundaries: number
          revealed_at?: string | null
          review_window_expires_at?: string
          reviewee_id: string
          reviewer_id: string
        }
        Update: {
          communication_responsiveness?: number
          compatibility_intent?: number
          created_at?: string
          feedback_text?: string | null
          flag_reason?: string | null
          honesty_authenticity?: number
          id?: string
          is_flagged?: boolean
          is_revealed?: boolean
          is_visible?: boolean
          match_id?: string
          overall_rating?: number
          reliability_followthrough?: number
          respect_boundaries?: number
          revealed_at?: string | null
          review_window_expires_at?: string
          reviewee_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewee_id_fkey"
            columns: ["reviewee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_usage_log: {
        Row: {
          avg_photos_per_user: number | null
          id: string
          logged_at: string | null
          total_photos: number | null
          total_storage_bytes: number | null
          total_users: number | null
        }
        Insert: {
          avg_photos_per_user?: number | null
          id?: string
          logged_at?: string | null
          total_photos?: number | null
          total_storage_bytes?: number | null
          total_users?: number | null
        }
        Update: {
          avg_photos_per_user?: number | null
          id?: string
          logged_at?: string | null
          total_photos?: number | null
          total_storage_bytes?: number | null
          total_users?: number | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          auto_renew: boolean | null
          created_at: string | null
          expires_at: string | null
          id: string
          profile_id: string
          revenuecat_customer_id: string | null
          started_at: string | null
          status: string | null
          tier: string
        }
        Insert: {
          auto_renew?: boolean | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          profile_id: string
          revenuecat_customer_id?: string | null
          started_at?: string | null
          status?: string | null
          tier: string
        }
        Update: {
          auto_renew?: boolean | null
          created_at?: string | null
          expires_at?: string | null
          id?: string
          profile_id?: string
          revenuecat_customer_id?: string | null
          started_at?: string | null
          status?: string | null
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          notified: boolean | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notified?: boolean | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notified?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      table_sizes: {
        Row: {
          schemaname: unknown
          size: string | null
          size_bytes: number | null
          tablename: unknown
        }
        Relationships: []
      }
    }
    Functions: {
      auto_reveal_expired_reviews: { Args: never; Returns: number }
      check_cost_thresholds: { Args: never; Returns: undefined }
      cleanup_inactive_matches: { Args: never; Returns: undefined }
      cleanup_old_bans: { Args: never; Returns: undefined }
      cleanup_old_messages: { Args: never; Returns: undefined }
      cleanup_orphaned_photos: { Args: never; Returns: undefined }
      expire_old_boosts: { Args: never; Returns: undefined }
      get_table_sizes: {
        Args: never
        Returns: {
          schemaname: unknown
          size: string
          size_bytes: number
          tablename: unknown
        }[]
      }
      is_banned: {
        Args: {
          check_device_id?: string
          check_email?: string
          check_phone_hash?: string
          check_user_id?: string
        }
        Returns: boolean
      }
      log_storage_usage: { Args: never; Returns: undefined }
      queue_notification: {
        Args: {
          p_body: string
          p_data?: Json
          p_notification_type: string
          p_recipient_profile_id: string
          p_title: string
        }
        Returns: string
      }
      trigger_notification_processing: { Args: never; Returns: undefined }
      unmatch_user: {
        Args: {
          p_match_id: string
          p_reason?: string
          p_unmatcher_profile_id: string
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
    Enums: {},
  },
} as const
