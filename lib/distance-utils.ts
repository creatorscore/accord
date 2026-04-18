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
export function getMaxDistanceForUnit(_unit: DistanceUnit): number {
  return DISTANCE_MAX;
}

/**
 * Get slider step based on unit
 */
export function getDistanceStep(unit: DistanceUnit): number {
  return unit === 'km' ? 16 : 10; // ~16km ≈ 10 miles
}

/**
 * Canonical distance range for all matching-distance sliders.
 * Anything at or above DISTANCE_MAX is shown as "Anywhere"; users who want
 * genuinely global search should use the separate `search_globally` toggle.
 */
export const DISTANCE_MIN = 5;
export const DISTANCE_MAX = 500;

/**
 * Non-linear mapping: higher resolution at short distances (5–100 mi) where
 * most users operate, compressing the long tail (100–500 mi). Slider position
 * is 0–1; miles are stored verbatim in the DB.
 */
export function distanceToSlider(miles: number): number {
  if (miles <= DISTANCE_MIN) return 0;
  if (miles >= DISTANCE_MAX) return 1;
  return Math.log(miles / DISTANCE_MIN) / Math.log(DISTANCE_MAX / DISTANCE_MIN);
}

export function sliderToDistance(position: number): number {
  if (position <= 0) return DISTANCE_MIN;
  if (position >= 1) return DISTANCE_MAX;
  const raw = DISTANCE_MIN * Math.pow(DISTANCE_MAX / DISTANCE_MIN, position);
  if (raw <= 25) return Math.round(raw);
  if (raw <= 100) return Math.round(raw / 5) * 5;
  if (raw <= 250) return Math.round(raw / 10) * 10;
  return Math.round(raw / 25) * 25;
}

/**
 * Display label: "42 mi", "68 km", or "Anywhere" when at/above DISTANCE_MAX.
 */
export function formatDistanceRangeLabel(miles: number, unit: DistanceUnit = 'miles', anywhereLabel: string = 'Anywhere'): string {
  if (miles >= DISTANCE_MAX) return anywhereLabel;
  if (unit === 'km') return `${Math.round(milesToKm(miles))} km`;
  return `${miles} mi`;
}
