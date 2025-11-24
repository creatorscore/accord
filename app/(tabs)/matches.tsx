import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, ActivityIndicator, StyleSheet, Modal, Alert, Pressable } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import { useScreenProtection } from '@/hooks/useScreenProtection';
import { isOnline, getLastActiveText } from '@/lib/online-status';
import { realtimeManager } from '@/lib/realtime-manager';

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
}

export default function Matches() {
  // Protect match list from screenshots
  useScreenProtection();

  const { t } = useTranslation();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const insets = useSafeAreaInsets();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
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

  const loadMatches = async () => {
    try {
      if (!currentProfileId) return;

      // Get all matches for current user
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
        .order('matched_at', { ascending: false });

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

      // Filter out matches with blocked users
      const filteredMatches = (matchesData || []).filter(match => {
        const otherProfileId = match.profile1_id === currentProfileId
          ? match.profile2_id
          : match.profile1_id;
        return !blockedProfileIds.has(otherProfileId);
      });

      // For each match, get the other person's profile and last message
      const matchesWithProfiles = await Promise.all(
        filteredMatches.map(async (match) => {
          const otherProfileId = match.profile1_id === currentProfileId
            ? match.profile2_id
            : match.profile1_id;

          // Get profile
          const { data: profile } = await supabase
            .from('profiles')
            .select(`
              id,
              display_name,
              age,
              is_verified,
              last_active_at,
              hide_last_active,
              photo_blur_enabled,
              photos (
                url,
                is_primary,
                display_order
              )
            `)
            .eq('id', otherProfileId)
            .single();

          // Get last message
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('encrypted_content, created_at, sender_profile_id, read_at')
            .eq('match_id', match.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Get unread count
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('match_id', match.id)
            .eq('receiver_profile_id', currentProfileId)
            .is('read_at', null);

          // Check if this user has revealed photos to current user
          const { data: revealData } = await supabase
            .from('photo_reveals')
            .select('id')
            .eq('revealer_profile_id', otherProfileId)
            .eq('revealed_to_profile_id', currentProfileId)
            .maybeSingle();

          const isRevealed = !!revealData;

          if (!profile) {
            return null;
          }

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
              photos: profile?.photos?.sort((a: any, b: any) => a.display_order - b.display_order),
              is_revealed: isRevealed,
            },
            compatibility_score: match.compatibility_score,
            matched_at: match.matched_at,
            last_message: lastMessage || undefined,
            unread_count: unreadCount || 0,
          };
        })
      );

      // Filter out any null values (profiles that failed to load)
      const validMatches = matchesWithProfiles.filter((m): m is Match => m !== null);
      setMatches(validMatches);
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
            colors={['#9B87CE', '#B8A9DD']}
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
    const primaryPhoto = item.profile.photos?.find(p => p.is_primary) || item.profile.photos?.[0];
    const hasUnread = (item.unread_count || 0) > 0;
    const userIsOnline = isOnline(item.profile.last_active_at || null);
    const showOnlineStatus = userIsOnline && !item.profile.hide_last_active;
    const lastActiveText = getLastActiveText(item.profile.last_active_at || null, item.profile.hide_last_active);

    return (
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: index * 50 }}
      >
        <TouchableOpacity
          style={styles.matchCard}
          onPress={() => handleMatchPress(item)}
          onLongPress={() => handleMatchLongPress(item)}
          activeOpacity={0.7}
        >
          {/* Profile Photo */}
          <View style={styles.photoContainer}>
            <Image
              source={{ uri: primaryPhoto?.url || 'https://via.placeholder.com/80' }}
              style={styles.photo}
              blurRadius={item.profile.photo_blur_enabled && !item.profile.is_revealed ? 30 : 0}
            />
            {item.profile.is_verified && (
              <View style={styles.verifiedBadge}>
                <MaterialCommunityIcons name="check-decagram" size={18} color="#3B82F6" />
              </View>
            )}
            {hasUnread && <View style={styles.unreadDot} />}
            {showOnlineStatus && <View style={styles.onlineDot} />}
          </View>

          {/* Match Info */}
          <View style={styles.matchInfo}>
            <View style={styles.matchHeader}>
              <Text style={styles.matchName} numberOfLines={1}>
                {item.profile.display_name}, {item.profile.age}
              </Text>
              {item.last_message && (
                <Text style={styles.timestamp}>{getTimeAgo(item.last_message.created_at)}</Text>
              )}
            </View>

            {/* Compatibility Score */}
            {item.compatibility_score && (
              <View style={styles.compatibilityRow}>
                <LinearGradient
                  colors={['#9B87CE', '#B8A9DD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.compatibilityBadge}
                >
                  <MaterialCommunityIcons name="heart" size={12} color="white" />
                  <Text style={styles.compatibilityText}>{t('matches.matchPercentage', { score: item.compatibility_score })}</Text>
                </LinearGradient>
              </View>
            )}

            {/* Online Status */}
            {lastActiveText && (
              <Text style={styles.onlineStatusText}>{lastActiveText}</Text>
            )}

            {/* Last Message or CTA */}
            {item.last_message ? (
              <Text
                style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]}
                numberOfLines={1}
              >
                {item.last_message.sender_profile_id === currentProfileId ? t('matches.youLabel') : ''}
                {item.last_message.encrypted_content}
              </Text>
            ) : (
              <View style={styles.ctaRow}>
                <MaterialCommunityIcons name="message-outline" size={14} color="#9B87CE" />
                <Text style={styles.ctaText}>{t('matches.sayHi')}</Text>
              </View>
            )}
          </View>

          {/* Chevron */}
          <MaterialCommunityIcons name="chevron-right" size={24} color="#D1D5DB" />
        </TouchableOpacity>
      </MotiView>
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('matches.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('matches.subtitle')}</Text>
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9B87CE" />
          <Text style={styles.loadingText}>{t('matches.loadingMatches')}</Text>
        </View>
      </View>
    );
  }

  // Empty state
  if (matches.length === 0) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('matches.title')}</Text>
          <Text style={styles.headerSubtitle}>{t('matches.subtitle')}</Text>
        </View>

        <View style={styles.emptyContainer}>
          <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: 200 }}
          >
            <View style={styles.emptyIconContainer}>
              <LinearGradient
                colors={['#9B87CE', '#B8A9DD']}
                style={styles.emptyIcon}
              >
                <MaterialCommunityIcons name="heart-outline" size={48} color="white" />
              </LinearGradient>
            </View>
            <Text style={styles.emptyTitle}>{t('matches.noMatchesYet')}</Text>
            <Text style={styles.emptyText}>
              {t('matches.noMatchesText')}
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/discover')}
            >
              <LinearGradient
                colors={['#9B87CE', '#B8A9DD']}
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
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>{t('matches.title')}</Text>
          <Text style={styles.headerSubtitle}>
            {matches.length === 1
              ? t('matches.connection', { count: matches.length })
              : t('matches.connections', { count: matches.length })}
          </Text>
        </View>
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
            tintColor="#9B87CE"
            colors={['#9B87CE']}
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
          <Pressable style={[styles.actionSheet, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>
                {actionSheetMatch?.profile.display_name}
              </Text>
              <Pressable onPress={() => setShowActionSheet(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* Actions */}
            <View style={styles.actionsList}>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleActionSelect('view_profile')}
              >
                <MaterialCommunityIcons name="account" size={24} color="#6B7280" />
                <Text style={styles.actionText}>{t('matches.actions.viewProfile')}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#D1D5DB" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleActionSelect('send_message')}
              >
                <MaterialCommunityIcons name="message-text" size={24} color="#6B7280" />
                <Text style={styles.actionText}>{t('matches.actions.sendMessage')}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#D1D5DB" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleActionSelect('report')}
              >
                <MaterialCommunityIcons name="flag" size={24} color="#6B7280" />
                <Text style={styles.actionText}>{t('matches.actions.report')}</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#D1D5DB" />
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
    backgroundColor: '#FAF7F0',
  },
  header: {
    backgroundColor: '#9B87CE',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
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
    color: '#9B87CE',
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
});
