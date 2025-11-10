import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
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
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setProfileId(data.id);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load profile');
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

    // Validate custom prompt
    const validation = validateContent(customPromptText, {
      checkProfanity: true,
      checkContactInfo: false,
      fieldName: 'custom prompt',
    });

    if (!validation.isValid) {
      Alert.alert('Inappropriate Content', validation.error);
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

    // Check all prompt answers for profanity and contact info
    for (let i = 0; i < filledPrompts.length; i++) {
      const validation = validateContent(filledPrompts[i].answer, {
        checkProfanity: true,
        checkContactInfo: true,
        fieldName: 'prompt answer',
      });
      if (!validation.isValid) {
        Alert.alert('Inappropriate Content', validation.error);
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
    <ScrollView className="flex-1 bg-white">
      <View className="px-6 pt-16 pb-8">
        {/* Progress */}
        <View className="mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-gray-600 font-medium">Step 5 of 7</Text>
            <Text className="text-sm text-primary-500 font-bold">71%</Text>
          </View>
          <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-3 bg-primary-500 rounded-full"
              style={{ width: '71%' }}
            />
          </View>
        </View>

        {/* Header */}
        <View className="mb-8">
          <Text className="text-4xl font-bold text-gray-900 mb-3">
            Tell your story 💭
          </Text>
          <Text className="text-gray-600 text-lg">
            Answer prompts to spark meaningful conversations
          </Text>
        </View>

        {/* Prompts */}
        {selectedPrompts.map((promptAnswer, index) => (
          <View key={index} className="mb-6">
            {!promptAnswer.prompt ? (
              <TouchableOpacity
                className="bg-purple-100 border-2 border-dashed border-purple-300 rounded-3xl p-6 items-center"
                onPress={() => setShowPromptPicker(index)}
              >
                <MaterialCommunityIcons name="plus-circle" size={40} color="#9B87CE" />
                <Text className="text-purple-700 font-bold text-lg mt-2">
                  Choose a prompt
                </Text>
              </TouchableOpacity>
            ) : (
              <View className="bg-white border-2 border-purple-200 rounded-3xl overflow-hidden shadow-sm">
                <TouchableOpacity
                  className="bg-primary-500 px-6 py-4 flex-row justify-between items-center"
                  onPress={() => setShowPromptPicker(index)}
                >
                  <Text className="text-white font-bold text-base flex-1">
                    {promptAnswer.prompt}
                  </Text>
                  <MaterialCommunityIcons name="pencil" size={20} color="white" />
                </TouchableOpacity>
                <View className="p-6">
                  <TextInput
                    className="text-gray-900 text-lg min-h-24"
                    placeholder="Your answer..."
                    value={promptAnswer.answer}
                    onChangeText={(text) => updateAnswer(index, text)}
                    multiline
                    textAlignVertical="top"
                    maxLength={200}
                    placeholderTextColor="#9CA3AF"
                  />
                  <Text className="text-xs text-gray-500 mt-2 text-right">
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
            <View className="bg-white rounded-3xl p-6 w-full max-h-96">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-gray-900">
                  Choose a prompt
                </Text>
                <TouchableOpacity onPress={() => setShowPromptPicker(null)}>
                  <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <ScrollView className="max-h-80">
                {/* Write Your Own Option */}
                <TouchableOpacity
                  className="py-4 border-b-2 border-purple-300 bg-purple-50 rounded-xl mb-2 px-4 flex-row items-center"
                  onPress={handleCustomPrompt}
                >
                  <MaterialCommunityIcons name="pencil-plus" size={24} color="#9B87CE" />
                  <Text className="text-purple-700 font-bold text-base ml-3">
                    ✨ Write your own prompt
                  </Text>
                </TouchableOpacity>

                {/* Predefined Prompts */}
                {availablePrompts.map((prompt) => (
                  <TouchableOpacity
                    key={prompt}
                    className="py-4 border-b border-gray-200"
                    onPress={() => selectPrompt(showPromptPicker, prompt)}
                  >
                    <Text className="text-gray-700 text-base">{prompt}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>
        )}

        {/* Custom Prompt Input Modal */}
        {showCustomPromptInput !== null && (
          <View className="absolute inset-0 bg-black/50 items-center justify-center px-6 z-50">
            <View className="bg-white rounded-3xl p-6 w-full">
              <View className="flex-row justify-between items-center mb-4">
                <Text className="text-xl font-bold text-gray-900">
                  Write your own prompt
                </Text>
                <TouchableOpacity onPress={() => {
                  setShowCustomPromptInput(null);
                  setCustomPromptText('');
                }}>
                  <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>

              <Text className="text-gray-600 mb-4">
                Create a unique question that helps showcase your personality! 💫
              </Text>

              <TextInput
                className="bg-gray-100 rounded-2xl p-4 text-gray-900 text-base mb-2 min-h-24"
                placeholder="e.g., What I'm most excited to share with a partner is..."
                value={customPromptText}
                onChangeText={setCustomPromptText}
                multiline
                textAlignVertical="top"
                maxLength={100}
                placeholderTextColor="#9CA3AF"
                autoFocus
              />
              <Text className="text-xs text-gray-500 mb-4 text-right">
                {customPromptText.length}/100
              </Text>

              <TouchableOpacity
                className={`py-4 rounded-full ${
                  customPromptText.trim().length < 10 ? 'bg-gray-300' : 'bg-purple-600'
                }`}
                onPress={saveCustomPrompt}
                disabled={customPromptText.trim().length < 10}
              >
                <Text className="text-white text-center font-bold text-lg">
                  Use This Prompt
                </Text>
              </TouchableOpacity>

              <Text className="text-xs text-gray-500 text-center mt-3">
                Minimum 10 characters
              </Text>
            </View>
          </View>
        )}

        {/* Tips */}
        <View className="bg-purple-50 border-2 border-purple-200 rounded-3xl p-5 mb-8">
          <View className="flex-row items-center mb-3">
            <MaterialCommunityIcons name="lightbulb-on" size={24} color="#9B87CE" />
            <Text className="text-purple-900 font-bold text-lg ml-2">Pro Tips</Text>
          </View>
          <Text className="text-purple-800 text-sm mb-2">
            ✨ Be specific and authentic - generic answers don't stand out
          </Text>
          <Text className="text-purple-800 text-sm mb-2">
            💬 Show your personality - humor, vulnerability, and honesty work
          </Text>
          <Text className="text-purple-800 text-sm">
            🎯 Focus on what matters in a lavender marriage partnership
          </Text>
        </View>

        {/* Buttons */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 py-4 rounded-full border-2 border-gray-300 bg-white"
            onPress={() => goToPreviousOnboardingStep('/(onboarding)/prompts')}
            disabled={loading}
          >
            <Text className="text-gray-700 text-center font-bold text-lg">Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-4 rounded-full ${
              loading || !selectedPrompts.some((p) => p.prompt && p.answer.trim())
                ? 'bg-gray-400'
                : 'bg-primary-500'
            }`}
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
