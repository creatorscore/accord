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

  // Load premium status from database (for development)
  useEffect(() => {
    console.log('🔄 SubscriptionContext: useEffect triggered', {
      hasUser: !!user,
      userId: user?.id,
      isDev: __DEV__
    });
    if (user && __DEV__) {
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

      if (error) throw error;

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
      // Skip RevenueCat in development/Expo Go
      if (__DEV__) {
        console.log('Skipping RevenueCat in development');
        setIsLoading(false);
        return;
      }
      initializeRevenueCat(user.id);
      loadSubscriptionStatus();
    } else {
      setCustomerInfo(null);
      setIsLoading(false);
    }
  }, [user]);

  // Listen for subscription updates
  useEffect(() => {
    if (!user || __DEV__) return; // Skip in development

    const listener = Purchases.addCustomerInfoUpdateListener((info) => {
      setCustomerInfo(info);
    });

    return () => {
      listener.remove();
    };
  }, [user]);

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

  // In development, use database status; in production, use RevenueCat
  const isSubscribed = __DEV__ ? (dbPremiumStatus || dbPlatinumStatus) : hasActiveSubscription(customerInfo);
  const isPremium = __DEV__ ? dbPremiumStatus : hasPremium(customerInfo);
  const isPlatinum = __DEV__ ? dbPlatinumStatus : hasPlatinum(customerInfo);
  const subscriptionTier = __DEV__
    ? (dbPlatinumStatus ? 'platinum' : dbPremiumStatus ? 'premium' : null)
    : getSubscriptionTier(customerInfo);

  // Debug log computed values
  console.log('💎 Subscription Status:', {
    isDev: __DEV__,
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
