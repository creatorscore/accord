import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import PremiumPaywall from '@/components/premium/PremiumPaywall';

interface Like {
  id: string;
  from_profile: {
    id: string;
    display_name: string;
    age: number;
    bio?: string;
    occupation?: string;
    location_city?: string;
    photos?: Array<{ url: string; is_primary: boolean; display_order: number }>;
    is_verified?: boolean;
  };
  like_type: string;
  message?: string;
  created_at: string;
}

export default function Likes() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [likes, setLikes] = useState<Like[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [matchingProfileId, setMatchingProfileId] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentProfile();
  }, []);

  useEffect(() => {
    if (currentProfileId) {
      if (!isPremium) {
        // Show paywall immediately for free users
        setShowPaywall(true);
        setLoading(false);
      } else {
        loadLikes();
        subscribeToLikes();
      }
    }
  }, [currentProfileId, isPremium]);

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

  const loadLikes = async () => {
    try {
      if (!currentProfileId) return;

      // Get all likes where the current user was liked
      const { data: likesData, error: likesError } = await supabase
        .from('likes')
        .select(`
          id,
          liker_profile_id,
          like_type,
          message,
          created_at
        `)
        .eq('liked_profile_id', currentProfileId)
        .order('created_at', { ascending: false });

      if (likesError) throw likesError;

      // Check if these likes already turned into matches
      const { data: matchesData } = await supabase
        .from('matches')
        .select('profile1_id, profile2_id')
        .or(`profile1_id.eq.${currentProfileId},profile2_id.eq.${currentProfileId}`);

      const matchedProfileIds = new Set(
        matchesData?.flatMap(m => [m.profile1_id, m.profile2_id]) || []
      );

      // Filter out likes that already became matches
      const unmatchedLikes = likesData?.filter(
        like => !matchedProfileIds.has(like.from_profile_id)
      ) || [];

      // Get profile data for each like
      const likesWithProfiles = await Promise.all(
        unmatchedLikes.map(async (like) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select(`
              id,
              display_name,
              age,
              bio,
              occupation,
              location_city,
              is_verified,
              photos (
                url,
                is_primary,
                display_order
              )
            `)
            .eq('id', like.from_profile_id)
            .single();

          return {
            id: like.id,
            from_profile: {
              ...profile,
              photos: profile?.photos?.sort((a: any, b: any) => a.display_order - b.display_order),
            },
            like_type: like.like_type,
            message: like.message,
            created_at: like.created_at,
          };
        })
      );

      setLikes(likesWithProfiles);
    } catch (error: any) {
      console.error('Error loading likes:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const subscribeToLikes = () => {
    if (!currentProfileId) return;

    const likesChannel = supabase
      .channel('likes-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'likes',
          filter: `to_profile_id=eq.${currentProfileId}`,
        },
        () => {
          loadLikes();
        }
      )
      .subscribe();

    return () => {
      likesChannel.unsubscribe();
    };
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadLikes();
  }, [currentProfileId]);

  const handleMatchNow = async (like: Like) => {
    try {
      setMatchingProfileId(like.from_profile.id);

      // Create a like back
      const { error: likeError } = await supabase
        .from('likes')
        .insert({
          from_profile_id: currentProfileId,
          to_profile_id: like.from_profile.id,
          like_type: 'standard',
        });

      if (likeError) throw likeError;

      // Create a match (ensure ordered pair)
      const [smallerId, largerId] = [currentProfileId!, like.from_profile.id].sort();

      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .insert({
          profile1_id: smallerId,
          profile2_id: largerId,
          initiated_by: like.from_profile.id, // They liked first
          status: 'active',
        })
        .select()
        .single();

      if (matchError) throw matchError;

      // Show success
      Alert.alert(
        '🎉 It\'s a Match!',
        `You and ${like.from_profile.display_name} are now connected!`,
        [
          {
            text: 'Send Message',
            onPress: () => router.push(`/chat/${matchData.id}`),
          },
          {
            text: 'Keep Browsing',
            style: 'cancel',
            onPress: () => {
              // Remove from likes list
              setLikes(prev => prev.filter(l => l.id !== like.id));
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error creating match:', error);
      Alert.alert('Error', 'Failed to create match. Please try again.');
    } finally {
      setMatchingProfileId(null);
    }
  };

  const handlePass = async (like: Like) => {
    try {
      // Create a pass record
      await supabase.from('passes').insert({
        from_profile_id: currentProfileId,
        to_profile_id: like.from_profile.id,
      });

      // Remove from likes list
      setLikes(prev => prev.filter(l => l.id !== like.id));
    } catch (error: any) {
      console.error('Error passing on like:', error);
    }
  };

  const handleViewProfile = (like: Like) => {
    router.push(`/profile/${like.from_profile.id}`);
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

  const renderLike = ({ item, index }: { item: Like; index: number }) => {
    const primaryPhoto = item.from_profile.photos?.find(p => p.is_primary) || item.from_profile.photos?.[0];
    const isMatching = matchingProfileId === item.from_profile.id;
    const isSuperLike = item.like_type === 'super_like';

    return (
      <MotiView
        from={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'timing', duration: 400, delay: index * 100 }}
        style={styles.likeCard}
      >
        <TouchableOpacity
          activeOpacity={0.95}
          onPress={() => handleViewProfile(item)}
        >
          {/* Photo */}
          <View style={styles.photoContainer}>
            <Image
              source={{ uri: primaryPhoto?.url || 'https://via.placeholder.com/400' }}
              style={styles.photo}
            />

            {/* Gradient Overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(0,0,0,0.7)']}
              style={styles.gradient}
            />

            {/* Super Like Badge */}
            {isSuperLike && (
              <View style={styles.superLikeBadge}>
                <LinearGradient
                  colors={['#3B82F6', '#8B5CF6']}
                  style={styles.superLikeBadgeGradient}
                >
                  <MaterialCommunityIcons name="star" size={16} color="white" />
                  <Text style={styles.superLikeBadgeText}>SUPER LIKE</Text>
                </LinearGradient>
              </View>
            )}

            {/* Verified Badge */}
            {item.from_profile.is_verified && (
              <View style={styles.verifiedBadge}>
                <MaterialCommunityIcons name="check-decagram" size={20} color="#3B82F6" />
              </View>
            )}

            {/* Profile Info */}
            <View style={styles.profileInfo}>
              <Text style={styles.name}>
                {item.from_profile.display_name}, {item.from_profile.age}
              </Text>
              {item.from_profile.occupation && (
                <Text style={styles.occupation} numberOfLines={1}>
                  {item.from_profile.occupation}
                </Text>
              )}
              {item.from_profile.location_city && (
                <View style={styles.locationRow}>
                  <MaterialCommunityIcons name="map-marker" size={14} color="rgba(255,255,255,0.9)" />
                  <Text style={styles.location}>{item.from_profile.location_city}</Text>
                </View>
              )}
            </View>

            {/* Timestamp */}
            <View style={styles.timestampBadge}>
              <BlurView intensity={40} tint="dark" style={styles.timestampBlur}>
                <MaterialCommunityIcons name="clock-outline" size={12} color="white" />
                <Text style={styles.timestampText}>{getTimeAgo(item.created_at)}</Text>
              </BlurView>
            </View>
          </View>

          {/* Intro Message */}
          {item.message && (
            <View style={styles.messageContainer}>
              <View style={styles.messageHeader}>
                <MaterialCommunityIcons name="message-text" size={16} color="#8B5CF6" />
                <Text style={styles.messageLabel}>Intro Message:</Text>
              </View>
              <Text style={styles.messageText}>{item.message}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.passButton}
            onPress={() => handlePass(item)}
            disabled={isMatching}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="close" size={28} color="#EF4444" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.matchButton}
            onPress={() => handleMatchNow(item)}
            disabled={isMatching}
            activeOpacity={0.7}
          >
            <LinearGradient
              colors={['#8B5CF6', '#EC4899']}
              style={styles.matchButtonGradient}
            >
              {isMatching ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <MaterialCommunityIcons name="heart" size={28} color="white" />
                  <Text style={styles.matchButtonText}>Match Now</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </MotiView>
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Likes</Text>
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading your likes...</Text>
        </View>
      </View>
    );
  }

  // Paywall for free users
  if (!isPremium) {
    return (
      <>
        <View style={styles.container}>
          <LinearGradient
            colors={['#8B5CF6', '#EC4899']}
            style={styles.paywallContainer}
          >
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <BlurView intensity={40} tint="dark" style={styles.backButtonBlur}>
                <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
              </BlurView>
            </TouchableOpacity>

            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', delay: 200 }}
              style={styles.paywallContent}
            >
              <View style={styles.paywallIcon}>
                <MaterialCommunityIcons name="eye" size={64} color="white" />
              </View>
              <Text style={styles.paywallTitle}>See Who Likes You</Text>
              <Text style={styles.paywallSubtitle}>
                {likes.length > 0
                  ? `${likes.length} ${likes.length === 1 ? 'person has' : 'people have'} already liked you!`
                  : 'Upgrade to see who likes you and match instantly'}
              </Text>

              <View style={styles.paywallFeatures}>
                {[
                  'See everyone who likes you',
                  'Match instantly with one tap',
                  'Never miss a connection',
                  'Unlimited swipes & more',
                ].map((feature, i) => (
                  <MotiView
                    key={i}
                    from={{ opacity: 0, translateX: -20 }}
                    animate={{ opacity: 1, translateX: 0 }}
                    transition={{ type: 'timing', duration: 400, delay: 400 + i * 100 }}
                    style={styles.paywallFeature}
                  >
                    <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
                    <Text style={styles.paywallFeatureText}>{feature}</Text>
                  </MotiView>
                ))}
              </View>

              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => setShowPaywall(true)}
                activeOpacity={0.8}
              >
                <View style={styles.upgradeButtonContent}>
                  <Text style={styles.upgradeButtonText}>Upgrade to Premium</Text>
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#8B5CF6" />
                </View>
              </TouchableOpacity>
            </MotiView>
          </LinearGradient>
        </View>

        <PremiumPaywall
          visible={showPaywall}
          onClose={() => {
            setShowPaywall(false);
            router.back();
          }}
          variant="premium"
          feature="see_who_liked"
        />
      </>
    );
  }

  // Empty state for premium users
  if (likes.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Likes</Text>
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
            <Text style={styles.emptyTitle}>No likes yet</Text>
            <Text style={styles.emptyText}>
              When someone likes you, they'll appear here.{'\n'}
              Keep your profile active and engaging!
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

  // Likes list
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Likes</Text>
          <Text style={styles.headerSubtitle}>
            {likes.length} {likes.length === 1 ? 'person' : 'people'} liked you
          </Text>
        </View>
      </View>

      <FlatList
        data={likes}
        renderItem={renderLike}
        keyExtractor={(item) => item.id}
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonBlur: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    marginTop: 4,
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
  listContent: {
    padding: 16,
    gap: 20,
  },
  likeCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  photoContainer: {
    position: 'relative',
    height: 400,
  },
  photo: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
  },
  gradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 200,
  },
  superLikeBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  superLikeBadgeGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  superLikeBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  profileInfo: {
    position: 'absolute',
    bottom: 16,
    left: 20,
    right: 20,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  occupation: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.95)',
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  location: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  timestampBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  timestampBlur: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  timestampText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
  messageContainer: {
    padding: 20,
    backgroundColor: '#F3F4F6',
    gap: 8,
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  messageLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  messageText: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    alignItems: 'center',
  },
  passButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 2,
    borderColor: '#FEE2E2',
  },
  matchButton: {
    flex: 1,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden',
  },
  matchButtonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  matchButtonText: {
    color: 'white',
    fontSize: 17,
    fontWeight: 'bold',
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
  paywallContainer: {
    flex: 1,
    paddingTop: 60,
  },
  paywallContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  paywallIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  paywallTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
    textAlign: 'center',
  },
  paywallSubtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    lineHeight: 26,
    marginBottom: 40,
  },
  paywallFeatures: {
    alignSelf: 'stretch',
    gap: 16,
    marginBottom: 40,
  },
  paywallFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  paywallFeatureText: {
    fontSize: 16,
    color: 'white',
    fontWeight: '500',
  },
  upgradeButton: {
    backgroundColor: 'white',
    borderRadius: 28,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignSelf: 'stretch',
  },
  upgradeButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  upgradeButtonText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#8B5CF6',
  },
});
