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

### Core Tables

```sql
-- Users (managed by Supabase Auth)
-- auth.users table includes: id, email, phone, created_at, etc.

-- User Profiles
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  age INTEGER NOT NULL,
  gender VARCHAR(50), -- 'man', 'woman', 'non-binary', 'trans-man', 'trans-woman', 'other'
  sexual_orientation VARCHAR(50), -- 'lesbian', 'gay', 'bisexual', 'queer', 'asexual', 'other'
  location_city VARCHAR(100),
  location_state VARCHAR(50),
  location_country VARCHAR(50) DEFAULT 'US',
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  bio TEXT,
  occupation VARCHAR(100),
  education VARCHAR(100),
  height_cm INTEGER,
  is_verified BOOLEAN DEFAULT false,
  verification_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  is_premium BOOLEAN DEFAULT false,
  is_platinum BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_active_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Profile Photos
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL, -- Supabase storage path
  position INTEGER NOT NULL, -- Order in profile (1-6)
  is_primary BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true, -- Can be blurred for privacy
  created_at TIMESTAMP DEFAULT NOW()
);

-- Marriage Preferences & Expectations
CREATE TABLE preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,

  -- Location preferences
  max_distance_miles INTEGER DEFAULT 50,
  willing_to_relocate BOOLEAN DEFAULT false,
  preferred_cities TEXT[], -- Array of preferred cities

  -- Marriage goals
  primary_reason VARCHAR(100), -- 'financial', 'immigration', 'family_pressure', 'legal_benefits', 'companionship'
  relationship_type VARCHAR(50), -- 'platonic', 'romantic', 'open'
  wants_children BOOLEAN,
  children_timeline VARCHAR(50), -- 'soon', '1-3_years', '3-5_years', 'open', 'never'

  -- Financial expectations
  income_level VARCHAR(50), -- '<50k', '50k-100k', '100k-200k', '200k+'
  financial_arrangement VARCHAR(100), -- 'separate', 'joint', 'prenup_required'
  housing_preference VARCHAR(50), -- 'separate_spaces', 'roommates', 'shared_bedroom'

  -- Lifestyle
  religion VARCHAR(50),
  political_views VARCHAR(50),
  smoking VARCHAR(50), -- 'never', 'socially', 'regularly'
  drinking VARCHAR(50),
  pets VARCHAR(50), -- 'love_them', 'okay_with_them', 'allergic', 'no_pets'

  -- Visibility preferences
  public_relationship BOOLEAN, -- Appear as couple publicly?
  family_involvement VARCHAR(50), -- 'very_involved', 'somewhat', 'minimal', 'none'

  -- Matching preferences
  age_min INTEGER DEFAULT 22,
  age_max INTEGER DEFAULT 50,
  gender_preference TEXT[], -- Array: ['man', 'woman', 'non-binary']

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Dealbreakers (hard filters)
CREATE TABLE dealbreakers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  dealbreaker_type VARCHAR(100) NOT NULL, -- 'must_want_children', 'no_smoking', 'same_city_only', etc.
  created_at TIMESTAMP DEFAULT NOW()
);

-- Matches (bidirectional connections)
CREATE TABLE matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile1_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  profile2_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  initiated_by UUID REFERENCES profiles(id), -- Who liked first
  matched_at TIMESTAMP DEFAULT NOW(),
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'unmatched', 'blocked'
  compatibility_score NUMERIC(5, 2), -- 0-100 calculated by algorithm
  unmatch_reason TEXT,
  unmatched_at TIMESTAMP,
  CONSTRAINT unique_match UNIQUE (profile1_id, profile2_id),
  CHECK (profile1_id < profile2_id) -- Ensure ordered pair
);

-- Likes (swipe right)
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  to_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  like_type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'super_like'
  message TEXT, -- Optional intro message
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_like UNIQUE (from_profile_id, to_profile_id)
);

-- Passes (swipe left)
CREATE TABLE passes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  to_profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_pass UNIQUE (from_profile_id, to_profile_id)
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  match_id UUID REFERENCES matches(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT, -- Encrypted content
  message_type VARCHAR(50) DEFAULT 'text', -- 'text', 'image', 'video', 'voice'
  media_url TEXT, -- Supabase Storage URL for media messages
  encryption_key TEXT, -- Public key used for E2E encryption
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_messages_match ON messages(match_id, created_at DESC);
CREATE INDEX idx_messages_unread ON messages(receiver_id, is_read) WHERE is_read = false;

-- Verification Records
CREATE TABLE verifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  verification_type VARCHAR(50) NOT NULL, -- 'identity', 'video_selfie', 'background_check'
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  provider VARCHAR(50), -- 'persona', 'jumio'
  provider_verification_id TEXT,
  verification_data JSONB, -- Store provider response
  submitted_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  notes TEXT
);

-- Blocks & Reports
CREATE TABLE blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id)
);

CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reported_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  report_type VARCHAR(100), -- 'harassment', 'fake_profile', 'inappropriate_content', 'scam', 'other'
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'reviewing', 'resolved', 'dismissed'
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- Subscriptions (synced from RevenueCat)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  revenue_cat_customer_id VARCHAR(255) UNIQUE,
  subscription_tier VARCHAR(50), -- 'premium', 'platinum'
  status VARCHAR(50), -- 'active', 'cancelled', 'expired', 'trial'
  platform VARCHAR(50), -- 'ios', 'android'
  product_id VARCHAR(255),
  original_purchase_date TIMESTAMP,
  expiration_date TIMESTAMP,
  will_renew BOOLEAN,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- One-time Purchases
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id VARCHAR(255) NOT NULL, -- 'verification_badge', 'profile_boost', 'super_like_bundle'
  platform VARCHAR(50), -- 'ios', 'android'
  revenue_cat_transaction_id VARCHAR(255),
  price_usd DECIMAL(10, 2),
  purchased_at TIMESTAMP DEFAULT NOW()
);

-- Profile Boosts (visibility increase)
CREATE TABLE boosts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  boost_type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'super'
  duration_minutes INTEGER DEFAULT 60,
  started_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  purchase_id UUID REFERENCES purchases(id)
);

-- Analytics Events
CREATE TABLE analytics_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type VARCHAR(100) NOT NULL, -- 'profile_view', 'swipe_left', 'swipe_right', 'message_sent', etc.
  event_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analytics_user ON analytics_events(user_id, created_at DESC);
CREATE INDEX idx_analytics_type ON analytics_events(event_type, created_at DESC);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type VARCHAR(100), -- 'new_match', 'new_message', 'profile_liked', 'verification_complete'
  title VARCHAR(255),
  body TEXT,
  data JSONB,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Background Jobs Queue
CREATE TABLE job_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_type VARCHAR(100) NOT NULL, -- 'calculate_compatibility', 'send_notification', 'expire_boost'
  payload JSONB,
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  error TEXT,
  scheduled_for TIMESTAMP DEFAULT NOW(),
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_jobs_pending ON job_queue(status, scheduled_for) WHERE status = 'pending';
```

### Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read their own profile, read active profiles (for matching)
CREATE POLICY "Users can view their own profile" ON profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can view active profiles" ON profiles FOR SELECT USING (is_active = true);

-- Photos: Users can manage their own, view public photos of active users
CREATE POLICY "Users can manage their own photos" ON photos FOR ALL USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Users can view public photos" ON photos FOR SELECT USING (is_public = true);

-- Messages: Users can only read messages they're part of
CREATE POLICY "Users can view their messages" ON messages FOR SELECT USING (
  sender_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  receiver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);
CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (
  sender_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Matches: Users can view their own matches
CREATE POLICY "Users can view their matches" ON matches FOR SELECT USING (
  profile1_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()) OR
  profile2_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Subscriptions: Users can only view their own subscription
CREATE POLICY "Users can view their subscription" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
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
