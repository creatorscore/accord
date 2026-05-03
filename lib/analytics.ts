import PostHog, { PostHogProvider } from 'posthog-react-native';
import Constants from 'expo-constants';

// Get PostHog config from environment OR app.json extra config (fallback)
const POSTHOG_API_KEY =
  process.env.EXPO_PUBLIC_POSTHOG_API_KEY ||
  Constants.expoConfig?.extra?.postHogApiKey;

const POSTHOG_HOST =
  process.env.EXPO_PUBLIC_POSTHOG_HOST ||
  Constants.expoConfig?.extra?.postHogHost ||
  'https://us.i.posthog.com';

let posthogClient: PostHog | null = null;

/**
 * Get or create the PostHog client (synchronous after first call).
 * The PostHog constructor is synchronous — no need for async init.
 */
export const getPostHogClient = (): PostHog | null => {
  if (posthogClient) return posthogClient;

  if (!POSTHOG_API_KEY) {
    console.error('❌ PostHog not initialized: Missing EXPO_PUBLIC_POSTHOG_API_KEY');
    return null;
  }

  try {
    posthogClient = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      debug: __DEV__,
      captureNativeAppLifecycleEvents: true,
      flushAt: 5,
      flushInterval: 30000,
    } as any);

    console.log('[PostHog] ✅ Client created:', POSTHOG_API_KEY.substring(0, 8) + '...', 'Host:', POSTHOG_HOST);
    return posthogClient;
  } catch (error) {
    console.error('❌ Failed to create PostHog client:', error);
    return null;
  }
};

/**
 * @deprecated Use getPostHogClient() instead. Kept for backward compat.
 */
export const initializePostHog = async () => {
  return getPostHogClient();
};

/**
 * Track an event
 */
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  const client = getPostHogClient();
  if (!client) return;

  try {
    client.capture(eventName, properties);
  } catch (error) {
    console.error(`❌ Error sending event to PostHog: ${eventName}`, error);
  }
};

/**
 * Identify a user
 */
const PII_KEYS = [
  'email', 'phone', 'name', 'firstName', 'lastName', 'first_name', 'last_name',
  // LGBTQ+ identity fields — exposure = prosecution risk in hostile jurisdictions
  'gender', 'sexual_orientation', 'ethnicity', 'religion', 'political_views',
  'location_city', 'location_state', 'location_country', 'display_name',
  'occupation', 'education', 'hometown', 'latitude', 'longitude',
  'pronouns', 'birth_date', 'bio', 'my_story',
];

export const identifyUser = (userId: string, traits?: Record<string, any>) => {
  const client = getPostHogClient();
  if (!client) return;

  // Strip PII fields before sending to PostHog
  if (traits) {
    const sanitized = { ...traits };
    for (const key of PII_KEYS) {
      delete sanitized[key];
    }
    client.identify(userId, sanitized);
  } else {
    client.identify(userId);
  }
};

/**
 * Flush all pending events (call on app background)
 */
export const flushPostHog = () => {
  const client = getPostHogClient();
  if (!client) return;
  client.flush();
};

/**
 * Reset user identity (on logout)
 */
export const resetUser = () => {
  const client = getPostHogClient();
  if (!client) return;
  client.reset();
};

/**
 * Track a screen view
 */
export const trackScreen = (screenName: string, properties?: Record<string, any>) => {
  const client = getPostHogClient();
  if (!client) return;
  client.screen(screenName, properties);
};

/**
 * Set user properties
 */
export const setUserProperties = (properties: Record<string, any>) => {
  const client = getPostHogClient();
  if (!client) return;
  client.identify(undefined, properties);
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

  // Matching — no profile/match IDs sent to analytics (prevents reconstructing who swiped whom)
  profileViewed: (_profileId: string) =>
    trackEvent('profile_viewed'),
  swipedLeft: (_profileId: string) =>
    trackEvent('swiped_left'),
  swipedRight: (_profileId: string) =>
    trackEvent('swiped_right'),
  matched: (_matchId: string) =>
    trackEvent('matched'),
  unmatched: (_matchId: string, reason?: string) =>
    trackEvent('unmatched', { reason }),

  // Messaging — no match IDs sent to analytics
  messageSent: (_matchId: string, messageType: 'text' | 'image' | 'voice') =>
    trackEvent('message_sent', { messageType }),
  messageReceived: (_matchId: string) =>
    trackEvent('message_received'),

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

  // Safety — no user IDs sent to analytics
  userBlocked: (_blockedUserId: string, reason?: string) =>
    trackEvent('user_blocked', { reason }),
  userReported: (_reportedUserId: string, reportType: string) =>
    trackEvent('user_reported', { reportType }),

  // Settings
  settingsChanged: (setting: string, value: any) =>
    trackEvent('settings_changed', { setting, value }),

  // Success Milestones — no match IDs sent to analytics
  dateScheduled: (_matchId: string, daysUntilDate?: number) =>
    trackEvent('date_scheduled', { daysUntilDate }),
  dateCompleted: (_matchId: string, rating?: number, wentWell?: boolean) =>
    trackEvent('date_completed', { rating, wentWell }),
  marriageArranged: (_matchId: string, daysUntilMarriage?: number) =>
    trackEvent('marriage_arranged', { daysUntilMarriage }),
  relationshipEnded: (_matchId: string, reason?: string, durationDays?: number) =>
    trackEvent('relationship_ended', { reason, durationDays }),

  // Reviews — no match/profile IDs sent to analytics
  reviewPromptShown: (_matchId: string) =>
    trackEvent('review_prompt_shown'),
  reviewSubmitted: (_matchId: string, overallRating: number) =>
    trackEvent('review_submitted', { overallRating }),
  reviewViewed: (_profileId: string, hasReviews: boolean) =>
    trackEvent('review_viewed', { hasReviews }),

  // Boost & Premium Features
  boostActivated: (boostType: 'standard' | 'super', duration: number) =>
    trackEvent('boost_activated', { boostType, duration }),
  superLikeUsed: (_profileId: string) =>
    trackEvent('super_like_used'),
  rewindUsed: () =>
    trackEvent('rewind_used'),

  // Discovery & Filters — no filter details or search queries sent (contain sensitive preferences)
  filtersChanged: (_filters: Record<string, any>) =>
    trackEvent('filters_changed'),
  searchPerformed: (searchType: 'location' | 'keyword', _query: string) =>
    trackEvent('search_performed', { searchType }),

  // Engagement
  appSessionStarted: (sessionDuration?: number) =>
    trackEvent('app_session_started', { sessionDuration }),
  appSessionEnded: (sessionDuration: number, actionsPerformed: number) =>
    trackEvent('app_session_ended', { sessionDuration, actionsPerformed }),

  // Content Moderation
  screenshotDetected: (location: 'profile' | 'chat' | 'discovery') =>
    trackEvent('screenshot_detected', { location }),
  screenshotBlocked: (location: string) =>
    trackEvent('screenshot_blocked', { location }),
};

/**
 * Track errors (complement to Sentry)
 */
export const trackError = (errorName: string, error: Error, _context?: Record<string, any>) => {
  // Only send error name and message — no stack traces (may contain file paths, user data)
  // Sentry already captures full stack traces with proper PII scrubbing
  trackEvent('error_occurred', {
    errorName,
    errorMessage: error.message,
  });
};

/**
 * Funnel tracking for conversion analysis
 */
export const trackFunnel = {
  // Onboarding Funnel
  onboardingStep1_BasicInfo: () => trackEvent('funnel_onboarding_step1'),
  onboardingStep2_Photos: () => trackEvent('funnel_onboarding_step2'),
  onboardingStep3_Preferences: () => trackEvent('funnel_onboarding_step3'),
  onboardingStep4_Goals: () => trackEvent('funnel_onboarding_step4'),
  onboardingStep5_Verification: () => trackEvent('funnel_onboarding_step5'),
  onboardingCompleted: () => trackEvent('funnel_onboarding_completed'),

  // Matching Funnel
  discoveryViewed: () => trackEvent('funnel_discovery_viewed'),
  profileCardSwiped: () => trackEvent('funnel_profile_swiped'),
  profileLiked: () => trackEvent('funnel_profile_liked'),
  matchReceived: () => trackEvent('funnel_match_received'),
  firstMessageSent: () => trackEvent('funnel_first_message_sent'),
  firstMessageReceived: () => trackEvent('funnel_first_message_received'),
  conversationStarted: () => trackEvent('funnel_conversation_started'),
  dateScheduled: () => trackEvent('funnel_date_scheduled'),
  dateCompleted: () => trackEvent('funnel_date_completed'),
  marriageArranged: () => trackEvent('funnel_marriage_arranged'),

  // Premium Funnel
  paywallViewed: () => trackEvent('funnel_paywall_viewed'),
  pricingViewed: () => trackEvent('funnel_pricing_viewed'),
  planSelected: (tier: string) => trackEvent('funnel_plan_selected', { tier }),
  checkoutStarted: (tier: string) => trackEvent('funnel_checkout_started', { tier }),
  subscriptionCompleted: (tier: string) => trackEvent('funnel_subscription_completed', { tier }),

  // Verification Funnel
  verificationPromptViewed: () => trackEvent('funnel_verification_prompt'),
  verificationStarted: () => trackEvent('funnel_verification_started'),
  identityUploaded: () => trackEvent('funnel_identity_uploaded'),
  videoSelfieRecorded: () => trackEvent('funnel_video_selfie_recorded'),
  verificationSubmitted: () => trackEvent('funnel_verification_submitted'),
  verificationApproved: () => trackEvent('funnel_verification_approved'),
};

/**
 * Track feature usage for product analytics
 */
export const trackFeatureUsage = {
  photoBlurEnabled: (enabled: boolean) =>
    trackEvent('feature_photo_blur', { enabled }),
  incognitoModeEnabled: (enabled: boolean) =>
    trackEvent('feature_incognito', { enabled }),
  locationSharingChanged: (shareExactLocation: boolean) =>
    trackEvent('feature_location_sharing', { shareExactLocation }),
  reviewsEnabled: (enabled: boolean) =>
    trackEvent('feature_reviews', { enabled }),
  voiceIntroRecorded: () =>
    trackEvent('feature_voice_intro_recorded'),
  voiceIntroPlayed: () =>
    trackEvent('feature_voice_intro_played'),
};

/**
 * Track A/B test variant assignment
 */
export const trackExperiment = (experimentName: string, variant: string) => {
  trackEvent('experiment_viewed', { experimentName, variant });

  // Also set as user property for segmentation
  setUserProperties({ [`experiment_${experimentName}`]: variant });
};

// Export PostHog client and provider for app integration
export { posthogClient, PostHogProvider };
