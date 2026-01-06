import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Dimensions, StatusBar, StyleSheet } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { calculateCompatibilityScore, getCompatibilityBreakdown } from '@/lib/matching-algorithm';
import { calculateDistance } from '@/lib/geolocation';
import { formatHeight, HeightUnit } from '@/lib/height-utils';
import DiscoveryProfileView from '@/components/matching/DiscoveryProfileView';
import ModerationMenu from '@/components/moderation/ModerationMenu';
import { useScreenCaptureProtection } from '@/hooks/useScreenCaptureProtection';
import { useColorScheme } from '@/lib/useColorScheme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  bio?: string;
  occupation?: string;
  education?: string;
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
      } catch (e) {
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

// Compatibility Bar Component
const CompatibilityBar = ({ label, score, icon, color }: { label: string; score: number; icon: string; color: string }) => {
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

export default function ProfileView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { isPremium, isPlatinum } = useSubscription();
  const { colors, isDarkColorScheme } = useColorScheme();
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

  // Enable screenshot protection for this profile view
  useScreenCaptureProtection(true);

  useEffect(() => {
    loadCurrentProfile();
  }, []);

  useEffect(() => {
    if (id && currentProfileId) {
      loadProfile();
      checkIfMatched();
    }
  }, [id, currentProfileId, currentPreferences]);

  // Refetch profile data when screen comes back into focus (e.g., after editing)
  useFocusEffect(
    useCallback(() => {
      if (id && currentProfileId) {
        loadProfile();
        checkIfMatched();
      }
    }, [id, currentProfileId, currentPreferences])
  );

  const loadCurrentProfile = async () => {
    try {
      // Load current user's full profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;

      setCurrentProfileId(profileData.id);
      setCurrentProfile(profileData);
      setIsAdmin(profileData.is_admin === true); // Set admin status

      // Load current user's preferences for compatibility calculation
      const { data: prefsData, error: prefsError } = await supabase
        .from('preferences')
        .select('*')
        .eq('profile_id', profileData.id)
        .single();

      if (prefsError) {
        console.error('Error loading current user preferences:', prefsError);
      } else {
        console.log('✅ Current user preferences loaded:', prefsData);
      }

      setCurrentPreferences(prefsData);
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
        console.log('👑 Admin user detected');
      }

      // Check if there's an active match between current user and viewed profile
      const { data: match } = await supabase
        .from('matches')
        .select('id')
        .eq('status', 'active')
        .or(`and(profile1_id.eq.${currentProfileId},profile2_id.eq.${id}),and(profile1_id.eq.${id},profile2_id.eq.${currentProfileId})`)
        .single();

      if (match) {
        console.log('✅ Found active match - showing matched UI');
        setIsMatched(true);
        setMatchId(match.id);
        checkPhotoRevealStatus();
      } else {
        console.log(`🔍 No match found. Premium: ${isPremium}, Platinum: ${isPlatinum}, Admin: ${isAdminUser}`);

        // Check if the viewed profile has liked the current user
        const { data: theirLike } = await supabase
          .from('likes')
          .select('id')
          .eq('liker_profile_id', id)
          .eq('liked_profile_id', currentProfileId)
          .maybeSingle();

        console.log(`🔍 Like check: theirLike exists = ${!!theirLike}`);

        // Allow viewing with like buttons if:
        // 1. Premium/Platinum user viewing someone who liked them
        // 2. Admin viewing someone who liked them (for testing)
        if ((isPremium || isPlatinum || isAdminUser) && theirLike) {
          console.log('✅ Showing LIKE BUTTONS (premium/admin viewing profile from likes tab)');
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
            console.log('👑 Admin has existing match with this profile');
            setIsMatched(true);
            setMatchId(adminMatch.id);
          } else {
            console.log('👑 Admin viewing profile without match - showing as viewable only');
            setIsMatched(true); // Show as "matched" to allow viewing full profile
            setMatchId(null); // But no chat available
          }
          return;
        }

        // Not matched and no permission to view - redirect back
        console.log('❌ No permission to view this profile - showing alert');
        setIsMatched(false);
        setMatchId(null);
        Alert.alert('Not Matched', 'You can only view full profiles of your matches.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error: any) {
      // Check if premium user viewing someone who liked them
      if (isPremium || isPlatinum) {
        try {
          const { data: theirLike } = await supabase
            .from('likes')
            .select('id')
            .eq('liker_profile_id', id)
            .eq('liked_profile_id', currentProfileId)
            .maybeSingle();

          if (theirLike) {
            // Premium user viewing someone who liked them - allow it
            console.log('✅ Premium user viewing profile from likes tab');
            setIsMatched(false); // Not matched yet, will show like/pass buttons
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
      Alert.alert('Not Matched', 'You can only view full profiles of your matches.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    }
  };

  const checkPhotoRevealStatus = async () => {
    if (!currentProfileId || !id) return;

    try {
      // Check if current user has revealed photos to this profile
      const { data: myReveal } = await supabase
        .from('photo_reveals')
        .select('id')
        .eq('revealer_profile_id', currentProfileId)
        .eq('revealed_to_profile_id', id)
        .maybeSingle();

      setHasRevealedPhotos(!!myReveal);

      // Check if other user has revealed photos to current user
      const { data: theirReveal } = await supabase
        .from('photo_reveals')
        .select('id')
        .eq('revealer_profile_id', id)
        .eq('revealed_to_profile_id', currentProfileId)
        .maybeSingle();

      setOtherUserRevealed(!!theirReveal);
    } catch (error: any) {
      console.error('Error checking photo reveal status:', error);
    }
  };

  const togglePhotoReveal = async () => {
    if (!currentProfileId || !id || !matchId) {
      Alert.alert('Error', 'You must be matched with this user to reveal photos');
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
        Alert.alert('Photos Blurred', 'Your photos are now blurred for this match');
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
        Alert.alert('Photos Revealed', `Your photos are now visible to ${profile?.display_name}`);
      }
    } catch (error: any) {
      console.error('Error toggling photo reveal:', error);
      Alert.alert('Error', 'Failed to update photo visibility. Please try again.');
    } finally {
      setRevealLoading(false);
    }
  };

  const loadProfile = async () => {
    try {
      setLoading(true);

      // CRITICAL SAFETY: Check if user is banned
      const { data: banData } = await supabase
        .from('bans')
        .select('id')
        .eq('banned_profile_id', id)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .maybeSingle();

      if (banData) {
        // User is banned - don't show their profile
        Alert.alert(
          'Error',
          'This profile is no longer available.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        setLoading(false);
        return;
      }

      // Load profile with photos
      const { data: profileData, error: profileError } = await supabase
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
          bio,
          occupation,
          education,
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
          religion,
          political_views,
          photo_blur_enabled,
          photos (
            url,
            is_primary,
            display_order
          )
        `)
        .eq('id', id)
        .single();

      if (profileError) throw profileError;

      // Load preferences
      const { data: prefsData } = await supabase
        .from('preferences')
        .select('*')
        .eq('profile_id', id)
        .single();

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

          console.log('Compatibility breakdown calculated:', breakdown);
        } catch (error) {
          console.error('Error calculating compatibility:', error);
        }
      } else {
        console.log('Missing data for compatibility calculation:', {
          hasCurrentProfile: !!currentProfile,
          hasCurrentPreferences: !!currentPreferences,
          hasPrefsData: !!prefsData,
        });
      }

      setProfile(transformedProfile);
      setPreferences(prefsData);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load profile');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async () => {
    if (!currentProfileId || !id) return;

    setIsLiked(true);

    try {
      // Insert like
      await supabase.from('likes').insert({
        liker_profile_id: currentProfileId,
        liked_profile_id: id,
      });

      // Check for mutual match
      const { data: mutualLike } = await supabase
        .from('likes')
        .select('id')
        .eq('liker_profile_id', id)
        .eq('liked_profile_id', currentProfileId)
        .single();

      if (mutualLike) {
        // It's a match!
        const profile1Id = currentProfileId < id ? currentProfileId : id;
        const profile2Id = currentProfileId < id ? id : currentProfileId;

        const { data: newMatch, error: matchError } = await supabase.from('matches').insert({
          profile1_id: profile1Id,
          profile2_id: profile2Id,
          initiated_by: currentProfileId,
          compatibility_score: profile?.compatibility_score || null,
          status: 'active',
        }).select('id').single();

        if (matchError) throw matchError;

        setTimeout(() => {
          Alert.alert('🎉 It\'s a Match!', `You matched with ${profile?.display_name}!`, [
            { text: 'Send Message', onPress: () => router.push(`/chat/${newMatch.id}`) },
            { text: 'Keep Swiping', onPress: () => router.back() }
          ]);
        }, 500);
      } else {
        setTimeout(() => router.back(), 800);
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to like profile');
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
    } catch (error: any) {
      Alert.alert('Error', 'Failed to pass profile');
    }
  };

  const handleObsessed = async () => {
    if (!currentProfileId || !id) return;

    setIsSuperLiked(true);

    try {
      // Insert super like
      await supabase.from('likes').insert({
        liker_profile_id: currentProfileId,
        liked_profile_id: id,
      });

      // Check for mutual match
      const { data: mutualLike } = await supabase
        .from('likes')
        .select('id')
        .eq('liker_profile_id', id)
        .eq('liked_profile_id', currentProfileId)
        .single();

      if (mutualLike) {
        // It's a match!
        const profile1Id = currentProfileId < id ? currentProfileId : id;
        const profile2Id = currentProfileId < id ? id : currentProfileId;

        const { data: newMatch, error: matchError } = await supabase.from('matches').insert({
          profile1_id: profile1Id,
          profile2_id: profile2Id,
          initiated_by: currentProfileId,
          compatibility_score: profile?.compatibility_score || null,
          status: 'active',
        }).select('id').single();

        if (matchError) throw matchError;

        setTimeout(() => {
          Alert.alert('🎉 It\'s a Match!', `You matched with ${profile?.display_name}!`, [
            { text: 'Send Message', onPress: () => router.push(`/chat/${newMatch.id}`) },
            { text: 'Keep Swiping', onPress: () => router.back() }
          ]);
        }, 500);
      } else {
        setTimeout(() => {
          Alert.alert('💜 Obsessed!', `${profile?.display_name} will be notified that you're interested!`, [
            { text: 'OK', onPress: () => router.back() }
          ]);
        }, 500);
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to send super like');
      setIsSuperLiked(false);
    }
  };

  // Value-to-label mappings for preferences
  const PREFERENCE_LABELS: { [key: string]: string } = {
    // Financial arrangements
    'separate': 'Keep Finances Separate',
    'shared_expenses': 'Share Living Expenses',
    'joint': 'Fully Joint Finances',
    'prenup_required': 'Prenup Required',
    'flexible': 'Flexible/Open to Discussion',

    // Housing preferences
    'separate_spaces': 'Separate Bedrooms/Spaces',
    'roommates': 'Roommate-Style Arrangement',
    'separate_homes': 'Separate Homes Nearby',
    'shared_bedroom': 'Shared Bedroom',

    // Children arrangements
    'biological': 'Biological Children',
    'adoption': 'Adoption',
    'co_parenting': 'Co-Parenting Agreement',
    'surrogacy': 'Surrogacy',
    'ivf': 'IVF',
    'already_have': 'Already Have Children',
    'open_discussion': 'Open to Discussion',

    // Primary reasons
    'financial': 'Financial Stability',
    'immigration': 'Immigration/Visa',
    'family_pressure': 'Family Pressure',
    'legal_benefits': 'Legal Benefits',
    'companionship': 'Companionship',
    'safety': 'Safety & Protection',

    // Relationship types
    'platonic': 'Platonic Only',
    'romantic': 'Romantic Partnership',
    'open': 'Open Arrangement',
  };

  const formatLabel = (value: string) => {
    // First try to get from mapping
    if (PREFERENCE_LABELS[value]) {
      return PREFERENCE_LABELS[value];
    }

    // Fallback to Title Case conversion for unmapped values
    return value
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
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
        } catch (e) {
          items = [value];
        }
      } else {
        items = [value];
      }
    }

    return items.map(formatLabel).join(', ');
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#A08AB7" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: colors.mutedForeground }}>Profile not found</Text>
      </View>
    );
  }

  const photos = profile.photos || [];

  // Prepare quick facts
  // Use viewer's height unit preference to display height
  const viewerHeightUnit: HeightUnit = currentProfile?.height_unit || 'imperial';
  const quickFacts = [];
  if (profile.height_inches) {
    quickFacts.push({
      emoji: '📏',
      label: 'Height',
      value: formatHeight(profile.height_inches, viewerHeightUnit),
    });
  }
  if (profile.zodiac_sign) {
    quickFacts.push({
      emoji: '✨',
      label: 'Zodiac',
      value: profile.zodiac_sign,
    });
  }
  if (profile.personality_type) {
    quickFacts.push({
      emoji: '🧠',
      label: 'Personality',
      value: profile.personality_type,
    });
  }
  if (profile.love_language) {
    quickFacts.push({
      emoji: '💖',
      label: 'Love Language',
      value: formatArrayOrString(profile.love_language),
    });
  }
  if (profile.languages?.length) {
    quickFacts.push({
      emoji: '🌍',
      label: 'Languages',
      value: profile.languages.join(', '),
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
          backgroundColor: colors.card,
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
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: colors.foreground, marginLeft: 12 }}>
            Why We Match
          </Text>
        </View>

        {/* Detailed Compatibility Breakdown */}
        <View style={{ marginTop: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: '#111827', marginBottom: 16 }}>
            What Makes You Compatible
          </Text>

          {/* Location Analysis */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#10B981" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginLeft: 8 }}>
                Location & Distance
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20 }}>
              {compatibilityBreakdown.location >= 80
                ? `You're both ${profile.distance ? `only ${profile.distance} miles apart` : 'in the same area'}, making it easy to meet up and build a connection. ${preferences?.willing_to_relocate || currentPreferences?.willing_to_relocate ? 'Plus, you\'re both open to relocating if needed.' : ''}`
                : compatibilityBreakdown.location >= 60
                ? `You're ${profile.distance ? `${profile.distance} miles apart` : 'at a moderate distance'}. ${preferences?.willing_to_relocate && currentPreferences?.willing_to_relocate ? 'Fortunately, you\'re both willing to relocate, which opens up possibilities.' : preferences?.willing_to_relocate || currentPreferences?.willing_to_relocate ? 'One of you is open to relocating, which could work well.' : 'The distance is manageable with some planning.'}`
                : preferences?.search_globally || currentPreferences?.search_globally || preferences?.willing_to_relocate || currentPreferences?.willing_to_relocate
                ? `While you're ${profile.distance ? `${profile.distance} miles apart` : 'at a distance'}, you're both open to ${preferences?.search_globally || currentPreferences?.search_globally ? 'matching globally' : 'relocating'}, showing flexibility in making a connection work.`
                : `You're ${profile.distance ? `${profile.distance} miles apart` : 'at a distance'}. Consider discussing how distance might work for your arrangement.`}
            </Text>
          </View>

          {/* Goals Analysis */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="target" size={20} color="#3B82F6" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginLeft: 8 }}>
                Marriage Goals & Vision
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20 }}>
              {compatibilityBreakdown.goals >= 80
                ? `You're highly aligned on marriage goals! ${preferences?.primary_reason === currentPreferences?.primary_reason ? `You both seek this arrangement primarily for ${formatLabel(preferences?.primary_reason || '')}.` : ''} ${preferences?.relationship_type === currentPreferences?.relationship_type ? `You both envision a ${formatLabel(preferences?.relationship_type || '')} partnership.` : ''} ${preferences?.wants_children === currentPreferences?.wants_children ? (preferences?.wants_children ? 'You both want children' : 'You both prefer not to have children') + ', making family planning straightforward.' : ''}`
                : compatibilityBreakdown.goals >= 60
                ? `You share common ground on key goals. ${preferences?.primary_reason === currentPreferences?.primary_reason ? `You both primarily seek ${formatLabel(preferences?.primary_reason || '')}.` : 'Your primary reasons differ but may complement each other.'} ${preferences?.relationship_type && currentPreferences?.relationship_type ? `Your relationship style preferences (${formatLabel(preferences?.relationship_type)} vs ${formatLabel(currentPreferences?.relationship_type)}) could work with open communication.` : ''}`
                : `Your marriage goals differ in some areas. ${preferences?.wants_children !== currentPreferences?.wants_children ? 'You have different views on children, which is important to discuss.' : ''} ${preferences?.relationship_type !== currentPreferences?.relationship_type ? `You envision different relationship styles (${formatLabel(preferences?.relationship_type || '')} vs ${formatLabel(currentPreferences?.relationship_type || '')}), but compromise may be possible.` : ''} Open and honest conversation about expectations will be key.`}
            </Text>
          </View>

          {/* Lifestyle Analysis */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="coffee" size={20} color="#F59E0B" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginLeft: 8 }}>
                Lifestyle & Values
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20 }}>
              {compatibilityBreakdown.lifestyle >= 80
                ? `Your day-to-day lifestyles are very compatible! ${preferences?.lifestyle_preferences?.smoking === currentPreferences?.lifestyle_preferences?.smoking ? 'You share the same views on smoking.' : ''} ${preferences?.lifestyle_preferences?.drinking === currentPreferences?.lifestyle_preferences?.drinking ? 'You have aligned drinking preferences.' : ''} ${preferences?.lifestyle_preferences?.pets === currentPreferences?.lifestyle_preferences?.pets ? 'You feel the same way about pets.' : ''} ${arraysEqual(preferences?.housing_preference, currentPreferences?.housing_preference) ? `You both prefer ${formatArrayWithLabels(preferences?.housing_preference)} living arrangements.` : ''}`
                : compatibilityBreakdown.lifestyle >= 60
                ? `Your lifestyles are moderately compatible. ${preferences?.lifestyle_preferences?.smoking !== currentPreferences?.lifestyle_preferences?.smoking ? 'You differ on smoking preferences, which may need discussion.' : ''} ${!arraysEqual(preferences?.housing_preference, currentPreferences?.housing_preference) ? 'Your ideal living arrangements differ but could potentially be negotiated.' : ''} ${preferences?.financial_arrangement || currentPreferences?.financial_arrangement ? 'Discussing financial expectations will help align your lifestyles.' : ''}`
                : `Your lifestyle preferences show some differences. ${preferences?.lifestyle_preferences?.pets !== currentPreferences?.lifestyle_preferences?.pets && (preferences?.lifestyle_preferences?.pets === 'allergic' || currentPreferences?.lifestyle_preferences?.pets === 'allergic') ? 'Pet allergies may be a challenge to work around.' : ''} ${!arraysEqual(preferences?.housing_preference, currentPreferences?.housing_preference) ? `You have different housing preferences (${formatArrayWithLabels(preferences?.housing_preference)} vs ${formatArrayWithLabels(currentPreferences?.housing_preference)}).` : ''} These differences are worth exploring in depth.`}
            </Text>
          </View>

          {/* Personality Analysis */}
          <View style={{ marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="heart" size={20} color="#A08AB7" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginLeft: 8 }}>
                Personality & Interests
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20 }}>
              {compatibilityBreakdown.personality >= 75
                ? `You share great chemistry! ${profile.personality_type === currentProfile?.personality_type ? `You're both ${profile.personality_type} personalities.` : profile.personality_type && currentProfile?.personality_type ? `Your ${profile.personality_type} and ${currentProfile.personality_type} personalities complement each other well.` : ''} ${profile.love_language && currentProfile?.love_language ? `${formatArrayOrString(profile.love_language) === formatArrayOrString(currentProfile.love_language) ? `You both value ${formatArrayOrString(profile.love_language)}.` : 'Your different love languages can create balance.'}` : ''} You likely have engaging conversations and shared interests.`
                : compatibilityBreakdown.personality >= 60
                ? `You have some personality compatibility. ${profile.hobbies && currentProfile?.hobbies ? 'You share some hobbies and interests.' : ''} ${profile.personality_type && currentProfile?.personality_type && profile.personality_type !== currentProfile.personality_type ? `Your ${profile.personality_type} and ${currentProfile.personality_type} types can balance each other out.` : ''} Getting to know each other's communication styles will strengthen your connection.`
                : `Your personalities are quite different, which isn't necessarily bad! ${profile.personality_type && currentProfile?.personality_type ? `Your ${profile.personality_type} and ${currentProfile.personality_type} types approach things differently.` : ''} Opposites can complement each other well if you appreciate each other's unique traits and communication styles.`}
            </Text>
          </View>

          {/* Demographics Analysis */}
          <View style={{ marginBottom: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <MaterialCommunityIcons name="account-group" size={20} color="#EC4899" />
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginLeft: 8 }}>
                Background & Values
              </Text>
            </View>
            <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20 }}>
              {compatibilityBreakdown.demographics >= 75
                ? `You share similar backgrounds and values. ${profile.religion === currentProfile?.religion ? `You both identify as ${profile.religion}.` : ''} ${profile.political_views === currentProfile?.political_views ? `You align politically as ${profile.political_views}.` : ''} ${profile.education === currentProfile?.education ? 'You have similar educational backgrounds.' : ''} This common ground provides a strong foundation for understanding each other's perspectives.`
                : compatibilityBreakdown.demographics >= 60
                ? `You have some shared background elements. ${profile.religion !== currentProfile?.religion ? 'You have different religious backgrounds, which can bring diverse perspectives.' : ''} ${profile.political_views !== currentProfile?.political_views ? 'Your political views differ, but mutual respect is what matters most.' : ''} Your differences can be enriching if approached with open minds.`
                : `You come from different backgrounds, which can offer valuable perspectives. ${profile.religion && currentProfile?.religion && profile.religion !== currentProfile.religion ? `Your ${profile.religion} and ${currentProfile.religion} backgrounds may require extra communication about values.` : ''} ${profile.political_views && currentProfile?.political_views && profile.political_views !== currentProfile.political_views ? 'Your differing political views are worth discussing to ensure mutual respect.' : ''} Diversity can strengthen a partnership when handled thoughtfully.`}
            </Text>
          </View>
        </View>
      </MotiView>
    );
  };

  // Transform profile for DiscoveryProfileView
  const transformedProfile = {
    ...profile,
    languages_spoken: profile.languages || [],
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar barStyle={isDarkColorScheme ? "light-content" : "dark-content"} />

      {/* Back Button */}
      <TouchableOpacity
        style={[styles.floatingButton, { top: insets.top + 8, left: 16, backgroundColor: isDarkColorScheme ? 'rgba(30,30,32,0.9)' : 'rgba(255,255,255,0.9)' }]}
        onPress={() => router.back()}
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color={colors.foreground} />
      </TouchableOpacity>

      {/* Report/Block Menu */}
      <View style={[styles.floatingButton, { top: insets.top + 8, right: 16, backgroundColor: isDarkColorScheme ? 'rgba(30,30,32,0.9)' : 'rgba(255,255,255,0.9)' }]}>
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
        hideCompatibilityScore={true}
        isAdmin={isAdmin}
        renderAdditionalContent={renderWhyWeMatch}
      />

      {/* Fixed Action Buttons with Animations */}
      {!isMatched ? (
        <LinearGradient
          colors={isDarkColorScheme
            ? ['transparent', 'rgba(10,10,11,0.9)', colors.background]
            : ['transparent', 'rgba(255,255,255,0.9)', colors.background]}
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
                style={{ backgroundColor: colors.card, borderColor: colors.border }}
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
                style={isLiked ? { backgroundColor: '#22C55E' } : { backgroundColor: colors.card, borderColor: colors.border }}
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
            <Text className="text-xs text-gray-500 font-medium">Pass</Text>
            <Text className="text-xs text-purple-600 font-bold">Obsessed</Text>
            <Text className="text-xs text-gray-500 font-medium">Like</Text>
          </View>
        </LinearGradient>
      ) : (
        <LinearGradient
          colors={isDarkColorScheme
            ? ['transparent', 'rgba(10,10,11,0.9)', colors.background]
            : ['transparent', 'rgba(255,255,255,0.9)', colors.background]}
          className="absolute bottom-0 left-0 right-0 pt-8"
          style={{ paddingBottom: Math.max(insets.bottom, 32) }}
        >
          <View className="px-6 gap-3">
            {/* Photo Reveal Toggle - Only show if current user has photo blur enabled */}
            {currentProfile?.photo_blur_enabled && (
              <TouchableOpacity
                onPress={togglePhotoReveal}
                disabled={revealLoading}
                style={hasRevealedPhotos ? { backgroundColor: colors.card, borderColor: '#9333EA' } : { backgroundColor: isDarkColorScheme ? '#3B2A4D' : '#F3E8FF', borderColor: '#D8B4FE' }}
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
                        {hasRevealedPhotos ? 'Blur My Photos' : 'Reveal My Photos'}
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
                  color={otherUserRevealed ? "#10B981" : colors.mutedForeground}
                />
                <Text style={{ color: colors.mutedForeground }} className="text-xs">
                  {otherUserRevealed
                    ? `${profile.display_name} revealed their photos to you`
                    : `${profile.display_name}'s photos are blurred`}
                </Text>
              </View>
            )}

            {/* Send Message Button - Only show if we have a matchId */}
            {matchId ? (
              <TouchableOpacity
                onPress={() => router.push(`/chat/${matchId}`)}
                className="bg-purple-600 rounded-full py-4 shadow-xl"
              >
                <View className="flex-row items-center justify-center gap-2">
                  <MaterialCommunityIcons name="message-text" size={24} color="white" />
                  <Text className="text-white text-lg font-bold">Send Message</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <View style={{ backgroundColor: isDarkColorScheme ? '#2D2D30' : '#E5E7EB' }} className="rounded-full py-4">
                <View className="flex-row items-center justify-center gap-2">
                  <MaterialCommunityIcons name="eye" size={24} color={colors.mutedForeground} />
                  <Text style={{ color: colors.mutedForeground }} className="text-lg font-semibold">Viewing Profile</Text>
                </View>
              </View>
            )}
          </View>
        </LinearGradient>
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
