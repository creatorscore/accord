import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { restorePurchases, getCustomerInfo, getOfferings, purchasePackage, presentCodeRedemptionSheet } from '@/lib/revenue-cat';
import { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

export default function SubscriptionManagement() {
  const router = useRouter();
  const { t } = useTranslation();
  const { customerInfo, isSubscribed, isPremium, isPlatinum, subscriptionTier, refreshSubscription, syncWithDatabase } = useSubscription();

  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'quarterly' | 'annual'>('monthly'); // Default to monthly (least commitment)

  // ALWAYS use RevenueCat - no development mode bypass
  // This ensures subscriptions work in TestFlight and Production
  const isDevelopmentMode = false;

  useEffect(() => {
    // Only load offerings if not in development mode
    if (!isDevelopmentMode) {
      loadOfferings();
    } else {
      setLoadingOfferings(false);
    }
  }, [isDevelopmentMode]);

  const loadOfferings = async () => {
    try {
      setLoadingOfferings(true);
      const available = await getOfferings();
      setOfferings(available);
    } catch (error: any) {
      console.error('Error loading offerings:', error);
      // Show user-friendly error message
      Alert.alert(
        t('subscriptionSettings.alerts.unableToLoadTitle'),
        error.message || t('subscriptionSettings.alerts.unableToLoadMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('subscriptionSettings.alerts.tryAgain'), onPress: loadOfferings }
        ]
      );
    } finally {
      setLoadingOfferings(false);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      setRestoring(true);
      const restored = await restorePurchases();

      if (restored && restored.entitlements.active && Object.keys(restored.entitlements.active).length > 0) {
        // Sync restored purchase with database
        await syncWithDatabase(restored);
        await refreshSubscription();

        Alert.alert(
          t('subscriptionSettings.alerts.successTitle'),
          t('subscriptionSettings.alerts.purchasesRestoredSuccess'),
          [{ text: t('common.ok') }]
        );
      } else {
        Alert.alert(
          t('subscriptionSettings.alerts.noPurchasesFoundTitle'),
          t('subscriptionSettings.alerts.noPurchasesFoundMessage')
        );
      }
    } catch (error) {
      console.error('Error restoring purchases:', error);
      Alert.alert(
        t('subscriptionSettings.alerts.restoreFailedTitle'),
        t('subscriptionSettings.alerts.restoreFailedMessage')
      );
    } finally {
      setRestoring(false);
    }
  };

  const handleManageSubscription = async () => {
    // In development mode, show info alert
    if (isDevelopmentMode) {
      Alert.alert(
        t('subscriptionSettings.alerts.developmentModeTitle'),
        t('subscriptionSettings.alerts.developmentModeMessage'),
        [{ text: t('common.ok') }]
      );
      return;
    }

    // Open App Store or Play Store subscription management
    try {
      if (Platform.OS === 'ios') {
        await Linking.openURL('https://apps.apple.com/account/subscriptions');
      } else {
        await Linking.openURL('https://play.google.com/store/account/subscriptions');
      }
    } catch (error) {
      Alert.alert(t('common.error'), t('subscriptionSettings.alerts.couldNotOpenManagement'));
    }
  };

  const handleRedeemCode = async () => {
    // Only available on iOS
    if (Platform.OS !== 'ios') {
      Alert.alert(
        t('subscriptionSettings.alerts.notAvailableTitle'),
        t('subscriptionSettings.alerts.promoCodeAndroidMessage'),
        [{ text: t('common.ok') }]
      );
      return;
    }

    try {
      setRedeeming(true);
      await presentCodeRedemptionSheet();

      // After redemption sheet closes, refresh subscription status
      // Small delay to allow Apple's systems to process
      setTimeout(async () => {
        await refreshSubscription();
      }, 2000);
    } catch (error: any) {
      console.error('Error presenting code redemption:', error);
      Alert.alert(
        t('common.error'),
        error.message || t('subscriptionSettings.alerts.codeRedemptionFailed')
      );
    } finally {
      setRedeeming(false);
    }
  };

  const handlePurchasePackage = async (pkg: PurchasesPackage) => {
    try {
      setLoading(true);
      const info = await purchasePackage(pkg);

      if (info) {
        // Sync purchase with database immediately
        await syncWithDatabase(info);
        await refreshSubscription();

        Alert.alert(
          t('subscriptionSettings.alerts.successTitle'),
          t('subscriptionSettings.alerts.subscriptionActivated'),
          [{ text: t('common.ok') }]
        );
      }
    } catch (error: any) {
      console.error('Purchase error details:', error);

      if (error.userCancelled) {
        // User cancelled, don't show error
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
        // User has a canceled subscription - guide them to reactivate or switch accounts
        Alert.alert(
          t('subscriptionSettings.alerts.subscriptionExistsTitle'),
          Platform.OS === 'android'
            ? t('subscriptionSettings.alerts.subscriptionExistsAndroid')
            : t('subscriptionSettings.alerts.subscriptionExistsIOS'),
          [
            { text: t('subscriptionSettings.alerts.gotIt'), style: 'cancel' },
            {
              text: t('subscriptionSettings.alerts.openSettings'),
              onPress: handleManageSubscription
            }
          ]
        );
      } else {
        // Other purchase errors
        Alert.alert(
          t('subscriptionSettings.alerts.purchaseFailedTitle'),
          t('subscriptionSettings.alerts.purchaseFailedMessage')
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const getSubscriptionStatus = () => {
    // Check subscription status - use the context values which handle both RevenueCat and DB
    if (isPlatinum) {
      return {
        title: t('subscriptionSettings.status.platinumMember'),
        description: t('subscriptionSettings.status.allFeaturesUnlocked'),
        icon: 'crown',
        color: '#FFD700',
      };
    }

    if (isPremium) {
      return {
        title: t('subscriptionSettings.status.premiumMember'),
        description: t('subscriptionSettings.status.enhancedFeaturesUnlocked'),
        icon: 'star',
        color: '#A08AB7',
      };
    }

    return {
      title: t('subscriptionSettings.status.freePlan'),
      description: t('subscriptionSettings.status.freeDescription'),
      icon: 'account-outline',
      color: '#6B7280',
    };
  };

  const status = getSubscriptionStatus();

  // Get expiration date if available
  const getExpirationDate = () => {
    // In development mode, show a placeholder
    if (isDevelopmentMode && isSubscribed) {
      return t('subscriptionSettings.developmentModeNA');
    }

    if (!customerInfo) return null;

    const activeEntitlements = customerInfo.entitlements.active;
    const firstEntitlement = Object.values(activeEntitlements)[0];

    if (firstEntitlement && firstEntitlement.expirationDate) {
      return new Date(firstEntitlement.expirationDate).toLocaleDateString();
    }

    return null;
  };

  const expirationDate = getExpirationDate();

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="px-6 pt-16 pb-8">
        {/* Header */}
        <View className="flex-row items-center mb-6">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mr-4 w-10 h-10 items-center justify-center"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-900">{t('subscriptionSettings.title')}</Text>
        </View>

        {/* Current Status Card */}
        <View className="mb-6">
          <LinearGradient
            colors={[status.color, `${status.color}99`]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            className="rounded-3xl p-6"
          >
            <View className="flex-row items-center mb-3">
              <MaterialCommunityIcons name={status.icon as any} size={40} color="white" />
              <View className="ml-4 flex-1">
                <Text className="text-white text-2xl font-bold">{status.title}</Text>
                <Text className="text-white/90 text-base">{status.description}</Text>
              </View>
            </View>

            {expirationDate && (
              <View className="mt-4 pt-4 border-t border-white/20">
                <Text className="text-white/90 text-sm">
                  {isDevelopmentMode ? t('subscriptionSettings.activeDevelopmentMode') : t('subscriptionSettings.renewsOn', { date: expirationDate })}
                </Text>
              </View>
            )}
          </LinearGradient>
        </View>

        {/* Subscription Plans */}
        {!isSubscribed && offerings && !loadingOfferings && (
          <View className="mb-6">
            <Text className="text-xl font-bold text-gray-900 mb-4">{t('subscriptionSettings.chooseYourPlan')}</Text>

            {/* Billing Period Toggle */}
            <View className="flex-row bg-gray-100 rounded-2xl p-1 mb-6">
              <TouchableOpacity
                onPress={() => setBillingPeriod('monthly')}
                className="flex-1"
              >
                <View className={`py-3 px-2 rounded-xl ${billingPeriod === 'monthly' ? 'bg-lavender-500' : 'bg-transparent'}`}>
                  <Text className={`text-center font-bold text-sm ${billingPeriod === 'monthly' ? 'text-white' : 'text-gray-600'}`}>
                    {t('subscriptionSettings.periods.monthly')}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setBillingPeriod('quarterly')}
                className="flex-1"
              >
                <View className={`py-3 px-2 rounded-xl ${billingPeriod === 'quarterly' ? 'bg-lavender-500' : 'bg-transparent'}`}>
                  <Text className={`text-center font-bold text-sm ${billingPeriod === 'quarterly' ? 'text-white' : 'text-gray-600'}`}>
                    {t('subscriptionSettings.periods.threeMonths')}
                  </Text>
                  <Text className={`text-center text-xs ${billingPeriod === 'quarterly' ? 'text-white/90' : 'text-green-600'}`}>
                    {t('subscriptionSettings.save22')}
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setBillingPeriod('annual')}
                className="flex-1"
              >
                <View className={`py-3 px-2 rounded-xl ${billingPeriod === 'annual' ? 'bg-lavender-500' : 'bg-transparent'}`}>
                  <Text className={`text-center font-bold text-sm ${billingPeriod === 'annual' ? 'text-white' : 'text-gray-600'}`}>
                    {t('subscriptionSettings.periods.annual')}
                  </Text>
                  <Text className={`text-center text-xs ${billingPeriod === 'annual' ? 'text-white/90' : 'text-green-600'}`}>
                    {t('subscriptionSettings.save33')}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Premium Plan */}
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <MaterialCommunityIcons name="star" size={24} color="#A08AB7" />
                <Text className="text-lg font-bold text-gray-900 ml-2">{t('subscriptionSettings.plans.premium')}</Text>
              </View>

              {(() => {
                // Log all available packages for debugging
                console.log('🔍 Available packages:', offerings.availablePackages.map(pkg => ({
                  identifier: pkg.identifier,
                  productId: pkg.product.identifier,
                })));

                // Try to find premium package for current billing period
                // Check for various naming patterns: premium_monthly, premium-monthly, monthly_premium, etc.
                const premiumPackage = offerings.availablePackages.find(pkg => {
                  const id = pkg.identifier.toLowerCase();
                  const productId = pkg.product.identifier.toLowerCase();
                  const isPremium = id.includes('premium') || productId.includes('premium');

                  // Check if package matches billing period
                  const isMonthly = id.includes('month') || productId.includes('month') || id.includes('1m') || productId.includes('1m');
                  const isQuarterly = id.includes('quarter') || productId.includes('quarter') || id.includes('3m') || productId.includes('3m') || id.includes('3_month') || productId.includes('3_month');
                  const isAnnual = id.includes('annual') || productId.includes('annual') || id.includes('year') || productId.includes('year') || id.includes('12m') || productId.includes('12m');

                  if (billingPeriod === 'monthly') {
                    return isPremium && isMonthly && !isQuarterly;
                  } else if (billingPeriod === 'quarterly') {
                    return isPremium && isQuarterly;
                  } else {
                    return isPremium && isAnnual;
                  }
                });

                console.log('🎯 Found premium package:', premiumPackage?.identifier);

                // If no package found for specific billing period, try to find ANY premium package
                const displayPackage = premiumPackage || offerings.availablePackages.find(pkg => {
                  const id = pkg.identifier.toLowerCase();
                  const productId = pkg.product.identifier.toLowerCase();
                  return id.includes('premium') || productId.includes('premium');
                });

                if (!displayPackage) {
                  console.warn(`⚠️ No premium package found at all`);
                  return (
                    <View className="bg-yellow-50 border border-yellow-300 rounded-2xl p-6">
                      <Text className="text-yellow-800 text-center">{t('subscriptionSettings.planNotAvailable', { plan: 'Premium', period: billingPeriod })}</Text>
                    </View>
                  );
                }

                return (
                  <TouchableOpacity
                    key={displayPackage.identifier}
                    onPress={() => handlePurchasePackage(displayPackage)}
                    disabled={loading}
                  >
                    <View className="bg-white border-2 border-lavender-300 rounded-2xl p-6">
                      {billingPeriod === 'quarterly' && (
                        <View className="absolute -top-2 right-4 bg-green-500 px-3 py-1 rounded-full">
                          <Text className="text-white text-xs font-bold">{t('subscriptionSettings.bestValueSave22')}</Text>
                        </View>
                      )}
                      {billingPeriod === 'annual' && (
                        <View className="absolute -top-2 right-4 bg-green-500 px-3 py-1 rounded-full">
                          <Text className="text-white text-xs font-bold">{t('subscriptionSettings.save33')}</Text>
                        </View>
                      )}
                      <View className="flex-row items-baseline mb-3">
                        <Text className="text-4xl font-bold text-lavender-600">
                          {displayPackage.product.priceString}
                        </Text>
                        <Text className="text-gray-600 ml-2">
                          /{billingPeriod === 'monthly' ? t('subscriptionSettings.perMonth') : billingPeriod === 'quarterly' ? t('subscriptionSettings.perThreeMonths') : t('subscriptionSettings.perYear')}
                        </Text>
                      </View>
                      {billingPeriod === 'quarterly' && (
                        <Text className="text-green-600 text-sm font-medium mb-2">
                          {t('subscriptionSettings.quarterlyPopular')}
                        </Text>
                      )}
                      <View className="bg-lavender-500 rounded-xl py-4 mb-4">
                        <Text className="text-white text-center text-lg font-bold">
                          {loading ? t('subscriptionSettings.processing') : t('subscriptionSettings.subscribeToPremium')}
                        </Text>
                      </View>
                      <View className="bg-lavender-50 rounded-xl p-4">
                        <Text className="text-xs text-gray-700 font-semibold mb-2">{t('subscriptionSettings.premiumIncludes')}</Text>
                        <Text className="text-xs text-gray-600 leading-5">
                          {t('subscriptionSettings.premiumFeaturesList')}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })()}
            </View>

            {/* Platinum Plan */}
            {(() => {
              // Try to find platinum package for current billing period
              const platinumPackage = offerings.availablePackages.find(pkg => {
                const id = pkg.identifier.toLowerCase();
                const productId = pkg.product.identifier.toLowerCase();
                const isPlatinum = id.includes('platinum') || productId.includes('platinum');

                // Check if package matches billing period
                const isMonthly = id.includes('month') || productId.includes('month') || id.includes('1m') || productId.includes('1m');
                const isAnnual = id.includes('annual') || productId.includes('annual') || id.includes('year') || productId.includes('year') || id.includes('12m') || productId.includes('12m');

                if (billingPeriod === 'monthly') {
                  return isPlatinum && isMonthly;
                } else {
                  return isPlatinum && isAnnual;
                }
              });

              console.log('🎯 Found platinum package:', platinumPackage?.identifier);

              // If no platinum package found, show "Coming Soon"
              if (!platinumPackage) {
                return (
                  <View className="mb-6">
                    <View className="flex-row items-center mb-3">
                      <MaterialCommunityIcons name="crown" size={24} color="#FFD700" />
                      <Text className="text-lg font-bold text-gray-900 ml-2">{t('subscriptionSettings.plans.platinum')}</Text>
                      <View className="bg-blue-100 px-2 py-0.5 rounded-full ml-2">
                        <Text className="text-blue-700 text-xs font-bold">{t('subscriptionSettings.comingSoon')}</Text>
                      </View>
                    </View>

                    <View className="bg-gradient-to-br from-yellow-100 to-orange-100 border-2 border-yellow-300 rounded-2xl p-6 opacity-75">
                      <View className="flex-row items-baseline mb-3">
                        <Text className="text-4xl font-bold text-gray-400">
                          {billingPeriod === 'monthly' ? '$24.99' : '$199.99'}
                        </Text>
                        <Text className="text-gray-500 ml-2">
                          /{billingPeriod === 'monthly' ? t('subscriptionSettings.perMonth') : t('subscriptionSettings.perYear')}
                        </Text>
                      </View>
                      <View className="bg-gray-300 rounded-xl py-4 mb-4">
                        <Text className="text-gray-600 text-center text-lg font-bold">{t('subscriptionSettings.comingSoon')}</Text>
                      </View>
                      <View className="bg-white/50 rounded-xl p-4">
                        <Text className="text-xs text-gray-700 font-semibold mb-2">{t('subscriptionSettings.everythingInPremiumPlus')}</Text>
                        <Text className="text-xs text-gray-600 leading-5">
                          {t('subscriptionSettings.platinumFeaturesList')}
                        </Text>
                        <Text className="text-xs text-gray-500 italic mt-2">
                          {t('subscriptionSettings.platinumComingSoonMessage')}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              }

              // Platinum package exists - render purchasable card
              return (
                <View className="mb-6">
                  <View className="flex-row items-center mb-3">
                    <MaterialCommunityIcons name="crown" size={24} color="#FFD700" />
                    <Text className="text-lg font-bold text-gray-900 ml-2">{t('subscriptionSettings.plans.platinum')}</Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => handlePurchasePackage(platinumPackage)}
                    disabled={loading}
                  >
                    <View className="bg-white border-2 border-yellow-300 rounded-2xl p-6">
                      {billingPeriod === 'annual' && (
                        <View className="absolute -top-2 right-4 bg-green-500 px-3 py-1 rounded-full">
                          <Text className="text-white text-xs font-bold">{t('subscriptionSettings.save33')}</Text>
                        </View>
                      )}
                      <View className="flex-row items-baseline mb-3">
                        <Text className="text-4xl font-bold text-yellow-600">
                          {platinumPackage.product.priceString}
                        </Text>
                        <Text className="text-gray-600 ml-2">
                          /{billingPeriod === 'monthly' ? t('subscriptionSettings.perMonth') : t('subscriptionSettings.perYear')}
                        </Text>
                      </View>
                      <View className="bg-yellow-500 rounded-xl py-4 mb-4">
                        <Text className="text-white text-center text-lg font-bold">
                          {loading ? t('subscriptionSettings.processing') : t('subscriptionSettings.subscribeToPlatinum')}
                        </Text>
                      </View>
                      <View className="bg-yellow-50 rounded-xl p-4">
                        <Text className="text-xs text-gray-700 font-semibold mb-2">{t('subscriptionSettings.everythingInPremiumPlus')}</Text>
                        <Text className="text-xs text-gray-600 leading-5">
                          {t('subscriptionSettings.platinumFeaturesList')}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </View>
        )}

        {loadingOfferings && (
          <View className="py-8 items-center">
            <ActivityIndicator size="large" color="#A08AB7" />
            <Text className="text-gray-600 mt-2">{t('subscriptionSettings.loadingPlans')}</Text>
          </View>
        )}

        {/* Show error if offerings failed to load and not in development mode */}
        {!loadingOfferings && !offerings && !isSubscribed && !isDevelopmentMode && (
          <View className="mb-6 bg-red-50 border-2 border-red-200 rounded-2xl p-6">
            <View className="flex-row items-start">
              <MaterialCommunityIcons name="alert-circle" size={24} color="#DC2626" />
              <View className="flex-1 ml-3">
                <Text className="text-red-900 font-bold text-lg mb-2">
                  {t('subscriptionSettings.unableToLoadTitle')}
                </Text>
                <Text className="text-red-800 text-sm mb-3">
                  {t('subscriptionSettings.unableToLoadDescription')}
                </Text>
                <Text className="text-red-800 text-sm ml-2 mb-1">{t('subscriptionSettings.errorReasons.revenueCat')}</Text>
                <Text className="text-red-800 text-sm ml-2 mb-1">{t('subscriptionSettings.errorReasons.network')}</Text>
                <Text className="text-red-800 text-sm ml-2 mb-3">{t('subscriptionSettings.errorReasons.serviceUnavailable')}</Text>
                <TouchableOpacity
                  onPress={loadOfferings}
                  className="bg-red-600 rounded-full py-3 px-4 mt-2"
                >
                  <View className="flex-row items-center justify-center">
                    <MaterialCommunityIcons name="refresh" size={20} color="white" />
                    <Text className="text-white font-bold ml-2">{t('subscriptionSettings.alerts.tryAgain')}</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Features List */}
        <View className="mb-6">
          <Text className="text-xl font-bold text-gray-900 mb-4">{t('subscriptionSettings.premiumFeaturesTitle')}</Text>

          <View className="bg-lavender-50 rounded-3xl p-6">
            {[
              { icon: 'infinity', text: t('subscriptionSettings.features.unlimitedSwipes'), tier: 'premium' },
              { icon: 'eye', text: t('subscriptionSettings.features.seeWhoLikedYou'), tier: 'premium' },
              { icon: 'star', text: t('subscriptionSettings.features.superLikesPerWeek'), tier: 'premium' },
              { icon: 'microphone', text: t('subscriptionSettings.features.voiceMessages'), tier: 'premium' },
              { icon: 'check-all', text: t('subscriptionSettings.features.readReceipts'), tier: 'premium' },
              { icon: 'filter', text: t('subscriptionSettings.features.advancedFilters'), tier: 'premium' },
              { icon: 'undo', text: t('subscriptionSettings.features.rewindLastSwipe'), tier: 'premium' },
              { icon: 'shield-check', text: t('subscriptionSettings.features.backgroundChecks'), tier: 'platinum' },
              { icon: 'scale-balance', text: t('subscriptionSettings.features.legalResources'), tier: 'platinum' },
              { icon: 'rocket', text: t('subscriptionSettings.features.weeklyProfileBoost'), tier: 'platinum' },
              { icon: 'headset', text: t('subscriptionSettings.features.prioritySupport'), tier: 'platinum' },
            ].map((feature, index) => (
              <View key={index} className="flex-row items-center mb-3">
                <MaterialCommunityIcons
                  name={feature.icon as any}
                  size={24}
                  color={feature.tier === 'platinum' ? '#FFD700' : '#A08AB7'}
                />
                <Text className="text-gray-800 text-base ml-3 flex-1">{feature.text}</Text>
                {feature.tier === 'platinum' && (
                  <View className="bg-yellow-400 px-2 py-1 rounded-full">
                    <Text className="text-yellow-900 text-xs font-bold">{t('subscriptionSettings.plans.platinum').toUpperCase()}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View className="space-y-3">
          {/* Restore Purchases */}
          <TouchableOpacity
            onPress={handleRestorePurchases}
            disabled={restoring}
            className="bg-white border-2 border-lavender-500 rounded-full py-4 px-6"
          >
            {restoring ? (
              <View className="flex-row items-center justify-center">
                <ActivityIndicator size="small" color="#A08AB7" />
                <Text className="text-lavender-600 font-bold text-lg ml-2">{t('subscriptionSettings.restoring')}</Text>
              </View>
            ) : (
              <View className="flex-row items-center justify-center">
                <MaterialCommunityIcons name="restore" size={20} color="#A08AB7" />
                <Text className="text-lavender-600 font-bold text-lg ml-2">{t('subscriptionSettings.restorePurchases')}</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Redeem Code (iOS only) */}
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              onPress={handleRedeemCode}
              disabled={redeeming}
              className="bg-white border-2 border-green-500 rounded-full py-4 px-6"
            >
              {redeeming ? (
                <View className="flex-row items-center justify-center">
                  <ActivityIndicator size="small" color="#22C55E" />
                  <Text className="text-green-600 font-bold text-lg ml-2">{t('subscriptionSettings.opening')}</Text>
                </View>
              ) : (
                <View className="flex-row items-center justify-center">
                  <MaterialCommunityIcons name="gift" size={20} color="#22C55E" />
                  <Text className="text-green-600 font-bold text-lg ml-2">{t('subscriptionSettings.redeemPromoCode')}</Text>
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Manage Subscription (if subscribed) */}
          {isSubscribed && (
            <TouchableOpacity
              onPress={handleManageSubscription}
              className="bg-gray-100 rounded-full py-4 px-6"
            >
              <View className="flex-row items-center justify-center">
                <MaterialCommunityIcons name="cog" size={20} color="#4B5563" />
                <Text className="text-gray-700 font-bold text-lg ml-2">
                  {t('subscriptionSettings.manageSubscription')}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Info Text */}
        <View className="mt-8 bg-blue-50 rounded-2xl p-4">
          <View className="flex-row items-start">
            <MaterialCommunityIcons name="information" size={20} color="#3B82F6" />
            <View className="flex-1 ml-3">
              <Text className="text-blue-900 text-sm">
                {Platform.OS === 'ios'
                  ? t('subscriptionSettings.infoTextIOS')
                  : t('subscriptionSettings.infoTextAndroid')}
              </Text>
            </View>
          </View>
        </View>

        {/* Terms of Use & Privacy Policy (Required by App Store) */}
        <View className="mt-4 flex-row justify-center items-center space-x-4">
          <TouchableOpacity
            onPress={() => Linking.openURL('https://joinaccord.app/terms')}
            className="py-2"
          >
            <Text className="text-lavender-600 text-sm font-medium underline">{t('subscriptionSettings.termsOfUse')}</Text>
          </TouchableOpacity>
          <Text className="text-gray-400">•</Text>
          <TouchableOpacity
            onPress={() => Linking.openURL('https://joinaccord.app/privacy')}
            className="py-2"
          >
            <Text className="text-lavender-600 text-sm font-medium underline">{t('subscriptionSettings.privacyPolicy')}</Text>
          </TouchableOpacity>
        </View>

        {/* Development Mode Notice */}
        {isDevelopmentMode && (
          <View className="mt-4 bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4">
            <View className="flex-row items-start">
              <MaterialCommunityIcons name="dev-to" size={20} color="#92400E" />
              <View className="flex-1 ml-3">
                <Text className="text-yellow-900 text-sm font-bold mb-1">{t('subscriptionSettings.developmentMode')}</Text>
                <Text className="text-yellow-800 text-sm">
                  {t('subscriptionSettings.developmentModeDescription')}
                </Text>
                <Text className="text-yellow-800 text-sm mt-2">
                  {t('subscriptionSettings.developmentModeProductionNote')}
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
