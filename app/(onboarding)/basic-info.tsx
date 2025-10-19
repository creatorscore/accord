import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Platform, Modal } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';
import { GradientButton } from '@/components/shared/GradientButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { validateDisplayName, getModerationErrorMessage } from '@/lib/content-moderation';
import { initializeEncryption } from '@/lib/encryption';

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

const PRONOUNS = [
  'she/her',
  'he/him',
  'they/them',
  'she/they',
  'he/they',
  'any pronouns',
  'ask me',
  'prefer not to say',
];

const ETHNICITIES = [
  'Asian',
  'Black/African',
  'Hispanic/Latinx',
  'Indigenous/Native',
  'Middle Eastern/North African',
  'Pacific Islander',
  'South Asian',
  'White/Caucasian',
  'Multiracial',
  'Other',
  'Prefer not to say',
];

// Helper function to calculate age from birth date
function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Helper function to calculate zodiac sign from birth date
function calculateZodiac(birthDate: Date): string {
  const month = birthDate.getMonth() + 1; // JavaScript months are 0-indexed
  const day = birthDate.getDate();

  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius';
  return 'Pisces'; // Feb 19 - Mar 20
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => currentYear - 18 - i); // Start from 18 years ago

export default function BasicInfo() {
  const router = useRouter();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Individual date components for custom picker
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const [gender, setGender] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [ethnicity, setEthnicity] = useState('');
  const [orientation, setOrientation] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [locationCountry, setLocationCountry] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [ageCertified, setAgeCertified] = useState(false);

  // Check authentication and load existing data on mount
  useEffect(() => {
    checkAuth();
    loadExistingProfile();
  }, []);

  const checkAuth = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      Alert.alert('Not Authenticated', 'Please sign in to continue');
      router.replace('/(auth)/welcome');
    }
  };

  const loadExistingProfile = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('display_name, birth_date, gender, pronouns, ethnicity, sexual_orientation, location_city, location_state, location_country, latitude, longitude')
        .eq('user_id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (new user)
        console.error('Error loading profile:', error);
        return;
      }

      // Pre-fill form if data exists
      if (profile) {
        if (profile.display_name) setDisplayName(profile.display_name);
        if (profile.birth_date) {
          const date = new Date(profile.birth_date);
          setBirthDate(date);
          setSelectedMonth(date.getMonth());
          setSelectedDay(date.getDate());
          setSelectedYear(date.getFullYear());
        }
        if (profile.gender) setGender(profile.gender);
        if (profile.pronouns) setPronouns(profile.pronouns);
        if (profile.ethnicity) setEthnicity(profile.ethnicity);
        if (profile.sexual_orientation) setOrientation(profile.sexual_orientation);
        if (profile.location_city) setLocationCity(profile.location_city);
        if (profile.location_state) setLocationState(profile.location_state);
        if (profile.location_country) setLocationCountry(profile.location_country);
        if (profile.latitude && profile.longitude) {
          setLocationCoords({
            latitude: profile.latitude,
            longitude: profile.longitude
          });
        }
      }
    } catch (error) {
      console.error('Error loading existing profile:', error);
    }
  };

  const handleDateConfirm = () => {
    if (selectedMonth !== null && selectedDay !== null && selectedYear !== null) {
      const date = new Date(selectedYear, selectedMonth, selectedDay);
      setBirthDate(date);
      setShowDatePicker(false);
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

      // Store coordinates immediately
      setLocationCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address.city) setLocationCity(address.city);
      if (address.region) setLocationState(address.region);
      if (address.country) setLocationCountry(address.country);
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

    // Check for profanity in display name
    const nameModeration = validateDisplayName(displayName);
    if (!nameModeration.isClean) {
      Alert.alert('Inappropriate Content', getModerationErrorMessage('display name'));
      return;
    }

    if (!birthDate) {
      Alert.alert('Required', 'Please select your birth date');
      return;
    }

    const age = calculateAge(birthDate);
    if (age < 18) {
      Alert.alert('Age Requirement', 'You must be at least 18 years old to use Accord');
      return;
    }

    if (age > 100) {
      Alert.alert('Invalid Birth Date', 'Please enter a valid birth date');
      return;
    }

    if (!ageCertified) {
      Alert.alert('Age Certification Required', 'Please confirm that you are 18 years or older');
      return;
    }

    if (!gender) {
      Alert.alert('Required', 'Please select your gender');
      return;
    }

    if (!pronouns) {
      Alert.alert('Required', 'Please select your pronouns');
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

      // Use stored coordinates if available (from "Use my location"), otherwise geocode the city
      let coords = locationCoords;
      if (!coords) {
        try {
          const geocoded = await Location.geocodeAsync(`${locationCity}, ${locationState}`);
          coords = geocoded[0] ? {
            latitude: geocoded[0].latitude,
            longitude: geocoded[0].longitude
          } : null;
        } catch (geocodeError) {
          // Geocoding failed, but we can still save without coordinates
          console.warn('Geocoding failed:', geocodeError);
        }
      }

      // Calculate zodiac sign from birth date
      const zodiac_sign = calculateZodiac(birthDate);

      // Initialize encryption keys for this user
      // This generates a private key (stored securely on device) and public key (stored in DB)
      let encryptionPublicKey: string | null = null;
      try {
        encryptionPublicKey = await initializeEncryption(currentUser.id);
        console.log('✅ Encryption keys initialized successfully');
      } catch (encryptionError) {
        console.error('⚠️ Failed to initialize encryption keys:', encryptionError);
        // Don't block onboarding if encryption fails - user can still proceed
        // Encryption will be attempted again if needed when sending first message
      }

      // Create or update profile
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: currentUser.id,
          display_name: displayName,
          birth_date: birthDate.toISOString().split('T')[0], // Store as YYYY-MM-DD
          age, // Calculated age
          zodiac_sign, // Calculated zodiac
          gender,
          pronouns,
          ethnicity: ethnicity || null,
          sexual_orientation: orientation,
          location_city: locationCity,
          location_state: locationState,
          location_country: locationCountry || null,
          latitude: coords?.latitude || null,
          longitude: coords?.longitude || null,
          encryption_public_key: encryptionPublicKey, // Store public key for E2E encryption
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

          {/* Birth Date */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">Birth Date</Text>
            <TouchableOpacity
              className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 flex-row items-center justify-between"
              onPress={() => setShowDatePicker(true)}
            >
              <Text className={birthDate ? "text-gray-900" : "text-gray-500"}>
                {birthDate ? birthDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'Select your birth date'}
              </Text>
              <MaterialCommunityIcons name="calendar" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            {birthDate && (
              <Text className="text-xs text-gray-600 mt-1">
                Age: {calculateAge(birthDate)} • {calculateZodiac(birthDate)}
              </Text>
            )}
          </View>

          {/* Age Certification Checkbox */}
          {birthDate && (
            <TouchableOpacity
              className="flex-row items-start bg-purple-50 border-2 border-purple-200 rounded-xl p-4"
              onPress={() => setAgeCertified(!ageCertified)}
              activeOpacity={0.7}
            >
              <View className={`w-6 h-6 rounded-md border-2 mr-3 items-center justify-center ${
                ageCertified ? 'bg-primary-600 border-primary-600' : 'bg-white border-gray-300'
              }`}>
                {ageCertified && (
                  <MaterialCommunityIcons name="check" size={16} color="white" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 font-semibold mb-1">
                  I certify that I am 18 years of age or older
                </Text>
                <Text className="text-xs text-gray-600 leading-5">
                  By checking this box, you confirm that you meet the minimum age requirement to use Accord and agree to our Terms of Service.
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Custom Date Picker Modal */}
          <Modal
            visible={showDatePicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View className="flex-1 bg-black/50 justify-end">
              <View className="bg-white rounded-t-3xl p-6 pb-8">
                {/* Header */}
                <View className="flex-row items-center justify-between mb-6">
                  <Text className="text-2xl font-bold text-gray-900">Select Birth Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <MaterialCommunityIcons name="close" size={28} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* Date Selectors */}
                <View className="flex-row gap-3 mb-6">
                  {/* Month */}
                  <View className="flex-1">
                    <Text className="text-xs font-medium text-gray-600 mb-2">Month</Text>
                    <ScrollView className="max-h-48 bg-gray-50 rounded-xl border border-gray-200">
                      {MONTHS.map((month, index) => (
                        <TouchableOpacity
                          key={month}
                          className={`px-4 py-3 border-b border-gray-100 ${
                            selectedMonth === index ? 'bg-primary-100' : ''
                          }`}
                          onPress={() => setSelectedMonth(index)}
                        >
                          <Text className={`${
                            selectedMonth === index ? 'text-primary-600 font-bold' : 'text-gray-700'
                          }`}>
                            {month}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Day */}
                  <View className="w-20">
                    <Text className="text-xs font-medium text-gray-600 mb-2">Day</Text>
                    <ScrollView className="max-h-48 bg-gray-50 rounded-xl border border-gray-200">
                      {DAYS.map((day) => (
                        <TouchableOpacity
                          key={day}
                          className={`px-4 py-3 border-b border-gray-100 items-center ${
                            selectedDay === day ? 'bg-primary-100' : ''
                          }`}
                          onPress={() => setSelectedDay(day)}
                        >
                          <Text className={`${
                            selectedDay === day ? 'text-primary-600 font-bold' : 'text-gray-700'
                          }`}>
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Year */}
                  <View className="w-24">
                    <Text className="text-xs font-medium text-gray-600 mb-2">Year</Text>
                    <ScrollView className="max-h-48 bg-gray-50 rounded-xl border border-gray-200">
                      {YEARS.map((year) => (
                        <TouchableOpacity
                          key={year}
                          className={`px-4 py-3 border-b border-gray-100 items-center ${
                            selectedYear === year ? 'bg-primary-100' : ''
                          }`}
                          onPress={() => setSelectedYear(year)}
                        >
                          <Text className={`${
                            selectedYear === year ? 'text-primary-600 font-bold' : 'text-gray-700'
                          }`}>
                            {year}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                {/* Confirm Button */}
                <TouchableOpacity
                  className={`rounded-full py-4 items-center ${
                    selectedMonth !== null && selectedDay !== null && selectedYear !== null
                      ? 'bg-primary-600'
                      : 'bg-gray-300'
                  }`}
                  onPress={handleDateConfirm}
                  disabled={selectedMonth === null || selectedDay === null || selectedYear === null}
                >
                  <Text className="text-white font-bold text-lg">Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

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

          {/* Pronouns */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">Pronouns</Text>
            <View className="flex-row flex-wrap gap-2">
              {PRONOUNS.map((p) => (
                <TouchableOpacity
                  key={p}
                  className={`px-4 py-2 rounded-full border ${
                    pronouns === p
                      ? 'bg-primary-500 border-primary-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setPronouns(p)}
                >
                  <Text
                    className={`${
                      pronouns === p ? 'text-white' : 'text-gray-700'
                    } font-medium`}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Ethnicity */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">Ethnicity (Optional)</Text>
            <Text className="text-xs text-gray-500 mb-2">This helps find cultural connections. You can hide this later in settings.</Text>
            <View className="flex-row flex-wrap gap-2">
              {ETHNICITIES.map((e) => (
                <TouchableOpacity
                  key={e}
                  className={`px-4 py-2 rounded-full border ${
                    ethnicity === e
                      ? 'bg-primary-500 border-primary-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setEthnicity(e)}
                >
                  <Text
                    className={`${
                      ethnicity === e ? 'text-white' : 'text-gray-700'
                    } font-medium`}
                  >
                    {e}
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
                onChangeText={(text) => {
                  setLocationCity(text);
                  // Clear stored coordinates when user manually edits location
                  setLocationCoords(null);
                }}
              />
              <TextInput
                className="w-20 bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900"
                placeholder="State"
                value={locationState}
                onChangeText={(text) => {
                  setLocationState(text);
                  // Clear stored coordinates when user manually edits location
                  setLocationCoords(null);
                }}
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
