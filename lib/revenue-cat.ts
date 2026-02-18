import Purchases, { PurchasesOffering, CustomerInfo, PurchasesPackage } from 'react-native-purchases';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

// RevenueCat API Keys from app.json extra config
const REVENUECAT_API_KEY_IOS = Constants.expoConfig?.extra?.revenueCatAppleApiKey || process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || '';
const REVENUECAT_API_KEY_ANDROID = Constants.expoConfig?.extra?.revenueCatGoogleApiKey || process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || '';

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
    if (isInitialized) return;

    const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;

    if (!apiKey) {
      console.warn('⚠️ RevenueCat API key not configured - running in free mode');
      isInitialized = false;
      return;
    }

    Purchases.configure({ apiKey, appUserID: userId });

    // Enable debug logs in development
    if (__DEV__) {
      Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
    }

    isInitialized = true;
  } catch (error) {
    console.error('❌ RevenueCat initialization failed:', error);
    isInitialized = false;
  }
};

/**
 * Get available offerings (subscription packages)
 */
export const getOfferings = async (): Promise<PurchasesOffering | null> => {
  if (!isInitialized) {
    console.error('❌ getOfferings failed: RevenueCat not initialized');
    throw new Error('RevenueCat not initialized. Please check API key configuration.');
  }

  try {
    const offerings = await Purchases.getOfferings();

    if (offerings.current !== null && offerings.current.availablePackages.length > 0) {
      return offerings.current;
    }

    console.warn('⚠️ No current offering available. Check RevenueCat dashboard configuration.');
    console.warn('Available offerings:', Object.keys(offerings.all || {}));
    throw new Error('No subscription packages configured in RevenueCat. Please configure offerings in the RevenueCat dashboard.');
  } catch (error: any) {
    console.error('❌ Error getting offerings:', {
      message: error.message,
      code: error.code,
      readableErrorCode: error.readableErrorCode,
      underlyingErrorMessage: error.underlyingErrorMessage,
      userInfo: error.userInfo,
      domain: error.domain,
      errorKeys: Object.keys(error)
    });
    throw error;
  }
};

/**
 * Purchase a package (subscription or one-time)
 */
export const purchasePackage = async (pkg: PurchasesPackage): Promise<CustomerInfo | null> => {
  if (!isInitialized) {
    throw new Error('RevenueCat not initialized. Please restart the app.');
  }

  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);

    // Track purchase event in Firebase Analytics for Google Ads conversion tracking
    // Firebase analytics removed - can be re-added later
    // TODO: Re-implement purchase tracking when Firebase is properly configured

    return customerInfo;
  } catch (error: any) {
    if (error.userCancelled) {
      // Return null for user cancellation (not an error)
      return null;
    } else {
      console.error('❌ Error purchasing package:', error);
      console.error('RevenueCat error details:', {
        code: error.code,
        message: error.message,
        readableErrorCode: error.readableErrorCode,
        underlyingErrorMessage: error.underlyingErrorMessage,
        userCancelled: error.userCancelled,
        domain: error.domain,
        errorKeys: Object.keys(error)
      });
      // Re-throw the error so it can be caught by the caller
      throw error;
    }
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
 * Check if user is in a trial period
 */
export const isInTrialPeriod = (customerInfo: CustomerInfo | null): boolean => {
  if (!customerInfo) return false;

  const activeEntitlements = customerInfo.entitlements.active;
  const firstEntitlement = Object.values(activeEntitlements)[0];

  if (firstEntitlement) {
    // Check periodType - RevenueCat uses 'trial' for trial periods
    return firstEntitlement.periodType === 'TRIAL';
  }

  return false;
};

/**
 * Get days remaining in trial or subscription
 */
export const getDaysRemaining = (customerInfo: CustomerInfo | null): number | null => {
  const expirationDate = getSubscriptionExpirationDate(customerInfo);
  if (!expirationDate) return null;

  const now = new Date();
  const diffMs = expirationDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return diffDays > 0 ? diffDays : 0;
};

/**
 * Get trial/subscription status details
 */
export interface SubscriptionStatus {
  isActive: boolean;
  isTrial: boolean;
  expirationDate: Date | null;
  daysRemaining: number | null;
  willRenew: boolean;
  tier: SubscriptionTier | null;
}

export const getSubscriptionStatus = (customerInfo: CustomerInfo | null): SubscriptionStatus => {
  return {
    isActive: hasActiveSubscription(customerInfo),
    isTrial: isInTrialPeriod(customerInfo),
    expirationDate: getSubscriptionExpirationDate(customerInfo),
    daysRemaining: getDaysRemaining(customerInfo),
    willRenew: willRenew(customerInfo),
    tier: getSubscriptionTier(customerInfo),
  };
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
 * Trial info extracted from a package's introductory price
 */
export interface TrialInfo {
  hasTrial: boolean;
  trialDays: number | null;
  trialText: string | null;
}

/**
 * Extract trial details from a package's introductory price
 */
export const getTrialInfo = (pkg: PurchasesPackage): TrialInfo => {
  const introPrice = (pkg.product as any).introPrice;

  if (!introPrice || introPrice.price !== 0) {
    return { hasTrial: false, trialDays: null, trialText: null };
  }

  const units = introPrice.periodNumberOfUnits || 1;
  const periodUnit: string = (introPrice.periodUnit || '').toUpperCase();

  let totalDays: number;
  switch (periodUnit) {
    case 'DAY':
      totalDays = units;
      break;
    case 'WEEK':
      totalDays = units * 7;
      break;
    case 'MONTH':
      totalDays = units * 30;
      break;
    case 'YEAR':
      totalDays = units * 365;
      break;
    default:
      totalDays = units;
      break;
  }

  return {
    hasTrial: true,
    trialDays: totalDays,
    trialText: `${totalDays}-day free trial`,
  };
};

/**
 * Check trial/introductory price eligibility for a set of packages.
 * On iOS, uses the SDK eligibility check. On Android (always UNKNOWN), falls back to introPrice inspection.
 */
export const checkTrialEligibility = async (
  packages: PurchasesPackage[]
): Promise<Record<string, { eligible: boolean; trialInfo: TrialInfo }>> => {
  const result: Record<string, { eligible: boolean; trialInfo: TrialInfo }> = {};

  // Build product IDs list
  const productIds = packages.map((p) => p.product.identifier);

  let eligibilityMap: Record<string, { status: number }> = {};

  if (isInitialized) {
    try {
      const raw = await Purchases.checkTrialOrIntroductoryPriceEligibility(productIds);
      // Convert to simple map
      for (const [key, value] of Object.entries(raw)) {
        eligibilityMap[key] = { status: (value as any).status };
      }
    } catch (error) {
      console.warn('⚠️ Trial eligibility check failed, falling back to introPrice inspection:', error);
    }
  }

  for (const pkg of packages) {
    const trialInfo = getTrialInfo(pkg);
    const eligibility = eligibilityMap[pkg.product.identifier];

    if (!trialInfo.hasTrial) {
      // No intro offer on this product
      result[pkg.product.identifier] = { eligible: false, trialInfo };
      continue;
    }

    if (eligibility) {
      // Status values: 0 = UNKNOWN, 1 = INELIGIBLE, 2 = ELIGIBLE, 3 = NO_INTRO_OFFER_EXISTS
      const status = eligibility.status;
      if (status === 2) {
        // ELIGIBLE
        result[pkg.product.identifier] = { eligible: true, trialInfo };
      } else if (status === 1 || status === 3) {
        // INELIGIBLE or NO_INTRO_OFFER_EXISTS
        result[pkg.product.identifier] = { eligible: false, trialInfo };
      } else {
        // UNKNOWN (0) - always returned on Android where we can't verify prior redemption.
        // Only trust introPrice on iOS; on Android, treat as ineligible to avoid showing
        // trial text to users who already redeemed theirs.
        result[pkg.product.identifier] = { eligible: Platform.OS === 'ios', trialInfo };
      }
    } else {
      // No eligibility data (SDK not initialized or call failed) - fall back to introPrice
      result[pkg.product.identifier] = { eligible: trialInfo.hasTrial, trialInfo };
    }
  }

  return result;
};

/**
 * Check if RevenueCat is initialized
 */
export const isRevenueCatInitialized = (): boolean => {
  return isInitialized;
};

/**
 * Present the Apple promo code redemption sheet (iOS only)
 * This allows users to redeem offer codes, custom codes, or one-time use codes
 * created in App Store Connect
 */
export const presentCodeRedemptionSheet = async (): Promise<void> => {
  if (!isInitialized) {
    console.warn('⚠️ RevenueCat not initialized - cannot present code redemption');
    throw new Error('RevenueCat not initialized. Please restart the app.');
  }

  if (Platform.OS !== 'ios') {
    console.warn('⚠️ Promo code redemption is only available on iOS');
    throw new Error('Promo code redemption is only available on iOS devices.');
  }

  try {
    await Purchases.presentCodeRedemptionSheet();
  } catch (error: any) {
    console.error('❌ Error presenting code redemption sheet:', error);
    throw error;
  }
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

    // TODO: Call Supabase edge function to update subscription status
    // This should be done server-side for security
  } catch (error) {
    console.error('Error syncing subscription status:', error);
  }
};
