import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, ActivityIndicator, StyleSheet, Alert, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import PremiumPaywall from '@/components/premium/PremiumPaywall';
import { getPrivateKey, decryptMessage } from '@/lib/encryption';
import { useScreenProtection } from '@/hooks/useScreenProtection';
import { useColorScheme } from '@/lib/useColorScheme';
import { useUnreadActivityCount } from '@/hooks/useActivityFeed';

interface Conversation {
  match_id: string;
  profile: {
    id: string;
    display_name: string;
    age: number;
    photo_url?: string;
    is_verified?: boolean;
    encryption_public_key?: string;
    photo_blur_enabled?: boolean;
    is_revealed?: boolean;
  };
  last_message?: {
    encrypted_content: string;
    created_at: string;
    sender_profile_id: string;
    read_at: string | null;
    decrypted_content?: string;  // Add field for decrypted content
  };
  unread_count: number;
  is_muted?: boolean;
  is_archived?: boolean;
  is_pinned?: boolean;
}

export default function Messages() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const insets = useSafeAreaInsets();
  const { colors, isDarkColorScheme } = useColorScheme();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const unreadActivityCount = useUnreadActivityCount(currentProfileId);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set()); // Set of match_ids where other user is typing

  // Refs for typing indicator subscriptions
  const typingChannelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Protect conversation list from screenshots
  useScreenProtection();

  useEffect(() => {
    loadCurrentProfile();
  }, []);

  useEffect(() => {
    if (currentProfileId) {
      loadConversations();
      subscribeToMessages();
    }
  }, [currentProfileId, showArchived]);

  // Reload conversations when screen comes into focus (e.g., after viewing a chat)
  useFocusEffect(
    useCallback(() => {
      if (currentProfileId) {
        loadConversations();
      }
    }, [currentProfileId, showArchived])
  );

  const loadCurrentProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setCurrentProfileId(data.id);
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const loadConversations = async () => {
    try {
      if (!currentProfileId) return;

      // Run initial queries in parallel for better performance
      const [matchesResult, blockedByMeResult, blockedMeResult, revealsResult] = await Promise.all([
        // Get all matches (filtered by archived status)
        supabase
          .from('matches')
          .select('id, profile1_id, profile2_id, is_muted, is_archived, is_pinned')
          .or(`profile1_id.eq.${currentProfileId},profile2_id.eq.${currentProfileId}`)
          .eq('status', 'active')
          .eq('is_archived', showArchived),
        // Get blocked users
        supabase
          .from('blocks')
          .select('blocked_profile_id')
          .eq('blocker_profile_id', currentProfileId),
        supabase
          .from('blocks')
          .select('blocker_profile_id')
          .eq('blocked_profile_id', currentProfileId),
        // Get photo reveals for current user
        supabase
          .from('photo_reveals')
          .select('revealer_profile_id')
          .eq('revealed_to_profile_id', currentProfileId),
      ]);

      if (matchesResult.error) throw matchesResult.error;

      const matches = matchesResult.data || [];
      const blockedProfileIds = new Set([
        ...(blockedByMeResult.data?.map(b => b.blocked_profile_id) || []),
        ...(blockedMeResult.data?.map(b => b.blocker_profile_id) || [])
      ]);
      const revealedProfileIds = new Set(
        revealsResult.data?.map(r => r.revealer_profile_id) || []
      );

      // Filter out matches with blocked users and get other profile IDs
      const filteredMatches = matches.filter(match => {
        const otherProfileId = match.profile1_id === currentProfileId
          ? match.profile2_id
          : match.profile1_id;
        return !blockedProfileIds.has(otherProfileId);
      });

      if (filteredMatches.length === 0) {
        setConversations([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Get all other profile IDs
      const otherProfileIds = filteredMatches.map(match =>
        match.profile1_id === currentProfileId ? match.profile2_id : match.profile1_id
      );
      const matchIds = filteredMatches.map(match => match.id);

      // Batch fetch all profiles and messages in parallel
      const [profilesResult, messagesResult, unreadCountsResult] = await Promise.all([
        // Get all profiles at once
        supabase
          .from('profiles')
          .select(`
            id,
            display_name,
            age,
            is_verified,
            encryption_public_key,
            photo_blur_enabled,
            photos (
              url,
              is_primary,
              display_order
            )
          `)
          .in('id', otherProfileIds),
        // Get last message for each match using a single query with distinct
        supabase
          .from('messages')
          .select('match_id, encrypted_content, created_at, sender_profile_id, read_at')
          .in('match_id', matchIds)
          .order('created_at', { ascending: false }),
        // Get unread counts for all matches at once
        supabase
          .from('messages')
          .select('match_id', { count: 'exact' })
          .in('match_id', matchIds)
          .eq('receiver_profile_id', currentProfileId)
          .is('read_at', null),
      ]);

      // Create lookup maps for O(1) access
      const profilesMap = new Map(
        (profilesResult.data || []).map(p => [p.id, p])
      );

      // Get last message per match (first occurrence since sorted desc)
      const lastMessagesMap = new Map<string, any>();
      for (const msg of messagesResult.data || []) {
        if (!lastMessagesMap.has(msg.match_id)) {
          lastMessagesMap.set(msg.match_id, msg);
        }
      }

      // Count unread messages per match
      const unreadCountsMap = new Map<string, number>();
      for (const msg of unreadCountsResult.data || []) {
        const current = unreadCountsMap.get(msg.match_id) || 0;
        unreadCountsMap.set(msg.match_id, current + 1);
      }

      // Get private key once for all decryptions
      const privateKey = await getPrivateKey(user?.id || '');

      // Build conversations with decryption done in parallel
      const conversationsData = await Promise.all(
        filteredMatches.map(async (match) => {
          const otherProfileId = match.profile1_id === currentProfileId
            ? match.profile2_id
            : match.profile1_id;

          const profile = profilesMap.get(otherProfileId);
          const lastMessage = lastMessagesMap.get(match.id);
          const unreadCount = unreadCountsMap.get(match.id) || 0;

          const photos = profile?.photos?.sort((a: any, b: any) => a.display_order - b.display_order);
          const primaryPhoto = photos?.find((p: any) => p.is_primary) || photos?.[0];
          const isRevealed = revealedProfileIds.has(otherProfileId);

          // Decrypt last message if available
          let decryptedContent: string | undefined;
          if (lastMessage && profile?.encryption_public_key) {
            try {
              if (privateKey) {
                decryptedContent = await decryptMessage(
                  lastMessage.encrypted_content,
                  privateKey,
                  profile.encryption_public_key
                );
              } else {
                decryptedContent = t('messages.encryptedMessage');
              }
            } catch (error) {
              decryptedContent = t('messages.encryptedMessage');
            }
          } else if (lastMessage) {
            const content = lastMessage.encrypted_content;
            if (content && content.includes(':') && /^[A-Za-z0-9+/=]+:/.test(content)) {
              decryptedContent = t('messages.encryptedMessage');
            } else {
              decryptedContent = content;
            }
          }

          return {
            match_id: match.id,
            profile: {
              id: profile?.id || '',
              display_name: profile?.display_name || 'Unknown',
              age: profile?.age || 0,
              photo_url: primaryPhoto?.url,
              is_verified: profile?.is_verified,
              encryption_public_key: profile?.encryption_public_key,
              photo_blur_enabled: profile?.photo_blur_enabled || false,
              is_revealed: isRevealed,
            },
            last_message: lastMessage ? {
              ...lastMessage,
              decrypted_content: decryptedContent
            } : undefined,
            unread_count: unreadCount,
            is_muted: match.is_muted || false,
            is_archived: match.is_archived || false,
            is_pinned: match.is_pinned || false,
          };
        })
      );

      // Sort: pinned first, then by last message time (most recent first)
      const sorted = conversationsData.sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        if (!a.last_message) return 1;
        if (!b.last_message) return -1;
        return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
      });

      setConversations(sorted);
    } catch (error: any) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel('messages-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  // Subscribe to typing indicators for all conversations (Premium feature)
  const subscribeToTypingIndicators = useCallback((matchIds: string[]) => {
    if (!isPremium || !currentProfileId) return;

    // Unsubscribe from channels that are no longer needed
    const currentMatchIds = new Set(matchIds);
    for (const [matchId, channel] of typingChannelsRef.current) {
      if (!currentMatchIds.has(matchId)) {
        channel.unsubscribe();
        typingChannelsRef.current.delete(matchId);
        // Clear any pending timeout
        const timeout = typingTimeoutsRef.current.get(matchId);
        if (timeout) {
          clearTimeout(timeout);
          typingTimeoutsRef.current.delete(matchId);
        }
      }
    }

    // Subscribe to new channels
    for (const matchId of matchIds) {
      if (typingChannelsRef.current.has(matchId)) continue;

      const channel = supabase.channel(`typing-${matchId}`, {
        config: {
          broadcast: { self: false },
        },
      });

      channel
        .on('broadcast', { event: 'typing' }, (payload) => {
          // Only show typing if it's from the other user
          if (payload.payload?.profileId && payload.payload.profileId !== currentProfileId) {
            // Add to typing users
            setTypingUsers((prev) => {
              const newSet = new Set(prev);
              newSet.add(matchId);
              return newSet;
            });

            // Clear existing timeout for this match
            const existingTimeout = typingTimeoutsRef.current.get(matchId);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
            }

            // Hide typing indicator after 3 seconds of no typing events
            const timeout = setTimeout(() => {
              setTypingUsers((prev) => {
                const newSet = new Set(prev);
                newSet.delete(matchId);
                return newSet;
              });
              typingTimeoutsRef.current.delete(matchId);
            }, 3000);

            typingTimeoutsRef.current.set(matchId, timeout);
          }
        })
        .subscribe();

      typingChannelsRef.current.set(matchId, channel);
    }
  }, [isPremium, currentProfileId]);

  // Subscribe to typing indicators when conversations change
  useEffect(() => {
    if (isPremium && currentProfileId && conversations.length > 0) {
      const matchIds = conversations.map((c) => c.match_id);
      subscribeToTypingIndicators(matchIds);
    }

    return () => {
      // Cleanup all typing channels
      for (const channel of typingChannelsRef.current.values()) {
        channel.unsubscribe();
      }
      typingChannelsRef.current.clear();

      // Clear all timeouts
      for (const timeout of typingTimeoutsRef.current.values()) {
        clearTimeout(timeout);
      }
      typingTimeoutsRef.current.clear();
    };
  }, [isPremium, currentProfileId, conversations, subscribeToTypingIndicators]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadConversations();
  }, [currentProfileId]);

  const handleConversationPress = (conversation: Conversation) => {
    router.push(`/chat/${conversation.match_id}`);
  };

  const handleDeleteConversation = (conversation: Conversation) => {
    Alert.alert(
      t('messages.deleteDialog.title'),
      t('messages.deleteDialog.message', { name: conversation.profile.display_name }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('messages.deleteDialog.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete all messages in the conversation
              const { error: messagesError } = await supabase
                .from('messages')
                .delete()
                .eq('match_id', conversation.match_id);

              if (messagesError) throw messagesError;

              // Remove from local state immediately
              setConversations((prev) => prev.filter((c) => c.match_id !== conversation.match_id));

              // Show success message
              Alert.alert(t('messages.deleteDialog.success'), t('messages.deleteDialog.successMessage'));
            } catch (error: any) {
              console.error('Error deleting conversation:', error);
              Alert.alert(t('common.error'), t('messages.deleteDialog.error'));
            }
          },
        },
      ]
    );
  };

  const handleBlock = (conversation: Conversation) => {
    Alert.alert(
      t('messages.blockDialog.title'),
      t('messages.blockDialog.message', { name: conversation.profile.display_name }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('messages.blockDialog.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              // Get current profile ID
              const { data: currentProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', user?.id)
                .single();

              if (!currentProfile) {
                throw new Error('Could not find your profile');
              }

              // Insert block record
              const { error: blockError } = await supabase
                .from('blocks')
                .insert({
                  blocker_profile_id: currentProfile.id,
                  blocked_profile_id: conversation.profile.id,
                  reason: 'Blocked from messages',
                });

              if (blockError) throw blockError;

              // Update match status to blocked
              const { error: matchError } = await supabase
                .from('matches')
                .update({ status: 'blocked' })
                .eq('id', conversation.match_id);

              if (matchError) throw matchError;

              // Remove from local state
              setConversations((prev) => prev.filter((c) => c.match_id !== conversation.match_id));

              Alert.alert(t('messages.blockDialog.success'), t('messages.blockDialog.successMessage', { name: conversation.profile.display_name }));
            } catch (error: any) {
              console.error('Error blocking user:', error);
              Alert.alert(t('common.error'), t('messages.blockDialog.error'));
            }
          },
        },
      ]
    );
  };

  const handleReport = (conversation: Conversation) => {
    Alert.prompt(
      t('messages.reportDialog.title'),
      t('messages.reportDialog.message', { name: conversation.profile.display_name }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('messages.reportDialog.submit'),
          onPress: async (reason?: string) => {
            if (!reason || reason.trim() === '') {
              Alert.alert(t('common.error'), t('messages.reportDialog.errorEmpty'));
              return;
            }

            try {
              // Get current profile ID
              const { data: currentProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', user?.id)
                .single();

              if (!currentProfile) {
                throw new Error('Could not find your profile');
              }

              // Insert report
              const { error } = await supabase
                .from('reports')
                .insert({
                  reporter_profile_id: currentProfile.id,
                  reported_profile_id: conversation.profile.id,
                  reason: reason.trim(),
                  status: 'pending',
                });

              if (error) throw error;

              Alert.alert(
                t('messages.reportDialog.success'),
                t('messages.reportDialog.successMessage')
              );
            } catch (error: any) {
              console.error('Error reporting user:', error);
              Alert.alert(t('common.error'), t('messages.reportDialog.error'));
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleMuteToggle = async (conversation: Conversation) => {
    try {
      const newMutedState = !conversation.is_muted;

      const { error } = await supabase
        .from('matches')
        .update({ is_muted: newMutedState })
        .eq('id', conversation.match_id);

      if (error) throw error;

      // Update local state
      setConversations((prev) =>
        prev.map((c) =>
          c.match_id === conversation.match_id ? { ...c, is_muted: newMutedState } : c
        )
      );

      Alert.alert(t('common.success'), t('messages.muteSuccess', {
        status: newMutedState ? t('messages.muted') : t('messages.unmuted'),
        name: conversation.profile.display_name
      }));
    } catch (error: any) {
      console.error('Error toggling mute:', error);
      Alert.alert(t('common.error'), t('messages.markUnreadError'));
    }
  };

  const handleArchiveToggle = async (conversation: Conversation) => {
    try {
      const newArchivedState = !conversation.is_archived;

      const { error } = await supabase
        .from('matches')
        .update({ is_archived: newArchivedState })
        .eq('id', conversation.match_id);

      if (error) throw error;

      // Remove from current view immediately
      setConversations((prev) => prev.filter((c) => c.match_id !== conversation.match_id));

      Alert.alert(t('common.success'), t('messages.archiveSuccess', {
        status: newArchivedState ? t('messages.archived') : t('messages.unarchived')
      }));
    } catch (error: any) {
      console.error('Error toggling archive:', error);
      Alert.alert(t('common.error'), t('messages.markUnreadError'));
    }
  };

  const handlePinToggle = async (conversation: Conversation) => {
    try {
      const newPinnedState = !conversation.is_pinned;

      const { error } = await supabase
        .from('matches')
        .update({ is_pinned: newPinnedState })
        .eq('id', conversation.match_id);

      if (error) throw error;

      // Update local state and re-sort
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.match_id === conversation.match_id ? { ...c, is_pinned: newPinnedState } : c
        );

        // Re-sort: pinned first, then by last message time
        return updated.sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          if (!a.last_message) return 1;
          if (!b.last_message) return -1;
          return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
        });
      });

      Alert.alert(t('common.success'), t('messages.pinSuccess', {
        status: newPinnedState ? t('messages.pinned') : t('messages.unpinned')
      }));
    } catch (error: any) {
      console.error('Error toggling pin:', error);
      Alert.alert(t('common.error'), t('messages.markUnreadError'));
    }
  };

  const handleMarkAsUnread = async (conversation: Conversation) => {
    try {
      if (!conversation.last_message) return;

      // Mark the last message as unread
      const { error } = await supabase
        .from('messages')
        .update({ read_at: null })
        .eq('match_id', conversation.match_id)
        .eq('receiver_profile_id', currentProfileId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      // Reload conversations to update unread count
      await loadConversations();

      Alert.alert(t('common.success'), t('messages.markUnreadSuccess'));
    } catch (error: any) {
      console.error('Error marking as unread:', error);
      Alert.alert(t('common.error'), t('messages.markUnreadError'));
    }
  };

  const handleConversationLongPress = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowActionSheet(true);
  };

  const handleActionSelect = (action: string) => {
    if (!selectedConversation) return;

    setShowActionSheet(false);

    // Small delay to allow modal to close smoothly before action
    setTimeout(() => {
      switch (action) {
        case 'view_profile':
          router.push(`/profile/${selectedConversation.profile.id}`);
          break;
        case 'pin':
          handlePinToggle(selectedConversation);
          break;
        case 'mute':
          handleMuteToggle(selectedConversation);
          break;
        case 'mark_unread':
          handleMarkAsUnread(selectedConversation);
          break;
        case 'archive':
          handleArchiveToggle(selectedConversation);
          break;
        case 'report':
          handleReport(selectedConversation);
          break;
        case 'block':
          handleBlock(selectedConversation);
          break;
        case 'delete':
          handleDeleteConversation(selectedConversation);
          break;
      }
    }, 100);
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return t('messages.timeAgo.justNow');
    if (seconds < 3600) return t('messages.timeAgo.minutesAgo', { count: Math.floor(seconds / 60) });
    if (seconds < 86400) return t('messages.timeAgo.hoursAgo', { count: Math.floor(seconds / 3600) });
    if (seconds < 604800) return t('messages.timeAgo.daysAgo', { count: Math.floor(seconds / 86400) });
    return t('messages.timeAgo.weeksAgo', { count: Math.floor(seconds / 604800) });
  };

  const renderUpgradeCard = () => {
    // Only show for free users with at least 2 conversations
    if (isPremium || conversations.length < 2) return null;

    return (
      <MotiView
        from={{ opacity: 0, scale: 0.95, translateY: -10 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{ type: 'spring', delay: 200 }}
        style={styles.upgradeCardContainer}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setShowPaywall(true)}
        >
          <LinearGradient
            colors={['#A08AB7', '#CDC2E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.upgradeCard}
          >
            {/* Header */}
            <View style={styles.upgradeHeader}>
              <View style={styles.upgradeTitleRow}>
                <MaterialCommunityIcons name="crown" size={24} color="#FFD700" />
                <Text style={styles.upgradeTitle}>{t('messages.upgradeCard.title')}</Text>
              </View>
              <MaterialCommunityIcons name="close" size={20} color="rgba(255,255,255,0.8)" />
            </View>

            {/* Features */}
            <View style={styles.upgradeFeatures}>
              {[
                { icon: 'check-all', text: t('messages.upgradeCard.readReceipts') },
                { icon: 'microphone', text: t('messages.upgradeCard.voiceMessages') },
                { icon: 'message-text', text: t('messages.upgradeCard.introMessages') },
              ].map((feature, i) => (
                <View key={i} style={styles.upgradeFeatureRow}>
                  <MaterialCommunityIcons name={feature.icon as any} size={18} color="white" />
                  <Text style={styles.upgradeFeatureText}>{feature.text}</Text>
                </View>
              ))}
            </View>

            {/* CTA */}
            <View style={styles.upgradeCTA}>
              <Text style={styles.upgradeCTAText}>{t('messages.upgradeCard.upgradeCta')}</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="white" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </MotiView>
    );
  };

  const renderConversation = ({ item, index }: { item: Conversation; index: number }) => {
    const hasUnread = item.unread_count > 0;
    const isTyping = typingUsers.has(item.match_id);

    return (
      <MotiView
        from={{ opacity: 0, translateX: -20 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'timing', duration: 300, delay: index * 50 }}
      >
        <TouchableOpacity
          style={[styles.conversationCard, { backgroundColor: colors.card }]}
          onPress={() => handleConversationPress(item)}
          onLongPress={() => handleConversationLongPress(item)}
          activeOpacity={0.7}
        >
          {/* Profile Photo */}
          <View style={styles.photoContainer}>
            <Image
              source={{ uri: item.profile.photo_url || 'https://via.placeholder.com/64' }}
              style={[styles.photo, { backgroundColor: colors.muted }]}
              blurRadius={item.profile.photo_blur_enabled && !item.profile.is_revealed ? 30 : 0}
            />
            {item.profile.is_verified && (
              <View style={[styles.verifiedBadge, { backgroundColor: colors.background }]}>
                <MaterialCommunityIcons name="check-decagram" size={16} color={colors.info} />
              </View>
            )}
            {hasUnread && <View style={styles.unreadDot} />}
          </View>

          {/* Conversation Info */}
          <View style={styles.conversationInfo}>
            <View style={styles.conversationHeader}>
              <View style={styles.nameRow}>
                {item.is_pinned && (
                  <MaterialCommunityIcons name="pin" size={16} color={colors.primary} style={{ marginRight: 4 }} />
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
                    // If no decrypted content and it looks encrypted, show placeholder
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
      </MotiView>
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('messages.title')}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{t('messages.subtitle')}</Text>
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>{t('messages.loadingMessages')}</Text>
        </View>
      </View>
    );
  }

  // Empty state
  if (conversations.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('messages.title')}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{t('messages.subtitle')}</Text>
        </View>

        <View style={styles.emptyContainer}>
          <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: 200 }}
          >
            <View style={styles.emptyIconContainer}>
              <LinearGradient colors={['#A08AB7', '#CDC2E5']} style={styles.emptyIcon}>
                <MaterialCommunityIcons name="chat-outline" size={48} color="white" />
              </LinearGradient>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t('messages.noMessagesYet')}</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {t('messages.noMessagesText')}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/discover')}
            >
              <LinearGradient colors={['#A08AB7', '#CDC2E5']} style={styles.emptyButtonGradient}>
                <MaterialCommunityIcons name="cards-heart" size={20} color="white" />
                <Text style={styles.emptyButtonText}>{t('messages.findMatches')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </MotiView>
        </View>
      </View>
    );
  }

  // Conversations list
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('messages.title')}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
            {showArchived
              ? t('messages.archivedConversations')
              : conversations.length === 1
                ? t('messages.conversation', { count: conversations.length })
                : t('messages.conversations', { count: conversations.length })
            }
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {/* Activity Bell */}
          <TouchableOpacity
            onPress={() => router.push('/activity')}
            style={[styles.activityButton, { backgroundColor: isPremium ? '#F5F0FF' : colors.muted }]}
          >
            <View style={{ position: 'relative' }}>
              <MaterialCommunityIcons
                name="bell-ring-outline"
                size={22}
                color="#A08AB7"
              />
              {unreadActivityCount > 0 && (
                <View style={styles.activityBadge}>
                  <Text style={styles.activityBadgeText}>
                    {unreadActivityCount > 9 ? '9+' : unreadActivityCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
          {/* Archive Button */}
          <TouchableOpacity
            onPress={() => {
              setShowArchived(!showArchived);
              setConversations([]); // Clear to trigger reload
              setLoading(true);
            }}
            style={[styles.archiveButton, { backgroundColor: colors.muted }]}
          >
            <MaterialCommunityIcons
              name={showArchived ? "inbox" : "archive"}
              size={24}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Conversations List */}
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.match_id}
        ListHeaderComponent={renderUpgradeCard}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#A08AB7"
            colors={['#A08AB7']}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Premium Paywall */}
      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        variant="premium"
        feature="read_receipts"
      />

      {/* Action Sheet Modal */}
      <Modal
        visible={showActionSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionSheet(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowActionSheet(false)}
        >
          <Pressable style={[styles.actionSheet, { paddingBottom: Math.max(insets.bottom, 20) + 20, backgroundColor: colors.card }]} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={[styles.actionSheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.actionSheetTitle, { color: colors.foreground }]}>
                {selectedConversation?.profile.display_name}
              </Text>
              <Pressable onPress={() => setShowActionSheet(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.mutedForeground} />
              </Pressable>
            </View>

            {/* Actions */}
            <View style={styles.actionsList}>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleActionSelect('view_profile')}
              >
                <MaterialCommunityIcons name="account" size={24} color={colors.grey} />
                <Text style={[styles.actionText, { color: colors.foreground }]}>{t('messages.actions.viewProfile')}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.grey3} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleActionSelect('pin')}
              >
                <MaterialCommunityIcons
                  name="pin"
                  size={24}
                  color={selectedConversation?.is_pinned ? colors.primary : colors.grey}
                />
                <Text style={[styles.actionText, { color: colors.foreground }]}>
                  {selectedConversation?.is_pinned ? t('messages.actions.unpinConversation') : t('messages.actions.pinConversation')}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.grey3} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleActionSelect('mute')}
              >
                <MaterialCommunityIcons
                  name={selectedConversation?.is_muted ? 'bell-ring' : 'bell-off'}
                  size={24}
                  color={colors.grey}
                />
                <Text style={[styles.actionText, { color: colors.foreground }]}>
                  {selectedConversation?.is_muted ? t('messages.actions.unmuteNotifications') : t('messages.actions.muteNotifications')}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.grey3} />
              </TouchableOpacity>

              {selectedConversation?.last_message && selectedConversation.unread_count === 0 && (
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => handleActionSelect('mark_unread')}
                >
                  <MaterialCommunityIcons name="email-mark-as-unread" size={24} color={colors.grey} />
                  <Text style={[styles.actionText, { color: colors.foreground }]}>{t('messages.actions.markAsUnread')}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.grey3} />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleActionSelect('archive')}
              >
                <MaterialCommunityIcons
                  name={showArchived ? 'inbox' : 'archive'}
                  size={24}
                  color={colors.grey}
                />
                <Text style={[styles.actionText, { color: colors.foreground }]}>
                  {showArchived ? t('messages.actions.unarchive') : t('messages.actions.archive')}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.grey3} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleActionSelect('report')}
              >
                <MaterialCommunityIcons name="flag" size={24} color={colors.grey} />
                <Text style={[styles.actionText, { color: colors.foreground }]}>{t('messages.actions.report')}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.grey3} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionItem, styles.actionItemDanger]}
                onPress={() => handleActionSelect('block')}
              >
                <MaterialCommunityIcons name="block-helper" size={24} color={colors.destructive} />
                <Text style={[styles.actionText, { color: colors.destructive }]}>{t('messages.actions.block')}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.destructive} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionItem, styles.actionItemDanger]}
                onPress={() => handleActionSelect('delete')}
              >
                <MaterialCommunityIcons name="delete" size={24} color={colors.destructive} />
                <Text style={[styles.actionText, { color: colors.destructive }]}>{t('messages.actions.deleteConversation')}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
  },
  activityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBadgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  archiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F5F2F7',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  archiveButtonText: {
    color: '#A08AB7',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 32,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#71717A',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#71717A',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyButton: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
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
  lastMessageUnread: {
    color: '#111827',
    fontWeight: '600',
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
  upgradeCardContainer: {
    marginBottom: 16,
  },
  upgradeCard: {
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  upgradeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  upgradeFeatures: {
    gap: 12,
  },
  upgradeFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  upgradeFeatureText: {
    fontSize: 15,
    color: 'white',
    fontWeight: '500',
  },
  upgradeCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'white',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  upgradeCTAText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#A08AB7',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  actionsList: {
    paddingTop: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  actionItemDanger: {
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
    marginTop: 8,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  actionTextDanger: {
    color: '#EF4444',
  },
});
