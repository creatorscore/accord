import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Platform, Modal, KeyboardAvoidingView, Pressable, InteractionManager } from 'react-native';
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
import { openAppSettings } from '@/lib/open-settings';
import { searchCities, CityResult } from '@/lib/city-search';
import { useToast } from '@/contexts/ToastContext';

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
  'Straight', // Note: Hidden for men-only users (filtered in getAvailableOrientations)
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

// Genders where "Straight" orientation is hidden (cis straight men not allowed on platform)
// Trans men CAN be straight - only cis men cannot
const CIS_MEN_GENDERS = ['Man'];

// Genders where "Lesbian" orientation doesn't apply (men, including trans men)
const MEN_GENDERS = ['Man', 'Trans Man'];

// Helper function to get available orientations based on gender
function getAvailableOrientations(selectedGender: string): string[] {
  let filtered = ORIENTATIONS;

  // Hide "Straight" for cis men only (straight cis men not allowed on platform)
  if (CIS_MEN_GENDERS.includes(selectedGender)) {
    filtered = filtered.filter(o => o !== 'Straight');
  }

  // Hide "Lesbian" for all men (cis and trans) - lesbian means women attracted to women
  if (MEN_GENDERS.includes(selectedGender)) {
    filtered = filtered.filter(o => o !== 'Lesbian');
  }

  return filtered;
}

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
  const { showToast } = useToast();
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [gender, setGender] = useState<string>('');
  const [pronouns, setPronouns] = useState('');
  const [ethnicity, setEthnicity] = useState<string[]>([]);
  const [orientation, setOrientation] = useState<string[]>([]);
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [locationCountry, setLocationCountry] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState<CityResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [ageCertified, setAgeCertified] = useState(false);
  const [hideLocation, setHideLocation] = useState(false); // Privacy option for high-risk countries
  const [showManualEntry, setShowManualEntry] = useState(false); // Fallback for GPS issues

  // Check authentication and load existing data on mount
  useEffect(() => {
    checkAuth();
    loadExistingProfile();
  }, []);

  const checkAuth = async () => {
    const { data: { user: currentUser } } = await supabase.auth.getUser();
    if (!currentUser) {
      showToast({ type: 'error', title: t('onboarding.errors.notAuthenticated'), message: t('onboarding.errors.pleaseSignIn') });
      router.replace('/(auth)/welcome');
    }
  };

  // Select gender (single choice only)
  const selectGender = (g: string) => {
    setGender(g);

    // Remove invalid orientations based on gender selection
    let newOrientation = orientation;

    // Remove "Straight" if cis man (straight cis men not allowed on platform)
    if (CIS_MEN_GENDERS.includes(g) && newOrientation.includes('Straight')) {
      newOrientation = newOrientation.filter(o => o !== 'Straight');
    }

    // Remove "Lesbian" if any male gender (lesbian means women attracted to women)
    if (MEN_GENDERS.includes(g) && newOrientation.includes('Lesbian')) {
      newOrientation = newOrientation.filter(o => o !== 'Lesbian');
    }

    if (newOrientation !== orientation) {
      setOrientation(newOrientation);
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
        .select('display_name, birth_date, gender, pronouns, ethnicity, sexual_orientation, location_city, location_state, location_country, latitude, longitude, hide_distance')
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
        if (profile.gender) setGender(Array.isArray(profile.gender) ? profile.gender[0] : profile.gender);
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
        if (profile.hide_distance !== undefined) setHideLocation(profile.hide_distance);
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
          showToast({ type: 'error', title: t('onboarding.errors.permissionDenied'), message: t('onboarding.errors.needLocationAccess') });
        } else {
          Alert.alert(
            t('onboarding.errors.permissionRequired'),
            t('onboarding.errors.enableInSettings'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              {
                text: t('onboarding.errors.openSettings'),
                onPress: () => openAppSettings()
              },
            ]
          );
        }
        return;
      }

      // Defer heavy location work to prevent ANR on low-end Android devices
      // This allows the UI to remain responsive while we get location
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });

      // Try to get location with multiple fallback strategies
      // This ensures location works in regions with restricted Google services (e.g., Iran, China)
      // OPTIMIZED: Reduced timeouts to prevent ANR on low-end devices
      let location: Location.LocationObject | null = null;

      try {
        // First: Try getLastKnownPositionAsync (instant, no GPS needed)
        // This often has a recent location cached and won't block
        console.log('📍 Checking for cached location...');
        const lastKnown = await Location.getLastKnownPositionAsync({
          maxAge: 60000, // Accept location up to 1 minute old
          requiredAccuracy: 1000, // Accept up to 1km accuracy
        });

        if (lastKnown && lastKnown.coords) {
          console.log('✅ Using cached location (instant)');
          location = lastKnown;
        }
      } catch (cachedError) {
        console.log('⚠️ No cached location available');
      }

      // If no cached location, try getting fresh location with reduced timeouts
      if (!location) {
        // Yield to main thread before heavy GPS work
        await new Promise(resolve => setTimeout(resolve, 50));

        try {
          // Second attempt: Try BALANCED accuracy first (faster than HIGHEST, good enough)
          console.log('📍 Attempting balanced-accuracy location...');
          location = await Promise.race([
            Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            }),
            // Reduced timeout: 5 seconds instead of 15
            new Promise<Location.LocationObject>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), 5000)
            )
          ]);
          console.log('✅ Balanced-accuracy location obtained');
        } catch (balancedError) {
          console.log('⚠️ Balanced accuracy failed, trying low accuracy...');

          // Yield to main thread between attempts
          await new Promise(resolve => setTimeout(resolve, 50));

          try {
            // Third attempt: Try LOW accuracy (network-only, fastest)
            location = await Promise.race([
              Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Low,
              }),
              // Reduced timeout: 3 seconds
              new Promise<Location.LocationObject>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 3000)
              )
            ]);
            console.log('✅ Low-accuracy location obtained');
          } catch (lowError) {
            console.log('⚠️ Low accuracy failed, final attempt with lowest...');

            // Final attempt: Lowest accuracy, shortest timeout
            location = await Promise.race([
              Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Lowest,
              }),
              new Promise<Location.LocationObject>((_, reject) =>
                setTimeout(() => reject(new Error('Timeout')), 2000)
              )
            ]);
            console.log('✅ Lowest-accuracy location obtained');
          }
        }
      }

      console.log('📍 Location accuracy:', location.coords.accuracy, 'meters');
      console.log('📍 Coordinates:', location.coords.latitude, location.coords.longitude);

      // Check if we got valid coordinates
      if (!location.coords) {
        throw new Error('No coordinates received');
      }

      // For iOS: Check if user has "Approximate Location" enabled (accuracy > 100m)
      // For Android in restricted regions: Accept lower accuracy (up to 1000m)
      if (Platform.OS === 'ios' && location.coords.accuracy !== null && location.coords.accuracy > 100) {
        showToast({ type: 'error', title: t('common.error'), message: t('toast.locationErrorPrecise') });
        // DO NOT store inaccurate coordinates on iOS - return early
        return;
      }

      // For Android: Accept up to 1km accuracy (important for restricted regions like Iran, China)
      if (Platform.OS === 'android' && location.coords.accuracy !== null && location.coords.accuracy > 1000) {
        Alert.alert(
          'Low Location Accuracy',
          `Location accuracy is very low (${Math.round(location.coords.accuracy / 1000)} km). This may affect match quality. Try:\n\n1. Move to an area with better GPS signal\n2. Enable "High accuracy" in Location settings\n3. Or manually enter your city`,
          [
            { text: 'Use Anyway', onPress: () => {
              // Continue with low accuracy location
            }},
            { text: 'Cancel', style: 'cancel', onPress: () => {
              return;
            }}
          ]
        );
      }

      // Store coordinates only if accuracy is good
      setLocationCoords({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Yield to main thread before geocoding to prevent ANR
      await new Promise(resolve => setTimeout(resolve, 50));

      // Reverse geocode to get city/state (with timeout to prevent blocking)
      const geocodeResult = await Promise.race([
        Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        }),
        // Timeout after 5 seconds
        new Promise<Location.LocationGeocodedAddress[]>((_, reject) =>
          setTimeout(() => reject(new Error('Geocode timeout')), 5000)
        )
      ]);
      const [address] = geocodeResult;

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
        // Use the constituent region as the state
        state = originalCity;
      }

      if (city) setLocationCity(city);
      if (state) setLocationState(state);
      if (country) setLocationCountry(country);

      console.log('✅ Location captured:', {
        city: city,
        state: state,
        accuracy: location.coords.accuracy,
        coords: `${location.coords.latitude}, ${location.coords.longitude}`
      });
    } catch (error: any) {
      console.error('Location error:', error);

      // Provide helpful error message based on error type
      let errorMessage = 'Could not get your location. ';

      if (error?.message?.includes('Timeout') || error?.code === 'E_TIMEOUT') {
        errorMessage += 'Location request timed out. This may happen if:\n\n• You\'re indoors without GPS signal\n• Location services are restricted in your region\n• Your device is in airplane mode\n\nPlease try:\n1. Move outdoors for better GPS signal\n2. Enable "High accuracy" in Location settings\n3. Or manually search for your city below';
      } else if (error?.code === 'E_LOCATION_SERVICES_DISABLED') {
        errorMessage += 'Location services are disabled. Please enable them in your device Settings.';
      } else if (error?.code === 'E_LOCATION_UNAVAILABLE') {
        errorMessage += 'GPS signal unavailable. Please try moving to an area with better signal, or manually search for your city below.';
      } else {
        errorMessage += 'Please check your location settings or manually search for your city below.';
      }

      showToast({ type: 'error', title: t('common.error'), message: t('toast.locationErrorGeneric') });
    } finally {
      setGettingLocation(false);
    }
  };

  // Debounce timer ref
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Handle city search using offline database
   * Works in ALL countries without needing GPS or Google services
   */
  const handleLocationSearch = (searchText: string) => {
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

    // Debounce search by 150ms (fast since it's offline)
    searchTimeoutRef.current = setTimeout(() => {
      setSearchingLocation(true);

      try {
        // Use offline city database - works everywhere, no permissions needed!
        const results = searchCities(searchText, 15);

        console.log('📍 City search:', results.length, 'results for:', searchText);
        setLocationSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch (error: any) {
        console.error('City search error:', error);
        setLocationSuggestions([]);
        setShowSuggestions(false);
      } finally {
        setSearchingLocation(false);
      }
    }, 150);
  };

  const selectLocation = (suggestion: CityResult) => {
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
      showToast({ type: 'error', title: t('onboarding.errors.required'), message: t('onboarding.errors.enterName') });
      return;
    }

    // Check for profanity in display name
    const nameModeration = validateDisplayName(displayName);
    if (!nameModeration.isClean) {
      showToast({ type: 'error', title: t('onboarding.errors.inappropriateContent'), message: getModerationErrorMessage('display name') });
      return;
    }

    if (!birthDate) {
      showToast({ type: 'error', title: t('onboarding.errors.required'), message: t('onboarding.errors.selectBirthDate') });
      return;
    }

    const birthDateObj = new Date(birthDate as Date);
    const age = calculateAge(birthDateObj);
    if (age < 18) {
      showToast({ type: 'error', title: t('onboarding.errors.ageRequirement'), message: t('onboarding.errors.mustBe18') });
      return;
    }

    if (age > 100) {
      showToast({ type: 'error', title: t('onboarding.errors.invalidBirthDate'), message: t('onboarding.errors.enterValidBirthDate') });
      return;
    }

    if (!ageCertified) {
      showToast({ type: 'error', title: t('onboarding.errors.ageCertRequired'), message: t('onboarding.errors.confirmAge18') });
      return;
    }

    if (!gender) {
      showToast({ type: 'error', title: t('onboarding.errors.required'), message: t('onboarding.errors.selectGender') });
      return;
    }

    if (!pronouns) {
      showToast({ type: 'error', title: t('onboarding.errors.required'), message: t('onboarding.errors.selectPronouns') });
      return;
    }

    if (orientation.length === 0) {
      showToast({ type: 'error', title: t('onboarding.errors.required'), message: t('onboarding.errors.selectOrientation') });
      return;
    }

    // Location validation: GPS is ALWAYS required for matching
    // Even if user hides exact location, we need it for distance-based filtering
    if (!locationCoords) {
      showToast({ type: 'error', title: t('onboarding.errors.locationRequired'), message: t('onboarding.errors.useLocationButton') });
      return;
    }

    if (!locationCity || !locationState) {
      showToast({ type: 'error', title: t('onboarding.errors.locationError'), message: t('onboarding.errors.couldNotDetermineCity') });
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
          gender: gender ? [gender] : [], // Store as single-element array (DB expects TEXT[])
          pronouns,
          ethnicity: ethnicity && ethnicity.length > 0 ? ethnicity : null, // Always store as array (TEXT[])
          sexual_orientation: orientation, // Always store as array (TEXT[])
          location_city: locationCity, // Always save location data
          location_state: locationState,
          location_country: locationCountry || null,
          latitude: coords?.latitude || null,
          longitude: coords?.longitude || null,
          hide_distance: hideLocation, // Privacy flag: if true, don't show exact distance to others
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
      showToast({ type: 'error', title: t('common.error'), message: error.message || t('toast.profileSaveError') });
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
      className="flex-1 bg-cream dark:bg-gray-900"
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
            <Text className="text-sm text-gray-600 dark:text-gray-300 font-medium">Step 1 of 8</Text>
            <Text className="text-sm text-lavender-400 dark:text-lavender-300 font-bold">12%</Text>
          </View>
          <View className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <View
              className="h-3 bg-lavender-400 rounded-full"
              style={{ width: '12%' }}
            />
          </View>
        </View>

        {/* Header */}
        <View className="mb-8 items-center">
          <Text className="text-5xl mb-4">💜</Text>
          <Text className="text-4xl font-bold text-charcoal dark:text-white mb-3 text-center">
            Let's get to know you
          </Text>
          <Text className="text-gray-600 dark:text-gray-300 text-lg text-center">
            First things first — the basics
          </Text>
        </View>

        {/* Form */}
        <View className="space-y-6">
          {/* Name */}
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{t('onboarding.displayName')}</Text>
            <TextInput
              className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 text-gray-900 dark:text-white"
              placeholder={t('onboarding.displayNamePlaceholder')}
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={50}
            />
          </View>

          {/* Birth Date */}
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{t('onboarding.birthDate')}</Text>
            <TouchableOpacity
              className="bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3 flex-row items-center justify-between"
              onPress={() => setShowDatePicker(true)}
            >
              <Text className={birthDate ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}>
                {birthDate ? new Date(birthDate as Date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'Select your birth date'}
              </Text>
              <MaterialCommunityIcons name="calendar" size={20} color="#9CA3AF" />
            </TouchableOpacity>
            {birthDate && (
              <Text className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Age: {calculateAge(new Date(birthDate as Date))} • {calculateZodiac(new Date(birthDate as Date))}
              </Text>
            )}
          </View>

          {/* Age Certification Checkbox */}
          {birthDate && (
            <TouchableOpacity
              className="flex-row items-start bg-purple-50 dark:bg-purple-900/30 border-2 border-purple-200 dark:border-purple-700 rounded-xl p-4"
              onPress={() => setAgeCertified(!ageCertified)}
              activeOpacity={0.7}
            >
              <View className={`w-6 h-6 rounded-md border-2 mr-3 items-center justify-center ${
                ageCertified ? 'bg-lavender-500 border-lavender-500' : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-500'
              }`}>
                {ageCertified && (
                  <MaterialCommunityIcons name="check" size={16} color="white" />
                )}
              </View>
              <View className="flex-1">
                <Text className="text-gray-900 dark:text-white font-semibold mb-1">
                  I certify that I am 18 years of age or older
                </Text>
                <Text className="text-xs text-gray-600 dark:text-gray-400 leading-5">
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
                <View className="bg-white dark:bg-gray-800 rounded-t-3xl p-6 pb-8">
                  {/* Header */}
                  <View className="flex-row items-center justify-between mb-4">
                    <Text className="text-2xl font-bold text-gray-900 dark:text-white">Select Birth Date</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <MaterialCommunityIcons name="close" size={28} color="#6B7280" />
                    </TouchableOpacity>
                  </View>

                  <Text className="text-sm text-gray-500 dark:text-gray-400 mb-4">
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
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{t('onboarding.gender')}</Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">Select one</Text>
            <View className="flex-row flex-wrap gap-2">
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g}
                  className={`px-4 py-2 rounded-full border ${
                    gender === g
                      ? 'bg-lavender-500 border-lavender-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => selectGender(g)}
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
            {gender && (
              <Text className="text-xs text-lavender-500 mt-2">
                Selected: {gender}
              </Text>
            )}
          </View>

          {/* Pronouns */}
          <View>
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{t('onboarding.pronouns')}</Text>
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
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{t('onboarding.ethnicity')}</Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('onboarding.ethnicityHelp')}</Text>
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
            <Text className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">{t('onboarding.sexualOrientation')}</Text>
            <Text className="text-xs text-gray-500 dark:text-gray-400 mb-2">Select all that apply</Text>
            <View className="flex-row flex-wrap gap-2">
              {getAvailableOrientations(gender).map((o) => (
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

          {/* Location - GPS with manual fallback */}
          <View>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-sm font-medium text-gray-700 dark:text-gray-200">{t('onboarding.location')}</Text>
            </View>

            {/* Privacy Toggle: Use Location vs Hide Exact Location */}
            <View className="mb-4">
              <View className="flex-row gap-3">
                {/* Use Precise Location Option */}
                <TouchableOpacity
                  className={`flex-1 border-2 rounded-xl p-4 ${
                    !hideLocation
                      ? 'bg-lavender-50 border-lavender-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setHideLocation(false)}
                >
                  <View className="flex-row items-center mb-2">
                    <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                      !hideLocation ? 'border-lavender-500' : 'border-gray-400'
                    }`}>
                      {!hideLocation && (
                        <View className="w-3 h-3 rounded-full bg-lavender-500" />
                      )}
                    </View>
                    <MaterialCommunityIcons
                      name="crosshairs-gps"
                      size={20}
                      color={!hideLocation ? "#A08AB7" : "#9CA3AF"}
                      style={{ marginLeft: 8 }}
                    />
                  </View>
                  <Text className={`font-semibold mb-1 ${
                    !hideLocation ? 'text-lavender-700' : 'text-gray-700'
                  }`}>
                    {t('onboarding.preciseLocation')}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {t('onboarding.preciseLocationDesc')}
                  </Text>
                </TouchableOpacity>

                {/* Hide Exact Location Option */}
                <TouchableOpacity
                  className={`flex-1 border-2 rounded-xl p-4 ${
                    hideLocation
                      ? 'bg-orange-50 border-orange-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setHideLocation(true)}
                >
                  <View className="flex-row items-center mb-2">
                    <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                      hideLocation ? 'border-orange-500' : 'border-gray-400'
                    }`}>
                      {hideLocation && (
                        <View className="w-3 h-3 rounded-full bg-orange-500" />
                      )}
                    </View>
                    <MaterialCommunityIcons
                      name="shield-lock"
                      size={20}
                      color={hideLocation ? "#F97316" : "#9CA3AF"}
                      style={{ marginLeft: 8 }}
                    />
                  </View>
                  <Text className={`font-semibold mb-1 ${
                    hideLocation ? 'text-orange-700' : 'text-gray-700'
                  }`}>
                    {t('onboarding.hideExactLocation')}
                  </Text>
                  <Text className="text-xs text-gray-500">
                    {t('onboarding.hideExactLocationDesc')}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Privacy Info for Hide Location */}
              {hideLocation && (
                <View className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mt-3">
                  <View className="flex-row items-start">
                    <MaterialCommunityIcons name="information" size={18} color="#F97316" />
                    <Text className="text-xs text-orange-700 ml-2 flex-1">
                      {t('onboarding.locationPrivacyInfo')}
                    </Text>
                  </View>
                </View>
              )}
            </View>

            {/* GPS Location Detection - with manual fallback */}
            <View className="mb-3">
              {/* Get Location Button */}
              {!locationCity && !locationState ? (
                <>
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

                  {/* Manual entry toggle - shows when GPS button is visible */}
                  <TouchableOpacity
                    className={`mt-3 py-3 px-4 rounded-xl border-2 flex-row items-center justify-center ${
                      showManualEntry
                        ? 'bg-gray-100 border-gray-300'
                        : 'bg-white border-lavender-300'
                    }`}
                    onPress={() => setShowManualEntry(!showManualEntry)}
                  >
                    <MaterialCommunityIcons
                      name={showManualEntry ? "chevron-up" : "magnify"}
                      size={20}
                      color={showManualEntry ? "#6B7280" : "#A08AB7"}
                    />
                    <Text className={`ml-2 font-medium ${
                      showManualEntry ? 'text-gray-600' : 'text-lavender-600'
                    }`}>
                      {showManualEntry ? 'Hide manual entry' : "Search for your city instead"}
                    </Text>
                  </TouchableOpacity>

                  {/* Manual city search input */}
                  {showManualEntry && (
                    <View className="mt-3">
                      <View className="relative">
                        <View className="flex-row items-center bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl px-4 py-3">
                          <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" />
                          <TextInput
                            className="flex-1 ml-2 text-gray-900 dark:text-white"
                            placeholder="Search for your city..."
                            placeholderTextColor="#9CA3AF"
                            value={locationSearch}
                            onChangeText={handleLocationSearch}
                            autoCapitalize="words"
                          />
                          {searchingLocation && (
                            <MaterialCommunityIcons name="loading" size={20} color="#A08AB7" />
                          )}
                        </View>

                        {/* Location suggestions dropdown */}
                        {showSuggestions && locationSuggestions.length > 0 && (
                          <View className="absolute top-full left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-xl mt-1 shadow-lg z-50">
                            {locationSuggestions.map((suggestion, index) => (
                              <TouchableOpacity
                                key={`${suggestion.city}-${suggestion.state}-${index}`}
                                className={`px-4 py-3 flex-row items-center ${
                                  index < locationSuggestions.length - 1 ? 'border-b border-gray-100 dark:border-gray-700' : ''
                                }`}
                                onPress={() => selectLocation(suggestion)}
                              >
                                <MaterialCommunityIcons name="map-marker" size={18} color="#A08AB7" />
                                <View className="ml-2 flex-1">
                                  <Text className="text-gray-900 dark:text-white font-medium">
                                    {suggestion.city}{suggestion.state ? `, ${suggestion.state}` : ''}
                                  </Text>
                                  <Text className="text-gray-500 dark:text-gray-400 text-xs">
                                    {suggestion.country}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                      </View>

                      <Text className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-center">
                        Search 150,000+ cities worldwide
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                /* Show detected location with option to refresh */
                <View className="bg-lavender-50 border border-lavender-200 rounded-xl px-4 py-4">
                  <View className="flex-row items-center">
                    <View className="w-10 h-10 rounded-full bg-lavender-100 items-center justify-center mr-3">
                      <MaterialCommunityIcons name="map-marker-check" size={24} color="#A08AB7" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-gray-900 dark:text-white font-semibold text-base">
                        {locationCity}{locationState ? `, ${locationState}` : ''}
                      </Text>
                      {locationCountry && (
                        <Text className="text-gray-500 dark:text-gray-400 text-sm">{locationCountry}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      className="ml-2 p-2"
                      onPress={() => {
                        // Clear location and show options again
                        setLocationCity('');
                        setLocationState('');
                        setLocationCountry('');
                        setLocationCoords(null);
                        setLocationSearch('');
                        setShowManualEntry(false);
                      }}
                    >
                      <MaterialCommunityIcons
                        name="close-circle"
                        size={22}
                        color="#9CA3AF"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Info message */}
              <View className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-xl px-4 py-3 mt-3">
                <View className="flex-row items-start">
                  <MaterialCommunityIcons name="shield-check" size={18} color="#2563EB" />
                  <Text className="text-xs text-blue-700 dark:text-blue-300 ml-2 flex-1">
                    {hideLocation
                      ? t('onboarding.locationUsedForMatching')
                      : t('onboarding.locationGPSInfo')
                    }
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
                    <Text className="text-gray-900 dark:text-white font-semibold">
                      {locationCity}
                      {locationState && `, ${locationState}`}
                    </Text>
                    <Text className="text-gray-600 dark:text-gray-400 text-sm">
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
        <Text className="text-sm text-gray-600 dark:text-gray-400 text-center mt-6 px-4">
          🔒 Your privacy is our priority. Only matched users can see your full profile.
        </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
