import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function Index() {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);

  useEffect(() => {
    // Only check once when auth is ready
    if (!loading) {
      checkUserStatus();
    }
  }, [loading]);

  const checkUserStatus = async () => {
    try {
      if (!user) {
        setChecking(false);
        return;
      }

      // Check if profile is complete
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('profile_complete, onboarding_step')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (new user)
        console.error('Error checking profile:', error);
      }

      setProfileComplete(profile?.profile_complete || false);
    } catch (error) {
      console.error('Error in checkUserStatus:', error);
    } finally {
      setChecking(false);
    }
  };

  if (loading || checking) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFBEB' }}>
        <ActivityIndicator size="large" color="#A78BFA" />
      </View>
    );
  }

  // Redirect based on user and profile status
  if (!user) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (profileComplete === true) {
    return <Redirect href="/(tabs)/discover" />;
  }

  // Profile incomplete or new user
  return <Redirect href="/(onboarding)/basic-info" />;
}
