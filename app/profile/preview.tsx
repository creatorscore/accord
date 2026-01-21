import { useState, useEffect, useCallback } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/lib/useColorScheme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import DiscoveryProfileView from '@/components/matching/DiscoveryProfileView';

export default function ProfilePreview() {
  const { user } = useAuth();
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const [profile, setProfile] = useState<any | null>(null);
  const [preferences, setPreferences] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

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
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#A08AB7" />
        <Text style={{ color: colors.mutedForeground, marginTop: 16 }}>Loading preview...</Text>
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

  return (
    <View style={styles.container}>
      {/* Back Button */}
      <TouchableOpacity
        style={[styles.backButton, { top: insets.top + 8 }]}
        onPress={() => router.back()}
      >
        <MaterialCommunityIcons name="arrow-left" size={24} color="#000000" />
      </TouchableOpacity>

      <DiscoveryProfileView
        profile={profile}
        preferences={preferences}
        heightUnit={(profile?.height_unit as 'imperial' | 'metric') || 'imperial'}
        hideActions={true}
        isOwnProfile={true}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    position: 'absolute',
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
