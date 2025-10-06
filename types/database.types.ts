// Supabase database types
// Generated from database schema

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  age: number;
  gender: string;
  sexual_orientation: string;
  location_city?: string;
  location_state?: string;
  location_country: string;
  latitude?: number;
  longitude?: number;
  bio?: string;
  occupation?: string;
  education?: string;
  height_cm?: number;
  is_verified: boolean;
  verification_status: 'pending' | 'approved' | 'rejected';
  is_premium: boolean;
  is_platinum: boolean;
  is_active: boolean;
  last_active_at: string;
  created_at: string;
  updated_at: string;
}

export interface Photo {
  id: string;
  profile_id: string;
  storage_path: string;
  position: number;
  is_primary: boolean;
  is_public: boolean;
  created_at: string;
}

export interface Preferences {
  id: string;
  profile_id: string;
  max_distance_miles: number;
  willing_to_relocate: boolean;
  preferred_cities?: string[];
  primary_reason: string;
  relationship_type: string;
  wants_children?: boolean;
  children_timeline?: string;
  income_level?: string;
  financial_arrangement?: string;
  housing_preference?: string;
  religion?: string;
  political_views?: string;
  smoking?: string;
  drinking?: string;
  pets?: string;
  public_relationship?: boolean;
  family_involvement?: string;
  age_min: number;
  age_max: number;
  gender_preference?: string[];
  created_at: string;
  updated_at: string;
}

export interface Match {
  id: string;
  profile1_id: string;
  profile2_id: string;
  initiated_by: string;
  matched_at: string;
  status: 'active' | 'unmatched' | 'blocked';
  compatibility_score: number;
  unmatch_reason?: string;
  unmatched_at?: string;
}

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'voice';
  media_url?: string;
  encryption_key?: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface Like {
  id: string;
  from_profile_id: string;
  to_profile_id: string;
  like_type: 'standard' | 'super_like';
  message?: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  revenue_cat_customer_id: string;
  subscription_tier: 'premium' | 'platinum';
  status: 'active' | 'cancelled' | 'expired' | 'trial';
  platform: 'ios' | 'android';
  product_id: string;
  original_purchase_date: string;
  expiration_date: string;
  will_renew: boolean;
  created_at: string;
  updated_at: string;
}
