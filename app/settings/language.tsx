import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  I18nManager,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage, RTL_LANGUAGES } from '@/lib/i18n';
import * as Updates from 'expo-updates';

interface Language {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  isRTL: boolean;
}

const LANGUAGES: Language[] = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', isRTL: false },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', isRTL: true },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', isRTL: false },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', flag: '🇵🇰', isRTL: true },
  { code: 'fa', name: 'Persian (Farsi)', nativeName: 'فارسی', flag: '🇮🇷', isRTL: true },
  { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱', isRTL: true },
  { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', isRTL: false },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', flag: '🇧🇩', isRTL: false },
  { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia', flag: '🇮🇩', isRTL: false },
  { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', isRTL: false },
  { code: 'zh', name: 'Mandarin Chinese', nativeName: '简体中文', flag: '🇨🇳', isRTL: false },
];

export default function LanguageSettings() {
  const { t, i18n } = useTranslation();
  const [currentLang, setCurrentLang] = useState(getCurrentLanguage());

  const handleLanguageChange = async (languageCode: string) => {
    const selectedLanguage = LANGUAGES.find((lang) => lang.code === languageCode);
    if (!selectedLanguage) return;

    const currentIsRTL = I18nManager.isRTL;
    const newIsRTL = selectedLanguage.isRTL;

    try {
      // Change language
      await changeLanguage(languageCode);
      setCurrentLang(languageCode);

      // If RTL direction changed, need to reload the app
      if (currentIsRTL !== newIsRTL) {
        Alert.alert(
          t('common.success'),
          'Language changed! The app will reload to apply text direction changes.',
          [
            {
              text: t('common.continue'),
              onPress: async () => {
                // Force RTL layout
                I18nManager.forceRTL(newIsRTL);

                // Reload the app
                if (!__DEV__) {
                  await Updates.reloadAsync();
                } else {
                  // In development, just navigate back
                  router.back();
                }
              },
            },
          ]
        );
      } else {
        Alert.alert(
          t('common.success'),
          'Language changed successfully!',
          [
            {
              text: 'OK',
              onPress: () => router.back(),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error changing language:', error);
      Alert.alert(t('common.error'), 'Failed to change language. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.language')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', delay: 100 }}
          style={styles.infoBanner}
        >
          <LinearGradient colors={['#EFF6FF', '#DBEAFE']} style={styles.infoBannerGradient}>
            <MaterialCommunityIcons name="translate" size={24} color="#3B82F6" />
            <View style={styles.infoBannerContent}>
              <Text style={styles.infoBannerTitle}>Global Language Support</Text>
              <Text style={styles.infoBannerText}>
                Accord is available in multiple languages. RTL (right-to-left) support included for
                Arabic, Hebrew, Persian, and Urdu.
              </Text>
            </View>
          </LinearGradient>
        </MotiView>

        {/* Language List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SELECT LANGUAGE</Text>

          {LANGUAGES.map((language, index) => (
            <MotiView
              key={language.code}
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: index * 50 }}
            >
              <TouchableOpacity
                style={[
                  styles.languageCard,
                  currentLang === language.code && styles.languageCardSelected,
                ]}
                onPress={() => handleLanguageChange(language.code)}
              >
                <View style={styles.languageContent}>
                  <Text style={styles.languageFlag}>{language.flag}</Text>
                  <View style={styles.languageText}>
                    <Text style={styles.languageName}>{language.name}</Text>
                    <Text style={styles.languageNative}>{language.nativeName}</Text>
                  </View>
                </View>

                {currentLang === language.code ? (
                  <MaterialCommunityIcons name="check-circle" size={24} color="#9B87CE" />
                ) : (
                  <MaterialCommunityIcons name="circle-outline" size={24} color="#D1D5DB" />
                )}

                {language.isRTL && (
                  <View style={styles.rtlBadge}>
                    <Text style={styles.rtlBadgeText}>RTL</Text>
                  </View>
                )}
              </TouchableOpacity>
            </MotiView>
          ))}
        </View>

        {/* Help Text */}
        <View style={styles.helpSection}>
          <MaterialCommunityIcons name="information-outline" size={20} color="#6B7280" />
          <Text style={styles.helpText}>
            Changing to a language with different text direction (RTL/LTR) will require reloading
            the app.
          </Text>
        </View>

        {/* Contribution Notice */}
        <View style={styles.contributeSection}>
          <Text style={styles.contributeTitle}>Help Translate</Text>
          <Text style={styles.contributeText}>
            Want to help translate Accord into your language? We support 11 languages and are
            always looking to expand. Contact us to contribute!
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  infoBanner: {
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoBannerGradient: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
  },
  infoBannerContent: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  infoBannerText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 24,
    marginBottom: 12,
  },
  languageCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  languageCardSelected: {
    borderColor: '#9B87CE',
    backgroundColor: '#F3E8FF',
  },
  languageContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  languageFlag: {
    fontSize: 32,
  },
  languageText: {
    flex: 1,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  languageNative: {
    fontSize: 14,
    color: '#6B7280',
  },
  rtlBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  rtlBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1E40AF',
  },
  helpSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FEF3C7',
    padding: 16,
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  helpText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
  contributeSection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  contributeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  contributeText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
});
