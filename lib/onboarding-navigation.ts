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
 * Uses router.back() if possible, otherwise navigates to the previous step manually
 */
export function goToPreviousOnboardingStep(currentRoute: OnboardingRoute) {
  // Try to use router.back() first (preserves form state if user navigated forward)
  if (router.canGoBack()) {
    router.back();
    return;
  }

  // If can't go back, manually navigate to previous step
  const currentIndex = ONBOARDING_STEPS.indexOf(currentRoute);

  if (currentIndex > 0) {
    const previousRoute = ONBOARDING_STEPS[currentIndex - 1];
    router.push(previousRoute);
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
