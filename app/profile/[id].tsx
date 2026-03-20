import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, StatusBar, StyleSheet } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { supabase } from '@/lib/supabase';
import { signPhotoUrls, getSignedUrl } from '@/lib/signed-urls';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { getCompatibilityBreakdown } from '@/lib/matching-algorithm';
import { calculateDistance } from '@/lib/geolocation';
import { formatHeight, HeightUnit } from '@/lib/height-utils';
import { translateProfileValue, translateProfileArray } from '@/lib/translate-profile-values';
import DiscoveryProfileView from '@/components/matching/DiscoveryProfileView';
import MatchModal from '@/components/matching/MatchModal';
import ModerationMenu from '@/components/moderation/ModerationMenu';
import { useScreenCaptureProtection } from '@/hooks/useScreenCaptureProtection';
import { ProfileSkeleton } from '@/components/shared/SkeletonScreens';

interface Photo {
  url: string;
  is_primary?: boolean;
  display_order?: number;
  caption?: string;
}

interface PromptAnswer {
  prompt: string;
  answer: string;
}

interface Profile {
  id: string;
  display_name: string;
  age: number;
  gender?: string | string[]; // Multi-select support
  pronouns?: string;
  ethnicity?: string | string[]; // Multi-select support
  sexual_orientation?: string | string[]; // Multi-select support
  location_city?: string;
  location_state?: string;
  is_verified?: boolean;
  photo_verified?: boolean;
  photos?: Photo[];
  prompt_answers?: PromptAnswer[];
  distance?: number;
  compatibility_score?: number;
  height_cm?: number;
  height_inches?: number;
  languages?: string[];
  zodiac_sign?: string;
  personality_type?: string;
  love_language?: string | string[]; // Multi-select support
  hobbies?: string[];
  interests?: {
    movies?: string[];
    music?: string[];
    books?: string[];
    tv_shows?: string[];
  };
  voice_intro_url?: string;
  voice_intro_duration?: number;
  religion?: string;
  political_views?: string;
  hometown?: string;
  occupation?: string;
  education?: string;
  photo_blur_enabled?: boolean;
}

interface Preferences {
  primary_reason?: string;
  primary_reasons?: string[]; // New multi-select field
  relationship_type?: string;
  wants_children?: boolean;
  housing_preference?: string | string[]; // Multi-select support
  financial_arrangement?: string | string[]; // Multi-select support
  children_arrangement?: string | string[]; // Multi-select support
  religion?: string;
  political_views?: string;
  smoking?: string;
  drinking?: string;
  pets?: string;
  public_relationship?: boolean;
  family_involvement?: string;
  children_timeline?: string;
  income_level?: string;
  willing_to_relocate?: boolean;
  search_globally?: boolean;
  preferred_cities?: string[];
  dealbreakers?: string[];
  must_haves?: string[];
  // Matching preferences
  age_min?: number;
  age_max?: number;
  gender_preference?: string[];
  max_distance_miles?: number;
  // Lifestyle preferences object
  lifestyle_preferences?: {
    smoking?: string;
    drinking?: string;
    pets?: string;
    exercise?: string;
  };
}

// Helper function to format arrays or strings
const formatArrayOrString = (value?: string | string[]): string => {
  if (!value) return '';

  // Handle actual arrays
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  // Handle PostgreSQL array format strings like "{value1,value2}"
  if (typeof value === 'string') {
    // Check if it's a PostgreSQL array string
    if (value.startsWith('{') && value.endsWith('}')) {
      const items = value.slice(1, -1).split(',');
      return items.join(', ');
    }
    // Check if it's a JSON array string like '["value1","value2"]'
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.join(', ');
        }
      } catch {
        // Not valid JSON, just return as-is
      }
    }
  }

  return value;
};

// Helper function to compare arrays (handles both arrays and strings)
const arraysEqual = (a?: string | string[], b?: string | string[]): boolean => {
  if (!a || !b) return false;

  // Normalize both to arrays
  const arrayA = Array.isArray(a) ? a : [a];
  const arrayB = Array.isArray(b) ? b : [b];

  if (arrayA.length !== arrayB.length) return false;

  // Sort and compare (order shouldn't matter for preferences)
  const sortedA = [...arrayA].sort();
  const sortedB = [...arrayB].sort();

  return sortedA.every((val, idx) => val === sortedB[idx]);
};

// Compatibility Bar Component (used in compatibility breakdown)
const _CompatibilityBar = ({ label, score, icon, color }: { label: string; score: number; icon: string; color: string }) => {
  const percentage = Math.round(score);

  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <MaterialCommunityIcons name={icon as any} size={18} color={color} />
          <Text style={{ fontSize: 14, color: '#374151', marginLeft: 8, fontWeight: '500' }}>
            {label}
          </Text>
        </View>
        <Text style={{ fontSize: 14, fontWeight: 'bold', color }}>
          {percentage}%
        </Text>
      </View>
      <View style={{ height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' }}>
        <MotiView
          from={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ type: 'timing', duration: 800 }}
          style={{ height: '100%', backgroundColor: color, borderRadius: 4 }}
        />
      </View>
    </View>
  );
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ProfileView() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isValidUUID = id ? UUID_REGEX.test(id) : false;
  const { user } = useAuth();
  const { isPremium, isPlatinum } = useSubscription();
  const insets = useSafeAreaInsets();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<any>(null);
  const [currentPreferences, setCurrentPreferences] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [compatibilityBreakdown, setCompatibilityBreakdown] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isSuperLiked, setIsSuperLiked] = useState(false);
  const [isMatched, setIsMatched] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false); // Admin can view any profile
  const [matchId, setMatchId] = useState<string | null>(null);
  const [hasRevealedPhotos, setHasRevealedPhotos] = useState(false); // Current user revealed to profile
  const [otherUserRevealed, setOtherUserRevealed] = useState(false); // Profile revealed to current user
  const [revealLoading, setRevealLoading] = useState(false);
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string | null>(null);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchModalMatchId, setMatchModalMatchId] = useState<string | null>(null);

  // Enable screenshot protection for this profile view
  useScreenCaptureProtection(true);

  useEffect(() => {
    loadCurrentProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (id && !isValidUUID) {
      Alert.alert(t('profileView.invalidProfile'), t('profileView.invalidProfileMsg'), [
        { text: t('common.goBack'), onPress: () => router.back() },
      ]);
      return;
    }
    if (id && currentProfileId) {
      loadProfile();
      checkIfMatched();
      // Record profile view (non-blocking, skip own profile)
      if (id !== currentProfileId) {
        Promise.resolve(supabase.rpc('record_profile_view', { p_viewer_id: currentProfileId, p_viewed_id: id })).catch(() => {});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentProfileId, currentPreferences]);

  // Skip redundant refetch on focus — the useEffect above already loads on id/currentProfileId change.
  // Only refetch if the profile ID changed (e.g., navigating from one profile to another).

  const loadCurrentProfile = async () => {
    try {
      // PERFORMANCE: Fetch profile+photos first, then preferences in parallel
      // NOTE: Cannot use JOIN for preferences — the admin RLS policy on preferences
      // causes statement timeouts when evaluated per-row inside a JOIN.
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select(`
          *,
          photos (
            url,
            storage_path,
            is_primary
          )
        `)
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;

      // Sign photos + fetch preferences in parallel (saves ~400ms vs sequential)
      const [signedPhotos, prefsResult] = await Promise.all([
        profileData.photos?.length ? signPhotoUrls(profileData.photos) : Promise.resolve(profileData.photos),
        supabase
          .from('preferences')
          .select('*')
          .eq('profile_id', profileData.id)
          .maybeSingle(),
      ]);

      if (signedPhotos) profileData.photos = signedPhotos;

      setCurrentProfileId(profileData.id);
      setCurrentProfile(profileData);
      setIsAdmin(profileData.is_admin === true);
      const primaryPhoto = profileData.photos?.find((p: any) => p.is_primary)?.url || profileData.photos?.[0]?.url;
      setCurrentUserPhoto(primaryPhoto || null);
      setCurrentPreferences(prefsResult.data || null);
    } catch (error: any) {
      console.error('Error loading current profile:', error);
    }
  };

  const checkIfMatched = async () => {
    if (!currentProfileId || !id) return;

    try {
      // First check if current user is an admin
      const { data: adminCheck } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', currentProfileId)
        .single();

      const isAdminUser = adminCheck?.is_admin === true;
      if (isAdminUser) {
        setIsAdmin(true);
      }

      // Check if there's an active match between current user and viewed profile
      const { data: match } = await supabase
        .from('matches')
        .select('id')
        .eq('status', 'active')
        .or(`and(profile1_id.eq.${currentProfileId},profile2_id.eq.${id}),and(profile1_id.eq.${id},profile2_id.eq.${currentProfileId})`)
        .maybeSingle();

      if (match) {
        setIsMatched(true);
        setMatchId(match.id);
        checkPhotoRevealStatus();
      } else {
        // Check if the viewed profile has liked the current user
        const { data: theirLikeId } = await supabase
          .rpc('check_mutual_like', { p_target_profile_id: id });

        // Allow viewing with like buttons if:
        // 1. Premium/Platinum user viewing someone who liked them
        // 2. Admin viewing someone who liked them (for testing)
        if ((isPremium || isPlatinum || isAdminUser) && theirLikeId) {
          setIsMatched(false); // Not matched yet, will show like/pass buttons
          setMatchId(null);
          return;
        }

        // Admin can view any profile even without a like
        if (isAdminUser) {
          // Check if there's an actual match with this profile (admin might be matched)
          const { data: adminMatch } = await supabase
            .from('matches')
            .select('id')
            .eq('status', 'active')
            .or(`and(profile1_id.eq.${currentProfileId},profile2_id.eq.${id}),and(profile1_id.eq.${id},profile2_id.eq.${currentProfileId})`)
            .maybeSingle();

          if (adminMatch) {
            setIsMatched(true);
            setMatchId(adminMatch.id);
          } else {
            setIsMatched(true); // Show as "matched" to allow viewing full profile
            setMatchId(null); // But no chat available
          }
          return;
        }

        // Not matched and no permission to view - redirect back
        setIsMatched(false);
        setMatchId(null);
        Alert.alert(t('profileView.notMatched'), t('profileView.notMatchedMsg'), [
          { text: t('common.ok'), onPress: () => router.back() }
        ]);
      }
    } catch {
      // Admin can always view profiles — don't redirect back on error
      if (isAdmin) {
        setIsMatched(true);
        setMatchId(null);
        return;
      }

      // Check if premium user viewing someone who liked them
      if (isPremium || isPlatinum) {
        try {
          const { data: theirLikeId } = await supabase
            .rpc('check_mutual_like', { p_target_profile_id: id });

          if (theirLikeId) {
            setIsMatched(false);
            setMatchId(null);
            return;
          }
        } catch (likeCheckError) {
          console.error('Error checking like status:', likeCheckError);
        }
      }

      // No match found and no permission - redirect back
      setIsMatched(false);
      setMatchId(null);
      Alert.alert(t('profileView.notMatched'), t('profileView.notMatchedMsg'), [
        { text: t('common.ok'), onPress: () => router.back() }
      ]);
    }
  };

  const checkPhotoRevealStatus = async () => {
    if (!currentProfileId || !id) return;

    try {
      // PERFORMANCE: Check both reveal directions in parallel
      const [myRevealResult, theirRevealResult] = await Promise.all([
        supabase
          .from('photo_reveals')
          .select('id')
          .eq('revealer_profile_id', currentProfileId)
          .eq('revealed_to_profile_id', id)
          .maybeSingle(),
        supabase
          .from('photo_reveals')
          .select('id')
          .eq('revealer_profile_id', id)
          .eq('revealed_to_profile_id', currentProfileId)
          .maybeSingle(),
      ]);

      setHasRevealedPhotos(!!myRevealResult.data);
      setOtherUserRevealed(!!theirRevealResult.data);
    } catch (error: any) {
      console.error('Error checking photo reveal status:', error);
    }
  };

  const togglePhotoReveal = async () => {
    if (!currentProfileId || !id || !matchId) {
      Alert.alert(t('common.error'), t('profileView.mustBeMatched'));
      return;
    }

    setRevealLoading(true);

    try {
      if (hasRevealedPhotos) {
        // Re-blur: Delete the reveal
        const { error } = await supabase
          .from('photo_reveals')
          .delete()
          .eq('revealer_profile_id', currentProfileId)
          .eq('revealed_to_profile_id', id);

        if (error) throw error;

        setHasRevealedPhotos(false);
        Alert.alert(t('profileView.photosBlurred'), t('profileView.photosBlurredMsg'));
      } else {
        // Reveal: Insert new reveal
        const { error } = await supabase
          .from('photo_reveals')
          .insert({
            revealer_profile_id: currentProfileId,
            revealed_to_profile_id: id,
            match_id: matchId,
          });

        if (error) throw error;

        setHasRevealedPhotos(true);
        Alert.alert(t('profileView.photosRevealed'), t('profileView.photosRevealedMsg', { name: profile?.display_name }));
      }
    } catch (error: any) {
      console.error('Error toggling photo reveal:', error);
      Alert.alert(t('common.error'), t('profileView.photoVisibilityError'));
    } finally {
      setRevealLoading(false);
    }
  };

  const loadProfile = async () => {
    try {
      setLoading(true);

      // PERFORMANCE: Run ban check + profile+prefs fetch in parallel (saves 1-2 round trips)
      const [banResult, profileResult, prefsResult] = await Promise.all([
        // Ban check
        supabase
          .from('bans')
          .select('id')
          .eq('banned_profile_id', id)
          .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
          .maybeSingle(),

        // Profile + photos (no preferences JOIN — admin RLS causes timeout in JOINs)
        supabase
          .from('profiles')
          .select(`
            id,
            display_name,
            age,
            gender,
            pronouns,
            ethnicity,
            sexual_orientation,
            location_city,
            location_state,
            latitude,
            longitude,
            is_verified,
            photo_verified,
            prompt_answers,
            interests,
            hobbies,
            voice_intro_url,
            voice_intro_duration,
            height_inches,
            zodiac_sign,
            personality_type,
            love_language,
            languages_spoken,
            hometown,
            occupation,
            education,
            religion,
            political_views,
            field_visibility,
            photo_blur_enabled,
            photos (
              url,
              storage_path,
              is_primary,
              display_order,
              blur_data_uri
            )
          `)
          .eq('id', id)
          .single(),

        // Preferences as separate query (avoids RLS timeout in JOINs)
        supabase
          .from('preferences')
          .select('*')
          .eq('profile_id', id)
          .maybeSingle(),
      ]);

      // Handle ban check
      if (banResult.data) {
        Alert.alert(
          t('common.error'),
          t('profileView.profileUnavailable'),
          [{ text: t('common.ok'), onPress: () => router.back() }]
        );
        setLoading(false);
        return;
      }

      const { data: profileData, error: profileError } = profileResult;
      if (profileError) throw profileError;

      const prefsData = prefsResult.data || null;

      // PERFORMANCE: Sign photos + voice intro in parallel
      const [signedPhotos, signedVoiceUrl] = await Promise.all([
        profileData.photos?.length ? signPhotoUrls(profileData.photos) : Promise.resolve(profileData.photos),
        profileData.voice_intro_url ? getSignedUrl('voice-intros', profileData.voice_intro_url) : Promise.resolve(null),
      ]);

      if (signedPhotos) profileData.photos = signedPhotos;
      if (signedVoiceUrl) profileData.voice_intro_url = signedVoiceUrl;

      // Transform profile data
      const transformedProfile: Profile = {
        ...profileData,
        photos: profileData.photos?.sort((a: Photo, b: Photo) =>
          (a.display_order || 0) - (b.display_order || 0)
        ),
        compatibility_score: 0, // Will be calculated below
        distance: calculateDistance(
          currentProfile?.latitude ?? null,
          currentProfile?.longitude ?? null,
          profileData.latitude ?? null,
          profileData.longitude ?? null
        ),
        // Use real data from database (no more mocking)
        height_inches: profileData.height_inches,
        height_cm: profileData.height_inches ? profileData.height_inches * 2.54 : undefined,
        languages: profileData.languages_spoken || [],
        zodiac_sign: profileData.zodiac_sign,
        personality_type: profileData.personality_type,
        love_language: profileData.love_language,
      };

      // Calculate real compatibility score if we have both profiles and preferences
      if (currentProfile && currentPreferences && prefsData) {
        try {
          // Use the built-in getCompatibilityBreakdown function
          const breakdown = getCompatibilityBreakdown(currentProfile, profileData, currentPreferences, prefsData);

          transformedProfile.compatibility_score = breakdown.total;

          // Store breakdown for detailed display
          setCompatibilityBreakdown({
            overall: breakdown.total,
            location: breakdown.location,
            goals: breakdown.goals,
            lifestyle: breakdown.lifestyle,
            personality: breakdown.personality,
            demographics: breakdown.demographics,
          });

        } catch (error) {
          console.error('Error calculating compatibility:', error);
        }
      }

      setProfile(transformedProfile);
      setPreferences(prefsData);
    } catch {
      Alert.alert(t('common.error'), t('profileView.loadError'));
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!currentProfileId || !id) return;

    setIsLiked(true);

    try {
      // Try to insert like (may fail if already exists)
      const { error: likeInsertError } = await supabase.from('likes').insert({
        liker_profile_id: currentProfileId,
        liked_profile_id: id,
      });

      // Ignore duplicate key errors - the like already exists
      if (likeInsertError && !likeInsertError.message?.includes('duplicate')) {
        throw likeInsertError;
      }

      // Check for mutual match
      const { data: mutualLikeId } = await supabase
        .rpc('check_mutual_like', { p_target_profile_id: id });

      if (mutualLikeId) {
        // Check if match already exists
        const profile1Id = currentProfileId < id ? currentProfileId : id;
        const profile2Id = currentProfileId < id ? id : currentProfileId;

        const { data: existingMatch } = await supabase
          .from('matches')
          .select('id, status')
          .eq('profile1_id', profile1Id)
          .eq('profile2_id', profile2Id)
          .maybeSingle();

        if (existingMatch?.status === 'active') {
          // Already matched
          Alert.alert(t('profileView.alreadyMatched'), t('profileView.alreadyMatchedMsg', { name: profile?.display_name }), [
            { text: t('profileView.actions.sendMessage'), onPress: () => router.push(`/chat/${existingMatch.id}`) },
            { text: t('common.ok'), onPress: () => router.back() }
          ]);
          return;
        }

        // Either no match or unmatched - create/recreate
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

        if (existingMatch && existingMatch.status === 'unmatched') {
          // Reactivate the unmatched record
          const { data: reactivatedMatch, error: updateError } = await supabase
            .from('matches')
            .update({
              status: 'active',
              matched_at: new Date().toISOString(),
              expires_at: expiresAt.toISOString(),
              unmatched_by: null,
              unmatched_at: null,
              unmatch_reason: null,
              first_message_sent_at: null,
            })
            .eq('id', existingMatch.id)
            .select('id')
            .single();

          if (updateError) throw updateError;

          setMatchModalMatchId(reactivatedMatch.id);
          setTimeout(() => setShowMatchModal(true), 500);
        } else {
          // Create new match
          const { data: newMatch, error: matchError } = await supabase.from('matches').insert({
            profile1_id: profile1Id,
            profile2_id: profile2Id,
            initiated_by: currentProfileId,
            compatibility_score: profile?.compatibility_score || null,
            status: 'active',
            expires_at: expiresAt.toISOString(),
          }).select('id').single();

          if (matchError) {
            if (matchError.message?.includes('MATCH_LIMIT_REACHED')) {
              Alert.alert(
                t('common.premiumRequired') || 'Premium Required',
                'You\'ve reached the free match limit (5). Upgrade to Premium for unlimited matches!',
                [{ text: t('common.ok') }]
              );
              setIsLiked(false);
              return;
            }
            throw matchError;
          }

          setMatchModalMatchId(newMatch.id);
          setTimeout(() => setShowMatchModal(true), 500);
        }
      } else {
        // No mutual like yet
        setTimeout(() => router.back(), 800);
      }
    } catch (error: any) {
      console.error('Error liking profile:', error);
      Alert.alert(t('common.error'), t('profileView.likeError'));
      setIsLiked(false);
    }
  };

  const handlePass = async () => {
    if (!currentProfileId || !id) return;

    try {
      await supabase.from('passes').insert({
        passer_profile_id: currentProfileId,
        passed_profile_id: id,
      });

      router.back();
    } catch {
      Alert.alert(t('common.error'), t('profileView.passError'));
    }
  };

  const handleObsessed = async () => {
    if (!currentProfileId || !id) return;

    setIsSuperLiked(true);

    try {
      // Insert super like
      const { error: superLikeError } = await supabase.from('likes').insert({
        liker_profile_id: currentProfileId,
        liked_profile_id: id,
      });

      if (superLikeError) {
        throw superLikeError;
      }

      // Check for mutual match
      const { data: mutualLikeId } = await supabase
        .rpc('check_mutual_like', { p_target_profile_id: id });

      if (mutualLikeId) {
        // It's a match!
        const profile1Id = currentProfileId < id ? currentProfileId : id;
        const profile2Id = currentProfileId < id ? id : currentProfileId;

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

        const { data: newMatch, error: matchError } = await supabase.from('matches').insert({
          profile1_id: profile1Id,
          profile2_id: profile2Id,
          initiated_by: currentProfileId,
          compatibility_score: profile?.compatibility_score || null,
          status: 'active',
          expires_at: expiresAt.toISOString(),
        }).select('id').single();

        if (matchError) throw matchError;

        setMatchModalMatchId(newMatch.id);
        setTimeout(() => setShowMatchModal(true), 500);
      } else {
        setTimeout(() => {
          Alert.alert(t('profileView.obsessed'), t('profileView.obsessedMsg', { name: profile?.display_name }), [
            { text: t('common.ok'), onPress: () => router.back() }
          ]);
        }, 500);
      }
    } catch {
      Alert.alert(t('common.error'), t('profileView.superLikeError'));
      setIsSuperLiked(false);
    }
  };

  // Value-to-label mappings for preferences (using i18n)
  const getPreferenceLabels = (): { [key: string]: string } => ({
    // Financial arrangements
    'separate': t('profileCard.preferences.financial.separate'),
    'shared_expenses': t('profileCard.preferences.financial.sharedExpenses'),
    'joint': t('profileCard.preferences.financial.joint'),
    'prenup_required': t('profileCard.preferences.financial.prenupRequired'),
    'flexible': t('profileCard.preferences.financial.flexible'),

    // Housing preferences
    'separate_spaces': t('profileCard.preferences.housing.separateSpaces'),
    'roommates': t('profileCard.preferences.housing.roommates'),
    'separate_homes': t('profileCard.preferences.housing.separateHomes'),
    'shared_bedroom': t('profileCard.preferences.housing.sharedBedroom'),

    // Children arrangements
    'biological': t('profileCard.preferences.children.biological'),
    'adoption': t('profileCard.preferences.children.adoption'),
    'co_parenting': t('profileCard.preferences.children.coParenting'),
    'surrogacy': t('profileCard.preferences.children.surrogacy'),
    'ivf': t('profileCard.preferences.children.ivf'),
    'already_have': t('profileCard.preferences.children.alreadyHave'),
    'open_discussion': t('profileCard.preferences.children.openDiscussion'),

    // Primary reasons
    'financial': t('profileCard.preferences.reasons.financial'),
    'immigration': t('profileCard.preferences.reasons.immigration'),
    'family_pressure': t('profileCard.preferences.reasons.familyPressure'),
    'legal_benefits': t('profileCard.preferences.reasons.legalBenefits'),
    'companionship': t('profileCard.preferences.reasons.companionship'),
    'safety': t('profileCard.preferences.reasons.safety'),

    // Relationship types
    'platonic': t('profileCard.preferences.relationship.platonic'),
    'romantic': t('profileCard.preferences.relationship.romantic'),
    'open': t('profileCard.preferences.relationship.open'),
  });

  const formatLabel = (value: any): string => {
    try {
      if (!value) return '';
      if (Array.isArray(value)) return value.filter(Boolean).map(formatLabel).join(', ');
      if (typeof value !== 'string') return String(value);
      const labels = getPreferenceLabels();
      if (labels[value]) return labels[value];
      return value.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    } catch {
      return typeof value === 'string' ? value : '';
    }
  };

  // Helper to format array fields and apply formatLabel to each item
  const formatArrayWithLabels = (value?: string | string[]): string => {
    if (!value) return '';

    let items: string[] = [];

    // Handle actual arrays
    if (Array.isArray(value)) {
      items = value;
    }
    // Handle PostgreSQL array format strings like "{value1,value2}"
    else if (typeof value === 'string') {
      if (value.startsWith('{') && value.endsWith('}')) {
        items = value.slice(1, -1).split(',');
      }
      // Check if it's a JSON array string
      else if (value.startsWith('[') && value.endsWith(']')) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) {
            items = parsed;
          } else {
            items = [value];
          }
        } catch {
          items = [value];
        }
      } else {
        items = [value];
      }
    }

    // Filter out empty/null/undefined items before mapping to prevent errors
    return items.filter(item => item && typeof item === 'string').map(formatLabel).join(', ');
  };

  if (loading) {
    return <ProfileSkeleton />;
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#6B7280' }}>{t('profileView.notFound')}</Text>
      </View>
    );
  }

  // Prepare quick facts
  // Use viewer's height unit preference to display height
  const viewerHeightUnit: HeightUnit = currentProfile?.height_unit || 'imperial';
  const quickFacts = [];
  if (profile.height_inches) {
    quickFacts.push({
      emoji: '📏',
      label: t('profileCard.vitals.height'),
      value: formatHeight(profile.height_inches, viewerHeightUnit),
    });
  }
  if (profile.zodiac_sign) {
    quickFacts.push({
      emoji: '✨',
      label: t('profileCard.vitals.zodiac'),
      value: translateProfileValue(t, 'zodiac_sign', profile.zodiac_sign),
    });
  }
  if (profile.personality_type) {
    quickFacts.push({
      emoji: '🧠',
      label: t('profileCard.vitals.personality'),
      value: profile.personality_type,
    });
  }
  if (profile.love_language) {
    quickFacts.push({
      emoji: '💖',
      label: t('profileCard.vitals.loveLanguage'),
      value: translateProfileArray(t, 'love_language', profile.love_language),
    });
  }
  if (profile.languages?.length) {
    quickFacts.push({
      emoji: '🌍',
      label: t('profileCard.vitals.languages'),
      value: translateProfileArray(t, 'languages_spoken', profile.languages),
    });
  }

  // Render "Why We Match" section
  const renderWhyWeMatch = () => {
    if (!compatibilityBreakdown || compatibilityBreakdown.overall < 0) return null;

    return (
      <MotiView
        from={{ opacity: 0, translateY: 20 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 500 }}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 20,
          padding: 20,
          marginBottom: 16,
          marginHorizontal: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <MaterialCommunityIcons name="heart-multiple" size={24} color="#A08AB7" />
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#000000', marginLeft: 12 }}>
            {t('profileView.compatibility.whyWeMatch')}
          </Text>
        </View>

        {/* Detailed Compatibility Breakdown */}
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 16 }}>
            {t('profileView.compatibility.whatMakesYouCompatible')}
          </Text>

          {/* Location Analysis */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#10B981" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginLeft: 8 }}>
                {t('profileView.compatibility.locationDistance')}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20 }}>
              {compatibilityBreakdown.location >= 80
                ? t('profileView.compatibility.locationHigh')
                : compatibilityBreakdown.location >= 60
                ? t('profileView.compatibility.locationMedium')
                : t('profileView.compatibility.locationLow')}
            </Text>
          </View>

          {/* Goals Analysis */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="target" size={20} color="#3B82F6" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginLeft: 8 }}>
                {t('profileView.compatibility.goalsVision')}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20 }}>
              {compatibilityBreakdown.goals >= 80
                ? t('profileView.compatibility.goalsHigh')
                : compatibilityBreakdown.goals >= 60
                ? t('profileView.compatibility.goalsMedium')
                : t('profileView.compatibility.goalsLow')}
            </Text>
          </View>

          {/* Lifestyle Analysis */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="coffee" size={20} color="#F59E0B" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginLeft: 8 }}>
                {t('profileView.compatibility.lifestyleValues')}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20 }}>
              {compatibilityBreakdown.lifestyle >= 80
                ? t('profileView.compatibility.lifestyleHigh')
                : compatibilityBreakdown.lifestyle >= 60
                ? t('profileView.compatibility.lifestyleMedium')
                : t('profileView.compatibility.lifestyleLow')}
            </Text>
          </View>

          {/* Personality Analysis */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="heart" size={20} color="#A08AB7" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginLeft: 8 }}>
                {t('profileView.compatibility.personalityInterests')}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20 }}>
              {compatibilityBreakdown.personality >= 75
                ? t('profileView.compatibility.personalityHigh')
                : compatibilityBreakdown.personality >= 60
                ? t('profileView.compatibility.personalityMedium')
                : t('profileView.compatibility.personalityLow')}
            </Text>
          </View>

          {/* Demographics Analysis */}
          <View style={{ marginBottom: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="account-group" size={20} color="#EC4899" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginLeft: 8 }}>
                {t('profileView.compatibility.backgroundValues')}
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20 }}>
              {compatibilityBreakdown.demographics >= 75
                ? t('profileView.compatibility.backgroundHigh')
                : compatibilityBreakdown.demographics >= 60
                ? t('profileView.compatibility.backgroundMedium')
                : t('profileView.compatibility.backgroundLow')}
            </Text>
          </View>
        </View>
      </MotiView>
    );
  };

  const handleMatchModalSendMessage = () => {
    setShowMatchModal(false);
    if (matchModalMatchId) {
      router.push(`/chat/${matchModalMatchId}`);
    }
  };

  const handleMatchModalClose = () => {
    setShowMatchModal(false);
    router.back();
  };

  // Transform profile for DiscoveryProfileView
  const transformedProfile = {
    ...profile,
    languages_spoken: profile.languages || [],
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <StatusBar barStyle="dark-content" />

      {/* Back Button */}
      <TouchableOpacity
        style={[styles.floatingButton, { top: insets.top + 8, left: 16, backgroundColor: 'rgba(255,255,255,0.9)' }]}
        onPress={() => router.back()}
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color={'#000000'} />
      </TouchableOpacity>

      {/* Report/Block Menu */}
      <View style={[styles.floatingButton, { top: insets.top + 8, right: 16, backgroundColor: 'rgba(255,255,255,0.9)' }]}>
        <ModerationMenu
          profileId={id}
          profileName={profile.display_name}
          matchId={matchId || undefined}
          currentProfileId={currentProfileId || undefined}
          onBlock={() => router.back()}
          onUnmatch={() => router.back()}
        />
      </View>

      <DiscoveryProfileView
        profile={transformedProfile as any}
        preferences={preferences || undefined}
        heightUnit={(currentProfile?.height_unit as 'imperial' | 'metric') || 'imperial'}
        hideActions={true}
        hideCompatibilityScore={false}
        isAdmin={isAdmin}
        isPhotoRevealed={otherUserRevealed}
        renderAdditionalContent={renderWhyWeMatch}
      />

      {/* Fixed Action Buttons with Animations */}
      {!isMatched ? (
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.9)', '#FFFFFF']}
          className="absolute bottom-0 left-0 right-0 pt-8"
          style={{ paddingBottom: Math.max(insets.bottom, 32) }}
        >
          <View className="flex-row justify-center items-center gap-4 px-6">
            {/* Pass Button */}
            <MotiView
              from={{ scale: 0, rotate: '-180deg' }}
              animate={{ scale: 1, rotate: '0deg' }}
              transition={{ type: 'spring', delay: 100 }}
            >
              <TouchableOpacity
                style={{ backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}
                className="rounded-full w-14 h-14 items-center justify-center shadow-xl border"
                onPress={handlePass}
                disabled={isLiked || isSuperLiked}
              >
                <MaterialCommunityIcons name="close" size={28} color="#EF4444" />
              </TouchableOpacity>
            </MotiView>

            {/* Obsessed Button */}
            <MotiView
              from={{ scale: 0 }}
              animate={{ scale: isSuperLiked ? [1, 1.2, 1] : 1 }}
              transition={{ type: 'spring', delay: 200 }}
            >
              <TouchableOpacity
                className={`rounded-full w-20 h-20 items-center justify-center shadow-xl ${
                  isSuperLiked ? 'bg-yellow-400' : 'bg-gradient-to-br from-purple-500 to-pink-500'
                }`}
                onPress={handleObsessed}
                disabled={isLiked || isSuperLiked}
                style={{
                  backgroundColor: isSuperLiked ? '#FBBF24' : '#A08AB7',
                }}
              >
                <MaterialCommunityIcons
                  name={isSuperLiked ? "star" : "star-outline"}
                  size={36}
                  color="white"
                />
              </TouchableOpacity>
            </MotiView>

            {/* Like Button */}
            <MotiView
              from={{ scale: 0, rotate: '180deg' }}
              animate={{ scale: isLiked ? [1, 1.2, 1] : 1, rotate: '0deg' }}
              transition={{ type: 'spring', delay: 300 }}
            >
              <TouchableOpacity
                style={isLiked ? { backgroundColor: '#22C55E' } : { backgroundColor: '#FFFFFF', borderColor: '#E5E7EB' }}
                className="rounded-full w-14 h-14 items-center justify-center shadow-xl border"
                onPress={handleLike}
                disabled={isLiked || isSuperLiked}
              >
                <MaterialCommunityIcons
                  name={isLiked ? "heart" : "heart-outline"}
                  size={28}
                  color={isLiked ? "white" : "#10B981"}
                />
              </TouchableOpacity>
            </MotiView>
          </View>

          {/* Action Labels */}
          <View className="flex-row justify-center items-center gap-8 mt-2 px-6">
            <Text className="text-xs text-gray-500 font-medium">{t('profileView.actions.pass')}</Text>
            <Text className="text-xs text-purple-600 font-bold">{t('profileView.actions.obsessed')}</Text>
            <Text className="text-xs text-gray-500 font-medium">{t('profileView.actions.like')}</Text>
          </View>
        </LinearGradient>
      ) : (
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.9)', '#FFFFFF']}
          className="absolute bottom-0 left-0 right-0 pt-8"
          style={{ paddingBottom: Math.max(insets.bottom, 32) }}
        >
          <View className="px-6 gap-3">
            {/* Photo Reveal Toggle - Only show if current user has photo blur enabled */}
            {currentProfile?.photo_blur_enabled && (
              <TouchableOpacity
                onPress={togglePhotoReveal}
                disabled={revealLoading}
                style={hasRevealedPhotos ? { backgroundColor: '#FFFFFF', borderColor: '#A08AB7' } : { backgroundColor: '#F3E8FF', borderColor: '#D8B4FE' }}
                className="rounded-full py-3 shadow-lg border-2"
              >
                <View className="flex-row items-center justify-center gap-2">
                  {revealLoading ? (
                    <ActivityIndicator size="small" color="#A08AB7" />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name={hasRevealedPhotos ? "eye-off" : "eye"}
                        size={22}
                        color="#A08AB7"
                      />
                      <Text className="text-purple-600 text-base font-semibold">
                        {hasRevealedPhotos ? t('profileView.actions.blurPhotos') : t('profileView.actions.revealPhotos')}
                      </Text>
                    </>
                  )}
                </View>
              </TouchableOpacity>
            )}

            {/* Status indicator - show if other user has photo blur enabled */}
            {profile?.photo_blur_enabled && (
              <View className="flex-row items-center justify-center gap-2 py-2">
                <MaterialCommunityIcons
                  name={otherUserRevealed ? "lock-open" : "lock"}
                  size={16}
                  color={otherUserRevealed ? "#10B981" : '#6B7280'}
                />
                <Text style={{ color: '#6B7280' }} className="text-xs">
                  {otherUserRevealed
                    ? t('profileView.revealedPhotos', { name: profile.display_name })
                    : t('profileView.blurredPhotos', { name: profile.display_name })}
                </Text>
              </View>
            )}

            {/* Send Message Button - Only show if we have a matchId */}
            {matchId ? (
              <TouchableOpacity
                onPress={() => router.push(`/chat/${matchId}`)}
                style={{ backgroundColor: '#1A1A1E' }}
                className="rounded-full py-4 mb-4"
              >
                <View className="flex-row items-center justify-center gap-2">
                  <MaterialCommunityIcons name="message-text" size={24} color="white" />
                  <Text className="text-white text-lg font-bold">{t('profileView.actions.sendMessage')}</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={{ backgroundColor: '#E5E7EB' }} className="rounded-full py-4">
                <View className="flex-row items-center justify-center gap-2">
                  <MaterialCommunityIcons name="eye" size={24} color={'#6B7280'} />
                  <Text style={{ color: '#6B7280' }} className="text-lg font-semibold">{t('profileView.viewingProfile')}</Text>
                </View>
              </View>
            )}
          </View>
        </LinearGradient>
      )}

      {/* Match Modal */}
      {profile && (
        <MatchModal
          visible={showMatchModal}
          onClose={handleMatchModalClose}
          onSendMessage={handleMatchModalSendMessage}
          matchedProfile={{
            display_name: profile.display_name,
            photo_url: profile.photos?.find(p => p.is_primary)?.url || profile.photos?.[0]?.url,
            compatibility_score: profile.compatibility_score,
          }}
          currentUserPhoto={currentUserPhoto || undefined}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  floatingButton: {
    position: 'absolute',
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
