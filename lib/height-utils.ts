/**
 * Utility functions for height conversion and formatting
 * Supports both imperial (feet/inches) and metric (cm)
 */

export type HeightUnit = 'imperial' | 'metric';

/**
 * Convert inches to centimeters
 */
export function inchesToCm(inches: number): number {
  return Math.round(inches * 2.54);
}

/**
 * Convert centimeters to inches
 */
export function cmToInches(cm: number): number {
  return Math.round(cm / 2.54);
}

/**
 * Convert total inches to feet and inches
 */
export function inchesToFeetAndInches(totalInches: number): { feet: number; inches: number } {
  const feet = Math.floor(totalInches / 12);
  const inches = totalInches % 12;
  return { feet, inches };
}

/**
 * Convert feet and inches to total inches
 */
export function feetAndInchesToInches(feet: number, inches: number): number {
  return (feet * 12) + inches;
}

/**
 * Format height for display based on user preference
 * @param heightInInches - The height in inches (our internal storage format)
 * @param unit - The user's preferred unit ('imperial' or 'metric')
 * @returns Formatted height string
 */
export function formatHeight(
  heightInInches: number | null | undefined,
  unit: HeightUnit = 'imperial'
): string {
  if (heightInInches === null || heightInInches === undefined) {
    return '';
  }

  if (unit === 'metric') {
    const cm = inchesToCm(heightInInches);
    return `${cm} cm`;
  } else {
    // imperial (default)
    const { feet, inches } = inchesToFeetAndInches(heightInInches);
    if (inches === 0) {
      return `${feet}'`;
    }
    return `${feet}'${inches}"`;
  }
}

/**
 * Format height for display with full text
 * @param heightInInches - The height in inches (our internal storage format)
 * @param unit - The user's preferred unit ('imperial' or 'metric')
 * @returns Formatted height string with unit labels
 */
export function formatHeightFull(
  heightInInches: number | null | undefined,
  unit: HeightUnit = 'imperial'
): string {
  if (heightInInches === null || heightInInches === undefined) {
    return '';
  }

  if (unit === 'metric') {
    const cm = inchesToCm(heightInInches);
    return `${cm} centimeters`;
  } else {
    // imperial (default)
    const { feet, inches } = inchesToFeetAndInches(heightInInches);
    if (inches === 0) {
      return `${feet} feet`;
    }
    return `${feet} feet ${inches} inches`;
  }
}

/**
 * Get height range for picker/slider in the appropriate unit
 */
export function getHeightRange(unit: HeightUnit): { min: number; max: number; step: number } {
  if (unit === 'metric') {
    // 120cm to 220cm (roughly 4' to 7'3")
    return { min: 120, max: 220, step: 1 };
  } else {
    // 48 inches (4') to 87 inches (7'3")
    return { min: 48, max: 87, step: 1 };
  }
}

/**
 * Parse height input value based on unit
 * For metric: just the cm value
 * For imperial: feet and inches
 */
export function parseHeightInput(
  value: number,
  unit: HeightUnit
): number {
  if (unit === 'metric') {
    // Convert cm to inches for storage
    return cmToInches(value);
  }
  return value; // Already in inches
}
