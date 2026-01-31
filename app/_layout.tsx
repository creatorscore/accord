// Import WebCrypto polyfill FIRST (enables crypto.subtle in React Native)
import 'expo-standard-web-crypto';

import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nManager, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as SplashScreenExpo from 'expo-splash-screen';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProfileDataProvider } from '@/contexts/ProfileDataContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { NotificationProvider } from '@/contexts/NotificationContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { MatchProvider } from '@/contexts/MatchContext';
import { SplashScreen } from '@/components/shared/SplashScreen';
import { ActivityTracker } from '@/components/shared/ActivityTracker';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';

// PERFORMANCE: Lazy load non-critical components to reduce cold start time
// These components are not needed until after the splash screen hides
const ScreenCaptureOverlay = lazy(() => import('@/components/shared/ScreenCaptureOverlay').then(m => ({ default: m.ScreenCaptureOverlay })));
const AppUpdateChecker = lazy(() => import('@/components/AppUpdateChecker'));
const WhatsNewModal = lazy(() => import('@/components/WhatsNewModal'));
import { loadSavedLanguage, isRTL, isI18nReady } from '@/lib/i18n';
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

// PERFORMANCE: Defer Sentry initialization to avoid blocking cold start
// Sentry.init() is heavyweight and can add 300-500ms to startup on low-RAM devices
// We'll initialize it after the first render via useEffect

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  // i18n is now initialized synchronously at module load - no blocking!
  const [i18nInitialized, setI18nInitialized] = useState(isI18nReady());
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
    // PERFORMANCE: All initialization is now non-blocking for faster cold start
    // on low-RAM devices (1.5-2 GB). Critical for 15% of our user base.

    // PERFORMANCE: Defer Sentry initialization until after first render
    // This removes 300-500ms from cold start time
    setTimeout(() => {
      try {
        initializeSentry();
      } catch (error) {
        console.error('Failed to initialize Sentry:', error);
      }
    }, 100); // Small delay to ensure first frame renders first

    // i18n is already initialized synchronously at module load
    // Just load saved language preference in background (don't block!)
    loadSavedLanguage().then(() => {
      // Sync RTL state after language loads
      const shouldBeRTL = isRTL();
      const currentlyRTL = I18nManager.isRTL;
      if (shouldBeRTL !== currentlyRTL) {
        I18nManager.forceRTL(shouldBeRTL);
        I18nManager.allowRTL(shouldBeRTL);
      }
    }).catch(console.error);

    // Initialize analytics in background (don't await)
    initializePostHog().catch(err => {
      console.error('PostHog initialization error:', err);
    });

    // Configure Google Sign-In for native authentication
    configureGoogleSignIn();

    // Track app lifecycle in background
    AsyncStorage.getItem('has_launched_before').then(hasLaunchedBefore => {
      const isFirstLaunch = !hasLaunchedBefore;

      if (isFirstLaunch) {
        const version = Application.nativeApplicationVersion || '1.0.0';
        const platform = Platform.OS as 'ios' | 'android';
        trackAppLifecycle.appInstalled(platform, version);
        AsyncStorage.setItem('has_launched_before', 'true').catch(console.error);
      }

      trackAppLifecycle.appStarted(isFirstLaunch);
    }).catch(console.error);

    // i18n is already ready - no need to wait
    setI18nInitialized(true);
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
            <AuthProvider>
              <ProfileDataProvider>
                <SubscriptionProvider>
                  <ToastProvider>
                    <MatchProvider>
                      <NotificationProvider>
                        <ActivityTracker />
                        {/* Only render Stack after i18n is initialized to prevent showing raw translation keys */}
                        {i18nInitialized ? (
                          <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 200 }}>
                            <Stack.Screen name="(tabs)" />
                            <Stack.Screen name="(auth)" />
                            <Stack.Screen name="(onboarding)" />
                            <Stack.Screen name="chat/[matchId]" options={{ animation: 'slide_from_right' }} />
                            <Stack.Screen name="profile/[id]" options={{ animation: 'fade_from_bottom' }} />
                          </Stack>
                        ) : null}
                        <StatusBar style={isDarkColorScheme ? 'light' : 'dark'} />

                        {/* Check for app updates - lazy loaded */}
                        {!showSplash && (
                          <Suspense fallback={null}>
                            <AppUpdateChecker />
                          </Suspense>
                        )}

                        {/* Show What's New modal after updates - lazy loaded */}
                        {!showSplash && (
                          <Suspense fallback={null}>
                            <WhatsNewModal />
                          </Suspense>
                        )}

                        {/* Overlay splash screen while initializing */}
                        {showSplash && (
                          <SplashScreen onFinish={() => setSplashAnimationDone(true)} />
                        )}

                        {/* Security overlay for screenshot protection (iOS) - lazy loaded */}
                        <Suspense fallback={null}>
                          <ScreenCaptureOverlay visible={showSecurityOverlay} />
                        </Suspense>
                      </NotificationProvider>
                    </MatchProvider>
                  </ToastProvider>
                </SubscriptionProvider>
              </ProfileDataProvider>
            </AuthProvider>
        </ThemeProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
