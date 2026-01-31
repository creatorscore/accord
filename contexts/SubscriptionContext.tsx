import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { CustomerInfo } from 'react-native-purchases';
import Purchases from 'react-native-purchases';
import {
  initializeRevenueCat,
  getCustomerInfo,
  hasActiveSubscription,
  hasPremium,
  hasPlatinum,
  getSubscriptionTier,
  canUseFeature,
  isInTrialPeriod,
  getDaysRemaining,
  getSubscriptionExpirationDate,
  willRenew as checkWillRenew,
  SUBSCRIPTION_TIERS,
  type SubscriptionTier,
} from '@/lib/revenue-cat';
import { useAuth } from './AuthContext';
import { useProfileData } from './ProfileDataContext';
import { supabase } from '@/lib/supabase';

interface SubscriptionContextType {
  customerInfo: CustomerInfo | null;
  isLoading: boolean;
  isSubscribed: boolean;
  isPremium: boolean;
  isPlatinum: boolean;
  subscriptionTier: SubscriptionTier | null;
  // Trial status
  isTrial: boolean;
  daysRemaining: number | null;
  expirationDate: Date | null;
  willRenew: boolean;
  // Methods
  refreshSubscription: () => Promise<void>;
  canUseFeature: (feature: string) => boolean;
  syncWithDatabase: (freshCustomerInfo?: CustomerInfo) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  // PERFORMANCE: Use centralized profile data instead of making duplicate queries
  const { profile, profileId } = useProfileData();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ALWAYS use RevenueCat - no development mode bypass
  // This ensures subscriptions work in TestFlight and Production
  const isDatabaseOnlyMode = false;

  // PERFORMANCE: Get premium status from shared ProfileDataContext
  // This eliminates a duplicate database query at startup
  const dbPremiumStatus = profile?.is_premium || false;
  const dbPlatinumStatus = profile?.is_platinum || false;
  const isAdmin = profile?.is_admin || false;

  // Initialize RevenueCat when user logs in
  // PERFORMANCE: Defer RevenueCat initialization to improve cold-start time
  // RevenueCat SDK init can add 200-400ms on low-RAM devices
  useEffect(() => {
    if (user) {
      // Skip RevenueCat in database-only development mode
      if (isDatabaseOnlyMode) {
        console.log('Skipping RevenueCat in database-only development mode');
        setIsLoading(false);
        return;
      }

      // PERFORMANCE: Defer RevenueCat initialization until after first render
      // This prevents blocking the main thread during cold start
      // The database premium status is used as fallback until RC loads
      const timeoutId = setTimeout(() => {
        try {
          initializeRevenueCat(user.id);
          loadSubscriptionStatus();
        } catch (error) {
          console.error('Failed to initialize RevenueCat:', error);
          setIsLoading(false);
        }
      }, 500); // 500ms delay to let UI render first

      return () => clearTimeout(timeoutId);
    } else {
      setCustomerInfo(null);
      setIsLoading(false);
    }
  }, [user, isDatabaseOnlyMode]);

  // Listen for subscription updates
  useEffect(() => {
    if (!user || isDatabaseOnlyMode) return; // Skip in database-only mode

    let listener: { remove: () => void } | null = null;

    try {
      listener = Purchases.addCustomerInfoUpdateListener((info) => {
        setCustomerInfo(info);
      }) as any;
    } catch (error) {
      console.error('Failed to add RevenueCat listener:', error);
    }

    return () => {
      if (listener && typeof listener.remove === 'function') {
        try {
          listener.remove();
        } catch (error) {
          console.error('Failed to remove RevenueCat listener:', error);
        }
      }
    };
  }, [user, isDatabaseOnlyMode]);

  const loadSubscriptionStatus = async () => {
    try {
      setIsLoading(true);
      const info = await getCustomerInfo();
      setCustomerInfo(info);

      // After loading RevenueCat status, sync with database to ensure consistency
      // This catches cases where webhook might have failed
      if (info && user && profileId) {
        const rcPremium = hasPremium(info);
        const rcPlatinum = hasPlatinum(info);

        // Check admin status directly from database to avoid stale ProfileDataContext
        // ProfileDataContext may not have loaded yet when RevenueCat finishes init
        const { data: adminCheck } = await supabase
          .from('profiles')
          .select('is_admin')
          .eq('user_id', user.id)
          .maybeSingle();
        const isAdminUser = adminCheck?.is_admin || false;

        // Skip sync for admin accounts - they always keep their database premium status
        if (isAdminUser) {
          console.log('👑 Skipping RevenueCat sync for admin account');
        }
        // If RevenueCat says no subscription but database says yes, fix it (non-admins only)
        else if (!rcPremium && !rcPlatinum && (dbPremiumStatus || dbPlatinumStatus)) {
          console.log('🔄 Syncing: RevenueCat says no subscription, updating database...');
          await syncWithDatabase(info);
        }
        // If RevenueCat says subscription but database doesn't match, sync it
        else if ((rcPremium !== dbPremiumStatus) || (rcPlatinum !== dbPlatinumStatus)) {
          console.log('🔄 Syncing: Database out of sync with RevenueCat, updating...');
          await syncWithDatabase(info);
        }
      }
    } catch (error) {
      console.error('Error loading subscription status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSubscription = useCallback(async () => {
    await loadSubscriptionStatus();
  }, []);

  /**
   * Sync RevenueCat subscription status to database
   * Called after purchase/restore to ensure DB is in sync
   *
   * @param freshCustomerInfo - Optional fresh CustomerInfo from purchase/restore
   *                            If provided, uses this instead of context state
   */
  const syncWithDatabase = useCallback(async (freshCustomerInfo?: CustomerInfo) => {
    // PERFORMANCE: Use profileId from shared ProfileDataContext instead of querying
    if (!user || !profileId) {
      if (!profileId) {
        console.log('Profile not found for sync - user might be in onboarding');
      }
      return;
    }

    try {
      // Use fresh CustomerInfo if provided (from purchase), otherwise use context state
      // This ensures we sync the LATEST subscription status, not stale context state
      const premium = freshCustomerInfo ? hasPremium(freshCustomerInfo) : isPremium;
      const platinum = freshCustomerInfo ? hasPlatinum(freshCustomerInfo) : isPlatinum;
      const tier = freshCustomerInfo ? getSubscriptionTier(freshCustomerInfo) : subscriptionTier;

      if (__DEV__) {
        console.log('🔄 Syncing subscription to database:', {
          profileId,
          isPremium: premium,
          isPlatinum: platinum,
          tier,
          usingFreshData: !!freshCustomerInfo,
        });
      }

      // Update profiles table
      await supabase
        .from('profiles')
        .update({
          is_premium: premium,
          is_platinum: platinum,
        })
        .eq('id', profileId);

      // Update subscriptions table if active subscription
      if (tier) {
        await supabase.from('subscriptions').upsert(
          {
            profile_id: profileId,
            tier,
            status: 'active',
            auto_renew: true,
          },
          { onConflict: 'profile_id' }
        );
      }

      if (__DEV__) {
        console.log('✅ Subscription synced to database');
      }
    } catch (error) {
      console.error('❌ Error syncing subscription to database:', error);
    }
  }, [user, profileId, customerInfo, isDatabaseOnlyMode]);

  // In database-only mode (dev), use database status exclusively
  // In production, RevenueCat is the SOURCE OF TRUTH
  // Database is only used as a fallback when RevenueCat hasn't loaded yet
  // Once RevenueCat loads, it takes precedence over database
  // EXCEPTION: Admin accounts always use database status (they get free premium)
  const hasRevenueCatLoaded = customerInfo !== null;

  const isSubscribed = isDatabaseOnlyMode || isAdmin
    ? (dbPremiumStatus || dbPlatinumStatus)
    : hasRevenueCatLoaded
      ? hasActiveSubscription(customerInfo) // RevenueCat is source of truth
      : (dbPremiumStatus || dbPlatinumStatus); // Only use DB when RC hasn't loaded

  const isPremium = isDatabaseOnlyMode || isAdmin
    ? dbPremiumStatus
    : hasRevenueCatLoaded
      ? hasPremium(customerInfo) // RevenueCat is source of truth
      : dbPremiumStatus; // Only use DB when RC hasn't loaded

  const isPlatinum = isDatabaseOnlyMode || isAdmin
    ? dbPlatinumStatus
    : hasRevenueCatLoaded
      ? hasPlatinum(customerInfo) // RevenueCat is source of truth
      : dbPlatinumStatus; // Only use DB when RC hasn't loaded

  const subscriptionTier = isDatabaseOnlyMode || isAdmin
    ? (dbPlatinumStatus ? 'platinum' : dbPremiumStatus ? 'premium' : null)
    : hasRevenueCatLoaded
      ? getSubscriptionTier(customerInfo) // RevenueCat is source of truth
      : (dbPlatinumStatus ? 'platinum' : dbPremiumStatus ? 'premium' : null); // Only use DB when RC hasn't loaded

  // Debug log computed values (only in development to avoid main thread work in production)
  if (__DEV__) {
    console.log('💎 Subscription Status:', {
      appEnv: process.env.EXPO_PUBLIC_APP_ENV,
      isDatabaseOnlyMode,
      isAdmin,
      dbPremiumStatus,
      dbPlatinumStatus,
      isSubscribed,
      isPremium,
      isPlatinum,
      subscriptionTier
    });
  }

  const checkFeature = useCallback(
    (feature: string) => {
      // If RevenueCat is not configured, allow basic features
      if (!customerInfo) {
        // Allow basic features in free mode
        const freeFeatures = ['basic_swipes', 'basic_messaging', 'basic_profile'];
        return freeFeatures.includes(feature);
      }
      return canUseFeature(
        customerInfo,
        feature as 'unlimited_swipes' | 'see_who_liked' | 'super_like' | 'voice_messages' | 'read_receipts' | 'advanced_filters' | 'rewind' | 'background_check' | 'legal_resources' | 'profile_boost'
      );
    },
    [customerInfo]
  );

  // Trial status - only relevant when RevenueCat is loaded
  const isTrial = hasRevenueCatLoaded ? isInTrialPeriod(customerInfo) : false;
  const daysRemaining = hasRevenueCatLoaded ? getDaysRemaining(customerInfo) : null;
  const expirationDate = hasRevenueCatLoaded ? getSubscriptionExpirationDate(customerInfo) : null;
  const willRenew = hasRevenueCatLoaded ? checkWillRenew(customerInfo) : false;

  const value: SubscriptionContextType = {
    customerInfo,
    isLoading,
    isSubscribed,
    isPremium,
    isPlatinum,
    subscriptionTier,
    // Trial status
    isTrial,
    daysRemaining,
    expirationDate,
    willRenew,
    // Methods
    refreshSubscription,
    canUseFeature: checkFeature,
    syncWithDatabase,
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
