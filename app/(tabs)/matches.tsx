import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import ImmersiveProfileCard from '@/components/matching/ImmersiveProfileCard';

interface Match {
  id: string;
  profile: {
    id: string;
    display_name: string;
    age: number;
    photos?: Array<{ url: string; is_primary: boolean }>;
    is_verified?: boolean;
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
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [likesCount, setLikesCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [selectedMatchPreferences, setSelectedMatchPreferences] = useState<any>(null);

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

      // For each match, get the other person's profile and last message
      const matchesWithProfiles = await Promise.all(
        (matchesData || []).map(async (match) => {
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

          return {
            id: match.id,
            profile: {
              ...profile,
              photos: profile?.photos?.sort((a: any, b: any) => a.display_order - b.display_order),
            },
            compatibility_score: match.compatibility_score,
            matched_at: match.matched_at,
            last_message: lastMessage || undefined,
            unread_count: unreadCount || 0,
          };
        })
      );

      setMatches(matchesWithProfiles);
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

      const unmatchedLikesCount = likesData?.filter(
        like => !matchedProfileIds.has(like.liker_profile_id)
      ).length || 0;

      setLikesCount(unmatchedLikesCount);
    } catch (error: any) {
      console.error('Error loading likes count:', error);
    }
  };

  const subscribeToMatches = () => {
    if (!currentProfileId) return;

    // Subscribe to new matches
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

    return () => {
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

  const handleMatchPress = async (match: Match) => {
    try {
      // Load full profile data with all fields
      const { data: fullProfile, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          photos (
            url,
            is_primary,
            display_order
          ),
          prompt_answers
        `)
        .eq('id', match.profile.id)
        .single();

      if (profileError) throw profileError;

      // Load preferences
      const { data: prefs, error: prefsError } = await supabase
        .from('preferences')
        .select('*')
        .eq('profile_id', match.profile.id)
        .single();

      if (prefsError) console.error('Error loading preferences:', prefsError);

      // Set match with full profile data
      setSelectedMatch({
        ...match,
        profile: {
          ...fullProfile,
          photos: fullProfile.photos?.sort((a: any, b: any) => a.display_order - b.display_order),
        },
      });
      setSelectedMatchPreferences(prefs);
      setShowProfileModal(true);
    } catch (error: any) {
      console.error('Error loading match profile:', error);
    }
  };

  const handleLikesPress = () => {
    router.push('/likes');
  };

  const handleCloseProfileModal = () => {
    setShowProfileModal(false);
    setSelectedMatch(null);
    setSelectedMatchPreferences(null);
  };

  const handleSendMessage = () => {
    if (selectedMatch) {
      setShowProfileModal(false);
      router.push(`/chat/${selectedMatch.id}`);
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return `${Math.floor(seconds / 604800)}w ago`;
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
            colors={['#8B5CF6', '#EC4899']}
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
              <Text style={styles.likesTitle}>See Who Likes You</Text>
              {isPremium ? (
                <Text style={styles.likesSubtitle}>
                  {likesCount === 0
                    ? 'No new likes yet'
                    : `${likesCount} ${likesCount === 1 ? 'person has' : 'people have'} liked you`}
                </Text>
              ) : (
                <View style={styles.likesBlurContainer}>
                  <BlurView intensity={20} tint="dark" style={styles.likesBlur}>
                    <MaterialCommunityIcons name="lock" size={16} color="white" />
                    <Text style={styles.likesBlurText}>
                      {likesCount > 0 ? `${likesCount}+ likes` : 'Upgrade to see'}
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

    return (
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 400, delay: index * 50 }}
      >
        <TouchableOpacity
          style={styles.matchCard}
          onPress={() => handleMatchPress(item)}
          activeOpacity={0.7}
        >
          {/* Profile Photo */}
          <View style={styles.photoContainer}>
            <Image
              source={{ uri: primaryPhoto?.url || 'https://via.placeholder.com/80' }}
              style={styles.photo}
            />
            {item.profile.is_verified && (
              <View style={styles.verifiedBadge}>
                <MaterialCommunityIcons name="check-decagram" size={18} color="#3B82F6" />
              </View>
            )}
            {hasUnread && <View style={styles.unreadDot} />}
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
                  colors={['#8B5CF6', '#EC4899']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.compatibilityBadge}
                >
                  <MaterialCommunityIcons name="heart" size={12} color="white" />
                  <Text style={styles.compatibilityText}>{item.compatibility_score}% Match</Text>
                </LinearGradient>
              </View>
            )}

            {/* Last Message or CTA */}
            {item.last_message ? (
              <Text
                style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]}
                numberOfLines={1}
              >
                {item.last_message.sender_profile_id === currentProfileId ? 'You: ' : ''}
                {item.last_message.encrypted_content}
              </Text>
            ) : (
              <View style={styles.ctaRow}>
                <MaterialCommunityIcons name="message-outline" size={14} color="#8B5CF6" />
                <Text style={styles.ctaText}>Say hi! 👋</Text>
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
          <Text style={styles.headerTitle}>Matches</Text>
          <Text style={styles.headerSubtitle}>Your connections</Text>
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading your matches...</Text>
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
          <Text style={styles.headerTitle}>Matches</Text>
          <Text style={styles.headerSubtitle}>Your connections</Text>
        </View>

        <View style={styles.emptyContainer}>
          <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: 200 }}
          >
            <View style={styles.emptyIconContainer}>
              <LinearGradient
                colors={['#8B5CF6', '#EC4899']}
                style={styles.emptyIcon}
              >
                <MaterialCommunityIcons name="heart-outline" size={48} color="white" />
              </LinearGradient>
            </View>
            <Text style={styles.emptyTitle}>No matches yet</Text>
            <Text style={styles.emptyText}>
              Keep swiping to find your perfect match!{'\n'}
              Your connections will appear here.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/discover')}
            >
              <LinearGradient
                colors={['#8B5CF6', '#EC4899']}
                style={styles.emptyButtonGradient}
              >
                <MaterialCommunityIcons name="cards-heart" size={20} color="white" />
                <Text style={styles.emptyButtonText}>Start Swiping</Text>
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
          <Text style={styles.headerTitle}>Matches</Text>
          <Text style={styles.headerSubtitle}>{matches.length} {matches.length === 1 ? 'connection' : 'connections'}</Text>
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
            tintColor="#8B5CF6"
            colors={['#8B5CF6']}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Profile Modal */}
      {selectedMatch && (
        <Modal
          visible={showProfileModal}
          animationType="slide"
          presentationStyle="fullScreen"
          onRequestClose={handleCloseProfileModal}
        >
          <ImmersiveProfileCard
            profile={selectedMatch.profile}
            preferences={selectedMatchPreferences}
            onClose={handleCloseProfileModal}
            visible={showProfileModal}
            isMatched={true}
            onSendMessage={handleSendMessage}
          />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#8B5CF6',
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
    color: '#8B5CF6',
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
});
