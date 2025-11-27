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
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('📱 App foregrounded - checking push token');
        if (user?.id && pushToken) {
          // Reset retry count and try again
          retryCount.current = 0;
          retrySavePushToken();
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
        console.log('Notification received:', notification);
        // You can show in-app notification UI here
      }
    );

    // Handle notification tap
    responseListener.current = setupNotificationListener((data) => {
      handleNotificationResponse(data);
    });
  };

  const handleNotificationResponse = (data: any) => {
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
          // Navigate to likes tab
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
