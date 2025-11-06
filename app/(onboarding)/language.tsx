import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { changeLanguage } from '@/lib/i18n';

const LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰' },
  { code: 'fa', name: 'Persian', nativeName: 'فارسی', flag: '🇮🇷' },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱' },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩' },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺' },
  { code: 'zh', name: 'Chinese', nativeName: '中文', flag: '🇨🇳' },
];

export default function LanguageSelection() {
  const router = useRouter();
  const { i18n } = useTranslation();
  const [selectedLanguage, setSelectedLanguage] = useState(i18n.language || 'en');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    try {
      setLoading(true);

      // Change language
      await changeLanguage(selectedLanguage);

      // Navigate to basic info (first onboarding step)
      router.push('/(onboarding)/basic-info');
    } catch (error: any) {
      Alert.alert('Error', 'Failed to set language. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-6 pt-16 pb-8">
        {/* Header */}
        <View className="mb-8">
          <View className="items-center mb-6">
            <Text className="text-6xl mb-4">🌍</Text>
            <Text className="text-4xl font-bold text-gray-900 mb-3 text-center">
              Choose Your Language
            </Text>
            <Text className="text-gray-600 text-lg text-center">
              Accord is available in 12 languages.{'\n'}Select your preferred language to continue.
            </Text>
          </View>
        </View>

        {/* Language List */}
        <View className="space-y-3 mb-8">
          {LANGUAGES.map((language) => (
            <TouchableOpacity
              key={language.code}
              className={`px-6 py-4 rounded-xl border-2 flex-row items-center justify-between ${
                selectedLanguage === language.code
                  ? 'bg-primary-50 border-primary-500'
                  : 'bg-white border-gray-200'
              }`}
              onPress={() => setSelectedLanguage(language.code)}
            >
              <View className="flex-row items-center flex-1">
                <Text className="text-3xl mr-4">{language.flag}</Text>
                <View>
                  <Text
                    className={`text-lg font-semibold ${
                      selectedLanguage === language.code
                        ? 'text-primary-500'
                        : 'text-gray-900'
                    }`}
                  >
                    {language.nativeName}
                  </Text>
                  <Text className="text-sm text-gray-500">{language.name}</Text>
                </View>
              </View>
              {selectedLanguage === language.code && (
                <MaterialCommunityIcons name="check-circle" size={24} color="#9B87CE" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Info Banner */}
        <View className="bg-purple-50 rounded-xl p-4 mb-6 flex-row">
          <MaterialCommunityIcons name="information" size={24} color="#9B87CE" />
          <View className="flex-1 ml-3">
            <Text className="text-sm text-gray-700">
              <Text className="font-semibold">Global Community: </Text>
              You can change your language anytime in Settings. Connect with users worldwide or search locally.
            </Text>
          </View>
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          className={`rounded-full py-4 px-8 items-center shadow-lg ${
            loading ? 'bg-gray-300' : 'bg-primary-500'
          }`}
          onPress={handleContinue}
          disabled={loading}
        >
          <Text className="text-white font-bold text-lg">
            {loading ? 'Setting Language...' : 'Continue'}
          </Text>
        </TouchableOpacity>

        {/* Skip Button */}
        <TouchableOpacity
          className="mt-4 py-3 items-center"
          onPress={() => router.push('/(onboarding)/basic-info')}
        >
          <Text className="text-gray-500 text-base">
            Skip (Continue in English)
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
