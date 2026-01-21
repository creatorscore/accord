import { useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus, InteractionManager } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileData } from '@/contexts/ProfileDataContext';

/**
 * Hook to track user activity and update last_active_at
 * Updates every 60 seconds when app is in foreground
 * PERFORMANCE: Uses shared ProfileDataContext to avoid duplicate queries
 */
export const useActivityTracker = () => {
  const { user } = useAuth();
  // PERFORMANCE: Use shared profile ID from ProfileDataContext
  const { profileId } = useProfileData();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  const updateLastActive = useCallback(async () => {
    // PERFORMANCE: Use profileId from context instead of querying
    if (!profileId) return;

    try {
      // Update last_active_at
      await supabase
        .from('profiles')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', profileId);

      console.log('📍 Updated last_active_at');
    } catch (error) {
      console.error('Error updating last_active_at:', error);
    }
  }, [profileId]);

  useEffect(() => {
    if (!user || !profileId) return;

    // PERFORMANCE: Defer initial update until after first render
    InteractionManager.runAfterInteractions(() => {
      // Additional delay to avoid impacting startup performance
      setTimeout(() => {
        updateLastActive();
      }, 5000); // 5 second delay after interactions complete
    });

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
  }, [user, profileId, updateLastActive]);
};
