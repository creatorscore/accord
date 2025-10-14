import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Important: This is needed for the OAuth flow to work properly (mobile only)
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

// Create a proper redirect URL for OAuth
const createRedirectUrl = () => {
  // For development with Expo Go, use exp:// scheme
  // For production builds, use custom accord:// scheme
  const isDevelopment = __DEV__;

  if (isDevelopment) {
    // Expo Go uses exp://[IP]/--/
    return Linking.createURL('/auth/callback');
  }

  // Production uses custom scheme
  return Linking.createURL('/auth/callback', {
    scheme: 'accord'
  });
};

// Google Sign-In with Supabase OAuth
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

      // The browser will handle the redirect automatically
      return data;
    }

    // For mobile, use the WebBrowser flow
    const redirectUrl = createRedirectUrl();
    console.log('Redirect URL:', redirectUrl);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        skipBrowserRedirect: true,
      },
    });

    if (error) throw error;

    // Open the OAuth URL in the browser
    if (data.url) {
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl
      );

      if (result.type === 'success' && result.url) {
        // Extract tokens from URL
        const url = new URL(result.url);
        const params = new URLSearchParams(url.hash.substring(1) || url.search);

        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken) {
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (sessionError) throw sessionError;
          return sessionData;
        }
      }
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
