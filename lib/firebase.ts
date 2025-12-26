/**
 * Firebase Analytics Configuration
 *
 * This file initializes Firebase Analytics for Google Ads conversion tracking.
 * Purchase events are automatically tracked when users complete subscriptions.
 */

import analytics from '@react-native-firebase/analytics';
import { Platform } from 'react-native';

/**
 * Track a purchase event for Google Ads conversion tracking
 *
 * This should be called when a user successfully completes a subscription purchase.
 * The event data is automatically sent to Google Ads for conversion tracking.
 *
 * @param productId - The RevenueCat product identifier (e.g., 'accord_premium_monthly')
 * @param price - The price in USD
 * @param currency - The currency code (default: 'USD')
 * @param transactionId - The transaction ID from RevenueCat
 */
export async function trackPurchase({
  productId,
  price,
  currency = 'USD',
  transactionId,
  tier,
}: {
  productId: string;
  price: number;
  currency?: string;
  transactionId: string;
  tier: 'premium' | 'platinum';
}): Promise<void> {
  try {
    // Log purchase event to Firebase Analytics
    await analytics().logPurchase({
      value: price,
      currency: currency,
      items: [
        {
          item_id: productId,
          item_name: `Accord ${tier.charAt(0).toUpperCase() + tier.slice(1)} Subscription`,
          item_category: 'subscription',
          price: price,
          quantity: 1,
        },
      ],
      transaction_id: transactionId,
    });

    // Also log as a custom event for additional tracking
    await analytics().logEvent('subscription_purchase', {
      product_id: productId,
      tier: tier,
      price: price,
      currency: currency,
      transaction_id: transactionId,
      platform: Platform.OS,
    });

    console.log('✅ Purchase event tracked to Firebase Analytics:', {
      productId,
      tier,
      price,
      transactionId,
    });
  } catch (error) {
    console.error('❌ Failed to track purchase event:', error);
    // Don't throw - analytics failures shouldn't break the app
  }
}

/**
 * Track app open event
 * This helps with attribution and user engagement tracking
 */
export async function trackAppOpen(): Promise<void> {
  try {
    await analytics().logAppOpen();
    console.log('✅ App open event tracked');
  } catch (error) {
    console.error('❌ Failed to track app open:', error);
  }
}

/**
 * Track screen view
 * @param screenName - The name of the screen being viewed
 */
export async function trackScreenView(screenName: string): Promise<void> {
  try {
    await analytics().logScreenView({
      screen_name: screenName,
      screen_class: screenName,
    });
  } catch (error) {
    console.error('❌ Failed to track screen view:', error);
  }
}

/**
 * Track custom event
 * @param eventName - The name of the event
 * @param params - Optional event parameters
 */
export async function trackEvent(
  eventName: string,
  params?: Record<string, any>
): Promise<void> {
  try {
    await analytics().logEvent(eventName, params);
    console.log('✅ Event tracked:', eventName, params);
  } catch (error) {
    console.error('❌ Failed to track event:', error);
  }
}

/**
 * Set user properties for analytics segmentation
 * @param userId - The user's ID
 * @param properties - User properties (e.g., subscription tier, verification status)
 */
export async function setUserProperties(
  userId: string,
  properties: {
    subscription_tier?: 'free' | 'premium' | 'platinum';
    is_verified?: boolean;
    gender?: string;
    age?: number;
  }
): Promise<void> {
  try {
    await analytics().setUserId(userId);

    if (properties.subscription_tier) {
      await analytics().setUserProperty('subscription_tier', properties.subscription_tier);
    }

    if (properties.is_verified !== undefined) {
      await analytics().setUserProperty('is_verified', properties.is_verified ? 'true' : 'false');
    }

    if (properties.gender) {
      await analytics().setUserProperty('gender', properties.gender);
    }

    if (properties.age) {
      await analytics().setUserProperty('age_group', getAgeGroup(properties.age));
    }

    console.log('✅ User properties set for analytics');
  } catch (error) {
    console.error('❌ Failed to set user properties:', error);
  }
}

/**
 * Helper function to categorize age into groups for privacy
 */
function getAgeGroup(age: number): string {
  if (age < 25) return '18-24';
  if (age < 30) return '25-29';
  if (age < 35) return '30-34';
  if (age < 40) return '35-39';
  if (age < 45) return '40-44';
  return '45+';
}
