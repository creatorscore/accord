import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
  StatusBar,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider, initialWindowMetrics } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeBlurView } from '@/components/shared/SafeBlurView';
import { getOfferings, purchasePackage } from '@/lib/revenue-cat';
import { trackUserAction, trackFunnel } from '@/lib/analytics';
import { openExternalURL } from '@/lib/external-link';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTranslation } from 'react-i18next';

interface PremiumPaywallProps {
  visible: boolean;
  onClose: () => void;
  variant?: 'premium' | 'platinum';
  feature?: string; // What triggered the paywall (e.g., "unlimited_swipes")
}

// Top features — the bullets shown on the purple card. Ordered by impact
// (most-asked-for at the top). The full feature list lives in account
// settings under "What you get with Premium".
const PREMIUM_HIGHLIGHT_KEYS = [
  { icon: 'infinity', titleKey: 'unlimitedLikes' },
  { icon: 'eye', titleKey: 'seeWhoLikedYou' },
  { icon: 'star', titleKey: 'superLikes' },
  { icon: 'filter-variant', titleKey: 'advancedFilters' },
  { icon: 'incognito', titleKey: 'incognitoMode' },
  { icon: 'check-all', titleKey: 'readReceipts' },
];

const PLATINUM_HIGHLIGHT_KEYS = [
  { icon: 'infinity', titleKey: 'unlimitedLikes' },
  { icon: 'eye', titleKey: 'seeWhoLikedYou' },
  { icon: 'rocket', titleKey: 'weeklyBoost' },
  { icon: 'headset', titleKey: 'prioritySupport' },
  { icon: 'shield-check', titleKey: 'backgroundCheck' },
];

// Weekly plan is RETIRED for new buyers (2026-07-23). It retained terribly
// (4% vs monthly 25%, annual 74% — measured 2026-07-21): weekly buyers churn
// after ~one cycle, so it dragged LTV without adding durable revenue. The
// product stays live in the stores/RevenueCat so existing weekly subscribers
// keep renewing (backward compatible), but the paywall no longer surfaces it.
// Flip to true to bring the option back.
const WEEKLY_PLAN_ENABLED = false;

export default function PremiumPaywall({
  visible,
  onClose,
  variant = 'premium',
  feature,
}: PremiumPaywallProps) {
  const { refreshSubscription, syncWithDatabase } = useSubscription();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  // Default to ANNUAL: it retains dramatically better (74% vs monthly 25%,
  // weekly 4% — measured 2026-07-21) and has the best per-month price, so it
  // both lifts LTV and captures revenue up front before the ~40-day churn.
  // Weekly is retired for new buyers (see WEEKLY_PLAN_ENABLED). The 'weekly'
  // union member is retained only so existing weekly subscribers' state is
  // still representable.
  const [selectedPlan, setSelectedPlan] = useState<'weekly' | 'monthly' | 'quarterly' | 'annual'>('annual');
  // Flips to true only when RevenueCat actually returns a weekly
  // package in the offering. The product is still live in both stores
  // (existing weekly subscribers keep renewing), but we no longer OFFER
  // it to new buyers — see WEEKLY_PLAN_ENABLED below.
  const [hasWeeklyPackage, setHasWeeklyPackage] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Live RC packages keyed by lowercased product identifier. Stores
  // priceString (localized formatted) AND the numeric price + currency
  // code so we can compute per-month equivalents in the user's local
  // currency instead of falling back to hardcoded USD.
  const [livePackages, setLivePackages] = useState<Record<string, {
    priceString: string;
    price: number;
    currencyCode: string;
  }>>({});

  // Reset closing state when paywall opens
  useEffect(() => {
    if (visible) {
      setIsClosing(false);
      // Top of the conversion funnel. These events existed in lib/analytics.ts
      // but were never fired anywhere, so paywall→purchase was unmeasurable.
      trackUserAction.paywallViewed(feature);
      trackFunnel.paywallViewed();
    }
  }, [visible, feature]);

  // Hide the Android navigation bar (gesture pill / 3-button bar) while
  // the paywall is open so the gray card visually claims the bottom of
  // the screen instead of being cut off by the system bar. Restores the
  // user's normal nav bar when the paywall closes. iOS home indicator
  // cannot be hidden from JS — that needs a native config change.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let cancelled = false;
    (async () => {
      try {
        const NavigationBar = await import('expo-navigation-bar');
        if (cancelled) return;
        if (visible) {
          await NavigationBar.setVisibilityAsync('hidden');
          // setBehaviorAsync('overlay-swipe') was used here to let the user
          // swipe to reveal the nav bar while hidden. It's deprecated/
          // unsupported on Android 15+ with edge-to-edge layout (Expo SDK
          // 54 default) and emits a WARN per open. The OS already handles
          // swipe-to-reveal on edge-to-edge, so dropping the call is a
          // no-op behaviorally and just silences the warning.
        } else {
          await NavigationBar.setVisibilityAsync('visible');
        }
      } catch (err) {
        // Library may not be available in Expo Go — silently no-op.
      }
    })();
    return () => {
      cancelled = true;
      if (Platform.OS !== 'android') return;
      // Always restore the nav bar on unmount so we don't leak the
      // hidden state into the rest of the app.
      import('expo-navigation-bar')
        .then((NavigationBar) => NavigationBar.setVisibilityAsync('visible'))
        .catch(() => {});
    };
  }, [visible]);

  // Fetch live RC offerings when paywall becomes visible. We only care
  // about package metadata (price + currency + which periods are
  // available) — there are no trials configured on any plan, so we
  // skip the trial-eligibility check entirely.
  //
  // Previously this effect bailed early under __DEV__ to avoid hitting
  // RC in development. The side-effect was that hasWeeklyPackage stayed
  // false for every dev build, which meant the weekly plan was
  // invisible during local testing — a real-device walk-through on
  // 2026-05-28 surfaced this as "weekly subscription plan is missing"
  // without anyone realizing the dev skip was responsible. RC is
  // internet-accessible from dev too; let it run.
  useEffect(() => {
    if (!visible) return;

    let cancelled = false;

    const fetchOfferings = async () => {
      try {
        const offerings = await getOfferings();
        if (!offerings || cancelled) return;
        const packages: Record<string, { priceString: string; price: number; currencyCode: string }> = {};
        let weeklyFound = false;
        // Log the raw RC offering so we can debug "weekly is missing"
        // reports without having to attach a debugger. The output is
        // small (a few entries) and only fires when the paywall opens.
        const debugSummary: { product: string; package: string; period: string | undefined }[] = [];
        for (const pkg of offerings.availablePackages) {
          const id = pkg.product.identifier.toLowerCase();
          const pkgId = pkg.identifier.toLowerCase();
          packages[id] = {
            priceString: pkg.product.priceString,
            price: pkg.product.price,
            currencyCode: pkg.product.currencyCode,
          };
          debugSummary.push({ product: pkg.product.identifier, package: pkg.identifier, period: (pkg.product as any).subscriptionPeriod });
          // Detect a weekly package across the common naming schemes:
          //   accord_premium_weekly, $rc_weekly, premium_1w, weekly, etc.
          if ((id.includes('week') || id.includes('1w') || pkgId.includes('week') || pkgId === '$rc_weekly') &&
              !id.includes('biweek')) {
            weeklyFound = true;
          }
        }
        console.log('[Paywall] RC offerings:', debugSummary, 'weeklyFound =', weeklyFound);
        setLivePackages(packages);
        setHasWeeklyPackage(weeklyFound);
      } catch (error) {
        console.warn('[Paywall] Failed to fetch RC offerings:', error);
      }
    };

    fetchOfferings();

    return () => { cancelled = true; };
  }, [visible]);

  const isPlatinum = variant === 'platinum';
  const highlightKeys = isPlatinum ? PLATINUM_HIGHLIGHT_KEYS : PREMIUM_HIGHLIGHT_KEYS;
  const title = isPlatinum ? t('premiumPaywall.accordPlatinum') : t('premiumPaywall.accordPremium');

  // Find the matching RC package for a given tier + period.
  const findLivePackage = (tier: string, period: string) => {
    for (const [id, pkg] of Object.entries(livePackages)) {
      const tierMatch = tier === 'platinum' ? id.includes('platinum') : (id.includes('premium') && !id.includes('platinum'));
      if (!tierMatch) continue;
      const isWeekly = (id.includes('week') || id.includes('1w')) && !id.includes('biweek');
      const isMonthly = (id.includes('month') || id.includes('1m')) && !id.includes('3m') && !id.includes('3_month');
      const isQuarterly = id.includes('quarter') || id.includes('3m') || id.includes('3_month');
      const isAnnual = id.includes('annual') || id.includes('year') || id.includes('12m');
      if (period === 'weekly' && isWeekly) return pkg;
      if (period === 'monthly' && isMonthly && !isQuarterly && !isWeekly) return pkg;
      if (period === 'quarterly' && isQuarterly) return pkg;
      if (period === 'annual' && isAnnual) return pkg;
    }
    return null;
  };

  // Localized priceString from RC, fall back to hardcoded USD.
  const getLivePrice = (tier: string, period: string, fallback: string): string => {
    return findLivePackage(tier, period)?.priceString ?? fallback;
  };

  // Format a numeric amount in a given currency. Uses Intl when available
  // (Hermes 0.71+ ships ICU); fall back to a simple "<currency> <amount>"
  // string so we never crash on older runtimes.
  const formatLocalCurrency = (amount: number, currencyCode: string): string => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: 2,
      }).format(amount);
    } catch {
      return `${currencyCode} ${amount.toFixed(2)}`;
    }
  };

  // Per-month equivalent for a quarterly/annual plan, computed from the
  // RC numeric price and formatted in the user's local currency. Falls
  // back to the hardcoded USD string when RC data isn't available
  // (e.g. Expo Go in dev).
  const getPerMonthEq = (tier: string, period: 'monthly' | 'quarterly' | 'annual', fallback: string): string => {
    const pkg = findLivePackage(tier, period);
    if (!pkg) return fallback;
    const monthsInPeriod = period === 'monthly' ? 1 : period === 'quarterly' ? 3 : 12;
    return formatLocalCurrency(pkg.price / monthsInPeriod, pkg.currencyCode);
  };

  const tier = isPlatinum ? 'platinum' : 'premium';
  // Weekly is currently Premium-only — Platinum stays on monthly/quarterly/annual.
  const weeklyPrice = getLivePrice(tier, 'weekly', '$5.99');
  const monthlyPrice = getLivePrice(tier, 'monthly', isPlatinum ? '$24.99' : '$14.99');
  const quarterlyPrice = getLivePrice(tier, 'quarterly', isPlatinum ? '$54.99' : '$34.99');
  const annualPrice = getLivePrice(tier, 'annual', isPlatinum ? '$199.99' : '$119.99');
  const quarterlySavings = '22%';
  const annualSavings = '33%';
  // Weekly is retired for new buyers (WEEKLY_PLAN_ENABLED === false), so this
  // is always false in production. The !isPlatinum && hasWeeklyPackage guards
  // remain so that flipping the flag back on restores the original
  // data-driven behavior (Premium-only, only when RC returns the package).
  const showWeekly = WEEKLY_PLAN_ENABLED && !isPlatinum && hasWeeklyPackage;

  const handlePurchase = async () => {
    try {
      setLoading(true);

      // In development mode, simulate purchase by updating database
      if (__DEV__) {
        Alert.alert(
          t('premiumPaywall.alerts.devModeTitle'),
          t('premiumPaywall.alerts.devModeMessage'),
          [
            {
              text: t('premiumPaywall.alerts.cancel'),
              style: 'cancel',
            },
            {
              text: t('premiumPaywall.alerts.enablePremium'),
              onPress: async () => {
                Alert.alert(
                  t('premiumPaywall.alerts.devOnlyTitle'),
                  t('premiumPaywall.alerts.devOnlyMessage'),
                  [{ text: t('common.ok'), onPress: onClose }]
                );
              },
            },
          ]
        );
        return;
      }

      const offerings = await getOfferings();
      if (!offerings) {
        Alert.alert(t('common.error'), t('premiumPaywall.alerts.errorLoadPlans'));
        return;
      }

      // Get the package based on variant and selected plan
      // Use flexible pattern matching (same as subscription page)
      const pkg = offerings.availablePackages.find((p) => {
        const id = p.identifier.toLowerCase();
        const productId = p.product.identifier.toLowerCase();

        // Check tier (premium or platinum)
        const tierMatch = isPlatinum
          ? (id.includes('platinum') || productId.includes('platinum'))
          : (id.includes('premium') || productId.includes('premium'));

        // Check billing period with multiple patterns
        const isWeekly = (id.includes('week') || productId.includes('week') || id.includes('1w') || productId.includes('1w')) && !id.includes('biweek') && !productId.includes('biweek');
        const isMonthly = id.includes('month') || productId.includes('month') || id.includes('1m') || productId.includes('1m');
        const isQuarterly = id.includes('quarter') || productId.includes('quarter') || id.includes('3m') || productId.includes('3m') || id.includes('3_month') || productId.includes('3_month');
        const isAnnual = id.includes('annual') || productId.includes('annual') || id.includes('year') || productId.includes('year') || id.includes('12m') || productId.includes('12m');

        let periodMatch = false;
        if (selectedPlan === 'weekly') {
          periodMatch = isWeekly;
        } else if (selectedPlan === 'monthly') {
          periodMatch = isMonthly && !isQuarterly && !isWeekly;
        } else if (selectedPlan === 'quarterly') {
          periodMatch = isQuarterly;
        } else {
          periodMatch = isAnnual;
        }
        const matches = tierMatch && periodMatch;

        return matches;
      });

      if (!pkg) {
        // Fallback: Try to find ANY premium package if exact match not found
        const fallbackPkg = offerings.availablePackages.find((p) => {
          const id = p.identifier.toLowerCase();
          const productId = p.product.identifier.toLowerCase();
          return id.includes('premium') || productId.includes('premium');
        });

        if (fallbackPkg) {
          Alert.alert(
            t('premiumPaywall.alerts.subscriptionPackage'),
            t('premiumPaywall.alerts.wouldYouLikeToSubscribe', { title: fallbackPkg.product.title, price: fallbackPkg.product.priceString }),
            [
              { text: t('premiumPaywall.alerts.cancel'), style: 'cancel' },
              {
                text: t('premiumPaywall.alerts.subscribe'),
                onPress: async () => {
                  const customerInfo = await purchasePackage(fallbackPkg);
                  if (customerInfo) {
                    trackUserAction.subscriptionStarted(variant as 'premium' | 'platinum', selectedPlan as any);
                    trackFunnel.subscriptionCompleted(variant);
                    await refreshSubscription();
                    await syncWithDatabase(customerInfo);
                    Alert.alert(t('premiumPaywall.alerts.successTitle'), t('premiumPaywall.alerts.welcomePremium'), [
                      { text: t('premiumPaywall.alerts.letsGo'), onPress: onClose }
                    ]);
                  }
                }
              }
            ]
          );
          return;
        }

        Alert.alert(t('common.error'), t('premiumPaywall.alerts.packageNotFound'));
        return;
      }

      const customerInfo = await purchasePackage(pkg);

      if (customerInfo) {
        // Bottom of the funnel — records the conversion (tier + plan) so
        // paywall_viewed → subscription_completed is finally measurable.
        trackUserAction.subscriptionStarted(variant as 'premium' | 'platinum', selectedPlan as any);
        trackFunnel.subscriptionCompleted(variant);
        // Purchase successful - sync to database and refresh
        await refreshSubscription();
        const synced = await syncWithDatabase(customerInfo);
        if (!synced) {
          // Purchase went through on RevenueCat but DB sync failed. The periodic
          // reconcile-subscriptions cron + next app launch will self-heal, but
          // tell the user so they don't panic if features don't unlock immediately.
          Alert.alert(
            t('premiumPaywall.alerts.successTitle'),
            'Your purchase went through! It may take a minute to activate — if it doesn\'t appear right away, please reopen the app.',
            [{ text: t('premiumPaywall.alerts.letsGo'), onPress: onClose }]
          );
          return;
        }
        Alert.alert(
          t('premiumPaywall.alerts.successTitle'),
          t('premiumPaywall.alerts.welcomeTier', { tier: isPlatinum ? t('premiumPaywall.platinum') : 'Premium' }),
          [
            {
              text: t('premiumPaywall.alerts.letsGo'),
              onPress: onClose,
            },
          ]
        );
      } else {
        Alert.alert(
          t('premiumPaywall.alerts.purchaseFailedTitle'),
          t('premiumPaywall.alerts.purchaseFailedMessage'),
          [{ text: t('common.ok') }]
        );
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        readableErrorCode: error.readableErrorCode,
        underlyingErrorMessage: error.underlyingErrorMessage,
        userCancelled: error.userCancelled,
        fullError: JSON.stringify(error, null, 2)
      });

      // Check if user cancelled
      if (error.userCancelled || error.code === 'E_USER_CANCELLED') {
        return;
      }

      // Check for Google Play canceled subscription error
      const errorMessage = error.message || error.toString();
      const errorCode = error.code || '';

      if (
        errorMessage.toLowerCase().includes('unable to change') ||
        errorMessage.toLowerCase().includes('manage subscription') ||
        errorCode === 'PRODUCT_ALREADY_OWNED' ||
        errorCode === '7' // Google Play error code for already owned
      ) {
        Alert.alert(
          t('premiumPaywall.alerts.subscriptionExistsTitle'),
          Platform.OS === 'android'
            ? t('premiumPaywall.alerts.subscriptionExistsAndroid')
            : t('premiumPaywall.alerts.subscriptionExistsIOS'),
          [
            { text: t('premiumPaywall.alerts.gotIt'), style: 'cancel', onPress: onClose },
            {
              text: t('premiumPaywall.alerts.openSettings'),
              onPress: async () => {
                try {
                  if (Platform.OS === 'ios') {
                    await Linking.openURL('https://apps.apple.com/account/subscriptions');
                  } else {
                    await Linking.openURL('https://play.google.com/store/account/subscriptions');
                  }
                  onClose();
                } catch (err) {
                  Alert.alert(t('common.error'), t('premiumPaywall.alerts.couldNotOpenManagement'));
                }
              }
            }
          ]
        );
      } else if (errorMessage.includes('Product not available')) {
        Alert.alert(t('common.error'), t('premiumPaywall.alerts.productNotAvailable'), [{ text: t('common.ok') }]);
      } else if (errorMessage.includes('network')) {
        Alert.alert(t('common.error'), t('premiumPaywall.alerts.networkError'), [{ text: t('common.ok') }]);
      } else {
        // Show detailed error for debugging in TestFlight
        const debugInfo = `Code: ${errorCode}\nMessage: ${errorMessage}\nReadable: ${error.readableErrorCode || 'N/A'}\nUnderlying: ${error.underlyingErrorMessage || 'N/A'}`;

        Alert.alert(
          t('premiumPaywall.alerts.purchaseErrorTitle'),
          __DEV__
            ? debugInfo
            : t('premiumPaywall.alerts.purchaseErrorMessage') + '\n\nError: ' + errorMessage,
          [
            {
              text: t('premiumPaywall.alerts.copyError'),
              onPress: () => {
                // Note: In production, you'd use Clipboard.setString(debugInfo)
              }
            },
            { text: t('common.ok') }
          ]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async () => {
    try {
      setLoading(true);
      const { restorePurchases } = await import('@/lib/revenue-cat');
      const customerInfo = await restorePurchases();

      if (customerInfo) {
        await refreshSubscription();
        await syncWithDatabase(customerInfo);
        Alert.alert(t('premiumPaywall.alerts.successTitle'), t('premiumPaywall.alerts.restoreSuccess'), [{ text: t('common.ok'), onPress: onClose }]);
      } else {
        Alert.alert(t('premiumPaywall.alerts.restoreNoPurchases'), t('premiumPaywall.alerts.restoreNoPurchases'));
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('premiumPaywall.alerts.restoreFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Helpers used by the plan rows below.
  const handleClose = () => { setIsClosing(true); setTimeout(onClose, 100); };

  // Per-month equivalent strings shown on each plan card. Computed
  // dynamically from the live RC numeric price + currency code so they
  // localize correctly (¥1,500/mo, €12,99/mo, etc.). The fallback USD
  // strings only show when RC isn't initialized (e.g. Expo Go in dev).
  const monthlyEq = getPerMonthEq(tier, 'monthly', isPlatinum ? '$24.99' : '$14.99');
  const quarterlyMonthlyEq = getPerMonthEq(tier, 'quarterly', isPlatinum ? '$18.33' : '$11.66');
  const annualMonthlyEq = getPerMonthEq(tier, 'annual', isPlatinum ? '$16.66' : '$9.99');

  const renderPlanCard = (
    key: 'quarterly' | 'annual' | 'monthly' | 'weekly',
    name: string,
    totalPrice: string,
    periodLabel: string,
    perUnitPrice: string,
    perUnitLabel: string,
    badge?: { label: string; type: 'best' },
  ) => {
    const isSelected = selectedPlan === key;
    return (
      <TouchableOpacity
        key={key}
        style={[styles.planCard, isSelected && styles.planCardSelected]}
        onPress={() => setSelectedPlan(key)}
        activeOpacity={0.85}
      >
        {badge && (
          <View style={styles.bestOfferBadge}>
            <MaterialCommunityIcons name="fire" size={11} color="#1A1A2E" />
            <Text style={styles.bestOfferText}>{badge.label}</Text>
          </View>
        )}
        <View style={styles.planCardHeader}>
          <Text style={styles.planCardName}>{name}</Text>
          {isSelected && (
            <View style={styles.checkCircle}>
              <MaterialCommunityIcons name="check" size={14} color="#FFFFFF" />
            </View>
          )}
        </View>
        <View style={styles.planCardBody}>
          <Text style={styles.planCardTotal}>{totalPrice}</Text>
          <Text style={styles.planCardPeriod}>{periodLabel}</Text>
        </View>
        <View style={styles.planCardFooter}>
          <Text style={styles.planCardPerUnit}>{perUnitPrice}</Text>
          <Text style={styles.planCardPerUnitLabel}>{perUnitLabel}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      {/* A React Native Modal renders in a separate native root that is
          outside the app's SafeAreaProvider, so SafeAreaView insets resolve
          to 0 inside it — which left the close "X" flush against the top edge
          (under the status bar) and untappable, most visibly on iPad. Adding
          a SafeAreaProvider here gives the inner SafeAreaViews real insets;
          initialWindowMetrics seeds them synchronously to avoid a layout
          flicker on open. */}
      <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <SafeAreaView style={styles.root} edges={['bottom', 'left', 'right']}>
        <StatusBar
          barStyle="dark-content"
          backgroundColor="#FFFFFF"
          translucent={true}
          animated={true}
        />

        {/* The card stack scrolls only when it doesn't fit.
            Nothing here could scroll before, so on a short screen (or at a
            large system font scale) the Subscribe button and the legal
            links below it were simply unreachable — the user could see the
            plans but had no way to get to the CTA. That is a hard stop on
            the one screen that takes money.

            flexGrow: 1 means the layout is byte-for-byte unchanged whenever
            the content fits: the purple card still meets the gray card
            flush and the CTA stays inside the gray card as designed. It
            only becomes scrollable when it would otherwise overflow, and
            the scroll indicator is left on so that overflow is visible —
            the welcome screen taught us that a hidden indicator plus a
            viewport-filling layout reads as "this screen is finished". */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={true}
        >

        {/* TOP CARD — solid light purple, extends to the very top of the
            screen (behind the status bar). Inner SafeAreaView pushes the
            close button + content below the status bar so they're not
            occluded. Side and bottom margins keep the card visually
            distinct from the page background. */}
        <View style={styles.topCardWrapper}>
          <View style={styles.topCard}>
            <SafeAreaView edges={['top']}>
            {/* Close X */}
            <TouchableOpacity
              style={styles.closeButton}
              onPress={handleClose}
              disabled={isClosing}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <MaterialCommunityIcons name="close" size={26} color="#1A1A2E" />
            </TouchableOpacity>

            {/* Title + benefits */}
            <View style={styles.topContent}>
              {isPlatinum && (
                <View style={styles.platinumBadge}>
                  <MaterialCommunityIcons name="crown" size={14} color="#FFD700" />
                  <Text style={styles.platinumBadgeText}>{t('premiumPaywall.platinum')}</Text>
                </View>
              )}
              <Text style={styles.title}>
                {/* Hard linebreak so the headline reads on two lines like the
                    reference design — a single line shrinks the vertical
                    breathing room between the title and the benefit list. */}
                {t(
                  isPlatinum ? 'premiumPaywall.whatPlatinumGetsYou' : 'premiumPaywall.whatPremiumGetsYou',
                  isPlatinum ? 'What Platinum\ngets you:' : 'What Premium\ngets you:',
                )}
              </Text>
              <View style={styles.benefitList}>
                {highlightKeys.map((feat) => (
                  <View key={feat.titleKey} style={styles.benefitRow}>
                    <MaterialCommunityIcons name="lightning-bolt" size={18} color="#1A1A2E" />
                    <Text style={styles.benefitText}>
                      {t(`premiumPaywall.features.${feat.titleKey}`)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
            </SafeAreaView>
          </View>
        </View>

        {/* BOTTOM CARD — light gray container floating on white,
            holds white plan cards + CTA + exits + legal */}
        <View style={styles.bottomCardWrapper}>
          <View style={styles.bottomCard}>
            <View style={styles.planContainer}>
              {renderPlanCard(
                'annual',
                t('premiumPaywall.annual'),
                annualPrice,
                t('premiumPaywall.everyYear', 'every year'),
                annualMonthlyEq,
                t('premiumPaywall.perMonthLabel', 'per month'),
                { label: t('premiumPaywall.bestOffer', 'BEST OFFER').toUpperCase(), type: 'best' },
              )}
              {renderPlanCard(
                'quarterly',
                t('premiumPaywall.threeMonths'),
                quarterlyPrice,
                t('premiumPaywall.everyThreeMonths', 'every 3 months'),
                quarterlyMonthlyEq,
                t('premiumPaywall.perMonthLabel', 'per month'),
              )}
              {renderPlanCard(
                'monthly',
                t('premiumPaywall.monthly'),
                monthlyPrice,
                t('premiumPaywall.everyMonth', 'every month'),
                monthlyEq,
                t('premiumPaywall.perMonthLabel', 'per month'),
              )}
              {showWeekly && renderPlanCard(
                'weekly',
                t('premiumPaywall.weekly', 'Weekly'),
                weeklyPrice,
                t('premiumPaywall.everyWeek', 'every week'),
                weeklyPrice,
                t('premiumPaywall.perWeekLabel', 'per week'),
              )}
            </View>

            {/* CTA — platform-specific. The IAP is processed by the App
                Store (iOS) or Google Play (Android), so the button text
                + icon mirror that. No trial logic — Accord has no trial
                period on any plan. */}
            <TouchableOpacity
              style={styles.ctaButton}
              onPress={handlePurchase}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <View style={styles.ctaButtonInner}>
                  <Text style={styles.ctaButtonText}>
                    {t('premiumPaywall.subscribeWith', 'Subscribe with')}
                  </Text>
                  <MaterialCommunityIcons
                    name={Platform.OS === 'ios' ? 'apple' : 'google'}
                    size={24}
                    color="#FFFFFF"
                    style={styles.ctaButtonIcon}
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* Legal: Restore · Terms · Privacy */}
            <View style={styles.bottomLinksRow}>
              <TouchableOpacity onPress={handleRestore} disabled={loading}>
                <Text style={styles.bottomLinkText}>{t('premiumPaywall.restorePurchases')}</Text>
              </TouchableOpacity>
              <Text style={styles.legalLinkSeparator}>·</Text>
              <TouchableOpacity onPress={() => openExternalURL('https://joinaccord.app/terms')}>
                <Text style={styles.bottomLinkText}>{t('premiumPaywall.termsOfUse')}</Text>
              </TouchableOpacity>
              <Text style={styles.legalLinkSeparator}>·</Text>
              <TouchableOpacity onPress={() => openExternalURL('https://joinaccord.app/privacy')}>
                <Text style={styles.bottomLinkText}>{t('premiumPaywall.privacyPolicy')}</Text>
              </TouchableOpacity>
            </View>

            {/* Auto-renewal disclosure — required for App Store review. */}
            <Text style={styles.finePrint}>
              {t(
                'premiumPaywall.autoRenewDisclosure',
                'Subscription auto-renews unless cancelled at least 24 hours before the end of the current period. Manage in your account settings.',
              )}
            </Text>
          </View>
        </View>

        </ScrollView>
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF', // page bg — visible on all sides of both cards
  },

  // ── TOP CARD — solid light purple, runs to top edge, meets the gray
  //    card flush with no white gap between them.
  topCardWrapper: {
    paddingHorizontal: 16,
    // No paddingTop — card flows under the status bar; inner SafeAreaView
    // handles status-bar clearance so the content sits below it.
    // No paddingBottom — purple card meets the gray card edge-to-edge.
  },
  topCard: {
    backgroundColor: '#D9CCE6', // lighter shade of brand purple — dark text pops
    // Top corners square (card flows to the screen edge); bottom corners
    // rounded — they touch the gray card directly with no white gap, but
    // the curves stay visible.
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 18,
  },
  closeButton: {
    alignSelf: 'flex-end',
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topContent: {
    paddingTop: 0,
  },
  platinumBadge: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(26, 26, 46, 0.12)',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
    marginBottom: 8,
  },
  platinumBadgeText: {
    color: '#1A1A2E',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 38,
    fontWeight: '600',
    color: '#1A1A2E',
    lineHeight: 44,
    letterSpacing: -0.5,
    marginBottom: 12,
    marginTop: -8, // pull title up tighter to the close button row
  },
  benefitList: {
    gap: 12,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  benefitText: {
    fontSize: 16,
    color: '#1A1A2E',
    fontWeight: '500',
    flex: 1,
  },

  // ── BOTTOM CARD — light gray, meets the purple card flush at the top,
  //    floats above the white page bg at the bottom (rounded bottom
  //    corners + bottom margin so the bottom edge is visible).
  bottomCardWrapper: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 8, // white gap below the card so its bottom edge + corners are visible
  },
  bottomCard: {
    flex: 1,
    backgroundColor: '#F2F1F4', // light gray with a hint of purple to harmonize
    borderRadius: 24, // all four corners rounded — card is fully visible
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 16,
  },

  // ── Plan cards — vertical, 2 per row grid ────────────────────────
  planContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  planCard: {
    // Two columns: width less than 50% to leave room for the row gap.
    // Using `width` (not flexBasis/flexGrow) — that combo can prevent
    // wrap in React Native flexbox.
    width: '48%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    minHeight: 130,
  },
  planCardSelected: {
    borderColor: '#1A1A2E',
  },
  planCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  planCardName: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1A1A2E',
    flex: 1,
  },
  planCardBody: {
    marginBottom: 8,
  },
  planCardTotal: {
    fontSize: 19,
    fontWeight: '700',
    color: '#1A1A2E',
  },
  planCardPeriod: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 1,
  },
  planCardFooter: {
    marginTop: 'auto',
  },
  planCardPerUnit: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A2E',
  },
  planCardPerUnitLabel: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 1,
  },
  // Only rendered when a card is selected — the empty unselected ring
  // was visual noise on every other card.
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1A2E',
  },
  // "BEST OFFER" yellow chip with flame icon — sits at the top edge of
  // the card, slightly overlapping it.
  bestOfferBadge: {
    position: 'absolute',
    top: -10,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FFD84D',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    zIndex: 1,
  },
  bestOfferText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1A1A2E',
    letterSpacing: 0.5,
  },

  // ── CTA + exits + legal ───────────────────────────────────────────
  ctaButton: {
    backgroundColor: '#1A1A2E', // black, matches reference
    borderRadius: 28,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 6,
  },
  ctaButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ctaButtonIcon: {
    marginLeft: 2,
  },
  ctaButtonText: {
    fontSize: 20,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  bottomLinksRow: {
    flexDirection: 'row',
    // Wrap so the three links stack instead of running off both edges at
    // large font scales — at font_scale 1.5 this rendered as "estore
    // Purchases · Terms of Use · Privacy Polic". These are the App Store
    // compliance links, so they have to stay fully readable.
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 6,
    paddingHorizontal: 8,
  },
  bottomLinkText: {
    fontSize: 12,
    color: '#A08AB7',
    textDecorationLine: 'underline',
  },
  legalLinkSeparator: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  finePrint: {
    fontSize: 11,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 15,
    paddingHorizontal: 4,
  },
});
