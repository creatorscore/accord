import PostHog from 'posthog-react-native';

const POSTHOG_API_KEY = process.env.EXPO_PUBLIC_POSTHOG_API_KEY;
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com';

let posthogClient: PostHog | null = null;

/**
 * Initialize PostHog for analytics and session recording
 */
export const initializePostHog = async () => {
  // Don't initialize in development or without API key
  if (__DEV__ || !POSTHOG_API_KEY) {
    console.log('PostHog not initialized (development mode or missing API key)');
    return null;
  }

  try {
    posthogClient = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      // Enable session recording (be mindful of privacy)
      captureMode: 'screen',
      // Enable autocapture for button clicks, screen changes, etc.
      autocapture: true,
    });

    console.log('✅ PostHog initialized');
    return posthogClient;
  } catch (error) {
    console.error('Failed to initialize PostHog:', error);
    return null;
  }
};

/**
 * Track an event
 */
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (!posthogClient) {
    if (__DEV__) {
      console.log(`📊 Event: ${eventName}`, properties);
    }
    return;
  }

  posthogClient.capture(eventName, properties);
};

/**
 * Identify a user
 */
export const identifyUser = (userId: string, traits?: Record<string, any>) => {
  if (!posthogClient) return;

  posthogClient.identify(userId, traits);
};

/**
 * Reset user identity (on logout)
 */
export const resetUser = () => {
  if (!posthogClient) return;

  posthogClient.reset();
};

/**
 * Track a screen view
 */
export const trackScreen = (screenName: string, properties?: Record<string, any>) => {
  if (!posthogClient) {
    if (__DEV__) {
      console.log(`📱 Screen: ${screenName}`, properties);
    }
    return;
  }

  posthogClient.screen(screenName, properties);
};

/**
 * Set user properties
 */
export const setUserProperties = (properties: Record<string, any>) => {
  if (!posthogClient) return;

  posthogClient.identify(undefined, properties);
};

/**
 * Track app lifecycle events
 */
export const trackAppLifecycle = {
  appStarted: (isFirstLaunch: boolean = false) =>
    trackEvent('app_started', { first_launch: isFirstLaunch }),
  appBackgrounded: () => trackEvent('app_backgrounded'),
  appForegrounded: () => trackEvent('app_foregrounded'),
  appInstalled: (platform: 'ios' | 'android', version: string) =>
    trackEvent('app_installed', { platform, version }),
};

/**
 * Track user actions
 */
export const trackUserAction = {
  // Auth
  signUp: (method: 'email' | 'google' | 'apple') =>
    trackEvent('user_signed_up', { method }),
  signIn: (method: 'email' | 'google' | 'apple') =>
    trackEvent('user_signed_in', { method }),
  signOut: () =>
    trackEvent('user_signed_out'),

  // Onboarding
  onboardingStarted: () =>
    trackEvent('onboarding_started'),
  onboardingCompleted: () =>
    trackEvent('onboarding_completed'),
  onboardingStepCompleted: (step: number, stepName: string) =>
    trackEvent('onboarding_step_completed', { step, stepName }),

  // Matching
  profileViewed: (profileId: string) =>
    trackEvent('profile_viewed', { profileId }),
  swipedLeft: (profileId: string) =>
    trackEvent('swiped_left', { profileId }),
  swipedRight: (profileId: string) =>
    trackEvent('swiped_right', { profileId }),
  matched: (matchId: string) =>
    trackEvent('matched', { matchId }),
  unmatched: (matchId: string, reason?: string) =>
    trackEvent('unmatched', { matchId, reason }),

  // Messaging
  messageSent: (matchId: string, messageType: 'text' | 'image' | 'voice') =>
    trackEvent('message_sent', { matchId, messageType }),
  messageReceived: (matchId: string) =>
    trackEvent('message_received', { matchId }),

  // Premium
  paywallViewed: (feature?: string) =>
    trackEvent('paywall_viewed', { feature }),
  subscriptionStarted: (tier: 'premium' | 'platinum', plan: 'monthly' | 'annual') =>
    trackEvent('subscription_started', { tier, plan }),
  subscriptionCancelled: (tier: string) =>
    trackEvent('subscription_cancelled', { tier }),

  // Profile
  profileEdited: (section: string) =>
    trackEvent('profile_edited', { section }),
  photoUploaded: () =>
    trackEvent('photo_uploaded'),
  verificationStarted: (type: string) =>
    trackEvent('verification_started', { type }),
  verificationCompleted: (type: string, status: 'approved' | 'rejected') =>
    trackEvent('verification_completed', { type, status }),

  // Safety
  userBlocked: (blockedUserId: string, reason?: string) =>
    trackEvent('user_blocked', { blockedUserId, reason }),
  userReported: (reportedUserId: string, reportType: string) =>
    trackEvent('user_reported', { reportedUserId, reportType }),

  // Settings
  settingsChanged: (setting: string, value: any) =>
    trackEvent('settings_changed', { setting, value }),
};

/**
 * Track errors (complement to Sentry)
 */
export const trackError = (errorName: string, error: Error, context?: Record<string, any>) => {
  trackEvent('error_occurred', {
    errorName,
    errorMessage: error.message,
    errorStack: error.stack,
    ...context,
  });
};

// Export PostHog client for advanced use cases
export { posthogClient };
