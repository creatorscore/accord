import { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, Alert, Modal } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

const DAILY_SWIPE_LIMIT = 10; // Free users get 10 swipes per day

export default function Discover() {
  const { user } = useAuth();
  const { isPremium, isPlatinum } = useSubscription();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string | null>(null);
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
    genderPreference: [],
    relationshipType: [],
    wantsChildren: null,
    religion: [],
    politicalViews: [],
    financialArrangement: [],
  });
  const [lastSwipe, setLastSwipe] = useState<{
    profile: Profile;
    action: 'like' | 'pass' | 'super_like';
    index: number;
  } | null>(null);
  const [showBoostModal, setShowBoostModal] = useState(false);

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
    if (currentProfileId) {
      loadProfiles();
    }
  }, [currentProfileId]);

  const [currentUserName, setCurrentUserName] = useState<string>('');

  const loadCurrentProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          photos (
            url,
            is_primary,
            display_order
          )
        `)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setCurrentProfileId(data.id);
      setCurrentUserName(data.display_name);

      // Get primary photo or first photo
      const photos = data.photos?.sort((a: any, b: any) => a.display_order - b.display_order);
      const primaryPhoto = photos?.find((p: any) => p.is_primary) || photos?.[0];
      setCurrentUserPhoto(primaryPhoto?.url || null);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load your profile');
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

    // Free users have daily limit
    if (swipeCount >= DAILY_SWIPE_LIMIT) {
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
      // 2. Haven't been swiped on yet
      // 3. Match basic preferences
      const { data: alreadySwipedLikes } = await supabase
        .from('likes')
        .select('liked_profile_id')
        .eq('liker_profile_id', currentProfileId);

      const { data: alreadySwipedPasses } = await supabase
        .from('passes')
        .select('passed_profile_id')
        .eq('passer_profile_id', currentProfileId);

      const swipedIds = [
        ...(alreadySwipedLikes?.map(l => l.liked_profile_id) || []),
        ...(alreadySwipedPasses?.map(p => p.passed_profile_id) || [])
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

      // Apply basic filters (always available)
      query = query.gte('age', filters.ageMin).lte('age', filters.ageMax);

      // Apply premium filters (only if user is premium AND filters are set)
      if (isPremium) {
        // Gender preference filter
        if (filters.genderPreference.length > 0) {
          query = query.in('gender', filters.genderPreference);
        }

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
          // Apply client-side filters for premium users

          // Distance filter (always check)
          if (profile.distance !== null && profile.distance > filters.maxDistance) {
            return false;
          }

          // Premium-only filters
          if (isPremium) {
            // Relationship type filter
            if (filters.relationshipType.length > 0 && profile.preferences?.relationship_type) {
              if (!filters.relationshipType.includes(profile.preferences.relationship_type)) {
                return false;
              }
            }

            // Children preference filter
            if (filters.wantsChildren !== null && profile.preferences?.wants_children !== undefined) {
              if (filters.wantsChildren !== profile.preferences.wants_children) {
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

      // Sort profiles: boosted profiles first, then by compatibility score
      const sortedProfiles = transformedProfiles.sort((a, b) => {
        const aIsBoosted = boostedProfileIds.has(a.id);
        const bIsBoosted = boostedProfileIds.has(b.id);

        // Boosted profiles come first
        if (aIsBoosted && !bIsBoosted) return -1;
        if (!aIsBoosted && bIsBoosted) return 1;

        // Otherwise sort by compatibility score
        return (b.compatibility_score || 0) - (a.compatibility_score || 0);
      });

      console.log('✅ Setting profiles:', sortedProfiles.length);
      console.log('🚀 Boosted profiles:', boostedProfileIds.size);
      setProfiles(sortedProfiles);
      setCurrentIndex(0);
    } catch (error: any) {
      console.error('❌ Error loading profiles:', error);
      Alert.alert('Error', error.message || 'Failed to load profiles');
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
        console.log('💑 Creating match...');
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
          throw matchError;
        }

        console.log('✅ Match created:', matchData?.id);
      } else {
        console.log('ℹ️ Match already exists:', existingMatch.id);
      }

      // Send like notification to the other user
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
          { text: 'Cancel', style: 'cancel' },
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
      Alert.alert('Error', 'Failed to send super like. Please try again.');
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
          { text: 'Cancel', style: 'cancel' },
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
      Alert.alert('Error', 'Failed to undo swipe. Please try again.');
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

  const handleCloseMatchModal = () => {
    setShowMatchModal(false);
    setMatchedProfile(null);
    setMatchId(null);
  };

  const handleSendMessage = () => {
    setShowMatchModal(false);
    // TODO: Navigate to chat screen with matchId
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
          text: 'Cancel',
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
              Alert.alert('Error', 'Failed to block user. Please try again.');
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
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Submit',
          onPress: async (reason) => {
            if (!reason || reason.trim() === '') {
              Alert.alert('Error', 'Please provide a reason for reporting.');
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
              Alert.alert('Error', 'Failed to submit report. Please try again.');
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
        <Text className="text-gray-600 mt-4">Finding your matches...</Text>
      </View>
    );
  }

  // Empty state - no more profiles
  if (currentIndex >= profiles.length) {
    console.log('📭 Empty state:', { currentIndex, profilesLength: profiles.length });
    return (
      <View className="flex-1 bg-cream">
        {/* Header */}
        <View className="bg-primary-500 pt-16 pb-8 px-6">
          <Text className="text-5xl mb-2">💜</Text>
          <Text className="text-4xl font-bold text-white mb-2">
            Find Your Match
          </Text>
          <Text className="text-white/90 text-lg">
            Swipe to discover your perfect arrangement
          </Text>
        </View>

        {/* Empty State */}
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-6xl mb-6">✨</Text>
          <Text className="text-2xl font-bold text-charcoal mb-3 text-center">
            You're all caught up!
          </Text>
          <Text className="text-gray-600 mb-8 text-center text-lg">
            We're looking for more compatible matches for you. Check back soon!
          </Text>

          <TouchableOpacity
            className="bg-primary-500 rounded-full py-4 px-8 shadow-lg"
            onPress={handleRefresh}
          >
            <Text className="text-white font-bold text-lg">Refresh</Text>
          </TouchableOpacity>
        </View>
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
      <View className="bg-primary-500 pt-16 pb-4 px-6">
        <View className="flex-row justify-between items-center">
          <View className="flex-1">
            <Text className="text-4xl font-bold text-white mb-1">
              Discover
            </Text>
            <Text className="text-white/90 text-base">
              {profiles.length - currentIndex} {profiles.length - currentIndex === 1 ? 'profile' : 'profiles'} to explore
            </Text>
          </View>
          <View className="flex-row gap-2">
            {!isPremium && (
              <TouchableOpacity
                className="bg-gold-500 rounded-full px-4 py-2 flex-row items-center gap-1.5"
                style={{ backgroundColor: '#FFD700' }}
                onPress={() => setShowPaywall(true)}
              >
                <MaterialCommunityIcons name="crown" size={18} color="#8B5CF6" />
                <Text className="text-primary-600 font-bold text-sm">Upgrade</Text>
              </TouchableOpacity>
            )}
            {isPlatinum && (
              <TouchableOpacity
                className="rounded-full p-3"
                style={{ backgroundColor: 'rgba(255, 215, 0, 0.3)' }}
                onPress={() => setShowBoostModal(true)}
              >
                <MaterialCommunityIcons name="rocket" size={24} color="#FFD700" />
              </TouchableOpacity>
            )}
            <TouchableOpacity
              className="bg-white/20 rounded-full p-3"
              onPress={() => setShowFilterModal(true)}
            >
              <MaterialCommunityIcons name="filter-variant" size={24} color="white" />
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-white/20 rounded-full p-3"
              onPress={handleRefresh}
            >
              <MaterialCommunityIcons name="refresh" size={24} color="white" />
            </TouchableOpacity>
          </View>
        </View>
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

      {/* Premium Paywall */}
      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        variant="premium"
        feature="unlimited_swipes"
      />

      {/* Swipe Counter for Free Users */}
      {!isPremium && (
        <View className="absolute bottom-32 right-6 bg-white rounded-full px-4 py-2 shadow-lg border-2 border-primary-500">
          <Text className="text-primary-600 font-bold text-sm">
            {swipeCount}/{DAILY_SWIPE_LIMIT} swipes
          </Text>
        </View>
      )}

      {/* Super Like Counter for Premium Users */}
      {isPremium && (
        <View className="absolute bottom-32 right-6 bg-white rounded-full px-4 py-2 shadow-lg border-2 border-primary-500">
          <View className="flex-row items-center gap-1">
            <MaterialCommunityIcons name="star" size={16} color="#8B5CF6" />
            <Text className="text-primary-600 font-bold text-sm">
              {superLikesRemaining}/5
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}
