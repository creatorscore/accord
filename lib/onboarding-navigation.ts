/**
 * Onboarding navigation helper
 * Simplified for the new single-route onboarding flow.
 */

import { router } from 'expo-router';

export const ONBOARDING_ROUTE = '/(onboarding)/onboarding';

/** Navigate to onboarding at a specific step */
export function goToOnboarding(resumeStep: number = 0) {
  router.replace(`${ONBOARDING_ROUTE}?resumeStep=${resumeStep}`);
}

/** Exit onboarding and go to the main app */
export function exitOnboarding() {
  router.replace('/(tabs)/discover');
}

// ── Legacy exports (kept for any remaining references during migration) ──

export type OnboardingRoute = string;

export const ONBOARDING_STEPS = [ONBOARDING_ROUTE] as const;

export function goToPreviousOnboardingStep(_currentRoute: string) {
  router.back();
}

export function goToNextOnboardingStep(_currentRoute: string) {
  // In the new flow, next-step logic is handled internally by the orchestrator
  router.replace(ONBOARDING_ROUTE);
}
