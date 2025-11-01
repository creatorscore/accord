// Supabase database types
// Generated from live database schema - Last updated: 2025-10-31

export interface Profile {
  // Primary key
  id: string;
  user_id: string;

  // Basic Info
  display_name: string;
  age: number;
  birth_date?: Date | string;
  gender: string;
  pronouns?: string;
  ethnicity?: string;
  sexual_orientation: string;

  // Location
  location_city?: string;
  location_state?: string;
  location_country?: string;
  latitude?: number;
  longitude?: number;

  // Profile Content
  bio?: string;
  my_story?: string;
  occupation?: string;
  education?: string;
  height_inches?: number;

  // Personality & Interests
  zodiac_sign?: string;
  personality_type?: string;
  love_language?: string;
  languages_spoken?: string[];
  religion?: string;
  political_views?: string;
  hobbies?: string[];
  interests?: Record<string, any>;
  prompt_answers?: Array<{ prompt: string; answer: string }>;

  // Voice Intro
  voice_intro_url?: string;
  voice_intro_duration?: number;

  // Verification & Status
  is_verified: boolean;
  is_premium: boolean;
  is_platinum: boolean;
  is_admin: boolean;
  verification_status: string;
  profile_complete: boolean;
  onboarding_step: number;

  // Privacy Settings
  photo_blur_enabled: boolean;
  incognito_mode: boolean;
  hide_last_active: boolean;
  hide_distance: boolean;

  // Encryption
  encryption_public_key?: string;
  public_key?: string; // Deprecated, use encryption_public_key

  // Push Notifications
  push_token?: string;
  push_enabled: boolean;

  // Premium Features
  super_likes_count: number;
  super_likes_reset_date?: Date | string;
  last_boost_at?: Date | string;
  boost_count: number;

  // Reviews System
  review_aggregate_score?: number;
  review_count: number;
  show_reviews: boolean;
  seeking_gender?: string;

  // Timestamps
  last_active_at?: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Photo {
  id: string;
  profile_id: string;
  storage_path: string;
  url: string;
  display_order: number;
  is_primary: boolean;
  moderation_status: string;
  created_at: Date | string;
}

export interface Preferences {
  id: string;
  profile_id: string;

  // Location Preferences
  max_distance_miles: number;
  willing_to_relocate: boolean;
  search_globally: boolean;
  preferred_cities?: string[];

  // Marriage Goals
  primary_reason: string;
  relationship_type: string;
  wants_children?: boolean;
  children_arrangement?: string;

  // Financial & Living
  financial_arrangement?: string;
  housing_preference?: string;

  // Lifestyle
  lifestyle_preferences?: Record<string, any>;

  // Matching Preferences
  age_min: number;
  age_max: number;
  gender_preference?: string[];

  // Dealbreakers & Must-Haves
  dealbreakers?: string[];
  must_haves?: string[];

  created_at: Date | string;
  updated_at: Date | string;
}

export interface Like {
  id: string;
  liker_profile_id: string;
  liked_profile_id: string;
  like_type: string;
  message?: string;
  created_at: Date | string;
}

export interface Pass {
  id: string;
  passer_profile_id: string;
  passed_profile_id: string;
  created_at: Date | string;
}

export interface Match {
  id: string;
  profile1_id: string;
  profile2_id: string;
  initiated_by?: string;
  compatibility_score: number;
  status: string;
  matched_at: Date | string;
  unmatched_by?: string;
  unmatched_at?: Date | string;
  unmatch_reason?: string;
  is_muted: boolean;
  is_archived: boolean;
  is_pinned: boolean;
}

export interface Message {
  id: string;
  match_id: string;
  sender_profile_id: string;
  receiver_profile_id: string;
  encrypted_content: string;
  content_type: string;
  media_url?: string;
  read_at?: Date | string;
  created_at: Date | string;
}

export interface Subscription {
  id: string;
  profile_id: string;
  tier: string;
  revenuecat_customer_id?: string;
  status: string;
  started_at: Date | string;
  expires_at?: Date | string;
  auto_renew: boolean;
  created_at: Date | string;
}

export interface Block {
  id: string;
  blocker_profile_id: string;
  blocked_profile_id: string;
  created_at: Date | string;
}

export interface Report {
  id: string;
  reporter_profile_id?: string;
  reported_profile_id: string;
  reason: string;
  details?: string;
  status: string;
  reviewed_by?: string;
  reviewed_at?: Date | string;
  created_at: Date | string;
}

export interface Boost {
  id: string;
  profile_id: string;
  boost_type: string;
  duration_minutes: number;
  started_at: Date | string;
  expires_at: Date | string;
  is_active: boolean;
  created_at: Date | string;
}

export interface PushNotification {
  id: string;
  profile_id?: string;
  notification_type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  is_read: boolean;
  read_at?: Date | string;
  sent_at: Date | string;
  created_at: Date | string;
}

export interface NotificationQueue {
  id: string;
  recipient_profile_id?: string;
  notification_type: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  status: string;
  attempts: number;
  error?: string;
  created_at: Date | string;
  processed_at?: Date | string;
}

export interface Review {
  id: string;
  match_id: string;
  reviewer_id: string;
  reviewee_id: string;
  communication_responsiveness: number;
  honesty_authenticity: number;
  respect_boundaries: number;
  compatibility_intent: number;
  reliability_followthrough: number;
  overall_rating?: number;
  feedback_text?: string;
  is_visible: boolean;
  is_revealed: boolean;
  revealed_at?: Date | string;
  review_window_expires_at: Date | string;
  is_flagged: boolean;
  flag_reason?: string;
  created_at: Date | string;
}

export interface ReviewPrompt {
  id: string;
  match_id: string;
  profile1_id: string;
  profile2_id: string;
  trigger_date: Date | string;
  window_expires_at: Date | string;
  profile1_reviewed: boolean;
  profile2_reviewed: boolean;
  profile1_notified: boolean;
  profile2_notified: boolean;
  reminder_sent: boolean;
  reviews_revealed: boolean;
  created_at: Date | string;
}

export interface ProfileReviewSettings {
  id: string;
  profile_id: string;
  reviews_enabled: boolean;
  auto_disabled_by_location: boolean;
  disabled_reason?: string;
  show_aggregate_publicly: boolean;
  show_detailed_after_match: boolean;
  minimum_reviews_threshold: number;
  allow_new_reviews: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Waitlist {
  id: string;
  email: string;
  notified: boolean;
  created_at: Date | string;
}

// Database response types
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'id' | 'user_id'>>;
      };
      photos: {
        Row: Photo;
        Insert: Omit<Photo, 'id' | 'created_at'>;
        Update: Partial<Omit<Photo, 'id' | 'profile_id'>>;
      };
      preferences: {
        Row: Preferences;
        Insert: Omit<Preferences, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Preferences, 'id' | 'profile_id'>>;
      };
      likes: {
        Row: Like;
        Insert: Omit<Like, 'id' | 'created_at'>;
        Update: Partial<Omit<Like, 'id'>>;
      };
      passes: {
        Row: Pass;
        Insert: Omit<Pass, 'id' | 'created_at'>;
        Update: Partial<Omit<Pass, 'id'>>;
      };
      matches: {
        Row: Match;
        Insert: Omit<Match, 'id' | 'matched_at'>;
        Update: Partial<Omit<Match, 'id'>>;
      };
      messages: {
        Row: Message;
        Insert: Omit<Message, 'id' | 'created_at'>;
        Update: Partial<Omit<Message, 'id'>>;
      };
      subscriptions: {
        Row: Subscription;
        Insert: Omit<Subscription, 'id' | 'created_at'>;
        Update: Partial<Omit<Subscription, 'id'>>;
      };
      blocks: {
        Row: Block;
        Insert: Omit<Block, 'id' | 'created_at'>;
        Update: Partial<Omit<Block, 'id'>>;
      };
      reports: {
        Row: Report;
        Insert: Omit<Report, 'id' | 'created_at'>;
        Update: Partial<Omit<Report, 'id'>>;
      };
      boosts: {
        Row: Boost;
        Insert: Omit<Boost, 'id' | 'created_at'>;
        Update: Partial<Omit<Boost, 'id'>>;
      };
      push_notifications: {
        Row: PushNotification;
        Insert: Omit<PushNotification, 'id' | 'created_at'>;
        Update: Partial<Omit<PushNotification, 'id'>>;
      };
      notification_queue: {
        Row: NotificationQueue;
        Insert: Omit<NotificationQueue, 'id' | 'created_at'>;
        Update: Partial<Omit<NotificationQueue, 'id'>>;
      };
      reviews: {
        Row: Review;
        Insert: Omit<Review, 'id' | 'created_at'>;
        Update: Partial<Omit<Review, 'id'>>;
      };
      review_prompts: {
        Row: ReviewPrompt;
        Insert: Omit<ReviewPrompt, 'id' | 'created_at'>;
        Update: Partial<Omit<ReviewPrompt, 'id'>>;
      };
      profile_review_settings: {
        Row: ProfileReviewSettings;
        Insert: Omit<ProfileReviewSettings, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ProfileReviewSettings, 'id'>>;
      };
      waitlist: {
        Row: Waitlist;
        Insert: Omit<Waitlist, 'id' | 'created_at'>;
        Update: Partial<Omit<Waitlist, 'id'>>;
      };
    };
  };
};
