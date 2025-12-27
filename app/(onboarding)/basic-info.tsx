import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Platform, Modal, KeyboardAvoidingView, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';
import { GradientButton } from '@/components/shared/GradientButton';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { validateDisplayName, getModerationErrorMessage } from '@/lib/content-moderation';
import { initializeEncryption } from '@/lib/encryption';
import { getDeviceFingerprint } from '@/lib/device-fingerprint';
import { useTranslation } from 'react-i18next';
import DateTimePicker from '@react-native-community/datetimepicker';
import { trackUserAction, trackFunnel } from '@/lib/analytics';

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

// Calculate date limits for DOB picker (18-100 years old)
const today = new Date();
const maxBirthDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate()); // Must be at least 18
const minBirthDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate()); // Max 100 years old

export default function BasicInfo() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [gender, setGender] = useState<string[]>([]);
  const [pronouns, setPronouns] = useState('');
  const [ethnicity, setEthnicity] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<string[]>([]);
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [locationCountry, setLocationCountry] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<Array<{ city: string; state: string; country: string; latitude: number; longitude: number }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [ageCertified, setAgeCertified] = useState(false);
  // GPS location is now required - no manual mode allowed

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

  // Toggle functions for multi-select fields
  const toggleGender = (g: string) => {
    if (gender.includes(g)) {
      setGender(gender.filter(item => item !== g));
    } else {
      setGender([...gender, g]);
    }
  };

  const toggleEthnicity = (e: string) => {
    if (ethnicity.includes(e)) {
      setEthnicity(ethnicity.filter(item => item !== e));
    } else {
      setEthnicity([...ethnicity, e]);
    }
  };

  const toggleOrientation = (o: string) => {
    if (orientation.includes(o)) {
      setOrientation(orientation.filter(item => item !== o));
    } else {
      setOrientation([...orientation, o]);
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
          setBirthDate(new Date(profile.birth_date));
        }
        if (profile.gender) setGender(Array.isArray(profile.gender) ? profile.gender : [profile.gender]);
        if (profile.pronouns) setPronouns(profile.pronouns);
        if (profile.ethnicity) setEthnicity(Array.isArray(profile.ethnicity) ? profile.ethnicity : [profile.ethnicity]);
        if (profile.sexual_orientation) setOrientation(Array.isArray(profile.sexual_orientation) ? profile.sexual_orientation : [profile.sexual_orientation]);
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

  const handleGetLocation = async () => {
    try {
      setGettingLocation(true);

      // Request foreground location permissions
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        if (canAskAgain) {
          Alert.alert(
            'Permission Denied',
            'Location access is needed to find matches near you. Please grant location permission.'
          );
        } else {
          Alert.alert(
            'Location Permission Required',
            'Accord needs precise location to find matches nearby. Please enable location in your device Settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: async () => {
                  try {
                    // Try to open location settings directly (Android)
                    if (Platform.OS === 'android') {
                      await Location.enableNetworkProviderAsync();
                    } else {
                      // On iOS, open app settings
                      await Linking.openSettings();
                    }
                  } catch (error) {
                    // Fallback: open app settings if enableNetworkProviderAsync fails
                    console.log('Could not open location settings, opening app settings instead');
                    await Linking.openSettings().catch(err => {
                      console.error('Error opening settings:', err);
                    });
                  }
                }
              },
            ]
          );
        }
        return;
      }

      // Request HIGHEST accuracy for precise GPS coordinates
      // This is critical for accurate distance calculations in dating apps
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest, // Use highest accuracy (GPS)
        timeInterval: 5000,
        distanceInterval: 0,
      });

      console.log('📍 Location accuracy:', location.coords.accuracy, 'meters');
      console.log('📍 Coordinates:', location.coords.latitude, location.coords.longitude);

      // Check if we got accurate coordinates (iOS can return approximate)
      if (!location.coords || (location.coords.accuracy !== null && location.coords.accuracy > 100)) {
        Alert.alert(
          'Precise Location Required',
          `Location accuracy is too low (${Math.round(location.coords?.accuracy || 0)} meters). Please enable "Precise Location" for Accord in your iPhone Settings:\n\n1. Open Settings\n2. Scroll to Accord\n3. Tap Location\n4. Enable "Precise Location"\n\nOr use the search feature to find your city instead.`,
          [
            { text: 'OK', style: 'cancel' }
          ]
        );
        // DO NOT store inaccurate coordinates - return early
        return;
      }

      // Store coordinates only if accuracy is good
      setLocationCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Reverse geocode to get city/state
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (address.city) setLocationCity(address.city);
      if (address.region) setLocationState(address.region);
      if (address.country) setLocationCountry(address.country);

      console.log('✅ Location captured:', {
        city: address.city,
        state: address.region,
        accuracy: location.coords.accuracy,
        coords: `${location.coords.latitude}, ${location.coords.longitude}`
      });
    } catch (error: any) {
      console.error('Location error:', error);
      Alert.alert(
        'Location Error',
        'Could not get your location. Please check your location settings or enter your location manually.',
        [{ text: 'OK' }]
      );
    } finally {
      setGettingLocation(false);
    }
  };

  // Debounce timer ref
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);

  // Request location permission on Android when user wants to search
  const requestLocationPermissionForSearch = async () => {
    if (Platform.OS === 'android' && !locationPermissionGranted) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationPermissionGranted(true);
        return true;
      } else {
        Alert.alert(
          'Permission Required',
          'Location permission is needed to search for cities on Android. You can also use "Get My Location" button instead.',
          [{ text: 'OK' }]
        );
        return false;
      }
    }
    return true; // iOS doesn't need permission for geocoding
  };

  const handleLocationSearch = async (searchText: string) => {
    setLocationSearch(searchText);

    // Clear previous suggestions if search is too short
    if (searchText.trim().length < 2) {
      setLocationSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search by 400ms (faster for better UX)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setSearchingLocation(true);

        // Android requires location permission for geocoding - check if already granted
        if (Platform.OS === 'android' && !locationPermissionGranted) {
          const hasPermission = await requestLocationPermissionForSearch();
          if (!hasPermission) {
            setSearchingLocation(false);
            return;
          }
        }

        // Use expo-location geocoding to find the location
        const results = await Location.geocodeAsync(searchText);

        if (results.length > 0) {
          // Get address details for each result (limit to first 5)
          const suggestions = await Promise.all(
            results.slice(0, 5).map(async (result) => {
              try {
                const [address] = await Location.reverseGeocodeAsync({
                  latitude: result.latitude,
                  longitude: result.longitude,
                });

                // Extract city - try multiple fields as different countries use different conventions
                let city = address.city || address.district || address.subregion || address.name || '';
                let state = address.region || address.subregion || '';
                const country = address.country || '';

                // Handle countries with constituent countries/regions (UK, Spain, etc.)
                // These places have regions that are more like "states" than cities
                const constituentRegions = [
                  'Wales', 'Scotland', 'England', 'Northern Ireland', // UK
                  'Catalonia', 'Andalusia', 'Galicia', 'Basque Country', // Spain
                  'Bavaria', 'Saxony', 'Hesse', // Germany
                  'Lombardy', 'Tuscany', 'Sicily', 'Veneto', // Italy
                  'Queensland', 'Victoria', 'New South Wales', // Australia
                  'Ontario', 'Quebec', 'British Columbia', 'Alberta', // Canada
                ];

                // If city is a constituent region, use district/subregion as city instead
                if (constituentRegions.some(r => city.toLowerCase() === r.toLowerCase())) {
                  const originalCity = city;
                  city = address.district || address.subregion || address.name || '';
                  // If we still don't have a city, use the search term's first part
                  if (!city) {
                    city = searchText.split(',')[0].trim();
                  }
                  // Use the constituent region as the state
                  state = originalCity;
                }

                // If city is still empty, try to extract from name or use search term
                if (!city && address.name) {
                  city = address.name;
                }

                // For countries without states/regions (small countries), leave state empty
                // but ensure we have at least the country
                if (!state && city) {
                  // Some small countries don't have regions - that's okay
                  state = '';
                }

                return {
                  city: city,
                  state: state,
                  country: country,
                  latitude: result.latitude,
                  longitude: result.longitude,
                };
              } catch (error) {
                console.log('Reverse geocode failed:', error);
                return null;
              }
            })
          );

          // Filter out null results and results without a city
          const validSuggestions = suggestions.filter(
            (s): s is { city: string; state: string; country: string; latitude: number; longitude: number } =>
              s !== null && s.city !== ''
          );

          // Deduplicate by city+state+country combination
          const uniqueSuggestions = validSuggestions.filter((s, index, self) =>
            index === self.findIndex((t) =>
              t.city.toLowerCase() === s.city.toLowerCase() &&
              t.state.toLowerCase() === s.state.toLowerCase() &&
              t.country.toLowerCase() === s.country.toLowerCase()
            )
          );

          console.log('📍 Location suggestions:', uniqueSuggestions.length, 'results for:', searchText);
          setLocationSuggestions(uniqueSuggestions);
          setShowSuggestions(uniqueSuggestions.length > 0);
        } else {
          console.log('📍 No geocode results for:', searchText);
          setLocationSuggestions([]);
          setShowSuggestions(false);
        }
      } catch (error: any) {
        console.error('Location search error:', error);
        setLocationSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setSearchingLocation(false);
      }
    }, 400);
  };

  const selectLocation = (suggestion: { city: string; state: string; country: string; latitude: number; longitude: number }) => {
    setLocationCity(suggestion.city);
    setLocationState(suggestion.state);
    setLocationCountry(suggestion.country);
    setLocationCoords({
      latitude: suggestion.latitude,
      longitude: suggestion.longitude,
    });
    setLocationSearch(`${suggestion.city}, ${suggestion.state}`);
    setShowSuggestions(false);
    setLocationSuggestions([]);

    console.log('✅ Location selected:', {
      city: suggestion.city,
      state: suggestion.state,
      country: suggestion.country,
      coords: `${suggestion.latitude}, ${suggestion.longitude}`
    });
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

    const birthDateObj = new Date(birthDate as Date);
    const age = calculateAge(birthDateObj);
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

    if (gender.length === 0) {
      Alert.alert('Required', 'Please select at least one gender');
      return;
    }

    if (!pronouns) {
      Alert.alert('Required', 'Please select your pronouns');
      return;
    }

    if (orientation.length === 0) {
      Alert.alert('Required', 'Please select at least one sexual orientation');
      return;
    }

    // GPS location is required - no manual entry allowed
    if (!locationCoords) {
      Alert.alert(
        'Location Required',
        'Please use the "Get My Location" button to detect your location. GPS location is required for matching.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    if (!locationCity || !locationState) {
      Alert.alert(
        'Location Error',
        'We could not determine your city. Please try getting your location again.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    await proceedWithSave();
  };

  const proceedWithSave = async () => {
    try {
      setLoading(true);

      // Get the current user from Supabase session (more reliable than context)
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        throw new Error('Not authenticated. Please sign in again.');
      }

      // GPS coordinates are required and validated before reaching this point
      const coords = locationCoords;

      // Calculate age and zodiac sign from birth date
      const birthDateObj = new Date(birthDate as Date);
      const age = calculateAge(birthDateObj);
      const zodiac_sign = calculateZodiac(birthDateObj);

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

      // Get device fingerprint for ban evasion prevention
      let deviceFingerprint: string | null = null;
      try {
        deviceFingerprint = await getDeviceFingerprint();
        console.log('✅ Device fingerprint captured for ban prevention');
      } catch (fingerprintError) {
        console.error('⚠️ Failed to get device fingerprint:', fingerprintError);
        // Don't block onboarding if fingerprinting fails
      }

      // Create or update profile
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: currentUser.id,
          display_name: displayName,
          birth_date: birthDateObj.toISOString().split('T')[0], // Store as YYYY-MM-DD
          age, // Calculated age
          zodiac_sign, // Calculated zodiac
          gender: gender, // Always store as array (TEXT[])
          pronouns,
          ethnicity: ethnicity && ethnicity.length > 0 ? ethnicity : null, // Always store as array (TEXT[])
          sexual_orientation: orientation, // Always store as array (TEXT[])
          location_city: locationCity,
          location_state: locationState,
          location_country: locationCountry || null,
          latitude: coords?.latitude || null,
          longitude: coords?.longitude || null,
          encryption_public_key: encryptionPublicKey, // Store public key for E2E encryption
          device_id: deviceFingerprint, // Store device fingerprint for ban evasion prevention
          onboarding_step: 1,
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      // Track onboarding step completion
      trackUserAction.onboardingStepCompleted(1, 'basic-info');
      trackFunnel.onboardingStep1_BasicInfo();

      router.push('/(onboarding)/photos');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  // Ref for scrolling to location input
  const scrollViewRef = useRef<ScrollView>(null);
  const locationInputRef = useRef<View>(null);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      className="flex-1 bg-cream"
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView
        ref={scrollViewRef}
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 100 }}
      >
        <View className="px-6 pb-8" style={{ paddingTop: Platform.OS === 'android' ? 8 : 64 }}>
        {/* Progress */}
        <View className="mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-gray-600 font-medium">Step 1 of 8</Text>
            <Text className="text-sm text-lavender-400 font-bold">12%</Text>
          </View>
          <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-3 bg-lavender-400 rounded-full"
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
            <Text className="text-sm font-medium text-gray-700 mb-2">{t('onboarding.displayName')}</Text>
            <TextInput
              className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900"
              placeholder={t('onboarding.displayNamePlaceholder')}
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={50}
            />
          </View>

          {/* Birth Date */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">{t('onboarding.birthDate')}</Text>
            <TouchableOpacity
              className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 flex-row items-center justify-between"
              onPress={() => setShowDatePicker(true)}
            >
              <Text className={birthDate ? "text-gray-900" : "text-gray-500"}>
                {birthDate ? new Date(birthDate as Date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'Select your birth date'}
              </Text>
              <MaterialCommunityIcons name="calendar" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            {birthDate && (
              <Text className="text-xs text-gray-600 mt-1">
                Age: {calculateAge(new Date(birthDate as Date))} • {calculateZodiac(new Date(birthDate as Date))}
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
                ageCertified ? 'bg-lavender-500 border-lavender-500' : 'bg-white border-gray-300'
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

          {/* Calendar Date Picker - Platform specific */}
          {Platform.OS === 'ios' ? (
            // iOS: Use Modal with inline spinner
            <Modal
              visible={showDatePicker}
              transparent
              animationType="slide"
              onRequestClose={() => setShowDatePicker(false)}
            >
              <View className="flex-1 bg-black/50 justify-end">
                <View className="bg-white rounded-t-3xl p-6 pb-8">
                  {/* Header */}
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-2xl font-bold text-gray-900">Select Birth Date</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <MaterialCommunityIcons name="close" size={28} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <Text className="text-sm text-gray-500 mb-4">
                    You must be at least 18 years old to use Accord
                  </Text>

                  {/* Calendar Date Picker */}
                  <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 8 }}>
                    <DateTimePicker
                      mode="date"
                      value={birthDate || maxBirthDate}
                      onChange={(event, selectedDate) => {
                        if (selectedDate) {
                          setBirthDate(selectedDate);
                        }
                      }}
                      maximumDate={maxBirthDate}
                      minimumDate={minBirthDate}
                      display="spinner"
                      themeVariant="light"
                    />
                  </View>

                  {/* Confirm Button */}
                  <TouchableOpacity
                    className={`rounded-full py-4 items-center mt-4 ${
                      birthDate ? 'bg-lavender-500' : 'bg-gray-300'
                    }`}
                    onPress={() => setShowDatePicker(false)}
                    disabled={!birthDate}
                  >
                    <Text className="text-white font-bold text-lg">
                      {birthDate ? 'Confirm' : 'Select a date'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </Modal>
          ) : (
            // Android: Use spinner date picker for easier year selection
            showDatePicker && (
              <DateTimePicker
                mode="date"
                value={birthDate || maxBirthDate}
                onChange={(event, selectedDate) => {
                  // Fix: Delay closing to prevent "dialog not attached to Activity" error
                  // This gives Android time to properly dismiss the native dialog
                  setTimeout(() => {
                    setShowDatePicker(false);
                  }, 100);

                  if (event.type === 'set' && selectedDate) {
                    setBirthDate(selectedDate);
                  }
                }}
                maximumDate={maxBirthDate}
                minimumDate={minBirthDate}
                display="spinner"
              />
            )
          )}

          {/* Gender */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">{t('onboarding.gender')}</Text>
            <Text className="text-xs text-gray-500 mb-2">Select all that apply</Text>
            <View className="flex-row flex-wrap gap-2">
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g}
                  className={`px-4 py-2 rounded-full border ${
                    gender.includes(g)
                      ? 'bg-lavender-500 border-lavender-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => toggleGender(g)}
                >
                  <Text
                    className={`${
                      gender.includes(g) ? 'text-white' : 'text-gray-700'
                    } font-medium`}
                  >
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {gender.length > 0 && (
              <Text className="text-xs text-lavender-500 mt-2">
                Selected: {gender.join(', ')}
              </Text>
            )}
          </View>

          {/* Pronouns */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">{t('onboarding.pronouns')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {PRONOUNS.map((p) => (
                <TouchableOpacity
                  key={p}
                  className={`px-4 py-2 rounded-full border ${
                    pronouns === p
                      ? 'bg-lavender-500 border-lavender-500'
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
            <Text className="text-sm font-medium text-gray-700 mb-2">{t('onboarding.ethnicity')}</Text>
            <Text className="text-xs text-gray-500 mb-2">{t('onboarding.ethnicityHelp')}</Text>
            <View className="flex-row flex-wrap gap-2">
              {ETHNICITIES.map((e) => (
                <TouchableOpacity
                  key={e}
                  className={`px-4 py-2 rounded-full border ${
                    ethnicity.includes(e)
                      ? 'bg-lavender-500 border-lavender-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => toggleEthnicity(e)}
                >
                  <Text
                    className={`${
                      ethnicity.includes(e) ? 'text-white' : 'text-gray-700'
                    } font-medium`}
                  >
                    {e}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {ethnicity.length > 0 && (
              <Text className="text-xs text-lavender-500 mt-2">
                Selected: {ethnicity.join(', ')}
              </Text>
            )}
          </View>

          {/* Sexual Orientation */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">{t('onboarding.sexualOrientation')}</Text>
            <Text className="text-xs text-gray-500 mb-2">Select all that apply</Text>
            <View className="flex-row flex-wrap gap-2">
              {ORIENTATIONS.map((o) => (
                <TouchableOpacity
                  key={o}
                  className={`px-4 py-2 rounded-full border ${
                    orientation.includes(o)
                      ? 'bg-lavender-500 border-lavender-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => toggleOrientation(o)}
                >
                  <Text
                    className={`${
                      orientation.includes(o) ? 'text-white' : 'text-gray-700'
                    } font-medium`}
                  >
                    {o}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {orientation.length > 0 && (
              <Text className="text-xs text-lavender-500 mt-2">
                Selected: {orientation.join(', ')}
              </Text>
            )}
          </View>

          {/* Location - GPS Only (no manual entry) */}
          <View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-medium text-gray-700">{t('onboarding.location')}</Text>
            </View>

            {/* GPS Location Detection */}
            <View className="mb-3">
              {/* Get Location Button */}
              {!locationCity && !locationState ? (
                <TouchableOpacity
                  className={`bg-lavender-500 rounded-xl py-4 flex-row items-center justify-center ${gettingLocation ? 'opacity-70' : ''}`}
                  onPress={handleGetLocation}
                  disabled={gettingLocation}
                >
                  {gettingLocation ? (
                    <>
                      <MaterialCommunityIcons name="loading" size={24} color="white" />
                      <Text className="text-white font-semibold text-base ml-2">
                        {t('onboarding.gettingLocation')}
                      </Text>
                    </>
                  ) : (
                    <>
                      <MaterialCommunityIcons name="crosshairs-gps" size={24} color="white" />
                      <Text className="text-white font-semibold text-base ml-2">
                        {t('onboarding.useMyLocation')}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : (
                /* Show detected location with option to refresh */
                <View className="bg-lavender-50 border border-lavender-200 rounded-xl px-4 py-4">
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-lavender-100 items-center justify-center mr-3">
                      <MaterialCommunityIcons name="map-marker-check" size={24} color="#A08AB7" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-gray-900 font-semibold text-base">
                        {locationCity}{locationState ? `, ${locationState}` : ''}
                      </Text>
                      {locationCountry && (
                        <Text className="text-gray-500 text-sm">{locationCountry}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      className="ml-2 p-2"
                      onPress={handleGetLocation}
                      disabled={gettingLocation}
                    >
                      <MaterialCommunityIcons
                        name={gettingLocation ? "loading" : "refresh"}
                        size={22}
                        color="#A08AB7"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Info message */}
              <View className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mt-3">
                <View className="flex-row items-start">
                  <MaterialCommunityIcons name="shield-check" size={18} color="#2563EB" />
                  <Text className="text-xs text-blue-700 ml-2 flex-1">
                    Your location is detected via GPS to ensure accurate matching with nearby users. You cannot manually change your location.
                  </Text>
                </View>
              </View>
            </View>

            {/* Legacy: Selected Location Display (kept for backwards compatibility) */}
            {(locationCity || locationState || locationCountry) && false && (
              <View className="bg-lavender-50 border border-lavender-200 rounded-xl px-4 py-3 mt-3">
                <View className="flex-row items-center">
                  <MaterialCommunityIcons name="map-marker-check" size={20} color="#A08AB7" />
                  <View className="ml-3 flex-1">
                    <Text className="text-gray-900 font-semibold">
                      {locationCity}
                      {locationState && `, ${locationState}`}
                    </Text>
                    <Text className="text-gray-600 text-sm">
                      {locationCountry}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setLocationCity('');
                      setLocationState('');
                      setLocationCountry('');
                      setLocationCoords(null);
                      setLocationSearch('');
                    }}
                    className="ml-2"
                  >
                    <MaterialCommunityIcons name="close-circle" size={24} color="#A08AB7" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Continue Button */}
        <GradientButton
          title={loading ? t('common.loading') : t('common.continue')}
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
    </KeyboardAvoidingView>
  );
}
