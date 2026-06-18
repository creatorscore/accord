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
const appOwnership = Constants.appOwnership as string | null;
const isProduction = appOwnership === 'standalone';

// Conditionally require expo-image only in production to avoid simulator errors
let ExpoImage: any = RNImage;

if (isProduction) {
  try {
    const expoImageModule = require('expo-image');
    ExpoImage = expoImageModule.Image;
  } catch (error) {
    console.warn('Failed to load expo-image, falling back to React Native Image:', error);
    ExpoImage = RNImage;
  }
}

// Export the appropriate Image component based on environment
export const Image = isProduction ? ExpoImage : RNImage;

// Type helper for consistent API - accepts both React Native and Expo Image props
export type ConditionalImageProps = RNImageProps;

/**
 * Helper to convert props between React Native Image and expo-image
 * Handles the resizeMode vs contentFit difference
 */
export const normalizeImageProps = (props: any) => {
  const ownership = Constants.appOwnership as string | null;
  const isProd = ownership === 'standalone';

  if (!isProd) {
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

/**
 * Prefetch images to cache them before they're displayed
 * Works with both React Native Image and expo-image
 */
export const prefetchImages = async (urls: string[]): Promise<void> => {
  if (!urls || urls.length === 0) return;

  // Image.prefetch (both expo-image and RN Image) only supports HTTP(S).
  // Whitelist instead of blacklist: discover.tsx prefetches photos as
  // soon as profiles arrive, but the rest-batch is signed asynchronously
  // and `photo.url` is the raw storage path (e.g. <uuid>/<ts>.jpg) until
  // signing lands. The native loader rejected those paths with
  // "Unsupported uri scheme for encoded image fetch! Uri is: <uuid>..."
  // and emitted a WARN per profile, which compounded on low-end devices.
  urls = urls.filter(url => typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://')));
  if (urls.length === 0) return;

  const ownership = Constants.appOwnership as string | null;
  const isProd = ownership === 'standalone';

  try {
    if (isProd) {
      // Production: Use expo-image's prefetch
      const expoImageModule = require('expo-image');
      await expoImageModule.Image.prefetch(urls);
    } else {
      // Development: Use React Native Image's prefetch
      await Promise.all(urls.map(url => RNImage.prefetch(url)));
    }
  } catch (error) {
    // Silently fail - prefetching is a performance optimization, not critical
    console.warn('Image prefetch failed:', error);
  }
};
