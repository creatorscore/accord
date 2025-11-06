import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Slider from '@react-native-community/slider';

const GENDER_OPTIONS = [
  'Man',
  'Woman',
  'Non-binary',
  'Trans Man',
  'Trans Woman',
  'Genderfluid',
  'Genderqueer',
  'Agender',
  'Bigender',
  'Two-Spirit',
  'Intersex',
  'Demigender',
  'Neutrois',
  'Questioning',
  'Prefer not to say',
  'Other',
];

export default function MatchingPreferences() {
  const router = useRouter();
  const { user } = useAuth();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [ageMin, setAgeMin] = useState(25);
  const [ageMax, setAgeMax] = useState(45);
  const [maxDistance, setMaxDistance] = useState(50);
  const [willingToRelocate, setWillingToRelocate] = useState(false);
  const [genderPreference, setGenderPreference] = useState<string[]>([]);

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

  const toggleGenderPreference = (gender: string) => {
    if (genderPreference.includes(gender)) {
      setGenderPreference(genderPreference.filter((g) => g !== gender));
    } else {
      setGenderPreference([...genderPreference, gender]);
    }
  };

  const handleFinish = async () => {
    if (genderPreference.length === 0) {
      Alert.alert('Required', 'Please select at least one gender preference');
      return;
    }

    if (!profileId) {
      Alert.alert('Error', 'Profile not found. Please start over.');
      return;
    }

    try {
      setLoading(true);

      // Update preferences
      const { error: prefsError } = await supabase
        .from('preferences')
        .update({
          age_min: ageMin,
          age_max: ageMax,
          max_distance_miles: maxDistance,
          willing_to_relocate: willingToRelocate,
          gender_preference: genderPreference,
        })
        .eq('profile_id', profileId);

      if (prefsError) throw prefsError;

      // Mark profile as complete
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          profile_complete: true,
          onboarding_step: 8,
        })
        .eq('id', profileId);

      if (profileError) throw profileError;

      // Navigate to main app
      router.replace('/(tabs)/discover');
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
            <Text className="text-sm text-gray-600 font-medium">Step 8 of 8</Text>
            <Text className="text-sm text-primary-500 font-bold">100%</Text>
          </View>
          <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-3 bg-primary-500 rounded-full"
              style={{ width: '100%' }}
            />
          </View>
        </View>

        {/* Header */}
        <View className="mb-8">
          <Text className="text-4xl font-bold text-gray-900 mb-3">
            Find your match 🔍
          </Text>
          <Text className="text-gray-600 text-lg">
            Set your preferences to find compatible partners
          </Text>
        </View>

        {/* Form */}
        <View className="space-y-8">
          {/* Age Range */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Age Range: {ageMin} - {ageMax}
            </Text>
            <View className="space-y-4">
              <View>
                <Text className="text-xs text-gray-600 mb-2">Minimum Age: {ageMin}</Text>
                <Slider
                  minimumValue={18}
                  maximumValue={80}
                  step={1}
                  value={ageMin}
                  onValueChange={setAgeMin}
                  minimumTrackTintColor="#9B87CE"
                  maximumTrackTintColor="#D1D5DB"
                />
              </View>
              <View>
                <Text className="text-xs text-gray-600 mb-2">Maximum Age: {ageMax}</Text>
                <Slider
                  minimumValue={18}
                  maximumValue={80}
                  step={1}
                  value={ageMax}
                  onValueChange={setAgeMax}
                  minimumTrackTintColor="#9B87CE"
                  maximumTrackTintColor="#D1D5DB"
                />
              </View>
            </View>
          </View>

          {/* Distance */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Maximum Distance: {maxDistance} miles
            </Text>
            <Slider
              minimumValue={10}
              maximumValue={500}
              step={10}
              value={maxDistance}
              onValueChange={setMaxDistance}
              minimumTrackTintColor="#9B87CE"
              maximumTrackTintColor="#D1D5DB"
            />
          </View>

          {/* Willing to Relocate */}
          <View>
            <TouchableOpacity
              className="flex-row items-center justify-between px-4 py-3 bg-gray-50 rounded-xl"
              onPress={() => setWillingToRelocate(!willingToRelocate)}
            >
              <Text className="text-gray-700 font-medium">
                Willing to relocate for the right match
              </Text>
              <View
                className={`w-12 h-7 rounded-full ${
                  willingToRelocate ? 'bg-primary-500' : 'bg-gray-300'
                }`}
              >
                <View
                  className={`w-5 h-5 rounded-full bg-white mt-1 ${
                    willingToRelocate ? 'ml-6' : 'ml-1'
                  }`}
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Gender Preference */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Interested in (select all that apply)
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {GENDER_OPTIONS.map((gender) => (
                <TouchableOpacity
                  key={gender}
                  className={`px-4 py-2 rounded-full border ${
                    genderPreference.includes(gender)
                      ? 'bg-primary-500 border-primary-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => toggleGenderPreference(gender)}
                >
                  <Text
                    className={`${
                      genderPreference.includes(gender)
                        ? 'text-white'
                        : 'text-gray-700'
                    } font-medium`}
                  >
                    {gender}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Success Message */}
        <View className="bg-green-50 border border-green-200 rounded-2xl p-4 my-8">
          <Text className="text-green-900 font-semibold mb-2">Almost There!</Text>
          <Text className="text-green-800 text-sm">
            You're all set to start finding compatible partners. You can always update your
            preferences later in Settings.
          </Text>
        </View>

        {/* Buttons */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 py-4 rounded-full border border-gray-300"
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text className="text-gray-700 text-center font-semibold text-lg">Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-4 rounded-full ${
              loading || genderPreference.length === 0 ? 'bg-gray-400' : 'bg-primary-500'
            }`}
            onPress={handleFinish}
            disabled={loading || genderPreference.length === 0}
          >
            <Text className="text-white text-center font-semibold text-lg">
              {loading ? 'Finishing...' : 'Start Matching!'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
