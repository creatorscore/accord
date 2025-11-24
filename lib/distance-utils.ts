/**
 * Utility functions for distance conversion and formatting
 * Supports both miles and kilometers based on user preference
 */

export type DistanceUnit = 'miles' | 'km';

/**
 * Convert miles to kilometers
 */
export function milesToKm(miles: number): number {
  return miles * 1.60934;
}

/**
 * Convert kilometers to miles
 */
export function kmToMiles(km: number): number {
  return km / 1.60934;
}

/**
 * Format distance for display based on user preference
 * @param distanceInMiles - The distance in miles (our internal storage format)
 * @param unit - The user's preferred unit ('miles' or 'km')
 * @param hideDistance - If true, returns 'Nearby' instead of actual distance
 * @returns Formatted distance string
 */
export function formatDistance(
  distanceInMiles: number | null | undefined,
  unit: DistanceUnit = 'miles',
  hideDistance: boolean = false
): string {
  // If user has distance hidden, show generic "Nearby"
  if (hideDistance) {
    return 'Nearby';
  }

  // If no distance available
  if (distanceInMiles === null || distanceInMiles === undefined) {
    return '';
  }

  if (unit === 'km') {
    const distanceInKm = milesToKm(distanceInMiles);
    if (distanceInKm < 1) {
      return '< 1 km away';
    }
    return `${Math.round(distanceInKm)} km away`;
  } else {
    // miles (default)
    if (distanceInMiles < 1) {
      return '< 1 mile away';
    }
    return `${Math.round(distanceInMiles)} miles away`;
  }
}

/**
 * Format distance for slider display (just the number and unit)
 * @param value - The distance value
 * @param unit - The unit to display
 * @returns Formatted string like "50 miles" or "80 km"
 */
export function formatDistanceSlider(value: number, unit: DistanceUnit = 'miles'): string {
  if (unit === 'km') {
    return `${Math.round(milesToKm(value))} km`;
  }
  return `${value} miles`;
}

/**
 * Get the maximum distance slider value based on unit
 * We store in miles internally, but display in user's preferred unit
 */
export function getMaxDistanceForUnit(unit: DistanceUnit): number {
  // Internal max is 500 miles
  return 500;
}

/**
 * Get slider step based on unit
 */
export function getDistanceStep(unit: DistanceUnit): number {
  return unit === 'km' ? 16 : 10; // ~16km ≈ 10 miles
}
