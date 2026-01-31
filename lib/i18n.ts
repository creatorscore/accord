import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import translation files
import en from '@/locales/en.json';
import ar from '@/locales/ar.json';
import hi from '@/locales/hi.json';
import ur from '@/locales/ur.json';
import fa from '@/locales/fa.json';
import he from '@/locales/he.json';
import tr from '@/locales/tr.json';
import bn from '@/locales/bn.json';
import id from '@/locales/id.json';
import ru from '@/locales/ru.json';
import zh from '@/locales/zh.json';
import fr from '@/locales/fr.json';
import de from '@/locales/de.json';
import pl from '@/locales/pl.json';
import ka from '@/locales/ka.json';
import es from '@/locales/es.json';
import it from '@/locales/it.json';
import pt from '@/locales/pt.json';
import uk from '@/locales/uk.json';

const LANGUAGE_STORAGE_KEY = '@accord_language';

const resources = {
  en: { translation: en },
  ar: { translation: ar },
  hi: { translation: hi },
  ur: { translation: ur },
  fa: { translation: fa },
  he: { translation: he },
  tr: { translation: tr },
  bn: { translation: bn },
  id: { translation: id },
  ru: { translation: ru },
  zh: { translation: zh },
  fr: { translation: fr },
  de: { translation: de },
  pl: { translation: pl },
  ka: { translation: ka },
  es: { translation: es },
  it: { translation: it },
  pt: { translation: pt },
  uk: { translation: uk },
};

// RTL languages
export const RTL_LANGUAGES = ['ar', 'he', 'fa', 'ur'];

// Track if i18n is initialized
let isInitialized = false;

// Detect device locale synchronously (fast operation)
const deviceLocale = Localization.getLocales()[0]?.languageCode || 'en';

// Initialize i18n SYNCHRONOUSLY with device locale (no async/await blocking)
// This prevents the 1-2 second startup delay on low-RAM devices
i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: deviceLocale, // Use device locale immediately, don't wait for AsyncStorage
    fallbackLng: 'en',
    compatibilityJSON: 'v3',
    interpolation: {
      escapeValue: false, // React already escapes
    },
    react: {
      useSuspense: false,
    },
  } as any);

isInitialized = true;

/**
 * Load saved language preference AFTER app renders
 * Call this in the background - don't await it during startup
 */
const loadSavedLanguage = async () => {
  try {
    const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (savedLanguage && savedLanguage !== i18n.language) {
      await i18n.changeLanguage(savedLanguage);
    }
  } catch (error) {
    console.error('Error loading saved language:', error);
  }
};

/**
 * @deprecated Use loadSavedLanguage() in background instead
 * Kept for backward compatibility - now returns immediately
 */
const initI18n = async () => {
  // i18n is already initialized synchronously above
  // Just load saved language preference in background
  loadSavedLanguage().catch(console.error);
  return i18n;
};

// Change language and persist preference
export const changeLanguage = async (languageCode: string) => {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
  return i18n.changeLanguage(languageCode);
};

/**
 * Sync the user's language preference to the database
 * This enables server-side localized push notifications
 *
 * @param languageCode - The language code to sync (e.g., 'en', 'es', 'ar')
 * @param profileId - The user's profile ID
 * @returns Promise that resolves when sync is complete
 */
export const syncLanguageToDatabase = async (
  languageCode: string,
  profileId: string
): Promise<void> => {
  try {
    // Dynamic import to avoid circular dependency
    const { supabase } = await import('./supabase');

    const { error } = await supabase
      .from('profiles')
      .update({ preferred_language: languageCode })
      .eq('id', profileId);

    if (error) {
      console.error('Error syncing language to database:', error);
    } else {
      console.log(`Language preference synced to database: ${languageCode}`);
    }
  } catch (error) {
    console.error('Error syncing language to database:', error);
  }
};

export const getCurrentLanguage = () => i18n.language;

export const isRTL = () => RTL_LANGUAGES.includes(i18n.language);

export const isI18nReady = () => isInitialized;

export { initI18n, loadSavedLanguage };
export default i18n;
