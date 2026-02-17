import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, TextInput, Keyboard, ScrollView, Dimensions, InteractionManager, useWindowDimensions, Platform, Animated, AppState } from 'react-native';
import { MotiView } from 'moti';
import Slider from '@react-native-community/slider';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { useScreenProtection } from '@/hooks/useScreenProtection';
import DiscoveryProfileView, { DiscoveryProfileViewRef } from '@/components/matching/DiscoveryProfileView';
import ImmersiveProfileCard from '@/components/matching/ImmersiveProfileCard';
import MatchModal from '@/components/matching/MatchModal';
import PremiumPaywall from '@/components/premium/PremiumPaywall';
import FilterModal, { FilterOptions } from '@/components/matching/FilterModal';
import ProfileBoostModal from '@/components/premium/ProfileBoostModal';
import ReportUserModal from '@/components/moderation/ReportUserModal';
// NOTE: Match and like notifications are sent via database triggers (notify_on_match, notify_on_like)
// Do NOT import or call sendMatchNotification/sendLikeNotification from client code
import { calculateCompatibilityScore, getCompatibilityBreakdown } from '@/lib/matching-algorithm';
import { initializeTracking } from '@/lib/tracking-permissions';
import { DistanceUnit } from '@/lib/distance-utils';
import { HeightUnit } from '@/lib/height-utils';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useColorScheme } from '@/lib/useColorScheme';
import { trackUserAction, trackFunnel, trackEvent } from '@/lib/analytics';
import { prefetchImages } from '@/components/shared/ConditionalImage';
import VerificationBanner from '@/components/shared/VerificationBanner';
import TrialExpirationBanner from '@/components/premium/TrialExpirationBanner';

interface Profile {
  id: string;
  display_name: string;
  age: number;
  gender?: string | string[]; // Can be single or array: users can select multiple gender identities
  sexual_orientation?: string | string[]; // Can be single or array: users can select multiple orientations
  ethnicity?: string | string[]; // Can be single or array: users can select multiple ethnicities
  location_city?: string;
  location_state?: string;
  latitude?: number | null;
  longitude?: number | null;
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
  photos?: { url: string; is_primary: boolean; display_order?: number; blur_data_uri?: string | null }[];
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
  prompt_answers?: { prompt: string; answer: string }[];
  voice_intro_url?: string;
  voice_intro_duration?: number;
  photo_blur_enabled?: boolean;
  hide_distance?: boolean;
  hide_last_active?: boolean;
  last_active_at?: string;
  preferences?: any;
}

// Daily like limit for free users (unlimited browsing/passing, limited likes)
const DAILY_LIKE_LIMIT = 5;

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
  const { showToast } = useToast();
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const rightSafeArea = isLandscape ? Math.max(insets.right, Platform.OS === 'android' ? 48 : 0) : 0;
  const [currentProfileId, _setCurrentProfileId] = useState<string | null>(null);
  const currentProfileIdRef = useRef<string | null>(null);
  const setCurrentProfileId = (id: string | null) => {
    currentProfileIdRef.current = id;
    _setCurrentProfileId(id);
  };
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string | null>(null);
  const [currentUserGender, setCurrentUserGender] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const hasInitiallyLoaded = useRef(false);
  const [refreshing, setRefreshing] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<Profile | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [showImmersiveProfile, setShowImmersiveProfile] = useState(false);
  const [currentProfilePreferences, setCurrentProfilePreferences] = useState<any>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [likeCount, setLikeCount] = useState(0); // Daily likes used (5/day for free users)
  const [superLikesRemaining, setSuperLikesRemaining] = useState(5);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    // Free filters
    ageMin: 18,
    ageMax: 65,
    maxDistance: 100,
    activeToday: false,
    showBlurredPhotos: true,
    // Premium filters
    religion: [],
    politicalViews: [],
    housingPreference: [],
    financialArrangement: [],
    genderPreference: [],
    ethnicity: [],
    sexualOrientation: [],
    heightMin: 48,
    heightMax: 84,
    zodiacSign: [],
    personalityType: [],
    loveLanguage: [],
    languagesSpoken: [],
    smoking: [],
    drinking: [],
    pets: [],
    primaryReason: [],
    relationshipType: [],
    wantsChildren: null,
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
  const [selectedIntention, _setSelectedIntention] = useState<string | null>(null);
  const selectedIntentionRef = useRef<string | null>(null);
  const setSelectedIntention = (value: string | null) => {
    selectedIntentionRef.current = value;
    _setSelectedIntention(value);
  };
  const [tempAgeMin, setTempAgeMin] = useState(22);
  const [tempAgeMax, setTempAgeMax] = useState(50);
  const [activeToday, setActiveToday] = useState(false);
  const [photoReviewRequired, setPhotoReviewRequired] = useState(false);
  const [isPhotoVerified, setIsPhotoVerified] = useState(true); // Default to true to hide banner initially
  const [showVerificationBanner, setShowVerificationBanner] = useState(false);
  const [isProfileComplete, setIsProfileComplete] = useState(true); // Default to true to avoid flash
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(false);
  const [showPhotoBlurBanner, setShowPhotoBlurBanner] = useState(false);


  // Premium upgrade prompt for locked features
  const [showPremiumLocationPrompt, setShowPremiumLocationPrompt] = useState(false);
  const hasShownPremiumLocationPrompt = useRef(false);

  // Hinge-style discovery refs and animation
  const discoveryProfileRef = useRef<DiscoveryProfileViewRef>(null);
  const profileOpacity = useRef(new Animated.Value(1)).current;
  const [isTransitioning, setIsTransitioning] = useState(false);
  const isInitialFocus = useRef(true); // Track if this is the first time screen is focused
  const hasAdvancedOnFocus = useRef(false); // Prevent multiple advances per focus

  // Store latest values in refs for focus effect (avoids stale closure)
  const profilesRef = useRef(profiles);
  const currentIndexRef = useRef(currentIndex);
  useEffect(() => {
    profilesRef.current = profiles;
    currentIndexRef.current = currentIndex;
  }, [profiles, currentIndex]);

  // Safely advance to the next profile index, bounded by current profiles length
  const advanceIndex = useCallback(() => {
    setCurrentIndex(prev => {
      const maxIndex = profilesRef.current.length;
      return prev + 1 <= maxIndex ? prev + 1 : prev;
    });
  }, []);

  // Transition to next profile with fade animation
  const transitionToNextProfile = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);

    // Fade out current profile
    Animated.timing(profileOpacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      // Update index
      advanceIndex();
      // Reset scroll position
      discoveryProfileRef.current?.scrollToTop();
      // Fade in next profile
      Animated.timing(profileOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setIsTransitioning(false);
      });
    });
  }, [isTransitioning, profileOpacity]);

  // Smart recommendations - dynamic array from database
  const [smartRecommendations, setSmartRecommendations] = useState<{
    type: 'age' | 'distance' | 'gender' | 'global';
    count: number;
    description: string;
    increment?: number;
    newDistance?: number;
    newAgeMin?: number;
    newAgeMax?: number;
    addedGender?: string;
  }[]>([]);

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
    if (user?.id) {
      loadCurrentProfile();
      loadLikeCount();
    }
    // Request tracking permission on first app use
    initializeTracking();
  }, [user?.id]);

  useEffect(() => {
    if (currentProfileId) {
      loadSuperLikesCount();
    }
  }, [currentProfileId]);

  // Load profiles when currentProfileId is set (triggered by loadCurrentProfile)
  useEffect(() => {
    if (currentProfileId) {
      loadProfiles();
    }
  }, [currentProfileId]);

  // Reload profiles when screen regains focus (returning from other tabs/screens)
  const isFirstFocusForReload = useRef(true);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusForReload.current) {
        isFirstFocusForReload.current = false;
        return;
      }
      // Reload profile (and filters from DB) when returning from settings
      loadCurrentProfile();
      if (currentProfileIdRef.current) {
        loadProfiles(undefined, undefined, filtersRef.current);
      }
    }, [])
  );

  // Hinge-style refresh: Show new profile when user returns to discovery screen
  // This prevents analysis paralysis and creates healthy FOMO
  useFocusEffect(
    useCallback(() => {
      // Skip on initial focus (when user first enters the screen)
      if (isInitialFocus.current) {
        isInitialFocus.current = false;
        return;
      }

      // Only advance once per focus event
      if (hasAdvancedOnFocus.current) {
        return;
      }

      // Only advance if there are more profiles to show (use refs for latest values)
      const currentProfiles = profilesRef.current;
      const currentIdx = currentIndexRef.current;

      let focusTimeout: ReturnType<typeof setTimeout> | null = null;

      if (currentProfiles.length > 0 && currentIdx < currentProfiles.length - 1) {

        hasAdvancedOnFocus.current = true;

        // Small delay to ensure screen transition is complete
        focusTimeout = setTimeout(() => {
          advanceIndex();
        }, 300);
      }

      // Reset flag and clear timeout when screen loses focus
      return () => {
        hasAdvancedOnFocus.current = false;
        if (focusTimeout) {
          clearTimeout(focusTimeout);
        }
      };
    }, [])
  );

  // Handle app foregrounding (when user returns from background)
  // This complements useFocusEffect which only handles in-app navigation
  useEffect(() => {
    let advanceTimeout: ReturnType<typeof setTimeout> | null = null;
    let resetTimeout: ReturnType<typeof setTimeout> | null = null;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // App came to foreground
        // Skip on initial mount
        if (isInitialFocus.current) {
          return;
        }

        // Only advance once per app foreground event
        if (hasAdvancedOnFocus.current) {
          return;
        }

        // Only advance if there are more profiles to show
        const currentProfiles = profilesRef.current;
        const currentIdx = currentIndexRef.current;

        if (currentProfiles.length > 0 && currentIdx < currentProfiles.length - 1) {

          hasAdvancedOnFocus.current = true;

          // Small delay to ensure app transition is complete
          advanceTimeout = setTimeout(() => {
            advanceIndex();
            // Reset flag after advance
            resetTimeout = setTimeout(() => {
              hasAdvancedOnFocus.current = false;
            }, 500);
          }, 300);
        }
      }
    });

    return () => {
      subscription.remove();
      if (advanceTimeout) clearTimeout(advanceTimeout);
      if (resetTimeout) clearTimeout(resetTimeout);
    };
  }, []);

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
      // Prefetch only the primary/first photo of next 3 profiles (not all 6 per profile)
      // to limit memory pressure from cached images
      const upcomingProfiles = profiles.slice(currentIndex, currentIndex + 3);
      const imagesToPrefetch = upcomingProfiles
        .map(p => {
          const photos = p.photos?.sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
          const primaryPhoto = photos?.find(ph => ph.is_primary) || photos?.[0];
          // Don't prefetch original URLs for blur-enabled profiles — use blur_data_uri instead
          if (p.photo_blur_enabled && primaryPhoto?.blur_data_uri) {
            return primaryPhoto.blur_data_uri;
          }
          return primaryPhoto?.url;
        })
        .filter(Boolean) as string[];

      if (imagesToPrefetch.length > 0) {
        prefetchImages(imagesToPrefetch);
      }
    }
  }, [currentIndex, profiles]);

  // Load preferences for current profile (Hinge-style: profile shown inline)
  useEffect(() => {
    if (profiles.length > 0 && currentIndex < profiles.length) {
      const targetProfile = profiles[currentIndex];
      const prefs = (targetProfile as any).preferences;
      setCurrentProfilePreferences(prefs);
      // Track profile view
      trackUserAction.profileViewed(targetProfile.id);
    }
  }, [currentIndex, profiles]);

  const [currentUserName, setCurrentUserName] = useState<string>('');

  const persistFilters = async (newFilters: FilterOptions) => {
    if (!currentProfileId) return;
    try {
      const discoveryFilters = {
        religion: newFilters.religion,
        politicalViews: newFilters.politicalViews,
        ethnicity: newFilters.ethnicity,
        sexualOrientation: newFilters.sexualOrientation,
        heightMin: newFilters.heightMin,
        heightMax: newFilters.heightMax,
        zodiacSign: newFilters.zodiacSign,
        personalityType: newFilters.personalityType,
        loveLanguage: newFilters.loveLanguage,
        languagesSpoken: newFilters.languagesSpoken,
        activeToday: newFilters.activeToday,
        showBlurredPhotos: newFilters.showBlurredPhotos,
        smoking: newFilters.smoking,
        drinking: newFilters.drinking,
        pets: newFilters.pets,
        housingPreference: newFilters.housingPreference,
        financialArrangement: newFilters.financialArrangement,
        primaryReason: newFilters.primaryReason,
        relationshipType: newFilters.relationshipType,
        wantsChildren: newFilters.wantsChildren,
      };
      await supabase
        .from('preferences')
        .update({
          age_min: newFilters.ageMin,
          age_max: newFilters.ageMax,
          max_distance_miles: newFilters.maxDistance,
          gender_preference: newFilters.genderPreference,
          discovery_filters: discoveryFilters,
        })
        .eq('profile_id', currentProfileId);
    } catch (err) {
      console.error('Failed to persist filters:', err);
    }
  };

  const loadCurrentProfile = async () => {
    if (!user?.id) {

      return;
    }
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
          profile_complete,
          photos (
            url,
            is_primary,
            display_order,
            blur_data_uri
          ),
          preferences:preferences(*)
        `)
        .eq('user_id', user.id)
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
      const df = userPreferences?.discovery_filters || {};
      const initialFilters: FilterOptions = userPreferences ? {
        // Free filters
        ageMin: userPreferences.age_min || 18,
        ageMax: userPreferences.age_max || 65,
        maxDistance: userPreferences.max_distance_miles || 100,
        activeToday: df.activeToday || false,
        showBlurredPhotos: df.showBlurredPhotos !== undefined ? df.showBlurredPhotos : true,
        // Gender preference is a true discovery filter (who you want to see)
        genderPreference: userPreferences.gender_preference || [],
        // All other premium filters: only load from discovery_filters JSONB
        // Do NOT load from the user's own preferences columns (housing_preference,
        // relationship_type, etc.) — those are the user's OWN prefs, not filters
        // for other profiles.
        housingPreference: df.housingPreference || [],
        financialArrangement: df.financialArrangement || [],
        smoking: df.smoking || [],
        drinking: df.drinking || [],
        pets: df.pets || [],
        relationshipType: df.relationshipType || [],
        primaryReason: df.primaryReason || [],
        religion: df.religion || [],
        politicalViews: df.politicalViews || [],
        ethnicity: df.ethnicity || [],
        sexualOrientation: df.sexualOrientation || [],
        heightMin: df.heightMin || 48,
        heightMax: df.heightMax || 84,
        zodiacSign: df.zodiacSign || [],
        personalityType: df.personalityType || [],
        loveLanguage: df.loveLanguage || [],
        languagesSpoken: df.languagesSpoken || [],
        wantsChildren: df.wantsChildren || null,
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

      // Check if profile is complete - if not, show onboarding banner
      const profileComplete = data.profile_complete || false;
      setIsProfileComplete(profileComplete);
      if (!profileComplete) {
        setShowOnboardingBanner(true);
      }

      // Show Photo Blur info banner (educate users about why some photos may be blurred)
      // Only show for complete profiles (don't show to brand new users who haven't finished onboarding)
      if (profileComplete) {
        AsyncStorage.getItem('photo_blur_info_dismissed').then((dismissed) => {
          if (!dismissed) {
            setShowPhotoBlurBanner(true);
          }
        });
      }

      // Profiles will be loaded by the useEffect([currentProfileId]) hook
      // which fires when setCurrentProfileId is called above
    } catch (error: any) {
      showToast({ type: 'error', title: t('common.error'), message: t('toast.profileLoadError') });
      // Don't set loading=false here - keep showing loading screen until loadProfiles completes
      // The user can pull to refresh or the next focus event will retry
    }
  };

  const loadLikeCount = async () => {
    try {
      const today = new Date().toDateString();
      const storedData = await AsyncStorage.getItem('like_data');

      if (storedData) {
        const { date, count} = JSON.parse(storedData);
        // Reset count if it's a new day
        if (date === today) {
          setLikeCount(count);
        } else {
          setLikeCount(0);
          await AsyncStorage.setItem('like_data', JSON.stringify({ date: today, count: 0 }));
        }
      } else {
        setLikeCount(0);
        await AsyncStorage.setItem('like_data', JSON.stringify({ date: today, count: 0 }));
      }
    } catch (error) {
      console.error('Error loading like count:', error);
    }
  };

  const incrementLikeCount = async () => {
    const newCount = likeCount + 1;
    setLikeCount(newCount);

    try {
      const today = new Date().toDateString();
      await AsyncStorage.setItem('like_data', JSON.stringify({ date: today, count: newCount }));
    } catch (error) {
      console.error('Error saving like count:', error);
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

  const checkLikeLimit = (): boolean => {
    // Premium users have unlimited likes
    if (isPremium) return true;

    // Free users have daily like limit (5 likes/day, unlimited browsing)
    if (likeCount >= DAILY_LIKE_LIMIT) {
      setShowPaywall(true);

      // Record when user hit like limit (for refresh notification)
      if (currentProfileId) {
        supabase
          .from('notification_preferences')
          .update({ last_swipe_limit_hit_at: new Date().toISOString() })
          .eq('profile_id', currentProfileId)
          .then(({ error }) => {
            if (error) console.warn('Failed to record like limit hit:', error);
          });
      }

      return false;
    }

    return true;
  };

  // FIX #2: Helper function to calculate distance once (eliminates duplicate calculations)
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3959; // Earth's radius in miles
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.round(R * c);
  }, []);

  const loadProfiles = async (searchModeOverride?: boolean, searchKeywordOverride?: string, filtersOverride?: Partial<FilterOptions>) => {
    // Use override values if provided, otherwise fall back to state
    // This fixes the React state timing issue where state updates are async
    const effectiveSearchMode = searchModeOverride !== undefined ? searchModeOverride : isSearchMode;
    const effectiveSearchKeyword = searchKeywordOverride !== undefined ? searchKeywordOverride : searchKeyword;
    const effectiveFilters = filtersOverride ? { ...filters, ...filtersOverride } : filters;
    // Use ref for profile ID to avoid stale closure issues
    const profileId = currentProfileIdRef.current;

    try {
      setLoading(true);

      if (!profileId) {
        return;
      }

      // Get profiles that:
      // 1. Are active
      // 2. Haven't been PASSED on yet (but INCLUDE people who liked you!)
      // 3. Match basic preferences

      // Run all exclusion queries + current user data + boosted profiles in PARALLEL for better performance
      const [
        { data: alreadySwipedLikes },
        { data: alreadySwipedPasses },
        { data: peopleWhoLikedMe },
        { data: blockedByMe },
        { data: blockedMe },
        { data: contactBlocks },
        { data: bannedUsers },
        { data: currentUserDataRaw, error: currentUserError },
        { data: boostedProfiles },
      ] = await Promise.all([
        // Get people you already LIKED (we'll exclude these)
        supabase
          .from('likes')
          .select('liked_profile_id')
          .eq('liker_profile_id', profileId),
        // Get people you already PASSED (we'll exclude these)
        supabase
          .from('passes')
          .select('passed_profile_id')
          .eq('passer_profile_id', profileId),
        // Get people who LIKED YOU (we'll PRIORITIZE these, not exclude!)
        // Premium users get prioritization via direct query; free users skip (RLS blocks it)
        isPremium
          ? supabase.from('likes').select('liker_profile_id').eq('liked_profile_id', profileId)
          : Promise.resolve({ data: [], error: null }),
        // SAFETY: Users that current user has blocked
        supabase
          .from('blocks')
          .select('blocked_profile_id')
          .eq('blocker_profile_id', profileId),
        // SAFETY: Users who have blocked current user
        supabase
          .from('blocks')
          .select('blocker_profile_id')
          .eq('blocked_profile_id', profileId),
        // Contact-blocked phone numbers (hashed)
        supabase
          .from('contact_blocks')
          .select('phone_number')
          .eq('profile_id', profileId),
        // CRITICAL SAFETY: Get ALL banned users (active bans that haven't expired)
        supabase
          .from('bans')
          .select('banned_profile_id')
          .not('banned_profile_id', 'is', null)
          .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString()),
        // Current user's full profile and preferences (for compatibility calculation)
        supabase
          .from('profiles')
          .select(`
            *,
            preferences:preferences(*)
          `)
          .eq('id', profileId)
          .single(),
        // Boosted profiles (for prioritization in results)
        supabase
          .from('boosts')
          .select('profile_id')
          .eq('is_active', true)
          .gt('expires_at', new Date().toISOString()),
      ]);

      if (currentUserError) throw currentUserError;

      const peopleWhoLikedMeIds = new Set(peopleWhoLikedMe?.map(l => l.liker_profile_id) || []);

      const blockedPhoneHashes = new Set(contactBlocks?.map(cb => cb.phone_number) || []);

      const blockedIds = [
        ...(blockedByMe?.map(b => b.blocked_profile_id) || []),
        ...(blockedMe?.map(b => b.blocker_profile_id) || [])
      ];

      const bannedProfileIds = bannedUsers?.map(b => b.banned_profile_id).filter(Boolean) || [];

      const boostedProfileIds = new Set(boostedProfiles?.map(b => b.profile_id) || []);

      // Only exclude: already liked, already passed, blocked users, AND BANNED USERS
      // DO NOT exclude people who liked you!
      const swipedIds = [
        ...(alreadySwipedLikes?.map(l => l.liked_profile_id) || []),
        ...(alreadySwipedPasses?.map(p => p.passed_profile_id) || []),
        ...blockedIds,
        ...bannedProfileIds
      ];

      // Extract preferences as single object (Supabase returns array for joined queries)
      const currentUserData = {
        ...currentUserDataRaw,
        preferences: Array.isArray(currentUserDataRaw.preferences)
          ? currentUserDataRaw.preferences[0]
          : currentUserDataRaw.preferences
      };

      // Check premium status (used for other features like advanced filters)
      const userHasPremium = currentUserData.is_premium || currentUserData.is_platinum || false;

      // Global search is now PREMIUM ONLY
      const isSearchingGlobally = currentUserData.preferences?.search_globally === true && userHasPremium;


      // Alert free users who had search_globally enabled — disable on confirmation
      if (!userHasPremium && currentUserData.preferences?.search_globally === true) {
        Alert.alert(
          t('toast.globalSearchPremiumTitle'),
          t('toast.globalSearchPremiumMessage'),
          [
            { text: t('common.upgrade'), onPress: () => router.push('/settings/subscription') },
            {
              text: t('common.ok'),
              onPress: async () => {
                try {
                  await supabase
                    .from('preferences')
                    .update({ search_globally: false })
                    .eq('profile_id', profileId);
                } catch (err) {
                  console.error('[Discovery] Error disabling search_globally:', err);
                }
              },
            },
          ]
        );
      }

      // Get potential matches with all fields needed for compatibility
      // When searching globally or in search mode, fetch more profiles
      const shouldFetchMore = isSearchingGlobally || effectiveSearchMode;

      // For LOCAL search: Use distance-based RPC function to get ALL profiles within distance
      // For GLOBAL search or SEARCH MODE: Use standard query
      let data: any[] = [];
      let error: any = null;

      if (!isSearchingGlobally && !effectiveSearchMode && currentUserData.latitude && currentUserData.longitude) {
        // LOCAL SEARCH: Use RPC function to get profiles filtered by distance at DATABASE level

        // FIX #3: Limit initial load to 50 profiles to prevent ANR on low-end devices
        const { data: rpcData, error: rpcError } = await supabase.rpc('get_nearby_profiles', {
          p_user_lat: currentUserData.latitude,
          p_user_lon: currentUserData.longitude,
          p_max_distance_miles: effectiveFilters.maxDistance,
          p_user_profile_id: profileId,
          p_min_age: Math.max(18, effectiveFilters.ageMin),
          p_max_age: effectiveFilters.ageMax,
          p_gender_prefs: effectiveFilters.genderPreference?.length > 0 ? effectiveFilters.genderPreference : (currentUserData.preferences?.gender_preference || []),
          p_result_limit: 50  // FIX #3: Reduced from 500 to 50 for better performance
        });

        if (rpcError) {
          console.error('RPC error:', rpcError);
          throw rpcError;
        }

        // Fetch full profile data with photos and preferences for each nearby profile

        if (rpcData && rpcData.length > 0) {

          // Filter out already-swiped profiles from RPC results
          const swipedSet = new Set(swipedIds);
          const nearbyIds = rpcData.map((p: any) => p.id).filter((id: string) => !swipedSet.has(id));


          if (nearbyIds.length > 0) {
            const { data: fullProfiles, error: profilesError } = await supabase
              .from('profiles')
              .select(`
                *,
                photos (
                  url,
                  is_primary,
                  display_order,
                  blur_data_uri
                ),
                preferences:preferences(*)
              `)
              .in('id', nearbyIds)
              .eq('is_active', true) // CRITICAL: Double-check banned users are filtered
              .or('policy_restricted.is.null,policy_restricted.eq.false'); // Filter policy restricted

            if (profilesError) {
              console.error('❌ Full profile fetch error:', profilesError);
              throw profilesError;
            }

            data = fullProfiles || [];
          } else {

          }
        } else {

        }
      } else {
        // GLOBAL SEARCH or SEARCH MODE: Use standard query

        let query = supabase
          .from('profiles')
          .select(`
            *,
            photos (
              url,
              is_primary,
              display_order,
              blur_data_uri
            ),
            preferences:preferences(*)
          `)
          .neq('id', profileId)
          .eq('is_active', true) // CRITICAL: Filter out banned/deactivated users
          .or('policy_restricted.is.null,policy_restricted.eq.false') // Filter policy restricted users
          .eq('incognito_mode', false)
          .eq('profile_complete', true)
          .eq('photo_review_required', false)
          .limit(effectiveSearchMode ? 500 : 200)
          .order('created_at', { ascending: false });

      // In SEARCH MODE: Only exclude blocked/banned users, NOT swiped profiles
      // This allows users to find profiles they may have already seen
      if (effectiveSearchMode) {


        // Only exclude blocked and banned users in search mode
        // Cap at 150 IDs to avoid PostgREST URL length limits (400 Bad Request)
        const searchExcludeIds = [...blockedIds, ...bannedProfileIds];
        if (searchExcludeIds.length > 0 && searchExcludeIds.length <= 150) {
          query = query.not('id', 'in', `(${searchExcludeIds.join(',')})`);
        }

        // Add server-side search filter using ILIKE for scalar TEXT fields only
        // Array fields (gender, ethnicity, love_language, sexual_orientation, hobbies, etc.)
        // are handled by the client-side filter instead
        if (effectiveSearchKeyword.trim()) {
          const keyword = effectiveSearchKeyword.trim();
          // Only search scalar text fields - NOT arrays
          query = query.or(
            `display_name.ilike.%${keyword}%,` +
            `bio.ilike.%${keyword}%,` +
            `occupation.ilike.%${keyword}%,` +
            `zodiac_sign.ilike.%${keyword}%,` +
            `location_city.ilike.%${keyword}%,` +
            `location_state.ilike.%${keyword}%,` +
            `education.ilike.%${keyword}%,` +
            `religion.ilike.%${keyword}%,` +
            `personality_type.ilike.%${keyword}%,` +
            `political_views.ilike.%${keyword}%`
          );
        }

        // Only apply safety minimum age of 18
        query = query.gte('age', 18);
      } else {
        // In NORMAL mode, exclude all swiped profiles
        // Cap at 150 IDs to avoid PostgREST URL length limits (400 Bad Request)
        // When over 200, we filter client-side after the query
        if (swipedIds.length > 0 && swipedIds.length <= 150) {
          query = query.not('id', 'in', `(${swipedIds.join(',')})`);
        }
        // Apply strict age filters (no buffer - respect user preferences exactly)
        // Safety: Always enforce minimum age of 18

        query = query
          .gte('age', Math.max(18, effectiveFilters.ageMin))
          .lte('age', effectiveFilters.ageMax);

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

          query = query.filter('gender', 'ov', pgArrayLiteral);
        }
      }

        // Apply premium filters (only if user is premium AND filters are set AND not in search mode)
        if (isPremium && !effectiveSearchMode) {
          // Religion filter
          if (effectiveFilters.religion.length > 0) {
            query = query.in('religion', effectiveFilters.religion);
          }

          // Political views filter
          if (effectiveFilters.politicalViews.length > 0) {
            query = query.in('political_views', effectiveFilters.politicalViews);
          }
        }

        const { data: queryData, error: queryError } = await query;
        if (queryError) throw queryError;
        data = queryData || [];
        error = queryError;
      }

      if (error) throw error;

      // Client-side exclusion fallback when ID list was too large for server-side filter
      // This handles users with 200+ swipes where the URL would exceed PostgREST limits
      let filteredData = data || [];
      if (swipedIds.length > 150) {
        const swipedSet = new Set(swipedIds);
        filteredData = filteredData.filter((p: any) => !swipedSet.has(p.id));
      }

      // Contact blocking using server-side function for privacy
      // This securely checks phone numbers without exposing them to the client
      if (blockedPhoneHashes.size > 0) {
        try {
          // Call server-side function that has access to auth.users.phone
          const { data: contactBlockedProfileIds, error: rpcError } = await supabase
            .rpc('get_contact_blocked_profile_ids', {
              requesting_profile_id: profileId
            });

          if (rpcError) {
            console.error('Error fetching contact-blocked profiles:', rpcError);
          } else if (contactBlockedProfileIds && contactBlockedProfileIds.length > 0) {
            const blockedProfileIdSet = new Set(contactBlockedProfileIds);
            const beforeCount = filteredData.length;
            filteredData = filteredData.filter((p: any) => !blockedProfileIdSet.has(p.id));
            const blockedCount = beforeCount - filteredData.length;

            if (blockedCount > 0) {

            }
          }
        } catch (error) {
          console.error('Contact blocking error:', error);
          // Don't fail the entire discovery flow if contact blocking fails
        }
      }

      // SAFETY: Filter out profiles that have blocked viewer's country
      // This protects users who don't want to be seen by people in specific countries
      const userCountry = currentUserData.location_country || 'US';

      // Only query country blocks if we have filtered data
      if (userCountry && filteredData.length > 0) {
        const profileIds = filteredData.map((p: any) => p.id);

        // Batch query for country blocks - check both country code AND country name
        // This handles cases where location_country might be stored as 'Jamaica' or 'JM'
        const { data: countryBlockedProfiles } = await supabase
          .from('country_blocks')
          .select('profile_id')
          .or(`country_code.eq.${userCountry},country_name.ilike.${userCountry}`)
          .in('profile_id', profileIds);

        if (countryBlockedProfiles && countryBlockedProfiles.length > 0) {
          const countryBlockedIds = new Set(countryBlockedProfiles.map(cb => cb.profile_id));
          const filteredCount = filteredData.filter((p: any) => countryBlockedIds.has(p.id)).length;
          if (filteredCount > 0) {

          }
          filteredData = filteredData.filter((p: any) => !countryBlockedIds.has(p.id));
        }
      }

      // SAFETY: Filter out profiles FROM countries that the viewer has blocked
      // This protects viewers from seeing profiles from countries they don't want to see
      const { data: viewerBlockedCountries } = await supabase
        .from('country_blocks')
        .select('country_code, country_name')
        .eq('profile_id', profileId);

      if (viewerBlockedCountries && viewerBlockedCountries.length > 0) {
        // Create sets for both country codes AND country names for flexible matching
        const blockedCountryCodes = new Set(viewerBlockedCountries.map(cb => cb.country_code));
        const blockedCountryNames = new Set(viewerBlockedCountries.map(cb => cb.country_name.toLowerCase()));

        // Filter out profiles from blocked countries
        filteredData = filteredData.filter((p: any) => {
          // Check if profile's location_country matches either the code or name
          if (p.location_country) {
            const profileCountry = p.location_country.toLowerCase();

            // Check against country codes (e.g., 'JM')
            if (blockedCountryCodes.has(p.location_country)) {

              return false;
            }

            // Check against country names (e.g., 'Jamaica')
            if (blockedCountryNames.has(profileCountry)) {

              return false;
            }
          }
          return true;
        });
      }

      // ANR FIX: Transform profiles first with default scores, calculate compatibility after UI renders

      // Log active filter state for debugging


      const transformedProfiles: Profile[] = filteredData
        .map((profile: any) => {

          // Start with default compatibility score for fast initial render
          let compatibilityScore = 75;
          let compatibilityBreakdown = undefined;

          // FIX #2: Calculate real distance using helper function (eliminates duplicate calculations)
          let distance = null;
          if (currentUserData.latitude && currentUserData.longitude && profile.latitude && profile.longitude) {
            distance = calculateDistance(currentUserData.latitude, currentUserData.longitude, profile.latitude, profile.longitude);
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
          try {

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
          // ONE-SIDED: Only check if profile fits current user's age preferences
          // Do NOT check if current user fits profile's age preferences (removed for small userbase)
          if (profile.age < effectiveFilters.ageMin || profile.age > effectiveFilters.ageMax) {

            return false;
          }


          // 1b. RELATIONSHIP TYPE / INTENTION FILTER (quick filter)
          if (selectedIntentionRef.current && profile.preferences?.relationship_type) {
            if (profile.preferences.relationship_type !== selectedIntentionRef.current) {

              return false;
            }
          }


          // 1c. ACTIVE TODAY FILTER (quick filter)
          if (effectiveFilters.activeToday && profile.last_active_at) {
            const lastActive = new Date(profile.last_active_at);
            const now = new Date();
            const hoursSinceActive = (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60);
            if (hoursSinceActive > 24) {

              return false;
            }
          }


          // 2. GENDER PREFERENCE - handled by RPC (p_gender_prefs), no client-side duplicate needed


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

          // 4. LOCATION/DISTANCE FILTER
          // IMPORTANT: A user's distance preference is ALWAYS respected.
          // - search_globally: Only affects what THAT user sees, not who sees them
          // - preferred_cities: Only affects what THAT user sees, not who sees them
          //
          // Example: User in Saudi Arabia adds "NYC" as preferred city
          // - They WILL see NYC profiles (because NYC is in their preferred cities)
          // - NYC users with 50-mile limit will NOT see them (their distance pref is respected)
          //
          // This prevents users from gaming the system to appear in distant users' feeds.
          //
          // NOTE: Global search and preferred cities are now FREE for all users
          // to help grow the user base during early launch phase.
          const userSearchGlobally = isSearchingGlobally;

          // Preferred cities is now FREE for all users
          const userPreferredCities = currentUserData.preferences?.preferred_cities || [];

          // Check if profile is in CURRENT USER's preferred cities
          // This lets users see profiles in cities they're interested in
          const profileInUserPreferredCity = userPreferredCities.length > 0 &&
            userPreferredCities.some((city: string) => {
              const [prefCity, prefState] = city.split(',').map((s: string) => s.trim().toLowerCase());
              const profileCity = (profile.location_city || '').toLowerCase();
              const profileState = (profile.location_state || '').toLowerCase();

              if (prefCity === profileCity) {
                return !prefState || prefState === profileState;
              }
              return false;
            });

          // Apply distance filter if current user is NOT searching globally
          // AND profile is NOT in current user's preferred cities
          if (!userSearchGlobally && !profileInUserPreferredCity) {

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

            if (realTimeDistance !== null && realTimeDistance > effectiveFilters.maxDistance) {

              return false;
            }
          }


          // 5. CHILDREN COMPATIBILITY - REMOVED AS BLOCKING FILTER
          // Note: Children preferences are important for compatibility scoring, but should NOT
          // be a hard dealbreaker in a lavender marriage app. Lavender marriages often involve
          // negotiated arrangements where children decisions can be discussed and agreed upon.
          //
          // Example: Someone who wants children might match with someone who doesn't, because:
          // - They might use surrogacy/adoption independently
          // - The arrangement might involve co-parenting with outside partners
          // - Preferences might change through conversation
          //
          // FILTER REMOVED - Compatibility score handles this preference instead of blocking.

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
          // FREE FILTERS (Active Today, Blurred Photos)
          // ====================================================================

          // Active Today filter - only show users active in the last 24 hours
          if (effectiveFilters.activeToday) {
            const lastActiveAt = profile.last_active_at ? new Date(profile.last_active_at) : null;
            if (lastActiveAt) {
              const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
              if (lastActiveAt < twentyFourHoursAgo) {

                return false;
              }
            } else {

              return false;
            }
          }

          // Show Blurred Photos filter - hide profiles with photo blur if disabled
          if (!effectiveFilters.showBlurredPhotos && profile.photo_blur_enabled) {

            return false;
          }


          // ====================================================================
          // PREFERENCE FILTERS (Applied to all users, not just premium)
          // ====================================================================

          // Religion filter
          if (effectiveFilters.religion.length > 0 && profile.religion) {
            if (!effectiveFilters.religion.includes(profile.religion)) {

              return false;
            }
          }

          // Political views filter
          if (effectiveFilters.politicalViews.length > 0 && profile.political_views) {
            if (!effectiveFilters.politicalViews.includes(profile.political_views)) {

              return false;
            }
          }

          // Housing preference filter (for premium users with specific preferences)
          if (isPremium && effectiveFilters.housingPreference.length > 0 &&
              profile.preferences?.housing_preference) {
            const profileHousing = Array.isArray(profile.preferences.housing_preference)
              ? profile.preferences.housing_preference
              : [profile.preferences.housing_preference];

            const hasMatch = profileHousing.some((h: string) => effectiveFilters.housingPreference.includes(h));
            if (!hasMatch) {

              return false;
            }
          }

          // Financial arrangement filter (for premium users with specific preferences)
          if (isPremium && effectiveFilters.financialArrangement.length > 0 &&
              profile.preferences?.financial_arrangement) {
            const profileFinancial = Array.isArray(profile.preferences.financial_arrangement)
              ? profile.preferences.financial_arrangement
              : [profile.preferences.financial_arrangement];

            const hasMatch = profileFinancial.some((f: string) => effectiveFilters.financialArrangement.includes(f));
            if (!hasMatch) {

              return false;
            }
          }

          // ====================================================================
          // PREMIUM FILTERS - Identity & Background
          // ====================================================================

          // Gender preference filter - handled by RPC (p_gender_prefs), no client-side duplicate needed
          // Note: profile.gender can be an array, which caused .includes() to fail with strict equality

          // Ethnicity filter (profile.ethnicity is text[] in DB)
          if (isPremium && effectiveFilters.ethnicity.length > 0 && profile.ethnicity) {
            const profileEthnicities = Array.isArray(profile.ethnicity) ? profile.ethnicity : [profile.ethnicity];
            const ethnicityMatch = profileEthnicities.some((e: string) => effectiveFilters.ethnicity.includes(e));
            if (!ethnicityMatch) {

              return false;
            }
          }

          // Sexual orientation filter (profile.sexual_orientation is text[] in DB)
          if (isPremium && effectiveFilters.sexualOrientation.length > 0 && profile.sexual_orientation) {
            const profileOrientations = Array.isArray(profile.sexual_orientation) ? profile.sexual_orientation : [profile.sexual_orientation];
            const orientationMatch = profileOrientations.some((o: string) => effectiveFilters.sexualOrientation.includes(o));
            if (!orientationMatch) {

              return false;
            }
          }

          // ====================================================================
          // PREMIUM FILTERS - Physical & Personality
          // ====================================================================

          // Height filter
          if (isPremium && (effectiveFilters.heightMin !== 48 || effectiveFilters.heightMax !== 84) && profile.height_inches) {
            if (profile.height_inches < effectiveFilters.heightMin || profile.height_inches > effectiveFilters.heightMax) {
              return false;
            }
          }

          // Zodiac sign filter
          if (isPremium && effectiveFilters.zodiacSign.length > 0 && profile.zodiac_sign) {
            if (!effectiveFilters.zodiacSign.includes(profile.zodiac_sign)) {
              return false;
            }
          }

          // Personality type (MBTI) filter
          if (isPremium && effectiveFilters.personalityType.length > 0 && profile.personality_type) {
            if (!effectiveFilters.personalityType.includes(profile.personality_type)) {
              return false;
            }
          }

          // Love language filter (profile.love_language is text[] in DB)
          if (isPremium && effectiveFilters.loveLanguage.length > 0 && profile.love_language) {
            const profileLoveLanguages = Array.isArray(profile.love_language) ? profile.love_language : [profile.love_language];
            const loveLanguageMatch = profileLoveLanguages.some((l: string) => effectiveFilters.loveLanguage.includes(l));
            if (!loveLanguageMatch) {
              return false;
            }
          }

          // ====================================================================
          // PREMIUM FILTERS - Lifestyle
          // ====================================================================

          // Languages spoken filter
          if (isPremium && effectiveFilters.languagesSpoken.length > 0 && profile.languages_spoken) {
            const profileLanguages = Array.isArray(profile.languages_spoken)
              ? profile.languages_spoken
              : [profile.languages_spoken];
            const hasMatch = profileLanguages.some((lang: string) => effectiveFilters.languagesSpoken.includes(lang));
            if (!hasMatch) {
              return false;
            }
          }

          // Smoking filter
          if (isPremium && effectiveFilters.smoking.length > 0 && profile.preferences?.lifestyle_preferences?.smoking) {
            if (!effectiveFilters.smoking.includes(profile.preferences.lifestyle_preferences.smoking)) {
              return false;
            }
          }

          // Drinking filter
          if (isPremium && effectiveFilters.drinking.length > 0 && profile.preferences?.lifestyle_preferences?.drinking) {
            if (!effectiveFilters.drinking.includes(profile.preferences.lifestyle_preferences.drinking)) {
              return false;
            }
          }

          // Pets filter
          if (isPremium && effectiveFilters.pets.length > 0 && profile.preferences?.lifestyle_preferences?.pets) {
            if (!effectiveFilters.pets.includes(profile.preferences.lifestyle_preferences.pets)) {
              return false;
            }
          }

          // ====================================================================
          // PREMIUM FILTERS - Marriage Intentions
          // ====================================================================

          // Primary reason filter
          if (isPremium && effectiveFilters.primaryReason.length > 0 && profile.preferences?.primary_reason) {
            if (!effectiveFilters.primaryReason.includes(profile.preferences.primary_reason)) {
              return false;
            }
          }

          // Relationship type filter
          if (isPremium && effectiveFilters.relationshipType.length > 0 && profile.preferences?.relationship_type) {
            if (!effectiveFilters.relationshipType.includes(profile.preferences.relationship_type)) {
              return false;
            }
          }

          // Wants children filter - available to ALL users (not just premium)
          // This is a fundamental life compatibility factor that shouldn't be paywalled

          if (effectiveFilters.wantsChildren !== null && profile.preferences?.wants_children !== undefined) {
            const wantsChildrenMap: { [key: string]: boolean | null } = {
              'yes': true,
              'no': false,
              'maybe': null,
            };
            const filterValue = wantsChildrenMap[effectiveFilters.wantsChildren];
            // If filter is 'maybe', allow all. Otherwise check exact match
            if (filterValue !== null && profile.preferences.wants_children !== filterValue) {
              return false;
            }
          }

          // All filters passed

          return true;
          } catch (filterErr) {
            console.error('❌ FILTER ERROR:', profile?.display_name, filterErr);
            return false;
          }
        });



      // Sort profiles with ORGANIC mixing of people who liked you (Hinge-style)
      // Instead of putting all "liked you" profiles at top (too obvious),
      // we mix 1-3 of them randomly throughout the deck for natural discovery

      // Separate profiles into two groups
      const profilesWhoLikedYou = transformedProfiles.filter(p => peopleWhoLikedMeIds.has(p.id));
      const otherProfiles = transformedProfiles.filter(p => !peopleWhoLikedMeIds.has(p.id));

      // Sort other profiles by: 1) Boosted status, 2) Compatibility score
      const sortedOtherProfiles = otherProfiles.sort((a, b) => {
        const aIsBoosted = boostedProfileIds.has(a.id);
        const bIsBoosted = boostedProfileIds.has(b.id);

        if (aIsBoosted && !bIsBoosted) return -1;
        if (!aIsBoosted && bIsBoosted) return 1;

        // Otherwise sort by compatibility score
        return (b.compatibility_score || 0) - (a.compatibility_score || 0);
      });

      // ORGANIC MIXING: Take up to 3 profiles who liked you and mix them into the deck
      // This gives free users a fair chance to match without knowing who liked them
      const maxLikedYouToMix = 3;
      const likedYouToMix = profilesWhoLikedYou.slice(0, maxLikedYouToMix);
      const remainingLikedYou = profilesWhoLikedYou.slice(maxLikedYouToMix);

      // Start with sorted profiles
      let sortedProfiles = [...sortedOtherProfiles];

      // Mix the "liked you" profiles at random positions throughout the first 10 cards
      // This ensures they appear early but not all at once
      likedYouToMix.forEach((profile, index) => {
        // Place within first 10 positions, spread out
        // First one: position 1-3, Second: position 4-6, Third: position 7-9
        const minPos = index * 3 + 1;
        const maxPos = Math.min(minPos + 2, sortedProfiles.length);
        const randomPos = Math.floor(Math.random() * (maxPos - minPos + 1)) + minPos;
        const insertPos = Math.min(randomPos, sortedProfiles.length);
        sortedProfiles.splice(insertPos, 0, profile);
      });

      // Add any remaining "liked you" profiles at the end (they'll still appear eventually)
      sortedProfiles = [...sortedProfiles, ...remainingLikedYou];



      setProfiles(sortedProfiles);
      setCurrentIndex(0);
      hasInitiallyLoaded.current = true;

      // ANR FIX: Calculate compatibility scores after animations complete
      // InteractionManager.runAfterInteractions waits for all animations/transitions to finish
      // This prevents blocking the UI thread and avoids ANR on Android
      InteractionManager.runAfterInteractions(() => {
        if (currentUserData.preferences && sortedProfiles.length > 0) {
          // Process in batches to avoid blocking main thread
          const BATCH_SIZE = 5;
          let currentBatch = 0;
          const totalBatches = Math.ceil(sortedProfiles.length / BATCH_SIZE);
          let updatedProfiles = [...sortedProfiles];

          const processBatch = () => {
            const start = currentBatch * BATCH_SIZE;
            const end = Math.min(start + BATCH_SIZE, sortedProfiles.length);

            for (let i = start; i < end; i++) {
              const profile = sortedProfiles[i];
              try {
                if (profile.preferences) {
                  const compatibilityScore = calculateCompatibilityScore(
                    currentUserData as any,
                    profile as any,
                    currentUserData.preferences,
                    profile.preferences
                  );
                  const compatibilityBreakdown = getCompatibilityBreakdown(
                    currentUserData as any,
                    profile as any,
                    currentUserData.preferences,
                    profile.preferences
                  );
                  updatedProfiles[i] = { ...profile, compatibility_score: compatibilityScore, compatibilityBreakdown };
                }
              } catch (err) {
                console.error('Error calculating compatibility for profile:', profile.id, err);
              }
            }

            currentBatch++;
            if (currentBatch < totalBatches) {
              // Process next batch on next frame to keep UI responsive
              requestAnimationFrame(processBatch);
            } else {
              // All batches done, update state once
              setProfiles(updatedProfiles);
            }
          };

          processBatch();
        }
      });

      // Prefetch images for the first few profiles for instant loading
      // For blur-enabled profiles, prefetch blur_data_uri instead of original URL to protect privacy
      const imagesToPrefetch = sortedProfiles
        .slice(0, 5) // Prefetch first 5 profiles
        .flatMap(p => p.photos?.map(photo => {
          if (p.photo_blur_enabled && photo.blur_data_uri) return photo.blur_data_uri;
          return photo.url;
        }) || [])
        .filter(Boolean);

      if (imagesToPrefetch.length > 0) {
        prefetchImages(imagesToPrefetch);
      }
    } catch (error: any) {
      console.error('❌ Error loading profiles:', error);
      showToast({ type: 'error', title: t('common.error'), message: error.message || t('toast.profilesLoadError') });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSwipeLeft = useCallback(async (): Promise<boolean> => {
    if (!currentProfileId || currentIndex >= profiles.length) {
      return false;
    }

    // Block swiping if profile is incomplete
    if (!isProfileComplete) {
      Alert.alert(
        'Complete Your Profile',
        'You need to finish setting up your profile before you can start matching.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Complete Profile', onPress: () => router.push('/(onboarding)/basic-info') }
        ]
      );
      return false;
    }

    // Passing (swiping left) is unlimited for all users
    const targetProfile = profiles[currentIndex];
    if (!targetProfile) return false;

    try {
      // Check if we already passed this profile (can happen in search mode)
      const { data: existingPass } = await supabase
        .from('passes')
        .select('id')
        .eq('passer_profile_id', currentProfileId)
        .eq('passed_profile_id', targetProfile.id)
        .maybeSingle();

      if (existingPass) {

        // Already passed - just move to next card
        const newIndex = currentIndex + 1;
        setCurrentIndex(newIndex);
        return true;
      }

      // Insert pass into database
      await supabase.from('passes').insert({
        passer_profile_id: currentProfileId,
        passed_profile_id: targetProfile.id,
      });

      // Track swipe left
      trackUserAction.swipedLeft(targetProfile.id);
      trackFunnel.profileCardSwiped();

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
  }, [currentProfileId, currentIndex, profiles, likeCount, isPremium, isProfileComplete]);

  const handleSwipeRight = useCallback(async (message?: string, likedContentData?: { type: string; prompt?: string; answer?: string; index?: number }): Promise<boolean> => {
    if (!currentProfileId || currentIndex >= profiles.length) {
      return false;
    }

    // Block swiping if profile is incomplete
    if (!isProfileComplete) {
      Alert.alert(
        'Complete Your Profile',
        'You need to finish setting up your profile before you can start matching.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Complete Profile', onPress: () => router.push('/(onboarding)/basic-info') }
        ]
      );
      return false;
    }

    // Check like limit (free users: 5 likes/day, premium: unlimited)
    if (!checkLikeLimit()) return false;

    const targetProfile = profiles[currentIndex];
    if (!targetProfile) return false;


    try {
      // Check if we already liked this profile (can happen in search mode)
      const { data: existingLike } = await supabase
        .from('likes')
        .select('id')
        .eq('liker_profile_id', currentProfileId)
        .eq('liked_profile_id', targetProfile.id)
        .maybeSingle();

      if (existingLike) {


        // Check if the OTHER person has also liked you (mutual like check)
        // Uses SECURITY DEFINER RPC to bypass RLS (free users can't directly read received likes)
        const { data: mutualLikeId } = await supabase
          .rpc('check_mutual_like', { p_target_profile_id: targetProfile.id });

        if (mutualLikeId) {
          // Check if there's already an ACTIVE match
          const profile1Id = currentProfileId < targetProfile.id ? currentProfileId : targetProfile.id;
          const profile2Id = currentProfileId < targetProfile.id ? targetProfile.id : currentProfileId;

          const { data: existingMatch } = await supabase
            .from('matches')
            .select('id, status')
            .eq('profile1_id', profile1Id)
            .eq('profile2_id', profile2Id)
            .maybeSingle();

          if (existingMatch?.status === 'active') {
            // Already matched and active
            showToast({ type: 'info', title: t('common.success'), message: t('toast.alreadyMatched', { name: targetProfile.display_name }) });
            const newIndex = currentIndex + 1;
            setCurrentIndex(newIndex);
            return true;
          }

          // Either no match exists, or it was unmatched - create/recreate the match!


          if (existingMatch && existingMatch.status === 'unmatched') {
            // Update the existing unmatched record to active
            const { data: reactivatedMatch, error: updateError } = await supabase
              .from('matches')
              .update({
                status: 'active',
                matched_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
                unmatched_by: null,
                unmatched_at: null,
                unmatch_reason: null,
                first_message_sent_at: null, // Reset expiration timer
              })
              .eq('id', existingMatch.id)
              .select('id')
              .single();

            if (updateError) {
              console.error('❌ Error reactivating match:', updateError);
            } else {

              trackUserAction.matched(reactivatedMatch?.id || '');
              trackFunnel.matchReceived();

              setMatchId(reactivatedMatch?.id || null);
              setMatchedProfile(targetProfile);
              setShowMatchModal(true);
              return true;
            }
          } else {
            // Create new match
            const { data: newMatch, error: matchError } = await supabase
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
            } else {
              trackUserAction.matched(newMatch?.id || '');
              trackFunnel.matchReceived();

              setMatchId(newMatch?.id || null);
              setMatchedProfile(targetProfile);
              setShowMatchModal(true);
              return true;
            }
          }
        } else {
          // No mutual like yet - just show info
          showToast({ type: 'info', title: t('common.success'), message: t('toast.alreadyLiked', { name: targetProfile.display_name }) });
        }

        const newIndex = currentIndex + 1;
        setCurrentIndex(newIndex);
        return true;
      }

      // Insert like into database
      const { error: likeError } = await supabase.from('likes').insert({
        liker_profile_id: currentProfileId,
        liked_profile_id: targetProfile.id,
        message: message || null,
        liked_content: likedContentData ? JSON.stringify(likedContentData) : null,
      });

      if (likeError) {
        if (likeError.code === 'P0001' && likeError.message?.includes('Daily like limit')) {
          setShowPaywall(true);
          return false;
        }
        throw likeError;
      }

      // Track swipe right (like)
      trackUserAction.swipedRight(targetProfile.id);
      trackFunnel.profileLiked();

      // Increment like count (free users limited to 5/day)
      await incrementLikeCount();

      // Check if the OTHER person has also liked you (mutual like check)
      // Uses SECURITY DEFINER RPC to bypass RLS (free users can't directly read received likes)
      const { data: mutualLikeId } = await supabase
        .rpc('check_mutual_like', { p_target_profile_id: targetProfile.id });

      if (mutualLikeId) {
        // It's a mutual match! Create the match


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
          // Track match
          trackUserAction.matched(matchData?.id || '');
          trackFunnel.matchReceived();

          // Store match ID and show match modal
          setMatchId(matchData?.id || null);
          setMatchedProfile(targetProfile);
          setShowMatchModal(true);

          // NOTE: Match notification is sent via database trigger (notify_on_match)
          // Do NOT call sendMatchNotification here - it causes duplicate notifications
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


      // NOTE: Like notification is sent via database trigger (notify_on_like)
      // Do NOT call sendLikeNotification here - it causes duplicate notifications

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
      if (error?.code === 'P0001' && error?.message?.includes('Daily like limit')) {
        setShowPaywall(true);
      }
      return false;
    }
  }, [currentProfileId, currentIndex, profiles, likeCount, isPremium, isProfileComplete]);

  const handleSwipeUp = useCallback(async (): Promise<boolean> => {
    if (!currentProfileId || currentIndex >= profiles.length) return false;

    // Block swiping if profile is incomplete
    if (!isProfileComplete) {
      Alert.alert(
        'Complete Your Profile',
        'You need to finish setting up your profile before you can start matching.',
        [
          { text: 'Later', style: 'cancel' },
          { text: 'Complete Profile', onPress: () => router.push('/(onboarding)/basic-info') }
        ]
      );
      return false;
    }

    const targetProfile = profiles[currentIndex];
    if (!targetProfile) return false;

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
        .maybeSingle();

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

        if (likeError) {
          if (likeError.code === 'P0001' && likeError.message?.includes('Premium subscription')) {
            Alert.alert(
              t('subscription.upgradeToPremium'),
              t('subscription.upgradeToPremiumSubtitle'),
              [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('common.upgrade'), onPress: () => setShowPaywall(true) },
              ]
            );
            return false;
          }
          throw likeError;
        }
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

      // Check if target user has already liked current user (mutual like = match)
      // Uses SECURITY DEFINER RPC to bypass RLS (free users can't directly read received likes)
      const { data: mutualLikeId } = await supabase
        .rpc('check_mutual_like', { p_target_profile_id: targetProfile.id });

      if (mutualLikeId) {
        // It's a match! Check if match already exists
        const profile1Id = currentProfileId < targetProfile.id ? currentProfileId : targetProfile.id;
        const profile2Id = currentProfileId < targetProfile.id ? targetProfile.id : currentProfileId;

        const { data: existingMatch } = await supabase
          .from('matches')
          .select('id')
          .eq('profile1_id', profile1Id)
          .eq('profile2_id', profile2Id)
          .maybeSingle();

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

          if (matchError) {
            console.error('Match creation error:', matchError);
          } else {
            // It's a match - show match modal
            setMatchId(matchData?.id || null);
            setMatchedProfile(targetProfile);
            setShowMatchModal(true);

            // NOTE: Match notification is sent via database trigger (notify_on_match)
            // Do NOT call sendMatchNotification here - it causes duplicate notifications
          }
        }
      }

      // NOTE: Like notification is sent via database trigger (notify_on_like)
      // Do NOT call sendLikeNotification here - it causes duplicate notifications

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
      showToast({
        type: 'success',
        title: t('toast.obsessedTitle'),
        message: isPremium
          ? t('toast.obsessedWithRemaining', { name: targetProfile.display_name, remaining })
          : t('toast.obsessedBasic', { name: targetProfile.display_name })
      });

      // Move to next card
      advanceIndex();
      return true;
    } catch (error: any) {
      console.error('Error recording super like:', error);
      if (error?.code === 'P0001' && error?.message?.includes('Premium subscription')) {
        Alert.alert(
          t('subscription.upgradeToPremium'),
          t('subscription.upgradeToPremiumSubtitle'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.upgrade'), onPress: () => setShowPaywall(true) },
          ]
        );
      } else if (error?.code === 'P0001' && error?.message?.includes('Daily like limit')) {
        setShowPaywall(true);
      } else {
        showToast({ type: 'error', title: t('common.error'), message: t('toast.superLikeError') });
      }
      return false;
    }
  }, [currentProfileId, currentIndex, profiles, isPremium, isProfileComplete]);

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
      showToast({ type: 'info', title: t('toast.noRecentSwipes'), message: t('toast.noRecentSwipes') });
      return;
    }

    if (!currentProfileId) return;

    try {


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

      // Decrement like count if not premium and action was a like (passes are unlimited)
      if (!isPremium && lastSwipe.action === 'like' && likeCount > 0) {
        const newCount = likeCount - 1;
        setLikeCount(newCount);
        const today = new Date().toDateString();
        await AsyncStorage.setItem('like_data', JSON.stringify({ date: today, count: newCount }));
      }

      // Go back to the previous profile
      setCurrentIndex(lastSwipe.index);

      // Reset scroll position to top
      discoveryProfileRef.current?.scrollToTop();

      // Clear last swipe
      setLastSwipe(null);

      showToast({ type: 'success', title: t('toast.swipeUndone'), message: t('toast.swipeUndone') });
    } catch (error: any) {
      console.error('❌ Error rewinding:', error);
      showToast({ type: 'error', title: t('common.error'), message: t('toast.undoSwipeError') });
    }
  }, [lastSwipe, currentProfileId, isPremium, likeCount]);

  const handleProfilePress = useCallback(async () => {
    if (currentIndex >= profiles.length) return;
    const targetProfile = profiles[currentIndex];
    if (!targetProfile) return;

    // Track profile view
    trackUserAction.profileViewed(targetProfile.id);

    // Use preferences that are already embedded in the profile
    // from the main query (line 267: preferences:preferences(*))
    const prefs = (targetProfile as any).preferences;
    setCurrentProfilePreferences(prefs);
    setShowImmersiveProfile(true);
  }, [currentIndex, profiles]);

  // Calculate smart recommendations using database function
  const calculateSmartRecommendations = useCallback(async () => {
    if (!currentProfileId) return;

    try {
      // Get current user's location and preferences IN PARALLEL for better performance
      const [
        { data: userData },
        { data: prefsData }
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('latitude, longitude, is_premium, is_platinum')
          .eq('id', currentProfileId)
          .single(),
        supabase
          .from('preferences')
          .select('gender_preference')
          .eq('profile_id', currentProfileId)
          .single()
      ]);

      if (!userData || !userData.latitude || !userData.longitude) {
        console.warn('User location not available for smart recommendations');
        return;
      }

      // Normalize gender preferences to ensure it's a proper array
      let genderPrefs = prefsData?.gender_preference;


      if (!genderPrefs || genderPrefs === '' || (Array.isArray(genderPrefs) && genderPrefs.length === 0)) {
        genderPrefs = null; // Pass null instead of empty array/string
      } else if (!Array.isArray(genderPrefs)) {
        // If it's a string, try to parse it as an array
        genderPrefs = typeof genderPrefs === 'string' ? [genderPrefs] : null;
      }



      // Call database RPC function for accurate recommendations
      // Pass current filters so counts match what the discovery feed actually shows
      const userIsPremium = userData.is_premium || userData.is_platinum || false;
      const { data, error } = await supabase.rpc('get_smart_recommendations', {
        p_user_profile_id: currentProfileId,
        p_user_lat: userData.latitude,
        p_user_lon: userData.longitude,
        p_current_max_distance_miles: filters.maxDistance,
        p_current_min_age: filters.ageMin,
        p_current_max_age: filters.ageMax,
        p_current_gender_prefs: genderPrefs,
        p_discovery_filters: {
          religion: filters.religion,
          politicalViews: filters.politicalViews,
          ethnicity: filters.ethnicity,
          sexualOrientation: filters.sexualOrientation,
          heightMin: filters.heightMin,
          heightMax: filters.heightMax,
          zodiacSign: filters.zodiacSign,
          personalityType: filters.personalityType,
          loveLanguage: filters.loveLanguage,
          languagesSpoken: filters.languagesSpoken,
          activeToday: filters.activeToday,
          showBlurredPhotos: filters.showBlurredPhotos,
          housingPreference: filters.housingPreference,
          financialArrangement: filters.financialArrangement,
          relationshipType: filters.relationshipType,
        },
        p_is_premium: userIsPremium
      });

      if (error) {
        console.error('Error fetching smart recommendations:', error);
        return;
      }

      // Set recommendations from database response
      if (data && data.recommendations) {
        setSmartRecommendations(data.recommendations);
      }
    } catch (error) {
      console.error('Error calculating smart recommendations:', error);
    }
  }, [currentProfileId, filters]);

  // Calculate smart recommendations when empty state is shown (only after first load)
  useEffect(() => {
    if (hasInitiallyLoaded.current && currentIndex >= profiles.length && currentProfileId && !loading && !isSearchMode) {
      calculateSmartRecommendations();
    }
  }, [currentIndex, profiles.length, currentProfileId, loading, isSearchMode, calculateSmartRecommendations]);

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

    setCurrentIndex(newIndex);
  };

  const handleSendMessage = () => {
    setShowMatchModal(false);

    // Advance to next card after going to chat
    const newIndex = currentIndex + 1;

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

  const handleDismissPhotoBlurBanner = async () => {
    setShowPhotoBlurBanner(false);
    await AsyncStorage.setItem('photo_blur_info_dismissed', 'true');
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

              showToast({ type: 'success', title: t('toast.blockSuccess'), message: t('toast.blockSuccess') });
            } catch (error: any) {
              console.error('Error blocking user:', error);
              showToast({ type: 'error', title: t('common.error'), message: t('toast.blockError') });
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

  // Empty state - no more profiles (only show after first load completes)
  if (hasInitiallyLoaded.current && currentIndex >= profiles.length) {
    return (
      <View className="flex-1 bg-background">
        {/* Header with Search/Filter Controls */}
        <View className="bg-background dark:bg-background pb-4 px-6 border-b border-border" style={{ paddingTop: insets.top + 16 }}>
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
                <MaterialCommunityIcons name="filter-variant" size={20} color={colors.foreground} />
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
                <MaterialCommunityIcons name="chevron-down" size={16} color={colors.foreground} style={{ marginLeft: 4 }} />
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
                <MaterialCommunityIcons name="chevron-down" size={16} color={colors.foreground} style={{ marginLeft: 4 }} />
              </TouchableOpacity>

              {/* Active Today Toggle */}
              <TouchableOpacity
                className={`rounded-full px-3 py-2 flex-row items-center ${activeToday ? 'bg-lavender-500' : 'bg-muted'}`}
                onPress={() => {
                  const newActiveToday = !activeToday;
                  setActiveToday(newActiveToday);
                  const newFilters = { ...filters, activeToday: newActiveToday };
                  setFilters(newFilters);
                  loadProfiles(undefined, undefined, newFilters);
                }}
              >
                <MaterialCommunityIcons name="clock-outline" size={16} color={activeToday ? 'white' : colors.foreground} style={{ marginRight: 4 }} />
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
                <MaterialCommunityIcons name="magnify" size={20} color={colors.foreground} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Age Slider Panel */}
          {showAgeSlider && (
            <View className="mt-3 bg-card dark:bg-card rounded-xl shadow-lg border border-border p-4">
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
                    const newFilters = { ...filters, ageMin: tempAgeMin, ageMax: tempAgeMax };
                    setFilters(newFilters);
                    setShowAgeSlider(false);
                    loadProfiles(undefined, undefined, newFilters);
                  }}
                >
                  <Text className="text-center text-white font-medium">Apply</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Intention Dropdown */}
          {showIntentionDropdown && (
            <View className="absolute top-full left-24 mt-1 bg-card dark:bg-card rounded-xl shadow-lg border border-border z-50" style={{ minWidth: 120 }}>
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

        {/* Smart Empty State with Dynamic Recommendations */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 32, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        >
          {isSearchMode ? (
            /* Search Mode Empty State */
            <View className="items-center">
              <Text className="text-6xl mb-4">🔍</Text>
              <Text className="text-2xl font-display-bold text-foreground mb-3 text-center">
                No results for "{searchKeyword}"
              </Text>
              <Text className="text-muted-foreground mb-6 text-center text-base font-sans">
                Try different keywords or adjust your filters to find more matches.
              </Text>
              <TouchableOpacity
                className="bg-lavender-500 rounded-full py-4 px-8 shadow-lg"
                onPress={handleClearSearch}
              >
                <Text className="text-white font-sans-bold text-lg">Clear Search</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Smart Recommendations System */
            <View>
              {/* Hero Section */}
              <View className="items-center mb-8">
                <Text className="text-6xl mb-4">✨</Text>
                <Text className="text-2xl font-display-bold text-foreground mb-2 text-center">
                  You've Seen All Available Matches!
                </Text>
                <Text className="text-muted-foreground text-center text-base font-sans leading-6">
                  Don't worry—we're actively looking for more perfect matches for you. Meanwhile, here are some ways to discover even more connections!
                </Text>
              </View>

              {/* Smart Recommendations - Dynamically shows relevant suggestions */}
              <View className="mb-6">
                <Text className="text-lg font-display-bold text-foreground mb-4">
                  Smart Suggestions to Find More Matches
                </Text>

                <View className="gap-3">
                  {/* Dynamic Smart Recommendations from Database */}
                  {smartRecommendations.map((rec, index) => {
                    const getIcon = () => {
                      switch (rec.type) {
                        case 'distance': return 'map-marker-radius';
                        case 'age': return 'calendar-range';
                        case 'gender': return 'gender-transgender';
                        case 'global': return 'earth';
                        default: return 'star';
                      }
                    };

                    const getTitle = () => {
                      const count = rec.count || 0;
                      const countText = count >= 1000 ? `${Math.floor(count / 1000)}k+` : `${count}`;

                      switch (rec.type) {
                        case 'distance':
                          return `Increase distance by ${rec.increment} miles`;
                        case 'age':
                          return `Expand age range by ${rec.increment} years`;
                        case 'gender':
                          return `Add ${rec.addedGender} to your preferences`;
                        case 'global':
                          return 'Search globally';
                        default:
                          return 'Expand your search';
                      }
                    };

                    const getCountLabel = () => {
                      const count = rec.count || 0;
                      if (count >= 1000) {
                        return `${(count / 1000).toFixed(1)}k+ matches`;
                      } else if (count > 0) {
                        return `${count} ${count === 1 ? 'match' : 'matches'}`;
                      }
                      return '';
                    };

                    const handlePress = async () => {

                      try {
                        if (rec.type === 'distance' && rec.newDistance) {

                          // Update state for UI and pass directly to loadProfiles to avoid React timing issue
                          setFilters({ ...filters, maxDistance: rec.newDistance });
                          setCurrentIndex(0); // Reset to show new profiles from beginning
                          trackEvent('smart_recommendation_clicked', {
                            type: 'distance',
                            increment: rec.increment,
                            count: rec.count
                          });
                          // Pass new filter value directly to avoid stale state
                          loadProfiles(undefined, undefined, { maxDistance: rec.newDistance });
                        } else if (rec.type === 'age' && rec.newAgeMin && rec.newAgeMax) {

                          // Update state for UI and pass directly to loadProfiles to avoid React timing issue
                          setFilters({ ...filters, ageMin: rec.newAgeMin, ageMax: rec.newAgeMax });
                          setCurrentIndex(0); // Reset to show new profiles from beginning
                          trackEvent('smart_recommendation_clicked', {
                            type: 'age',
                            increment: rec.increment,
                            count: rec.count
                          });
                          // Pass new filter values directly to avoid stale state
                          loadProfiles(undefined, undefined, { ageMin: rec.newAgeMin, ageMax: rec.newAgeMax });
                        } else if (rec.type === 'gender' && rec.addedGender) {
                          // Confirm before modifying gender preferences
                          const addedGender = rec.addedGender;
                          Alert.alert(
                            'Update Preferences?',
                            `Add "${addedGender}" to your gender preferences? You can change this anytime in Settings > Matching Preferences.`,
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Add',
                                onPress: async () => {
                                  try {
                                    const { data: currentPrefs, error: fetchError } = await supabase
                                      .from('preferences')
                                      .select('gender_preference')
                                      .eq('profile_id', currentProfileId)
                                      .maybeSingle();

                                    if (fetchError) {
                                      console.error('[Discovery] Error fetching preferences:', fetchError);
                                      showToast({ type: 'error', title: t('common.error'), message: t('toast.filterError') });
                                      return;
                                    }

                                    const currentGenderPrefs = currentPrefs?.gender_preference || [];
                                    const newGenderPrefs = [...currentGenderPrefs, addedGender];

                                    // Only update gender_preference — do NOT overwrite other fields
                                    const { error: updateError } = await supabase
                                      .from('preferences')
                                      .update({ gender_preference: newGenderPrefs })
                                      .eq('profile_id', currentProfileId);

                                    if (updateError) {
                                      console.error('[Discovery] Error updating gender preference:', updateError);
                                      showToast({ type: 'error', title: t('common.error'), message: t('toast.filterError') });
                                      return;
                                    }

                                    trackEvent('smart_recommendation_clicked', {
                                      type: 'gender',
                                      addedGender,
                                      count: rec.count
                                    });
                                    loadProfiles();
                                  } catch (err) {
                                    console.error('[Discovery] Unexpected error adding gender:', err);
                                    showToast({ type: 'error', title: t('common.error'), message: t('toast.genericError') });
                                  }
                                },
                              },
                            ]
                          );
                        } else if (rec.type === 'global') {
                          // Check premium status before enabling global search
                          if (!isPremium && !isPlatinum) {
                            Alert.alert(
                              t('toast.globalSearchPremiumTitle'),
                              t('toast.globalSearchPremiumMessage'),
                              [
                                { text: t('common.upgrade'), onPress: () => router.push('/settings/subscription') },
                                { text: t('common.ok'), style: 'cancel' },
                              ]
                            );
                            return;
                          }

                          // Confirm before enabling global search
                          Alert.alert(
                            'Enable Global Search?',
                            'Search for matches anywhere in the world? You can change this anytime in Settings > Matching Preferences.',
                            [
                              { text: 'Cancel', style: 'cancel' },
                              {
                                text: 'Enable',
                                onPress: async () => {
                                  try {
                                    const { error } = await supabase
                                      .from('preferences')
                                      .update({ search_globally: true })
                                      .eq('profile_id', currentProfileId);

                                    if (error) {
                                      console.error('[Discovery] Error enabling global search:', error);
                                      showToast({ type: 'error', title: t('common.error'), message: t('toast.globalSearchError') });
                                      return;
                                    }

                                    trackEvent('smart_recommendation_clicked', {
                                      type: 'global',
                                      count: rec.count
                                    });
                                    loadProfiles();
                                  } catch (err) {
                                    console.error('[Discovery] Unexpected error enabling global search:', err);
                                    showToast({ type: 'error', title: t('common.error'), message: t('toast.genericError') });
                                  }
                                },
                              },
                            ]
                          );
                        }
                      } catch (error) {
                        console.error('[Discovery] Unexpected error in handlePress:', error);
                        showToast({ type: 'error', title: t('common.error'), message: t('toast.genericError') });
                      }
                    };

                    return (
                      <TouchableOpacity
                        key={`recommendation-${index}`}
                        className="bg-card dark:bg-card rounded-xl p-4 border border-border flex-row items-center"
                        onPress={handlePress}
                        activeOpacity={0.6}
                      >
                        <View className="bg-lavender-100 dark:bg-lavender-900/30 rounded-full p-3 mr-3">
                          <MaterialCommunityIcons name={getIcon()} size={24} color="#A08AB7" />
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center mb-1">
                            <Text className="text-foreground font-sans-semibold text-base">
                              {getTitle()}
                            </Text>
                            {rec.type === 'global' && !isPremium && !isPlatinum && (
                              <View className="bg-lavender-500 rounded-full px-2 py-0.5 ml-2">
                                <Text className="text-white text-xs font-sans-bold">Premium</Text>
                              </View>
                            )}
                          </View>
                          <View className="flex-row items-center gap-2">
                            <View className="bg-lavender-500 rounded-full px-2.5 py-1">
                              <Text className="text-white text-xs font-sans-bold">{getCountLabel()}</Text>
                            </View>
                            {rec.description && (
                              <Text className="text-muted-foreground text-sm flex-1" numberOfLines={1}>
                                {rec.description}
                              </Text>
                            )}
                          </View>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={24} color="#A1A1AA" />
                      </TouchableOpacity>
                    );
                  })}

                  {/* Always show: Adjust All Filters option */}
                  <TouchableOpacity
                    className="bg-card dark:bg-card rounded-xl p-4 border border-border flex-row items-center"
                    onPress={() => {
                      trackEvent('empty_state_recommendation_clicked', { action: 'open_filters' });
                      setShowFilterModal(true);
                    }}
                  >
                    <View className="bg-lavender-100 dark:bg-lavender-900/30 rounded-full p-2 mr-3">
                      <MaterialCommunityIcons name="tune-variant" size={20} color="#A08AB7" />
                    </View>
                    <View className="flex-1">
                      <Text className="text-foreground font-sans-semibold">Adjust All Filters</Text>
                      <Text className="text-muted-foreground text-sm">Fine-tune your preferences to find better matches</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color="#A1A1AA" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Secondary Actions */}
              <View className="gap-3 mb-6">
                <TouchableOpacity
                  className="bg-lavender-500 rounded-full py-4 shadow-sm"
                  onPress={() => {
                    trackEvent('empty_state_action_clicked', { action: 'search' });
                    setShowSearchBar(true);
                  }}
                >
                  <Text className="text-white font-sans-bold text-base text-center">Search by Keyword</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  className="border-2 border-lavender-500 rounded-full py-4"
                  onPress={() => {
                    trackEvent('empty_state_action_clicked', { action: 'refresh' });
                    handleRefresh();
                  }}
                >
                  <Text className="text-lavender-500 font-sans-bold text-base text-center">Refresh Matches</Text>
                </TouchableOpacity>
              </View>

              {/* Premium Benefits - Subtle, non-intrusive placement */}
              {!isPremium && (
                <View className="mb-6 p-4 bg-card/50 dark:bg-card/30 rounded-xl border border-border/50">
                  <View className="flex-row items-center justify-between mb-3">
                    <View className="flex-row items-center gap-2">
                      <MaterialCommunityIcons name="crown-outline" size={18} color="#A08AB7" />
                      <Text className="text-foreground font-sans-semibold text-sm">Want more matches?</Text>
                    </View>
                    <TouchableOpacity
                      className="bg-lavender-500 rounded-full px-4 py-2"
                      onPress={() => {
                        trackEvent('empty_state_premium_cta_clicked', { source: 'discover_empty_state' });
                        setShowPaywall(true);
                      }}
                    >
                      <Text className="text-white font-sans-semibold text-xs">Try Premium</Text>
                    </TouchableOpacity>
                  </View>
                  <Text className="text-muted-foreground text-xs leading-relaxed">
                    See who liked you, get unlimited swipes, and boost your profile visibility.
                  </Text>
                </View>
              )}

              {/* Social Proof Footer */}
              <View className="items-center pt-6 border-t border-border">
                <View className="flex-row items-center gap-2 mb-2">
                  <MaterialCommunityIcons name="check-decagram" size={16} color="#10B981" />
                  <Text className="text-muted-foreground text-sm">Trusted by 10,000+ users</Text>
                </View>
                <Text className="text-muted-foreground text-xs text-center">
                  Join the safest community for lavender marriages
                </Text>
              </View>
            </View>
          )}
        </ScrollView>

        {/* Filter Modal */}
        <FilterModal
          visible={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          onApply={(newFilters) => {
            setFilters(newFilters);
            setShowFilterModal(false);
            persistFilters(newFilters);
            loadProfiles(undefined, undefined, newFilters);
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

  // Guard against undefined profile (race condition during loading/refresh)
  if (!currentProfile) {
    return null;
  }

  return (
    <View className="flex-1 bg-background" style={{ paddingRight: rightSafeArea }}>
      {/* Header */}
      <View className="bg-background dark:bg-background pb-4 px-6 border-b border-border" style={{ paddingTop: insets.top + 16 }}>
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
              <MaterialCommunityIcons name="filter-variant" size={20} color={colors.foreground} />
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
              <MaterialCommunityIcons name="chevron-down" size={16} color={colors.foreground} style={{ marginLeft: 4 }} />
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
              <MaterialCommunityIcons name="chevron-down" size={16} color={colors.foreground} style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            {/* Active Today Toggle */}
            <TouchableOpacity
              className={`rounded-full px-3 py-2 flex-row items-center ${activeToday ? 'bg-lavender-500' : 'bg-muted'}`}
              onPress={() => {
                const newActiveToday = !activeToday;
                setActiveToday(newActiveToday);
                const newFilters = { ...filters, activeToday: newActiveToday };
                setFilters(newFilters);
                loadProfiles(undefined, undefined, newFilters);
              }}
            >
              <MaterialCommunityIcons name="clock-outline" size={16} color={activeToday ? 'white' : colors.foreground} style={{ marginRight: 4 }} />
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
              <MaterialCommunityIcons name="magnify" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Age Slider Panel */}
        {showAgeSlider && (
          <View className="mt-3 bg-card dark:bg-card rounded-xl shadow-lg border border-border p-4">
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
                  const newFilters = { ...filters, ageMin: tempAgeMin, ageMax: tempAgeMax };
                  setFilters(newFilters);
                  setShowAgeSlider(false);
                  loadProfiles(undefined, undefined, newFilters);
                }}
              >
                <Text className="text-center text-white font-medium">Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Intention Dropdown */}
        {showIntentionDropdown && (
          <View className="absolute top-full left-24 mt-1 bg-card dark:bg-card rounded-xl shadow-lg border border-border z-50" style={{ minWidth: 120 }}>
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

      {/* Trial Expiration Banner - Warn users when trial is about to end */}
      <TrialExpirationBanner key="trial-expiration-banner" />

      {/* Photo Blur Info Banner - Explain why some photos may be blurred */}
      {showPhotoBlurBanner && (
        <View className="mx-4 mt-2 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <View className="flex-row items-start">
            <View className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-full items-center justify-center mr-3">
              <MaterialCommunityIcons name="image-off-outline" size={20} color="#3B82F6" />
            </View>
            <View className="flex-1">
              <Text className="text-blue-900 dark:text-blue-100 font-semibold text-sm">Why Some Photos Are Blurred</Text>
              <Text className="text-blue-700 dark:text-blue-300 text-xs mt-1 leading-5">
                Some users enable Photo Blur in their privacy settings to protect their identity until they match. Photos will be revealed once you connect!
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleDismissPhotoBlurBanner}
              className="ml-2 w-6 h-6 items-center justify-center"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MaterialCommunityIcons name="close" size={20} color="#3B82F6" />
            </TouchableOpacity>
          </View>
        </View>
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

      {/* Complete Profile Banner - For users who haven't finished onboarding */}
      {showOnboardingBanner && !isProfileComplete && (
        <TouchableOpacity
          className="mx-4 mt-2 p-4 bg-lavender-50 border border-lavender-200 rounded-xl flex-row items-center"
          onPress={() => router.push('/(onboarding)/basic-info')}
          activeOpacity={0.8}
        >
          <View className="w-10 h-10 bg-lavender-100 rounded-full items-center justify-center mr-3">
            <MaterialCommunityIcons name="account-edit" size={20} color="#9B87CE" />
          </View>
          <View className="flex-1">
            <Text className="text-lavender-900 font-semibold text-sm">Complete Your Profile</Text>
            <Text className="text-lavender-700 text-xs mt-0.5">Finish setting up to start matching. You can browse but can't like or be seen yet.</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#9B87CE" />
        </TouchableOpacity>
      )}

      {/* Hinge-Style Scrollable Profile View */}
      <Animated.View style={{ flex: 1, opacity: profileOpacity }}>
        <DiscoveryProfileView
          ref={discoveryProfileRef}
          key={currentProfile.id}
          profile={currentProfile as any}
          preferences={currentProfilePreferences}
          compatibilityBreakdown={currentProfile.compatibilityBreakdown}
          distanceUnit={distanceUnit}
          heightUnit={heightUnit}
          onBlock={handleBlock}
          onReport={handleReport}
          onPass={handleSwipeLeft}
          onLike={(_likedContent, message, likedContentData) => handleSwipeRight(message, likedContentData)}
          onSuperLike={handleSwipeUp}
          onRewind={handleRewind}
          canRewind={!!lastSwipe && isPremium}
          isAdmin={isAdmin}
          superLikesRemaining={superLikesRemaining}
          likesRemaining={DAILY_LIKE_LIMIT - likeCount}
          dailyLikeLimit={DAILY_LIKE_LIMIT}
          isPremium={isPremium}
        />
      </Animated.View>

      {/* Match Modal */}
      {matchedProfile && (
        <MatchModal
          visible={showMatchModal}
          onClose={handleCloseMatchModal}
          onSendMessage={handleSendMessage}
          matchedProfile={(() => {
            const primaryPhoto = matchedProfile.photos?.find(p => p.is_primary) || matchedProfile.photos?.[0];
            const blurEnabled = matchedProfile.photo_blur_enabled || false;
            // Respect photo_blur_enabled: match does not equal reveal
            const photoUrl = blurEnabled && primaryPhoto?.blur_data_uri
              ? primaryPhoto.blur_data_uri
              : primaryPhoto?.url;
            return {
              display_name: matchedProfile.display_name,
              photo_url: photoUrl,
              compatibility_score: matchedProfile.compatibility_score,
            };
          })()}
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
        {currentIndex < profiles.length && profiles[currentIndex] && (
          <ImmersiveProfileCard
            profile={profiles[currentIndex] as any}
            preferences={currentProfilePreferences}
            compatibilityBreakdown={profiles[currentIndex]?.compatibilityBreakdown}
            onSwipeLeft={handleImmersiveSwipeLeft}
            onSwipeRight={handleImmersiveSwipeRight}
            onSuperLike={handleImmersiveSwipeUp}
            onClose={handleCloseImmersiveProfile}
            visible={showImmersiveProfile}
            heightUnit={heightUnit}
            distanceUnit={distanceUnit}
            onBlock={handleBlock}
            onReport={handleReport}
            currentProfileId={currentProfileId || undefined}
            isAdmin={isAdmin}
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
          persistFilters(newFilters);
          loadProfiles(undefined, undefined, newFilters);
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

      {/* Premium Location Features Prompt - Shows when free user has global search or preferred cities saved */}
      <Modal
        visible={showPremiumLocationPrompt}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPremiumLocationPrompt(false)}
      >
        <View className="flex-1 bg-black/60 justify-center items-center px-6">
          <View className="bg-card dark:bg-card rounded-3xl w-full max-w-sm overflow-hidden">
            {/* Header */}
            <View className="bg-lavender-500 p-6 items-center">
              <View className="w-16 h-16 rounded-full bg-white/20 items-center justify-center mb-3">
                <MaterialCommunityIcons name="earth" size={32} color="#fff" />
              </View>
              <Text className="text-white text-xl font-sans-bold text-center">
                Unlock Global Search
              </Text>
            </View>

            {/* Body */}
            <View className="p-6">
              <Text className="text-foreground dark:text-foreground text-center text-base mb-4">
                You have location preferences saved that require Premium to use:
              </Text>

              <View className="bg-lavender-50 dark:bg-lavender-900/30 rounded-xl p-4 mb-4">
                <View className="flex-row items-center mb-2">
                  <MaterialCommunityIcons name="check-circle" size={20} color="#A08AB7" />
                  <Text className="text-foreground dark:text-foreground ml-2">Search globally for matches</Text>
                </View>
                <View className="flex-row items-center">
                  <MaterialCommunityIcons name="check-circle" size={20} color="#A08AB7" />
                  <Text className="text-foreground dark:text-foreground ml-2">Match in specific cities</Text>
                </View>
              </View>

              <Text className="text-muted-foreground dark:text-muted-foreground text-center text-sm mb-6">
                Upgrade to Premium to activate these features and find matches anywhere in the world.
              </Text>

              {/* Buttons */}
              <TouchableOpacity
                className="bg-lavender-500 rounded-full py-4 mb-3"
                onPress={() => {
                  setShowPremiumLocationPrompt(false);
                  router.push('/settings/subscription');
                }}
              >
                <Text className="text-white text-center font-sans-bold text-base">
                  Upgrade to Premium
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="py-3"
                onPress={() => setShowPremiumLocationPrompt(false)}
              >
                <Text className="text-muted-foreground dark:text-muted-foreground text-center text-sm">
                  Maybe Later
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


    </View>
  );
}
