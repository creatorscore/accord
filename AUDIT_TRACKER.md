---
Started: 2026-04-11 (spec docs created)
Last updated: 2026-04-16
Trigger: Google Play review flagging preference persistence, wrong-gender matches, filter enforcement, general glitchiness
Specs: ONBOARDING_SPEC.md · MATCHING_SPEC.md · PROFILE_SPEC.md · QUALITY_PLAYBOOK.md
---

# Accord Audit Tracker

## ⚠️ LIVE PRODUCTION APP

Accord is **shipped and in active use by real users**. Every fix on this tracker must be:

- **Non-breaking** — old installed app versions must keep working against the current backend and the updated code
- **Backward compatible** — DB changes additive only (new columns nullable or with defaults), no renames/drops, no tightened constraints that would reject existing rows
- **Safe to roll back** — if a fix causes regressions, we need to be able to revert without data loss or stuck users
- **Tested against old client shapes** — new code paths must still handle data written by older app versions
- **OTA-aware** — `eas update` reaches users within minutes; never push an untested fix as an OTA

See CLAUDE.md "LIVE PRODUCTION APP" section and DATABASE_MIGRATION_RULES.md before touching schemas or contracts.

---

Living punch list for the Apr 2026 quality overhaul. Status keys:
🔴 broken / not started · 🟡 in progress / uncommitted · 🟢 verified on device · ⚪ not yet audited

---

## 1. Sticky filters & preference persistence

Root cause from review + user reports: filters "don't work the first time", require re-entry, revert after navigation.

| # | Item | Status | Files | Verification |
|---|------|--------|-------|--------------|
| 1.1 | **`persistFilters()` not awaited** — fire-and-forget DB write; user navigates away before it completes → next load reverts to stale DB values | 🟢 | `app/(tabs)/discover.tsx` both FilterModal onApply handlers | Change filter → navigate away → come back → filter persisted |
| 1.2 | **Empty dependency array in `useFocusEffect`** — stale closure on return from settings/matching-prefs; changes from other screens not detected | 🟢 | `app/(tabs)/discover.tsx` lines 299-309 | Edit matching prefs in settings → return to discover → feed reloads |
| 1.3 | **`computeFiltersHash` already includes matching pref fields** — false alarm; real issue was stale closure (1.2) | 🟢 | `app/(tabs)/discover.tsx` lines 473-498 | Hash includes genderPreference, ageMin, ageMax, maxDistance |
| 1.4 | Every Supabase write checks `error` and surfaces a toast on failure | 🟡 | sweep all `.from(...).update/insert` calls | Force a network failure, confirm toast |
| 1.5 | Onboarding store persists each step to DB at checkpoints | 🟡 | `stores/onboardingStore.ts`, `app/(onboarding)/onboarding.tsx` | Kill app mid-flow, re-enter, data present |
| 1.6 | Edit-profile saves don't clobber array fields (gender, orientation, ethnicity) | ⚪ | `app/settings/edit-profile.tsx` | Edit one field, confirm arrays intact |
| 1.7 | `preferences.gender_preference` writes as `VARCHAR[]`, never scalar | ⚪ | `components/onboarding/steps/MatchingPrefsStep.tsx` | DB inspect after save |

---

## 2. Gender filter enforcement (hard filter)

Root cause: wrong genders appearing in discovery feed. Golden Rule #1.

| # | Item | Status | Files | Verification |
|---|------|--------|-------|--------------|
| 2.1 | **`"Everyone"` gender pref treated as literal in RPCs** — `p.gender && ['Everyone']` matches nothing | 🟢 | `get_nearby_profiles` + `refresh_discovery_feed` RPCs | Fixed 2026-04-16; verified 18 profiles returned |
| 2.2 | Client-side hard-excludes gender in `discover.tsx` filter (lines 1363-1382); scoring in `matching-algorithm.ts` is separate. Added "Everyone" handling to both. | 🟢 | `discover.tsx` + `lib/matching-algorithm.ts` | "Everyone" users see all genders; specific prefs exclude correctly |
| 2.3 | Array-aware comparison uses `Array.isArray()` + `.some()`, never `.includes()` on scalars | ⚪ | `lib/matching-algorithm.ts`, `app/(tabs)/discover.tsx` | grep for `.includes(` on gender fields |
| 2.4 | `policy-restrict-straight-men` job still running on cron | ⚪ | `supabase/functions/policy-restrict-straight-men/index.ts` | Check cron + last run |

---

## 3. Age & distance hard filters

| # | Item | Status | Files | Verification |
|---|------|--------|-------|--------------|
| 3.1 | Client-side hard-excludes age in `discover.tsx` filter (line 1386-1388); scoring in `matching-algorithm.ts` is separate | 🟢 | `discover.tsx` line 1386 | Age outside range → return false |
| 3.2 | Distance > `max_distance_miles` → excluded unless `search_globally` or `willing_to_relocate` | 🟡 | `lib/matching-algorithm.ts` | Seed with far profile |
| 3.3 | `preferred_cities` array honored when set | ⚪ | onboarding city autocomplete + discover | Set city, confirm filter |
| 3.4 | Distance unit (miles/km) respected in display + filter | ⚪ | `components/matching/ImmersiveProfileCard.tsx` | Toggle unit, verify |

---

## 4. 30-step onboarding overhaul

Memory: "All 30 steps built, hobbies/MBTI removed; don't deploy step check yet."

| # | Item | Status | Files | Verification |
|---|------|--------|-------|--------------|
| 4.1 | `interests.tsx` + `personality.tsx` removed, no dangling refs | 🟡 | deleted files | grep for old imports |
| 4.2 | `hobby-options.ts` deleted, no residual references | 🟡 | `lib/hobby-options.ts` deleted | grep for `hobby-options` |
| 4.3 | All 30 steps rendered via single-screen flow in order | 🟢 | `lib/onboarding-config.ts`, `app/(onboarding)/onboarding.tsx` | Walked full flow on Samsung 2026-04-16 |
| 4.4 | CityAutocompleteStep + cities dataset work offline | 🟡 | `components/onboarding/steps/CityAutocompleteStep.tsx`, `assets/data/cities.ts` | Airplane mode test |
| 4.5 | Each step fits viewport, no scroll (Golden Rule #3) | ⚪ | all `components/onboarding/steps/*` | Small device (SE-class) check |
| 4.5a | Prompts step: flicker fixed (noScroll + internal ScrollView + KAV fix) | 🟢 | `app/(onboarding)/onboarding.tsx`, `app/(onboarding)/prompts.tsx` | Verified on Samsung |
| 4.5b | Voice-intro step (28): compact layout, fits one viewport | 🟢 | `app/(onboarding)/voice-intro.tsx`, `app/(onboarding)/onboarding.tsx` | Verified on Samsung |
| 4.5c | Voice-intro: native waveform module loads in dev builds | 🟢 | `components/shared/ConditionalWaveform.tsx` | Verified on Samsung dev build |
| 4.5d | Voice-intro: record/stop/playback all functional | 🟢 | `app/(onboarding)/voice-intro.tsx` | Record + play + upload verified |
| 4.5e | Voice-intro: playback uses expo-av (reliable across remounts) | 🟢 | `app/(onboarding)/voice-intro.tsx` | Navigate away + back, playback works |
| 4.5f | Prompts: back from voice-intro resumes at last sub-step | 🟢 | `app/(onboarding)/prompts.tsx` | Press back from step 28, lands on prompt 3 |
| 4.5g | OnboardingLayout: consistent circle button on all steps (check icon on last) | 🟢 | `components/onboarding/OnboardingLayout.tsx` | Visual check |
| 4.6 | Resume mid-onboarding returns to correct step | ⚪ | `stores/onboardingStore.ts` + step check | Kill app mid-flow, relaunch |
| 4.7 | Onboarding reminders (24h/3d/7d) still fire | ⚪ | `supabase/functions/onboarding-reminders/index.ts` | Check cron logs |
| 4.8 | `profile_complete` flips true only after all required steps | 🟢 | onboarding finalize | DB shows `profile_complete=true, onboarding_step=30` |

---

## 5. Onboarding → DB → Display field audit

Fields collected in onboarding must be saved, displayed, and used in matching.

| # | Item | Status | Files | Verification |
|---|------|--------|-------|--------------|
| 5.1 | `languages_spoken` used in matching but rarely populated — added null guard so it only scores when both profiles have data | 🟢 | `lib/matching-algorithm.ts` lines 472-479 | Algorithm gracefully skips when field is empty |
| 5.2 | `smokes_weed` + `does_drugs` collected and saved but never scored | 🟡 | `lib/matching-algorithm.ts` | Add to lifestyle scoring or document why excluded |
| 5.3 | `height_inches` collected and saved but not used in matching | ⚪ | `lib/matching-algorithm.ts` | Intentional? Document decision |
| 5.4 | `must_haves` / `dealbreakers` from marriage-preferences shown on ImmersiveProfileCard but not in main onboarding flow | ⚪ | `components/matching/ImmersiveProfileCard.tsx` | Verify saved + displayed |
| 5.5 | All 30 onboarding fields present in saveCheckpoint profileData + prefsData | 🟡 | `app/(onboarding)/onboarding.tsx` lines 216-305 | Compare store fields to DB writes |

---

## 6. Profile display & visibility

| # | Item | Status | Files | Verification |
|---|------|--------|-------|--------------|
| 6.1 | IdealMarriageCard replaces hobbies/interests on all profile views | 🟡 | `app/profile/[id].tsx`, `DiscoveryProfileView.tsx`, `ImmersiveProfileCard.tsx` | Visual check |
| 6.2 | Visibility toggles from PROFILE_SPEC honored (show_reviews, hide_distance, hide_last_active) | ⚪ | profile render paths | Toggle each, verify |
| 6.3 | Removed fields (hobbies, MBTI, love language) don't leak into UI | ⚪ | grep for `mbti`, `love_language`, `hobbies` in JSX | Static grep |
| 6.4 | `translate-profile-values.ts` covers every enum the UI renders | 🟡 | `lib/translate-profile-values.ts` | Walk i18n strings |

---

## 7. Monetization & subscription integrity

| # | Item | Status | Files | Verification |
|---|------|--------|-------|--------------|
| 7.1 | RevenueCat webhook updates `subscriptions` + `profiles.is_premium` atomically | 🟡 | `supabase/functions/revenuecat-webhook/index.ts` | Test purchase sandbox |
| 7.2 | `reconcile-subscriptions` sweeps stuck/expired rows on cron | 🟡 | `supabase/functions/reconcile-subscriptions/index.ts` | Run once, check results |
| 7.3 | `sweep-stuck-premium.js` one-off has been run & results reviewed | 🟡 | `scripts/sweep-stuck-premium.js`, `sweep-results-*.json` | Read JSON outputs |
| 7.4 | Paywall correctly reflects current tier (premium vs platinum) | ⚪ | `components/premium/PremiumPaywall.tsx`, `contexts/SubscriptionContext.tsx` | Mock tier changes |
| 7.5 | Winback campaign targets correct churned users | ⚪ | `supabase/functions/winback-subscribers/index.ts` | Dry-run logs |
| 7.6 | Free match limit = 10, counter visible on matches page | 🟢 | shipped 8d9db2c | — |

---

## 8. Notifications & email

| # | Item | Status | Files | Verification |
|---|------|--------|-------|--------------|
| 8.1 | MailerLite fully removed, replacement (Resend?) handles all lifecycle emails | 🟡 | `supabase/functions/resend-webhook/index.ts`, deleted mailerlite-* | Send test of each email type |
| 8.2 | Push tokens registered + `push_enabled` respected | ⚪ | `lib/notifications.ts` | Background notification test |
| 8.3 | Notify-new-match / like / message still fire with new structure | ⚪ | `supabase/functions/notify-*` | Trigger each, inbox check |
| 8.4 | `email_unsubscribed_at` / `email_bounced` set from Resend webhook | ⚪ | `resend-webhook/index.ts` | Simulate bounce |

---

## 9. Safety, moderation, reporting

| # | Item | Status | Files | Verification |
|---|------|--------|-------|--------------|
| 9.1 | ReportUserModal writes to `reports` table with evidence URLs | 🟡 | `components/moderation/ReportUserModal.tsx` | File test report |
| 9.2 | `moderate-photo` edge function still runs on photo upload | 🟡 | `supabase/functions/moderate-photo/index.ts` | Upload, check status |
| 9.3 | Content moderation covers message send path | ⚪ | `lib/content-moderation.ts` | Send flagged content |
| 9.4 | Blocks hide profile both directions in discover | ⚪ | discovery query | Block + verify absence |

---

## 10. Pre-ship checklist (run before next release)

- [x] Walk full onboarding on fresh account (Android Samsung — 2026-04-16)
- [ ] Walk full onboarding on iOS
- [ ] Verify discover feed respects every hard filter (gender, age, distance)
- [ ] Change a preference → reload → confirm persisted
- [ ] Kill app mid-onboarding → relaunch → resumes correctly
- [ ] Purchase in sandbox → is_premium flips → paywall unlocks
- [ ] Send/receive push notification
- [ ] No uncommitted spec docs (stage MATCHING/ONBOARDING/PROFILE/QUALITY specs or decide to drop)
- [ ] Review QUALITY_PLAYBOOK.md checklist
- [ ] `npx expo-doctor` clean
- [ ] Type check + lint clean

---

## Log

- **2026-04-11** — Overhaul kicked off after Google Play review. Spec docs created.
- **2026-04-15** — Audit tracker created.
- **2026-04-15** — Fixed prompts step flicker: noScroll + internal ScrollView + KAV `behavior={undefined}` on Android. (4.5a)
- **2026-04-15** — Fixed embedded bottom bars missing safe-area insets (prompts + voice-intro).
- **2026-04-15** — Redesigned voice-intro embedded layout: compact chips, smaller record button, no tips card, fits viewport. (4.5b)
- **2026-04-15** — Fixed voice-intro: setState-during-render, record button ref null, stop order, audio mode, file:// prefix, expo-av playback, waveform bars. (4.5c-e)
- **2026-04-15** — Fixed prompts back-navigation resuming at last sub-step. (4.5f)
- **2026-04-15** — Unified OnboardingLayout continue button to circle on all steps. (4.5g)
- **2026-04-16** — Removed `__DEV__` gate from ConditionalWaveform; native module loads in dev builds now.
- **2026-04-16** — Fixed `"Everyone"` gender_preference in `get_nearby_profiles` and `refresh_discovery_feed` RPCs. Was treated as literal gender match → zero results. Now skips gender filter when "Everyone" is selected. Migration applied. (2.1)
- **2026-04-16** — Full audit completed: filter persistence, onboarding field gaps, matching algorithm. Identified 3 critical sticky-filter bugs (1.1-1.3), client-side hard filter gap (2.2, 3.1), and `languages_spoken` data gap (5.1).
- **2026-04-16** — Fixed all critical bugs:
  - 1.1: `persistFilters()` now awaited in both FilterModal onApply handlers
  - 1.2: `useFocusEffect` dependency array fixed (`[user?.id]`) so `loadCurrentProfile` is called fresh on each focus
  - 1.3: False alarm — hash already included matching pref fields; real issue was stale closure (1.2)
  - 2.2: "Everyone" handling added to client-side gender filter in discover.tsx (both search + normal query paths) and matching-algorithm.ts scoring
  - 3.1: Confirmed age hard-exclude already works in discover.tsx (line 1386)
  - 5.1: `languages_spoken` null guard added; gracefully skips when field is empty
