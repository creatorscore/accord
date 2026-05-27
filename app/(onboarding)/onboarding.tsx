import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Keyboard } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { captureException } from '@/lib/sentry';
import { useOnboardingStore } from '@/stores/onboardingStore';
import {
  ONBOARDING_STEPS,
  TOTAL_ONBOARDING_STEPS,
  GENDERS,
  PRONOUNS,
  ORIENTATIONS,
  GENDER_PREF_OPTIONS,
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
  getAvailableOrientations,
  mapOldStepToNew,
  resolveResumeStep,
  earliestMissingRequiredStep,
} from '@/lib/onboarding-config';
import { expandGenderPreference, collapseGenderPreference } from '@/lib/gender-preferences';
import { tOptions } from '@/lib/onboarding-labels';
import { ensurePushTokenSaved, registerForPushNotifications } from '@/lib/notifications';
import { getDeviceFingerprint } from '@/lib/device-fingerprint';
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
  ChipSelect,
  TextInputStep,
  CityAutocompleteStep,
} from '@/components/onboarding/steps';

// Lazy imports for heavy steps
import { lazy, Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';
const PhotosStep = lazy(() => import('@/app/(onboarding)/photos'));
const PromptsStep = lazy(() => import('@/app/(onboarding)/prompts'));
const VoiceStep = lazy(() => import('@/app/(onboarding)/voice-intro'));

const StepFallback = () => <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color="#A08AB7" /></View>;

export default function Onboarding() {
  const { resumeStep } = useLocalSearchParams<{ resumeStep?: string }>();
  const { t } = useTranslation();
  const { user } = useAuth();
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

  // Store accessors
  const store = useOnboardingStore();
  const setField = useOnboardingStore((s) => s.setField);
  const setFields = useOnboardingStore((s) => s.setFields);
  const setVisibility = useOnboardingStore((s) => s.setVisibility);

  const stepConfig = ONBOARDING_STEPS[subStep];

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
          store.hydrateIfEmpty({
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
            genderPreference: collapseGenderPreference(prefs?.gender_preference || []),
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

  // ── Validation ──
  const isStepValid = useCallback((): boolean => {
    switch (subStep) {
      case 0: return store.displayName.trim().length >= 1;
      case 1: return store.birthDate !== null && store.age !== null && store.age >= 18;
      case 2: return true; // notifications now skippable
      case 3:
        // Require BOTH a selected city AND resolved lat/lng. Lat/lng is what
        // the location_required_when_complete CHECK constraint enforces at
        // final save; gating Continue here prevents users from advancing
        // into purgatory when geocoding hasn't landed yet (or failed).
        return !!(store.locationCity || store.locationState)
          && store.latitude != null
          && store.longitude != null;
      case 4: return !!store.pronouns; // Pronouns required per ONBOARDING_SPEC (incl. "prefer not to say")
      case 5: return store.gender.length > 0;
      case 6: return store.sexualOrientation.length > 0;
      case 7: return store.genderPreference.length > 0;
      case 8: return store.relationshipType !== '';
      case 9: return store.primaryReasons.length > 0;
      case 10: return true; // height skippable
      case 11: return true; // ethnicity skippable
      case 12: return store.wantsChildren !== '';
      case 13: return true; // family plans skippable
      case 14: return true; // pets skippable
      case 15: return true; // hometown skippable
      case 16: return true; // job title skippable
      case 17: return true; // school skippable
      case 18: return true; // education level skippable
      case 19: return true; // religion skippable
      case 20: return true; // politics skippable
      case 21: return store.financialArrangement.length > 0;
      case 22: return store.housingPreference.length > 0;
      case 23: return true; // drinking skippable
      case 24: return true; // smoking skippable
      case 25: return true; // weed skippable
      case 26: return true; // drugs skippable
      case 27: return true; // photos handled by its own component
      case 28: return true; // prompts handled by its own component
      case 29: return true; // voice note skippable
      case 30: return true; // matching prefs always valid (has defaults)
      default: return true;
    }
  }, [subStep, store, notificationsGranted]);

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
    try {
      console.log('[saveCheckpoint] getDeviceFingerprint...');
      const deviceFingerprint = await getDeviceFingerprint();
      console.log('[saveCheckpoint] got fingerprint');

      // Profile data
      const profileData: Record<string, any> = {
        user_id: user.id,
        display_name: store.displayName,
        birth_date: store.birthDate?.toISOString().split('T')[0] || null,
        age: store.age,
        zodiac_sign: store.zodiacSign,
        location_city: store.locationCity,
        location_state: store.locationState,
        location_country: store.locationCountry,
        latitude: store.latitude,
        longitude: store.longitude,
        pronouns: store.pronouns || null,
        gender: store.gender,
        sexual_orientation: store.sexualOrientation,
        ethnicity: store.ethnicity.length > 0 ? store.ethnicity : null,
        height_inches: store.heightInches,
        height_unit: store.heightUnit,
        hometown: store.hometown || null,
        job_title: store.jobTitle || null,
        occupation: store.jobTitle || null, // keep occupation in sync
        education: store.education || null,
        education_level: store.educationLevel || null,
        religion: store.religion || null,
        political_views: store.politicalViews || null,
        smokes_weed: store.smokesWeed || null,
        does_drugs: store.doesDrugs || null,
        field_visibility: store.fieldVisibility,
        device_id: deviceFingerprint,
        preferred_language: 'en',
        onboarding_step: step,
        // Only set profile_complete on the final step
        ...(step >= TOTAL_ONBOARDING_STEPS - 1 ? { profile_complete: true } : {}),
      };

      // Build the preferences payload up-front so we can fire profile + prefs
      // upserts concurrently when we already know the profile id.
      const buildPrefsData = (pid: string): Record<string, any> => ({
        profile_id: pid,
        gender_preference: expandGenderPreference(store.genderPreference),
        // Mark gender preference as explicitly confirmed by the user. Any
        // checkpoint after step 7 (genderPreference picker) means they've
        // explicitly answered. The discover screen uses this flag to decide
        // whether to show the recovery prompt for pre-fix wiped users.
        gender_preference_confirmed_at: new Date().toISOString(),
        relationship_type: store.relationshipType || 'platonic',
        primary_reasons: store.primaryReasons.length > 0 ? store.primaryReasons : null,
        // Legacy column — keep in sync to avoid NOT NULL constraint on older schema
        primary_reason: store.primaryReasons.length > 0 ? store.primaryReasons[0] : 'other',
        wants_children: store.wantsChildren === 'yes' ? true : store.wantsChildren === 'no' ? false : null,
        children_arrangement: store.childrenArrangement.length > 0 ? store.childrenArrangement : null,
        financial_arrangement: store.financialArrangement.length > 0 ? store.financialArrangement : null,
        housing_preference: store.housingPreference.length > 0 ? store.housingPreference : null,
        lifestyle_preferences: {
          pets: store.pets || null,
          drinking: store.drinking || null,
          smoking: store.smoking || null,
          smokes_weed: store.smokesWeed || null,
          does_drugs: store.doesDrugs || null,
        },
        age_min: store.ageMin,
        age_max: store.ageMax,
        max_distance_miles: store.maxDistanceMiles,
        distance_unit: store.distanceUnit || 'miles',
        willing_to_relocate: store.willingToRelocate,
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
      // Defense in depth: on the final save, the location_required_when_complete
      // CHECK constraint trips if lat/lng are null. Step 3's UI gate normally
      // prevents this, but an older client/build could still surface it.
      // Try one geocode + retry before bubbling the error to the toast.
      const msg = error?.message || '';
      const isLocationConstraint =
        msg.includes('location_required_when_complete') ||
        (msg.includes('violates check constraint') && msg.includes('location'));
      const isFinalStep = step >= TOTAL_ONBOARDING_STEPS;
      if (isLocationConstraint && isFinalStep && store.locationCity) {
        try {
          const { data: geo, error: geoErr } = await supabase.functions.invoke('geocode-city', {
            body: {
              city: store.locationCity,
              state: store.locationState,
              country: store.locationCountry,
            },
          });
          if (!geoErr && geo && typeof geo.latitude === 'number' && typeof geo.longitude === 'number') {
            store.setFields({ latitude: geo.latitude, longitude: geo.longitude });
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
      let ckptFingerprint = 'onboarding-checkpoint-other';
      if (ckptMsg.includes('location_required_when_complete')) {
        ckptFingerprint = 'onboarding-checkpoint-location-required';
      } else if (ckptCode === '23505') {
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
      showToast({ type: 'error', title: 'Error', message: error.message || 'Failed to save progress. Please try again.' });
      throw error; // Re-throw so callers know the save failed
    } finally {
      setSaving(false);
    }
  }, [user?.id, store, profileId, notificationsGranted]);

  // ── Navigation ──
  const handleContinue = useCallback(async () => {
    console.log('[Onboarding] handleContinue pressed at step', subStep);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();

    const valid = isStepValid();
    console.log('[Onboarding] handleContinue isStepValid =', valid);
    if (!valid) {
      showToast({ type: 'info', title: 'Required', message: 'Please complete this step to continue.' });
      return;
    }

    // Save at checkpoints: after location (3), after pets (14), after drugs (26), final (30).
    // Show a "Saving your progress..." toast only if the save actually takes
    // more than ~600ms — avoids a toast-flash on the common fast path but
    // reassures users that the app isn't frozen when the queue is stalled.
    let savingToastShown = false;
    let savingToastTimer: ReturnType<typeof setTimeout> | null = null;
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

    // After the last hard checkpoint (step 26 → 27), we still need to track
    // where the user actually is so a closed/reopened app doesn't bounce
    // them back to photos. Fire a lightweight onboarding_step-only update
    // for transitions between steps 27, 28, 29 — non-blocking because the
    // resume logic tolerates a slightly stale value, and we don't want to
    // gate Continue on this network call. The full saveCheckpoint runs on
    // step 30 (final) as before.
    if (profileId && subStep >= 27 && subStep < TOTAL_ONBOARDING_STEPS - 1) {
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
        const { count: photoCount, error: countErr } = await supabase
          .from('photos')
          .select('id', { count: 'exact', head: true })
          .eq('profile_id', profileId)
          .neq('moderation_status', 'rejected');
        if (countErr) {
          console.warn('[Onboarding] photo count preflight failed', countErr.message);
        } else if ((photoCount ?? 0) < 2) {
          showToast({
            type: 'error',
            title: 'Add more photos',
            message: 'Please add at least 2 photos before finishing.',
          });
          captureException(
            new Error('Final save blocked: insufficient photos in DB'),
            { profileId, photoCount: photoCount ?? 0 },
            ['onboarding-final-insufficient-photos'],
          );
          setSubStep(27);
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
      store.reset();
      router.replace('/(tabs)/discover');
    } else {
      // Skip step 13 (family_plans) when the user said "no" to wanting
      // children — the spec marks family_plans as "only shown if children
      // ≠ No", so asking them how they'd grow a family they've said they
      // don't want is noise.
      let nextStep = subStep + 1;
      if (subStep === 12 && store.wantsChildren === 'no' && nextStep === 13) {
        nextStep = 14;
      }
      setSubStep(nextStep);
    }
  }, [subStep, isStepValid, saveCheckpoint, store.wantsChildren]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (subStep === 0) {
      router.back();
    } else {
      // Mirror the skip-family-plans logic on back-navigation so the user
      // doesn't land on step 13 when they got there by skipping from 12 → 14.
      let prevStep = subStep - 1;
      if (subStep === 14 && store.wantsChildren === 'no' && prevStep === 13) {
        prevStep = 12;
      }
      setSubStep(prevStep);
    }
  }, [subStep, store.wantsChildren]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (subStep < TOTAL_ONBOARDING_STEPS - 1) {
      setSubStep(subStep + 1);
    }
  }, [subStep]);

  // ── Preview mode (available after location, step 3) ──
  const currentRoute = stepConfig?.previewAvailable
    ? `/(onboarding)/onboarding?resumeStep=${subStep}`
    : undefined;

  // ── Render step content ──
  const renderStepContent = () => {
    const vis = (key: string) => store.fieldVisibility[key] !== false;
    const setVis = (key: string, v: boolean) => setVisibility(key, v);

    switch (subStep) {
      case 0: return <NameStep />;
      case 1: return <DOBStep />;
      case 2: return <NotificationsStep onGranted={() => setNotificationsGranted(true)} onContinue={handleContinue} granted={notificationsGranted} />;
      case 3: return <LocationStep />;
      case 4: // Pronouns
        return <ChipSelect options={tOptions(t, 'pronouns', PRONOUNS)} selected={store.pronouns ? [store.pronouns] : []} onSelect={(v) => setField('pronouns', v[0] || '')} multi={false} />;
      case 5: // Gender
        return <ChipSelect options={tOptions(t, 'genders', GENDERS)} selected={store.gender} onSelect={(v) => setField('gender', v)} multi={false} />;
      case 6: // Sexuality
        return <ChipSelect options={tOptions(t, 'orientations', Array.isArray(store.gender) && store.gender.includes('Man') ? getAvailableOrientations('Man') : ORIENTATIONS)} selected={store.sexualOrientation} onSelect={(v) => setField('sexualOrientation', v)} multi={false} />;
      case 7: // Gender Preference
        return <ChipSelect options={tOptions(t, 'genderPrefs', GENDER_PREF_OPTIONS)} selected={store.genderPreference} onSelect={(newSelection) => {
          const prev = store.genderPreference;
          const added = newSelection.filter((v) => !prev.includes(v));
          if (added.includes('Everyone')) {
            // Everyone was just tapped on → make it exclusive
            setField('genderPreference', ['Everyone']);
          } else if (added.length > 0 && prev.includes('Everyone')) {
            // A specific option was tapped while Everyone was selected → drop Everyone
            setField('genderPreference', added);
          } else {
            setField('genderPreference', newSelection);
          }
        }} />;
      case 8: // Relationship Type
        return <ChipSelect options={tOptions(t, 'relationshipTypes', RELATIONSHIP_TYPES)} selected={store.relationshipType ? [store.relationshipType] : []} onSelect={(v) => setField('relationshipType', v[0] || '')} multi={false} />;
      case 9: // Intention / Primary Reasons — multi-select per spec; users often have several reasons
        return <ChipSelect options={tOptions(t, 'primaryReasons', PRIMARY_REASONS)} selected={store.primaryReasons} onSelect={(v) => setField('primaryReasons', v)} multi={true} />;
      case 10: return <HeightStep />;
      case 11: // Ethnicity
        return <ChipSelect options={tOptions(t, 'ethnicities', ETHNICITIES)} selected={store.ethnicity} onSelect={(v) => setField('ethnicity', v)} />;
      case 12: // Children
        return <ChipSelect options={tOptions(t, 'childrenOptions', CHILDREN_OPTIONS)} selected={store.wantsChildren ? [store.wantsChildren] : []} onSelect={(v) => setField('wantsChildren', v[0] || '')} multi={false} />;
      case 13: // Family Plans
        return <ChipSelect options={tOptions(t, 'familyPlans', FAMILY_PLANS)} selected={store.childrenArrangement} onSelect={(v) => setField('childrenArrangement', v)} />;
      case 14: // Pets
        return <ChipSelect options={tOptions(t, 'petsOptions', PETS_OPTIONS)} selected={store.pets ? [store.pets] : []} onSelect={(v) => setField('pets', v[0] || '')} multi={false} showVisibility visible={vis('pets')} onVisibilityChange={(v) => setVis('pets', v)} />;
      case 15: // Hometown
        return <CityAutocompleteStep value={store.hometown} onSelect={(v) => setField('hometown', v)} placeholder="e.g. Los Angeles, CA" showVisibility visible={vis('hometown')} onVisibilityChange={(v) => setVis('hometown', v)} onSkip={handleSkip} />;
      case 16: // Job Title
        return <TextInputStep value={store.jobTitle} onChangeText={(v) => setField('jobTitle', v)} placeholder="e.g. Software Engineer" showVisibility visible={vis('job_title')} onVisibilityChange={(v) => setVis('job_title', v)} />;
      case 17: // School
        return <TextInputStep value={store.education} onChangeText={(v) => setField('education', v)} placeholder="e.g. UCLA, Harvard" showVisibility visible={vis('education')} onVisibilityChange={(v) => setVis('education', v)} />;
      case 18: // Education Level
        return <ChipSelect options={tOptions(t, 'educationLevels', EDUCATION_LEVELS)} selected={store.educationLevel ? [store.educationLevel] : []} onSelect={(v) => setField('educationLevel', v[0] || '')} multi={false} showVisibility visible={vis('education_level')} onVisibilityChange={(v) => setVis('education_level', v)} />;
      case 19: // Religion
        return <ChipSelect options={tOptions(t, 'religions', RELIGIONS)} selected={store.religion ? [store.religion] : []} onSelect={(v) => setField('religion', v[0] || '')} multi={false} showVisibility visible={vis('religion')} onVisibilityChange={(v) => setVis('religion', v)} />;
      case 20: // Politics
        return <ChipSelect options={tOptions(t, 'politicalViews', POLITICAL_VIEWS)} selected={store.politicalViews ? [store.politicalViews] : []} onSelect={(v) => setField('politicalViews', v[0] || '')} multi={false} showVisibility visible={vis('political_views')} onVisibilityChange={(v) => setVis('political_views', v)} />;
      case 21: // Financial Arrangement
        return <ChipSelect options={tOptions(t, 'financialArr', FINANCIAL_ARRANGEMENTS)} selected={store.financialArrangement} onSelect={(v) => setField('financialArrangement', v)} multi={false} />;
      case 22: // Housing
        return <ChipSelect options={tOptions(t, 'housingPrefs', HOUSING_PREFERENCES)} selected={store.housingPreference} onSelect={(v) => setField('housingPreference', v)} multi={false} />;
      case 23: // Drinking
        return <ChipSelect options={tOptions(t, 'drinkingOptions', DRINKING_OPTIONS)} selected={store.drinking ? [store.drinking] : []} onSelect={(v) => setField('drinking', v[0] || '')} multi={false} showVisibility visible={vis('drinking')} onVisibilityChange={(v) => setVis('drinking', v)} />;
      case 24: // Smoking
        return <ChipSelect options={tOptions(t, 'smokingOptions', SMOKING_OPTIONS)} selected={store.smoking ? [store.smoking] : []} onSelect={(v) => setField('smoking', v[0] || '')} multi={false} showVisibility visible={vis('smoking')} onVisibilityChange={(v) => setVis('smoking', v)} />;
      case 25: // Weed
        return <ChipSelect options={tOptions(t, 'weedOptions', WEED_OPTIONS)} selected={store.smokesWeed ? [store.smokesWeed] : []} onSelect={(v) => setField('smokesWeed', v[0] || '')} multi={false} showVisibility visible={vis('smokes_weed')} onVisibilityChange={(v) => setVis('smokes_weed', v)} />;
      case 26: // Drugs
        return <ChipSelect options={tOptions(t, 'drugOptions', DRUG_OPTIONS)} selected={store.doesDrugs ? [store.doesDrugs] : []} onSelect={(v) => setField('doesDrugs', v[0] || '')} multi={false} showVisibility visible={vis('does_drugs')} onVisibilityChange={(v) => setVis('does_drugs', v)} />;
      case 27: // Photos (embedded — manages its own continue)
        return <Suspense fallback={<StepFallback />}><PhotosStep embedded onContinue={handleContinue} onBack={handleBack} initialProfileId={profileId} /></Suspense>;
      case 28: // Prompts (embedded — has internal sub-steps)
        return <Suspense fallback={<StepFallback />}><PromptsStep embedded onContinue={handleContinue} onBack={handleBack} /></Suspense>;
      case 29: // Voice Note (embedded — manages its own continue)
        return <Suspense fallback={<StepFallback />}><VoiceStep embedded onContinue={handleContinue} onBack={handleBack} /></Suspense>;
      case 30: return <MatchingPrefsStep />;
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
      continueDisabled={saving || !isStepValid()}
      continueLabel={saving ? 'Saving...' : undefined}
      hideContinue={isEmbeddedStep}
      hideBack={subStep === 0}
      hideTitle={isEmbeddedStep}
      noScroll={subStep === 27 || subStep === 28 || subStep === 29 || [4, 5, 6, 7, 8, 9, 11, 12, 13, 14].includes(subStep)}
      currentRoute={currentRoute}
    >
      {renderStepContent()}
    </OnboardingLayout>
  );
}
