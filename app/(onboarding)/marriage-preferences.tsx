import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, TextInput, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { goToPreviousOnboardingStep } from '@/lib/onboarding-navigation';
import { useTranslation } from 'react-i18next';

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

const CHILDREN_OPTIONS = [
  { value: true, label: 'Yes' },
  { value: false, label: 'No' },
  { value: null, label: 'Maybe/Open' },
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

        // Load existing preferences
        const { data: prefs, error: prefsError } = await supabase
          .from('preferences')
          .select('*')
          .eq('profile_id', data.id)
          .single();

        if (prefsError && prefsError.code !== 'PGRST116') {
          console.error('Error loading preferences:', prefsError);
        }

        if (prefs) {
          // Pre-fill form with existing data
          if (prefs.primary_reasons) setPrimaryReason(Array.isArray(prefs.primary_reasons) ? prefs.primary_reasons : [prefs.primary_reasons]);
          else if (prefs.primary_reason) setPrimaryReason([prefs.primary_reason]);
          if (prefs.relationship_type) setRelationshipType(prefs.relationship_type);
          if (prefs.wants_children !== null && prefs.wants_children !== undefined) setWantsChildren(prefs.wants_children);
          if (prefs.children_arrangement) setChildrenArrangement(Array.isArray(prefs.children_arrangement) ? prefs.children_arrangement : [prefs.children_arrangement]);
          if (prefs.housing_preference) setHousingPreference(Array.isArray(prefs.housing_preference) ? prefs.housing_preference : [prefs.housing_preference]);
          if (prefs.financial_arrangement) setFinancialArrangement(Array.isArray(prefs.financial_arrangement) ? prefs.financial_arrangement : [prefs.financial_arrangement]);
          if (prefs.dealbreakers) setDealbreakers(Array.isArray(prefs.dealbreakers) ? prefs.dealbreakers : [prefs.dealbreakers]);
          if (prefs.must_haves) setMustHaves(Array.isArray(prefs.must_haves) ? prefs.must_haves : [prefs.must_haves]);

          // Lifestyle preferences
          if (prefs.lifestyle_preferences) {
            if (prefs.lifestyle_preferences.smoking) setSmoking(prefs.lifestyle_preferences.smoking);
            if (prefs.lifestyle_preferences.drinking) setDrinking(prefs.lifestyle_preferences.drinking);
            if (prefs.lifestyle_preferences.pets) setPets(prefs.lifestyle_preferences.pets);
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  // Toggle functions for multi-select fields
  const togglePrimaryReason = (value: string) => {
    if (primaryReason.includes(value)) {
      setPrimaryReason(primaryReason.filter(item => item !== value));
    } else {
      setPrimaryReason([...primaryReason, value]);
    }
  };

  const toggleChildrenArrangement = (value: string) => {
    if (childrenArrangement.includes(value)) {
      setChildrenArrangement(childrenArrangement.filter(item => item !== value));
    } else {
      setChildrenArrangement([...childrenArrangement, value]);
    }
  };

  const toggleHousingPreference = (value: string) => {
    if (housingPreference.includes(value)) {
      setHousingPreference(housingPreference.filter(item => item !== value));
    } else {
      setHousingPreference([...housingPreference, value]);
    }
  };

  const toggleFinancialArrangement = (value: string) => {
    if (financialArrangement.includes(value)) {
      setFinancialArrangement(financialArrangement.filter(item => item !== value));
    } else {
      setFinancialArrangement([...financialArrangement, value]);
    }
  };

  const handleContinue = async () => {
    if (primaryReason.length === 0) {
      Alert.alert('Required', 'Please select at least one reason');
      return;
    }

    if (!relationshipType) {
      Alert.alert('Required', 'Please select your preferred relationship type');
      return;
    }

    if (wantsChildren === undefined) {
      Alert.alert('Required', 'Please indicate your preference about children');
      return;
    }

    if (housingPreference.length === 0) {
      Alert.alert('Required', 'Please select at least one housing preference');
      return;
    }

    if (financialArrangement.length === 0) {
      Alert.alert('Required', 'Please select at least one financial arrangement preference');
      return;
    }

    if (!profileId) {
      Alert.alert('Error', 'Profile not found. Please start over.');
      return;
    }

    try {
      setLoading(true);

      // Create or update preferences
      const lifestylePreferences: any = {};
      if (smoking) lifestylePreferences.smoking = smoking;
      if (drinking) lifestylePreferences.drinking = drinking;
      if (pets) lifestylePreferences.pets = pets;

      const { error } = await supabase
        .from('preferences')
        .upsert({
          profile_id: profileId,
          primary_reasons: primaryReason.length > 0 ? primaryReason : null,
          primary_reason: primaryReason.length > 0 ? primaryReason[0] : null, // Keep legacy column for backward compat
          relationship_type: relationshipType,
          wants_children: wantsChildren,
          children_arrangement: childrenArrangement.length > 0 ? childrenArrangement : null,
          housing_preference: housingPreference.length > 0 ? housingPreference : null,
          financial_arrangement: financialArrangement.length > 0 ? financialArrangement : null,
          lifestyle_preferences: Object.keys(lifestylePreferences).length > 0 ? lifestylePreferences : null,
          dealbreakers: dealbreakers.length > 0 ? dealbreakers : null,
          must_haves: mustHaves.length > 0 ? mustHaves : null,
        }, {
          onConflict: 'profile_id'
        });

      if (error) throw error;

      // Update onboarding step
      await supabase
        .from('profiles')
        .update({ onboarding_step: 7 })
        .eq('id', profileId);

      router.push('/(onboarding)/matching-preferences');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-6 pb-8" style={{ paddingTop: Platform.OS === 'android' ? 8 : 64 }}>
        {/* Progress */}
        <View className="mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-gray-600 font-medium">Step 7 of 8</Text>
            <Text className="text-sm text-lavender-500 font-bold">88%</Text>
          </View>
          <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-3 bg-lavender-500 rounded-full"
              style={{ width: '88%' }}
            />
          </View>
        </View>

        {/* Header */}
        <View className="mb-8">
          <Text className="text-4xl font-bold text-gray-900 mb-3">
            Marriage Goals 💍
          </Text>
          <Text className="text-gray-600 text-lg">
            What are you looking for in this partnership?
          </Text>
        </View>

        {/* Form */}
        <View className="space-y-8">
          {/* Primary Reason - Multi-select */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Reasons for seeking a lavender marriage?
            </Text>
            <Text className="text-xs text-gray-500 mb-2">Select all that apply</Text>
            <View className="space-y-2">
              {PRIMARY_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.value}
                  className={`px-4 py-3 rounded-xl border ${
                    primaryReason.includes(reason.value)
                      ? 'bg-lavender-50 border-lavender-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => togglePrimaryReason(reason.value)}
                >
                  <Text
                    className={`${
                      primaryReason.includes(reason.value)
                        ? 'text-lavender-500 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {primaryReason.length > 0 && (
              <Text className="text-xs text-lavender-500 mt-2">
                Selected: {primaryReason.map(val => PRIMARY_REASONS.find(r => r.value === val)?.label).join(', ')}
              </Text>
            )}
          </View>

          {/* Relationship Type */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Preferred relationship dynamic?
            </Text>
            <View className="space-y-2">
              {RELATIONSHIP_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  className={`px-4 py-3 rounded-xl border ${
                    relationshipType === type.value
                      ? 'bg-lavender-50 border-lavender-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setRelationshipType(type.value)}
                >
                  <Text
                    className={`${
                      relationshipType === type.value
                        ? 'text-lavender-500 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Children */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Do you want children?
            </Text>
            <View className="flex-row gap-2">
              {CHILDREN_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={String(option.value)}
                  className={`flex-1 px-4 py-3 rounded-xl border ${
                    wantsChildren === option.value
                      ? 'bg-lavender-50 border-lavender-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setWantsChildren(option.value)}
                >
                  <Text
                    className={`text-center ${
                      wantsChildren === option.value
                        ? 'text-lavender-500 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Housing */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Living arrangement preference?
            </Text>
            <Text className="text-xs text-gray-500 mb-2">Select all that you're open to</Text>
            <View className="space-y-2">
              {HOUSING_PREFERENCES.map((pref) => (
                <TouchableOpacity
                  key={pref.value}
                  className={`px-4 py-3 rounded-xl border ${
                    housingPreference.includes(pref.value)
                      ? 'bg-lavender-50 border-lavender-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => toggleHousingPreference(pref.value)}
                >
                  <Text
                    className={`${
                      housingPreference.includes(pref.value)
                        ? 'text-lavender-500 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    {pref.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {housingPreference.length > 0 && (
              <Text className="text-xs text-lavender-500 mt-2">
                Selected: {housingPreference.map(val => HOUSING_PREFERENCES.find(p => p.value === val)?.label).join(', ')}
              </Text>
            )}
          </View>

          {/* Financial */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Financial arrangement preference?
            </Text>
            <Text className="text-xs text-gray-500 mb-2">Select all that you're open to</Text>
            <View className="space-y-2">
              {FINANCIAL_ARRANGEMENTS.map((arr) => (
                <TouchableOpacity
                  key={arr.value}
                  className={`px-4 py-3 rounded-xl border ${
                    financialArrangement.includes(arr.value)
                      ? 'bg-lavender-50 border-lavender-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => toggleFinancialArrangement(arr.value)}
                >
                  <Text
                    className={`${
                      financialArrangement.includes(arr.value)
                        ? 'text-lavender-500 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    {arr.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {financialArrangement.length > 0 && (
              <Text className="text-xs text-lavender-500 mt-2">
                Selected: {financialArrangement.map(val => FINANCIAL_ARRANGEMENTS.find(a => a.value === val)?.label).join(', ')}
              </Text>
            )}
          </View>

          {/* Children Arrangement - only show if wants children */}
          {wantsChildren === true && (
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-3">
                How would you like to have children? (optional)
              </Text>
              <Text className="text-xs text-gray-500 mb-2">Select all that you're open to</Text>
              <View className="space-y-2">
                {CHILDREN_ARRANGEMENTS.map((arr) => (
                  <TouchableOpacity
                    key={arr.value}
                    className={`px-4 py-3 rounded-xl border ${
                      childrenArrangement.includes(arr.value)
                        ? 'bg-lavender-50 border-lavender-500'
                        : 'bg-white border-gray-300'
                    }`}
                    onPress={() => toggleChildrenArrangement(arr.value)}
                  >
                    <Text
                      className={`${
                        childrenArrangement.includes(arr.value)
                          ? 'text-lavender-500 font-semibold'
                          : 'text-gray-700'
                      }`}
                    >
                      {arr.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {childrenArrangement.length > 0 && (
                <Text className="text-xs text-lavender-500 mt-2">
                  Selected: {childrenArrangement.map(val => CHILDREN_ARRANGEMENTS.find(a => a.value === val)?.label).join(', ')}
                </Text>
              )}
            </View>
          )}

          {/* Lifestyle Preferences */}
          <View>
            <Text className="text-lg font-bold text-gray-900 mb-4">
              Lifestyle Preferences
            </Text>

            {/* Smoking */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-3">
                Smoking (optional)
              </Text>
              <View className="space-y-2">
                {SMOKING_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    className={`px-4 py-3 rounded-xl border ${
                      smoking === option.value
                        ? 'bg-lavender-50 border-lavender-500'
                        : 'bg-white border-gray-300'
                    }`}
                    onPress={() => setSmoking(option.value)}
                  >
                    <Text
                      className={`${
                        smoking === option.value
                          ? 'text-lavender-500 font-semibold'
                          : 'text-gray-700'
                      }`}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Drinking */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-3">
                Drinking (optional)
              </Text>
              <View className="space-y-2">
                {DRINKING_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    className={`px-4 py-3 rounded-xl border ${
                      drinking === option.value
                        ? 'bg-lavender-50 border-lavender-500'
                        : 'bg-white border-gray-300'
                    }`}
                    onPress={() => setDrinking(option.value)}
                  >
                    <Text
                      className={`${
                        drinking === option.value
                          ? 'text-lavender-500 font-semibold'
                          : 'text-gray-700'
                      }`}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Pets */}
            <View className="mb-4">
              <Text className="text-sm font-medium text-gray-700 mb-3">
                Pets (optional)
              </Text>
              <View className="space-y-2">
                {PETS_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    className={`px-4 py-3 rounded-xl border ${
                      pets === option.value
                        ? 'bg-lavender-50 border-lavender-500'
                        : 'bg-white border-gray-300'
                    }`}
                    onPress={() => setPets(option.value)}
                  >
                    <Text
                      className={`${
                        pets === option.value
                          ? 'text-lavender-500 font-semibold'
                          : 'text-gray-700'
                      }`}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Must-Haves */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Must-haves in a partner (optional)
            </Text>
            <View className="flex-row items-center gap-2 mb-2">
              <TextInput
                className="flex-1 border border-gray-300 rounded-lg px-4 py-3"
                placeholder="e.g., Good communication"
                value={newMustHave}
                onChangeText={setNewMustHave}
                onSubmitEditing={() => {
                  if (newMustHave.trim()) {
                    setMustHaves([...mustHaves, newMustHave.trim()]);
                    setNewMustHave('');
                  }
                }}
              />
              <TouchableOpacity
                className="bg-lavender-500 p-3 rounded-lg"
                onPress={() => {
                  if (newMustHave.trim()) {
                    setMustHaves([...mustHaves, newMustHave.trim()]);
                    setNewMustHave('');
                  }
                }}
              >
                <MaterialCommunityIcons name="plus" size={24} color="white" />
              </TouchableOpacity>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {mustHaves.map((item, index) => (
                <View key={index} className="bg-green-100 px-3 py-2 rounded-full flex-row items-center gap-2">
                  <Text className="text-green-800">{item}</Text>
                  <TouchableOpacity onPress={() => setMustHaves(mustHaves.filter((_, i) => i !== index))}>
                    <MaterialCommunityIcons name="close-circle" size={18} color="#166534" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          {/* Dealbreakers */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Dealbreakers (optional)
            </Text>
            <View className="flex-row items-center gap-2 mb-2">
              <TextInput
                className="flex-1 border border-gray-300 rounded-lg px-4 py-3"
                placeholder="e.g., Smoking"
                value={newDealbreaker}
                onChangeText={setNewDealbreaker}
                onSubmitEditing={() => {
                  if (newDealbreaker.trim()) {
                    setDealbreakers([...dealbreakers, newDealbreaker.trim()]);
                    setNewDealbreaker('');
                  }
                }}
              />
              <TouchableOpacity
                className="bg-lavender-500 p-3 rounded-lg"
                onPress={() => {
                  if (newDealbreaker.trim()) {
                    setDealbreakers([...dealbreakers, newDealbreaker.trim()]);
                    setNewDealbreaker('');
                  }
                }}
              >
                <MaterialCommunityIcons name="plus" size={24} color="white" />
              </TouchableOpacity>
            </View>
            <View className="flex-row flex-wrap gap-2">
              {dealbreakers.map((item, index) => (
                <View key={index} className="bg-red-100 px-3 py-2 rounded-full flex-row items-center gap-2">
                  <Text className="text-red-800">{item}</Text>
                  <TouchableOpacity onPress={() => setDealbreakers(dealbreakers.filter((_, i) => i !== index))}>
                    <MaterialCommunityIcons name="close-circle" size={18} color="#991B1B" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Buttons */}
        <View className="flex-row gap-3 mt-8">
          <TouchableOpacity
            className="flex-1 py-4 rounded-full border border-gray-300"
            onPress={() => goToPreviousOnboardingStep('/(onboarding)/marriage-preferences')}
            disabled={loading}
          >
            <Text className="text-gray-700 text-center font-semibold text-lg">{t('common.back')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-4 rounded-full ${
              loading || primaryReason.length === 0 || !relationshipType || wantsChildren === undefined || housingPreference.length === 0 || financialArrangement.length === 0
                ? 'bg-gray-400'
                : 'bg-lavender-500'
            }`}
            style={{
              borderRadius: 9999,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 16,
            }}
            onPress={handleContinue}
            disabled={loading || primaryReason.length === 0 || !relationshipType || wantsChildren === undefined || housingPreference.length === 0 || financialArrangement.length === 0}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {loading ? t('common.loading') : t('common.continue')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
