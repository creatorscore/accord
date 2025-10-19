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
  const { customerInfo, isSubscribed, isPremium, isPlatinum, subscriptionTier, refreshSubscription } = useSubscription();

  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [offerings, setOfferings] = useState<PurchasesOffering | null>(null);
  const [loadingOfferings, setLoadingOfferings] = useState(true);

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
        Alert.alert(
          'Success!',
          'Your purchases have been restored successfully.',
          [{ text: 'OK', onPress: () => refreshSubscription() }]
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
        Alert.alert(
          'Success!',
          'Your subscription has been activated.',
          [{ text: 'OK', onPress: () => refreshSubscription() }]
        );
      }
    } catch (error: any) {
      if (!error.userCancelled) {
        Alert.alert('Purchase Failed', 'Failed to complete purchase. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getSubscriptionStatus = () => {
    if (!customerInfo || !isSubscribed) {
      return {
        title: 'Free Plan',
        description: 'Limited features',
        icon: 'account-outline',
        color: '#6B7280',
      };
    }

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
        color: '#8B5CF6',
      };
    }

    return {
      title: 'Free Plan',
      description: 'Limited features',
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

        {/* Available Packages */}
        {!isSubscribed && offerings && !loadingOfferings && (
          <View className="mb-6">
            <Text className="text-xl font-bold text-gray-900 mb-4">Upgrade Your Experience</Text>

            {offerings.availablePackages.map((pkg) => (
              <TouchableOpacity
                key={pkg.identifier}
                onPress={() => handlePurchasePackage(pkg)}
                disabled={loading}
                className="mb-4"
              >
                <LinearGradient
                  colors={['#8B5CF6', '#EC4899']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  className="rounded-3xl p-6"
                >
                  <View className="flex-row items-center justify-between">
                    <View className="flex-1">
                      <Text className="text-white text-xl font-bold">
                        {pkg.product.title}
                      </Text>
                      <Text className="text-white/90 text-sm mt-1">
                        {pkg.product.description}
                      </Text>
                    </View>
                    <View className="ml-4">
                      <Text className="text-white text-2xl font-bold">
                        {pkg.product.priceString}
                      </Text>
                      <Text className="text-white/80 text-xs text-right">
                        {pkg.packageType}
                      </Text>
                    </View>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {loadingOfferings && (
          <View className="py-8 items-center">
            <ActivityIndicator size="large" color="#8B5CF6" />
            <Text className="text-gray-600 mt-2">Loading plans...</Text>
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
                  color={feature.tier === 'platinum' ? '#FFD700' : '#8B5CF6'}
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
                <ActivityIndicator size="small" color="#8B5CF6" />
                <Text className="text-purple-600 font-bold text-lg ml-2">Restoring...</Text>
              </View>
            ) : (
              <View className="flex-row items-center justify-center">
                <MaterialCommunityIcons name="restore" size={20} color="#8B5CF6" />
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
