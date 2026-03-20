import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, StyleSheet, useColorScheme } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { goToPreviousOnboardingStep, skipToDiscovery } from '@/lib/onboarding-navigation';
import { getGlobalStep } from '@/lib/onboarding-steps';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import OnboardingChips from '@/components/onboarding/OnboardingChips';
import { useOnboardingDraft } from '@/hooks/useOnboardingDraft';

interface MarriagePrefsDraft {
  primaryReason: string[];
  relationshipType: string;
  wantsChildren: boolean | null | undefined;
  childrenArrangement: string[];
  housingPreference: string[];
  financialArrangement: string[];
  smoking: string;
  drinking: string;
  pets: string;
  dealbreakers: string[];
  mustHaves: string[];
}

const PRIMARY_REASONS = [
  { value: 'financial', label: 'Financial Stability' },
  { value: 'immigration', label: 'Immigration/Visa' },
  { value: 'family_pressure', label: 'Family Pressure' },
  { value: 'legal_benefits', label: 'Legal Benefits' },
  { value: 'companionship', label: 'Companionship' },
  { value: 'safety', label: 'Safety & Protection' },
  { value: 'other', label: 'Other' },
];

const RELATIONSHIP_TYPES = [
  { value: 'platonic', label: 'Platonic Only' },
  { value: 'romantic', label: 'Romantic Possible' },
  { value: 'open', label: 'Open Arrangement' },
];

const CHILDREN_ARRANGEMENTS = [
  { value: 'biological', label: 'Biological Children' },
  { value: 'adoption', label: 'Adoption' },
  { value: 'surrogacy', label: 'Surrogacy' },
  { value: 'ivf', label: 'IVF/Fertility Treatments' },
  { value: 'co_parenting', label: 'Co-Parenting' },
  { value: 'fostering', label: 'Fostering' },
  { value: 'already_have', label: 'Already Have Children' },
  { value: 'open_discussion', label: 'Open to Discussion' },
  { value: 'other', label: 'Other' },
];

const HOUSING_PREFERENCES = [
  { value: 'separate_spaces', label: 'Separate Bedrooms/Spaces' },
  { value: 'roommates', label: 'Live Like Roommates' },
  { value: 'separate_homes', label: 'Separate Homes Nearby' },
  { value: 'shared_bedroom', label: 'Shared Bedroom' },
  { value: 'flexible', label: 'Flexible/Negotiable' },
];

const FINANCIAL_ARRANGEMENTS = [
  { value: 'separate', label: 'Keep Finances Separate' },
  { value: 'shared_expenses', label: 'Share Bills/Expenses' },
  { value: 'joint', label: 'Joint Finances' },
  { value: 'prenup_required', label: 'Prenup Required' },
  { value: 'flexible', label: 'Flexible/Negotiable' },
];

const SMOKING_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'socially', label: 'Socially' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'trying_to_quit', label: 'Trying to Quit' },
];

const DRINKING_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'socially', label: 'Socially' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'prefer_not_to_say', label: 'Prefer Not to Say' },
];

const PETS_OPTIONS = [
  { value: 'love_them', label: 'Love Them' },
  { value: 'like_them', label: 'Like Them' },
  { value: 'indifferent', label: 'Indifferent' },
  { value: 'allergic', label: 'Allergic' },
  { value: 'dont_like', label: "Don't Like" },
];

export default function MarriagePreferences() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Label mappings for option arrays defined outside the component
  const reasonLabels: Record<string, string> = {
    financial: t('onboarding.marriagePreferences.reason.financial'),
    immigration: t('onboarding.marriagePreferences.reason.immigration'),
    family_pressure: t('onboarding.marriagePreferences.reason.familyPressure'),
    legal_benefits: t('onboarding.marriagePreferences.reason.legalBenefits'),
    companionship: t('onboarding.marriagePreferences.reason.companionship'),
    safety: t('onboarding.marriagePreferences.reason.safety'),
    other: t('common.other'),
  };

  const relationshipLabels: Record<string, string> = {
    platonic: t('onboarding.marriagePreferences.relationship.platonic'),
    romantic: t('onboarding.marriagePreferences.relationship.romantic'),
    open: t('onboarding.marriagePreferences.relationship.open'),
  };

  const childrenLabels: Record<string, string> = {
    biological: t('onboarding.marriagePreferences.children.biological'),
    adoption: t('onboarding.marriagePreferences.children.adoption'),
    surrogacy: t('onboarding.marriagePreferences.children.surrogacy'),
    ivf: t('onboarding.marriagePreferences.children.ivf'),
    co_parenting: t('onboarding.marriagePreferences.children.coParenting'),
    fostering: t('onboarding.marriagePreferences.children.fostering'),
    already_have: t('onboarding.marriagePreferences.children.alreadyHave'),
    open_discussion: t('onboarding.marriagePreferences.children.openToDiscussion'),
    other: t('common.other'),
  };

  const housingLabels: Record<string, string> = {
    separate_spaces: t('onboarding.marriagePreferences.housing.separateSpaces'),
    roommates: t('onboarding.marriagePreferences.housing.roommates'),
    separate_homes: t('onboarding.marriagePreferences.housing.separateHomes'),
    shared_bedroom: t('onboarding.marriagePreferences.housing.sharedBedroom'),
    flexible: t('onboarding.marriagePreferences.housing.flexible'),
  };

  const financialLabels: Record<string, string> = {
    separate: t('onboarding.marriagePreferences.financial.separate'),
    shared_expenses: t('onboarding.marriagePreferences.financial.sharedExpenses'),
    joint: t('onboarding.marriagePreferences.financial.joint'),
    prenup_required: t('onboarding.marriagePreferences.financial.prenupRequired'),
    flexible: t('onboarding.marriagePreferences.financial.flexible'),
  };

  const smokingLabels: Record<string, string> = {
    never: t('onboarding.marriagePreferences.lifestyle.never'),
    socially: t('onboarding.marriagePreferences.lifestyle.socially'),
    regularly: t('onboarding.marriagePreferences.lifestyle.regularly'),
    trying_to_quit: t('onboarding.marriagePreferences.lifestyle.tryingToQuit'),
  };

  const drinkingLabels: Record<string, string> = {
    never: t('onboarding.marriagePreferences.lifestyle.never'),
    socially: t('onboarding.marriagePreferences.lifestyle.socially'),
    regularly: t('onboarding.marriagePreferences.lifestyle.regularly'),
    prefer_not_to_say: t('onboarding.marriagePreferences.lifestyle.preferNotToSay'),
  };

  const petsLabels: Record<string, string> = {
    love_them: t('onboarding.marriagePreferences.lifestyle.loveThem'),
    like_them: t('onboarding.marriagePreferences.lifestyle.likeThem'),
    indifferent: t('onboarding.marriagePreferences.lifestyle.indifferent'),
    allergic: t('onboarding.marriagePreferences.lifestyle.allergic'),
    dont_like: t('onboarding.marriagePreferences.lifestyle.dontLike'),
  };

  const localizedOptions = (options: { value: string; label: string }[], labels: Record<string, string>) =>
    options.map(o => ({ ...o, label: labels[o.value] || o.label }));

  const [subStep, setSubStep] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [primaryReason, setPrimaryReason] = useState<string[]>([]);
  const [relationshipType, setRelationshipType] = useState('');
  const [wantsChildren, setWantsChildren] = useState<boolean | null | undefined>(undefined);
  const [childrenArrangement, setChildrenArrangement] = useState<string[]>([]);
  const [housingPreference, setHousingPreference] = useState<string[]>([]);
  const [financialArrangement, setFinancialArrangement] = useState<string[]>([]);
  const [smoking, setSmoking] = useState('');
  const [drinking, setDrinking] = useState('');
  const [pets, setPets] = useState('');
  const [dealbreakers, setDealbreakers] = useState<string[]>([]);
  const [newDealbreaker, setNewDealbreaker] = useState('');
  const [mustHaves, setMustHaves] = useState<string[]>([]);
  const [newMustHave, setNewMustHave] = useState('');

  const { loadDraft, saveDraft, clearDraft } = useOnboardingDraft<MarriagePrefsDraft>(user?.id, 'marriage-preferences');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, field_visibility')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setProfileId(data.id);

        const { data: prefs, error: prefsError } = await supabase
          .from('preferences')
          .select('*')
          .eq('profile_id', data.id)
          .single();

        if (prefsError && prefsError.code !== 'PGRST116') {
          console.error('Error loading preferences:', prefsError);
        }

        if (prefs) {
          if (prefs.primary_reasons) setPrimaryReason(Array.isArray(prefs.primary_reasons) ? prefs.primary_reasons : [prefs.primary_reasons]);
          else if (prefs.primary_reason) setPrimaryReason([prefs.primary_reason]);
          if (prefs.relationship_type) setRelationshipType(prefs.relationship_type);
          if (prefs.wants_children !== null && prefs.wants_children !== undefined) setWantsChildren(prefs.wants_children);
          if (prefs.children_arrangement) setChildrenArrangement(Array.isArray(prefs.children_arrangement) ? prefs.children_arrangement : [prefs.children_arrangement]);
          if (prefs.housing_preference) setHousingPreference(Array.isArray(prefs.housing_preference) ? prefs.housing_preference : [prefs.housing_preference]);
          if (prefs.financial_arrangement) setFinancialArrangement(Array.isArray(prefs.financial_arrangement) ? prefs.financial_arrangement : [prefs.financial_arrangement]);
          if (prefs.dealbreakers) setDealbreakers(Array.isArray(prefs.dealbreakers) ? prefs.dealbreakers : [prefs.dealbreakers]);
          if (prefs.must_haves) setMustHaves(Array.isArray(prefs.must_haves) ? prefs.must_haves : [prefs.must_haves]);

          if (prefs.lifestyle_preferences) {
            if (prefs.lifestyle_preferences.smoking) setSmoking(prefs.lifestyle_preferences.smoking);
            if (prefs.lifestyle_preferences.drinking) setDrinking(prefs.lifestyle_preferences.drinking);
            if (prefs.lifestyle_preferences.pets) setPets(prefs.lifestyle_preferences.pets);
          }
        }
      }

      // Overlay draft on top of DB data
      const draft = await loadDraft();
      if (draft) {
        const d = draft.data;
        if (d.primaryReason?.length) setPrimaryReason(d.primaryReason);
        if (d.relationshipType) setRelationshipType(d.relationshipType);
        if (d.wantsChildren !== undefined) setWantsChildren(d.wantsChildren);
        if (d.childrenArrangement?.length) setChildrenArrangement(d.childrenArrangement);
        if (d.housingPreference?.length) setHousingPreference(d.housingPreference);
        if (d.financialArrangement?.length) setFinancialArrangement(d.financialArrangement);
        if (d.smoking) setSmoking(d.smoking);
        if (d.drinking) setDrinking(d.drinking);
        if (d.pets) setPets(d.pets);
        if (d.dealbreakers?.length) setDealbreakers(d.dealbreakers);
        if (d.mustHaves?.length) setMustHaves(d.mustHaves);
        setSubStep(draft.subStep);
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const handleSaveAndContinue = async () => {
    if (primaryReason.length === 0) { Alert.alert(t('common.required'), t('onboarding.marriagePreferences.errors.selectReason')); return; }
    if (!relationshipType) { Alert.alert(t('common.required'), t('onboarding.marriagePreferences.errors.selectRelationship')); return; }
    if (wantsChildren === undefined) { Alert.alert(t('common.required'), t('onboarding.marriagePreferences.errors.selectChildren')); return; }
    if (housingPreference.length === 0) { Alert.alert(t('common.required'), t('onboarding.marriagePreferences.errors.selectHousing')); return; }
    if (financialArrangement.length === 0) { Alert.alert(t('common.required'), t('onboarding.marriagePreferences.errors.selectFinancial')); return; }

    if (!profileId) {
      Alert.alert(t('common.error'), t('onboarding.common.profileNotFound'));
      return;
    }

    try {
      setLoading(true);

      const lifestylePreferences: any = {};
      if (smoking) lifestylePreferences.smoking = smoking;
      if (drinking) lifestylePreferences.drinking = drinking;
      if (pets) lifestylePreferences.pets = pets;

      const marriagePrefs = {
        primary_reasons: primaryReason.length > 0 ? primaryReason : ['other'],
        primary_reason: primaryReason.length > 0 ? primaryReason[0] : 'other',
        relationship_type: relationshipType,
        wants_children: wantsChildren,
        children_arrangement: childrenArrangement.length > 0 ? childrenArrangement : null,
        housing_preference: housingPreference.length > 0 ? housingPreference : ['flexible'],
        financial_arrangement: financialArrangement.length > 0 ? financialArrangement : ['flexible'],
        lifestyle_preferences: Object.keys(lifestylePreferences).length > 0 ? lifestylePreferences : null,
        dealbreakers: dealbreakers.length > 0 ? dealbreakers : null,
        must_haves: mustHaves.length > 0 ? mustHaves : null,
      };

      const { data: existing } = await supabase
        .from('preferences')
        .select('id')
        .eq('profile_id', profileId)
        .maybeSingle();

      const { error } = existing
        ? await supabase.from('preferences').update(marriagePrefs).eq('profile_id', profileId)
        : await supabase.from('preferences').insert({ profile_id: profileId, ...marriagePrefs });

      if (error) throw error;

      await supabase
        .from('profiles')
        .update({ onboarding_step: 8 })
        .eq('id', profileId);

      await clearDraft();
      router.push('/(onboarding)/matching-preferences');
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('onboarding.marriagePreferences.errors.saveFailed'));
    } finally {
      setLoading(false);
    }
  };

  const buildDraftSnapshot = (): MarriagePrefsDraft => ({
    primaryReason, relationshipType, wantsChildren, childrenArrangement,
    housingPreference, financialArrangement, smoking, drinking, pets,
    dealbreakers, mustHaves,
  });

  const handleBack = () => {
    if (subStep === 0) {
      goToPreviousOnboardingStep('/(onboarding)/marriage-preferences');
    } else {
      const prevStep = subStep - 1;
      saveDraft(prevStep, buildDraftSnapshot());
      setSubStep(prevStep);
    }
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (subStep < 6) {
      const nextStep = subStep + 1;
      saveDraft(nextStep, buildDraftSnapshot());
      setSubStep(nextStep);
    } else {
      handleSaveAndContinue();
    }
  };

  const handleSkip = () => {
    if (subStep < 6) {
      const nextStep = subStep + 1;
      saveDraft(nextStep, buildDraftSnapshot());
      setSubStep(nextStep);
    } else {
      handleSaveAndContinue();
    }
  };

  const canContinue = () => {
    switch (subStep) {
      case 0: return primaryReason.length > 0;
      case 1: return !!relationshipType;
      case 2: return wantsChildren !== undefined;
      case 3: return housingPreference.length > 0;
      case 4: return financialArrangement.length > 0;
      case 5: return true; // optional
      case 6: return true; // optional
      default: return true;
    }
  };

  const getStepConfig = () => {
    switch (subStep) {
      case 0: return { title: t('onboarding.marriagePreferences.step0Title'), subtitle: t('onboarding.marriagePreferences.step0Subtitle') };
      case 1: return { title: t('onboarding.marriagePreferences.step1Title'), subtitle: t('onboarding.marriagePreferences.step1Subtitle') };
      case 2: return { title: t('onboarding.marriagePreferences.step2Title'), subtitle: t('onboarding.marriagePreferences.step2Subtitle') };
      case 3: return { title: t('onboarding.marriagePreferences.step3Title'), subtitle: t('onboarding.marriagePreferences.step3Subtitle') };
      case 4: return { title: t('onboarding.marriagePreferences.step4Title'), subtitle: t('onboarding.marriagePreferences.step4Subtitle') };
      case 5: return { title: t('onboarding.marriagePreferences.step5Title'), subtitle: t('onboarding.marriagePreferences.step5Subtitle') };
      case 6: return { title: t('onboarding.marriagePreferences.step6Title'), subtitle: t('onboarding.marriagePreferences.step6Subtitle') };
      default: return { title: "", subtitle: "" };
    }
  };

  const { title, subtitle } = getStepConfig();

  const renderContent = () => {
    switch (subStep) {
      case 0:
        return (
          <View>
            <OnboardingChips
              options={localizedOptions(PRIMARY_REASONS, reasonLabels)}
              value={primaryReason}
              onChange={setPrimaryReason}
              multiSelect
            />
            <View style={styles.visibilityNote}>
              <MaterialCommunityIcons name="eye-outline" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
              <Text style={[styles.visibilityNoteText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{t('onboarding.visibility.alwaysVisible')}</Text>
            </View>
          </View>
        );

      case 1:
        return (
          <View>
            <OnboardingChips
              options={localizedOptions(RELATIONSHIP_TYPES, relationshipLabels)}
              value={relationshipType}
              onChange={setRelationshipType}
            />
            <View style={styles.visibilityNote}>
              <MaterialCommunityIcons name="eye-outline" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
              <Text style={[styles.visibilityNoteText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{t('onboarding.visibility.alwaysVisible')}</Text>
            </View>
          </View>
        );

      case 2:
        return (
          <View>
            <View>
              {[
                { value: true, label: t('common.yes') },
                { value: false, label: t('common.no') },
                { value: null, label: t('onboarding.marriagePreferences.children.maybeOpen') },
              ].map((option, i) => {
                const selected = wantsChildren === option.value;
                return (
                  <TouchableOpacity
                    key={String(option.value)}
                    style={[styles.optionRow, i < 2 && { marginBottom: 4 }]}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setWantsChildren(option.value); }}
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

            {wantsChildren === true && (
              <View style={styles.childrenArrangementSection}>
                <Text style={[styles.sectionLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                  {t('onboarding.marriagePreferences.childrenArrangementLabel')}
                </Text>
                <OnboardingChips
                  options={localizedOptions(CHILDREN_ARRANGEMENTS, childrenLabels)}
                  value={childrenArrangement}
                  onChange={setChildrenArrangement}
                  multiSelect
                />
              </View>
            )}
            <View style={styles.visibilityNote}>
              <MaterialCommunityIcons name="eye-outline" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
              <Text style={[styles.visibilityNoteText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{t('onboarding.visibility.alwaysVisible')}</Text>
            </View>
          </View>
        );

      case 3:
        return (
          <View>
            <OnboardingChips
              options={localizedOptions(HOUSING_PREFERENCES, housingLabels)}
              value={housingPreference}
              onChange={setHousingPreference}
              multiSelect
            />
            <View style={styles.visibilityNote}>
              <MaterialCommunityIcons name="eye-outline" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
              <Text style={[styles.visibilityNoteText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{t('onboarding.visibility.alwaysVisible')}</Text>
            </View>
          </View>
        );

      case 4:
        return (
          <View>
            <OnboardingChips
              options={localizedOptions(FINANCIAL_ARRANGEMENTS, financialLabels)}
              value={financialArrangement}
              onChange={setFinancialArrangement}
              multiSelect
            />
            <View style={styles.visibilityNote}>
              <MaterialCommunityIcons name="eye-outline" size={18} color={isDark ? '#9CA3AF' : '#6B7280'} />
              <Text style={[styles.visibilityNoteText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{t('onboarding.visibility.alwaysVisible')}</Text>
            </View>
          </View>
        );

      case 5:
        return (
          <View>
            <View style={[styles.lifestyleCard, { backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA' }]}>
              <View style={styles.lifestyleCardHeader}>
                <MaterialCommunityIcons name="smoking" size={20} color="#A08AB7" />
                <Text style={[styles.lifestyleCardTitle, { color: isDark ? '#E5E7EB' : '#1F2937' }]}>{t('onboarding.marriagePreferences.lifestyle.smokingTitle')}</Text>
              </View>
              <OnboardingChips options={localizedOptions(SMOKING_OPTIONS, smokingLabels)} value={smoking} onChange={setSmoking} />
            </View>

            <View style={[styles.lifestyleCard, { backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA' }]}>
              <View style={styles.lifestyleCardHeader}>
                <MaterialCommunityIcons name="glass-cocktail" size={20} color="#A08AB7" />
                <Text style={[styles.lifestyleCardTitle, { color: isDark ? '#E5E7EB' : '#1F2937' }]}>{t('onboarding.marriagePreferences.lifestyle.drinkingTitle')}</Text>
              </View>
              <OnboardingChips options={localizedOptions(DRINKING_OPTIONS, drinkingLabels)} value={drinking} onChange={setDrinking} />
            </View>

            <View style={[styles.lifestyleCard, { backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA' }]}>
              <View style={styles.lifestyleCardHeader}>
                <MaterialCommunityIcons name="paw" size={20} color="#A08AB7" />
                <Text style={[styles.lifestyleCardTitle, { color: isDark ? '#E5E7EB' : '#1F2937' }]}>{t('onboarding.marriagePreferences.lifestyle.petsTitle')}</Text>
              </View>
              <OnboardingChips options={localizedOptions(PETS_OPTIONS, petsLabels)} value={pets} onChange={setPets} />
            </View>
          </View>
        );

      case 6:
        return (
          <View>
            {/* Must-haves */}
            <Text style={[styles.sectionLabel, { color: isDark ? '#E5E7EB' : '#1F2937' }]}>{t('onboarding.marriagePreferences.mustHavesTitle')}</Text>
            <View style={styles.tagInputRow}>
              <TextInput
                style={[styles.tagInput, {
                  backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA',
                  color: isDark ? '#F5F5F7' : '#1A1A2E',
                }]}
                placeholder={t('onboarding.marriagePreferences.mustHavesPlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={newMustHave}
                onChangeText={setNewMustHave}
                onSubmitEditing={() => {
                  if (newMustHave.trim()) { setMustHaves([...mustHaves, newMustHave.trim()]); setNewMustHave(''); }
                }}
              />
              <TouchableOpacity
                style={[styles.tagAddButton, { backgroundColor: newMustHave.trim() ? '#A08AB7' : isDark ? '#2C2C3E' : '#D1D5DB' }]}
                onPress={() => {
                  if (newMustHave.trim()) { setMustHaves([...mustHaves, newMustHave.trim()]); setNewMustHave(''); }
                }}
              >
                <MaterialCommunityIcons name="plus" size={22} color="white" />
              </TouchableOpacity>
            </View>
            <View style={styles.tagsContainer}>
              {mustHaves.map((item, index) => (
                <View key={index} style={[styles.tag, { backgroundColor: isDark ? 'rgba(22,101,52,0.3)' : '#DCFCE7' }]}>
                  <Text style={[styles.tagText, { color: isDark ? '#86EFAC' : '#166534' }]}>{item}</Text>
                  <TouchableOpacity onPress={() => setMustHaves(mustHaves.filter((_, i) => i !== index))}>
                    <MaterialCommunityIcons name="close-circle" size={16} color={isDark ? '#86EFAC' : '#166534'} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>

            {/* Dealbreakers */}
            <Text style={[styles.sectionLabel, { color: isDark ? '#E5E7EB' : '#1F2937', marginTop: 28 }]}>{t('onboarding.marriagePreferences.dealbreakersTitle')}</Text>
            <View style={styles.tagInputRow}>
              <TextInput
                style={[styles.tagInput, {
                  backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA',
                  color: isDark ? '#F5F5F7' : '#1A1A2E',
                }]}
                placeholder={t('onboarding.marriagePreferences.dealbreakersPlaceholder')}
                placeholderTextColor="#9CA3AF"
                value={newDealbreaker}
                onChangeText={setNewDealbreaker}
                onSubmitEditing={() => {
                  if (newDealbreaker.trim()) { setDealbreakers([...dealbreakers, newDealbreaker.trim()]); setNewDealbreaker(''); }
                }}
              />
              <TouchableOpacity
                style={[styles.tagAddButton, { backgroundColor: newDealbreaker.trim() ? '#A08AB7' : isDark ? '#2C2C3E' : '#D1D5DB' }]}
                onPress={() => {
                  if (newDealbreaker.trim()) { setDealbreakers([...dealbreakers, newDealbreaker.trim()]); setNewDealbreaker(''); }
                }}
              >
                <MaterialCommunityIcons name="plus" size={22} color="white" />
              </TouchableOpacity>
            </View>
            <View style={styles.tagsContainer}>
              {dealbreakers.map((item, index) => (
                <View key={index} style={[styles.tag, { backgroundColor: isDark ? 'rgba(153,27,27,0.3)' : '#FEE2E2' }]}>
                  <Text style={[styles.tagText, { color: isDark ? '#FCA5A5' : '#991B1B' }]}>{item}</Text>
                  <TouchableOpacity onPress={() => setDealbreakers(dealbreakers.filter((_, i) => i !== index))}>
                    <MaterialCommunityIcons name="close-circle" size={16} color={isDark ? '#FCA5A5' : '#991B1B'} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <OnboardingLayout
      currentStep={getGlobalStep('marriage-preferences', subStep)}
      title={title}
      subtitle={subtitle}
      onBack={handleBack}
      onContinue={handleContinue}
      onSkip={skipToDiscovery}
      continueDisabled={loading || !canContinue()}
      continueLabel={loading ? t('common.loading') : t('common.continue')}
      currentRoute="/(onboarding)/marriage-preferences"
    >
      {renderContent()}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
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
  childrenArrangementSection: {
    marginTop: 28,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  tagInputRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  tagInput: {
    flex: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
  },
  tagAddButton: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '500',
  },
  lifestyleCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  lifestyleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  lifestyleCardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
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
});
