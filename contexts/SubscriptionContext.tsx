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
  SUBSCRIPTION_TIERS,
  type SubscriptionTier,
} from '@/lib/revenue-cat';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';

interface SubscriptionContextType {
  customerInfo: CustomerInfo | null;
  isLoading: boolean;
  isSubscribed: boolean;
  isPremium: boolean;
  isPlatinum: boolean;
  subscriptionTier: SubscriptionTier | null;
  refreshSubscription: () => Promise<void>;
  canUseFeature: (feature: string) => boolean;
  syncWithDatabase: (freshCustomerInfo?: CustomerInfo) => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dbPremiumStatus, setDbPremiumStatus] = useState(false);
  const [dbPlatinumStatus, setDbPlatinumStatus] = useState(false);

  // Check if we should use database-only mode (development only)
  const isDatabaseOnlyMode = process.env.EXPO_PUBLIC_APP_ENV === 'development';

  // Load premium status from database (for both dev and production as fallback)
  useEffect(() => {
    console.log('🔄 SubscriptionContext: useEffect triggered', {
      hasUser: !!user,
      userId: user?.id,
      appEnv: process.env.EXPO_PUBLIC_APP_ENV,
      isDatabaseOnlyMode
    });
    if (user) {
      console.log('📞 Calling loadDatabasePremiumStatus...');
      loadDatabasePremiumStatus();
    }
  }, [user]);

  const loadDatabasePremiumStatus = async () => {
    console.log('🔍 Loading premium status from database for user:', user?.id);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_premium, is_platinum')
        .eq('user_id', user?.id)
        .single();

      console.log('📊 Database query result:', { data, error });

      // If profile doesn't exist yet (user is in onboarding), silently return
      if (error) {
        if (error.code === 'PGRST116') {
          console.log('Profile not found yet - user likely in onboarding. Premium status will be loaded after profile creation.');
          setDbPremiumStatus(false);
          setDbPlatinumStatus(false);
          return;
        }
        throw error;
      }

      const premium = data?.is_premium || false;
      const platinum = data?.is_platinum || false;

      console.log('✅ Setting premium status:', { premium, platinum });
      setDbPremiumStatus(premium);
      setDbPlatinumStatus(platinum);
    } catch (error) {
      console.error('❌ Error loading premium status from database:', error);
    }
  };

  // Initialize RevenueCat when user logs in
  useEffect(() => {
    if (user) {
      // Skip RevenueCat in database-only development mode
      if (isDatabaseOnlyMode) {
        console.log('Skipping RevenueCat in database-only development mode');
        setIsLoading(false);
        return;
      }

      try {
        initializeRevenueCat(user.id);
        loadSubscriptionStatus();
      } catch (error) {
        console.error('Failed to initialize RevenueCat:', error);
        setIsLoading(false);
      }
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
      });
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
    } catch (error) {
      console.error('Error loading subscription status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSubscription = useCallback(async () => {
    await loadSubscriptionStatus();
    // Also refresh database status in dev mode
    if (isDatabaseOnlyMode) {
      await loadDatabasePremiumStatus();
    }
  }, [isDatabaseOnlyMode]);

  /**
   * Sync RevenueCat subscription status to database
   * Called after purchase/restore to ensure DB is in sync
   *
   * @param freshCustomerInfo - Optional fresh CustomerInfo from purchase/restore
   *                            If provided, uses this instead of context state
   */
  const syncWithDatabase = useCallback(async (freshCustomerInfo?: CustomerInfo) => {
    if (!user) return;

    try {
      // Get current profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) {
        console.error('Profile not found for sync');
        return;
      }

      // Use fresh CustomerInfo if provided (from purchase), otherwise use context state
      // This ensures we sync the LATEST subscription status, not stale context state
      const premium = freshCustomerInfo ? hasPremium(freshCustomerInfo) : isPremium;
      const platinum = freshCustomerInfo ? hasPlatinum(freshCustomerInfo) : isPlatinum;
      const tier = freshCustomerInfo ? getSubscriptionTier(freshCustomerInfo) : subscriptionTier;

      console.log('🔄 Syncing subscription to database:', {
        profileId: profile.id,
        isPremium: premium,
        isPlatinum: platinum,
        tier,
        usingFreshData: !!freshCustomerInfo,
      });

      // Update profiles table
      await supabase
        .from('profiles')
        .update({
          is_premium: premium,
          is_platinum: platinum,
        })
        .eq('id', profile.id);

      // Immediately update local database status for instant UI update
      setDbPremiumStatus(premium);
      setDbPlatinumStatus(platinum);

      // Update subscriptions table if active subscription
      if (tier) {
        await supabase.from('subscriptions').upsert(
          {
            profile_id: profile.id,
            tier,
            status: 'active',
            auto_renew: true,
          },
          { onConflict: 'profile_id' }
        );
      }

      console.log('✅ Subscription synced to database');
    } catch (error) {
      console.error('❌ Error syncing subscription to database:', error);
    }
  }, [user, customerInfo, dbPremiumStatus, dbPlatinumStatus, isDatabaseOnlyMode]);

  // In database-only mode (dev), use database status exclusively
  // In production, use RevenueCat OR database (database as fallback)
  const isSubscribed = isDatabaseOnlyMode
    ? (dbPremiumStatus || dbPlatinumStatus)
    : (hasActiveSubscription(customerInfo) || dbPremiumStatus || dbPlatinumStatus);

  const isPremium = isDatabaseOnlyMode
    ? dbPremiumStatus
    : (hasPremium(customerInfo) || dbPremiumStatus);

  const isPlatinum = isDatabaseOnlyMode
    ? dbPlatinumStatus
    : (hasPlatinum(customerInfo) || dbPlatinumStatus);

  const subscriptionTier = isDatabaseOnlyMode
    ? (dbPlatinumStatus ? 'platinum' : dbPremiumStatus ? 'premium' : null)
    : (getSubscriptionTier(customerInfo) || (dbPlatinumStatus ? 'platinum' : dbPremiumStatus ? 'premium' : null));

  // Debug log computed values
  console.log('💎 Subscription Status:', {
    appEnv: process.env.EXPO_PUBLIC_APP_ENV,
    isDatabaseOnlyMode,
    dbPremiumStatus,
    dbPlatinumStatus,
    isSubscribed,
    isPremium,
    isPlatinum,
    subscriptionTier
  });

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

  const value: SubscriptionContextType = {
    customerInfo,
    isLoading,
    isSubscribed,
    isPremium,
    isPlatinum,
    subscriptionTier,
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
