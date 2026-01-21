import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, RefreshControl, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';
import PremiumPaywall from '@/components/premium/PremiumPaywall';
import MatchModal from '@/components/matching/MatchModal';
import { calculateCompatibilityScore } from '@/lib/matching-algorithm';
import { useUnreadActivityCount } from '@/hooks/useActivityFeed';

interface LikeProfile {
  id: string;
  profile_id: string;
  liked_at: string;
  profile: {
    display_name: string;
    age: number;
    location_city?: string;
    location_state?: string;
    occupation?: string;
    bio?: string;
    photos: Array<{ url: string; is_primary: boolean }>;
    compatibility_score?: number;
  };
}

export default function Likes() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isPremium, isPlatinum } = useSubscription();
  const { refreshUnreadLikeCount } = useNotifications();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const rightSafeArea = isLandscape ? Math.max(insets.right, Platform.OS === 'android' ? 48 : 0) : 0;
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const unreadActivityCount = useUnreadActivityCount(currentProfileId);
  const [likes, setLikes] = useState<LikeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<{
    display_name: string;
    photo_url?: string;
    compatibility_score?: number;
  } | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentProfile();
  }, [user]);

  useEffect(() => {
    if (currentProfileId) {
      loadLikes();
    }
  }, [currentProfileId]);

  const loadCurrentProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          photos (
            url,
            is_primary
          )
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setCurrentProfileId(data.id);
        // Get primary photo or first photo
        const primaryPhoto = data.photos?.find((p: any) => p.is_primary)?.url || data.photos?.[0]?.url;
        setCurrentUserPhoto(primaryPhoto || null);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadLikes = async () => {
    if (!currentProfileId) return;

    try {
      setLoading(true);

      // Get all likes where this user was liked
      const { data: likesData, error } = await supabase
        .from('likes')
        .select(`
          id,
          liker_profile_id,
          created_at,
          liker_profile:profiles!likes_liker_profile_id_fkey (
            id,
            display_name,
            age,
            location_city,
            location_state,
            occupation,
            bio,
            photos (
              url,
              is_primary
            )
          )
        `)
        .eq('liked_profile_id', currentProfileId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter out users we already matched with
      const { data: matches } = await supabase
        .from('matches')
        .select('profile1_id, profile2_id')
        .or(`profile1_id.eq.${currentProfileId},profile2_id.eq.${currentProfileId}`);

      const matchedProfileIds = new Set(
        matches?.flatMap(m => [m.profile1_id, m.profile2_id]) || []
      );

      // Filter out users we've passed on
      const { data: passes } = await supabase
        .from('passes')
        .select('passed_profile_id')
        .eq('passer_profile_id', currentProfileId);

      const passedProfileIds = new Set(
        passes?.map(p => p.passed_profile_id) || []
      );

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

      const formattedLikes: LikeProfile[] = (likesData || [])
        .filter(like =>
          !matchedProfileIds.has(like.liker_profile_id) &&
          !passedProfileIds.has(like.liker_profile_id) &&
          !blockedProfileIds.has(like.liker_profile_id) &&
          !bannedProfileIds.has(like.liker_profile_id)
        )
        .map(like => {
          // Supabase returns joined data as array, extract first element
          const likerProfile = Array.isArray(like.liker_profile) ? like.liker_profile[0] : like.liker_profile;
          return {
            id: like.id,
            profile_id: like.liker_profile_id,
            liked_at: like.created_at,
            profile: {
              display_name: likerProfile.display_name,
              age: likerProfile.age,
              location_city: likerProfile.location_city,
              location_state: likerProfile.location_state,
              occupation: likerProfile.occupation,
              bio: likerProfile.bio,
              photos: likerProfile.photos || [],
            },
          };
        });

      setLikes(formattedLikes);
    } catch (error) {
      console.error('Error loading likes:', error);
      Alert.alert(t('common.error'), t('likes.errorLoadingLikes'));
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadLikes();
    setRefreshing(false);
  };

  const handleLikeBack = async (likeProfileId: string) => {
    if (!currentProfileId) return;

    // Optimistically remove from UI
    setLikes(prev => prev.filter(l => l.profile_id !== likeProfileId));

    try {
      // Create a like back (use upsert to handle case where like already exists)
      const { error: likeError } = await supabase
        .from('likes')
        .upsert({
          liker_profile_id: currentProfileId,
          liked_profile_id: likeProfileId,
          like_type: 'standard',
        }, {
          onConflict: 'liker_profile_id,liked_profile_id',
          ignoreDuplicates: true, // If already exists, that's fine
        });

      // Ignore duplicate key errors - the like already exists which is fine
      if (likeError && !likeError.message?.includes('duplicate')) {
        throw likeError;
      }

      // Fetch both profiles with preferences to calculate compatibility
      const { data: myProfile } = await supabase
        .from('profiles')
        .select(`
          *,
          preferences (*)
        `)
        .eq('id', currentProfileId)
        .single();

      const { data: otherProfile } = await supabase
        .from('profiles')
        .select(`
          *,
          preferences (*),
          photos (
            url,
            is_primary
          )
        `)
        .eq('id', likeProfileId)
        .single();

      // Calculate compatibility score
      let compatibilityScore: number | null = null;
      if (myProfile && otherProfile) {
        const myPrefs = Array.isArray(myProfile.preferences) ? myProfile.preferences[0] : myProfile.preferences;
        const otherPrefs = Array.isArray(otherProfile.preferences) ? otherProfile.preferences[0] : otherProfile.preferences;

        if (myPrefs && otherPrefs) {
          compatibilityScore = calculateCompatibilityScore(
            myProfile,
            otherProfile,
            myPrefs,
            otherPrefs
          );
        }
      }

      // Create a match with compatibility score
      const profile1Id = currentProfileId < likeProfileId ? currentProfileId : likeProfileId;
      const profile2Id = currentProfileId < likeProfileId ? likeProfileId : currentProfileId;

      // Check if match already exists first
      const { data: existingMatch } = await supabase
        .from('matches')
        .select('id')
        .eq('profile1_id', profile1Id)
        .eq('profile2_id', profile2Id)
        .maybeSingle();

      let matchData = existingMatch;

      if (!existingMatch) {
        // Create new match
        const { data: newMatch, error: matchError } = await supabase
          .from('matches')
          .insert({
            profile1_id: profile1Id,
            profile2_id: profile2Id,
            initiated_by: currentProfileId,
            compatibility_score: compatibilityScore,
          })
          .select('id')
          .single();

        if (matchError) {
          // If it's a duplicate key error, the match was created by someone else (race condition)
          // Try to fetch the existing match
          if (matchError.code === '23505' || matchError.message?.includes('duplicate')) {
            const { data: raceMatch } = await supabase
              .from('matches')
              .select('id')
              .eq('profile1_id', profile1Id)
              .eq('profile2_id', profile2Id)
              .single();
            matchData = raceMatch;
          } else {
            throw matchError;
          }
        } else {
          matchData = newMatch;
        }
      }

      // Get the other person's primary photo
      const otherPhoto = otherProfile?.photos?.find((p: any) => p.is_primary)?.url || otherProfile?.photos?.[0]?.url;

      // Show match modal
      setMatchedProfile({
        display_name: otherProfile?.display_name || 'Someone',
        photo_url: otherPhoto,
        compatibility_score: compatibilityScore || undefined,
      });
      setMatchId(matchData?.id || null);
      setShowMatchModal(true);

      // Refresh the notification badge count
      refreshUnreadLikeCount();
    } catch (error: any) {
      console.error('Error creating match:', error);
      // Restore the like back to UI on error
      loadLikes();
      Alert.alert(t('common.error'), t('likes.errorCreatingMatch'));
    }
  };

  const handlePass = async (likeId: string) => {
    if (!currentProfileId) return;

    // Find the like to get the profile ID
    const like = likes.find(l => l.id === likeId);
    if (!like) return;

    // Optimistically remove from UI
    setLikes(prev => prev.filter(l => l.id !== likeId));

    try {
      // Create a pass record (so we remember this dismissal)
      await supabase
        .from('passes')
        .insert({
          passer_profile_id: currentProfileId,
          passed_profile_id: like.profile_id,
        });

      // Delete the like (cleanup)
      await supabase
        .from('likes')
        .delete()
        .eq('id', likeId);

      // Refresh the notification badge count
      refreshUnreadLikeCount();
    } catch (error) {
      console.error('Error passing:', error);
      // Reload likes to restore state
      loadLikes();
    }
  };

  const handleCloseMatchModal = () => {
    setShowMatchModal(false);
    setMatchedProfile(null);
    setMatchId(null);
  };

  const handleSendMessage = () => {
    setShowMatchModal(false);
    if (matchId) {
      router.push(`/chat/${matchId}`);
    }
    setMatchedProfile(null);
    setMatchId(null);
  };

  const handleUpgrade = () => {
    setShowPaywall(true);
  };

  const getPrimaryPhoto = (photos: Array<{ url: string; is_primary: boolean }>) => {
    const primary = photos.find(p => p.is_primary);
    return primary?.url || photos[0]?.url || 'https://via.placeholder.com/400x600?text=No+Photo';
  };

  // Free users see blurred likes
  if (!isPremium && !isPlatinum) {
    return (
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="bg-background dark:bg-background px-6 pb-6 border-b border-border flex-row justify-between items-end" style={{ paddingTop: insets.top + 16 }}>
          <View>
            <Text className="text-heading-2xl font-display-bold text-foreground mb-2">{t('likes.title')}</Text>
            <Text className="text-body-lg font-sans text-muted-foreground">{t('likes.subtitle')}</Text>
          </View>
          {/* Activity Bell */}
          <TouchableOpacity
            onPress={() => router.push('/activity')}
            style={styles.activityButton}
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

        <ScrollView className="flex-1 px-6 pt-6">
          {/* Teaser - show blurred cards */}
          <View className="mb-6 rounded-3xl overflow-hidden">
            <LinearGradient
              colors={['#A08AB7', '#CDC2E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="px-6 pt-8 pb-12"
            >
              <View className="items-center">
                <Ionicons name="heart" size={64} color="white" />
                <Text className="text-heading-lg font-display-bold text-white mt-4 text-center">
                  {loading ? '...' : likes.length === 1
                    ? t('likes.personLikesYou', { count: likes.length })
                    : t('likes.peopleLikeYou', { count: likes.length })}
                </Text>
                <Text className="text-body font-sans text-white/90 mt-2 text-center">
                  {t('likes.upgradeToPremium')}
                </Text>
                <TouchableOpacity
                  onPress={handleUpgrade}
                  className="bg-white mt-5 px-8 py-3.5 rounded-full shadow-lg"
                >
                  <Text className="text-lavender-600 font-sans-bold text-body-lg">{t('likes.seeWhoLikesYou')}</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>

          {/* Blurred preview grid */}
          <View className="flex-row flex-wrap gap-3 mb-6">
            {likes.slice(0, 8).map((like, index) => (
              <View key={like.id} className="w-[47%] aspect-[3/4] rounded-2xl overflow-hidden bg-muted">
                <Image
                  source={{ uri: getPrimaryPhoto(like.profile.photos) }}
                  className="w-full h-full"
                  blurRadius={30}
                />
                <View className="absolute inset-0 bg-black/30 items-center justify-center">
                  <Ionicons name="heart" size={40} color="white" />
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        {showPaywall && (
          <PremiumPaywall
            visible={showPaywall}
            onClose={() => setShowPaywall(false)}
            variant="premium"
            feature="see_who_liked"
          />
        )}
      </View>
    );
  }

  // Premium users see actual likes
  return (
    <View className="flex-1 bg-background" style={{ paddingRight: rightSafeArea }}>
      {/* Header */}
      <View className="bg-background dark:bg-background px-6 pb-6 border-b border-border flex-row justify-between items-end" style={{ paddingTop: insets.top + 16 }}>
        <View>
          <Text className="text-heading-2xl font-display-bold text-foreground mb-2">
            {t('likes.title')} ({likes.length})
          </Text>
          <Text className="text-body-lg font-sans text-muted-foreground">{t('likes.subtitleWithCount')}</Text>
        </View>
        {/* Activity Bell */}
        <TouchableOpacity
          onPress={() => router.push('/activity')}
          style={[styles.activityButton, { backgroundColor: '#F5F0FF' }]}
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

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#A08AB7" />
        </View>
      ) : likes.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Ionicons name="heart-outline" size={80} color="#A1A1AA" />
          <Text className="text-heading font-display-bold text-foreground mt-4">{t('likes.noLikesYet')}</Text>
          <Text className="text-body font-sans text-muted-foreground text-center mt-2">
            {t('likes.noLikesText')}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-6 pt-6"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#A08AB7" />
          }
        >
          <View className="flex-row flex-wrap gap-3 pb-24">
            {likes.map((like) => (
              <View key={like.id} className="w-[47%]">
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push(`/profile/${like.profile_id}`)}
                >
                  <View className="aspect-[3/4] rounded-2xl overflow-hidden bg-card shadow-sm">
                    <Image
                      source={{ uri: getPrimaryPhoto(like.profile.photos) }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                    <View className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <Text className="text-white font-sans-bold text-body-lg">
                        {like.profile.display_name}, {like.profile.age}
                      </Text>
                      {like.profile.location_city && (
                        <Text className="text-white/90 font-sans text-body-sm">
                          {like.profile.location_city}
                          {like.profile.location_state && `, ${like.profile.location_state}`}
                        </Text>
                      )}
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Action buttons */}
                <View className="flex-row gap-2 mt-3">
                  <TouchableOpacity
                    onPress={() => handlePass(like.id)}
                    className="flex-1 bg-muted py-3 rounded-full items-center"
                  >
                    <Ionicons name="close" size={24} color="#71717A" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleLikeBack(like.profile_id)}
                    className="flex-1 bg-lavender-500 py-3 rounded-full items-center"
                  >
                    <Ionicons name="heart" size={24} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}

      {/* Match Modal */}
      {matchedProfile && (
        <MatchModal
          visible={showMatchModal}
          onClose={handleCloseMatchModal}
          onSendMessage={handleSendMessage}
          matchedProfile={{
            display_name: matchedProfile.display_name,
            photo_url: matchedProfile.photo_url,
            compatibility_score: matchedProfile.compatibility_score,
          }}
          currentUserPhoto={currentUserPhoto || undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  activityButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F6',
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
