import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import {
  registerForPushNotifications,
  savePushToken,
  setupNotificationListener,
  removePushToken,
  ensurePushTokenSaved,
} from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { useToast } from './ToastContext';
import { useMatch } from './MatchContext';

interface NotificationContextType {
  pushToken: string | null;
  notificationsEnabled: boolean;
}

const NotificationContext = createContext<NotificationContextType>({
  pushToken: null,
  notificationsEnabled: false,
});

export function useNotifications() {
  return useContext(NotificationContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { showToast, showMessageToast, showLikeToast } = useToast();
  const { showMatchCelebration } = useMatch();
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const notificationListener = useRef<Notifications.Subscription | undefined>(undefined);
  const responseListener = useRef<Notifications.Subscription | undefined>(undefined);
  const pendingNavigation = useRef<any>(null);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const retryCount = useRef<number>(0);
  const maxRetries = 10; // Will retry up to 10 times with exponential backoff

  useEffect(() => {
    if (user) {
      // Register for push notifications when user logs in
      initializePushNotifications();
    } else {
      // Clean up when user logs out (no need to remove token as user is null)
      setPushToken(null);
      setNotificationsEnabled(false);
    }

    return () => {
      // Cleanup listeners
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user]);

  const initializePushNotifications = async () => {
    try {
      // Clear badge count on app launch
      try {
        await Notifications.setBadgeCountAsync(0);
      } catch (e) {
        // Ignore badge errors
      }

      // Register and get push token
      const token = await registerForPushNotifications();

      if (token && user?.id) {
        setPushToken(token);
        setNotificationsEnabled(true);

        // Save token to database
        // Note: This may fail for new users during onboarding (no profile yet)
        // The token will be saved again at onboarding completion
        await savePushToken(user.id, token);

        // Set up notification listeners
        setupListeners();
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  };

  // Aggressive retry mechanism with exponential backoff
  // This ensures push tokens are ALWAYS saved, even if profile creation is delayed
  const retrySavePushToken = async () => {
    if (!user?.id || !pushToken) return;
    if (retryCount.current >= maxRetries) {
      console.warn('⚠️  Max retries reached for push token save');
      return;
    }

    try {
      const success = await ensurePushTokenSaved(user.id, pushToken);
      if (success) {
        console.log('✅ Push token saved successfully on retry', retryCount.current);
        retryCount.current = 0; // Reset on success
      } else {
        // Token not saved yet, schedule another retry
        retryCount.current++;
        const delay = Math.min(1000 * Math.pow(2, retryCount.current), 60000); // Exponential backoff, max 60s
        console.log(`⏰ Retry ${retryCount.current}/${maxRetries} in ${delay}ms`);
        setTimeout(retrySavePushToken, delay);
      }
    } catch (error) {
      console.error('❌ Error in retry push token:', error);
      // Still retry on error
      retryCount.current++;
      if (retryCount.current < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount.current), 60000);
        setTimeout(retrySavePushToken, delay);
      }
    }
  };

  // Retry saving push token when app comes to foreground
  // This catches users who completed onboarding while app was in background
  // AND users who initially denied permissions but later enabled them in settings
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 App foregrounded - checking push token');

        // Clear badge count when app is opened
        try {
          await Notifications.setBadgeCountAsync(0);
          console.log('🔔 Badge count cleared');
        } catch (error) {
          console.warn('Failed to clear badge:', error);
        }

        // ALWAYS try to get and save token on foreground if user is logged in
        // This catches users who:
        // 1. Initially denied permissions but later enabled in settings
        // 2. Had token obtained but profile wasn't created yet
        // 3. Had any other timing issue during onboarding
        if (user?.id) {
          try {
            // If we don't have a token yet, try to get one
            let currentToken = pushToken;
            if (!currentToken) {
              console.log('📱 No push token in state, attempting to register...');
              currentToken = await registerForPushNotifications();
              if (currentToken) {
                setPushToken(currentToken);
                setNotificationsEnabled(true);
                console.log('✅ Push token obtained on foreground');
              }
            }

            // If we have a token (new or existing), try to save it
            if (currentToken) {
              retryCount.current = 0;
              const saved = await ensurePushTokenSaved(user.id, currentToken);
              if (saved) {
                console.log('✅ Push token verified/saved on foreground');
              }
            }
          } catch (error) {
            console.warn('Error checking push token on foreground:', error);
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [user, pushToken]);

  // Initial retry mechanism - start retrying immediately after token is obtained
  useEffect(() => {
    if (user && pushToken) {
      // Start aggressive retry loop
      retryCount.current = 0;
      retrySavePushToken();
    }
  }, [user, pushToken]);

  const setupListeners = () => {
    // Handle notifications received while app is in foreground
    notificationListener.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received in foreground:', notification);

        const data = notification.request.content.data;
        const title = notification.request.content.title || '';
        const body = notification.request.content.body || '';

        // Show in-app toast based on notification type
        if (data?.type === 'new_message' && data?.matchId) {
          // Extract sender name from title (format: "New message from Name")
          const senderName = title.replace('New message from ', '');
          showMessageToast(senderName, body, data.matchId as string);
        } else if (data?.type === 'new_like') {
          const isPremium = data?.isPremium === true;
          const likerName = isPremium && title ? title.replace(' likes you!', '') : 'Someone';
          showLikeToast(likerName, isPremium);
        } else if (data?.type === 'new_match' && data?.matchId) {
          // For matches, show a toast (the full celebration modal is shown from discover screen)
          showToast({
            type: 'match',
            title: title || "It's a Match!",
            message: body || 'You have a new match!',
            onPress: () => router.push('/(tabs)/matches'),
          });
        } else if (title || body) {
          // Generic notification toast
          showToast({
            type: 'info',
            title: title || 'Notification',
            message: body,
          });
        }
      }
    );

    // Handle notification tap
    responseListener.current = setupNotificationListener((data) => {
      handleNotificationResponse(data);
    });
  };

  const handleNotificationResponse = async (data: any) => {
    if (!data || !data.type) return;

    // Store the navigation data for the app to handle
    // Navigation will be handled by individual screens using useEffect
    // to check for pending notifications after mounting
    pendingNavigation.current = data;

    console.log('Notification tapped:', data.type);

    // Handle navigation based on notification type
    try {
      switch (data.type) {
        case 'review_ready':
        case 'review_reminder':
          // Navigate to reviews screen
          router.push('/reviews/my-reviews');
          break;
        case 'new_match':
          // Navigate to matches tab
          router.push('/(tabs)/matches');
          break;
        case 'new_message':
          // Navigate to chat if matchId is available
          if (data.matchId) {
            router.push(`/chat/${data.matchId}`);
          } else {
            router.push('/(tabs)/messages');
          }
          break;
        case 'new_like':
          // For premium users, check if the liker has become a match
          // (happens when user swiped right on them from Discover before tapping notification)
          if (data.likerProfileId && user?.id) {
            try {
              // Get current user's profile ID
              const { data: currentProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', user.id)
                .single();

              if (currentProfile) {
                // Check if there's already a match with this liker
                const profile1Id = currentProfile.id < data.likerProfileId ? currentProfile.id : data.likerProfileId;
                const profile2Id = currentProfile.id < data.likerProfileId ? data.likerProfileId : currentProfile.id;

                const { data: existingMatch } = await supabase
                  .from('matches')
                  .select('id')
                  .eq('profile1_id', profile1Id)
                  .eq('profile2_id', profile2Id)
                  .eq('status', 'active')
                  .maybeSingle();

                if (existingMatch) {
                  // The like has become a match! Redirect to matches instead
                  console.log('Like is now a match, redirecting to matches tab');
                  router.push('/(tabs)/matches');
                  return;
                }
              }
            } catch (error) {
              console.error('Error checking if like is now a match:', error);
              // Fall through to default likes navigation
            }
          }
          // Navigate to likes tab (default behavior)
          router.push('/(tabs)/likes');
          break;
        default:
          // For unknown types, store for screens to handle
          break;
      }
    } catch (error) {
      console.error('Error navigating from notification:', error);
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        pushToken,
        notificationsEnabled,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}
