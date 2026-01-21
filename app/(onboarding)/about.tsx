import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { goToPreviousOnboardingStep } from '@/lib/onboarding-navigation';
import { validateBio, validateContent, getModerationErrorMessage } from '@/lib/content-moderation';

export default function About() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [bio, setBio] = useState('');
  const [occupation, setOccupation] = useState('');
  const [education, setEducation] = useState('');
  const [hometown, setHometown] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, bio, occupation, education, hometown')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        return;
      }

      if (data) {
        setProfileId(data.id);
        setBio(data.bio || '');
        setOccupation(data.occupation || '');
        setEducation(data.education || '');
        setHometown(data.hometown || '');
      }
    } catch (error: any) {
      // Silent fail
    }
  };

  // Save draft data (without validation) when navigating away
  const saveDraft = async (currentBio: string, currentOccupation: string, currentEducation: string, currentHometown: string) => {
    try {
      let activeProfileId = profileId;
      if (!activeProfileId && user?.id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();
        activeProfileId = profileData?.id;
      }

      if (!activeProfileId) return;

      await supabase
        .from('profiles')
        .update({
          bio: currentBio.trim() || null,
          occupation: currentOccupation.trim() || null,
          education: currentEducation.trim() || null,
          hometown: currentHometown.trim() || null,
        })
        .eq('id', activeProfileId);
    } catch (error) {
      // Silent fail
    }
  };

  const handleBack = async () => {
    // Pass current values directly to avoid closure issues
    await saveDraft(bio, occupation, education, hometown);
    goToPreviousOnboardingStep('/(onboarding)/about');
  };

  const handleContinue = async () => {
    if (!bio.trim()) {
      Alert.alert('Required', 'Please write a short bio about yourself');
      return;
    }

    if (bio.length < 50) {
      Alert.alert('Too Short', 'Please write at least 50 characters for your bio');
      return;
    }

    // Check for profanity and contact info in bio
    const bioValidation = validateContent(bio, {
      checkProfanity: true,
      checkContactInfo: true,
      fieldName: 'bio',
    });
    if (!bioValidation.isValid) {
      Alert.alert('Inappropriate Content', bioValidation.error);
      return;
    }

    // Check occupation if provided
    if (occupation.trim()) {
      const occupationValidation = validateContent(occupation, {
        checkProfanity: true,
        checkContactInfo: false,
        fieldName: 'occupation',
      });
      if (!occupationValidation.isValid) {
        Alert.alert('Inappropriate Content', occupationValidation.error);
        return;
      }
    }

    // Check education if provided
    if (education.trim()) {
      const educationValidation = validateContent(education, {
        checkProfanity: true,
        checkContactInfo: false,
        fieldName: 'education',
      });
      if (!educationValidation.isValid) {
        Alert.alert('Inappropriate Content', educationValidation.error);
        return;
      }
    }

    // Check hometown if provided
    if (hometown.trim()) {
      const hometownValidation = validateContent(hometown, {
        checkProfanity: true,
        checkContactInfo: false,
        fieldName: 'hometown',
      });
      if (!hometownValidation.isValid) {
        Alert.alert('Inappropriate Content', hometownValidation.error);
        return;
      }
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

      const { error } = await supabase
        .from('profiles')
        .update({
          bio: bio.trim(),
          occupation: occupation.trim() || null,
          education: education.trim() || null,
          hometown: hometown.trim() || null,
          onboarding_step: 3,
        })
        .eq('id', activeProfileId);

      if (error) throw error;

      router.push('/(onboarding)/personality');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save information');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: '#EFF6FF' }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView className="flex-1 bg-blue-50 dark:bg-gray-900" keyboardShouldPersistTaps="handled">
        <View className="px-6 pb-8" style={{ paddingTop: Platform.OS === 'android' ? 8 : 64 }}>
        {/* Progress */}
        <View className="mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-gray-600 dark:text-gray-400 font-medium">Step 3 of 9</Text>
            <Text className="text-sm text-lavender-500 font-bold">33%</Text>
          </View>
          <View className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <View
              className="h-3 bg-lavender-500 rounded-full"
              style={{ width: '33%' }}
            />
          </View>
        </View>

        {/* Header */}
        <View className="mb-8">
          <Text className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            About you ✍️
          </Text>
          <Text className="text-gray-600 dark:text-gray-400 text-lg">
            Share what makes you unique
          </Text>
        </View>

        {/* Form */}
        <View className="space-y-6">
          {/* Bio */}
          <View>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-gray-900 dark:text-white">About Me</Text>
              <Text className="text-sm text-gray-500 dark:text-gray-400 font-semibold">{bio.length}/500</Text>
            </View>
            <TextInput
              className="bg-white dark:bg-gray-800 border-2 border-blue-200 dark:border-blue-700 rounded-2xl px-5 py-4 text-gray-900 dark:text-white min-h-36 text-base"
              placeholder="Write a bit about yourself, your interests, what makes you unique..."
              value={bio}
              onChangeText={(text) => setBio(text.slice(0, 500))}
              multiline
              textAlignVertical="top"
              placeholderTextColor="#9CA3AF"
            />
            <Text className="text-sm text-blue-600 dark:text-blue-400 mt-2 font-medium">
              ✨ Minimum 50 characters. Be genuine and specific!
            </Text>
          </View>

          {/* Occupation */}
          <View>
            <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              💼 Occupation <Text className="text-gray-400 dark:text-gray-500 text-sm">(optional)</Text>
            </Text>
            <TextInput
              className="bg-white dark:bg-gray-800 border-2 border-purple-200 dark:border-purple-700 rounded-xl px-5 py-4 text-gray-900 dark:text-white text-base"
              placeholder="e.g., Software Engineer, Teacher, Student"
              value={occupation}
              onChangeText={setOccupation}
              maxLength={100}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Education */}
          <View>
            <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              🎓 Education <Text className="text-gray-400 dark:text-gray-500 text-sm">(optional)</Text>
            </Text>
            <TextInput
              className="bg-white dark:bg-gray-800 border-2 border-pink-200 dark:border-pink-700 rounded-xl px-5 py-4 text-gray-900 dark:text-white text-base"
              placeholder="e.g., Bachelor's at UCLA, High School"
              value={education}
              onChangeText={setEducation}
              maxLength={100}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Hometown */}
          <View>
            <Text className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              🏠 Hometown <Text className="text-gray-400 dark:text-gray-500 text-sm">(optional)</Text>
            </Text>
            <TextInput
              className="bg-white dark:bg-gray-800 border-2 border-amber-200 dark:border-amber-700 rounded-xl px-5 py-4 text-gray-900 dark:text-white text-base"
              placeholder="e.g., Los Angeles, CA"
              value={hometown}
              onChangeText={setHometown}
              maxLength={100}
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* Tips */}
        <View className="bg-purple-50 dark:bg-purple-900/30 border-2 border-purple-200 dark:border-purple-700 rounded-3xl p-5 my-8">
          <View className="flex-row items-center mb-3">
            <Text className="text-3xl mr-2">💡</Text>
            <Text className="text-purple-900 dark:text-purple-200 font-bold text-lg">Bio Tips</Text>
          </View>
          <Text className="text-purple-800 dark:text-purple-300 text-sm mb-2">
            ✨ Be authentic about your reasons for seeking a lavender marriage
          </Text>
          <Text className="text-purple-800 dark:text-purple-300 text-sm mb-2">
            💬 Share your hobbies, interests, and lifestyle
          </Text>
          <Text className="text-purple-800 dark:text-purple-300 text-sm mb-2">
            🎯 Mention what you're looking for in a partner
          </Text>
          <Text className="text-purple-800 dark:text-purple-300 text-sm">
            🌈 Keep it positive and genuine
          </Text>
        </View>

        {/* Buttons */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 py-4 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            onPress={handleBack}
            disabled={loading}
          >
            <Text className="text-gray-700 dark:text-gray-300 text-center font-bold text-lg">Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-4 rounded-full ${
              loading || bio.length < 50
                ? 'bg-gray-400 dark:bg-gray-600'
                : 'bg-lavender-500'
            }`}
            style={{
              borderRadius: 9999,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 16,
            }}
            onPress={handleContinue}
            disabled={loading || bio.length < 50}
          >
            <Text className="text-white text-center font-bold text-lg">
              {loading ? 'Saving...' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
