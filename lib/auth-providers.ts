import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Get Google Client ID from app config
const getGoogleClientId = () => {
  return Constants.expoConfig?.extra?.googleIosClientId || '';
};

// Important: This is needed for the OAuth flow to work properly (mobile only)
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

// Create a proper redirect URL for OAuth
const createRedirectUrl = () => {
  // Always use the accord:// scheme for standalone builds
  // This works for both development and production builds
  const url = Linking.createURL('/auth/callback', {
    scheme: 'accord'
  });

  console.log('Generated redirect URL:', url);
  return url;
};

// Helper to extract params from OAuth redirect URL
function extractParamsFromUrl(url: string) {
  const parsedUrl = new URL(url);
  const hash = parsedUrl.hash.substring(1); // Remove the leading '#'
  const params = new URLSearchParams(hash);

  return {
    access_token: params.get('access_token'),
    expires_in: parseInt(params.get('expires_in') || '0'),
    refresh_token: params.get('refresh_token'),
    token_type: params.get('token_type'),
    provider_token: params.get('provider_token'),
  };
}

// Google Sign-In with Supabase OAuth (following official Supabase Expo docs)
export const signInWithGoogle = async () => {
  try {
    // For web, use a simpler redirect flow
    if (Platform.OS === 'web') {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });

      if (error) throw error;
      return data;
    }

    // For mobile, use the accord:// scheme as redirect
    const redirectUrl = 'accord://google-auth';
    console.log('Using redirect URL:', redirectUrl);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;

    const googleOAuthUrl = data.url;
    if (!googleOAuthUrl) {
      console.error('No OAuth URL found!');
      return null;
    }

    // Open the OAuth URL in the browser
    const result = await WebBrowser.openAuthSessionAsync(
      googleOAuthUrl,
      redirectUrl,
      { showInRecents: true }
    );

    console.log('OAuth result:', result);

    if (result && result.type === 'success') {
      const params = extractParamsFromUrl(result.url);
      console.log('Extracted params:', params);

      if (params.access_token && params.refresh_token) {
        const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
          access_token: params.access_token,
          refresh_token: params.refresh_token,
        });

        if (sessionError) throw sessionError;
        return sessionData;
      } else {
        console.error('No access token or refresh token in response');
        return null;
      }
    } else if (result.type === 'cancel') {
      throw new Error('User cancelled');
    }

    return null;
  } catch (error: any) {
    console.error('Google sign-in error:', error);
    throw error;
  }
};

// Apple Sign-In
export const signInWithApple = async () => {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    // Sign in with Supabase using Apple identity token
    if (credential.identityToken) {
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: credential.nonce, // Pass nonce for security
      });

      if (error) throw error;
      return data;
    } else {
      throw new Error('No identityToken returned from Apple');
    }
  } catch (error: any) {
    if (error.code === 'ERR_REQUEST_CANCELED') {
      // User canceled the sign-in flow
      return null;
    }
    console.error('Apple sign-in error:', error);
    throw error;
  }
};

// Check if Apple Sign-In is available (iOS only)
export const isAppleAuthAvailable = async (): Promise<boolean> => {
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
};
