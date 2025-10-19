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

  // Load premium status from database (for development)
  useEffect(() => {
    console.log('🔄 SubscriptionContext: useEffect triggered', {
      hasUser: !!user,
      userId: user?.id,
      appEnv: process.env.EXPO_PUBLIC_APP_ENV,
      isDatabaseOnlyMode
    });
    if (user && isDatabaseOnlyMode) {
      console.log('📞 Calling loadDatabasePremiumStatus...');
      loadDatabasePremiumStatus();
    }
  }, [user, isDatabaseOnlyMode]);

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
      initializeRevenueCat(user.id);
      loadSubscriptionStatus();
    } else {
      setCustomerInfo(null);
      setIsLoading(false);
    }
  }, [user, isDatabaseOnlyMode]);

  // Listen for subscription updates
  useEffect(() => {
    if (!user || isDatabaseOnlyMode) return; // Skip in database-only mode

    const listener = Purchases.addCustomerInfoUpdateListener((info) => {
      setCustomerInfo(info);
    });

    return () => {
      listener.remove();
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
  }, []);

  // In database-only mode, use database status; otherwise use RevenueCat
  const isSubscribed = isDatabaseOnlyMode ? (dbPremiumStatus || dbPlatinumStatus) : hasActiveSubscription(customerInfo);
  const isPremium = isDatabaseOnlyMode ? dbPremiumStatus : hasPremium(customerInfo);
  const isPlatinum = isDatabaseOnlyMode ? dbPlatinumStatus : hasPlatinum(customerInfo);
  const subscriptionTier = isDatabaseOnlyMode
    ? (dbPlatinumStatus ? 'platinum' : dbPremiumStatus ? 'premium' : null)
    : getSubscriptionTier(customerInfo);

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
