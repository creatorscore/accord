import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import * as Notifications from 'expo-notifications';
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
  const notificationListener = useRef<Notifications.Subscription>();
  const responseListener = useRef<Notifications.Subscription>();
  const pendingNavigation = useRef<any>(null);

  useEffect(() => {
    if (user) {
      // Register for push notifications when user logs in
      initializePushNotifications();
    } else {
      // Clean up when user logs out
      if (pushToken && user?.id) {
        removePushToken(user.id);
      }
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
        await savePushToken(user.id, token);

        // Set up notification listeners
        setupListeners();
      }
    } catch (error) {
      console.error('Error initializing push notifications:', error);
    }
  };

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
    // Navigation is now handled by screens checking pendingNavigation
    // This avoids router context issues during app initialization
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
