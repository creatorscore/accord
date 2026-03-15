import { useState, useEffect, useCallback, useMemo, useRef, createRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, StyleSheet, Alert, Modal, Pressable, useWindowDimensions, Platform, InteractionManager, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect , router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import PremiumPaywall from '@/components/premium/PremiumPaywall';
import { getPrivateKey, decryptMessage } from '@/lib/encryption';
import { getSignedUrls } from '@/lib/signed-urls';
import { useScreenProtection } from '@/hooks/useScreenProtection';
import { useColorScheme } from '@/lib/useColorScheme';
import { MessagesListSkeleton } from '@/components/shared/SkeletonScreens';
import { useToast } from '@/contexts/ToastContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import SwipeableConversationCard from '@/components/messaging/SwipeableConversationCard';
import ReportUserModal from '@/components/moderation/ReportUserModal';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

interface Conversation {
  match_id: string;
  profile: {
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
  const { showToast } = useToast();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const rightSafeArea = isLandscape ? Math.max(insets.right, Platform.OS === 'android' ? 48 : 0) : 0;
  const { colors, isDarkColorScheme } = useColorScheme();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const currentProfileIdRef = useRef<string | null>(null);
  const initialLoadDone = useRef(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [upgradeBannerDismissed, setUpgradeBannerDismissed] = useState(true); // hidden until checked
  const [showArchived, setShowArchived] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set()); // Set of match_ids where other user is typing
  const typingUsersRef = useRef(typingUsers);
  typingUsersRef.current = typingUsers;
  const [isAdmin, setIsAdmin] = useState(false);
  const [archivedCount, setArchivedCount] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingConversation, setReportingConversation] = useState<Conversation | null>(null);

  // Refs for typing indicator subscriptions
  const typingChannelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Swipeable refs for single-open coordination
  const openSwipeableRef = useRef<SwipeableMethods | null>(null);
  const swipeableRefs = useRef<Map<string, React.RefObject<SwipeableMethods | null>>>(new Map());

  // Protect conversation list from screenshots
  useScreenProtection();

  // Android back handler: return from archived view instead of exiting tab
  useEffect(() => {
    if (!showArchived) return;
    const onBackPress = () => {
      setShowArchived(false);
      setConversations([]);
      setLoading(true);
      return true;
    };
    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, [showArchived]);

  // Check if upgrade banner was recently dismissed (3-day cooldown)
  useEffect(() => {
    const checkBannerDismissal = async () => {
      try {
        const dismissedAt = await AsyncStorage.getItem('upgradeBannerDismissedAt');
        if (dismissedAt) {
          const daysSince = (Date.now() - parseInt(dismissedAt, 10)) / (1000 * 60 * 60 * 24);
          setUpgradeBannerDismissed(daysSince < 3);
        } else {
          setUpgradeBannerDismissed(false);
        }
      } catch {
        setUpgradeBannerDismissed(false);
      }
    };
    checkBannerDismissal();
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initMessages = async () => {
      try {
        // ═══ Phase 0: Profile + matches in parallel ═══
        // RLS on matches table filters to current user, so no profileId needed for query
        // Get profile first (need ID to filter matches to own only)
        const profileResult = await supabase.from('profiles').select('id, is_admin').eq('user_id', user?.id).single();
        if (profileResult.error) throw profileResult.error;
        const myProfileId = profileResult.data.id;
        currentProfileIdRef.current = myProfileId;
        setCurrentProfileId(myProfileId);
        setIsAdmin(profileResult.data.is_admin || false);

        // CRITICAL: Always filter to own matches — admin RLS returns ALL matches in DB
        const matchesResult = await supabase.from('matches')
            .select('id, profile1_id, profile2_id, is_muted, is_archived, is_pinned')
            .eq('status', 'active')
            .eq('is_archived', showArchived)
            .or(`profile1_id.eq.${myProfileId},profile2_id.eq.${myProfileId}`);

        if (matchesResult.error) throw matchesResult.error;
        const matches = matchesResult.data || [];

        // Now run queries that need profileId
        await loadConversationsWithId(myProfileId, matches);

        // Set up subscription
        unsubscribe = subscribeToMessages();
        initialLoadDone.current = true;
      } catch (error: any) {
        console.error('Error initializing messages:', error);
        setLoading(false);
      }
    };

    initMessages();

    return () => {
      unsubscribe?.();
    };
  }, [showArchived]);

  // Reload conversations when screen regains focus (e.g., after viewing a chat)
  // Skip initial mount — initMessages already handles that
  useFocusEffect(
    useCallback(() => {
      if (initialLoadDone.current && currentProfileId) {
        loadConversations();
      }
    }, [currentProfileId, showArchived])
  );

  const loadConversations = async () => {
    const profileId = currentProfileIdRef.current || currentProfileId;
    if (!profileId) return;
    try {
      const [matchesResult] = await Promise.all([
        supabase.from('matches')
          .select('id, profile1_id, profile2_id, is_muted, is_archived, is_pinned')
          .or(`profile1_id.eq.${profileId},profile2_id.eq.${profileId}`)
          .eq('status', 'active')
          .eq('is_archived', showArchived),
      ]);
      if (matchesResult.error) throw matchesResult.error;
      await loadConversationsWithId(profileId, matchesResult.data || []);
    } catch (error: any) {
      console.error('Error loading conversations:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadConversationsWithId = async (profileId: string, filteredMatchesRaw: any[]) => {
    try {
      // Run block/reveal queries + data queries all in parallel
      const [blockedByMeResult, blockedMeResult, revealsResult] = await Promise.all([
        supabase.from('blocks').select('blocked_profile_id').eq('blocker_profile_id', profileId),
        supabase.from('blocks').select('blocker_profile_id').eq('blocked_profile_id', profileId),
        supabase.from('photo_reveals').select('revealer_profile_id').eq('revealed_to_profile_id', profileId),
      ]);

      // Fetch archived count in parallel when viewing active messages (non-blocking)
      if (!showArchived) {
        supabase
          .from('matches')
          .select('id', { count: 'exact', head: true })
          .or(`profile1_id.eq.${profileId},profile2_id.eq.${profileId}`)
          .eq('status', 'active')
          .eq('is_archived', true)
          .then(({ count }) => {
            setArchivedCount(count || 0);
          });
      }

      const blockedProfileIds = new Set([
        ...(blockedByMeResult.data?.map(b => b.blocked_profile_id) || []),
        ...(blockedMeResult.data?.map(b => b.blocker_profile_id) || [])
      ]);
      const revealedProfileIds = new Set(
        revealsResult.data?.map(r => r.revealer_profile_id) || []
      );

      // Filter out matches with blocked users
      const filteredMatches = filteredMatchesRaw.filter(match => {
        const otherPId = match.profile1_id === profileId
          ? match.profile2_id
          : match.profile1_id;
        return !blockedProfileIds.has(otherPId);
      });

      if (filteredMatches.length === 0) {
        setConversations([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Get all other profile IDs
      const otherProfileIds = filteredMatches.map(match =>
        match.profile1_id === profileId ? match.profile2_id : match.profile1_id
      );
      const matchIds = filteredMatches.map(match => match.id);

      // Batch fetch profiles, messages, unread counts, and private key all in parallel
      const [profilesResult, messagesResult, unreadCountsResult, privateKey] = await Promise.all([
        supabase
          .from('profiles')
          .select(`
            id,
            display_name,
            age,
            is_verified,
            photo_verified,
            encryption_public_key,
            photo_blur_enabled,
            photos (
              url,
              storage_path,
              is_primary,
              display_order,
              blur_data_uri
            )
          `)
          .in('id', otherProfileIds),
        // PERFORMANCE: Use RPCs that return only last message per match + grouped unread counts
        supabase.rpc('get_last_messages', { p_match_ids: matchIds }),
        supabase.rpc('get_unread_counts', { p_match_ids: matchIds, p_profile_id: profileId }),
        getPrivateKey(user?.id || ''),
      ]);

      // Create lookup maps for O(1) access
      const profilesMap = new Map(
        (profilesResult.data || []).map(p => [p.id, p])
      );

      // RPC returns one row per match (DISTINCT ON), so direct map
      const lastMessagesMap = new Map<string, any>(
        (messagesResult.data || []).map((msg: any) => [msg.match_id, msg])
      );

      // RPC returns grouped counts, so direct map
      const unreadCountsMap = new Map<string, number>(
        (unreadCountsResult.data || []).map((row: any) => [row.match_id, Number(row.unread_count)])
      );

      // Collect primary photo paths for all conversations, then batch-sign (1 RPC call)
      const matchEntries = filteredMatches.map((match) => {
        const otherProfileId = match.profile1_id === profileId
          ? match.profile2_id
          : match.profile1_id;
        const profile = profilesMap.get(otherProfileId);
        const photos = profile?.photos?.sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
        const primaryPhoto = photos?.find((p: any) => p.is_primary) || photos?.[0];
        return { match, otherProfileId, profile, primaryPhoto };
      });

      // Batch-sign all primary photo URLs at once (skip entries with no photo)
      const photoPaths = matchEntries.map(e =>
        e.primaryPhoto ? (e.primaryPhoto.storage_path || e.primaryPhoto.url || '') : ''
      );
      const validIndices: number[] = [];
      const validPaths: string[] = [];
      photoPaths.forEach((p, i) => {
        if (p) { validIndices.push(i); validPaths.push(p); }
      });
      const signedPhotoUrls: (string | null)[] = new Array(photoPaths.length).fill(null);
      if (validPaths.length > 0) {
        const signed = await getSignedUrls('profile-photos', validPaths);
        for (let j = 0; j < signed.length; j++) {
          signedPhotoUrls[validIndices[j]] = signed[j];
        }
      }

      // Build conversations WITHOUT decryption first (show UI immediately)
      const conversationsData = matchEntries.map(({ match, otherProfileId, profile, primaryPhoto }, i) => {
        const lastMessage = lastMessagesMap.get(match.id);
        const unreadCount = unreadCountsMap.get(match.id) || 0;
        const isRevealed = revealedProfileIds.has(otherProfileId);
        const signedPhotoUrl = signedPhotoUrls[i] || primaryPhoto?.url;

        // Quick check for plaintext messages (no decryption needed)
        let decryptedContent: string | undefined;
        if (lastMessage) {
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
            photo_url: signedPhotoUrl,
            photo_blur_data_uri: primaryPhoto?.blur_data_uri,
            is_verified: profile?.is_verified,
            photo_verified: profile?.photo_verified,
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
      });

      // Sort: pinned first, then by last message time (most recent first)
      const sortConversations = (list: typeof conversationsData) =>
        [...list].sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          if (!a.last_message) return 1;
          if (!b.last_message) return -1;
          return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
        });

      // Show conversations immediately (with placeholder previews)
      setConversations(sortConversations(conversationsData));
      setLoading(false);
      setRefreshing(false);

      // PERFORMANCE: Defer decryption until after UI is responsive
      InteractionManager.runAfterInteractions(async () => {
        try {
          if (!privateKey) return;
          const decrypted = await Promise.all(
            conversationsData.map(async (conv) => {
              if (!conv.last_message || !conv.profile.encryption_public_key) return conv;
              const content = conv.last_message.encrypted_content;
              // Skip if already plaintext
              if (!content || !(content.includes(':') && /^[A-Za-z0-9+/=]+:/.test(content))) return conv;
              try {
                const decryptedContent = await decryptMessage(
                  content,
                  privateKey,
                  conv.profile.encryption_public_key!
                );
                return {
                  ...conv,
                  last_message: { ...conv.last_message, decrypted_content: decryptedContent },
                };
              } catch {
                return conv;
              }
            })
          );
          setConversations(sortConversations(decrypted));
        } catch (error) {
          console.error('Error decrypting message previews:', error);
        }
      });
    } catch (error: any) {
      console.error('Error loading conversations:', error);
      setLoading(false);
      setRefreshing(false);
    }
  };

  const subscribeToMessages = () => {
    const profileId = currentProfileIdRef.current || currentProfileId;
    if (!profileId) return () => {};

    const channel = supabase
      .channel('messages-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_profile_id=eq.${profileId}`,
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
          filter: `receiver_profile_id=eq.${profileId}`,
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
          if (payload.payload?.profileId && payload.payload.profileId !== (currentProfileIdRef.current || currentProfileId)) {
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

  const handleConversationPress = useCallback((conversation: Conversation) => {
    router.push(`/chat/${conversation.match_id}`);
  }, []);

  const handleDeleteConversation = useCallback((conversation: Conversation) => {
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
              // Delete all messages to free DB storage (match stays intact)
              const { error: messagesError } = await supabase
                .from('messages')
                .delete()
                .eq('match_id', conversation.match_id);

              if (messagesError) throw messagesError;

              // Remove from local state immediately
              setConversations((prev) => prev.filter((c) => c.match_id !== conversation.match_id));

              // Show success message
              showToast({ type: 'success', title: t('messages.deleteDialog.success'), message: t('messages.deleteDialog.successMessage') });
            } catch (error: any) {
              console.error('Error deleting conversation:', error);
              showToast({ type: 'error', title: t('common.error'), message: t('messages.deleteDialog.error') });
            }
          },
        },
      ]
    );
  }, [t, showToast]);

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

              showToast({ type: 'success', title: t('messages.blockDialog.success'), message: t('messages.blockDialog.successMessage', { name: conversation.profile.display_name }) });
            } catch (error: any) {
              console.error('Error blocking user:', error);
              showToast({ type: 'error', title: t('common.error'), message: t('messages.blockDialog.error') });
            }
          },
        },
      ]
    );
  };

  const handleReport = (conversation: Conversation) => {
    setReportingConversation(conversation);
    setShowReportModal(true);
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

      showToast({ type: 'success', title: t('common.success'), message: t('messages.muteSuccess', {
        status: newMutedState ? t('messages.muted') : t('messages.unmuted'),
        name: conversation.profile.display_name
      }) });
    } catch (error: any) {
      console.error('Error toggling mute:', error);
      showToast({ type: 'error', title: t('common.error'), message: t('messages.markUnreadError') });
    }
  };

  const handleArchiveToggle = useCallback(async (conversation: Conversation) => {
    try {
      const newArchivedState = !conversation.is_archived;

      const { error } = await supabase
        .from('matches')
        .update({ is_archived: newArchivedState })
        .eq('id', conversation.match_id);

      if (error) throw error;

      // Remove from current view immediately
      setConversations((prev) => prev.filter((c) => c.match_id !== conversation.match_id));

      // Update archived count without re-fetching
      setArchivedCount((prev) => newArchivedState ? prev + 1 : Math.max(prev - 1, 0));

      showToast({ type: 'success', title: t('common.success'), message: t('messages.archiveSuccess', {
        status: newArchivedState ? t('messages.archived') : t('messages.unarchived')
      }) });
    } catch (error: any) {
      console.error('Error toggling archive:', error);
      showToast({ type: 'error', title: t('common.error'), message: t('messages.markUnreadError') });
    }
  }, [t, showToast]);

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

      showToast({ type: 'success', title: t('common.success'), message: t('messages.pinSuccess', {
        status: newPinnedState ? t('messages.pinned') : t('messages.unpinned')
      }) });
    } catch (error: any) {
      console.error('Error toggling pin:', error);
      showToast({ type: 'error', title: t('common.error'), message: t('messages.markUnreadError') });
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

      showToast({ type: 'success', title: t('common.success'), message: t('messages.markUnreadSuccess') });
    } catch (error: any) {
      console.error('Error marking as unread:', error);
      showToast({ type: 'error', title: t('common.error'), message: t('messages.markUnreadError') });
    }
  };

  const handleConversationLongPress = useCallback((conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowActionSheet(true);
  }, []);

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

  const getTimeAgo = useCallback((dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return t('messages.timeAgo.justNow');
    if (seconds < 3600) return t('messages.timeAgo.minutesAgo', { count: Math.floor(seconds / 60) });
    if (seconds < 86400) return t('messages.timeAgo.hoursAgo', { count: Math.floor(seconds / 3600) });
    if (seconds < 604800) return t('messages.timeAgo.daysAgo', { count: Math.floor(seconds / 86400) });
    return t('messages.timeAgo.weeksAgo', { count: Math.floor(seconds / 604800) });
  }, [t]);

  // Get or create a ref for a conversation's swipeable
  const getSwipeableRef = useCallback((matchId: string) => {
    if (!swipeableRefs.current.has(matchId)) {
      swipeableRefs.current.set(matchId, createRef<SwipeableMethods | null>());
    }
    return swipeableRefs.current.get(matchId)!;
  }, []);

  const renderUpgradeCard = () => {
    // Only show for free users with at least 2 conversations, and not dismissed
    if (isPremium || conversations.length < 2 || upgradeBannerDismissed) return null;

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
              <TouchableOpacity
                onPress={(e) => {
                  e.stopPropagation();
                  setUpgradeBannerDismissed(true);
                  AsyncStorage.setItem('upgradeBannerDismissedAt', Date.now().toString());
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons name="close" size={20} color="rgba(255,255,255,0.8)" />
              </TouchableOpacity>
            </View>

            {/* Features */}
            <View style={styles.upgradeFeatures}>
              {[
                { icon: 'check-all', text: t('messages.upgradeCard.readReceipts') },
                { icon: 'microphone', text: t('messages.upgradeCard.voiceMessages') },
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

  const renderConversation = useCallback(({ item }: { item: Conversation }) => {
    const ref = getSwipeableRef(item.match_id);
    return (
      <SwipeableConversationCard
        item={item}
        currentProfileId={currentProfileId}
        isAdmin={isAdmin}
        isPremium={isPremium}
        isTyping={typingUsersRef.current.has(item.match_id)}
        showArchived={showArchived}
        colors={colors}
        openSwipeableRef={openSwipeableRef}
        swipeableRef={ref}
        getTimeAgo={getTimeAgo}
        onPress={handleConversationPress}
        onLongPress={handleConversationLongPress}
        onArchive={handleArchiveToggle}
        onDelete={handleDeleteConversation}
      />
    );
  }, [currentProfileId, isAdmin, isPremium, showArchived, colors, getTimeAgo, handleConversationPress, handleConversationLongPress, handleArchiveToggle, handleDeleteConversation, getSwipeableRef]);

  const keyExtractor = useCallback((item: Conversation) => item.match_id, []);

  const listHeader = useMemo(() => (
    <>
      {renderUpgradeCard()}
      {!showArchived && archivedCount > 0 && (
        <TouchableOpacity
          style={[styles.archivedFolderRow, { backgroundColor: colors.card }]}
          onPress={() => {
            setShowArchived(true);
            setConversations([]);
            setLoading(true);
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.archivedFolderIcon, { backgroundColor: colors.muted }]}>
            <MaterialCommunityIcons name="archive-outline" size={20} color="#A08AB7" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.archivedFolderLabel, { color: colors.foreground }]}>
              {t('messages.archivedFolder')}
            </Text>
          </View>
          <Text style={[styles.archivedFolderCount, { color: colors.mutedForeground }]}>
            {archivedCount}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.grey3} />
        </TouchableOpacity>
      )}
    </>
  ), [showArchived, archivedCount, colors, t, isPremium, conversations.length]);

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('messages.title')}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{t('messages.subtitle')}</Text>
        </View>

        <MessagesListSkeleton />
      </View>
    );
  }

  // Empty state
  if (conversations.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          {showArchived ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowArchived(false);
                  setConversations([]);
                  setLoading(true);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <MaterialCommunityIcons name="arrow-left" size={28} color={colors.foreground} />
              </TouchableOpacity>
              <View>
                <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('messages.archivedFolder')}</Text>
                <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
                  {t('messages.conversation', { count: 0 })}
                </Text>
              </View>
            </View>
          ) : (
            <View>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('messages.title')}</Text>
              <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{t('messages.subtitle')}</Text>
            </View>
          )}
        </View>

        <View style={styles.emptyContainer}>
          <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: 200 }}
          >
            {showArchived ? (
              <>
                <View style={styles.emptyIconContainer}>
                  <View style={[styles.emptyIcon, { backgroundColor: colors.muted }]}>
                    <MaterialCommunityIcons name="archive-outline" size={48} color={colors.mutedForeground} />
                  </View>
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t('messages.noArchivedMessages')}</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {t('messages.noArchivedMessagesText')}
                </Text>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => {
                    setShowArchived(false);
                    setConversations([]);
                    setLoading(true);
                  }}
                >
                  <View style={[styles.emptyButtonGradient, { backgroundColor: colors.muted }]}>
                    <MaterialCommunityIcons name="arrow-left" size={20} color={colors.foreground} />
                    <Text style={[styles.emptyButtonText, { color: colors.foreground }]}>{t('messages.backToMessages')}</Text>
                  </View>
                </TouchableOpacity>
              </>
            ) : (
              <>
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
              </>
            )}
          </MotiView>
        </View>
      </View>
    );
  }

  // Conversations list
  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingRight: rightSafeArea }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        {showArchived ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <TouchableOpacity
              onPress={() => {
                setShowArchived(false);
                setConversations([]);
                setLoading(true);
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="arrow-left" size={28} color={colors.foreground} />
            </TouchableOpacity>
            <View>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('messages.archivedFolder')}</Text>
              <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
                {conversations.length === 1
                  ? t('messages.archivedFolderCountOne', { count: conversations.length })
                  : t('messages.archivedFolderCount', { count: conversations.length })
                }
              </Text>
            </View>
          </View>
        ) : (
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('messages.title')}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
              {conversations.length === 1
                ? t('messages.conversation', { count: conversations.length })
                : t('messages.conversations', { count: conversations.length })
              }
            </Text>
          </View>
        )}
      </View>

      {/* Conversations List */}
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={keyExtractor}
        extraData={typingUsers}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#A08AB7"
            colors={['#A08AB7']}
          />
        }
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
        windowSize={10}
        removeClippedSubviews={true}
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
                  color={selectedConversation?.is_pinned ? '#A08AB7' : colors.grey}
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

      {/* Report User Modal */}
      {reportingConversation && (
        <ReportUserModal
          visible={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setReportingConversation(null);
          }}
          reportedProfileId={reportingConversation.profile.id}
          reportedProfileName={reportingConversation.profile.display_name}
        />
      )}
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
  archivedFolderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 14,
    gap: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  archivedFolderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  archivedFolderLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  archivedFolderCount: {
    fontSize: 14,
    fontWeight: '500',
    marginRight: 4,
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
