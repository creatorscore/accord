// Import WebCrypto polyfill FIRST (enables crypto.subtle in React Native)
import 'expo-standard-web-crypto';

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { I18nManager, Platform, processColor, View, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
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
import { loadSavedLanguage, isRTL, isI18nReady } from '@/lib/i18n';
import { initializeSentry } from '@/lib/sentry';
import { getPostHogClient, trackAppLifecycle, flushPostHog } from '@/lib/analytics';
import { PostHogProvider } from 'posthog-react-native';
import { configureGoogleSignIn } from '@/lib/auth-providers';
import { useScreenCaptureProtection } from '@/hooks/useScreenCaptureProtection';
import { useColorScheme, useInitializeColorScheme } from '@/lib/useColorScheme';
import { SystemBars } from 'react-native-edge-to-edge';
import { NAV_THEME } from '@/theme';
import { fontAssets } from '@/lib/fonts';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import '../global.css';

// PERFORMANCE: Lazy load non-critical components to reduce cold start time
// These components are not needed until after the splash screen hides
const ScreenCaptureOverlay = lazy(() => import('@/components/shared/ScreenCaptureOverlay').then(m => ({ default: m.ScreenCaptureOverlay })));
const AppUpdateChecker = lazy(() => import('@/components/AppUpdateChecker'));
const WhatsNewModal = lazy(() => import('@/components/WhatsNewModal'));
const GenderConfirmationModal = lazy(() => import('@/components/GenderConfirmationModal'));

// Prevent splash screen from hiding until fonts are loaded
SplashScreenExpo.preventAutoHideAsync();

/**
 * Permanent dark overlay covering the system navigation bar / home indicator area.
 * react-native-edge-to-edge forces the system bar transparent, so whatever renders
 * behind it determines the visible color. This overlay sits on TOP of all screen
 * content (zIndex 9999) with pointerEvents="none" so touches pass through.
 * Height = exactly the safe-area bottom inset (home indicator on iOS, gesture bar on Android).
 */
function BottomBarBackground() {
  const insets = useSafeAreaInsets();
  // On Android, always render with a fallback height even when insets.bottom is 0
  // (e.g. 3-button nav or initial render). This prevents the white React Navigation
  // background from bleeding through the transparent system nav bar.
  const height = Platform.OS === 'android'
    ? Math.max(insets.bottom, 48)
    : insets.bottom;
  if (height === 0) return null;
  return (
    <View
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height,
        backgroundColor: '#0A0A0B',
        zIndex: 9999,
        elevation: 9999, // Native z-ordering on Android (zIndex is JS-only)
      }}
      pointerEvents="none"
    />
  );
}

// PERFORMANCE: Defer Sentry initialization to avoid blocking cold start
// Sentry.init() is heavyweight and can add 300-500ms to startup on low-RAM devices
// We'll initialize it after the first render via useEffect

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  // i18n is now initialized synchronously at module load - no blocking!
  const [i18nInitialized, setI18nInitialized] = useState(isI18nReady());
  const [splashAnimationDone, setSplashAnimationDone] = useState(false);

  // Initialize PostHog client synchronously (memoized so it's created once)
  const posthogClient = useMemo(() => getPostHogClient(), []);

  // Load custom fonts (Plus Jakarta Sans + Inter)
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  // Initialize color scheme from storage
  useInitializeColorScheme();

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

  // Force Android navigation bar to dark (#0A0A0B) on mount, foreground, AND
  // color scheme changes. react-native-edge-to-edge may reset the nav bar color
  // when the theme changes, so we must re-apply on every colorScheme transition.
  useEffect(() => {
    const setAndroidNavBarDark = () => {
      if (Platform.OS !== 'android') return;
      try {
        const ExpoNavigationBar = require('expo-navigation-bar/build/ExpoNavigationBar').default;
        const color = processColor('#0A0A0B');
        if (ExpoNavigationBar?.setBackgroundColorAsync && color != null) {
          ExpoNavigationBar.setBackgroundColorAsync(color);
        }
      } catch {
        // Silently ignore if module not available
      }
    };

    // Apply immediately on mount and on every colorScheme change
    setAndroidNavBarDark();

    // Re-apply every time the app comes back to foreground
    // Also flush PostHog events when app goes to background
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setAndroidNavBarDark();
      } else if (state === 'background') {
        flushPostHog();
      }
    });

    return () => subscription.remove();
  }, [colorScheme]);

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

    // Configure Google Sign-In for native authentication
    configureGoogleSignIn();

    // Track app lifecycle (PostHog client is created synchronously by getPostHogClient)
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
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0A0A0B' }} onLayout={onLayoutRootView}>
        <PostHogProvider client={posthogClient} autocapture>
        <BottomSheetModalProvider>
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
                            <Stack.Screen name="index" />
                            <Stack.Screen name="(tabs)" />
                            <Stack.Screen name="(auth)" />
                            <Stack.Screen name="(onboarding)" />
                            <Stack.Screen name="auth" />
                            <Stack.Screen name="chat/[matchId]" options={{ animation: 'slide_from_right' }} />
                            <Stack.Screen name="profile" options={{ animation: 'fade_from_bottom' }} />
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

                        {/* One-time gender confirmation for migrated users */}
                        {!showSplash && (
                          <Suspense fallback={null}>
                            <GenderConfirmationModal />
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

                        {/* Set navigation bar icon style (light icons for dark background) */}
                        <SystemBars style={{ navigationBar: 'light' }} />

                        {/* Always-dark overlay behind system navigation bar / home indicator */}
                        <BottomBarBackground />
                      </NotificationProvider>
                    </MatchProvider>
                  </ToastProvider>
                </SubscriptionProvider>
              </ProfileDataProvider>
            </AuthProvider>
        </ThemeProvider>
        </BottomSheetModalProvider>
        </PostHogProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
