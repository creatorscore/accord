import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import Purchases, { CustomerInfo } from 'react-native-purchases';
import {
  initializeRevenueCat,
  getCustomerInfo,
  hasActiveSubscription,
  hasPremium,
  hasPlatinum,
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
  syncWithDatabase: (freshCustomerInfo?: CustomerInfo) => Promise<boolean>;
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
  }, [user?.id, isDatabaseOnlyMode]);

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
  }, [user?.id, isDatabaseOnlyMode]);

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
        if (!isAdminUser) {
          // Sync ONLY when RevenueCat reports entitlements the DB is missing.
          // That direction can only ever GRANT access, so it's safe as a
          // missed-webhook safety net.
          //
          // Deliberately NOT syncing the reverse ("RC says nothing, DB says
          // premium"): sync-subscription writes `is_premium: hasPremium ||
          // hasPlatinum` and expires the subscription row, so that branch let a
          // device-local RC failure trigger a real revocation of a paying user.
          // An empty CustomerInfo is far more often a misconfigured app user ID
          // than a genuine lapse, and genuine lapses are already handled
          // server-side by the RevenueCat webhook, which is authoritative.
          if ((rcPremium && !dbPremiumStatus) || (rcPlatinum && !dbPlatinumStatus)) {
            await syncWithDatabase(info);
          }
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
   * Sync RevenueCat subscription status to database via the sync-subscription
   * edge function. The function re-fetches CustomerInfo server-side from the
   * RevenueCat REST API (authoritative) and upserts using the service role,
   * bypassing RLS pitfalls and any stale client state.
   *
   * Called after purchase/restore as a safety net for missed webhooks.
   */
  const syncWithDatabase = useCallback(async (_freshCustomerInfo?: CustomerInfo): Promise<boolean> => {
    if (!user) {
      return false;
    }

    try {
      const { data, error } = await supabase.functions.invoke('sync-subscription', {
        body: {},
      });

      if (error) {
        console.error('❌ sync-subscription failed:', error);
        return false;
      }

      if (data && data.success === false) {
        console.error('❌ sync-subscription returned failure:', data);
        return false;
      }

      // Refresh the local customerInfo from RC so the UI reflects the new status
      const fresh = await getCustomerInfo();
      if (fresh) setCustomerInfo(fresh);

      return true;
    } catch (error) {
      console.error('❌ Error syncing subscription to database:', error);
      return false;
    }
  }, [user]);

  // ENTITLEMENT RESOLUTION — grant if EITHER source says paid.
  //
  // This used to be "RevenueCat overrides the DB once loaded". That locked out
  // real paying subscribers: `Purchases.getCustomerInfo()` RESOLVES SUCCESSFULLY
  // with an empty `entitlements.active` whenever the SDK is configured under the
  // wrong app user ID (see initializeRevenueCat — the module-level `isInitialized`
  // guard means a later call with a different userId is a no-op, and nothing ever
  // calls Purchases.logIn/logOut). It only returns null on a *thrown* error, so
  // that empty-but-valid object set hasRevenueCatLoaded = true and silently
  // overrode a database that correctly said `is_premium`. Reported by multiple
  // paying users 2026-08-07; both audited accounts had a healthy active
  // subscription row while the app showed them the paywall.
  //
  // Safety of OR-ing: profiles.is_premium is written ONLY server-side, by the
  // RevenueCat webhook and sync-subscription (service role, RC REST API as the
  // authority). A 2026-08-07 audit found 126 active subscribers and ZERO drift
  // in any direction, so the DB flag is not a weaker signal than the client SDK
  // — it is the same signal, minus the device-local failure modes. Revocation
  // still happens, but only from the server when the webhook says the sub
  // lapsed; a flaky client can no longer take away access someone paid for.
  //
  // EXCEPTION: admin accounts always use database status (they get free premium).
  const hasRevenueCatLoaded = customerInfo !== null;

  const isSubscribed = isDatabaseOnlyMode || isAdmin
    ? (dbPremiumStatus || dbPlatinumStatus)
    : hasActiveSubscription(customerInfo) || dbPremiumStatus || dbPlatinumStatus;

  const isPremium = isDatabaseOnlyMode || isAdmin
    ? dbPremiumStatus
    : hasPremium(customerInfo) || dbPremiumStatus;

  const isPlatinum = isDatabaseOnlyMode || isAdmin
    ? dbPlatinumStatus
    : hasPlatinum(customerInfo) || dbPlatinumStatus;

  const subscriptionTier = isDatabaseOnlyMode || isAdmin
    ? (dbPlatinumStatus ? 'platinum' : dbPremiumStatus ? 'premium' : null)
    : (isPlatinum ? 'platinum' : isPremium ? 'premium' : null);

  // Gate features off the RESOLVED tier above, not off customerInfo directly.
  // canUseFeature() derives the tier from customerInfo alone, so reading it raw
  // reintroduced the same lockout this file's entitlement block fixes: a paying
  // user whose SDK returned an empty-but-valid CustomerInfo was denied every
  // premium feature despite is_premium in the DB.
  const checkFeature = useCallback(
    (feature: string) => {
      const freeFeatures = ['basic_swipes', 'basic_messaging', 'basic_profile'];
      if (freeFeatures.includes(feature)) return true;

      const premiumFeatures = [
        'unlimited_swipes', 'see_who_liked', 'super_like', 'voice_messages',
        'read_receipts', 'advanced_filters', 'rewind',
      ];
      const platinumFeatures = ['background_check', 'legal_resources', 'profile_boost'];

      if (premiumFeatures.includes(feature)) return isPremium || isPlatinum;
      if (platinumFeatures.includes(feature)) return isPlatinum;
      return false;
    },
    [isPremium, isPlatinum]
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
