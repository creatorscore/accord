# Accord Onboarding Specification

> **Last updated:** 2026-04-20
> **Status:** Active — this is the source of truth for the 34-step onboarding flow (indices 0–33).

## Design Principles

1. **One question per screen** — no scrolling, no overwhelming forms
2. **Mobile-first** — everything fits within the viewport; use dropdowns/pickers if options overflow
3. **Progressive commitment** — users can "take a look around" after Location (step 3), but cannot like anyone until onboarding is complete
4. **Checkpoint saves** — data persists at key milestones so users don't lose progress
5. **Visibility toggles** — personal fields (marked below) let users choose whether to show them on their profile
6. **Skip-friendly** — optional fields are clearly skippable; required fields must be answered

---

## Step-by-Step Flow (Steps 0–33)

### Section 1: Basics (Steps 0–3)

| Step | Key | Screen Title | Required | Skippable | Visibility Toggle | Input Type | Notes |
|------|-----|-------------|----------|-----------|-------------------|------------|-------|
| 0 | `name` | What's your first name? | Yes | No | No | Text input | Cannot be changed later |
| 1 | `dob` | When's your birthday? | Yes | No | No | Date picker | Auto-calculates age + zodiac sign; must be 18+ |
| 2 | `notifications` | Turn on notifications | No | Yes | No | System prompt | iOS/Android push permission request |
| 3 | `location` | Where are you based? | Yes | No | No | Location permission + city display | Stores lat/lng, city, state, country. **Preview mode unlocked after this step.** |

**Checkpoint save after step 3** — profile basics persisted to DB.

---

### Section 2: Identity (Steps 4–7)

| Step | Key | Screen Title | Required | Skippable | Visibility Toggle | Input Type | Notes |
|------|-----|-------------|----------|-----------|-------------------|------------|-------|
| 4 | `pronouns` | What are your pronouns? | Yes | No | No | Single-select chips | Options: she/her, he/him, they/them, she/they, he/they, any pronouns, ask me, prefer not to say |
| 5 | `gender` | Choose your gender | Yes | No | No | Multi-select chips | Options: Man, Woman, Non-binary. Select all that apply. |
| 6 | `sexuality` | What's your sexuality? | Yes | No | No | Multi-select chips | Options: Lesbian, Gay, Bisexual, Straight, Queer, Asexual, Pansexual, Demisexual, Questioning, Omnisexual, Polysexual, Androsexual, Gynesexual, Sapiosexual, Heteroflexible, Homoflexible, Prefer not to say, Other. **Note:** If gender is "Man", filter out "Straight" and "Lesbian" (Accord is for LGBTQ+ lavender marriages). |
| 7 | `gender_pref` | Who would you like to date? | Yes | No | No | Multi-select chips | Options: Men, Women, Non-binary, Everyone. This sets discovery feed gender filter AND matching preferences. |

---

### Section 3: Goals (Steps 8–14)

| Step | Key | Screen Title | Required | Skippable | Visibility Toggle | Input Type | Notes |
|------|-----|-------------|----------|-----------|-------------------|------------|-------|
| 8 | `relationship_type` | What type of relationship are you looking for? | Yes | No | No | Single-select chips | Options: Platonic Only, Romantic Possible, Open Arrangement |
| 9 | `intention` | What brings you to Accord? | Yes | No | No | Multi-select chips | Options: Financial Stability, Immigration/Visa, Family Pressure, Legal Benefits, Companionship, Safety & Protection, Other |
| 10 | `height` | How tall are you? | No | Yes | **Yes** (`height`) | Scroll picker / dropdown | Imperial (ft/in) or metric (cm) toggle. Visible on profile toggle. |
| 11 | `ethnicity` | What's your ethnicity? | No | Yes | No | Multi-select chips | Options: Asian, Black/African, Hispanic/Latinx, Indigenous/Native, Middle Eastern/North African, Pacific Islander, South Asian, White/Caucasian, Multiracial, Other, Prefer not to say |
| 12 | `children` | Do you want children? | Yes | No | No | Single-select chips | Options: Yes, No, Maybe / Open to it |
| 13 | `family_plans` | What are your family plans? | No | Yes | No | Multi-select chips | Options: Biological Children, Adoption, Surrogacy, IVF/Fertility Treatments, Co-Parenting, Fostering, Already Have Children, Open to Discussion, Other. Only shown if children ≠ "No". |
| 14 | `pets` | How do you feel about pets? | No | Yes | **Yes** (`pets`) | Single-select chips | Options: Love them, Like them, Indifferent, Allergic, Don't like. Stored in `preferences.lifestyle_preferences.pets`. |

**Checkpoint save after step 14** — identity + goals + pets persisted to DB.

---

### Section 4: Background (Steps 15–20)

| Step | Key | Screen Title | Required | Skippable | Visibility Toggle | Input Type | Notes |
|------|-----|-------------|----------|-----------|-------------------|------------|-------|
| 15 | `hometown` | Where are you from? | No | Yes | **Yes** (`hometown`) | Text input / city autocomplete | Hometown, not current location |
| 16 | `job_title` | What's your job title? | No | Yes | **Yes** (`job_title`) | Text input | Free-text occupation/role |
| 17 | `school` | Where did you go to school? | No | Yes | **Yes** (`education`) | Text input | School/university name |
| 18 | `education_level` | What's the highest level you attained? | No | Yes | **Yes** (`education_level`) | Single-select chips or dropdown | Options: High School, Associate's Degree, Bachelor's Degree, Master's Degree, Doctorate / PhD, Trade School, Self-Taught, Other |
| 19 | `religion` | Are you religious? | No | Yes | **Yes** (`religion`) | Single-select chips or dropdown | Options: Christian, Catholic, Protestant, Muslim, Jewish, Hindu, Buddhist, Sikh, Atheist, Agnostic, Spiritual but not religious, Other, Prefer not to say |
| 20 | `politics` | Political beliefs? | No | Yes | **Yes** (`political_views`) | Single-select chips or dropdown | Options: Liberal, Progressive, Moderate, Conservative, Libertarian, Socialist, Apolitical, Other, Prefer not to say |

---

### Section 5: Lifestyle (Steps 21–26)

| Step | Key | Screen Title | Required | Skippable | Visibility Toggle | Input Type | Notes |
|------|-----|-------------|----------|-----------|-------------------|------------|-------|
| 21 | `financial` | Financial arrangement? | Yes | No | No | Multi-select chips | Options: Keep Finances Separate, Share Bills/Expenses, Joint Finances, Prenup Required, Flexible/Negotiable |
| 22 | `housing` | Housing preference? | Yes | No | No | Multi-select chips | Options: Separate Bedrooms/Spaces, Live Like Roommates, Separate Homes Nearby, Shared Bedroom, Flexible/Negotiable |
| 23 | `drinking` | Do you drink? | No | Yes | **Yes** (`drinking`) | Single-select chips | Options: Never, Socially, Regularly, Prefer Not to Say |
| 24 | `smoking` | Do you smoke? | No | Yes | **Yes** (`smoking`) | Single-select chips | Options: Never, Socially, Regularly, Trying to Quit |
| 25 | `weed` | Do you smoke weed? | No | Yes | **Yes** (`smokes_weed`) | Single-select chips | Options: Never, Socially, Regularly |
| 26 | `drugs` | Do you do drugs? | No | Yes | **Yes** (`does_drugs`) | Single-select chips | Options: Never, Socially, Regularly |

**Checkpoint save after step 26** — background + lifestyle persisted to DB.

---

### Section 6: Profile (Steps 27–29)

| Step | Key | Screen Title | Required | Skippable | Visibility Toggle | Input Type | Notes |
|------|-----|-------------|----------|-----------|-------------------|------------|-------|
| 27 | `photos` | Add your photos | Yes | No | No | Photo grid (6 slots) | **Minimum 3 photos required.** First photo = primary profile photo. Drag to reorder. Photos save independently inside this step. |
| 28 | `prompts` | Answer some prompts | Yes | No | No | Prompt selector + text answers | **Minimum 2 prompts required.** User picks from prompt list and writes answers. |
| 29 | `voice_note` | Record a voice intro | No | Yes | No | Audio recorder | 30 seconds max. Optional but encouraged. |

---

### Section 7: Preferences (Steps 30–33)

| Step | Key | Screen Title | Required | Skippable | Visibility Toggle | Input Type | Notes |
|------|-----|-------------|----------|-----------|-------------------|------------|-------|
| 30 | `matching_prefs` | Set your preferences | Yes | No | No | Sliders + toggle | Age range (18–80), Max distance (5–1000 mi/km), Willing to relocate toggle. Gender preference was already set in step 7. |
| 31 | `languages` | What languages do you speak? | No | Yes | No | Chip multi-select | Optional. Select up to **5**. Writes to `profiles.languages_spoken` (TEXT[]). |
| 32 | `must_haves` | What are your must-haves? | No | Yes | No | Chip multi-select | Optional. Select up to **10**. Writes to `preferences.must_haves` (TEXT[]). |
| 33 | `dealbreakers` | Any dealbreakers? | No | Yes | No | Chip multi-select | Optional. Select up to **10**. Writes to `preferences.dealbreakers` (TEXT[]). Final step. Skipping it still completes the profile. |

Steps 31–33 were appended to the **end** of the flow (never inserted mid-flow) so existing users' saved `onboarding_step` indices don't shift. All three are optional chip multi-selects (one question per screen); their values are committed by the final save.

**Final save after step 33** — all data persisted, `profile_complete = true`, `onboarding_step = 34`.

---

## Checkpoint Save Strategy

In practice `saveCheckpoint` writes the *entire* accumulated store state on every fire — including future-section fields the user may have already touched. The table below lists the fields newly *committed* at each checkpoint.

| After Step | What's Saved |
|-----------|-------------|
| 3 | name, birth_date, age, zodiac_sign, push_token, location (lat/lng/city/state/country) |
| 14 | pronouns, gender, sexual_orientation, gender_preference, relationship_type, primary_reasons, height, ethnicity, wants_children, children_arrangement, pets |
| 26 | hometown, occupation, education, education_level, religion, political_views, financial_arrangement, housing_preference, drinking, smoking, smokes_weed, does_drugs, field_visibility |
| 33 (final) | age_min, age_max, max_distance_miles, willing_to_relocate, languages_spoken, must_haves, dealbreakers, profile_complete=true |

Between checkpoints the answers also survive an app-kill: the zustand store persists to `AsyncStorage` under the `accord-onboarding-draft` key, and the draft is cleared only on successful final save or sign-out.

---

## Visibility Toggle Fields

These fields have a "Show on profile" toggle during onboarding. Default is **visible** unless user turns it off.

| Field | Visibility Key | DB Location |
|-------|---------------|-------------|
| Height | `height` | `profiles.field_visibility.height` |
| Hometown | `hometown` | `profiles.field_visibility.hometown` |
| Job Title | `job_title` | `profiles.field_visibility.job_title` |
| School | `education` | `profiles.field_visibility.education` |
| Education Level | `education_level` | `profiles.field_visibility.education_level` |
| Religion | `religion` | `profiles.field_visibility.religion` |
| Political Views | `political_views` | `profiles.field_visibility.political_views` |
| Drinking | `drinking` | `profiles.field_visibility.drinking` |
| Smoking | `smoking` | `profiles.field_visibility.smoking` |
| Weed | `smokes_weed` | `profiles.field_visibility.smokes_weed` |
| Drugs | `does_drugs` | `profiles.field_visibility.does_drugs` |
| Pets | `pets` | `profiles.field_visibility.pets` |

---

## Preview Mode ("Take a Look Around")

- Available from step 3 (Location) onward
- User can browse discovery feed but **cannot like, super-like, or message anyone**
- A banner appears on the discover screen: "Finish your profile to start matching"
- Tapping the banner returns user to their current onboarding step
- This banner takes priority over the verification banner

---

## Removed Fields (No Longer in Onboarding or Profiles)

These fields were removed from the entire codebase as of 2026-04-07:

- **Hobbies/Interests** — removed from onboarding, profiles, discovery, filters, matching algorithm
- **MBTI Personality Type** — removed entirely
- **Love Language** — removed entirely
- **hobby-options.ts** — deleted
- **personality.tsx** — deleted
- **interests.tsx** — deleted

The 5% matching algorithm weight that was on personality has been redistributed to goals, lifestyle, and location.

---

## UX Requirements

1. **No scrolling** — every screen must fit within the mobile viewport. Use dropdowns, bottom sheets, or compact chip layouts for steps with many options.
2. **Compact chip mode** — steps with 8+ options auto-switch to smaller chip sizing.
3. **Clear progress** — section-based progress indicator shows which section the user is in and their progress within it.
4. **Back navigation** — users can go back to any previous step.
5. **Resume from where you left off** — if a user closes the app mid-onboarding, they resume at their last checkpoint.
6. **Skip button** — clearly visible for skippable steps, positioned consistently.
7. **Validation** — required fields show inline errors; prevent advancing without valid input.

---

## Data Flow

```
Onboarding UI → onboardingStore (Zustand) → checkpoint save → Supabase profiles/preferences tables
```

- Form state is held in `stores/onboardingStore.ts` during the flow
- At each checkpoint, accumulated state is batch-written to `profiles` and `preferences` tables
- The final save also sets `profile_complete = true` and `onboarding_step = 34`
- Visibility toggles are stored in `profiles.field_visibility` (JSONB)
- Lifestyle fields (drinking, smoking, weed, drugs) are stored in `preferences.lifestyle_preferences` (JSONB)
