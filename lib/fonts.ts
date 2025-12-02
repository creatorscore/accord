/**
 * Font Configuration for Accord
 *
 * Uses Plus Jakarta Sans for headings and Inter for body text.
 * Both fonts are loaded from Google Fonts via expo-font.
 *
 * Font Weights:
 * - Regular (400): Default body text
 * - Medium (500): Emphasized body, buttons
 * - SemiBold (600): Subheadings, labels
 * - Bold (700): Headings, CTAs
 */

import * as Font from 'expo-font';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';

/**
 * Font family names (must match tailwind.config.js)
 */
export const FontFamily = {
  // Plus Jakarta Sans - Headers
  display: 'PlusJakartaSans',
  displayMedium: 'PlusJakartaSans-Medium',
  displaySemiBold: 'PlusJakartaSans-SemiBold',
  displayBold: 'PlusJakartaSans-Bold',

  // Inter - Body
  sans: 'Inter',
  sansMedium: 'Inter-Medium',
  sansSemiBold: 'Inter-SemiBold',
  sansBold: 'Inter-Bold',
} as const;

/**
 * Font assets to load
 * These are loaded from @expo-google-fonts packages
 */
export const fontAssets = {
  // Plus Jakarta Sans
  'PlusJakartaSans': PlusJakartaSans_400Regular,
  'PlusJakartaSans-Medium': PlusJakartaSans_500Medium,
  'PlusJakartaSans-SemiBold': PlusJakartaSans_600SemiBold,
  'PlusJakartaSans-Bold': PlusJakartaSans_700Bold,

  // Inter
  'Inter': Inter_400Regular,
  'Inter-Medium': Inter_500Medium,
  'Inter-SemiBold': Inter_600SemiBold,
  'Inter-Bold': Inter_700Bold,
};

/**
 * Load all custom fonts
 *
 * Usage:
 * ```tsx
 * const [fontsLoaded] = useFonts();
 *
 * if (!fontsLoaded) {
 *   return <LoadingScreen />;
 * }
 * ```
 */
export async function loadFonts(): Promise<void> {
  await Font.loadAsync(fontAssets);
}

/**
 * Check if fonts are loaded
 */
export function areFontsLoaded(): boolean {
  return Object.keys(fontAssets).every((fontName) => Font.isLoaded(fontName));
}

export default fontAssets;
