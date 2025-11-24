# Accord - AI Assistant Context

## Project Overview

Accord is a native mobile dating application (iOS + Android) designed specifically for individuals seeking lavender marriages - marriages of convenience between LGBTQ+ individuals. The app provides a safe, discreet, and verified platform for meaningful connections that prioritize compatibility, mutual benefit, and safety.

### Core Purpose
- **Safe Connections**: Verified, discreet platform for LGBTQ+ individuals seeking mutually beneficial marriages
- **Privacy-First**: End-to-end encryption, photo blur controls, selective visibility
- **Compatibility Focus**: Advanced matching based on lifestyle, finances, family goals, location
- **Crisis Response**: Addressing the 112% increase in anti-LGBTQ+ sentiment (2022-2024)

### Market Opportunity
- **Target Market**: LGBTQ+ individuals aged 22-40 seeking marriages of convenience
- **Market Size**: 50M+ LGBTQ+ adults in US, dating app use at 2x straight adults
- **Competitive Gap**: Minimal competition (GEN WE just announced, no established players)
- **Revenue Target**: $40K MRR by Month 3 (2,700 paid users)

## Technology Stack

### Mobile Frontend
- **Framework**: React Native with Expo (SDK 54+)
- **Language**: TypeScript 5.9+
- **Navigation**: Expo Router (file-based routing)
- **UI Framework**: React Native Paper (Material Design)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **State Management**: Zustand (global) + React Context (auth, theme)
- **Image Handling**: expo-image-picker, expo-image-manipulator
- **Animations**: React Native Reanimated 3 + Moti
- **Share**: expo-sharing
- **Payments**: RevenueCat SDK (Apple/Google IAP)
- **Push Notifications**: Expo Push Notifications
- **Deep Linking**: Expo Linking

### Backend & Infrastructure
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth (email, Google, Apple Sign-In)
- **Storage**: Supabase Storage (profile images, chat media)
- **Real-time**: Supabase Realtime (messaging, match notifications)
- **API**: Supabase Edge Functions (Deno)
- **Encryption**: Web Crypto API (E2E messaging)
- **Verification**: Persona or Jumio API (identity verification)
- **Background Jobs**: Supabase pg_cron + job queue table

### Development & Deployment
- **Build System**: EAS Build (Expo Application Services)
- **App Distribution**:
  - iOS: Apple App Store + TestFlight
  - Android: Google Play Store + Internal Testing
- **Version Control**: Git + GitHub
- **CI/CD**: EAS Build + GitHub Actions
- **Analytics**: PostHog (React Native SDK)
- **Error Tracking**: Sentry (React Native)
- **Testing**: Expo Go (dev), EAS Build (staging/prod)

### Third-Party Services
- **Payments**: RevenueCat (subscription management)
- **Identity Verification**: Persona/Jumio
- **Geolocation**: Expo Location
- **Notifications**: Expo Push Notifications Service
- **Background Checks**: Checkr API (optional premium feature)

## Database Schema

**IMPORTANT:** When making database changes, always follow the rules in [DATABASE_MIGRATION_RULES.md](./DATABASE_MIGRATION_RULES.md) to ensure backward compatibility across app versions.

### Core Tables

```sql
-- Users (managed by Supabase Auth)
-- auth.users table includes: id, email, phone, created_at, etc.

-- User Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Basic Info
  display_name VARCHAR NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 18 AND age <= 100),
  birth_date DATE, -- Auto-calculates age
  gender VARCHAR, -- Man, Woman, Non-binary, Trans Man, Trans Woman, Other
  pronouns VARCHAR, -- she/her, he/him, they/them, she/they, he/they, any pronouns, ask me, prefer not to say
  ethnicity VARCHAR, -- Asian, Black/African, Hispanic/Latinx, Indigenous/Native, Middle Eastern/North African, Pacific Islander, South Asian, White/Caucasian, Multiracial, Other, Prefer not to say
  sexual_orientation VARCHAR, -- Straight, Lesbian, Gay, Bisexual, Queer, Asexual, Pansexual, Other

  -- Location
  location_city VARCHAR,
  location_state VARCHAR,
  location_country VARCHAR DEFAULT 'US',
  latitude NUMERIC,
  longitude NUMERIC,

  -- Profile Content
  bio TEXT, -- Short bio/tagline
  my_story TEXT, -- Longer narrative (100-1000 characters)
  occupation VARCHAR,
  education VARCHAR,
  height_inches INTEGER, -- Height in inches (e.g., 5'10" = 70 inches)

  -- Personality & Interests
  zodiac_sign VARCHAR, -- Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, Pisces
  personality_type VARCHAR, -- MBTI (e.g., ENFJ, INTJ, ISFP)
  love_language VARCHAR, -- Words of Affirmation, Quality Time, Receiving Gifts, Acts of Service, Physical Touch
  languages_spoken TEXT[], -- Array of languages
  religion VARCHAR, -- Christian, Muslim, Jewish, Hindu, Buddhist, Atheist, Agnostic, Spiritual but not religious, Prefer not to say
  political_views VARCHAR, -- Liberal, Conservative, Moderate, Progressive, Libertarian, Apolitical, Prefer not to say
  hobbies TEXT[], -- Array of hobby tags
  interests JSONB DEFAULT '{}'::jsonb, -- {movies: [], music: [], books: [], tv_shows: []}
  prompt_answers JSONB DEFAULT '[]'::jsonb, -- Array of {prompt, answer} objects

  -- Voice Intro
  voice_intro_url TEXT, -- 30 second voice introduction from Supabase Storage
  voice_intro_duration INTEGER, -- Duration in seconds

  -- Verification & Status
  is_verified BOOLEAN DEFAULT false,
  is_premium BOOLEAN DEFAULT false,
  is_platinum BOOLEAN DEFAULT false,
  is_admin BOOLEAN DEFAULT false,
  verification_status VARCHAR DEFAULT 'pending', -- pending, approved, rejected
  profile_complete BOOLEAN DEFAULT false,
  onboarding_step INTEGER DEFAULT 0,

  -- Privacy Settings
  photo_blur_enabled BOOLEAN DEFAULT false, -- Blur photos until matched
  incognito_mode BOOLEAN DEFAULT false, -- Hide from discovery
  hide_last_active BOOLEAN DEFAULT false,
  hide_distance BOOLEAN DEFAULT false, -- Show "nearby" instead of exact distance

  -- Encryption
  encryption_public_key TEXT, -- Public key for E2E encrypted messaging
  public_key TEXT, -- Deprecated, use encryption_public_key

  -- Push Notifications
  push_token TEXT, -- Expo Push Notification token
  push_enabled BOOLEAN DEFAULT true,

  -- Premium Features
  super_likes_count INTEGER DEFAULT 0, -- Used this week
  super_likes_reset_date TIMESTAMP DEFAULT now(), -- Resets every Sunday
  last_boost_at TIMESTAMP,
  boost_count INTEGER DEFAULT 0,

  -- Reviews System
  review_aggregate_score NUMERIC, -- Average of all visible reviews (null if <5 reviews)
  review_count INTEGER DEFAULT 0, -- Total number of visible reviews
  show_reviews BOOLEAN DEFAULT true, -- Quick toggle for showing/hiding reviews
  seeking_gender TEXT, -- What gender seeking in matches

  -- Timestamps
  last_active_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Profile Photos
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path VARCHAR NOT NULL, -- Supabase storage path
  url TEXT NOT NULL, -- Public URL
  display_order INTEGER DEFAULT 0, -- Order in profile (0-5)
  is_primary BOOLEAN DEFAULT false,
  moderation_status VARCHAR DEFAULT 'pending', -- pending, approved, rejected
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Marriage Preferences & Expectations
CREATE TABLE preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  -- Location Preferences
  max_distance_miles INTEGER DEFAULT 50,
  willing_to_relocate BOOLEAN DEFAULT false,
  search_globally BOOLEAN DEFAULT false, -- Search anywhere in the world

  -- Marriage Goals
  primary_reason VARCHAR NOT NULL, -- financial, immigration, family_pressure, legal_benefits, companionship, safety, other
  relationship_type VARCHAR NOT NULL, -- platonic, romantic, open
  wants_children BOOLEAN,
  children_arrangement VARCHAR, -- How children would be handled

  -- Financial & Living
  financial_arrangement VARCHAR, -- separate, shared_expenses, joint, prenup_required, flexible
  housing_preference VARCHAR, -- separate_spaces, roommates, separate_homes, shared_bedroom, flexible

  -- Lifestyle
  lifestyle_preferences JSONB, -- {smoking, drinking, pets, etc.}

  -- Matching Preferences
  age_min INTEGER DEFAULT 25,
  age_max INTEGER DEFAULT 45,
  gender_preference VARCHAR[] DEFAULT ARRAY[]::VARCHAR[], -- Array of acceptable genders

  -- Dealbreakers & Must-Haves
  dealbreakers TEXT[], -- Array of dealbreakers
  must_haves TEXT[], -- Array of must-haves

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Likes (swipe right)
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liker_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  liked_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  like_type VARCHAR DEFAULT 'standard', -- standard, super
  message TEXT, -- Optional intro message for super likes
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(liker_profile_id, liked_profile_id)
);

-- Passes (swipe left)
CREATE TABLE passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  passer_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  passed_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(passer_profile_id, passed_profile_id)
);

-- Matches (bidirectional connections)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile1_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  profile2_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  initiated_by UUID REFERENCES profiles(id), -- Who liked first
  compatibility_score INTEGER DEFAULT 0, -- 0-100
  status VARCHAR DEFAULT 'active', -- active, unmatched, blocked
  matched_at TIMESTAMPTZ DEFAULT now(),
  unmatched_by UUID REFERENCES profiles(id), -- Who initiated unmatch
  unmatched_at TIMESTAMPTZ,
  unmatch_reason TEXT,
  is_muted BOOLEAN DEFAULT false,
  is_archived BOOLEAN DEFAULT false,
  is_pinned BOOLEAN DEFAULT false,
  UNIQUE(profile1_id, profile2_id),
  CHECK (profile1_id < profile2_id) -- Ensure ordered pair
);

-- Messages (end-to-end encrypted)
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  sender_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL, -- Encrypted message content
  content_type VARCHAR DEFAULT 'text', -- text, image, video, voice
  media_url TEXT, -- For image/video/voice messages
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_match ON messages(match_id, created_at DESC);
CREATE INDEX idx_messages_unread ON messages(receiver_profile_id, read_at) WHERE read_at IS NULL;

-- Subscriptions (synced from RevenueCat)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  tier VARCHAR NOT NULL, -- premium, platinum
  revenuecat_customer_id VARCHAR,
  status VARCHAR DEFAULT 'active', -- active, cancelled, expired, trial
  started_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Blocks & Reports
CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(blocker_profile_id, blocked_profile_id)
);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reported_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reason VARCHAR NOT NULL, -- harassment, fake_profile, inappropriate_content, scam, other
  details TEXT,
  status VARCHAR DEFAULT 'pending', -- pending, reviewing, resolved, dismissed
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Profile Boosts (visibility increases)
CREATE TABLE boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  boost_type VARCHAR DEFAULT 'standard', -- standard, super
  duration_minutes INTEGER DEFAULT 30,
  started_at TIMESTAMP DEFAULT now(),
  expires_at TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT now()
);

-- Push Notifications Log
CREATE TABLE push_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type VARCHAR NOT NULL, -- new_match, new_message, profile_liked, etc.
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB, -- Additional data payload
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  sent_at TIMESTAMP DEFAULT now(),
  created_at TIMESTAMP DEFAULT now()
);

-- Notification Queue (for background processing)
CREATE TABLE notification_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipient_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  notification_type VARCHAR NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB,
  status VARCHAR DEFAULT 'pending', -- pending, sent, failed
  attempts INTEGER DEFAULT 0,
  error TEXT,
  created_at TIMESTAMP DEFAULT now(),
  processed_at TIMESTAMP
);

-- Reviews System (Airbnb-style mutual reviews)
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  -- 5 Category Ratings (1-5 stars each)
  communication_responsiveness INTEGER NOT NULL CHECK (communication_responsiveness >= 1 AND communication_responsiveness <= 5),
  honesty_authenticity INTEGER NOT NULL CHECK (honesty_authenticity >= 1 AND honesty_authenticity <= 5),
  respect_boundaries INTEGER NOT NULL CHECK (respect_boundaries >= 1 AND respect_boundaries <= 5),
  compatibility_intent INTEGER NOT NULL CHECK (compatibility_intent >= 1 AND compatibility_intent <= 5),
  reliability_followthrough INTEGER NOT NULL CHECK (reliability_followthrough >= 1 AND reliability_followthrough <= 5),

  overall_rating NUMERIC, -- Calculated average
  feedback_text TEXT, -- Optional written feedback

  -- Visibility & Moderation
  is_visible BOOLEAN DEFAULT false, -- Whether shown publicly
  is_revealed BOOLEAN DEFAULT false, -- Whether revealed to reviewee
  revealed_at TIMESTAMPTZ,
  review_window_expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '3 days'), -- Auto-reveal after 3 days

  is_flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Review Prompts (manages review timing)
CREATE TABLE review_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE UNIQUE,
  profile1_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  profile2_id UUID REFERENCES profiles(id) ON DELETE CASCADE,

  trigger_date TIMESTAMPTZ NOT NULL, -- 7 days after match
  window_expires_at TIMESTAMPTZ NOT NULL, -- trigger + 3 days

  profile1_reviewed BOOLEAN DEFAULT false,
  profile2_reviewed BOOLEAN DEFAULT false,
  profile1_notified BOOLEAN DEFAULT false,
  profile2_notified BOOLEAN DEFAULT false,
  reminder_sent BOOLEAN DEFAULT false,
  reviews_revealed BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT now()
);

-- Profile Review Settings
CREATE TABLE profile_review_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  reviews_enabled BOOLEAN DEFAULT true, -- Master toggle
  auto_disabled_by_location BOOLEAN DEFAULT false, -- Auto-disabled in high-risk countries
  disabled_reason TEXT,

  show_aggregate_publicly BOOLEAN DEFAULT true,
  show_detailed_after_match BOOLEAN DEFAULT true,
  minimum_reviews_threshold INTEGER DEFAULT 5,
  allow_new_reviews BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Waitlist (pre-launch)
CREATE TABLE waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  notified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now())
);
```

### Row Level Security (RLS) Policies

All tables have RLS enabled for security. Key policies:

```sql
-- Profiles: Users can read their own + active profiles
CREATE POLICY "Users view own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users view active profiles" ON profiles FOR SELECT USING (is_active = true AND incognito_mode = false);

-- Photos: Users manage their own, view public photos
CREATE POLICY "Users manage own photos" ON photos FOR ALL USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Users view public photos" ON photos FOR SELECT USING (moderation_status = 'approved');

-- Messages: Users only see their own messages
CREATE POLICY "Users view their messages" ON messages FOR SELECT USING (
  sender_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  receiver_profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Matches: Users view their own matches
CREATE POLICY "Users view their matches" ON matches FOR SELECT USING (
  profile1_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  profile2_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Subscriptions: Users view their own subscription
CREATE POLICY "Users view own subscription" ON subscriptions FOR SELECT USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);
```

## API Architecture

### Supabase Edge Functions

```
POST /functions/v1/matching/calculate
- Calculate compatibility score between two profiles
- Input: { profile1_id, profile2_id }
- Output: { compatibility_score, reasoning }

POST /functions/v1/matching/discover
- Get batch of potential matches for user
- Input: { profile_id, limit: 20 }
- Output: { profiles: [], pagination }

POST /functions/v1/matching/like
- User likes another profile
- Check if mutual match
- Input: { from_profile_id, to_profile_id, like_type, message }
- Output: { is_match: boolean, match_id? }

POST /functions/v1/messaging/send
- Send message (encrypt before storing)
- Input: { match_id, sender_id, content, message_type }
- Output: { message_id, created_at }

POST /functions/v1/verification/initiate
- Start identity verification flow with Persona/Jumio
- Input: { profile_id, verification_type }
- Output: { verification_url, session_id }

POST /functions/v1/webhooks/revenuecat
- Handle RevenueCat webhook events
- Update subscription status in database
- Grant/revoke premium features

POST /functions/v1/webhooks/verification
- Handle verification provider webhooks (Persona/Jumio)
- Update verification status
- Send notification to user

POST /functions/v1/profile/boost
- Activate profile boost (increase visibility)
- Input: { profile_id, boost_type, duration }
- Output: { boost_id, expires_at }

GET /functions/v1/analytics/profile-stats
- Get profile performance metrics
- Input: { profile_id }
- Output: { views, likes_received, matches, response_rate }
```

### Supabase Realtime Subscriptions

```javascript
// Listen for new matches
supabase
  .channel('matches')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'matches',
    filter: `profile1_id=eq.${currentProfileId} OR profile2_id=eq.${currentProfileId}`
  }, handleNewMatch)
  .subscribe()

// Listen for new messages
supabase
  .channel(`messages:${matchId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `match_id=eq.${matchId}`
  }, handleNewMessage)
  .subscribe()

// Listen for likes (premium feature - see who liked you)
supabase
  .channel('likes')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'likes',
    filter: `to_profile_id=eq.${currentProfileId}`
  }, handleNewLike)
  .subscribe()
```

## Matching Algorithm

### Compatibility Score Calculation

```typescript
interface CompatibilityFactors {
  location: number;        // 25% weight - Distance between users
  goals: number;          // 20% weight - Marriage goals alignment
  lifestyle: number;      // 20% weight - Lifestyle compatibility
  financial: number;      // 15% weight - Financial expectations
  timeline: number;       // 10% weight - Children/marriage timeline
  values: number;         // 10% weight - Religion, politics, etc.
}

function calculateCompatibilityScore(
  profile1: Profile,
  profile2: Profile,
  prefs1: Preferences,
  prefs2: Preferences
): number {
  const factors: CompatibilityFactors = {
    location: calculateLocationScore(profile1, profile2, prefs1, prefs2),
    goals: calculateGoalsScore(prefs1, prefs2),
    lifestyle: calculateLifestyleScore(prefs1, prefs2),
    financial: calculateFinancialScore(prefs1, prefs2),
    timeline: calculateTimelineScore(prefs1, prefs2),
    values: calculateValuesScore(prefs1, prefs2)
  };

  // Weighted average
  const score =
    factors.location * 0.25 +
    factors.goals * 0.20 +
    factors.lifestyle * 0.20 +
    factors.financial * 0.15 +
    factors.timeline * 0.10 +
    factors.values * 0.10;

  return Math.round(score * 100) / 100; // Round to 2 decimals
}

function calculateLocationScore(p1, p2, prefs1, prefs2): number {
  const distance = getDistanceMiles(p1.latitude, p1.longitude, p2.latitude, p2.longitude);

  // Check dealbreaker: max distance
  if (distance > prefs1.max_distance_miles || distance > prefs2.max_distance_miles) {
    if (!prefs1.willing_to_relocate && !prefs2.willing_to_relocate) {
      return 0; // Hard fail
    }
  }

  // Score based on distance
  if (distance < 10) return 100;
  if (distance < 25) return 90;
  if (distance < 50) return 75;
  if (distance < 100) return 60;
  if (prefs1.willing_to_relocate || prefs2.willing_to_relocate) return 50;
  return 30;
}

function calculateGoalsScore(prefs1, prefs2): number {
  let score = 100;

  // Primary reason alignment
  if (prefs1.primary_reason === prefs2.primary_reason) score += 20;

  // Relationship type compatibility
  const typeMatrix = {
    'platonic-platonic': 100,
    'platonic-romantic': 40,
    'platonic-open': 60,
    'romantic-romantic': 100,
    'romantic-open': 70,
    'open-open': 100
  };
  const key = `${prefs1.relationship_type}-${prefs2.relationship_type}`;
  score *= (typeMatrix[key] || 50) / 100;

  return Math.min(score, 100);
}

function calculateLifestyleScore(prefs1, prefs2): number {
  let score = 100;

  // Smoking compatibility
  if ((prefs1.smoking === 'never' && prefs2.smoking === 'regularly') ||
      (prefs2.smoking === 'never' && prefs1.smoking === 'regularly')) {
    score -= 30;
  }

  // Pets compatibility
  if ((prefs1.pets === 'allergic' && prefs2.pets === 'love_them') ||
      (prefs2.pets === 'allergic' && prefs1.pets === 'love_them')) {
    score -= 20;
  }

  // Housing preference
  if (prefs1.housing_preference === prefs2.housing_preference) score += 10;

  return Math.max(score, 0);
}
```

## Security & Privacy Features

### End-to-End Encryption (Messaging)

```typescript
// Client-side encryption for messages
import { generateKeyPair, encrypt, decrypt } from './crypto';

class SecureMessaging {
  async sendMessage(content: string, recipientPublicKey: string) {
    const encryptedContent = await encrypt(content, recipientPublicKey);

    await supabase.from('messages').insert({
      match_id,
      sender_id,
      receiver_id,
      content: encryptedContent,
      encryption_key: recipientPublicKey
    });
  }

  async receiveMessage(message: Message, privateKey: string) {
    const decryptedContent = await decrypt(message.content, privateKey);
    return decryptedContent;
  }
}

// Generate key pair on registration
async function setupEncryption(userId: string) {
  const { publicKey, privateKey } = await generateKeyPair();

  // Store public key in profile (for others to encrypt messages to this user)
  await supabase.from('profiles').update({
    public_key: publicKey
  }).eq('user_id', userId);

  // Store private key securely in device keychain
  await SecureStore.setItemAsync(`private_key_${userId}`, privateKey);
}
```

### Privacy Controls

```typescript
interface PrivacySettings {
  photo_blur_mode: boolean;           // Blur photos until match
  incognito_mode: boolean;            // Don't appear in discovery
  hide_last_active: boolean;          // Don't show "Active 2h ago"
  show_distance: boolean;             // Show exact distance or just "nearby"
  allow_screenshots: boolean;         // Attempt to prevent screenshots (iOS only)
  share_verification_status: boolean; // Show verified badge publicly
}

// Photo blur implementation
<Image
  source={{ uri: photo.url }}
  style={[
    styles.photo,
    profile.privacy_settings.photo_blur_mode && !isMatched && { opacity: 0.1 }
  ]}
  blurRadius={profile.privacy_settings.photo_blur_mode && !isMatched ? 20 : 0}
/>
```

### Safety Features

- **Profile Verification**: Identity + video selfie verification
- **Block & Report**: Immediate blocking with optional report submission
- **Automated Moderation**: AI detection of inappropriate content in messages/photos
- **Background Checks**: Optional integration with Checkr (premium feature)
- **Safety Center**: In-app resources about safe meeting, relationship contracts, legal resources

## File Structure

```
accord/
├── CLAUDE.md                          # This file
├── accord-prd.md                      # Product requirements document
├── README.md                          # Project overview
├── package.json
├── app.json                           # Expo configuration
├── tsconfig.json
├── babel.config.js
├── .env.example
├── .gitignore
│
├── app/                               # Expo Router screens
│   ├── (auth)/                        # Auth flow
│   │   ├── welcome.tsx
│   │   ├── sign-in.tsx
│   │   ├── sign-up.tsx
│   │   └── _layout.tsx
│   ├── (tabs)/                        # Main app tabs
│   │   ├── discover.tsx               # Swipe/matching screen
│   │   ├── matches.tsx                # Matches list
│   │   ├── messages.tsx               # Conversations
│   │   ├── profile.tsx                # User's own profile
│   │   └── _layout.tsx                # Tab navigator
│   ├── (onboarding)/                  # Profile setup flow
│   │   ├── basic-info.tsx
│   │   ├── photos.tsx
│   │   ├── preferences.tsx
│   │   ├── goals.tsx
│   │   └── verification.tsx
│   ├── profile/[id].tsx               # View other user profile
│   ├── chat/[matchId].tsx             # Message thread
│   ├── settings/                      # Settings screens
│   │   ├── index.tsx
│   │   ├── privacy.tsx
│   │   ├── subscription.tsx
│   │   └── safety-center.tsx
│   ├── verification/                  # Verification flow
│   │   ├── identity.tsx
│   │   └── video-selfie.tsx
│   ├── index.tsx                      # Root entry
│   └── _layout.tsx                    # Root layout
│
├── components/                        # Reusable UI components
│   ├── matching/
│   │   ├── SwipeCard.tsx              # Tinder-style swipe card
│   │   ├── ProfilePreview.tsx
│   │   └── CompatibilityScore.tsx
│   ├── messaging/
│   │   ├── MessageBubble.tsx
│   │   ├── ChatInput.tsx
│   │   └── MessageList.tsx
│   ├── profile/
│   │   ├── PhotoGrid.tsx
│   │   ├── ProfileHeader.tsx
│   │   ├── AboutSection.tsx
│   │   └── PreferencesSection.tsx
│   ├── onboarding/
│   │   ├── ProgressIndicator.tsx
│   │   └── StepCard.tsx
│   ├── shared/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   ├── Avatar.tsx
│   │   └── Modal.tsx
│   └── premium/
│       ├── PaywallModal.tsx
│       └── SubscriptionCard.tsx
│
├── lib/                               # Utilities & services
│   ├── supabase.ts                    # Supabase client
│   ├── matching-algorithm.ts          # Compatibility calculation
│   ├── encryption.ts                  # E2E encryption helpers
│   ├── revenue-cat.ts                 # RevenueCat integration
│   ├── verification.ts                # Persona/Jumio integration
│   ├── geolocation.ts                 # Distance calculations
│   ├── image-utils.ts                 # Image compression/manipulation
│   └── analytics.ts                   # PostHog tracking
│
├── contexts/                          # React Context providers
│   ├── AuthContext.tsx                # Auth state
│   ├── ProfileContext.tsx             # Current user profile
│   ├── SubscriptionContext.tsx        # Premium status
│   └── ThemeContext.tsx               # Dark/light mode
│
├── stores/                            # Zustand stores
│   ├── matchingStore.ts               # Matching state
│   ├── messagingStore.ts              # Message state
│   └── notificationStore.ts           # Notifications
│
├── types/                             # TypeScript type definitions
│   ├── database.types.ts              # Supabase generated types
│   ├── profile.types.ts
│   ├── matching.types.ts
│   └── messaging.types.ts
│
├── hooks/                             # Custom React hooks
│   ├── useAuth.ts
│   ├── useProfile.ts
│   ├── useMatches.ts
│   ├── useMessages.ts
│   └── useSubscription.ts
│
├── assets/                            # Static assets
│   ├── images/
│   ├── icons/
│   └── fonts/
│
└── supabase/                          # Backend code
    ├── migrations/                    # Database migrations
    │   └── 001_initial_schema.sql
    └── functions/                     # Edge functions
        ├── matching-calculate/
        ├── matching-discover/
        ├── verification-webhook/
        └── revenuecat-webhook/
```

## Key Dependencies

```json
{
  "dependencies": {
    "@react-native-async-storage/async-storage": "^2.2.0",
    "@supabase/supabase-js": "^2.58.0",
    "expo": "~54.0.0",
    "expo-constants": "^18.0.0",
    "expo-crypto": "^14.0.0",
    "expo-file-system": "~19.0.0",
    "expo-image-manipulator": "^14.0.0",
    "expo-image-picker": "^17.0.0",
    "expo-linking": "^8.0.0",
    "expo-location": "^18.0.0",
    "expo-notifications": "^1.0.0",
    "expo-router": "^6.0.0",
    "expo-secure-store": "^14.0.0",
    "expo-status-bar": "^3.0.0",
    "react": "19.1.0",
    "react-native": "0.81.4",
    "react-native-gesture-handler": "^2.20.0",
    "react-native-paper": "^5.15.0",
    "react-native-purchases": "^9.5.0",
    "react-native-reanimated": "^4.1.0",
    "react-native-safe-area-context": "^5.6.0",
    "react-native-screens": "^4.16.0",
    "nativewind": "^4.1.0",
    "zustand": "^5.0.0",
    "posthog-react-native": "^4.0.0"
  }
}
```

## Development Workflow

### Local Development
```bash
# Start Expo dev server
npm run start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Type checking
npm run type-check

# Linting
npm run lint
```

### Building for Production
```bash
# Build for iOS (TestFlight/App Store)
eas build --platform ios --profile production

# Build for Android (Internal Testing/Play Store)
eas build --platform android --profile production

# Submit to stores
eas submit --platform ios
eas submit --platform android
```

## Environment Variables

```bash
# .env.example
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Verification
PERSONA_API_KEY=your-persona-key
PERSONA_TEMPLATE_ID=your-template-id

# Analytics
POSTHOG_API_KEY=your-posthog-key

# RevenueCat
REVENUECAT_APPLE_API_KEY=your-ios-key
REVENUECAT_GOOGLE_API_KEY=your-android-key

# Sentry
SENTRY_DSN=your-sentry-dsn
```

## Monitoring & Analytics

### Key Metrics to Track
- **User Acquisition**: Downloads, signups, completion rate
- **Engagement**: DAU/MAU, swipes per session, messages sent
- **Matching**: Match rate, conversation start rate, response rate
- **Monetization**: Conversion to paid, ARPU, LTV, churn
- **Verification**: Verification completion rate, approval rate

### Error Tracking
- Sentry for crash reports
- PostHog for session replay (privacy-compliant)
- Custom error logging for API failures

## Security Considerations

1. **Data Encryption**: All sensitive data encrypted at rest and in transit
2. **RLS Policies**: Supabase Row Level Security enforced
3. **API Security**: Rate limiting on all endpoints
4. **Privacy Compliance**: GDPR, CCPA compliant data handling
5. **Content Moderation**: AI + manual review for inappropriate content
6. **Secure Storage**: Use Expo SecureStore for sensitive data (encryption keys)

## Future Enhancements (Post-MVP)

- **Video Profiles**: 15-second intro videos
- **Events & Meetups**: In-app events for lavender marriage community
- **Legal Resources**: Partnership with LGBTQ+ family law attorneys
- **Relationship Contracts**: Templates for prenups, cohabitation agreements
- **Success Stories**: Anonymous testimonials from matched couples
- **AI Matching Coach**: Personalized tips to improve match rate
- **Web App**: Browser-based version for desktop users

---

**Note**: This is a living document. Update as architecture evolves and features are added.
