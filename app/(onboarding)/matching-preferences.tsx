import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { goToPreviousOnboardingStep, goToNextOnboardingStep } from '@/lib/onboarding-navigation';
import { getGlobalStep } from '@/lib/onboarding-steps';
import { formatDistanceSlider, DistanceUnit } from '@/lib/distance-utils';
import Slider from '@react-native-community/slider';
import * as Haptics from 'expo-haptics';
import { GENDER_PREF_OPTIONS, expandGenderPreference, collapseGenderPreference } from '@/lib/gender-preferences';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import OnboardingChips from '@/components/onboarding/OnboardingChips';
import { useOnboardingDraft } from '@/hooks/useOnboardingDraft';

interface MatchingPrefsDraft {
  ageMin: number;
  ageMax: number;
  maxDistance: number;
  distanceUnit: string;
  willingToRelocate: boolean;
  genderPreference: string[];
}

export default function MatchingPreferences() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [subStep, setSubStep] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(65);
  const [maxDistance, setMaxDistance] = useState(100);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('miles');
  const [willingToRelocate, setWillingToRelocate] = useState(false);
  const [genderPreference, setGenderPreference] = useState<string[]>([]);

  const { loadDraft, saveDraft, clearDraft } = useOnboardingDraft<MatchingPrefsDraft>(user?.id, 'matching-preferences');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setProfileId(data.id);

        const { data: prefs, error: prefsError } = await supabase
          .from('preferences')
          .select('age_min, age_max, max_distance_miles, distance_unit, willing_to_relocate, gender_preference')
          .eq('profile_id', data.id)
          .single();

        if (prefsError && prefsError.code !== 'PGRST116') {
          console.error('Error loading preferences:', prefsError);
        }

        if (prefs) {
          if (prefs.age_min) setAgeMin(prefs.age_min);
          if (prefs.age_max) setAgeMax(prefs.age_max);
          if (prefs.max_distance_miles) setMaxDistance(prefs.max_distance_miles);
          if (prefs.distance_unit) setDistanceUnit(prefs.distance_unit);
          if (prefs.willing_to_relocate !== null && prefs.willing_to_relocate !== undefined) {
            setWillingToRelocate(prefs.willing_to_relocate);
          }
          if (prefs.gender_preference) {
            const raw = Array.isArray(prefs.gender_preference) ? prefs.gender_preference : [prefs.gender_preference];
            setGenderPreference(collapseGenderPreference(raw));
          }
        }
      }

      // Overlay draft on top of DB data
      const draft = await loadDraft();
      if (draft) {
        const d = draft.data;
        if (d.ageMin) setAgeMin(d.ageMin);
        if (d.ageMax) setAgeMax(d.ageMax);
        if (d.maxDistance) setMaxDistance(d.maxDistance);
        if (d.distanceUnit) setDistanceUnit(d.distanceUnit as DistanceUnit);
        if (d.willingToRelocate !== undefined) setWillingToRelocate(d.willingToRelocate);
        if (d.genderPreference?.length) setGenderPreference(d.genderPreference);
        setSubStep(draft.subStep);
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const handleSaveAndContinue = async () => {
    if (genderPreference.length === 0) {
      Alert.alert(t('common.required'), t('onboarding.matchingPreferences.selectGenderPreference'));
      return;
    }

    if (!profileId) {
      Alert.alert(t('common.error'), t('onboarding.common.profileNotFound'));
      return;
    }

    try {
      setLoading(true);

      const { error: prefsError } = await supabase
        .from('preferences')
        .upsert({
          profile_id: profileId,
          age_min: ageMin,
          age_max: ageMax,
          max_distance_miles: maxDistance,
          distance_unit: distanceUnit,
          willing_to_relocate: willingToRelocate,
          gender_preference: expandGenderPreference(genderPreference),
        }, { onConflict: 'profile_id' });

      if (prefsError) throw prefsError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          onboarding_step: 9,
        })
        .eq('id', profileId);

      if (profileError) throw profileError;

      await clearDraft();
      router.push('/(onboarding)/notifications');
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('onboarding.matchingPreferences.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const buildDraftSnapshot = (): MatchingPrefsDraft => ({
    ageMin, ageMax, maxDistance, distanceUnit, willingToRelocate, genderPreference,
  });

  const handleBack = () => {
    if (subStep === 0) {
      goToPreviousOnboardingStep('/(onboarding)/matching-preferences');
    } else {
      const prevStep = subStep - 1;
      saveDraft(prevStep, buildDraftSnapshot());
      setSubStep(prevStep);
    }
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (subStep < 2) {
      const nextStep = subStep + 1;
      saveDraft(nextStep, buildDraftSnapshot());
      setSubStep(nextStep);
    } else {
      handleSaveAndContinue();
    }
  };

  const getStepConfig = () => {
    switch (subStep) {
      case 0: return { title: t('onboarding.matchingPreferences.ageTitle'), subtitle: t('onboarding.matchingPreferences.ageSubtitle') };
      case 1: return { title: t('onboarding.matchingPreferences.distanceTitle'), subtitle: t('onboarding.matchingPreferences.distanceSubtitle') };
      case 2: return { title: t('onboarding.matchingPreferences.genderTitle'), subtitle: t('onboarding.matchingPreferences.genderSubtitle') };
      default: return { title: "", subtitle: "" };
    }
  };

  const { title, subtitle } = getStepConfig();

  const renderContent = () => {
    switch (subStep) {
      case 0:
        return (
          <View>
            <Text style={[styles.rangeLabel, { color: isDark ? '#F5F5F7' : '#1F2937' }]}>
              {t('onboarding.matchingPreferences.lookingForAges', { min: ageMin, max: ageMax })}
            </Text>

            <View style={styles.sliderSection}>
              <Text style={[styles.sliderLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{t('onboarding.matchingPreferences.minAge', { age: ageMin })}</Text>
              <Slider
                minimumValue={18}
                maximumValue={80}
                step={1}
                value={ageMin}
                onValueChange={setAgeMin}
                minimumTrackTintColor="#A08AB7"
                maximumTrackTintColor={isDark ? '#374151' : '#D1D5DB'}
                thumbTintColor="#A08AB7"
              />
            </View>

            <View style={styles.sliderSection}>
              <Text style={[styles.sliderLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{t('onboarding.matchingPreferences.maxAge', { age: ageMax })}</Text>
              <Slider
                minimumValue={18}
                maximumValue={80}
                step={1}
                value={ageMax}
                onValueChange={setAgeMax}
                minimumTrackTintColor="#A08AB7"
                maximumTrackTintColor={isDark ? '#374151' : '#D1D5DB'}
                thumbTintColor="#A08AB7"
              />
            </View>
          </View>
        );

      case 1:
        return (
          <View>
            {/* Distance Unit Toggle */}
            <View style={styles.unitToggle}>
              {[
                { value: 'miles' as DistanceUnit, label: t('onboarding.matchingPreferences.miles') },
                { value: 'km' as DistanceUnit, label: t('onboarding.matchingPreferences.kilometers') },
              ].map((option, i) => {
                const selected = distanceUnit === option.value;
                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[styles.optionRow, i < 1 && { marginBottom: 4 }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDistanceUnit(option.value); }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.optionRowText, { color: selected ? '#A08AB7' : isDark ? '#E5E7EB' : '#374151' }]}>
                      {option.label}
                    </Text>
                    {selected && (
                      <MaterialCommunityIcons name="check" size={22} color="#A08AB7" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Distance Slider */}
            <View style={styles.sliderSection}>
              <Text style={[styles.sliderLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                {t('onboarding.matchingPreferences.maxDistance', { distance: formatDistanceSlider(maxDistance, distanceUnit) })}
              </Text>
              <Slider
                minimumValue={10}
                maximumValue={1000}
                step={10}
                value={maxDistance}
                onValueChange={setMaxDistance}
                minimumTrackTintColor="#A08AB7"
                maximumTrackTintColor={isDark ? '#374151' : '#D1D5DB'}
                thumbTintColor="#A08AB7"
              />
            </View>

            {/* Willing to Relocate */}
            <TouchableOpacity
              style={[styles.relocateRow, { backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA' }]}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setWillingToRelocate(!willingToRelocate); }}
            >
              <Text style={[styles.relocateText, { color: isDark ? '#E5E7EB' : '#374151' }]}>
                {t('onboarding.matchingPreferences.willingToRelocate')}
              </Text>
              <View style={[styles.toggle, { backgroundColor: willingToRelocate ? '#A08AB7' : isDark ? '#374151' : '#D1D5DB' }]}>
                <View style={[styles.toggleThumb, { marginLeft: willingToRelocate ? 18 : 2 }]} />
              </View>
            </TouchableOpacity>
          </View>
        );

      case 2:
        return (
          <OnboardingChips
            options={GENDER_PREF_OPTIONS.map(g => ({ label: g, value: g }))}
            value={genderPreference}
            onChange={(selected) => {
              const lastSelected = selected[selected.length - 1];
              if (lastSelected === 'Everyone') {
                setGenderPreference(['Everyone']);
              } else {
                setGenderPreference(selected.filter((s: string) => s !== 'Everyone'));
              }
            }}
            multiSelect
          />
        );

      default:
        return null;
    }
  };

  return (
    <OnboardingLayout
      currentStep={getGlobalStep('matching-preferences', subStep)}
      title={title}
      subtitle={subtitle}
      onBack={handleBack}
      onContinue={handleContinue}
      continueDisabled={loading || (subStep === 2 && genderPreference.length === 0)}
      continueLabel={t('common.continue')}
      onSkip={() => goToNextOnboardingStep('/(onboarding)/matching-preferences')}
    >
      {renderContent()}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  rangeLabel: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 24,
    textAlign: 'center',
  },
  sliderSection: {
    marginBottom: 24,
  },
  sliderLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  unitToggle: {
    marginBottom: 24,
  },
  optionRow: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionRowText: {
    fontSize: 16,
    fontWeight: '500',
  },
  relocateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 14,
  },
  relocateText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#FFFFFF',
  },
});
