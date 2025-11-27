import PostHog from 'posthog-react-native';
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
 * Initialize PostHog for analytics and session recording
 */
export const initializePostHog = async () => {
  // Don't initialize without API key
  // TODO: Re-enable __DEV__ check before production to prevent test data pollution
  if (!POSTHOG_API_KEY) {
    console.error('❌ PostHog not initialized: Missing EXPO_PUBLIC_POSTHOG_API_KEY');
    console.log('Add to .env: EXPO_PUBLIC_POSTHOG_API_KEY=your_key_here');
    return null;
  }

  console.log('🔄 Initializing PostHog...');
  console.log('API Key:', POSTHOG_API_KEY.substring(0, 10) + '...');
  console.log('Host:', POSTHOG_HOST);

  try {
    posthogClient = new PostHog(POSTHOG_API_KEY, {
      host: POSTHOG_HOST,
      // Enable debug mode in development
      ...(__DEV__ ? { debug: true } : {}),
      // Enable autocapture for automatic event tracking
      captureNativeAppLifecycleEvents: true,
    } as any);

    console.log('✅ PostHog initialized successfully!');
    console.log('PostHog client:', posthogClient ? 'Ready' : 'Failed');

    // Send test event to verify it's working
    if (posthogClient) {
      posthogClient.capture('posthog_initialized', {
        timestamp: new Date().toISOString(),
        environment: __DEV__ ? 'development' : 'production',
      });
      console.log('📊 Test event sent to PostHog');

      // Flush events immediately to ensure they're sent
      posthogClient.flush();
    }

    return posthogClient;
  } catch (error) {
    console.error('❌ Failed to initialize PostHog:', error);
    return null;
  }
};

/**
 * Track an event
 */
export const trackEvent = (eventName: string, properties?: Record<string, any>) => {
  if (!posthogClient) {
    console.warn(`⚠️  PostHog not initialized, event not sent: ${eventName}`);
    if (__DEV__) {
      console.log(`📊 Event (not sent): ${eventName}`, properties);
    }
    return;
  }

  try {
    posthogClient.capture(eventName, properties);
    if (__DEV__) {
      console.log(`✅ Event sent to PostHog: ${eventName}`, properties);
      // Flush in development to see events immediately
      posthogClient.flush();
    }
  } catch (error) {
    console.error(`❌ Error sending event to PostHog: ${eventName}`, error);
  }
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

  // Success Milestones
  dateScheduled: (matchId: string, daysUntilDate?: number) =>
    trackEvent('date_scheduled', { matchId, daysUntilDate }),
  dateCompleted: (matchId: string, rating?: number, wentWell?: boolean) =>
    trackEvent('date_completed', { matchId, rating, wentWell }),
  marriageArranged: (matchId: string, daysUntilMarriage?: number) =>
    trackEvent('marriage_arranged', { matchId, daysUntilMarriage }),
  relationshipEnded: (matchId: string, reason?: string, durationDays?: number) =>
    trackEvent('relationship_ended', { matchId, reason, durationDays }),

  // Reviews
  reviewPromptShown: (matchId: string) =>
    trackEvent('review_prompt_shown', { matchId }),
  reviewSubmitted: (matchId: string, overallRating: number) =>
    trackEvent('review_submitted', { matchId, overallRating }),
  reviewViewed: (profileId: string, hasReviews: boolean) =>
    trackEvent('review_viewed', { profileId, hasReviews }),

  // Boost & Premium Features
  boostActivated: (boostType: 'standard' | 'super', duration: number) =>
    trackEvent('boost_activated', { boostType, duration }),
  superLikeUsed: (profileId: string) =>
    trackEvent('super_like_used', { profileId }),
  rewindUsed: () =>
    trackEvent('rewind_used'),

  // Discovery & Filters
  filtersChanged: (filters: Record<string, any>) =>
    trackEvent('filters_changed', { filters }),
  searchPerformed: (searchType: 'location' | 'keyword', query: string) =>
    trackEvent('search_performed', { searchType, query }),

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
export const trackError = (errorName: string, error: Error, context?: Record<string, any>) => {
  trackEvent('error_occurred', {
    errorName,
    errorMessage: error.message,
    errorStack: error.stack,
    ...context,
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

// Export PostHog client for advanced use cases
export { posthogClient };
