/**
 * Onboarding navigation helper
 * Handles backward navigation in onboarding flow when router.back() doesn't work
 * (e.g., when user lands directly on a step via redirect/replace)
 */

import { router } from 'expo-router';

// Onboarding steps in order
export const ONBOARDING_STEPS = [
  '/(onboarding)/basic-info',           // step 0
  '/(onboarding)/personality',          // step 1
  '/(onboarding)/photos',               // step 2
  '/(onboarding)/interests',            // step 3
  '/(onboarding)/prompts',              // step 4
  '/(onboarding)/voice-intro',          // step 5
  '/(onboarding)/marriage-preferences', // step 6
  '/(onboarding)/matching-preferences', // step 7
  '/(onboarding)/notifications',        // step 8
] as const;

export type OnboardingRoute = typeof ONBOARDING_STEPS[number];

/**
 * Navigate to the previous onboarding step.
 * Uses router.back() since forward navigation uses router.push(),
 * so the previous screen is always on the stack.
 */
export function goToPreviousOnboardingStep(currentRoute: OnboardingRoute) {
  const currentIndex = ONBOARDING_STEPS.indexOf(currentRoute);

  if (currentIndex > 0) {
    if (router.canGoBack()) {
      router.back();
    } else {
      // Fallback: user landed here via redirect, navigate explicitly
      const previousRoute = ONBOARDING_STEPS[currentIndex - 1];
      router.replace(previousRoute);
    }
  } else {
    // First step - nowhere to go back to
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
