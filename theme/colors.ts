/**
 * Accord Color System
 *
 * Modern, minimal palette with lavender as the primary accent.
 * Designed for eye comfort during long usage sessions.
 *
 * Usage:
 * - import { COLORS } from '@/theme/colors';
 * - COLORS.light.primary or COLORS.dark.primary
 */

import { Platform } from 'react-native';

/**
 * Lavender palette - Our signature color
 */
export const LAVENDER = {
  50:  '#F8F6FB',
  100: '#F3F0F7',
  200: '#E2D8EC',
  300: '#CDC2E5',
  400: '#B7A4CC',
  500: '#A08AB7', // Primary brand purple
  600: '#7B6794',
  700: '#5F4F73',
  800: '#473A56',
  900: '#2F2638',
} as const;

/**
 * Light mode colors
 */
const LIGHT_COLORS = {
  // Base
  white: 'rgb(255, 255, 255)',
  black: 'rgb(10, 10, 11)',

  // Backgrounds
  background: 'rgb(255, 255, 255)',
  foreground: 'rgb(31, 41, 55)',

  // Cards & Surfaces
  card: 'rgb(255, 255, 255)',
  cardForeground: 'rgb(31, 41, 55)',

  // Popover
  popover: 'rgb(255, 255, 255)',
  popoverForeground: 'rgb(31, 41, 55)',

  // Primary - Brand lavender (#A08AB7)
  primary: 'rgb(160, 138, 183)',         // lavender-500
  primaryForeground: 'rgb(255, 255, 255)',

  // Secondary
  secondary: 'rgb(248, 246, 251)',       // lavender-50
  secondaryForeground: 'rgb(71, 58, 86)', // lavender-800

  // Muted
  muted: 'rgb(249, 250, 251)',
  mutedForeground: 'rgb(107, 114, 128)',

  // Accent
  accent: 'rgb(243, 240, 247)',          // lavender-100
  accentForeground: 'rgb(47, 38, 56)',   // lavender-900

  // Destructive
  destructive: 'rgb(239, 68, 68)',
  destructiveForeground: 'rgb(255, 255, 255)',

  // Border & Input
  border: 'rgb(229, 231, 235)',
  input: 'rgb(229, 231, 235)',
  ring: 'rgb(160, 138, 183)',

  // Semantic
  success: 'rgb(34, 197, 94)',
  warning: 'rgb(245, 158, 11)',
  info: 'rgb(59, 130, 246)',

  // Grays (warm-toned for eye comfort)
  grey: 'rgb(107, 114, 128)',
  grey2: 'rgb(156, 163, 175)',
  grey3: 'rgb(209, 213, 219)',
  grey4: 'rgb(229, 231, 235)',
  grey5: 'rgb(243, 244, 246)',
  grey6: 'rgb(249, 250, 251)',
} as const;

/**
 * Dark mode colors
 */
const DARK_COLORS = {
  // Base
  white: 'rgb(255, 255, 255)',
  black: 'rgb(10, 10, 11)',

  // Backgrounds
  background: 'rgb(10, 10, 11)',
  foreground: 'rgb(250, 250, 250)',

  // Cards & Surfaces (elevated)
  card: 'rgb(24, 24, 27)',
  cardForeground: 'rgb(250, 250, 250)',

  // Popover
  popover: 'rgb(24, 24, 27)',
  popoverForeground: 'rgb(250, 250, 250)',

  // Primary - Brighter brand lavender for dark mode (#B7A4CC)
  primary: 'rgb(183, 164, 204)',         // lavender-400
  primaryForeground: 'rgb(10, 10, 11)',

  // Secondary
  secondary: 'rgb(39, 39, 42)',
  secondaryForeground: 'rgb(226, 216, 236)', // lavender-200

  // Muted
  muted: 'rgb(39, 39, 42)',
  mutedForeground: 'rgb(161, 161, 170)',

  // Accent
  accent: 'rgb(63, 63, 70)',
  accentForeground: 'rgb(205, 194, 229)', // lavender-300

  // Destructive
  destructive: 'rgb(220, 38, 38)',
  destructiveForeground: 'rgb(255, 255, 255)',

  // Border & Input
  border: 'rgb(39, 39, 42)',
  input: 'rgb(39, 39, 42)',
  ring: 'rgb(183, 164, 204)',

  // Semantic
  success: 'rgb(74, 222, 128)',
  warning: 'rgb(251, 191, 36)',
  info: 'rgb(96, 165, 250)',

  // Grays
  grey: 'rgb(161, 161, 170)',
  grey2: 'rgb(113, 113, 122)',
  grey3: 'rgb(82, 82, 91)',
  grey4: 'rgb(63, 63, 70)',
  grey5: 'rgb(39, 39, 42)',
  grey6: 'rgb(24, 24, 27)',
} as const;

/**
 * Combined colors object
 */
export const COLORS = {
  light: LIGHT_COLORS,
  dark: DARK_COLORS,
  lavender: LAVENDER,
} as const;

export type ColorScheme = 'light' | 'dark';
export type ThemeColors = typeof LIGHT_COLORS;

export default COLORS;
