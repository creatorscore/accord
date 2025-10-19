/**
 * Geolocation utilities for Accord
 * Privacy-conscious location handling for lavender marriage matching
 */

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
} | null> {
  try {
    const { requestForegroundPermissionsAsync, getCurrentPositionAsync } = await import('expo-location');

    // Request permission
    const { status } = await requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      console.log('Location permission denied');
      return null;
    }

    // Get current position
    const location = await getCurrentPositionAsync({
      accuracy: 4, // Balanced accuracy - not too precise for privacy
    });

    // TODO: Optionally use reverse geocoding to get city/state
    // For now, just return coordinates
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Error getting location:', error);
    return null;
  }
}
