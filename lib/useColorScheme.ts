/**
 * useColorScheme Hook
 *
 * Provides color scheme management with persistence and system sync.
 * Integrates with NativeWind and Android navigation bar.
 */

import { useColorScheme as useNativewindColorScheme } from 'nativewind';
import * as NavigationBar from 'expo-navigation-bar';
import * as React from 'react';
import { Platform, useColorScheme as useSystemColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, type ColorScheme, type ThemeColors } from '@/theme/colors';

const COLOR_SCHEME_KEY = '@accord_color_scheme';
const COLOR_SCHEME_PREFERENCE_KEY = '@accord_color_scheme_preference';

export type ColorSchemePreference = 'light' | 'dark' | 'system';

// Global state for preference (shared across hook instances)
let globalPreference: ColorSchemePreference = 'system';
const preferenceListeners = new Set<(pref: ColorSchemePreference) => void>();

function notifyPreferenceChange(pref: ColorSchemePreference) {
  globalPreference = pref;
  preferenceListeners.forEach((listener) => listener(pref));
}

/**
 * Custom hook for managing color scheme with persistence
 */
export function useColorScheme() {
  const { colorScheme, setColorScheme: setNativewindColorScheme } = useNativewindColorScheme();
  const systemColorScheme = useSystemColorScheme();
  const [preference, setPreferenceState] = React.useState<ColorSchemePreference>(globalPreference);

  // Subscribe to preference changes
  React.useEffect(() => {
    const listener = (pref: ColorSchemePreference) => setPreferenceState(pref);
    preferenceListeners.add(listener);
    return () => {
      preferenceListeners.delete(listener);
    };
  }, []);

  // Sync with system when preference is 'system'
  React.useEffect(() => {
    if (preference === 'system' && systemColorScheme) {
      setNativewindColorScheme(systemColorScheme);
      if (Platform.OS === 'android') {
        setAndroidNavigationBar(systemColorScheme).catch(console.error);
      }
    }
  }, [preference, systemColorScheme]);

  /**
   * Set the color scheme preference with persistence
   */
  async function setColorSchemePreference(pref: ColorSchemePreference) {
    // Persist preference
    try {
      await AsyncStorage.setItem(COLOR_SCHEME_PREFERENCE_KEY, pref);
    } catch (error) {
      console.error('Failed to persist color scheme preference:', error);
    }

    notifyPreferenceChange(pref);

    // Apply the actual color scheme
    const actualScheme = pref === 'system' ? (systemColorScheme ?? 'light') : pref;
    setNativewindColorScheme(actualScheme);

    // Also store the resolved scheme for legacy support
    try {
      await AsyncStorage.setItem(COLOR_SCHEME_KEY, actualScheme);
    } catch (error) {
      console.error('Failed to persist color scheme:', error);
    }

    // Update Android navigation bar
    if (Platform.OS === 'android') {
      try {
        await setAndroidNavigationBar(actualScheme);
      } catch (error) {
        console.error('Failed to update Android navigation bar:', error);
      }
    }
  }

  /**
   * Set the color scheme directly (for backward compatibility)
   */
  async function setColorScheme(scheme: ColorScheme) {
    return setColorSchemePreference(scheme);
  }

  /**
   * Toggle between light and dark mode
   */
  function toggleColorScheme() {
    const newScheme = colorScheme === 'light' ? 'dark' : 'light';
    return setColorScheme(newScheme);
  }

  /**
   * Get the resolved color scheme (handles 'system' preference)
   */
  const resolvedColorScheme: ColorScheme = colorScheme ?? systemColorScheme ?? 'light';

  return {
    /** Current color scheme ('light' or 'dark') */
    colorScheme: resolvedColorScheme,

    /** Whether dark mode is active */
    isDarkColorScheme: resolvedColorScheme === 'dark',

    /** Set the color scheme */
    setColorScheme,

    /** Set the color scheme preference (system, light, or dark) */
    setColorSchemePreference,

    /** Current preference setting ('system', 'light', or 'dark') */
    preference,

    /** Toggle between light and dark */
    toggleColorScheme,

    /** Current theme colors */
    colors: COLORS[resolvedColorScheme] as ThemeColors,
  };
}

/**
 * Hook to initialize color scheme from storage on app start
 */
export function useInitializeColorScheme() {
  const { setColorScheme } = useNativewindColorScheme();
  const systemColorScheme = useSystemColorScheme();

  React.useEffect(() => {
    async function loadStoredPreference() {
      try {
        // First try to load the preference (system, light, dark)
        const storedPreference = await AsyncStorage.getItem(COLOR_SCHEME_PREFERENCE_KEY);

        let preference: ColorSchemePreference = 'system';
        if (storedPreference === 'light' || storedPreference === 'dark' || storedPreference === 'system') {
          preference = storedPreference;
        } else {
          // Check legacy key for backward compatibility
          const legacyStored = await AsyncStorage.getItem(COLOR_SCHEME_KEY);
          if (legacyStored === 'light' || legacyStored === 'dark') {
            preference = legacyStored;
          }
        }

        // Update global preference
        notifyPreferenceChange(preference);

        // Resolve actual scheme
        const actualScheme = preference === 'system' ? (systemColorScheme ?? 'light') : preference;
        setColorScheme(actualScheme);

        if (Platform.OS === 'android') {
          await setAndroidNavigationBar(actualScheme);
        }
      } catch (error) {
        console.error('Failed to load color scheme preference:', error);
        // Fall back to system preference
        notifyPreferenceChange('system');
        setColorScheme(systemColorScheme ?? 'light');
      }
    }

    loadStoredPreference();
  }, []);
}

/**
 * Hook to sync Android navigation bar with current theme
 */
export function useInitialAndroidBarSync() {
  const { colorScheme } = useColorScheme();

  React.useEffect(() => {
    if (Platform.OS !== 'android') return;

    setAndroidNavigationBar(colorScheme).catch((error) => {
      console.error('Failed to sync Android navigation bar:', error);
    });
  }, [colorScheme]);
}

/**
 * Update Android navigation bar to match theme
 */
async function setAndroidNavigationBar(colorScheme: ColorScheme) {
  if (Platform.OS !== 'android') return;

  const isDark = colorScheme === 'dark';

  return Promise.all([
    NavigationBar.setButtonStyleAsync(isDark ? 'light' : 'dark'),
    NavigationBar.setPositionAsync('absolute'),
    NavigationBar.setBackgroundColorAsync(
      isDark ? 'rgba(10, 10, 11, 0.9)' : 'rgba(255, 255, 255, 0.9)'
    ),
  ]);
}

export default useColorScheme;
