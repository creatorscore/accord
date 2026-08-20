import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Keyboard } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import i18n from '@/lib/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { nameHasContactInfo, NAME_CONTACT_INFO_MESSAGE } from '@/lib/content-moderation';
import { captureException, addBreadcrumb } from '@/lib/sentry';
import { useOnboardingStore } from '@/stores/onboardingStore';
import {
  ONBOARDING_STEPS,
  TOTAL_ONBOARDING_STEPS,
  GENDERS,
  PRONOUNS,
  ETHNICITIES,
  RELIGIONS,
  POLITICAL_VIEWS,
  RELATIONSHIP_TYPES,
  PRIMARY_REASONS,
  CHILDREN_OPTIONS,
  FAMILY_PLANS,
  PETS_OPTIONS,
  HOUSING_PREFERENCES,
  FINANCIAL_ARRANGEMENTS,
  EDUCATION_LEVELS,
  DRINKING_OPTIONS,
  SMOKING_OPTIONS,
  WEED_OPTIONS,
  DRUG_OPTIONS,
  mapOldStepToNew,
  resolveResumeStep,
  earliestMissingRequiredStep,
} from '@/lib/onboarding-config';
import { expandGenderPreference, collapseGenderPreference } from '@/lib/gender-preferences';
import { ensurePushTokenSaved, registerForPushNotifications } from '@/lib/notifications';
import { getDeviceFingerprint } from '@/lib/device-fingerprint';
import { PROFILE_TEXT_LIMITS, clampText } from '@/lib/geolocation';
import { trackUserAction, trackFunnel } from '@/lib/analytics';
import { usePreviewModeStore } from '@/stores/previewModeStore';
import * as Haptics from 'expo-haptics';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import {
  NameStep,
  DOBStep,
  NotificationsStep,
  LocationStep,
  HeightStep,
  MatchingPrefsStep,
  FieldChipStep,
  FieldTextStep,
  OrientationFieldStep,
  GenderPrefFieldStep,
  HometownFieldStep,
  LanguagesFieldStep,
  MustHavesFieldStep,
  DealbreakersFieldStep,
} from '@/components/onboarding/steps';

// Lazy imports for heavy steps
import { lazy, Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { toUserMessage } from '@/lib/error-messages';
const PhotosStep = lazy(() => import('@/app/(onboarding)/photos'));
const PromptsStep = lazy(() => import('@/app/(onboarding)/prompts'));
const VoiceStep = lazy(() => import('@/app/(onboarding)/voice-intro'));

const StepFallback = () => <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#A08AB7" /></View>;

/**
 * profiles column -> onboarding store field, for the length-bounded text
 * columns the checkpoint writes. Used by clampProfilePayload to mirror a
 * clamped value back into the store; without the mirror the UI would keep
 * showing the long text and every later step would resend it.
 *
 * Only columns present in PROFILE_TEXT_LIMITS need an entry. `occupation`
 * and `job_title` are both fed by `jobTitle`, and clamping to the narrower
 * of the two (occupation, varchar(100)) keeps them consistent.
 */
const CHECKPOINT_COLUMN_TO_STORE_FIELD: Record<string, string> = {
  display_name: 'displayName',
  zodiac_sign: 'zodiacSign',
  location_city: 'locationCity',
  location_state: 'locationState',
  location_country: 'locationCountry',
  pronouns: 'pronouns',
  occupation: 'jobTitle',
  education: 'education',
  religion: 'religion',
  political_views: 'politicalViews',
  hometown: 'hometown',
};

/**
 * Clamp every length-bounded text column in a checkpoint payload to its
 * column width, mutating the payload in place, and mirror the clamped values
 * back into the onboarding store via `setFields`.
 *
 * Returns the list of columns that were actually shortened (empty in the
 * overwhelming majority of saves), for breadcrumb/telemetry purposes.
 */
function clampProfilePayload(
  payload: Record<string, any>,
  setFields: (fields: Record<string, any>) => void,
): string[] {
  const storeFix: Record<string, string> = {};
  const clamped: string[] = [];

  for (const [column, max] of Object.entries(PROFILE_TEXT_LIMITS)) {
    const value = payload[column];
    if (typeof value === 'string' && value.length > max) {
      const next = clampText(value, max) ?? '';
      payload[column] = next || null;
      clamped.push(column);
      const storeField = CHECKPOINT_COLUMN_TO_STORE_FIELD[column];
      if (storeField) storeFix[storeField] = next;
    }
  }

  if (Object.keys(storeFix).length > 0) setFields(storeFix);
  return clamped;
}

export default function Onboarding() {
  const { resumeStep } = useLocalSearchParams<{ resumeStep?: string }>();
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { showToast } = useToast();
  const enterPreviewMode = usePreviewModeStore((s) => s.enterPreviewMode);

  const [subStep, setSubStep] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const initialLoadDone = useRef(false);

  // Seed notificationsGranted from the actual OS permission on mount, so a
  // user who enabled notifications in a prior session (or on another step
  // that triggered the prompt) sees the "enabled" state when they come back
  // to step 2 instead of the enable button again.
  useEffect(() => {
    (async () => {
      try {
        const Notifications = require('expo-notifications');
        const { status } = await Notifications.getPermissionsAsync();
        if (status === 'granted') setNotificationsGranted(true);
      } catch {
        // If expo-notifications is unavailable here, fall back to the user
        // tapping the button explicitly.
      }
    })();
  }, []);

  // Store accessors. Previously this component subscribed to the
  // entire store (`useOnboardingStore()`) and re-rendered on every
  // field change — by step 12 the JS thread was blocking long enough
  // on tap-driven re-renders that chip presses appeared frozen on
  // iPhone 14 Pro / iPad Pro. Now: action selectors only (stable
  // refs) + a single boolean selector for the current step's validity.
  // Inside callbacks we read state via `useOnboardingStore.getState()`,
  // which is non-reactive. Form-field rendering lives in per-field
  // wrapper components (FieldChipStep, FieldTextStep, etc.) that each
  // subscribe to only their own slice.
  const setFields = useOnboardingStore((s) => s.setFields);

  const stepConfig = ONBOARDING_STEPS[subStep];

  // Single boolean selector — parent re-renders only when this flips.
  const isCurrentStepValid = useOnboardingStore((s): boolean => {
    switch (subStep) {
      case 0: return s.displayName.trim().length >= 1;
      case 1: return s.birthDate !== null && s.age !== null && s.age >= 18;
      case 2: return true; // notifications skippable
      case 3:
        return !!(s.locationCity || s.locationState)
          && s.latitude != null
          && s.longitude != null;
      case 4: return !!s.pronouns;
      case 5: return s.gender.length > 0;
      case 6: return s.sexualOrientation.length > 0;
      case 7: return s.genderPreference.length > 0;
      case 8: return s.relationshipType !== '';
      case 9: return s.primaryReasons.length > 0;
      case 12: return s.wantsChildren !== '';
      case 21: return s.financialArrangement.length > 0;
      case 22: return s.housingPreference.length > 0;
      default: return true;
    }
  });

  // ── Load existing profile data on mount ──
  useEffect(() => {
    if (initialLoadDone.current || !user?.id) return;
    initialLoadDone.current = true;

    (async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*, preferences:preferences(*)')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile) {
          setProfileId(profile.id);
          const prefs = Array.isArray(profile.preferences) ? profile.preferences[0] : profile.preferences;

          // Hydrate store from existing DB data, but only for fields the user
          // hasn't already touched locally. The zustand persist middleware may
          // have already rehydrated in-progress answers (gender, genderPreference,
          // etc.) from AsyncStorage before this effect runs; overwriting those
          // with DB defaults would wipe the user's unsaved progress and send
          // them back to re-enter the same answers.
          useOnboardingStore.getState().hydrateIfEmpty({
            displayName: profile.display_name || '',
            birthDate: profile.birth_date ? new Date(profile.birth_date) : null,
            age: profile.age || null,
            zodiacSign: profile.zodiac_sign || '',
            locationCity: profile.location_city || '',
            locationState: profile.location_state || '',
            locationCountry: profile.location_country || 'US',
            latitude: profile.latitude || null,
            longitude: profile.longitude || null,
            pronouns: profile.pronouns || '',
            gender: profile.gender || [],
            sexualOrientation: profile.sexual_orientation || [],
            // 'Everyone' is no longer a selectable chip. A returning user who
            // picked it (stored []) collapses to ['Everyone'] — show that as all
            // three selected so the step isn't blank; expandGenderPreference
            // saves it back to [] (Everyone).
            genderPreference: (() => {
              const collapsed = collapseGenderPreference(prefs?.gender_preference || []);
              return collapsed.includes('Everyone') ? ['Men', 'Women', 'Non-binary'] : collapsed;
            })(),
            relationshipType: prefs?.relationship_type || '',
            primaryReasons: prefs?.primary_reasons || [],
            heightInches: profile.height_inches || null,
            heightUnit: profile.height_unit || 'imperial',
            ethnicity: profile.ethnicity || [],
            wantsChildren: prefs?.wants_children === true ? 'yes' : prefs?.wants_children === false ? 'no' : prefs?.wants_children === null ? '' : 'maybe',
            childrenArrangement: prefs?.children_arrangement || [],
            hometown: profile.hometown || '',
            jobTitle: profile.job_title || profile.occupation || '',
            education: profile.education || '',
            educationLevel: profile.education_level || '',
            religion: profile.religion || '',
            politicalViews: profile.political_views || '',
            financialArrangement: prefs?.financial_arrangement || [],
            housingPreference: prefs?.housing_preference || [],
            pets: prefs?.lifestyle_preferences?.pets || '',
            drinking: prefs?.lifestyle_preferences?.drinking || '',
            smoking: prefs?.lifestyle_preferences?.smoking || '',
            smokesWeed: profile.smokes_weed || '',
            doesDrugs: profile.does_drugs || '',
            ageMin: prefs?.age_min || 22,
            ageMax: prefs?.age_max || 45,
            maxDistanceMiles: prefs?.max_distance_miles || 50,
            willingToRelocate: prefs?.willing_to_relocate ?? false,
            languagesSpoken: Array.isArray(profile.languages_spoken) ? profile.languages_spoken : [],
            mustHaves: Array.isArray(prefs?.must_haves) ? prefs.must_haves : [],
            dealbreakers: Array.isArray(prefs?.dealbreakers) ? prefs.dealbreakers : [],
            fieldVisibility: profile.field_visibility || {},
          });

          // Determine resume step.
          //
          // Two inputs can tell us where the user belongs:
          //   1. URL `resumeStep` — explicit "I was here" hint set when the
          //      user taps "Take a look around" from onboarding into Discover.
          //      When present, this is the most reliable signal.
          //   2. `earliestMissingRequiredStep(profile, prefs)` — data-driven
          //      heuristic that bounces legacy users back to the first
          //      required field they never filled.
          //
          // Previously the URL was discarded whenever `profile.onboarding_step
          // <= 9`, which meant every "back from preview" on a brand-new user
          // landed at the heuristic's earliest-missing step instead of where
          // the user actually was (causing either a backward bounce or a
          // forward skip, depending on prior DB state). Honor the URL param as
          // the TARGET; only bounce earlier if a required field *before* that
          // target is genuinely missing.
          const urlStep = parseInt(resumeStep || '0', 10) || 0;
          let mappedStep: number;
          if (urlStep > 0) {
            const missing = earliestMissingRequiredStep(profile, prefs);
            mappedStep = (missing !== null && missing < urlStep)
              ? missing
              : Math.min(urlStep, TOTAL_ONBOARDING_STEPS - 1);
          } else {
            mappedStep = resolveResumeStep(
              profile.onboarding_step || 0,
              profile,
              prefs,
              TOTAL_ONBOARDING_STEPS,
            );
          }
          setSubStep(mappedStep);

          // Warn if resuming past identity steps but critical prefs are missing
          // (indicates a previous save failure)
          if (mappedStep > 14 && prefs) {
            const missing: string[] = [];
            // gender_preference === [] is valid — it means "Everyone". Only null/undefined = actually missing.
            if (prefs.gender_preference == null) missing.push('gender preference');
            if (!prefs.relationship_type) missing.push('relationship type');
            if (missing.length > 0) {
              showToast({ type: 'info', title: 'Review needed', message: `Your ${missing.join(' and ')} may not have saved. Please review previous steps.` });
            }
          }
        } else {
          // No profile yet — start from step 0
          setSubStep(parseInt(resumeStep || '0', 10) || 0);
        }
      } catch (error) {
        console.error('Error loading profile for onboarding:', error);
      }
    })();
  }, [user?.id]);

  // ── Prefetch heavy lazy chunks ──
  // photos/prompts/voice each pull in big native deps (expo-image-picker,
  // expo-av, audio-waveform). When fired only at first paint of their
  // own step, the user stares at a spinner while Metro (dev) or RN
  // (prod) does the chunk fetch + module init. Kick the imports off as
  // soon as the user enters the relevant section so the chunk is warm
  // by the time we render it. Fire-and-forget; errors are swallowed
  // because Suspense will retry the import on actual render anyway.
  useEffect(() => {
    if (subStep >= 24 && subStep < 27) {
      import('@/app/(onboarding)/photos').catch(() => {});
    }
    if (subStep >= 26 && subStep < 28) {
      import('@/app/(onboarding)/prompts').catch(() => {});
    }
    if (subStep >= 27 && subStep < 29) {
      import('@/app/(onboarding)/voice-intro').catch(() => {});
    }
  }, [subStep]);

  // Validation lives in the isCurrentStepValid selector defined above.

  // ── Retry helper for transient failures ──
  const withRetry = async <T,>(fn: () => PromiseLike<T>, retries = 1, delayMs = 1000): Promise<T> => {
    try {
      return await fn();
    } catch (error: any) {
      if (retries > 0 && (error?.message?.includes('network') || error?.message?.includes('timeout') || error?.code === 'PGRST301' || error?.code === '503')) {
        await new Promise(r => setTimeout(r, delayMs));
        return withRetry(fn, retries - 1, delayMs * 2);
      }
      throw error;
    }
  };

  // ── Save checkpoint to DB ──
  const saveCheckpoint = useCallback(async (step: number) => {
    console.log('[saveCheckpoint] enter, target step =', step, 'user?.id =', user?.id);
    if (!user?.id) { console.log('[saveCheckpoint] no user, returning'); return; }
    setSaving(true);
    // Non-reactive read of the store at save time. We don't subscribe to
    // state changes here — by the time saveCheckpoint runs (Continue tap),
    // the latest values are already in the state. Avoids the
    // store-in-deps re-render storm that plagued the parent.
    const state = useOnboardingStore.getState();
    try {
      console.log('[saveCheckpoint] getDeviceFingerprint...');
      const deviceFingerprint = await getDeviceFingerprint();
      console.log('[saveCheckpoint] got fingerprint');

      // Profile data
      const profileData: Record<string, any> = {
        user_id: user.id,
        display_name: state.displayName,
        birth_date: state.birthDate?.toISOString().split('T')[0] || null,
        age: state.age,
        zodiac_sign: state.zodiacSign,
        location_city: state.locationCity,
        location_state: state.locationState,
        location_country: state.locationCountry,
        // Only write coords when we actually have them. Writing null here
        // clobbers good coords on a row that is ALREADY profile_complete=true
        // (a user who finished earlier and re-entered onboarding, or a row
        // completed by backfill-stuck-onboarding), which trips the
        // location_required_when_complete CHECK — the constraint is
        // re-evaluated on every UPDATE, not just the one that sets the flag.
        // That's the remaining half of REACT-8R: the final-step guard below
        // only covers saves that SET profile_complete, but these violations
        // fire mid-flow (observed at step 27) where the flag isn't in the
        // payload at all. Omitting the keys leaves the stored coords intact.
        ...(state.latitude != null && state.longitude != null
          ? { latitude: state.latitude, longitude: state.longitude }
          : {}),
        // Stamp last_gps_at at the location checkpoint (step 3 → 4) so
        // the staleness banner knows this profile has a fresh GPS read.
        // LocationStep is GPS-only (autocomplete removed), so lat/lng
        // being present at this step necessarily implies a GPS source.
        // ANTI-SCAM: tag location_source='gps' here too so the main onboarding
        // flow's (majority) users read as trusted, not null/untrusted.
        ...(step === 4 && state.latitude != null && state.longitude != null
          ? { last_gps_at: new Date().toISOString(), location_source: 'gps' }
          : {}),
        pronouns: state.pronouns || null,
        gender: state.gender,
        sexual_orientation: state.sexualOrientation,
        ethnicity: state.ethnicity.length > 0 ? state.ethnicity : null,
        height_inches: state.heightInches,
        height_unit: state.heightUnit,
        hometown: state.hometown || null,
        job_title: state.jobTitle || null,
        occupation: state.jobTitle || null, // keep occupation in sync
        education: state.education || null,
        education_level: state.educationLevel || null,
        religion: state.religion || null,
        political_views: state.politicalViews || null,
        languages_spoken: state.languagesSpoken.length > 0 ? state.languagesSpoken : null,
        smokes_weed: state.smokesWeed || null,
        does_drugs: state.doesDrugs || null,
        field_visibility: state.fieldVisibility,
        device_id: deviceFingerprint,
        // Previously hardcoded 'en' — sent every non-English user English
        // push notifications and emails regardless of UI language. Use the
        // active i18n locale so localized email/push templates actually
        // reach the right cohort.
        preferred_language: i18n.language || 'en',
        onboarding_step: step,
        // Only set profile_complete on the final step — AND only when coords are
        // present, so the location_required_when_complete CHECK can never throw
        // (REACT-8R). The step-3 UI gate + final-step preflight normally guarantee
        // coords, but a resumed/backfilled/older-client row can still reach here
        // with null lat/lng; in that rare case we leave the profile incomplete
        // (the app routes them back to finish location) instead of dead-ending on
        // a raw constraint-error toast.
        ...(step >= TOTAL_ONBOARDING_STEPS - 1 && state.latitude != null && state.longitude != null
          ? { profile_complete: true }
          : {}),
      };

      // Guarantee no length-bounded column can overflow before the payload
      // ever reaches Postgres. Clamping here rather than only reacting to the
      // error matters: a 22001 thrown by the profile upsert aborts the whole
      // checkpoint *before* the preferences upsert on the sequential path
      // (new signup / final step), so a reactive retry would save the profile
      // and silently drop preferences. Getting the write right the first time
      // keeps the normal path intact.
      //
      // Values are mirrored back into the store so the shortened text is what
      // the user sees and what later steps resend.
      const clampedFields = clampProfilePayload(profileData, state.setFields);
      if (clampedFields.length > 0) {
        addBreadcrumb('onboarding', 'Clamped over-long profile fields before save', {
          step,
          fields: clampedFields.join(','),
        });
      }

      // Build the preferences payload up-front so we can fire profile + prefs
      // upserts concurrently when we already know the profile id.
      const buildPrefsData = (pid: string): Record<string, any> => ({
        profile_id: pid,
        gender_preference: expandGenderPreference(state.genderPreference),
        // Mark gender preference as explicitly confirmed by the user. Any
        // checkpoint after step 7 (genderPreference picker) means they've
        // explicitly answered. The discover screen uses this flag to decide
        // whether to show the recovery prompt for pre-fix wiped users.
        gender_preference_confirmed_at: new Date().toISOString(),
        relationship_type: state.relationshipType || 'platonic',
        primary_reasons: state.primaryReasons.length > 0 ? state.primaryReasons : null,
        // Legacy column — keep in sync to avoid NOT NULL constraint on older schema
        primary_reason: state.primaryReasons.length > 0 ? state.primaryReasons[0] : 'other',
        wants_children: state.wantsChildren === 'yes' ? true : state.wantsChildren === 'no' ? false : null,
        children_arrangement: state.childrenArrangement.length > 0 ? state.childrenArrangement : null,
        financial_arrangement: state.financialArrangement.length > 0 ? state.financialArrangement : null,
        housing_preference: state.housingPreference.length > 0 ? state.housingPreference : null,
        must_haves: state.mustHaves.length > 0 ? state.mustHaves : null,
        dealbreakers: state.dealbreakers.length > 0 ? state.dealbreakers : null,
        lifestyle_preferences: {
          pets: state.pets || null,
          drinking: state.drinking || null,
          smoking: state.smoking || null,
          smokes_weed: state.smokesWeed || null,
          does_drugs: state.doesDrugs || null,
        },
        age_min: state.ageMin,
        age_max: state.ageMax,
        max_distance_miles: state.maxDistanceMiles,
        distance_unit: state.distanceUnit || 'miles',
        willing_to_relocate: state.willingToRelocate,
      });

      // Race helper: treat a response-level timeout as "write likely succeeded"
      // rather than a fatal error (Postgres logs show the server-side write
      // completes in ~100ms; only the HTTP response is queue-stalled).
      const raceWithTimeout = <T,>(p: PromiseLike<T>, ms: number, label: string): Promise<T | { error: { code: 'TIMEOUT'; message: string } }> =>
        Promise.race([
          p as Promise<T>,
          new Promise<{ error: { code: 'TIMEOUT'; message: string } }>((resolve) =>
            setTimeout(() => resolve({ error: { code: 'TIMEOUT', message: `${label} timed out — write likely succeeded` } }), ms)
          ),
        ]);

      const profileUpsert = supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'user_id' })
        .select('id')
        .single();

      // Parallelize when we already know the profile id (returning user) AND
      // we're not on the final step. The final step flips profile_complete
      // = true, which fires `trigger_create_preferences_on_complete` on
      // profiles — that trigger writes to the preferences row from within
      // the profile transaction, and a concurrent preferences upsert trying
      // to lock the same row deadlocks with it. Sequential on the final
      // step avoids the deadlock at the cost of a few hundred ms.
      // Non-final steps also run sequential when profileId is null (brand-new
      // signup) so preferences doesn't violate the FK before profile inserts.
      const isFinalStep = step >= TOTAL_ONBOARDING_STEPS - 1;
      let upserted: { id?: string } | null = null;
      let profileError: any = null;
      let prefsError: any = null;

      if (profileId && !isFinalStep) {
        console.log('[saveCheckpoint] parallel upsert (profile + preferences)');
        const prefsUpsert = supabase
          .from('preferences')
          .upsert(buildPrefsData(profileId), { onConflict: 'profile_id' });
        const [profResult, prefsResult] = await Promise.all([
          raceWithTimeout(profileUpsert, 4000, 'profile upsert'),
          raceWithTimeout(prefsUpsert, 4000, 'preferences upsert'),
        ]);
        upserted = (profResult as any).data ?? null;
        profileError = (profResult as any).error ?? null;
        prefsError = (prefsResult as any).error ?? null;
      } else {
        console.log('[saveCheckpoint] sequential upsert', isFinalStep ? '(final step — avoids trigger deadlock)' : '(new signup)');
        const profResult = await raceWithTimeout(profileUpsert, 6000, 'profile upsert');
        upserted = (profResult as any).data ?? null;
        profileError = (profResult as any).error ?? null;
      }
      console.log('[saveCheckpoint] profile upsert done. err =', profileError?.message, 'id =', upserted?.id);

      if (profileError && profileError.code !== 'TIMEOUT') throw profileError;

      let pid = upserted?.id || profileId;
      if (!pid) {
        console.log('[saveCheckpoint] no id from upsert, looking up by user_id...');
        const lookupResult = await raceWithTimeout(
          supabase.from('profiles').select('id').eq('user_id', user.id).maybeSingle(),
          4000,
          'profile id lookup'
        );
        pid = (lookupResult as any).data?.id || null;
        console.log('[saveCheckpoint] id lookup result:', pid);
      }
      if (pid && !profileId) setProfileId(pid);

      // If we ran sequentially (new signup OR final step), do preferences
      // now that we have pid AND the profile transaction has committed.
      if ((!profileId || isFinalStep) && pid) {
        console.log('[saveCheckpoint] upserting preferences for pid', pid);
        const prefsResult = await raceWithTimeout(
          supabase.from('preferences').upsert(buildPrefsData(pid), { onConflict: 'profile_id' }),
          5000,
          'preferences upsert'
        );
        prefsError = (prefsResult as any).error ?? null;
      }
      console.log('[saveCheckpoint] preferences upsert done. err =', prefsError?.message);

      if (prefsError && prefsError.code !== 'TIMEOUT') throw prefsError;

      // Push token save is fire-and-forget — we're not going to block Continue
      // on it. Fires in the background; if it fails, NotificationContext has
      // its own retry loop that'll pick up on next app launch.
      //
      // ensurePushTokenSaved looks up the profile via user_id (auth uid), NOT
      // profile_id. Passing profileId here silently fails — the lookup
      // returns PGRST116 and the token never lands. (~33% of post-2026-04-22
      // cohort had no push token saved because of this.) Also: 3s was too
      // tight for getExpoPushTokenAsync on first call — FCM/APNS registration
      // routinely takes 5-10s on a real device. Bumped to 10s.
      if (notificationsGranted && pid) {
        const authUserId: string = user.id;
        (async () => {
          try {
            const token = await Promise.race<string | null>([
              registerForPushNotifications().catch(() => null),
              new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
            ]);
            if (token) await ensurePushTokenSaved(authUserId, token).catch(() => {});
          } catch {}
        })();
      }
      console.log('[saveCheckpoint] all done, returning');
    } catch (error: any) {
      // Orphaned-session recovery: if the auth user backing this session no
      // longer exists (account deleted out from under the device, server-side
      // wipe, etc.), every profile write fails the profiles_user_id_fkey
      // constraint (code 23503, "Key is not present in table users"). There is
      // no sign-out affordance inside onboarding, so the user would be wedged
      // forever — each Continue tap just re-hits the same FK error. Detect it,
      // sign out (which now force-clears the dead local session even if the
      // server /logout 401s), and bounce to the auth flow for a clean sign-in.
      const fkCode: string | undefined = (error as any)?.code;
      const fkMsg: string = (error?.message || '').toString();
      if (fkCode === '23503' && fkMsg.includes('profiles_user_id_fkey')) {
        console.warn('[saveCheckpoint] orphaned session (auth user missing) — signing out and routing to auth');
        showToast({ type: 'info', title: 'Session expired', message: 'Please sign in again to continue.' });
        try { await signOut(); } catch { /* signOut already force-clears local session */ }
        router.replace('/(auth)/welcome');
        // Re-throw so handleContinue treats this as a failed save and does NOT
        // advance the step (otherwise it logs SUCCESS and tries to render the
        // next step while we're navigating away to the auth flow).
        throw error;
      }
      // Defense in depth: on the final save, the location_required_when_complete
      // CHECK constraint trips if lat/lng are null. Step 3's UI gate normally
      // prevents this, but an older client/build could still surface it.
      // Try one geocode + retry before bubbling the error to the toast.
      const msg = error?.message || '';
      const isLocationConstraint =
        msg.includes('location_required_when_complete') ||
        (msg.includes('violates check constraint') && msg.includes('location'));
      const isFinalStep = step >= TOTAL_ONBOARDING_STEPS;
      if (isLocationConstraint && isFinalStep && state.locationCity) {
        try {
          const { data: geo, error: geoErr } = await supabase.functions.invoke('geocode-city', {
            body: {
              city: state.locationCity,
              state: state.locationState,
              country: state.locationCountry,
            },
          });
          if (!geoErr && geo && typeof geo.latitude === 'number' && typeof geo.longitude === 'number') {
            state.setFields({ latitude: geo.latitude, longitude: geo.longitude });
            const pid = profileId;
            if (pid) {
              const { error: retryErr } = await supabase
                .from('profiles')
                .update({
                  latitude: geo.latitude,
                  longitude: geo.longitude,
                  profile_complete: true,
                  onboarding_step: TOTAL_ONBOARDING_STEPS,
                  updated_at: new Date().toISOString(),
                })
                .eq('id', pid);
              if (!retryErr) {
                console.log('[saveCheckpoint] recovered from location constraint via geocode + retry');
                return;
              }
              captureException(
                new Error((retryErr as any)?.message || 'location constraint retry failed'),
                { step, context: 'location_constraint_retry' },
                ['onboarding-location-constraint-retry'],
              );
            }
          } else {
            captureException(
              new Error(geoErr?.message || 'geocode-city returned no coords'),
              { step, context: 'location_constraint_geocode' },
              ['onboarding-location-geocode-failed'],
            );
          }
        } catch (recoveryErr: any) {
          captureException(
            recoveryErr instanceof Error ? recoveryErr : new Error(recoveryErr?.message || 'recovery failed'),
            { step, context: 'location_constraint_recovery' },
            ['onboarding-location-recovery-failed'],
          );
        }
      }
      console.error('Checkpoint save error:', error);
      // Classify by error.code so retryable transient failures (network,
      // PGRST timeouts) don't collide with real schema/constraint bugs
      // in the same Sentry bucket.
      const ckptCode: string | undefined = (error as any)?.code;
      const ckptMsg: string = (error?.message || '').toString();

      // Photo-minimum trigger (check_minimum_photos) — the DB rejects a
      // profile_complete=true save when there are too few photos. This is the
      // same expected user state the preflight above catches, but it still
      // fires for clients running an older OTA bundle without the preflight, or
      // when moderation rejects a photo between preflight and save. Treat it as
      // a recoverable user state (bounce to the photos step) rather than a hard
      // app error — this was JAVASCRIPT-REACT-71 (8.5k captureException events).
      if (ckptMsg.includes('photos to be marked complete')) {
        addBreadcrumb('onboarding', 'Final save blocked by photo-minimum trigger', {
          step,
          error_code: ckptCode,
        });
        showToast({
          type: 'error',
          title: 'Add more photos',
          message: 'Please add at least 2 photos before finishing.',
        });
        setSubStep(27);
        throw error; // Re-throw so the caller does NOT advance the step
      }

      // Location CHECK constraint — same treatment as the photo-minimum case
      // above: a recoverable user state, not an app bug. The payload no longer
      // writes null coords, so this should only reach here on older bundles,
      // but without this branch the user gets the raw Postgres string
      // ("new row for relation \"profiles\" violates check constraint ...")
      // as a toast with no way forward. Bounce to the location step instead.
      // Observed as a retry loop: 5 failed saves in 13s from one user.
      if (ckptMsg.includes('location_required_when_complete')) {
        addBreadcrumb('onboarding', 'Checkpoint blocked by location CHECK constraint', {
          step,
          error_code: ckptCode,
        });
        captureException(
          error instanceof Error ? error : new Error('Checkpoint blocked: location required'),
          { step, context: 'onboarding_checkpoint', error_code: ckptCode },
          ['onboarding-checkpoint-location-required'],
        );
        showToast({
          type: 'error',
          title: 'Add your location',
          message: 'We need your location to save your profile. Please set it and try again.',
        });
        setSubStep(3);
        throw error; // Re-throw so the caller does NOT advance the step
      }

      // String-too-long (SQLSTATE 22001). Postgres rejects rather than
      // truncates, so a single over-long value — in practice a localized
      // region name from reverse geocoding landing in location_state
      // varchar(50) — hard-blocks the whole checkpoint. The user saw the raw
      // "value too long for type character varying(50)" as a toast with no
      // way forward and no field to edit, because the offending value was
      // never something they typed (Sentry REACT-8N: 3 failed saves in 15s
      // at step 4, then the user gave up).
      //
      // clampProfilePayload above should make this unreachable, so if we land
      // here it means a bounded column we don't know about overflowed. Retrying
      // with the same limits wouldn't help, so just make it diagnosable and
      // don't show the user a raw Postgres string they can't act on.
      if (ckptCode === '22001') {
        addBreadcrumb('onboarding', 'Checkpoint blocked by 22001 despite payload clamp', { step });
        captureException(
          error instanceof Error ? error : new Error('Checkpoint value too long'),
          { step, context: 'onboarding_checkpoint', error_code: ckptCode },
          ['onboarding-checkpoint-value-too-long'],
        );
        showToast({
          type: 'error',
          title: 'Couldn’t save',
          message: 'One of your entries was too long. Please shorten it and try again.',
        });
        throw error; // Re-throw so the caller does NOT advance the step
      }

      let ckptFingerprint = 'onboarding-checkpoint-other';
      if (ckptCode === '23505') {
        ckptFingerprint = 'onboarding-checkpoint-duplicate';
      } else if (ckptCode === '23514') {
        ckptFingerprint = 'onboarding-checkpoint-check-constraint';
      } else if (ckptCode === '42501') {
        ckptFingerprint = 'onboarding-checkpoint-permission-denied';
      } else if (ckptCode === 'PGRST303' || ckptMsg.toLowerCase().includes('jwt expired')) {
        ckptFingerprint = 'onboarding-checkpoint-jwt-expired';
      }
      captureException(
        error instanceof Error ? error : new Error(error?.message || 'Checkpoint save failed'),
        { step, context: 'onboarding_checkpoint', error_code: ckptCode },
        [ckptFingerprint],
      );
      showToast({ type: 'error', title: 'Error', message: toUserMessage(error, 'Failed to save progress. Please try again.') });
      throw error; // Re-throw so callers know the save failed
    } finally {
      setSaving(false);
    }
  }, [user?.id, profileId, notificationsGranted, setFields, showToast, signOut]);

  // ── Navigation ──
  // Debounce accidental double-taps on Continue. Real-device walk-through
  // 2026-05-28 showed users tapping Continue 2-3x within ~200ms at the
  // first preview-eligible step transitions (8: relationship_type, 9:
  // intention) — the parent re-renders the entire onboarding tree on
  // every store change and the fade-out/in animation runs 300ms total,
  // so the screen feels frozen and users panic-tap. Each tap registers
  // and they end up skipping a step.
  const lastContinueAt = useRef(0);
  const handleContinue = useCallback(async () => {
    const now = Date.now();
    if (now - lastContinueAt.current < 600) {
      console.log('[Onboarding] handleContinue ignored (double-tap within 600ms)');
      return;
    }
    lastContinueAt.current = now;
    console.log('[Onboarding] handleContinue pressed at step', subStep);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();

    // Non-reactive store read for navigation logic (wantsChildren skip,
    // final-step reset). The button's enabled/disabled state comes from
    // isCurrentStepValid (a reactive selector); this is just for the
    // single moment of the tap.
    const state = useOnboardingStore.getState();
    console.log('[Onboarding] handleContinue isCurrentStepValid =', isCurrentStepValid);
    if (!isCurrentStepValid) {
      showToast({ type: 'info', title: 'Required', message: 'Please complete this step to continue.' });
      return;
    }

    // Anti-scam: a name can't be a phone number / email / link / app handle
    // (the profiles trigger enforces this server-side too). Block on the name
    // step with a clear message instead of letting the save fail.
    if (subStep === 0 && nameHasContactInfo(state.displayName)) {
      showToast({ type: 'error', title: 'Invalid name', message: NAME_CONTACT_INFO_MESSAGE });
      return;
    }

    // Save at checkpoints: after location (3), after pets (14), after drugs (26).
    // Step 30 (final) is handled by the dedicated final-step block below —
    // including it here too caused step 30 → 31 to fire saveCheckpoint twice
    // (verified in real-device walkthroughs 2026-05-28). Both writes
    // succeeded, but the duplicate added ~1s of network latency before the
    // navigation to Discover and burned a free write quota.
    // Show a "Saving your progress..." toast only if the save actually takes
    // more than ~600ms — avoids a toast-flash on the common fast path but
    // reassures users that the app isn't frozen when the queue is stalled.
    let savingToastShown = false;
    let savingToastTimer: ReturnType<typeof setTimeout> | null = null;
    // Step 30 (matching_prefs) is a checkpoint: age range + max distance are HARD
    // filters, and since the 3 new optional steps (languages/must-haves/deal-
    // breakers) now follow it, without a save here a user who sets them then
    // abandons on a new step — and later resumes from a cleared/other-device
    // store — would land past matching_prefs and get default age/distance.
    const checkpoints = [3, 14, 26, 30];
    if (checkpoints.includes(subStep)) {
      savingToastTimer = setTimeout(() => {
        savingToastShown = true;
        showToast({ type: 'info', title: 'Saving...', message: 'Saving your progress.' });
      }, 600);
      console.log('[Onboarding] saveCheckpoint starting for step', subStep + 1);
      try {
        await saveCheckpoint(subStep + 1);
        console.log('[Onboarding] saveCheckpoint SUCCESS for step', subStep + 1);
      } catch (err: any) {
        console.log('[Onboarding] saveCheckpoint FAILED for step', subStep + 1, ':', err?.message || err);
        if (savingToastTimer) clearTimeout(savingToastTimer);
        // Save failed — toast already shown by saveCheckpoint. Stay on current step.
        return;
      } finally {
        if (savingToastTimer) clearTimeout(savingToastTimer);
      }
      if (savingToastShown) {
        showToast({ type: 'success', title: 'Saved', message: "Moving on — you're all set." });
      }
    }

    // Between hard checkpoints, still track where the user actually is so a
    // closed/reopened app doesn't bounce them back. Fire a lightweight
    // onboarding_step-only update for the non-checkpoint transitions (27, 28,
    // 29, 31, 32) — non-blocking because resume tolerates a slightly stale
    // value. Checkpoint steps (incl. 30/matching_prefs) already persist the
    // step via saveCheckpoint above, so skip them here to avoid a double write.
    if (profileId && subStep >= 27 && subStep < TOTAL_ONBOARDING_STEPS - 1 && !checkpoints.includes(subStep)) {
      const targetStep = subStep + 1;
      supabase
        .from('profiles')
        .update({ onboarding_step: targetStep })
        .eq('id', profileId)
        .then(({ error }) => {
          if (error) console.warn('[Onboarding] onboarding_step update failed', error.message);
        });
    }

    if (subStep >= TOTAL_ONBOARDING_STEPS - 1) {
      // Final step — pre-flight: photos table must have >= 2 rows or the
      // check_minimum_photos trigger rejects the profile_complete=true
      // upsert with a cryptic P0001. The photos screen tracks local state
      // optimistically; partial-failure paths (silently-swallowed 23505,
      // moderation rejections, stuck-onboarding-backfill rows) can leave
      // local state showing 3 photos while the DB has fewer. Verify
      // server-side and bounce back to step 27 with a clear message
      // before triggering the doomed upsert.
      if (profileId) {
        // Fetch the per-photo moderation status (≤6 rows) so we can both count
        // the usable (non-rejected) photos AND explain to the user when some
        // were removed by moderation — the common reason a user who "added 3
        // photos" still can't finish.
        const { data: photoRows, error: countErr } = await supabase
          .from('photos')
          .select('moderation_status')
          .eq('profile_id', profileId);
        if (countErr) {
          console.warn('[Onboarding] photo count preflight failed', countErr.message);
        } else {
          const rows = photoRows ?? [];
          const rejectedCount = rows.filter((p) => p.moderation_status === 'rejected').length;
          const usableCount = rows.length - rejectedCount;
          if (usableCount < 2) {
            // Expected user state (their photos didn't pass moderation), NOT an
            // app bug. Leave a breadcrumb instead of captureException so this
            // doesn't flood Sentry — this was JAVASCRIPT-REACT-8Y, and the raw
            // trigger error it pre-empts was JAVASCRIPT-REACT-71 (8.5k events).
            addBreadcrumb('onboarding', 'Final save blocked: insufficient usable photos', {
              profileId,
              usableCount,
              rejectedCount,
              total: rows.length,
            });
            showToast({
              type: 'error',
              title: rejectedCount > 0 ? 'Some photos were removed' : 'Add more photos',
              message:
                rejectedCount > 0
                  ? `${rejectedCount} of your photo${rejectedCount > 1 ? 's were' : ' was'} removed for not meeting our photo guidelines. Please add new photos to finish.`
                  : 'Please add at least 2 photos before finishing.',
            });
            setSubStep(27);
            return;
          }
        }
      }

      // Final step — location preflight. The profile_complete=true upsert trips
      // the location_required_when_complete CHECK constraint when lat/lng are
      // null. Step 3's UI gate normally prevents this, but resumed/backfilled
      // rows (and older clients) can reach the final step with a city but no
      // coords. Recover coords from the saved city; if that fails too, bounce
      // back to the location step with a clear message instead of firing a
      // doomed save that dead-ends on a constraint error toast with no way
      // forward. This is JAVASCRIPT-REACT-8R (49 users stuck at completion).
      if (state.latitude == null || state.longitude == null) {
        let recoveredCoords = false;
        if (state.locationCity || state.locationState) {
          try {
            const { data: geo } = await supabase.functions.invoke('geocode-city', {
              body: {
                city: state.locationCity,
                state: state.locationState,
                country: state.locationCountry,
              },
            });
            if (geo && typeof geo.latitude === 'number' && typeof geo.longitude === 'number') {
              // Fresh coords land in the store, so saveCheckpoint's getState()
              // read below picks them up before the profile_complete upsert.
              state.setFields({ latitude: geo.latitude, longitude: geo.longitude });
              recoveredCoords = true;
            }
          } catch {
            // fall through to the bounce below
          }
        }
        if (!recoveredCoords) {
          addBreadcrumb('onboarding', 'Final save blocked: missing location coords', {
            profileId: profileId ?? undefined,
            hasCity: !!state.locationCity,
            hasState: !!state.locationState,
          });
          showToast({
            type: 'error',
            title: 'Add your location',
            message: 'We need your location to finish setting up your profile. Please set it and try again.',
          });
          setSubStep(3);
          return;
        }
      }

      // Final step — save and exit
      try {
        await saveCheckpoint(TOTAL_ONBOARDING_STEPS);
      } catch {
        // Save failed — stay on current step so user can retry
        return;
      }

      // Post-save validation: verify critical preferences made it to DB
      if (profileId) {
        // Verify the profile_complete flag actually landed. saveCheckpoint
        // wraps the profile upsert in raceWithTimeout and treats a 6s
        // response timeout as "write likely succeeded" — but production
        // audit (2026-05-05) found 135 users where the timeout fired,
        // the sequential preferences upsert succeeded, but the profile
        // row never got profile_complete=true. Those users sat stuck in
        // preview mode with a fully-filled onboarding flow. Re-read the
        // flag here and do a focused UPDATE if it didn't persist.
        const { data: savedProfile } = await supabase
          .from('profiles')
          .select('profile_complete')
          .eq('id', profileId)
          .maybeSingle();

        if (!savedProfile?.profile_complete) {
          captureException(
            new Error('Final onboarding save: profile_complete did not persist; retrying'),
            { profileId },
            ['onboarding-profile-complete-did-not-persist'],
          );
          const { error: retryErr } = await supabase
            .from('profiles')
            .update({ profile_complete: true, onboarding_step: TOTAL_ONBOARDING_STEPS, updated_at: new Date().toISOString() })
            .eq('id', profileId);
          if (retryErr) {
            // Don't advance to discover — that would land them in
            // preview-mode purgatory. Stay on step 30 so they can hit
            // Continue again once the network recovers.
            showToast({ type: 'error', title: "Couldn't finalize profile", message: 'Network issue — please tap Continue once more.' });
            captureException(
              new Error((retryErr as any)?.message || 'profile_complete retry failed'),
              { profileId, context: 'profile_complete_retry', error_code: (retryErr as any)?.code },
              ['onboarding-profile-complete-retry-failed'],
            );
            return;
          }
        }

        const { data: savedPrefs } = await supabase
          .from('preferences')
          .select('gender_preference, relationship_type, age_min, age_max')
          .eq('profile_id', profileId)
          .maybeSingle();

        const missing: string[] = [];
        // gender_preference === [] is valid — it means "Everyone". Only null/undefined = actually missing.
        if (savedPrefs?.gender_preference == null) missing.push('gender preference');
        if (!savedPrefs?.relationship_type) missing.push('relationship type');
        if (missing.length > 0) {
          showToast({ type: 'error', title: 'Preferences may not have saved', message: `Please check your ${missing.join(' and ')} in settings.` });
          captureException(
            new Error('Post-onboarding validation failed'),
            { missing, profileId },
            ['onboarding-post-validation-missing-prefs'],
          );
        }
      }

      trackUserAction.onboardingCompleted?.();
      // Clear the persisted onboarding draft — prevents stale answers from
      // leaking into a new signup on the same device or a re-onboarding session.
      state.reset();
      router.replace('/(tabs)/discover');
    } else {
      // Skip step 13 (family_plans) when the user said "no" to wanting
      // children — the spec marks family_plans as "only shown if children
      // ≠ No", so asking them how they'd grow a family they've said they
      // don't want is noise.
      let nextStep = subStep + 1;
      if (subStep === 12 && state.wantsChildren === 'no' && nextStep === 13) {
        nextStep = 14;
      }
      setSubStep(nextStep);
    }
  }, [subStep, isCurrentStepValid, saveCheckpoint, profileId, showToast]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (subStep === 0) {
      router.back();
    } else {
      // Mirror the skip-family-plans logic on back-navigation so the user
      // doesn't land on step 13 when they got there by skipping from 12 → 14.
      let prevStep = subStep - 1;
      if (subStep === 14 && useOnboardingStore.getState().wantsChildren === 'no' && prevStep === 13) {
        prevStep = 12;
      }
      setSubStep(prevStep);
    }
  }, [subStep]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (subStep < TOTAL_ONBOARDING_STEPS - 1) {
      setSubStep(subStep + 1);
    } else {
      // Final step (dealbreakers) is skippable — skipping it means "finish
      // without answering". Route through the same completion path as Continue
      // (photo/location preflight + final saveCheckpoint) so the profile still
      // completes; otherwise the Skip button would be a dead no-op here.
      handleContinue();
    }
  }, [subStep, handleContinue]);

  // ── Preview mode (available after location, step 3) ──
  const currentRoute = stepConfig?.previewAvailable
    ? `/(onboarding)/onboarding?resumeStep=${subStep}`
    : undefined;

  // ── Render step content ──
  // Each step is a field-bound wrapper component that subscribes only to
  // its own store slice. The parent doesn't read form fields here so a
  // chip tap on step 12 never re-renders steps 0..11 or the OnboardingLayout.
  const renderStepContent = () => {
    switch (subStep) {
      case 0: return <NameStep />;
      case 1: return <DOBStep />;
      case 2: return <NotificationsStep onGranted={() => setNotificationsGranted(true)} onContinue={handleContinue} granted={notificationsGranted} />;
      case 3: return <LocationStep />;
      case 4: return <FieldChipStep fieldKey="pronouns" optionsKey="pronouns" optionsList={PRONOUNS} />;
      case 5: return <FieldChipStep fieldKey="gender" optionsKey="genders" optionsList={GENDERS} isArrayField />;
      case 6: return <OrientationFieldStep />;
      case 7: return <GenderPrefFieldStep />;
      case 8: return <FieldChipStep fieldKey="relationshipType" optionsKey="relationshipTypes" optionsList={RELATIONSHIP_TYPES} />;
      case 9: return <FieldChipStep fieldKey="primaryReasons" optionsKey="primaryReasons" optionsList={PRIMARY_REASONS} isArrayField multi />;
      case 10: return <HeightStep />;
      case 11: return <FieldChipStep fieldKey="ethnicity" optionsKey="ethnicities" optionsList={ETHNICITIES} isArrayField multi />;
      case 12: return <FieldChipStep fieldKey="wantsChildren" optionsKey="childrenOptions" optionsList={CHILDREN_OPTIONS} />;
      case 13: return <FieldChipStep fieldKey="childrenArrangement" optionsKey="familyPlans" optionsList={FAMILY_PLANS} isArrayField multi />;
      case 14: return <FieldChipStep fieldKey="pets" optionsKey="petsOptions" optionsList={PETS_OPTIONS} visibilityKey="pets" />;
      case 15: return <HometownFieldStep onSkip={handleSkip} />;
      case 16: return <FieldTextStep fieldKey="jobTitle" placeholder="e.g. Software Engineer" visibilityKey="job_title" />;
      case 17: return <FieldTextStep fieldKey="education" placeholder="e.g. UCLA, Harvard" visibilityKey="education" />;
      case 18: return <FieldChipStep fieldKey="educationLevel" optionsKey="educationLevels" optionsList={EDUCATION_LEVELS} visibilityKey="education_level" />;
      case 19: return <FieldChipStep fieldKey="religion" optionsKey="religions" optionsList={RELIGIONS} visibilityKey="religion" />;
      case 20: return <FieldChipStep fieldKey="politicalViews" optionsKey="politicalViews" optionsList={POLITICAL_VIEWS} visibilityKey="political_views" />;
      case 21: return <FieldChipStep fieldKey="financialArrangement" optionsKey="financialArr" optionsList={FINANCIAL_ARRANGEMENTS} isArrayField />;
      case 22: return <FieldChipStep fieldKey="housingPreference" optionsKey="housingPrefs" optionsList={HOUSING_PREFERENCES} isArrayField />;
      case 23: return <FieldChipStep fieldKey="drinking" optionsKey="drinkingOptions" optionsList={DRINKING_OPTIONS} visibilityKey="drinking" />;
      case 24: return <FieldChipStep fieldKey="smoking" optionsKey="smokingOptions" optionsList={SMOKING_OPTIONS} visibilityKey="smoking" />;
      case 25: return <FieldChipStep fieldKey="smokesWeed" optionsKey="weedOptions" optionsList={WEED_OPTIONS} visibilityKey="smokes_weed" />;
      case 26: return <FieldChipStep fieldKey="doesDrugs" optionsKey="drugOptions" optionsList={DRUG_OPTIONS} visibilityKey="does_drugs" />;
      case 27: return <Suspense fallback={<StepFallback />}><PhotosStep embedded onContinue={handleContinue} onBack={handleBack} initialProfileId={profileId} /></Suspense>;
      case 28: return <Suspense fallback={<StepFallback />}><PromptsStep embedded onContinue={handleContinue} onBack={handleBack} /></Suspense>;
      case 29: return <Suspense fallback={<StepFallback />}><VoiceStep embedded onContinue={handleContinue} onBack={handleBack} /></Suspense>;
      case 30: return <MatchingPrefsStep />;
      case 31: return <LanguagesFieldStep />;
      case 32: return <MustHavesFieldStep />;
      case 33: return <DealbreakersFieldStep />;
      default: return null;
    }
  };

  const isEmbeddedStep = subStep >= 27 && subStep <= 29;

  return (
    <OnboardingLayout
      currentStep={subStep}
      title={stepConfig ? t(`onboarding.stepLabels.${stepConfig.key}.title`, stepConfig.title) : ''}
      subtitle={stepConfig?.subtitle ? t(`onboarding.stepLabels.${stepConfig.key}.subtitle`, stepConfig.subtitle) : undefined}
      onBack={handleBack}
      onContinue={handleContinue}
      onSkip={stepConfig?.skippable ? handleSkip : undefined}
      continueDisabled={saving || !isCurrentStepValid}
      continueLabel={saving ? 'Saving...' : undefined}
      hideContinue={isEmbeddedStep}
      hideBack={subStep === 0}
      hideTitle={isEmbeddedStep}
      noScroll={subStep === 27 || subStep === 28 || subStep === 29 || [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].includes(subStep)}
      currentRoute={currentRoute}
    >
      {renderStepContent()}
    </OnboardingLayout>
  );
}
