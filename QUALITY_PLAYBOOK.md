# Accord Quality Playbook

> **Last updated:** 2026-04-11
> **Purpose:** Prevent the bugs and glitches that lead to bad user experiences and negative reviews. Every developer (human or AI) working on this codebase must follow these rules.

## The Review That Started This

> "The app is extremely glitchy and requires you to re-enter your preferences numerous times and even then the app won't receive them causing you to see people of the gender you are not interested in outside of your age and distance range and a bunch of other nonsense."
> — Google Play Review, April 2026

This review is valid. Our users are LGBTQ+ individuals whose safety depends on this app working correctly. A glitchy app isn't just bad UX — it puts people at risk.

---

## Non-Negotiable Rules

### 1. Preferences Must Be Hard Filters

**Gender preference, age range, and distance are HARD FILTERS in discovery queries — not soft scoring factors.**

```
WRONG: Score profiles lower if gender doesn't match preference
RIGHT: WHERE profile.gender && preferences.gender_preference (exclude entirely)
```

- Gender preference from onboarding step 7 → `preferences.gender_preference` → used as WHERE clause in discovery
- Age range → `preferences.age_min` / `age_max` → WHERE clause
- Distance → `preferences.max_distance_miles` → WHERE clause (with relocation exception)

If a user says they want to see Women, they must NEVER see Men in their feed. Period.

### 2. Data Must Actually Save

Every write to Supabase must:
- Check the response for errors
- Retry once on transient failure
- Show the user a toast/alert if the save fails
- Log failures to Sentry with full context (which fields, which step, what error)

**Never silently swallow a save error.** If preferences didn't save, the user needs to know.

### 3. Onboarding State Must Be Resilient

- The onboarding store (`stores/onboardingStore.ts`) rehydrates from DB on app restart
- Checkpoint saves at steps 3, 13, 25, and final save at 29
- If a checkpoint save fails, the user must be informed and given the option to retry
- The `onboarding_step` column tracks the highest completed step — never decrease it
- Preview mode (browsing before completing onboarding) must prevent all like/match actions

### 4. Array Columns Need Array Handling

Several DB columns are `TEXT[]` arrays. Always use proper array operations:

```typescript
// WRONG
if (profile.gender.includes('Woman')) { ... }

// RIGHT
if (Array.isArray(profile.gender) && profile.gender.some(g => g === 'Woman')) { ... }
```

Array columns: `gender`, `sexual_orientation`, `ethnicity`, `love_language`, `housing_preference`, `financial_arrangement`, `children_arrangement`, `primary_reasons`, `gender_preference`

### 5. No Scrolling in Onboarding

Every onboarding screen must fit within the mobile viewport. If a step has too many options:
- Use compact/small chip sizing (auto-triggered for 8+ options)
- Use a dropdown or bottom sheet picker
- Never add a ScrollView to an onboarding step

### 6. Test on Real Devices

Before any release:
- Test the full onboarding flow end-to-end on Android emulator AND iOS simulator
- Verify discovery feed respects ALL filter preferences after onboarding
- Verify edit-profile changes are reflected immediately in discovery
- Check that app restart preserves all onboarding progress and preferences

---

## Common Bug Patterns to Watch For

### Race Conditions
- Onboarding store writes + Supabase writes happening in wrong order
- User navigating forward before save completes
- Multiple rapid taps on "Next" creating duplicate saves

### Stale State
- Discovery feed using cached preferences instead of fresh DB values
- Onboarding store not rehydrating after app background/foreground
- Filter modal showing old values after preferences change

### RLS Policy Blocks
- User can't update their own profile (check `auth.uid() = user_id` policies)
- Silent 403 errors on Supabase writes appearing as "preferences not saving"

### Type Mismatches
- Sending a string where the DB expects an array (e.g., `gender_preference`)
- Sending an array where the DB expects a string (e.g., `relationship_type`)
- Null vs undefined vs empty string in optional fields

---

## Testing Checklist for Any PR

- [ ] Onboarding: Can complete all 30 steps without error
- [ ] Onboarding: Checkpoint saves work (kill app mid-flow, reopen, verify progress preserved)
- [ ] Onboarding: Visibility toggles are respected in profile display
- [ ] Discovery: Gender filter matches exactly what user selected in step 7
- [ ] Discovery: Age range filter excludes profiles outside range
- [ ] Discovery: Distance filter excludes profiles outside range
- [ ] Discovery: No blocked/passed/banned users appear
- [ ] Discovery: Incomplete profiles don't appear
- [ ] Edit Profile: Changes save and are immediately reflected
- [ ] Filters: Free filters work without premium
- [ ] Filters: Premium filters properly gated
- [ ] Error handling: Network failure during save shows user-facing error

---

## Monitoring

- **Sentry:** All save failures, API errors, and unhandled exceptions
- **PostHog:** Track onboarding completion rate, drop-off per step, filter usage
- **Supabase Dashboard:** Monitor RLS policy denials, slow queries on discovery

---

## Policy: Straight Men

Accord is built for LGBTQ+ individuals seeking lavender marriages. Straight cisgender men who identify as "Straight" + "Man" are policy-restricted via the `policy-restrict-straight-men` edge function. This is enforced at the database level and in discovery queries. See `supabase/functions/policy-restrict-straight-men/` for implementation.

Quality over growth — it's better to have fewer users who belong than to dilute the community.
