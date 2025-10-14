import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function About() {
  const router = useRouter();
  const { user } = useAuth();
  const [bio, setBio] = useState('');
  const [occupation, setOccupation] = useState('');
  const [education, setEducation] = useState('');
  const [loading, setLoading] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);

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

      if (error) throw error;
      setProfileId(data.id);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load profile');
    }
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
    <ScrollView className="flex-1 bg-blue-50">
      <View className="px-6 pt-16 pb-8">
        {/* Progress */}
        <View className="mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-gray-600 font-medium">Step 3 of 9</Text>
            <Text className="text-sm text-primary-600 font-bold">33%</Text>
          </View>
          <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-3 bg-primary-500 rounded-full"
              style={{ width: '33%' }}
            />
          </View>
        </View>

        {/* Header */}
        <View className="mb-8">
          <Text className="text-4xl font-bold text-gray-900 mb-3">
            About you ✍️
          </Text>
          <Text className="text-gray-600 text-lg">
            Share what makes you unique
          </Text>
        </View>

        {/* Form */}
        <View className="space-y-6">
          {/* Bio */}
          <View>
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-bold text-gray-900">About Me</Text>
              <Text className="text-sm text-gray-500 font-semibold">{bio.length}/500</Text>
            </View>
            <TextInput
              className="bg-white border-2 border-blue-200 rounded-2xl px-5 py-4 text-gray-900 min-h-36 text-base"
              placeholder="Write a bit about yourself, your interests, what makes you unique..."
              value={bio}
              onChangeText={(text) => setBio(text.slice(0, 500))}
              multiline
              textAlignVertical="top"
              placeholderTextColor="#9CA3AF"
            />
            <Text className="text-sm text-blue-600 mt-2 font-medium">
              ✨ Minimum 50 characters. Be genuine and specific!
            </Text>
          </View>

          {/* Occupation */}
          <View>
            <Text className="text-lg font-bold text-gray-900 mb-3">
              💼 Occupation <Text className="text-gray-400 text-sm">(optional)</Text>
            </Text>
            <TextInput
              className="bg-white border-2 border-purple-200 rounded-xl px-5 py-4 text-gray-900 text-base"
              placeholder="e.g., Software Engineer, Teacher, Student"
              value={occupation}
              onChangeText={setOccupation}
              maxLength={100}
              placeholderTextColor="#9CA3AF"
            />
          </View>

          {/* Education */}
          <View>
            <Text className="text-lg font-bold text-gray-900 mb-3">
              🎓 Education <Text className="text-gray-400 text-sm">(optional)</Text>
            </Text>
            <TextInput
              className="bg-white border-2 border-pink-200 rounded-xl px-5 py-4 text-gray-900 text-base"
              placeholder="e.g., Bachelor's at UCLA, High School"
              value={education}
              onChangeText={setEducation}
              maxLength={100}
              placeholderTextColor="#9CA3AF"
            />
          </View>
        </View>

        {/* Tips */}
        <View className="bg-purple-50 border-2 border-purple-200 rounded-3xl p-5 my-8">
          <View className="flex-row items-center mb-3">
            <Text className="text-3xl mr-2">💡</Text>
            <Text className="text-purple-900 font-bold text-lg">Bio Tips</Text>
          </View>
          <Text className="text-purple-800 text-sm mb-2">
            ✨ Be authentic about your reasons for seeking a lavender marriage
          </Text>
          <Text className="text-purple-800 text-sm mb-2">
            💬 Share your hobbies, interests, and lifestyle
          </Text>
          <Text className="text-purple-800 text-sm mb-2">
            🎯 Mention what you're looking for in a partner
          </Text>
          <Text className="text-purple-800 text-sm">
            🌈 Keep it positive and genuine
          </Text>
        </View>

        {/* Buttons */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 py-4 rounded-full border-2 border-gray-300 bg-white"
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text className="text-gray-700 text-center font-bold text-lg">Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-4 rounded-full ${
              loading || bio.length < 50
                ? 'bg-gray-400'
                : 'bg-primary-500'
            }`}
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
  );
}
