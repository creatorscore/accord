import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, TextInput, Keyboard, ScrollView, Dimensions } from 'react-native';
import { MotiView } from 'moti';
import Slider from '@react-native-community/slider';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import { useScreenProtection } from '@/hooks/useScreenProtection';
import SwipeCard from '@/components/matching/SwipeCard';
import ImmersiveProfileCard from '@/components/matching/ImmersiveProfileCard';
import MatchModal from '@/components/matching/MatchModal';
import PremiumPaywall from '@/components/premium/PremiumPaywall';
import FilterModal, { FilterOptions } from '@/components/matching/FilterModal';
import ProfileBoostModal from '@/components/premium/ProfileBoostModal';
import ReportUserModal from '@/components/moderation/ReportUserModal';
import { sendMatchNotification, sendLikeNotification } from '@/lib/notifications';
import { calculateCompatibilityScore, getCompatibilityBreakdown } from '@/lib/matching-algorithm';
import { initializeTracking } from '@/lib/tracking-permissions';
import { DistanceUnit } from '@/lib/distance-utils';
import { HeightUnit } from '@/lib/height-utils';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { trackUserAction, trackFunnel } from '@/lib/analytics';
import { prefetchImages } from '@/components/shared/ConditionalImage';
import VerificationBanner from '@/components/shared/VerificationBanner';

interface Profile {
  id: string;
  display_name: string;
  age: number;
  gender?: string | string[]; // Can be single or array: users can select multiple gender identities
  sexual_orientation?: string | string[]; // Can be single or array: users can select multiple orientations
  ethnicity?: string | string[]; // Can be single or array: users can select multiple ethnicities
  location_city?: string;
  location_state?: string;
  bio?: string;
  occupation?: string;
  education?: string;
  height_inches?: number;
  zodiac_sign?: string;
  personality_type?: string;
  love_language?: string | string[]; // Can be single or array: users can select multiple love languages
  languages_spoken?: string[];
  religion?: string;
  political_views?: string;
  hobbies?: string[];
  interests?: any; // JSONB object with arrays
  photos?: Array<{ url: string; is_primary: boolean; display_order?: number }>;
  compatibility_score?: number;
  compatibilityBreakdown?: {
    total: number; // Changed from 'overall' to match matching-algorithm.ts
    location: number;
    goals: number;
    lifestyle: number;
    personality: number;
    demographics: number;
    orientation: number;
  };
  is_verified?: boolean;
  photo_verified?: boolean;
  distance?: number | null;
  prompt_answers?: Array<{ prompt: string; answer: string }>;
  voice_intro_url?: string;
  voice_intro_duration?: number;
  photo_blur_enabled?: boolean;
  hide_distance?: boolean;
  hide_last_active?: boolean;
  last_active_at?: string;
  preferences?: any;
}

// Daily swipe limit for free users (fair for everyone)
const DAILY_SWIPE_LIMIT = 25;

// Helper function to hash phone numbers for contact blocking
const hashPhoneNumber = async (phoneNumber: string): Promise<string> => {
  // Normalize phone number (remove spaces, dashes, etc.)
  const normalized = phoneNumber.replace(/[\s\-\(\)]/g, '');
  // Hash for privacy
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    normalized
  );
  return hash;
};

export default function Discover() {
  // Protect user profiles from screenshots
  useScreenProtection();

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
  const [distanceUnit, setDistanceUnit] = useState<DistanceUnit>('miles');
  const [heightUnit, setHeightUnit] = useState<HeightUnit>('imperial');
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportingProfile, setReportingProfile] = useState<{ id: string; name: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAgeSlider, setShowAgeSlider] = useState(false);
  const [showIntentionDropdown, setShowIntentionDropdown] = useState(false);
  const [selectedIntention, setSelectedIntention] = useState<string | null>(null);
  const [tempAgeMin, setTempAgeMin] = useState(22);
  const [tempAgeMax, setTempAgeMax] = useState(50);
  const [activeToday, setActiveToday] = useState(false);
  const [photoReviewRequired, setPhotoReviewRequired] = useState(false);
  const [isPhotoVerified, setIsPhotoVerified] = useState(true); // Default to true to hide banner initially
  const [showVerificationBanner, setShowVerificationBanner] = useState(false);

  // Quick filter options
  const INTENTIONS = [
    { label: 'All', value: null },
    { label: 'Platonic', value: 'platonic' },
    { label: 'Romantic', value: 'romantic' },
    { label: 'Open', value: 'open' },
  ];

  const getCurrentIntentionLabel = () => {
    const intention = INTENTIONS.find(i => i.value === selectedIntention);
    return intention ? intention.label : 'All';
  };

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
      if (currentProfileId && filters) {
        console.log('🔄 Discovery screen focused - reloading profiles');
        loadProfiles();
      }
    }, [currentProfileId, filters])
  );

  // Refresh photo verification status when screen comes into focus
  // This ensures the banner disappears after user completes verification
  useFocusEffect(
    useCallback(() => {
      const checkVerificationStatus = async () => {
        if (!user?.id) return;

        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('photo_verified')
            .eq('user_id', user.id)
            .single();

          if (!error && data) {
            setIsPhotoVerified(data.photo_verified || false);
            // Auto-hide banner if now verified
            if (data.photo_verified) {
              setShowVerificationBanner(false);
            }
          }
        } catch (e) {
          console.error('Error checking verification status:', e);
        }
      };

      checkVerificationStatus();
    }, [user?.id])
  );

  // Prefetch images for upcoming profiles as user swipes
  useEffect(() => {
    if (profiles.length > 0 && currentIndex < profiles.length) {
      // Prefetch next 3 profiles ahead
      const upcomingProfiles = profiles.slice(currentIndex, currentIndex + 3);
      const imagesToPrefetch = upcomingProfiles
        .flatMap(p => p.photos?.map(photo => photo.url) || [])
        .filter(Boolean);

      if (imagesToPrefetch.length > 0) {
        prefetchImages(imagesToPrefetch);
      }
    }
  }, [currentIndex, profiles]);

  const [currentUserName, setCurrentUserName] = useState<string>('');

  const loadCurrentProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          gender,
          height_unit,
          is_admin,
          photo_review_required,
          photo_verified,
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
      // Note: Supabase returns preferences as array even for single relationship
      const userPreferences = Array.isArray(data.preferences) ? data.preferences[0] : data.preferences;
      const initialFilters = userPreferences ? {
        ageMin: userPreferences.age_min || 22,
        ageMax: userPreferences.age_max || 50,
        maxDistance: userPreferences.max_distance_miles || 100,
        religion: [],
        politicalViews: [],
        housingPreference: [],
        financialArrangement: [],
      } : filters;

      // Load distance unit preference (default to 'miles' for backward compatibility)
      const userDistanceUnit = userPreferences?.distance_unit || 'miles';
      // Load height unit preference from profile (default to 'imperial' for backward compatibility)
      const userHeightUnit = data.height_unit || 'imperial';

      // Update all state at once to prevent multiple re-renders
      setCurrentProfileId(profileId);
      setCurrentUserName(displayName);
      setCurrentUserGender(userGender);
      setCurrentUserPhoto(photoUrl);
      setFilters(initialFilters);
      setDistanceUnit(userDistanceUnit as DistanceUnit);
      setHeightUnit(userHeightUnit as HeightUnit);
      setIsAdmin(data.is_admin || false);
      setPhotoReviewRequired(data.photo_review_required || false);
      setIsPhotoVerified(data.photo_verified || false);
      // Show verification banner if not verified (check AsyncStorage for dismiss state)
      if (!data.photo_verified) {
        AsyncStorage.getItem('verification_banner_dismissed').then((dismissed) => {
          if (!dismissed) {
            setShowVerificationBanner(true);
          }
        });
      }

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

    // Free users have daily limit (same for everyone)
    if (swipeCount >= DAILY_SWIPE_LIMIT) {
      setShowPaywall(true);
      return false;
    }

    return true;
  };

  const loadProfiles = async (searchModeOverride?: boolean, searchKeywordOverride?: string) => {
    // Use override values if provided, otherwise fall back to state
    // This fixes the React state timing issue where state updates are async
    const effectiveSearchMode = searchModeOverride !== undefined ? searchModeOverride : isSearchMode;
    const effectiveSearchKeyword = searchKeywordOverride !== undefined ? searchKeywordOverride : searchKeyword;

    try {
      setLoading(true);

      if (!currentProfileId) {
        return;
      }

      // Get profiles that:
      // 1. Are active
      // 2. Haven't been PASSED on yet (but INCLUDE people who liked you!)
      // 3. Match basic preferences

      // Run all exclusion queries in PARALLEL for better performance
      const [
        { data: alreadySwipedLikes },
        { data: alreadySwipedPasses },
        { data: peopleWhoLikedMe },
        { data: blockedByMe },
        { data: blockedMe },
        { data: contactBlocks },
        { data: bannedUsers },
      ] = await Promise.all([
        // Get people you already LIKED (we'll exclude these)
        supabase
          .from('likes')
          .select('liked_profile_id')
          .eq('liker_profile_id', currentProfileId),
        // Get people you already PASSED (we'll exclude these)
        supabase
          .from('passes')
          .select('passed_profile_id')
          .eq('passer_profile_id', currentProfileId),
        // Get people who LIKED YOU (we'll PRIORITIZE these, not exclude!)
        supabase
          .from('likes')
          .select('liker_profile_id')
          .eq('liked_profile_id', currentProfileId),
        // SAFETY: Users that current user has blocked
        supabase
          .from('blocks')
          .select('blocked_profile_id')
          .eq('blocker_profile_id', currentProfileId),
        // SAFETY: Users who have blocked current user
        supabase
          .from('blocks')
          .select('blocker_profile_id')
          .eq('blocked_profile_id', currentProfileId),
        // Contact-blocked phone numbers (hashed)
        supabase
          .from('contact_blocks')
          .select('phone_number')
          .eq('profile_id', currentProfileId),
        // CRITICAL SAFETY: Get ALL banned users (active bans that haven't expired)
        supabase
          .from('bans')
          .select('banned_profile_id')
          .not('banned_profile_id', 'is', null)
          .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString()),
      ]);

      const peopleWhoLikedMeIds = new Set(peopleWhoLikedMe?.map(l => l.liker_profile_id) || []);

      const blockedPhoneHashes = new Set(contactBlocks?.map(cb => cb.phone_number) || []);

      const blockedIds = [
        ...(blockedByMe?.map(b => b.blocked_profile_id) || []),
        ...(blockedMe?.map(b => b.blocker_profile_id) || [])
      ];

      const bannedProfileIds = bannedUsers?.map(b => b.banned_profile_id).filter(Boolean) || [];

      // Only exclude: already liked, already passed, blocked users, AND BANNED USERS
      // DO NOT exclude people who liked you!
      const swipedIds = [
        ...(alreadySwipedLikes?.map(l => l.liked_profile_id) || []),
        ...(alreadySwipedPasses?.map(p => p.passed_profile_id) || []),
        ...blockedIds,
        ...bannedProfileIds
      ];

      // Get current user's full profile and preferences for compatibility calculation
      const { data: currentUserDataRaw, error: currentUserError } = await supabase
        .from('profiles')
        .select(`
          *,
          preferences:preferences(*)
        `)
        .eq('id', currentProfileId)
        .single();

      if (currentUserError) throw currentUserError;

      // Extract preferences as single object (Supabase returns array for joined queries)
      const currentUserData = {
        ...currentUserDataRaw,
        preferences: Array.isArray(currentUserDataRaw.preferences)
          ? currentUserDataRaw.preferences[0]
          : currentUserDataRaw.preferences
      };

      // Check if user has global search enabled
      const isSearchingGlobally = currentUserData.preferences?.search_globally === true;
      console.log('🌍 Global search enabled:', isSearchingGlobally);

      // Get potential matches with all fields needed for compatibility
      // When searching globally or in search mode, fetch more profiles
      const shouldFetchMore = isSearchingGlobally || effectiveSearchMode;
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
        .eq('photo_review_required', false) // Hide profiles flagged for photo review
        .limit(shouldFetchMore ? 200 : 20) // Fetch more profiles when searching
        .order('created_at', { ascending: false });

      if (swipedIds.length > 0) {
        query = query.not('id', 'in', `(${swipedIds.join(',')})`);
      }

      // In SEARCH MODE: Skip age/gender filters at database level to get more potential matches
      // The keyword search + client-side filters will narrow down results
      if (effectiveSearchMode) {
        console.log('🔍 SEARCH MODE: Skipping database-level age/gender filters');
        // Only apply safety minimum age of 18
        query = query.gte('age', 18);
      } else {
        // Apply strict age filters (no buffer - respect user preferences exactly)
        // Safety: Always enforce minimum age of 18
        console.log('🔍 Applying age filter:', Math.max(18, filters.ageMin), '-', filters.ageMax);
        console.log('📋 Current user age:', currentUserData.age);
        query = query
          .gte('age', Math.max(18, filters.ageMin))
          .lte('age', filters.ageMax);

        // Apply gender preference filter (hard filter for all users)
        // Users can multi-select genders, so this should be a hard requirement
        // Use array overlap operator since gender is now an array in the database
        if (currentUserData.preferences?.gender_preference && currentUserData.preferences.gender_preference.length > 0) {
          // Convert gender_preference to array if it's a string (handles legacy data)
          const genderPrefArray = Array.isArray(currentUserData.preferences.gender_preference)
            ? currentUserData.preferences.gender_preference
            : currentUserData.preferences.gender_preference.split(',').map((g: string) => g.trim());

          // Use 'overlaps' operator for array-to-array matching
          // Format as PostgreSQL array literal with quoted values: {"value1","value2"}
          const pgArrayLiteral = `{${genderPrefArray.map((g: string) => `"${g}"`).join(',')}}`;
          console.log('🔍 Applying gender filter:', genderPrefArray, '→', pgArrayLiteral);
          query = query.filter('gender', 'ov', pgArrayLiteral);
        }
      }

      // Apply premium filters (only if user is premium AND filters are set AND not in search mode)
      if (isPremium && !effectiveSearchMode) {
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


      // Check for boosted profiles
      const { data: boostedProfiles } = await supabase
        .from('boosts')
        .select('profile_id')
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString());

      const boostedProfileIds = new Set(boostedProfiles?.map(b => b.profile_id) || []);

      // Filter out contact-blocked profiles (by phone number hash)
      // This happens BEFORE transformation to avoid unnecessary processing
      let filteredData = data || [];

      if (blockedPhoneHashes.size > 0) {
        // Hash each profile's phone number and filter out matches
        const filterPromises = filteredData.map(async (profile: any) => {
          if (profile.phone_number) {
            try {
              const phoneHash = await hashPhoneNumber(profile.phone_number);
              if (blockedPhoneHashes.has(phoneHash)) {
                return null; // Mark for removal
              }
            } catch (err) {
              console.error('Error hashing phone number:', err);
            }
          }
          return profile;
        });

        const filterResults = await Promise.all(filterPromises);
        filteredData = filterResults.filter(p => p !== null);
      }

      // SAFETY: Filter out profiles that have blocked viewer's country
      // This protects users who don't want to be seen by people in specific countries
      const userCountry = currentUserData.location_country || 'US';

      if (userCountry && filteredData.length > 0) {
        // Get profile IDs that have blocked the viewer's country
        const profileIds = filteredData.map((p: any) => p.id);
        const { data: countryBlockedProfiles } = await supabase
          .from('country_blocks')
          .select('profile_id')
          .eq('country_code', userCountry)
          .in('profile_id', profileIds);

        if (countryBlockedProfiles && countryBlockedProfiles.length > 0) {
          const countryBlockedIds = new Set(countryBlockedProfiles.map(cb => cb.profile_id));
          filteredData = filteredData.filter((p: any) => !countryBlockedIds.has(p.id));
        }
      }

      // Transform and calculate real compatibility scores
      const transformedProfiles: Profile[] = filteredData
        .map((profile: any) => {
          // Calculate real compatibility score and breakdown using the algorithm
          let compatibilityScore = 75; // Default if can't calculate
          let compatibilityBreakdown = undefined;

          try {
            if (currentUserData.preferences && profile.preferences) {
              compatibilityScore = calculateCompatibilityScore(
                currentUserData,
                profile,
                currentUserData.preferences,
                profile.preferences
              );

              // Also calculate detailed breakdown for display
              compatibilityBreakdown = getCompatibilityBreakdown(
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
            ethnicity: profile.ethnicity,
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
            religion: profile.religion,
            political_views: profile.political_views,
            hobbies: profile.hobbies,
            interests: profile.interests,
            is_verified: profile.is_verified,
            prompt_answers: profile.prompt_answers,
            photos: profile.photos?.sort((a: any, b: any) => a.display_order - b.display_order),
            compatibility_score: compatibilityScore,
            compatibilityBreakdown: compatibilityBreakdown,
            distance: distance,
            voice_intro_url: profile.voice_intro_url,
            voice_intro_duration: profile.voice_intro_duration,
            photo_blur_enabled: profile.photo_blur_enabled || false,
            hide_distance: profile.hide_distance || false,
            hide_last_active: profile.hide_last_active || false,
            last_active_at: profile.last_active_at,
            // Supabase returns preferences as array when using joined queries, extract first element
            preferences: Array.isArray(profile.preferences) ? profile.preferences[0] : profile.preferences,
          };
        })
        .filter((profile: any) => {
          // ====================================================================
          // SAFETY FILTERS (ALWAYS APPLIED - NO BYPASS)
          // ====================================================================

          // 1. CRITICAL: Minimum age verification (prevent underage users)
          if (profile.age < 18) {
            console.error('🚨 CRITICAL: Underage profile detected:', profile.id);
            return false;
          }

          // 2. CRITICAL: Incognito mode double-check (privacy protection)
          if (profile.incognito_mode === true) {
            return false;
          }

          // 3. CRITICAL: Blocked users double-check (safety protection)
          const allBlockedIds = [
            ...(blockedByMe?.map((b: any) => b.blocked_profile_id) || []),
            ...(blockedMe?.map((b: any) => b.blocker_profile_id) || [])
          ];
          if (allBlockedIds.includes(profile.id)) {
            return false;
          }

          // 4. CRITICAL: Photo requirement
          if (!profile.photos || profile.photos.length === 0) {
            return false;
          }

          // ====================================================================
          // KEYWORD SEARCH FILTER (if in search mode)
          // ====================================================================
          if (effectiveSearchMode && effectiveSearchKeyword.trim()) {
            const keyword = effectiveSearchKeyword.toLowerCase().trim();

            // Build searchable text from all profile fields
            const searchableFields = [
              profile.display_name, // Allow searching by name
              profile.bio,
              profile.occupation,
              profile.education,
              profile.zodiac_sign,
              profile.personality_type,
              profile.love_language,
              profile.religion,
              profile.political_views,
              profile.location_city,
              profile.location_state,
              profile.gender, // Allow searching by gender
              profile.sexual_orientation, // Allow searching by orientation
              profile.ethnicity, // Allow searching by ethnicity
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
                // Support both legacy primary_reason and new primary_reasons array
                prefs.primary_reasons ? prefs.primary_reasons.join(' ') : prefs.primary_reason,
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

            if (!searchableText.includes(keyword)) {
              return false; // Keyword not found
            }

            // In search mode, skip preference filters - show all keyword matches
            // Only apply critical safety filters (minimum age 18)
            if (profile.age < 18) {
              return false;
            }

            // Search matched and passes safety check - include this profile!
            return true;
          }

          // ====================================================================
          // DEALBREAKER FILTERS (only in NORMAL mode, not search mode)
          // ====================================================================

          // 1. STRICT AGE FILTER (no buffer, exact preferences)
          if (profile.age < filters.ageMin || profile.age > filters.ageMax) {
            return false;
          }

          // 1b. RELATIONSHIP TYPE / INTENTION FILTER (quick filter)
          if (selectedIntention && profile.preferences?.relationship_type) {
            if (profile.preferences.relationship_type !== selectedIntention) {
              return false;
            }
          }

          // 1c. ACTIVE TODAY FILTER (quick filter)
          if (activeToday && profile.last_active_at) {
            const lastActive = new Date(profile.last_active_at);
            const now = new Date();
            const hoursSinceActive = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60);
            if (hoursSinceActive > 24) {
              return false;
            }
          }

          // 2. BIDIRECTIONAL GENDER PREFERENCE (both directions must match)
          // A. Check if current user wants this profile's gender
          if (currentUserData.preferences?.gender_preference &&
              currentUserData.preferences.gender_preference.length > 0) {
            // Convert to array if string (handles legacy data)
            const userGenderPrefArray = Array.isArray(currentUserData.preferences.gender_preference)
              ? currentUserData.preferences.gender_preference
              : currentUserData.preferences.gender_preference.split(',').map((g: string) => g.trim());

            const profileGenderArray = Array.isArray(profile.gender) ? profile.gender : [profile.gender];
            const userWantsThisGender = profileGenderArray.some((g: string) =>
              userGenderPrefArray.includes(g)
            );
            if (!userWantsThisGender) {
              return false;
            }
          }

          // B. Check if profile wants current user's gender
          if (profile.preferences?.gender_preference &&
              profile.preferences.gender_preference.length > 0) {
            // Convert to array if string (handles legacy data)
            const profileGenderPrefArray = Array.isArray(profile.preferences.gender_preference)
              ? profile.preferences.gender_preference
              : profile.preferences.gender_preference.split(',').map((g: string) => g.trim());

            const currentUserGenderArray = Array.isArray(currentUserData.gender)
              ? currentUserData.gender
              : [currentUserData.gender];
            const profileWantsMyGender = currentUserGenderArray.some((g: string) =>
              profileGenderPrefArray.includes(g)
            );
            if (!profileWantsMyGender) {
              return false;
            }
          }

          // 3. SEXUAL ORIENTATION COMPATIBILITY - DISABLED FOR LAVENDER MARRIAGE APP
          // Note: Lavender marriages are specifically for LGBTQ+ individuals seeking marriages of
          // convenience (often platonic). Sexual orientation should NOT be a blocking factor because
          // the whole point is that people with different orientations can match (e.g., gay man + straight woman).
          // Users already specify what GENDER they're seeking, which is the only relevant filter.
          //
          // Example: A gay man seeking a woman for a lavender marriage should match with straight women.
          // This is literally the purpose of the app!
          //
          // FILTER DISABLED - Gender preference is the only relevant matching criteria.

          // 4. LOCATION/DISTANCE FILTER (ALWAYS APPLIED - even in search mode unless global)
          // Use the pre-computed isSearchingGlobally flag from the outer scope
          const userSearchGlobally = isSearchingGlobally;
          const profileSearchGlobally = profile.preferences?.search_globally || false;
          const userPreferredCities = currentUserData.preferences?.preferred_cities || [];
          const profilePreferredCities = profile.preferences?.preferred_cities || [];


          // Check if profile is in user's preferred cities (exact match)
          const profileMatchesPreferredCity = userPreferredCities.length > 0 &&
            userPreferredCities.some((city: string) => {
              const [prefCity, prefState] = city.split(',').map((s: string) => s.trim().toLowerCase());
              const profileCity = (profile.location_city || '').toLowerCase();
              const profileState = (profile.location_state || '').toLowerCase();

              if (prefCity === profileCity) {
                return !prefState || prefState === profileState;
              }
              return false;
            });

          // Check if user is in profile's preferred cities (bidirectional)
          const userMatchesProfilePreferredCity = profilePreferredCities.length > 0 &&
            profilePreferredCities.some((city: string) => {
              const [prefCity, prefState] = city.split(',').map((s: string) => s.trim().toLowerCase());
              const userCity = (currentUserData.location_city || '').toLowerCase();
              const userState = (currentUserData.location_state || '').toLowerCase();

              if (prefCity === userCity) {
                return !prefState || prefState === userState;
              }
              return false;
            });

          // Apply distance filter if:
          // - Neither is searching globally
          // - Profile is NOT in preferred cities
          if (!userSearchGlobally && !profileSearchGlobally &&
              !profileMatchesPreferredCity && !userMatchesProfilePreferredCity) {

            // Recalculate distance in real-time (avoid stale data)
            let realTimeDistance = profile.distance;
            if (currentUserData.latitude && currentUserData.longitude &&
                profile.latitude && profile.longitude) {
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
              realTimeDistance = Math.round(R * c);
            }

            if (realTimeDistance !== null && realTimeDistance > filters.maxDistance) {
              return false;
            }
          }

          // 5. CHILDREN COMPATIBILITY (hard dealbreaker if both have strong opinions)
          if (currentUserData.preferences?.wants_children !== undefined &&
              currentUserData.preferences?.wants_children !== null &&
              profile.preferences?.wants_children !== undefined &&
              profile.preferences?.wants_children !== null) {

            const userWants = currentUserData.preferences.wants_children;
            const profileWants = profile.preferences.wants_children;

            // Hard incompatibility: one wants (true), one doesn't want (false)
            if ((userWants === true && profileWants === false) ||
                (userWants === false && profileWants === true)) {
              return false;
            }
          }

          // 6. RELATIONSHIP TYPE COMPATIBILITY - REMOVED AS BLOCKING FILTER
          // Note: Relationship type preference (platonic, romantic, open) is important for
          // compatibility scoring, but should NOT be a blocking filter in a lavender marriage app.
          // People with different relationship type preferences should still be able to see each
          // other and discuss what arrangement works for them. The compatibility score will reflect
          // the preference mismatch, but they should have the opportunity to connect and negotiate.
          //
          // Example: Someone seeking platonic should still see people seeking romantic, because
          // lavender marriages are about finding mutually beneficial arrangements that work for
          // both parties - not rigid matching rules.
          //
          // FILTER REMOVED - Compatibility score handles this preference.

          // ====================================================================
          // PREFERENCE FILTERS (Applied to all users, not just premium)
          // ====================================================================

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

          // Housing preference filter (for premium users with specific preferences)
          if (isPremium && filters.housingPreference.length > 0 &&
              profile.preferences?.housing_preference) {
            const profileHousing = Array.isArray(profile.preferences.housing_preference)
              ? profile.preferences.housing_preference
              : [profile.preferences.housing_preference];

            const hasMatch = profileHousing.some((h: string) => filters.housingPreference.includes(h));
            if (!hasMatch) {
              return false;
            }
          }

          // Financial arrangement filter (for premium users with specific preferences)
          if (isPremium && filters.financialArrangement.length > 0 &&
              profile.preferences?.financial_arrangement) {
            const profileFinancial = Array.isArray(profile.preferences.financial_arrangement)
              ? profile.preferences.financial_arrangement
              : [profile.preferences.financial_arrangement];

            const hasMatch = profileFinancial.some((f: string) => filters.financialArrangement.includes(f));
            if (!hasMatch) {
              return false;
            }
          }

          // All filters passed
          return true;
        });

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

      setProfiles(sortedProfiles);
      setCurrentIndex(0);

      // Prefetch images for the first few profiles for instant loading
      const imagesToPrefetch = sortedProfiles
        .slice(0, 5) // Prefetch first 5 profiles
        .flatMap(p => p.photos?.map(photo => photo.url) || [])
        .filter(Boolean);

      if (imagesToPrefetch.length > 0) {
        prefetchImages(imagesToPrefetch);
      }
    } catch (error: any) {
      console.error('❌ Error loading profiles:', error);
      Alert.alert(t('common.error'), error.message || 'Failed to load profiles');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSwipeLeft = useCallback(async (): Promise<boolean> => {
    if (!currentProfileId || currentIndex >= profiles.length) {
      return false;
    }

    // Check swipe limit
    if (!checkSwipeLimit()) return false;

    const targetProfile = profiles[currentIndex];

    try {
      // Insert pass into database
      await supabase.from('passes').insert({
        passer_profile_id: currentProfileId,
        passed_profile_id: targetProfile.id,
      });

      // Track swipe left
      trackUserAction.swipedLeft(targetProfile.id);
      trackFunnel.profileCardSwiped();

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
      setCurrentIndex(newIndex);
      return true;
    } catch (error: any) {
      console.error('❌ Error recording pass:', error);
      return false;
    }
  }, [currentProfileId, currentIndex, profiles, swipeCount, isPremium]);

  const handleSwipeRight = useCallback(async (): Promise<boolean> => {
    if (!currentProfileId || currentIndex >= profiles.length) {
      return false;
    }

    // Check swipe limit
    if (!checkSwipeLimit()) return false;

    const targetProfile = profiles[currentIndex];
    console.log('❤️ Liking:', targetProfile.display_name);

    try {
      // Insert like into database
      const { error: likeError } = await supabase.from('likes').insert({
        liker_profile_id: currentProfileId,
        liked_profile_id: targetProfile.id,
      });

      if (likeError) throw likeError;

      // Track swipe right (like)
      trackUserAction.swipedRight(targetProfile.id);
      trackFunnel.profileLiked();

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

          // Track match
          trackUserAction.matched(matchData?.id || '');
          trackFunnel.matchReceived();

          // Store match ID and show match modal
          setMatchId(matchData?.id || null);
          setMatchedProfile(targetProfile);
          setShowMatchModal(true);

          // Send match notification (don't await to avoid blocking modal)
          sendMatchNotification(targetProfile.id, currentUserName, matchData?.id || '').catch(err => {
            console.error('Failed to send match notification:', err);
          });
        }

        // Track last swipe for rewind
        setLastSwipe({
          profile: targetProfile,
          action: 'like',
          index: currentIndex,
        });

        // DON'T advance the card when there's a match
        // The modal close handler will advance it
        return true;
      }

      // No match - proceed with normal flow
      console.log('ℹ️ Like recorded, waiting for mutual like');

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
      setCurrentIndex(newIndex);
      return true;
    } catch (error: any) {
      console.error('❌ Error recording like:', error);
      return false;
    }
  }, [currentProfileId, currentIndex, profiles, swipeCount, isPremium]);

  const handleSwipeUp = useCallback(async (): Promise<boolean> => {
    if (!currentProfileId || currentIndex >= profiles.length) return false;

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
      return false; // Don't proceed with the swipe
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
          return false; // Don't proceed with the swipe
        }
      }

      // Check if a like already exists
      const { data: existingLike } = await supabase
        .from('likes')
        .select('id, like_type')
        .eq('liker_profile_id', currentProfileId)
        .eq('liked_profile_id', targetProfile.id)
        .single();

      if (existingLike) {
        // Update existing like to super_like
        const { error: updateError } = await supabase
          .from('likes')
          .update({ like_type: 'super_like' })
          .eq('id', existingLike.id);

        if (updateError) throw updateError;
      } else {
        // Insert new super like
        const { error: likeError } = await supabase.from('likes').insert({
          liker_profile_id: currentProfileId,
          liked_profile_id: targetProfile.id,
          like_type: 'super_like',
        });

        if (likeError) throw likeError;
      }

      // Track super like
      trackUserAction.superLikeUsed(targetProfile.id);

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
      return true;
    } catch (error: any) {
      console.error('Error recording super like:', error);
      Alert.alert(t('common.error'), 'Failed to send super like. Please try again.');
      return false;
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

    // Track profile view
    trackUserAction.profileViewed(targetProfile.id);

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
    Keyboard.dismiss(); // Always dismiss keyboard when search button is pressed
    if (searchKeyword.trim()) {
      setIsSearchMode(true);
      setCurrentIndex(0);
      // Pass true directly to avoid state timing issue
      loadProfiles(true, searchKeyword.trim());
    }
  };

  const handleClearSearch = () => {
    setSearchKeyword('');
    setIsSearchMode(false);
    setCurrentIndex(0);
    // Pass false directly to avoid state timing issue
    loadProfiles(false, '');
  };

  const handleCloseMatchModal = () => {
    setShowMatchModal(false);
    setMatchedProfile(null);
    setMatchId(null);

    // Advance to next card after closing match modal
    const newIndex = currentIndex + 1;
    console.log('➡️ Match modal closed, moving to index:', newIndex);
    setCurrentIndex(newIndex);
  };

  const handleSendMessage = () => {
    setShowMatchModal(false);

    // Advance to next card after going to chat
    const newIndex = currentIndex + 1;
    console.log('➡️ Navigating to chat, moving to index:', newIndex);
    setCurrentIndex(newIndex);

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

  const handleDismissVerificationBanner = async () => {
    setShowVerificationBanner(false);
    await AsyncStorage.setItem('verification_banner_dismissed', 'true');
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

    setReportingProfile({
      id: currentProfile.id,
      name: currentProfile.display_name,
    });
    setShowReportModal(true);
    setShowImmersiveProfile(false);
  };

  // Fun loading messages
  const loadingMessages = [
    t('discover.findingMatches'),
    'Scanning the universe...',
    'Finding your perfect match...',
    'Almost there...',
    'Good things take time...',
  ];
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  // Rotate loading messages
  useEffect(() => {
    if (!loading) return;
    const interval = setInterval(() => {
      setLoadingMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [loading]);

  // Loading state with fun animation
  if (loading) {
    const { width } = Dimensions.get('window');

    return (
      <View className="flex-1 bg-background items-center justify-center overflow-hidden">
        {/* Floating hearts background */}
        {[...Array(8)].map((_, i) => (
          <MotiView
            key={i}
            from={{
              opacity: 0,
              translateY: 100,
              translateX: (i % 2 === 0 ? -1 : 1) * (20 + (i * 15)),
              scale: 0.5,
            }}
            animate={{
              opacity: [0, 0.6, 0],
              translateY: -400,
              translateX: (i % 2 === 0 ? 1 : -1) * (30 + (i * 10)),
              scale: [0.5, 1, 0.8],
            }}
            transition={{
              type: 'timing',
              duration: 3000 + (i * 400),
              loop: true,
              delay: i * 300,
            }}
            style={{
              position: 'absolute',
              bottom: 100,
              left: width / 2 - 12 + ((i - 4) * 25),
            }}
          >
            <Text style={{ fontSize: 24 + (i % 3) * 8 }}>
              {['💜', '💕', '✨', '💫', '💜', '💕', '✨', '💫'][i]}
            </Text>
          </MotiView>
        ))}

        {/* Pulsing rings */}
        <View style={{ alignItems: 'center', justifyContent: 'center' }}>
          {[0, 1, 2].map((i) => (
            <MotiView
              key={i}
              from={{ opacity: 0.8, scale: 0.8 }}
              animate={{ opacity: 0, scale: 2 }}
              transition={{
                type: 'timing',
                duration: 2000,
                loop: true,
                delay: i * 600,
              }}
              style={{
                position: 'absolute',
                width: 100,
                height: 100,
                borderRadius: 50,
                borderWidth: 3,
                borderColor: '#A08AB7',
              }}
            />
          ))}

          {/* Center heart icon */}
          <MotiView
            from={{ scale: 0.9 }}
            animate={{ scale: 1.1 }}
            transition={{
              type: 'timing',
              duration: 800,
              loop: true,
              repeatReverse: true,
            }}
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: '#F3E8FF',
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: '#A08AB7',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            <MaterialCommunityIcons name="cards-heart" size={40} color="#A08AB7" />
          </MotiView>
        </View>

        {/* Animated loading text */}
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 500 }}
          key={loadingMessageIndex}
          style={{ marginTop: 32 }}
        >
          <Text className="text-muted-foreground text-base font-sans-medium text-center px-8">
            {loadingMessages[loadingMessageIndex]}
          </Text>
        </MotiView>

        {/* Animated dots */}
        <View style={{ flexDirection: 'row', marginTop: 16, gap: 6 }}>
          {[0, 1, 2].map((i) => (
            <MotiView
              key={i}
              from={{ opacity: 0.3, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1.2 }}
              transition={{
                type: 'timing',
                duration: 500,
                loop: true,
                repeatReverse: true,
                delay: i * 150,
              }}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#A08AB7',
              }}
            />
          ))}
        </View>
      </View>
    );
  }

  // Empty state - no more profiles
  if (currentIndex >= profiles.length) {
    return (
      <View className="flex-1 bg-background">
        {/* Header with Search/Filter Controls */}
        <View className="bg-white pb-4 px-6 border-b border-border" style={{ paddingTop: insets.top + 16 }}>
          {/* Quick Filters Row - Horizontal Scroll with Search/Refresh on right */}
          <View className="flex-row items-center mb-3">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
              style={{ flex: 1 }}
            >
              <TouchableOpacity
                className="bg-muted rounded-full p-2.5"
                onPress={() => setShowFilterModal(true)}
              >
                <MaterialCommunityIcons name="filter-variant" size={20} color="#1F2937" />
              </TouchableOpacity>

              {/* Age Quick Filter */}
              <TouchableOpacity
                className="bg-muted rounded-full px-3 py-2 flex-row items-center"
                onPress={() => {
                  setTempAgeMin(filters.ageMin);
                  setTempAgeMax(filters.ageMax);
                  setShowAgeSlider(!showAgeSlider);
                  setShowIntentionDropdown(false);
                }}
              >
                <Text className="text-foreground text-sm font-medium">Age</Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color="#1F2937" style={{ marginLeft: 4 }} />
              </TouchableOpacity>

              {/* Intention Quick Filter */}
              <TouchableOpacity
                className="bg-muted rounded-full px-3 py-2 flex-row items-center"
                onPress={() => {
                  setShowIntentionDropdown(!showIntentionDropdown);
                  setShowAgeSlider(false);
                }}
              >
                <Text className="text-foreground text-sm font-medium">Dating Intentions</Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color="#1F2937" style={{ marginLeft: 4 }} />
              </TouchableOpacity>

              {/* Active Today Toggle */}
              <TouchableOpacity
                className={`rounded-full px-3 py-2 flex-row items-center ${activeToday ? 'bg-lavender-500' : 'bg-muted'}`}
                onPress={() => {
                  setActiveToday(!activeToday);
                  loadProfiles();
                }}
              >
                <MaterialCommunityIcons name="clock-outline" size={16} color={activeToday ? 'white' : '#1F2937'} style={{ marginRight: 4 }} />
                <Text className={`text-sm font-medium ${activeToday ? 'text-white' : 'text-foreground'}`}>Active Today</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Right side - Search, Refresh */}
            <View className="flex-row gap-2 ml-2">
              {!isPremium && (
                <TouchableOpacity
                  className="bg-gold-500 rounded-full px-3 py-2 flex-row items-center gap-1"
                  style={{ backgroundColor: '#FFD700' }}
                  onPress={() => setShowPaywall(true)}
                >
                  <MaterialCommunityIcons name="crown" size={16} color="#A08AB7" />
                  <Text className="text-lavender-500 font-sans-bold text-xs">Upgrade</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className="bg-muted rounded-full p-2.5"
                onPress={() => setShowSearchBar(!showSearchBar)}
              >
                <MaterialCommunityIcons name="magnify" size={20} color="#1F2937" />
              </TouchableOpacity>
              <TouchableOpacity
                className="bg-muted rounded-full p-2.5"
                onPress={handleRefresh}
              >
                <MaterialCommunityIcons name="refresh" size={20} color="#1F2937" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Age Slider Panel */}
          {showAgeSlider && (
            <View className="mt-3 bg-white rounded-xl shadow-lg border border-gray-200 p-4">
              <Text className="text-foreground font-semibold mb-3">Age Range: {tempAgeMin} - {tempAgeMax}</Text>

              <View className="mb-4">
                <Text className="text-muted-foreground text-sm mb-2">Minimum: {tempAgeMin}</Text>
                <Slider
                  minimumValue={18}
                  maximumValue={80}
                  step={1}
                  value={tempAgeMin}
                  onValueChange={(value) => setTempAgeMin(Math.min(value, tempAgeMax - 1))}
                  minimumTrackTintColor="#A08AB7"
                  maximumTrackTintColor="#E5E7EB"
                  thumbTintColor="#A08AB7"
                />
              </View>

              <View className="mb-4">
                <Text className="text-muted-foreground text-sm mb-2">Maximum: {tempAgeMax}</Text>
                <Slider
                  minimumValue={18}
                  maximumValue={80}
                  step={1}
                  value={tempAgeMax}
                  onValueChange={(value) => setTempAgeMax(Math.max(value, tempAgeMin + 1))}
                  minimumTrackTintColor="#A08AB7"
                  maximumTrackTintColor="#E5E7EB"
                  thumbTintColor="#A08AB7"
                />
              </View>

              <View className="flex-row gap-2">
                <TouchableOpacity
                  className="flex-1 bg-muted rounded-full py-2"
                  onPress={() => setShowAgeSlider(false)}
                >
                  <Text className="text-center text-foreground font-medium">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="flex-1 bg-lavender-500 rounded-full py-2"
                  onPress={() => {
                    setFilters({ ...filters, ageMin: tempAgeMin, ageMax: tempAgeMax });
                    setShowAgeSlider(false);
                    loadProfiles();
                  }}
                >
                  <Text className="text-center text-white font-medium">Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Intention Dropdown */}
          {showIntentionDropdown && (
            <View className="absolute top-full left-24 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 z-50" style={{ minWidth: 120 }}>
              {INTENTIONS.map((intention, index) => (
                <TouchableOpacity
                  key={index}
                  className={`px-4 py-3 ${index !== INTENTIONS.length - 1 ? 'border-b border-gray-100' : ''}`}
                  onPress={() => {
                    setSelectedIntention(intention.value);
                    setShowIntentionDropdown(false);
                    loadProfiles();
                  }}
                >
                  <Text className={`text-sm ${selectedIntention === intention.value ? 'text-lavender-500 font-semibold' : 'text-foreground'}`}>
                    {intention.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Keyword Search Bar - Expanded when showSearchBar is true */}
          {showSearchBar && (
            <View className="mt-3">
              <View className="flex-row items-center bg-muted rounded-full px-4 py-2">
                <MaterialCommunityIcons name="magnify" size={20} color="#71717A" />
                <TextInput
                  className="flex-1 ml-2 text-foreground text-base"
                  placeholder="Search by keyword (e.g., 'travel', 'vegan')"
                  placeholderTextColor="#A1A1AA"
                  value={searchKeyword}
                  onChangeText={setSearchKeyword}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                  autoFocus
                />
                {isSearchMode && (
                  <TouchableOpacity onPress={handleClearSearch} className="ml-2">
                    <MaterialCommunityIcons name="close-circle" size={20} color="#71717A" />
                  </TouchableOpacity>
                )}
                {!isSearchMode && searchKeyword.trim() && (
                  <TouchableOpacity onPress={handleSearch} className="ml-2 bg-lavender-500 rounded-full px-3 py-1">
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
                  <MaterialCommunityIcons name="close" size={20} color="#71717A" />
                </TouchableOpacity>
              </View>
              {isSearchMode && (
                <Text className="text-muted-foreground text-xs mt-2 text-center">
                  💡 Tip: Like or pass to continue searching. Clear search to see all profiles.
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Empty State */}
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-6">✨</Text>
          <Text className="text-2xl font-display-bold text-foreground mb-3 text-center">
            {isSearchMode ? `No results for "${searchKeyword}"` : t('discover.allCaughtUp')}
          </Text>
          <Text className="text-muted-foreground mb-8 text-center text-lg font-sans">
            {isSearchMode
              ? "Try different keywords or adjust your filters to find more matches."
              : t('discover.checkBackSoon')}
          </Text>

          {isSearchMode ? (
            <TouchableOpacity
              className="bg-lavender-500 rounded-full py-4 px-8 shadow-lg"
              onPress={handleClearSearch}
            >
              <Text className="text-white font-sans-bold text-lg">Clear Search</Text>
            </TouchableOpacity>
          ) : (
            <View className="items-center gap-4">
              <TouchableOpacity
                className="bg-lavender-500 rounded-full py-4 px-8 shadow-lg"
                onPress={() => setShowSearchBar(true)}
              >
                <Text className="text-white font-sans-bold text-lg">Search by Keyword</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="border-2 border-lavender-500 rounded-full py-4 px-8"
                onPress={handleRefresh}
              >
                <Text className="text-lavender-500 font-sans-bold text-lg">{t('discover.refresh')}</Text>
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

  return (
    <View className="flex-1 bg-background">
      {/* Header */}
      <View className="bg-white pb-4 px-6 border-b border-border" style={{ paddingTop: insets.top + 16 }}>
        {/* Quick Filters Row - Horizontal Scroll with Search/Refresh on right */}
        <View className="flex-row items-center mb-3">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8 }}
            style={{ flex: 1 }}
          >
            <TouchableOpacity
              className="bg-muted rounded-full p-2.5"
              onPress={() => setShowFilterModal(true)}
            >
              <MaterialCommunityIcons name="filter-variant" size={20} color="#1F2937" />
            </TouchableOpacity>

            {/* Age Quick Filter */}
            <TouchableOpacity
              className="bg-muted rounded-full px-3 py-2 flex-row items-center"
              onPress={() => {
                setTempAgeMin(filters.ageMin);
                setTempAgeMax(filters.ageMax);
                setShowAgeSlider(!showAgeSlider);
                setShowIntentionDropdown(false);
              }}
            >
              <Text className="text-foreground text-sm font-medium">Age</Text>
              <MaterialCommunityIcons name="chevron-down" size={16} color="#1F2937" style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            {/* Intention Quick Filter */}
            <TouchableOpacity
              className="bg-muted rounded-full px-3 py-2 flex-row items-center"
              onPress={() => {
                setShowIntentionDropdown(!showIntentionDropdown);
                setShowAgeSlider(false);
              }}
            >
              <Text className="text-foreground text-sm font-medium">Dating Intentions</Text>
              <MaterialCommunityIcons name="chevron-down" size={16} color="#1F2937" style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            {/* Active Today Toggle */}
            <TouchableOpacity
              className={`rounded-full px-3 py-2 flex-row items-center ${activeToday ? 'bg-lavender-500' : 'bg-muted'}`}
              onPress={() => {
                setActiveToday(!activeToday);
                loadProfiles();
              }}
            >
              <MaterialCommunityIcons name="clock-outline" size={16} color={activeToday ? 'white' : '#1F2937'} style={{ marginRight: 4 }} />
              <Text className={`text-sm font-medium ${activeToday ? 'text-white' : 'text-foreground'}`}>Active Today</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Right side - Search, Refresh */}
          <View className="flex-row gap-2 ml-2">
            {!isPremium && (
              <TouchableOpacity
                className="bg-gold-500 rounded-full px-3 py-2 flex-row items-center gap-1"
                style={{ backgroundColor: '#FFD700' }}
                onPress={() => setShowPaywall(true)}
              >
                <MaterialCommunityIcons name="crown" size={16} color="#A08AB7" />
                <Text className="text-lavender-500 font-sans-bold text-xs">Upgrade</Text>
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
              className="bg-muted rounded-full p-2.5"
              onPress={() => setShowSearchBar(!showSearchBar)}
            >
              <MaterialCommunityIcons name="magnify" size={20} color="#1F2937" />
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-muted rounded-full p-2.5"
              onPress={handleRefresh}
            >
              <MaterialCommunityIcons name="refresh" size={20} color="#1F2937" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Age Slider Panel */}
        {showAgeSlider && (
          <View className="mt-3 bg-white rounded-xl shadow-lg border border-gray-200 p-4">
            <Text className="text-foreground font-semibold mb-3">Age Range: {tempAgeMin} - {tempAgeMax}</Text>

            <View className="mb-4">
              <Text className="text-muted-foreground text-sm mb-2">Minimum: {tempAgeMin}</Text>
              <Slider
                minimumValue={18}
                maximumValue={80}
                step={1}
                value={tempAgeMin}
                onValueChange={(value) => setTempAgeMin(Math.min(value, tempAgeMax - 1))}
                minimumTrackTintColor="#A08AB7"
                maximumTrackTintColor="#E5E7EB"
                thumbTintColor="#A08AB7"
              />
            </View>

            <View className="mb-4">
              <Text className="text-muted-foreground text-sm mb-2">Maximum: {tempAgeMax}</Text>
              <Slider
                minimumValue={18}
                maximumValue={80}
                step={1}
                value={tempAgeMax}
                onValueChange={(value) => setTempAgeMax(Math.max(value, tempAgeMin + 1))}
                minimumTrackTintColor="#A08AB7"
                maximumTrackTintColor="#E5E7EB"
                thumbTintColor="#A08AB7"
              />
            </View>

            <View className="flex-row gap-2">
              <TouchableOpacity
                className="flex-1 bg-muted rounded-full py-2"
                onPress={() => setShowAgeSlider(false)}
              >
                <Text className="text-center text-foreground font-medium">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 bg-lavender-500 rounded-full py-2"
                onPress={() => {
                  setFilters({ ...filters, ageMin: tempAgeMin, ageMax: tempAgeMax });
                  setShowAgeSlider(false);
                  loadProfiles();
                }}
              >
                <Text className="text-center text-white font-medium">Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Intention Dropdown */}
        {showIntentionDropdown && (
          <View className="absolute top-full left-24 mt-1 bg-white rounded-xl shadow-lg border border-gray-200 z-50" style={{ minWidth: 120 }}>
            {INTENTIONS.map((intention, index) => (
              <TouchableOpacity
                key={index}
                className={`px-4 py-3 ${index !== INTENTIONS.length - 1 ? 'border-b border-gray-100' : ''}`}
                onPress={() => {
                  setSelectedIntention(intention.value);
                  setShowIntentionDropdown(false);
                  loadProfiles();
                }}
              >
                <Text className={`text-sm ${selectedIntention === intention.value ? 'text-lavender-500 font-semibold' : 'text-foreground'}`}>
                  {intention.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Keyword Search Bar - Expanded when showSearchBar is true */}
        {showSearchBar && (
          <View className="mt-3">
            <View className="flex-row items-center bg-muted rounded-full px-4 py-2">
              <MaterialCommunityIcons name="magnify" size={20} color="#71717A" />
              <TextInput
                className="flex-1 ml-2 text-foreground text-base"
                placeholder="Search by keyword (e.g., 'travel', 'vegan')"
                placeholderTextColor="#A1A1AA"
                value={searchKeyword}
                onChangeText={setSearchKeyword}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                autoFocus
              />
              {isSearchMode && (
                <TouchableOpacity onPress={handleClearSearch} className="ml-2">
                  <MaterialCommunityIcons name="close-circle" size={20} color="#71717A" />
                </TouchableOpacity>
              )}
              {!isSearchMode && searchKeyword.trim() && (
                <TouchableOpacity onPress={handleSearch} className="ml-2 bg-lavender-500 rounded-full px-3 py-1">
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
                <MaterialCommunityIcons name="close" size={20} color="#71717A" />
              </TouchableOpacity>
            </View>
            {isSearchMode && (
              <Text className="text-muted-foreground text-xs mt-2 text-center">
                💡 Tip: Like or pass to continue searching. Clear search to see all profiles.
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Verification Banner - Prompt unverified users to verify */}
      {showVerificationBanner && !isPhotoVerified && (
        <VerificationBanner onDismiss={handleDismissVerificationBanner} />
      )}

      {/* Photo Review Required Banner */}
      {photoReviewRequired && (
        <TouchableOpacity
          className="mx-4 mt-2 p-4 bg-amber-50 border border-amber-200 rounded-xl flex-row items-center"
          onPress={() => router.push('/settings/edit-profile')}
          activeOpacity={0.8}
        >
          <View className="w-10 h-10 bg-amber-100 rounded-full items-center justify-center mr-3">
            <MaterialCommunityIcons name="camera-off" size={20} color="#F59E0B" />
          </View>
          <View className="flex-1">
            <Text className="text-amber-900 font-semibold text-sm">Profile Hidden</Text>
            <Text className="text-amber-700 text-xs mt-0.5">Your profile is temporarily hidden. Tap to upload new photos.</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#F59E0B" />
        </TouchableOpacity>
      )}

      {/* Card Stack */}
      <View className="flex-1 relative">
        {/* Show current card and one behind it for depth */}
        {currentIndex + 1 < profiles.length && (
          <View className="absolute w-full h-full px-4 pt-4" style={{ opacity: 0.5, transform: [{ scale: 0.95 }] }}>
            <View className="flex-1 bg-gray-300 rounded-3xl" />
          </View>
        )}

        <SwipeCard
          key={currentProfile.id}
          profile={currentProfile as any}
          onSwipeLeft={handleSwipeLeft}
          onSwipeRight={handleSwipeRight}
          onSwipeUp={handleSwipeUp}
          onPress={handleProfilePress}
          distanceUnit={distanceUnit}
          isAdmin={isAdmin}
        />
      </View>

      {/* Action Buttons */}
      <View className="pb-8 px-6">
        <View className="flex-row justify-center items-center gap-4">
          {/* Rewind Button */}
          <TouchableOpacity
            className={`rounded-full w-14 h-14 items-center justify-center shadow-lg ${
              lastSwipe && isPremium ? 'bg-lavender-400' : 'bg-gray-300'
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
            className="bg-white rounded-full w-16 h-16 items-center justify-center shadow-lg border-2 border-border"
            onPress={handleSwipeLeft}
          >
            <MaterialCommunityIcons name="close" size={32} color="#EF4444" />
          </TouchableOpacity>

          {/* Obsessed Button (Super Like) */}
          <TouchableOpacity
            className="bg-lavender-500 rounded-full w-16 h-16 items-center justify-center shadow-lg"
            onPress={handleSwipeUp}
          >
            <MaterialCommunityIcons name="star" size={32} color="white" />
          </TouchableOpacity>

          {/* Like Button */}
          <TouchableOpacity
            className="bg-white rounded-full w-16 h-16 items-center justify-center shadow-lg border-2 border-border"
            onPress={handleSwipeRight}
          >
            <MaterialCommunityIcons name="heart" size={32} color="#10B981" />
          </TouchableOpacity>
        </View>

        {/* Action Labels */}
        <View className="flex-row justify-center items-center gap-4 mt-2">
          <Text className="text-muted-foreground text-xs font-sans-medium w-14 text-center">Rewind</Text>
          <Text className="text-muted-foreground text-xs font-sans-medium w-16 text-center">Pass</Text>
          <Text className="text-lavender-500 text-xs font-sans-bold w-16 text-center">Obsessed</Text>
          <Text className="text-muted-foreground text-xs font-sans-medium w-16 text-center">Like</Text>
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
            profile={profiles[currentIndex] as any}
            preferences={currentProfilePreferences}
            compatibilityBreakdown={profiles[currentIndex].compatibilityBreakdown}
            onSwipeLeft={handleImmersiveSwipeLeft}
            onSwipeRight={handleImmersiveSwipeRight}
            onSuperLike={handleImmersiveSwipeUp}
            onClose={handleCloseImmersiveProfile}
            visible={showImmersiveProfile}
            heightUnit={heightUnit}
            onBlock={handleBlock}
            onReport={handleReport}
            currentProfileId={currentProfileId || undefined}
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

      {/* Report User Modal */}
      {reportingProfile && (
        <ReportUserModal
          visible={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setReportingProfile(null);
          }}
          reportedProfileId={reportingProfile.id}
          reportedProfileName={reportingProfile.name}
        />
      )}

      {/* Swipe Counter for Free Users */}
      {!isPremium && (
        <View className="absolute bottom-32 right-6 bg-white rounded-full px-4 py-2 shadow-lg border-2 border-lavender-500">
          <Text className="text-lavender-500 font-sans-bold text-sm">
            {t('discover.swipesRemaining', { count: swipeCount, limit: DAILY_SWIPE_LIMIT })}
          </Text>
        </View>
      )}

      {/* Super Like Counter for Premium Users */}
      {isPremium && (
        <View className="absolute bottom-32 right-6 bg-white rounded-full px-4 py-2 shadow-lg border-2 border-lavender-500">
          <View className="flex-row items-center gap-1">
            <MaterialCommunityIcons name="star" size={16} color="#A08AB7" />
            <Text className="text-lavender-500 font-sans-bold text-sm">
              {t('discover.superLikesRemaining', { count: superLikesRemaining })}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
