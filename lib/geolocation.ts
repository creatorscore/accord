/**
 * Geolocation utilities for Accord
 * Privacy-conscious location handling for lavender marriage matching
 */
// Platform MUST be a static named import. `await import('react-native')` builds
// an ES-module namespace, which reads every export of react-native/index.js and
// so fires its deprecated getters (ProgressBarAndroid, Clipboard,
// PushNotificationIOS). PushNotificationIOS.js constructs a NativeEventEmitter
// against a native module that isn't in our binary, throwing an Invariant
// Violation that becomes a fatal JSI crash on iOS (Sentry REACT-76).
import { Platform } from 'react-native';

/**
 * Width of the length-bounded text columns on `profiles`, mirrored from the
 * DB schema. Postgres rejects an over-long value outright (SQLSTATE 22001,
 * "value too long for type character varying(N)") rather than truncating, so
 * anything we write from an unbounded source has to be clamped client-side.
 *
 * The unbounded source that actually bit us is reverse geocoding: iOS returns
 * localized, fully-spelled region names (Sentry REACT-8N — a user in Brussels
 * on a ru_BE locale hard-blocked at onboarding step 4, retried 3x in 15s, then
 * gave up). Longest region currently stored is 47 chars against a 50 cap, so
 * the margin was effectively gone for non-US users.
 */
export const PROFILE_TEXT_LIMITS = {
  location_city: 100,
  location_state: 50,
  location_country: 50,
  display_name: 100,
  pronouns: 50,
  zodiac_sign: 50,
  occupation: 100,
  education: 100,
  religion: 100,
  political_views: 100,
  hometown: 255,
  preferred_language: 5,
} as const;

export type ProfileTextField = keyof typeof PROFILE_TEXT_LIMITS;

/**
 * Clamp a free-text value to a Postgres varchar(N) width.
 *
 * Prefers cutting on a word boundary so a truncated region reads as
 * "Brussels-Capital" rather than "Brussels-Capital Reg", but only when the
 * boundary is reasonably close to the limit — otherwise a single long token
 * would collapse to almost nothing.
 *
 * Note on units: JS `.length` counts UTF-16 code units while Postgres counts
 * characters, so for any non-BMP input this clamps *more* than strictly
 * required. That's the safe direction (never under-clamps); we only guard
 * against slicing a surrogate pair in half, which would produce invalid UTF-8.
 *
 * Returns undefined for empty/whitespace-only input so callers can omit the
 * key rather than writing an empty string.
 */
export function clampText(value: string | null | undefined, max: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length <= max) return trimmed;

  let cut = trimmed.slice(0, max);

  // Don't leave a dangling high surrogate at the cut point.
  const lastCode = cut.charCodeAt(cut.length - 1);
  if (lastCode >= 0xd800 && lastCode <= 0xdbff) {
    cut = cut.slice(0, -1);
  }

  const lastSpace = cut.lastIndexOf(' ');
  if (lastSpace >= Math.floor(max * 0.6)) {
    cut = cut.slice(0, lastSpace);
  }

  return cut.trim() || undefined;
}

/**
 * Clamp a named `profiles` text field to its column width.
 */
export function clampProfileField(
  field: ProfileTextField,
  value: string | null | undefined,
): string | undefined {
  return clampText(value, PROFILE_TEXT_LIMITS[field]);
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in miles
 */
export function calculateDistance(
  lat1: number | null,
  lon1: number | null,
  lat2: number | null,
  lon2: number | null
): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999;

  const R = 3959; // Radius of Earth in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance);
}

/**
 * Format distance for display with privacy in mind
 * Rounds to nearest 5 miles for privacy
 *
 * @param distanceMiles - Actual distance in miles
 * @param hideDistance - User's privacy setting
 * @param willingToRelocate - If user is willing to relocate
 * @returns Human-readable distance string
 */
export function formatDistance(
  distanceMiles: number | null | undefined,
  hideDistance: boolean = false,
  willingToRelocate: boolean = false
): string {
  // If user has privacy enabled, show generic text
  if (hideDistance) {
    return 'Nearby';
  }

  // If no distance data available
  if (!distanceMiles || distanceMiles >= 999999) {
    return willingToRelocate ? 'Willing to relocate' : 'Location unavailable';
  }

  // Very close - same neighborhood (< 2 miles)
  if (distanceMiles < 2) {
    return 'Less than 2 miles away';
  }

  // Close - same city (< 10 miles)
  if (distanceMiles < 10) {
    return 'Nearby'; // Privacy-friendly for very close matches
  }

  // Same metro area (< 25 miles) - round to nearest 5
  if (distanceMiles < 25) {
    const rounded = Math.round(distanceMiles / 5) * 5;
    return `About ${rounded} miles away`;
  }

  // Nearby cities (< 50 miles) - round to nearest 10
  if (distanceMiles < 50) {
    const rounded = Math.round(distanceMiles / 10) * 10;
    return `About ${rounded} miles away`;
  }

  // Same state/region (< 200 miles) - round to nearest 25
  if (distanceMiles < 200) {
    const rounded = Math.round(distanceMiles / 25) * 25;
    return `About ${rounded} miles away`;
  }

  // Far away - just show willing to relocate status
  if (willingToRelocate) {
    return 'Willing to relocate';
  }

  return `${Math.round(distanceMiles / 50) * 50}+ miles away`;
}

/**
 * Format location for display
 * Shows city, state for privacy (not exact coordinates)
 *
 * @param city - City name
 * @param state - State abbreviation
 * @param country - Country (optional, defaults to US)
 * @returns Formatted location string
 */
export function formatLocation(
  city: string | null | undefined,
  state: string | null | undefined,
  country: string | null | undefined = 'US'
): string {
  if (!city && !state) {
    return 'Location not set';
  }

  if (city && state) {
    return `${city}, ${state}`;
  }

  if (city) {
    return city;
  }

  if (state) {
    return state;
  }

  return 'Location not set';
}

/**
 * Get location display text for profile card
 * Combines city/state with distance if available
 *
 * @param profile - Profile data
 * @param currentUserLat - Current user's latitude
 * @param currentUserLon - Current user's longitude
 * @param hideDistance - Privacy setting
 * @returns Full location display string
 */
export function getLocationDisplay(
  profile: {
    location_city?: string | null;
    location_state?: string | null;
    location_country?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    hide_distance?: boolean;
  },
  currentUserLat?: number | null,
  currentUserLon?: number | null,
  willingToRelocate: boolean = false
): {
  location: string;
  distance: string | null;
} {
  const location = formatLocation(
    profile.location_city,
    profile.location_state,
    profile.location_country
  );

  // Calculate distance if both users have coordinates
  let distance: string | null = null;
  if (currentUserLat && currentUserLon && profile.latitude && profile.longitude) {
    const distanceMiles = calculateDistance(
      currentUserLat,
      currentUserLon,
      profile.latitude,
      profile.longitude
    );
    distance = formatDistance(distanceMiles, profile.hide_distance, willingToRelocate);
  } else if (willingToRelocate) {
    distance = 'Willing to relocate';
  }

  return { location, distance };
}

/**
 * Update user's location coordinates
 * Used when user explicitly refreshes their location
 */
export async function updateUserLocation(): Promise<{
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  accuracy?: number;
  error?: string;
} | null> {
  try {
    const Location = await import('expo-location');

    // Request permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }

    // Try getLastKnownPositionAsync first (instant, no GPS needed)
    // This prevents the hang/crash on Android with getCurrentPositionAsync
    let location = await Location.getLastKnownPositionAsync();

    if (!location) {
      // Fall back to getCurrentPositionAsync
      // Use Balanced accuracy on Android (Highest can hang/crash on Samsung)
      const accuracy = Platform.OS === 'android'
        ? Location.Accuracy.Balanced
        : Location.Accuracy.Highest;

      location = await Location.getCurrentPositionAsync({ accuracy });
    }

    // CRITICAL: Reject poor accuracy (iOS approximate location issue)
    // If accuracy > 100 meters, user likely has "Approximate Location" enabled
    // This prevents storing fake/generalized coordinates
    if (location.coords.accuracy !== null && location.coords.accuracy > 100) {
      console.error('❌ Location accuracy too low:', location.coords.accuracy, 'meters');
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? undefined,
        error: 'approximate_location'
      };
    }

    // Optionally use reverse geocoding to get city/state
    try {
      const [address] = await Location.reverseGeocodeAsync({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Clamp at the source: `address.city`/`address.region` come from the OS
      // geocoder and are unbounded, but land in varchar(100)/varchar(50).
      // Every caller of updateUserLocation() writes these straight to the
      // profiles row, so clamping here fixes all of them at once.
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        city: clampProfileField('location_city', address.city),
        state: clampProfileField('location_state', address.region),
        accuracy: location.coords.accuracy ?? undefined,
      };
    } catch (geocodeError) {
      // If geocoding fails, still return coordinates
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy ?? undefined,
      };
    }
  } catch (error) {
    console.error('Error getting location:', error);
    return null;
  }
}
