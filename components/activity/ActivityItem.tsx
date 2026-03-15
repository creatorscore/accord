import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ActivityItem as ActivityItemType, ActivityType } from '@/hooks/useActivityFeed';
import { useSafeBlur } from '@/hooks/useSafeBlur';
import { SafeBlurImage } from '@/components/shared/SafeBlurImage';

interface ActivityItemProps {
  activity: ActivityItemType;
  onPress?: () => void;
  onUnmatch?: (activity: ActivityItemType) => void;
}

// Helper to check if actor was deleted
// Actor is considered deleted if we have an actor_profile_id but no valid actor data
const isDeleted = (a: ActivityItemType) =>
  a.actor_profile_id && (!a.actor || !a.actor.id || !a.actor.display_name);

const ACTIVITY_STYLE: Record<
  ActivityType,
  { icon: string; color: string; bgColor: string }
> = {
  like_received: { icon: 'heart', color: '#FF6B6B', bgColor: '#FFF0F0' },
  super_like_received: { icon: 'star', color: '#FFD700', bgColor: '#FFFBEB' },
  like_sent: { icon: 'heart-outline', color: '#F472B6', bgColor: '#FDF2F8' },
  super_like_sent: { icon: 'star-outline', color: '#FBBF24', bgColor: '#FFFBEB' },
  match: { icon: 'heart-multiple', color: '#A08AB7', bgColor: '#F5F0FF' },
  message_received: { icon: 'message-text', color: '#4ECDC4', bgColor: '#E6FAF8' },
  review_received: { icon: 'star-circle', color: '#FF9F43', bgColor: '#FFF5EB' },
  profile_view: { icon: 'eye', color: '#6B7280', bgColor: '#F3F4F6' },
  verification_approved: { icon: 'check-decagram', color: '#10B981', bgColor: '#ECFDF5' },
};

function getRoute(activity: ActivityItemType): string | null {
  const type = activity.activity_type;
  if (type === 'like_received' || type === 'super_like_received' || type === 'like_sent' || type === 'super_like_sent' || type === 'profile_view') {
    return activity.actor_profile_id ? `/profile/${activity.actor_profile_id}` : null;
  }
  if (type === 'match' || type === 'message_received') {
    return activity.reference_id ? `/chat/${activity.reference_id}` : null;
  }
  if (type === 'review_received') return '/settings/reviews';
  return null;
}

export default function ActivityItem({ activity, onPress, onUnmatch }: ActivityItemProps) {
  const { t } = useTranslation();
  const config = ACTIVITY_STYLE[activity.activity_type];
  if (!config) return null;

  // Check if the actor profile was deleted (uses the isDeleted helper for consistency)
  const isActorDeleted = isDeleted(activity);
  const name = activity.actor?.display_name || t('activity.item.someone');
  const defaultName = activity.actor?.display_name || t('activity.item.defaultName');

  // Compute title and subtitle with translations
  const getTitle = (): string => {
    const type = activity.activity_type;
    if (type === 'like_received') return isActorDeleted ? t('activity.item.likeReceivedDeleted') : t('activity.item.likeReceived', { name });
    if (type === 'super_like_received') return isActorDeleted ? t('activity.item.superLikeReceivedDeleted') : t('activity.item.superLikeReceived', { name });
    if (type === 'like_sent') return isActorDeleted ? t('activity.item.likeSentDeleted') : t('activity.item.likeSent', { name: defaultName });
    if (type === 'super_like_sent') return isActorDeleted ? t('activity.item.superLikeSentDeleted') : t('activity.item.superLikeSent', { name: defaultName });
    if (type === 'match') return isActorDeleted ? t('activity.item.matchedDeleted') : t('activity.item.matched', { name: defaultName });
    if (type === 'message_received') return isActorDeleted ? t('activity.item.messageReceivedDeleted') : t('activity.item.messageReceived', { name: defaultName });
    if (type === 'review_received') {
      const rating = activity.metadata?.rating;
      return rating ? t('activity.item.reviewReceived', { rating }) : t('activity.item.reviewReceivedGeneric');
    }
    if (type === 'profile_view') {
      if (isActorDeleted) return t('activity.item.profileViewDeleted');
      const count = activity.metadata?.view_count || 1;
      if (count > 1) return t('activity.item.profileViewMultiple', { count });
      return t('activity.item.profileView', { name });
    }
    if (type === 'verification_approved') return t('activity.item.verificationApproved');
    return '';
  };

  const getSubtitle = (): string | null => {
    const type = activity.activity_type;
    if (type === 'like_received') return isActorDeleted ? null : t('activity.item.likeReceivedSubtitle');
    if (type === 'super_like_received') return isActorDeleted ? null : t('activity.item.superLikeReceivedSubtitle');
    if (type === 'like_sent' || type === 'super_like_sent') return isActorDeleted ? null : t('activity.item.likeSentSubtitle');
    if (type === 'match') return isActorDeleted ? t('activity.item.matchedDeletedSubtitle') : t('activity.item.matchedSubtitle');
    if (type === 'message_received') {
      if (isActorDeleted) return t('activity.item.messageReceivedDeletedSubtitle');
      const preview = activity.decrypted_preview || activity.metadata?.preview;
      if (!preview) return null;
      if (!activity.decrypted_preview && preview.includes(':') && preview.length > 50) {
        return `"${t('activity.item.newMessage')}"`;
      }
      return `"${preview.slice(0, 50)}${preview.length > 50 ? '...' : ''}"`;
    }
    if (type === 'review_received') {
      const text = activity.metadata?.feedback_preview;
      return text ? `"${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"` : null;
    }
    if (type === 'profile_view') return null;
    if (type === 'verification_approved') return t('activity.item.verificationApprovedSubtitle');
    return null;
  };

  const formatTimeAgo = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return t('activity.time.justNow');
    if (diffMins < 60) return t('activity.time.minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('activity.time.hoursAgo', { count: diffHours });
    if (diffDays === 1) return t('activity.time.yesterday');
    if (diffDays < 7) return t('activity.time.daysAgo', { count: diffDays });
    return date.toLocaleDateString();
  };

  const title = getTitle();
  const subtitle = getSubtitle();

  // Don't navigate to deleted profiles - only get route if actor exists or activity doesn't need actor
  const route = isActorDeleted
    ? (activity.activity_type === 'verification_approved' ? getRoute(activity) : null)
    : getRoute(activity);

  // Only show unmatch button for match-related activities that have a reference_id (match ID)
  // Don't show unmatch for deleted profiles since the match may already be gone
  const canUnmatch = (activity.activity_type === 'match' || activity.activity_type === 'message_received')
    && activity.reference_id
    && onUnmatch
    && !isActorDeleted;

  const handlePress = () => {
    if (onPress) onPress();
    if (route) {
      router.push(route as any);
    }
  };

  const handleUnmatch = () => {
    if (onUnmatch) {
      onUnmatch(activity);
    }
  };

  // Get actor's primary photo
  const actorPhoto = activity.actor?.photos?.find((p) => p.is_primary)?.url ||
    activity.actor?.photos?.[0]?.url;

  // Safe blur hook - protects actor privacy while preventing crashes
  const { blurRadius, onImageLoad, onImageError } = useSafeBlur({
    shouldBlur: (activity.actor as any)?.photo_blur_enabled || false,
    blurIntensity: 20,
  });

  return (
    <TouchableOpacity
      style={[styles.container, !activity.is_read && styles.unread]}
      className={activity.is_read ? "bg-card" : "bg-card"}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Avatar or Icon */}
      <View style={[styles.iconContainer, isActorDeleted && styles.deletedIconContainer]} className="bg-muted">
        {isActorDeleted ? (
          <MaterialCommunityIcons name="account-off" size={24} color="#9CA3AF" />
        ) : actorPhoto ? (
          <SafeBlurImage
            source={{ uri: actorPhoto }}
            style={styles.avatar}
            blurRadius={blurRadius}
            onLoad={onImageLoad}
            onError={onImageError}
          />
        ) : (
          <MaterialCommunityIcons name={config.icon as any} size={24} color={config.color} />
        )}
        {/* Activity type badge */}
        <View style={[styles.typeBadge, { backgroundColor: isActorDeleted ? '#9CA3AF' : config.color }]}>
          <MaterialCommunityIcons name={config.icon as any} size={12} color="white" />
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} className="text-foreground" numberOfLines={2}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} className="text-muted-foreground" numberOfLines={1}>
            {subtitle}
          </Text>
        )}
        <Text style={styles.time} className="text-muted-foreground">{formatTimeAgo(activity.created_at)}</Text>
      </View>

      {/* Unmatch button */}
      {canUnmatch && (
        <TouchableOpacity
          style={styles.unmatchButton}
          className="bg-yellow-100 dark:bg-yellow-900/30"
          onPress={(e) => {
            e.stopPropagation();
            handleUnmatch();
          }}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <MaterialCommunityIcons name="heart-broken" size={18} color="#F59E0B" />
        </TouchableOpacity>
      )}

      {/* Arrow */}
      {route && (
        <MaterialCommunityIcons name="chevron-right" size={20} color="#9CA3AF" />
      )}

      {/* Unread dot */}
      {!activity.is_read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  unread: {
    borderLeftWidth: 3,
    borderLeftColor: '#A08AB7',
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  deletedIconContainer: {
    opacity: 0.6,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  typeBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 4,
    fontStyle: 'italic',
  },
  time: {
    fontSize: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#A08AB7',
    marginLeft: 8,
  },
  unmatchButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
});
