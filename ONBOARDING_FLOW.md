# Accord - Enhanced Onboarding Flow

## Overview

Accord's onboarding flow has been designed with personality, vibrancy, and customization in mind - specifically targeting LGBTQ+ and female demographics who want more than just basic profiles.

**Inspiration**: Hinge's engaging prompts + vibrant, inclusive design + rich personality features

## 8-Step Onboarding Flow

### Step 1: Basic Info (12% complete)
**Route**: `/(onboarding)/basic-info.tsx`

**Fields**:
- Display name
- Age (18-100)
- Gender (Man, Woman, Non-binary, Trans Man, Trans Woman, Other)
- Sexual Orientation (Lesbian, Gay, Bisexual, Queer, Asexual, Pansexual, Other)
- Location (City, State) with GPS auto-detect

**Features**:
- Auto-location detection with expo-location
- Form validation
- Geocoding for latitude/longitude storage

**Design**:
- Gradient background (pink → purple → white)
- Large emoji header (👋)
- Pill-style selection buttons
- Progress bar with gradient fill

---

### Step 2: Photos (25% complete)
**Route**: `/(onboarding)/photos.tsx`

**Requirements**:
- 3-6 photos required
- First photo becomes primary profile picture
- Image compression to 1080px width
- Stored in Supabase Storage (`profile-photos` bucket)

**Features**:
- Grid layout with reordering capability
- Primary badge on first photo
- Photo tips card
- Delete button on each photo
- Upload progress indicator

**Design**:
- Purple gradient background
- Colorful tip cards with emojis
- Rounded corners everywhere

---

### Step 3: About/Bio (43% complete)
**Route**: `/(onboarding)/about.tsx`

**Fields**:
- Bio (50-500 characters, required)
- Occupation (optional)
- Education (optional)

**Features**:
- Character counter
- Minimum 50 characters validation
- Helpful bio writing tips
- Emoji-enhanced field labels

**Design**:
- Blue gradient background
- Color-coded input borders (blue, purple, pink)
- Large emoji icons
- Tip card with gradient background

---

### Step 4: Interests & Hobbies (57% complete)
**Route**: `/(onboarding)/interests.tsx`

**Fields**:
- Hobbies (1-10 selections from 20 options)
- Favorite Movies (comma-separated, optional)
- Favorite Music/Artists (comma-separated, optional)
- Favorite Books (comma-separated, optional)
- Favorite TV Shows (comma-separated, optional)

**Hobby Options**:
🎨 Art & Design, 📚 Reading, ✈️ Travel, 🎵 Music, 🏃 Fitness, 🎮 Gaming, 🍳 Cooking, 📸 Photography, 🧘 Yoga, 🎭 Theater, 🌱 Gardening, 🎬 Film, 💻 Tech, ✍️ Writing, 🐕 Pets, 🎪 Live Events, 🏕️ Outdoors, 🎨 Crafts, 🍷 Wine Tasting, ☕ Coffee

**Features**:
- Multi-select hobby tags
- Color-coded input fields for each category
- Stores arrays in database
- Emoji-enhanced labels

**Design**:
- Gradient backgrounds on input fields
- Pill-shaped hobby buttons
- Gradient selected state (purple → pink)
- Organized sections with heart icon header

**Database Storage**:
```sql
hobbies: TEXT[] -- Array of selected hobbies
interests: JSONB -- { movies: [], music: [], books: [], tv_shows: [] }
```

---

### Step 5: Hinge-Style Prompts (71% complete)
**Route**: `/(onboarding)/prompts.tsx`

**Features**:
- 3 customizable prompts
- 20 pre-written prompt options
- 200 character limit per answer
- Modal prompt picker

**Prompt Examples**:
- "My ideal lavender marriage looks like..."
- "I'm looking for someone who..."
- "Together we could..."
- "What makes me a great partner is..."
- "My guilty pleasure is..."

**Features**:
- Interactive prompt selection modal
- Character counter per prompt
- Used prompts filtered from available list
- Gradient prompt headers

**Design**:
- White background
- Gradient prompt cards (purple → pink)
- Dashed border "add prompt" cards
- Modal overlay for prompt selection

**Database Storage**:
```sql
prompt_answers: JSONB -- [{ prompt: "...", answer: "..." }]
```

---

### Step 6: Voice Introduction (86% complete)
**Route**: `/(onboarding)/voice-intro.tsx`

**Requirements**:
- 30 second voice recording (optional)
- Microphone permissions
- Audio playback preview
- Re-record capability

**Features**:
- expo-av audio recording
- Real-time duration counter (0-30s)
- Auto-stop at 30 seconds
- Playback controls (play/pause)
- Delete and re-record
- Upload to Supabase Storage (`voice-intros` bucket)

**Design**:
- Pink gradient background
- Large circular record button
- Red when recording, purple/pink gradient when idle
- Timer display (Xs / 30s)
- Recording tips card

**Database Storage**:
```sql
voice_intro_url: TEXT -- Supabase Storage public URL
voice_intro_duration: INTEGER -- Seconds (max 30)
```

**Statistics**:
> Profiles with voice intros get 3x more matches! 🌈

---

### Step 7: Marriage Preferences (88% complete)
**Route**: `/(onboarding)/marriage-preferences.tsx`

**Fields**:
- Primary reason (financial, immigration, family_pressure, legal_benefits, companionship, safety, other)
- Relationship type (platonic, romantic, open)
- Wants children (Yes, No, Maybe/Open)
- Housing preference (separate bedrooms, roommates, separate homes, shared bedroom, flexible)
- Financial arrangement (separate, shared expenses, joint, prenup required, flexible)

**Features**:
- Single-select radio lists
- Card-based selection UI
- Required validation for all fields

**Design**:
- White background
- Selected state: purple background + border
- Card-based layout
- Emoji header (💍)

**Database Storage**:
```sql
-- preferences table
primary_reason: VARCHAR(50)
relationship_type: VARCHAR(50)
wants_children: BOOLEAN
housing_preference: VARCHAR(100)
financial_arrangement: VARCHAR(100)
```

---

### Step 8: Matching Preferences (100% complete)
**Route**: `/(onboarding)/matching-preferences.tsx`

**Fields**:
- Age range (18-80, dual sliders)
- Maximum distance (10-500 miles)
- Willing to relocate (toggle)
- Gender preference (multi-select)

**Features**:
- @react-native-community/slider for age and distance
- Toggle switch for relocation
- Multi-select gender buttons
- Green success card at completion

**Design**:
- White background
- Purple gradient sliders
- Toggle switch animation
- Gradient buttons for gender selection
- Success card (green background)

**Database Storage**:
```sql
-- preferences table
age_min: INTEGER
age_max: INTEGER
max_distance_miles: INTEGER
willing_to_relocate: BOOLEAN
gender_preference: VARCHAR[]
```

**Completion**: Sets `profile_complete = true` and redirects to main app

---

## Design System

### Colors
- **Primary**: Purple (#8B5CF6)
- **Secondary**: Pink (#EC4899)
- **Accent**: Blue (#3B82F6)
- **Success**: Green (#10B981)
- **Background Gradients**: pink-50 → purple-50 → white

### Typography
- **Headers**: 4xl (36px), bold
- **Subheaders**: lg (18px), regular
- **Body**: base (16px)
- **Labels**: lg (18px), bold
- **Captions**: sm (14px)

### Components
- **Buttons**: Rounded-full (pill shape), gradient backgrounds
- **Inputs**: Rounded-2xl/rounded-xl, border-2, color-coded
- **Cards**: Rounded-3xl, gradient backgrounds, border-2
- **Progress Bar**: Gradient (purple → pink), height-3
- **Selection Pills**: Rounded-full, gradient selected state

### Emojis Usage
Every screen features prominent emoji usage:
- Headers: Large (text-5xl) emoji
- Sections: Medium (text-3xl) emoji
- Lists: Inline emoji for visual hierarchy

---

## Database Schema

### Enhanced Profile Fields

```sql
-- profiles table additions
voice_intro_url: TEXT
voice_intro_duration: INTEGER
hobbies: TEXT[]
interests: JSONB -- { movies: [], music: [], books: [], tv_shows: [] }
prompt_answers: JSONB -- [{ prompt: "", answer: "" }]
```

### Storage Buckets

**profile-photos**:
- Public bucket
- Stores: `{profile_id}/{timestamp}_{index}.jpg`
- Policies: Users can upload/update/delete own photos, everyone can view

**voice-intros**:
- Public bucket
- Stores: `{profile_id}/voice-intro.m4a`
- Policies: Users can upload/update/delete own intro, everyone can view

---

## Protected Route Logic

**File**: `components/ProtectedRoute.tsx`

**Behavior**:
1. Checks `profile_complete` field in database
2. New users → redirect to `/(onboarding)/basic-info`
3. Incomplete profiles → redirect to onboarding
4. Complete profiles → redirect to `/(tabs)/discover`
5. Authenticated users in auth screens → redirect based on profile status

---

## Key Features for LGBTQ+ & Female Demographic

### 1. **Personality-First**
- Hinge-style prompts allow authentic self-expression
- Voice intros add personal touch
- Rich interests section shows hobbies and culture

### 2. **Vibrant & Inclusive Design**
- Gradient backgrounds (purple, pink, blue)
- Emoji-enhanced UI
- Gender-inclusive options (6 gender identities)
- Orientation-inclusive (7 options)

### 3. **Safe & Specific**
- Lavender marriage-specific questions
- Clear relationship type options
- Detailed living arrangement preferences
- Financial transparency options

### 4. **Customizable**
- 10 hobby selections
- Unlimited favorite media entries
- 3 customizable prompts from 20 options
- Optional voice intro

### 5. **Visual Hierarchy**
- Large headers with emojis
- Color-coded sections
- Gradient progress indicators
- Tip cards with context

---

## Completion Criteria

Profile is marked complete (`profile_complete = true`) when user completes all 8 steps:

✅ Basic info saved
✅ 3+ photos uploaded
✅ Bio written (50+ characters)
✅ At least 1 hobby selected
✅ At least 1 prompt answered
✅ Voice intro (optional - can skip)
✅ Marriage preferences set
✅ Matching preferences set

Upon completion → Redirect to `/(tabs)/discover`

---

## Technical Implementation

### Dependencies Added
```json
{
  "@react-native-community/slider": "5.0.1",
  "expo-av": "16.0.7",
  "expo-image-manipulator": "^14.0.0",
  "expo-location": "^18.0.0"
}
```

### Permissions Required

**iOS** (`app.json`):
- `NSMicrophoneUsageDescription`
- `NSPhotoLibraryUsageDescription`
- `NSCameraUsageDescription`
- `NSLocationWhenInUseUsageDescription`

**Android** (`app.json`):
- `android.permission.RECORD_AUDIO`
- `android.permission.READ_EXTERNAL_STORAGE`
- `android.permission.WRITE_EXTERNAL_STORAGE`
- `android.permission.ACCESS_FINE_LOCATION`

---

## Next Steps

After onboarding completion, users can:
1. **Discover**: Browse potential matches with swipe interface
2. **Matches**: View mutual matches
3. **Messages**: Start conversations
4. **Profile**: Edit profile, add more photos, update prompts

---

**Built with ❤️ for the LGBTQ+ community and allies**
