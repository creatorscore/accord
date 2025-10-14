import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

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

export default function MarriagePreferences() {
  const router = useRouter();
  const { user } = useAuth();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [primaryReason, setPrimaryReason] = useState('');
  const [relationshipType, setRelationshipType] = useState('');
  const [wantsChildren, setWantsChildren] = useState<boolean | null | undefined>(undefined);
  const [housingPreference, setHousingPreference] = useState('');
  const [financialArrangement, setFinancialArrangement] = useState('');

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

      if (error) throw error;
      setProfileId(data.id);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load profile');
    }
  };

  const handleContinue = async () => {
    if (!primaryReason) {
      Alert.alert('Required', 'Please select your primary reason');
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

    if (!housingPreference) {
      Alert.alert('Required', 'Please select your housing preference');
      return;
    }

    if (!financialArrangement) {
      Alert.alert('Required', 'Please select your financial arrangement preference');
      return;
    }

    if (!profileId) {
      Alert.alert('Error', 'Profile not found. Please start over.');
      return;
    }

    try {
      setLoading(true);

      // Create or update preferences
      const { error } = await supabase
        .from('preferences')
        .upsert({
          profile_id: profileId,
          primary_reason: primaryReason,
          relationship_type: relationshipType,
          wants_children: wantsChildren,
          housing_preference: housingPreference,
          financial_arrangement: financialArrangement,
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
      <View className="px-6 pt-16 pb-8">
        {/* Progress */}
        <View className="mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-gray-600 font-medium">Step 7 of 8</Text>
            <Text className="text-sm text-primary-600 font-bold">88%</Text>
          </View>
          <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-3 bg-primary-500 rounded-full"
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
          {/* Primary Reason */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Primary reason for seeking a lavender marriage?
            </Text>
            <View className="space-y-2">
              {PRIMARY_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.value}
                  className={`px-4 py-3 rounded-xl border ${
                    primaryReason === reason.value
                      ? 'bg-primary-50 border-primary-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setPrimaryReason(reason.value)}
                >
                  <Text
                    className={`${
                      primaryReason === reason.value
                        ? 'text-primary-700 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    {reason.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
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
                      ? 'bg-primary-50 border-primary-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setRelationshipType(type.value)}
                >
                  <Text
                    className={`${
                      relationshipType === type.value
                        ? 'text-primary-700 font-semibold'
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
                      ? 'bg-primary-50 border-primary-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setWantsChildren(option.value)}
                >
                  <Text
                    className={`text-center ${
                      wantsChildren === option.value
                        ? 'text-primary-700 font-semibold'
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
            <View className="space-y-2">
              {HOUSING_PREFERENCES.map((pref) => (
                <TouchableOpacity
                  key={pref.value}
                  className={`px-4 py-3 rounded-xl border ${
                    housingPreference === pref.value
                      ? 'bg-primary-50 border-primary-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setHousingPreference(pref.value)}
                >
                  <Text
                    className={`${
                      housingPreference === pref.value
                        ? 'text-primary-700 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    {pref.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Financial */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Financial arrangement preference?
            </Text>
            <View className="space-y-2">
              {FINANCIAL_ARRANGEMENTS.map((arr) => (
                <TouchableOpacity
                  key={arr.value}
                  className={`px-4 py-3 rounded-xl border ${
                    financialArrangement === arr.value
                      ? 'bg-primary-50 border-primary-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setFinancialArrangement(arr.value)}
                >
                  <Text
                    className={`${
                      financialArrangement === arr.value
                        ? 'text-primary-700 font-semibold'
                        : 'text-gray-700'
                    }`}
                  >
                    {arr.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Buttons */}
        <View className="flex-row gap-3 mt-8">
          <TouchableOpacity
            className="flex-1 py-4 rounded-full border border-gray-300"
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text className="text-gray-700 text-center font-semibold text-lg">Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-4 rounded-full ${
              loading || !primaryReason || !relationshipType || wantsChildren === undefined || !housingPreference || !financialArrangement
                ? 'bg-gray-400'
                : 'bg-primary-500'
            }`}
            onPress={handleContinue}
            disabled={loading || !primaryReason || !relationshipType || wantsChildren === undefined || !housingPreference || !financialArrangement}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {loading ? 'Saving...' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
