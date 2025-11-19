import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Dimensions, StatusBar } from 'react-native';
import { useLocalSearchParams, router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { calculateCompatibilityScore, getCompatibilityBreakdown } from '@/lib/matching-algorithm';
import ProfilePhotoCarousel from '@/components/profile/ProfilePhotoCarousel';
import ProfileStoryCard from '@/components/profile/ProfileStoryCard';
import ProfileInteractiveSection from '@/components/profile/ProfileInteractiveSection';
import ProfileQuickFacts from '@/components/profile/ProfileQuickFacts';
import ProfileVoiceNote from '@/components/profile/ProfileVoiceNote';
import ModerationMenu from '@/components/moderation/ModerationMenu';
import ProfileReviewDisplay from '@/components/reviews/ProfileReviewDisplay';
import { useScreenCaptureProtection } from '@/hooks/useScreenCaptureProtection';
import { logScreenshotEvent } from '@/lib/screenshot-tracking';

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
  photos?: Photo[];
  prompt_answers?: PromptAnswer[];
  distance?: number;
  compatibility_score?: number;
  height_cm?: number;
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
  my_story?: string;
  religion?: string;
  political_views?: string;
}

interface Preferences {
  primary_reason?: string;
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
  const [matchId, setMatchId] = useState<string | null>(null);
  const [hasRevealedPhotos, setHasRevealedPhotos] = useState(false); // Current user revealed to profile
  const [otherUserRevealed, setOtherUserRevealed] = useState(false); // Profile revealed to current user
  const [revealLoading, setRevealLoading] = useState(false);

  // Screenshot tracking - log when someone screenshots this profile
  useScreenCaptureProtection(true, async () => {
    if (currentProfileId && id) {
      await logScreenshotEvent(currentProfileId, id, 'profile_view');
    }
  });

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
      // Check if there's an active match between current user and viewed profile
      const { data: match } = await supabase
        .from('matches')
        .select('id')
        .eq('status', 'active')
        .or(`and(profile1_id.eq.${currentProfileId},profile2_id.eq.${id}),and(profile1_id.eq.${id},profile2_id.eq.${currentProfileId})`)
        .single();

      if (match) {
        setIsMatched(true);
        setMatchId(match.id);
        checkPhotoRevealStatus();
      } else {
        // Not matched - redirect back
        setIsMatched(false);
        setMatchId(null);
        Alert.alert('Not Matched', 'You can only view full profiles of your matches.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    } catch (error: any) {
      // No match found - redirect back
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
          my_story,
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
        distance: Math.floor(Math.random() * 50) + 1,
        // Use real data from database (no more mocking)
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

        await supabase.from('matches').insert({
          profile1_id: profile1Id,
          profile2_id: profile2Id,
          initiated_by: currentProfileId,
          compatibility_score: profile?.compatibility_score || 0,
          status: 'active',
        });

        setTimeout(() => {
          Alert.alert('🎉 It\'s a Match!', `You matched with ${profile?.display_name}!`, [
            { text: 'Send Message', onPress: () => router.push(`/chat/${profile1Id}_${profile2Id}`) },
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

        await supabase.from('matches').insert({
          profile1_id: profile1Id,
          profile2_id: profile2Id,
          initiated_by: currentProfileId,
          compatibility_score: profile?.compatibility_score || 0,
          status: 'active',
        });

        setTimeout(() => {
          Alert.alert('🎉 It\'s a Match!', `You matched with ${profile?.display_name}!`, [
            { text: 'Send Message', onPress: () => router.push(`/chat/${profile1Id}_${profile2Id}`) },
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
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#9B87CE" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <Text className="text-gray-600">Profile not found</Text>
      </View>
    );
  }

  const photos = profile.photos || [];

  // Prepare quick facts
  const quickFacts = [];
  if (profile.height_cm) {
    const feet = Math.floor(profile.height_cm / 30.48);
    const inches = Math.round((profile.height_cm % 30.48) / 2.54);
    quickFacts.push({
      emoji: '📏',
      label: 'Height',
      value: `${feet}'${inches}"`,
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

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar barStyle="light-content" />

      {/* Back Button */}
      <TouchableOpacity
        className="absolute top-12 left-4 z-10 bg-white/90 rounded-full p-2 shadow-lg"
        onPress={() => router.back()}
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color="#374151" />
      </TouchableOpacity>

      {/* Report/Block Menu */}
      <View className="absolute top-12 right-4 z-10 bg-white/90 rounded-full shadow-lg">
        <ModerationMenu
          profileId={id}
          profileName={profile.display_name}
          matchId={matchId || undefined}
          currentProfileId={currentProfileId || undefined}
          onBlock={() => router.back()}
          onUnmatch={() => router.back()}
        />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Enhanced Photo Carousel */}
        <ProfilePhotoCarousel
          profileId={id}
          photos={photos}
          name={profile.display_name}
          age={profile.age}
          isVerified={profile.is_verified}
          distance={profile.distance}
          compatibilityScore={profile.compatibility_score}
          photoBlurEnabled={profile.photo_blur_enabled}
          isRevealed={otherUserRevealed}
        />

        {/* Location Intent Badges */}
        {preferences && (preferences.search_globally || (preferences.preferred_cities && preferences.preferred_cities.length > 0)) && (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', delay: 100 }}
            >
              {preferences.search_globally && (
                <View style={{
                  backgroundColor: '#EDE9FE',
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: '#C4B5FD',
                }}>
                  <MaterialCommunityIcons name="earth" size={20} color="#9B87CE" />
                  <Text style={{
                    color: '#9B87CE',
                    fontWeight: '600',
                    fontSize: 14,
                  }}>Open to matching anywhere</Text>
                </View>
              )}

              {preferences.preferred_cities && preferences.preferred_cities.length > 0 && (
                <View style={{
                  backgroundColor: '#DBEAFE',
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 16,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  borderWidth: 1,
                  borderColor: '#BFDBFE',
                }}>
                  <MaterialCommunityIcons name="map-marker-multiple" size={20} color="#2563EB" />
                  <Text style={{
                    color: '#2563EB',
                    fontWeight: '600',
                    fontSize: 14,
                    flex: 1,
                  }}>Looking in: {preferences.preferred_cities.join(', ')}</Text>
                </View>
              )}
            </MotiView>
          </View>
        )}

        {/* Quick Facts Carousel */}
        {quickFacts.length > 0 && (
          <ProfileQuickFacts facts={quickFacts} />
        )}

        {/* Voice Introduction */}
        {profile.voice_intro_url && (
          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <ProfileVoiceNote
              voiceUrl={profile.voice_intro_url}
              duration={profile.voice_intro_duration}
              profileName={profile.display_name}
            />
          </View>
        )}

        {/* Profile Content */}
        <View className="px-5 pb-32">
          {/* Story Introduction */}
          {profile.bio && (
            <ProfileStoryCard
              title="My Story"
              icon="book-open-variant"
              content={profile.bio}
              gradient={['#9B87CE', '#B8A9DD']}
              delay={100}
            />
          )}

          {/* My Full Story */}
          {profile.my_story && (
            <ProfileStoryCard
              title="What Brings Me Here"
              icon="heart-circle"
              content={profile.my_story}
              gradient={['#F59E0B', '#FBBF24']}
              delay={150}
            />
          )}

          {/* About Section - Comprehensive */}
          <ProfileInteractiveSection
            title="About Me"
            expandable={false}
            items={[
              ...(profile.occupation ? [{
                icon: 'briefcase',
                label: 'Career',
                value: profile.occupation,
                detail: 'Building my future'
              }] : []),
              ...(profile.education ? [{
                icon: 'school',
                label: 'Education',
                value: profile.education,
              }] : []),
              ...(profile.location_city ? [{
                icon: 'map-marker',
                label: 'Location',
                value: `${profile.location_city}${profile.location_state ? `, ${profile.location_state}` : ''}`,
              }] : []),
              ...(profile.gender ? [{
                icon: 'gender-transgender',
                label: 'Gender',
                value: formatArrayOrString(profile.gender),
              }] : []),
              ...(profile.sexual_orientation ? [{
                icon: 'heart',
                label: 'Orientation',
                value: formatArrayOrString(profile.sexual_orientation),
              }] : []),
              ...(profile.ethnicity ? [{
                icon: 'account-group',
                label: 'Ethnicity',
                value: formatArrayOrString(profile.ethnicity),
              }] : []),
              ...(profile.languages?.length ? [{
                icon: 'translate',
                label: 'Languages',
                value: profile.languages.join(', '),
              }] : []),
              ...(profile.religion ? [{
                icon: 'hands-pray',
                label: 'Religion',
                value: profile.religion,
              }] : []),
              ...(profile.political_views ? [{
                icon: 'vote',
                label: 'Political Views',
                value: profile.political_views,
              }] : []),
            ]}
          />

          {/* Prompt Answers as Story Cards */}
          {profile.prompt_answers && profile.prompt_answers.length > 0 && (
            <View>
              {profile.prompt_answers.map((pa, index) => (
                <ProfileStoryCard
                  key={index}
                  title={pa.prompt}
                  icon="comment-quote"
                  content={pa.answer}
                  gradient={
                    index % 3 === 0 ? ['#10B981', '#34D399'] :
                    index % 3 === 1 ? ['#F59E0B', '#FBBF24'] :
                    ['#3B82F6', '#60A5FA']
                  }
                  delay={200 + index * 100}
                />
              ))}
            </View>
          )}

          {/* Marriage Goals - Interactive Section */}
          {preferences && (
            <ProfileInteractiveSection
              title="Partnership Vision"
              items={[
                ...(preferences.primary_reason ? [{
                  emoji: '🎯',
                  label: 'Primary Goal',
                  value: formatLabel(preferences.primary_reason),
                  detail: 'What brings us together'
                }] : []),
                ...(preferences.relationship_type ? [{
                  emoji: '💑',
                  label: 'Relationship Style',
                  value: formatLabel(preferences.relationship_type),
                }] : []),
                ...(preferences.wants_children !== undefined ? [{
                  emoji: '👶',
                  label: 'Children',
                  value: preferences.wants_children === true ? 'Yes, definitely' :
                         preferences.wants_children === false ? 'No children' : 'Open to discussion',
                  detail: preferences.children_arrangement ? formatArrayWithLabels(preferences.children_arrangement) : undefined
                }] : []),
                ...(preferences.housing_preference ? [{
                  emoji: '🏠',
                  label: 'Living Arrangement',
                  value: formatArrayWithLabels(preferences.housing_preference),
                }] : []),
                ...(preferences.financial_arrangement ? [{
                  emoji: '💰',
                  label: 'Finances',
                  value: formatArrayWithLabels(preferences.financial_arrangement),
                }] : []),
                ...(preferences.willing_to_relocate ? [{
                  emoji: '✈️',
                  label: 'Relocation',
                  value: 'Open to relocating',
                }] : []),
                ...(preferences.public_relationship ? [{
                  emoji: '👨‍👩‍👧',
                  label: 'Public Appearance',
                  value: 'Comfortable appearing as a couple',
                }] : []),
              ]}
            />
          )}

          {/* Must-Haves */}
          {preferences?.must_haves && preferences.must_haves.length > 0 && (
            <View style={{ marginBottom: 20, backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#86EFAC' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 24, marginRight: 8 }}>✅</Text>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#166534' }}>Must-Haves</Text>
              </View>
              <Text style={{ fontSize: 14, color: '#16A34A', marginBottom: 12, fontStyle: 'italic' }}>
                Important qualities they're looking for
              </Text>
              {preferences.must_haves.map((item, index) => (
                <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                  <Text style={{ fontSize: 16, color: '#15803D', marginRight: 8 }}>•</Text>
                  <Text style={{ fontSize: 15, color: '#15803D', flex: 1, lineHeight: 22 }}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Dealbreakers */}
          {preferences?.dealbreakers && preferences.dealbreakers.length > 0 && (
            <View style={{ marginBottom: 20, backgroundColor: '#FEF2F2', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FCA5A5' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 24, marginRight: 8 }}>🚫</Text>
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#991B1B' }}>Dealbreakers</Text>
              </View>
              <Text style={{ fontSize: 14, color: '#DC2626', marginBottom: 12, fontStyle: 'italic' }}>
                Important boundaries to be aware of
              </Text>
              {preferences.dealbreakers.map((item, index) => (
                <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 }}>
                  <Text style={{ fontSize: 16, color: '#B91C1C', marginRight: 8 }}>•</Text>
                  <Text style={{ fontSize: 15, color: '#B91C1C', flex: 1, lineHeight: 22 }}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Hobbies Section */}
          {profile.hobbies && profile.hobbies.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: 12,
                paddingHorizontal: 4
              }}>Hobbies</Text>
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
              }}>
                {profile.hobbies.map((hobby, index) => (
                  <MotiView
                    key={index}
                    from={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', delay: index * 50 }}
                    style={{
                      backgroundColor: index % 3 === 0 ? '#DCFCE7' :
                                       index % 3 === 1 ? '#FFEDD5' : '#E0E7FF',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                    }}
                  >
                    <Text style={{
                      color: index % 3 === 0 ? '#16A34A' :
                             index % 3 === 1 ? '#EA580C' : '#6366F1',
                      fontWeight: '600',
                      fontSize: 14,
                    }}>{hobby}</Text>
                  </MotiView>
                ))}
              </View>
            </View>
          )}

          {/* Interests Section - Movies, Music, Books, TV Shows */}
          {profile.interests && typeof profile.interests === 'object' && (
            <>
              {/* Movies */}
              {profile.interests.movies && profile.interests.movies.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: '#111827',
                    marginBottom: 12,
                    paddingHorizontal: 4
                  }}>🎬 Favorite Movies</Text>
                  <View style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}>
                    {profile.interests.movies.map((movie, index) => (
                      <MotiView
                        key={index}
                        from={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', delay: index * 50 }}
                        style={{
                          backgroundColor: '#EDE9FE',
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 20,
                        }}
                      >
                        <Text style={{
                          color: '#9B87CE',
                          fontWeight: '600',
                          fontSize: 14,
                        }}>{movie}</Text>
                      </MotiView>
                    ))}
                  </View>
                </View>
              )}

              {/* Music */}
              {profile.interests.music && profile.interests.music.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: '#111827',
                    marginBottom: 12,
                    paddingHorizontal: 4
                  }}>🎵 Favorite Music</Text>
                  <View style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}>
                    {profile.interests.music.map((music, index) => (
                      <MotiView
                        key={index}
                        from={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', delay: index * 50 }}
                        style={{
                          backgroundColor: '#FEF3C7',
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 20,
                        }}
                      >
                        <Text style={{
                          color: '#F59E0B',
                          fontWeight: '600',
                          fontSize: 14,
                        }}>{music}</Text>
                      </MotiView>
                    ))}
                  </View>
                </View>
              )}

              {/* Books */}
              {profile.interests.books && profile.interests.books.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: '#111827',
                    marginBottom: 12,
                    paddingHorizontal: 4
                  }}>📚 Favorite Books</Text>
                  <View style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}>
                    {profile.interests.books.map((book, index) => (
                      <MotiView
                        key={index}
                        from={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', delay: index * 50 }}
                        style={{
                          backgroundColor: '#DBEAFE',
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 20,
                        }}
                      >
                        <Text style={{
                          color: '#3B82F6',
                          fontWeight: '600',
                          fontSize: 14,
                        }}>{book}</Text>
                      </MotiView>
                    ))}
                  </View>
                </View>
              )}

              {/* TV Shows */}
              {profile.interests.tv_shows && profile.interests.tv_shows.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: '#111827',
                    marginBottom: 12,
                    paddingHorizontal: 4
                  }}>📺 Favorite TV Shows</Text>
                  <View style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}>
                    {profile.interests.tv_shows.map((show, index) => (
                      <MotiView
                        key={index}
                        from={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', delay: index * 50 }}
                        style={{
                          backgroundColor: '#D1FAE5',
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 20,
                        }}
                      >
                        <Text style={{
                          color: '#059669',
                          fontWeight: '600',
                          fontSize: 14,
                        }}>{show}</Text>
                      </MotiView>
                    ))}
                  </View>
                </View>
              )}
            </>
          )}

          {/* Lifestyle - Interactive Section */}
          {preferences?.lifestyle_preferences && (
            preferences.lifestyle_preferences.smoking ||
            preferences.lifestyle_preferences.drinking ||
            preferences.lifestyle_preferences.pets
          ) && (
            <ProfileInteractiveSection
              title="Lifestyle & Values"
              items={[
                ...(preferences.lifestyle_preferences.smoking ? [{
                  emoji: '🚬',
                  label: 'Smoking',
                  value: formatLabel(preferences.lifestyle_preferences.smoking),
                }] : []),
                ...(preferences.lifestyle_preferences.drinking ? [{
                  emoji: '🍷',
                  label: 'Drinking',
                  value: formatLabel(preferences.lifestyle_preferences.drinking),
                }] : []),
                ...(preferences.lifestyle_preferences.pets ? [{
                  emoji: '🐾',
                  label: 'Pets',
                  value: formatLabel(preferences.lifestyle_preferences.pets),
                }] : []),
              ]}
            />
          )}

          {/* Matching Preferences Section */}
          {preferences && (
            <ProfileInteractiveSection
              title="Looking For"
              items={[
                ...(preferences.age_min && preferences.age_max ? [{
                  emoji: '🎯',
                  label: 'Age Range',
                  value: `${preferences.age_min}-${preferences.age_max} years old`,
                }] : []),
                ...(preferences.gender_preference && preferences.gender_preference.length > 0 ? [{
                  emoji: '💜',
                  label: 'Gender Preference',
                  value: preferences.gender_preference.join(', '),
                }] : []),
                ...(preferences.max_distance_miles ? [{
                  emoji: '📍',
                  label: 'Distance',
                  value: `Within ${preferences.max_distance_miles} miles`,
                }] : []),
              ]}
            />
          )}

          {/* Dealbreakers & Must-Haves */}
          {preferences && (preferences.dealbreakers?.length > 0 || preferences.must_haves?.length > 0) && (
            <View style={{ marginBottom: 16 }}>
              {preferences.dealbreakers && preferences.dealbreakers.length > 0 && (
                <>
                  <Text style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: '#111827',
                    marginBottom: 12,
                    paddingHorizontal: 4
                  }}>Dealbreakers</Text>
                  <View style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                    marginBottom: 16,
                  }}>
                    {preferences.dealbreakers.map((dealbreaker, index) => (
                      <MotiView
                        key={index}
                        from={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', delay: index * 50 }}
                        style={{
                          backgroundColor: '#FEE2E2',
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: '#FCA5A5',
                        }}
                      >
                        <Text style={{
                          color: '#DC2626',
                          fontWeight: '600',
                          fontSize: 14,
                        }}>❌ {dealbreaker}</Text>
                      </MotiView>
                    ))}
                  </View>
                </>
              )}

              {preferences.must_haves && preferences.must_haves.length > 0 && (
                <>
                  <Text style={{
                    fontSize: 20,
                    fontWeight: 'bold',
                    color: '#111827',
                    marginBottom: 12,
                    paddingHorizontal: 4
                  }}>Must-Haves</Text>
                  <View style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: 8,
                  }}>
                    {preferences.must_haves.map((mustHave, index) => (
                      <MotiView
                        key={index}
                        from={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', delay: index * 50 }}
                        style={{
                          backgroundColor: '#D1FAE5',
                          paddingHorizontal: 16,
                          paddingVertical: 8,
                          borderRadius: 20,
                          borderWidth: 1,
                          borderColor: '#6EE7B7',
                        }}
                      >
                        <Text style={{
                          color: '#059669',
                          fontWeight: '600',
                          fontSize: 14,
                        }}>✓ {mustHave}</Text>
                      </MotiView>
                    ))}
                  </View>
                </>
              )}
            </View>
          )}

          {/* Compatibility Breakdown */}
          {compatibilityBreakdown && compatibilityBreakdown.overall >= 0 && (
            <MotiView
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 500 }}
              style={{
                backgroundColor: 'white',
                borderRadius: 20,
                padding: 20,
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.08,
                shadowRadius: 8,
                elevation: 3,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                <MaterialCommunityIcons name="heart-multiple" size={24} color="#9B87CE" />
                <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#111827', marginLeft: 12 }}>
                  Why We Match
                </Text>
              </View>

              {/* Overall Score */}
              <View style={{ alignItems: 'center', marginBottom: 20, paddingVertical: 16, backgroundColor: '#F3E8FF', borderRadius: 12 }}>
                <Text style={{ fontSize: 48, fontWeight: 'bold', color: '#9B87CE' }}>
                  {Math.round(compatibilityBreakdown.overall)}%
                </Text>
                <Text style={{ fontSize: 16, color: '#6B7280', marginTop: 4 }}>
                  Overall Compatibility
                </Text>
              </View>

              {/* Breakdown Bars */}
              <View style={{ gap: 16 }}>
                <CompatibilityBar
                  label="Location & Distance"
                  score={compatibilityBreakdown.location}
                  icon="map-marker"
                  color="#10B981"
                />
                <CompatibilityBar
                  label="Marriage Goals & Vision"
                  score={compatibilityBreakdown.goals}
                  icon="target"
                  color="#3B82F6"
                />
                <CompatibilityBar
                  label="Lifestyle & Values"
                  score={compatibilityBreakdown.lifestyle}
                  icon="coffee"
                  color="#F59E0B"
                />
                <CompatibilityBar
                  label="Personality & Interests"
                  score={compatibilityBreakdown.personality}
                  icon="heart"
                  color="#8B5CF6"
                />
                <CompatibilityBar
                  label="Demographics & Background"
                  score={compatibilityBreakdown.demographics}
                  icon="account-group"
                  color="#EC4899"
                />
              </View>

              {/* Detailed Text Breakdown */}
              <View style={{ marginTop: 24, paddingTop: 24, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
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
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#10B981', marginLeft: 'auto' }}>
                      {Math.round(compatibilityBreakdown.location)}%
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
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#3B82F6', marginLeft: 'auto' }}>
                      {Math.round(compatibilityBreakdown.goals)}%
                    </Text>
                  </View>
                  <Text style={{ fontSize: 14, color: '#6B7280', lineHeight: 20 }}>
                    {compatibilityBreakdown.goals >= 80
                      ? `You're highly aligned on marriage goals! ${preferences?.primary_reason === currentPreferences?.primary_reason ? `You both seek this arrangement primarily for ${formatLabel(preferences.primary_reason || '')}.` : ''} ${preferences?.relationship_type === currentPreferences?.relationship_type ? `You both envision a ${formatLabel(preferences.relationship_type || '')} partnership.` : ''} ${preferences?.wants_children === currentPreferences?.wants_children ? (preferences.wants_children ? 'You both want children' : 'You both prefer not to have children') + ', making family planning straightforward.' : ''}`
                      : compatibilityBreakdown.goals >= 60
                      ? `You share common ground on key goals. ${preferences?.primary_reason === currentPreferences?.primary_reason ? `You both primarily seek ${formatLabel(preferences.primary_reason || '')}.` : 'Your primary reasons differ but may complement each other.'} ${preferences?.relationship_type && currentPreferences?.relationship_type ? `Your relationship style preferences (${formatLabel(preferences.relationship_type)} vs ${formatLabel(currentPreferences.relationship_type)}) could work with open communication.` : ''}`
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
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#F59E0B', marginLeft: 'auto' }}>
                      {Math.round(compatibilityBreakdown.lifestyle)}%
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
                    <MaterialCommunityIcons name="heart" size={20} color="#8B5CF6" />
                    <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', marginLeft: 8 }}>
                      Personality & Interests
                    </Text>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#8B5CF6', marginLeft: 'auto' }}>
                      {Math.round(compatibilityBreakdown.personality)}%
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
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#EC4899', marginLeft: 'auto' }}>
                      {Math.round(compatibilityBreakdown.demographics)}%
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
          )}

          {/* Reviews Section */}
          <ProfileReviewDisplay
            profileId={id}
            isMatched={isMatched}
            compact={false}
          />
        </View>
      </ScrollView>

      {/* Fixed Action Buttons with Animations */}
      {!isMatched ? (
        <LinearGradient
          colors={['transparent', 'rgba(255,255,255,0.9)', 'white']}
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
                className="bg-white rounded-full w-14 h-14 items-center justify-center shadow-xl border border-gray-200"
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
                  backgroundColor: isSuperLiked ? '#FBBF24' : '#9B87CE',
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
                className={`rounded-full w-14 h-14 items-center justify-center shadow-xl ${
                  isLiked ? 'bg-green-500' : 'bg-white border border-gray-200'
                }`}
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
          colors={['transparent', 'rgba(255,255,255,0.9)', 'white']}
          className="absolute bottom-0 left-0 right-0 pt-8"
          style={{ paddingBottom: Math.max(insets.bottom, 32) }}
        >
          <View className="px-6 gap-3">
            {/* Photo Reveal Toggle - Only show if current user has photo blur enabled */}
            {currentProfile?.photo_blur_enabled && (
              <TouchableOpacity
                onPress={togglePhotoReveal}
                disabled={revealLoading}
                className={`rounded-full py-3 shadow-lg border-2 ${
                  hasRevealedPhotos
                    ? 'bg-white border-purple-600'
                    : 'bg-purple-100 border-purple-300'
                }`}
              >
                <View className="flex-row items-center justify-center gap-2">
                  {revealLoading ? (
                    <ActivityIndicator size="small" color="#9B87CE" />
                  ) : (
                    <>
                      <MaterialCommunityIcons
                        name={hasRevealedPhotos ? "eye-off" : "eye"}
                        size={22}
                        color="#9B87CE"
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
                  color={otherUserRevealed ? "#10B981" : "#6B7280"}
                />
                <Text className="text-xs text-gray-600">
                  {otherUserRevealed
                    ? `${profile.display_name} revealed their photos to you`
                    : `${profile.display_name}'s photos are blurred`}
                </Text>
              </View>
            )}

            {/* Send Message Button */}
            <TouchableOpacity
              onPress={() => matchId && router.push(`/chat/${matchId}`)}
              className="bg-purple-600 rounded-full py-4 shadow-xl"
            >
              <View className="flex-row items-center justify-center gap-2">
                <MaterialCommunityIcons name="message-text" size={24} color="white" />
                <Text className="text-white text-lg font-bold">Send Message</Text>
              </View>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      )}
    </View>
  );
}
