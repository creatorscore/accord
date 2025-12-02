/**
 * React Navigation Theme Configuration
 *
 * Provides theme objects compatible with @react-navigation/native's ThemeProvider.
 * Automatically syncs with our color system for consistent styling.
 */

import { DefaultTheme, DarkTheme, Theme } from '@react-navigation/native';
import { COLORS } from './colors';

/**
 * Light mode navigation theme
 */
const LightNavigationTheme: Theme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    primary: COLORS.light.primary,
    background: COLORS.light.background,
    card: COLORS.light.card,
    text: COLORS.light.foreground,
    border: COLORS.light.border,
    notification: COLORS.light.destructive,
  },
};

/**
 * Dark mode navigation theme
 */
const DarkNavigationTheme: Theme = {
  ...DarkTheme,
  dark: true,
  colors: {
    primary: COLORS.dark.primary,
    background: COLORS.dark.background,
    card: COLORS.dark.card,
    text: COLORS.dark.foreground,
    border: COLORS.dark.border,
    notification: COLORS.dark.destructive,
  },
};

/**
 * Navigation theme object for ThemeProvider
 *
 * Usage:
 * ```tsx
 * import { NAV_THEME } from '@/theme';
 * import { useColorScheme } from '@/lib/useColorScheme';
 *
 * const { colorScheme } = useColorScheme();
 * <ThemeProvider value={NAV_THEME[colorScheme]}>
 * ```
 */
export const NAV_THEME = {
  light: LightNavigationTheme,
  dark: DarkNavigationTheme,
} as const;

export default NAV_THEME;
