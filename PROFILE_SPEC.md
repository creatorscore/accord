# Accord Profile Specification

> **Last updated:** 2026-04-11
> **Status:** Active — source of truth for what data a user profile contains and how it's displayed.

## Profile Data Model

### Always-Present Fields (Set During Onboarding, Always Visible)

| Field | DB Column | Type | Set At Step | Editable Post-Onboarding |
|-------|-----------|------|-------------|--------------------------|
| Display Name | `profiles.display_name` | VARCHAR | 0 | **No** (immutable) |
| Age | `profiles.age` | INTEGER | 1 (calculated from DOB) | No (auto-calculated) |
| Birth Date | `profiles.birth_date` | DATE | 1 | No |
| Zodiac Sign | `profiles.zodiac_sign` | VARCHAR | 1 (calculated from DOB) | No (auto-calculated) |
| Location (city/state) | `profiles.location_city`, `location_state` | VARCHAR | 3 | Yes |
| Lat/Lng | `profiles.latitude`, `longitude` | NUMERIC | 3 | Yes (via location update) |
| Pronouns | `profiles.pronouns` | VARCHAR | 4 | Yes |
| Gender | `profiles.gender` | TEXT[] | 5 | Yes |
| Sexual Orientation | `profiles.sexual_orientation` | TEXT[] | 6 | Yes |
| Photos | `photos` table | — | 26 | Yes |
| Prompt Answers | `profiles.prompt_answers` | JSONB | 27 | Yes |

### Marriage & Matching Fields (Always Visible on Full Profile)

| Field | DB Column | Type | Set At Step |
|-------|-----------|------|-------------|
| Relationship Type | `preferences.relationship_type` | VARCHAR | 8 |
| Primary Reasons | `preferences.primary_reasons` | TEXT[] | 9 |
| Wants Children | `preferences.wants_children` | BOOLEAN | 12 |
| Children Arrangement | `preferences.children_arrangement` | TEXT[] | 13 |
| Financial Arrangement | `preferences.financial_arrangement` | TEXT[] | 20 |
| Housing Preference | `preferences.housing_preference` | TEXT[] | 21 |

These are **always shown** on the full profile view because they're critical for compatibility assessment.

### Visibility-Toggled Fields

These fields are collected during onboarding but the user controls whether they appear on their profile via the `field_visibility` JSONB object.

| Field | DB Column | Visibility Key | Default |
|-------|-----------|---------------|---------|
| Height | `profiles.height_inches` | `height` | Visible |
| Hometown | `profiles.hometown` | `hometown` | Visible |
| Job Title | `profiles.occupation` | `job_title` | Visible |
| School | `profiles.education` | `education` | Visible |
| Education Level | `profiles.education_level` | `education_level` | Visible |
| Religion | `profiles.religion` | `religion` | Visible |
| Political Views | `profiles.political_views` | `political_views` | Visible |
| Drinking | `preferences.lifestyle_preferences.drinking` | `drinking` | Visible |
| Smoking | `preferences.lifestyle_preferences.smoking` | `smoking` | Visible |
| Weed | `preferences.lifestyle_preferences.smokes_weed` | `smokes_weed` | Visible |
| Drugs | `preferences.lifestyle_preferences.does_drugs` | `does_drugs` | Visible |

### Optional Fields

| Field | DB Column | Set At Step | Notes |
|-------|-----------|-------------|-------|
| Ethnicity | `profiles.ethnicity` | 11 | Skippable |
| Family Plans | `preferences.children_arrangement` | 13 | Skippable, only if children ≠ "No" |
| Voice Intro | `profiles.voice_intro_url` | 28 | Skippable |

### Matching Preference Fields (Not Shown on Profile)

These are used for matching/filtering only — never displayed to other users:

| Field | DB Column | Set At Step |
|-------|-----------|-------------|
| Gender Preference | `preferences.gender_preference` | 7 |
| Age Min | `preferences.age_min` | 29 |
| Age Max | `preferences.age_max` | 29 |
| Max Distance | `preferences.max_distance_miles` | 29 |
| Willing to Relocate | `preferences.willing_to_relocate` | 29 |
| Discovery Filters | `preferences.discovery_filters` | Filter modal (post-onboarding) |

---

## Privacy & Visibility Controls

### Profile-Level Privacy

| Setting | DB Column | Default | Description |
|---------|-----------|---------|-------------|
| Photo Blur | `profiles.photo_blur_enabled` | false | Blur photos until matched |
| Incognito Mode | `profiles.incognito_mode` | false | Hide from all discovery feeds |
| Hide Last Active | `profiles.hide_last_active` | false | Don't show "Active X ago" |
| Hide Distance | `profiles.hide_distance` | false | Show "Nearby" instead of exact distance |

### Field-Level Visibility

Stored in `profiles.field_visibility` as JSONB:

```json
{
  "height": true,
  "hometown": true,
  "job_title": true,
  "education": true,
  "education_level": true,
  "religion": true,
  "political_views": true,
  "drinking": true,
  "smoking": true,
  "smokes_weed": true,
  "does_drugs": true
}
```

Default: all `true` (visible). User can toggle each individually during onboarding or in Edit Profile.

---

## Profile Display Contexts

### 1. Discovery Card (Compact)
Shown in the swipe feed. Minimal info to make a quick decision.
- Name, age
- Primary photo (or blurred)
- Location + distance
- Compatibility score %
- Gender, pronouns
- Verification badges

### 2. Full Profile View (Expanded)
Shown when user taps "View Profile" from discovery or from matches list.
- All photos (carousel)
- Prompt answers (scrollable)
- Voice intro player
- All visible fields organized by section:
  - **About**: Gender, pronouns, sexuality, zodiac, height*, hometown*, ethnicity
  - **Background**: Job*, school*, education level*, religion*, politics*
  - **Marriage Goals**: Relationship type, primary reasons, children, family plans, housing, financial
  - **Lifestyle**: Drinking*, smoking*, weed*, drugs*
  - **Compatibility**: Score breakdown by category

\* = Subject to visibility toggle

### 3. Own Profile View
What the user sees on their Profile tab. Shows everything including hidden fields (marked as "Hidden from profile").

### 4. Edit Profile
Full editing interface for all fields. Mirrors onboarding sections. Saves immediately on change.

---

## Removed Fields

The following were removed from profiles, onboarding, discovery, matching, and filters:

| Field | Reason | Removed Date |
|-------|--------|-------------|
| Hobbies/Interests | Not relevant to lavender marriage compatibility; cluttered profiles | 2026-04-07 |
| MBTI Personality Type | Low signal, not matching-relevant | 2026-04-07 |
| Love Language | Removed to streamline | 2026-04-07 |

Do NOT re-add these fields or reference them in new code.

---

## Verification Badges

| Badge | Column | How Earned |
|-------|--------|-----------|
| Identity Verified | `profiles.is_verified` | Persona/Jumio identity check |
| Photo Verified | `profiles.photo_verified` | Persona selfie match |
| Premium | `profiles.is_premium` | Active RevenueCat subscription |
| Platinum | `profiles.is_platinum` | Platinum tier subscription |

---

## Photo Requirements

- **Minimum:** 3 photos required to complete onboarding
- **Maximum:** 6 photo slots
- **First photo** = primary profile photo (shown on discovery card)
- **Moderation:** All photos go through AI moderation (`moderate-photo` edge function)
- **Storage:** Supabase Storage, paths in `photos` table
- **Reorder:** Drag to change display order
- **Photo Review:** Admins can flag photos for re-upload (`photo_review_required`)

## Prompt System

- **Minimum:** 2 prompts required to complete onboarding
- **Format:** `[{ prompt: "string", answer: "string" }]` in `profiles.prompt_answers` JSONB
- User selects from a curated prompt list, then writes their answer
- Prompts are displayed on the full profile view as conversation starters
