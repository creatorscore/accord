// Import WebCrypto polyfill FIRST (enables crypto.subtle in React Native)
import 'expo-standard-web-crypto';

import { useState, useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nManager } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { SplashScreen } from '@/components/shared/SplashScreen';
import { ActivityTracker } from '@/components/shared/ActivityTracker';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { initI18n, isRTL } from '@/lib/i18n';
import { initializeSentry } from '@/lib/sentry';
import { initializePostHog } from '@/lib/analytics';
import '../global.css';

// Initialize Sentry before anything else (with error handling)
try {
  initializeSentry();
} catch (error) {
  console.error('Failed to initialize Sentry:', error);
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [i18nInitialized, setI18nInitialized] = useState(false);

  useEffect(() => {
    async function initialize() {
      try {
        // Initialize analytics (don't await, let it run in background)
        initializePostHog().catch(err => {
          console.error('PostHog initialization error:', err);
        });

        // Initialize i18n
        await initI18n();
        console.log('✅ i18n initialized successfully');
        setI18nInitialized(true);
      } catch (error) {
        console.error('Error during initialization:', error);
        // Fall back to English and continue - don't crash the app
        setI18nInitialized(true);
      }
    }

    initialize();
  }, []);

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <PaperProvider>
          <AuthProvider>
            <SubscriptionProvider>
              <NotificationProvider>
                <ActivityTracker />
                <Stack screenOptions={{ headerShown: false }} />
                <StatusBar style="auto" />

                {/* Overlay splash screen while initializing */}
                {(showSplash || !i18nInitialized) && (
                  <SplashScreen onFinish={() => setShowSplash(false)} />
                )}
              </NotificationProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </PaperProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
