import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Try to import native Google Sign-In (may not be available in Expo Go)
let GoogleSignin: any = null;
let isSuccessResponse: any = null;
let isErrorWithCode: any = null;
let statusCodes: any = null;
let nativeGoogleAvailable = false;

try {
  const googleSignInModule = require('@react-native-google-signin/google-signin');
  GoogleSignin = googleSignInModule.GoogleSignin;
  isSuccessResponse = googleSignInModule.isSuccessResponse;
  isErrorWithCode = googleSignInModule.isErrorWithCode;
  statusCodes = googleSignInModule.statusCodes;
  nativeGoogleAvailable = true;
  console.log('✅ Native Google Sign-In module loaded');
} catch (error) {
  console.log('⚠️ Native Google Sign-In not available, using browser fallback');
  nativeGoogleAvailable = false;
}

// Complete auth session for browser fallback
if (Platform.OS !== 'web') {
  WebBrowser.maybeCompleteAuthSession();
}

// Get Google Client IDs from app config
const getGoogleWebClientId = () => {
  return Constants.expoConfig?.extra?.googleWebClientId || '';
};

const getGoogleIosClientId = () => {
  return Constants.expoConfig?.extra?.googleIosClientId || '';
};

// Configure Google Sign-In (call once at app startup)
let isGoogleConfigured = false;

export const configureGoogleSignIn = () => {
  if (isGoogleConfigured || !nativeGoogleAvailable) return;

  try {
    GoogleSignin.configure({
      webClientId: getGoogleWebClientId(), // Required for getting ID token
      iosClientId: getGoogleIosClientId(), // Required for iOS
      offlineAccess: true,
    });
    isGoogleConfigured = true;
    console.log('✅ Google Sign-In configured successfully');
  } catch (error) {
    console.error('❌ Failed to configure Google Sign-In:', error);
  }
};

// Helper to extract params from OAuth redirect URL (for browser fallback)
function extractParamsFromUrl(url: string) {
  const parsedUrl = new URL(url);
  const hash = parsedUrl.hash.substring(1);
  const params = new URLSearchParams(hash);

  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
  };
}

// Browser-based OAuth fallback (for Expo Go or when native isn't available)
const signInWithGoogleBrowser = async () => {
  const redirectUrl = 'accord://google-auth';
  console.log('Using browser OAuth fallback with redirect:', redirectUrl);

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
    throw new Error('No OAuth URL returned');
  }

  const result = await WebBrowser.openAuthSessionAsync(
    googleOAuthUrl,
    redirectUrl,
    { showInRecents: true }
  );

  if (result.type === 'success') {
    const params = extractParamsFromUrl(result.url);

    if (params.access_token && params.refresh_token) {
      const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
        access_token: params.access_token,
        refresh_token: params.refresh_token,
      });

      if (sessionError) throw sessionError;
      return sessionData;
    }
  } else if (result.type === 'cancel') {
    throw new Error('User cancelled');
  }

  return null;
};

// Native Google Sign-In (no browser redirect!)
const signInWithGoogleNative = async () => {
  // Ensure Google Sign-In is configured
  configureGoogleSignIn();

  // Check if Google Play Services are available (Android)
  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

  // Sign in with native Google modal (stays in app!)
  const response = await GoogleSignin.signIn();

  console.log('Google Sign-In response:', response);

  if (isSuccessResponse(response)) {
    const { idToken } = response.data;

    if (!idToken) {
      throw new Error('No ID token returned from Google');
    }

    // Sign in to Supabase with the Google ID token
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'google',
      token: idToken,
    });

    if (error) throw error;

    console.log('✅ Google Sign-In successful');
    return data;
  } else {
    console.log('Google Sign-In was cancelled or failed');
    return null;
  }
};

// Main Google Sign-In function - uses native when available, browser fallback otherwise
export const signInWithGoogle = async () => {
  try {
    // For web, always use OAuth redirect flow
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

    // For mobile, use native if available, otherwise browser fallback
    if (nativeGoogleAvailable) {
      return await signInWithGoogleNative();
    } else {
      console.log('Using browser OAuth fallback (native module not available)');
      return await signInWithGoogleBrowser();
    }
  } catch (error: any) {
    // Handle native Google Sign-In specific errors
    if (nativeGoogleAvailable && isErrorWithCode && isErrorWithCode(error)) {
      switch (error.code) {
        case statusCodes.SIGN_IN_CANCELLED:
          console.log('User cancelled Google Sign-In');
          throw new Error('User cancelled');
        case statusCodes.IN_PROGRESS:
          console.log('Sign-In already in progress');
          throw new Error('Sign in already in progress');
        case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
          console.log('Play Services not available');
          throw new Error('Google Play Services not available');
        default:
          console.error('Google Sign-In error:', error);
          throw error;
      }
    }
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
