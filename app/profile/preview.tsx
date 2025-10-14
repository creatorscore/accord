import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import ProfilePhotoCarousel from '@/components/profile/ProfilePhotoCarousel';
import ProfileStoryCard from '@/components/profile/ProfileStoryCard';
import ProfileInteractiveSection from '@/components/profile/ProfileInteractiveSection';
import ProfileQuickFacts from '@/components/profile/ProfileQuickFacts';
import ProfileVoiceNote from '@/components/profile/ProfileVoiceNote';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfilePreview() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.profileData && params.isRealtime === 'true') {
      // Use the passed data from edit screen
      try {
        const data = JSON.parse(params.profileData as string);
        // Add mock captions to photos if not present
        if (data.photos) {
          data.photos = data.photos.map((photo: any, index: number) => ({
            ...photo,
            caption: photo.caption || (
              index === 0 ? "My favorite moment" :
              index === 1 ? "Living my truth" :
              index === 2 ? "Adventure awaits" : "Good times"
            )
          }));
        }
        setProfile(data);
        setLoading(false);
      } catch (error) {
        console.error('Error parsing profile data:', error);
        loadCurrentUserProfile();
      }
    } else {
      // Load actual user profile from database
      loadCurrentUserProfile();
    }
  }, [params]);

  const loadCurrentUserProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          age,
          bio,
          occupation,
          education,
          location_city,
          location_state,
          gender,
          sexual_orientation,
          is_verified,
          prompt_answers,
          interests,
          voice_intro_url,
          voice_intro_duration,
          photos (
            url,
            is_primary,
            display_order
          )
        `)
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      // Process photos
      if (data.photos) {
        data.photos = data.photos.sort((a: any, b: any) =>
          (a.display_order || 0) - (b.display_order || 0)
        ).map((photo: any, index: number) => ({
          ...photo,
          caption: index === 0 ? "My favorite moment" :
                   index === 1 ? "Living my truth" :
                   index === 2 ? "Adventure awaits" : "Good times"
        }));
      }

      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
      // Set a default profile
      setProfile({
        display_name: "Your Name",
        age: 25,
        bio: "Your story will appear here...",
        photos: [],
        prompt_answers: [],
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !profile) {
    return (
      <View className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="text-gray-600 mt-4">Loading preview...</Text>
      </View>
    );
  }

  // Prepare quick facts
  const quickFacts = [];
  if (profile.occupation) {
    quickFacts.push({
      emoji: '💼',
      label: 'Work',
      value: profile.occupation,
    });
  }
  if (profile.location_city) {
    quickFacts.push({
      emoji: '📍',
      label: 'Location',
      value: profile.location_city,
    });
  }
  if (profile.education) {
    quickFacts.push({
      emoji: '🎓',
      label: 'Education',
      value: profile.education,
    });
  }
  if (profile.gender) {
    quickFacts.push({
      emoji: '⚧',
      label: 'Gender',
      value: profile.gender,
    });
  }
  if (profile.sexual_orientation) {
    quickFacts.push({
      emoji: '🏳️‍🌈',
      label: 'Orientation',
      value: profile.sexual_orientation,
    });
  }

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View className="absolute top-12 left-0 right-0 z-10 flex-row justify-between px-4">
        <TouchableOpacity
          className="bg-white/90 rounded-full p-2 shadow-lg"
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#374151" />
        </TouchableOpacity>

        <View className="flex-row gap-2">
          {params.isRealtime !== 'true' && (
            <TouchableOpacity
              className="bg-white/90 rounded-full p-2 shadow-lg"
              onPress={loadCurrentUserProfile}
            >
              <MaterialCommunityIcons name="refresh" size={24} color="#8B5CF6" />
            </TouchableOpacity>
          )}

          <View className="bg-gradient-to-r from-purple-500 to-pink-500 px-4 py-2 rounded-full flex-row items-center">
            <MaterialCommunityIcons name="eye" size={16} color="white" />
            <Text className="text-white font-semibold ml-1">Preview</Text>
          </View>
        </View>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Enhanced Photo Carousel */}
        {profile.photos && profile.photos.length > 0 ? (
          <ProfilePhotoCarousel
            photos={profile.photos}
            name={profile.display_name}
            age={profile.age}
            isVerified={profile.is_verified}
          />
        ) : (
          <LinearGradient
            colors={['#8B5CF6', '#EC4899']}
            style={{ height: 520, justifyContent: 'center', alignItems: 'center' }}
          >
            <View className="bg-white/20 rounded-full p-8 mb-4">
              <MaterialCommunityIcons name="camera-off" size={48} color="white" />
            </View>
            <Text className="text-white text-xl font-bold mb-2">
              {profile.display_name}, {profile.age}
            </Text>
            <Text className="text-white/80">No photos yet</Text>
          </LinearGradient>
        )}

        {/* Quick Facts */}
        {quickFacts.length > 0 && (
          <ProfileQuickFacts facts={quickFacts} />
        )}

        {/* Voice Introduction */}
        {profile.voice_intro_url && (
          <View className="px-5 mt-4">
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

          {/* Interests Section */}
          {profile.interests && profile.interests.length > 0 && (
            <View className="mb-4">
              <Text className="text-xl font-bold text-gray-900 mb-3">Interests & Hobbies</Text>
              <View className="flex-row flex-wrap gap-2">
                {profile.interests.map((interest: string, index: number) => (
                  <MotiView
                    key={index}
                    from={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', delay: index * 50 }}
                    className={`px-4 py-2 rounded-full ${
                      index % 3 === 0 ? 'bg-purple-100' :
                      index % 3 === 1 ? 'bg-yellow-100' : 'bg-blue-100'
                    }`}
                  >
                    <Text className={`font-semibold ${
                      index % 3 === 0 ? 'text-purple-700' :
                      index % 3 === 1 ? 'text-yellow-700' : 'text-blue-700'
                    }`}>{interest}</Text>
                  </MotiView>
                ))}
              </View>
            </View>
          )}

          {/* About Section */}
          {(profile.occupation || profile.education || profile.location_city || profile.gender || profile.sexual_orientation) && (
            <ProfileInteractiveSection
              title="About Me"
              expandable={false}
              items={[
                ...(profile.occupation ? [{
                  icon: 'briefcase',
                  label: 'Career',
                  value: profile.occupation,
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
              ]}
            />
          )}

          {/* Prompt Answers */}
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

          {/* Preview Notice */}
          <View className="mt-8 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl border border-purple-200">
            <View className="flex-row items-center justify-center mb-2">
              <MaterialCommunityIcons name="eye" size={20} color="#8B5CF6" />
              <Text className="text-purple-700 font-semibold text-center ml-2">
                Live Preview Mode
              </Text>
            </View>
            <Text className="text-purple-600 text-center text-sm">
              {params.isRealtime === 'true'
                ? "This preview updates as you edit. Save your changes when done."
                : "This is how your profile currently appears to others."}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons with Animation */}
      <LinearGradient
        colors={['transparent', 'rgba(255,255,255,0.9)', 'white']}
        className="absolute bottom-0 left-0 right-0 pb-8 pt-8"
      >
        <View className="flex-row justify-center items-center gap-4 px-6">
          <MotiView
            from={{ scale: 0, rotate: '-180deg' }}
            animate={{ scale: 1, rotate: '0deg' }}
            transition={{ type: 'spring', delay: 100 }}
          >
            <View className="bg-white/80 rounded-full w-14 h-14 items-center justify-center shadow-xl border border-gray-200">
              <MaterialCommunityIcons name="close" size={28} color="#EF4444" />
            </View>
          </MotiView>

          <MotiView
            from={{ scale: 0 }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ type: 'timing', duration: 2000, loop: true }}
          >
            <LinearGradient
              colors={['#8B5CF6', '#EC4899']}
              className="rounded-full w-20 h-20 items-center justify-center shadow-xl"
            >
              <MaterialCommunityIcons name="star" size={36} color="white" />
            </LinearGradient>
          </MotiView>

          <MotiView
            from={{ scale: 0, rotate: '180deg' }}
            animate={{ scale: 1, rotate: '0deg' }}
            transition={{ type: 'spring', delay: 200 }}
          >
            <View className="bg-white/80 rounded-full w-14 h-14 items-center justify-center shadow-xl border border-gray-200">
              <MaterialCommunityIcons name="heart" size={28} color="#10B981" />
            </View>
          </MotiView>
        </View>

        <Text className="text-center text-gray-500 text-xs mt-3 font-medium">
          This is how others will interact with your profile
        </Text>
      </LinearGradient>
    </View>
  );
}