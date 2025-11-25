/**
 * Conditional Image Component
 *
 * Uses React Native Image in development (works in simulator)
 * Uses expo-image in production (better performance, caching)
 */

import { Image as ExpoImage, ImageProps as ExpoImageProps } from 'expo-image';
import { Image as RNImage, ImageProps as RNImageProps, StyleSheet } from 'react-native';

// Export the appropriate Image component based on environment
export const Image = __DEV__ ? RNImage : ExpoImage;

// Type helper for consistent API
export type ConditionalImageProps = __DEV__ ? RNImageProps : ExpoImageProps;

/**
 * Helper to convert props between React Native Image and expo-image
 * Handles the resizeMode vs contentFit difference
 */
export const normalizeImageProps = (props: any) => {
  if (__DEV__) {
    // Development: Use React Native Image API
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
