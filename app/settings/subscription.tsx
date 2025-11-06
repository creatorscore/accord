import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Linking, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { restorePurchases, getCustomerInfo, getOfferings, purchasePackage } from '@/lib/revenue-cat';
import { PurchasesOffering, PurchasesPackage } from 'react-native-purchases';

export default function SubscriptionManagement() {
  const router = useRouter();
  const { customerInfo, isSubscribed, isPremium, isPlatinum, subscriptionTier, refreshSubscription, syncWithDatabase } = useSubscription();

  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual'); // Default to annual (best value)

  // Check if in development mode
  const isDevelopmentMode = process.env.EXPO_PUBLIC_APP_ENV === 'development' || __DEV__;

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
    } catch (error) {
      console.error('Error loading offerings:', error);
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
          'Success!',
          'Your purchases have been restored successfully.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'No Purchases Found',
          'We couldn\'t find any purchases to restore. If you believe this is an error, please contact support.'
        );
      }
    } catch (error) {
      console.error('Error restoring purchases:', error);
      Alert.alert(
        'Restore Failed',
        'Failed to restore purchases. Please try again later.'
      );
    } finally {
      setRestoring(false);
    }
  };

  const handleManageSubscription = async () => {
    // In development mode, show info alert
    if (isDevelopmentMode) {
      Alert.alert(
        'Development Mode',
        'Subscription management is handled via the database in development mode.\n\nIn production, this will open your App Store or Play Store subscription settings.',
        [{ text: 'OK' }]
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
      Alert.alert('Error', 'Could not open subscription management');
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
          'Success!',
          'Your subscription has been activated.',
          [{ text: 'OK' }]
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
          'Subscription Already Exists',
          Platform.OS === 'android'
            ? 'You have a canceled subscription on your current Google Play account.\n\nOptions:\n\n1. Reactivate your existing subscription in Google Play Settings\n\n2. Use a different Google Play account: Sign out of Google Play on your device, then sign in with a different account and try again'
            : 'You have a canceled subscription on your current Apple ID.\n\nOptions:\n\n1. Reactivate your existing subscription in App Store Settings\n\n2. Use a different Apple ID: Sign out in Settings > [Your Name], then sign in with a different Apple ID and try again',
          [
            { text: 'Got It', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: handleManageSubscription
            }
          ]
        );
      } else {
        // Other purchase errors
        Alert.alert(
          'Purchase Failed',
          'Failed to complete purchase. Please try again or contact support if the problem persists.'
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
        title: 'Platinum Member',
        description: 'All premium features unlocked',
        icon: 'crown',
        color: '#FFD700',
      };
    }

    if (isPremium) {
      return {
        title: 'Premium Member',
        description: 'Enhanced features unlocked',
        icon: 'star',
        color: '#9B87CE',
      };
    }

    return {
      title: 'Free Plan',
      description: '25 swipes per day, basic messaging',
      icon: 'account-outline',
      color: '#6B7280',
    };
  };

  const status = getSubscriptionStatus();

  // Get expiration date if available
  const getExpirationDate = () => {
    // In development mode, show a placeholder
    if (isDevelopmentMode && isSubscribed) {
      return 'N/A (Development Mode)';
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
          <Text className="text-2xl font-bold text-gray-900">Subscription</Text>
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
                  {isDevelopmentMode ? 'Active (Development Mode)' : `Renews on: ${expirationDate}`}
                </Text>
              </View>
            )}
          </LinearGradient>
        </View>

        {/* Subscription Plans */}
        {!isSubscribed && offerings && !loadingOfferings && (
          <View className="mb-6">
            <Text className="text-xl font-bold text-gray-900 mb-4">Choose Your Plan</Text>

            {/* Billing Period Toggle */}
            <View className="flex-row bg-gray-100 rounded-full p-1 mb-6">
              <TouchableOpacity
                onPress={() => setBillingPeriod('monthly')}
                className="flex-1"
              >
                <View className={`py-3 rounded-full ${billingPeriod === 'monthly' ? 'bg-purple-500' : 'bg-transparent'}`}>
                  <Text className={`text-center font-bold ${billingPeriod === 'monthly' ? 'text-white' : 'text-gray-600'}`}>
                    Monthly
                  </Text>
                </View>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setBillingPeriod('annual')}
                className="flex-1"
              >
                <View className={`py-3 rounded-full ${billingPeriod === 'annual' ? 'bg-purple-500' : 'bg-transparent'}`}>
                  <Text className={`text-center font-bold ${billingPeriod === 'annual' ? 'text-white' : 'text-gray-600'}`}>
                    Annual
                    <Text className="text-xs"> (Save 33%)</Text>
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* Premium Plan */}
            <View className="mb-6">
              <View className="flex-row items-center mb-3">
                <MaterialCommunityIcons name="star" size={24} color="#9B87CE" />
                <Text className="text-lg font-bold text-gray-900 ml-2">Premium</Text>
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
                  const isAnnual = id.includes('annual') || productId.includes('annual') || id.includes('year') || productId.includes('year') || id.includes('12m') || productId.includes('12m');

                  if (billingPeriod === 'monthly') {
                    return isPremium && isMonthly;
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
                      <Text className="text-yellow-800 text-center">Premium {billingPeriod} plan not available in RevenueCat</Text>
                    </View>
                  );
                }

                return (
                  <TouchableOpacity
                    key={displayPackage.identifier}
                    onPress={() => handlePurchasePackage(displayPackage)}
                    disabled={loading}
                  >
                    <View className="bg-white border-2 border-purple-300 rounded-2xl p-6">
                      {billingPeriod === 'annual' && (
                        <View className="absolute -top-2 right-4 bg-green-500 px-3 py-1 rounded-full">
                          <Text className="text-white text-xs font-bold">SAVE 33%</Text>
                        </View>
                      )}
                      <View className="flex-row items-baseline mb-3">
                        <Text className="text-4xl font-bold text-purple-600">
                          {displayPackage.product.priceString}
                        </Text>
                        <Text className="text-gray-600 ml-2">
                          /{billingPeriod === 'monthly' ? 'month' : 'year'}
                        </Text>
                      </View>
                      <View className="bg-purple-500 rounded-xl py-4 mb-4">
                        <Text className="text-white text-center text-lg font-bold">
                          {loading ? 'Processing...' : 'Subscribe to Premium'}
                        </Text>
                      </View>
                      <View className="bg-purple-50 rounded-xl p-4">
                        <Text className="text-xs text-gray-700 font-semibold mb-2">Premium includes:</Text>
                        <Text className="text-xs text-gray-600 leading-5">
                          • Unlimited swipes{'\n'}
                          • See who liked you{'\n'}
                          • 5 Super Likes/week{'\n'}
                          • Voice messages{'\n'}
                          • Read receipts{'\n'}
                          • Advanced filters{'\n'}
                          • Rewind
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
                      <Text className="text-lg font-bold text-gray-900 ml-2">Platinum</Text>
                      <View className="bg-blue-100 px-2 py-0.5 rounded-full ml-2">
                        <Text className="text-blue-700 text-xs font-bold">COMING SOON</Text>
                      </View>
                    </View>

                    <View className="bg-gradient-to-br from-yellow-100 to-orange-100 border-2 border-yellow-300 rounded-2xl p-6 opacity-75">
                      <View className="flex-row items-baseline mb-3">
                        <Text className="text-4xl font-bold text-gray-400">
                          {billingPeriod === 'monthly' ? '$24.99' : '$199.99'}
                        </Text>
                        <Text className="text-gray-500 ml-2">
                          /{billingPeriod === 'monthly' ? 'month' : 'year'}
                        </Text>
                      </View>
                      <View className="bg-gray-300 rounded-xl py-4 mb-4">
                        <Text className="text-gray-600 text-center text-lg font-bold">Coming Soon</Text>
                      </View>
                      <View className="bg-white/50 rounded-xl p-4">
                        <Text className="text-xs text-gray-700 font-semibold mb-2">Everything in Premium, plus:</Text>
                        <Text className="text-xs text-gray-600 leading-5">
                          • Weekly profile boost{'\n'}
                          • Background checks{'\n'}
                          • Legal resources{'\n'}
                          • Priority support
                        </Text>
                        <Text className="text-xs text-gray-500 italic mt-2">
                          Stay tuned! Platinum tier launching soon.
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
                    <Text className="text-lg font-bold text-gray-900 ml-2">Platinum</Text>
                  </View>

                  <TouchableOpacity
                    onPress={() => handlePurchasePackage(platinumPackage)}
                    disabled={loading}
                  >
                    <View className="bg-white border-2 border-yellow-300 rounded-2xl p-6">
                      {billingPeriod === 'annual' && (
                        <View className="absolute -top-2 right-4 bg-green-500 px-3 py-1 rounded-full">
                          <Text className="text-white text-xs font-bold">SAVE 33%</Text>
                        </View>
                      )}
                      <View className="flex-row items-baseline mb-3">
                        <Text className="text-4xl font-bold text-yellow-600">
                          {platinumPackage.product.priceString}
                        </Text>
                        <Text className="text-gray-600 ml-2">
                          /{billingPeriod === 'monthly' ? 'month' : 'year'}
                        </Text>
                      </View>
                      <View className="bg-yellow-500 rounded-xl py-4 mb-4">
                        <Text className="text-white text-center text-lg font-bold">
                          {loading ? 'Processing...' : 'Subscribe to Platinum'}
                        </Text>
                      </View>
                      <View className="bg-yellow-50 rounded-xl p-4">
                        <Text className="text-xs text-gray-700 font-semibold mb-2">Everything in Premium, plus:</Text>
                        <Text className="text-xs text-gray-600 leading-5">
                          • Weekly profile boost{'\n'}
                          • Background checks{'\n'}
                          • Legal resources{'\n'}
                          • Priority support
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
            <ActivityIndicator size="large" color="#9B87CE" />
            <Text className="text-gray-600 mt-2">Loading plans...</Text>
          </View>
        )}

        {/* Show error if offerings failed to load and not in development mode */}
        {!loadingOfferings && !offerings && !isSubscribed && !isDevelopmentMode && (
          <View className="mb-6 bg-red-50 border-2 border-red-200 rounded-2xl p-6">
            <View className="flex-row items-start">
              <MaterialCommunityIcons name="alert-circle" size={24} color="#DC2626" />
              <View className="flex-1 ml-3">
                <Text className="text-red-900 font-bold text-lg mb-2">
                  Unable to Load Subscription Options
                </Text>
                <Text className="text-red-800 text-sm mb-3">
                  We're having trouble loading subscription plans. This could be because:
                </Text>
                <Text className="text-red-800 text-sm ml-2 mb-1">• Offerings not configured in RevenueCat</Text>
                <Text className="text-red-800 text-sm ml-2 mb-1">• Network connection issue</Text>
                <Text className="text-red-800 text-sm ml-2 mb-3">• RevenueCat service temporarily unavailable</Text>
                <TouchableOpacity
                  onPress={loadOfferings}
                  className="bg-red-600 rounded-full py-3 px-4 mt-2"
                >
                  <View className="flex-row items-center justify-center">
                    <MaterialCommunityIcons name="refresh" size={20} color="white" />
                    <Text className="text-white font-bold ml-2">Try Again</Text>
                  </View>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Features List */}
        <View className="mb-6">
          <Text className="text-xl font-bold text-gray-900 mb-4">Premium Features</Text>

          <View className="bg-purple-50 rounded-3xl p-6">
            {[
              { icon: 'infinity', text: 'Unlimited swipes', tier: 'premium' },
              { icon: 'eye', text: 'See who liked you', tier: 'premium' },
              { icon: 'star', text: '5 Super Likes per week', tier: 'premium' },
              { icon: 'microphone', text: 'Voice messages', tier: 'premium' },
              { icon: 'check-all', text: 'Read receipts', tier: 'premium' },
              { icon: 'filter', text: 'Advanced filters', tier: 'premium' },
              { icon: 'undo', text: 'Rewind last swipe', tier: 'premium' },
              { icon: 'shield-check', text: 'Background checks', tier: 'platinum' },
              { icon: 'scale-balance', text: 'Legal resources', tier: 'platinum' },
              { icon: 'rocket', text: 'Weekly profile boost', tier: 'platinum' },
              { icon: 'headset', text: 'Priority support', tier: 'platinum' },
            ].map((feature, index) => (
              <View key={index} className="flex-row items-center mb-3">
                <MaterialCommunityIcons
                  name={feature.icon as any}
                  size={24}
                  color={feature.tier === 'platinum' ? '#FFD700' : '#9B87CE'}
                />
                <Text className="text-gray-800 text-base ml-3 flex-1">{feature.text}</Text>
                {feature.tier === 'platinum' && (
                  <View className="bg-yellow-400 px-2 py-1 rounded-full">
                    <Text className="text-yellow-900 text-xs font-bold">PLATINUM</Text>
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
            className="bg-white border-2 border-purple-500 rounded-full py-4 px-6"
          >
            {restoring ? (
              <View className="flex-row items-center justify-center">
                <ActivityIndicator size="small" color="#9B87CE" />
                <Text className="text-purple-600 font-bold text-lg ml-2">Restoring...</Text>
              </View>
            ) : (
              <View className="flex-row items-center justify-center">
                <MaterialCommunityIcons name="restore" size={20} color="#9B87CE" />
                <Text className="text-purple-600 font-bold text-lg ml-2">Restore Purchases</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Manage Subscription (if subscribed) */}
          {isSubscribed && (
            <TouchableOpacity
              onPress={handleManageSubscription}
              className="bg-gray-100 rounded-full py-4 px-6"
            >
              <View className="flex-row items-center justify-center">
                <MaterialCommunityIcons name="cog" size={20} color="#4B5563" />
                <Text className="text-gray-700 font-bold text-lg ml-2">
                  Manage Subscription
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
                Subscriptions are managed through your {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} account.
                You can cancel anytime from your account settings.
              </Text>
            </View>
          </View>
        </View>

        {/* Development Mode Notice */}
        {isDevelopmentMode && (
          <View className="mt-4 bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-4">
            <View className="flex-row items-start">
              <MaterialCommunityIcons name="dev-to" size={20} color="#92400E" />
              <View className="flex-1 ml-3">
                <Text className="text-yellow-900 text-sm font-bold mb-1">Development Mode</Text>
                <Text className="text-yellow-800 text-sm">
                  RevenueCat is disabled in development. Your subscription status is controlled by the <Text className="font-mono">is_premium</Text> and <Text className="font-mono">is_platinum</Text> flags in the database.
                </Text>
                <Text className="text-yellow-800 text-sm mt-2">
                  In production, this screen will show real subscription packages and allow users to manage their subscriptions through the App Store or Play Store.
                </Text>
              </View>
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
