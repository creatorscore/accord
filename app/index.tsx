import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

export default function Index() {
  const { user, loading } = useAuth();
  const [checking, setChecking] = useState(true);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<number>(0);

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
        // If there's an error, default to onboarding
        setOnboardingStep(0);
        setProfileComplete(false);
        setChecking(false);
        return;
      }

      // Store onboarding step for redirect
      setOnboardingStep(profile?.onboarding_step || 0);
      setProfileComplete(profile?.profile_complete || false);
    } catch (error) {
      console.error('Error in checkUserStatus:', error);
      // On error, send to onboarding
      setOnboardingStep(0);
      setProfileComplete(false);
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

  // Profile incomplete - redirect to appropriate onboarding step
  const onboardingRoutes = [
    '/(onboarding)/basic-info',      // step 0
    '/(onboarding)/photos',          // step 1
    '/(onboarding)/about',           // step 2
    '/(onboarding)/personality',     // step 3
    '/(onboarding)/interests',       // step 4
    '/(onboarding)/prompts',         // step 5
    '/(onboarding)/matching-preferences',  // step 6
    '/(onboarding)/marriage-preferences',  // step 7
    '/(onboarding)/voice-intro',     // step 8
  ];

  const targetRoute = onboardingRoutes[onboardingStep] || onboardingRoutes[0];
  return <Redirect href={targetRoute as any} />;
}
