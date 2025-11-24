import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import PremiumPaywall from '@/components/premium/PremiumPaywall';

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
  const insets = useSafeAreaInsets();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [likes, setLikes] = useState<LikeProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

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
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      if (data) {
        setCurrentProfileId(data.id);
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

      const formattedLikes: LikeProfile[] = (likesData || [])
        .filter(like =>
          !matchedProfileIds.has(like.liker_profile_id) &&
          !blockedProfileIds.has(like.liker_profile_id)
        )
        .map(like => ({
          id: like.id,
          profile_id: like.liker_profile_id,
          liked_at: like.created_at,
          profile: {
            display_name: like.liker_profile.display_name,
            age: like.liker_profile.age,
            location_city: like.liker_profile.location_city,
            location_state: like.liker_profile.location_state,
            occupation: like.liker_profile.occupation,
            bio: like.liker_profile.bio,
            photos: like.liker_profile.photos || [],
          },
        }));

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
      // Create a like back
      const { error: likeError } = await supabase
        .from('likes')
        .insert({
          liker_profile_id: currentProfileId,
          liked_profile_id: likeProfileId,
          like_type: 'standard',
        });

      if (likeError) throw likeError;

      // Create a match
      const profile1Id = currentProfileId < likeProfileId ? currentProfileId : likeProfileId;
      const profile2Id = currentProfileId < likeProfileId ? likeProfileId : currentProfileId;

      const { error: matchError } = await supabase
        .from('matches')
        .insert({
          profile1_id: profile1Id,
          profile2_id: profile2Id,
          initiated_by: currentProfileId,
        });

      if (matchError) throw matchError;

      Alert.alert(
        t('likes.itsAMatch'),
        t('likes.canStartChatting'),
        [
          {
            text: t('likes.keepBrowsing'),
            style: 'cancel',
          },
          {
            text: t('likes.goToMatches'),
            onPress: () => router.push('/(tabs)/matches'),
          },
        ]
      );
    } catch (error) {
      console.error('Error creating match:', error);
      // Restore the like back to UI on error
      loadLikes();
      Alert.alert(t('common.error'), t('likes.errorCreatingMatch'));
    }
  };

  const handlePass = async (likeId: string) => {
    // Optimistically remove from UI
    setLikes(prev => prev.filter(l => l.id !== likeId));

    try {
      // Delete the like (they passed on someone who liked them)
      await supabase
        .from('likes')
        .delete()
        .eq('id', likeId);
    } catch (error) {
      console.error('Error passing:', error);
      // Reload likes to restore state
      loadLikes();
    }
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
      <View className="flex-1 bg-cream">
        {/* Purple Header */}
        <View className="bg-primary-500 px-6 pb-6" style={{ paddingTop: insets.top + 16 }}>
          <Text className="text-4xl font-bold text-white mb-2">{t('likes.title')}</Text>
          <Text className="text-white/90 text-base">{t('likes.subtitle')}</Text>
        </View>

        <ScrollView className="flex-1 px-6 pt-6">
          {/* Teaser - show blurred cards */}
          <View className="mb-6 rounded-3xl overflow-hidden">
            <LinearGradient
              colors={['#9B87CE', '#B8A9DD']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              className="px-6 pt-8 pb-12"
            >
              <View className="items-center">
                <MaterialCommunityIcons name="heart-multiple" size={64} color="white" />
                <Text className="text-2xl font-bold text-white mt-4 text-center">
                  {loading ? '...' : likes.length === 1
                    ? t('likes.personLikesYou', { count: likes.length })
                    : t('likes.peopleLikeYou', { count: likes.length })}
                </Text>
                <Text className="text-white/90 mt-2 text-center">
                  {t('likes.upgradeToPremium')}
                </Text>
                <TouchableOpacity
                  onPress={handleUpgrade}
                  className="bg-white mt-5 px-8 py-3.5 rounded-full shadow-lg"
                >
                  <Text className="text-purple-600 font-bold text-lg">{t('likes.seeWhoLikesYou')}</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>

          {/* Blurred preview grid */}
          <View className="flex-row flex-wrap gap-3 mb-6">
            {likes.slice(0, 8).map((like, index) => (
              <View key={like.id} className="w-[47%] aspect-[3/4] rounded-2xl overflow-hidden bg-gray-200">
                <Image
                  source={{ uri: getPrimaryPhoto(like.profile.photos) }}
                  className="w-full h-full"
                  blurRadius={30}
                />
                <View className="absolute inset-0 bg-black/30 items-center justify-center">
                  <MaterialCommunityIcons name="heart" size={40} color="white" />
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
    <View className="flex-1 bg-cream">
      {/* Purple Header */}
      <View className="bg-primary-500 px-6 pb-6" style={{ paddingTop: insets.top + 16 }}>
        <Text className="text-4xl font-bold text-white mb-2">
          {t('likes.title')} ({likes.length})
        </Text>
        <Text className="text-white/90 text-base">{t('likes.subtitleWithCount')}</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#9B87CE" />
        </View>
      ) : likes.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <MaterialCommunityIcons name="heart-outline" size={80} color="#D1D5DB" />
          <Text className="text-xl font-bold text-gray-700 mt-4">{t('likes.noLikesYet')}</Text>
          <Text className="text-gray-500 text-center mt-2">
            {t('likes.noLikesText')}
          </Text>
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-6 pt-6"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#9B87CE" />
          }
        >
          <View className="flex-row flex-wrap gap-3 pb-6">
            {likes.map((like) => (
              <View key={like.id} className="w-[47%]">
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => router.push(`/profile/${like.profile_id}`)}
                >
                  <View className="aspect-[3/4] rounded-2xl overflow-hidden bg-white shadow-sm">
                    <Image
                      source={{ uri: getPrimaryPhoto(like.profile.photos) }}
                      className="w-full h-full"
                      resizeMode="cover"
                    />
                    <View className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                      <Text className="text-white font-bold text-lg">
                        {like.profile.display_name}, {like.profile.age}
                      </Text>
                      {like.profile.location_city && (
                        <Text className="text-white/90 text-sm">
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
                    className="flex-1 bg-gray-200 py-3 rounded-full items-center"
                  >
                    <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleLikeBack(like.profile_id)}
                    className="flex-1 bg-primary-400 py-3 rounded-full items-center"
                  >
                    <MaterialCommunityIcons name="heart" size={24} color="white" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}
