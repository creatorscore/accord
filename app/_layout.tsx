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
import { ScreenCaptureOverlay } from '@/components/shared/ScreenCaptureOverlay';
import { initI18n, isRTL } from '@/lib/i18n';
// import { initializeSentry } from '@/lib/sentry'; // Temporarily disabled for production build
import { initializePostHog, trackAppLifecycle } from '@/lib/analytics';
import { useScreenCaptureProtection } from '@/hooks/useScreenCaptureProtection';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import '../global.css';

// Initialize Sentry before anything else (with error handling)
// Temporarily disabled for production build
// try {
//   initializeSentry();
// } catch (error) {
//   console.error('Failed to initialize Sentry:', error);
// }

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [i18nInitialized, setI18nInitialized] = useState(false);
  const [splashAnimationDone, setSplashAnimationDone] = useState(false);

  // Enable screenshot protection app-wide (returns true when overlay should show)
  const showSecurityOverlay = useScreenCaptureProtection(true);

  useEffect(() => {
    async function initialize() {
      try {
        // Check if this is first launch
        const hasLaunchedBefore = await AsyncStorage.getItem('has_launched_before');
        const isFirstLaunch = !hasLaunchedBefore;

        // Initialize analytics (don't await, let it run in background)
        initializePostHog().catch(err => {
          console.error('PostHog initialization error:', err);
        });

        // Track app install/launch
        if (isFirstLaunch) {
          const version = Application.nativeApplicationVersion || '1.0.0';
          const platform = Platform.OS as 'ios' | 'android';
          trackAppLifecycle.appInstalled(platform, version);
          await AsyncStorage.setItem('has_launched_before', 'true');
        }

        // Track app started
        trackAppLifecycle.appStarted(isFirstLaunch);

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

  // Only hide splash when BOTH animation is done AND i18n is initialized
  useEffect(() => {
    if (splashAnimationDone && i18nInitialized) {
      setShowSplash(false);
    }
  }, [splashAnimationDone, i18nInitialized]);

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
                {showSplash && (
                  <SplashScreen onFinish={() => setSplashAnimationDone(true)} />
                )}

                {/* Security overlay for screenshot protection (iOS) */}
                <ScreenCaptureOverlay visible={showSecurityOverlay} />
              </NotificationProvider>
            </SubscriptionProvider>
          </AuthProvider>
        </PaperProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
