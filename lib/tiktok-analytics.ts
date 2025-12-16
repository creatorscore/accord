import { NativeModules, Platform } from 'react-native';

const { TikTokAnalyticsBridge } = NativeModules;

/**
 * TikTok Analytics - Track events for TikTok Ads attribution
 * Supports both iOS and Android platforms
 *
 * Usage:
 * import { TikTokAnalytics } from '@/lib/tiktok-analytics';
 *
 * // Track registration
 * TikTokAnalytics.trackRegistration();
 *
 * // Track subscription purchase
 * TikTokAnalytics.trackPurchase('premium_monthly', 'Premium Monthly', 9.99, 'USD');
 */

const isSupported = () => {
  return (Platform.OS === 'ios' || Platform.OS === 'android') && TikTokAnalyticsBridge;
};

export const TikTokAnalytics = {
  /**
   * Track when a user registers/signs up
   */
  trackRegistration: () => {
    if (isSupported()) {
      TikTokAnalyticsBridge.trackRegistration();
    }
  },

  /**
   * Track when a user logs in
   */
  trackLogin: () => {
    if (isSupported()) {
      TikTokAnalyticsBridge.trackLogin();
    }
  },

  /**
   * Track when onboarding is completed
   */
  trackCompleteTutorial: () => {
    if (isSupported()) {
      TikTokAnalyticsBridge.trackCompleteTutorial();
    }
  },

  /**
   * Identify a user for attribution
   */
  identifyUser: (externalId: string, email?: string) => {
    if (isSupported()) {
      TikTokAnalyticsBridge.identifyUser(externalId, email || null);
    }
  },

  /**
   * Track when a user starts a free trial
   */
  trackStartTrial: () => {
    if (isSupported()) {
      TikTokAnalyticsBridge.trackStartTrial();
    }
  },

  /**
   * Track when a user subscribes
   */
  trackSubscribe: () => {
    if (isSupported()) {
      TikTokAnalyticsBridge.trackSubscribe();
    }
  },

  /**
   * Track a purchase event with details
   */
  trackPurchase: (productId: string, productName: string, price: number, currency: string = 'USD') => {
    if (isSupported()) {
      TikTokAnalyticsBridge.trackPurchase(productId, productName, price, currency);
    }
  },

  /**
   * Track when payment info is added
   */
  trackAddPaymentInfo: () => {
    if (isSupported()) {
      TikTokAnalyticsBridge.trackAddPaymentInfo();
    }
  },

  /**
   * Track when a user views a profile
   */
  trackViewContent: (profileId: string, profileName: string) => {
    if (isSupported()) {
      TikTokAnalyticsBridge.trackViewContent(profileId, profileName);
    }
  },

  /**
   * Track search activity
   */
  trackSearch: () => {
    if (isSupported()) {
      TikTokAnalyticsBridge.trackSearch();
    }
  },

  /**
   * Track when a match is made (generate lead)
   */
  trackMatch: () => {
    if (isSupported()) {
      TikTokAnalyticsBridge.trackGenerateLead();
    }
  },

  /**
   * Track when a user likes a profile (add to wishlist)
   */
  trackLike: (profileId: string, profileName: string) => {
    if (isSupported()) {
      TikTokAnalyticsBridge.trackAddToWishlist(profileId, profileName);
    }
  },

  /**
   * Track app launch
   */
  trackLaunchApp: () => {
    if (isSupported()) {
      TikTokAnalyticsBridge.trackLaunchApp();
    }
  },

  /**
   * Track a custom event by name
   */
  trackCustomEvent: (eventName: string) => {
    if (isSupported()) {
      TikTokAnalyticsBridge.trackCustomEvent(eventName);
    }
  },
};

export default TikTokAnalytics;
