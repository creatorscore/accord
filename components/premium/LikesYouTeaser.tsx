import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useTranslation } from 'react-i18next';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useProfileData } from '@/contexts/ProfileDataContext';
import { getPendingLikesCount } from '@/lib/trial-engagement';
import { trackEvent } from '@/lib/analytics';

interface LikesYouTeaserProps {
  onPress: () => void;
  /** Override the likes count (for testing or when parent already has the count) */
  likesCount?: number;
}

/**
 * LikesYouTeaser - Floating badge showing how many people liked the user
 *
 * Shows a blurred teaser for free users to entice them to upgrade.
 * - Only shows for free users
 * - Only shows when likes count > 0
 * - Tappable to open paywall
 */
export default function LikesYouTeaser({ onPress, likesCount: propLikesCount }: LikesYouTeaserProps) {
  const { t } = useTranslation();
  const { isPremium, isPlatinum } = useSubscription();
  const { profileId } = useProfileData();
  const [likesCount, setLikesCount] = useState(propLikesCount ?? 0);
  const [loading, setLoading] = useState(propLikesCount === undefined);

  const isSubscribed = isPremium || isPlatinum;

  useEffect(() => {
    const loadLikesCount = async () => {
      if (!profileId) return;

      try {
        setLoading(true);
        const count = await getPendingLikesCount(profileId);
        setLikesCount(count);
      } catch (error) {
        console.error('Error loading likes count:', error);
      } finally {
        setLoading(false);
      }
    };

    // If count provided via props, use that
    if (propLikesCount !== undefined) {
      setLikesCount(propLikesCount);
      setLoading(false);
      return;
    }

    // Otherwise fetch it
    if (profileId && !isSubscribed) {
      loadLikesCount();
    } else {
      setLoading(false);
    }
  }, [profileId, isSubscribed, propLikesCount]);

  // Don't show for premium users or if no likes
  if (isSubscribed || loading || likesCount === 0) {
    return null;
  }

  const handlePress = () => {
    trackEvent('likes_teaser_pressed', {
      likes_count: likesCount,
      source: 'discover',
    });
    onPress();
  };

  return (
    <MotiView
      from={{ opacity: 0, scale: 0.9, translateY: 20 }}
      animate={{ opacity: 1, scale: 1, translateY: 0 }}
      exit={{ opacity: 0, scale: 0.9, translateY: 20 }}
      transition={{ type: 'spring', damping: 15 }}
      style={{
        position: 'absolute',
        top: 100,
        right: 16,
        zIndex: 100,
      }}
    >
      <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
        <View
          style={{
            backgroundColor: 'white',
            borderRadius: 16,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 8,
            overflow: 'hidden',
          }}
        >
          {/* Gradient accent bar at top */}
          <LinearGradient
            colors={['#EC4899', '#F472B6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ height: 4 }}
          />

          <View style={{ padding: 12 }}>
            {/* Blurred avatar stack */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 8,
              }}
            >
              {/* Stacked blurred circles representing people */}
              <View style={{ flexDirection: 'row', marginRight: 8 }}>
                {[...Array(Math.min(likesCount, 3))].map((_, index) => (
                  <View
                    key={index}
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: '#F3F4F6',
                      borderWidth: 2,
                      borderColor: 'white',
                      marginLeft: index > 0 ? -10 : 0,
                      overflow: 'hidden',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <MaterialCommunityIcons name="account" size={18} color="#D1D5DB" />
                  </View>
                ))}
                {likesCount > 3 && (
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: '#EC4899',
                      borderWidth: 2,
                      borderColor: 'white',
                      marginLeft: -10,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: 'white', fontSize: 10, fontWeight: 'bold' }}>
                      +{likesCount - 3}
                    </Text>
                  </View>
                )}
              </View>

              {/* Heart icon with pulse */}
              <MotiView
                from={{ scale: 1 }}
                animate={{ scale: [1, 1.15, 1] }}
                transition={{
                  loop: true,
                  type: 'timing',
                  duration: 1500,
                  delay: 500,
                }}
              >
                <MaterialCommunityIcons name="heart" size={20} color="#EC4899" />
              </MotiView>
            </View>

            {/* Count text */}
            <Text
              style={{
                color: '#111827',
                fontSize: 14,
                fontWeight: 'bold',
                marginBottom: 4,
              }}
            >
              {likesCount === 1
                ? t('likesTeaser.personLikesYou', '1 person likes you!')
                : t('likesTeaser.peopleLikeYou', { count: likesCount, defaultValue: `${likesCount} people like you!` })}
            </Text>

            {/* CTA */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: '#EC4899',
                  fontSize: 12,
                  fontWeight: '600',
                }}
              >
                {t('likesTeaser.seeWho', 'See who')}
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={16}
                color="#EC4899"
                style={{ marginLeft: 2 }}
              />
            </View>

            {/* Premium badge */}
            <View
              style={{
                position: 'absolute',
                top: 8,
                right: 8,
                backgroundColor: '#FEF3C7',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderRadius: 4,
              }}
            >
              <Text style={{ color: '#92400E', fontSize: 8, fontWeight: 'bold' }}>
                {t('common.premium', 'PREMIUM')}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </MotiView>
  );
}
