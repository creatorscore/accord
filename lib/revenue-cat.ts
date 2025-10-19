import Purchases, { PurchasesOffering, CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';

// RevenueCat API Keys
// TODO: Replace with actual keys from RevenueCat dashboard
const REVENUECAT_API_KEY_IOS = process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || '';
const REVENUECAT_API_KEY_ANDROID = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || '';

// Track if RevenueCat is initialized
let isInitialized = false;

export const SUBSCRIPTION_TIERS = {
  PREMIUM: 'premium',
  PLATINUM: 'platinum',
} as const;

export type SubscriptionTier = typeof SUBSCRIPTION_TIERS[keyof typeof SUBSCRIPTION_TIERS];

/**
 * Initialize RevenueCat SDK
 * Call this once when the app starts
 */
export const initializeRevenueCat = async (userId?: string) => {
  try {
    const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

    if (!apiKey) {
      console.log('RevenueCat API key not configured - running in free mode');
      isInitialized = false;
      return;
    }

    Purchases.configure({ apiKey, appUserID: userId });

    // Enable debug logs in development
    if (__DEV__) {
      Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    }

    isInitialized = true;
    console.log('RevenueCat initialized successfully');
  } catch (error) {
    console.log('RevenueCat initialization skipped:', error);
    isInitialized = false;
  }
};

/**
 * Get available offerings (subscription packages)
 */
export const getOfferings = async (): Promise<PurchasesOffering | null> => {
  if (!isInitialized) {
    return null;
  }

  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current !== null) {
      return offerings.current;
    }
    return null;
  } catch (error) {
    console.error('Error getting offerings:', error);
    return null;
  }
};

/**
 * Purchase a package (subscription or one-time)
 */
export const purchasePackage = async (pkg: PurchasesPackage): Promise<CustomerInfo | null> => {
  if (!isInitialized) {
    console.log('RevenueCat not initialized - cannot make purchases');
    return null;
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo;
  } catch (error: any) {
    if (error.userCancelled) {
      console.log('User cancelled purchase');
    } else {
      console.error('Error purchasing package:', error);
    }
    return null;
  }
};

/**
 * Restore purchases (for users who reinstalled app)
 * Returns CustomerInfo if successful, throws error if not
 */
export const restorePurchases = async (): Promise<CustomerInfo> => {
  if (!isInitialized) {
    throw new Error('RevenueCat not initialized');
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    console.log('Purchases restored successfully:', {
      hasActiveSubscriptions: Object.keys(customerInfo.entitlements.active).length > 0,
      activeEntitlements: Object.keys(customerInfo.entitlements.active),
    });
    return customerInfo;
  } catch (error) {
    console.error('Error restoring purchases:', error);
    throw error;
  }
};

/**
 * Get current customer info (subscription status)
 */
export const getCustomerInfo = async (): Promise<CustomerInfo | null> => {
  if (!isInitialized) {
    // RevenueCat not initialized, return null
    return null;
  }

  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return customerInfo;
  } catch (error) {
    console.log('RevenueCat not configured, running in free mode');
    return null;
  }
};

/**
 * Check if user has an active subscription
 */
export const hasActiveSubscription = (customerInfo: CustomerInfo | null): boolean => {
  if (!customerInfo) return false;

  const entitlements = customerInfo.entitlements.active;
  return Object.keys(entitlements).length > 0;
};

/**
 * Check if user has Premium subscription
 */
export const hasPremium = (customerInfo: CustomerInfo | null): boolean => {
  if (!customerInfo) return false;

  return (
    customerInfo.entitlements.active['premium'] !== undefined ||
    customerInfo.entitlements.active['platinum'] !== undefined
  );
};

/**
 * Check if user has Platinum subscription
 */
export const hasPlatinum = (customerInfo: CustomerInfo | null): boolean => {
  if (!customerInfo) return false;

  return customerInfo.entitlements.active['platinum'] !== undefined;
};

/**
 * Get subscription tier
 */
export const getSubscriptionTier = (customerInfo: CustomerInfo | null): SubscriptionTier | null => {
  if (!customerInfo) return null;

  if (hasPlatinum(customerInfo)) return SUBSCRIPTION_TIERS.PLATINUM;
  if (hasPremium(customerInfo)) return SUBSCRIPTION_TIERS.PREMIUM;

  return null;
};

/**
 * Check if user can perform a premium feature
 */
export const canUseFeature = (
  customerInfo: CustomerInfo | null,
  feature: 'unlimited_swipes' | 'see_who_liked' | 'super_like' | 'voice_messages' | 'read_receipts' | 'advanced_filters' | 'rewind' | 'background_check' | 'legal_resources' | 'profile_boost'
): boolean => {
  const tier = getSubscriptionTier(customerInfo);

  if (!tier) return false; // Free user

  // Premium features
  const premiumFeatures = ['unlimited_swipes', 'see_who_liked', 'super_like', 'voice_messages', 'read_receipts', 'advanced_filters', 'rewind'];

  // Platinum-only features
  const platinumFeatures = ['background_check', 'legal_resources', 'profile_boost'];

  if (premiumFeatures.includes(feature)) {
    return tier === SUBSCRIPTION_TIERS.PREMIUM || tier === SUBSCRIPTION_TIERS.PLATINUM;
  }

  if (platinumFeatures.includes(feature)) {
    return tier === SUBSCRIPTION_TIERS.PLATINUM;
  }

  return false;
};

/**
 * Set custom user attributes for analytics
 */
export const setUserAttributes = async (attributes: { [key: string]: string | null }) => {
  try {
    await Purchases.setAttributes(attributes);
  } catch (error) {
    console.error('Error setting user attributes:', error);
  }
};

/**
 * Log out user from RevenueCat
 */
export const logOutRevenueCat = async () => {
  try {
    await Purchases.logOut();
  } catch (error) {
    console.error('Error logging out from RevenueCat:', error);
  }
};

/**
 * Get subscription expiration date
 */
export const getSubscriptionExpirationDate = (customerInfo: CustomerInfo | null): Date | null => {
  if (!customerInfo) return null;

  const activeEntitlements = customerInfo.entitlements.active;
  const firstEntitlement = Object.values(activeEntitlements)[0];

  if (firstEntitlement && firstEntitlement.expirationDate) {
    return new Date(firstEntitlement.expirationDate);
  }

  return null;
};

/**
 * Check if subscription will auto-renew
 */
export const willRenew = (customerInfo: CustomerInfo | null): boolean => {
  if (!customerInfo) return false;

  const activeEntitlements = customerInfo.entitlements.active;
  const firstEntitlement = Object.values(activeEntitlements)[0];

  if (firstEntitlement) {
    return firstEntitlement.willRenew;
  }

  return false;
};

/**
 * Get price string for a package
 */
export const getPriceString = (pkg: PurchasesPackage): string => {
  return pkg.product.priceString;
};

/**
 * Check if RevenueCat is initialized
 */
export const isRevenueCatInitialized = (): boolean => {
  return isInitialized;
};

/**
 * Sync subscription status with Supabase database
 * Call this after purchase/restore to update DB
 */
export const syncSubscriptionStatus = async (
  customerInfo: CustomerInfo,
  profileId: string
): Promise<void> => {
  try {
    const tier = getSubscriptionTier(customerInfo);
    const isPremiumUser = tier === SUBSCRIPTION_TIERS.PREMIUM || tier === SUBSCRIPTION_TIERS.PLATINUM;
    const isPlatinumUser = tier === SUBSCRIPTION_TIERS.PLATINUM;

    // This would be called from your backend/edge function
    // For now, just log what would be updated
    console.log('Syncing subscription status to database:', {
      profileId,
      isPremium: isPremiumUser,
      isPlatinum: isPlatinumUser,
      tier,
    });

    // TODO: Call Supabase edge function to update subscription status
    // This should be done server-side for security
  } catch (error) {
    console.error('Error syncing subscription status:', error);
  }
};
