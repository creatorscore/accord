import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, ActivityIndicator, StyleSheet, Modal, Alert, Pressable, InteractionManager } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
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
import { useUnreadActivityCount } from '@/hooks/useActivityFeed';
import { useSafeBlur } from '@/hooks/useSafeBlur';

interface Match {
  id: string;
  profile: {
    id: string;
    display_name: string;
    age: number;
    photos?: Array<{ url: string; is_primary: boolean }>;
    is_verified?: boolean;
    last_active_at?: string | null;
    hide_last_active?: boolean;
    photo_blur_enabled?: boolean;
    is_revealed?: boolean;
    encryption_public_key?: string;
  };
  compatibility_score?: number;
  matched_at: string;
  last_message?: {
    encrypted_content: string;
    created_at: string;
    sender_profile_id: string;
    read_at: string | null;
  };
  unread_count?: number;
  decrypted_preview?: string;
}

export default function Matches() {
  // Protect match list from screenshots
  useScreenProtection();

  const { t } = useTranslation();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const { colors, isDarkColorScheme } = useColorScheme();
  const insets = useSafeAreaInsets();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const unreadActivityCount = useUnreadActivityCount(currentProfileId);
  const [matches, setMatches] = useState<Match[]>([]);
  const [likesCount, setLikesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [actionSheetMatch, setActionSheetMatch] = useState<Match | null>(null);

  useEffect(() => {
    loadCurrentProfile();
  }, []);

  useEffect(() => {
    if (currentProfileId) {
      loadMatches();
      loadLikesCount();
      subscribeToMatches();
    }
  }, [currentProfileId]);

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

  // Decrypt message previews for all matches
  const decryptMessagePreviews = async (matchesList: Match[]): Promise<Match[]> => {
    if (!user?.id) return matchesList;

    try {
      // Get current user's private key
      const myPrivateKey = await getPrivateKey(user.id);
      if (!myPrivateKey) {
        console.log('No private key found, returning matches without decryption');
        return matchesList;
      }

      // Get current user's public key for messages they sent
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('encryption_public_key')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!myProfile) {
        console.log('No profile found for decryption, returning matches without decryption');
        return matchesList;
      }

      const myPublicKey = myProfile?.encryption_public_key;

      // Decrypt each message preview
      const decryptedMatches = await Promise.all(
        matchesList.map(async (match) => {
          if (!match.last_message?.encrypted_content) {
            return match;
          }

          try {
            // Determine if I sent this message or received it
            const iAmSender = match.last_message.sender_profile_id === currentProfileId;

            // For ECDH: we need the OTHER person's public key
            // If I sent it, I need their public key (match.profile.encryption_public_key)
            // If they sent it, I also need their public key
            const otherPublicKey = match.profile.encryption_public_key;

            if (!otherPublicKey) {
              console.log('No public key for match, showing encrypted content');
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

  const loadMatches = async () => {
    try {
      if (!currentProfileId) return;

      // PERFORMANCE: Limit initial matches to prevent ANR on low-end devices
      // Get all matches for current user (limit to most recent 50 for performance)
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select(`
          id,
          profile1_id,
          profile2_id,
          compatibility_score,
          matched_at,
          status
        `)
        .or(`profile1_id.eq.${currentProfileId},profile2_id.eq.${currentProfileId}`)
        .eq('status', 'active')
        .order('matched_at', { ascending: false })
        .limit(50);  // Limit to 50 most recent matches for performance

      if (matchesError) throw matchesError;

      // SAFETY: Filter out blocked users (bidirectional)
      const { data: blockedByMe } = await supabase
        .from('blocks')
        .select('blocked_profile_id')
        .eq('blocker_profile_id', currentProfileId);

      const { data: blockedMe } = await supabase
        .from('blocks')
        .select('blocker_profile_id')
        .eq('blocked_profile_id', currentProfileId);

      const blockedProfileIds = new Set([
        ...(blockedByMe?.map(b => b.blocked_profile_id) || []),
        ...(blockedMe?.map(b => b.blocker_profile_id) || [])
      ]);

      // CRITICAL SAFETY: Filter out banned users
      const { data: bannedUsers } = await supabase
        .from('bans')
        .select('banned_profile_id')
        .not('banned_profile_id', 'is', null)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

      const bannedProfileIds = new Set(
        bannedUsers?.map(b => b.banned_profile_id).filter(Boolean) || []
      );

      // Filter out matches with blocked OR banned users
      const filteredMatches = (matchesData || []).filter(match => {
        const otherProfileId = match.profile1_id === currentProfileId
          ? match.profile2_id
          : match.profile1_id;
        return !blockedProfileIds.has(otherProfileId) && !bannedProfileIds.has(otherProfileId);
      });

      // PERFORMANCE OPTIMIZATION: Batch all queries to prevent ANR on low-end devices
      // Get all other profile IDs and match IDs
      const otherProfileIds = filteredMatches.map(match =>
        match.profile1_id === currentProfileId ? match.profile2_id : match.profile1_id
      );
      const matchIds = filteredMatches.map(match => match.id);

      if (matchIds.length === 0) {
        setMatches([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Batch fetch ALL data in parallel (4 queries total instead of 4N)
      const [profilesResult, messagesResult, unreadCountsResult, revealsResult] = await Promise.all([
        // Get all profiles at once
        supabase
          .from('profiles')
          .select(`
            id,
            display_name,
            age,
            is_verified,
            last_active_at,
            hide_last_active,
            photo_blur_enabled,
            encryption_public_key,
            photos (
              url,
              is_primary,
              display_order
            )
          `)
          .in('id', otherProfileIds),
        // Get last message for each match using a single query
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
        // Get photo reveals for all profiles at once
        supabase
          .from('photo_reveals')
          .select('revealer_profile_id')
          .in('revealer_profile_id', otherProfileIds)
          .eq('revealed_to_profile_id', currentProfileId),
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

      // Create set of revealed profile IDs
      const revealedProfileIds = new Set(
        revealsResult.data?.map(r => r.revealer_profile_id) || []
      );

      // Build matches array using lookup maps
      const validMatches = filteredMatches.map((match) => {
        const otherProfileId = match.profile1_id === currentProfileId
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
            last_active_at: profile.last_active_at,
            hide_last_active: profile.hide_last_active,
            photo_blur_enabled: profile.photo_blur_enabled,
            encryption_public_key: profile.encryption_public_key,
            photos: profile?.photos?.sort((a: any, b: any) => a.display_order - b.display_order),
            is_revealed: isRevealed,
          },
          compatibility_score: match.compatibility_score,
          matched_at: match.matched_at,
          last_message: lastMessage || undefined,
          unread_count: unreadCount,
        };
      }).filter(m => m !== null) as Match[];

      // Show matches immediately without decryption for faster UI
      setMatches(validMatches);
      setLoading(false);
      setRefreshing(false);

      // PERFORMANCE: Defer decryption until after UI is responsive
      // This prevents ANR on low-end devices by not blocking main thread
      InteractionManager.runAfterInteractions(async () => {
        try {
          const matchesWithDecryptedPreviews = await decryptMessagePreviews(validMatches);
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

  const loadLikesCount = async () => {
    try {
      if (!currentProfileId) return;

      // Get count of likes where current user is liked
      const { data: likesData } = await supabase
        .from('likes')
        .select('id, liker_profile_id')
        .eq('liked_profile_id', currentProfileId);

      // Filter out likes that already became matches
      const { data: matchesData } = await supabase
        .from('matches')
        .select('profile1_id, profile2_id')
        .or(`profile1_id.eq.${currentProfileId},profile2_id.eq.${currentProfileId}`);

      const matchedProfileIds = new Set(
        matchesData?.flatMap(m => [m.profile1_id, m.profile2_id]) || []
      );

      // SAFETY: Filter out blocked users from like count
      const { data: blockedByMe } = await supabase
        .from('blocks')
        .select('blocked_profile_id')
        .eq('blocker_profile_id', currentProfileId);

      const { data: blockedMe } = await supabase
        .from('blocks')
        .select('blocker_profile_id')
        .eq('blocked_profile_id', currentProfileId);

      const blockedProfileIds = new Set([
        ...(blockedByMe?.map(b => b.blocked_profile_id) || []),
        ...(blockedMe?.map(b => b.blocker_profile_id) || [])
      ]);

      const unmatchedLikesCount = likesData?.filter(
        like =>
          !matchedProfileIds.has(like.liker_profile_id) &&
          !blockedProfileIds.has(like.liker_profile_id)
      ).length || 0;

      setLikesCount(unmatchedLikesCount);
    } catch (error: any) {
      console.error('Error loading likes count:', error);
    }
  };

  const subscribeToMatches = () => {
    if (!currentProfileId) return;

    // Subscribe to new matches (with realtime manager for cost protection)
    const matchesChannel = supabase
      .channel('matches-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'matches',
          filter: `profile1_id=eq.${currentProfileId}`,
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
          filter: `profile2_id=eq.${currentProfileId}`,
        },
        () => {
          loadMatches();
          loadLikesCount();
        }
      )
      .subscribe();

    // Subscribe to new messages (for last message updates)
    const messagesChannel = supabase
      .channel('messages-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
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
          filter: `liked_profile_id=eq.${currentProfileId}`,
        },
        () => {
          loadLikesCount();
        }
      )
      .subscribe();

    // Register channels with realtime manager for cost protection
    realtimeManager.registerChannel(currentProfileId, matchesChannel);
    realtimeManager.registerChannel(currentProfileId, messagesChannel);
    realtimeManager.registerChannel(currentProfileId, likesChannel);

    return () => {
      // Unregister and cleanup
      realtimeManager.unregisterChannel(currentProfileId, matchesChannel);
      realtimeManager.unregisterChannel(currentProfileId, messagesChannel);
      realtimeManager.unregisterChannel(currentProfileId, likesChannel);

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

  const handleMatchPress = (match: Match) => {
    // Navigate to profile page (consistent with messages tab)
    router.push(`/profile/${match.profile.id}`);
  };

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
              Alert.alert(t('matches.unmatchDialog.success'), t('matches.unmatchDialog.successMessage', { name: match.profile.display_name }));
            } catch (error: any) {
              console.error('Error unmatching:', error);
              Alert.alert(t('common.error'), t('matches.unmatchDialog.error'));
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

              Alert.alert(t('matches.blockDialog.success'), t('matches.blockDialog.successMessage', { name: match.profile.display_name }));
            } catch (error: any) {
              console.error('Error blocking user:', error);
              Alert.alert(t('common.error'), t('matches.blockDialog.error'));
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
              Alert.alert(t('common.error'), t('matches.reportDialog.errorEmpty'));
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

              Alert.alert(
                t('matches.reportDialog.success'),
                t('matches.reportDialog.successMessage')
              );
            } catch (error: any) {
              console.error('Error reporting user:', error);
              Alert.alert(t('common.error'), t('matches.reportDialog.error'));
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleMatchLongPress = (match: Match) => {
    setActionSheetMatch(match);
    setShowActionSheet(true);
  };

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

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return t('matches.timeAgo.justNow');
    if (seconds < 3600) return t('matches.timeAgo.minutesAgo', { count: Math.floor(seconds / 60) });
    if (seconds < 86400) return t('matches.timeAgo.hoursAgo', { count: Math.floor(seconds / 3600) });
    if (seconds < 604800) return t('matches.timeAgo.daysAgo', { count: Math.floor(seconds / 86400) });
    return t('matches.timeAgo.weeksAgo', { count: Math.floor(seconds / 604800) });
  };

  // Separate MatchCard component to use useSafeBlur hook
  const MatchCard = ({ item, index }: { item: Match; index: number }) => {
    const primaryPhoto = item.profile.photos?.find(p => p.is_primary) || item.profile.photos?.[0];
    const hasUnread = (item.unread_count || 0) > 0;
    const userIsOnline = isOnline(item.profile.last_active_at || null);
    const showOnlineStatus = userIsOnline && !item.profile.hide_last_active;
    const lastActiveText = getLastActiveText(item.profile.last_active_at || null, item.profile.hide_last_active);

    // Safe blur hook - protects user privacy while preventing crashes
    const { blurRadius, onImageLoad, onImageError } = useSafeBlur({
      shouldBlur: (item.profile.photo_blur_enabled || false) && !item.profile.is_revealed,
      blurIntensity: 30,
    });

    return (
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: index * 50 }}
      >
        <TouchableOpacity
          style={[styles.matchCard, { backgroundColor: colors.card }]}
          onPress={() => handleMatchPress(item)}
          onLongPress={() => handleMatchLongPress(item)}
          activeOpacity={0.7}
        >
          {/* Profile Photo */}
          <View style={styles.photoContainer}>
            <Image
              source={{ uri: primaryPhoto?.url || 'https://via.placeholder.com/80' }}
              style={styles.photo}
              blurRadius={blurRadius}
              onLoad={onImageLoad}
              onError={onImageError}
            />
            {item.profile.is_verified && (
              <View style={[styles.verifiedBadge, { backgroundColor: colors.card }]}>
                <MaterialCommunityIcons name="check-decagram" size={18} color="#3B82F6" />
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
                <Text style={[styles.timestamp, { color: colors.mutedForeground }]}>{getTimeAgo(item.last_message.created_at)}</Text>
              )}
            </View>

            {/* Compatibility Score - only show if we have a real score (not 0 or null) */}
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

            {/* Online Status */}
            {lastActiveText && (
              <Text style={styles.onlineStatusText}>{lastActiveText}</Text>
            )}

            {/* Last Message or CTA */}
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
                <MaterialCommunityIcons name="message-outline" size={14} color="#9B87CE" />
                <Text style={styles.ctaText}>{t('matches.sayHi')}</Text>
              </View>
            )}
          </View>

          {/* Chevron */}
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
        </TouchableOpacity>
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
                  <BlurView intensity={20} tint="dark" style={styles.likesBlur}>
                    <MaterialCommunityIcons name="lock" size={16} color="white" />
                    <Text style={styles.likesBlurText}>
                      {likesCount > 0 ? t('matches.upgradeTo', { count: likesCount }) : t('matches.upgradeToSee')}
                    </Text>
                  </BlurView>
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

  const renderMatch = ({ item, index }: { item: Match; index: number }) => {
    return <MatchCard item={item} index={index} />;
  };

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
          {/* Activity Bell */}
          <TouchableOpacity
            onPress={() => router.push('/activity')}
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
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>{t('matches.loadingMatches')}</Text>
        </View>
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
          {/* Activity Bell */}
          <TouchableOpacity
            onPress={() => router.push('/activity')}
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
        {/* Activity Bell */}
        <TouchableOpacity
          onPress={() => router.push('/activity')}
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
          </View>
        </TouchableOpacity>
      </View>

      {/* Matches List */}
      <FlatList
        data={matches}
        renderItem={renderMatch}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderLikesCard}
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
    gap: 12,
  },
  matchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    gap: 16,
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
});
