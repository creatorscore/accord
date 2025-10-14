import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';
import { GradientButton } from '@/components/shared/GradientButton';

const GENDERS = [
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

const ORIENTATIONS = [
  'Lesbian',
  'Gay',
  'Bisexual',
  'Straight',
  'Queer',
  'Asexual',
  'Pansexual',
  'Demisexual',
  'Questioning',
  'Omnisexual',
  'Polysexual',
  'Androsexual',
  'Gynesexual',
  'Sapiosexual',
  'Heteroflexible',
  'Homoflexible',
  'Prefer not to say',
  'Other',
];

export default function BasicInfo() {
  const router = useRouter();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('');
  const [orientation, setOrientation] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      Alert.alert('Not Authenticated', 'Please sign in to continue');
      router.replace('/(auth)/welcome');
    }
  };

  const handleGetLocation = async () => {
    try {
      setGettingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is needed to find matches near you.');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address.city) setLocationCity(address.city);
      if (address.region) setLocationState(address.region);
    } catch (error: any) {
      Alert.alert('Error', 'Could not get your location. Please enter it manually.');
    } finally {
      setGettingLocation(false);
    }
  };

  const handleContinue = async () => {
    // Validation
    if (!displayName.trim()) {
      Alert.alert('Required', 'Please enter your name');
      return;
    }

    const ageNum = parseInt(age);
    if (!ageNum || ageNum < 18 || ageNum > 100) {
      Alert.alert('Invalid Age', 'Please enter a valid age (18-100)');
      return;
    }

    if (!gender) {
      Alert.alert('Required', 'Please select your gender');
      return;
    }

    if (!orientation) {
      Alert.alert('Required', 'Please select your sexual orientation');
      return;
    }

    if (!locationCity || !locationState) {
      Alert.alert('Required', 'Please enter your location');
      return;
    }

    try {
      setLoading(true);

      // Get the current user from Supabase session (more reliable than context)
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        throw new Error('Not authenticated. Please sign in again.');
      }

      // Get coordinates for the city
      const geocoded = await Location.geocodeAsync(`${locationCity}, ${locationState}`);
      const coords = geocoded[0];

      // Create or update profile
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: currentUser.id,
          display_name: displayName,
          age: ageNum,
          gender,
          sexual_orientation: orientation,
          location_city: locationCity,
          location_state: locationState,
          location_country: 'US',
          latitude: coords?.latitude || null,
          longitude: coords?.longitude || null,
          onboarding_step: 1,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      router.push('/(onboarding)/photos');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-cream">
      <View className="px-6 pt-16 pb-8">
        {/* Progress */}
        <View className="mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-gray-600 font-medium">Step 1 of 8</Text>
            <Text className="text-sm text-accent-500 font-bold">12%</Text>
          </View>
          <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-3 bg-primary-400 rounded-full"
              style={{ width: '12%' }}
            />
          </View>
        </View>

        {/* Header */}
        <View className="mb-8 items-center">
          <Text className="text-5xl mb-4">💜</Text>
          <Text className="text-4xl font-bold text-charcoal mb-3 text-center">
            Let's get to know you
          </Text>
          <Text className="text-gray-600 text-lg text-center">
            First things first — the basics
          </Text>
        </View>

        {/* Form */}
        <View className="space-y-6">
          {/* Name */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">Display Name</Text>
            <TextInput
              className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900"
              placeholder="What should we call you?"
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={50}
            />
          </View>

          {/* Age */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">Age</Text>
            <TextInput
              className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900"
              placeholder="Your age"
              value={age}
              onChangeText={setAge}
              keyboardType="number-pad"
              maxLength={3}
            />
          </View>

          {/* Gender */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">Gender</Text>
            <View className="flex-row flex-wrap gap-2">
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g}
                  className={`px-4 py-2 rounded-full border ${
                    gender === g
                      ? 'bg-primary-500 border-primary-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setGender(g)}
                >
                  <Text
                    className={`${
                      gender === g ? 'text-white' : 'text-gray-700'
                    } font-medium`}
                  >
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Sexual Orientation */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">Sexual Orientation</Text>
            <View className="flex-row flex-wrap gap-2">
              {ORIENTATIONS.map((o) => (
                <TouchableOpacity
                  key={o}
                  className={`px-4 py-2 rounded-full border ${
                    orientation === o
                      ? 'bg-primary-500 border-primary-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setOrientation(o)}
                >
                  <Text
                    className={`${
                      orientation === o ? 'text-white' : 'text-gray-700'
                    } font-medium`}
                  >
                    {o}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Location */}
          <View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-medium text-gray-700">Location</Text>
              <TouchableOpacity onPress={handleGetLocation} disabled={gettingLocation}>
                <Text className="text-primary-600 font-medium">
                  {gettingLocation ? 'Getting location...' : 'Use my location'}
                </Text>
              </TouchableOpacity>
            </View>
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900"
                placeholder="City"
                value={locationCity}
                onChangeText={setLocationCity}
              />
              <TextInput
                className="w-20 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900"
                placeholder="State"
                value={locationState}
                onChangeText={setLocationState}
                maxLength={2}
                autoCapitalize="characters"
              />
            </View>
          </View>
        </View>

        {/* Continue Button */}
        <GradientButton
          title={loading ? 'Saving...' : 'Continue'}
          onPress={handleContinue}
          loading={loading}
          className="mt-8"
        />

        {/* Privacy Note */}
        <Text className="text-sm text-gray-600 text-center mt-6 px-4">
          🔒 Your privacy is our priority. Only matched users can see your full profile.
        </Text>
      </View>
    </ScrollView>
  );
}
