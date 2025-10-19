import React, { useState, useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ImmersiveProfileCard from '@/components/matching/ImmersiveProfileCard';

export default function ProfilePreview() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [profile, setProfile] = useState<any>(null);
  const [preferences, setPreferences] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Extract param values to avoid object reference issues
  const profileDataParam = params.profileData as string | undefined;
  const isRealtimeParam = params.isRealtime as string | undefined;

  useEffect(() => {
    if (profileDataParam && isRealtimeParam === 'true') {
      // Use the passed data from edit screen (Live Preview)
      try {
        const data = JSON.parse(profileDataParam);

        console.log('📸 Preview received photos:', data.photos?.length, data.photos?.map(p => p.url.substring(0, 30)));

        // Extract preferences from the data
        const { preferences: prefs, ...profileData } = data;

        setProfile(profileData);
        setPreferences(prefs);
        setLoading(false);
      } catch (error) {
        console.error('Error parsing profile data:', error);
        loadCurrentUserProfile();
      }
    } else {
      // Load actual user profile from database
      loadCurrentUserProfile();
    }
  }, [profileDataParam, isRealtimeParam]);

  const loadCurrentUserProfile = async () => {
    try {
      // Load the COMPLETE profile with ALL fields that appear in discover view
      const { data, error } = await supabase
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
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      // Process photos - sort by display_order
      if (data.photos) {
        data.photos = data.photos.sort((a: any, b: any) =>
          (a.display_order || 0) - (b.display_order || 0)
        );
      }

      // Extract preferences from the result
      const { preferences: prefs, ...profileData } = data;

      // Get the first preference object (since it's an array from the query)
      const preferencesData = Array.isArray(prefs) ? prefs[0] : prefs;

      setProfile(profileData);
      setPreferences(preferencesData);
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
      setPreferences(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !profile) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text className="text-gray-600 mt-4 text-base">Loading preview...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ImmersiveProfileCard
        profile={profile}
        preferences={preferences}
        onClose={() => router.back()}
        visible={true}
        isMatched={true} // Hide swipe actions in preview mode
        onSendMessage={undefined} // Don't show "Send Message" button
      />

      {/* Preview Mode Indicator Overlay */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 60,
          left: 20,
          right: 20,
          alignItems: 'center',
          zIndex: 999,
        }}
      >
        <View
          style={{
            backgroundColor: 'rgba(139, 92, 246, 0.95)',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            shadowColor: '#8B5CF6',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
          }}
        >
          <Text style={{ color: 'white', fontSize: 14, fontWeight: '600' }}>
            {isRealtimeParam === 'true' ? '👁️ Live Preview' : '👁️ Profile Preview'}
          </Text>
        </View>
      </View>
    </View>
  );
}
