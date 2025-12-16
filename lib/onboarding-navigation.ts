/**
 * Onboarding navigation helper
 * Handles backward navigation in onboarding flow when router.back() doesn't work
 * (e.g., when user lands directly on a step via redirect/replace)
 */

import { router } from 'expo-router';

// Onboarding steps in order
export const ONBOARDING_STEPS = [
  '/(onboarding)/basic-info',           // step 0
  '/(onboarding)/photos',               // step 1
  '/(onboarding)/about',                // step 2
  '/(onboarding)/personality',          // step 3
  '/(onboarding)/interests',            // step 4
  '/(onboarding)/prompts',              // step 5
  '/(onboarding)/voice-intro',          // step 6
  '/(onboarding)/marriage-preferences', // step 7
  '/(onboarding)/matching-preferences', // step 8
] as const;

export type OnboardingRoute = typeof ONBOARDING_STEPS[number];

/**
 * Navigate to the previous onboarding step
 * Always navigates to the logically previous step based on ONBOARDING_STEPS order
 * (Do NOT use router.back() as it goes to where user came from, not the logical previous step)
 */
export function goToPreviousOnboardingStep(currentRoute: OnboardingRoute) {
  const currentIndex = ONBOARDING_STEPS.indexOf(currentRoute);

  if (currentIndex > 0) {
    const previousRoute = ONBOARDING_STEPS[currentIndex - 1];
    // Use replace to avoid building up a confusing navigation stack
    router.replace(previousRoute);
  } else {
    // First step - sign out
    console.warn('Already at first onboarding step, cannot go back');
  }
}

/**
 * Navigate to the next onboarding step
 */
export function goToNextOnboardingStep(currentRoute: OnboardingRoute) {
  const currentIndex = ONBOARDING_STEPS.indexOf(currentRoute);

  if (currentIndex < ONBOARDING_STEPS.length - 1) {
    const nextRoute = ONBOARDING_STEPS[currentIndex + 1];
    router.push(nextRoute);
  } else {
    // Last step - go to main app
    router.replace('/(tabs)/discover');
  }
}
