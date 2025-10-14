import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { getOfferings, purchasePackage } from '@/lib/revenue-cat';
import { useSubscription } from '@/contexts/SubscriptionContext';

interface PremiumPaywallProps {
  visible: boolean;
  onClose: () => void;
  variant?: 'premium' | 'platinum';
  feature?: string; // What triggered the paywall (e.g., "unlimited_swipes")
}

const PREMIUM_FEATURES = [
  {
    icon: 'infinity',
    title: 'Unlimited Swipes',
    description: 'No more daily limits - swipe as much as you want',
  },
  {
    icon: 'eye',
    title: 'See Who Liked You',
    description: 'See all your likes and match instantly',
  },
  {
    icon: 'filter-variant',
    title: 'Advanced Filters',
    description: 'Filter by lifestyle, goals, and finances',
  },
  {
    icon: 'message-text',
    title: 'Intro Messages',
    description: 'Stand out with personalized first messages',
  },
  {
    icon: 'check-all',
    title: 'Read Receipts',
    description: 'Know when your messages are read',
  },
  {
    icon: 'microphone',
    title: 'Voice Messages',
    description: 'Send and receive voice notes',
  },
  {
    icon: 'undo-variant',
    title: 'Rewind',
    description: 'Take back your last swipe',
  },
  {
    icon: 'star',
    title: '5 Super Likes/Week',
    description: 'Get noticed by your top matches',
  },
];

const PLATINUM_FEATURES = [
  ...PREMIUM_FEATURES,
  {
    icon: 'shield-check',
    title: 'Background Check',
    description: 'Optional background checks for peace of mind',
  },
  {
    icon: 'library',
    title: 'Legal Resources',
    description: 'Prenup templates & attorney directory',
  },
  {
    icon: 'headset',
    title: 'Priority Support',
    description: '24/7 priority customer service',
  },
  {
    icon: 'rocket',
    title: 'Weekly Profile Boost',
    description: '30-minute visibility boost every week',
  },
];

export default function PremiumPaywall({
  visible,
  onClose,
  variant = 'premium',
  feature,
}: PremiumPaywallProps) {
  const { refreshSubscription } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'annual'>('monthly');

  const isPlatinum = variant === 'platinum';
  const features = isPlatinum ? PLATINUM_FEATURES : PREMIUM_FEATURES;
  const title = isPlatinum ? 'Accord Platinum' : 'Accord Premium';
  const monthlyPrice = isPlatinum ? '$24.99' : '$14.99';
  const annualPrice = isPlatinum ? '$199.99' : '$119.99';
  const annualSavings = isPlatinum ? '33%' : '33%';

  const handlePurchase = async () => {
    try {
      setLoading(true);

      // In development mode, simulate purchase by updating database
      if (__DEV__) {
        Alert.alert(
          'Development Mode',
          'RevenueCat is not configured yet. This would activate a real subscription in production.\n\nFor testing, would you like to enable premium status in the database?',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Enable Premium',
              onPress: async () => {
                // Import supabase and auth
                const { supabase } = await import('@/lib/supabase');
                const { useAuth } = await import('@/contexts/AuthContext');

                // This is a workaround - in real implementation you'd have user context
                Alert.alert(
                  '⚠️ Development Only',
                  'In production, this would process a real payment through Apple/Google.\n\nTo test premium features now:\n1. Go to your database\n2. Set is_premium = true for your profile\n3. Restart the app',
                  [{ text: 'OK', onPress: onClose }]
                );
              },
            },
          ]
        );
        return;
      }

      const offerings = await getOfferings();
      if (!offerings) {
        Alert.alert('Error', 'Unable to load subscription options. Please try again.');
        return;
      }

      // Get the package based on variant and selected plan
      const packageIdentifier = isPlatinum
        ? selectedPlan === 'monthly'
          ? 'platinum_monthly'
          : 'platinum_annual'
        : selectedPlan === 'monthly'
        ? 'premium_monthly'
        : 'premium_annual';

      const pkg = offerings.availablePackages.find((p) => p.identifier === packageIdentifier);

      if (!pkg) {
        Alert.alert('Error', 'Subscription package not found. Please try again.');
        return;
      }

      const customerInfo = await purchasePackage(pkg);

      if (customerInfo) {
        // Purchase successful
        await refreshSubscription();
        Alert.alert(
          '🎉 Success!',
          `Welcome to Accord ${isPlatinum ? 'Platinum' : 'Premium'}!`,
          [
            {
              text: 'Let\'s Go!',
              onPress: onClose,
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Purchase error:', error);
      Alert.alert('Error', 'Something went wrong. Please try again.');
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
        Alert.alert('Success', 'Your purchases have been restored!', [{ text: 'OK', onPress: onClose }]);
      } else {
        Alert.alert('No Purchases', 'We couldn\'t find any purchases to restore.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to restore purchases. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.container}>
        {/* Close Button */}
        <TouchableOpacity style={styles.closeButton} onPress={onClose}>
          <BlurView intensity={40} tint="dark" style={styles.closeBlur}>
            <MaterialCommunityIcons name="close" size={24} color="white" />
          </BlurView>
        </TouchableOpacity>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <MotiView
            from={{ opacity: 0, translateY: -20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 600 }}
            style={styles.header}
          >
            {isPlatinum && (
              <View style={styles.platinumBadge}>
                <MaterialCommunityIcons name="crown" size={20} color="#FFD700" />
                <Text style={styles.platinumBadgeText}>Platinum</Text>
              </View>
            )}
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>
              {feature
                ? `Unlock ${feature.replace('_', ' ')} and all premium features`
                : 'Unlock the full Accord experience'}
            </Text>
          </MotiView>

          {/* Plan Selection */}
          <View style={styles.planContainer}>
            <TouchableOpacity
              style={[styles.planCard, selectedPlan === 'monthly' && styles.planCardSelected]}
              onPress={() => setSelectedPlan('monthly')}
              activeOpacity={0.8}
            >
              <View style={styles.planHeader}>
                <Text style={styles.planName}>Monthly</Text>
                {selectedPlan === 'monthly' && (
                  <MaterialCommunityIcons name="check-circle" size={24} color="#10B981" />
                )}
              </View>
              <Text style={styles.planPrice}>{monthlyPrice}/mo</Text>
              <Text style={styles.planDescription}>7-day free trial</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.planCard, selectedPlan === 'annual' && styles.planCardSelected]}
              onPress={() => setSelectedPlan('annual')}
              activeOpacity={0.8}
            >
              <View style={styles.savingsBadge}>
                <Text style={styles.savingsBadgeText}>SAVE {annualSavings}</Text>
              </View>
              <View style={styles.planHeader}>
                <Text style={styles.planName}>Annual</Text>
                {selectedPlan === 'annual' && (
                  <MaterialCommunityIcons name="check-circle" size={24} color="#10B981" />
                )}
              </View>
              <Text style={styles.planPrice}>{annualPrice}/yr</Text>
              <Text style={styles.planDescription}>7-day free trial</Text>
            </TouchableOpacity>
          </View>

          {/* Features List */}
          <View style={styles.featuresContainer}>
            {features.map((feature, index) => (
              <MotiView
                key={feature.title}
                from={{ opacity: 0, translateX: -20 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', duration: 400, delay: index * 50 }}
                style={styles.featureItem}
              >
                <View style={styles.featureIcon}>
                  <MaterialCommunityIcons name={feature.icon as any} size={24} color="#8B5CF6" />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  <Text style={styles.featureDescription}>{feature.description}</Text>
                </View>
              </MotiView>
            ))}
          </View>

          {/* CTA Button */}
          <TouchableOpacity
            style={styles.ctaButton}
            onPress={handlePurchase}
            disabled={loading}
            activeOpacity={0.8}
          >
            <View style={styles.ctaButtonContent}>
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <Text style={styles.ctaButtonText}>Start 7-Day Free Trial</Text>
                  <Text style={styles.ctaButtonSubtext}>
                    Then {selectedPlan === 'monthly' ? monthlyPrice : annualPrice}/
                    {selectedPlan === 'monthly' ? 'mo' : 'yr'}
                  </Text>
                </>
              )}
            </View>
          </TouchableOpacity>

          {/* Restore Purchases */}
          <TouchableOpacity onPress={handleRestore} disabled={loading}>
            <Text style={styles.restoreText}>Restore Purchases</Text>
          </TouchableOpacity>

          {/* Fine Print */}
          <Text style={styles.finePrint}>
            Subscription automatically renews unless cancelled at least 24 hours before the end of the current
            period. Payment charged to your Apple or Google account. Manage in Account Settings.
          </Text>
        </ScrollView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 48,
    right: 20,
    zIndex: 100,
    borderRadius: 20,
    overflow: 'hidden',
  },
  closeBlur: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingTop: 80,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  platinumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 16,
  },
  platinumBadgeText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: '600',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    lineHeight: 24,
  },
  planContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 32,
  },
  planCard: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 20,
    padding: 20,
    borderWidth: 3,
    borderColor: 'transparent',
    position: 'relative',
  },
  planCardSelected: {
    borderColor: '#10B981',
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  planName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  planPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#8B5CF6',
    marginBottom: 4,
  },
  planDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  savingsBadge: {
    position: 'absolute',
    top: -10,
    right: 12,
    backgroundColor: '#10B981',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  savingsBadgeText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  featuresContainer: {
    gap: 20,
    marginBottom: 32,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: 'white',
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    lineHeight: 20,
  },
  ctaButton: {
    backgroundColor: 'white',
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 16,
  },
  ctaButtonContent: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  ctaButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#8B5CF6',
    marginBottom: 4,
  },
  ctaButtonSubtext: {
    fontSize: 13,
    color: '#6B7280',
  },
  restoreText: {
    textAlign: 'center',
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 15,
    marginBottom: 16,
  },
  finePrint: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 16,
  },
});
