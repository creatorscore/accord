# Accord Matching & Discovery Specification

> **Last updated:** 2026-04-11
> **Status:** Active — source of truth for matching algorithm, filters, and discovery behavior.

## Core Philosophy

Accord is a **lavender marriage** dating app. The matching algorithm is optimized for practical compatibility between LGBTQ+ individuals seeking marriages of convenience — not romantic chemistry. This means:

- **Sexual orientation is intentionally NOT a matching factor** — different orientations are ideal for lavender marriages (e.g., a gay man + lesbian woman)
- **Practical arrangements matter most** — financial, housing, children, relocation goals
- **Safety is paramount** — users in dangerous situations depend on accurate, respectful matching
- **Quality over quantity** — better to show fewer, highly compatible profiles than flood users with bad matches

---

## Matching Algorithm Weights

| Category | Weight | What It Measures |
|----------|--------|-----------------|
| **Goals & Practical Arrangements** | **37%** | Primary reasons alignment, relationship type compatibility, children compatibility (wants + arrangement method) |
| **Lifestyle & Values** | **27%** | Housing preference, financial arrangement, religion, political views, smoking, drinking, ethnicity/cultural background |
| **Location & Distance** | **21%** | Physical distance, global search, preferred cities, relocation willingness |
| **Demographics** | **15%** | Age range compatibility, gender preference matching |

### Hard Filters (Must Match or Profile is Excluded)

These are **dealbreakers** — if they don't match, the profile is never shown:

1. **Gender preference** — User only sees genders they selected in step 7
2. **Blocked users** — Never shown
3. **Already liked/passed** — Not re-shown (unless undo from passed profiles)
4. **Incognito users** — Hidden from all discovery
5. **Incomplete profiles** — `profile_complete = false` profiles are excluded from discovery
6. **Banned/restricted users** — Never shown
7. **Policy-restricted users** — Never shown (e.g., straight men who slipped through)

### Soft Factors (Affect Score, Don't Exclude)

- Distance beyond max preference (reduced score, not excluded if one party willing to relocate)
- Age outside preferred range (reduced score)
- Mismatched lifestyle preferences (reduced score)

---

## Discovery Feed Behavior

### Profile Card Display

Each card in the discovery feed shows:

**Always visible:**
- Name, age
- Location (city, distance — or "Nearby" if distance hidden)
- Primary photo (blurred if user has photo blur enabled and not yet matched)
- Compatibility score percentage
- Gender, pronouns
- Verification badges (identity verified, photo verified)

**Shown in expanded view:**
- All photos (swipe through)
- Prompt answers
- Voice intro player
- Sexual orientation
- Zodiac sign
- Marriage preferences (relationship type, primary reasons, children, housing, financial)
- Background info (subject to visibility toggles): height, hometown, job, education, religion, politics
- Lifestyle (subject to visibility toggles): drinking, smoking, weed, drugs
- Compatibility breakdown by category

### Swipe Actions

- **Like** (right swipe / heart button) — Free users: 10 likes per day. Premium: unlimited.
- **Pass** (left swipe / X button) — Unlimited. Can be undone from Passed Profiles screen.
- **Super Like** (star button) — Premium feature. Notifies the other user.

### Incomplete Onboarding Behavior

If a user is browsing in preview mode (onboarding incomplete):
- Discovery feed loads and shows profiles normally
- Like/Super Like buttons are **disabled**
- A persistent banner shows: "Finish your profile to start matching"
- Tapping the banner navigates back to onboarding at their current step

---

## Filter System

### Free Filters (Available to All Users)

| Filter | Type | Default | Range |
|--------|------|---------|-------|
| Age range | Dual slider | 25–45 | 18–80 |
| Max distance | Slider | 50 miles | 5–1000 miles (or km) |
| Active today | Toggle | Off | — |
| Show blurred photos | Toggle | On | — |

### Premium Filters

| Category | Filter | Type |
|----------|--------|------|
| **Identity** | Gender preference | Multi-select |
| | Ethnicity | Multi-select |
| | Sexual orientation | Multi-select |
| **Physical & Zodiac** | Height range | Dual slider |
| | Zodiac signs | Multi-select |
| **Lifestyle** | Religion | Multi-select |
| | Political views | Multi-select |
| | Languages spoken | Multi-select |
| | Smoking | Multi-select |
| | Drinking | Multi-select |
| **Marriage Intentions** | Primary reason | Multi-select |
| | Relationship type | Multi-select |
| | Wants children | Multi-select |
| | Housing preference | Multi-select |
| | Financial arrangement | Multi-select |

### Filter Persistence

- Free filters are persisted locally and in `preferences` table
- Premium filters are stored in `preferences.discovery_filters` (JSONB)
- Filters are applied server-side during discovery query for performance
- Filter modal clearly labels which filters require premium

---

## Known Issues Being Addressed

Based on user feedback (Google Play review, 2026-04-11):

### Problem: "See people of the gender you are not interested in"
**Root cause:** Gender preference from onboarding step 7 must be a **hard filter** in discovery queries.
**Fix:** Ensure `gender_preference` is always applied as a WHERE clause, never just a scoring factor.

### Problem: "Outside of your age and distance range"
**Root cause:** Age and distance filters need to be enforced as hard cutoffs, not soft scoring.
**Fix:** Apply `age_min`/`age_max` and `max_distance_miles` as WHERE clauses in the discovery query.

### Problem: "Requires you to re-enter your preferences numerous times"
**Root cause:** Checkpoint save failures, race conditions in onboarding store, or stale state after app restart.
**Fix:** 
- Ensure all checkpoint saves complete successfully with retry logic
- Verify onboarding store rehydrates correctly from DB on app restart
- Add optimistic saves on each step (not just checkpoints) for critical fields like gender_preference

### Problem: "App won't receive preferences"
**Root cause:** Possible silent failures in Supabase upserts, or RLS policy blocking writes.
**Fix:**
- Add error handling and user-facing feedback on save failures
- Verify RLS policies allow profile owner to update all relevant columns
- Log save failures to Sentry

---

## Profile Display Rules

### What Shows on Profile Cards (Discovery & Full Profile View)

| Field | Shows On Card | Shows On Full Profile | Respects Visibility Toggle |
|-------|--------------|----------------------|---------------------------|
| Name | Yes | Yes | No (always shown) |
| Age | Yes | Yes | No (always shown) |
| Location/Distance | Yes | Yes | Respects `hide_distance` |
| Photos | Yes | Yes | Blur if `photo_blur_enabled` |
| Gender | Yes | Yes | No (always shown) |
| Pronouns | Yes | Yes | No (always shown) |
| Compatibility % | Yes | Yes | No |
| Sexual Orientation | No | Yes | No (always shown) |
| Zodiac Sign | No | Yes | No (derived from DOB) |
| Height | No | Yes | **Yes** |
| Ethnicity | No | Yes | No |
| Hometown | No | Yes | **Yes** |
| Job Title | No | Yes | **Yes** |
| Education (school) | No | Yes | **Yes** |
| Education Level | No | Yes | **Yes** |
| Religion | No | Yes | **Yes** |
| Political Views | No | Yes | **Yes** |
| Drinking | No | Yes | **Yes** |
| Smoking | No | Yes | **Yes** |
| Weed | No | Yes | **Yes** |
| Drugs | No | Yes | **Yes** |
| Relationship Type | No | Yes | No (matching-critical) |
| Primary Reasons | No | Yes | No (matching-critical) |
| Children | No | Yes | No (matching-critical) |
| Family Plans | No | Yes | No |
| Housing Preference | No | Yes | No (matching-critical) |
| Financial Arrangement | No | Yes | No (matching-critical) |
| Prompt Answers | No | Yes | No |
| Voice Intro | No | Yes | No |
| Verification Status | Yes (badge) | Yes (badge) | No |

---

## Edit Profile

Users can edit all onboarding fields from Settings > Edit Profile. The edit profile screen mirrors the onboarding structure but allows direct editing of any field. Changes save immediately (not checkpoint-based).

Fields that **cannot** be changed after onboarding:
- **Name** (display_name) — set once during onboarding

Fields that trigger re-matching:
- Gender preference, age range, distance — changing these refreshes the discovery feed
