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

const initI18n = async () => {
  // Try to get saved language preference
  const savedLanguage = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);

  // Detect device locale
  const deviceLocale = Localization.getLocales()[0]?.languageCode || 'en';

  // Use saved language or device locale, fallback to English
  const initialLanguage = savedLanguage || deviceLocale || 'en';

  i18n
    .use(initReactI18next)
    .init({
      resources,
      lng: initialLanguage,
      fallbackLng: 'en',
      compatibilityJSON: 'v3',
      interpolation: {
        escapeValue: false, // React already escapes
      },
      react: {
        useSuspense: false,
      },
    } as any);

  return i18n;
};

// Change language and persist preference
export const changeLanguage = async (languageCode: string) => {
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
  return i18n.changeLanguage(languageCode);
};

export const getCurrentLanguage = () => i18n.language;

export const isRTL = () => RTL_LANGUAGES.includes(i18n.language);

export { initI18n };
export default i18n;
