/**
 * Conditional Image Component
 *
 * Uses React Native Image in development/simulator (works in simulator)
 * Uses expo-image in production standalone builds (better performance, caching)
 */

import { Image as RNImage, ImageProps as RNImageProps } from 'react-native';
import Constants from 'expo-constants';

// Determine if we're in a production standalone build
// appOwnership === 'standalone' means App Store/Play Store build
// This is more reliable than __DEV__ which can be true in production with expo-dev-client
const isProduction = Constants.appOwnership === 'standalone';

// Conditionally require expo-image only in production to avoid simulator errors
let ExpoImage: any;
let ExpoImageProps: any;

if (isProduction) {
  try {
    const expoImageModule = require('expo-image');
    ExpoImage = expoImageModule.Image;
    ExpoImageProps = expoImageModule.ImageProps;
  } catch (error) {
    console.warn('Failed to load expo-image, falling back to React Native Image:', error);
    ExpoImage = RNImage;
    ExpoImageProps = RNImageProps;
  }
}

// Export the appropriate Image component based on environment
export const Image = isProduction ? ExpoImage : RNImage;

// Type helper for consistent API - accepts both React Native and Expo Image props
export type ConditionalImageProps = RNImageProps | ExpoImageProps;

/**
 * Helper to convert props between React Native Image and expo-image
 * Handles the resizeMode vs contentFit difference
 */
export const normalizeImageProps = (props: any) => {
  const isProduction = Constants.appOwnership === 'standalone';

  if (!isProduction) {
    // Development/Simulator: Use React Native Image API
    return {
      ...props,
      resizeMode: props.contentFit || props.resizeMode || 'cover',
      style: props.style,
    };
  } else {
    // Production: Use expo-image API
    return {
      ...props,
      contentFit: props.contentFit || props.resizeMode || 'cover',
      style: props.style,
    };
  }
};
