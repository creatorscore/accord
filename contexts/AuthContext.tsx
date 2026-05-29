import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { AppState, AppStateStatus, InteractionManager } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { initializeEncryption, deleteEncryptionKeys } from '@/lib/encryption';
import { setUser as setSentryUser } from '@/lib/sentry';
import { identifyUser, resetUser, trackUserAction } from '@/lib/analytics';
import { removePushToken } from '@/lib/notifications';
import { clearSignedUrlCache } from '@/lib/signed-urls';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  sendPasswordResetEmail: async () => {},
  updatePassword: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const lastLocationUpdate = useRef<number>(0);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Update user identity in PostHog
      if (session?.user) {
        setSentryUser({ id: session.user.id });
        identifyUser(session.user.id);
      } else {
        setSentryUser(null);
        resetUser();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // CRITICAL SAFETY: Check if user is banned.
  // One-shot per session — token-refresh events change the user reference
  // and would otherwise re-fire this. index.tsx already runs the primary
  // ban check (rpc/is_banned) on cold start; this is the secondary safeguard
  // for users banned mid-session.
  const banCheckedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!user) {
      banCheckedFor.current = null;
      return;
    }
    if (banCheckedFor.current === user.id) return;

    const checkBanStatus = async () => {
      try {
        // Query bans directly by banned_user_id — avoids the redundant
        // profile.id lookup that ProfileDataContext is already doing in
        // parallel. We don't need to also check banned_profile_id here:
        // a profile-level ban always sets banned_user_id too (see
        // admin-ban-user edge function), so user_id alone catches both
        // cases. Removing the profile fetch removes one launch-time GET
        // that was contributing to the saveCheckpoint queue stall.
        const { data: banData } = await supabase
          .from('bans')
          .select('id, ban_reason')
          .eq('banned_user_id', user.id)
          .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
          .maybeSingle();

        if (banData) {
          // Sign out the banned user
          await supabase.auth.signOut();
          // Redirect to banned screen with user info
          router.replace({
            pathname: '/(auth)/banned',
            params: { userId: user.id }
          });
          return;
        }
        banCheckedFor.current = user.id;
      } catch (error) {
        console.error('Error checking ban status:', error);
      }
    };

    // Run ban check immediately — security takes priority over startup performance.
    checkBanStatus();
  }, [user]);

  // Initialize encryption keys for authenticated users
  // Uses deterministic key derivation so the same user gets identical keys on iOS/Android
  // CRITICAL: This ensures cross-platform messaging works correctly
  // PERFORMANCE: Deferred to avoid blocking cold start.
  // One-shot per session — once we've verified/synced the encryption key for
  // this user.id, don't run again. Token refresh events change the user
  // object reference and would otherwise re-fire this effect, contributing to
  // the launch-time GET+PATCH flood that was stalling saveCheckpoint.
  const encryptionSyncedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!user) {
      encryptionSyncedFor.current = null;
      return;
    }
    if (encryptionSyncedFor.current === user.id) return;

    const setupEncryption = async () => {
      try {
        const publicKey = await initializeEncryption(user.id);

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, encryption_public_key')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile) {
          if (profile.encryption_public_key !== publicKey) {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({ encryption_public_key: publicKey })
              .eq('id', profile.id);

            if (updateError) {
              console.error('❌ Failed to update encryption key:', updateError);
              return; // don't mark as synced if the write failed
            }
          }
          encryptionSyncedFor.current = user.id;
        }
      } catch (error) {
        console.error('Error setting up encryption:', error);
      }
    };

    InteractionManager.runAfterInteractions(() => {
      setupEncryption();
    });
  }, [user]);

  // Automatic location refresh when app comes to foreground
  // This ensures users always show their true/live GPS location
  // PERFORMANCE: Deferred to avoid blocking cold start on low-RAM devices
  useEffect(() => {
    const refreshLocation = async () => {
      if (!user) return;

      // Throttle updates: only refresh if 5+ minutes have passed since last update
      const now = Date.now();
      const minInterval = 5 * 60 * 1000; // 5 minutes
      if (now - lastLocationUpdate.current < minInterval) {
        return;
      }

      try {
        // Check if we have permission
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          return;
        }

        // PERFORMANCE: Use Balanced accuracy instead of High for faster GPS lock
        // High accuracy can take 5-10+ seconds on poor signal; Balanced is usually <2s
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });

        // Validate accuracy - reject if too inaccurate (> 500 meters for balanced)
        if (location.coords.accuracy && location.coords.accuracy > 500) {
          return;
        }

        // Reverse geocode to get city/state
        const reverseGeocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        const addressInfo = reverseGeocode[0];
        if (!addressInfo) {
          return;
        }

        const city = addressInfo.city || addressInfo.subregion || addressInfo.district || '';
        const state = addressInfo.region || '';
        // isoCountryCode FIRST — addressInfo.country returns the country
        // name in the device locale ('भारत', 'Türkiye', 'Côte d'Ivoire',
        // 'Oʻzbekiston') which splits the same country into many cohorts
        // and breaks downstream grouping/filtering. ISO is locale-agnostic
        // and matches what LocationStep already writes from the cities DB.
        const country = addressInfo.isoCountryCode || addressInfo.country || '';

        // Get profile ID
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, latitude, longitude')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!profile) {
          return;
        }

        // Check if location has changed significantly (> 500 meters for balanced accuracy)
        if (profile.latitude && profile.longitude) {
          const latDiff = Math.abs(profile.latitude - location.coords.latitude);
          const lonDiff = Math.abs(profile.longitude - location.coords.longitude);
          // Roughly 0.005 degrees = ~500 meters
          if (latDiff < 0.005 && lonDiff < 0.005) {
            lastLocationUpdate.current = now;
            return;
          }
        }

        // Update profile with new location. last_gps_at marks "I have
        // a fresh GPS reading from this device" — drives the staleness
        // banner that prompts users who revoked permission to re-grant.
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            location_city: city,
            location_state: state,
            location_country: country,
            last_active_at: new Date().toISOString(),
            last_gps_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        if (updateError) {
          console.error('❌ Failed to update location:', updateError);
        } else {
          lastLocationUpdate.current = now;
        }
      } catch (error) {
        console.error('Error refreshing location:', error);
      }
    };

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      // When app goes to background, clear signed URL cache
      if (appState.current === 'active' && nextAppState.match(/inactive|background/)) {
        clearSignedUrlCache();
      }

      // When app comes to foreground, refresh location
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        // Fix: Don't await - let it run in background to prevent ANR
        // GPS calls can take 5-10 seconds and will block Activity launch if awaited
        refreshLocation().catch(err => console.error('Background location refresh failed:', err));
      }
      appState.current = nextAppState;
    });

    // PERFORMANCE: Defer initial location refresh until AFTER first render
    // This prevents GPS calls from blocking cold start on low-RAM devices
    // GPS can take 5-10 seconds and was causing 87% slow cold-start rate
    if (user) {
      InteractionManager.runAfterInteractions(() => {
        // Additional delay to ensure UI is fully rendered first
        setTimeout(() => {
          refreshLocation().catch(err => console.error('Initial location refresh failed:', err));
        }, 3000); // 3 second delay after interactions complete
      });
    }

    return () => {
      subscription.remove();
    };
  }, [user]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;

    // Track sign in
    trackUserAction.signIn('email');
  };

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: 'accord://auth/callback'
      }
    });
    if (error) throw error;

    // Track sign up
    trackUserAction.signUp('email');

    // Return data so caller can check if email confirmation is needed
    return data;
  };

  const signOut = async () => {
    // Capture user ID before clearing state for cleanup
    const userId = user?.id;

    // Clear state immediately so components stop making authenticated requests
    // before the server-side token revocation completes (prevents 401 race condition)
    setUser(null);
    setSession(null);

    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Track sign out
    trackUserAction.signOut();

    // Non-blocking cleanup: remove push token, encryption keys, signed URL cache
    if (userId) {
      Promise.allSettled([
        removePushToken(userId),
        deleteEncryptionKeys(userId),
        Promise.resolve(clearSignedUrlCache()),
      ]).catch(() => {});
    }

    // Clear persisted onboarding draft so the next user on this device doesn't
    // inherit the previous user's in-progress answers.
    try {
      const { useOnboardingStore } = await import('@/stores/onboardingStore');
      useOnboardingStore.getState().reset();
    } catch {}
  };

  const sendPasswordResetEmail = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'accord://auth/callback'
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        signIn,
        signUp,
        signOut,
        sendPasswordResetEmail,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
