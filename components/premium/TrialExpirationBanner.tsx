import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useTranslation } from 'react-i18next';

/**
 * TrialExpirationBanner - Shows when user is in a trial that's about to expire
 *
 * Shows:
 * - When trial has 3 or fewer days remaining (warning)
 * - When trial has 1 day remaining (urgent)
 * - When trial expires today (critical)
 *
 * Features loss aversion messaging to highlight what they'll lose
 */
export default function TrialExpirationBanner() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isTrial, daysRemaining } = useSubscription();

  // Don't show if not in trial or no days remaining info
  if (!isTrial || daysRemaining === null) {
    return null;
  }

  // Only show warning when 3 or fewer days remaining
  if (daysRemaining > 3) {
    return null;
  }

  // Determine urgency level
  const isUrgent = daysRemaining <= 1;
  const isCritical = daysRemaining === 0;

  // Get appropriate message
  const getMessage = () => {
    if (isCritical) {
      return t('subscription.trialEndsToday', 'Your free trial ends today!');
    } else if (daysRemaining === 1) {
      return t('subscription.trialEnds1Day', 'Your free trial ends tomorrow!');
    } else {
      return t('subscription.trialEndsDays', { count: daysRemaining, defaultValue: `Your free trial ends in ${daysRemaining} days` });
    }
  };

  // Get gradient colors based on urgency
  const getGradientColors = (): [string, string] => {
    if (isCritical) {
      return ['#DC2626', '#B91C1C']; // Red for critical
    } else if (isUrgent) {
      return ['#F59E0B', '#D97706']; // Amber for urgent
    }
    return ['#3B82F6', '#2563EB']; // Blue for warning
  };

  // Get icon based on urgency
  const getIcon = () => {
    if (isCritical || isUrgent) {
      return 'alert-circle';
    }
    return 'clock-alert-outline';
  };

  // Get loss aversion features list
  const getLossFeatures = () => {
    // Show different features based on urgency
    if (isCritical) {
      return [
        t('subscription.loseUnlimitedLikes', 'Unlimited likes'),
        t('subscription.loseSeeWhoLiked', 'See who liked you'),
        t('subscription.loseSuperLikes', 'Super Likes'),
      ];
    }
    return [
      t('subscription.loseSeeWhoLiked', 'See who liked you'),
      t('subscription.loseVoiceMessages', 'Voice messages'),
    ];
  };

  const handlePress = () => {
    router.push('/settings/subscription');
  };

  const lossFeatures = getLossFeatures();

  return (
    <MotiView
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', delay: 300 }}
      style={{ marginHorizontal: 16, marginVertical: 8 }}
    >
      {/* Days countdown badge - moved OUTSIDE the gradient to avoid layer cycle */}
      {daysRemaining > 0 && (
        <View
          style={{
            alignSelf: 'flex-end',
            backgroundColor: isCritical ? '#FEE2E2' : isUrgent ? '#FEF3C7' : '#DBEAFE',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
            marginBottom: -6,
            marginRight: 12,
            zIndex: 10,
          }}
        >
          <Text
            style={{
              color: isCritical ? '#991B1B' : isUrgent ? '#92400E' : '#1E40AF',
              fontSize: 12,
              fontWeight: 'bold',
            }}
          >
            {daysRemaining} {daysRemaining === 1 ? t('common.day', 'day') : t('common.days', 'days')} {t('common.left', 'left')}
          </Text>
        </View>
      )}

      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        <LinearGradient
          colors={getGradientColors()}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            borderRadius: 16,
            padding: 16,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialCommunityIcons name={getIcon()} size={24} color="white" />
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text
                style={{
                  color: 'white',
                  fontWeight: 'bold',
                  fontSize: 16,
                }}
              >
                {getMessage()}
              </Text>

              {/* Loss aversion: Show what they'll lose */}
              <View style={{ marginTop: 6, marginBottom: 4 }}>
                <Text
                  style={{
                    color: 'rgba(255, 255, 255, 0.85)',
                    fontSize: 12,
                    fontWeight: '600',
                    marginBottom: 4,
                  }}
                >
                  {t('subscription.youllLose', "You'll lose access to:")}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                  {lossFeatures.map((feature, index) => (
                    <View
                      key={index}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginRight: 12,
                        marginBottom: 2,
                      }}
                    >
                      <MaterialCommunityIcons name="close-circle" size={12} color="rgba(255, 255, 255, 0.7)" />
                      <Text
                        style={{
                          color: 'rgba(255, 255, 255, 0.9)',
                          fontSize: 12,
                          marginLeft: 4,
                        }}
                      >
                        {feature}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>

              {/* CTA */}
              <View
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                  borderRadius: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  marginTop: 8,
                  alignSelf: 'flex-start',
                }}
              >
                <Text
                  style={{
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: 14,
                  }}
                >
                  {t('subscription.keepPremium', 'Keep Premium')}
                </Text>
              </View>
            </View>

            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color="rgba(255, 255, 255, 0.8)"
              style={{ marginTop: 8 }}
            />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </MotiView>
  );
}
