import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, Modal, TextInput, Keyboard, ScrollView, RefreshControl, Dimensions, useWindowDimensions, Platform, Animated, AppState } from 'react-native';
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
import ConfirmGenderPreferenceModal from '@/components/matching/ConfirmGenderPreferenceModal';
import ProfileBoostModal from '@/components/premium/ProfileBoostModal';
import ReportUserModal from '@/components/moderation/ReportUserModal';
// NOTE: Match and like notifications are sent via database triggers (notify_on_match, notify_on_like)
// Do NOT import or call sendMatchNotification/sendLikeNotification from client code
import { calculateScoreAndBreakdown } from '@/lib/matching-algorithm';
import { initializeTracking } from '@/lib/tracking-permissions';
import { DistanceUnit } from '@/lib/distance-utils';
import { signProfileMediaUrls } from '@/lib/signed-urls';
import { HeightUnit } from '@/lib/height-utils';
import { usePreviewModeStore } from '@/stores/previewModeStore';
import { router } from 'expo-router';
import * as Crypto from 'expo-crypto';
import { useColorScheme } from '@/lib/useColorScheme';
import { COLORS } from '@/theme/colors';
import { expandGenderPreference } from '@/lib/gender-preferences';
import { trackUserAction, trackFunnel, trackEvent } from '@/lib/analytics';
import { captureException, isTransientNetworkError } from '@/lib/sentry';
import { prefetchImages } from '@/components/shared/ConditionalImage';
import VerificationBanner from '@/components/shared/VerificationBanner';
import HandshakeLoader from '@/components/shared/HandshakeLoader';
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
  height_inches?: number;
  zodiac_sign?: string;
  languages_spoken?: string[];
  religion?: string;
  political_views?: string;
  photos?: { url: string; storage_path?: string; is_primary: boolean; display_order?: number; blur_data_uri?: string | null }[];
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
  hometown?: string;
  occupation?: string;
  education?: string;
  photo_blur_enabled?: boolean;
  field_visibility?: Record<string, boolean>;
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
  const { isPreviewMode, returnRoute, exitPreviewMode } = usePreviewModeStore();
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
  // Re-entry guard for the like flow. Without this, rapid taps (the user
  // double-taps before the first insert commits) race the existingLike
  // SELECT and hit the unique-constraint on (liker_profile_id,
  // liked_profile_id) — surfacing as duplicate-key errors in Sentry
  // (REACT-71). Cleared in the handler's finally block.
  const isLikingRef = useRef(false);
  // Hash of the filter set most recently passed to loadProfiles. If this diverges from
  // the current DB preferences on focus, the feed needs to refetch — fixes the bug where
  // editing preferences in settings didn't take effect until leaving & reopening the app.
  const filtersSnapshotRef = useRef<string>('');
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
  const [pendingLikesCount, setPendingLikesCount] = useState(0); // Likes received (for teaser banner)
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showConfirmGenderModal, setShowConfirmGenderModal] = useState(false);
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
  const [photoReviewReason, setPhotoReviewReason] = useState<string | null>(null);
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
  const INTENTIONS: { value: string | null }[] = [
    { value: null },
    { value: 'platonic' },
    { value: 'romantic' },
    { value: 'open' },
  ];

  const intentionLabels: Record<string, string> = {
    all: t('discover.intention.all'),
    platonic: t('discover.intention.platonic'),
    romantic: t('discover.intention.romantic'),
    open: t('discover.intention.open'),
  };

  const getIntentionLabel = (value: string | null) => intentionLabels[value || 'all'] || intentionLabels.all;

  const getCurrentIntentionLabel = () => {
    return getIntentionLabel(selectedIntention);
  };

  useEffect(() => {
    if (user?.id) {
      loadCurrentProfile();
      loadLikeCount();
    }
    // Request tracking permission on first app use
    initializeTracking();
  }, [user?.id]);

  // loadLikeCount reconciles AsyncStorage with the server-side daily_likes_count
  // but only when currentProfileId is set. On initial mount, loadLikeCount and
  // loadCurrentProfile race — the counter is loaded before the profile id is
  // known, so server reconciliation is skipped and the client may show "5 likes
  // left" while the server trigger has already blown past the limit (e.g. after
  // the 2026-04-20 back-sync migration). Re-reconcile once the profile id lands.
  useEffect(() => {
    if (currentProfileId) loadLikeCount();
  }, [currentProfileId]);

  // Refresh user data when screen regains focus (returning from other tabs/screens)
  // loadCurrentProfile already checks if filters changed via hash comparison
  // and reloads profiles if needed (lines 727-732).
  const isFirstFocusForReload = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocusForReload.current) {
        isFirstFocusForReload.current = false;
        return;
      }
      // Reload current user's profile and like count (e.g. after settings changes)
      // This picks up preference changes made on other screens.
      loadCurrentProfile();
      loadLikeCount();
    }, [user?.id])
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
        // App came to foreground - always refresh like count (handles day rollover)
        loadLikeCount();

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
          // Skip blur-enabled profiles — blur_data_uri is base64, not a prefetchable URL
          if (p.photo_blur_enabled && primaryPhoto?.blur_data_uri) {
            return null;
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
      // Record view for "Who viewed me" feature (non-blocking)
      if (currentProfileId) {
        Promise.resolve(supabase.rpc('record_profile_view', { p_viewer_id: currentProfileId, p_viewed_id: targetProfile.id })).catch(() => {});
      }
    }
  }, [currentIndex, profiles]);

  const [currentUserName, setCurrentUserName] = useState<string>('');

  // Build a stable hash of the fields that actually influence the discover feed.
  // Used to detect preference changes made elsewhere (e.g. settings) and refetch.
  const computeFiltersHash = (f: FilterOptions): string => {
    return JSON.stringify({
      ageMin: f.ageMin,
      ageMax: f.ageMax,
      maxDistance: f.maxDistance,
      genderPreference: [...(f.genderPreference || [])].sort(),
      activeToday: f.activeToday,
      showBlurredPhotos: f.showBlurredPhotos,
      religion: [...(f.religion || [])].sort(),
      politicalViews: [...(f.politicalViews || [])].sort(),
      ethnicity: [...(f.ethnicity || [])].sort(),
      sexualOrientation: [...(f.sexualOrientation || [])].sort(),
      housingPreference: [...(f.housingPreference || [])].sort(),
      financialArrangement: [...(f.financialArrangement || [])].sort(),
      heightMin: f.heightMin,
      heightMax: f.heightMax,
      zodiacSign: [...(f.zodiacSign || [])].sort(),
      languagesSpoken: [...(f.languagesSpoken || [])].sort(),
      smoking: [...(f.smoking || [])].sort(),
      drinking: [...(f.drinking || [])].sort(),
      pets: [...(f.pets || [])].sort(),
      primaryReason: [...(f.primaryReason || [])].sort(),
      relationshipType: [...(f.relationshipType || [])].sort(),
      wantsChildren: f.wantsChildren,
    });
  };

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
      const { error: filterSaveError } = await supabase
        .from('preferences')
        .update({
          age_min: newFilters.ageMin,
          age_max: newFilters.ageMax,
          max_distance_miles: newFilters.maxDistance,
          // expandGenderPreference is idempotent: ['Men']→['Man'], ['Woman']→['Woman'],
          // ['Everyone']→[]. FilterModal stores canonical values so this is a pass-through
          // for that surface, but earlier this wrap silently wiped canonical values
          // (audit 2026-05-05 found 1,338 users with gender_preference=[] from this).
          gender_preference: expandGenderPreference(newFilters.genderPreference),
          gender_preference_confirmed_at: new Date().toISOString(),
          discovery_filters: discoveryFilters,
        })
        .eq('profile_id', currentProfileId);
      if (filterSaveError) {
        console.error('Failed to persist filters:', filterSaveError);
        showToast({
          type: 'error',
          title: t('common.error'),
          message: t('toast.filtersSaveError') || "Couldn't save your filters. Please try again.",
        });
        return;
      }
      // Also cache locally for instant restore on app restart
      await AsyncStorage.setItem('discovery_filters_cache', JSON.stringify(newFilters)).catch(() => {});
    } catch (err) {
      console.error('Failed to persist filters:', err);
      showToast({
        type: 'error',
        title: t('common.error'),
        message: t('toast.filtersSaveError') || "Couldn't save your filters. Please try again.",
      });
    }
  };

  const loadCurrentProfile = async () => {
    if (!user?.id) {

      return;
    }
    try {
      // Race the profile fetch against a 12s timeout. If the supabase-js
      // queue is stalled (see onboarding checkpoint notes), we don't want
      // discover to sit on the animated loading screen indefinitely —
      // drop to the empty/incomplete state so the user can navigate away.
      const fetchPromise = supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          gender,
          height_unit,
          is_admin,
          photo_review_required,
          photo_review_reason,
          photo_verified,
          profile_complete,
          super_likes_count,
          super_likes_reset_date,
          photos (
            url,
            storage_path,
            is_primary,
            display_order,
            blur_data_uri
          ),
          preferences:preferences(*)
        `)
        .eq('user_id', user.id)
        .single();
      const timeoutPromise = new Promise<{ data: null; error: { code: 'TIMEOUT'; message: string } }>((resolve) =>
        setTimeout(() => resolve({ data: null, error: { code: 'TIMEOUT', message: 'Profile fetch timed out' } }), 12000)
      );
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
      if (error?.code === 'TIMEOUT') {
        console.warn('[Discover] loadCurrentProfile timed out');
        setLoading(false);
        showToast({ type: 'info', title: t('common.slowConnection', { defaultValue: 'Slow connection' }), message: t('common.pullToRetry', { defaultValue: 'Pull down to retry.' }) });
        return;
      }

      if (error) throw error;

      const profileId = data.id;
      const displayName = data.display_name;
      const userGender = data.gender || null;

      // Get primary photo or first photo
      const photos = data.photos?.sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
      const primaryPhoto = photos?.find((p: any) => p.is_primary) || photos?.[0];
      const photoUrl = primaryPhoto?.url || null;

      // Initialize filters from user's database preferences
      // Note: Supabase returns preferences as array even for single relationship
      const userPreferences = Array.isArray(data.preferences) ? data.preferences[0] : data.preferences;
      const df = userPreferences?.discovery_filters || {};

      // Normalize stale persisted filter values (old format used display labels instead of DB values)
      const LEGACY_VALUE_MAP: Record<string, string> = {
        // Relationship types
        'Platonic': 'platonic', 'Romantic': 'romantic', 'Open': 'open',
        // Primary reasons
        'Financial Benefits': 'financial', 'Financial Stability': 'financial',
        'Immigration': 'immigration', 'Immigration/Visa': 'immigration',
        'Family Pressure': 'family_pressure', 'Legal Benefits': 'legal_benefits',
        'Companionship': 'companionship', 'Safety': 'safety', 'Safety & Protection': 'safety',
        'Other': 'other',
        // Housing
        'Separate Homes': 'separate_homes', 'Separate Spaces': 'separate_spaces',
        'Roommates': 'roommates', 'Shared Bedroom': 'shared_bedroom', 'Flexible': 'flexible',
        // Financial
        'Separate': 'separate', 'Shared Expenses': 'shared_expenses',
        'Joint': 'joint', 'Prenup Required': 'prenup_required',
        // Smoking/Drinking
        'Never': 'never', 'Socially': 'socially', 'Regularly': 'regularly',
        // Pets (old values were completely wrong type - discard them)
        'Dogs': '', 'Cats': '', 'Both': '', 'Other Pets': '', 'No Pets': '',
        // Religion partial match
        'Spiritual': 'Spiritual but not religious',
      };
      const normArr = (arr: string[] | undefined): string[] =>
        (arr || []).map(v => LEGACY_VALUE_MAP[v] ?? v).filter(Boolean);

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
        housingPreference: normArr(df.housingPreference),
        financialArrangement: normArr(df.financialArrangement),
        smoking: normArr(df.smoking),
        drinking: normArr(df.drinking),
        pets: normArr(df.pets),
        relationshipType: normArr(df.relationshipType),
        primaryReason: normArr(df.primaryReason),
        religion: normArr(df.religion),
        politicalViews: df.politicalViews || [],
        ethnicity: df.ethnicity || [],
        sexualOrientation: df.sexualOrientation || [],
        heightMin: df.heightMin || 48,
        heightMax: df.heightMax || 84,
        zodiacSign: df.zodiacSign || [],
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
      setActiveToday(initialFilters.activeToday);
      setTempAgeMin(initialFilters.ageMin);
      setTempAgeMax(initialFilters.ageMax);
      setDistanceUnit(userDistanceUnit as DistanceUnit);
      setHeightUnit(userHeightUnit as HeightUnit);
      setIsAdmin(data.is_admin || false);
      setPhotoReviewRequired(data.photo_review_required || false);
      setPhotoReviewReason(data.photo_review_reason || null);
      setIsPhotoVerified(data.photo_verified || false);
      // Show verification banner if not verified (check AsyncStorage for dismiss state)
      if (!data.photo_verified) {
        AsyncStorage.getItem('verification_banner_dismissed').then((dismissed) => {
          if (!dismissed) {
            setShowVerificationBanner(true);
          }
        });
      }

      // One-time prompt for users whose gender_preference was wiped to []
      // by the now-fixed expandGenderPreference bug (audit 2026-05-05). Only
      // gate completed profiles — incomplete profiles still need to finish
      // onboarding and the matching-prefs step there will set the flag.
      if (data.profile_complete && userPreferences && !userPreferences.gender_preference_confirmed_at) {
        setShowConfirmGenderModal(true);
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

      // Process super likes count inline (saves a separate query)
      const resetDate = new Date(data.super_likes_reset_date);
      const now = new Date();
      const daysSinceReset = Math.floor((now.getTime() - resetDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysSinceReset >= 7) {
        setSuperLikesRemaining(5);
      } else {
        setSuperLikesRemaining(5 - (data.super_likes_count || 0));
      }

      // Call loadProfiles directly on initial load (avoid render-cycle waterfall)
      // loadProfiles uses currentProfileIdRef.current which is already set above
      if (!hasInitiallyLoaded.current) {
        hasInitiallyLoaded.current = true;
        filtersSnapshotRef.current = computeFiltersHash(initialFilters);
        loadProfiles(undefined, undefined, initialFilters);
        // Fetch pending likes count for teaser banner (non-blocking)
        supabase.rpc('count_unmatched_received_likes').then(({ data }) => {
          if (data != null) setPendingLikesCount(data);
        });
      } else {
        // Subsequent focus: if preferences changed elsewhere (e.g. matching-preferences
        // screen, edit-profile, or another device), the feed is stale. Refetch with the
        // freshly loaded filters and reset the index.
        const newHash = computeFiltersHash(initialFilters);
        if (newHash !== filtersSnapshotRef.current) {
          filtersSnapshotRef.current = newHash;
          setCurrentIndex(0);
          loadProfiles(undefined, undefined, initialFilters);
        }
      }
    } catch (error: any) {
      showToast({ type: 'error', title: t('common.error'), message: t('toast.profileLoadError') });
      // If loadCurrentProfile itself threw, drop out of the loading screen
      // so the user isn't stuck on the animated heart forever. The empty
      // state has its own pull-to-refresh.
      setLoading(false);
    }
  };

  const loadLikeCount = async () => {
    try {
      const today = new Date().toDateString();
      const storedData = await AsyncStorage.getItem('like_data');

      let localCount = 0;
      if (storedData) {
        const { date, count } = JSON.parse(storedData);
        localCount = date === today && typeof count === 'number' ? count : 0;
      }

      // Reconcile with server-side counter (enforce_like_limits trigger maintains
      // profiles.daily_likes_count on every free-tier like). The server is the
      // authoritative source: trust it whenever we got a response. If the fetch
      // failed or the profile isn't found, fall back to the AsyncStorage value
      // so offline users still see their last known count. Trusting the server
      // makes admin resets (zeroing daily_likes_count from support) reach the
      // user's device on next load — with the old max(local, server) strategy,
      // stale AsyncStorage would keep the UI pinned at the old count.
      let serverCount: number | null = null;
      if (currentProfileId) {
        const { data: prof, error: profErr } = await supabase
          .from('profiles')
          .select('daily_likes_count, daily_likes_reset_date')
          .eq('id', currentProfileId)
          .maybeSingle();
        if (!profErr && prof) {
          // The server's daily_likes_reset_date is a DATE column (UTC).
          // Compare it to today's UTC date directly as YYYY-MM-DD strings —
          // previously we converted via toDateString() in the client's local
          // timezone, which shifted the UTC date into yesterday for
          // west-of-UTC users and made the client always treat server counts
          // as stale (so likes never appeared decremented).
          const todayUTC = new Date().toISOString().slice(0, 10);
          const serverDateUTC = prof.daily_likes_reset_date || null;
          if (typeof prof.daily_likes_count === 'number') {
            serverCount = serverDateUTC === todayUTC ? prof.daily_likes_count : 0;
          }
        }
      }

      const reconciled = serverCount !== null ? serverCount : localCount;
      setLikeCount(reconciled);
      await AsyncStorage.setItem('like_data', JSON.stringify({ date: today, count: reconciled }));
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

  const checkLikeLimit = (): boolean => {
    // Premium users have unlimited likes
    if (isPremium) return true;

    // Free users have daily like limit (5 likes/day, unlimited browsing)
    if (likeCount >= DAILY_LIKE_LIMIT) {
      showToast({ type: 'info', title: t('discover.dailyLimitTitle'), message: t('discover.dailyLimitMessage') });
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

    // Diagnostic timing — each mark() records elapsed-ms since loadProfiles
    // started. Attached to captureException on error so Sentry shows which
    // stage timed out (cache / RPC / full-fetch / prefs) without needing
    // console output. See JAVASCRIPT-REACT-70 incident 2026-05-15.
    const t0 = Date.now();
    const marks: Record<string, number> = {};
    const mark = (label: string) => { marks[label] = Date.now() - t0; };

    try {
      setLoading(true);

      if (!profileId) return;

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
        { data: reportedByMe },
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
        // SAFETY: Users you've reported (exclude from discovery)
        supabase
          .from('reports')
          .select('reported_profile_id')
          .eq('reporter_profile_id', profileId),
      ]);

      mark('exclusionQueries');

      if (currentUserError) throw currentUserError;

      const peopleWhoLikedMeIds = new Set(peopleWhoLikedMe?.map(l => l.liker_profile_id) || []);

      const blockedPhoneHashes = new Set(contactBlocks?.map(cb => cb.phone_number) || []);

      const blockedIds = [
        ...(blockedByMe?.map(b => b.blocked_profile_id) || []),
        ...(blockedMe?.map(b => b.blocker_profile_id) || [])
      ];

      const bannedProfileIds = bannedUsers?.map(b => b.banned_profile_id).filter(Boolean) || [];

      const boostedProfileIds = new Set(boostedProfiles?.map(b => b.profile_id) || []);

      const reportedIds = reportedByMe?.map(r => r.reported_profile_id) || [];

      // Only exclude: already liked, already passed, blocked users, banned users, AND REPORTED USERS
      // DO NOT exclude people who liked you!
      const swipedIds = [
        ...(alreadySwipedLikes?.map(l => l.liked_profile_id) || []),
        ...(alreadySwipedPasses?.map(p => p.passed_profile_id) || []),
        ...blockedIds,
        ...bannedProfileIds,
        ...reportedIds,
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
        // PERFORMANCE: Try cached discovery feed first (pre-computed every 30min)
        // Falls back to live RPC if cache is empty/stale
        const { data: cachedFeed, error: cacheError } = await supabase.rpc('get_cached_discovery_feed', {
          p_profile_id: profileId,
          p_limit: 50,
        });
        mark('cacheLookup');

        let nearbyIds: string[] = [];

        if (!cacheError && cachedFeed && cachedFeed.length > 0) {
          // Cache hit — use pre-computed feed (skips 9 exclusion queries + RPC)
          const swipedSet = new Set(swipedIds);
          nearbyIds = cachedFeed
            .map((c: any) => c.candidate_id)
            .filter((id: string) => !swipedSet.has(id));
        } else {
          // Cache miss — fall back to live RPC
          // Gender prefs: use in-session filter only. Empty array = "Everyone" (RPC skips the filter).
          // No DB fallback — if the user clears to Everyone but DB save raced, we honor the user's intent.
          const { data: rpcData, error: rpcError } = await supabase.rpc('get_nearby_profiles', {
            p_user_lat: currentUserData.latitude,
            p_user_lon: currentUserData.longitude,
            p_max_distance_miles: effectiveFilters.maxDistance,
            p_user_profile_id: profileId,
            p_min_age: Math.max(18, effectiveFilters.ageMin),
            p_max_age: effectiveFilters.ageMax,
            p_gender_prefs: effectiveFilters.genderPreference || [],
            p_result_limit: 50
          });
          mark('liveRpc');
          if (rpcError) throw rpcError;

          if (rpcData && rpcData.length > 0) {
            const swipedSet = new Set(swipedIds);
            nearbyIds = rpcData.map((p: any) => p.id).filter((id: string) => !swipedSet.has(id));
          }
        }

        // Fetch full profile data with photos for the candidate IDs
        if (nearbyIds.length > 0) {
            const { data: fullProfiles, error: profilesError } = await supabase
              .from('profiles')
              .select(`
                *,
                photos (
                  url,
                  storage_path,
                  is_primary,
                  display_order,
                  blur_data_uri
                )
              `)
              .in('id', nearbyIds)
              .eq('is_active', true)
              .eq('profile_complete', true)
              .eq('incognito_mode', false)
              .eq('photo_review_required', false)
              .or('policy_restricted.is.null,policy_restricted.eq.false');
            mark('fullProfilesFetch');
            if (profilesError) throw profilesError;

            data = fullProfiles || [];

            // Fetch preference fields for filtering (relationship_type, etc.)
            // SECURITY DEFINER RPC bypasses preferences RLS
            if (data.length > 0) {
              const profileIds = data.map((p: any) => p.id);
              const { data: prefsData } = await supabase.rpc('get_profile_preferences', { p_profile_ids: profileIds });
              mark('prefsFetch');
              if (prefsData) {
                const prefsMap = new Map(prefsData.map((p: any) => [p.profile_id, p]));
                data = data.map((profile: any) => ({
                  ...profile,
                  preferences: prefsMap.get(profile.id) || null,
                }));
              }
            }
        }
      } else {
        // GLOBAL SEARCH or SEARCH MODE: two-phase query.
        // Phase 1 fetches only profile IDs with the filter+order — the
        // idx_profiles_global_discovery partial index makes this ~2ms.
        // Phase 2 hydrates those IDs with profile+photos+preferences.
        // Previously this was one fat query with a photos LEFT JOIN, which
        // joined photos for all ~17k active profiles BEFORE the LIMIT 200,
        // taking 8+ seconds cold and timing out at JAVASCRIPT-REACT-70.

        let query = supabase
          .from('profiles')
          .select('id')
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
        // Array fields (gender, ethnicity, sexual_orientation, etc.)
        // are handled by the client-side filter instead
        if (effectiveSearchKeyword.trim()) {
          // PostgREST .or() uses `,` and `()` as filter delimiters. A raw
          // keyword like "Phee, 24" interpolated directly would split the
          // value across columns and trip "failed to parse logic tree".
          // Strip the reserved chars before injection — users searching
          // "Alex, 28" still match the ilike on "Alex" and "28" gracefully
          // collapses to a single space.
          const keyword = effectiveSearchKeyword.trim().replace(/[,()*]/g, ' ').trim();
          if (keyword) {
            // Only search scalar text fields - NOT arrays
            query = query.or(
              `display_name.ilike.%${keyword}%,` +
              `zodiac_sign.ilike.%${keyword}%,` +
              `location_city.ilike.%${keyword}%,` +
              `location_state.ilike.%${keyword}%,` +
              `religion.ilike.%${keyword}%,` +
              `political_views.ilike.%${keyword}%`
            );
          }
        }

        // HARD FILTERS: Always enforce age range and gender preference, even in search mode.
        // Users must NEVER see profiles outside their stated preferences.
        // Safety: Always enforce minimum age of 18
        query = query
          .gte('age', Math.max(18, effectiveFilters.ageMin))
          .lte('age', effectiveFilters.ageMax);

        // Gender preference is a hard filter — enforce in search mode too.
        // Use in-session effectiveFilters (not DB) so an in-session filter change takes
        // effect immediately even if the DB write is still in flight.
        // "Everyone" (or empty array) means skip the gender filter entirely.
        if (effectiveFilters.genderPreference && effectiveFilters.genderPreference.length > 0) {
          const genderPrefArray = effectiveFilters.genderPreference;
          if (!genderPrefArray.includes('Everyone')) {
            const pgArrayLiteral = `{${genderPrefArray.map((g: string) => `"${g}"`).join(',')}}`;
            query = query.filter('gender', 'ov', pgArrayLiteral);
          }
        }

        // Distance prefilter via bounding box — only when not searching globally.
        // The client-side Haversine check (below) is the precise filter; the bbox
        // just cuts the candidate set dramatically so we fetch fewer profile+photo rows.
        if (!isSearchingGlobally && currentUserData.latitude && currentUserData.longitude) {
          const latMiles = 69;
          const lat0 = currentUserData.latitude;
          const lng0 = currentUserData.longitude;
          const latDelta = effectiveFilters.maxDistance / latMiles;
          // cos(lat) shrinks longitude degrees at higher latitudes
          const lngDelta = effectiveFilters.maxDistance / (Math.cos((lat0 * Math.PI) / 180) * latMiles);
          query = query
            .gte('latitude', lat0 - latDelta)
            .lte('latitude', lat0 + latDelta)
            .gte('longitude', lng0 - lngDelta)
            .lte('longitude', lng0 + lngDelta);
        }
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

        // Apply gender preference filter (hard filter for all users).
        // Source of truth: in-session effectiveFilters, not DB (so in-session changes
        // take effect before the DB write settles).
        // "Everyone" (or empty array) means skip the gender filter entirely.
        if (effectiveFilters.genderPreference && effectiveFilters.genderPreference.length > 0) {
          const genderPrefArray = effectiveFilters.genderPreference;
          if (!genderPrefArray.includes('Everyone')) {
            const pgArrayLiteral = `{${genderPrefArray.map((g: string) => `"${g}"`).join(',')}}`;
            query = query.filter('gender', 'ov', pgArrayLiteral);
          }
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

        // Phase 1: ID-only fetch (uses idx_profiles_global_discovery)
        const { data: idData, error: idError } = await query;
        mark('globalIdQuery');
        if (idError) throw idError;
        const candidateIds = (idData ?? []).map((p: any) => p.id);

        // Phase 2: hydrate full profiles + photos + preferences
        if (candidateIds.length > 0) {
          const { data: fullData, error: fullError } = await supabase
            .from('profiles')
            .select(`
              *,
              photos (
                url,
                storage_path,
                is_primary,
                display_order,
                blur_data_uri
              ),
              preferences:preferences(*)
            `)
            .in('id', candidateIds);
          mark('globalFullFetch');
          if (fullError) throw fullError;

          // .in() doesn't preserve order — re-sort to match the indexed
          // created_at DESC ordering from phase 1.
          const orderMap = new Map(candidateIds.map((id: string, i: number) => [id, i]));
          data = (fullData ?? []).slice().sort((a: any, b: any) =>
            (orderMap.get(a.id) ?? Infinity) - (orderMap.get(b.id) ?? Infinity)
          );

          // Preferences RLS blocks direct reads of other users' rows, so
          // the inline preferences:preferences(*) select returns null. Use
          // the SECURITY DEFINER RPC to hydrate prefs (same pattern as the
          // local-search branch).
          if (data.length > 0) {
            const { data: prefsData } = await supabase.rpc('get_profile_preferences', { p_profile_ids: candidateIds });
            mark('globalPrefsFetch');
            if (prefsData) {
              const prefsMap = new Map(prefsData.map((p: any) => [p.profile_id, p]));
              data = data.map((profile: any) => ({
                ...profile,
                preferences: prefsMap.get(profile.id) || profile.preferences || null,
              }));
            }
          }
        } else {
          data = [];
        }
        error = idError;
      }

      if (error) throw error;

      // Client-side exclusion fallback when ID list was too large for server-side filter
      // This handles users with 200+ swipes where the URL would exceed PostgREST limits
      let filteredData = data || [];
      if (swipedIds.length > 150) {
        const swipedSet = new Set(swipedIds);
        filteredData = filteredData.filter((p: any) => !swipedSet.has(p.id));
      }

      // PERF: Run contact blocking + country block queries in PARALLEL instead of sequentially
      const userCountry = currentUserData.location_country || 'US';
      const profileIds = filteredData.map((p: any) => p.id);

      const [contactBlockResult, countryBlockedResult, viewerBlockedResult] = await Promise.all([
        // 1. Contact blocking using server-side function for privacy
        blockedPhoneHashes.size > 0
          ? supabase.rpc('get_contact_blocked_profile_ids', { requesting_profile_id: profileId })
              .then(({ data, error }) => {
                if (error) console.error('Error fetching contact-blocked profiles:', error);
                return data || [];
              })
          : Promise.resolve([]),
        // 2. Profiles that have blocked viewer's country
        userCountry && profileIds.length > 0
          ? supabase.from('country_blocks').select('profile_id')
              .or(`country_code.eq.${userCountry},country_name.ilike.${userCountry}`)
              .in('profile_id', profileIds)
              .then(({ data }) => data || [])
          : Promise.resolve([]),
        // 3. Countries the viewer has blocked
        supabase.from('country_blocks').select('country_code, country_name')
          .eq('profile_id', profileId)
          .then(({ data }) => data || []),
      ]);

      // Apply contact blocking filter
      if (contactBlockResult.length > 0) {
        const blockedProfileIdSet = new Set(contactBlockResult);
        filteredData = filteredData.filter((p: any) => !blockedProfileIdSet.has(p.id));
      }

      // Apply country blocks (profiles that blocked viewer's country)
      if (countryBlockedResult.length > 0) {
        const countryBlockedIds = new Set(countryBlockedResult.map((cb: any) => cb.profile_id));
        filteredData = filteredData.filter((p: any) => !countryBlockedIds.has(p.id));
      }

      // Apply viewer's blocked countries
      if (viewerBlockedResult.length > 0) {
        const blockedCountryCodes = new Set(viewerBlockedResult.map((cb: any) => cb.country_code));
        const blockedCountryNames = new Set(viewerBlockedResult.map((cb: any) => cb.country_name?.toLowerCase()));
        filteredData = filteredData.filter((p: any) => {
          if (p.location_country) {
            if (blockedCountryCodes.has(p.location_country)) return false;
            if (blockedCountryNames.has(p.location_country.toLowerCase())) return false;
          }
          return true;
        });
      }

      // ANR FIX: Transform profiles first with default scores, calculate compatibility after UI renders

      // Log active filter state for debugging


      const transformedProfiles: Profile[] = filteredData
        .map((profile: any) => {

          // PERF: Calculate score + breakdown in a single pass (was previously double-calculating)
          let compatibilityScore = 75;
          let compatibilityBreakdown = undefined;
          const profilePrefs = Array.isArray(profile.preferences) ? profile.preferences[0] : profile.preferences;
          const effectiveProfilePrefs = profilePrefs || {};
          if (currentUserData.preferences) {
            try {
              const result = calculateScoreAndBreakdown(
                currentUserData as any,
                profile as any,
                currentUserData.preferences,
                effectiveProfilePrefs
              );
              compatibilityScore = result.score;
              compatibilityBreakdown = result.breakdown;
            } catch (err) {
              console.warn('⚠️ Compatibility calculation failed for profile:', profile.id, err);
            }
          }

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
            hometown: profile.hometown,
            occupation: profile.occupation,
            education: profile.education,
            height_inches: profile.height_inches,
            zodiac_sign: profile.zodiac_sign,
            languages_spoken: profile.languages_spoken,
            religion: profile.religion,
            political_views: profile.political_views,
            is_verified: profile.is_verified,
            prompt_answers: profile.prompt_answers,
            photos: profile.photos?.sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0)),
            compatibility_score: compatibilityScore,
            compatibilityBreakdown: compatibilityBreakdown,
            distance: distance,
            voice_intro_url: profile.voice_intro_url,
            voice_intro_duration: profile.voice_intro_duration,
            photo_blur_enabled: profile.photo_blur_enabled || false,
            field_visibility: profile.field_visibility,
            hide_distance: profile.hide_distance || false,
            hide_last_active: profile.hide_last_active || false,
            last_active_at: profile.last_active_at,
            is_premium: profile.is_premium || profile.is_platinum || false,
            // Supabase returns preferences as array when using joined queries, extract first element
            preferences: Array.isArray(profile.preferences) ? profile.preferences[0] : profile.preferences,
          };
        })
        .filter((profile: any) => {
          try {

          // ====================================================================
          // SAFETY FILTERS (ALWAYS APPLIED - NO BYPASS, including search mode)
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

          // 5. CRITICAL: Gender preference hard filter (client-side safety net)
          // Defense-in-depth — server-side filters (RPC + SQL overlap) are authoritative
          // but this catches any leaks. Source: effectiveFilters (in-session) so mid-session
          // changes are enforced immediately, matching what the RPC/query was called with.
          if (effectiveFilters.genderPreference && effectiveFilters.genderPreference.length > 0) {
            const genderPrefArr = effectiveFilters.genderPreference;
            // "Everyone" means no restriction — matches the RPC convention
            if (!genderPrefArr.includes('Everyone')) {
              const profileGenders = Array.isArray(profile.gender) ? profile.gender : (profile.gender ? [profile.gender] : []);
              const hasGenderMatch = profileGenders.some((pg: string) => genderPrefArr.includes(pg));
              if (!hasGenderMatch) {
                return false;
              }
            }
          }

          // 6. CRITICAL: Age range hard filter (client-side safety net)
          // Always enforce user's age preferences, even in search mode.
          if (profile.age < effectiveFilters.ageMin || profile.age > effectiveFilters.ageMax) {
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
              profile.zodiac_sign,
              profile.religion,
              profile.political_views,
              profile.location_city,
              profile.location_state,
              profile.gender, // Allow searching by gender
              profile.sexual_orientation, // Allow searching by orientation
              profile.ethnicity, // Allow searching by ethnicity
              ...(profile.languages_spoken || []),
              ...(profile.prompt_answers?.flatMap((pa: any) => [pa.prompt, pa.answer]) || []),
            ];

            // Handle preferences fields
            if (profile.preferences) {
              const prefs = profile.preferences;
              searchableFields.push(
                // Support both legacy primary_reason and new primary_reasons array
                prefs.primary_reasons ? prefs.primary_reasons.join(' ') : prefs.primary_reason,
                prefs.relationship_type,
                ...(Array.isArray(prefs.financial_arrangement) ? prefs.financial_arrangement : []),
                ...(Array.isArray(prefs.housing_preference) ? prefs.housing_preference : []),
                ...(Array.isArray(prefs.children_arrangement) ? prefs.children_arrangement : []),
                ...(Array.isArray(prefs.dealbreakers) ? prefs.dealbreakers : []),
                ...(Array.isArray(prefs.must_haves) ? prefs.must_haves : []),
              );
            }

            const searchableText = searchableFields
              .filter(Boolean)
              .join(' ')
              .toLowerCase();

            if (!searchableText.includes(keyword)) {
              return false; // Keyword not found
            }

            // Keyword matched. Fall through to premium/preference filters below so
            // a premium user searching "yoga" with religion=Jewish still only sees
            // Jewish candidates who match "yoga" — filters are NEVER skipped because
            // you typed something. Gender/age hard filters already ran above.
          }

          // ====================================================================
          // DEALBREAKER FILTERS (only in NORMAL mode, not search mode)
          // ====================================================================

          // Age and gender preference are now enforced in the SAFETY FILTERS section above
          // (always applied, including search mode). No duplicate check needed here.

          // 1b. RELATIONSHIP TYPE / INTENTION FILTER (quick filter)
          if (selectedIntentionRef.current) {
            if (!profile.preferences?.relationship_type || profile.preferences.relationship_type !== selectedIntentionRef.current) {
              return false;
            }
          }


          // 1c. ACTIVE TODAY FILTER is applied below with other free filters


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

            // Use pre-calculated distance (computed earlier via calculateDistance)
            if (profile.distance !== null && profile.distance !== undefined && profile.distance > effectiveFilters.maxDistance) {

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
          // PREFERENCE FILTERS (effectively premium — FilterModal gates these
          // behind isPremium so the filter lists are empty for free users)
          // ====================================================================

          // Religion filter — premium only. Without this guard, a user who
          // downgrades from premium still has religion/politics selections
          // persisted in discovery_filters and silently narrows their feed.
          if (isPremium && effectiveFilters.religion.length > 0 && profile.religion) {
            if (!effectiveFilters.religion.includes(profile.religion)) {
              return false;
            }
          }

          // Political views filter — premium only (same reason as religion).
          if (isPremium && effectiveFilters.politicalViews.length > 0 && profile.political_views) {
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

          // Primary reason filter (supports both legacy scalar and new array)
          if (isPremium && effectiveFilters.primaryReason.length > 0) {
            const profileReasons = profile.preferences?.primary_reasons
              ? (Array.isArray(profile.preferences.primary_reasons) ? profile.preferences.primary_reasons : [profile.preferences.primary_reasons])
              : (profile.preferences?.primary_reason ? [profile.preferences.primary_reason] : []);
            if (profileReasons.length > 0) {
              const hasMatch = profileReasons.some((r: string) => effectiveFilters.primaryReason.includes(r));
              if (!hasMatch) {
                return false;
              }
            }
          }

          // Relationship type filter
          if (isPremium && effectiveFilters.relationshipType.length > 0) {
            if (!profile.preferences?.relationship_type || !effectiveFilters.relationshipType.includes(profile.preferences.relationship_type)) {
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

      // Sort other profiles by: 1) Boosted status, 2) Subscriber status, 3) Compatibility score
      // Subscribers get a ranking boost so they appear higher in feeds, increasing
      // their match rate and reducing churn from low engagement.
      const sortedOtherProfiles = otherProfiles.sort((a, b) => {
        const aIsBoosted = boostedProfileIds.has(a.id);
        const bIsBoosted = boostedProfileIds.has(b.id);

        if (aIsBoosted && !bIsBoosted) return -1;
        if (!aIsBoosted && bIsBoosted) return 1;

        // Subscribers rank higher than free users (within same boost tier)
        const aIsSub = (a as any).is_premium === true;
        const bIsSub = (b as any).is_premium === true;
        if (aIsSub && !bIsSub) return -1;
        if (!aIsSub && bIsSub) return 1;

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



      // PERFORMANCE: Sign first few profiles immediately, show them, then sign rest in background.
      // This gets the first profile on screen 1-3 seconds faster than signing all 50 at once.
      const IMMEDIATE_BATCH = 5;
      const firstBatch = sortedProfiles.slice(0, IMMEDIATE_BATCH);
      const restBatch = sortedProfiles.slice(IMMEDIATE_BATCH);

      // Sign first batch — this is what the user sees immediately
      const signedFirst = await signProfileMediaUrls(firstBatch);
      mark('signFirstBatch');

      // Show profiles NOW (first batch signed, rest unsigned but will be signed before user reaches them)
      setProfiles([...signedFirst, ...restBatch]);
      setCurrentIndex(0);
      hasInitiallyLoaded.current = true;
      mark('total');

      // Prefetch images for the first few profiles for instant loading
      const imagesToPrefetch = signedFirst
        .flatMap(p => {
          if (p.photo_blur_enabled) return [];
          return p.photos?.map(photo => photo.url) || [];
        })
        .filter(Boolean);

      if (imagesToPrefetch.length > 0) {
        prefetchImages(imagesToPrefetch);
      }

      // Sign remaining profiles in background (non-blocking)
      if (restBatch.length > 0) {
        signProfileMediaUrls(restBatch).then(signedRest => {
          setProfiles(prev => {
            // Only update if profiles haven't been completely replaced (e.g., by a refresh)
            if (prev.length >= IMMEDIATE_BATCH + restBatch.length) {
              return [...prev.slice(0, IMMEDIATE_BATCH), ...signedRest];
            }
            return prev;
          });
        }).catch(err => console.warn('Background URL signing failed:', err));
      }
    } catch (error: any) {
      mark('totalAtError');
      console.error('[Discover] loadProfiles error', error?.message ?? error);
      // Attach stage marks to Sentry so the issue page shows which stage
      // timed out without requiring console output. See JAVASCRIPT-REACT-70.
      // Fingerprint by error code so distinct failures (network, RLS,
      // PGRST, custom) form distinct Sentry issues instead of collapsing
      // into one grab-bag like JS-71 did.
      const loadCode: string | undefined = error?.code;
      const loadMsg: string = (error?.message || '').toString();
      let loadFingerprint = 'discovery-load-other';
      if (loadCode === 'PGRST301' || loadMsg.toLowerCase().includes('timed out')) {
        loadFingerprint = 'discovery-load-timeout';
      } else if (loadCode === '42501') {
        loadFingerprint = 'discovery-load-permission-denied';
      } else if (loadCode === 'PGRST116') {
        loadFingerprint = 'discovery-load-no-rows';
      } else if (loadCode === 'PGRST303' || loadMsg.toLowerCase().includes('jwt expired')) {
        loadFingerprint = 'discovery-load-jwt-expired';
      } else if (loadCode) {
        loadFingerprint = `discovery-load-${loadCode}`;
      }
      captureException(
        error instanceof Error ? error : new Error(error?.message || 'Discovery profile load failed'),
        {
          context: 'discovery_load',
          marks,
          errorCode: loadCode,
          lastReachedStage: Object.keys(marks).filter(k => k !== 'totalAtError').pop() ?? null,
        },
        [loadFingerprint],
      );
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

    // In preview mode, allow passing so users can browse profiles
    // But skip recording the pass if profile is incomplete (no profile row to reference)
    if (!isProfileComplete) {
      transitionToNextProfile();
      return true;
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
      const { error: passError } = await supabase.from('passes').insert({
        passer_profile_id: currentProfileId,
        passed_profile_id: targetProfile.id,
      });
      if (passError) {
        console.error('Failed to record pass:', passError);
        // Non-blocking: still advance to next card, but log the failure
      }

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
  }, [currentProfileId, currentIndex, profiles, likeCount, isPremium, isProfileComplete, transitionToNextProfile]);

  const handleSwipeRight = useCallback(async (message?: string, likedContentData?: { type: string; prompt?: string; answer?: string; index?: number }): Promise<boolean> => {
    // Hard auth gate. Without an auth.uid the supabase client sends the
    // anon JWT, and INSERT on `likes` is not granted to anon → users
    // were hitting "permission denied for table likes" in Sentry. Don't
    // even attempt the request if there's no user session.
    if (!user?.id) {
      captureException(
        new Error('handleSwipeRight invoked without auth user'),
        { context: 'discovery_like_no_user', currentProfileId },
        ['discovery-like-no-user'],
      );
      return false;
    }

    if (!currentProfileId || currentIndex >= profiles.length) {
      return false;
    }

    // Re-entry guard. Without this, double-taps before the insert
    // commits race the duplicate-key check and crash with 23505.
    if (isLikingRef.current) {
      return false;
    }
    isLikingRef.current = true;

    // Block swiping if profile is incomplete
    if (!isProfileComplete) {
      isLikingRef.current = false;
      const destination = returnRoute || '/(onboarding)/onboarding';
      Alert.alert(
        t('discover.completeProfile.title'),
        t('discover.completeProfile.message'),
        [
          { text: t('common.later'), style: 'cancel' },
          { text: t('discover.completeProfile.button'), onPress: () => {
            exitPreviewMode();
            router.replace(destination as any);
          }}
        ]
      );
      return false;
    }

    // Check like limit (free users: 5 likes/day, premium: unlimited)
    if (!checkLikeLimit()) {
      isLikingRef.current = false;
      return false;
    }

    const targetProfile = profiles[currentIndex];
    if (!targetProfile) {
      isLikingRef.current = false;
      return false;
    }


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
            // Update the existing unmatched record to active. maybeSingle()
            // here so a 0-row return from RLS doesn't throw "Cannot coerce
            // result to a single JSON object" — we'd rather log and fall
            // through than crash the like flow.
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
              .maybeSingle();

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
            // Create new match. maybeSingle() prevents a 0-row return
            // (e.g., RLS dropping the returned row) from throwing "Cannot
            // coerce result to a single JSON object" instead of the real
            // matchError.
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
              .maybeSingle();

            if (matchError) {
              // Check if it's the match limit error
              if (matchError.message?.includes('MATCH_LIMIT_REACHED')) {
                Alert.alert(
                  t('likes.matchLimitTitle'),
                  t('likes.matchLimitMessage'),
                  [
                    { text: t('common.ok') },
                    { text: t('likes.freeUser.revealPhoto'), onPress: () => setShowPaywall(true) },
                  ]
                );
                return true;
              }
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
          // Server says limit hit but client counter may be stale (e.g. back-sync
          // from a migration). Sync the client count so the UI shows "0 remaining"
          // and the user understands this is a daily-limit issue, not a paywall
          // for browsing itself.
          setLikeCount(DAILY_LIKE_LIMIT);
          try {
            const today = new Date().toDateString();
            await AsyncStorage.setItem('like_data', JSON.stringify({ date: today, count: DAILY_LIKE_LIMIT }));
          } catch {}
          showToast({ type: 'info', title: t('discover.dailyLimitTitle'), message: t('discover.dailyLimitMessage') });
          setShowPaywall(true);
          return false;
        }
        // 23505 = unique_violation on (liker_profile_id, liked_profile_id).
        // The existingLike SELECT above is best-effort, but the user can
        // tap fast enough to race past it before the first insert
        // commits. Treat as already-liked: silently advance the card
        // rather than throwing, since the underlying intent (like this
        // profile) is already satisfied. Do NOT capture to Sentry.
        if (likeError.code === '23505') {
          const newIndex = currentIndex + 1;
          setCurrentIndex(newIndex);
          return true;
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
          .maybeSingle();

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

      // Classify the error so Sentry groups events by their real cause
      // instead of all collapsing under the catch-handler fingerprint.
      // Before this, REACT-71 buried 4 distinct bugs (permission denied,
      // duplicate key, network, single-row mismatch) under one 813-user
      // issue and made triage impossible.
      const code: string | undefined = error?.code;
      const msg: string = (error?.message || '').toString();
      const lowerMsg = msg.toLowerCase();

      // Transient network errors are not bugs — don't pollute Sentry.
      const isNetwork = isTransientNetworkError(error);

      let fingerprint: string[] | undefined;
      let errorClass = 'unknown';
      // PGRST303 / "JWT expired" — the supabase client's
      // autoRefreshToken missed its window (typically because the device
      // was backgrounded for hours, or the refresh token itself died).
      // The user object is still populated client-side so our up-front
      // !user?.id gate doesn't catch this. Trigger a manual refresh in
      // the background so the next tap works, and surface a "try again"
      // nudge instead of failing silently.
      const isJwtExpired = code === 'PGRST303' || lowerMsg.includes('jwt expired');
      if (code === '42501' || lowerMsg.includes('permission denied for table')) {
        fingerprint = ['discovery-like-permission-denied'];
        errorClass = 'permission_denied';
      } else if (code === '23505' || lowerMsg.includes('duplicate key value')) {
        // Should be impossible here since we swallow 23505 above, but
        // keep a distinct bucket for any path that slips through.
        fingerprint = ['discovery-like-duplicate'];
        errorClass = 'duplicate_key';
      } else if (lowerMsg.includes('cannot coerce') || lowerMsg.includes('single json object')) {
        fingerprint = ['discovery-like-single-row-mismatch'];
        errorClass = 'single_row_mismatch';
      } else if (isJwtExpired) {
        fingerprint = ['discovery-like-jwt-expired'];
        errorClass = 'jwt_expired';
        // Fire-and-forget refresh so the next user tap succeeds.
        supabase.auth.refreshSession().catch(() => {});
      } else if (code === 'P0001') {
        fingerprint = ['discovery-like-server-rejection'];
        errorClass = 'server_rejection';
      } else if (isNetwork) {
        errorClass = 'network';
        // No fingerprint and no capture — handled below.
      }

      if (!isNetwork) {
        captureException(
          error instanceof Error ? error : new Error(msg || 'Like recording failed'),
          { context: 'discovery_like', error_class: errorClass, error_code: code, has_user: !!user?.id },
          fingerprint,
        );
      }

      if (error?.code === 'P0001' && error?.message?.includes('Daily like limit')) {
        setLikeCount(DAILY_LIKE_LIMIT);
        try {
          const today = new Date().toDateString();
          await AsyncStorage.setItem('like_data', JSON.stringify({ date: today, count: DAILY_LIKE_LIMIT }));
        } catch {}
        showToast({ type: 'info', title: t('discover.dailyLimitTitle'), message: t('discover.dailyLimitMessage') });
        setShowPaywall(true);
      } else if (error?.code === 'P0001' && error?.message) {
        // Surface other server-side rejections (profile incomplete, photo count,
        // premium required for super like, etc.) instead of silently returning.
        showToast({ type: 'error', title: t('common.error'), message: error.message });
      } else if (isJwtExpired) {
        // Refresh was kicked off above; nudge the user to retry so the
        // next tap goes out with the new token.
        showToast({ type: 'info', title: t('common.tryAgain', 'Try again'), message: t('common.sessionExpiredRetry', 'Session refreshed — tap like again.') });
      } else if (isNetwork) {
        // User-visible nudge for network failures so the silent return
        // doesn't look like the like was accepted.
        showToast({ type: 'error', title: t('common.error'), message: t('common.networkError', 'Network error — please try again.') });
      }
      return false;
    } finally {
      // Always release the re-entry guard, even on early returns or
      // unhandled throws — otherwise the like button stays dead for the
      // rest of the session.
      isLikingRef.current = false;
    }
  }, [currentProfileId, currentIndex, profiles, likeCount, isPremium, isProfileComplete, returnRoute, exitPreviewMode, user?.id]);

  const handleSwipeUp = useCallback(async (): Promise<boolean> => {
    if (!currentProfileId || currentIndex >= profiles.length) return false;

    // Block swiping if profile is incomplete
    if (!isProfileComplete) {
      const destination = returnRoute || '/(onboarding)/onboarding';
      Alert.alert(
        t('discover.completeProfile.title'),
        t('discover.completeProfile.message'),
        [
          { text: t('common.later'), style: 'cancel' },
          { text: t('discover.completeProfile.button'), onPress: () => {
            exitPreviewMode();
            router.replace(destination as any);
          }}
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
        t('discover.premium.upgradeTitle'),
        t('discover.premium.superLikesMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.upgrade'), onPress: () => setShowPaywall(true) },
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
          const { error: resetError } = await supabase
            .from('profiles')
            .update({
              super_likes_count: 0,
              super_likes_reset_date: now.toISOString(),
            })
            .eq('id', currentProfileId);
          if (resetError) console.error('Failed to reset super like count:', resetError);
        }

        // Check limit for premium users (5 per week)
        const weeklyLimit = 5;

        if (currentCount >= weeklyLimit) {
          // Premium users hit their limit
          Alert.alert(
            t('discover.premium.superLikeLimitTitle'),
            t('discover.premium.superLikeLimitMessage', { day: getDayName((resetDate.getDay() + 7) % 7) }),
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
        // Update existing like to super_like. The enforce_super_like_on_update
        // trigger (migration 20260420_enforce_super_like_on_update) now applies
        // the same premium + weekly-budget checks as the INSERT trigger, so a
        // free user upgrading their own standard like is rejected server-side
        // and a premium user's super_likes_count is incremented correctly.
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
      const { error: superLikeCountError } = await supabase
        .from('profiles')
        .update({
          super_likes_count: (profileData?.super_likes_count || 0) + 1,
        })
        .eq('id', currentProfileId);
      if (superLikeCountError) {
        console.error('Failed to update super like count:', superLikeCountError);
      }

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
      } else if (error?.code === 'P0001' && error?.message?.includes('Weekly super like limit')) {
        // Surfaced by enforce_super_like_on_update when a premium user tries to
        // promote a standard like after already using their 5 super-likes this
        // week. Don't show the paywall — they already pay; show the limit.
        Alert.alert(
          t('discover.premium.superLikeLimitTitle'),
          t('discover.premium.superLikeLimitMessage', { day: '' }),
          [{ text: 'OK' }]
        );
      } else if (error?.code === 'P0001' && error?.message?.includes('Daily like limit')) {
        setShowPaywall(true);
      } else if (error?.code === 'P0001' && error?.message) {
        // Surface any other server-side rejection (profile incomplete, photo
        // count, etc.) instead of the generic superLikeError toast.
        showToast({ type: 'error', title: t('common.error'), message: error.message });
      } else {
        showToast({ type: 'error', title: t('common.error'), message: t('toast.superLikeError') });
      }
      return false;
    }
  }, [currentProfileId, currentIndex, profiles, isPremium, isProfileComplete, returnRoute, exitPreviewMode]);

  // Helper function to get day name
  const getDayName = (day: number) => {
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    return t(`common.days.${dayKeys[day]}`);
  };

  const handleRewind = useCallback(async () => {
    // Premium-only feature
    if (!isPremium) {
      Alert.alert(
        t('discover.premium.upgradeTitle'),
        t('discover.premium.rewindMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.upgrade'), onPress: () => setShowPaywall(true) },
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

  // Loading state
  if (loading) {
    return (
      <View className="flex-1 items-center justify-center overflow-hidden" style={{ backgroundColor: colors.background }}>
        <HandshakeLoader />
      </View>
    );
  }

  // Empty state - no more profiles (only show after first load completes)
  if (hasInitiallyLoaded.current && currentIndex >= profiles.length) {
    return (
      <View className="flex-1" style={{ backgroundColor: colors.background }}>
        {/* Header with Search/Filter Controls */}
        <View className="pb-0" style={{ backgroundColor: colors.background, paddingTop: insets.top + 16 }}>
          {/* Quick Filters Row - Horizontal Scroll with Search/Refresh on right */}
          <View className="flex-row items-center mb-3">
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 6, paddingLeft: 12, paddingRight: 12, alignItems: 'center' }}
              style={{ flex: 1 }}
            >
              <TouchableOpacity
                style={{ backgroundColor: colors.background, height: 33, paddingHorizontal: 4, borderRadius: 999, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', }}
                onPress={() => setShowFilterModal(true)}
              >
                <MaterialCommunityIcons name="tune-vertical" size={26} color={colors.foreground} />
              </TouchableOpacity>

              {/* Age Quick Filter */}
              <TouchableOpacity
                style={{ backgroundColor: colors.card, borderWidth: 2, borderColor: colors.foreground, paddingHorizontal: 14, height: 33, borderRadius: 999, flexDirection: 'row', alignItems: 'center', }}
                onPress={() => {
                  setTempAgeMin(filters.ageMin);
                  setTempAgeMax(filters.ageMax);
                  setShowAgeSlider(!showAgeSlider);
                  setShowIntentionDropdown(false);
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.foreground, lineHeight: 14 }}>{t('discover.quickFilter.age')}</Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color={colors.foreground} style={{ marginLeft: 4 }} />
              </TouchableOpacity>

              {/* Intention Quick Filter */}
              <TouchableOpacity
                style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 33, borderRadius: 999, flexDirection: 'row', alignItems: 'center', }}
                onPress={() => {
                  setShowIntentionDropdown(!showIntentionDropdown);
                  setShowAgeSlider(false);
                }}
              >
                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.foreground, lineHeight: 14 }}>{t('discover.quickFilter.datingIntentions')}</Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color={colors.foreground} style={{ marginLeft: 4 }} />
              </TouchableOpacity>

              {/* Active Today Toggle */}
              <TouchableOpacity
                style={{ backgroundColor: activeToday ? '#A08AB7' : colors.card, borderWidth: 1, borderColor: activeToday ? '#A08AB7' : colors.border, paddingHorizontal: 14, height: 33, borderRadius: 999, flexDirection: 'row', alignItems: 'center', }}
                onPress={() => {
                  const newActiveToday = !activeToday;
                  setActiveToday(newActiveToday);
                  const newFilters = { ...filters, activeToday: newActiveToday };
                  setFilters(newFilters);
                  loadProfiles(undefined, undefined, newFilters);
                }}
              >
                <MaterialCommunityIcons name="clock-outline" size={16} color={activeToday ? 'white' : colors.foreground} style={{ marginRight: 4 }} />
                <Text style={{ fontSize: 13, fontWeight: '500', color: activeToday ? '#fff' : colors.foreground, lineHeight: 14 }}>{t('discover.quickFilter.activeToday')}</Text>
              </TouchableOpacity>

              {/* Search */}
              <TouchableOpacity
                style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 33, borderRadius: 999, flexDirection: 'row', alignItems: 'center', }}
                onPress={() => setShowSearchBar(!showSearchBar)}
              >
                <Text style={{ fontSize: 13, fontWeight: '500', color: colors.foreground, lineHeight: 14 }}>{t('discover.quickFilter.search')}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>

          {/* Age Slider Panel */}
          {showAgeSlider && (
            <View className="mt-3 rounded-xl shadow-lg p-4" style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
              <Text className="font-semibold mb-3" style={{ color: colors.foreground }}>{t('discover.ageSlider.ageRange', { min: tempAgeMin, max: tempAgeMax })}</Text>

              <View className="mb-4">
                <Text className="text-sm mb-2" style={{ color: colors.mutedForeground }}>{t('discover.ageSlider.minimum', { value: tempAgeMin })}</Text>
                <Slider
                  minimumValue={18}
                  maximumValue={80}
                  step={1}
                  value={tempAgeMin}
                  onValueChange={(value) => setTempAgeMin(Math.min(value, tempAgeMax - 1))}
                  minimumTrackTintColor="#A08AB7"
                  maximumTrackTintColor={colors.border}
                  thumbTintColor="#A08AB7"
                />
              </View>

              <View className="mb-4">
                <Text className="text-sm mb-2" style={{ color: colors.mutedForeground }}>{t('discover.ageSlider.maximum', { value: tempAgeMax })}</Text>
                <Slider
                  minimumValue={18}
                  maximumValue={80}
                  step={1}
                  value={tempAgeMax}
                  onValueChange={(value) => setTempAgeMax(Math.max(value, tempAgeMin + 1))}
                  minimumTrackTintColor="#A08AB7"
                  maximumTrackTintColor={colors.border}
                  thumbTintColor="#A08AB7"
                />
              </View>

              <View className="flex-row gap-2">
                <TouchableOpacity
                  className="flex-1 rounded-full py-2" style={{ backgroundColor: colors.muted }}
                  onPress={() => {
                    setTempAgeMin(filters.ageMin);
                    setTempAgeMax(filters.ageMax);
                    setShowAgeSlider(false);
                  }}
                >
                  <Text className="text-center font-medium" style={{ color: colors.foreground }}>{t('common.cancel')}</Text>
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
                  <Text className="text-center text-white font-medium">{t('filters.applyFilters')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Intention Dropdown */}
          {showIntentionDropdown && (
            <View className="absolute top-full left-24 mt-1 rounded-xl shadow-lg z-50" style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, minWidth: 120 }}>
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
                  <Text style={{ fontSize: 12, fontWeight: selectedIntention === intention.value ? '600' : '400', color: selectedIntention === intention.value ? '#A08AB7' : colors.foreground }}>
                    {getIntentionLabel(intention.value)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Keyword Search Bar - Expanded when showSearchBar is true */}
          {showSearchBar && (
            <View className="mt-3">
              <View className="flex-row items-center rounded-full px-4 py-2" style={{ backgroundColor: colors.muted }}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.mutedForeground} />
                <TextInput
                  className="flex-1 ml-2 text-base" style={{ color: colors.foreground }}
                  placeholder={t('discover.search.placeholder')}
                  placeholderTextColor={colors.mutedForeground}
                  value={searchKeyword}
                  onChangeText={setSearchKeyword}
                  onSubmitEditing={handleSearch}
                  returnKeyType="search"
                  autoFocus
                />
                {isSearchMode && (
                  <TouchableOpacity onPress={handleClearSearch} className="ml-2">
                    <MaterialCommunityIcons name="close-circle" size={20} color={colors.mutedForeground} />
                  </TouchableOpacity>
                )}
                {!isSearchMode && searchKeyword.trim() && (
                  <TouchableOpacity onPress={handleSearch} className="ml-2 bg-lavender-500 rounded-full px-3 py-1">
                    <Text className="text-white font-semibold text-sm">{t('discover.search.button')}</Text>
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
                  <MaterialCommunityIcons name="close" size={20} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
              {isSearchMode && (
                <Text className="text-xs mt-2 text-center" style={{ color: colors.mutedForeground }}>
                  {t('discover.search.tip')}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* Likes Teaser Banner — drive free users to upgrade */}
        {pendingLikesCount > 0 && !isPremium && !isPlatinum && (
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/likes')}
            activeOpacity={0.85}
            style={{
              marginHorizontal: 12, marginBottom: 8, borderRadius: 14,
              backgroundColor: '#A08AB7', paddingVertical: 12, paddingHorizontal: 16,
              flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <MaterialCommunityIcons name="heart-multiple" size={22} color="#FFD700" />
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 14 }}>
                {pendingLikesCount === 1
                  ? t('likesTeaser.personLikesYou')
                  : t('likesTeaser.peopleLikeYou', { count: pendingLikesCount })}
              </Text>
            </View>
            <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 12 }}>
                {t('likesTeaser.seeWho', { defaultValue: 'See Who' })}
              </Text>
            </View>
          </TouchableOpacity>
        )}

        {/* Smart Empty State with Dynamic Recommendations */}
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, justifyContent: 'center' }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#A08AB7" />
          }
        >
          {isSearchMode ? (
            /* Search Mode Empty State */
            <View className="items-center">
              <Text className="text-6xl mb-4">🔍</Text>
              <Text className="text-2xl font-display-bold mb-3 text-center" style={{ color: colors.foreground }}>
                {t('discover.search.noResults', { keyword: searchKeyword })}
              </Text>
              <Text className="mb-6 text-center text-base font-sans" style={{ color: colors.mutedForeground }}>
                {t('discover.search.noResultsHint')}
              </Text>
              <TouchableOpacity
                className="bg-lavender-500 rounded-full py-4 px-8 shadow-lg"
                onPress={handleClearSearch}
              >
                <Text className="text-white font-sans-bold text-lg">{t('discover.search.clearSearch')}</Text>
              </TouchableOpacity>
            </View>
          ) : !isProfileComplete ? (
            /* Finish Onboarding — dominant CTA when profile is incomplete */
            <View className="items-center" style={{ paddingHorizontal: 8 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(160, 138, 183, 0.12)' }} className="items-center justify-center">
                <MaterialCommunityIcons name="pencil-plus-outline" size={32} color="#A08AB7" />
              </View>
              <Text className="text-center" style={{ fontSize: 22, fontWeight: '700', letterSpacing: -0.3, marginTop: 16, marginBottom: 8, color: colors.foreground }}>
                {t('discover.completeProfile.title')}
              </Text>
              <Text className="text-center font-sans" style={{ fontSize: 15, lineHeight: 22, maxWidth: 300, marginBottom: 24, color: colors.mutedForeground }}>
                {t('discover.completeProfile.message')}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  const destination = returnRoute || '/(onboarding)/onboarding';
                  exitPreviewMode();
                  router.replace(destination as any);
                }}
                style={{
                  backgroundColor: '#A08AB7',
                  paddingVertical: 14,
                  paddingHorizontal: 36,
                  borderRadius: 999,
                }}
                activeOpacity={0.85}
              >
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600', letterSpacing: 0.1 }}>
                  {t('discover.completeProfile.button')}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Smart Recommendations System */
            <View>
              {/* Hero Section */}
              <View className="items-center" style={{ marginBottom: 24 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(160, 138, 183, 0.12)' }} className="items-center justify-center" >
                  <MaterialCommunityIcons name="check-circle-outline" size={32} color="#A08AB7" />
                </View>
                <Text className="text-center" style={{ fontSize: 24, fontWeight: '700', letterSpacing: -0.5, marginTop: 16, marginBottom: 6, color: colors.foreground }}>
                  {t('discover.emptyState.allCaughtUp')}
                </Text>
                <Text className="text-center font-sans" style={{ fontSize: 15, lineHeight: 21, maxWidth: 280, color: colors.mutedForeground }}>
                  {t('discover.emptyState.checkBack')}
                </Text>
              </View>

              {/* Premium CTA Banner */}
              {!isPremium && (
                <TouchableOpacity
                  style={{
                    borderRadius: 16,
                    overflow: 'hidden',
                    marginBottom: 24,
                    backgroundColor: '#A08AB7',
                    shadowColor: '#A08AB7',
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.2,
                    shadowRadius: 12,
                    elevation: 5,
                  }}
                  onPress={() => {
                    trackEvent('empty_state_premium_cta_clicked', { source: 'discover_empty_state' });
                    setShowPaywall(true);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16 }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                        <MaterialCommunityIcons name="crown" size={18} color="rgba(255,255,255,0.9)" />
                        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginLeft: 6 }}>
                          {t('discover.premiumCta.goPremium')}
                        </Text>
                      </View>
                      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 18 }}>
                        {t('discover.premiumCta.description')}
                      </Text>
                    </View>
                    <View style={{
                      backgroundColor: '#fff',
                      borderRadius: 20,
                      paddingHorizontal: 18,
                      paddingVertical: 10,
                    }}>
                      <Text style={{ color: '#A08AB7', fontSize: 14, fontWeight: '700' }}>{t('discover.premiumCta.upgrade')}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              )}

              {/* Smart Recommendations */}
              {smartRecommendations.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text className="uppercase" style={{ fontSize: 12, fontWeight: '600', letterSpacing: 1.2, textAlign: 'center', marginBottom: 10, color: colors.mutedForeground }}>
                  {t('discover.recommendations.expandReach')}
                </Text>

                <View style={{ gap: 8 }}>
                  {smartRecommendations.map((rec, index) => {
                    const getIcon = () => {
                      switch (rec.type) {
                        case 'distance': return 'map-marker-radius';
                        case 'age': return 'calendar-range';
                        case 'gender': return 'account-plus-outline';
                        case 'global': return 'earth';
                        default: return 'star';
                      }
                    };

                    const getTitle = () => {
                      switch (rec.type) {
                        case 'distance':
                          return t('discover.recommendations.increaseDistance', { count: rec.increment });
                        case 'age':
                          return t('discover.recommendations.widenAge', { count: rec.increment });
                        case 'gender':
                          return t('discover.recommendations.includeGender', { gender: rec.addedGender });
                        case 'global':
                          return t('discover.recommendations.searchGlobally');
                        default:
                          return t('discover.recommendations.expandSearch');
                      }
                    };

                    const getSubtitle = () => {
                      const count = rec.count || 0;
                      if (count >= 1000) return t('discover.recommendations.newProfilesK', { count: parseFloat((count / 1000).toFixed(1)) });
                      if (count === 1) return t('discover.recommendations.newProfileSingular');
                      if (count > 0) return t('discover.recommendations.newProfiles', { count });
                      return '';
                    };

                    const handlePress = async () => {

                      try {
                        if (rec.type === 'distance' && rec.newDistance) {

                          setFilters({ ...filters, maxDistance: rec.newDistance });
                          setCurrentIndex(0);
                          trackEvent('smart_recommendation_clicked', {
                            type: 'distance',
                            increment: rec.increment,
                            count: rec.count
                          });
                          loadProfiles(undefined, undefined, { maxDistance: rec.newDistance });
                        } else if (rec.type === 'age' && rec.newAgeMin && rec.newAgeMax) {

                          setFilters({ ...filters, ageMin: rec.newAgeMin, ageMax: rec.newAgeMax });
                          setCurrentIndex(0);
                          trackEvent('smart_recommendation_clicked', {
                            type: 'age',
                            increment: rec.increment,
                            count: rec.count
                          });
                          loadProfiles(undefined, undefined, { ageMin: rec.newAgeMin, ageMax: rec.newAgeMax });
                        } else if (rec.type === 'gender' && rec.addedGender) {
                          const addedGender = rec.addedGender;
                          Alert.alert(
                            t('discover.recommendations.updatePreferencesTitle'),
                            t('discover.recommendations.updatePreferencesMessage', { gender: addedGender }),
                            [
                              { text: t('common.cancel'), style: 'cancel' },
                              {
                                text: t('discover.recommendations.add'),
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
                                    // Defensive expand: if addedGender is a UI label ("Men"), convert
                                    // to the canonical DB value ("Man") before writing.
                                    const newGenderPrefs = expandGenderPreference([...currentGenderPrefs, addedGender]);

                                    const { error: updateError } = await supabase
                                      .from('preferences')
                                      .update({
                                        gender_preference: newGenderPrefs,
                                        gender_preference_confirmed_at: new Date().toISOString(),
                                      })
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

                    const subtitle = getSubtitle();
                    const isGlobal = rec.type === 'global';

                    return (
                      <TouchableOpacity
                        key={`recommendation-${index}`}
                        style={{
                          backgroundColor: isGlobal ? '#A08AB7' : colors.card,
                          borderRadius: 14,
                          paddingVertical: 12,
                          paddingHorizontal: 14,
                          flexDirection: 'row',
                          alignItems: 'center',
                          shadowColor: isGlobal ? '#A08AB7' : '#000',
                          shadowOffset: { width: 0, height: 1 },
                          shadowOpacity: isGlobal ? 0.2 : 0.05,
                          shadowRadius: isGlobal ? 10 : 6,
                          elevation: isGlobal ? 4 : 2,
                        }}
                        onPress={handlePress}
                        activeOpacity={0.7}
                      >
                        <View style={{
                          width: 38, height: 38, borderRadius: 11,
                          backgroundColor: isGlobal ? 'rgba(255,255,255,0.2)' : 'rgba(160, 138, 183, 0.12)',
                          alignItems: 'center', justifyContent: 'center', marginRight: 12,
                        }}>
                          <MaterialCommunityIcons name={getIcon()} size={20} color={isGlobal ? '#fff' : '#A08AB7'} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: isGlobal ? '#fff' : colors.foreground, fontSize: 15, fontWeight: '600' }} numberOfLines={1}>
                            {getTitle()}
                          </Text>
                        </View>
                        {subtitle ? (
                          <Text style={{ color: isGlobal ? 'rgba(255,255,255,0.8)' : '#A08AB7', fontSize: 12, fontWeight: '600', marginRight: 6 }}>{subtitle}</Text>
                        ) : null}
                        {isGlobal && !isPremium && !isPlatinum && (
                          <View style={{ backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2, marginRight: 6 }}>
                            <Text style={{ color: '#A08AB7', fontSize: 10, fontWeight: '700' }}>PRO</Text>
                          </View>
                        )}
                        <MaterialCommunityIcons name="chevron-right" size={20} color={isGlobal ? 'rgba(255,255,255,0.6)' : colors.grey3} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              )}

              {/* Quick Actions */}
              <View style={{ gap: 8 }}>
                <TouchableOpacity
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 6,
                    elevation: 2,
                  }}
                  onPress={() => {
                    trackEvent('empty_state_recommendation_clicked', { action: 'open_filters' });
                    setShowFilterModal(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{
                    width: 38, height: 38, borderRadius: 11,
                    backgroundColor: 'rgba(160, 138, 183, 0.12)',
                    alignItems: 'center', justifyContent: 'center', marginRight: 12,
                  }}>
                    <MaterialCommunityIcons name="tune-variant" size={20} color="#A08AB7" />
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: '600', flex: 1 }}>Adjust Filters</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.grey3} />
                </TouchableOpacity>

                <TouchableOpacity
                  style={{
                    backgroundColor: colors.card,
                    borderRadius: 14,
                    paddingVertical: 12,
                    paddingHorizontal: 14,
                    flexDirection: 'row',
                    alignItems: 'center',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 1 },
                    shadowOpacity: 0.05,
                    shadowRadius: 6,
                    elevation: 2,
                  }}
                  onPress={() => {
                    trackEvent('empty_state_action_clicked', { action: 'search' });
                    setShowSearchBar(true);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={{
                    width: 38, height: 38, borderRadius: 11,
                    backgroundColor: 'rgba(160, 138, 183, 0.12)',
                    alignItems: 'center', justifyContent: 'center', marginRight: 12,
                  }}>
                    <MaterialCommunityIcons name="magnify" size={20} color="#A08AB7" />
                  </View>
                  <Text style={{ color: colors.foreground, fontSize: 15, fontWeight: '600', flex: 1 }}>Search by Keyword</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.grey3} />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>

        {/* One-time gender preference confirmation (only shown if user's
            gender_preference_confirmed_at is null — i.e. they were affected
            by the pre-2026-05-05 expandGenderPreference wipe bug). */}
        <ConfirmGenderPreferenceModal
          visible={showConfirmGenderModal}
          onConfirm={async (uiSelections) => {
            if (!currentProfileId) return;
            const expanded = expandGenderPreference(uiSelections);
            const { error } = await supabase
              .from('preferences')
              .update({
                gender_preference: expanded,
                gender_preference_confirmed_at: new Date().toISOString(),
              })
              .eq('profile_id', currentProfileId);
            if (error) {
              showToast({
                type: 'error',
                title: t('common.error'),
                message: t('toast.filtersSaveError') || "Couldn't save your preference. Please try again.",
              });
              captureException(
                new Error((error as any)?.message || 'confirm gender modal save failed'),
                { context: 'confirm_gender_modal_save', errorCode: (error as any)?.code },
                ['confirm-gender-modal-save'],
              );
              return;
            }
            setFilters((prev) => ({ ...prev, genderPreference: expanded }));
            setShowConfirmGenderModal(false);
            // Re-load discovery feed with the new filter applied
            loadProfiles();
          }}
        />

        {/* Filter Modal */}
        <FilterModal
          visible={showFilterModal}
          onClose={() => setShowFilterModal(false)}
          onApply={async (newFilters) => {
            setFilters(newFilters);
            setShowFilterModal(false);
            filtersSnapshotRef.current = computeFiltersHash(newFilters);
            // Clear stale profile queue immediately so the user can't swipe
            // on pre-filter candidates during the refetch window.
            setProfiles([]);
            setCurrentIndex(0);
            // Await persistFilters so the DB write completes (and the cache
            // invalidation trigger fires) before we re-query.
            await persistFilters(newFilters);
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
    <View className="flex-1" style={{ backgroundColor: colors.background, paddingRight: rightSafeArea }}>
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
          onRefresh={handleRefresh}
          refreshing={refreshing}
          renderHeader={() => (
            <>
              {/* Header with Search/Filter Controls */}
              <View className="pt-4 pb-0" style={{ backgroundColor: colors.background, marginHorizontal: -16 }}>
                {/* Quick Filters Row - Horizontal Scroll with Search/Refresh on right */}
                <View className="flex-row items-center mb-3">
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6, paddingLeft: 12, paddingRight: 12, alignItems: 'center' }}
                    style={{ flex: 1 }}
                  >
                    <TouchableOpacity
                      className="rounded-full p-2.5" style={{ backgroundColor: colors.background }}
                      onPress={() => setShowFilterModal(true)}
                    >
                      <MaterialCommunityIcons name="tune-vertical" size={24} color={colors.foreground} />
                    </TouchableOpacity>

                    {/* Age Quick Filter */}
                    <TouchableOpacity
                      style={{ backgroundColor: colors.card, borderWidth: 2, borderColor: colors.foreground, paddingHorizontal: 14, height: 33, borderRadius: 999, flexDirection: 'row', alignItems: 'center', }}
                      onPress={() => {
                        setTempAgeMin(filters.ageMin);
                        setTempAgeMax(filters.ageMax);
                        setShowAgeSlider(!showAgeSlider);
                        setShowIntentionDropdown(false);
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '500', color: colors.foreground, lineHeight: 14 }}>{t('discover.quickFilter.age')}</Text>
                      <MaterialCommunityIcons name="chevron-down" size={16} color={colors.foreground} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>

                    {/* Intention Quick Filter */}
                    <TouchableOpacity
                      style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 33, borderRadius: 999, flexDirection: 'row', alignItems: 'center', }}
                      onPress={() => {
                        setShowIntentionDropdown(!showIntentionDropdown);
                        setShowAgeSlider(false);
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '500', color: colors.foreground, lineHeight: 14 }}>{t('discover.quickFilter.datingIntentions')}</Text>
                      <MaterialCommunityIcons name="chevron-down" size={16} color={colors.foreground} style={{ marginLeft: 4 }} />
                    </TouchableOpacity>

                    {/* Active Today Toggle */}
                    <TouchableOpacity
                      style={{ backgroundColor: activeToday ? '#A08AB7' : colors.card, borderWidth: 1, borderColor: activeToday ? '#A08AB7' : colors.border, paddingHorizontal: 14, height: 33, borderRadius: 999, flexDirection: 'row', alignItems: 'center', }}
                      onPress={() => {
                        const newActiveToday = !activeToday;
                        setActiveToday(newActiveToday);
                        const newFilters = { ...filters, activeToday: newActiveToday };
                        setFilters(newFilters);
                        loadProfiles(undefined, undefined, newFilters);
                      }}
                    >
                      <MaterialCommunityIcons name="clock-outline" size={16} color={activeToday ? 'white' : colors.foreground} style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: 13, fontWeight: '500', color: activeToday ? '#fff' : colors.foreground, lineHeight: 14 }}>{t('discover.quickFilter.activeToday')}</Text>
                    </TouchableOpacity>

                    {/* Search */}
                    <TouchableOpacity
                      style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, height: 33, borderRadius: 999, flexDirection: 'row', alignItems: 'center', }}
                      onPress={() => setShowSearchBar(!showSearchBar)}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '500', color: colors.foreground, lineHeight: 14 }}>{t('discover.quickFilter.search')}</Text>
                    </TouchableOpacity>

                    {/* Daily likes remaining — free users only. Gives clear
                        feedback that the 5/day limit is counting down, and
                        lets them tap through to the paywall if they want
                        unlimited. */}
                    {!isPremium && !isPlatinum && (() => {
                      const remaining = Math.max(0, DAILY_LIKE_LIMIT - likeCount);
                      const depleted = remaining === 0;
                      return (
                        <TouchableOpacity
                          style={{
                            backgroundColor: depleted ? '#EF4444' : '#A08AB7',
                            paddingHorizontal: 14,
                            height: 33,
                            borderRadius: 999,
                            flexDirection: 'row',
                            alignItems: 'center',
                          }}
                          onPress={() => setShowPaywall(true)}
                          activeOpacity={0.85}
                        >
                          <MaterialCommunityIcons name="heart" size={14} color="#fff" style={{ marginRight: 4 }} />
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#fff', lineHeight: 14 }}>
                            {remaining}/{DAILY_LIKE_LIMIT}
                          </Text>
                        </TouchableOpacity>
                      );
                    })()}

                    {isPlatinum && (
                      <TouchableOpacity
                        className="rounded-full p-2.5"
                        style={{ backgroundColor: 'rgba(255, 215, 0, 0.3)' }}
                        onPress={() => setShowBoostModal(true)}
                      >
                        <MaterialCommunityIcons name="rocket" size={20} color="#FFD700" />
                      </TouchableOpacity>
                    )}
                  </ScrollView>
                </View>

                {/* Age Slider Panel */}
                {showAgeSlider && (
                  <View className="mt-3 rounded-xl shadow-lg p-4" style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }}>
                    <Text className="font-semibold mb-3" style={{ color: colors.foreground }}>{t('discover.ageSlider.ageRange', { min: tempAgeMin, max: tempAgeMax })}</Text>

                    <View className="mb-4">
                      <Text className="text-sm mb-2" style={{ color: colors.mutedForeground }}>{t('discover.ageSlider.minimum', { value: tempAgeMin })}</Text>
                      <Slider
                        minimumValue={18}
                        maximumValue={80}
                        step={1}
                        value={tempAgeMin}
                        onValueChange={(value) => setTempAgeMin(Math.min(value, tempAgeMax - 1))}
                        minimumTrackTintColor="#A08AB7"
                        maximumTrackTintColor={colors.border}
                        thumbTintColor="#A08AB7"
                      />
                    </View>

                    <View className="mb-4">
                      <Text className="text-sm mb-2" style={{ color: colors.mutedForeground }}>{t('discover.ageSlider.maximum', { value: tempAgeMax })}</Text>
                      <Slider
                        minimumValue={18}
                        maximumValue={80}
                        step={1}
                        value={tempAgeMax}
                        onValueChange={(value) => setTempAgeMax(Math.max(value, tempAgeMin + 1))}
                        minimumTrackTintColor="#A08AB7"
                        maximumTrackTintColor={colors.border}
                        thumbTintColor="#A08AB7"
                      />
                    </View>

                    <View className="flex-row gap-2">
                      <TouchableOpacity
                        className="flex-1 rounded-full py-2" style={{ backgroundColor: colors.muted }}
                        onPress={() => {
                          setTempAgeMin(filters.ageMin);
                          setTempAgeMax(filters.ageMax);
                          setShowAgeSlider(false);
                        }}
                      >
                        <Text className="text-center font-medium" style={{ color: colors.foreground }}>{t('common.cancel')}</Text>
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
                        <Text className="text-center text-white font-medium">{t('filters.applyFilters')}</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                {/* Intention Dropdown */}
                {showIntentionDropdown && (
                  <View className="absolute top-full left-24 mt-1 rounded-xl shadow-lg z-50" style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, minWidth: 120 }}>
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
                        <Text style={{ fontSize: 12, fontWeight: selectedIntention === intention.value ? '600' : '400', color: selectedIntention === intention.value ? '#A08AB7' : colors.foreground }}>
                          {getIntentionLabel(intention.value)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Keyword Search Bar - Expanded when showSearchBar is true */}
                {showSearchBar && (
                  <View className="mt-3">
                    <View className="flex-row items-center rounded-full px-4 py-2" style={{ backgroundColor: colors.muted }}>
                      <MaterialCommunityIcons name="magnify" size={20} color={colors.mutedForeground} />
                      <TextInput
                        className="flex-1 ml-2 text-base" style={{ color: colors.foreground }}
                        placeholder={t('discover.search.placeholder')}
                        placeholderTextColor={colors.mutedForeground}
                        value={searchKeyword}
                        onChangeText={setSearchKeyword}
                        onSubmitEditing={handleSearch}
                        returnKeyType="search"
                        autoFocus
                      />
                      {isSearchMode && (
                        <TouchableOpacity onPress={handleClearSearch} className="ml-2">
                          <MaterialCommunityIcons name="close-circle" size={20} color={colors.mutedForeground} />
                        </TouchableOpacity>
                      )}
                      {!isSearchMode && searchKeyword.trim() && (
                        <TouchableOpacity onPress={handleSearch} className="ml-2 bg-lavender-500 rounded-full px-3 py-1">
                          <Text className="text-white font-semibold text-sm">{t('discover.search.button')}</Text>
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
                        <MaterialCommunityIcons name="close" size={20} color={colors.mutedForeground} />
                      </TouchableOpacity>
                    </View>
                    {isSearchMode && (
                      <Text className="text-xs mt-2 text-center" style={{ color: colors.mutedForeground }}>
                        {t('discover.search.tip')}
                      </Text>
                    )}
                  </View>
                )}
              </View>

              {/* Verification Banner - Prompt unverified users to verify (hidden if onboarding incomplete) */}
              {showVerificationBanner && !isPhotoVerified && isProfileComplete && (
                <VerificationBanner onDismiss={handleDismissVerificationBanner} />
              )}

              {/* Trial Expiration Banner - Warn users when trial is about to end */}
              <TrialExpirationBanner key="trial-expiration-banner" />

              {/* Photo Blur Info Banner - Explain why some photos may be blurred */}
              {showPhotoBlurBanner && (
                <View className="mx-4 mt-2 p-4 rounded-xl" style={{ backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE' }}>
                  <View className="flex-row items-start">
                    <View className="w-10 h-10 rounded-full items-center justify-center mr-3" style={{ backgroundColor: '#DBEAFE' }}>
                      <MaterialCommunityIcons name="image-off-outline" size={20} color="#3B82F6" />
                    </View>
                    <View className="flex-1">
                      <Text className="font-semibold text-sm" style={{ color: '#1E3A5F' }}>{t('discover.banner.photoBlurTitle')}</Text>
                      <Text className="text-xs mt-1 leading-5" style={{ color: '#1D4ED8' }}>
                        {t('discover.banner.photoBlurDescription')}
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
                    <Text className="text-amber-900 font-semibold text-sm">{t('discover.banner.profileHidden')}</Text>
                    <Text className="text-amber-700 text-xs mt-0.5" numberOfLines={2}>
                      {photoReviewReason
                        ? `${t('discover.banner.profileHiddenDescription')} (${photoReviewReason})`
                        : t('discover.banner.profileHiddenDescription')}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={24} color="#F59E0B" />
                </TouchableOpacity>
              )}

              {/* Complete Profile Banner - For users who haven't finished onboarding */}
              {showOnboardingBanner && !isProfileComplete && (
                <TouchableOpacity
                  className="mx-4 mt-2 p-4 bg-lavender-50 border border-lavender-200 rounded-xl flex-row items-center"
                  onPress={() => {
                    const destination = returnRoute || '/(onboarding)/onboarding';
                    exitPreviewMode();
                    router.replace(destination as any);
                  }}
                  activeOpacity={0.8}
                >
                  <View className="w-10 h-10 bg-lavender-100 rounded-full items-center justify-center mr-3">
                    <MaterialCommunityIcons name={isPreviewMode ? "arrow-left" : "account-edit"} size={20} color="#A08AB7" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-lavender-900 font-semibold text-sm">
                      {isPreviewMode ? t('discover.banner.completeProfileToMatch') : t('discover.banner.completeProfile')}
                    </Text>
                    <Text className="text-lavender-700 text-xs mt-0.5">
                      {isPreviewMode
                        ? t('discover.banner.completeProfilePreview')
                        : t('discover.banner.completeProfileDefault')}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            </>
          )}
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
        onApply={async (newFilters) => {
          setFilters(newFilters);
          setShowFilterModal(false);
          filtersSnapshotRef.current = computeFiltersHash(newFilters);
          setCurrentIndex(0);
          await persistFilters(newFilters);
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
          onReportSuccess={(reportedId, didBlock) => {
            // Remove the reported profile from the deck so they can't reappear
            setProfiles(prev => prev.filter(p => p.id !== reportedId));
          }}
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
          <View className="rounded-3xl w-full max-w-sm overflow-hidden" style={{ backgroundColor: colors.card }}>
            {/* Header */}
            <View className="bg-lavender-500 p-6 items-center">
              <View className="w-16 h-16 rounded-full bg-white/20 items-center justify-center mb-3">
                <MaterialCommunityIcons name="earth" size={32} color="#fff" />
              </View>
              <Text className="text-white text-xl font-sans-bold text-center">
                {t('discover.premiumLocation.title')}
              </Text>
            </View>

            {/* Body */}
            <View className="p-6">
              <Text className="text-center text-base mb-4" style={{ color: colors.foreground }}>
                {t('discover.premiumLocation.description')}
              </Text>

              <View className="rounded-xl p-4 mb-4" style={{ backgroundColor: colors.secondary }}>
                <View className="flex-row items-center mb-2">
                  <MaterialCommunityIcons name="check-circle" size={20} color="#A08AB7" />
                  <Text className="ml-2" style={{ color: colors.foreground }}>{t('discover.premiumLocation.searchGlobally')}</Text>
                </View>
                <View className="flex-row items-center">
                  <MaterialCommunityIcons name="check-circle" size={20} color="#A08AB7" />
                  <Text className="ml-2" style={{ color: colors.foreground }}>{t('discover.premiumLocation.matchCities')}</Text>
                </View>
              </View>

              <Text className="text-center text-sm mb-6" style={{ color: colors.mutedForeground }}>
                {t('discover.premiumLocation.upgradeMessage')}
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
                  {t('discover.premiumLocation.upgradeToPremium')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="py-3"
                onPress={() => setShowPremiumLocationPrompt(false)}
              >
                <Text className="text-center text-sm" style={{ color: colors.mutedForeground }}>
                  {t('discover.premiumLocation.maybeLater')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


    </View>
  );
}
