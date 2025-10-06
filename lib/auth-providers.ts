import * as Google from 'expo-auth-session/providers/google';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';
import { makeRedirectUri } from 'expo-auth-session';

// Google Sign-In Configuration
export const useGoogleAuth = () => {
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  const signInWithGoogle = async () => {
    try {
      const result = await promptAsync();

      if (result.type === 'success') {
        const { id_token } = result.params;

        const { data, error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: id_token,
        });

        if (error) throw error;
        return data;
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      throw error;
    }
  };

  return { signInWithGoogle, request };
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
