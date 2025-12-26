import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ActivityItem as ActivityItemType, ActivityType } from '@/hooks/useActivityFeed';
import { useSafeBlur } from '@/hooks/useSafeBlur';

interface ActivityItemProps {
  activity: ActivityItemType;
  onPress?: () => void;
  onUnmatch?: (activity: ActivityItemType) => void;
}

const ACTIVITY_CONFIG: Record<
  ActivityType,
  {
    icon: string;
    color: string;
    bgColor: string;
    getTitle: (activity: ActivityItemType) => string;
    getSubtitle: (activity: ActivityItemType) => string | null;
    getRoute: (activity: ActivityItemType) => string | null;
  }
> = {
  like_received: {
    icon: 'heart',
    color: '#FF6B6B',
    bgColor: '#FFF0F0',
    getTitle: (a) => `${a.actor?.display_name || 'Someone'} liked your profile`,
    getSubtitle: () => 'Tap to see their profile',
    getRoute: (a) => (a.actor_profile_id ? `/profile/${a.actor_profile_id}` : null),
  },
  super_like_received: {
    icon: 'star',
    color: '#FFD700',
    bgColor: '#FFFBEB',
    getTitle: (a) => `${a.actor?.display_name || 'Someone'} Super Liked you!`,
    getSubtitle: () => 'They really like you!',
    getRoute: (a) => (a.actor_profile_id ? `/profile/${a.actor_profile_id}` : null),
  },
  match: {
    icon: 'heart-multiple',
    color: '#A08AB7',
    bgColor: '#F5F0FF',
    getTitle: (a) => `You matched with ${a.actor?.display_name || 'someone'}!`,
    getSubtitle: () => 'Tap to start chatting',
    getRoute: (a) => (a.reference_id ? `/chat/${a.reference_id}` : null),
  },
  message_received: {
    icon: 'message-text',
    color: '#4ECDC4',
    bgColor: '#E6FAF8',
    getTitle: (a) => `New message from ${a.actor?.display_name || 'someone'}`,
    getSubtitle: (a) => {
      // Use decrypted preview if available, otherwise fall back to metadata preview
      const preview = a.decrypted_preview || a.metadata?.preview;
      if (!preview) return null;
      // Don't show encrypted content (contains colons in iv:ciphertext:tag format)
      if (!a.decrypted_preview && preview.includes(':') && preview.length > 50) {
        return '"New message"';
      }
      return `"${preview.slice(0, 50)}${preview.length > 50 ? '...' : ''}"`;
    },
    getRoute: (a) => (a.reference_id ? `/chat/${a.reference_id}` : null),
  },
  review_received: {
    icon: 'star-circle',
    color: '#FF9F43',
    bgColor: '#FFF5EB',
    getTitle: (a) => {
      const rating = a.metadata?.rating;
      return rating ? `You received a ${rating}-star review` : 'You received a new review';
    },
    getSubtitle: (a) => {
      const text = a.metadata?.feedback_preview;
      return text ? `"${text.slice(0, 50)}${text.length > 50 ? '...' : ''}"` : null;
    },
    getRoute: () => '/settings/reviews',
  },
  profile_view: {
    icon: 'eye',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    getTitle: (a) => {
      const count = a.metadata?.view_count || 1;
      if (count > 1) return `${count} people viewed your profile`;
      return `${a.actor?.display_name || 'Someone'} viewed your profile`;
    },
    getSubtitle: () => null,
    getRoute: (a) => (a.actor_profile_id ? `/profile/${a.actor_profile_id}` : null),
  },
  verification_approved: {
    icon: 'check-decagram',
    color: '#10B981',
    bgColor: '#ECFDF5',
    getTitle: () => 'Your profile is now verified!',
    getSubtitle: () => 'You now have a verified badge',
    getRoute: () => null,
  },
};

function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function ActivityItem({ activity, onPress, onUnmatch }: ActivityItemProps) {
  const config = ACTIVITY_CONFIG[activity.activity_type];
  if (!config) return null;

  const title = config.getTitle(activity);
  const subtitle = config.getSubtitle(activity);
  const route = config.getRoute(activity);

  // Only show unmatch button for match-related activities that have a reference_id (match ID)
  const canUnmatch = (activity.activity_type === 'match' || activity.activity_type === 'message_received')
    && activity.reference_id
    && onUnmatch;

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
      onPress={handlePress}
      activeOpacity={0.7}
    >
      {/* Avatar or Icon */}
      <View style={[styles.iconContainer, { backgroundColor: config.bgColor }]}>
        {actorPhoto ? (
          <Image
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
        <View style={[styles.typeBadge, { backgroundColor: config.color }]}>
          <MaterialCommunityIcons name={config.icon as any} size={12} color="white" />
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle && (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
        <Text style={styles.time}>{formatTimeAgo(activity.created_at)}</Text>
      </View>

      {/* Unmatch button */}
      {canUnmatch && (
        <TouchableOpacity
          style={styles.unmatchButton}
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
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 8,
  },
  unread: {
    backgroundColor: '#FAFBFF',
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
    color: '#111827',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
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
    backgroundColor: '#FEF3C7',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
});
