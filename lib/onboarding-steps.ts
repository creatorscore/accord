/**
 * Onboarding sub-step configuration
 * Each screen manages multiple sub-steps internally.
 * The progress bar reflects the global position across all sub-steps.
 */

export const ONBOARDING_STEP_COUNTS: Record<string, number> = {
  'basic-info': 10,          // name, birthday, gender, pronouns, orientation, ethnicity, location, hometown, occupation, education
  'photos': 1,               // photos + blur toggle
  'interests': 2,            // hobbies, favorites
  'prompts': 3,              // 3 prompt slots
  'voice-intro': 1,          // voice recording
  'marriage-preferences': 7, // reasons, relationship, children, housing, financial, lifestyle, non-negotiables
  'matching-preferences': 3, // age-range, distance, gender-pref
  'notifications': 1,        // enable notifications
};

const SCREEN_ORDER = [
  'basic-info',
  'photos',
  'interests',
  'prompts',
  'voice-intro',
  'marriage-preferences',
  'matching-preferences',
  'notifications',
];

export const TOTAL_ONBOARDING_STEPS = Object.values(ONBOARDING_STEP_COUNTS).reduce((a, b) => a + b, 0);

/**
 * Get the global step index for a given screen and sub-step.
 * Used to calculate progress bar position.
 */
export function getGlobalStep(screenName: string, subStep: number): number {
  let offset = 0;
  for (const screen of SCREEN_ORDER) {
    if (screen === screenName) break;
    offset += ONBOARDING_STEP_COUNTS[screen] || 0;
  }
  return offset + subStep;
}
