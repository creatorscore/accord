import { useState, useEffect, useCallback, useMemo, useRef, createRef, memo } from 'react';
import { View, Text, FlatList, TouchableOpacity, RefreshControl, StyleSheet, Alert, Modal, Pressable, useWindowDimensions, Platform, InteractionManager, BackHandler, Image } from 'react-native';
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
import { usePhotoBlur } from '@/hooks/usePhotoBlur';
import { SafeBlurImage } from '@/components/shared/SafeBlurImage';
import { useUnreadActivityCount } from '@/hooks/useActivityFeed';
import { isOnline } from '@/lib/online-status';
import type { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';

// Combined Matches tab: new matches (no messages yet) in a horizontal carousel
// on top, conversations below. This replaced the separate Matches and Messages
// tabs — /(tabs)/messages now redirects here. Data pipeline is the former
// messages.tsx one (matches → get_last_messages + get_unread_counts → deferred
// decryption), extended with the former matches.tsx extras: expiry info, the
// free-plan match meter, the activity bell, and unmatch.

interface Conversation {
  match_id: string;
  matched_at?: string | null;
  expires_at?: string | null;
  first_message_sent_at?: string | null;
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
    last_active_at?: string | null;
    hide_last_active?: boolean;
  };
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

const FREE_MATCH_LIMIT = 10;

function getExpirationInfo(conv: Conversation): { hoursLeft: number; isUrgent: boolean; isExpired: boolean } | null {
  if (conv.first_message_sent_at) return null;
  if (!conv.expires_at) return null;
  const timeLeft = new Date(conv.expires_at).getTime() - Date.now();
  if (timeLeft <= 0) return { hoursLeft: 0, isUrgent: true, isExpired: true };
  const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
  return { hoursLeft, isUrgent: hoursLeft < 24, isExpired: false };
}

// Circular avatar card for the new-matches carousel.
const NewMatchAvatar = memo(function NewMatchAvatar({
  conv,
  isAdmin,
  colors,
  onPress,
  onLongPress,
  t,
}: {
  conv: Conversation;
  isAdmin: boolean;
  colors: any;
  onPress: (c: Conversation) => void;
  onLongPress: (c: Conversation) => void;
  t: any;
}) {
  const { imageUri, blurRadius, onImageLoad, onImageError } = usePhotoBlur({
    shouldBlur: (conv.profile.photo_blur_enabled || false) && !conv.profile.is_revealed && !isAdmin,
    photoUrl: conv.profile.photo_url || 'https://via.placeholder.com/80',
    blurDataUri: conv.profile.photo_blur_data_uri,
    blurIntensity: 30,
  });
  const online = isOnline(conv.profile.last_active_at || null) && !conv.profile.hide_last_active;
  const expiration = getExpirationInfo(conv);

  return (
    <TouchableOpacity
      style={styles.newMatchItem}
      onPress={() => onPress(conv)}
      onLongPress={() => onLongPress(conv)}
      activeOpacity={0.75}
    >
      <View>
        <View style={[styles.newMatchPhotoRing, expiration?.isUrgent ? styles.newMatchPhotoRingUrgent : null]}>
          <SafeBlurImage
            source={{ uri: imageUri }}
            style={styles.newMatchPhoto}
            resizeMode="cover"
            blurRadius={blurRadius}
            onLoad={onImageLoad}
            onError={onImageError}
          />
        </View>
        {online && <View style={[styles.newMatchOnlineDot, { borderColor: colors.background }]} />}
        {expiration && !expiration.isExpired && (
          <View style={[styles.newMatchExpiryBadge, expiration.isUrgent ? styles.newMatchExpiryBadgeUrgent : null]}>
            <MaterialCommunityIcons name="clock-outline" size={10} color="#FFFFFF" />
            <Text style={styles.newMatchExpiryText}>
              {expiration.hoursLeft >= 24 ? `${Math.floor(expiration.hoursLeft / 24)}d` : `${Math.max(1, expiration.hoursLeft)}h`}
            </Text>
          </View>
        )}
      </View>
      <Text style={[styles.newMatchName, { color: colors.foreground }]} numberOfLines={1}>
        {conv.profile.display_name}
      </Text>
      <Text style={[styles.newMatchHint, { color: colors.mutedForeground }]} numberOfLines={1}>
        {t('matches.sayHi')}
      </Text>
    </TouchableOpacity>
  );
});

export default function Matches() {
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
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  // Ticks every 60s — forces FlatList to re-render relative timestamps.
  const [timeTick, setTimeTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTimeTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);
  const typingUsersRef = useRef(typingUsers);
  typingUsersRef.current = typingUsers;
  const [isAdmin, setIsAdmin] = useState(false);
  const [archivedCount, setArchivedCount] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingConversation, setReportingConversation] = useState<Conversation | null>(null);

  // Activity bell (ported from the old Matches tab)
  const unreadActivityCount = useUnreadActivityCount(currentProfileId);
  const [showActivityNewBadge, setShowActivityNewBadge] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('activity_center_seen').then(val => {
      if (!val) setShowActivityNewBadge(true);
    });
  }, []);
  const handleActivityPress = useCallback(() => {
    setShowActivityNewBadge(false);
    AsyncStorage.setItem('activity_center_seen', 'true');
    router.push('/activity');
  }, []);

  // Refs for typing indicator subscriptions
  const typingChannelsRef = useRef<Map<string, RealtimeChannel>>(new Map());
  const typingTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Swipeable refs for single-open coordination
  const openSwipeableRef = useRef<SwipeableMethods | null>(null);
  const swipeableRefs = useRef<Map<string, React.RefObject<SwipeableMethods | null>>>(new Map());

  useScreenProtection();

  // New matches (no conversation yet) vs threads
  const newMatches = useMemo(
    () => showArchived ? [] : conversations
      .filter((c) => !c.last_message)
      .sort((a, b) => new Date(b.matched_at || 0).getTime() - new Date(a.matched_at || 0).getTime()),
    [conversations, showArchived]
  );
  const threads = useMemo(
    () => showArchived ? conversations : conversations.filter((c) => !!c.last_message),
    [conversations, showArchived]
  );

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
    let unsubscribeMatches: (() => void) | null = null;

    const initMatches = async () => {
      try {
        const profileResult = await supabase.from('profiles').select('id, is_admin').eq('user_id', user?.id).single();
        if (profileResult.error) throw profileResult.error;
        const myProfileId = profileResult.data.id;
        currentProfileIdRef.current = myProfileId;
        setCurrentProfileId(myProfileId);
        setIsAdmin(profileResult.data.is_admin || false);

        // CRITICAL: Always filter to own matches — admin RLS returns ALL matches in DB
        const matchesResult = await supabase.from('matches')
            .select('id, profile1_id, profile2_id, is_muted, is_archived, is_pinned, matched_at, expires_at, first_message_sent_at')
            .eq('status', 'active')
            .eq('is_archived', showArchived)
            .or(`profile1_id.eq.${myProfileId},profile2_id.eq.${myProfileId}`);

        if (matchesResult.error) throw matchesResult.error;
        const matches = matchesResult.data || [];

        await loadConversationsWithId(myProfileId, matches);

        unsubscribe = subscribeToMessages();
        unsubscribeMatches = subscribeToMatches();
        initialLoadDone.current = true;
      } catch (error: any) {
        console.error('Error initializing matches:', error);
        setLoading(false);
      }
    };

    initMatches();

    return () => {
      unsubscribe?.();
      unsubscribeMatches?.();
    };
  }, [showArchived]);

  // Reload when screen regains focus (e.g., after viewing a chat)
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
          .select('id, profile1_id, profile2_id, is_muted, is_archived, is_pinned, matched_at, expires_at, first_message_sent_at')
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
      const [blockedByMeResult, blockedMeResult, revealsResult] = await Promise.all([
        supabase.from('blocks').select('blocked_profile_id').eq('blocker_profile_id', profileId),
        supabase.from('blocks').select('blocker_profile_id').eq('blocked_profile_id', profileId),
        supabase.from('photo_reveals').select('revealer_profile_id').eq('revealed_to_profile_id', profileId),
      ]);

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

      const otherProfileIds = filteredMatches.map(match =>
        match.profile1_id === profileId ? match.profile2_id : match.profile1_id
      );
      const matchIds = filteredMatches.map(match => match.id);

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
            last_active_at,
            hide_last_active,
            photos (
              url,
              storage_path,
              is_primary,
              display_order,
              blur_data_uri
            )
          `)
          .in('id', otherProfileIds),
        supabase.rpc('get_last_messages', { p_match_ids: matchIds }),
        supabase.rpc('get_unread_counts', { p_match_ids: matchIds, p_profile_id: profileId }),
        getPrivateKey(user?.id || ''),
      ]);

      const profilesMap = new Map(
        (profilesResult.data || []).map(p => [p.id, p])
      );
      const lastMessagesMap = new Map<string, any>(
        (messagesResult.data || []).map((msg: any) => [msg.match_id, msg])
      );
      const unreadCountsMap = new Map<string, number>(
        (unreadCountsResult.data || []).map((row: any) => [row.match_id, Number(row.unread_count)])
      );

      const matchEntries = filteredMatches.map((match) => {
        const otherProfileId = match.profile1_id === profileId
          ? match.profile2_id
          : match.profile1_id;
        const profile = profilesMap.get(otherProfileId);
        const photos = profile?.photos?.sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
        const primaryPhoto = photos?.find((p: any) => p.is_primary) || photos?.[0];
        return { match, otherProfileId, profile, primaryPhoto };
      });

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

      const conversationsData = matchEntries.map(({ match, otherProfileId, profile, primaryPhoto }, i) => {
        const lastMessage = lastMessagesMap.get(match.id);
        const unreadCount = unreadCountsMap.get(match.id) || 0;
        const isRevealed = revealedProfileIds.has(otherProfileId);
        const signedPhotoUrl = signedPhotoUrls[i] || primaryPhoto?.url;

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
          matched_at: match.matched_at,
          expires_at: match.expires_at,
          first_message_sent_at: match.first_message_sent_at,
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
            last_active_at: profile?.last_active_at,
            hide_last_active: profile?.hide_last_active,
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

      const sortConversations = (list: typeof conversationsData) =>
        [...list].sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          if (!a.last_message) return 1;
          if (!b.last_message) return -1;
          return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
        });

      setConversations(sortConversations(conversationsData));
      setLoading(false);
      setRefreshing(false);

      // Defer decryption until after UI is responsive
      InteractionManager.runAfterInteractions(async () => {
        try {
          if (!privateKey) return;
          const decrypted = await Promise.all(
            conversationsData.map(async (conv) => {
              if (!conv.last_message || !conv.profile.encryption_public_key) return conv;
              const content = conv.last_message.encrypted_content;
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
      .channel(`messages-updates-${profileId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_profile_id=eq.${profileId}`,
        },
        () => {
          setTimeout(() => loadConversations(), 300);
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

  // New matches appear live in the carousel (INSERTs can't be filtered to
  // either column server-side, so reload on any insert — RLS means we only
  // receive our own rows anyway).
  const subscribeToMatches = () => {
    const profileId = currentProfileIdRef.current || currentProfileId;
    if (!profileId) return () => {};

    const channel = supabase
      .channel(`matches-updates-${profileId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
        },
        () => {
          setTimeout(() => loadConversations(), 300);
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

    const currentMatchIds = new Set(matchIds);
    for (const [matchId, channel] of typingChannelsRef.current) {
      if (!currentMatchIds.has(matchId)) {
        channel.unsubscribe();
        typingChannelsRef.current.delete(matchId);
        const timeout = typingTimeoutsRef.current.get(matchId);
        if (timeout) {
          clearTimeout(timeout);
          typingTimeoutsRef.current.delete(matchId);
        }
      }
    }

    for (const matchId of matchIds) {
      if (typingChannelsRef.current.has(matchId)) continue;

      const channel = supabase.channel(`typing-${matchId}`, {
        config: {
          broadcast: { self: false },
        },
      });

      channel
        .on('broadcast', { event: 'typing' }, (payload) => {
          if (payload.payload?.profileId && payload.payload.profileId !== (currentProfileIdRef.current || currentProfileId)) {
            setTypingUsers((prev) => {
              const newSet = new Set(prev);
              newSet.add(matchId);
              return newSet;
            });

            const existingTimeout = typingTimeoutsRef.current.get(matchId);
            if (existingTimeout) {
              clearTimeout(existingTimeout);
            }

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

  useEffect(() => {
    if (isPremium && currentProfileId && conversations.length > 0) {
      const matchIds = conversations.map((c) => c.match_id);
      subscribeToTypingIndicators(matchIds);
    }

    return () => {
      for (const channel of typingChannelsRef.current.values()) {
        channel.unsubscribe();
      }
      typingChannelsRef.current.clear();
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

  const handleNewMatchPress = useCallback((conversation: Conversation) => {
    router.push(`/profile/${conversation.profile.id}`);
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
              const { error: messagesError } = await supabase
                .from('messages')
                .delete()
                .eq('match_id', conversation.match_id);

              if (messagesError) throw messagesError;

              setConversations((prev) => prev.filter((c) => c.match_id !== conversation.match_id));
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

  const handleUnmatch = useCallback((conversation: Conversation) => {
    Alert.alert(
      t('matches.unmatchDialog.title'),
      t('matches.unmatchDialog.message', { name: conversation.profile.display_name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('matches.unmatchDialog.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              const profileId = currentProfileIdRef.current || currentProfileId;
              if (!profileId) throw new Error('No profile');

              const { error } = await supabase
                .from('matches')
                .update({
                  status: 'unmatched',
                  unmatch_reason: 'User unmatched',
                  unmatched_by: profileId,
                  unmatched_at: new Date().toISOString(),
                })
                .eq('id', conversation.match_id);

              if (error) throw error;

              setConversations((prev) => prev.filter((c) => c.match_id !== conversation.match_id));
              showToast({ type: 'success', title: t('matches.unmatchDialog.success'), message: t('matches.unmatchDialog.successMessage', { name: conversation.profile.display_name }) });
            } catch (error: any) {
              console.error('Error unmatching:', error);
              showToast({ type: 'error', title: t('common.error'), message: t('matches.unmatchDialog.error') });
            }
          },
        },
      ]
    );
  }, [t, showToast, currentProfileId]);

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
              const { data: currentProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', user?.id)
                .single();

              if (!currentProfile) {
                throw new Error('Could not find your profile');
              }

              const { error: blockError } = await supabase
                .from('blocks')
                .insert({
                  blocker_profile_id: currentProfile.id,
                  blocked_profile_id: conversation.profile.id,
                  reason: 'Blocked from messages',
                });

              if (blockError) throw blockError;

              const { error: matchError } = await supabase
                .from('matches')
                .update({ status: 'blocked' })
                .eq('id', conversation.match_id);

              if (matchError) throw matchError;

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

      setConversations((prev) => prev.filter((c) => c.match_id !== conversation.match_id));
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

      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.match_id === conversation.match_id ? { ...c, is_pinned: newPinnedState } : c
        );
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
    if (!conversation.last_message) return;

    const previousUnread = conversation.unread_count || 0;
    setConversations((prev) =>
      prev.map((c) =>
        c.match_id === conversation.match_id
          ? { ...c, unread_count: Math.max(1, previousUnread + 1) }
          : c
      )
    );

    try {
      const { error } = await supabase
        .from('messages')
        .update({ read_at: null })
        .eq('match_id', conversation.match_id)
        .eq('receiver_profile_id', currentProfileId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      showToast({ type: 'success', title: t('common.success'), message: t('messages.markUnreadSuccess') });
      loadConversations();
    } catch (error: any) {
      console.error('Error marking as unread:', error);
      setConversations((prev) =>
        prev.map((c) =>
          c.match_id === conversation.match_id
            ? { ...c, unread_count: previousUnread }
            : c
        )
      );
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
        case 'unmatch':
          handleUnmatch(selectedConversation);
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

  const getSwipeableRef = useCallback((matchId: string) => {
    if (!swipeableRefs.current.has(matchId)) {
      swipeableRefs.current.set(matchId, createRef<SwipeableMethods | null>());
    }
    return swipeableRefs.current.get(matchId)!;
  }, []);

  const renderUpgradeCard = () => {
    if (isPremium || threads.length < 2 || upgradeBannerDismissed) return null;

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

            <View style={styles.upgradeCTA}>
              <Text style={styles.upgradeCTAText}>{t('messages.upgradeCard.upgradeCta')}</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="white" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </MotiView>
    );
  };

  // Free-plan match meter (ported from the old Matches tab).
  const renderMatchMeter = () => {
    const count = conversations.length;
    if (isPremium || count === 0 || showArchived) return null;
    const isFull = count >= FREE_MATCH_LIMIT;
    const isWarning = count >= FREE_MATCH_LIMIT - 2 && !isFull;
    const progressPct = Math.min((count / FREE_MATCH_LIMIT) * 100, 100);

    const accent = isFull ? '#C44569' : isWarning ? '#C49A4A' : '#A08AB7';
    const bg = isFull ? '#FBEEF1' : isWarning ? '#FBF6EA' : '#F3F0F7';
    const trackBg = isFull ? '#F3D9DF' : isWarning ? '#F1E5C8' : '#E2D8EC';

    const headline = t('matches.matchCountTitle', {
      current: count,
      limit: FREE_MATCH_LIMIT,
      defaultValue: `${count} of ${FREE_MATCH_LIMIT} active matches`,
    });
    const subtitle = isFull
      ? t('matches.matchCountSubtitleFull', { defaultValue: 'Unmatch someone or upgrade for unlimited' })
      : isWarning
      ? t('matches.matchCountSubtitleWarning', { defaultValue: 'Almost full — get unlimited matches' })
      : t('matches.matchCountSubtitleFree', { defaultValue: 'Free plan' });

    return (
      <Pressable
        onPress={() => router.push('/settings/subscription')}
        style={({ pressed }) => ({
          marginBottom: 12,
          padding: 14,
          backgroundColor: bg,
          borderRadius: 14,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
          <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: accent + '22', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
            <MaterialCommunityIcons
              name={isFull ? 'lock-outline' : 'heart-multiple-outline'}
              size={18}
              color={accent}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: '#1F2937' }}>
              {headline}
            </Text>
            <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
              {subtitle}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: accent, marginRight: 2 }}>
              {t('common.upgrade', { defaultValue: 'Upgrade' })}
            </Text>
            <MaterialCommunityIcons name="chevron-right" size={16} color={accent} />
          </View>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: trackBg, overflow: 'hidden' }}>
          <View style={{ width: `${progressPct}%`, height: '100%', backgroundColor: accent, borderRadius: 3 }} />
        </View>
      </Pressable>
    );
  };

  // Expiration warning for unmessaged matches (ported from the old Matches tab).
  const renderExpirationWarning = () => {
    let urgent = 0;
    let soon = 0;
    for (const conv of newMatches) {
      const info = getExpirationInfo(conv);
      if (!info || info.isExpired) continue;
      if (info.isUrgent) urgent++;
      else if (info.hoursLeft < 72) soon++;
    }
    if (urgent === 0 && soon === 0) return null;

    const isUrgent = urgent > 0;
    const count = urgent > 0 ? urgent : soon;
    const timeframe = urgent > 0 ? '24 hours' : '3 days';

    return (
      <View style={[styles.warningBanner, isUrgent && styles.warningUrgent]}>
        <MaterialCommunityIcons
          name="alert-circle"
          size={20}
          color={isUrgent ? '#EF4444' : '#F59E0B'}
        />
        <Text style={[styles.warningText, isUrgent && styles.warningTextUrgent]}>
          {t('matches.expirationWarning', {
            count,
            timeframe,
            defaultValue: `${count} ${count === 1 ? 'match expires' : 'matches expire'} in ${timeframe}. Send a message to keep the connection!`,
          })}
        </Text>
      </View>
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
      {renderMatchMeter()}
      {!showArchived && renderExpirationWarning()}
      {newMatches.length > 0 && (
        <View style={styles.newMatchesSection}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            {t('matches.newMatchesSection', { defaultValue: 'New matches' })}
          </Text>
          <FlatList
            data={newMatches}
            keyExtractor={(item) => item.match_id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 12, paddingRight: 8 }}
            renderItem={({ item }) => (
              <NewMatchAvatar
                conv={item}
                isAdmin={isAdmin}
                colors={colors}
                onPress={handleNewMatchPress}
                onLongPress={handleConversationLongPress}
                t={t}
              />
            )}
          />
        </View>
      )}
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
      {newMatches.length > 0 && threads.length > 0 && (
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 4 }]}>
          {t('matches.messagesSection', { defaultValue: 'Messages' })}
        </Text>
      )}
      {!showArchived && newMatches.length > 0 && threads.length === 0 && (
        <View style={[styles.sayHiHint, { backgroundColor: colors.card }]}>
          <MaterialCommunityIcons name="chat-outline" size={20} color="#A08AB7" />
          <Text style={[styles.sayHiHintText, { color: colors.mutedForeground }]}>
            {t('matches.sayHiHint', { defaultValue: 'Tap a new match to view their profile and say hi — matches expire after 7 days without a message.' })}
          </Text>
        </View>
      )}
    </>
  ), [showArchived, archivedCount, colors, t, isPremium, newMatches, threads.length, conversations.length, isAdmin, upgradeBannerDismissed]);

  const activityBell = (
    <TouchableOpacity
      onPress={handleActivityPress}
      style={[styles.activityButton, { backgroundColor: isPremium ? '#F5F0FF' : colors.muted }]}
    >
      <View style={{ position: 'relative' }}>
        <MaterialCommunityIcons name="bell-ring-outline" size={22} color="#A08AB7" />
        {unreadActivityCount > 0 && (
          <View style={styles.activityBadge}>
            <Text style={styles.activityBadgeText}>
              {unreadActivityCount > 9 ? '9+' : unreadActivityCount}
            </Text>
          </View>
        )}
        {showActivityNewBadge && unreadActivityCount === 0 && (
          <View style={styles.newFeatureBadge}>
            <Text style={styles.newFeatureBadgeText}>NEW</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('matches.title')}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{t('matches.subtitle')}</Text>
          </View>
          {activityBell}
        </View>

        <MessagesListSkeleton />
      </View>
    );
  }

  // Empty state: no matches at all
  if (conversations.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
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
            <>
              <View>
                <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('matches.title')}</Text>
                <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{t('matches.subtitle')}</Text>
              </View>
              {activityBell}
            </>
          )}
        </View>

        <View style={styles.emptyContainer}>
          <MotiView
            from={{ opacity: 0, translateY: 8 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400, delay: 120 }}
            style={styles.emptyContent}
          >
            {showArchived ? (
              <>
                <View style={[styles.emptyIconWell, { backgroundColor: colors.muted }]}>
                  <MaterialCommunityIcons name="archive-outline" size={28} color={colors.mutedForeground} />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t('messages.noArchivedMessages')}</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {t('messages.noArchivedMessagesText')}
                </Text>
                <TouchableOpacity
                  style={[styles.emptyPrimaryButton, { backgroundColor: colors.muted }]}
                  onPress={() => {
                    setShowArchived(false);
                    setConversations([]);
                    setLoading(true);
                  }}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.emptyPrimaryButtonText, { color: colors.foreground }]}>{t('messages.backToMessages')}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={[styles.emptyIconWell, { backgroundColor: colors.secondary }]}>
                  <MaterialCommunityIcons name="heart-multiple-outline" size={28} color="#A08AB7" />
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t('matches.noMatchesYet')}</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {t('matches.noMatchesText')}
                </Text>
                <TouchableOpacity
                  style={styles.emptyPrimaryButton}
                  onPress={() => router.push('/(tabs)/discover')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.emptyPrimaryButtonText}>{t('matches.startSwiping')}</Text>
                </TouchableOpacity>
              </>
            )}
          </MotiView>

          {!showArchived && (
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 600, delay: 380 }}
              style={styles.emptyPreviewWrap}
              pointerEvents="none"
            >
              <Text style={[styles.emptyPreviewLabel, { color: colors.mutedForeground }]}>
                {t('messages.emptyPreviewLabel')}
              </Text>
              <View style={[styles.previewThread, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.previewThreadHeader}>
                  <View style={styles.previewAvatarWrap}>
                    <Image
                      source={require('@/assets/images/mock-conversation-avatar.jpg')}
                      style={styles.previewAvatar}
                    />
                    <View style={[styles.previewAvatarActiveDot, { borderColor: colors.card }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.previewName, { color: colors.foreground }]} numberOfLines={1}>
                      {t('messages.emptyPreviewName')}
                    </Text>
                    <Text style={[styles.previewMatch, { color: colors.mutedForeground }]} numberOfLines={1}>
                      {t('messages.emptyPreviewMatch')}
                    </Text>
                  </View>
                </View>

                <View style={styles.previewBubbles}>
                  <View style={[styles.previewBubbleTheirs, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.previewBubbleText, { color: colors.foreground }]}>
                      {t('messages.emptyPreviewBubble1')}
                    </Text>
                  </View>
                  <LinearGradient
                    colors={['#A08AB7', '#CDC2E5']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.previewBubbleMine}
                  >
                    <Text style={[styles.previewBubbleText, { color: '#1F1B2E' }]}>
                      {t('messages.emptyPreviewBubble2')}
                    </Text>
                  </LinearGradient>
                  <View style={[styles.previewBubbleTheirs, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.previewBubbleText, { color: colors.foreground }]}>
                      {t('messages.emptyPreviewBubble3')}
                    </Text>
                  </View>
                </View>
              </View>
            </MotiView>
          )}
        </View>
      </View>
    );
  }

  // Combined list
  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingRight: rightSafeArea }]}>
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
          <>
            <View>
              <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('matches.title')}</Text>
              <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
                {conversations.length === 1
                  ? t('matches.headerCountOne', { count: conversations.length, defaultValue: '{{count}} match' })
                  : t('matches.headerCount', { count: conversations.length, defaultValue: '{{count}} matches' })
                }
              </Text>
            </View>
            {activityBell}
          </>
        )}
      </View>

      <FlatList
        data={threads}
        renderItem={renderConversation}
        keyExtractor={keyExtractor}
        extraData={[typingUsers, timeTick]}
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
            <View style={[styles.actionSheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.actionSheetTitle, { color: colors.foreground }]}>
                {selectedConversation?.profile.display_name}
              </Text>
              <Pressable onPress={() => setShowActionSheet(false)}>
                <MaterialCommunityIcons name="close" size={24} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <View style={styles.actionsList}>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleActionSelect('view_profile')}
              >
                <MaterialCommunityIcons name="account" size={24} color={colors.grey} />
                <Text style={[styles.actionText, { color: colors.foreground }]}>{t('messages.actions.viewProfile')}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.grey3} />
              </TouchableOpacity>

              {!!selectedConversation?.last_message && (
                <>
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

                  {selectedConversation.unread_count === 0 && (
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
                </>
              )}

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
                onPress={() => handleActionSelect('unmatch')}
              >
                <MaterialCommunityIcons name="heart-off-outline" size={24} color={colors.destructive} />
                <Text style={[styles.actionText, { color: colors.destructive }]}>{t('matches.actions.unmatch')}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.destructive} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionItem, styles.actionItemDanger]}
                onPress={() => handleActionSelect('block')}
              >
                <MaterialCommunityIcons name="block-helper" size={24} color={colors.destructive} />
                <Text style={[styles.actionText, { color: colors.destructive }]}>{t('messages.actions.block')}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.destructive} />
              </TouchableOpacity>

              {!!selectedConversation?.last_message && (
                <TouchableOpacity
                  style={[styles.actionItem, styles.actionItemDanger]}
                  onPress={() => handleActionSelect('delete')}
                >
                  <MaterialCommunityIcons name="delete" size={24} color={colors.destructive} />
                  <Text style={[styles.actionText, { color: colors.destructive }]}>{t('messages.actions.deleteConversation')}</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.destructive} />
                </TouchableOpacity>
              )}
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
  activityButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  activityBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  newFeatureBadge: {
    position: 'absolute',
    top: -8,
    right: -14,
    backgroundColor: '#8B5CF6',
    borderRadius: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  newFeatureBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '800',
  },
  newMatchesSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  newMatchItem: {
    width: 84,
    alignItems: 'center',
  },
  newMatchPhotoRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: '#A08AB7',
    padding: 2,
    overflow: 'hidden',
  },
  newMatchPhotoRingUrgent: {
    borderColor: '#EF4444',
  },
  newMatchPhoto: {
    width: '100%',
    height: '100%',
    borderRadius: 34,
    backgroundColor: '#E9E2F5',
  },
  newMatchOnlineDot: {
    position: 'absolute',
    bottom: 2,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
  },
  newMatchExpiryBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#F59E0B',
    borderRadius: 999,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  newMatchExpiryBadgeUrgent: {
    backgroundColor: '#EF4444',
  },
  newMatchExpiryText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '800',
  },
  newMatchName: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
    maxWidth: 84,
  },
  newMatchHint: {
    fontSize: 11,
    marginTop: 1,
    maxWidth: 84,
  },
  sayHiHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  sayHiHintText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FEF3C7',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  warningUrgent: {
    backgroundColor: '#FEE2E2',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#92400E',
    lineHeight: 18,
  },
  warningTextUrgent: {
    color: '#B91C1C',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 48,
  },
  emptyContent: {
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  emptyIconWell: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyPrimaryButton: {
    backgroundColor: '#A08AB7',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 999,
    alignSelf: 'center',
  },
  emptyPrimaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  emptyPreviewWrap: {
    alignSelf: 'stretch',
    marginTop: 40,
    gap: 10,
  },
  emptyPreviewLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 6,
  },
  previewThread: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  previewThreadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.2)',
  },
  previewAvatarWrap: {
    position: 'relative',
    width: 40,
    height: 40,
  },
  previewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#E9E2F5',
  },
  previewAvatarActiveDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
  },
  previewName: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewMatch: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
  },
  previewBubbles: {
    gap: 6,
  },
  previewBubbleTheirs: {
    alignSelf: 'flex-start',
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
  },
  previewBubbleMine: {
    alignSelf: 'flex-end',
    maxWidth: '80%',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderBottomRightRadius: 6,
  },
  previewBubbleText: {
    fontSize: 13,
    lineHeight: 18,
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
});
