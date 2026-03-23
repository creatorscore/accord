import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, ActivityIndicator, StyleSheet, Modal, Alert, Pressable, InteractionManager, useWindowDimensions, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeBlurView } from '@/components/shared/SafeBlurView';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useColorScheme } from '@/lib/useColorScheme';
import { supabase } from '@/lib/supabase';
import { useScreenProtection } from '@/hooks/useScreenProtection';
import { isOnline, getLastActiveText } from '@/lib/online-status';
import { realtimeManager } from '@/lib/realtime-manager';
import { decryptMessage, getPrivateKey } from '@/lib/encryption';
import { usePhotoBlur } from '@/hooks/usePhotoBlur';
import { SafeBlurImage } from '@/components/shared/SafeBlurImage';
import { useUnreadActivityCount } from '@/hooks/useActivityFeed';
import { signPhotoUrls } from '@/lib/signed-urls';
import { MatchesListSkeleton } from '@/components/shared/SkeletonScreens';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useToast } from '@/contexts/ToastContext';

interface Match {
  id: string;
  profile: {
    id: string;
    display_name: string;
    age: number;
    photos?: { url: string; is_primary: boolean; blur_data_uri?: string | null; storage_path?: string | null }[];
    is_verified?: boolean;
    photo_verified?: boolean;
    last_active_at?: string | null;
    hide_last_active?: boolean;
    photo_blur_enabled?: boolean;
    is_revealed?: boolean;
    encryption_public_key?: string;
  };
  compatibility_score?: number;
  matched_at: string;
  expires_at?: string | null;
  first_message_sent_at?: string | null;
  last_message?: {
    encrypted_content: string;
    created_at: string;
    sender_profile_id: string;
    read_at: string | null;
  };
  unread_count?: number;
  decrypted_preview?: string;
}

// Utility functions extracted outside component to avoid re-creation
function getTimeAgoStatic(dateString: string, t: any) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return t('matches.timeAgo.justNow');
  if (seconds < 3600) return t('matches.timeAgo.minutesAgo', { count: Math.floor(seconds / 60) });
  if (seconds < 86400) return t('matches.timeAgo.hoursAgo', { count: Math.floor(seconds / 3600) });
  if (seconds < 604800) return t('matches.timeAgo.daysAgo', { count: Math.floor(seconds / 86400) });
  return t('matches.timeAgo.weeksAgo', { count: Math.floor(seconds / 604800) });
}

function getExpirationInfoStatic(match: Match): { text: string; isUrgent: boolean; isExpired: boolean } | null {
  if (match.first_message_sent_at) return null;
  if (!match.expires_at) return null;

  const now = new Date();
  const expiresAt = new Date(match.expires_at);
  const timeLeft = expiresAt.getTime() - now.getTime();

  if (timeLeft <= 0) {
    return { text: 'Expired', isUrgent: true, isExpired: true };
  }

  const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
  const daysLeft = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const isUrgent = hoursLeft < 24;

  if (daysLeft >= 1) {
    return { text: `Expires in ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'}`, isUrgent, isExpired: false };
  } else if (hoursLeft >= 1) {
    return { text: `Expires in ${hoursLeft} ${hoursLeft === 1 ? 'hour' : 'hours'}`, isUrgent, isExpired: false };
  } else {
    const minutesLeft = Math.floor(timeLeft / (1000 * 60));
    return { text: `Expires in ${Math.max(1, minutesLeft)} ${minutesLeft === 1 ? 'minute' : 'minutes'}`, isUrgent: true, isExpired: false };
  }
}

// Extracted & memoized MatchCard - prevents re-creation on parent re-render
interface MatchCardProps {
  item: Match;
  currentProfileId: string | null;
  colors: any;
  onPress: (match: Match) => void;
  onLongPress: (match: Match) => void;
  t: any;
  isAdmin?: boolean;
}

const MatchCard = memo(function MatchCard({ item, currentProfileId, colors, onPress, onLongPress, t, isAdmin = false }: MatchCardProps) {
  const primaryPhoto = item.profile.photos?.find(p => p.is_primary) || item.profile.photos?.[0];
  const hasUnread = (item.unread_count || 0) > 0;
  const userIsOnline = isOnline(item.profile.last_active_at || null);
  const showOnlineStatus = userIsOnline && !item.profile.hide_last_active;
  const lastActiveText = getLastActiveText(item.profile.last_active_at || null, item.profile.hide_last_active);
  const expirationInfo = getExpirationInfoStatic(item);

  const { imageUri, blurRadius, onImageLoad, onImageError } = usePhotoBlur({
    shouldBlur: (item.profile.photo_blur_enabled || false) && !item.profile.is_revealed && !isAdmin,
    photoUrl: primaryPhoto?.url || 'https://via.placeholder.com/80',
    blurDataUri: primaryPhoto?.blur_data_uri,
    blurIntensity: 30,
  });

  return (
    <TouchableOpacity
      style={[styles.matchCard, { backgroundColor: colors.card }]}
      onPress={() => onPress(item)}
      onLongPress={() => onLongPress(item)}
      activeOpacity={0.7}
    >
      {/* Profile Photo */}
      <View style={styles.photoContainer}>
        <SafeBlurImage
          source={{ uri: imageUri }}
          style={styles.photo}
          blurRadius={blurRadius}
          onLoad={onImageLoad}
          onError={onImageError}
        />
        {(item.profile.is_verified || item.profile.photo_verified) && (
          <View style={[styles.verifiedBadge, { backgroundColor: colors.card }]}>
            <MaterialCommunityIcons name="check-decagram" size={18} color="#A08AB7" />
          </View>
        )}
        {hasUnread && <View style={styles.unreadDot} />}
        {showOnlineStatus && <View style={styles.onlineDot} />}
      </View>

      {/* Match Info */}
      <View style={styles.matchInfo}>
        <View style={styles.matchHeader}>
          <Text style={[styles.matchName, { color: colors.foreground }]} numberOfLines={1}>
            {item.profile.display_name}, {item.profile.age}
          </Text>
          {item.last_message && (
            <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>{getTimeAgoStatic(item.last_message.created_at, t)}</Text>
          )}
        </View>

        {typeof item.compatibility_score === 'number' && item.compatibility_score > 0 && (
          <View style={styles.compatibilityRow}>
            <LinearGradient
              colors={['#A08AB7', '#CDC2E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.compatibilityBadge}
            ><MaterialCommunityIcons name="heart" size={12} color="white" /><Text style={styles.compatibilityText}>{t('matches.matchPercentage', { score: item.compatibility_score })}</Text></LinearGradient>
          </View>
        )}

        {expirationInfo && (
          <View style={[styles.expirationBadge, expirationInfo.isUrgent && styles.expirationUrgent]}>
            <MaterialCommunityIcons
              name={expirationInfo.isExpired ? "timer-off" : "timer-sand"}
              size={12}
              color={expirationInfo.isUrgent ? "#EF4444" : "#F59E0B"}
            />
            <Text style={[styles.expirationText, expirationInfo.isUrgent && styles.expirationTextUrgent]}>
              {expirationInfo.text}
            </Text>
          </View>
        )}

        {lastActiveText && !expirationInfo && (
          <Text style={styles.onlineStatusText}>{lastActiveText}</Text>
        )}

        {item.last_message ? (
          <Text
            style={[styles.lastMessage, { color: colors.mutedForeground }, hasUnread && { color: colors.foreground, fontWeight: '600' }]}
            numberOfLines={1}
          >
            {item.last_message.sender_profile_id === currentProfileId ? t('matches.youLabel') : ''}
            {item.decrypted_preview || item.last_message.encrypted_content}
          </Text>
        ) : (
          <View style={styles.ctaRow}>
            <MaterialCommunityIcons name="message-outline" size={14} color="#A08AB7" />
            <Text style={styles.ctaText}>{t('matches.sayHi')}</Text>
          </View>
        )}
      </View>

      <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
    </TouchableOpacity>
  );
});

export default function Matches() {
  // Protect match list from screenshots
  useScreenProtection();

  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const { colors, isDarkColorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const rightSafeArea = isLandscape ? Math.max(insets.right, Platform.OS === 'android' ? 48 : 0) : 0;
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const currentProfileIdRef = useRef<string | null>(null);
  const unreadActivityCount = useUnreadActivityCount(currentProfileId);
  const [matches, setMatches] = useState<Match[]>([]);
  const [likesCount, setLikesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [actionSheetMatch, setActionSheetMatch] = useState<Match | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myEncryptionPublicKey, setMyEncryptionPublicKey] = useState<string | null>(null);
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

  useEffect(() => {
    let cancelled = false;

    const initialize = async () => {
      try {
        // Phase 1: Profile query + bans query in parallel (bans don't need profileId)
        const [profileResult, bansResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('id, is_admin, encryption_public_key')
            .eq('user_id', user?.id)
            .single(),
          supabase
            .from('bans')
            .select('banned_profile_id')
            .not('banned_profile_id', 'is', null)
            .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString()),
        ]);

        if (cancelled) return;
        if (profileResult.error) throw profileResult.error;

        const myProfileId = profileResult.data.id;
        currentProfileIdRef.current = myProfileId;
        setCurrentProfileId(myProfileId);
        setIsAdmin(profileResult.data.is_admin || false);
        setMyEncryptionPublicKey(profileResult.data.encryption_public_key || null);

        // Fire likes count non-blocking (doesn't need to finish before matches load)
        loadLikesCount();

        // Phase 2: Load matches with pre-fetched bans data
        await loadMatchesWithId(myProfileId, bansResult.data);

        if (cancelled) return;

        // Set up subscriptions after data is loaded
        const unsubscribe = subscribeToMatches();
        cleanupRef.current = unsubscribe || null;
      } catch (error: any) {
        console.error('Error initializing matches:', error);
        setLoading(false);
      }
    };

    const cleanupRef = { current: null as (() => void) | null };
    initialize();

    return () => {
      cancelled = true;
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  // Decrypt message previews for all matches
  // Accepts an optional pre-fetched privateKey to avoid re-fetching from keychain
  const decryptMessagePreviews = async (matchesList: Match[], prefetchedPrivateKey?: string | null): Promise<Match[]> => {
    if (!user?.id) return matchesList;

    try {
      // Use pre-fetched key if available, otherwise fetch from keychain
      const myPrivateKey = prefetchedPrivateKey ?? await getPrivateKey(user.id);
      if (!myPrivateKey) {
        return matchesList;
      }

      const profileId = currentProfileIdRef.current || currentProfileId;

      // Decrypt each message preview
      const decryptedMatches = await Promise.all(
        matchesList.map(async (match) => {
          if (!match.last_message?.encrypted_content) {
            return match;
          }

          try {
            // For ECDH: we need the OTHER person's public key
            // If I sent it, I need their public key (match.profile.encryption_public_key)
            // If they sent it, I also need their public key
            const otherPublicKey = match.profile.encryption_public_key;

            if (!otherPublicKey) {
              return { ...match, decrypted_preview: match.last_message.encrypted_content };
            }

            const decrypted = await decryptMessage(
              match.last_message.encrypted_content,
              myPrivateKey,
              otherPublicKey
            );

            return { ...match, decrypted_preview: decrypted };
          } catch (error) {
            console.error('Error decrypting preview for match:', match.id, error);
            // Return encrypted content as fallback
            return { ...match, decrypted_preview: match.last_message.encrypted_content };
          }
        })
      );

      return decryptedMatches;
    } catch (error) {
      console.error('Error in decryptMessagePreviews:', error);
      return matchesList;
    }
  };

  // Core match loading logic - accepts profileId directly to avoid waterfall
  // Pre-fetched bans data can be passed from initialization to avoid duplicate query
  const loadMatchesWithId = async (profileId: string, prefetchedBans?: any[] | null) => {
    try {
      // Phase 1: Matches + blocks in parallel (bans already fetched if from init)
      const phase1Queries: PromiseLike<any>[] = [
        // Get all matches for current user (limit to most recent 50 for performance)
        supabase
          .from('matches')
          .select(`
            id,
            profile1_id,
            profile2_id,
            compatibility_score,
            matched_at,
            status,
            expires_at,
            first_message_sent_at
          `)
          .or(`profile1_id.eq.${profileId},profile2_id.eq.${profileId}`)
          .eq('status', 'active')
          .order('matched_at', { ascending: false })
          .limit(50),
        // SAFETY: Filter out blocked users (bidirectional)
        supabase
          .from('blocks')
          .select('blocked_profile_id')
          .eq('blocker_profile_id', profileId),
        supabase
          .from('blocks')
          .select('blocker_profile_id')
          .eq('blocked_profile_id', profileId),
      ];

      // Only query bans if not pre-fetched
      if (!prefetchedBans) {
        phase1Queries.push(
          supabase
            .from('bans')
            .select('banned_profile_id')
            .not('banned_profile_id', 'is', null)
            .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        );
      }

      const phase1Results = await Promise.all(phase1Queries);

      const { data: matchesData, error: matchesError } = phase1Results[0];
      const { data: blockedByMe } = phase1Results[1];
      const { data: blockedMe } = phase1Results[2];
      const bannedUsers = prefetchedBans ?? phase1Results[3]?.data;

      if (matchesError) throw matchesError;

      const blockedProfileIds = new Set([
        ...(blockedByMe?.map((b: any) => b.blocked_profile_id) || []),
        ...(blockedMe?.map((b: any) => b.blocker_profile_id) || [])
      ]);

      const bannedProfileIds = new Set(
        bannedUsers?.map((b: any) => b.banned_profile_id).filter(Boolean) || []
      );

      // Filter out matches with blocked OR banned users
      const filteredMatches = (matchesData || []).filter((match: any) => {
        const otherProfileId = match.profile1_id === profileId
          ? match.profile2_id
          : match.profile1_id;
        return !blockedProfileIds.has(otherProfileId) && !bannedProfileIds.has(otherProfileId);
      });

      // PERFORMANCE OPTIMIZATION: Batch all queries to prevent ANR on low-end devices
      // Get all other profile IDs and match IDs
      const otherProfileIds = filteredMatches.map((match: any) =>
        match.profile1_id === profileId ? match.profile2_id : match.profile1_id
      );
      const matchIds = filteredMatches.map((match: any) => match.id);

      if (matchIds.length === 0) {
        setMatches([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Phase 2: Batch fetch ALL data in parallel (profiles, messages, unread, reveals + private key)
      const [profilesResult, messagesResult, unreadCountsResult, revealsResult, myPrivateKey] = await Promise.all([
        // Get all profiles at once
        supabase
          .from('profiles')
          .select(`
            id,
            display_name,
            age,
            is_verified,
            photo_verified,
            last_active_at,
            hide_last_active,
            photo_blur_enabled,
            encryption_public_key,
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
        // instead of fetching ALL messages across all matches
        supabase.rpc('get_last_messages', { p_match_ids: matchIds }),
        supabase.rpc('get_unread_counts', { p_match_ids: matchIds, p_profile_id: profileId }),
        // Get photo reveals for all profiles at once
        supabase
          .from('photo_reveals')
          .select('revealer_profile_id')
          .in('revealer_profile_id', otherProfileIds)
          .eq('revealed_to_profile_id', profileId),
        // Pre-fetch private key for decryption (runs in parallel with DB queries)
        user?.id ? getPrivateKey(user.id) : Promise.resolve(null),
      ]);

      // Create lookup maps for O(1) access
      const profilesMap = new Map(
        (profilesResult.data || []).map((p: any) => [p.id, p])
      );

      // RPC returns one row per match (DISTINCT ON), so direct map
      const lastMessagesMap = new Map<string, any>(
        (messagesResult.data || []).map((msg: any) => [msg.match_id, msg])
      );

      // RPC returns grouped counts, so direct map
      const unreadCountsMap = new Map<string, number>(
        (unreadCountsResult.data || []).map((row: any) => [row.match_id, Number(row.unread_count)])
      );

      // Create set of revealed profile IDs
      const revealedProfileIds = new Set(
        revealsResult.data?.map((r: any) => r.revealer_profile_id) || []
      );

      // Build matches array using lookup maps
      const validMatches = filteredMatches.map((match: any) => {
        const otherProfileId = match.profile1_id === profileId
          ? match.profile2_id
          : match.profile1_id;

        const profile = profilesMap.get(otherProfileId);
        if (!profile) return null;

        const lastMessage = lastMessagesMap.get(match.id);
        const unreadCount = unreadCountsMap.get(match.id) || 0;
        const isRevealed = revealedProfileIds.has(otherProfileId);

        return {
          id: match.id,
          profile: {
            id: profile.id,
            display_name: profile.display_name,
            age: profile.age,
            is_verified: profile.is_verified,
            photo_verified: profile.photo_verified,
            last_active_at: profile.last_active_at,
            hide_last_active: profile.hide_last_active,
            photo_blur_enabled: profile.photo_blur_enabled,
            encryption_public_key: profile.encryption_public_key,
            photos: profile?.photos?.sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0)),
            is_revealed: isRevealed,
          },
          compatibility_score: match.compatibility_score,
          matched_at: match.matched_at,
          expires_at: match.expires_at,
          first_message_sent_at: match.first_message_sent_at,
          last_message: lastMessage || undefined,
          unread_count: unreadCount,
        };
      }).filter((m: any) => m !== null) as Match[];

      // Filter out expired matches
      const now = new Date();
      const activeMatches = validMatches.filter(match => {
        // Keep matches that have no expiration set (old matches before feature)
        if (!match.expires_at) return true;

        // Keep matches where first message was sent (no longer expires)
        if (match.first_message_sent_at) return true;

        // Filter out expired matches
        const expiresAt = new Date(match.expires_at);
        return expiresAt > now;
      });

      // Sign photo URLs for private storage buckets
      const allPhotosToSign: { storage_path?: string | null; url?: string | null }[] = [];
      const photoOffsets: number[] = [];
      for (const match of activeMatches) {
        photoOffsets.push(allPhotosToSign.length);
        if (match.profile.photos?.length) {
          allPhotosToSign.push(...match.profile.photos);
        }
      }
      if (allPhotosToSign.length > 0) {
        const signedPhotos = await signPhotoUrls(allPhotosToSign);
        for (let i = 0; i < activeMatches.length; i++) {
          const start = photoOffsets[i];
          const count = activeMatches[i].profile.photos?.length || 0;
          if (count > 0) {
            activeMatches[i] = {
              ...activeMatches[i],
              profile: {
                ...activeMatches[i].profile,
                photos: signedPhotos.slice(start, start + count) as any,
              },
            };
          }
        }
      }

      // Show matches immediately without decryption for faster UI
      setMatches(activeMatches);
      setLoading(false);
      setRefreshing(false);

      // PERFORMANCE: Defer decryption until after UI is responsive
      // This prevents ANR on low-end devices by not blocking main thread
      InteractionManager.runAfterInteractions(async () => {
        try {
          const matchesWithDecryptedPreviews = await decryptMessagePreviews(activeMatches, myPrivateKey);
          setMatches(matchesWithDecryptedPreviews);
        } catch (error) {
          console.error('Error decrypting message previews:', error);
          // Keep showing matches even if decryption fails
        }
      });
    } catch (error: any) {
      console.error('Error loading matches:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Standalone loadMatches for refresh/subscription callbacks - reads profileId from ref/state
  const loadMatches = async () => {
    const profileId = currentProfileIdRef.current || currentProfileId;
    if (!profileId) return;
    await loadMatchesWithId(profileId);
  };

  const loadLikesCount = async () => {
    try {
      const profileId = currentProfileIdRef.current || currentProfileId;
      if (!profileId) return;

      // Use server-side RPC that counts unmatched likes (excludes matched, passed, blocked, banned)
      // This is also secure: free users get the count without seeing WHO liked them
      const { data: count, error } = await supabase.rpc('count_unmatched_received_likes');

      if (error) throw error;
      setLikesCount(count || 0);
    } catch (error: any) {
      console.error('Error loading likes count:', error);
    }
  };

  const subscribeToMatches = () => {
    const profileId = currentProfileIdRef.current || currentProfileId;
    if (!profileId) return;

    // Subscribe to new matches (with realtime manager for cost protection)
    const matchesChannel = supabase
      .channel('matches-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `profile1_id=eq.${profileId}`,
        },
        () => {
          loadMatches();
          loadLikesCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `profile2_id=eq.${profileId}`,
        },
        () => {
          loadMatches();
          loadLikesCount();
        }
      )
      .subscribe();

    // Subscribe to new messages (for last message updates) — scoped to this user
    const messagesChannel = supabase
      .channel(`messages-changes-${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_profile_id=eq.${profileId}`,
        },
        () => {
          loadMatches();
        }
      )
      .subscribe();

    // Subscribe to new likes
    const likesChannel = supabase
      .channel('likes-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'likes',
          filter: `liked_profile_id=eq.${profileId}`,
        },
        () => {
          loadLikesCount();
        }
      )
      .subscribe();

    // Register channels with realtime manager for cost protection
    realtimeManager.registerChannel(profileId, matchesChannel);
    realtimeManager.registerChannel(profileId, messagesChannel);
    realtimeManager.registerChannel(profileId, likesChannel);

    return () => {
      // Unregister and cleanup
      realtimeManager.unregisterChannel(profileId, matchesChannel);
      realtimeManager.unregisterChannel(profileId, messagesChannel);
      realtimeManager.unregisterChannel(profileId, likesChannel);

      matchesChannel.unsubscribe();
      messagesChannel.unsubscribe();
      likesChannel.unsubscribe();
    };
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadMatches();
    loadLikesCount();
  }, [currentProfileId]);

  const handleLikesPress = () => {
    router.push('/likes');
  };

  const handleUnmatch = (match: Match) => {
    Alert.alert(
      t('matches.unmatchDialog.title'),
      t('matches.unmatchDialog.message', { name: match.profile.display_name }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('matches.unmatchDialog.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              // Get current profile ID to track who unmatched
              const { data: currentProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', user?.id)
                .single();

              if (!currentProfile) {
                throw new Error('Could not find your profile');
              }

              // Update match status to unmatched
              const { error } = await supabase
                .from('matches')
                .update({
                  status: 'unmatched',
                  unmatch_reason: 'User unmatched',
                  unmatched_by: currentProfile.id,
                  unmatched_at: new Date().toISOString(),
                })
                .eq('id', match.id);

              if (error) throw error;

              // Remove from local state immediately
              setMatches((prev) => prev.filter((m) => m.id !== match.id));

              // Show success message
              showToast({ type: 'success', title: t('matches.unmatchDialog.success'), message: t('matches.unmatchDialog.successMessage', { name: match.profile.display_name }) });
            } catch (error: any) {
              console.error('Error unmatching:', error);
              showToast({ type: 'error', title: t('common.error'), message: t('matches.unmatchDialog.error') });
            }
          },
        },
      ]
    );
  };

  const handleBlock = (match: Match) => {
    Alert.alert(
      t('matches.blockDialog.title'),
      t('matches.blockDialog.message', { name: match.profile.display_name }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('matches.blockDialog.confirm'),
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
                  blocked_profile_id: match.profile.id,
                  reason: 'Blocked from matches',
                });

              if (blockError) throw blockError;

              // Update match status to blocked
              const { error: matchError } = await supabase
                .from('matches')
                .update({ status: 'blocked' })
                .eq('id', match.id);

              if (matchError) throw matchError;

              // Remove from local state
              setMatches((prev) => prev.filter((m) => m.id !== match.id));

              showToast({ type: 'success', title: t('matches.blockDialog.success'), message: t('matches.blockDialog.successMessage', { name: match.profile.display_name }) });
            } catch (error: any) {
              console.error('Error blocking user:', error);
              showToast({ type: 'error', title: t('common.error'), message: t('matches.blockDialog.error') });
            }
          },
        },
      ]
    );
  };

  const handleReport = (match: Match) => {
    Alert.prompt(
      t('matches.reportDialog.title'),
      t('matches.reportDialog.message', { name: match.profile.display_name }),
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('matches.reportDialog.submit'),
          onPress: async (reason?: string) => {
            if (!reason || reason.trim() === '') {
              showToast({ type: 'error', title: t('common.error'), message: t('matches.reportDialog.errorEmpty') });
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
                  reported_profile_id: match.profile.id,
                  reason: reason.trim(),
                  status: 'pending',
                });

              if (error) throw error;

              showToast({ type: 'success', title: t('matches.reportDialog.success'), message: t('matches.reportDialog.successMessage') });
            } catch (error: any) {
              console.error('Error reporting user:', error);
              showToast({ type: 'error', title: t('common.error'), message: t('matches.reportDialog.error') });
            }
          },
        },
      ],
      'plain-text'
    );
  };

  // Stable callback refs for MatchCard (defined before handleActionSelect which references them)
  const handleMatchPress = useCallback((match: Match) => {
    router.push(`/profile/${match.profile.id}`);
  }, []);

  const handleMatchLongPress = useCallback((match: Match) => {
    setActionSheetMatch(match);
    setShowActionSheet(true);
  }, []);

  const handleActionSelect = (action: string) => {
    if (!actionSheetMatch) return;

    setShowActionSheet(false);

    // Small delay to allow modal to close smoothly before action
    setTimeout(() => {
      switch (action) {
        case 'view_profile':
          handleMatchPress(actionSheetMatch);
          break;
        case 'send_message':
          router.push(`/chat/${actionSheetMatch.id}`);
          break;
        case 'report':
          handleReport(actionSheetMatch);
          break;
        case 'block':
          handleBlock(actionSheetMatch);
          break;
        case 'unmatch':
          handleUnmatch(actionSheetMatch);
          break;
      }
    }, 100);
  };

  const getExpiringMatchesCount = (): { urgent: number; soon: number } => {
    const now = new Date();
    const urgentThreshold = 24 * 60 * 60 * 1000; // 24 hours in ms
    const soonThreshold = 3 * 24 * 60 * 60 * 1000; // 3 days in ms

    let urgent = 0;
    let soon = 0;

    matches.forEach(match => {
      if (match.first_message_sent_at || !match.expires_at) return;

      const expiresAt = new Date(match.expires_at);
      const timeLeft = expiresAt.getTime() - now.getTime();

      if (timeLeft > 0 && timeLeft <= urgentThreshold) {
        urgent++;
      } else if (timeLeft > urgentThreshold && timeLeft <= soonThreshold) {
        soon++;
      }
    });

    return { urgent, soon };
  };

  const renderExpirationWarning = () => {
    const { urgent, soon } = getExpiringMatchesCount();

    if (urgent === 0 && soon === 0) return null;

    const isUrgent = urgent > 0;
    const count = urgent > 0 ? urgent : soon;
    const timeframe = urgent > 0 ? '24 hours' : '3 days';

    return (
      <MotiView
        from={{ opacity: 0, translateY: -20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'spring', delay: 50 }}
        style={styles.warningContainer}
      >
        <View style={[styles.warningBanner, isUrgent && styles.warningUrgent]}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={20}
            color={isUrgent ? "#EF4444" : "#F59E0B"}
          />
          <Text style={[styles.warningText, isUrgent && styles.warningTextUrgent]}>
            {count} {count === 1 ? 'match expires' : 'matches expire'} in {timeframe}. Send a message to keep the connection!
          </Text>
        </View>
      </MotiView>
    );
  };

  const renderLikesCard = () => {
    if (likesCount === 0 && isPremium) return null; // Don't show if premium user has no likes

    return (
      <MotiView
        from={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', delay: 100 }}
        style={styles.likesCardContainer}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handleLikesPress}
        >
          <LinearGradient
            colors={['#A08AB7', '#CDC2E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.likesCard}
          >
            {/* Icon */}
            <View style={styles.likesIconContainer}>
              <MaterialCommunityIcons name="eye" size={32} color="white" />
            </View>

            {/* Content */}
            <View style={styles.likesContent}>
              <Text style={styles.likesTitle}>{t('matches.seeWhoLikesYou')}</Text>
              {isPremium ? (
                <Text style={styles.likesSubtitle}>
                  {likesCount === 0
                    ? t('matches.noNewLikes')
                    : t('matches.likesCount', {
                        count: likesCount,
                        likes: likesCount === 1 ? t('matches.personHas') : t('matches.peopleHave')
                      })}
                </Text>
              ) : (
                <View style={styles.likesBlurContainer}>
                  <SafeBlurView intensity={20} tint="dark" style={styles.likesBlur}>
                    <MaterialCommunityIcons name="lock" size={16} color="white" />
                    <Text style={styles.likesBlurText}>
                      {likesCount > 0 ? t('matches.upgradeTo', { count: likesCount }) : t('matches.upgradeToSee')}
                    </Text>
                  </SafeBlurView>
                  <MaterialCommunityIcons name="crown" size={16} color="#FFD700" style={styles.premiumIcon} />
                </View>
              )}
            </View>

            {/* Arrow */}
            <MaterialCommunityIcons name="chevron-right" size={28} color="rgba(255,255,255,0.8)" />
          </LinearGradient>
        </TouchableOpacity>
      </MotiView>
    );
  };

  const FREE_MATCH_LIMIT = 10;

  const listHeader = useMemo(() => (
    <>
      {!isPremium && matches.length > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 10, marginHorizontal: 16, marginTop: 8, marginBottom: 4, backgroundColor: matches.length >= FREE_MATCH_LIMIT ? '#FEF2F2' : '#F5F0FF', borderRadius: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: matches.length >= FREE_MATCH_LIMIT ? '#DC2626' : '#7C3AED' }}>
              {t('matches.matchCount', { current: matches.length, limit: FREE_MATCH_LIMIT })}
            </Text>
          </View>
          {matches.length >= FREE_MATCH_LIMIT && (
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#DC2626" style={{ marginLeft: 8 }} />
          )}
        </View>
      )}
      {renderExpirationWarning()}
      {renderLikesCard()}
    </>
  ), [matches, likesCount, isPremium, t]);

  const matchKeyExtractor = useCallback((item: Match) => item.id, []);

  const renderMatch = useCallback(({ item }: { item: Match }) => {
    return (
      <MatchCard
        item={item}
        currentProfileId={currentProfileId}
        colors={colors}
        onPress={handleMatchPress}
        onLongPress={handleMatchLongPress}
        t={t}
        isAdmin={isAdmin}
      />
    );
  }, [currentProfileId, colors, handleMatchPress, handleMatchLongPress, t, isAdmin]);

  // Loading state
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('matches.title')}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{t('matches.subtitle')}</Text>
          </View>
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
        </View>

        <MatchesListSkeleton />
      </View>
    );
  }

  // Empty state
  if (matches.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <View>
            <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('matches.title')}</Text>
            <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>{t('matches.subtitle')}</Text>
          </View>
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
        </View>

        <View style={styles.emptyContainer}>
          <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: 200 }}
          >
            <View style={styles.emptyIconContainer}>
              <LinearGradient
                colors={['#A08AB7', '#CDC2E5']}
                style={styles.emptyIcon}
              >
                <MaterialCommunityIcons name="heart-outline" size={48} color="white" />
              </LinearGradient>
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t('matches.noMatchesYet')}</Text>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
              {t('matches.noMatchesText')}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/discover')}
            >
              <LinearGradient
                colors={['#A08AB7', '#CDC2E5']}
                style={styles.emptyButtonGradient}
              >
                <MaterialCommunityIcons name="cards-heart" size={20} color="white" />
                <Text style={styles.emptyButtonText}>{t('matches.startSwiping')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </MotiView>
        </View>
      </View>
    );
  }

  // Matches list
  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingRight: rightSafeArea }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('matches.title')}</Text>
          <Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>
            {matches.length === 1
              ? t('matches.connection', { count: matches.length })
              : t('matches.connections', { count: matches.length })}
          </Text>
        </View>
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
      </View>

      {/* Matches List */}
      <FlatList
        data={matches}
        renderItem={renderMatch}
        keyExtractor={matchKeyExtractor}
        ListHeaderComponent={listHeader}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#A08AB7"
            colors={['#A08AB7']}
          />
        }
        showsVerticalScrollIndicator={false}
        // ANR FIX: Optimize FlatList rendering performance
        initialNumToRender={8}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
        windowSize={10}
        removeClippedSubviews={true}
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
          <Pressable style={[styles.actionSheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 20) + 20 }]} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={[styles.actionSheetHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.actionSheetTitle, { color: colors.foreground }]}>
                {actionSheetMatch?.profile.display_name}
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
                <MaterialCommunityIcons name="account" size={24} color={colors.mutedForeground} />
                <Text style={[styles.actionText, { color: colors.foreground }]}>{t('matches.actions.viewProfile')}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.border} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleActionSelect('send_message')}
              >
                <MaterialCommunityIcons name="message-text" size={24} color={colors.mutedForeground} />
                <Text style={[styles.actionText, { color: colors.foreground }]}>{t('matches.actions.sendMessage')}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.border} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleActionSelect('report')}
              >
                <MaterialCommunityIcons name="flag" size={24} color={colors.mutedForeground} />
                <Text style={[styles.actionText, { color: colors.foreground }]}>{t('matches.actions.report')}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.border} />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionItem, styles.actionItemDanger]}
                onPress={() => handleActionSelect('block')}
              >
                <MaterialCommunityIcons name="block-helper" size={24} color="#EF4444" />
                <Text style={[styles.actionText, styles.actionTextDanger]}>{t('matches.actions.block')}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#EF4444" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionItem, styles.actionItemDanger]}
                onPress={() => handleActionSelect('unmatch')}
              >
                <MaterialCommunityIcons name="heart-broken" size={24} color="#EF4444" />
                <Text style={[styles.actionText, styles.actionTextDanger]}>{t('matches.actions.unmatch')}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#EF4444" />
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
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
    paddingBottom: 100, // Extra padding for tab bar in edge-to-edge mode
    gap: 12,
  },
  warningContainer: {
    marginBottom: 12,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#F59E0B',
  },
  warningUrgent: {
    backgroundColor: '#FEE2E2',
    borderLeftColor: '#EF4444',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
    lineHeight: 18,
  },
  warningTextUrgent: {
    color: '#991B1B',
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    gap: 16,
    // Use border instead of elevation on Android to avoid GPU overdraw during scroll
    ...(Platform.OS === 'android'
      ? { borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 }),
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E5E7EB',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 2,
    ...(Platform.OS === 'android'
      ? { borderWidth: 1, borderColor: 'rgba(0,0,0,0.1)' }
      : { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 }),
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
  onlineDot: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#fff',
  },
  matchInfo: {
    flex: 1,
    gap: 6,
  },
  matchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  matchName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  timestamp: {
    fontSize: 13,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  compatibilityRow: {
    flexDirection: 'row',
  },
  compatibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  compatibilityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  onlineStatusText: {
    fontSize: 12,
    color: '#10B981',
    fontWeight: '500',
  },
  expirationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#FEF3C7',
    alignSelf: 'flex-start',
  },
  expirationUrgent: {
    backgroundColor: '#FEE2E2',
  },
  expirationText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F59E0B',
  },
  expirationTextUrgent: {
    color: '#EF4444',
  },
  lastMessage: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  lastMessageUnread: {
    color: '#111827',
    fontWeight: '600',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ctaText: {
    fontSize: 14,
    color: '#A08AB7',
    fontWeight: '500',
  },
  likesCardContainer: {
    marginBottom: 16,
  },
  likesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  likesIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  likesContent: {
    flex: 1,
    gap: 6,
  },
  likesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  likesSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.95)',
  },
  likesBlurContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  likesBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  likesBlurText: {
    fontSize: 13,
    color: 'white',
    fontWeight: '600',
  },
  premiumIcon: {
    marginLeft: 4,
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
  newFeatureBadge: {
    position: 'absolute',
    top: -8,
    right: -14,
    backgroundColor: '#10B981',
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  newFeatureBadgeText: {
    color: 'white',
    fontSize: 8,
    fontWeight: '700',
  },
});
