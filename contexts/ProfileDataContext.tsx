import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { InteractionManager } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from './AuthContext';

/**
 * ProfileDataContext - PERFORMANCE OPTIMIZATION
 *
 * This context centralizes profile data fetching to eliminate duplicate queries.
 * Previously, AuthContext, SubscriptionContext, NotificationContext, and ActivityTracker
 * each queried the profiles table independently (5+ queries at startup).
 *
 * Now we fetch profile data ONCE and share it across all contexts.
 * This reduces cold-start time significantly, especially on low-RAM devices.
 */

export interface ProfileData {
  id: string;
  user_id: string;
  is_premium: boolean;
  is_platinum: boolean;
  is_admin: boolean;
  encryption_public_key: string | null;
  latitude: number | null;
  longitude: number | null;
  location_city: string | null;
  location_state: string | null;
  push_token: string | null;
  last_active_at: string | null;
}

interface ProfileDataContextType {
  profile: ProfileData | null;
  profileId: string | null;
  isLoading: boolean;
  error: Error | null;
  refreshProfile: () => Promise<void>;
  updateProfile: (updates: Partial<ProfileData>) => Promise<void>;
}

const ProfileDataContext = createContext<ProfileDataContextType>({
  profile: null,
  profileId: null,
  isLoading: true,
  error: null,
  refreshProfile: async () => {},
  updateProfile: async () => {},
});

export const useProfileData = () => useContext(ProfileDataContext);

export const ProfileDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fetchInProgress = useRef(false);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setIsLoading(false);
      return;
    }

    // Prevent duplicate concurrent fetches
    if (fetchInProgress.current) {
      return;
    }

    fetchInProgress.current = true;

    try {
      // Single optimized query that fetches ALL fields needed by other contexts
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select(`
          id,
          user_id,
          is_premium,
          is_platinum,
          is_admin,
          encryption_public_key,
          latitude,
          longitude,
          location_city,
          location_state,
          push_token,
          last_active_at
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching profile data:', fetchError);
        setError(fetchError);
        setProfile(null);
      } else {
        setProfile(data);
        setError(null);
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
      setError(err as Error);
    } finally {
      setIsLoading(false);
      fetchInProgress.current = false;
    }
  }, [user?.id]);

  // Fetch profile when user changes, but defer to avoid blocking navigation
  useEffect(() => {
    if (user?.id) {
      // Use InteractionManager to defer the query until after animations complete
      // This prevents jank during navigation and improves perceived performance
      const task = InteractionManager.runAfterInteractions(() => {
        fetchProfile();
      });

      return () => task.cancel();
    } else {
      setProfile(null);
      setIsLoading(false);
    }
  }, [user?.id, fetchProfile]);

  const refreshProfile = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  const updateProfile = useCallback(async (updates: Partial<ProfileData>) => {
    if (!profile?.id) return;

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id);

      if (updateError) {
        console.error('Error updating profile:', updateError);
        throw updateError;
      }

      // Optimistically update local state
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    } catch (err) {
      console.error('Profile update error:', err);
      throw err;
    }
  }, [profile?.id]);

  const value: ProfileDataContextType = {
    profile,
    profileId: profile?.id || null,
    isLoading,
    error,
    refreshProfile,
    updateProfile,
  };

  return (
    <ProfileDataContext.Provider value={value}>
      {children}
    </ProfileDataContext.Provider>
  );
};
