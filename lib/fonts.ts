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
 *
 * PERFORMANCE: Reduced from 8 fonts to 4 essential fonts
 * This significantly improves cold-start time on low-RAM devices (1.5-2GB)
 * Each font adds ~50-100ms to startup on slow devices
 *
 * We keep:
 * - PlusJakartaSans-Bold: Headers and titles
 * - Inter: Body text (regular)
 * - Inter-Medium: Emphasized text and buttons
 * - Inter-SemiBold: Labels and subheadings
 *
 * Removed (use fallback weights):
 * - PlusJakartaSans (400): Use Inter instead
 * - PlusJakartaSans-Medium (500): Use Inter-Medium instead
 * - PlusJakartaSans-SemiBold (600): Use Inter-SemiBold instead
 * - Inter-Bold (700): Use Inter-SemiBold instead
 */
export const fontAssets = {
  // Plus Jakarta Sans - Only Bold for headers
  'PlusJakartaSans-Bold': PlusJakartaSans_700Bold,
  // Fallback aliases for compatibility (point to available fonts)
  'PlusJakartaSans': Inter_400Regular,
  'PlusJakartaSans-Medium': Inter_500Medium,
  'PlusJakartaSans-SemiBold': Inter_600SemiBold,

  // Inter - Core body fonts
  'Inter': Inter_400Regular,
  'Inter-Medium': Inter_500Medium,
  'Inter-SemiBold': Inter_600SemiBold,
  'Inter-Bold': Inter_600SemiBold, // Use SemiBold as Bold fallback
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
