import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { goToPreviousOnboardingStep } from '@/lib/onboarding-navigation';

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

export default function Interests() {
  const router = useRouter();
  const { user } = useAuth();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [hobbies, setHobbies] = useState<string[]>([]);
  const [customHobby, setCustomHobby] = useState('');
  const [favoriteMovies, setFavoriteMovies] = useState('');
  const [favoriteMusic, setFavoriteMusic] = useState('');
  const [favoriteBooks, setFavoriteBooks] = useState('');
  const [favoriteTvShows, setFavoriteTvShows] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, hobbies, interests')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setProfileId(data.id);

      // Load existing hobbies
      if (data.hobbies && data.hobbies.length > 0) {
        console.log('📋 Loaded existing hobbies:', data.hobbies);
        setHobbies(data.hobbies);
      }

      // Load existing interests
      if (data.interests) {
        if (data.interests.movies && data.interests.movies.length > 0) {
          setFavoriteMovies(data.interests.movies.join(', '));
        }
        if (data.interests.music && data.interests.music.length > 0) {
          setFavoriteMusic(data.interests.music.join(', '));
        }
        if (data.interests.books && data.interests.books.length > 0) {
          setFavoriteBooks(data.interests.books.join(', '));
        }
        if (data.interests.tv_shows && data.interests.tv_shows.length > 0) {
          setFavoriteTvShows(data.interests.tv_shows.join(', '));
        }
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load profile');
    }
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

  const addCustomHobby = () => {
    const trimmedHobby = customHobby.trim();

    if (!trimmedHobby) {
      return;
    }

    if (hobbies.length >= 10) {
      Alert.alert('Maximum Hobbies', 'You can select up to 10 hobbies');
      return;
    }

    // Check if hobby already exists (case insensitive)
    const hobbyExists = hobbies.some(h =>
      h.toLowerCase().replace(/[^\w\s]/g, '') === trimmedHobby.toLowerCase()
    );

    if (hobbyExists) {
      Alert.alert('Duplicate Hobby', 'You\'ve already added this hobby');
      return;
    }

    // Add custom emoji prefix if user didn't include one
    const hobbyWithEmoji = /\p{Emoji}/u.test(trimmedHobby)
      ? trimmedHobby
      : `✨ ${trimmedHobby}`;

    setHobbies([...hobbies, hobbyWithEmoji]);
    setCustomHobby('');
  };

  const handleContinue = async () => {
    if (hobbies.length === 0) {
      Alert.alert('Required', 'Please select at least one hobby');
      return;
    }

    if (!profileId) {
      Alert.alert('Error', 'Profile not found. Please start over.');
      return;
    }

    try {
      setLoading(true);

      // Parse comma-separated lists
      const movies = favoriteMovies.split(',').map(s => s.trim()).filter(Boolean);
      const music = favoriteMusic.split(',').map(s => s.trim()).filter(Boolean);
      const books = favoriteBooks.split(',').map(s => s.trim()).filter(Boolean);
      const tvShows = favoriteTvShows.split(',').map(s => s.trim()).filter(Boolean);

      const { error } = await supabase
        .from('profiles')
        .update({
          hobbies,
          interests: {
            movies,
            music,
            books,
            tv_shows: tvShows,
          },
          onboarding_step: 4,
        })
        .eq('id', profileId);

      if (error) throw error;

      router.push('/(onboarding)/prompts');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save interests');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <ScrollView
        className="flex-1 bg-purple-50"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 120 }}
      >
        <View className="px-6 pb-8" style={{ paddingTop: Platform.OS === 'android' ? 8 : 64 }}>
        {/* Progress */}
        <View className="mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-gray-600 font-medium">Step 5 of 9</Text>
            <Text className="text-sm text-lavender-500 font-bold">56%</Text>
          </View>
          <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-3 bg-lavender-500 rounded-full"
              style={{ width: '56%' }}
            />
          </View>
        </View>

        {/* Header */}
        <View className="mb-8">
          <Text className="text-4xl font-bold text-gray-900 mb-3">
            Show your personality ✨
          </Text>
          <Text className="text-gray-600 text-lg">
            Help matches see who you really are
          </Text>
        </View>

        {/* Hobbies */}
        <View className="mb-8">
          <Text className="text-lg font-bold text-gray-900 mb-3">
            What do you love doing? 💫
          </Text>
          <Text className="text-sm text-gray-600 mb-4">
            Select 1-10 hobbies • {hobbies.length} selected
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {/* Predefined hobbies */}
            {HOBBY_OPTIONS.map((hobby) => (
              <TouchableOpacity
                key={hobby}
                className={`px-4 py-3 rounded-full border-2 ${
                  hobbies.includes(hobby)
                    ? 'bg-lavender-500 border-lavender-500'
                    : 'bg-white border-gray-300'
                }`}
                onPress={() => toggleHobby(hobby)}
              >
                <Text
                  className={`text-sm font-semibold ${
                    hobbies.includes(hobby) ? 'text-white' : 'text-gray-700'
                  }`}
                >
                  {hobby}
                </Text>
              </TouchableOpacity>
            ))}

            {/* Custom hobbies (not in predefined list) */}
            {hobbies
              .filter(hobby => !HOBBY_OPTIONS.includes(hobby))
              .map((hobby) => (
                <TouchableOpacity
                  key={hobby}
                  className="px-4 py-3 rounded-full border-2 bg-lavender-500 border-lavender-500"
                  onPress={() => toggleHobby(hobby)}
                >
                  <Text className="text-sm font-semibold text-white">
                    {hobby}
                  </Text>
                </TouchableOpacity>
              ))}
          </View>

          {/* Add Custom Hobby */}
          <View className="mt-4">
            <View className="flex-row gap-2">
              <TextInput
                className="flex-1 bg-white border-2 border-gray-300 rounded-full px-4 py-3 text-gray-900"
                placeholder="Add your own hobby..."
                value={customHobby}
                onChangeText={setCustomHobby}
                placeholderTextColor="#9CA3AF"
                returnKeyType="done"
                onSubmitEditing={addCustomHobby}
                maxLength={30}
              />
              <TouchableOpacity
                className={`px-6 py-3 rounded-full ${
                  customHobby.trim() ? 'bg-lavender-500' : 'bg-gray-300'
                }`}
                onPress={addCustomHobby}
                disabled={!customHobby.trim()}
              >
                <MaterialCommunityIcons
                  name="plus-circle"
                  size={24}
                  color="white"
                />
              </TouchableOpacity>
            </View>
            <Text className="text-xs text-gray-500 mt-1 ml-4">
              Add custom hobbies not listed above
            </Text>
          </View>
        </View>

        {/* Favorites Section */}
        <View className="bg-white rounded-3xl p-6 shadow-sm border border-purple-100 mb-8">
          <View className="flex-row items-center mb-6">
            <MaterialCommunityIcons name="heart-multiple" size={28} color="#A08AB7" />
            <Text className="text-2xl font-bold text-gray-900 ml-2">
              Your Favorites
            </Text>
          </View>

          {/* Movies */}
          <View className="mb-6">
            <View className="flex-row items-center mb-2">
              <Text className="text-lg font-semibold text-gray-900">🎬 Movies</Text>
              <Text className="text-xs text-gray-500 ml-2">(optional)</Text>
            </View>
            <TextInput
              className="bg-purple-50 border-2 border-purple-200 rounded-2xl px-4 py-3 text-gray-900"
              placeholder="e.g., Moonlight, Carol, The Half of It"
              value={favoriteMovies}
              onChangeText={setFavoriteMovies}
              placeholderTextColor="#9CA3AF"
            />
            <Text className="text-xs text-gray-500 mt-1">Separate with commas</Text>
          </View>

          {/* Music */}
          <View className="mb-6">
            <View className="flex-row items-center mb-2">
              <Text className="text-lg font-semibold text-gray-900">🎵 Music Artists</Text>
              <Text className="text-xs text-gray-500 ml-2">(optional)</Text>
            </View>
            <TextInput
              className="bg-pink-50 border-2 border-pink-200 rounded-2xl px-4 py-3 text-gray-900"
              placeholder="e.g., Hayley Kiyoko, Troye Sivan, Chappell Roan"
              value={favoriteMusic}
              onChangeText={setFavoriteMusic}
              placeholderTextColor="#9CA3AF"
            />
            <Text className="text-xs text-gray-500 mt-1">Separate with commas</Text>
          </View>

          {/* Books */}
          <View className="mb-6">
            <View className="flex-row items-center mb-2">
              <Text className="text-lg font-semibold text-gray-900">📚 Books</Text>
              <Text className="text-xs text-gray-500 ml-2">(optional)</Text>
            </View>
            <TextInput
              className="bg-blue-50 border-2 border-blue-200 rounded-2xl px-4 py-3 text-gray-900"
              placeholder="e.g., Red White & Royal Blue, Stone Butch Blues"
              value={favoriteBooks}
              onChangeText={setFavoriteBooks}
              placeholderTextColor="#9CA3AF"
            />
            <Text className="text-xs text-gray-500 mt-1">Separate with commas</Text>
          </View>

          {/* TV Shows */}
          <View>
            <View className="flex-row items-center mb-2">
              <Text className="text-lg font-semibold text-gray-900">📺 TV Shows</Text>
              <Text className="text-xs text-gray-500 ml-2">(optional)</Text>
            </View>
            <TextInput
              className="bg-green-50 border-2 border-green-200 rounded-2xl px-4 py-3 text-gray-900"
              placeholder="e.g., Heartstopper, Pose, The L Word"
              value={favoriteTvShows}
              onChangeText={setFavoriteTvShows}
              placeholderTextColor="#9CA3AF"
            />
            <Text className="text-xs text-gray-500 mt-1">Separate with commas</Text>
          </View>
        </View>

        {/* Buttons */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 py-4 rounded-full border-2 border-gray-300 bg-white"
            onPress={() => goToPreviousOnboardingStep('/(onboarding)/interests')}
            disabled={loading}
          >
            <Text className="text-gray-700 text-center font-bold text-lg">Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-4 rounded-full ${
              loading || hobbies.length === 0
                ? 'bg-gray-400'
                : 'bg-lavender-500'
            }`}
            style={{
              borderRadius: 9999,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 16,
            }}
            onPress={handleContinue}
            disabled={loading || hobbies.length === 0}
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
