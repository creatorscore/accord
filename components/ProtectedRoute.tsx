import { useEffect, useState } from 'react';
import { useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { View, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [profileComplete, setProfileComplete] = useState(false);

  useEffect(() => {
    if (user) {
      checkProfileStatus();
    } else {
      setCheckingProfile(false);
    }
  }, [user]);

  const checkProfileStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('profile_complete, onboarding_step')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned, which is expected for new users
        console.error('Error checking profile:', error);
      }

      setProfileComplete(data?.profile_complete || false);
    } catch (error) {
      console.error('Error checking profile:', error);
    } finally {
      setCheckingProfile(false);
    }
  };

  useEffect(() => {
    if (loading || checkingProfile) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboardingGroup = segments[0] === '(onboarding)';
    const inTabsGroup = segments[0] === '(tabs)';

    // Use dynamic import and setTimeout to ensure navigation happens after render
    const navigate = async (path: string) => {
      const { router } = await import('expo-router');
      setTimeout(() => router.replace(path as any), 0);
    };

    if (!user && !inAuthGroup) {
      // Not authenticated -> redirect to auth
      navigate('/(auth)/welcome');
    } else if (user && inAuthGroup) {
      // Authenticated in auth screens -> redirect based on profile status
      if (profileComplete) {
        navigate('/(tabs)/discover');
      } else {
        navigate('/(onboarding)/basic-info');
      }
    } else if (user && !profileComplete && inTabsGroup) {
      // Authenticated but incomplete profile trying to access main app -> redirect to onboarding
      navigate('/(onboarding)/basic-info');
    } else if (user && profileComplete && inOnboardingGroup) {
      // Authenticated with complete profile in onboarding -> redirect to main app
      navigate('/(tabs)/discover');
    }
  }, [user, loading, checkingProfile, segments, profileComplete]);

  if (loading || checkingProfile) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#9B87CE" />
      </View>
    );
  }

  return <>{children}</>;
}
