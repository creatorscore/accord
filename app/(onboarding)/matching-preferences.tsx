import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';
import { goToPreviousOnboardingStep } from '@/lib/onboarding-navigation';
import { formatDistanceSlider, DistanceUnit } from '@/lib/distance-utils';
import { registerForPushNotifications, savePushToken, ensurePushTokenSaved } from '@/lib/notifications';
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
  // Get push token from NotificationContext (already registered on login)
  const { pushToken: contextPushToken, notificationsEnabled: contextNotificationsEnabled } = useNotifications();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [ageMin, setAgeMin] = useState(25);
  const [ageMax, setAgeMax] = useState(45);
  const [maxDistance, setMaxDistance] = useState(50);
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('miles');
  const [willingToRelocate, setWillingToRelocate] = useState(false);
  const [genderPreference, setGenderPreference] = useState<string[]>([]);
  // Use context values as initial state, allow local override if user enables here
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationToken, setNotificationToken] = useState<string | null>(null);

  // Sync with context on mount
  useEffect(() => {
    if (contextPushToken) {
      setNotificationToken(contextPushToken);
      setNotificationsEnabled(true);
      console.log('📱 Push token already available from context');
    }
  }, [contextPushToken]);

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
          .select('age_min, age_max, max_distance_miles, distance_unit, willing_to_relocate, gender_preference')
          .eq('profile_id', data.id)
          .single();

        if (prefsError && prefsError.code !== 'PGRST116') {
          console.error('Error loading preferences:', prefsError);
        }

        if (prefs) {
          // Pre-fill form with existing data
          if (prefs.age_min) setAgeMin(prefs.age_min);
          if (prefs.age_max) setAgeMax(prefs.age_max);
          if (prefs.max_distance_miles) setMaxDistance(prefs.max_distance_miles);
          if (prefs.distance_unit) setDistanceUnit(prefs.distance_unit);
          if (prefs.willing_to_relocate !== null && prefs.willing_to_relocate !== undefined) {
            setWillingToRelocate(prefs.willing_to_relocate);
          }
          if (prefs.gender_preference) {
            setGenderPreference(Array.isArray(prefs.gender_preference) ? prefs.gender_preference : [prefs.gender_preference]);
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const toggleGenderPreference = (gender: string) => {
    if (genderPreference.includes(gender)) {
      setGenderPreference(genderPreference.filter((g) => g !== gender));
    } else {
      setGenderPreference([...genderPreference, gender]);
    }
  };

  const handleEnableNotifications = async () => {
    try {
      const token = await registerForPushNotifications();
      if (token) {
        setNotificationToken(token);
        setNotificationsEnabled(true);
        Alert.alert(
          'Notifications Enabled! 🎉',
          'You\'ll now receive updates about matches, messages, and activity.'
        );
      } else {
        Alert.alert(
          'Notifications Not Available',
          'Notifications require a physical device. You can enable them later in Settings.'
        );
      }
    } catch (error: any) {
      console.error('Error enabling notifications:', error);
      Alert.alert(
        'Permission Denied',
        'Please enable notifications in your device settings to receive match alerts.'
      );
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

      // Verify user has at least 2 photos before completing profile
      const { data: photos, error: photosError } = await supabase
        .from('photos')
        .select('id')
        .eq('profile_id', profileId);

      if (photosError) throw photosError;

      if (!photos || photos.length < 2) {
        Alert.alert(
          'Photos Required',
          'Please add at least 2 photos to complete your profile.',
          [{ text: 'OK', onPress: () => router.push('/(onboarding)/add-photos') }]
        );
        setLoading(false);
        return;
      }

      // Update preferences
      const { error: prefsError } = await supabase
        .from('preferences')
        .update({
          age_min: ageMin,
          age_max: ageMax,
          max_distance_miles: maxDistance,
          distance_unit: distanceUnit,
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

      // ALWAYS try to save push token at end of onboarding
      // This is critical for Android users who might have skipped the notification prompt
      if (user?.id) {
        try {
          // First, try to use existing token (from context or local state)
          let tokenToSave = notificationToken || contextPushToken;

          // If no token exists, try to register one now
          if (!tokenToSave) {
            console.log('📱 No push token found, attempting to register...');
            tokenToSave = await registerForPushNotifications();
          }

          if (tokenToSave) {
            // Use ensurePushTokenSaved which handles both profiles and device_tokens tables
            const saved = await ensurePushTokenSaved(user.id, tokenToSave);
            if (saved) {
              console.log('✅ Push token saved after onboarding completion');
            } else {
              console.warn('⚠️ Push token save returned false - will retry via NotificationContext');
            }
          } else {
            console.log('📱 No push token available (user denied permissions or running in simulator)');
          }
        } catch (pushError) {
          console.warn('Push notification save failed:', pushError);
          // Don't block onboarding completion for push notification failures
        }
      }

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
      <View className="px-6 pb-8" style={{ paddingTop: Platform.OS === 'android' ? 8 : 64 }}>
        {/* Progress */}
        <View className="mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-gray-600 font-medium">Step 8 of 8</Text>
            <Text className="text-sm text-lavender-500 font-bold">100%</Text>
          </View>
          <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-3 bg-lavender-500 rounded-full"
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
                  minimumTrackTintColor="#A08AB7"
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
                  minimumTrackTintColor="#A08AB7"
                  maximumTrackTintColor="#D1D5DB"
                />
              </View>
            </View>
          </View>

          {/* Distance Unit Toggle */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Distance Unit
            </Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                className={`flex-1 py-3 rounded-xl border ${
                  distanceUnit === 'miles'
                    ? 'bg-lavender-500 border-lavender-500'
                    : 'bg-white border-gray-300'
                }`}
                onPress={() => setDistanceUnit('miles')}
              >
                <Text
                  className={`text-center font-medium ${
                    distanceUnit === 'miles' ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  Miles
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-3 rounded-xl border ${
                  distanceUnit === 'km'
                    ? 'bg-lavender-500 border-lavender-500'
                    : 'bg-white border-gray-300'
                }`}
                onPress={() => setDistanceUnit('km')}
              >
                <Text
                  className={`text-center font-medium ${
                    distanceUnit === 'km' ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  Kilometers
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Distance */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-3">
              Maximum Distance: {formatDistanceSlider(maxDistance, distanceUnit)}
            </Text>
            <Slider
              minimumValue={10}
              maximumValue={500}
              step={10}
              value={maxDistance}
              onValueChange={setMaxDistance}
              minimumTrackTintColor="#A08AB7"
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
                  willingToRelocate ? 'bg-lavender-500' : 'bg-gray-300'
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
                      ? 'bg-lavender-500 border-lavender-500'
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

          {/* Notification Permission */}
          <View className="mt-6">
            <View className={`border-2 rounded-2xl p-5 ${
              (notificationsEnabled || contextNotificationsEnabled) ? 'bg-lavender-50 border-lavender-500' : 'bg-gray-50 border-gray-300'
            }`}>
              <View className="flex-row items-center mb-3">
                <Text className="text-2xl mr-2">🔔</Text>
                <Text className="text-xl font-bold text-gray-900 flex-1">
                  Stay in the Loop
                </Text>
                {(notificationsEnabled || contextNotificationsEnabled) && (
                  <View className="bg-lavender-500 px-3 py-1 rounded-full">
                    <Text className="text-white text-xs font-bold">Enabled</Text>
                  </View>
                )}
              </View>
              <Text className="text-gray-700 mb-4 leading-6">
                Get instant alerts when you match, receive messages, or someone likes your profile. Don't miss your perfect match!
              </Text>
              {!(notificationsEnabled || contextNotificationsEnabled) ? (
                <TouchableOpacity
                  className="bg-lavender-500 py-4 rounded-xl"
                  onPress={handleEnableNotifications}
                >
                  <Text className="text-white text-center font-semibold text-base">
                    Enable Notifications
                  </Text>
                </TouchableOpacity>
              ) : (
                <View className="flex-row items-center justify-center py-2">
                  <Text className="text-lavender-700 font-semibold">✓ You're all set!</Text>
                </View>
              )}
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
            onPress={() => goToPreviousOnboardingStep('/(onboarding)/matching-preferences')}
            disabled={loading}
          >
            <Text className="text-gray-700 text-center font-semibold text-lg">Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-4 rounded-full ${
              loading || genderPreference.length === 0 ? 'bg-gray-400' : 'bg-lavender-500'
            }`}
            style={{
              borderRadius: 9999,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 16,
            }}
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
