import { useEffect, useState } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getDeviceFingerprint } from '@/lib/device-fingerprint';

export default function Index() {
  const { t } = useTranslation();
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
          t('auth.restricted.title'),
          t('auth.restricted.message'),
          [{ text: t('common.ok') }]
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
          t('auth.restricted.title'),
          t('auth.restricted.message'),
          [{ text: t('common.ok') }]
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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0A0A0B' }}>
        <ActivityIndicator size="large" color="#A08AB7" />
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
  // Each screen saves the step number AFTER completing. The route map points to the
  // NEXT screen the user should see when resuming with that saved step.
  // Flow: basic-info(1) → photos(3) → interests(5) → prompts(6)
  //       → voice-intro(7) → marriage-prefs(8) → matching-prefs(9) → notifications
  // Note: After basic-info, profile_complete=true so users CAN skip to discovery.
  // Remaining steps enhance their profile but aren't required.
  const onboardingRouteMap: Record<number, string> = {
    0: '/(onboarding)/welcome-info',         // Not started — show lavender marriage explanation
    1: '/(onboarding)/photos',               // basic-info done → next is photos
    2: '/(onboarding)/photos',               // legacy personality step → send to photos
    3: '/(onboarding)/interests',            // photos done → next is interests
    4: '/(onboarding)/interests',            // legacy step → fallback to interests
    5: '/(onboarding)/prompts',              // interests done → next is prompts
    6: '/(onboarding)/voice-intro',          // prompts done → next is voice-intro
    7: '/(onboarding)/marriage-preferences', // voice-intro done → next is marriage prefs
    8: '/(onboarding)/matching-preferences', // marriage-prefs done → next is matching-prefs
    9: '/(onboarding)/notifications',        // matching-prefs done → next is notifications
  };

  const targetRoute = onboardingRouteMap[onboardingStep] || onboardingRouteMap[0];
  return <Redirect href={targetRoute as any} />;
}
