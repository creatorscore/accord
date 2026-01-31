import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useProfileData } from '@/contexts/ProfileDataContext';
import { getTrialUsageStats, TrialUsageStats } from '@/lib/trial-engagement';

interface StatItemProps {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  value: number;
  label: string;
  isPremiumFeature?: boolean;
  color: string;
}

function StatItem({ icon, value, label, isPremiumFeature, color }: StatItemProps) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        padding: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        marginHorizontal: 4,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: color,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 8,
        }}
      >
        <MaterialCommunityIcons name={icon} size={20} color="white" />
      </View>
      <Text
        style={{
          color: 'white',
          fontSize: 24,
          fontWeight: 'bold',
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: 'rgba(255, 255, 255, 0.8)',
          fontSize: 12,
          textAlign: 'center',
          marginTop: 2,
        }}
      >
        {label}
      </Text>
      {isPremiumFeature && (
        <View
          style={{
            backgroundColor: '#FFD700',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            marginTop: 4,
          }}
        >
          <Text style={{ color: '#000', fontSize: 8, fontWeight: 'bold' }}>PREMIUM</Text>
        </View>
      )}
    </View>
  );
}

/**
 * TrialValueSummary - Shows users the value they've gotten from their premium trial
 *
 * Displays stats like:
 * - Super likes sent
 * - People who liked you (premium feature)
 * - Matches made
 * - Voice messages sent
 *
 * Used to demonstrate value and reduce churn at trial end
 */
export default function TrialValueSummary() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isTrial, daysRemaining } = useSubscription();
  const { profileId } = useProfileData();
  const [stats, setStats] = useState<TrialUsageStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      if (!profileId) return;

      try {
        setLoading(true);
        const trialStats = await getTrialUsageStats(profileId);
        setStats(trialStats);
      } catch (error) {
        console.error('Error loading trial stats:', error);
      } finally {
        setLoading(false);
      }
    };

    if (profileId && isTrial) {
      loadStats();
    } else {
      setLoading(false);
    }
  }, [profileId, isTrial]);

  // Don't show if not in trial
  if (!isTrial) {
    return null;
  }

  const handleUpgrade = () => {
    router.push('/settings/subscription');
  };

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', delay: 200 }}
      style={{ marginBottom: 16 }}
    >
      <LinearGradient
        colors={['#6366F1', '#8B5CF6', '#A855F7']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          borderRadius: 20,
          padding: 20,
          shadowColor: '#6366F1',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 8,
          elevation: 8,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <MaterialCommunityIcons name="chart-line" size={24} color="white" />
          <Text
            style={{
              color: 'white',
              fontSize: 18,
              fontWeight: 'bold',
              marginLeft: 8,
              flex: 1,
            }}
          >
            {t('trialValue.title', 'Your Trial Stats')}
          </Text>
          {daysRemaining !== null && (
            <View
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 12,
              }}
            >
              <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
                {daysRemaining}{' '}
                {daysRemaining === 1 ? t('common.day', 'day') : t('common.days', 'days')}{' '}
                {t('common.left', 'left')}
              </Text>
            </View>
          )}
        </View>

        {loading ? (
          <View style={{ alignItems: 'center', padding: 20 }}>
            <ActivityIndicator size="small" color="white" />
            <Text style={{ color: 'rgba(255, 255, 255, 0.8)', marginTop: 8 }}>
              {t('common.loading', 'Loading...')}
            </Text>
          </View>
        ) : (
          <>
            {/* Stats Grid */}
            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              <StatItem
                icon="heart-multiple"
                value={stats?.likesReceivedCount || 0}
                label={t('trialValue.likesReceived', 'Likes Received')}
                isPremiumFeature
                color="#EC4899"
              />
              <StatItem
                icon="star"
                value={stats?.superLikesSent || 0}
                label={t('trialValue.superLikes', 'Super Likes')}
                isPremiumFeature
                color="#F59E0B"
              />
            </View>
            <View style={{ flexDirection: 'row', marginBottom: 16 }}>
              <StatItem
                icon="account-heart"
                value={stats?.matchesMade || 0}
                label={t('trialValue.matches', 'Matches')}
                color="#10B981"
              />
              <StatItem
                icon="microphone"
                value={stats?.voiceMessagesSent || 0}
                label={t('trialValue.voiceMessages', 'Voice Messages')}
                isPremiumFeature
                color="#3B82F6"
              />
            </View>

            {/* Value message */}
            {stats && (stats.likesReceivedCount > 0 || stats.matchesMade > 0) && (
              <View
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: 12,
                  padding: 12,
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{
                    color: 'white',
                    fontSize: 14,
                    textAlign: 'center',
                    lineHeight: 20,
                  }}
                >
                  {stats.likesReceivedCount > 0
                    ? t('trialValue.valueMessage', {
                        count: stats.likesReceivedCount,
                        defaultValue: `${stats.likesReceivedCount} people are interested in you! Keep Premium to see who they are.`,
                      })
                    : t('trialValue.matchesMessage', {
                        count: stats.matchesMade,
                        defaultValue: `You've made ${stats.matchesMade} connection${stats.matchesMade === 1 ? '' : 's'}! Keep premium to continue the conversation.`,
                      })}
                </Text>
              </View>
            )}

            {/* What you'll lose section */}
            <View
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderRadius: 12,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <Text
                style={{
                  color: '#FEE2E2',
                  fontSize: 13,
                  fontWeight: 'bold',
                  marginBottom: 8,
                }}
              >
                {t('trialValue.loseAccess', "Without Premium, you'll lose:")}
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {[
                  { icon: 'infinity', text: t('trialValue.unlimitedLikes', 'Unlimited likes') },
                  { icon: 'eye', text: t('trialValue.seeWhoLiked', 'See who liked you') },
                  { icon: 'star', text: t('trialValue.superLikesFeature', 'Super Likes') },
                  { icon: 'microphone', text: t('trialValue.voiceMessagesFeature', 'Voice messages') },
                ].map((item, index) => (
                  <View
                    key={index}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      width: '50%',
                      marginBottom: 6,
                    }}
                  >
                    <MaterialCommunityIcons
                      name={item.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                      size={14}
                      color="rgba(255, 255, 255, 0.7)"
                    />
                    <Text
                      style={{
                        color: 'rgba(255, 255, 255, 0.8)',
                        fontSize: 12,
                        marginLeft: 6,
                      }}
                    >
                      {item.text}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* CTA Button */}
            <TouchableOpacity onPress={handleUpgrade} activeOpacity={0.8}>
              <View
                style={{
                  backgroundColor: 'white',
                  borderRadius: 12,
                  paddingVertical: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MaterialCommunityIcons name="crown" size={20} color="#8B5CF6" />
                <Text
                  style={{
                    color: '#8B5CF6',
                    fontSize: 16,
                    fontWeight: 'bold',
                    marginLeft: 8,
                  }}
                >
                  {t('trialValue.keepPremium', 'Keep Premium')}
                </Text>
              </View>
            </TouchableOpacity>

            {/* Annual discount hint */}
            <Text
              style={{
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: 12,
                textAlign: 'center',
                marginTop: 8,
              }}
            >
              {t('trialValue.annualDiscount', 'Save 33% with annual plan')}
            </Text>
          </>
        )}
      </LinearGradient>
    </MotiView>
  );
}
