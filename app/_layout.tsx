import { useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { SplashScreen } from '@/components/shared/SplashScreen';
import { ActivityTracker } from '@/components/shared/ActivityTracker';
import '../global.css';

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <NotificationProvider>
              <ActivityTracker />
              <Stack screenOptions={{ headerShown: false }} />
              <StatusBar style="auto" />
            </NotificationProvider>
          </SubscriptionProvider>
        </AuthProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
