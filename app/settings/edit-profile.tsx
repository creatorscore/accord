import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Pressable,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { MotiView } from 'moti';
import { Audio } from 'expo-av';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { optimizeImage, uriToArrayBuffer, validateImage, generateImageHash } from '@/lib/image-optimization';
import { HeightUnit, cmToInches, inchesToCm } from '@/lib/height-utils';
import { openAppSettings } from '@/lib/open-settings';
import { validateContent } from '@/lib/content-moderation';

interface Photo {
  id?: string;
  url: string;
  storage_path?: string;
  is_primary: boolean;
  display_order: number;
  is_new?: boolean;
  to_delete?: boolean;
  contentHash?: string;
}

interface PromptAnswer {
  prompt: string;
  answer: string;
}

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

// Genders that are considered "men only" - straight men are not allowed on the platform
const MEN_ONLY_GENDERS = ['Man', 'Trans Man'];

// Helper function to get available orientations based on gender
// Straight men are not allowed - only show "Straight" if user is NOT exclusively male-identifying
function getAvailableOrientations(selectedGenders: string[]): string[] {
  const isExclusivelyMale = selectedGenders.length > 0 &&
    selectedGenders.every(g => MEN_ONLY_GENDERS.includes(g));

  if (isExclusivelyMale) {
    return ORIENTATIONS.filter(o => o !== 'Straight');
  }
  return ORIENTATIONS;
}

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

const PERSONALITY_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
  'Not sure',
  'Prefer not to say',
];

const LOVE_LANGUAGES = [
  'Words of Affirmation',
  'Quality Time',
  'Receiving Gifts',
  'Acts of Service',
  'Physical Touch',
  'Not sure',
];

const RELIGIONS = [
  'Agnostic',
  'Atheist',
  'Buddhist',
  'Catholic',
  'Christian',
  'Hindu',
  'Jewish',
  'Muslim',
  'Spiritual',
  'Other',
  'Prefer not to say',
];

const POLITICAL_VIEWS = [
  'Very Liberal',
  'Liberal',
  'Moderate',
  'Conservative',
  'Very Conservative',
  'Apolitical',
  'Other',
  'Prefer not to say',
];

const VOICE_PROMPTS = [
  "A story I love to tell...",
  "My hot take is...",
  "The way to my heart is...",
  "I'm looking for someone who...",
  "Something that always makes me laugh...",
  "My perfect Sunday looks like...",
  "I get way too excited about...",
  "The best trip I ever took...",
];

const COMMON_LANGUAGES = [
  'English',
  'Spanish',
  'Mandarin',
  'French',
  'German',
  'Italian',
  'Portuguese',
  'Russian',
  'Japanese',
  'Korean',
  'Arabic',
  'Hindi',
  'Other',
];

const HOBBY_OPTIONS = [
  '🎨 Art & Design',
  '📚 Reading',
  '✈️ Travel',
  '🎵 Music',
  '🏃 Fitness',
  '🎮 Gaming',
  '🍳 Cooking',
  '📸 Photography',
  '🧘 Yoga',
  '🎭 Theater',
  '🌱 Gardening',
  '🎬 Film',
  '💻 Tech',
  '✍️ Writing',
  '🐕 Pets',
  '🎪 Live Events',
  '🏕️ Outdoors',
  '🎨 Crafts',
  '🍷 Wine Tasting',
  '☕ Coffee',
];

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
  { value: 'romantic', label: 'Romantic Partnership' },
  { value: 'open', label: 'Open Arrangement' },
];

const CHILDREN_ARRANGEMENTS = [
  { value: 'biological', label: 'Biological Children' },
  { value: 'adoption', label: 'Adoption' },
  { value: 'co_parenting', label: 'Co-Parenting Agreement' },
  { value: 'surrogacy', label: 'Surrogacy' },
  { value: 'ivf', label: 'IVF' },
  { value: 'already_have', label: 'Already Have Children' },
  { value: 'open_discussion', label: 'Open to Discussion' },
];

const FINANCIAL_ARRANGEMENTS = [
  { value: 'separate', label: 'Keep Finances Separate' },
  { value: 'shared_expenses', label: 'Share Living Expenses' },
  { value: 'joint', label: 'Fully Joint Finances' },
  { value: 'prenup_required', label: 'Prenup Required' },
  { value: 'flexible', label: 'Flexible/Open to Discussion' },
];

const HOUSING_PREFERENCES = [
  { value: 'separate_spaces', label: 'Separate Bedrooms/Spaces' },
  { value: 'roommates', label: 'Roommate-Style Arrangement' },
  { value: 'separate_homes', label: 'Separate Homes Nearby' },
  { value: 'shared_bedroom', label: 'Shared Bedroom' },
  { value: 'flexible', label: 'Flexible/Open to Discussion' },
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

const PROMPT_OPTIONS = [
  "My ideal lavender marriage looks like...",
  "I'm looking for someone who...",
  "The best partnership includes...",
  "A perfect Sunday with my partner would be...",
  "Together we could...",
  "I need a partner who understands...",
  "My ideal living situation is...",
  "Financial goals I want us to share...",
  "The most important thing in our arrangement...",
  "I can offer my partner...",
  "Deal breakers for me are...",
  "My vision for our future includes...",
  "What makes me a great partner is...",
  "I'm passionate about...",
  "Green flags I'm looking for...",
  "A fun fact about me...",
  "My love language is...",
  "I'm secretly really good at...",
  "The key to my heart is...",
  "My guilty pleasure is...",
];

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => currentYear - 18 - i); // Start from 18 years ago

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

export default function EditProfile() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Profile fields
  const [profileId, setProfileId] = useState<string>('');
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Individual date components for custom picker
  const [selectedMonth, setSelectedMonth] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const [age, setAge] = useState('');
  const [bio, setBio] = useState('');
  const [occupation, setOccupation] = useState('');
  const [education, setEducation] = useState('');
  const [hometown, setHometown] = useState('');
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [refreshingLocation, setRefreshingLocation] = useState(false);
  const [gender, setGender] = useState<string[]>([]);
  const [pronouns, setPronouns] = useState('');
  const [ethnicity, setEthnicity] = useState<string[]>([]);
  const [sexualOrientation, setSexualOrientation] = useState<string[]>([]);
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('imperial');
  const [zodiac, setZodiac] = useState('');
  const [personality, setPersonality] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [promptAnswers, setPromptAnswers] = useState<PromptAnswer[]>([
    { prompt: '', answer: '' },
    { prompt: '', answer: '' },
    { prompt: '', answer: '' },
  ]);
  const [showCustomPromptInput, setShowCustomPromptInput] = useState<number | null>(null);
  const [customPromptText, setCustomPromptText] = useState('');
  const [favoriteMovies, setFavoriteMovies] = useState('');
  const [favoriteMusic, setFavoriteMusic] = useState('');
  const [favoriteBooks, setFavoriteBooks] = useState('');
  const [favoriteTvShows, setFavoriteTvShows] = useState('');
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [newHobby, setNewHobby] = useState('');
  const [loveLanguage, setLoveLanguage] = useState('');
  const [languagesSpoken, setLanguagesSpoken] = useState<string[]>([]);
  const [religion, setReligion] = useState('');
  const [politicalViews, setPoliticalViews] = useState('');
  const [voiceIntroUrl, setVoiceIntroUrl] = useState<string | null>(null);
  const [voiceIntroPrompt, setVoiceIntroPrompt] = useState<string>('');
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState<number>(0);

  // Preferences fields
  const [preferencesId, setPreferencesId] = useState<string>('');
  const [primaryReason, setPrimaryReason] = useState<string[]>([]);
  const [relationshipType, setRelationshipType] = useState('');
  const [wantsChildren, setWantsChildren] = useState<boolean | null>(null);
  const [childrenArrangement, setChildrenArrangement] = useState<string[]>([]);
  const [financialArrangement, setFinancialArrangement] = useState<string[]>([]);
  const [housingPreference, setHousingPreference] = useState<string[]>([]);
  const [smoking, setSmoking] = useState('');
  const [drinking, setDrinking] = useState('');
  const [pets, setPets] = useState('');
  const [ageMin, setAgeMin] = useState('25');
  const [ageMax, setAgeMax] = useState('45');
  const [maxDistance, setMaxDistance] = useState('50');
  const [willingToRelocate, setWillingToRelocate] = useState(false);
  const [genderPreference, setGenderPreference] = useState<string[]>([]);
  const [dealbreakers, setDealbreakers] = useState<string[]>([]);
  const [newDealbreaker, setNewDealbreaker] = useState('');
  const [mustHaves, setMustHaves] = useState<string[]>([]);
  const [newMustHave, setNewMustHave] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      // Load profile data
      const { data: profileData, error: profileError} = await supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          birth_date,
          age,
          bio,
          occupation,
          education,
          location_city,
          location_state,
          gender,
          pronouns,
          ethnicity,
          sexual_orientation,
          height_inches,
          height_unit,
          zodiac_sign,
          personality_type,
          prompt_answers,
          interests,
          hobbies,
          love_language,
          languages_spoken,
          religion,
          political_views,
          voice_intro_url,
          voice_intro_duration,
          voice_intro_prompt
        `)
        .eq('user_id', user?.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        throw profileError;
      }

      if (profileData) {
        setProfileId(profileData.id);
        setDisplayName(profileData.display_name || '');

        // Load birth date if available, otherwise fall back to age
        if (profileData.birth_date) {
          const date = new Date(profileData.birth_date);
          setBirthDate(date);
          setSelectedMonth(date.getMonth());
          setSelectedDay(date.getDate());
          setSelectedYear(date.getFullYear());
        }
        setAge(profileData.age?.toString() || '');
        setBio(profileData.bio || '');
        setOccupation(profileData.occupation || '');
        setEducation(profileData.education || '');
        setHometown(profileData.hometown || '');
        setLocationCity(profileData.location_city || '');
        setLocationState(profileData.location_state || '');

        setGender(profileData.gender || []);
        setPronouns(profileData.pronouns || '');
        setEthnicity(profileData.ethnicity || []);
        setSexualOrientation(profileData.sexual_orientation || []);

        // Load height unit preference and convert height_inches to the appropriate format
        const savedHeightUnit = profileData.height_unit || 'imperial';
        setHeightUnit(savedHeightUnit as HeightUnit);

        if (profileData.height_inches) {
          if (savedHeightUnit === 'metric') {
            // Convert inches to cm for metric users
            const cm = inchesToCm(profileData.height_inches);
            setHeightCm(cm.toString());
          } else {
            // Convert to feet and inches for imperial users
            const feet = Math.floor(profileData.height_inches / 12);
            const inches = profileData.height_inches % 12;
            setHeightFeet(feet.toString());
            setHeightInches(inches.toString());
          }
        }

        setZodiac(profileData.zodiac_sign || '');
        setPersonality(profileData.personality_type || '');

        // Load photos separately to avoid relation issues
        try {
          const { data: photosData } = await supabase
            .from('photos')
            .select('id, url, storage_path, is_primary, display_order')
            .eq('profile_id', profileData.id)
            .order('display_order', { ascending: true });

          if (photosData) {
            setPhotos(photosData);
          }
        } catch (photoError) {
          console.warn('Error loading photos:', photoError);
          // Continue without photos
        }

        if (profileData.prompt_answers && profileData.prompt_answers.length > 0) {
          setPromptAnswers([
            ...profileData.prompt_answers,
            ...Array(3 - profileData.prompt_answers.length).fill({ prompt: '', answer: '' })
          ].slice(0, 3));
        }

        // Parse interests JSONB object {movies: [], music: [], books: [], tv_shows: []}
        if (profileData.interests && typeof profileData.interests === 'object') {
          const interests = profileData.interests as any;
          setFavoriteMovies(Array.isArray(interests.movies) ? interests.movies.join(', ') : '');
          setFavoriteMusic(Array.isArray(interests.music) ? interests.music.join(', ') : '');
          setFavoriteBooks(Array.isArray(interests.books) ? interests.books.join(', ') : '');
          setFavoriteTvShows(Array.isArray(interests.tv_shows) ? interests.tv_shows.join(', ') : '');
        }

        if (profileData.hobbies && Array.isArray(profileData.hobbies)) {
          setHobbies(profileData.hobbies);
        } else {
          setHobbies([]);
        }

        // love_language is now a TEXT[] array, take first element if present
        const loveLanguageArray = profileData.love_language || [];
        setLoveLanguage(Array.isArray(loveLanguageArray) && loveLanguageArray.length > 0 ? loveLanguageArray[0] : '');

        if (profileData.languages_spoken && Array.isArray(profileData.languages_spoken)) {
          setLanguagesSpoken(profileData.languages_spoken);
        } else {
          setLanguagesSpoken([]);
        }

        setReligion(profileData.religion || '');
        setPoliticalViews(profileData.political_views || '');

        if (profileData.voice_intro_url) {
          setVoiceIntroUrl(profileData.voice_intro_url);
          setVoiceDuration(profileData.voice_intro_duration || 0);
        }
        setVoiceIntroPrompt(profileData.voice_intro_prompt || '');

        // Load preferences data
        try {
          const { data: prefsData } = await supabase
            .from('preferences')
            .select('*')
            .eq('profile_id', profileData.id)
            .single();

          if (prefsData) {
            setPreferencesId(prefsData.id);
            // Prefer new primary_reasons column, fallback to legacy primary_reason
            if (prefsData.primary_reasons && Array.isArray(prefsData.primary_reasons)) {
              setPrimaryReason(prefsData.primary_reasons);
            } else if (prefsData.primary_reason) {
              setPrimaryReason([prefsData.primary_reason]); // Convert legacy single value to array
            } else {
              setPrimaryReason([]);
            }
            setRelationshipType(prefsData.relationship_type || '');
            setWantsChildren(prefsData.wants_children);
            setChildrenArrangement(prefsData.children_arrangement || []);
            setFinancialArrangement(prefsData.financial_arrangement || []);
            setHousingPreference(prefsData.housing_preference || []);
            setAgeMin(prefsData.age_min?.toString() || '25');
            setAgeMax(prefsData.age_max?.toString() || '45');
            setMaxDistance(prefsData.max_distance_miles?.toString() || '50');
            setWillingToRelocate(prefsData.willing_to_relocate || false);

            // Load lifestyle preferences
            if (prefsData.lifestyle_preferences) {
              setSmoking(prefsData.lifestyle_preferences.smoking || '');
              setDrinking(prefsData.lifestyle_preferences.drinking || '');
              setPets(prefsData.lifestyle_preferences.pets || '');
            }

            if (prefsData.gender_preference && Array.isArray(prefsData.gender_preference)) {
              setGenderPreference(prefsData.gender_preference);
            }

            if (prefsData.dealbreakers && Array.isArray(prefsData.dealbreakers)) {
              setDealbreakers(prefsData.dealbreakers);
            }

            if (prefsData.must_haves && Array.isArray(prefsData.must_haves)) {
              setMustHaves(prefsData.must_haves);
            }
          }
        } catch (prefsError) {
          console.warn('No preferences found, will create on save');
        }
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
      Alert.alert('Error', 'Failed to load profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDateConfirm = () => {
    if (selectedMonth !== null && selectedDay !== null && selectedYear !== null) {
      const date = new Date(selectedYear, selectedMonth, selectedDay);
      setBirthDate(date);
      setShowDatePicker(false);
    }
  };

  const pickImage = async () => {
    // Count only active photos (not marked for deletion)
    const activePhotos = photos.filter(p => !p.to_delete);

    if (activePhotos.length >= 6) {
      Alert.alert('Limit Reached', 'You can add up to 6 photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const selectedUri = result.assets[0].uri;

      // Validate image before processing
      const validation = await validateImage(selectedUri);
      if (!validation.isValid) {
        Alert.alert('Invalid Image', validation.error || 'Please select a different photo');
        return;
      }

      // Optimize image with compression
      const { optimized } = await optimizeImage(selectedUri, {
        generateThumbnail: true,
      });

      console.log(`Optimized profile image: ${(optimized.size! / 1024).toFixed(0)}KB`);

      // Generate hash for duplicate detection
      const contentHash = await generateImageHash(optimized.uri);
      console.log(`Generated content hash: ${contentHash.substring(0, 16)}...`);

      // Check for duplicate in current selection (local check)
      const isDuplicateLocal = photos.some(p => !p.to_delete && p.contentHash === contentHash);
      if (isDuplicateLocal) {
        Alert.alert('Duplicate Photo', 'You have already selected this photo. Please choose a different one.');
        return;
      }

      // Check for duplicate in database (already uploaded photos)
      if (profileId) {
        const { data: existingPhoto } = await supabase
          .from('photos')
          .select('id')
          .eq('profile_id', profileId)
          .eq('content_hash', contentHash)
          .maybeSingle();

        if (existingPhoto) {
          Alert.alert('Duplicate Photo', 'You have already uploaded this photo. Please choose a different one.');
          return;
        }
      }

      const newPhoto: Photo = {
        url: optimized.uri,
        is_primary: activePhotos.length === 0,
        display_order: activePhotos.length,
        is_new: true,
        contentHash,
      };
      setPhotos([...photos, newPhoto]);
    }
  };

  const removePhoto = (index: number) => {
    // Count current active photos (not marked for deletion)
    const currentActivePhotos = photos.filter(p => !p.to_delete);
    if (currentActivePhotos.length <= 2) {
      Alert.alert('Minimum Photos Required', 'Your profile must have at least 2 photos. Add another photo before removing this one.');
      return;
    }

    console.log('🗑️ Before removing photo:', photos.length, photos.map(p => p.url.substring(0, 30)));
    const updatedPhotos = [...photos];
    const photoToRemove = updatedPhotos[index];

    // Mark existing photos for deletion, or just remove new ones
    if (photoToRemove.id) {
      photoToRemove.to_delete = true;
    } else {
      updatedPhotos.splice(index, 1);
    }

    // Reset all primary flags first
    updatedPhotos.forEach(photo => {
      photo.is_primary = false;
    });

    // Update display order and primary status for remaining active photos only
    const activePhotos = updatedPhotos.filter(p => !p.to_delete);
    activePhotos.forEach((photo, i) => {
      photo.display_order = i;
      photo.is_primary = i === 0;
    });

    setPhotos(updatedPhotos);
    console.log('✅ After removing photo:', updatedPhotos.filter(p => !p.to_delete).length);
  };

  const movePhoto = (index: number, direction: 'up' | 'down') => {
    const newPhotos = [...photos];
    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex >= 0 && newIndex < photos.length) {
      [newPhotos[index], newPhotos[newIndex]] = [newPhotos[newIndex], newPhotos[index]];

      // Update display order and primary status
      newPhotos.forEach((photo, i) => {
        photo.display_order = i;
        photo.is_primary = i === 0;
      });

      setPhotos(newPhotos);
    }
  };

  const updatePromptAnswer = (index: number, field: 'prompt' | 'answer', value: string) => {
    const updated = [...promptAnswers];
    updated[index] = { ...updated[index], [field]: value };
    setPromptAnswers(updated);
  };

  const saveCustomPrompt = () => {
    if (showCustomPromptInput === null || !customPromptText.trim()) return;

    if (customPromptText.trim().length < 10) {
      Alert.alert('Error', 'Custom prompt must be at least 10 characters long.');
      return;
    }

    updatePromptAnswer(showCustomPromptInput, 'prompt', customPromptText.trim());
    setCustomPromptText('');
    setShowCustomPromptInput(null);
  };


  const toggleHobby = (hobby: string) => {
    if (hobbies.includes(hobby)) {
      setHobbies(hobbies.filter((h) => h !== hobby));
    } else {
      if (hobbies.length >= 10) {
        Alert.alert('Maximum Hobbies', 'You can select up to 10 hobbies');
        return;
      }
      setHobbies([...hobbies, hobby]);
    }
  };

  const addHobby = () => {
    if (newHobby.trim() && hobbies.length < 10) {
      setHobbies([...hobbies, newHobby.trim()]);
      setNewHobby('');
    }
  };

  const removeHobby = (index: number) => {
    setHobbies(hobbies.filter((_, i) => i !== index));
  };

  const addLanguage = (language: string) => {
    if (language && !languagesSpoken.includes(language) && languagesSpoken.length < 5) {
      setLanguagesSpoken([...languagesSpoken, language]);
    }
  };

  const removeLanguage = (index: number) => {
    setLanguagesSpoken(languagesSpoken.filter((_, i) => i !== index));
  };

  const addDealbreaker = () => {
    if (newDealbreaker.trim() && dealbreakers.length < 10) {
      setDealbreakers([...dealbreakers, newDealbreaker.trim()]);
      setNewDealbreaker('');
    }
  };

  const removeDealbreaker = (index: number) => {
    setDealbreakers(dealbreakers.filter((_, i) => i !== index));
  };

  const addMustHave = () => {
    if (newMustHave.trim() && mustHaves.length < 10) {
      setMustHaves([...mustHaves, newMustHave.trim()]);
      setNewMustHave('');
    }
  };

  const removeMustHave = (index: number) => {
    setMustHaves(mustHaves.filter((_, i) => i !== index));
  };

  const toggleGenderPreference = (gender: string) => {
    if (genderPreference.includes(gender)) {
      setGenderPreference(genderPreference.filter(g => g !== gender));
    } else {
      setGenderPreference([...genderPreference, gender]);
    }
  };

  const startVoiceRecording = async () => {
    try {
      const { status, canAskAgain } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        if (!canAskAgain) {
          // Permission was denied and user must enable it in Settings
          Alert.alert(
            'Microphone Permission Required',
            'To record a voice intro, please enable microphone access in your device settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => openAppSettings(),
              },
            ]
          );
        } else {
          Alert.alert(
            'Microphone Access Needed',
            'Please grant microphone permission to record a voice intro.'
          );
        }
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Recording Error', 'Failed to start recording. Please try again.');
    }
  };

  const stopVoiceRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);
      const status = await recording.getStatusAsync();
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();

      // Calculate duration in seconds
      const durationSeconds = status.durationMillis ? Math.floor(status.durationMillis / 1000) : 0;

      setVoiceIntroUrl(uri);
      setVoiceDuration(durationSeconds);
      setRecording(null);
    } catch (error) {
      console.error('Failed to stop recording:', error);
    }
  };

  // Refresh location using GPS (no manual entry allowed)
  const refreshLocation = async () => {
    setRefreshingLocation(true);
    try {
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Permission Required',
          'Please enable location access in your device settings to update your location.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      // Get current location with high accuracy
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      // Reject locations with low accuracy (prevents iOS approximate location)
      if (location.coords.accuracy && location.coords.accuracy > 100) {
        Alert.alert(
          'Precise Location Required',
          'Please enable precise location access in Settings > Privacy > Location Services > Accord.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ]
        );
        return;
      }

      // Reverse geocode to get city/state
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      if (reverseGeocode.length > 0) {
        const place = reverseGeocode[0];
        const city = place.city || place.subregion || '';
        const state = place.region || '';

        // Update local state
        setLocationCity(city);
        setLocationState(state);

        // Save to database immediately
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user?.id)
          .single();

        if (profile) {
          await supabase
            .from('profiles')
            .update({
              location_city: city,
              location_state: state,
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            })
            .eq('id', profile.id);
        }

        Alert.alert('Location Updated', `Your location has been updated to ${city}${state ? `, ${state}` : ''}`);
      } else {
        Alert.alert('Error', 'Could not determine your location. Please try again.');
      }
    } catch (error) {
      console.error('Error refreshing location:', error);
      Alert.alert('Error', 'Failed to update location. Please try again.');
    } finally {
      setRefreshingLocation(false);
    }
  };

  const saveProfile = async (skipAlert = false) => {
    if (!displayName) {
      Alert.alert('Required Fields', 'Please fill in your name');
      return false;
    }

    if (!birthDate) {
      Alert.alert('Required Fields', 'Please select your birth date');
      return false;
    }

    // Count active photos (not marked for deletion)
    const activePhotos = photos.filter(p => !p.to_delete);
    if (activePhotos.length < 2) {
      Alert.alert('More Photos Needed', 'Your profile must have at least 2 photos');
      return false;
    }

    setSaving(true);

    try {
      // Calculate age and zodiac from birth date
      const calculatedAge = calculateAge(birthDate);
      const calculatedZodiac = calculateZodiac(birthDate);

      // Calculate total height in inches based on selected unit
      let totalHeightInches = null;
      if (heightUnit === 'metric' && heightCm) {
        // Convert cm to inches for storage
        totalHeightInches = cmToInches(parseInt(heightCm) || 0);
      } else if (heightUnit === 'imperial' && heightFeet) {
        const feet = parseInt(heightFeet) || 0;
        const inches = parseInt(heightInches) || 0;
        totalHeightInches = (feet * 12) + inches;
      }

      // Filter out empty prompt answers
      const validPromptAnswers = promptAnswers.filter(pa => pa.prompt && pa.answer);

      // Validate prompt answers for gibberish and profanity
      for (const pa of validPromptAnswers) {
        // Validate the prompt text (if custom)
        const promptValidation = validateContent(pa.prompt, {
          checkProfanity: true,
          checkGibberish: true,
          fieldName: 'prompt',
        });
        if (!promptValidation.isValid) {
          setSaving(false);
          Alert.alert(
            promptValidation.moderationResult?.isGibberish ? 'Invalid Prompt' : 'Inappropriate Content',
            promptValidation.error
          );
          return false;
        }

        // Validate the answer
        const answerValidation = validateContent(pa.answer, {
          checkProfanity: true,
          checkGibberish: true,
          fieldName: 'prompt answer',
        });
        if (!answerValidation.isValid) {
          setSaving(false);
          Alert.alert(
            answerValidation.moderationResult?.isGibberish ? 'Invalid Response' : 'Inappropriate Content',
            answerValidation.error
          );
          return false;
        }
      }

      // Update or create profile
      const profilePayload = {
        user_id: user?.id,
        display_name: displayName,
        birth_date: birthDate.toISOString().split('T')[0], // Store as YYYY-MM-DD
        age: calculatedAge,
        zodiac_sign: calculatedZodiac,
        bio,
        occupation,
        education,
        hometown,
        // NOTE: location_city and location_state are NOT included here
        // Location can only be updated via GPS refresh button (no manual editing)
        gender: gender.length > 0 ? gender : null,
        pronouns,
        ethnicity: ethnicity.length > 0 ? ethnicity : null,
        sexual_orientation: sexualOrientation.length > 0 ? sexualOrientation : null,
        height_inches: totalHeightInches,
        height_unit: heightUnit,
        personality_type: personality,
        prompt_answers: validPromptAnswers.length > 0 ? validPromptAnswers : null,
        interests: {
          movies: favoriteMovies.split(',').map(s => s.trim()).filter(Boolean),
          music: favoriteMusic.split(',').map(s => s.trim()).filter(Boolean),
          books: favoriteBooks.split(',').map(s => s.trim()).filter(Boolean),
          tv_shows: favoriteTvShows.split(',').map(s => s.trim()).filter(Boolean),
        },
        hobbies: hobbies.length > 0 ? hobbies : null,
        love_language: loveLanguage ? [loveLanguage] : null,
        languages_spoken: languagesSpoken.length > 0 ? languagesSpoken : null,
        religion: religion || null,
        political_views: politicalViews || null,
        voice_intro_url: voiceIntroUrl,
        voice_intro_prompt: voiceIntroPrompt || null,
        // NOTE: photo_review_required is NOT cleared here - only admins can clear it
        // after reviewing the user's updated photos. This prevents users from bypassing
        // the photo review process by simply saving their profile.
      };

      let finalProfileId = profileId;

      if (profileId) {
        // Update existing profile
        const { error } = await supabase
          .from('profiles')
          .update(profilePayload)
          .eq('id', profileId);

        if (error) throw error;

        // Check if user was policy_restricted as straight man and has now updated their profile
        // to no longer be a straight man - if so, clear the restriction
        const isStillStraightMan = (() => {
          const genderArr = gender.length > 0 ? gender : [];
          const orientationArr = sexualOrientation.length > 0 ? sexualOrientation : [];
          const menOnlyGenders = ['Man', 'Trans Man'];
          const isExclusivelyMale = genderArr.length > 0 &&
            genderArr.every(g => menOnlyGenders.includes(g));
          return isExclusivelyMale && orientationArr.includes('Straight');
        })();

        if (!isStillStraightMan) {
          // Clear policy restriction if they're no longer a straight man
          await supabase
            .from('profiles')
            .update({
              policy_restricted: false,
              policy_restricted_reason: null,
              policy_restricted_at: null,
              policy_restriction_notified_at: null,
              policy_restriction_reminder_sent: false,
            })
            .eq('id', profileId)
            .eq('policy_restricted', true); // Only update if they were restricted
        }
      } else {
        // Create new profile
        const { data, error } = await supabase
          .from('profiles')
          .insert(profilePayload)
          .select()
          .single();

        if (error) throw error;
        finalProfileId = data.id;
        setProfileId(data.id);
      }

      // Handle photo updates
      const photosToDelete = photos.filter(p => p.to_delete && p.id);
      const photosToUpload = photos.filter(p => p.is_new && !p.to_delete);
      const photosToUpdate = photos.filter(p => !p.is_new && !p.to_delete && p.id);

      // Delete photos from storage and database
      for (const photo of photosToDelete) {
        if (photo.storage_path && !photo.storage_path.startsWith('file://')) {
          // Only delete from storage if it's a valid storage path
          const { error: storageError } = await supabase.storage
            .from('profile-photos')
            .remove([photo.storage_path]);

          if (storageError) console.error('Error deleting from storage:', storageError);
        }

        const { error: dbError } = await supabase
          .from('photos')
          .delete()
          .eq('id', photo.id);

        if (dbError) console.error('Error deleting photo from database:', dbError);
      }

      // Upload new photos to Supabase Storage
      for (const photo of photosToUpload) {
        try {
          // Get file extension
          const fileExt = 'jpg'; // Always use jpg since we optimized as JPEG
          const fileName = `${finalProfileId}/${Date.now()}_${photo.display_order}.${fileExt}`;

          // Convert optimized image to ArrayBuffer
          const arrayBuffer = await uriToArrayBuffer(photo.url);

          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from('profile-photos')
            .upload(fileName, arrayBuffer, {
              contentType: 'image/jpeg',
              upsert: false
            });

          if (uploadError) {
            console.error('Upload error:', uploadError);
            continue;
          }

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('profile-photos')
            .getPublicUrl(fileName);

          // Insert photo record into database with content hash for duplicate detection
          const { data: photoData, error: insertError } = await supabase
            .from('photos')
            .insert({
              profile_id: finalProfileId,
              url: publicUrl,
              storage_path: fileName,
              is_primary: photo.is_primary,
              display_order: photo.display_order,
              content_hash: photo.contentHash,
              moderation_status: 'pending', // Start as pending until moderation completes
            })
            .select('id')
            .single();

          if (insertError) {
            console.error('Error inserting photo record:', insertError);
          } else {
            // Run NSFW moderation check
            // This uses AWS Rekognition to detect explicit content
            try {
              const moderationResponse = await fetch(
                `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/moderate-photo`,
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
                  },
                  body: JSON.stringify({
                    photo_url: publicUrl,
                    photo_id: photoData?.id,
                    profile_id: finalProfileId,
                  }),
                }
              );

              const moderationResult = await moderationResponse.json();
              console.log(`🔍 Moderation result:`, moderationResult);

              // If photo was rejected for explicit content, alert user and remove photo
              if (moderationResult.approved === false && moderationResult.reason === 'explicit_content') {
                // Delete the photo from storage and database
                await supabase.storage.from('profile-photos').remove([fileName]);
                await supabase.from('photos').delete().eq('id', photoData?.id);

                Alert.alert(
                  'Photo Rejected',
                  'This photo contains inappropriate content and cannot be uploaded. Please choose a different photo.'
                );
              }
            } catch (moderationError: any) {
              console.error('Moderation check failed (non-blocking):', moderationError);
            }
          }
        } catch (error) {
          console.error('Error uploading photo:', error);
        }
      }

      // Update existing photo order and primary status
      for (const photo of photosToUpdate) {
        const { error } = await supabase
          .from('photos')
          .update({
            is_primary: photo.is_primary,
            display_order: photo.display_order,
          })
          .eq('id', photo.id);

        if (error) console.error('Error updating photo:', error);
      }

      // Upload voice intro if it's a new local file
      let finalVoiceIntroUrl = voiceIntroUrl;
      let finalVoiceDuration = voiceDuration;
      if (voiceIntroUrl && voiceIntroUrl.startsWith('file://')) {
        try {
          const fileName = `${finalProfileId}/voice-intro.m4a`;

          // Fetch the audio file and convert to ArrayBuffer
          const response = await fetch(voiceIntroUrl);
          const arrayBuffer = await response.arrayBuffer();

          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from('voice-intros')
            .upload(fileName, arrayBuffer, {
              contentType: 'audio/m4a',
              upsert: true
            });

          if (uploadError) {
            console.error('Voice upload error:', uploadError);
          } else {
            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('voice-intros')
              .getPublicUrl(fileName);

            finalVoiceIntroUrl = publicUrl;

            // Update the profile with the public URL and duration
            await supabase
              .from('profiles')
              .update({
                voice_intro_url: publicUrl,
                voice_intro_duration: finalVoiceDuration
              })
              .eq('id', finalProfileId);
          }
        } catch (error) {
          console.error('Error uploading voice intro:', error);
        }
      }

      // Save preferences
      if (finalProfileId) {
        // Build lifestyle preferences object
        const lifestylePreferences: any = {};
        if (smoking) lifestylePreferences.smoking = smoking;
        if (drinking) lifestylePreferences.drinking = drinking;
        if (pets) lifestylePreferences.pets = pets;

        const preferencesPayload = {
          profile_id: finalProfileId,
          primary_reasons: primaryReason.length > 0 ? primaryReason : null,
          primary_reason: primaryReason.length > 0 ? primaryReason[0] : null, // Keep legacy column for backward compat
          relationship_type: relationshipType || null,
          wants_children: wantsChildren,
          children_arrangement: childrenArrangement.length > 0 ? childrenArrangement : null,
          financial_arrangement: financialArrangement.length > 0 ? financialArrangement : null,
          housing_preference: housingPreference.length > 0 ? housingPreference : null,
          lifestyle_preferences: Object.keys(lifestylePreferences).length > 0 ? lifestylePreferences : null,
          age_min: parseInt(ageMin) || 25,
          age_max: parseInt(ageMax) || 45,
          max_distance_miles: parseInt(maxDistance) || 50,
          willing_to_relocate: willingToRelocate,
          gender_preference: genderPreference.length > 0 ? genderPreference : null,
          dealbreakers: dealbreakers.length > 0 ? dealbreakers : null,
          must_haves: mustHaves.length > 0 ? mustHaves : null,
        };

        const { error: prefsError } = await supabase
          .from('preferences')
          .upsert(preferencesPayload, { onConflict: 'profile_id' });

        if (prefsError) {
          console.error('Error saving preferences:', prefsError);
          // Don't fail the whole save if preferences fail
        }
      }

      if (!skipAlert) {
        Alert.alert(
          'Success',
          'Your profile has been updated!',
          [
            { text: 'View Profile', onPress: () => router.push('/profile/preview') }
          ]
        );
      }
      return true;
    } catch (error: any) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', error.message || 'Failed to save profile');
      return false;
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A08AB7" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#A08AB7', '#CDC2E5']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={() => saveProfile()} disabled={saving}>
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.saveButton}>Save</Text>
          )}
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Photos Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Photos</Text>
          <Text style={styles.sectionSubtitle}>Add up to 6 photos. First photo will be your primary.</Text>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photosScroll}>
            {photos.filter(p => !p.to_delete).map((photo, index) => (
              <MotiView
                key={index}
                from={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring' }}
                style={styles.photoContainer}
              >
                <Image source={{ uri: photo.url }} style={styles.photoImage} />

                {/* Photo Controls */}
                <View style={styles.photoControls}>
                  {index > 0 && (
                    <TouchableOpacity
                      style={styles.photoControl}
                      onPress={() => {
                        // Find the real index in the full photos array
                        const realIndex = photos.indexOf(photo);
                        movePhoto(realIndex, 'up');
                      }}
                    >
                      <MaterialCommunityIcons name="arrow-left" size={16} color="white" />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={[styles.photoControl, styles.deleteControl]}
                    onPress={() => {
                      // Find the real index in the full photos array
                      const realIndex = photos.indexOf(photo);
                      removePhoto(realIndex);
                    }}
                  >
                    <MaterialCommunityIcons name="close" size={16} color="white" />
                  </TouchableOpacity>

                  {index < photos.filter(p => !p.to_delete).length - 1 && (
                    <TouchableOpacity
                      style={styles.photoControl}
                      onPress={() => {
                        // Find the real index in the full photos array
                        const realIndex = photos.indexOf(photo);
                        movePhoto(realIndex, 'down');
                      }}
                    >
                      <MaterialCommunityIcons name="arrow-right" size={16} color="white" />
                    </TouchableOpacity>
                  )}
                </View>

                {photo.is_primary && (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryText}>Primary</Text>
                  </View>
                )}
              </MotiView>
            ))}

            {photos.filter(p => !p.to_delete).length < 6 && (
              <TouchableOpacity style={styles.addPhotoButton} onPress={pickImage}>
                <MaterialCommunityIcons name="camera-plus" size={32} color="#A08AB7" />
                <Text style={styles.addPhotoText}>Add Photo</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </View>

        {/* Basic Info Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Basic Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Display Name *</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Your name"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Birth Date *</Text>
            <TouchableOpacity
              style={styles.input}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={birthDate ? { color: '#111827' } : { color: '#9CA3AF' }}>
                {birthDate ? birthDate.toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : 'Select your birth date'}
              </Text>
            </TouchableOpacity>
            {birthDate && (
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 4 }}>
                Age: {calculateAge(birthDate)} • {calculateZodiac(birthDate)}
              </Text>
            )}
          </View>

          {/* Custom Date Picker Modal */}
          <Modal
            visible={showDatePicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowDatePicker(false)}
          >
            <View style={{ flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' }}>
              <View style={{ backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 32 }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                  <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827' }}>Select Birth Date</Text>
                  <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                    <MaterialCommunityIcons name="close" size={28} color="#6B7280" />
                  </TouchableOpacity>
                </View>

                {/* Date Selectors */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                  {/* Month */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 8 }}>Month</Text>
                    <ScrollView style={{ maxHeight: 192, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
                      {MONTHS.map((month, index) => (
                        <TouchableOpacity
                          key={month}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            borderBottomWidth: 1,
                            borderBottomColor: '#F3F4F6',
                            backgroundColor: selectedMonth === index ? '#F3E8FF' : 'transparent'
                          }}
                          onPress={() => setSelectedMonth(index)}
                        >
                          <Text style={{
                            color: selectedMonth === index ? '#A08AB7' : '#374151',
                            fontWeight: selectedMonth === index ? 'bold' : 'normal'
                          }}>
                            {month}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Day */}
                  <View style={{ width: 80 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 8 }}>Day</Text>
                    <ScrollView style={{ maxHeight: 192, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
                      {DAYS.map((day) => (
                        <TouchableOpacity
                          key={day}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            borderBottomWidth: 1,
                            borderBottomColor: '#F3F4F6',
                            alignItems: 'center',
                            backgroundColor: selectedDay === day ? '#F3E8FF' : 'transparent'
                          }}
                          onPress={() => setSelectedDay(day)}
                        >
                          <Text style={{
                            color: selectedDay === day ? '#A08AB7' : '#374151',
                            fontWeight: selectedDay === day ? 'bold' : 'normal'
                          }}>
                            {day}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>

                  {/* Year */}
                  <View style={{ width: 96 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B7280', marginBottom: 8 }}>Year</Text>
                    <ScrollView style={{ maxHeight: 192, backgroundColor: '#F9FAFB', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB' }}>
                      {YEARS.map((year) => (
                        <TouchableOpacity
                          key={year}
                          style={{
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            borderBottomWidth: 1,
                            borderBottomColor: '#F3F4F6',
                            alignItems: 'center',
                            backgroundColor: selectedYear === year ? '#F3E8FF' : 'transparent'
                          }}
                          onPress={() => setSelectedYear(year)}
                        >
                          <Text style={{
                            color: selectedYear === year ? '#A08AB7' : '#374151',
                            fontWeight: selectedYear === year ? 'bold' : 'normal'
                          }}>
                            {year}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                </View>

                {/* Confirm Button */}
                <TouchableOpacity
                  style={{
                    borderRadius: 16,
                    paddingVertical: 16,
                    alignItems: 'center',
                    backgroundColor: (selectedMonth !== null && selectedDay !== null && selectedYear !== null) ? '#A08AB7' : '#D1D5DB'
                  }}
                  onPress={handleDateConfirm}
                  disabled={selectedMonth === null || selectedDay === null || selectedYear === null}
                >
                  <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>Confirm</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          <View style={styles.inputGroup}>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Gender</Text>
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Select all that apply</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.interestChip,
                    gender.includes(g) && { backgroundColor: '#A08AB7', borderColor: '#A08AB7' }
                  ]}
                  onPress={() => {
                    let newGenders: string[];
                    if (gender.includes(g)) {
                      newGenders = gender.filter(item => item !== g);
                    } else {
                      newGenders = [...gender, g];
                    }
                    setGender(newGenders);

                    // If user becomes exclusively male-identifying, remove "Straight" from orientation
                    const isExclusivelyMale = newGenders.length > 0 &&
                      newGenders.every(gen => MEN_ONLY_GENDERS.includes(gen));
                    if (isExclusivelyMale && sexualOrientation.includes('Straight')) {
                      setSexualOrientation(sexualOrientation.filter(o => o !== 'Straight'));
                    }
                  }}
                >
                  <Text style={[
                    styles.interestText,
                    gender.includes(g) && { color: '#FFFFFF' }
                  ]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {gender.length > 0 && (
              <Text style={{ fontSize: 12, color: '#A08AB7', marginTop: 8 }}>
                Selected: {gender.join(', ')}
              </Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Pronouns</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PRONOUNS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.interestChip,
                    pronouns === p && { backgroundColor: '#A08AB7', borderColor: '#A08AB7' }
                  ]}
                  onPress={() => setPronouns(p)}
                >
                  <Text style={[
                    styles.interestText,
                    pronouns === p && { color: '#FFFFFF' }
                  ]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Ethnicity (Optional)</Text>
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Select all that apply. This helps find cultural connections.</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ETHNICITIES.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[
                    styles.interestChip,
                    ethnicity.includes(e) && { backgroundColor: '#A08AB7', borderColor: '#A08AB7' }
                  ]}
                  onPress={() => {
                    if (ethnicity.includes(e)) {
                      setEthnicity(ethnicity.filter(item => item !== e));
                    } else {
                      setEthnicity([...ethnicity, e]);
                    }
                  }}
                >
                  <Text style={[
                    styles.interestText,
                    ethnicity.includes(e) && { color: '#FFFFFF' }
                  ]}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {ethnicity.length > 0 && (
              <Text style={{ fontSize: 12, color: '#A08AB7', marginTop: 8 }}>
                Selected: {ethnicity.join(', ')}
              </Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Sexual Orientation</Text>
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Select all that apply</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {getAvailableOrientations(gender).map((o) => (
                <TouchableOpacity
                  key={o}
                  style={[
                    styles.interestChip,
                    sexualOrientation.includes(o) && { backgroundColor: '#A08AB7', borderColor: '#A08AB7' }
                  ]}
                  onPress={() => {
                    if (sexualOrientation.includes(o)) {
                      setSexualOrientation(sexualOrientation.filter(item => item !== o));
                    } else {
                      setSexualOrientation([...sexualOrientation, o]);
                    }
                  }}
                >
                  <Text style={[
                    styles.interestText,
                    sexualOrientation.includes(o) && { color: '#FFFFFF' }
                  ]}>{o}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {sexualOrientation.length > 0 && (
              <Text style={{ fontSize: 12, color: '#A08AB7', marginTop: 8 }}>
                Selected: {sexualOrientation.join(', ')}
              </Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Height</Text>

            {/* Height Unit Toggle */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <TouchableOpacity
                style={[
                  styles.unitToggleButton,
                  heightUnit === 'imperial' && styles.unitToggleButtonActive
                ]}
                onPress={() => setHeightUnit('imperial')}
              >
                <Text style={[
                  styles.unitToggleText,
                  heightUnit === 'imperial' && styles.unitToggleTextActive
                ]}>Feet / Inches</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.unitToggleButton,
                  heightUnit === 'metric' && styles.unitToggleButtonActive
                ]}
                onPress={() => setHeightUnit('metric')}
              >
                <Text style={[
                  styles.unitToggleText,
                  heightUnit === 'metric' && styles.unitToggleTextActive
                ]}>Centimeters</Text>
              </TouchableOpacity>
            </View>

            {/* Height Input - Imperial (feet/inches) */}
            {heightUnit === 'imperial' ? (
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.input}
                    value={heightFeet}
                    onChangeText={setHeightFeet}
                    placeholder="Feet (e.g., 5)"
                    keyboardType="number-pad"
                    placeholderTextColor="#9CA3AF"
                    maxLength={1}
                  />
                </View>
                <Text style={{ fontWeight: 'bold', color: '#6B7280' }}>ft</Text>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.input}
                    value={heightInches}
                    onChangeText={setHeightInches}
                    placeholder="Inches (e.g., 10)"
                    keyboardType="number-pad"
                    placeholderTextColor="#9CA3AF"
                    maxLength={2}
                  />
                </View>
                <Text style={{ fontWeight: 'bold', color: '#6B7280' }}>in</Text>
              </View>
            ) : (
              /* Height Input - Metric (cm) */
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <TextInput
                    style={styles.input}
                    value={heightCm}
                    onChangeText={setHeightCm}
                    placeholder="Height in cm (e.g., 175)"
                    keyboardType="number-pad"
                    placeholderTextColor="#9CA3AF"
                    maxLength={3}
                  />
                </View>
                <Text style={{ fontWeight: 'bold', color: '#6B7280' }}>cm</Text>
              </View>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Personality Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PERSONALITY_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.interestChip,
                    personality === type && { backgroundColor: '#A08AB7', borderColor: '#A08AB7' }
                  ]}
                  onPress={() => setPersonality(type)}
                >
                  <Text style={[
                    styles.interestText,
                    personality === type && { color: '#FFFFFF' }
                  ]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Bio Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About You</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bio</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell your story..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Occupation</Text>
            <TextInput
              style={styles.input}
              value={occupation}
              onChangeText={setOccupation}
              placeholder="What do you do?"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Education</Text>
            <TextInput
              style={styles.input}
              value={education}
              onChangeText={setEducation}
              placeholder="Your education"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Hometown</Text>
            <TextInput
              style={styles.input}
              value={hometown}
              onChangeText={setHometown}
              placeholder="e.g., Los Angeles, CA"
              placeholderTextColor="#9CA3AF"
              maxLength={100}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Love Language</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {LOVE_LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.interestChip,
                    loveLanguage === lang && { backgroundColor: '#A08AB7', borderColor: '#A08AB7' }
                  ]}
                  onPress={() => setLoveLanguage(lang)}
                >
                  <Text style={[
                    styles.interestText,
                    loveLanguage === lang && { color: '#FFFFFF' }
                  ]}>{lang}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Religion</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {RELIGIONS.map((rel) => (
                <TouchableOpacity
                  key={rel}
                  style={[
                    styles.interestChip,
                    religion === rel && { backgroundColor: '#A08AB7', borderColor: '#A08AB7' }
                  ]}
                  onPress={() => setReligion(rel)}
                >
                  <Text style={[
                    styles.interestText,
                    religion === rel && { color: '#FFFFFF' }
                  ]}>{rel}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Political Views</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {POLITICAL_VIEWS.map((view) => (
                <TouchableOpacity
                  key={view}
                  style={[
                    styles.interestChip,
                    politicalViews === view && { backgroundColor: '#A08AB7', borderColor: '#A08AB7' }
                  ]}
                  onPress={() => setPoliticalViews(view)}
                >
                  <Text style={[
                    styles.interestText,
                    politicalViews === view && { color: '#FFFFFF' }
                  ]}>{view}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Location Section - GPS Only (no manual editing) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <Text style={styles.sectionSubtitle}>
            Your location is automatically detected via GPS
          </Text>

          {/* Current Location Display */}
          <View style={styles.locationDisplayContainer}>
            <View style={styles.locationIconContainer}>
              <MaterialCommunityIcons name="map-marker" size={24} color="#A08AB7" />
            </View>
            <View style={styles.locationTextContainer}>
              <Text style={styles.locationDisplayText}>
                {locationCity && locationState
                  ? `${locationCity}, ${locationState}`
                  : locationCity || locationState || 'Location not set'}
              </Text>
              <Text style={styles.locationHelpText}>
                Tap refresh to update your location
              </Text>
            </View>
          </View>

          {/* Refresh Location Button */}
          <TouchableOpacity
            style={styles.refreshLocationButton}
            onPress={refreshLocation}
            disabled={refreshingLocation}
          >
            {refreshingLocation ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#FFFFFF" />
                <Text style={styles.refreshLocationButtonText}>Refresh My Location</Text>
              </>
            )}
          </TouchableOpacity>

          <Text style={styles.locationNote}>
            Your location is used to show you relevant matches nearby. You cannot manually change your location.
          </Text>
        </View>

        {/* Hobbies Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hobbies</Text>
          <Text style={styles.sectionSubtitle}>Select from options or add your own (up to 10)</Text>

          {/* Predefined Hobby Options */}
          <View style={styles.interestsContainer}>
            {HOBBY_OPTIONS.map((hobby) => (
              <TouchableOpacity
                key={hobby}
                style={[
                  styles.optionChip,
                  hobbies.includes(hobby) && styles.optionChipSelected,
                ]}
                onPress={() => toggleHobby(hobby)}
              >
                <Text
                  style={[
                    styles.optionChipText,
                    hobbies.includes(hobby) && styles.optionChipTextSelected,
                  ]}
                >
                  {hobby}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Selected/Custom Hobbies */}
          {hobbies.some(h => !HOBBY_OPTIONS.includes(h)) && (
            <>
              <Text style={[styles.sectionSubtitle, { marginTop: 16, marginBottom: 8 }]}>Custom Hobbies</Text>
              <View style={styles.interestsContainer}>
                {hobbies
                  .filter(h => !HOBBY_OPTIONS.includes(h))
                  .map((hobby, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.interestChip}
                      onPress={() => setHobbies(hobbies.filter((h) => h !== hobby))}
                    >
                      <Text style={styles.interestText}>{hobby}</Text>
                      <MaterialCommunityIcons name="close" size={16} color="#A08AB7" />
                    </TouchableOpacity>
                  ))}
              </View>
            </>
          )}

          {/* Add Custom Hobby */}
          {hobbies.length < 10 && (
            <View style={styles.addInterestContainer}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newHobby}
                onChangeText={setNewHobby}
                placeholder="Add a custom hobby..."
                placeholderTextColor="#9CA3AF"
                onSubmitEditing={addHobby}
              />
              <TouchableOpacity style={styles.addButton} onPress={addHobby}>
                <MaterialCommunityIcons name="plus" size={24} color="#A08AB7" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Favorites Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Favorites</Text>
          <Text style={styles.sectionSubtitle}>Share what you love (optional)</Text>

          {/* Movies */}
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.fieldLabel}>🎬 Favorite Movies</Text>
            <TextInput
              style={styles.input}
              value={favoriteMovies}
              onChangeText={setFavoriteMovies}
              placeholder="e.g., Moonlight, Carol, The Half of It"
              placeholderTextColor="#9CA3AF"
              multiline
            />
            <Text style={styles.helperText}>Separate with commas</Text>
          </View>

          {/* Music */}
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.fieldLabel}>🎵 Favorite Music Artists</Text>
            <TextInput
              style={styles.input}
              value={favoriteMusic}
              onChangeText={setFavoriteMusic}
              placeholder="e.g., Hayley Kiyoko, Troye Sivan, Chappell Roan"
              placeholderTextColor="#9CA3AF"
              multiline
            />
            <Text style={styles.helperText}>Separate with commas</Text>
          </View>

          {/* Books */}
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.fieldLabel}>📚 Favorite Books</Text>
            <TextInput
              style={styles.input}
              value={favoriteBooks}
              onChangeText={setFavoriteBooks}
              placeholder="e.g., Red White & Royal Blue, Stone Butch Blues"
              placeholderTextColor="#9CA3AF"
              multiline
            />
            <Text style={styles.helperText}>Separate with commas</Text>
          </View>

          {/* TV Shows */}
          <View>
            <Text style={styles.fieldLabel}>📺 Favorite TV Shows</Text>
            <TextInput
              style={styles.input}
              value={favoriteTvShows}
              onChangeText={setFavoriteTvShows}
              placeholder="e.g., Heartstopper, The L Word, Pose"
              placeholderTextColor="#9CA3AF"
              multiline
            />
            <Text style={styles.helperText}>Separate with commas</Text>
          </View>
        </View>

        {/* Languages Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Languages Spoken</Text>
          <Text style={styles.sectionSubtitle}>Select up to 5 languages</Text>

          <View style={styles.interestsContainer}>
            {languagesSpoken.map((language, index) => (
              <TouchableOpacity
                key={index}
                style={styles.interestChip}
                onPress={() => removeLanguage(index)}
              >
                <Text style={styles.interestText}>{language}</Text>
                <MaterialCommunityIcons name="close" size={16} color="#A08AB7" />
              </TouchableOpacity>
            ))}
          </View>

          {languagesSpoken.length < 5 && (
            <TouchableOpacity
              style={styles.input}
              onPress={() => {
                Alert.alert(
                  'Select a Language',
                  '',
                  [
                    ...COMMON_LANGUAGES.filter(lang => !languagesSpoken.includes(lang)).map(lang => ({
                      text: lang,
                      onPress: () => addLanguage(lang)
                    })),
                    { text: 'Cancel', style: 'cancel' as const }
                  ]
                );
              }}
            >
              <Text style={{ color: '#9CA3AF', fontSize: 16 }}>Add a language...</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Voice Introduction Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Voice Introduction</Text>
          <Text style={styles.sectionSubtitle}>Record a 30-second voice intro</Text>

          <TouchableOpacity
            style={[styles.voiceButton, isRecording && styles.voiceButtonRecording]}
            onPress={isRecording ? stopVoiceRecording : startVoiceRecording}
          >
            <MaterialCommunityIcons
              name={isRecording ? "stop" : "microphone"}
              size={32}
              color={isRecording ? "#EF4444" : "#A08AB7"}
            />
            <Text style={[styles.voiceButtonText, isRecording && { color: '#EF4444' }]}>
              {isRecording ? "Stop Recording" : voiceIntroUrl ? "Re-record Voice Intro" : "Record Voice Intro"}
            </Text>
          </TouchableOpacity>

          {voiceIntroUrl && !isRecording && (
            <View style={styles.voiceStatus}>
              <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
              <Text style={styles.voiceStatusText}>Voice intro recorded</Text>
            </View>
          )}

          {/* Voice Prompt Selection */}
          {voiceIntroUrl && !isRecording && (
            <View style={{ marginTop: 16 }}>
              <Text style={styles.inputLabel}>Voice intro prompt</Text>
              <Text style={{ color: '#6B7280', fontSize: 13, marginBottom: 12 }}>
                Give your voice intro a creative title
              </Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                {VOICE_PROMPTS.map((prompt) => (
                  <TouchableOpacity
                    key={prompt}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 20,
                      backgroundColor: voiceIntroPrompt === prompt ? '#A08AB7' : '#F3F4F6',
                      borderWidth: 1,
                      borderColor: voiceIntroPrompt === prompt ? '#A08AB7' : '#E5E7EB',
                    }}
                    onPress={() => setVoiceIntroPrompt(prompt)}
                  >
                    <Text style={{
                      fontSize: 13,
                      color: voiceIntroPrompt === prompt ? '#FFFFFF' : '#374151',
                    }}>
                      {prompt}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.input, { marginTop: 8 }]}
                placeholder="Or write your own prompt..."
                placeholderTextColor="#9CA3AF"
                value={voiceIntroPrompt && !VOICE_PROMPTS.includes(voiceIntroPrompt) ? voiceIntroPrompt : ''}
                onChangeText={(text) => setVoiceIntroPrompt(text)}
                onFocus={() => {
                  if (VOICE_PROMPTS.includes(voiceIntroPrompt)) {
                    setVoiceIntroPrompt('');
                  }
                }}
              />
            </View>
          )}
        </View>

        {/* Prompt Answers Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Prompt Answers</Text>
          <Text style={styles.sectionSubtitle}>Answer prompts to help others get to know you better</Text>

          {promptAnswers.map((pa, index) => (
            <View key={index} style={styles.promptContainer}>
              <TouchableOpacity
                style={styles.promptSelector}
                onPress={() => {
                  Alert.alert(
                    'Select a Prompt',
                    '',
                    [
                      {
                        text: '✨ Write your own prompt',
                        onPress: () => setShowCustomPromptInput(index),
                        style: 'default'
                      },
                      ...PROMPT_OPTIONS.map(prompt => ({
                        text: prompt,
                        onPress: () => updatePromptAnswer(index, 'prompt', prompt)
                      })),
                      ...(pa.prompt ? [{
                        text: '🗑️ Clear this prompt',
                        onPress: () => {
                          const updated = [...promptAnswers];
                          updated[index] = { prompt: '', answer: '' };
                          setPromptAnswers(updated);
                        },
                        style: 'destructive' as const
                      }] : []),
                      {
                        text: 'Cancel',
                        style: 'cancel'
                      }
                    ]
                  );
                }}
              >
                <Text style={pa.prompt ? styles.promptText : styles.promptPlaceholder}>
                  {pa.prompt || 'Select a prompt...'}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color="#A08AB7" />
              </TouchableOpacity>

              {pa.prompt && (
                <TextInput
                  style={[styles.input, styles.promptAnswer]}
                  value={pa.answer}
                  onChangeText={(text) => updatePromptAnswer(index, 'answer', text)}
                  placeholder="Your answer..."
                  placeholderTextColor="#9CA3AF"
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              )}
            </View>
          ))}
        </View>

        {/* Lifestyle Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lifestyle Preferences</Text>
          <Text style={styles.sectionSubtitle}>Your lifestyle choices and preferences</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Smoking (optional)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {SMOKING_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.interestChip,
                    smoking === option.value && { backgroundColor: '#A08AB7', borderColor: '#A08AB7' }
                  ]}
                  onPress={() => setSmoking(option.value)}
                >
                  <Text style={[
                    styles.interestText,
                    smoking === option.value && { color: '#FFFFFF' }
                  ]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Drinking (optional)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {DRINKING_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.interestChip,
                    drinking === option.value && { backgroundColor: '#A08AB7', borderColor: '#A08AB7' }
                  ]}
                  onPress={() => setDrinking(option.value)}
                >
                  <Text style={[
                    styles.interestText,
                    drinking === option.value && { color: '#FFFFFF' }
                  ]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Pets (optional)</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PETS_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.interestChip,
                    pets === option.value && { backgroundColor: '#A08AB7', borderColor: '#A08AB7' }
                  ]}
                  onPress={() => setPets(option.value)}
                >
                  <Text style={[
                    styles.interestText,
                    pets === option.value && { color: '#FFFFFF' }
                  ]}>{option.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Partnership Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Partnership Preferences</Text>
          <Text style={styles.sectionSubtitle}>What are you looking for in a partnership?</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Primary Reasons</Text>
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Select all that apply</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PRIMARY_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.value}
                  style={[
                    styles.interestChip,
                    primaryReason.includes(reason.value) && { backgroundColor: '#A08AB7', borderColor: '#A08AB7' }
                  ]}
                  onPress={() => {
                    if (primaryReason.includes(reason.value)) {
                      setPrimaryReason(primaryReason.filter(r => r !== reason.value));
                    } else {
                      setPrimaryReason([...primaryReason, reason.value]);
                    }
                  }}
                >
                  <Text style={[
                    styles.interestText,
                    primaryReason.includes(reason.value) && { color: '#FFFFFF' }
                  ]}>{reason.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {primaryReason.length > 0 && (
              <Text style={{ fontSize: 12, color: '#A08AB7', marginTop: 8 }}>
                Selected: {primaryReason.map(val => PRIMARY_REASONS.find(r => r.value === val)?.label).join(', ')}
              </Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Relationship Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {RELATIONSHIP_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  style={[
                    styles.interestChip,
                    relationshipType === type.value && { backgroundColor: '#A08AB7', borderColor: '#A08AB7' }
                  ]}
                  onPress={() => setRelationshipType(type.value)}
                >
                  <Text style={[
                    styles.interestText,
                    relationshipType === type.value && { color: '#FFFFFF' }
                  ]}>{type.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Children</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.input, { flex: 1, alignItems: 'center' }, wantsChildren === true && { backgroundColor: '#E9D5FF', borderColor: '#A08AB7' }]}
                onPress={() => setWantsChildren(true)}
              >
                <Text style={{ color: wantsChildren === true ? '#A08AB7' : '#6B7280', fontWeight: wantsChildren === true ? '600' : '400' }}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.input, { flex: 1, alignItems: 'center' }, wantsChildren === false && { backgroundColor: '#E9D5FF', borderColor: '#A08AB7' }]}
                onPress={() => setWantsChildren(false)}
              >
                <Text style={{ color: wantsChildren === false ? '#A08AB7' : '#6B7280', fontWeight: wantsChildren === false ? '600' : '400' }}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.input, { flex: 1, alignItems: 'center' }, wantsChildren === null && { backgroundColor: '#E9D5FF', borderColor: '#A08AB7' }]}
                onPress={() => setWantsChildren(null)}
              >
                <Text style={{ color: wantsChildren === null ? '#A08AB7' : '#6B7280', fontWeight: wantsChildren === null ? '600' : '400' }}>Open</Text>
              </TouchableOpacity>
            </View>
          </View>

          {wantsChildren !== false && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Children Arrangement</Text>
              <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Select all that apply</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CHILDREN_ARRANGEMENTS.map((arr) => (
                  <TouchableOpacity
                    key={arr.value}
                    style={[
                      styles.interestChip,
                      childrenArrangement.includes(arr.value) && { backgroundColor: '#A08AB7', borderColor: '#A08AB7' }
                    ]}
                    onPress={() => {
                      if (childrenArrangement.includes(arr.value)) {
                        setChildrenArrangement(childrenArrangement.filter(item => item !== arr.value));
                      } else {
                        setChildrenArrangement([...childrenArrangement, arr.value]);
                      }
                    }}
                  >
                    <Text style={[
                      styles.interestText,
                      childrenArrangement.includes(arr.value) && { color: '#FFFFFF' }
                    ]}>{arr.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {childrenArrangement.length > 0 && (
                <Text style={{ fontSize: 12, color: '#A08AB7', marginTop: 8 }}>
                  Selected: {childrenArrangement.map(val => CHILDREN_ARRANGEMENTS.find(a => a.value === val)?.label).join(', ')}
                </Text>
              )}
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Financial Arrangement</Text>
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Select all that apply</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {FINANCIAL_ARRANGEMENTS.map((arr) => (
                <TouchableOpacity
                  key={arr.value}
                  style={[
                    styles.interestChip,
                    financialArrangement.includes(arr.value) && { backgroundColor: '#A08AB7', borderColor: '#A08AB7' }
                  ]}
                  onPress={() => {
                    if (financialArrangement.includes(arr.value)) {
                      setFinancialArrangement(financialArrangement.filter(item => item !== arr.value));
                    } else {
                      setFinancialArrangement([...financialArrangement, arr.value]);
                    }
                  }}
                >
                  <Text style={[
                    styles.interestText,
                    financialArrangement.includes(arr.value) && { color: '#FFFFFF' }
                  ]}>{arr.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {financialArrangement.length > 0 && (
              <Text style={{ fontSize: 12, color: '#A08AB7', marginTop: 8 }}>
                Selected: {financialArrangement.map(val => FINANCIAL_ARRANGEMENTS.find(a => a.value === val)?.label).join(', ')}
              </Text>
            )}
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Housing Preference</Text>
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>Select all that apply</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {HOUSING_PREFERENCES.map((pref) => (
                <TouchableOpacity
                  key={pref.value}
                  style={[
                    styles.interestChip,
                    housingPreference.includes(pref.value) && { backgroundColor: '#A08AB7', borderColor: '#A08AB7' }
                  ]}
                  onPress={() => {
                    if (housingPreference.includes(pref.value)) {
                      setHousingPreference(housingPreference.filter(item => item !== pref.value));
                    } else {
                      setHousingPreference([...housingPreference, pref.value]);
                    }
                  }}
                >
                  <Text style={[
                    styles.interestText,
                    housingPreference.includes(pref.value) && { color: '#FFFFFF' }
                  ]}>{pref.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {housingPreference.length > 0 && (
              <Text style={{ fontSize: 12, color: '#A08AB7', marginTop: 8 }}>
                Selected: {housingPreference.map(val => HOUSING_PREFERENCES.find(a => a.value === val)?.label).join(', ')}
              </Text>
            )}
          </View>
        </View>

        {/* Matching Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Matching Preferences</Text>
          <Text style={styles.sectionSubtitle}>Who are you looking for?</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Age Range</Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  value={ageMin}
                  onChangeText={setAgeMin}
                  placeholder="Min"
                  keyboardType="number-pad"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
              <Text style={{ fontWeight: 'bold', color: '#6B7280' }}>to</Text>
              <View style={{ flex: 1 }}>
                <TextInput
                  style={styles.input}
                  value={ageMax}
                  onChangeText={setAgeMax}
                  placeholder="Max"
                  keyboardType="number-pad"
                  placeholderTextColor="#9CA3AF"
                />
              </View>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Gender Preference</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {['Man', 'Woman', 'Non-binary'].map((gender) => (
                <TouchableOpacity
                  key={gender}
                  style={[
                    styles.interestChip,
                    genderPreference.includes(gender) && { backgroundColor: '#A08AB7', borderColor: '#A08AB7' }
                  ]}
                  onPress={() => toggleGenderPreference(gender)}
                >
                  <Text style={[
                    styles.interestText,
                    genderPreference.includes(gender) && { color: '#FFFFFF' }
                  ]}>{gender}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Maximum Distance (miles)</Text>
            <TextInput
              style={styles.input}
              value={maxDistance}
              onChangeText={setMaxDistance}
              placeholder="50"
              keyboardType="number-pad"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
              onPress={() => setWillingToRelocate(!willingToRelocate)}
            >
              <View style={{
                width: 24,
                height: 24,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: willingToRelocate ? '#A08AB7' : '#D1D5DB',
                backgroundColor: willingToRelocate ? '#A08AB7' : 'transparent',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {willingToRelocate && (
                  <MaterialCommunityIcons name="check" size={16} color="white" />
                )}
              </View>
              <Text style={{ fontSize: 16, color: '#374151', fontWeight: '500' }}>
                Willing to relocate
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Dealbreakers Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Dealbreakers</Text>
          <Text style={styles.sectionSubtitle}>Add up to 10 dealbreakers</Text>

          <View style={styles.interestsContainer}>
            {dealbreakers.map((dealbreaker, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.interestChip, { backgroundColor: '#FEE2E2', borderWidth: 1, borderColor: '#FCA5A5' }]}
                onPress={() => removeDealbreaker(index)}
              >
                <Text style={[styles.interestText, { color: '#DC2626' }]}>❌ {dealbreaker}</Text>
                <MaterialCommunityIcons name="close" size={16} color="#DC2626" />
              </TouchableOpacity>
            ))}
          </View>

          {dealbreakers.length < 10 && (
            <View style={styles.addInterestContainer}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newDealbreaker}
                onChangeText={setNewDealbreaker}
                placeholder="Add a dealbreaker..."
                placeholderTextColor="#9CA3AF"
                onSubmitEditing={addDealbreaker}
              />
              <TouchableOpacity style={styles.addButton} onPress={addDealbreaker}>
                <MaterialCommunityIcons name="plus" size={24} color="#A08AB7" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Must-Haves Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Must-Haves</Text>
          <Text style={styles.sectionSubtitle}>Add up to 10 must-haves</Text>

          <View style={styles.interestsContainer}>
            {mustHaves.map((mustHave, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.interestChip, { backgroundColor: '#D1FAE5', borderWidth: 1, borderColor: '#6EE7B7' }]}
                onPress={() => removeMustHave(index)}
              >
                <Text style={[styles.interestText, { color: '#059669' }]}>✓ {mustHave}</Text>
                <MaterialCommunityIcons name="close" size={16} color="#059669" />
              </TouchableOpacity>
            ))}
          </View>

          {mustHaves.length < 10 && (
            <View style={styles.addInterestContainer}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newMustHave}
                onChangeText={setNewMustHave}
                placeholder="Add a must-have..."
                placeholderTextColor="#9CA3AF"
                onSubmitEditing={addMustHave}
              />
              <TouchableOpacity style={styles.addButton} onPress={addMustHave}>
                <MaterialCommunityIcons name="plus" size={24} color="#A08AB7" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {/* Save & Preview Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.savePreviewButton]}
            onPress={async () => {
              // Save first (skip alert), then navigate to preview
              const success = await saveProfile(true);
              if (success) {
                router.push('/profile/preview');
              }
            }}
            disabled={saving}
          >
            <LinearGradient
              colors={['#A08AB7', '#CDC2E5']}
              style={styles.actionButtonGradient}
            >
              <MaterialCommunityIcons name="content-save" size={20} color="white" />
              <Text style={styles.actionButtonText}>Save & View</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Live Preview Button */}
          <TouchableOpacity
            style={[styles.actionButton, styles.previewButton]}
            onPress={() => {
            console.log('👁️ Live Preview button clicked. Photos in state:', photos.length, photos.map(p => p.url.substring(0, 30)));

            // Calculate age and zodiac from birth date
            const calculatedAge = birthDate ? calculateAge(birthDate) : age;
            const calculatedZodiac = birthDate ? calculateZodiac(birthDate) : zodiac;
            const totalHeightInches = heightFeet ? (parseInt(heightFeet) * 12) + (parseInt(heightInches) || 0) : null;

            // Pass COMPLETE current form data to preview
            const previewData = {
              display_name: displayName,
              age: calculatedAge,
              bio,
              occupation,
              education,
              hometown,
              // Location is read-only - set via GPS only
              location_city: locationCity,
              location_state: locationState,
              gender: gender.length > 0 ? gender : null,
              pronouns,
              ethnicity: ethnicity.length > 0 ? ethnicity : null,
              sexual_orientation: sexualOrientation.length > 0 ? sexualOrientation : null,
              height_inches: totalHeightInches,
              zodiac_sign: calculatedZodiac,
              personality_type: personality,
              love_language: loveLanguage ? [loveLanguage] : null,
              languages_spoken: languagesSpoken.length > 0 ? languagesSpoken : null,
              religion,
              political_views: politicalViews,
              photos: photos.filter(p => !p.to_delete),
              prompt_answers: promptAnswers.filter(pa => pa.prompt && pa.answer),
              interests: {
                movies: favoriteMovies.split(',').map(s => s.trim()).filter(Boolean),
                music: favoriteMusic.split(',').map(s => s.trim()).filter(Boolean),
                books: favoriteBooks.split(',').map(s => s.trim()).filter(Boolean),
                tv_shows: favoriteTvShows.split(',').map(s => s.trim()).filter(Boolean),
              },
              hobbies,
              voice_intro_url: voiceIntroUrl,
              voice_intro_duration: voiceDuration,
              voice_intro_prompt: voiceIntroPrompt || null,
              is_verified: false,
              // Include preferences for the preview
              preferences: {
                primary_reason: primaryReason,
                relationship_type: relationshipType,
                wants_children: wantsChildren,
                children_arrangement: childrenArrangement,
                financial_arrangement: financialArrangement,
                housing_preference: housingPreference,
                age_min: parseInt(ageMin) || 25,
                age_max: parseInt(ageMax) || 45,
                max_distance_miles: parseInt(maxDistance) || 50,
                willing_to_relocate: willingToRelocate,
                gender_preference: Array.isArray(genderPreference) ? genderPreference : [],
                dealbreakers: Array.isArray(dealbreakers) ? dealbreakers : [],
                must_haves: Array.isArray(mustHaves) ? mustHaves : [],
                lifestyle_preferences: {
                  smoking: smoking || null,
                  drinking: drinking || null,
                  pets: pets || null,
                },
              },
            };

            // Store in temporary storage for preview
            router.push({
              pathname: '/profile/preview',
              params: {
                profileData: JSON.stringify(previewData),
                isRealtime: 'true'
              }
            });
          }}
        >
              <MaterialCommunityIcons name="eye" size={20} color="#A08AB7" />
              <Text style={styles.previewButtonText}>Live Preview</Text>
            </TouchableOpacity>
          </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Custom Prompt Input Modal */}
      <Modal
        visible={showCustomPromptInput !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowCustomPromptInput(null);
          setCustomPromptText('');
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setShowCustomPromptInput(null);
            setCustomPromptText('');
          }}
        >
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {/* Header with Close Button */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Write your own prompt</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowCustomPromptInput(null);
                  setCustomPromptText('');
                }}
                style={styles.modalCloseButton}
              >
                <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.customPromptInput}
              value={customPromptText}
              onChangeText={setCustomPromptText}
              placeholder="Type your custom prompt..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={100}
              autoFocus
            />

            <Text style={styles.charCount}>{customPromptText.length}/100</Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => {
                  setShowCustomPromptInput(null);
                  setCustomPromptText('');
                }}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalButton,
                  styles.modalSaveButton,
                  customPromptText.trim().length < 10 && styles.modalButtonDisabled
                ]}
                onPress={saveCustomPrompt}
                disabled={customPromptText.trim().length < 10}
              >
                <Text style={[
                  styles.modalSaveText,
                  customPromptText.trim().length < 10 && styles.modalButtonDisabledText
                ]}>Save</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  saveButton: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: 'white',
    marginTop: 16,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  helperText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  photosScroll: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
  },
  photoContainer: {
    marginRight: 12,
    position: 'relative',
  },
  photoImage: {
    width: 120,
    height: 160,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  photoControls: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: 'row',
    gap: 4,
  },
  photoControl: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteControl: {
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
  },
  primaryBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#A08AB7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  primaryText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  addPhotoButton: {
    width: 120,
    height: 160,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  addPhotoText: {
    fontSize: 14,
    color: '#A08AB7',
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    minHeight: 100,
    paddingTop: 12,
  },
  promptContainer: {
    marginBottom: 20,
  },
  promptSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
    marginBottom: 8,
  },
  promptText: {
    fontSize: 15,
    color: '#111827',
    fontWeight: '500',
    flex: 1,
  },
  promptPlaceholder: {
    fontSize: 15,
    color: '#9CA3AF',
    flex: 1,
  },
  promptAnswer: {
    minHeight: 80,
    paddingTop: 12,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  interestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  interestText: {
    fontSize: 14,
    color: '#A08AB7',
    fontWeight: '500',
  },
  optionChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  optionChipSelected: {
    backgroundColor: '#A08AB7',
    borderColor: '#A08AB7',
  },
  optionChipText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  optionChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  addInterestContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#F3E8FF',
    paddingVertical: 20,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#E9D5FF',
  },
  voiceButtonRecording: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FECACA',
  },
  voiceButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#A08AB7',
  },
  voiceStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  voiceStatusText: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginTop: 20,
  },
  actionButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  savePreviewButton: {
    shadowColor: '#A08AB7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  actionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderWidth: 2,
    borderColor: '#A08AB7',
    backgroundColor: 'white',
  },
  previewButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#A08AB7',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
  },
  modalCloseButton: {
    padding: 4,
    marginLeft: 8,
  },
  customPromptInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#111827',
    minHeight: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#F3F4F6',
  },
  modalSaveButton: {
    backgroundColor: '#A08AB7',
  },
  modalButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
  modalButtonDisabledText: {
    color: '#9CA3AF',
  },
  unitToggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  unitToggleButtonActive: {
    backgroundColor: '#A08AB7',
    borderColor: '#A08AB7',
  },
  unitToggleText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  unitToggleTextActive: {
    color: '#FFFFFF',
  },
  // Location Section Styles (GPS only)
  locationDisplayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  locationIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F0F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationDisplayText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  locationHelpText: {
    fontSize: 13,
    color: '#6B7280',
  },
  refreshLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A08AB7',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    gap: 8,
  },
  refreshLocationButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  locationNote: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});