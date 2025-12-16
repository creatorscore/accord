import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { GradientButton } from '@/components/shared/GradientButton';
import { goToPreviousOnboardingStep } from '@/lib/onboarding-navigation';
import { HeightUnit, cmToInches, getHeightRange } from '@/lib/height-utils';

const ZODIAC_SIGNS = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces',
  'Prefer not to say'
];

const MBTI_TYPES = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
  "Don't know"
];

const LOVE_LANGUAGES = [
  'Words of Affirmation',
  'Quality Time',
  'Receiving Gifts',
  'Acts of Service',
  'Physical Touch',
  'Not sure'
];

const COMMON_LANGUAGES = [
  'English', 'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Mandarin', 'Cantonese', 'Japanese', 'Korean', 'Arabic', 'Hindi',
  'Russian', 'Dutch', 'Polish', 'Swedish', 'Greek', 'Hebrew',
  'Vietnamese', 'Thai', 'Tagalog', 'ASL (Sign Language)', 'Other'
];

const RELIGIONS = [
  'Christian', 'Catholic', 'Protestant', 'Muslim', 'Jewish', 'Hindu',
  'Buddhist', 'Sikh', 'Atheist', 'Agnostic', 'Spiritual but not religious',
  'Other', 'Prefer not to say'
];

const POLITICAL_VIEWS = [
  'Liberal', 'Progressive', 'Moderate', 'Conservative', 'Libertarian',
  'Socialist', 'Apolitical', 'Other', 'Prefer not to say'
];

export default function Personality() {
  const router = useRouter();
  const { user } = useAuth();
  const [zodiacSign, setZodiacSign] = useState('');
  const [heightFeet, setHeightFeet] = useState('');
  const [heightInches, setHeightInches] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('imperial');
  const [personalityType, setPersonalityType] = useState('');
  const [loveLanguage, setLoveLanguage] = useState<string[]>([]);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const [religion, setReligion] = useState('');
  const [politicalViews, setPoliticalViews] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, zodiac_sign, height_inches, height_unit, personality_type, love_language, languages_spoken, religion, political_views')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setProfileId(data.id);
        // Pre-fill form if data exists
        if (data.zodiac_sign) setZodiacSign(data.zodiac_sign);
        if (data.personality_type) setPersonalityType(data.personality_type);
        if (data.love_language) setLoveLanguage(Array.isArray(data.love_language) ? data.love_language : [data.love_language]);
        if (data.languages_spoken) setSelectedLanguages(Array.isArray(data.languages_spoken) ? data.languages_spoken : [data.languages_spoken]);
        if (data.religion) setReligion(data.religion);
        if (data.political_views) setPoliticalViews(data.political_views);

        // Handle height based on saved unit preference
        if (data.height_unit) setHeightUnit(data.height_unit);
        if (data.height_inches) {
          const unit = data.height_unit || 'imperial';
          if (unit === 'metric') {
            // Convert inches to cm for display
            const cm = Math.round(data.height_inches * 2.54);
            setHeightCm(cm.toString());
          } else {
            // Convert total inches to feet and inches
            const feet = Math.floor(data.height_inches / 12);
            const inches = data.height_inches % 12;
            setHeightFeet(feet.toString());
            setHeightInches(inches.toString());
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const toggleLanguage = (language: string) => {
    if (selectedLanguages.includes(language)) {
      setSelectedLanguages(selectedLanguages.filter(l => l !== language));
    } else {
      setSelectedLanguages([...selectedLanguages, language]);
    }
  };

  const toggleLoveLanguage = (lang: string) => {
    if (loveLanguage.includes(lang)) {
      setLoveLanguage(loveLanguage.filter(l => l !== lang));
    } else {
      setLoveLanguage([...loveLanguage, lang]);
    }
  };

  const handleContinue = async () => {
    // Validation - at least some fields should be filled
    const hasHeight = heightUnit === 'metric' ? !!heightCm : !!heightFeet;
    if (!zodiacSign && !hasHeight && !personalityType && loveLanguage.length === 0 && selectedLanguages.length === 0) {
      Alert.alert('Required', 'Please fill in at least a few fields to continue');
      return;
    }

    try {
      setLoading(true);

      // Get the current user from Supabase session
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();

      if (userError || !currentUser) {
        throw new Error('Not authenticated. Please sign in again.');
      }

      // Get profile ID if not already loaded
      let activeProfileId = profileId;
      if (!activeProfileId) {
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', currentUser.id)
          .single();

        if (profileError) throw profileError;
        activeProfileId = profileData.id;
      }

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

      const { error} = await supabase
        .from('profiles')
        .update({
          zodiac_sign: zodiacSign || null,
          height_inches: totalHeightInches,
          height_unit: heightUnit,
          personality_type: personalityType || null,
          love_language: loveLanguage.length > 0 ? loveLanguage : null,
          languages_spoken: selectedLanguages.length > 0 ? selectedLanguages : null,
          religion: religion || null,
          political_views: politicalViews || null,
          onboarding_step: 4,
        })
        .eq('id', activeProfileId);

      if (error) throw error;

      router.push('/(onboarding)/interests');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save information');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-cream">
      <View className="px-6 pb-4" style={{ paddingTop: Platform.OS === 'android' ? 8 : 64 }}>
        {/* Progress */}
        <View className="mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-gray-600 font-medium">Step 4 of 9</Text>
            <Text className="text-sm text-lavender-400 font-bold">44%</Text>
          </View>
          <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-3 bg-lavender-400 rounded-full"
              style={{ width: '44%' }}
            />
          </View>
        </View>

        {/* Header */}
        <View className="mb-8 items-center">
          <Text className="text-5xl mb-4">✨</Text>
          <Text className="text-4xl font-bold text-charcoal mb-3 text-center">
            Let's get personal
          </Text>
          <Text className="text-gray-600 text-lg text-center">
            Share more about your personality and what makes you unique
          </Text>
        </View>

        {/* Form */}
        <View className="space-y-6">
          {/* Zodiac Sign */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Zodiac Sign <Text className="text-gray-400">(optional)</Text>
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {ZODIAC_SIGNS.map((sign) => (
                <TouchableOpacity
                  key={sign}
                  className={`px-4 py-2 rounded-full border ${
                    zodiacSign === sign
                      ? 'bg-lavender-500 border-lavender-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setZodiacSign(sign)}
                >
                  <Text
                    className={`${
                      zodiacSign === sign ? 'text-white' : 'text-gray-700'
                    } font-medium`}
                  >
                    {sign}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Height */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Height <Text className="text-gray-400">(optional)</Text>
            </Text>

            {/* Height Unit Toggle */}
            <View className="flex-row gap-2 mb-3">
              <TouchableOpacity
                className={`flex-1 py-3 rounded-xl border ${
                  heightUnit === 'imperial'
                    ? 'bg-lavender-500 border-lavender-500'
                    : 'bg-white border-gray-300'
                }`}
                onPress={() => setHeightUnit('imperial')}
              >
                <Text
                  className={`text-center font-medium ${
                    heightUnit === 'imperial' ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  Feet / Inches
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                className={`flex-1 py-3 rounded-xl border ${
                  heightUnit === 'metric'
                    ? 'bg-lavender-500 border-lavender-500'
                    : 'bg-white border-gray-300'
                }`}
                onPress={() => setHeightUnit('metric')}
              >
                <Text
                  className={`text-center font-medium ${
                    heightUnit === 'metric' ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  Centimeters
                </Text>
              </TouchableOpacity>
            </View>

            {/* Height Input - Imperial (feet/inches) */}
            {heightUnit === 'imperial' ? (
              <View className="flex-row gap-3 items-center">
                <View className="flex-1">
                  <TextInput
                    className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900"
                    placeholder="Feet (e.g., 5)"
                    value={heightFeet}
                    onChangeText={setHeightFeet}
                    keyboardType="number-pad"
                    maxLength={1}
                  />
                </View>
                <Text className="text-gray-500 font-bold">ft</Text>
                <View className="flex-1">
                  <TextInput
                    className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900"
                    placeholder="Inches (e.g., 10)"
                    value={heightInches}
                    onChangeText={setHeightInches}
                    keyboardType="number-pad"
                    maxLength={2}
                  />
                </View>
                <Text className="text-gray-500 font-bold">in</Text>
              </View>
            ) : (
              /* Height Input - Metric (cm) */
              <View className="flex-row gap-3 items-center">
                <View className="flex-1">
                  <TextInput
                    className="bg-gray-50 border border-gray-300 rounded-xl px-4 py-3 text-gray-900"
                    placeholder="Height in cm (e.g., 175)"
                    value={heightCm}
                    onChangeText={setHeightCm}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                </View>
                <Text className="text-gray-500 font-bold">cm</Text>
              </View>
            )}
          </View>

          {/* MBTI/Personality Type */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Personality Type (MBTI) <Text className="text-gray-400">(optional)</Text>
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {MBTI_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  className={`px-4 py-2 rounded-full border ${
                    personalityType === type
                      ? 'bg-lavender-500 border-lavender-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setPersonalityType(type)}
                >
                  <Text
                    className={`${
                      personalityType === type ? 'text-white' : 'text-gray-700'
                    } font-medium`}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Love Language */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Love Language <Text className="text-gray-400">(optional)</Text>
            </Text>
            <Text className="text-xs text-gray-500 mb-2">Select all that apply - most people have 2-3</Text>
            <View className="flex-row flex-wrap gap-2">
              {LOVE_LANGUAGES.map((language) => (
                <TouchableOpacity
                  key={language}
                  className={`px-4 py-2 rounded-full border ${
                    loveLanguage.includes(language)
                      ? 'bg-lavender-500 border-lavender-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => toggleLoveLanguage(language)}
                >
                  <Text
                    className={`${
                      loveLanguage.includes(language) ? 'text-white' : 'text-gray-700'
                    } font-medium text-sm`}
                  >
                    {language}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {loveLanguage.length > 0 && (
              <Text className="text-xs text-lavender-500 mt-2">
                Selected: {loveLanguage.join(', ')}
              </Text>
            )}
          </View>

          {/* Languages Spoken */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Languages You Speak <Text className="text-gray-400">(optional, select all that apply)</Text>
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {COMMON_LANGUAGES.map((language) => (
                <TouchableOpacity
                  key={language}
                  className={`px-4 py-2 rounded-full border ${
                    selectedLanguages.includes(language)
                      ? 'bg-lavender-500 border-lavender-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => toggleLanguage(language)}
                >
                  <Text
                    className={`${
                      selectedLanguages.includes(language) ? 'text-white' : 'text-gray-700'
                    } font-medium text-sm`}
                  >
                    {language}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Religion */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Religion <Text className="text-gray-400">(optional)</Text>
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {RELIGIONS.map((rel) => (
                <TouchableOpacity
                  key={rel}
                  className={`px-4 py-2 rounded-full border ${
                    religion === rel
                      ? 'bg-lavender-500 border-lavender-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setReligion(rel)}
                >
                  <Text
                    className={`${
                      religion === rel ? 'text-white' : 'text-gray-700'
                    } font-medium text-sm`}
                  >
                    {rel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Political Views */}
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">
              Political Views <Text className="text-gray-400">(optional)</Text>
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {POLITICAL_VIEWS.map((view) => (
                <TouchableOpacity
                  key={view}
                  className={`px-4 py-2 rounded-full border ${
                    politicalViews === view
                      ? 'bg-lavender-500 border-lavender-500'
                      : 'bg-white border-gray-300'
                  }`}
                  onPress={() => setPoliticalViews(view)}
                >
                  <Text
                    className={`${
                      politicalViews === view ? 'text-white' : 'text-gray-700'
                    } font-medium text-sm`}
                  >
                    {view}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

        </View>

        {/* Continue Button */}
        <View className="flex-row gap-3 mt-8">
          <TouchableOpacity
            className="flex-1 py-4 rounded-full border-2 border-gray-300 bg-white"
            onPress={() => goToPreviousOnboardingStep('/(onboarding)/personality')}
            disabled={loading}
          >
            <Text className="text-gray-700 text-center font-bold text-lg">Back</Text>
          </TouchableOpacity>

          <View className="flex-1">
            <GradientButton
              title={loading ? 'Saving...' : 'Continue'}
              onPress={handleContinue}
              loading={loading}
            />
          </View>
        </View>

        {/* Note */}
        <Text className="text-sm text-gray-600 text-center mt-6 px-4">
          All fields are optional, but filling them out helps you find better matches!
        </Text>
      </View>
    </ScrollView>
  );
}
