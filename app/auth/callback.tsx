import { useEffect } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';

type ParsedLink = {
  access_token?: string;
  refresh_token?: string;
  token_hash?: string;
  type?: string;
  error?: string;
  error_description?: string;
};

function parseAuthLink(url: string): ParsedLink {
  const result: ParsedLink = {};
  try {
    // Pull both query and fragment, since Supabase uses either depending on flow.
    const queryIdx = url.indexOf('?');
    const fragIdx = url.indexOf('#');

    const collect = (segment: string) => {
      const params = new URLSearchParams(segment);
      for (const [k, v] of params.entries()) {
        if (v && !(k in result)) (result as any)[k] = v;
      }
    };

    if (queryIdx !== -1) {
      const end = fragIdx !== -1 && fragIdx > queryIdx ? fragIdx : url.length;
      collect(url.slice(queryIdx + 1, end));
    }
    if (fragIdx !== -1) {
      collect(url.slice(fragIdx + 1));
    }
  } catch (e) {
    console.warn('[auth/callback] parse error:', e);
  }
  return result;
}

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const handleUrl = async (url: string | null) => {
      if (!url || cancelled) return;
      console.log('[auth/callback] handling url:', url);

      const parsed = parseAuthLink(url);

      if (parsed.error) {
        console.error('[auth/callback] provider error:', parsed.error_description || parsed.error);
        router.replace('/(auth)/sign-in');
        return;
      }

      const isRecovery = parsed.type === 'recovery';

      // PKCE / token_hash flow (Supabase default for email links)
      if (parsed.token_hash && parsed.type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: parsed.token_hash,
          type: parsed.type as any,
        });
        if (error) {
          console.error('[auth/callback] verifyOtp error:', error);
          router.replace('/(auth)/sign-in');
          return;
        }
        if (isRecovery) {
          router.replace('/(auth)/reset-password');
        } else {
          await routeAfterAuth();
        }
        return;
      }

      // Implicit flow: tokens in fragment
      if (parsed.access_token) {
        const { error } = await supabase.auth.setSession({
          access_token: parsed.access_token,
          refresh_token: parsed.refresh_token || '',
        });
        if (error) {
          console.error('[auth/callback] setSession error:', error);
          router.replace('/(auth)/sign-in');
          return;
        }
        if (isRecovery) {
          router.replace('/(auth)/reset-password');
        } else {
          await routeAfterAuth();
        }
        return;
      }

      console.warn('[auth/callback] no tokens found in url');
      router.replace('/(auth)/sign-in');
    };

    const routeAfterAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/(auth)/sign-in');
        return;
      }
      const { data: profile } = await supabase
        .from('profiles')
        .select('profile_complete')
        .eq('user_id', user.id)
        .single();
      if (profile?.profile_complete) {
        router.replace('/(tabs)/discover');
      } else {
        router.replace('/(onboarding)/onboarding');
      }
    };

    Linking.getInitialURL().then(handleUrl);
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, [router]);

  return (
    <View className="flex-1 items-center justify-center bg-cream">
      <ActivityIndicator size="large" color="#A08AB7" />
      <Text className="text-gray-600 mt-4">Completing sign in...</Text>
    </View>
  );
}
