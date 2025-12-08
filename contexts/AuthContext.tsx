import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { router } from 'expo-router';
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
  useEffect(() => {
    const setupEncryption = async () => {
      if (!user) return;

      try {
        // Always initialize encryption - this uses deterministic keys based on userId
        // So the same user gets the same keys on any device (iOS/Android)
        // If keys already match, initializeEncryption() will skip storing
        console.log('🔐 Initializing deterministic encryption keys...');
        const publicKey = await initializeEncryption(user.id);

        // Store public key in user's profile (use maybeSingle - profile might not exist yet)
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, encryption_public_key')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profile) {
          // Always update DB to ensure it has the deterministic public key
          // This handles migration from old random keys to new deterministic keys
          if (profile.encryption_public_key !== publicKey) {
            await supabase
              .from('profiles')
              .update({ encryption_public_key: publicKey })
              .eq('id', profile.id);
            console.log('✅ Encryption public key updated in database');
          } else {
            console.log('✅ Encryption keys already synced');
          }
        }
      } catch (error) {
        console.error('Error setting up encryption:', error);
      }
    };

    setupEncryption();
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
