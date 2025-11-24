import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useAuth } from './AuthContext';
import {
  registerForPushNotifications,
  savePushToken,
  setupNotificationListener,
  removePushToken,
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

  // Retry saving push token for existing users who may not have one
  // This handles users who completed onboarding before this fix
  const retrySavePushToken = async () => {
    if (!user?.id || !pushToken) return;

    try {
      await savePushToken(user.id, pushToken);
    } catch (error) {
      // Silently fail - not critical
    }
  };

  // Check periodically if push token needs to be saved (for existing users)
  useEffect(() => {
    if (user && pushToken) {
      // Retry saving after a short delay to ensure profile exists
      const timer = setTimeout(() => {
        retrySavePushToken();
      }, 5000);
      return () => clearTimeout(timer);
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
