import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Hook to track user activity and update last_active_at
 * Updates every 60 seconds when app is in foreground
 */
export const useActivityTracker = () => {
  const { user } = useAuth();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const updateLastActive = async () => {
    if (!user?.id) return;

    try {
      // Get current profile ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Update last_active_at
      await supabase
        .from('profiles')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', profile.id);

      console.log('📍 Updated last_active_at');
    } catch (error) {
      console.error('Error updating last_active_at:', error);
    }
  };

  useEffect(() => {
    if (!user) return;

    // Update immediately on mount
    updateLastActive();

    // Set up interval to update every 60 seconds
    intervalRef.current = setInterval(() => {
      if (appStateRef.current === 'active') {
        updateLastActive();
      }
    }, 60000); // 60 seconds

    // Listen for app state changes
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      appStateRef.current = nextAppState;

      // Update when app comes to foreground
      if (nextAppState === 'active') {
        updateLastActive();
      }
    });

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      subscription.remove();
    };
  }, [user]);
};
