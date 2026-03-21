import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Keyboard } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
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
  HOUSING_PREFERENCES,
  FINANCIAL_ARRANGEMENTS,
  EDUCATION_LEVELS,
  DRINKING_OPTIONS,
  SMOKING_OPTIONS,
  WEED_OPTIONS,
  DRUG_OPTIONS,
  getAvailableOrientations,
  mapOldStepToNew,
} from '@/lib/onboarding-config';
import { ensurePushTokenSaved } from '@/lib/notifications';
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
  const { user } = useAuth();
  const { showToast } = useToast();
  const enterPreviewMode = usePreviewModeStore((s) => s.enterPreviewMode);

  const [subStep, setSubStep] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notificationsGranted, setNotificationsGranted] = useState(false);
  const initialLoadDone = useRef(false);

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

          // Hydrate store from existing data
          store.hydrate({
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
            genderPreference: prefs?.gender_preference || [],
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
            drinking: prefs?.lifestyle_preferences?.drinking || '',
            smoking: prefs?.lifestyle_preferences?.smoking || '',
            smokesWeed: profile.smokes_weed || '',
            doesDrugs: profile.does_drugs || '',
            ageMin: prefs?.age_min || 22,
            ageMax: prefs?.age_max || 45,
            maxDistanceMiles: prefs?.max_distance_miles || 50,
            fieldVisibility: profile.field_visibility || {},
          });

          // Determine resume step
          const rawStep = parseInt(resumeStep || '0', 10);
          // If onboarding_step is from the old flow (0-9), map it
          const mappedStep = profile.onboarding_step <= 9
            ? mapOldStepToNew(profile.onboarding_step || 0)
            : Math.min(rawStep, TOTAL_ONBOARDING_STEPS - 1);
          setSubStep(mappedStep);
        } else {
          // No profile yet — start from step 0
          setSubStep(parseInt(resumeStep || '0', 10) || 0);
        }
      } catch (error) {
        console.error('Error loading profile for onboarding:', error);
      }
    })();
  }, [user?.id]);

  // ── Validation ──
  const isStepValid = useCallback((): boolean => {
    switch (subStep) {
      case 0: return store.displayName.trim().length >= 1;
      case 1: return store.birthDate !== null && store.age !== null && store.age >= 18;
      case 2: return notificationsGranted;
      case 3: return !!(store.locationCity || store.locationState);
      case 4: return true; // pronouns skippable
      case 5: return store.gender.length > 0;
      case 6: return store.sexualOrientation.length > 0;
      case 7: return store.genderPreference.length > 0;
      case 8: return store.relationshipType !== '';
      case 9: return store.primaryReasons.length > 0;
      case 10: return true; // height skippable
      case 11: return true; // ethnicity skippable
      case 12: return store.wantsChildren !== '';
      case 13: return true; // family plans skippable
      case 14: return true; // hometown skippable
      case 15: return true; // job title skippable
      case 16: return true; // school skippable
      case 17: return true; // education level skippable
      case 18: return true; // religion skippable
      case 19: return true; // politics skippable
      case 20: return store.financialArrangement.length > 0;
      case 21: return store.housingPreference.length > 0;
      case 22: return true; // drinking skippable
      case 23: return true; // smoking skippable
      case 24: return true; // weed skippable
      case 25: return true; // drugs skippable
      case 26: return true; // photos handled by its own component
      case 27: return true; // prompts handled by its own component
      case 28: return true; // voice note skippable
      case 29: return true; // matching prefs always valid (has defaults)
      default: return true;
    }
  }, [subStep, store, notificationsGranted]);

  // ── Save checkpoint to DB ──
  const saveCheckpoint = useCallback(async (step: number) => {
    if (!user?.id) return;
    setSaving(true);
    try {
      const deviceFingerprint = await getDeviceFingerprint();

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

      // Upsert profile
      const { data: upserted, error: profileError } = await supabase
        .from('profiles')
        .upsert(profileData, { onConflict: 'user_id' })
        .select('id')
        .single();

      if (profileError) throw profileError;

      const pid = upserted?.id || profileId;
      if (pid && !profileId) setProfileId(pid);

      // Save preferences
      if (pid) {
        const prefsData: Record<string, any> = {
          profile_id: pid,
          gender_preference: store.genderPreference,
          relationship_type: store.relationshipType || null,
          primary_reasons: store.primaryReasons.length > 0 ? store.primaryReasons : null,
          wants_children: store.wantsChildren === 'yes' ? true : store.wantsChildren === 'no' ? false : null,
          children_arrangement: store.childrenArrangement.length > 0 ? store.childrenArrangement : null,
          financial_arrangement: store.financialArrangement.length > 0 ? store.financialArrangement : null,
          housing_preference: store.housingPreference.length > 0 ? store.housingPreference : null,
          lifestyle_preferences: {
            drinking: store.drinking || null,
            smoking: store.smoking || null,
          },
          age_min: store.ageMin,
          age_max: store.ageMax,
          max_distance_miles: store.maxDistanceMiles,
        };

        await supabase
          .from('preferences')
          .upsert(prefsData, { onConflict: 'profile_id' });
      }

      // Save push token if granted
      if (notificationsGranted && pid) {
        await ensurePushTokenSaved(pid).catch(() => {});
      }
    } catch (error: any) {
      console.error('Checkpoint save error:', error);
      showToast({ type: 'error', title: 'Error', message: error.message || 'Failed to save progress' });
    } finally {
      setSaving(false);
    }
  }, [user?.id, store, profileId, notificationsGranted]);

  // ── Navigation ──
  const handleContinue = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Keyboard.dismiss();

    if (!isStepValid()) {
      showToast({ type: 'info', title: 'Required', message: 'Please complete this step to continue.' });
      return;
    }

    // Save at checkpoints: after location (3), after family plans (13), after drugs (25), final (29)
    const checkpoints = [3, 13, 25, 29];
    if (checkpoints.includes(subStep)) {
      await saveCheckpoint(subStep + 1);
    }

    if (subStep >= TOTAL_ONBOARDING_STEPS - 1) {
      // Final step — save and exit
      await saveCheckpoint(TOTAL_ONBOARDING_STEPS);
      trackUserAction.onboardingCompleted?.();
      router.replace('/(tabs)/discover');
    } else {
      setSubStep(subStep + 1);
    }
  }, [subStep, isStepValid, saveCheckpoint]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (subStep === 0) {
      router.back();
    } else {
      setSubStep(subStep - 1);
    }
  }, [subStep]);

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
      case 2: return <NotificationsStep onGranted={() => setNotificationsGranted(true)} />;
      case 3: return <LocationStep />;
      case 4: // Pronouns
        return <ChipSelect options={PRONOUNS} selected={store.pronouns ? [store.pronouns] : []} onSelect={(v) => setField('pronouns', v[0] || '')} multi={false} />;
      case 5: // Gender
        return <ChipSelect options={GENDERS} selected={store.gender} onSelect={(v) => setField('gender', v)} />;
      case 6: // Sexuality
        return <ChipSelect options={store.gender.includes('Man') ? getAvailableOrientations('Man') : ORIENTATIONS} selected={store.sexualOrientation} onSelect={(v) => setField('sexualOrientation', v)} />;
      case 7: // Gender Preference
        return <ChipSelect options={GENDER_PREF_OPTIONS} selected={store.genderPreference} onSelect={(v) => setField('genderPreference', v)} />;
      case 8: // Relationship Type
        return <ChipSelect options={RELATIONSHIP_TYPES} selected={store.relationshipType ? [store.relationshipType] : []} onSelect={(v) => setField('relationshipType', v[0] || '')} multi={false} />;
      case 9: // Intention / Primary Reasons
        return <ChipSelect options={PRIMARY_REASONS} selected={store.primaryReasons} onSelect={(v) => setField('primaryReasons', v)} />;
      case 10: return <HeightStep />;
      case 11: // Ethnicity
        return <ChipSelect options={ETHNICITIES} selected={store.ethnicity} onSelect={(v) => setField('ethnicity', v)} />;
      case 12: // Children
        return <ChipSelect options={CHILDREN_OPTIONS} selected={store.wantsChildren ? [store.wantsChildren] : []} onSelect={(v) => setField('wantsChildren', v[0] || '')} multi={false} />;
      case 13: // Family Plans
        return <ChipSelect options={FAMILY_PLANS} selected={store.childrenArrangement} onSelect={(v) => setField('childrenArrangement', v)} />;
      case 14: // Hometown
        return <TextInputStep value={store.hometown} onChangeText={(v) => setField('hometown', v)} placeholder="e.g. Los Angeles, CA" showVisibility visible={vis('hometown')} onVisibilityChange={(v) => setVis('hometown', v)} />;
      case 15: // Job Title
        return <TextInputStep value={store.jobTitle} onChangeText={(v) => setField('jobTitle', v)} placeholder="e.g. Software Engineer" showVisibility visible={vis('job_title')} onVisibilityChange={(v) => setVis('job_title', v)} />;
      case 16: // School
        return <TextInputStep value={store.education} onChangeText={(v) => setField('education', v)} placeholder="e.g. UCLA, Harvard" showVisibility visible={vis('education')} onVisibilityChange={(v) => setVis('education', v)} />;
      case 17: // Education Level
        return <ChipSelect options={EDUCATION_LEVELS} selected={store.educationLevel ? [store.educationLevel] : []} onSelect={(v) => setField('educationLevel', v[0] || '')} multi={false} showVisibility visible={vis('education_level')} onVisibilityChange={(v) => setVis('education_level', v)} />;
      case 18: // Religion
        return <ChipSelect options={RELIGIONS} selected={store.religion ? [store.religion] : []} onSelect={(v) => setField('religion', v[0] || '')} multi={false} showVisibility visible={vis('religion')} onVisibilityChange={(v) => setVis('religion', v)} />;
      case 19: // Politics
        return <ChipSelect options={POLITICAL_VIEWS} selected={store.politicalViews ? [store.politicalViews] : []} onSelect={(v) => setField('politicalViews', v[0] || '')} multi={false} showVisibility visible={vis('political_views')} onVisibilityChange={(v) => setVis('political_views', v)} />;
      case 20: // Financial Arrangement
        return <ChipSelect options={FINANCIAL_ARRANGEMENTS} selected={store.financialArrangement} onSelect={(v) => setField('financialArrangement', v)} />;
      case 21: // Housing
        return <ChipSelect options={HOUSING_PREFERENCES} selected={store.housingPreference} onSelect={(v) => setField('housingPreference', v)} />;
      case 22: // Drinking
        return <ChipSelect options={DRINKING_OPTIONS} selected={store.drinking ? [store.drinking] : []} onSelect={(v) => setField('drinking', v[0] || '')} multi={false} showVisibility visible={vis('drinking')} onVisibilityChange={(v) => setVis('drinking', v)} />;
      case 23: // Smoking
        return <ChipSelect options={SMOKING_OPTIONS} selected={store.smoking ? [store.smoking] : []} onSelect={(v) => setField('smoking', v[0] || '')} multi={false} showVisibility visible={vis('smoking')} onVisibilityChange={(v) => setVis('smoking', v)} />;
      case 24: // Weed
        return <ChipSelect options={WEED_OPTIONS} selected={store.smokesWeed ? [store.smokesWeed] : []} onSelect={(v) => setField('smokesWeed', v[0] || '')} multi={false} showVisibility visible={vis('smokes_weed')} onVisibilityChange={(v) => setVis('smokes_weed', v)} />;
      case 25: // Drugs
        return <ChipSelect options={DRUG_OPTIONS} selected={store.doesDrugs ? [store.doesDrugs] : []} onSelect={(v) => setField('doesDrugs', v[0] || '')} multi={false} showVisibility visible={vis('does_drugs')} onVisibilityChange={(v) => setVis('does_drugs', v)} />;
      case 26: // Photos (uses existing component)
        return <Suspense fallback={<StepFallback />}><PhotosStep /></Suspense>;
      case 27: // Prompts (uses existing component)
        return <Suspense fallback={<StepFallback />}><PromptsStep /></Suspense>;
      case 28: // Voice Note (uses existing component)
        return <Suspense fallback={<StepFallback />}><VoiceStep /></Suspense>;
      case 29: return <MatchingPrefsStep />;
      default: return null;
    }
  };

  return (
    <OnboardingLayout
      currentStep={subStep}
      title={stepConfig?.title || ''}
      subtitle={stepConfig?.subtitle}
      onBack={handleBack}
      onContinue={handleContinue}
      onSkip={stepConfig?.skippable ? handleSkip : undefined}
      continueDisabled={saving || !isStepValid()}
      continueLabel={saving ? 'Saving...' : undefined}
      currentRoute={currentRoute}
    >
      {renderStepContent()}
    </OnboardingLayout>
  );
}
