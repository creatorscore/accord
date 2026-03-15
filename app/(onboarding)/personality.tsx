import { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { goToPreviousOnboardingStep } from '@/lib/onboarding-navigation';
import { getGlobalStep } from '@/lib/onboarding-steps';
import { HeightUnit, cmToInches, inchesToCm, inchesToFeetAndInches } from '@/lib/height-utils';
import * as Haptics from 'expo-haptics';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import OnboardingChips from '@/components/onboarding/OnboardingChips';
import VisibilityToggle from '@/components/onboarding/VisibilityToggle';
import ScrollPicker from '@/components/onboarding/ScrollPicker';
import { useOnboardingDraft } from '@/hooks/useOnboardingDraft';

interface PersonalityDraft {
  heightInTotal: number;
  heightUnit: string;
  personalityType: string;
  loveLanguage: string[];
  selectedLanguages: string[];
  religion: string;
  politicalViews: string;
  fieldVisibility: Record<string, boolean>;
}

const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
  "Don't know",
];

const LOVE_LANGUAGES = [
  'Words of Affirmation',
  'Quality Time',
  'Receiving Gifts',
  'Acts of Service',
  'Physical Touch',
  'Not sure',
];

const COMMON_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Mandarin', 'Cantonese', 'Japanese', 'Korean', 'Arabic', 'Hindi',
  'Russian', 'Dutch', 'Polish', 'Swedish', 'Greek', 'Hebrew',
  'Vietnamese', 'Thai', 'Tagalog', 'ASL (Sign Language)', 'Other',
];

const RELIGIONS = [
  'Christian', 'Catholic', 'Protestant', 'Muslim', 'Jewish', 'Hindu',
  'Buddhist', 'Sikh', 'Atheist', 'Agnostic', 'Spiritual but not religious',
  'Other', 'Prefer not to say',
];

const POLITICAL_VIEWS = [
  'Liberal', 'Progressive', 'Moderate', 'Conservative', 'Libertarian',
  'Socialist', 'Apolitical', 'Other', 'Prefer not to say',
];

export default function Personality() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const LOVE_LANGUAGE_LABELS: Record<string, string> = {
    'Words of Affirmation': t('onboarding.personality.wordsOfAffirmation'),
    'Quality Time': t('onboarding.personality.qualityTime'),
    'Receiving Gifts': t('onboarding.personality.receivingGifts'),
    'Acts of Service': t('onboarding.personality.actsOfService'),
    'Physical Touch': t('onboarding.personality.physicalTouch'),
    'Not sure': t('onboarding.personality.notSure'),
  };
  const LANGUAGE_LABELS: Record<string, string> = {
    'English': t('onboarding.personality.lang.english'),
    'Spanish': t('onboarding.personality.lang.spanish'),
    'French': t('onboarding.personality.lang.french'),
    'German': t('onboarding.personality.lang.german'),
    'Italian': t('onboarding.personality.lang.italian'),
    'Portuguese': t('onboarding.personality.lang.portuguese'),
    'Mandarin': t('onboarding.personality.lang.mandarin'),
    'Japanese': t('onboarding.personality.lang.japanese'),
    'Korean': t('onboarding.personality.lang.korean'),
    'Arabic': t('onboarding.personality.lang.arabic'),
    'Hindi': t('onboarding.personality.lang.hindi'),
    'Russian': t('onboarding.personality.lang.russian'),
    'Dutch': t('onboarding.personality.lang.dutch'),
    'Polish': t('onboarding.personality.lang.polish'),
    'Vietnamese': t('onboarding.personality.lang.vietnamese'),
    'Thai': t('onboarding.personality.lang.thai'),
    'Tagalog': t('onboarding.personality.lang.tagalog'),
    'ASL (Sign Language)': t('onboarding.personality.lang.asl'),
    'Other': t('onboarding.personality.lang.other'),
  };
  const RELIGION_LABELS: Record<string, string> = {
    'Christian': t('onboarding.personality.religion.christian'),
    'Muslim': t('onboarding.personality.religion.muslim'),
    'Jewish': t('onboarding.personality.religion.jewish'),
    'Hindu': t('onboarding.personality.religion.hindu'),
    'Buddhist': t('onboarding.personality.religion.buddhist'),
    'Sikh': t('onboarding.personality.religion.sikh'),
    'Atheist': t('onboarding.personality.religion.atheist'),
    'Agnostic': t('onboarding.personality.religion.agnostic'),
    'Spiritual but not religious': t('onboarding.personality.religion.spiritual'),
    'Prefer not to say': t('onboarding.personality.religion.preferNotToSay'),
  };
  const POLITICS_LABELS: Record<string, string> = {
    'Liberal': t('onboarding.personality.politics.liberal'),
    'Conservative': t('onboarding.personality.politics.conservative'),
    'Moderate': t('onboarding.personality.politics.moderate'),
    'Progressive': t('onboarding.personality.politics.progressive'),
    'Libertarian': t('onboarding.personality.politics.libertarian'),
    'Apolitical': t('onboarding.personality.politics.apolitical'),
    'Prefer not to say': t('onboarding.personality.politics.preferNotToSay'),
  };

  const [subStep, setSubStep] = useState(0);
  const [heightInTotal, setHeightInTotal] = useState<number>(69); // total inches, default 5'9"
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('imperial');

  // Imperial: combined feet+inches items (48" = 4'0" through 87" = 7'3")
  const imperialItems = useMemo(() =>
    Array.from({ length: 40 }, (_, i) => {
      const totalIn = i + 48;
      const { feet, inches } = inchesToFeetAndInches(totalIn);
      return { label: `${feet}' ${inches}"`, value: totalIn };
    }), []);

  // Metric: cm items (120cm through 220cm)
  const metricItems = useMemo(() =>
    Array.from({ length: 101 }, (_, i) => ({
      label: `${i + 120} cm`,
      value: i + 120,
    })), []);

  // Convert between units for the picker
  const pickerValue = useMemo(() => {
    if (heightUnit === 'metric') return inchesToCm(heightInTotal);
    return heightInTotal;
  }, [heightInTotal, heightUnit]);

  const handleHeightChange = (value: number) => {
    if (heightUnit === 'metric') {
      setHeightInTotal(cmToInches(value));
    } else {
      setHeightInTotal(value);
    }
  };
  const [personalityType, setPersonalityType] = useState('');
  const [loveLanguage, setLoveLanguage] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [religion, setReligion] = useState('');
  const [politicalViews, setPoliticalViews] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [fieldVisibility, setFieldVisibility] = useState<Record<string, boolean>>({
    religion: true, political_views: true,
  });

  const { loadDraft, saveDraft, clearDraft } = useOnboardingDraft<PersonalityDraft>(user?.id, 'personality');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, height_inches, height_unit, personality_type, love_language, languages_spoken, religion, political_views, field_visibility')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setProfileId(data.id);
        if (data.personality_type) setPersonalityType(data.personality_type);
        if (data.love_language) setLoveLanguage(Array.isArray(data.love_language) ? data.love_language : [data.love_language]);
        if (data.languages_spoken) setSelectedLanguages(Array.isArray(data.languages_spoken) ? data.languages_spoken : [data.languages_spoken]);
        if (data.religion) setReligion(data.religion);
        if (data.political_views) setPoliticalViews(data.political_views);
        if (data.field_visibility) {
          setFieldVisibility(prev => ({ ...prev, ...data.field_visibility }));
        }

        if (data.height_unit) setHeightUnit(data.height_unit);
        if (data.height_inches) {
          setHeightInTotal(data.height_inches);
        }
      }

      // Overlay draft on top of DB data
      const draft = await loadDraft();
      if (draft) {
        const d = draft.data;
        if (d.heightInTotal) setHeightInTotal(d.heightInTotal);
        if (d.heightUnit) setHeightUnit(d.heightUnit as HeightUnit);
        if (d.personalityType) setPersonalityType(d.personalityType);
        if (d.loveLanguage?.length) setLoveLanguage(d.loveLanguage);
        if (d.selectedLanguages?.length) setSelectedLanguages(d.selectedLanguages);
        if (d.religion) setReligion(d.religion);
        if (d.politicalViews) setPoliticalViews(d.politicalViews);
        if (d.fieldVisibility) setFieldVisibility(prev => ({ ...prev, ...d.fieldVisibility }));
        setSubStep(draft.subStep);
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const handleSaveAndContinue = async () => {
    try {
      setLoading(true);

      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !currentUser) throw new Error('Not authenticated. Please sign in again.');

      let activeProfileId = profileId;
      if (!activeProfileId) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', currentUser.id)
          .single();
        if (profileError) throw profileError;
        activeProfileId = profileData.id;
      }

      const totalHeightInches = heightInTotal;

      // Merge field_visibility with existing values
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('field_visibility')
        .eq('id', activeProfileId)
        .single();

      const mergedVisibility = {
        ...(existingProfile?.field_visibility || {}),
        ...fieldVisibility,
      };

      const { error } = await supabase
        .from('profiles')
        .update({
          height_inches: totalHeightInches,
          height_unit: heightUnit,
          personality_type: personalityType || null,
          love_language: loveLanguage.length > 0 ? loveLanguage : null,
          languages_spoken: selectedLanguages.length > 0 ? selectedLanguages : null,
          religion: religion || null,
          political_views: politicalViews || null,
          field_visibility: mergedVisibility,
          onboarding_step: 2,
        })
        .eq('id', activeProfileId);

      if (error) throw error;

      await clearDraft();
      router.push('/(onboarding)/photos');
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('onboarding.personality.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const buildDraftSnapshot = (): PersonalityDraft => ({
    heightInTotal, heightUnit, personalityType, loveLanguage,
    selectedLanguages, religion, politicalViews, fieldVisibility,
  });

  const handleBack = () => {
    if (subStep === 0) {
      goToPreviousOnboardingStep('/(onboarding)/personality');
    } else {
      const prevStep = subStep - 1;
      saveDraft(prevStep, buildDraftSnapshot());
      setSubStep(prevStep);
    }
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (subStep < 5) {
      const nextStep = subStep + 1;
      saveDraft(nextStep, buildDraftSnapshot());
      setSubStep(nextStep);
    } else {
      handleSaveAndContinue();
    }
  };

  const handleSkip = () => {
    if (subStep < 5) {
      const nextStep = subStep + 1;
      saveDraft(nextStep, buildDraftSnapshot());
      setSubStep(nextStep);
    } else {
      handleSaveAndContinue();
    }
  };

  const getStepConfig = () => {
    switch (subStep) {
      case 0:
        return { title: t('onboarding.personality.heightTitle'), subtitle: "" };
      case 1:
        return { title: t('onboarding.personality.mbtiTitle'), subtitle: t('onboarding.personality.mbtiSubtitle') };
      case 2:
        return { title: t('onboarding.personality.loveLanguageTitle'), subtitle: t('onboarding.personality.loveLanguageSubtitle') };
      case 3:
        return { title: t('onboarding.personality.languagesTitle'), subtitle: t('onboarding.personality.languagesSubtitle') };
      case 4:
        return { title: t('onboarding.personality.faithTitle'), subtitle: t('onboarding.personality.faithSubtitle') };
      case 5:
        return { title: t('onboarding.personality.politicsTitle'), subtitle: t('onboarding.personality.politicsSubtitle') };
      default:
        return { title: "", subtitle: "" };
    }
  };

  const { title, subtitle } = getStepConfig();

  const renderContent = () => {
    switch (subStep) {
      case 0:
        return (
          <View>
            <ScrollPicker
              items={heightUnit === 'imperial' ? imperialItems : metricItems}
              selectedValue={pickerValue}
              onValueChange={handleHeightChange}
            />

            {/* FT / CM pill toggle */}
            <View style={styles.unitToggleRow}>
              <View style={[styles.unitPill, { backgroundColor: isDark ? '#2A2A3E' : '#F0EDF4' }]}>
                <TouchableOpacity
                  style={[
                    styles.unitPillOption,
                    heightUnit === 'imperial' && [styles.unitPillOptionActive, { backgroundColor: isDark ? '#3D3D52' : '#FFFFFF' }],
                  ]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setHeightUnit('imperial'); }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.unitPillText,
                    { color: heightUnit === 'imperial' ? (isDark ? '#F5F5F7' : '#1A1A2E') : (isDark ? '#6B7280' : '#9CA3AF') },
                    heightUnit === 'imperial' && { fontWeight: '700' },
                  ]}>
                    {t('onboarding.personality.ft')}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.unitPillOption,
                    heightUnit === 'metric' && [styles.unitPillOptionActive, { backgroundColor: isDark ? '#3D3D52' : '#FFFFFF' }],
                  ]}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setHeightUnit('metric'); }}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.unitPillText,
                    { color: heightUnit === 'metric' ? (isDark ? '#F5F5F7' : '#1A1A2E') : (isDark ? '#6B7280' : '#9CA3AF') },
                    heightUnit === 'metric' && { fontWeight: '700' },
                  ]}>
                    {t('onboarding.personality.cm')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider */}
            <View style={[styles.divider, { backgroundColor: isDark ? '#2A2A3E' : '#F0EDF4' }]} />

            <View style={styles.visibilityNote}>
              <MaterialCommunityIcons name="eye-outline" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
              <Text style={[styles.visibilityNoteText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                {t('onboarding.visibility.alwaysVisible')}
              </Text>
            </View>
          </View>
        );

      case 1:
        return (
          <OnboardingChips
            options={MBTI_TYPES.map(v => ({ label: v === "Don't know" ? t('onboarding.personality.dontKnow') : v, value: v }))}
            value={personalityType}
            onChange={setPersonalityType}
          />
        );

      case 2:
        return (
          <OnboardingChips
            options={LOVE_LANGUAGES.map(l => ({ label: LOVE_LANGUAGE_LABELS[l] || l, value: l }))}
            value={loveLanguage}
            onChange={setLoveLanguage}
            multiSelect
          />
        );

      case 3:
        return (
          <OnboardingChips
            options={COMMON_LANGUAGES.map(l => ({ label: LANGUAGE_LABELS[l] || l, value: l }))}
            value={selectedLanguages}
            onChange={setSelectedLanguages}
            multiSelect
          />
        );

      case 4:
        return (
          <View>
            <OnboardingChips
              options={RELIGIONS.map(r => ({ label: RELIGION_LABELS[r] || r, value: r }))}
              value={religion}
              onChange={setReligion}
            />
            <VisibilityToggle
              visible={fieldVisibility.religion !== false}
              onToggle={(v) => setFieldVisibility(prev => ({ ...prev, religion: v }))}
            />
          </View>
        );

      case 5:
        return (
          <View>
            <OnboardingChips
              options={POLITICAL_VIEWS.map(v => ({ label: POLITICS_LABELS[v] || v, value: v }))}
              value={politicalViews}
              onChange={setPoliticalViews}
            />
            <VisibilityToggle
              visible={fieldVisibility.political_views !== false}
              onToggle={(v) => setFieldVisibility(prev => ({ ...prev, political_views: v }))}
            />
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <OnboardingLayout
      currentStep={getGlobalStep('personality', subStep)}
      title={title}
      subtitle={subtitle}
      onBack={handleBack}
      onContinue={handleContinue}
      onSkip={undefined}
      continueDisabled={loading}
      continueLabel={loading ? t('common.saving') : t('common.continue')}
      currentRoute="/(onboarding)/personality"
    >
      {renderContent()}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  visibilityNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 20,
  },
  visibilityNoteText: {
    fontSize: 14,
    fontWeight: '500',
  },
  unitToggleRow: {
    alignItems: 'flex-end',
    marginTop: 20,
  },
  unitPill: {
    flexDirection: 'row',
    borderRadius: 20,
    padding: 3,
  },
  unitPillOption: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 17,
  },
  unitPillOptionActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  unitPillText: {
    fontSize: 14,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    marginTop: 20,
  },
});
