import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { initializeEncryption, hasEncryptionKeys } from '@/lib/encryption';
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

  // Initialize encryption keys for authenticated users
  useEffect(() => {
    const setupEncryption = async () => {
      if (!user) return;

      try {
        // Check if user already has encryption keys
        const hasKeys = await hasEncryptionKeys(user.id);
        if (hasKeys) {
          console.log('✅ Encryption keys already exist');
          return;
        }

        console.log('🔐 Initializing encryption keys...');
        const publicKey = await initializeEncryption(user.id);

        // Store public key in user's profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', user.id)
          .single();

        if (profile) {
          await supabase
            .from('profiles')
            .update({ encryption_public_key: publicKey })
            .eq('id', profile.id);

          console.log('✅ Encryption keys initialized and saved');
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
