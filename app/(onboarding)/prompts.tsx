import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { goToPreviousOnboardingStep } from '@/lib/onboarding-navigation';
import { validatePromptAnswer, validateContent } from '@/lib/content-moderation';

const PROMPTS = [
  'My ideal lavender marriage looks like...',
  'I\'m looking for someone who...',
  'The best partnership includes...',
  'A perfect Sunday with my partner would be...',
  'Together we could...',
  'I need a partner who understands...',
  'My ideal living situation is...',
  'Financial goals I want us to share...',
  'The most important thing in our arrangement...',
  'I can offer my partner...',
  'Deal breakers for me are...',
  'My vision for our future includes...',
  'What makes me a great partner is...',
  'I\'m passionate about...',
  'Green flags I\'m looking for...',
  'A fun fact about me...',
  'My love language is...',
  'I\'m secretly really good at...',
  'The key to my heart is...',
  'My guilty pleasure is...',
];

interface PromptAnswer {
  prompt: string;
  answer: string;
}

export default function Prompts() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [selectedPrompts, setSelectedPrompts] = useState<PromptAnswer[]>([
    { prompt: '', answer: '' },
    { prompt: '', answer: '' },
    { prompt: '', answer: '' },
  ]);
  const [showPromptPicker, setShowPromptPicker] = useState<number | null>(null);
  const [showCustomPromptInput, setShowCustomPromptInput] = useState<number | null>(null);
  const [customPromptText, setCustomPromptText] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, prompt_answers')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setProfileId(data.id);
        // Pre-fill prompts if data exists
        if (data.prompt_answers && Array.isArray(data.prompt_answers) && data.prompt_answers.length > 0) {
          // Pad with empty slots if less than 3 prompts saved
          const loadedPrompts = [...data.prompt_answers];
          while (loadedPrompts.length < 3) {
            loadedPrompts.push({ prompt: '', answer: '' });
          }
          setSelectedPrompts(loadedPrompts.slice(0, 3));
        }
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const selectPrompt = (index: number, prompt: string) => {
    const newPrompts = [...selectedPrompts];
    newPrompts[index] = { prompt, answer: newPrompts[index].answer };
    setSelectedPrompts(newPrompts);
    setShowPromptPicker(null);
  };

  const handleCustomPrompt = () => {
    if (showPromptPicker === null) return;
    setShowPromptPicker(null);
    setShowCustomPromptInput(showPromptPicker);
  };

  const saveCustomPrompt = () => {
    if (showCustomPromptInput === null || !customPromptText.trim()) return;

    // Validate custom prompt for profanity and gibberish
    const validation = validateContent(customPromptText, {
      checkProfanity: true,
      checkContactInfo: false,
      checkGibberish: true,
      fieldName: 'custom prompt',
    });

    if (!validation.isValid) {
      Alert.alert(
        validation.moderationResult?.isGibberish ? 'Invalid Prompt' : 'Inappropriate Content',
        validation.error
      );
      return;
    }

    selectPrompt(showCustomPromptInput, customPromptText.trim());
    setCustomPromptText('');
    setShowCustomPromptInput(null);
  };

  const updateAnswer = (index: number, answer: string) => {
    const newPrompts = [...selectedPrompts];
    newPrompts[index].answer = answer;
    setSelectedPrompts(newPrompts);
  };

  const handleContinue = async () => {
    const filledPrompts = selectedPrompts.filter(
      (p) => p.prompt && p.answer.trim()
    );

    if (filledPrompts.length === 0) {
      Alert.alert('Required', 'Please answer at least one prompt');
      return;
    }

    // Check all prompt answers for profanity, contact info, and gibberish
    for (let i = 0; i < filledPrompts.length; i++) {
      const validation = validateContent(filledPrompts[i].answer, {
        checkProfanity: true,
        checkContactInfo: true,
        checkGibberish: true,
        fieldName: 'prompt answer',
      });
      if (!validation.isValid) {
        Alert.alert(
          validation.moderationResult?.isGibberish ? 'Invalid Response' : 'Inappropriate Content',
          validation.error
        );
        return;
      }
    }

    if (!profileId) {
      Alert.alert('Error', 'Profile not found. Please start over.');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase
        .from('profiles')
        .update({
          prompt_answers: filledPrompts,
          onboarding_step: 5,
        })
        .eq('id', profileId);

      if (error) throw error;

      router.push('/(onboarding)/voice-intro');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to save prompts');
    } finally {
      setLoading(false);
    }
  };

  const usedPrompts = selectedPrompts.map((p) => p.prompt).filter(Boolean);
  const availablePrompts = PROMPTS.filter((p) => !usedPrompts.includes(p));

  return (
    <ScrollView
      className="flex-1 bg-white dark:bg-gray-900"
      contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 20) + 32 }}
    >
      <View className="px-6" style={{ paddingTop: Platform.OS === 'android' ? 8 : 64 }}>
        {/* Progress */}
        <View className="mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-gray-600 dark:text-gray-400 font-medium">Step 5 of 7</Text>
            <Text className="text-sm text-lavender-500 font-bold">71%</Text>
          </View>
          <View className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <View
              className="h-3 bg-lavender-500 rounded-full"
              style={{ width: '71%' }}
            />
          </View>
        </View>

        {/* Header */}
        <View className="mb-8">
          <Text className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Tell your story 💭
          </Text>
          <Text className="text-gray-600 dark:text-gray-400 text-lg">
            Answer prompts to spark meaningful conversations
          </Text>
        </View>

        {/* Prompts */}
        {selectedPrompts.map((promptAnswer, index) => (
          <View key={index} className="mb-6">
            {!promptAnswer.prompt ? (
              <TouchableOpacity
                className="bg-purple-100 dark:bg-purple-900/30 border-2 border-dashed border-purple-300 dark:border-purple-700 rounded-3xl p-6 items-center"
                onPress={() => setShowPromptPicker(index)}
              >
                <MaterialCommunityIcons name="plus-circle" size={40} color="#A08AB7" />
                <Text className="text-purple-700 dark:text-purple-300 font-bold text-lg mt-2">
                  Choose a prompt
                </Text>
              </TouchableOpacity>
            ) : (
              <View className="bg-white dark:bg-gray-800 border-2 border-purple-200 dark:border-purple-700 rounded-3xl overflow-hidden shadow-sm">
                <TouchableOpacity
                  className="bg-lavender-500 px-6 py-4 flex-row justify-between items-center"
                  onPress={() => setShowPromptPicker(index)}
                >
                  <Text className="text-white font-bold text-base flex-1">
                    {promptAnswer.prompt}
                  </Text>
                  <MaterialCommunityIcons name="pencil" size={20} color="white" />
                </TouchableOpacity>
                <View className="p-6">
                  <TextInput
                    className="text-gray-900 dark:text-white text-lg min-h-24"
                    placeholder="Your answer..."
                    value={promptAnswer.answer}
                    onChangeText={(text) => updateAnswer(index, text)}
                    multiline
                    textAlignVertical="top"
                    maxLength={200}
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text className="text-xs text-gray-500 dark:text-gray-400 mt-2 text-right">
                    {promptAnswer.answer.length}/200
                  </Text>
                </View>
              </View>
            )}
          </View>
        ))}

        {/* Prompt Picker Modal */}
        {showPromptPicker !== null && (
          <View className="absolute inset-0 bg-black/50 items-center justify-center px-6 z-50">
            <View className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full max-h-96">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-gray-900 dark:text-white">
                  Choose a prompt
                </Text>
                <TouchableOpacity onPress={() => setShowPromptPicker(null)}>
                  <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView className="max-h-80">
                {/* Write Your Own Option */}
                <TouchableOpacity
                  className="py-4 border-b-2 border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-900/30 rounded-xl mb-2 px-4 flex-row items-center"
                  onPress={handleCustomPrompt}
                >
                  <MaterialCommunityIcons name="pencil-plus" size={24} color="#A08AB7" />
                  <Text className="text-purple-700 dark:text-purple-300 font-bold text-base ml-3">
                    ✨ Write your own prompt
                  </Text>
                </TouchableOpacity>

                {/* Predefined Prompts */}
                {availablePrompts.map((prompt) => (
                  <TouchableOpacity
                    key={prompt}
                    className="py-4 border-b border-gray-200 dark:border-gray-700"
                    onPress={() => selectPrompt(showPromptPicker, prompt)}
                  >
                    <Text className="text-gray-700 dark:text-gray-300 text-base">{prompt}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Custom Prompt Input Modal */}
        {showCustomPromptInput !== null && (
          <View className="absolute inset-0 bg-black/50 items-center justify-center px-6 z-50">
            <View className="bg-white dark:bg-gray-800 rounded-3xl p-6 w-full">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-gray-900 dark:text-white">
                  Write your own prompt
                </Text>
                <TouchableOpacity onPress={() => {
                  setShowCustomPromptInput(null);
                  setCustomPromptText('');
                }}>
                  <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <Text className="text-gray-600 dark:text-gray-400 mb-4">
                Create a unique question that helps showcase your personality! 💫
              </Text>

              <TextInput
                className="bg-gray-100 dark:bg-gray-700 rounded-2xl p-4 text-gray-900 dark:text-white text-base mb-2 min-h-24"
                placeholder="e.g., What I'm most excited to share with a partner is..."
                value={customPromptText}
                onChangeText={setCustomPromptText}
                multiline
                textAlignVertical="top"
                maxLength={100}
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
              <Text className="text-xs text-gray-500 dark:text-gray-400 mb-4 text-right">
                {customPromptText.length}/100
              </Text>

              <TouchableOpacity
                className={`py-4 rounded-full ${
                  customPromptText.trim().length < 10 ? 'bg-gray-300 dark:bg-gray-600' : 'bg-purple-600'
                }`}
                onPress={saveCustomPrompt}
                disabled={customPromptText.trim().length < 10}
              >
                <Text className="text-white text-center font-bold text-lg">
                  Use This Prompt
                </Text>
              </TouchableOpacity>

              <Text className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
                Minimum 10 characters
              </Text>
            </View>
          </View>
        )}

        {/* Tips */}
        <View className="bg-purple-50 dark:bg-purple-900/30 border-2 border-purple-200 dark:border-purple-700 rounded-3xl p-5 mb-8">
          <View className="flex-row items-center mb-3">
            <MaterialCommunityIcons name="lightbulb-on" size={24} color="#A08AB7" />
            <Text className="text-purple-900 dark:text-purple-300 font-bold text-lg ml-2">Pro Tips</Text>
          </View>
          <Text className="text-purple-800 dark:text-purple-200 text-sm mb-2">
            ✨ Be specific and authentic - generic answers don't stand out
          </Text>
          <Text className="text-purple-800 dark:text-purple-200 text-sm mb-2">
            💬 Show your personality - humor, vulnerability, and honesty work
          </Text>
          <Text className="text-purple-800 dark:text-purple-200 text-sm">
            🎯 Focus on what matters in a lavender marriage partnership
          </Text>
        </View>

        {/* Buttons */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 py-4 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            onPress={() => goToPreviousOnboardingStep('/(onboarding)/prompts')}
            disabled={loading}
          >
            <Text className="text-gray-700 dark:text-gray-300 text-center font-bold text-lg">Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-4 rounded-full ${
              loading || !selectedPrompts.some((p) => p.prompt && p.answer.trim())
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
            disabled={loading || !selectedPrompts.some((p) => p.prompt && p.answer.trim())}
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
