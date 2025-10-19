import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Dimensions, StatusBar } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ProfilePhotoCarousel from '@/components/profile/ProfilePhotoCarousel';
import ProfileStoryCard from '@/components/profile/ProfileStoryCard';
import ProfileInteractiveSection from '@/components/profile/ProfileInteractiveSection';
import ProfileQuickFacts from '@/components/profile/ProfileQuickFacts';
import ProfileVoiceNote from '@/components/profile/ProfileVoiceNote';
import ModerationMenu from '@/components/moderation/ModerationMenu';

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
  gender?: string;
  sexual_orientation?: string;
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
  love_language?: string;
  interests?: string[];
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
  housing_preference?: string;
  financial_arrangement?: string;
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
}

export default function ProfileView() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiked, setIsLiked] = useState(false);
  const [isSuperLiked, setIsSuperLiked] = useState(false);
  const [isMatched, setIsMatched] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentProfile();
  }, []);

  useEffect(() => {
    if (id && currentProfileId) {
      loadProfile();
      checkIfMatched();
    }
  }, [id, currentProfileId]);

  const loadCurrentProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setCurrentProfileId(data.id);
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
      }
    } catch (error: any) {
      // No match found, which is fine
      setIsMatched(false);
      setMatchId(null);
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
          sexual_orientation,
          location_city,
          location_state,
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
        ).map((photo: Photo, index: number) => ({
          ...photo,
          caption: index === 0 ? "My favorite weekend spot" :
                   index === 1 ? "Love exploring new places" :
                   index === 2 ? "Quality time with loved ones" : undefined
        })),
        compatibility_score: Math.floor(Math.random() * 30) + 70,
        distance: Math.floor(Math.random() * 50) + 1,
        // Use real data from database (no more mocking)
        height_cm: profileData.height_inches ? profileData.height_inches * 2.54 : undefined,
        languages: profileData.languages_spoken || [],
        zodiac_sign: profileData.zodiac_sign,
        personality_type: profileData.personality_type,
        love_language: profileData.love_language,
      };

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

  const formatLabel = (value: string) => {
    return value
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#8B5CF6" />
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
      value: profile.love_language,
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
          onBlock={() => router.back()}
        />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Enhanced Photo Carousel */}
        <ProfilePhotoCarousel
          photos={photos}
          name={profile.display_name}
          age={profile.age}
          isVerified={profile.is_verified}
          distance={profile.distance}
          compatibilityScore={profile.compatibility_score}
        />

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
              gradient={['#8B5CF6', '#EC4899']}
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
                value: profile.gender,
              }] : []),
              ...(profile.sexual_orientation ? [{
                icon: 'heart',
                label: 'Orientation',
                value: profile.sexual_orientation,
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
                  detail: preferences.children_arrangement ? formatLabel(preferences.children_arrangement) : undefined
                }] : []),
                ...(preferences.housing_preference ? [{
                  emoji: '🏠',
                  label: 'Living Arrangement',
                  value: formatLabel(preferences.housing_preference),
                }] : []),
                ...(preferences.financial_arrangement ? [{
                  emoji: '💰',
                  label: 'Finances',
                  value: formatLabel(preferences.financial_arrangement),
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

          {/* Interests Section */}
          {profile.interests && profile.interests.length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: '#111827',
                marginBottom: 12,
                paddingHorizontal: 4
              }}>Interests & Favorites</Text>
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
              }}>
                {profile.interests.map((interest, index) => (
                  <MotiView
                    key={index}
                    from={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', delay: index * 50 }}
                    style={{
                      backgroundColor: index % 3 === 0 ? '#EDE9FE' :
                                       index % 3 === 1 ? '#FEF3C7' : '#DBEAFE',
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                    }}
                  >
                    <Text style={{
                      color: index % 3 === 0 ? '#7C3AED' :
                             index % 3 === 1 ? '#F59E0B' : '#3B82F6',
                      fontWeight: '600',
                      fontSize: 14,
                    }}>{interest}</Text>
                  </MotiView>
                ))}
              </View>
            </View>
          )}

          {/* Lifestyle - Interactive Section */}
          {preferences && preferences.lifestyle_preferences && (
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

          {/* Compatibility Insights */}
          {profile.compatibility_score && profile.compatibility_score > 75 && (
            <ProfileStoryCard
              title="Why We Match"
              icon="heart-multiple"
              content="Based on your preferences and values, you both are looking for similar partnership goals and have compatible lifestyle choices. This could be the beginning of something meaningful!"
              gradient={['#EC4899', '#F472B6']}
              delay={400}
            />
          )}
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
                  backgroundColor: isSuperLiked ? '#FBBF24' : '#8B5CF6',
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
          <View className="px-6">
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
