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
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { MotiView } from 'moti';
import { Audio } from 'expo-av';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface Photo {
  id?: string;
  url: string;
  storage_path?: string;
  is_primary: boolean;
  display_order: number;
  is_new?: boolean;
  to_delete?: boolean;
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

const PRIMARY_REASONS = [
  'Companionship',
  'Legal Benefits',
  'Immigration',
  'Family Pressure',
  'Financial Security',
  'Raising Children',
  'Social Acceptance',
  'Healthcare Benefits',
  'Other',
];

const RELATIONSHIP_TYPES = [
  'Platonic',
  'Romantic',
  'Open',
  'Queerplatonic',
  'Flexible',
  'Other',
];

const CHILDREN_ARRANGEMENTS = [
  'Biological',
  'Adoption',
  'Co-parenting',
  'Fostering',
  'Surrogacy',
  'IVF',
  'Already have children',
  'Open to discussion',
  'Other',
];

const FINANCIAL_ARRANGEMENTS = [
  'Separate Finances',
  'Joint Finances',
  'Prenup Required',
  'Partial Joint (some shared accounts)',
  'Income Sharing',
  'Open to discussion',
  'Other',
];

const HOUSING_PREFERENCES = [
  'Separate Spaces (same building)',
  'Separate Bedrooms (same home)',
  'Shared Bedroom',
  'Separate Homes (nearby)',
  'Roommate-style',
  'Open to discussion',
  'Other',
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
  const [locationCity, setLocationCity] = useState('');
  const [locationState, setLocationState] = useState('');
  const [gender, setGender] = useState('');
  const [pronouns, setPronouns] = useState('');
  const [ethnicity, setEthnicity] = useState('');
  const [sexualOrientation, setSexualOrientation] = useState('');
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [zodiac, setZodiac] = useState('');
  const [personality, setPersonality] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [promptAnswers, setPromptAnswers] = useState<PromptAnswer[]>([
    { prompt: '', answer: '' },
    { prompt: '', answer: '' },
    { prompt: '', answer: '' },
  ]);
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState('');
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [newHobby, setNewHobby] = useState('');
  const [loveLanguage, setLoveLanguage] = useState('');
  const [languagesSpoken, setLanguagesSpoken] = useState<string[]>([]);
  const [myStory, setMyStory] = useState('');
  const [religion, setReligion] = useState('');
  const [politicalViews, setPoliticalViews] = useState('');
  const [voiceIntroUrl, setVoiceIntroUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceDuration, setVoiceDuration] = useState<number>(0);

  // Preferences fields
  const [preferencesId, setPreferencesId] = useState<string>('');
  const [primaryReason, setPrimaryReason] = useState('');
  const [relationshipType, setRelationshipType] = useState('');
  const [wantsChildren, setWantsChildren] = useState<boolean | null>(null);
  const [childrenArrangement, setChildrenArrangement] = useState('');
  const [financialArrangement, setFinancialArrangement] = useState('');
  const [housingPreference, setHousingPreference] = useState('');
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
          zodiac_sign,
          personality_type,
          prompt_answers,
          interests,
          hobbies,
          love_language,
          languages_spoken,
          my_story,
          religion,
          political_views,
          voice_intro_url,
          voice_intro_duration
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
        setLocationCity(profileData.location_city || '');
        setLocationState(profileData.location_state || '');
        setGender(profileData.gender || '');
        setPronouns(profileData.pronouns || '');
        setEthnicity(profileData.ethnicity || '');
        setSexualOrientation(profileData.sexual_orientation || '');

        // Convert height_inches to feet and inches
        if (profileData.height_inches) {
          const feet = Math.floor(profileData.height_inches / 12);
          const inches = profileData.height_inches % 12;
          setHeightFeet(feet.toString());
          setHeightInches(inches.toString());
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

        if (profileData.interests && Array.isArray(profileData.interests)) {
          setInterests(profileData.interests);
        } else {
          setInterests([]);
        }

        if (profileData.hobbies && Array.isArray(profileData.hobbies)) {
          setHobbies(profileData.hobbies);
        } else {
          setHobbies([]);
        }

        setLoveLanguage(profileData.love_language || '');

        if (profileData.languages_spoken && Array.isArray(profileData.languages_spoken)) {
          setLanguagesSpoken(profileData.languages_spoken);
        } else {
          setLanguagesSpoken([]);
        }

        setMyStory(profileData.my_story || '');
        setReligion(profileData.religion || '');
        setPoliticalViews(profileData.political_views || '');

        if (profileData.voice_intro_url) {
          setVoiceIntroUrl(profileData.voice_intro_url);
          setVoiceDuration(profileData.voice_intro_duration || 0);
        }

        // Load preferences data
        try {
          const { data: prefsData } = await supabase
            .from('preferences')
            .select('*')
            .eq('profile_id', profileData.id)
            .single();

          if (prefsData) {
            setPreferencesId(prefsData.id);
            setPrimaryReason(prefsData.primary_reason || '');
            setRelationshipType(prefsData.relationship_type || '');
            setWantsChildren(prefsData.wants_children);
            setChildrenArrangement(prefsData.children_arrangement || '');
            setFinancialArrangement(prefsData.financial_arrangement || '');
            setHousingPreference(prefsData.housing_preference || '');
            setAgeMin(prefsData.age_min?.toString() || '25');
            setAgeMax(prefsData.age_max?.toString() || '45');
            setMaxDistance(prefsData.max_distance_miles?.toString() || '50');
            setWillingToRelocate(prefsData.willing_to_relocate || false);

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
      const newPhoto: Photo = {
        url: result.assets[0].uri,
        is_primary: activePhotos.length === 0,
        display_order: activePhotos.length,
        is_new: true,
      };
      setPhotos([...photos, newPhoto]);
    }
  };

  const removePhoto = (index: number) => {
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

  const addInterest = () => {
    if (newInterest.trim() && interests.length < 10) {
      setInterests([...interests, newInterest.trim()]);
      setNewInterest('');
    }
  };

  const removeInterest = (index: number) => {
    setInterests(interests.filter((_, i) => i !== index));
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
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone access is needed');
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

  const saveProfile = async (skipAlert = false) => {
    if (!displayName) {
      Alert.alert('Required Fields', 'Please fill in your name');
      return false;
    }

    if (!birthDate) {
      Alert.alert('Required Fields', 'Please select your birth date');
      return false;
    }

    setSaving(true);

    try {
      // Calculate age and zodiac from birth date
      const calculatedAge = calculateAge(birthDate);
      const calculatedZodiac = calculateZodiac(birthDate);

      // Calculate total height in inches from feet and inches
      let totalHeightInches = null;
      if (heightFeet) {
        const feet = parseInt(heightFeet) || 0;
        const inches = parseInt(heightInches) || 0;
        totalHeightInches = (feet * 12) + inches;
      }

      // Filter out empty prompt answers
      const validPromptAnswers = promptAnswers.filter(pa => pa.prompt && pa.answer);

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
        location_city: locationCity,
        location_state: locationState,
        gender,
        pronouns,
        ethnicity: ethnicity || null,
        sexual_orientation: sexualOrientation,
        height_inches: totalHeightInches,
        personality_type: personality,
        prompt_answers: validPromptAnswers.length > 0 ? validPromptAnswers : null,
        interests: interests.length > 0 ? interests : null,
        hobbies: hobbies.length > 0 ? hobbies : null,
        love_language: loveLanguage || null,
        languages_spoken: languagesSpoken.length > 0 ? languagesSpoken : null,
        my_story: myStory || null,
        religion: religion || null,
        political_views: politicalViews || null,
        voice_intro_url: voiceIntroUrl,
      };

      let finalProfileId = profileId;

      if (profileId) {
        // Update existing profile
        const { error } = await supabase
          .from('profiles')
          .update(profilePayload)
          .eq('id', profileId);

        if (error) throw error;
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
          const fileExt = photo.url.split('.').pop()?.toLowerCase() || 'jpg';
          const fileName = `${finalProfileId}/${Date.now()}_${photo.display_order}.${fileExt}`;

          // Fetch the image and convert to ArrayBuffer
          const response = await fetch(photo.url);
          const arrayBuffer = await response.arrayBuffer();

          // Upload to Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from('profile-photos')
            .upload(fileName, arrayBuffer, {
              contentType: `image/${fileExt}`,
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

          // Insert photo record into database
          const { error: insertError } = await supabase
            .from('photos')
            .insert({
              profile_id: finalProfileId,
              url: publicUrl,
              storage_path: fileName,
              is_primary: photo.is_primary,
              display_order: photo.display_order,
            });

          if (insertError) console.error('Error inserting photo record:', insertError);
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
        const preferencesPayload = {
          profile_id: finalProfileId,
          primary_reason: primaryReason || null,
          relationship_type: relationshipType || null,
          wants_children: wantsChildren,
          children_arrangement: childrenArrangement || null,
          financial_arrangement: financialArrangement || null,
          housing_preference: housingPreference || null,
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
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient
        colors={['#8B5CF6', '#EC4899']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={saveProfile} disabled={saving}>
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
                <MaterialCommunityIcons name="camera-plus" size={32} color="#8B5CF6" />
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
                            color: selectedMonth === index ? '#8B5CF6' : '#374151',
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
                            color: selectedDay === day ? '#8B5CF6' : '#374151',
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
                            color: selectedYear === year ? '#8B5CF6' : '#374151',
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
                    backgroundColor: (selectedMonth !== null && selectedDay !== null && selectedYear !== null) ? '#8B5CF6' : '#D1D5DB'
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {GENDERS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[
                    styles.interestChip,
                    gender === g && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' }
                  ]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[
                    styles.interestText,
                    gender === g && { color: '#FFFFFF' }
                  ]}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Pronouns</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PRONOUNS.map((p) => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.interestChip,
                    pronouns === p && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' }
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
            <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8 }}>This helps find cultural connections. Will display on your profile.</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ETHNICITIES.map((e) => (
                <TouchableOpacity
                  key={e}
                  style={[
                    styles.interestChip,
                    ethnicity === e && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' }
                  ]}
                  onPress={() => setEthnicity(e)}
                >
                  <Text style={[
                    styles.interestText,
                    ethnicity === e && { color: '#FFFFFF' }
                  ]}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Sexual Orientation</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {ORIENTATIONS.map((o) => (
                <TouchableOpacity
                  key={o}
                  style={[
                    styles.interestChip,
                    sexualOrientation === o && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' }
                  ]}
                  onPress={() => setSexualOrientation(o)}
                >
                  <Text style={[
                    styles.interestText,
                    sexualOrientation === o && { color: '#FFFFFF' }
                  ]}>{o}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Height</Text>
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
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Personality Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PERSONALITY_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.interestChip,
                    personality === type && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' }
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
            <Text style={styles.inputLabel}>My Story (Why I'm Here)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={myStory}
              onChangeText={setMyStory}
              placeholder="Share more about your situation..."
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
            <Text style={styles.inputLabel}>Love Language</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {LOVE_LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[
                    styles.interestChip,
                    loveLanguage === lang && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' }
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
                    religion === rel && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' }
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
                    politicalViews === view && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' }
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

        {/* Location Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>City</Text>
            <TextInput
              style={styles.input}
              value={locationCity}
              onChangeText={setLocationCity}
              placeholder="City"
              placeholderTextColor="#9CA3AF"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>State</Text>
            <TextInput
              style={styles.input}
              value={locationState}
              onChangeText={setLocationState}
              placeholder="State"
              placeholderTextColor="#9CA3AF"
              maxLength={2}
              autoCapitalize="characters"
            />
          </View>
        </View>

        {/* Hobbies Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hobbies</Text>
          <Text style={styles.sectionSubtitle}>Add up to 10 hobbies</Text>

          <View style={styles.interestsContainer}>
            {hobbies.map((hobby, index) => (
              <TouchableOpacity
                key={index}
                style={styles.interestChip}
                onPress={() => removeHobby(index)}
              >
                <Text style={styles.interestText}>{hobby}</Text>
                <MaterialCommunityIcons name="close" size={16} color="#8B5CF6" />
              </TouchableOpacity>
            ))}
          </View>

          {hobbies.length < 10 && (
            <View style={styles.addInterestContainer}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newHobby}
                onChangeText={setNewHobby}
                placeholder="Add a hobby..."
                placeholderTextColor="#9CA3AF"
                onSubmitEditing={addHobby}
              />
              <TouchableOpacity style={styles.addButton} onPress={addHobby}>
                <MaterialCommunityIcons name="plus" size={24} color="#8B5CF6" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Interests Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interests & Favorites</Text>
          <Text style={styles.sectionSubtitle}>Add up to 10 interests (movies, music, books, etc.)</Text>

          <View style={styles.interestsContainer}>
            {interests.map((interest, index) => (
              <TouchableOpacity
                key={index}
                style={styles.interestChip}
                onPress={() => removeInterest(index)}
              >
                <Text style={styles.interestText}>{interest}</Text>
                <MaterialCommunityIcons name="close" size={16} color="#8B5CF6" />
              </TouchableOpacity>
            ))}
          </View>

          {interests.length < 10 && (
            <View style={styles.addInterestContainer}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newInterest}
                onChangeText={setNewInterest}
                placeholder="Add an interest..."
                placeholderTextColor="#9CA3AF"
                onSubmitEditing={addInterest}
              />
              <TouchableOpacity style={styles.addButton} onPress={addInterest}>
                <MaterialCommunityIcons name="plus" size={24} color="#8B5CF6" />
              </TouchableOpacity>
            </View>
          )}
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
                <MaterialCommunityIcons name="close" size={16} color="#8B5CF6" />
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
                  COMMON_LANGUAGES.filter(lang => !languagesSpoken.includes(lang)).map(lang => ({
                    text: lang,
                    onPress: () => addLanguage(lang)
                  })).concat([{ text: 'Cancel', style: 'cancel' }])
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
              color={isRecording ? "#EF4444" : "#8B5CF6"}
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
                    PROMPT_OPTIONS.map(prompt => ({
                      text: prompt,
                      onPress: () => updatePromptAnswer(index, 'prompt', prompt)
                    }))
                  );
                }}
              >
                <Text style={pa.prompt ? styles.promptText : styles.promptPlaceholder}>
                  {pa.prompt || 'Select a prompt...'}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={20} color="#8B5CF6" />
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

        {/* Partnership Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Partnership Preferences</Text>
          <Text style={styles.sectionSubtitle}>What are you looking for in a partnership?</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Primary Reason</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {PRIMARY_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={[
                    styles.interestChip,
                    primaryReason === reason && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' }
                  ]}
                  onPress={() => setPrimaryReason(reason)}
                >
                  <Text style={[
                    styles.interestText,
                    primaryReason === reason && { color: '#FFFFFF' }
                  ]}>{reason}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Relationship Type</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {RELATIONSHIP_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.interestChip,
                    relationshipType === type && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' }
                  ]}
                  onPress={() => setRelationshipType(type)}
                >
                  <Text style={[
                    styles.interestText,
                    relationshipType === type && { color: '#FFFFFF' }
                  ]}>{type}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Children</Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={[styles.input, { flex: 1, alignItems: 'center' }, wantsChildren === true && { backgroundColor: '#E9D5FF', borderColor: '#8B5CF6' }]}
                onPress={() => setWantsChildren(true)}
              >
                <Text style={{ color: wantsChildren === true ? '#8B5CF6' : '#6B7280', fontWeight: wantsChildren === true ? '600' : '400' }}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.input, { flex: 1, alignItems: 'center' }, wantsChildren === false && { backgroundColor: '#E9D5FF', borderColor: '#8B5CF6' }]}
                onPress={() => setWantsChildren(false)}
              >
                <Text style={{ color: wantsChildren === false ? '#8B5CF6' : '#6B7280', fontWeight: wantsChildren === false ? '600' : '400' }}>No</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.input, { flex: 1, alignItems: 'center' }, wantsChildren === null && { backgroundColor: '#E9D5FF', borderColor: '#8B5CF6' }]}
                onPress={() => setWantsChildren(null)}
              >
                <Text style={{ color: wantsChildren === null ? '#8B5CF6' : '#6B7280', fontWeight: wantsChildren === null ? '600' : '400' }}>Open</Text>
              </TouchableOpacity>
            </View>
          </View>

          {wantsChildren !== false && (
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Children Arrangement</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {CHILDREN_ARRANGEMENTS.map((arr) => (
                  <TouchableOpacity
                    key={arr}
                    style={[
                      styles.interestChip,
                      childrenArrangement === arr && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' }
                    ]}
                    onPress={() => setChildrenArrangement(arr)}
                  >
                    <Text style={[
                      styles.interestText,
                      childrenArrangement === arr && { color: '#FFFFFF' }
                    ]}>{arr}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Financial Arrangement</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {FINANCIAL_ARRANGEMENTS.map((arr) => (
                <TouchableOpacity
                  key={arr}
                  style={[
                    styles.interestChip,
                    financialArrangement === arr && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' }
                  ]}
                  onPress={() => setFinancialArrangement(arr)}
                >
                  <Text style={[
                    styles.interestText,
                    financialArrangement === arr && { color: '#FFFFFF' }
                  ]}>{arr}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Housing Preference</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {HOUSING_PREFERENCES.map((pref) => (
                <TouchableOpacity
                  key={pref}
                  style={[
                    styles.interestChip,
                    housingPreference === pref && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' }
                  ]}
                  onPress={() => setHousingPreference(pref)}
                >
                  <Text style={[
                    styles.interestText,
                    housingPreference === pref && { color: '#FFFFFF' }
                  ]}>{pref}</Text>
                </TouchableOpacity>
              ))}
            </View>
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
                    genderPreference.includes(gender) && { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' }
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
                borderColor: willingToRelocate ? '#8B5CF6' : '#D1D5DB',
                backgroundColor: willingToRelocate ? '#8B5CF6' : 'transparent',
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
                <MaterialCommunityIcons name="plus" size={24} color="#8B5CF6" />
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
                <MaterialCommunityIcons name="plus" size={24} color="#8B5CF6" />
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
              colors={['#8B5CF6', '#EC4899']}
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
              my_story: myStory,
              occupation,
              education,
              location_city: locationCity,
              location_state: locationState,
              gender,
              pronouns,
              ethnicity,
              sexual_orientation: sexualOrientation,
              height_inches: totalHeightInches,
              zodiac_sign: calculatedZodiac,
              personality_type: personality,
              love_language: loveLanguage,
              languages_spoken: languagesSpoken.length > 0 ? languagesSpoken : null,
              religion,
              political_views: politicalViews,
              photos: photos.filter(p => !p.to_delete),
              prompt_answers: promptAnswers.filter(pa => pa.prompt && pa.answer),
              interests,
              hobbies,
              voice_intro_url: voiceIntroUrl,
              voice_intro_duration: voiceDuration,
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
                gender_preference: genderPreference,
                dealbreakers,
                must_haves: mustHaves,
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
              <MaterialCommunityIcons name="eye" size={20} color="#8B5CF6" />
              <Text style={styles.previewButtonText}>Live Preview</Text>
            </TouchableOpacity>
          </View>

        <View style={{ height: 100 }} />
      </ScrollView>
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
    backgroundColor: '#8B5CF6',
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
    color: '#8B5CF6',
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
    color: '#8B5CF6',
    fontWeight: '500',
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
    color: '#8B5CF6',
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
    shadowColor: '#8B5CF6',
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
    borderColor: '#8B5CF6',
    backgroundColor: 'white',
  },
  previewButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#8B5CF6',
  },
});