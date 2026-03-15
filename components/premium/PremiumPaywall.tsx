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
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeBlurView } from '@/components/shared/SafeBlurView';
import { getOfferings, purchasePackage, checkTrialEligibility, getTrialInfo, TrialInfo } from '@/lib/revenue-cat';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTranslation } from 'react-i18next';

interface PremiumPaywallProps {
  visible: boolean;
  onClose: () => void;
  variant?: 'premium' | 'platinum';
  feature?: string; // What triggered the paywall (e.g., "unlimited_swipes")
}

const PREMIUM_FEATURE_KEYS = [
  { icon: 'infinity', titleKey: 'unlimitedLikes', descKey: 'unlimitedLikesDesc' },
  { icon: 'eye', titleKey: 'seeWhoLikedYou', descKey: 'seeWhoLikedYouDesc' },
  { icon: 'lightning-bolt', titleKey: 'activityCenter', descKey: 'activityCenterDesc' },
  { icon: 'filter-variant', titleKey: 'advancedFilters', descKey: 'advancedFiltersDesc' },
  { icon: 'incognito', titleKey: 'incognitoMode', descKey: 'incognitoModeDesc' },
  { icon: 'check-all', titleKey: 'readReceipts', descKey: 'readReceiptsDesc' },
  { icon: 'keyboard', titleKey: 'typingIndicators', descKey: 'typingIndicatorsDesc' },
  { icon: 'microphone', titleKey: 'voiceMessages', descKey: 'voiceMessagesDesc' },
  { icon: 'undo-variant', titleKey: 'rewind', descKey: 'rewindDesc' },
  { icon: 'star', titleKey: 'superLikes', descKey: 'superLikesDesc' },
];

const PLATINUM_EXTRA_KEYS = [
  { icon: 'shield-check', titleKey: 'backgroundCheck', descKey: 'backgroundCheckDesc', comingSoon: true },
  { icon: 'library', titleKey: 'legalResources', descKey: 'legalResourcesDesc', comingSoon: true },
  { icon: 'headset', titleKey: 'prioritySupport', descKey: 'prioritySupportDesc', comingSoon: false },
  { icon: 'rocket', titleKey: 'weeklyBoost', descKey: 'weeklyBoostDesc', comingSoon: true },
];

export default function PremiumPaywall({
  visible,
  onClose,
  variant = 'premium',
  feature,
}: PremiumPaywallProps) {
  const { refreshSubscription, syncWithDatabase } = useSubscription();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'quarterly' | 'annual'>('monthly'); // Default to monthly (least commitment)
  const [isClosing, setIsClosing] = useState(false);

  const [trialEligibility, setTrialEligibility] = useState<Record<string, { eligible: boolean; trialInfo: TrialInfo }>>({});

  // Check trial eligibility when paywall becomes visible
  useEffect(() => {
    if (!visible || __DEV__) return;

    let cancelled = false;

    const fetchTrialEligibility = async () => {
      try {
        const offerings = await getOfferings();
        if (!offerings || cancelled) return;
        const eligibility = await checkTrialEligibility(offerings.availablePackages);
        if (!cancelled) {
          setTrialEligibility(eligibility);
        }
      } catch (error) {
        console.warn('⚠️ Failed to check trial eligibility:', error);
      }
    };

    fetchTrialEligibility();

    return () => { cancelled = true; };
  }, [visible]);

  /**
   * Get trial text for a given tier and billing period.
   * Looks through eligibility data to find a matching product.
   */
  const getTrialTextForPlan = (tier: 'premium' | 'platinum', period: 'monthly' | 'quarterly' | 'annual'): { text: string | null; eligible: boolean } => {
    for (const [productId, data] of Object.entries(trialEligibility)) {
      const id = productId.toLowerCase();
      const tierMatch = tier === 'platinum' ? id.includes('platinum') : id.includes('premium');
      if (!tierMatch) continue;

      const isMonthly = (id.includes('month') || id.includes('1m')) && !id.includes('3m') && !id.includes('3_month');
      const isQuarterly = id.includes('quarter') || id.includes('3m') || id.includes('3_month');
      const isAnnual = id.includes('annual') || id.includes('year') || id.includes('12m');

      let periodMatch = false;
      if (period === 'monthly') periodMatch = isMonthly && !isQuarterly;
      else if (period === 'quarterly') periodMatch = isQuarterly;
      else periodMatch = isAnnual;

      if (periodMatch && data.eligible && data.trialInfo.trialText) {
        return { text: data.trialInfo.trialText, eligible: true };
      }
      if (periodMatch) {
        return { text: null, eligible: false };
      }
    }
    return { text: null, eligible: false };
  };

  const isPlatinum = variant === 'platinum';
  const featureKeys = isPlatinum ? [...PREMIUM_FEATURE_KEYS, ...PLATINUM_EXTRA_KEYS] : PREMIUM_FEATURE_KEYS;
  const title = isPlatinum ? t('premiumPaywall.accordPlatinum') : t('premiumPaywall.accordPremium');
  const monthlyPrice = isPlatinum ? '$24.99' : '$14.99';
  const quarterlyPrice = isPlatinum ? '$54.99' : '$34.99';
  const annualPrice = isPlatinum ? '$199.99' : '$119.99';
  const quarterlySavings = '22%';
  const annualSavings = '33%';

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
        const isMonthly = id.includes('month') || productId.includes('month') || id.includes('1m') || productId.includes('1m');
        const isQuarterly = id.includes('quarter') || productId.includes('quarter') || id.includes('3m') || productId.includes('3m') || id.includes('3_month') || productId.includes('3_month');
        const isAnnual = id.includes('annual') || productId.includes('annual') || id.includes('year') || productId.includes('year') || id.includes('12m') || productId.includes('12m');

        let periodMatch = false;
        if (selectedPlan === 'monthly') {
          periodMatch = isMonthly && !isQuarterly;
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
        // Purchase successful - sync to database and refresh
        await refreshSubscription();
        await syncWithDatabase(customerInfo);
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

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <View style={styles.containerFull}>
        <StatusBar
          barStyle="light-content"
          backgroundColor="#A08AB7"
          translucent={true}
          animated={true}
        />
        <LinearGradient colors={['#A08AB7', '#CDC2E5']} style={styles.containerFull}>
          <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
            {/* Close Button */}
            <TouchableOpacity
              style={[styles.closeButton, { top: insets.top + 8 }]}
              onPress={() => {
                setIsClosing(true);
                // Small delay to allow blur to cleanly unmount
                setTimeout(onClose, 100);
              }}
              disabled={isClosing}
            >
              {!isClosing && (
                <SafeBlurView intensity={40} tint="dark" style={styles.closeBlur}>
                  <MaterialCommunityIcons name="close" size={24} color="white" />
                </SafeBlurView>
              )}
            </TouchableOpacity>

            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              contentInsetAdjustmentBehavior="automatic"
            >
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
                <Text style={styles.platinumBadgeText}>{t('premiumPaywall.platinum')}</Text>
              </View>
            )}
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>
              {feature === 'unlimited_swipes'
                ? t('premiumPaywall.subtitleSwipes')
                : feature
                  ? t('premiumPaywall.subtitleFeature', { feature: feature.replace('_', ' ') })
                  : t('premiumPaywall.subtitleDefault')}
            </Text>
          </MotiView>

          {/* Plan Selection */}
          <View style={styles.planContainer}>
            {/* 3 Months - Most Popular (Featured) */}
            <TouchableOpacity
              style={[styles.planRow, selectedPlan === 'quarterly' && styles.planRowSelected, styles.planRowFeatured]}
              onPress={() => setSelectedPlan('quarterly')}
              activeOpacity={0.8}
            >
              <View style={styles.planRowLeft}>
                <View style={styles.radioOuter}>
                  {selectedPlan === 'quarterly' && <View style={styles.radioInner} />}
                </View>
                <View style={styles.planRowInfo}>
                  <View style={styles.planNameRow}>
                    <Text style={styles.planRowName}>{t('premiumPaywall.threeMonths')}</Text>
                    <View style={styles.mostPopularBadgeInline}>
                      <Text style={styles.mostPopularBadgeInlineText}>{t('premiumPaywall.mostPopular')}</Text>
                    </View>
                  </View>
                  <Text style={styles.planRowSubtext}>
                    {(() => {
                      const trial = getTrialTextForPlan(isPlatinum ? 'platinum' : 'premium', 'quarterly');
                      return trial.eligible ? `$11.66/mo • ${trial.text}` : '$11.66/mo';
                    })()}
                  </Text>
                </View>
              </View>
              <View style={styles.planRowRight}>
                <Text style={styles.planRowPrice}>{quarterlyPrice}</Text>
                <View style={styles.savingsBadgeInline}>
                  <Text style={styles.savingsBadgeInlineText}>{t('premiumPaywall.save', { percent: quarterlySavings })}</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Annual - Best Value */}
            <TouchableOpacity
              style={[styles.planRow, selectedPlan === 'annual' && styles.planRowSelected]}
              onPress={() => setSelectedPlan('annual')}
              activeOpacity={0.8}
            >
              <View style={styles.planRowLeft}>
                <View style={styles.radioOuter}>
                  {selectedPlan === 'annual' && <View style={styles.radioInner} />}
                </View>
                <View style={styles.planRowInfo}>
                  <View style={styles.planNameRow}>
                    <Text style={styles.planRowName}>{t('premiumPaywall.annual')}</Text>
                    <View style={styles.bestValueBadgeInline}>
                      <Text style={styles.bestValueBadgeInlineText}>{t('premiumPaywall.bestValue')}</Text>
                    </View>
                  </View>
                  <Text style={styles.planRowSubtext}>
                    {(() => {
                      const trial = getTrialTextForPlan(isPlatinum ? 'platinum' : 'premium', 'annual');
                      return trial.eligible ? `$10.00/mo • ${trial.text}` : '$10.00/mo';
                    })()}
                  </Text>
                </View>
              </View>
              <View style={styles.planRowRight}>
                <Text style={styles.planRowPrice}>{annualPrice}</Text>
                <View style={styles.savingsBadgeInline}>
                  <Text style={styles.savingsBadgeInlineText}>{t('premiumPaywall.save', { percent: annualSavings })}</Text>
                </View>
              </View>
            </TouchableOpacity>

            {/* Monthly */}
            <TouchableOpacity
              style={[styles.planRow, selectedPlan === 'monthly' && styles.planRowSelected]}
              onPress={() => setSelectedPlan('monthly')}
              activeOpacity={0.8}
            >
              <View style={styles.planRowLeft}>
                <View style={styles.radioOuter}>
                  {selectedPlan === 'monthly' && <View style={styles.radioInner} />}
                </View>
                <View style={styles.planRowInfo}>
                  <Text style={styles.planRowName}>{t('premiumPaywall.monthly')}</Text>
                  <Text style={styles.planRowSubtext}>
                    {(() => {
                      const trial = getTrialTextForPlan(isPlatinum ? 'platinum' : 'premium', 'monthly');
                      return trial.eligible ? `$14.99/mo • ${trial.text}` : '$14.99/mo';
                    })()}
                  </Text>
                </View>
              </View>
              <View style={styles.planRowRight}>
                <Text style={styles.planRowPrice}>{monthlyPrice}</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Features List */}
          <View style={styles.featuresContainer}>
            {featureKeys.map((feat, index) => (
              <MotiView
                key={feat.titleKey}
                from={{ opacity: 0, translateX: -20 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ type: 'timing', duration: 400, delay: index * 50 }}
                style={styles.featureItem}
              >
                <View style={styles.featureIcon}>
                  <MaterialCommunityIcons name={feat.icon as any} size={24} color="#A08AB7" />
                </View>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{t(`premiumPaywall.features.${feat.titleKey}`)}</Text>
                  <Text style={styles.featureDescription}>{t(`premiumPaywall.features.${feat.descKey}`)}</Text>
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
                (() => {
                  const trial = getTrialTextForPlan(isPlatinum ? 'platinum' : 'premium', selectedPlan);
                  const price = selectedPlan === 'monthly' ? monthlyPrice : selectedPlan === 'quarterly' ? quarterlyPrice : annualPrice;
                  const period = selectedPlan === 'monthly' ? t('premiumPaywall.periodMonth') : selectedPlan === 'quarterly' ? t('premiumPaywall.periodThreeMonths') : t('premiumPaywall.periodYear');
                  return (
                    <>
                      <Text style={styles.ctaButtonText}>
                        {trial.eligible && trial.text
                          ? t('premiumPaywall.startTrial', { trial: trial.text.replace(/\b\w/g, (c: string) => c.toUpperCase()) })
                          : t('premiumPaywall.subscribeNow')}
                      </Text>
                      {trial.eligible && (
                        <Text style={styles.ctaButtonSubtext}>
                          {t('premiumPaywall.thenPrice', { price, period })}
                        </Text>
                      )}
                    </>
                  );
                })()
              )}
            </View>
          </TouchableOpacity>

          {/* Restore Purchases */}
          <TouchableOpacity onPress={handleRestore} disabled={loading}>
            <Text style={styles.restoreText}>{t('premiumPaywall.restorePurchases')}</Text>
          </TouchableOpacity>

          {/* Fine Print */}
          <Text style={styles.finePrint}>
            {t('premiumPaywall.finePrint')}
          </Text>

          {/* Terms of Use & Privacy Policy (Required by App Store) */}
          <View style={styles.legalLinks}>
            <TouchableOpacity onPress={() => Linking.openURL('https://joinaccord.app/terms').catch(() => {})}>
              <Text style={styles.legalLinkText}>{t('premiumPaywall.termsOfUse')}</Text>
            </TouchableOpacity>
            <Text style={styles.legalLinkSeparator}>•</Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://joinaccord.app/privacy').catch(() => {})}>
              <Text style={styles.legalLinkText}>{t('premiumPaywall.privacyPolicy')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
          </SafeAreaView>
        </LinearGradient>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  containerFull: {
    flex: 1,
    backgroundColor: '#A08AB7', // Purple background to fill status bar area
  },
  container: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    // top is set dynamically using insets
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
    paddingTop: 20, // Reduced since SafeAreaView handles top spacing now
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
    flexDirection: 'column',
    gap: 12,
    marginBottom: 32,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planRowSelected: {
    borderColor: '#10B981',
    backgroundColor: 'white',
  },
  planRowFeatured: {
    borderColor: '#A08AB7',
    borderWidth: 2,
  },
  planRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#A08AB7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
  },
  planRowInfo: {
    flex: 1,
  },
  planNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planRowName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  planRowSubtext: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  planRowRight: {
    alignItems: 'flex-end',
  },
  planRowPrice: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#A08AB7',
  },
  planRowPeriod: {
    fontSize: 12,
    color: '#6B7280',
  },
  savingsBadgeInline: {
    backgroundColor: '#10B981',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 4,
  },
  savingsBadgeInlineText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  bestValueBadgeInline: {
    backgroundColor: '#10B981',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  bestValueBadgeInlineText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  mostPopularBadgeInline: {
    backgroundColor: '#A08AB7',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  mostPopularBadgeInlineText: {
    color: 'white',
    fontSize: 10,
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
    color: '#A08AB7',
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
  legalLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    gap: 8,
  },
  legalLinkText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    textDecorationLine: 'underline',
  },
  legalLinkSeparator: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
