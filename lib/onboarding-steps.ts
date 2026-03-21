/**
 * Onboarding step configuration.
 * The new flow uses a single screen with 30 sub-steps (0-29).
 * Each sub-step = one question = one progress bar increment.
 */

import { TOTAL_ONBOARDING_STEPS as TOTAL } from './onboarding-config';

export const TOTAL_ONBOARDING_STEPS = TOTAL;

// Legacy exports kept for OnboardingLayout compatibility
export const ONBOARDING_STEP_COUNTS: Record<string, number> = {
  'onboarding': TOTAL,
};

/**
 * Get the global step index. In the new flat flow, this is just the sub-step index.
 */
export function getGlobalStep(_screenName: string, subStep: number): number {
  return subStep;
}
