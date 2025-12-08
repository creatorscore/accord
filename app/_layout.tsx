// Import WebCrypto polyfill FIRST (enables crypto.subtle in React Native)
import 'expo-standard-web-crypto';

import { useState, useEffect, useCallback } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nManager, Platform } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as SplashScreenExpo from 'expo-splash-screen';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { MatchProvider } from '@/contexts/MatchContext';
import { SplashScreen } from '@/components/shared/SplashScreen';
import { ActivityTracker } from '@/components/shared/ActivityTracker';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import { ScreenCaptureOverlay } from '@/components/shared/ScreenCaptureOverlay';
import AppUpdateChecker from '@/components/AppUpdateChecker';
import { initI18n, isRTL } from '@/lib/i18n';
import { initializeSentry } from '@/lib/sentry';
import { initializePostHog, trackAppLifecycle } from '@/lib/analytics';
import { configureGoogleSignIn } from '@/lib/auth-providers';
import { useScreenCaptureProtection } from '@/hooks/useScreenCaptureProtection';
import { useColorScheme, useInitializeColorScheme, useInitialAndroidBarSync } from '@/lib/useColorScheme';
import { NAV_THEME } from '@/theme';
import { fontAssets } from '@/lib/fonts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import '../global.css';

// Prevent splash screen from hiding until fonts are loaded
SplashScreenExpo.preventAutoHideAsync();

// Initialize Sentry before anything else (with error handling)
try {
  initializeSentry();
} catch (error) {
  console.error('Failed to initialize Sentry:', error);
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const [i18nInitialized, setI18nInitialized] = useState(false);
  const [splashAnimationDone, setSplashAnimationDone] = useState(false);

  // Load custom fonts (Plus Jakarta Sans + Inter)
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  // Initialize color scheme from storage
  useInitializeColorScheme();

  // Sync Android navigation bar with theme
  useInitialAndroidBarSync();

  // Get current color scheme for theme provider
  const { colorScheme, isDarkColorScheme } = useColorScheme();

  // Enable screenshot protection app-wide (returns true when overlay should show)
  const showSecurityOverlay = useScreenCaptureProtection(true);

  // Hide native splash screen once fonts are loaded
  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded || fontError) {
      await SplashScreenExpo.hideAsync();
    }
  }, [fontsLoaded, fontError]);

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

        // Configure Google Sign-In for native authentication
        configureGoogleSignIn();

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

        // Sync RTL state with current language
        // This fixes the case where language changed but app didn't reload properly
        const shouldBeRTL = isRTL();
        const currentlyRTL = I18nManager.isRTL;
        if (shouldBeRTL !== currentlyRTL) {
          I18nManager.forceRTL(shouldBeRTL);
          I18nManager.allowRTL(shouldBeRTL);
        }

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

  // Wait for fonts to load
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
        <ThemeProvider value={NAV_THEME[colorScheme]}>
          <PaperProvider>
            <AuthProvider>
              <SubscriptionProvider>
                <ToastProvider>
                  <MatchProvider>
                    <NotificationProvider>
                      <ActivityTracker />
                      {/* Only render Stack after i18n is initialized to prevent showing raw translation keys */}
                      {i18nInitialized ? (
                        <Stack screenOptions={{ headerShown: false }} />
                      ) : null}
                      <StatusBar style={isDarkColorScheme ? 'light' : 'dark'} />

                      {/* Check for app updates */}
                      {!showSplash && <AppUpdateChecker />}

                      {/* Overlay splash screen while initializing */}
                      {showSplash && (
                        <SplashScreen onFinish={() => setSplashAnimationDone(true)} />
                      )}

                      {/* Security overlay for screenshot protection (iOS) */}
                      <ScreenCaptureOverlay visible={showSecurityOverlay} />
                    </NotificationProvider>
                  </MatchProvider>
                </ToastProvider>
              </SubscriptionProvider>
            </AuthProvider>
          </PaperProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
