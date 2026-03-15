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

  // CRITICAL SAFETY: Check if user is banned
  // PERFORMANCE: Defer to avoid blocking cold start
  useEffect(() => {
    const checkBanStatus = async () => {
      if (!user) return;

      try {
        // Get user's profile ID (use maybeSingle - user might not have a profile yet)
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!profile) return;

        // Check if banned by user_id or profile_id
        const { data: banData } = await supabase
          .from('bans')
          .select('id, ban_reason')
          .or(`banned_user_id.eq.${user.id},banned_profile_id.eq.${profile.id}`)
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
        }
      } catch (error) {
        console.error('Error checking ban status:', error);
      }
    };

    // Run ban check immediately — security takes priority over startup performance.
    // The index.tsx routing already does a primary ban check; this is the secondary
    // safeguard for users who were banned AFTER the initial route check.
    if (user) {
      checkBanStatus();
    }
  }, [user]);

  // Initialize encryption keys for authenticated users
  // Uses deterministic key derivation so the same user gets identical keys on iOS/Android
  // CRITICAL: This ensures cross-platform messaging works correctly
  // PERFORMANCE: Deferred to avoid blocking cold start
  useEffect(() => {
    const setupEncryption = async () => {
      if (!user) return;

      try {
        // Always initialize encryption - this uses deterministic keys based on userId
        // So the same user gets the same keys on any device (iOS/Android)
        const publicKey = await initializeEncryption(user.id);

        // Store public key in user's profile (use maybeSingle - profile might not exist yet)
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, encryption_public_key')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile) {
          // CRITICAL FIX: ALWAYS force update the encryption key in the database
          // This fixes users who had old random keys that don't match deterministic derivation
          // Without this, iOS/Android users can't read each other's messages
          const currentDbKey = profile.encryption_public_key;
          const keysMatch = currentDbKey === publicKey;

          // Always update to ensure consistency across platforms
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ encryption_public_key: publicKey })
            .eq('id', profile.id);

          if (updateError) {
            console.error('❌ Failed to update encryption key:', updateError);
          }
        }
      } catch (error) {
        console.error('Error setting up encryption:', error);
      }
    };

    // PERFORMANCE: Defer encryption setup until after initial render
    if (user) {
      InteractionManager.runAfterInteractions(() => {
        setupEncryption();
      });
    }
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
        const country = addressInfo.country || addressInfo.isoCountryCode || '';

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

        // Update profile with new location
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            location_city: city,
            location_state: state,
            location_country: country,
            last_active_at: new Date().toISOString(),
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
