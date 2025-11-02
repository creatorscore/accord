import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import SwipeCard from '@/components/matching/SwipeCard';
import ImmersiveProfileCard from '@/components/matching/ImmersiveProfileCard';
import MatchModal from '@/components/matching/MatchModal';
import PremiumPaywall from '@/components/premium/PremiumPaywall';
import FilterModal, { FilterOptions } from '@/components/matching/FilterModal';
import ProfileBoostModal from '@/components/premium/ProfileBoostModal';
import { sendMatchNotification, sendLikeNotification } from '@/lib/notifications';
import { calculateCompatibilityScore } from '@/lib/matching-algorithm';
import { initializeTracking } from '@/lib/tracking-permissions';
import { router } from 'expo-router';

interface Profile {
  id: string;
  display_name: string;
  age: number;
  gender?: string;
  sexual_orientation?: string;
  location_city?: string;
  location_state?: string;
  bio?: string;
  occupation?: string;
  education?: string;
  height_inches?: number;
  zodiac_sign?: string;
  personality_type?: string;
  love_language?: string;
  languages_spoken?: string[];
  my_story?: string;
  religion?: string;
  political_views?: string;
  hobbies?: string[];
  interests?: any; // JSONB object with arrays
  photos?: Array<{ url: string; is_primary: boolean }>;
  compatibility_score?: number;
  is_verified?: boolean;
  distance?: number;
  prompt_answers?: Array<{ prompt: string; answer: string }>;
  voice_intro_url?: string;
  voice_intro_duration?: number;
  photo_blur_enabled?: boolean;
  hide_distance?: boolean;
  hide_last_active?: boolean;
}

// Gender-balanced swipe limits for free users
// Men get unlimited swipes to encourage engagement
// Women get limited swipes to prevent oversaturation
const DAILY_SWIPE_LIMIT_WOMEN = 10;
const DAILY_SWIPE_LIMIT_MEN = 999999; // Effectively unlimited

export default function Discover() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isPremium, isPlatinum } = useSubscription();
  const insets = useSafeAreaInsets();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string | null>(null);
  const [currentUserGender, setCurrentUserGender] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [showImmersiveProfile, setShowImmersiveProfile] = useState(false);
  const [currentProfilePreferences, setCurrentProfilePreferences] = useState<any>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [swipeCount, setSwipeCount] = useState(0);
  const [superLikesRemaining, setSuperLikesRemaining] = useState(5);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    ageMin: 22,
    ageMax: 50,
    maxDistance: 100,
    religion: [],
    politicalViews: [],
    housingPreference: [],
    financialArrangement: [],
  });
  const [lastSwipe, setLastSwipe] = useState<{
    profile: Profile;
    action: 'like' | 'pass' | 'super_like';
    index: number;
  } | null>(null);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [showSearchBar, setShowSearchBar] = useState(false);

  useEffect(() => {
    loadCurrentProfile();
    loadSwipeCount();
    // Request tracking permission on first app use
    initializeTracking();
  }, []);

  useEffect(() => {
    if (currentProfileId) {
      loadSuperLikesCount();
    }
  }, [currentProfileId]);

  useEffect(() => {
    if (currentProfileId && filters) {
      loadProfiles();
    }
  }, [currentProfileId, filters]);

  // Reload profiles every time the screen comes into focus
  // This ensures fresh data when user returns from editing preferences or other screens
  useFocusEffect(
    useCallback(() => {
      if (currentProfileId) {
        console.log('🔄 Discovery screen focused - reloading profiles');
        loadProfiles();
      }
    }, [currentProfileId])
  );

  const [currentUserName, setCurrentUserName] = useState<string>('');

  const loadCurrentProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          gender,
          photos (
            url,
            is_primary,
            display_order
          ),
          preferences:preferences(*)
        `)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      const profileId = data.id;
      const displayName = data.display_name;
      const userGender = data.gender || null;

      // Get primary photo or first photo
      const photos = data.photos?.sort((a: any, b: any) => a.display_order - b.display_order);
      const primaryPhoto = photos?.find((p: any) => p.is_primary) || photos?.[0];
      const photoUrl = primaryPhoto?.url || null;

      // Initialize filters from user's database preferences
      const initialFilters = data.preferences ? {
        ageMin: data.preferences.age_min || 22,
        ageMax: data.preferences.age_max || 50,
        maxDistance: data.preferences.max_distance_miles || 100,
        religion: [],
        politicalViews: [],
        housingPreference: [],
        financialArrangement: [],
      } : filters;

      // Update all state at once to prevent multiple re-renders
      setCurrentProfileId(profileId);
      setCurrentUserName(displayName);
      setCurrentUserGender(userGender);
      setCurrentUserPhoto(photoUrl);
      setFilters(initialFilters);

      // Immediately start loading profiles to reduce perceived lag
      // Don't wait for next render cycle
      setLoading(false); // Remove initial loading state immediately
    } catch (error: any) {
      Alert.alert(t('common.error'), 'Failed to load your profile');
      setLoading(false);
    }
  };

  const loadSwipeCount = async () => {
    try {
      const today = new Date().toDateString();
      const storedData = await AsyncStorage.getItem('swipe_data');

      if (storedData) {
        const { date, count } = JSON.parse(storedData);
        // Reset count if it's a new day
        if (date === today) {
          setSwipeCount(count);
        } else {
          setSwipeCount(0);
          await AsyncStorage.setItem('swipe_data', JSON.stringify({ date: today, count: 0 }));
        }
      } else {
        setSwipeCount(0);
        await AsyncStorage.setItem('swipe_data', JSON.stringify({ date: today, count: 0 }));
      }
    } catch (error) {
      console.error('Error loading swipe count:', error);
    }
  };

  const incrementSwipeCount = async () => {
    const newCount = swipeCount + 1;
    setSwipeCount(newCount);

    try {
      const today = new Date().toDateString();
      await AsyncStorage.setItem('swipe_data', JSON.stringify({ date: today, count: newCount }));
    } catch (error) {
      console.error('Error saving swipe count:', error);
    }
  };

  const loadSuperLikesCount = async () => {
    if (!currentProfileId) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('super_likes_count, super_likes_reset_date')
        .eq('id', currentProfileId)
        .single();

      if (error) throw error;

      if (data) {
        const resetDate = new Date(data.super_likes_reset_date);
        const now = new Date();
        const daysSinceReset = Math.floor((now.getTime() - resetDate.getTime()) / (1000 * 60 * 60 * 24));

        // Reset if week has passed
        if (daysSinceReset >= 7) {
          setSuperLikesRemaining(5);
        } else {
          setSuperLikesRemaining(5 - (data.super_likes_count || 0));
        }
      }
    } catch (error) {
      console.error('Error loading super likes count:', error);
    }
  };

  const checkSwipeLimit = (): boolean => {
    // Premium users have unlimited swipes
    if (isPremium) return true;

    // Determine swipe limit based on gender
    // Men get effectively unlimited swipes to encourage male engagement
    // Women get limited swipes to prevent oversaturation
    const swipeLimit = currentUserGender === 'Woman' ? DAILY_SWIPE_LIMIT_WOMEN : DAILY_SWIPE_LIMIT_MEN;

    // Free users have daily limit (gender-based)
    if (swipeCount >= swipeLimit) {
      setShowPaywall(true);
      return false;
    }

    return true;
  };

  const loadProfiles = async () => {
    try {
      setLoading(true);

      if (!currentProfileId) {
        console.log('❌ No currentProfileId');
        return;
      }

      console.log('🔍 Loading profiles for:', currentProfileId);

      // Get profiles that:
      // 1. Are active
      // 2. Haven't been PASSED on yet (but INCLUDE people who liked you!)
      // 3. Match basic preferences

      // Get people you already LIKED (we'll exclude these)
      const { data: alreadySwipedLikes } = await supabase
        .from('likes')
        .select('liked_profile_id')
        .eq('liker_profile_id', currentProfileId);

      // Get people you already PASSED (we'll exclude these)
      const { data: alreadySwipedPasses } = await supabase
        .from('passes')
        .select('passed_profile_id')
        .eq('passer_profile_id', currentProfileId);

      // Get people who LIKED YOU (we'll PRIORITIZE these, not exclude!)
      const { data: peopleWhoLikedMe } = await supabase
        .from('likes')
        .select('liker_profile_id')
        .eq('liked_profile_id', currentProfileId);

      const peopleWhoLikedMeIds = new Set(peopleWhoLikedMe?.map(l => l.liker_profile_id) || []);
      console.log('❤️ People who liked you:', peopleWhoLikedMeIds.size);

      // SAFETY: Get blocked users (bidirectional blocking)
      // 1. Users that current user has blocked
      const { data: blockedByMe } = await supabase
        .from('blocks')
        .select('blocked_profile_id')
        .eq('blocker_profile_id', currentProfileId);

      // 2. Users who have blocked current user
      const { data: blockedMe } = await supabase
        .from('blocks')
        .select('blocker_profile_id')
        .eq('blocked_profile_id', currentProfileId);

      const blockedIds = [
        ...(blockedByMe?.map(b => b.blocked_profile_id) || []),
        ...(blockedMe?.map(b => b.blocker_profile_id) || [])
      ];

      console.log('🚫 Blocked users (bidirectional):', blockedIds.length);

      // Only exclude: already liked, already passed, and blocked users
      // DO NOT exclude people who liked you!
      const swipedIds = [
        ...(alreadySwipedLikes?.map(l => l.liked_profile_id) || []),
        ...(alreadySwipedPasses?.map(p => p.passed_profile_id) || []),
        ...blockedIds
      ];

      // Get current user's full profile and preferences for compatibility calculation
      const { data: currentUserData, error: currentUserError } = await supabase
        .from('profiles')
        .select(`
          *,
          preferences:preferences(*)
        `)
        .eq('id', currentProfileId)
        .single();

      if (currentUserError) throw currentUserError;

      // Get potential matches with all fields needed for compatibility
      let query = supabase
        .from('profiles')
        .select(`
          *,
          photos (
            url,
            is_primary,
            display_order
          ),
          preferences:preferences(*)
        `)
        .neq('id', currentProfileId)
        .eq('incognito_mode', false)
        .limit(20)
        .order('created_at', { ascending: false });

      if (swipedIds.length > 0) {
        query = query.not('id', 'in', `(${swipedIds.join(',')})`);
      }

      // Apply basic filters with wider range (±5 years) to allow more matches
      // Compatibility scoring will rank profiles closer to preferences higher
      const ageBuffer = 5;
      query = query
        .gte('age', Math.max(18, filters.ageMin - ageBuffer))
        .lte('age', Math.min(100, filters.ageMax + ageBuffer));

      // Apply gender preference filter (hard filter for all users)
      // Users can multi-select genders, so this should be a hard requirement
      if (currentUserData.preferences?.gender_preference && currentUserData.preferences.gender_preference.length > 0) {
        query = query.in('gender', currentUserData.preferences.gender_preference);
      }

      // Apply premium filters (only if user is premium AND filters are set)
      if (isPremium) {
        // Religion filter
        if (filters.religion.length > 0) {
          query = query.in('religion', filters.religion);
        }

        // Political views filter
        if (filters.politicalViews.length > 0) {
          query = query.in('political_views', filters.politicalViews);
        }
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log('📊 Query returned profiles:', data?.length || 0);
      console.log('🔍 Swiped IDs:', swipedIds.length);

      // Check for boosted profiles
      const { data: boostedProfiles } = await supabase
        .from('boosts')
        .select('profile_id')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      const boostedProfileIds = new Set(boostedProfiles?.map(b => b.profile_id) || []);

      // Transform and calculate real compatibility scores
      const transformedProfiles: Profile[] = (data || [])
        .map((profile: any) => {
          // Calculate real compatibility score using the algorithm
          let compatibilityScore = 75; // Default if can't calculate

          try {
            if (currentUserData.preferences && profile.preferences) {
              compatibilityScore = calculateCompatibilityScore(
                currentUserData,
                profile,
                currentUserData.preferences,
                profile.preferences
              );
            }
          } catch (err) {
            console.error('Error calculating compatibility:', err);
          }

          // Calculate real distance using Haversine formula
          let distance = null;
          if (currentUserData.latitude && currentUserData.longitude && profile.latitude && profile.longitude) {
            const R = 3959; // Earth's radius in miles
            const dLat = ((profile.latitude - currentUserData.latitude) * Math.PI) / 180;
            const dLon = ((profile.longitude - currentUserData.longitude) * Math.PI) / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos((currentUserData.latitude * Math.PI) / 180) *
                Math.cos((profile.latitude * Math.PI) / 180) *
                Math.sin(dLon / 2) *
                Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            distance = Math.round(R * c);
          }

          return {
            id: profile.id,
            display_name: profile.display_name,
            age: profile.age,
            gender: profile.gender,
            sexual_orientation: profile.sexual_orientation,
            location_city: profile.location_city,
            location_state: profile.location_state,
            bio: profile.bio,
            occupation: profile.occupation,
            education: profile.education,
            height_inches: profile.height_inches,
            zodiac_sign: profile.zodiac_sign,
            personality_type: profile.personality_type,
            love_language: profile.love_language,
            languages_spoken: profile.languages_spoken,
            my_story: profile.my_story,
            religion: profile.religion,
            political_views: profile.political_views,
            hobbies: profile.hobbies,
            interests: profile.interests,
            is_verified: profile.is_verified,
            prompt_answers: profile.prompt_answers,
            photos: profile.photos?.sort((a: any, b: any) => a.display_order - b.display_order),
            compatibility_score: compatibilityScore,
            distance: distance,
            voice_intro_url: profile.voice_intro_url,
            voice_intro_duration: profile.voice_intro_duration,
            photo_blur_enabled: profile.photo_blur_enabled || false,
            hide_distance: profile.hide_distance || false,
            hide_last_active: profile.hide_last_active || false,
            preferences: profile.preferences,
          };
        })
        .filter((profile: any) => {
          // Apply client-side filters

          // Keyword search filter (if search is active)
          if (isSearchMode && searchKeyword.trim()) {
            const keyword = searchKeyword.toLowerCase().trim();

            // Build searchable text from all profile fields
            const searchableFields = [
              profile.bio,
              profile.my_story,
              profile.occupation,
              profile.education,
              profile.zodiac_sign,
              profile.personality_type,
              profile.love_language,
              profile.religion,
              profile.political_views,
              profile.location_city,
              profile.location_state,
              ...(profile.hobbies || []),
              ...(profile.languages_spoken || []),
              ...(profile.prompt_answers?.map((pa: any) => pa.answer) || []),
            ];

            // Handle interests (JSONB object with arrays)
            if (profile.interests && typeof profile.interests === 'object') {
              Object.values(profile.interests).forEach((arr: any) => {
                if (Array.isArray(arr)) {
                  searchableFields.push(...arr);
                }
              });
            }

            // Handle preferences fields (if searching in preferences is desired)
            if (profile.preferences) {
              const prefs = profile.preferences;
              searchableFields.push(
                prefs.primary_reason,
                prefs.relationship_type,
                prefs.financial_arrangement,
                prefs.housing_preference,
                prefs.children_arrangement
              );
            }

            const searchableText = searchableFields
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

            console.log('🔍 Search keyword:', keyword);
            console.log('📝 Searchable text sample:', searchableText.substring(0, 200));

            if (!searchableText.includes(keyword)) {
              return false;
            }
          }

          // Skip all preference-based filters when in keyword search mode
          // Keyword search supersedes the algorithm and lets users find anyone
          if (!isSearchMode) {
            // Location/Distance filter
            const userSearchGlobally = currentUserData.preferences?.search_globally || false;
            const profileSearchGlobally = profile.preferences?.search_globally || false;
            const userPreferredCities = currentUserData.preferences?.preferred_cities || [];
            const profilePreferredCities = profile.preferences?.preferred_cities || [];

            // Check if this profile matches user's preferred cities
            const profileMatchesPreferredCity = userPreferredCities.length > 0 && (
              userPreferredCities.some((city: string) => {
                const cityLower = city.toLowerCase();
                const profileCityLower = (profile.location_city || '').toLowerCase();
                const profileStateLower = (profile.location_state || '').toLowerCase();
                // Match if city name is in location_city or if "City, State" format matches
                return profileCityLower.includes(cityLower) ||
                       `${profileCityLower}, ${profileStateLower}`.includes(cityLower);
              })
            );

            // Check if user matches profile's preferred cities (bidirectional)
            const userMatchesProfilePreferredCity = profilePreferredCities.length > 0 && (
              profilePreferredCities.some((city: string) => {
                const cityLower = city.toLowerCase();
                const userCityLower = (currentUserData.location_city || '').toLowerCase();
                const userStateLower = (currentUserData.location_state || '').toLowerCase();
                return userCityLower.includes(cityLower) ||
                       `${userCityLower}, ${userStateLower}`.includes(cityLower);
              })
            );

            // Apply distance filter ONLY if:
            // 1. Neither user is searching globally
            // 2. Profile is NOT in user's preferred cities
            // 3. User is NOT in profile's preferred cities
            if (!userSearchGlobally && !profileSearchGlobally &&
                !profileMatchesPreferredCity && !userMatchesProfilePreferredCity) {
              // Neither is searching globally and no city match, apply distance filter
              if (profile.distance !== null && profile.distance > filters.maxDistance) {
                return false;
              }
            }

            // DEALBREAKER FILTERS (all users) - Based on onboarding preferences

            // 1. Bidirectional gender preference check
            if (profile.preferences?.gender_preference && currentUserData.gender) {
              if (!profile.preferences.gender_preference.includes(currentUserData.gender)) {
                return false; // They don't want my gender
              }
            }

            // 2. Children compatibility (hard dealbreaker)
            // If one definitely wants kids and the other definitely doesn't, filter out
            if (currentUserData.preferences?.wants_children !== undefined &&
                profile.preferences?.wants_children !== undefined) {
              const userWants = currentUserData.preferences.wants_children;
              const profileWants = profile.preferences.wants_children;

              // Hard incompatibility: one wants (true), one doesn't want (false)
              // 'maybe' (null) is flexible and compatible with either
              if ((userWants === true && profileWants === false) ||
                  (userWants === false && profileWants === true)) {
                return false;
              }
            }

            // 3. Relationship type compatibility
            // Filter out highly incompatible relationship types
            if (currentUserData.preferences?.relationship_type && profile.preferences?.relationship_type) {
              const userType = currentUserData.preferences.relationship_type;
              const profileType = profile.preferences.relationship_type;

              // Incompatible pairs: platonic with romantic (unless one is open)
              const incompatiblePairs = [
                ['platonic', 'romantic'],
                ['romantic', 'platonic']
              ];

              const isIncompatible = incompatiblePairs.some(
                ([type1, type2]) =>
                  (userType === type1 && profileType === type2)
              );

              if (isIncompatible) {
                return false;
              }
            }
          }

          // PREMIUM-ONLY FILTERS
          if (isPremium) {
            // Religion filter
            if (filters.religion.length > 0 && profile.religion) {
              if (!filters.religion.includes(profile.religion)) {
                return false;
              }
            }

            // Political views filter
            if (filters.politicalViews.length > 0 && profile.political_views) {
              if (!filters.politicalViews.includes(profile.political_views)) {
                return false;
              }
            }

            // Housing preference filter
            if (filters.housingPreference.length > 0 && profile.preferences?.housing_preference) {
              if (!filters.housingPreference.includes(profile.preferences.housing_preference)) {
                return false;
              }
            }

            // Financial arrangement filter
            if (filters.financialArrangement.length > 0 && profile.preferences?.financial_arrangement) {
              if (!filters.financialArrangement.includes(profile.preferences.financial_arrangement)) {
                return false;
              }
            }
          }

          return true;
        });

      // Log search results if in search mode
      if (isSearchMode) {
        console.log('🔍 Search results:', transformedProfiles.length, 'profiles matched keyword:', searchKeyword);
      }

      // Sort profiles:
      // 1. People who liked you (highest priority for mutual matching)
      // 2. Boosted profiles
      // 3. By compatibility score
      const sortedProfiles = transformedProfiles.sort((a, b) => {
        const aLikedYou = peopleWhoLikedMeIds.has(a.id);
        const bLikedYou = peopleWhoLikedMeIds.has(b.id);

        // People who liked you come FIRST (no paywall, instant match potential)
        if (aLikedYou && !bLikedYou) return -1;
        if (!aLikedYou && bLikedYou) return 1;

        // If both or neither liked you, then sort by boosted status
        const aIsBoosted = boostedProfileIds.has(a.id);
        const bIsBoosted = boostedProfileIds.has(b.id);

        if (aIsBoosted && !bIsBoosted) return -1;
        if (!aIsBoosted && bIsBoosted) return 1;

        // Otherwise sort by compatibility score
        return (b.compatibility_score || 0) - (a.compatibility_score || 0);
      });

      // Count how many profiles who liked you are in the feed
      const mutualInterestCount = sortedProfiles.filter(p => peopleWhoLikedMeIds.has(p.id)).length;

      console.log('✅ Setting profiles:', sortedProfiles.length);
      console.log('💕 Mutual interest profiles (liked you):', mutualInterestCount);
      console.log('🚀 Boosted profiles:', boostedProfileIds.size);
      setProfiles(sortedProfiles);
      setCurrentIndex(0);
    } catch (error: any) {
      console.error('❌ Error loading profiles:', error);
      Alert.alert(t('common.error'), error.message || 'Failed to load profiles');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSwipeLeft = useCallback(async () => {
    console.log('👈 Swipe left - Current index:', currentIndex, 'Total profiles:', profiles.length);

    if (!currentProfileId || currentIndex >= profiles.length) {
      console.log('❌ Cannot swipe - no profile or out of range');
      return;
    }

    // Check swipe limit
    if (!checkSwipeLimit()) return;

    const targetProfile = profiles[currentIndex];
    console.log('👈 Passing on:', targetProfile.display_name);

    try {
      // Insert pass into database
      await supabase.from('passes').insert({
        passer_profile_id: currentProfileId,
        passed_profile_id: targetProfile.id,
      });

      // Increment swipe count
      await incrementSwipeCount();

      // Track last swipe for rewind
      setLastSwipe({
        profile: targetProfile,
        action: 'pass',
        index: currentIndex,
      });

      // Move to next card
      const newIndex = currentIndex + 1;
      console.log('➡️ Moving to index:', newIndex);
      setCurrentIndex(newIndex);
    } catch (error: any) {
      console.error('❌ Error recording pass:', error);
    }
  }, [currentProfileId, currentIndex, profiles, swipeCount, isPremium]);

  const handleSwipeRight = useCallback(async () => {
    console.log('👉 Swipe right - Current index:', currentIndex, 'Total profiles:', profiles.length);

    if (!currentProfileId || currentIndex >= profiles.length) {
      console.log('❌ Cannot swipe - no profile or out of range');
      return;
    }

    // Check swipe limit
    if (!checkSwipeLimit()) return;

    const targetProfile = profiles[currentIndex];
    console.log('❤️ Liking:', targetProfile.display_name);

    try {
      // Insert like into database
      const { error: likeError } = await supabase.from('likes').insert({
        liker_profile_id: currentProfileId,
        liked_profile_id: targetProfile.id,
      });

      if (likeError) throw likeError;

      // Increment swipe count
      await incrementSwipeCount();

      // Check if the OTHER person has also liked you (mutual like check)
      const { data: mutualLike } = await supabase
        .from('likes')
        .select('id')
        .eq('liker_profile_id', targetProfile.id)
        .eq('liked_profile_id', currentProfileId)
        .single();

      if (mutualLike) {
        // It's a mutual match! Create the match
        console.log('💑 Mutual like found! Creating match...');

        const profile1Id = currentProfileId < targetProfile.id ? currentProfileId : targetProfile.id;
        const profile2Id = currentProfileId < targetProfile.id ? targetProfile.id : currentProfileId;

        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .insert({
            profile1_id: profile1Id,
            profile2_id: profile2Id,
            initiated_by: currentProfileId,
            compatibility_score: targetProfile.compatibility_score,
            status: 'active',
          })
          .select('id')
          .single();

        if (matchError) {
          console.error('❌ Match error:', matchError);
          // Still show the match modal even if database insert fails (they already matched)
          setMatchedProfile(targetProfile);
          setShowMatchModal(true);
        } else {
          console.log('✅ Match created:', matchData?.id);

          // Store match ID and show match modal
          setMatchId(matchData?.id || null);
          setMatchedProfile(targetProfile);
          setShowMatchModal(true);

          // Send match notification (don't await to avoid blocking modal)
          sendMatchNotification(targetProfile.id, currentUserName, currentProfileId, matchData?.id).catch(err => {
            console.error('Failed to send match notification:', err);
          });
        }
      } else {
        console.log('ℹ️ Like recorded, waiting for mutual like');
      }

      // Send like notification to the other user (so they know someone liked them)
      await sendLikeNotification(targetProfile.id, currentUserName, currentProfileId);

      // Track last swipe for rewind
      setLastSwipe({
        profile: targetProfile,
        action: 'like',
        index: currentIndex,
      });

      // Move to next card
      const newIndex = currentIndex + 1;
      console.log('➡️ Moving to index:', newIndex);
      setCurrentIndex(newIndex);
    } catch (error: any) {
      console.error('❌ Error recording like:', error);
    }
  }, [currentProfileId, currentIndex, profiles, swipeCount, isPremium]);

  const handleSwipeUp = useCallback(async () => {
    if (!currentProfileId || currentIndex >= profiles.length) return;

    const targetProfile = profiles[currentIndex];

    // Check premium status FIRST before any async operations
    if (!isPremium) {
      // Free users need to upgrade - show alert and return immediately
      Alert.alert(
        '💜 Upgrade to Premium',
        'Super likes are a Premium feature! Upgrade to send 5 super likes per week.',
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: 'Upgrade', onPress: () => setShowPaywall(true) },
        ]
      );
      return; // Don't proceed with the swipe
    }

    try {
      // Check super like limit for premium users
      const { data: profileData } = await supabase
        .from('profiles')
        .select('super_likes_count, super_likes_reset_date')
        .eq('id', currentProfileId)
        .single();

      if (profileData) {
        const resetDate = new Date(profileData.super_likes_reset_date);
        const now = new Date();
        const daysSinceReset = Math.floor((now.getTime() - resetDate.getTime()) / (1000 * 60 * 60 * 24));

        // Reset counter if it's been a week (Sunday to Sunday)
        let currentCount = profileData.super_likes_count || 0;
        if (daysSinceReset >= 7) {
          currentCount = 0;
          await supabase
            .from('profiles')
            .update({
              super_likes_count: 0,
              super_likes_reset_date: now.toISOString(),
            })
            .eq('id', currentProfileId);
        }

        // Check limit for premium users (5 per week)
        const weeklyLimit = 5;

        if (currentCount >= weeklyLimit) {
          // Premium users hit their limit
          Alert.alert(
            '✨ Super Like Limit Reached',
            `You've used all 5 super likes this week. Your super likes will reset next ${getDayName((resetDate.getDay() + 7) % 7)}.`,
            [{ text: 'OK' }]
          );
          return; // Don't proceed with the swipe
        }
      }

      // Insert "Obsessed" (super like) into database
      const { error: likeError } = await supabase.from('likes').insert({
        liker_profile_id: currentProfileId,
        liked_profile_id: targetProfile.id,
        like_type: 'super_like',
      });

      if (likeError) throw likeError;

      // Increment super like count
      await supabase
        .from('profiles')
        .update({
          super_likes_count: (profileData?.super_likes_count || 0) + 1,
        })
        .eq('id', currentProfileId);

      // Check if match already exists
      const profile1Id = currentProfileId < targetProfile.id ? currentProfileId : targetProfile.id;
      const profile2Id = currentProfileId < targetProfile.id ? targetProfile.id : currentProfileId;

      const { data: existingMatch } = await supabase
        .from('matches')
        .select('id')
        .eq('profile1_id', profile1Id)
        .eq('profile2_id', profile2Id)
        .single();

      if (!existingMatch) {
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .insert({
            profile1_id: profile1Id,
            profile2_id: profile2Id,
            initiated_by: currentProfileId,
            compatibility_score: targetProfile.compatibility_score,
            status: 'active',
          })
          .select('id')
          .single();

        if (matchError) throw matchError;
      }

      // Send "obsessed" notification to the other user
      await sendLikeNotification(targetProfile.id, currentUserName, currentProfileId);

      // Update super likes counter
      const remaining = 5 - ((profileData?.super_likes_count || 0) + 1);
      setSuperLikesRemaining(remaining);

      // Track last swipe for rewind
      setLastSwipe({
        profile: targetProfile,
        action: 'super_like',
        index: currentIndex,
      });

      // Show obsessed alert with counter
      Alert.alert(
        '💜 Obsessed!',
        isPremium
          ? `${targetProfile.display_name} will be notified that you're obsessed!\n\n${remaining} super likes remaining this week.`
          : `${targetProfile.display_name} will be notified that you're obsessed!`
      );

      // Move to next card
      setCurrentIndex(prev => prev + 1);
    } catch (error: any) {
      console.error('Error recording super like:', error);
      Alert.alert(t('common.error'), 'Failed to send super like. Please try again.');
    }
  }, [currentProfileId, currentIndex, profiles, isPremium]);

  // Helper function to get day name
  const getDayName = (day: number) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[day];
  };

  const handleRewind = useCallback(async () => {
    // Premium-only feature
    if (!isPremium) {
      Alert.alert(
        '💜 Upgrade to Premium',
        'Rewind is a Premium feature! Upgrade to undo your last swipe.',
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: 'Upgrade', onPress: () => setShowPaywall(true) },
        ]
      );
      return;
    }

    // Check if there's a last swipe to undo
    if (!lastSwipe) {
      Alert.alert('No Recent Swipes', 'There are no recent swipes to undo.');
      return;
    }

    if (!currentProfileId) return;

    try {
      console.log('⏪ Rewinding last swipe:', lastSwipe.action, 'on', lastSwipe.profile.display_name);

      // Delete the swipe from database based on action type
      if (lastSwipe.action === 'pass') {
        await supabase
          .from('passes')
          .delete()
          .eq('passer_profile_id', currentProfileId)
          .eq('passed_profile_id', lastSwipe.profile.id);
      } else if (lastSwipe.action === 'like' || lastSwipe.action === 'super_like') {
        await supabase
          .from('likes')
          .delete()
          .eq('liker_profile_id', currentProfileId)
          .eq('liked_profile_id', lastSwipe.profile.id);

        // Delete any match that was created
        const profile1Id = currentProfileId < lastSwipe.profile.id ? currentProfileId : lastSwipe.profile.id;
        const profile2Id = currentProfileId < lastSwipe.profile.id ? lastSwipe.profile.id : currentProfileId;

        await supabase
          .from('matches')
          .delete()
          .eq('profile1_id', profile1Id)
          .eq('profile2_id', profile2Id)
          .eq('initiated_by', currentProfileId);

        // If it was a super like, decrement the super likes count
        if (lastSwipe.action === 'super_like') {
          const { data: profileData } = await supabase
            .from('profiles')
            .select('super_likes_count')
            .eq('id', currentProfileId)
            .single();

          if (profileData) {
            const newCount = Math.max(0, (profileData.super_likes_count || 0) - 1);
            await supabase
              .from('profiles')
              .update({ super_likes_count: newCount })
              .eq('id', currentProfileId);

            setSuperLikesRemaining(5 - newCount);
          }
        }
      }

      // Decrement swipe count if not premium
      if (!isPremium && swipeCount > 0) {
        const newCount = swipeCount - 1;
        setSwipeCount(newCount);
        const today = new Date().toDateString();
        await AsyncStorage.setItem('swipe_data', JSON.stringify({ date: today, count: newCount }));
      }

      // Go back to the previous profile
      setCurrentIndex(lastSwipe.index);

      // Clear last swipe
      setLastSwipe(null);

      Alert.alert('✨ Rewound!', 'Your last swipe has been undone.');
    } catch (error: any) {
      console.error('❌ Error rewinding:', error);
      Alert.alert(t('common.error'), 'Failed to undo swipe. Please try again.');
    }
  }, [lastSwipe, currentProfileId, isPremium, swipeCount]);

  const handleProfilePress = useCallback(async () => {
    if (currentIndex >= profiles.length) return;
    const targetProfile = profiles[currentIndex];

    // Use preferences that are already embedded in the profile
    // from the main query (line 267: preferences:preferences(*))
    const prefs = (targetProfile as any).preferences;
    setCurrentProfilePreferences(prefs);
    setShowImmersiveProfile(true);
  }, [currentIndex, profiles]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadProfiles();
  };

  const handleSearch = () => {
    if (searchKeyword.trim()) {
      setIsSearchMode(true);
      setCurrentIndex(0);
      loadProfiles();
    }
  };

  const handleClearSearch = () => {
    setSearchKeyword('');
    setIsSearchMode(false);
    setCurrentIndex(0);
    loadProfiles();
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
  };

  const handleCloseImmersiveProfile = () => {
    setShowImmersiveProfile(false);
    setCurrentProfilePreferences(null);
  };

  const handleImmersiveSwipeLeft = () => {
    setShowImmersiveProfile(false);
    handleSwipeLeft();
  };

  const handleImmersiveSwipeRight = () => {
    setShowImmersiveProfile(false);
    handleSwipeRight();
  };

  const handleImmersiveSwipeUp = () => {
    setShowImmersiveProfile(false);
    handleSwipeUp();
  };

  const handleBlock = async () => {
    const currentProfile = profiles[currentIndex];
    if (!currentProfile) return;

    setShowImmersiveProfile(false);

    Alert.alert(
      'Block User',
      `Are you sure you want to block ${currentProfile.display_name}? They will no longer be able to see your profile or contact you.`,
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get current user's profile ID
              const { data: myProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', user?.id)
                .single();

              if (!myProfile) {
                throw new Error('Could not find your profile');
              }

              // Insert block record
              const { error } = await supabase
                .from('blocks')
                .insert({
                  blocker_profile_id: myProfile.id,
                  blocked_profile_id: currentProfile.id,
                  reason: 'Blocked from discover',
                });

              if (error) throw error;

              // Move to next profile
              setCurrentIndex((prev) => prev + 1);

              Alert.alert('Blocked', `You have blocked ${currentProfile.display_name}`);
            } catch (error: any) {
              console.error('Error blocking user:', error);
              Alert.alert(t('common.error'), 'Failed to block user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleReport = () => {
    const currentProfile = profiles[currentIndex];
    if (!currentProfile) return;

    setShowImmersiveProfile(false);

    Alert.prompt(
      'Report User',
      `Why are you reporting ${currentProfile.display_name}?`,
      [
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
        {
          text: t('common.submit'),
          onPress: async (reason) => {
            if (!reason || reason.trim() === '') {
              Alert.alert(t('common.error'), 'Please provide a reason for reporting.');
              return;
            }

            try {
              // Get current user's profile ID
              const { data: myProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', user?.id)
                .single();

              if (!myProfile) {
                throw new Error('Could not find your profile');
              }

              // Insert report
              const { error } = await supabase
                .from('reports')
                .insert({
                  reporter_profile_id: myProfile.id,
                  reported_profile_id: currentProfile.id,
                  reason: reason.trim(),
                  status: 'pending',
                });

              if (error) throw error;

              Alert.alert(
                'Report Submitted',
                'Thank you for helping keep Accord safe. Our team will review this report.'
              );
            } catch (error: any) {
              console.error('Error reporting user:', error);
              Alert.alert(t('common.error'), 'Failed to submit report. Please try again.');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  // Loading state
  if (loading) {
    return (
      <View className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="text-gray-600 mt-4">{t('discover.findingMatches')}</Text>
      </View>
    );
  }

  // Empty state - no more profiles
  if (currentIndex >= profiles.length) {
    console.log('📭 Empty state:', { currentIndex, profilesLength: profiles.length });
    return (
      <View className="flex-1 bg-cream">
        {/* Header with Search/Filter Controls */}
        <View className="bg-primary-500 pb-4 px-6" style={{ paddingTop: insets.top + 16 }}>
          <View className="flex-row justify-between items-center mb-3">
            <View className="flex-1 mr-2">
              <Text className="text-4xl font-bold text-white mb-1" numberOfLines={1} adjustsFontSizeToFit>
                {t('discover.title')}
              </Text>
              <Text className="text-white/90 text-base" numberOfLines={1}>
                {isSearchMode ? `Search for "${searchKeyword}"` : 'No more profiles to show'}
              </Text>
            </View>
            <View className="flex-row gap-2">
              {!isPremium && (
                <TouchableOpacity
                  className="bg-gold-500 rounded-full px-3 py-2 flex-row items-center gap-1"
                  style={{ backgroundColor: '#FFD700' }}
                  onPress={() => setShowPaywall(true)}
                >
                  <MaterialCommunityIcons name="crown" size={16} color="#8B5CF6" />
                  <Text className="text-primary-600 font-bold text-xs">Upgrade</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className="bg-white/20 rounded-full p-2.5"
                onPress={() => setShowSearchBar(!showSearchBar)}
              >
                <MaterialCommunityIcons name="magnify" size={20} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-white/20 rounded-full p-2.5"
                onPress={() => setShowFilterModal(true)}
              >
                <MaterialCommunityIcons name="filter-variant" size={20} color="white" />
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-white/20 rounded-full p-2.5"
                onPress={handleRefresh}
              >
                <MaterialCommunityIcons name="refresh" size={20} color="white" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Keyword Search Bar - Expanded when showSearchBar is true */}
          {showSearchBar && (
            <View className="mt-3">
              <View className="flex-row items-center bg-white/20 rounded-full px-4 py-2">
                <MaterialCommunityIcons name="magnify" size={20} color="white" />
                <TextInput
                  className="flex-1 ml-2 text-white text-base"
                  placeholder="Search by keyword (e.g., 'travel', 'vegan')"
                  placeholderTextColor="rgba(255, 255, 255, 0.6)"
                  value={searchKeyword}
                  onChangeText={setSearchKeyword}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                  autoFocus
                />
                {isSearchMode && (
                  <TouchableOpacity onPress={handleClearSearch} className="ml-2">
                    <MaterialCommunityIcons name="close-circle" size={20} color="white" />
                  </TouchableOpacity>
                )}
                {!isSearchMode && searchKeyword.trim() && (
                  <TouchableOpacity onPress={handleSearch} className="ml-2 bg-white/30 rounded-full px-3 py-1">
                    <Text className="text-white font-semibold text-sm">Search</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => {
                    setShowSearchBar(false);
                    if (isSearchMode) {
                      handleClearSearch();
                    }
                  }}
                  className="ml-2"
                >
                  <MaterialCommunityIcons name="close" size={20} color="white" />
                </TouchableOpacity>
              </View>
              {isSearchMode && (
                <Text className="text-white/80 text-xs mt-2 text-center">
                  💡 Tip: Like or pass to continue searching. Clear search to see all profiles.
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Empty State */}
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-6">✨</Text>
          <Text className="text-2xl font-bold text-charcoal mb-3 text-center">
            {isSearchMode ? `No results for "${searchKeyword}"` : t('discover.allCaughtUp')}
          </Text>
          <Text className="text-gray-600 mb-8 text-center text-lg">
            {isSearchMode
              ? "Try different keywords or adjust your filters to find more matches."
              : t('discover.checkBackSoon')}
          </Text>

          {isSearchMode ? (
            <TouchableOpacity
              className="bg-primary-500 rounded-full py-4 px-8 shadow-lg"
              onPress={handleClearSearch}
            >
              <Text className="text-white font-bold text-lg">Clear Search</Text>
            </TouchableOpacity>
          ) : (
            <View className="items-center gap-4">
              <TouchableOpacity
                className="bg-primary-500 rounded-full py-4 px-8 shadow-lg"
                onPress={() => setShowSearchBar(true)}
              >
                <Text className="text-white font-bold text-lg">Search by Keyword</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="border-2 border-primary-500 rounded-full py-4 px-8"
                onPress={handleRefresh}
              >
                <Text className="text-primary-500 font-bold text-lg">{t('discover.refresh')}</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Filter Modal */}
        <FilterModal
          visible={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          onApply={(newFilters) => {
            setFilters(newFilters);
            setShowFilterModal(false);
            handleRefresh();
          }}
          currentFilters={filters}
          isPremium={isPremium}
          onUpgrade={() => {
            setShowFilterModal(false);
            setShowPaywall(true);
          }}
        />

        {/* Premium Paywall */}
        <PremiumPaywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          variant="premium"
          feature="unlimited_swipes"
        />
      </View>
    );
  }

  const currentProfile = profiles[currentIndex];
  console.log('🎴 Rendering card:', {
    currentIndex,
    profilesLength: profiles.length,
    currentProfile: currentProfile ? {
      id: currentProfile.id,
      name: currentProfile.display_name
    } : 'null'
  });

  return (
    <View className="flex-1 bg-cream">
      {/* Header */}
      <View className="bg-primary-500 pb-4 px-6" style={{ paddingTop: insets.top + 16 }}>
        <View className="flex-row justify-between items-center mb-3">
          <View className="flex-1 mr-2">
            <Text className="text-4xl font-bold text-white mb-1" numberOfLines={1} adjustsFontSizeToFit>
              {t('discover.title')}
            </Text>
            <Text className="text-white/90 text-base" numberOfLines={1}>
              {isSearchMode ? `${profiles.length - currentIndex} matches for "${searchKeyword}"` : t('discover.profilesToExplore', { count: profiles.length - currentIndex })}
            </Text>
          </View>
          <View className="flex-row gap-2">
            {!isPremium && (
              <TouchableOpacity
                className="bg-gold-500 rounded-full px-3 py-2 flex-row items-center gap-1"
                style={{ backgroundColor: '#FFD700' }}
                onPress={() => setShowPaywall(true)}
              >
                <MaterialCommunityIcons name="crown" size={16} color="#8B5CF6" />
                <Text className="text-primary-600 font-bold text-xs">Upgrade</Text>
              </TouchableOpacity>
            )}
            {isPlatinum && (
              <TouchableOpacity
                className="rounded-full p-2.5"
                style={{ backgroundColor: 'rgba(255, 215, 0, 0.3)' }}
                onPress={() => setShowBoostModal(true)}
              >
                <MaterialCommunityIcons name="rocket" size={20} color="#FFD700" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              className="bg-white/20 rounded-full p-2.5"
              onPress={() => setShowSearchBar(!showSearchBar)}
            >
              <MaterialCommunityIcons name="magnify" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-white/20 rounded-full p-2.5"
              onPress={() => setShowFilterModal(true)}
            >
              <MaterialCommunityIcons name="filter-variant" size={20} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-white/20 rounded-full p-2.5"
              onPress={handleRefresh}
            >
              <MaterialCommunityIcons name="refresh" size={20} color="white" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Keyword Search Bar - Expanded when showSearchBar is true */}
        {showSearchBar && (
          <View className="mt-3">
            <View className="flex-row items-center bg-white/20 rounded-full px-4 py-2">
              <MaterialCommunityIcons name="magnify" size={20} color="white" />
              <TextInput
                className="flex-1 ml-2 text-white text-base"
                placeholder="Search by keyword (e.g., 'travel', 'vegan')"
                placeholderTextColor="rgba(255, 255, 255, 0.6)"
                value={searchKeyword}
                onChangeText={setSearchKeyword}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                autoFocus
              />
              {isSearchMode && (
                <TouchableOpacity onPress={handleClearSearch} className="ml-2">
                  <MaterialCommunityIcons name="close-circle" size={20} color="white" />
                </TouchableOpacity>
              )}
              {!isSearchMode && searchKeyword.trim() && (
                <TouchableOpacity onPress={handleSearch} className="ml-2 bg-white/30 rounded-full px-3 py-1">
                  <Text className="text-white font-semibold text-sm">Search</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={() => {
                  setShowSearchBar(false);
                  if (isSearchMode) {
                    handleClearSearch();
                  }
                }}
                className="ml-2"
              >
                <MaterialCommunityIcons name="close" size={20} color="white" />
              </TouchableOpacity>
            </View>
            {isSearchMode && (
              <Text className="text-white/80 text-xs mt-2 text-center">
                💡 Tip: Like or pass to continue searching. Clear search to see all profiles.
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Card Stack */}
      <View className="flex-1 relative">
        {/* Show current card and one behind it for depth */}
        {currentIndex + 1 < profiles.length && (
          <View className="absolute w-full h-full px-4 pt-4" style={{ opacity: 0.5, transform: [{ scale: 0.95 }] }}>
            <View className="flex-1 bg-gray-300 rounded-3xl" />
          </View>
        )}

        <SwipeCard
          profile={currentProfile}
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          onSwipeUp={handleSwipeUp}
          onPress={handleProfilePress}
        />
      </View>

      {/* Action Buttons */}
      <View className="pb-8 px-6">
        <View className="flex-row justify-center items-center gap-4">
          {/* Rewind Button */}
          <TouchableOpacity
            className={`rounded-full w-14 h-14 items-center justify-center shadow-lg ${
              lastSwipe && isPremium ? 'bg-accent-500' : 'bg-gray-300'
            }`}
            onPress={handleRewind}
            disabled={!lastSwipe && isPremium}
          >
            <MaterialCommunityIcons
              name="undo-variant"
              size={28}
              color={lastSwipe && isPremium ? 'white' : '#9CA3AF'}
            />
          </TouchableOpacity>

          {/* Pass Button */}
          <TouchableOpacity
            className="bg-white rounded-full w-16 h-16 items-center justify-center shadow-lg border-2 border-gray-200"
            onPress={handleSwipeLeft}
          >
            <MaterialCommunityIcons name="close" size={32} color="#EF4444" />
          </TouchableOpacity>

          {/* Obsessed Button (Super Like) */}
          <TouchableOpacity
            className="bg-primary-500 rounded-full w-16 h-16 items-center justify-center shadow-lg"
            onPress={handleSwipeUp}
          >
            <MaterialCommunityIcons name="star" size={32} color="white" />
          </TouchableOpacity>

          {/* Like Button */}
          <TouchableOpacity
            className="bg-white rounded-full w-16 h-16 items-center justify-center shadow-lg border-2 border-gray-200"
            onPress={handleSwipeRight}
          >
            <MaterialCommunityIcons name="heart" size={32} color="#10B981" />
          </TouchableOpacity>
        </View>

        {/* Action Labels */}
        <View className="flex-row justify-center items-center gap-4 mt-2">
          <Text className="text-gray-600 text-xs font-medium w-14 text-center">Rewind</Text>
          <Text className="text-gray-600 text-xs font-medium w-16 text-center">Pass</Text>
          <Text className="text-primary-600 text-xs font-bold w-16 text-center">Obsessed</Text>
          <Text className="text-gray-600 text-xs font-medium w-16 text-center">Like</Text>
        </View>
      </View>

      {/* Match Modal */}
      {matchedProfile && (
        <MatchModal
          visible={showMatchModal}
          onClose={handleCloseMatchModal}
          onSendMessage={handleSendMessage}
          matchedProfile={{
            display_name: matchedProfile.display_name,
            photo_url: matchedProfile.photos?.find(p => p.is_primary)?.url || matchedProfile.photos?.[0]?.url,
            compatibility_score: matchedProfile.compatibility_score,
          }}
          currentUserPhoto={currentUserPhoto || undefined}
        />
      )}

      {/* Immersive Profile Modal */}
      <Modal
        visible={showImmersiveProfile}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={handleCloseImmersiveProfile}
      >
        {currentIndex < profiles.length && (
          <ImmersiveProfileCard
            profile={profiles[currentIndex]}
            preferences={currentProfilePreferences}
            onSwipeLeft={handleImmersiveSwipeLeft}
            onSwipeRight={handleImmersiveSwipeRight}
            onSuperLike={handleImmersiveSwipeUp}
            onClose={handleCloseImmersiveProfile}
            visible={showImmersiveProfile}
            onBlock={handleBlock}
            onReport={handleReport}
          />
        )}
      </Modal>

      {/* Profile Boost Modal */}
      {currentProfileId && (
        <ProfileBoostModal
          visible={showBoostModal}
          onClose={() => setShowBoostModal(false)}
          profileId={currentProfileId}
          isPlatinum={isPlatinum}
          onUpgrade={() => {
            setShowBoostModal(false);
            setShowPaywall(true);
          }}
        />
      )}

      {/* Filter Modal */}
      <FilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        onApply={(newFilters) => {
          setFilters(newFilters);
          setShowFilterModal(false);
          handleRefresh();
        }}
        currentFilters={filters}
        isPremium={isPremium}
        onUpgrade={() => {
          setShowFilterModal(false);
          setShowPaywall(true);
        }}
      />

      {/* Premium Paywall */}
      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        variant="premium"
        feature="unlimited_swipes"
      />

      {/* Swipe Counter for Free Users (only show for women since men have unlimited) */}
      {!isPremium && currentUserGender === 'Woman' && (
        <View className="absolute bottom-32 right-6 bg-white rounded-full px-4 py-2 shadow-lg border-2 border-primary-500">
          <Text className="text-primary-600 font-bold text-sm">
            {t('discover.swipesRemaining', { count: swipeCount, limit: DAILY_SWIPE_LIMIT_WOMEN })}
          </Text>
        </View>
      )}

      {/* Super Like Counter for Premium Users */}
      {isPremium && (
        <View className="absolute bottom-32 right-6 bg-white rounded-full px-4 py-2 shadow-lg border-2 border-primary-500">
          <View className="flex-row items-center gap-1">
            <MaterialCommunityIcons name="star" size={16} color="#8B5CF6" />
            <Text className="text-primary-600 font-bold text-sm">
              {t('discover.superLikesRemaining', { count: superLikesRemaining })}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
