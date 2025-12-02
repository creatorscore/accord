import { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import ImmersiveProfileCard from '@/components/matching/ImmersiveProfileCard';

export default function ProfilePreview() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const [profile, setProfile] = useState<any | null>(null);
  const [preferences, setPreferences] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [cardVisible, setCardVisible] = useState(true);

  const profileDataParam = params.profileData as string | undefined;
  const isRealtimeParam = params.isRealtime as string | undefined;

  useEffect(() => {
    if (profileDataParam && isRealtimeParam === 'true') {
      try {
        const data = JSON.parse(profileDataParam);
        const { preferences: prefs, ...profileData } = data;
        setProfile(profileData);
        // Handle preferences as array or object
        setPreferences(Array.isArray(prefs) ? prefs[0] : prefs);
        setLoading(false);
      } catch (error) {
        console.error('Error parsing profile data:', error);
        loadCurrentUserProfile();
      }
    } else {
      loadCurrentUserProfile();
    }
  }, [profileDataParam, isRealtimeParam]);

  // Always refresh profile from database when screen comes into focus
  // This ensures verification status and other data is always up to date
  useFocusEffect(
    useCallback(() => {
      loadCurrentUserProfile();
    }, [user?.id])
  );

  const loadCurrentUserProfile = async () => {
    try {
      const { data: profileData, error: profileError } = await supabase
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

      if (profileError) throw profileError;

      // Extract preferences from the joined query
      const { preferences: prefsData, ...restProfileData } = profileData;

      const transformedProfile = {
        ...restProfileData,
        photos: profileData.photos?.sort((a: any, b: any) =>
          (a.display_order || 0) - (b.display_order || 0)
        ),
        languages_spoken: profileData.languages_spoken || [],
      };

      setProfile(transformedProfile);
      // Supabase returns preferences as an array when using joined queries, extract first element
      setPreferences(Array.isArray(prefsData) ? prefsData[0] : prefsData);
    } catch (error: any) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#A08AB7" />
        <Text style={{ color: '#6B7280', marginTop: 16 }}>Loading preview...</Text>
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={{ flex: 1, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: '#6B7280' }}>Profile not found</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ImmersiveProfileCard
        profile={profile}
        preferences={preferences}
        visible={cardVisible}
        onClose={() => router.back()}
        isMatched={true}
        heightUnit={profile?.height_unit || 'imperial'}
        // No swipe actions or send message button for profile preview
      />
    </View>
  );
}
