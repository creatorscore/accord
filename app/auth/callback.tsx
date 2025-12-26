import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function AuthCallback() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // The params will contain the OAuth tokens from the redirect
      const { access_token, refresh_token, type, error, error_description } = params;

      if (error) {
        console.error('OAuth error:', error_description || error);
        router.replace('/(auth)/sign-in');
        return;
      }

      // Check if this is a password recovery callback
      if (type === 'recovery' || type === 'magiclink') {
        console.log('Password recovery callback detected');

        if (access_token && typeof access_token === 'string') {
          // Set the session with the tokens from the password reset link
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: access_token,
            refresh_token: (refresh_token as string) || '',
          });

          if (sessionError) {
            console.error('Session error:', sessionError);
            router.replace('/(auth)/sign-in');
            return;
          }

          // Redirect to password reset screen
          router.replace('/(auth)/reset-password');
          return;
        }
      }

      if (access_token && typeof access_token === 'string') {
        // Set the session with the tokens from the OAuth callback
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: access_token,
          refresh_token: (refresh_token as string) || '',
        });

        if (sessionError) {
          console.error('Session error:', sessionError);
          router.replace('/(auth)/sign-in');
          return;
        }

        // Check if profile exists
        const { data: profile } = await supabase
          .from('profiles')
          .select('profile_complete')
          .eq('user_id', data.user?.id)
          .single();

        // Redirect based on profile completion
        if (profile?.profile_complete) {
          router.replace('/(tabs)/discover');
        } else {
          router.replace('/(onboarding)/basic-info');
        }
      } else {
        // No tokens found, redirect to sign in
        router.replace('/(auth)/sign-in');
      }
    } catch (error) {
      console.error('Callback handling error:', error);
      router.replace('/(auth)/sign-in');
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-cream">
      <ActivityIndicator size="large" color="#9B87CE" />
      <Text className="text-gray-600 mt-4">Completing sign in...</Text>
    </View>
  );
}
