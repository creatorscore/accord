import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { AppState, AppStateStatus } from 'react-native';
import { router } from 'expo-router';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { initializeEncryption } from '@/lib/encryption';
// import { setUser as setSentryUser } from '@/lib/sentry'; // Temporarily disabled
import { identifyUser, resetUser, trackUserAction } from '@/lib/analytics';

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
        // setSentryUser({ id: session.user.id }); // Temporarily disabled
        identifyUser(session.user.id, {
          email: session.user.email,
        });
      } else {
        // setSentryUser(null); // Temporarily disabled
        resetUser();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // CRITICAL SAFETY: Check if user is banned
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
          console.log('🚨 USER IS BANNED - redirecting to banned screen');
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

    checkBanStatus();
  }, [user]);

  // Initialize encryption keys for authenticated users
  // Uses deterministic key derivation so the same user gets identical keys on iOS/Android
  // CRITICAL: This ensures cross-platform messaging works correctly
  useEffect(() => {
    const setupEncryption = async () => {
      if (!user) return;

      try {
        // Always initialize encryption - this uses deterministic keys based on userId
        // So the same user gets the same keys on any device (iOS/Android)
        console.log('🔐 Initializing deterministic encryption keys...');
        const publicKey = await initializeEncryption(user.id);
        console.log('🔑 Derived public key:', publicKey.substring(0, 16) + '...');

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

          if (!keysMatch) {
            console.log('⚠️ Database key mismatch detected!');
            console.log('   DB key:', currentDbKey ? currentDbKey.substring(0, 16) + '...' : 'NULL');
            console.log('   Correct key:', publicKey.substring(0, 16) + '...');
          }

          // Always update to ensure consistency across platforms
          const { error: updateError } = await supabase
            .from('profiles')
            .update({ encryption_public_key: publicKey })
            .eq('id', profile.id);

          if (updateError) {
            console.error('❌ Failed to update encryption key:', updateError);
          } else {
            console.log('✅ Encryption public key synced to database');
          }
        }
      } catch (error) {
        console.error('Error setting up encryption:', error);
      }
    };

    setupEncryption();
  }, [user]);

  // Automatic location refresh when app comes to foreground
  // This ensures users always show their true/live GPS location
  useEffect(() => {
    const refreshLocation = async () => {
      if (!user) return;

      // Throttle updates: only refresh if 5+ minutes have passed since last update
      const now = Date.now();
      const minInterval = 5 * 60 * 1000; // 5 minutes
      if (now - lastLocationUpdate.current < minInterval) {
        console.log('📍 Skipping location refresh - too recent');
        return;
      }

      try {
        // Check if we have permission
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('📍 Location permission not granted, skipping refresh');
          return;
        }

        // Get current GPS location with high accuracy
        const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        // Validate accuracy - reject if too inaccurate (> 100 meters)
        if (location.coords.accuracy && location.coords.accuracy > 100) {
          console.log('📍 Location too inaccurate, skipping refresh');
          return;
        }

        // Reverse geocode to get city/state
        const reverseGeocode = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        const addressInfo = reverseGeocode[0];
        if (!addressInfo) {
          console.log('📍 Could not reverse geocode location');
          return;
        }

        const city = addressInfo.city || addressInfo.subregion || addressInfo.district || '';
        const state = addressInfo.region || '';

        // Get profile ID
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, latitude, longitude')
          .eq('user_id', user.id)
          .maybeSingle();

        if (!profile) {
          console.log('📍 No profile found, skipping location refresh');
          return;
        }

        // Check if location has changed significantly (> 100 meters)
        if (profile.latitude && profile.longitude) {
          const latDiff = Math.abs(profile.latitude - location.coords.latitude);
          const lonDiff = Math.abs(profile.longitude - location.coords.longitude);
          // Roughly 0.001 degrees = ~111 meters
          if (latDiff < 0.001 && lonDiff < 0.001) {
            console.log('📍 Location unchanged, skipping update');
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
            last_active_at: new Date().toISOString(),
          })
          .eq('id', profile.id);

        if (updateError) {
          console.error('❌ Failed to update location:', updateError);
        } else {
          console.log('✅ Location refreshed:', city, state);
          lastLocationUpdate.current = now;
        }
      } catch (error) {
        console.error('Error refreshing location:', error);
      }
    };

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      // When app comes to foreground, refresh location
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 App foregrounded - refreshing location');
        await refreshLocation();
      }
      appState.current = nextAppState;
    });

    // Also refresh on initial mount if user is logged in
    if (user) {
      refreshLocation();
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
    const { error } = await supabase.auth.signOut();
    if (error) throw error;

    // Track sign out
    trackUserAction.signOut();
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
