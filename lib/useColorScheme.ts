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

type ColorSchemePreference = 'light' | 'dark' | 'system';

/**
 * Custom hook for managing color scheme with persistence
 */
export function useColorScheme() {
  const { colorScheme, setColorScheme: setNativewindColorScheme } = useNativewindColorScheme();
  const systemColorScheme = useSystemColorScheme();

  /**
   * Set the color scheme with optional persistence
   */
  async function setColorScheme(scheme: ColorScheme) {
    setNativewindColorScheme(scheme);

    // Persist preference
    try {
      await AsyncStorage.setItem(COLOR_SCHEME_KEY, scheme);
    } catch (error) {
      console.error('Failed to persist color scheme:', error);
    }

    // Update Android navigation bar
    if (Platform.OS === 'android') {
      try {
        await setAndroidNavigationBar(scheme);
      } catch (error) {
        console.error('Failed to update Android navigation bar:', error);
      }
    }
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
        const stored = await AsyncStorage.getItem(COLOR_SCHEME_KEY);

        if (stored === 'light' || stored === 'dark') {
          setColorScheme(stored);

          if (Platform.OS === 'android') {
            await setAndroidNavigationBar(stored);
          }
        } else {
          // Default to system preference
          const scheme = systemColorScheme ?? 'light';
          setColorScheme(scheme);

          if (Platform.OS === 'android') {
            await setAndroidNavigationBar(scheme);
          }
        }
      } catch (error) {
        console.error('Failed to load color scheme preference:', error);
        // Fall back to system preference
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
