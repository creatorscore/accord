import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { SharedValue, useAnimatedStyle, interpolate } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { usePhotoBlur } from '@/hooks/usePhotoBlur';
import { SafeBlurImage } from '@/components/shared/SafeBlurImage';

interface ConversationProfile {
  id: string;
  display_name: string;
  age: number;
  photo_url?: string;
  photo_blur_data_uri?: string | null;
  is_verified?: boolean;
  photo_verified?: boolean;
  encryption_public_key?: string;
  photo_blur_enabled?: boolean;
  is_revealed?: boolean;
}

interface Conversation {
  match_id: string;
  profile: ConversationProfile;
  last_message?: {
    encrypted_content: string;
    created_at: string;
    sender_profile_id: string;
    read_at: string | null;
    decrypted_content?: string;
  };
  unread_count: number;
  is_muted?: boolean;
  is_archived?: boolean;
  is_pinned?: boolean;
}

interface SwipeableConversationCardProps {
  item: Conversation;
  currentProfileId: string | null;
  isAdmin: boolean;
  isPremium: boolean;
  isTyping: boolean;
  showArchived: boolean;
  colors: Record<string, string>;
  openSwipeableRef: React.MutableRefObject<SwipeableMethods | null>;
  swipeableRef: React.RefObject<SwipeableMethods | null>;
  getTimeAgo: (dateString: string) => string;
  onPress: (conversation: Conversation) => void;
  onLongPress: (conversation: Conversation) => void;
  onArchive: (conversation: Conversation) => void;
  onDelete: (conversation: Conversation) => void;
}

function RightAction(
  prog: SharedValue<number>,
  drag: SharedValue<number>,
  label: string,
  iconName: string,
  bgColor: string,
  onAction: () => void,
) {
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(prog.value, [0, 0.5, 1], [0, 0.6, 1]);
    return { opacity };
  });

  return (
    <Animated.View style={[styles.swipeAction, { backgroundColor: bgColor }, animatedStyle]}>
      <TouchableOpacity style={styles.swipeActionInner} onPress={onAction}>
        <MaterialCommunityIcons name={iconName as any} size={22} color="white" />
        <Text style={styles.swipeActionText}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function LeftAction(
  prog: SharedValue<number>,
  drag: SharedValue<number>,
  label: string,
  onAction: () => void,
) {
  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(prog.value, [0, 0.5, 1], [0, 0.6, 1]);
    return { opacity };
  });

  return (
    <Animated.View style={[styles.swipeAction, { backgroundColor: '#EF4444' }, animatedStyle]}>
      <TouchableOpacity style={styles.swipeActionInner} onPress={onAction}>
        <MaterialCommunityIcons name="delete-outline" size={22} color="white" />
        <Text style={styles.swipeActionText}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

function SwipeableConversationCard({
  item,
  currentProfileId,
  isAdmin,
  isPremium,
  isTyping,
  showArchived,
  colors,
  openSwipeableRef,
  swipeableRef,
  getTimeAgo,
  onPress,
  onLongPress,
  onArchive,
  onDelete,
}: SwipeableConversationCardProps) {
  const { t } = useTranslation();
  const hasUnread = item.unread_count > 0;

  const { imageUri, blurRadius, onImageLoad, onImageError } = usePhotoBlur({
    shouldBlur: (item.profile.photo_blur_enabled || false) && !item.profile.is_revealed && !isAdmin,
    photoUrl: item.profile.photo_url || 'https://via.placeholder.com/64',
    blurDataUri: item.profile.photo_blur_data_uri,
    blurIntensity: 30,
  });

  const handleSwipeOpen = useCallback(() => {
    // Close previously open swipeable
    if (openSwipeableRef.current && openSwipeableRef.current !== swipeableRef.current) {
      openSwipeableRef.current.close();
    }
    openSwipeableRef.current = swipeableRef.current;
  }, [openSwipeableRef, swipeableRef]);

  const renderRightActions = useCallback(
    (prog: SharedValue<number>, drag: SharedValue<number>) => {
      const label = showArchived
        ? t('messages.swipeUnarchive')
        : t('messages.swipeArchive');
      const icon = showArchived ? 'inbox' : 'archive-outline';
      return RightAction(prog, drag, label, icon, '#A08AB7', () => {
        swipeableRef.current?.close();
        onArchive(item);
      });
    },
    [showArchived, item, onArchive, swipeableRef, t],
  );

  const renderLeftActions = useCallback(
    (prog: SharedValue<number>, drag: SharedValue<number>) => {
      return LeftAction(prog, drag, t('messages.swipeDelete'), () => {
        swipeableRef.current?.close();
        onDelete(item);
      });
    },
    [item, onDelete, swipeableRef, t],
  );

  return (
    <View style={styles.cardShadowWrapper}>
    <ReanimatedSwipeable
      ref={swipeableRef}
      friction={2}
      leftThreshold={40}
      rightThreshold={40}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={renderLeftActions}
      renderRightActions={renderRightActions}
      onSwipeableWillOpen={handleSwipeOpen}
    >
      <TouchableOpacity
        style={[styles.conversationCard, { backgroundColor: colors.card }]}
        onPress={() => onPress(item)}
        onLongPress={() => onLongPress(item)}
        activeOpacity={0.7}
      >
        {/* Profile Photo */}
        <View style={styles.photoContainer}>
          <SafeBlurImage
            source={{ uri: imageUri }}
            style={[styles.photo, { backgroundColor: colors.muted }]}
            blurRadius={blurRadius}
            onLoad={onImageLoad}
            onError={onImageError}
          />
          {(item.profile.is_verified || item.profile.photo_verified) && (
            <View style={[styles.verifiedBadge, { backgroundColor: colors.background }]}>
              <MaterialCommunityIcons name="check-decagram" size={16} color="#A08AB7" />
            </View>
          )}
          {hasUnread && <View style={styles.unreadDot} />}
        </View>

        {/* Conversation Info */}
        <View style={styles.conversationInfo}>
          <View style={styles.conversationHeader}>
            <View style={styles.nameRow}>
              {item.is_pinned && (
                <MaterialCommunityIcons name="pin" size={16} color="#A08AB7" style={{ marginRight: 4 }} />
              )}
              <Text style={[styles.conversationName, { color: colors.foreground }]} numberOfLines={1}>
                {item.profile.display_name}
              </Text>
              {item.is_muted && (
                <MaterialCommunityIcons name="bell-off" size={14} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
              )}
            </View>
            {item.last_message && (
              <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>{getTimeAgo(item.last_message.created_at)}</Text>
            )}
          </View>

          {/* Last Message or Typing Indicator */}
          {isTyping ? (
            <View style={styles.messageRow}>
              <View style={styles.typingIndicator}>
                <MotiView
                  from={{ opacity: 0.4 }}
                  animate={{ opacity: 1 }}
                  transition={{ type: 'timing', duration: 400, loop: true }}
                  style={[styles.typingDot, { backgroundColor: colors.primary }]}
                />
                <MotiView
                  from={{ opacity: 0.4 }}
                  animate={{ opacity: 1 }}
                  transition={{ type: 'timing', duration: 400, loop: true, delay: 150 }}
                  style={[styles.typingDot, { backgroundColor: colors.primary }]}
                />
                <MotiView
                  from={{ opacity: 0.4 }}
                  animate={{ opacity: 1 }}
                  transition={{ type: 'timing', duration: 400, loop: true, delay: 300 }}
                  style={[styles.typingDot, { backgroundColor: colors.primary }]}
                />
                <Text style={[styles.typingText, { color: colors.primary }]}>
                  {t('messages.typing', { defaultValue: 'typing' })}
                </Text>
              </View>
            </View>
          ) : item.last_message ? (
            <View style={styles.messageRow}>
              <Text
                style={[styles.lastMessage, { color: colors.mutedForeground }, hasUnread && { color: colors.foreground, fontWeight: '600' }]}
                numberOfLines={2}
              >
                {item.last_message.sender_profile_id === currentProfileId ? t('matches.youLabel') : ''}
                {item.last_message.decrypted_content || (
                  item.last_message.encrypted_content?.includes(':')
                    ? t('messages.encryptedMessage')
                    : item.last_message.encrypted_content
                )}
              </Text>
              {isPremium && item.last_message.sender_profile_id === currentProfileId && (
                <MaterialCommunityIcons
                  name={item.last_message.read_at ? "check-all" : "check"}
                  size={16}
                  color={item.last_message.read_at ? colors.info : colors.mutedForeground}
                  style={{ marginLeft: 4 }}
                />
              )}
              {hasUnread && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadCount}>{item.unread_count}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.ctaRow}>
              <MaterialCommunityIcons name="chat-outline" size={14} color={colors.primary} />
              <Text style={[styles.ctaText, { color: colors.primary }]}>{t('messages.startConversation')}</Text>
            </View>
          )}
        </View>

        {/* Chevron */}
        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.grey3} />
      </TouchableOpacity>
    </ReanimatedSwipeable>
    </View>
  );
}

export default React.memo(SwipeableConversationCard);

const styles = StyleSheet.create({
  swipeAction: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 90,
    borderRadius: 20,
  },
  swipeActionInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  swipeActionText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  cardShadowWrapper: {
    borderRadius: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' },
    }),
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    gap: 14,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E5E7EB',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 2,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2 },
      android: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' },
    }),
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#fff',
  },
  conversationInfo: {
    flex: 1,
    gap: 6,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  conversationName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    flexShrink: 1,
  },
  timestamp: {
    fontSize: 13,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ctaText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#A08AB7',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#A08AB7',
  },
  typingText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
    color: '#A08AB7',
  },
});
