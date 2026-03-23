import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, ScrollView, FlatList, TouchableOpacity, Image, ActivityIndicator, Alert, RefreshControl, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileData } from '@/contexts/ProfileDataContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import PremiumPaywall from '@/components/premium/PremiumPaywall';
import MatchModal from '@/components/matching/MatchModal';
import { calculateCompatibilityScore } from '@/lib/matching-algorithm';
import { usePhotoBlur } from '@/hooks/usePhotoBlur';
import { SafeBlurImage } from '@/components/shared/SafeBlurImage';
import { signProfileMediaUrls } from '@/lib/signed-urls';

interface LikeProfile {
  id: string;
  profile_id: string;
  liked_at: string;
  like_type?: string;
  message?: string;
  liked_content?: string;
  profile: {
    display_name: string;
    age: number;
    location_city?: string;
    location_state?: string;
    photo_blur_enabled?: boolean;
    photos: { url: string; storage_path?: string; is_primary: boolean; blur_data_uri?: string | null }[];
    compatibility_score?: number;
  };
}

const DAILY_LIKE_LIMIT = 5;

// ─── Extracted helpers (outside component to avoid re-creation) ───

const getPrimaryPhotoObj = (photos: { url: string; storage_path?: string; is_primary: boolean; blur_data_uri?: string | null }[]) => {
  return photos.find(p => p.is_primary) || photos[0] || null;
};

// ─── Extracted card components (React.memo prevents remount on parent re-render) ───

const LikeCard = React.memo(({ like, onPass, onLikeBack, isAdmin }: {
  like: LikeProfile; onPass: (id: string) => void; onLikeBack: (id: string) => void; isAdmin: boolean;
}) => {
  const { t } = useTranslation();
  const primaryPhoto = getPrimaryPhotoObj(like.profile.photos);
  const shouldBlur = (like.profile.photo_blur_enabled || false) && !isAdmin;
  const { imageUri, blurRadius, onImageLoad, onImageError } = usePhotoBlur({
    shouldBlur,
    photoUrl: primaryPhoto?.url || 'https://via.placeholder.com/400x600?text=No+Photo',
    blurDataUri: primaryPhoto?.blur_data_uri,
    blurIntensity: 30,
  });
  const parsedContent = useMemo(() => {
    if (!like.liked_content) return null;
    try { return JSON.parse(like.liked_content); } catch { return null; }
  }, [like.liked_content]);

  return (
    <View className="w-[47%]">
      <TouchableOpacity activeOpacity={0.9} onPress={() => router.push(`/profile/${like.profile_id}`)}>
        <View style={styles.likeCard}>
          <View className="aspect-[3/4] overflow-hidden bg-card">
            <SafeBlurImage source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" blurRadius={blurRadius} onLoad={onImageLoad} onError={onImageError} />
            {like.like_type === 'super_like' && (
              <View style={styles.superLikeBadge}>
                <MaterialCommunityIcons name="star" size={14} color="#FFD700" />
                <Text style={styles.superLikeBadgeText}>{t('likes.superLike', { defaultValue: 'Super Like' })}</Text>
              </View>
            )}
            <View className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
              <Text className="text-white font-sans-bold text-body-lg">
                {like.profile.display_name}{like.profile.age ? `, ${like.profile.age}` : ''}
              </Text>
              {(like.profile.location_city || like.profile.location_state) && (
                <Text className="text-white/80 font-sans text-body-sm mt-0.5">
                  {[like.profile.location_city, like.profile.location_state].filter(Boolean).join(', ')}
                </Text>
              )}
            </View>
          </View>
          <LikedContentSection parsedContent={parsedContent} message={like.message} />
        </View>
      </TouchableOpacity>
      <View className="flex-row gap-2 mt-3">
        <TouchableOpacity onPress={() => onPass(like.id)} className="flex-1 bg-muted py-3 rounded-full items-center">
          <Ionicons name="close" size={24} color="#71717A" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onLikeBack(like.profile_id)} className="flex-1 bg-lavender-500 py-3 rounded-full items-center">
          <Ionicons name="heart" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const BlurredPreviewCard = React.memo(({ like, isAdmin }: { like: LikeProfile; isAdmin: boolean }) => {
  const primaryPhoto = getPrimaryPhotoObj(like.profile.photos);
  const hasPrivacyBlur = (like.profile.photo_blur_enabled || false) && !isAdmin;
  const { imageUri, blurRadius: privacyBlurRadius, onImageLoad, onImageError } = usePhotoBlur({
    shouldBlur: hasPrivacyBlur,
    photoUrl: primaryPhoto?.url || 'https://via.placeholder.com/400x600?text=No+Photo',
    blurDataUri: primaryPhoto?.blur_data_uri,
    blurIntensity: 30,
  });
  const paywallBlurRadius = hasPrivacyBlur ? privacyBlurRadius : 30;

  return (
    <View className="w-[47%] aspect-[3/4] rounded-2xl overflow-hidden bg-muted">
      <SafeBlurImage source={{ uri: imageUri }} className="w-full h-full" blurRadius={paywallBlurRadius} onLoad={onImageLoad} onError={onImageError} />
      <View className="absolute inset-0 bg-black/30 items-center justify-center">
        <Ionicons name="heart" size={40} color="white" />
      </View>
    </View>
  );
});

const FreeLikeCard = React.memo(({ like, onPass, onLikeBack, onUpgrade }: {
  like: LikeProfile; onPass: (id: string) => void; onLikeBack: (id: string) => void; onUpgrade: () => void;
}) => {
  const { t } = useTranslation();
  const primaryPhoto = getPrimaryPhotoObj(like.profile.photos);
  const { imageUri, blurRadius: privacyBlurRadius, onImageLoad, onImageError } = usePhotoBlur({
    shouldBlur: true,
    photoUrl: primaryPhoto?.url || 'https://via.placeholder.com/400x600?text=No+Photo',
    blurDataUri: primaryPhoto?.blur_data_uri,
    blurIntensity: 30,
  });
  const parsedContent = useMemo(() => {
    if (!like.liked_content) return null;
    try { return JSON.parse(like.liked_content); } catch { return null; }
  }, [like.liked_content]);

  return (
    <View className="w-[47%]">
      <View style={styles.likeCard}>
        <TouchableOpacity onPress={onUpgrade} activeOpacity={0.8} className="aspect-[3/4] overflow-hidden bg-card">
          <SafeBlurImage source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" blurRadius={privacyBlurRadius} onLoad={onImageLoad} onError={onImageError} />
          {like.like_type === 'super_like' && (
            <View style={styles.superLikeBadge}>
              <MaterialCommunityIcons name="star" size={14} color="#FFD700" />
              <Text style={styles.superLikeBadgeText}>{t('likes.superLike', { defaultValue: 'Super Like' })}</Text>
            </View>
          )}
          <View className="absolute inset-0 items-center justify-center">
            <Ionicons name="heart" size={32} color="white" />
            <View className="mt-2 bg-white/20 px-3 py-1 rounded-full">
              <Text className="text-white text-xs font-sans-bold">{t('likes.freeUser.revealPhoto')}</Text>
            </View>
          </View>
        </TouchableOpacity>
        <LikedContentSection parsedContent={parsedContent} message={like.message} />
      </View>
      <View className="flex-row gap-2 mt-3">
        <TouchableOpacity onPress={() => onPass(like.id)} className="flex-1 bg-muted py-3 rounded-full items-center">
          <Ionicons name="close" size={24} color="#71717A" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onLikeBack(like.profile_id)} className="flex-1 bg-lavender-500 py-3 rounded-full items-center">
          <Ionicons name="heart" size={24} color="white" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

// Extracted liked content display (prompt card / photo thumbnail / message)
const LikedContentSection = React.memo(({ parsedContent, message }: { parsedContent: any; message?: string }) => {
  if (!parsedContent && !message) return null;
  return (
    <View style={styles.likeContentSection}>
      {parsedContent?.type === 'prompt' && parsedContent.prompt && (
        <View style={styles.likedPromptCard}>
          <View style={styles.likedPromptBorder} />
          <View style={styles.likedPromptContent}>
            <Text style={styles.likedPromptQuestion} numberOfLines={1}>{parsedContent.prompt}</Text>
            {parsedContent.answer && (
              <Text style={styles.likedPromptAnswer} numberOfLines={2}>{"\u201C"}{parsedContent.answer}{"\u201D"}</Text>
            )}
          </View>
        </View>
      )}
      {parsedContent?.type === 'photo' && parsedContent.url && (
        <View style={styles.likedPhotoThumb}>
          <SafeBlurImage source={{ uri: parsedContent.url }} style={{ width: '100%', height: '100%', borderRadius: 8 }} resizeMode="cover" blurRadius={0} />
        </View>
      )}
      {message && (
        <View style={[
          styles.likeMessageContainer,
          (parsedContent?.type === 'prompt' || parsedContent?.type === 'photo') && styles.likeMessageSeparator,
        ]}>
          <MaterialCommunityIcons name="comment-text-outline" size={14} color="#A08AB7" style={{ marginTop: 2 }} />
          <Text style={styles.likeMessageText} numberOfLines={3}>{message}</Text>
        </View>
      )}
    </View>
  );
});

export default function Likes() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const profileDataContext = useProfileData();
  const { isPremium, isPlatinum } = useSubscription();
  const { refreshUnreadLikeCount, setUnreadLikeCount } = useNotifications();
  const { showToast } = useToast();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const rightSafeArea = isLandscape ? Math.max(insets.right, Platform.OS === 'android' ? 48 : 0) : 0;
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [likes, setLikes] = useState<LikeProfile[]>([]);
  const [likesCount, setLikesCount] = useState(0);
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
  const [currentUserPhotos, setCurrentUserPhotos] = useState<{ url: string; storage_path?: string; display_order: number }[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [dailyLikeCount, setDailyLikeCount] = useState(0);
  const currentProfileIdRef = useRef<string | null>(null);
  const initialLoadDone = useRef(false);

  // Load daily like count from AsyncStorage (shared with discover tab)
  const loadDailyLikeCount = async () => {
    try {
      const stored = await AsyncStorage.getItem('like_data');
      if (stored) {
        const { date, count } = JSON.parse(stored);
        const today = new Date().toDateString();
        if (date === today) {
          setDailyLikeCount(count);
        } else {
          setDailyLikeCount(0);
        }
      }
    } catch (error) {
      console.error('Error loading daily like count:', error);
    }
  };

  const incrementDailyLikeCount = async () => {
    const newCount = dailyLikeCount + 1;
    setDailyLikeCount(newCount);
    try {
      const today = new Date().toDateString();
      await AsyncStorage.setItem('like_data', JSON.stringify({ date: today, count: newCount }));
    } catch (error) {
      console.error('Error saving daily like count:', error);
    }
  };

  // Single mount effect: parallel Phase 0, then Phase 1 once we have profileId
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const init = async () => {
      try {
        // PERFORMANCE: Get profileId from shared context (already loaded by ProfileDataContext)
        // This eliminates an entire sequential network round trip.
        const cachedProfileId = profileDataContext?.profileId;

        // If context has profileId, skip the profile query entirely and run EVERYTHING in one Promise.all
        // If not (cold start), fetch profile first then run the rest
        let myProfileId: string;
        let myPhotos: any;
        let isAdminUser = false;

        if (cachedProfileId) {
          myProfileId = cachedProfileId;
        } else {
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .select('id, is_admin, photos(url, storage_path, is_primary, blur_data_uri, display_order)')
            .eq('user_id', user.id)
            .maybeSingle();
          if (profileError) throw profileError;
          if (!profileData) return;
          myProfileId = profileData.id;
          myPhotos = profileData.photos;
          isAdminUser = profileData.is_admin || false;
        }

        if (cancelled) return;
        currentProfileIdRef.current = myProfileId;
        setCurrentProfileId(myProfileId);

        // SINGLE round trip: ALL queries in parallel (likes, matches, passes, blocks, count, bans, profile photos)
        const [
          likesResult,
          matchesResult,
          passesResult,
          blockedByMeResult,
          blockedMeResult,
          countResult,
          bansResult,
          profileResult,
        ] = await Promise.all([
          supabase
            .from('likes')
            .select(`
              id,
              liker_profile_id,
              like_type,
              created_at,
              message,
              liked_content,
              liker_profile:profiles!likes_liker_profile_id_fkey (
                id,
                display_name,
                age,
                location_city,
                location_state,
                photo_blur_enabled,
                photos (
                  url,
                  storage_path,
                  is_primary,
                  blur_data_uri
                )
              )
            `)
            .eq('liked_profile_id', myProfileId)
            .order('created_at', { ascending: false }),
          supabase
            .from('matches')
            .select('profile1_id, profile2_id')
            .eq('status', 'active')
            .or(`profile1_id.eq.${myProfileId},profile2_id.eq.${myProfileId}`),
          supabase
            .from('passes')
            .select('passed_profile_id')
            .eq('passer_profile_id', myProfileId),
          supabase
            .from('blocks')
            .select('blocked_profile_id')
            .eq('blocker_profile_id', myProfileId),
          supabase
            .from('blocks')
            .select('blocker_profile_id')
            .eq('blocked_profile_id', myProfileId),
          supabase.rpc('count_unmatched_received_likes'),
          supabase
            .from('bans')
            .select('banned_profile_id')
            .not('banned_profile_id', 'is', null)
            .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString()),
          // Fetch own photos if not already loaded from context
          cachedProfileId
            ? supabase.from('profiles').select('is_admin, photos(url, storage_path, is_primary, blur_data_uri, display_order)').eq('id', myProfileId).maybeSingle()
            : Promise.resolve({ data: { is_admin: isAdminUser, photos: myPhotos }, error: null }),
          loadDailyLikeCount(),
        ]);

        if (cancelled) return;
        if (likesResult.error) throw likesResult.error;

        myPhotos = myPhotos || profileResult.data?.photos;
        setIsAdmin(profileResult.data?.is_admin || isAdminUser || false);
        setLikesCount(countResult.data || 0);

        if (cancelled) return;

        const matchedProfileIds = new Set(
          matchesResult.data?.flatMap(m => [m.profile1_id, m.profile2_id]) || []
        );
        const passedProfileIds = new Set(
          passesResult.data?.map(p => p.passed_profile_id) || []
        );
        const blockedProfileIds = new Set([
          ...(blockedByMeResult.data?.map(b => b.blocked_profile_id) || []),
          ...(blockedMeResult.data?.map(b => b.blocker_profile_id) || [])
        ]);
        const bannedProfileIds = new Set(
          bansResult.data?.map(b => b.banned_profile_id).filter(Boolean) || []
        );

        const formattedLikes: LikeProfile[] = (likesResult.data || [])
          .filter(like => {
            if (matchedProfileIds.has(like.liker_profile_id) ||
                passedProfileIds.has(like.liker_profile_id) ||
                blockedProfileIds.has(like.liker_profile_id) ||
                bannedProfileIds.has(like.liker_profile_id)) {
              return false;
            }
            const prof = Array.isArray(like.liker_profile) ? like.liker_profile[0] : like.liker_profile;
            if (!prof || !prof.photos || prof.photos.length === 0) return false;
            return true;
          })
          .map(like => {
            const likerProfile = Array.isArray(like.liker_profile) ? like.liker_profile[0] : like.liker_profile;
            return {
              id: like.id,
              profile_id: like.liker_profile_id,
              liked_at: like.created_at,
              like_type: like.like_type || 'standard',
              message: like.message || undefined,
              liked_content: like.liked_content || undefined,
              profile: {
                display_name: likerProfile.display_name,
                age: likerProfile.age,
                location_city: likerProfile.location_city,
                location_state: likerProfile.location_state,
                photo_blur_enabled: likerProfile.photo_blur_enabled || false,
                photos: likerProfile.photos || [],
              },
            };
          });

        // Sort super likes to the top, then by date
        formattedLikes.sort((a, b) => {
          const aSuper = a.like_type === 'super_like' ? 1 : 0;
          const bSuper = b.like_type === 'super_like' ? 1 : 0;
          if (aSuper !== bSuper) return bSuper - aSuper;
          return new Date(b.liked_at).getTime() - new Date(a.liked_at).getTime();
        });

        // PERFORMANCE: Show likes IMMEDIATELY with unsigned URLs, sign in background
        setLikes(formattedLikes);

        // Sync badge count with actual filtered results (not the RPC count which uses different criteria)
        const filteredCount = formattedLikes.length;
        if (filteredCount !== (countResult.data || 0)) {
          setLikesCount(filteredCount);
          setUnreadLikeCount(filteredCount);
        }

        // Sign photo URLs in background (non-blocking)
        const profilesToSign = formattedLikes.map(l => l.profile);
        signProfileMediaUrls(profilesToSign).then(signedProfiles => {
          if (cancelled) return;
          const signedLikes = formattedLikes.map((like, i) => ({
            ...like,
            profile: signedProfiles[i],
          }));
          setLikes(signedLikes);
        }).catch(err => console.warn('Error signing like photos:', err));

        initialLoadDone.current = true;

        // Deferred: sign current user's photos (needed for MatchModal, not for displaying likes list)
        // Fire non-blocking after main data is loaded
        signProfileMediaUrls([{ photos: myPhotos }]).then(([signedData]) => {
          if (cancelled) return;
          const signedPhotos = signedData?.photos || myPhotos || [];
          const sortedPhotos = [...signedPhotos].sort((a: any, b: any) => (a.display_order || 0) - (b.display_order || 0));
          setCurrentUserPhotos(sortedPhotos);
          const primaryPhoto = signedPhotos?.find((p: any) => p.is_primary)?.url || signedPhotos?.[0]?.url;
          setCurrentUserPhoto(primaryPhoto || null);
        }).catch(err => {
          console.error('Error signing current user photos:', err);
        });
      } catch (error) {
        console.error('Error loading likes:', error);
        Alert.alert(t('common.error'), t('likes.errorLoadingLikes'));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    init();
    return () => { cancelled = true; };
  }, [user]);

  // Refresh likes and daily count when screen regains focus (skip initial mount)
  useFocusEffect(
    useCallback(() => {
      if (initialLoadDone.current && currentProfileIdRef.current) {
        loadLikes();
      }
      loadDailyLikeCount();
    }, [currentProfileId])
  );

  const loadLikes = async () => {
    const profileId = currentProfileIdRef.current || currentProfileId;
    if (!profileId) return;

    try {
      setLoading(true);

      // Run all independent queries in parallel for ~5x faster load
      const [
        { data: countData },
        { data: likesData, error },
        { data: matches },
        { data: passes },
        { data: blockedByMe },
        { data: blockedMe },
        { data: bannedUsers },
      ] = await Promise.all([
        // 1. Count via secure RPC (works for all users, no profile IDs exposed)
        supabase.rpc('count_unmatched_received_likes'),
        // 2. All users can now view received likes (RLS updated)
        supabase
          .from('likes')
          .select(`
            id,
            liker_profile_id,
            like_type,
            created_at,
            message,
            liked_content,
            liker_profile:profiles!likes_liker_profile_id_fkey (
              id,
              display_name,
              age,
              location_city,
              location_state,
              photo_blur_enabled,
              photos (
                url,
                storage_path,
                is_primary,
                blur_data_uri
              )
            )
          `)
          .eq('liked_profile_id', profileId)
          .order('created_at', { ascending: false }),
        // 3. Filter out users we have ANY match with (active, unmatched, or blocked)
        supabase
          .from('matches')
          .select('profile1_id, profile2_id')
          .or(`profile1_id.eq.${profileId},profile2_id.eq.${profileId}`),
        // 4. Filter out users we've passed on
        supabase
          .from('passes')
          .select('passed_profile_id')
          .eq('passer_profile_id', profileId),
        // 5. SAFETY: Filter out blocked users (blocker direction)
        supabase
          .from('blocks')
          .select('blocked_profile_id')
          .eq('blocker_profile_id', profileId),
        // 6. SAFETY: Filter out blocked users (blocked direction)
        supabase
          .from('blocks')
          .select('blocker_profile_id')
          .eq('blocked_profile_id', profileId),
        // 7. CRITICAL SAFETY: Filter out banned users
        supabase
          .from('bans')
          .select('banned_profile_id')
          .not('banned_profile_id', 'is', null)
          .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString()),
      ]);

      setLikesCount(countData || 0);

      if (error) throw error;

      const matchedProfileIds = new Set(
        matches?.flatMap(m => [m.profile1_id, m.profile2_id]) || []
      );

      const passedProfileIds = new Set(
        passes?.map(p => p.passed_profile_id) || []
      );

      const blockedProfileIds = new Set([
        ...(blockedByMe?.map(b => b.blocked_profile_id) || []),
        ...(blockedMe?.map(b => b.blocker_profile_id) || [])
      ]);

      const bannedProfileIds = new Set(
        bannedUsers?.map(b => b.banned_profile_id).filter(Boolean) || []
      );

      const formattedLikes: LikeProfile[] = (likesData || [])
        .filter(like => {
          if (matchedProfileIds.has(like.liker_profile_id) ||
              passedProfileIds.has(like.liker_profile_id) ||
              blockedProfileIds.has(like.liker_profile_id) ||
              bannedProfileIds.has(like.liker_profile_id)) {
            return false;
          }
          // Exclude profiles with no approved photos
          const prof = Array.isArray(like.liker_profile) ? like.liker_profile[0] : like.liker_profile;
          if (!prof || !prof.photos || prof.photos.length === 0) return false;
          return true;
        })
        .map(like => {
          // Supabase returns joined data as array, extract first element
          const likerProfile = Array.isArray(like.liker_profile) ? like.liker_profile[0] : like.liker_profile;
          return {
            id: like.id,
            profile_id: like.liker_profile_id,
            liked_at: like.created_at,
            like_type: like.like_type || 'standard',
            message: like.message || undefined,
            liked_content: like.liked_content || undefined,
            profile: {
              display_name: likerProfile.display_name,
              age: likerProfile.age,
              location_city: likerProfile.location_city,
              location_state: likerProfile.location_state,
              photo_blur_enabled: likerProfile.photo_blur_enabled || false,
              photos: likerProfile.photos || [],
            },
          };
        });

      // Sign photo URLs for private storage buckets
      const profilesToSign = formattedLikes.map(l => l.profile);
      const signedProfiles = await signProfileMediaUrls(profilesToSign);
      const signedLikes = formattedLikes.map((like, i) => ({
        ...like,
        profile: signedProfiles[i],
      }));

      // Sort super likes to the top, then by date
      signedLikes.sort((a, b) => {
        const aSuper = a.like_type === 'super_like' ? 1 : 0;
        const bSuper = b.like_type === 'super_like' ? 1 : 0;
        if (aSuper !== bSuper) return bSuper - aSuper;
        return new Date(b.liked_at).getTime() - new Date(a.liked_at).getTime();
      });

      setLikes(signedLikes);

      // Sync displayed count & badge with actual filtered results
      // (the RPC doesn't filter no-photo profiles, so counts can drift)
      const filteredCount = signedLikes.length;
      if (filteredCount !== (countData || 0)) {
        setLikesCount(filteredCount);
        setUnreadLikeCount(filteredCount);
      }
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

    if (!isPremium && !isPlatinum) {
      // Check active match limit BEFORE consuming a daily like
      const { count: activeMatches } = await supabase
        .from('matches')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active')
        .or(`profile1_id.eq.${currentProfileId},profile2_id.eq.${currentProfileId}`);

      if ((activeMatches || 0) >= 10) {
        Alert.alert(
          t('likes.matchLimitTitle'),
          t('likes.matchLimitMessage'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('likes.goToMatches'), onPress: () => router.push('/(tabs)/matches') },
            { text: t('likes.freeUser.revealPhoto'), onPress: () => setShowPaywall(true) },
          ]
        );
        return;
      }

      // Check daily like limit
      await loadDailyLikeCount();
      const stored = await AsyncStorage.getItem('like_data');
      const currentCount = stored ? (() => { const d = JSON.parse(stored); return d.date === new Date().toDateString() ? d.count : 0; })() : 0;

      if (currentCount >= DAILY_LIKE_LIMIT) {
        showToast({ type: 'info', title: t('likes.freeUser.dailyLimitTitle'), message: t('likes.freeUser.dailyLimitMessage') });
        setShowPaywall(true);
        return;
      }
    }

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

      const { data: otherProfileRaw } = await supabase
        .from('profiles')
        .select(`
          *,
          preferences (*),
          photos (
            url,
            storage_path,
            is_primary,
            blur_data_uri
          )
        `)
        .eq('id', likeProfileId)
        .single();

      // Sign photo URLs for private storage buckets
      const [otherProfile] = otherProfileRaw
        ? await signProfileMediaUrls([otherProfileRaw])
        : [null];

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

      // Check if match already exists first (including unmatched ones)
      const { data: existingMatch } = await supabase
        .from('matches')
        .select('id, status')
        .eq('profile1_id', profile1Id)
        .eq('profile2_id', profile2Id)
        .maybeSingle();

      let matchData = existingMatch;

      if (existingMatch && existingMatch.status === 'unmatched') {
        // Reactivate a previously unmatched match
        const { data: reactivated, error: reactivateError } = await supabase
          .from('matches')
          .update({
            status: 'active',
            unmatched_by: null,
            unmatched_at: null,
            unmatch_reason: null,
            matched_at: new Date().toISOString(),
            compatibility_score: compatibilityScore,
          })
          .eq('id', existingMatch.id)
          .select('id')
          .single();

        if (reactivateError) throw reactivateError;
        matchData = reactivated;
      } else if (!existingMatch) {
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
          } else if (matchError.message?.includes('MATCH_LIMIT_REACHED')) {
            // Free user hit match cap — restore UI and show clear message
            loadLikes();
            Alert.alert(
              t('likes.matchLimitTitle'),
              t('likes.matchLimitMessage'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('likes.goToMatches'), onPress: () => router.push('/(tabs)/matches') },
                { text: t('likes.freeUser.revealPhoto'), onPress: () => setShowPaywall(true) },
              ]
            );
            return;
          } else {
            throw matchError;
          }
        } else {
          matchData = newMatch;
        }
      }

      // Get the other person's primary photo - respect photo_blur_enabled privacy
      const otherPrimaryPhoto = otherProfile?.photos?.find((p: any) => p.is_primary) || otherProfile?.photos?.[0];
      const otherPhotoBlurEnabled = otherProfile?.photo_blur_enabled || false;
      // If the other user has blur enabled, use the blur data URI (match != reveal)
      const otherPhoto = otherPhotoBlurEnabled && otherPrimaryPhoto?.blur_data_uri
        ? otherPrimaryPhoto.blur_data_uri
        : otherPrimaryPhoto?.url;

      // Show match modal
      setMatchedProfile({
        display_name: otherProfile?.display_name || t('common.someone'),
        photo_url: otherPhoto,
        compatibility_score: compatibilityScore || undefined,
      });
      setMatchId(matchData?.id || null);
      setShowMatchModal(true);

      // Increment daily like count for free users
      if (!isPremium && !isPlatinum) {
        await incrementDailyLikeCount();
      }

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

  const getPrimaryPhoto = (photos: { url: string; storage_path?: string; is_primary: boolean; blur_data_uri?: string | null }[]) => {
    const photo = getPrimaryPhotoObj(photos);
    return photo?.url || 'https://via.placeholder.com/400x600?text=No+Photo';
  };

  // Free users see blurred photos but visible messages
  if (!isPremium && !isPlatinum) {
    const likesRemaining = DAILY_LIKE_LIMIT - dailyLikeCount;

    return (
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="bg-background dark:bg-background px-6 pb-6 border-b border-border flex-row justify-between items-end" style={{ paddingTop: insets.top + 16 }}>
          <View>
            <Text className="text-heading-2xl font-display-bold text-foreground mb-2">
              {t('likes.title')} ({loading ? '...' : likesCount})
            </Text>
            <Text className="text-body-lg font-sans text-muted-foreground">
              {likesRemaining > 0
                ? t('likes.freeUser.likesRemaining', { count: likesRemaining })
                : t('likes.freeUser.noLikesRemaining')}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowPaywall(true)}
            style={{ padding: 8, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: 12 }}
          >
            <MaterialCommunityIcons name="eye-outline" size={24} color="#F59E0B" />
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
          <FlatList
            data={likes}
            keyExtractor={(item) => item.id}
            numColumns={2}
            columnWrapperStyle={{ gap: 12 }}
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 96, gap: 12 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#A08AB7" />}
            initialNumToRender={6}
            maxToRenderPerBatch={4}
            windowSize={5}
            removeClippedSubviews={true}
            ListHeaderComponent={
              <TouchableOpacity onPress={handleUpgrade} className="mb-1 rounded-2xl overflow-hidden">
                <LinearGradient colors={['#A08AB7', '#CDC2E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} className="px-4 py-3 flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <MaterialCommunityIcons name="crown" size={20} color="#FFD700" />
                    <Text className="text-white font-sans-bold text-body">{t('likes.freeUser.upgradeBanner')}</Text>
                  </View>
                </LinearGradient>
              </TouchableOpacity>
            }
            renderItem={({ item: like }) => (
              <FreeLikeCard like={like} onPass={handlePass} onLikeBack={handleLikeBack} onUpgrade={handleUpgrade} />
            )}
          />
        )}

        {showPaywall && (
          <PremiumPaywall
            visible={showPaywall}
            onClose={() => setShowPaywall(false)}
            variant="premium"
            feature="unlimited_swipes"
          />
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
        <TouchableOpacity
          onPress={() => router.push('/activity/viewers' as any)}
          style={{ padding: 8, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: 12 }}
        >
          <MaterialCommunityIcons name="eye-outline" size={24} color="#F59E0B" />
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
        <FlatList
          data={likes}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 24, paddingBottom: 96, gap: 12 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#A08AB7" />}
          initialNumToRender={6}
          maxToRenderPerBatch={4}
          windowSize={5}
          removeClippedSubviews={true}
          renderItem={({ item: like }) => (
            <LikeCard like={like} onPass={handlePass} onLikeBack={handleLikeBack} isAdmin={isAdmin} />
          )}
        />
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
  superLikeBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  superLikeBadgeText: {
    color: '#FFD700',
    fontSize: 11,
    fontWeight: '700',
  },
  likeCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  likeContentSection: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 6,
  },
  likedPromptCard: {
    flexDirection: 'row',
    backgroundColor: '#F8F5FB',
    borderRadius: 8,
    overflow: 'hidden',
  },
  likedPromptBorder: {
    width: 3,
    backgroundColor: '#A08AB7',
  },
  likedPromptContent: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 2,
  },
  likedPromptQuestion: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8B7BA3',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    lineHeight: 13,
  },
  likedPromptAnswer: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 17,
  },
  likedPhotoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  likedPhotoThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  likedPhotoLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  likeMessageContainer: {
    flexDirection: 'row',
    gap: 6,
    alignItems: 'flex-start',
  },
  likeMessageSeparator: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
  },
  likeMessageText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1F2937',
    lineHeight: 18,
    flex: 1,
  },
});
