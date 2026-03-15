import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Platform, Modal, useColorScheme, StyleSheet, AppState } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';
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
import { InteractionManager } from 'react-native';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import OnboardingChips from '@/components/onboarding/OnboardingChips';
import VisibilityToggle from '@/components/onboarding/VisibilityToggle';
import { getGlobalStep } from '@/lib/onboarding-steps';
import { useOnboardingDraft } from '@/hooks/useOnboardingDraft';

interface BasicInfoDraft {
  displayName: string;
  birthDate: string | null; // ISO string
  ageCertified: boolean;
  gender: string;
  pronouns: string;
  orientation: string[];
  ethnicity: string[];
  locationCity: string;
  locationState: string;
  locationCountry: string;
  locationCoords: { latitude: number; longitude: number } | null;
  hideLocation: boolean;
  fieldVisibility: Record<string, boolean>;
  hometown: string;
  occupation: string;
  education: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GENDERS = ['Man', 'Woman', 'Non-binary'];

const ORIENTATIONS = [
  'Lesbian', 'Gay', 'Bisexual', 'Straight', 'Queer', 'Asexual',
  'Pansexual', 'Demisexual', 'Questioning', 'Omnisexual', 'Polysexual',
  'Androsexual', 'Gynesexual', 'Sapiosexual', 'Heteroflexible',
  'Homoflexible', 'Prefer not to say', 'Other',
];

const PRONOUNS = [
  'she/her', 'he/him', 'they/them', 'she/they',
  'he/they', 'any pronouns', 'ask me', 'prefer not to say',
];

const ETHNICITIES = [
  'Asian', 'Black/African', 'Hispanic/Latinx', 'Indigenous/Native',
  'Middle Eastern/North African', 'Pacific Islander', 'South Asian',
  'White/Caucasian', 'Multiracial', 'Other', 'Prefer not to say',
];

function getAvailableOrientations(selectedGender: string): string[] {
  let filtered = ORIENTATIONS;
  if (selectedGender === 'Man') {
    filtered = filtered.filter(o => o !== 'Straight' && o !== 'Lesbian');
  }
  return filtered;
}

function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
  return age;
}

function calculateZodiac(birthDate: Date): string {
  const month = birthDate.getMonth() + 1;
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
  return 'Pisces';
}

const today = new Date();
const maxBirthDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
const minBirthDate = new Date(today.getFullYear() - 100, today.getMonth(), today.getDate());

// ─── Sub-step definitions ────────────────────────────────────────────────────

const SUB_STEPS = [
  { key: 'name',        title: "What should we call you?",      subtitle: "This is how you'll appear on Accord." },
  { key: 'birthday',    title: "What's your date of birth?",     subtitle: "You must be 18 or older to use Accord." },
  { key: 'gender',      title: "Which gender best describes you?", subtitle: "We use broad categories so everyone gets seen by more people. You can share more about yourself in your profile." },
  { key: 'pronouns',    title: "What are your pronouns?",       subtitle: null },
  { key: 'orientation', title: "What's your orientation?",      subtitle: null },
  { key: 'ethnicity',   title: "What's your ethnicity?",        subtitle: "Select all that apply. This is optional." },
  { key: 'location',    title: "Where are you based?",          subtitle: "We use this to find people near you." },
  { key: 'hometown',    title: "Where are you from?",           subtitle: "Your hometown helps others connect with you." },
  { key: 'occupation',  title: "What do you do?",               subtitle: "Share your occupation or profession." },
  { key: 'education',   title: "Where did you study?",          subtitle: "Your school, university, or program." },
] as const;

// ─── Component ───────────────────────────────────────────────────────────────

export default function BasicInfo() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Label mappings for arrays defined outside the component
  const genderLabel = (value: string): string => {
    const map: Record<string, string> = {
      'Man': t('onboarding.genderOptions.man'),
      'Woman': t('onboarding.genderOptions.woman'),
      'Non-binary': t('onboarding.genderOptions.nonBinary'),
    };
    return map[value] || value;
  };

  const orientationLabel = (value: string): string => {
    const keyMap: Record<string, string> = {
      'Lesbian': 'lesbian', 'Gay': 'gay', 'Bisexual': 'bisexual', 'Straight': 'straight',
      'Queer': 'queer', 'Asexual': 'asexual', 'Pansexual': 'pansexual', 'Demisexual': 'demisexual',
      'Questioning': 'questioning', 'Omnisexual': 'omnisexual', 'Polysexual': 'polysexual',
      'Androsexual': 'androsexual', 'Gynesexual': 'gynesexual', 'Sapiosexual': 'sapiosexual',
      'Heteroflexible': 'heteroflexible', 'Homoflexible': 'homoflexible',
      'Prefer not to say': 'preferNotToSay', 'Other': 'other',
    };
    const key = keyMap[value];
    return key ? t(`onboarding.orientationOptions.${key}`) : value;
  };

  const pronounLabel = (value: string): string => {
    const keyMap: Record<string, string> = {
      'she/her': 'sheHer', 'he/him': 'heHim', 'they/them': 'theyThem',
      'she/they': 'sheThey', 'he/they': 'heThey', 'any pronouns': 'anyPronouns',
      'ask me': 'askMe', 'prefer not to say': 'preferNotToSay',
    };
    const key = keyMap[value];
    return key ? t(`onboarding.pronounOptions.${key}`) : value;
  };

  const ethnicityLabel = (value: string): string => {
    const keyMap: Record<string, string> = {
      'Asian': 'asian', 'Black/African': 'blackAfrican', 'Hispanic/Latinx': 'hispanicLatinx',
      'Indigenous/Native': 'indigenousNative', 'Middle Eastern/North African': 'middleEastern',
      'Pacific Islander': 'pacificIslander', 'South Asian': 'southAsian',
      'White/Caucasian': 'whiteCaucasian', 'Multiracial': 'multiracial',
      'Other': 'other', 'Prefer not to say': 'preferNotToSay',
    };
    const key = keyMap[value];
    return key ? t(`onboarding.ethnicityOptions.${key}`) : value;
  };

  const getStepTitles = (stepKey: string) => {
    const titles: Record<string, { title: string; subtitle?: string }> = {
      name: { title: t('onboarding.basicInfoSteps.nameTitle'), subtitle: t('onboarding.basicInfoSteps.nameSubtitle') },
      birthday: { title: t('onboarding.basicInfoSteps.birthdayTitle'), subtitle: t('onboarding.basicInfoSteps.birthdaySubtitle') },
      gender: { title: t('onboarding.basicInfoSteps.genderTitle'), subtitle: t('onboarding.basicInfoSteps.genderSubtitle') },
      pronouns: { title: t('onboarding.basicInfoSteps.pronounsTitle') },
      orientation: { title: t('onboarding.basicInfoSteps.orientationTitle') },
      ethnicity: { title: t('onboarding.basicInfoSteps.ethnicityTitle'), subtitle: t('onboarding.basicInfoSteps.ethnicitySubtitle') },
      location: { title: t('onboarding.basicInfoSteps.locationTitle'), subtitle: t('onboarding.basicInfoSteps.locationSubtitle') },
      hometown: { title: t('onboarding.basicInfoSteps.hometownTitle'), subtitle: t('onboarding.basicInfoSteps.hometownSubtitle') },
      occupation: { title: t('onboarding.basicInfoSteps.occupationTitle'), subtitle: t('onboarding.basicInfoSteps.occupationSubtitle') },
      education: { title: t('onboarding.basicInfoSteps.educationTitle'), subtitle: t('onboarding.basicInfoSteps.educationSubtitle') },
    };
    return titles[stepKey] || { title: '', subtitle: undefined };
  };

  // Sub-step navigation
  const [subStep, setSubStep] = useState(0);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | undefined>(undefined);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Dismiss DatePicker when app backgrounds to prevent RNCDatePicker crash
  // (Android Activity destruction causes "not attached to Activity" error)
  useEffect(() => {
    if (!showDatePicker || Platform.OS !== 'android') return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') setShowDatePicker(false);
    });
    return () => sub.remove();
  }, [showDatePicker]);
  const [ageCertified, setAgeCertified] = useState(false);
  const [gender, setGender] = useState('');
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
  const [hometown, setHometown] = useState('');
  const [occupation, setOccupation] = useState('');
  const [education, setEducation] = useState('');
  const [loading, setLoading] = useState(false);
  const [gettingLocation, setGettingLocation] = useState(false);
  const [hideLocation, setHideLocation] = useState(false);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [fieldVisibility, setFieldVisibility] = useState<Record<string, boolean>>({
    gender: true, sexual_orientation: true, ethnicity: true,
  });

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { loadDraft, saveDraft, clearDraft } = useOnboardingDraft<BasicInfoDraft>(user?.id, 'basic-info');

  // ─── Load existing profile ─────────────────────────────────────────────────

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

  const loadExistingProfile = async () => {
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) return;

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('display_name, birth_date, gender, pronouns, ethnicity, sexual_orientation, location_city, location_state, location_country, latitude, longitude, hide_distance, field_visibility, hometown, occupation, education')
        .eq('user_id', currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') return;

      if (profile) {
        if (profile.display_name) setDisplayName(profile.display_name);
        if (profile.birth_date) setBirthDate(new Date(profile.birth_date));
        if (profile.gender) setGender(Array.isArray(profile.gender) ? profile.gender[0] : profile.gender);
        if (profile.pronouns) setPronouns(profile.pronouns);
        if (profile.ethnicity) setEthnicity(Array.isArray(profile.ethnicity) ? profile.ethnicity : [profile.ethnicity]);
        if (profile.sexual_orientation) setOrientation(Array.isArray(profile.sexual_orientation) ? profile.sexual_orientation : [profile.sexual_orientation]);
        if (profile.location_city) setLocationCity(profile.location_city);
        if (profile.location_state) setLocationState(profile.location_state);
        if (profile.location_country) setLocationCountry(profile.location_country);
        if (profile.latitude && profile.longitude) setLocationCoords({ latitude: profile.latitude, longitude: profile.longitude });
        if (profile.hometown) setHometown(profile.hometown);
        if (profile.occupation) setOccupation(profile.occupation);
        if (profile.education) setEducation(profile.education);
        if (profile.hide_distance !== undefined) setHideLocation(profile.hide_distance);
        if (profile.field_visibility) {
          setFieldVisibility(prev => ({ ...prev, ...profile.field_visibility }));
        }
      }

      // Overlay draft on top of DB data (draft is more recent unsaved input)
      const draft = await loadDraft();
      if (draft) {
        const d = draft.data;
        if (d.displayName) setDisplayName(d.displayName);
        if (d.birthDate) setBirthDate(new Date(d.birthDate));
        if (d.ageCertified) setAgeCertified(d.ageCertified);
        if (d.gender) setGender(d.gender);
        if (d.pronouns) setPronouns(d.pronouns);
        if (d.orientation?.length) setOrientation(d.orientation);
        if (d.ethnicity?.length) setEthnicity(d.ethnicity);
        if (d.locationCity) setLocationCity(d.locationCity);
        if (d.locationState) setLocationState(d.locationState);
        if (d.locationCountry) setLocationCountry(d.locationCountry);
        if (d.locationCoords) setLocationCoords(d.locationCoords);
        if (d.hideLocation !== undefined) setHideLocation(d.hideLocation);
        if (d.hometown) setHometown(d.hometown);
        if (d.occupation) setOccupation(d.occupation);
        if (d.education) setEducation(d.education);
        if (d.fieldVisibility) setFieldVisibility(prev => ({ ...prev, ...d.fieldVisibility }));
        setSubStep(draft.subStep);
      }
    } catch (error) {
      console.error('Error loading existing profile:', error);
    }
  };

  // ─── Gender selection (clears invalid orientations) ────────────────────────

  const selectGender = (g: string) => {
    setGender(g);
    if (g === 'Man' && (orientation.includes('Straight') || orientation.includes('Lesbian'))) setOrientation([]);
  };

  // ─── Location helpers ──────────────────────────────────────────────────────

  const handleGetLocation = async () => {
    try {
      setGettingLocation(true);
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        if (canAskAgain) {
          showToast({ type: 'error', title: t('onboarding.errors.permissionDenied'), message: t('onboarding.errors.needLocationAccess') });
        } else {
          Alert.alert(t('onboarding.errors.permissionRequired'), t('onboarding.errors.enableInSettings'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('onboarding.errors.openSettings'), onPress: () => openAppSettings() },
          ]);
        }
        return;
      }

      await new Promise<void>(resolve => InteractionManager.runAfterInteractions(() => resolve()));

      let location: Location.LocationObject | null = null;

      try {
        const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 1000 });
        if (lastKnown?.coords) location = lastKnown;
      } catch {}

      if (!location) {
        await new Promise(resolve => setTimeout(resolve, 50));
        try {
          location = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise<Location.LocationObject>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000)),
          ]);
        } catch {
          await new Promise(resolve => setTimeout(resolve, 50));
          try {
            location = await Promise.race([
              Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low }),
              new Promise<Location.LocationObject>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 3000)),
            ]);
          } catch {
            location = await Promise.race([
              Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Lowest }),
              new Promise<Location.LocationObject>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)),
            ]);
          }
        }
      }

      if (!location?.coords) throw new Error('No coordinates received');

      if (Platform.OS === 'ios' && location.coords.accuracy !== null && location.coords.accuracy > 100) {
        showToast({ type: 'error', title: t('common.error'), message: t('toast.locationErrorPrecise') });
        return;
      }

      setLocationCoords({ latitude: location.coords.latitude, longitude: location.coords.longitude });
      await new Promise(resolve => setTimeout(resolve, 50));

      const geocodeResult = await Promise.race([
        Location.reverseGeocodeAsync({ latitude: location.coords.latitude, longitude: location.coords.longitude }),
        new Promise<Location.LocationGeocodedAddress[]>((_, reject) => setTimeout(() => reject(new Error('Geocode timeout')), 5000)),
      ]);
      const [address] = geocodeResult;

      let city = address.city || address.district || address.subregion || address.name || '';
      let state = address.region || address.subregion || '';
      const country = address.country || '';

      const constituentRegions = [
        'Wales', 'Scotland', 'England', 'Northern Ireland',
        'Catalonia', 'Andalusia', 'Galicia', 'Basque Country',
        'Bavaria', 'Saxony', 'Hesse',
        'Lombardy', 'Tuscany', 'Sicily', 'Veneto',
        'Queensland', 'Victoria', 'New South Wales',
        'Ontario', 'Quebec', 'British Columbia', 'Alberta',
      ];
      if (constituentRegions.some(r => city.toLowerCase() === r.toLowerCase())) {
        const originalCity = city;
        city = address.district || address.subregion || address.name || '';
        state = originalCity;
      }

      if (city) setLocationCity(city);
      if (state) setLocationState(state);
      if (country) setLocationCountry(country);
    } catch (error: any) {
      console.error('Location error:', error);
      showToast({ type: 'error', title: t('common.error'), message: t('toast.locationErrorGeneric') });
    } finally {
      setGettingLocation(false);
    }
  };

  const handleLocationSearch = (searchText: string) => {
    setLocationSearch(searchText);
    if (searchText.trim().length < 2) {
      setLocationSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchingLocation(true);
      try {
        const results = searchCities(searchText, 15);
        setLocationSuggestions(results);
        setShowSuggestions(results.length > 0);
      } catch {
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
    setLocationCoords({ latitude: suggestion.latitude, longitude: suggestion.longitude });
    setLocationSearch(`${suggestion.city}, ${suggestion.state}`);
    setShowSuggestions(false);
    setLocationSuggestions([]);
  };

  const clearLocation = () => {
    setLocationCity('');
    setLocationState('');
    setLocationCountry('');
    setLocationCoords(null);
    setLocationSearch('');
    setShowManualEntry(false);
  };

  // ─── Validation per sub-step ───────────────────────────────────────────────

  const canContinue = (): boolean => {
    switch (SUB_STEPS[subStep].key) {
      case 'name': return displayName.trim().length >= 2;
      case 'birthday': return !!birthDate && ageCertified && calculateAge(birthDate) >= 18;
      case 'gender': return !!gender;
      case 'pronouns': return !!pronouns;
      case 'orientation': return orientation.length > 0;
      case 'ethnicity': return true; // optional
      case 'location': return !!locationCoords && !!locationCity;
      case 'hometown': return hometown.trim().length >= 2;
      case 'occupation': return occupation.trim().length >= 2;
      case 'education': return education.trim().length >= 2;
      default: return false;
    }
  };

  // ─── Per-step validation with error messages ───────────────────────────────

  const validateCurrentStep = (): boolean => {
    switch (SUB_STEPS[subStep].key) {
      case 'name': {
        if (!displayName.trim()) {
          showToast({ type: 'error', title: t('onboarding.errors.required'), message: t('onboarding.errors.enterName') });
          return false;
        }
        const mod = validateDisplayName(displayName);
        if (!mod.isClean) {
          showToast({ type: 'error', title: t('onboarding.errors.inappropriateContent'), message: getModerationErrorMessage('display name') });
          return false;
        }
        return true;
      }
      case 'birthday': {
        if (!birthDate) {
          showToast({ type: 'error', title: t('onboarding.errors.required'), message: t('onboarding.errors.selectBirthDate') });
          return false;
        }
        const age = calculateAge(birthDate);
        if (age < 18) {
          showToast({ type: 'error', title: t('onboarding.errors.ageRequirement'), message: t('onboarding.errors.mustBe18') });
          return false;
        }
        if (!ageCertified) {
          showToast({ type: 'error', title: t('onboarding.errors.ageCertRequired'), message: t('onboarding.errors.confirmAge18') });
          return false;
        }
        return true;
      }
      case 'gender':
        if (!gender) { showToast({ type: 'error', title: t('onboarding.errors.required'), message: t('onboarding.errors.selectGender') }); return false; }
        return true;
      case 'pronouns':
        if (!pronouns) { showToast({ type: 'error', title: t('onboarding.errors.required'), message: t('onboarding.errors.selectPronouns') }); return false; }
        return true;
      case 'orientation':
        if (orientation.length === 0) { showToast({ type: 'error', title: t('onboarding.errors.required'), message: t('onboarding.errors.selectOrientation') }); return false; }
        return true;
      case 'ethnicity': return true;
      case 'location':
        if (!locationCoords) { showToast({ type: 'error', title: t('onboarding.errors.locationRequired'), message: t('onboarding.errors.useLocationButton') }); return false; }
        if (!locationCity || !locationState) { showToast({ type: 'error', title: t('onboarding.errors.locationError'), message: t('onboarding.errors.couldNotDetermineCity') }); return false; }
        return true;
      case 'hometown':
        if (hometown.trim().length < 2) { showToast({ type: 'error', title: t('onboarding.errors.required'), message: t('onboarding.additionalErrors.enterHometown') }); return false; }
        return true;
      case 'occupation':
        if (occupation.trim().length < 2) { showToast({ type: 'error', title: t('onboarding.errors.required'), message: t('onboarding.additionalErrors.enterOccupation') }); return false; }
        return true;
      case 'education':
        if (education.trim().length < 2) { showToast({ type: 'error', title: t('onboarding.errors.required'), message: t('onboarding.additionalErrors.enterEducation') }); return false; }
        return true;
      default: return true;
    }
  };

  // ─── Draft snapshot helper ─────────────────────────────────────────────────

  const buildDraftSnapshot = (): BasicInfoDraft => ({
    displayName,
    birthDate: birthDate ? birthDate.toISOString() : null,
    ageCertified,
    gender,
    pronouns,
    orientation,
    ethnicity,
    locationCity,
    locationState,
    locationCountry,
    locationCoords,
    hideLocation,
    fieldVisibility,
    hometown,
    occupation,
    education,
  });

  // ─── Navigation ────────────────────────────────────────────────────────────

  const handleContinue = async () => {
    if (!validateCurrentStep()) return;

    if (subStep < SUB_STEPS.length - 1) {
      const nextStep = subStep + 1;
      saveDraft(nextStep, buildDraftSnapshot());
      setSubStep(nextStep);
    } else {
      await saveProfile();
    }
  };

  const handleBack = () => {
    if (subStep > 0) {
      const prevStep = subStep - 1;
      saveDraft(prevStep, buildDraftSnapshot());
      setSubStep(prevStep);
    } else {
      // First step of first screen — sign out or go to auth
      router.replace('/(auth)/welcome');
    }
  };

  const handleSkip = () => {
    if (subStep < SUB_STEPS.length - 1) {
      const nextStep = subStep + 1;
      saveDraft(nextStep, buildDraftSnapshot());
      setSubStep(nextStep);
    }
  };

  // ─── Save ──────────────────────────────────────────────────────────────────

  const saveProfile = async () => {
    try {
      setLoading(true);
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      if (userError || !currentUser) throw new Error(t('onboarding.additionalErrors.notAuthenticatedMessage'));

      const birthDateObj = new Date(birthDate as Date);
      const age = calculateAge(birthDateObj);
      const zodiac_sign = calculateZodiac(birthDateObj);

      let encryptionPublicKey: string | null = null;
      try { encryptionPublicKey = await initializeEncryption(currentUser.id); } catch {}

      let deviceFingerprint: string | null = null;
      try { deviceFingerprint = await getDeviceFingerprint(); } catch {}

      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: currentUser.id,
          display_name: displayName,
          birth_date: birthDateObj.toISOString().split('T')[0],
          age,
          zodiac_sign,
          gender: gender ? [gender] : ['Other'],
          pronouns,
          ethnicity: ethnicity.length > 0 ? ethnicity : null,
          sexual_orientation: orientation.length > 0 ? orientation : ['Other'],
          location_city: locationCity,
          location_state: locationState,
          location_country: locationCountry || null,
          latitude: locationCoords?.latitude ?? null,
          longitude: locationCoords?.longitude ?? null,
          hide_distance: hideLocation,
          hometown: hometown.trim() || null,
          occupation: occupation.trim() || null,
          education: education.trim() || null,
          encryption_public_key: encryptionPublicKey,
          device_id: deviceFingerprint,
          field_visibility: fieldVisibility,
          preferred_language: i18n.language || 'en',
          onboarding_step: 1,
        }, { onConflict: 'user_id' });

      if (error) throw error;

      await clearDraft();
      trackUserAction.onboardingStepCompleted(1, 'basic-info');
      trackFunnel.onboardingStep1_BasicInfo();
      router.push('/(onboarding)/personality');
    } catch (error: any) {
      showToast({ type: 'error', title: t('common.error'), message: error.message || t('toast.profileSaveError') });
    } finally {
      setLoading(false);
    }
  };

  // ─── Render each sub-step ──────────────────────────────────────────────────

  const renderContent = () => {
    const step = SUB_STEPS[subStep];

    switch (step.key) {
      // ── Name ──────────────────────────────────────────────────────────────
      case 'name':
        return (
          <View>
            <TextInput
              style={[s.textInput, {
                backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA',
                color: isDark ? '#F5F5F7' : '#1A1A2E',
              }]}
              placeholder={t('onboarding.basicInfoSteps.namePlaceholder')}
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              value={displayName}
              onChangeText={setDisplayName}
              maxLength={50}
              autoFocus
            />
            <Text style={[s.hint, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
              {t('onboarding.basicInfoSteps.nameHint')}
            </Text>
          </View>
        );

      // ── Birthday ──────────────────────────────────────────────────────────
      case 'birthday':
        return (
          <View>
            <TouchableOpacity
              style={[s.dateButton, {
                backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA',
              }]}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={[s.dateButtonText, {
                color: birthDate ? (isDark ? '#F5F5F7' : '#1A1A2E') : (isDark ? '#6B7280' : '#9CA3AF'),
              }]}>
                {birthDate
                  ? birthDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                  : t('onboarding.basicInfoSteps.selectBirthDate')}
              </Text>
              <MaterialCommunityIcons name="calendar" size={22} color="#A08AB7" />
            </TouchableOpacity>

            {birthDate && (
              <Text style={[s.ageDisplay, { color: isDark ? '#A08AB7' : '#8B72A8' }]}>
                {calculateAge(birthDate)} years old  ·  {calculateZodiac(birthDate)}
              </Text>
            )}

            {/* Age certification */}
            {birthDate && (
              <TouchableOpacity
                style={[s.certifyRow, {
                  backgroundColor: isDark ? '#1A1628' : '#F5F0FA',
                }]}
                onPress={() => setAgeCertified(!ageCertified)}
                activeOpacity={0.7}
              >
                <View style={[s.checkbox, ageCertified && s.checkboxChecked]}>
                  {ageCertified && <MaterialCommunityIcons name="check" size={14} color="white" />}
                </View>
                <Text style={[s.certifyText, { color: isDark ? '#E5E7EB' : '#374151' }]}>
                  {t('onboarding.basicInfoSteps.ageCertification')}
                </Text>
              </TouchableOpacity>
            )}

            {/* Date picker */}
            {Platform.OS === 'ios' ? (
              <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
                <View style={s.modalOverlay}>
                  <View style={[s.modalSheet, { backgroundColor: isDark ? '#1C1C2E' : '#FFFFFF' }]}>
                    <View style={s.modalHeader}>
                      <Text style={[s.modalTitle, { color: isDark ? '#F5F5F7' : '#1A1A2E' }]}>{t('onboarding.basicInfoSteps.birthDateModalTitle')}</Text>
                      <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                        <MaterialCommunityIcons name="close" size={24} color={isDark ? '#9CA3AF' : '#6B7280'} />
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      mode="date"
                      value={birthDate || maxBirthDate}
                      onChange={(_, d) => { if (d) setBirthDate(d); }}
                      maximumDate={maxBirthDate}
                      minimumDate={minBirthDate}
                      display="spinner"
                      themeVariant={isDark ? 'dark' : 'light'}
                    />
                    <TouchableOpacity
                      style={[s.modalConfirm, !birthDate && { opacity: 0.5 }]}
                      onPress={() => setShowDatePicker(false)}
                      disabled={!birthDate}
                    >
                      <Text style={s.modalConfirmText}>{t('common.confirm')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Modal>
            ) : (
              showDatePicker && (
                <DateTimePicker
                  mode="date"
                  value={birthDate || maxBirthDate}
                  onChange={(event, d) => {
                    setShowDatePicker(false);
                    if (event.type === 'set' && d) setBirthDate(d);
                  }}
                  maximumDate={maxBirthDate}
                  minimumDate={minBirthDate}
                  display="spinner"
                />
              )
            )}
          </View>
        );

      // ── Gender ────────────────────────────────────────────────────────────
      case 'gender':
        return (
          <View>
            {GENDERS.map((g, i) => {
              const selected = gender === g;
              return (
                <TouchableOpacity
                  key={g}
                  style={{
                    paddingVertical: 16,
                    marginBottom: i < GENDERS.length - 1 ? 4 : 0,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onPress={() => selectGender(g)}
                  activeOpacity={0.7}
                >
                  <Text style={{ fontSize: 16, fontWeight: '500', color: selected ? '#A08AB7' : (isDark ? '#E5E7EB' : '#374151') }}>
                    {genderLabel(g)}
                  </Text>
                  {selected && (
                    <MaterialCommunityIcons name="check" size={22} color="#A08AB7" />
                  )}
                </TouchableOpacity>
              );
            })}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: isDark ? '#1C1C2E' : '#F3F0F8', borderRadius: 12 }}>
              <MaterialCommunityIcons name="information-outline" size={18} color="#A08AB7" style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: isDark ? '#D1D5DB' : '#6B7280' }}>
                {t('onboarding.basicInfoSteps.genderInfoText')}
              </Text>
            </View>
            <VisibilityToggle
              visible={fieldVisibility.gender !== false}
              onToggle={(v) => setFieldVisibility(prev => ({ ...prev, gender: v }))}
            />
          </View>
        );

      // ── Pronouns ──────────────────────────────────────────────────────────
      case 'pronouns':
        return (
          <OnboardingChips
            options={PRONOUNS.map(p => ({ label: pronounLabel(p), value: p }))}
            value={pronouns}
            onChange={setPronouns}
          />
        );

      // ── Orientation ───────────────────────────────────────────────────────
      case 'orientation':
        return (
          <View>
            <OnboardingChips
              options={getAvailableOrientations(gender).map(o => ({ label: orientationLabel(o), value: o }))}
              value={orientation[0] || ''}
              onChange={(v: string) => setOrientation(v ? [v] : [])}
            />
            <VisibilityToggle
              visible={fieldVisibility.sexual_orientation !== false}
              onToggle={(v) => setFieldVisibility(prev => ({ ...prev, sexual_orientation: v }))}
            />
          </View>
        );

      // ── Ethnicity ─────────────────────────────────────────────────────────
      case 'ethnicity':
        return (
          <View>
            <OnboardingChips
              options={ETHNICITIES.map(e => ({ label: ethnicityLabel(e), value: e }))}
              value={ethnicity}
              onChange={setEthnicity}
              multiSelect
            />
            <VisibilityToggle
              visible={fieldVisibility.ethnicity !== false}
              onToggle={(v) => setFieldVisibility(prev => ({ ...prev, ethnicity: v }))}
            />
          </View>
        );

      // ── Location ──────────────────────────────────────────────────────────
      case 'location':
        return (
          <View>
            {/* Privacy toggle */}
            <View style={s.privacyRow}>
              <TouchableOpacity
                style={[s.privacyOption, {
                  backgroundColor: !hideLocation ? (isDark ? '#1A1628' : '#F5F0FA') : (isDark ? '#1C1C2E' : '#F8F7FA'),
                }]}
                onPress={() => setHideLocation(false)}
              >
                <MaterialCommunityIcons name="crosshairs-gps" size={20} color={!hideLocation ? '#A08AB7' : '#9CA3AF'} />
                <Text style={[s.privacyOptionTitle, { color: isDark ? '#F5F5F7' : '#1A1A2E' }]}>{t('onboarding.locationStep.showDistance')}</Text>
                <Text style={[s.privacyOptionDesc, { color: isDark ? '#8E8E93' : '#71717A' }]}>{t('onboarding.locationStep.showDistanceDesc')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.privacyOption, {
                  backgroundColor: hideLocation ? (isDark ? '#1A1628' : '#F5F0FA') : (isDark ? '#1C1C2E' : '#F8F7FA'),
                }]}
                onPress={() => setHideLocation(true)}
              >
                <MaterialCommunityIcons name="shield-lock" size={20} color={hideLocation ? '#A08AB7' : '#9CA3AF'} />
                <Text style={[s.privacyOptionTitle, { color: isDark ? '#F5F5F7' : '#1A1A2E' }]}>{t('onboarding.locationStep.hideDistance')}</Text>
                <Text style={[s.privacyOptionDesc, { color: isDark ? '#8E8E93' : '#71717A' }]}>{t('onboarding.locationStep.hideDistanceDesc')}</Text>
              </TouchableOpacity>
            </View>

            {/* Location result or input */}
            {locationCity && locationState ? (
              <View style={[s.locationResult, {
                backgroundColor: isDark ? '#1A1628' : '#F5F0FA',
              }]}>
                <MaterialCommunityIcons name="map-marker-check" size={24} color="#A08AB7" />
                <View style={s.locationResultText}>
                  <Text style={[s.locationCity, { color: isDark ? '#F5F5F7' : '#1A1A2E' }]}>
                    {locationCity}, {locationState}
                  </Text>
                  {locationCountry ? <Text style={[s.locationCountry, { color: isDark ? '#8E8E93' : '#71717A' }]}>{locationCountry}</Text> : null}
                </View>
                <TouchableOpacity onPress={clearLocation}>
                  <MaterialCommunityIcons name="close-circle" size={22} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            ) : (
              <View>
                {/* GPS button */}
                <TouchableOpacity
                  style={[s.gpsButton, gettingLocation && { opacity: 0.7 }]}
                  onPress={handleGetLocation}
                  disabled={gettingLocation}
                >
                  <MaterialCommunityIcons name={gettingLocation ? 'loading' : 'crosshairs-gps'} size={22} color="white" />
                  <Text style={s.gpsButtonText}>
                    {gettingLocation ? t('onboarding.gettingLocation') : t('onboarding.useMyLocation')}
                  </Text>
                </TouchableOpacity>

                {/* Manual search toggle */}
                <TouchableOpacity
                  style={s.manualToggle}
                  onPress={() => setShowManualEntry(!showManualEntry)}
                >
                  <Text style={[s.manualToggleText, { color: '#A08AB7' }]}>
                    {showManualEntry ? t('onboarding.locationStep.hideSearch') : t('onboarding.locationStep.searchForCity')}
                  </Text>
                </TouchableOpacity>

                {/* Manual search input */}
                {showManualEntry && (
                  <View style={{ marginTop: 12 }}>
                    <View style={[s.searchInput, {
                      backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA',
                    }]}>
                      <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" />
                      <TextInput
                        style={[s.searchInputField, { color: isDark ? '#F5F5F7' : '#1A1A2E' }]}
                        placeholder={t('onboarding.locationStep.searchPlaceholder')}
                        placeholderTextColor="#9CA3AF"
                        value={locationSearch}
                        onChangeText={handleLocationSearch}
                        autoCapitalize="words"
                      />
                    </View>

                    {showSuggestions && locationSuggestions.length > 0 && (
                      <View style={[s.suggestions, {
                        backgroundColor: isDark ? '#1C1C2E' : '#FFFFFF',
                      }]}>
                        {locationSuggestions.map((sug, i) => (
                          <TouchableOpacity
                            key={`${sug.city}-${sug.state}-${i}`}
                            style={s.suggestionRow}
                            onPress={() => selectLocation(sug)}
                          >
                            <MaterialCommunityIcons name="map-marker" size={18} color="#A08AB7" />
                            <View style={{ marginLeft: 8, flex: 1 }}>
                              <Text style={{ color: isDark ? '#F5F5F7' : '#1A1A2E', fontWeight: '500' }}>
                                {sug.city}{sug.state ? `, ${sug.state}` : ''}
                              </Text>
                              <Text style={{ color: isDark ? '#6B7280' : '#9CA3AF', fontSize: 12 }}>{sug.country}</Text>
                            </View>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
          </View>
        );

      // ── Hometown ──────────────────────────────────────────────────────────
      case 'hometown':
        return (
          <View>
            <TextInput
              style={[s.textInput, {
                backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA',
                color: isDark ? '#F5F5F7' : '#1A1A2E',
              }]}
              placeholder={t('onboarding.basicInfoSteps.hometownPlaceholder')}
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              value={hometown}
              onChangeText={setHometown}
              maxLength={100}
              autoFocus
            />
            <Text style={[s.hint, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
              {t('onboarding.basicInfoSteps.hometownHint')}
            </Text>
          </View>
        );

      // ── Occupation ─────────────────────────────────────────────────────────
      case 'occupation':
        return (
          <View>
            <TextInput
              style={[s.textInput, {
                backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA',
                color: isDark ? '#F5F5F7' : '#1A1A2E',
              }]}
              placeholder={t('onboarding.basicInfoSteps.occupationPlaceholder')}
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              value={occupation}
              onChangeText={setOccupation}
              maxLength={100}
              autoFocus
            />
          </View>
        );

      // ── Education ──────────────────────────────────────────────────────────
      case 'education':
        return (
          <View>
            <TextInput
              style={[s.textInput, {
                backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA',
                color: isDark ? '#F5F5F7' : '#1A1A2E',
              }]}
              placeholder={t('onboarding.basicInfoSteps.educationPlaceholder')}
              placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
              value={education}
              onChangeText={setEducation}
              maxLength={100}
              autoFocus
            />
          </View>
        );

      default:
        return null;
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  const step = SUB_STEPS[subStep];
  const isOptional = step.key === 'ethnicity';
  const stepTitles = getStepTitles(step.key);

  return (
    <OnboardingLayout
      currentStep={getGlobalStep('basic-info', subStep)}
      title={stepTitles.title}
      subtitle={stepTitles.subtitle}
      onBack={handleBack}
      onContinue={handleContinue}
      onSkip={undefined}
      continueDisabled={!canContinue()}
      continueLabel={subStep === SUB_STEPS.length - 1 && loading ? t('common.saving') : t('common.continue')}
    >
      {renderContent()}
    </OnboardingLayout>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  textInput: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 18,
    fontWeight: '500',
  },
  hint: {
    fontSize: 13,
    marginTop: 10,
  },
  dateButton: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateButtonText: {
    fontSize: 17,
    fontWeight: '500',
  },
  ageDisplay: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 12,
  },
  certifyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D5CDE2',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#A08AB7',
    borderColor: '#A08AB7',
  },
  certifyText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
  },
  modalConfirm: {
    backgroundColor: '#A08AB7',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  privacyRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  privacyOption: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  privacyOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
  privacyOptionDesc: {
    fontSize: 12,
  },
  locationResult: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  locationResultText: {
    flex: 1,
  },
  locationCity: {
    fontSize: 16,
    fontWeight: '600',
  },
  locationCountry: {
    fontSize: 13,
    marginTop: 2,
  },
  gpsButton: {
    backgroundColor: '#A08AB7',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  gpsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  manualToggle: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  manualToggleText: {
    fontSize: 15,
    fontWeight: '600',
  },
  searchInput: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInputField: {
    flex: 1,
    fontSize: 16,
  },
  suggestions: {
    borderRadius: 14,
    marginTop: 6,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
