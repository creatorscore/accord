import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getDeviceFingerprint } from '@/lib/device-fingerprint';

export default function Index() {
  const { user, loading, signOut } = useAuth();
  const [checking, setChecking] = useState(true);
  const [profileComplete, setProfileComplete] = useState<boolean | null>(null);
  const [onboardingStep, setOnboardingStep] = useState<number>(0);
  const [isBanned, setIsBanned] = useState(false);

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

      // PERFORMANCE: Compute fingerprint once and run ban check + profile check in parallel
      // This saves 500-1000ms on low-end devices vs the old sequential approach
      const deviceId = await getDeviceFingerprint();

      const [banResult, profileResult] = await Promise.all([
        // Ban check (secondary safeguard)
        supabase.rpc('is_banned', {
          check_email: user.email?.toLowerCase(),
          check_device_id: deviceId,
        }).then(
          (res) => res,
          (banError: any) => {
            console.error('Error checking ban status:', banError);
            return { data: false }; // Continue if we can't check
          }
        ),

        // Profile check
        supabase
          .from('profiles')
          .select('profile_complete, onboarding_step, is_active')
          .eq('user_id', user.id)
          .single(),
      ]);

      // Fire-and-forget: update device_id in background (non-critical)
      supabase
        .from('profiles')
        .update({ device_id: deviceId })
        .eq('user_id', user.id)
        .then(() => {}, (err: any) => console.warn('⚠️ Failed to update device fingerprint:', err));

      // Handle ban check result
      if (banResult.data === true) {
        setIsBanned(true);
        await signOut();
        Alert.alert(
          'Account Restricted',
          'This account has been restricted from using Accord. If you believe this is an error, please contact support at hello@joinaccord.app.',
          [{ text: 'OK' }]
        );
        setChecking(false);
        return;
      }

      // Handle profile result
      const { data: profile, error } = profileResult;

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned (new user)
        console.error('Error checking profile:', error);
        setOnboardingStep(0);
        setProfileComplete(false);
        setChecking(false);
        return;
      }

      // Check if profile is deactivated (banned)
      if (profile?.is_active === false) {
        setIsBanned(true);
        await signOut();
        Alert.alert(
          'Account Restricted',
          'This account has been restricted from using Accord. If you believe this is an error, please contact support at hello@joinaccord.app.',
          [{ text: 'OK' }]
        );
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
  if (!user || isBanned) {
    return <Redirect href="/(auth)/welcome" />;
  }

  if (profileComplete === true) {
    return <Redirect href="/(tabs)/discover" />;
  }

  // Profile incomplete - redirect to appropriate onboarding step
  const onboardingRoutes = [
    '/(onboarding)/basic-info',           // step 0
    '/(onboarding)/photos',              // step 1
    '/(onboarding)/about',               // step 2
    '/(onboarding)/personality',         // step 3
    '/(onboarding)/interests',           // step 4
    '/(onboarding)/prompts',             // step 5
    '/(onboarding)/voice-intro',         // step 6
    '/(onboarding)/marriage-preferences', // step 7
    '/(onboarding)/matching-preferences', // step 8
  ];

  const targetRoute = onboardingRoutes[onboardingStep] || onboardingRoutes[0];
  return <Redirect href={targetRoute as any} />;
}
