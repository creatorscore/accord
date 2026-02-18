import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

/**
 * Initialize Sentry for error tracking
 * Call this once when the app starts (in _layout.tsx)
 */
export const initializeSentry = () => {
  // Only initialize if DSN is configured
  if (!SENTRY_DSN) {
    return;
  }

  // Allow testing in dev mode for onboarding
  try {
    Sentry.init({
      dsn: SENTRY_DSN,

      // Enable automatic session tracking
      enableAutoSessionTracking: true,

      // Session tracking interval (30 seconds)
      sessionTrackingIntervalMillis: 30000,

      // Enable automatic breadcrumbs for navigation, console logs, etc.
      enableAutoPerformanceTracing: true,

      // Set release version
      release: `accord@${Constants.expoConfig?.version || '1.0.0'}`,
      dist: `${Platform.OS}-${Constants.expoConfig?.ios?.buildNumber || Constants.expoConfig?.android?.versionCode || '1'}`,

      // Environment
      environment: __DEV__ ? 'development' : 'production',

      // Sample rate for error events (100% = all errors)
      sampleRate: 1.0,

      // Sample rate for performance monitoring (adjust based on traffic)
      tracesSampleRate: 0.2, // 20% of transactions

      // Filter out sensitive data and handle known device-side errors
      beforeSend(event: any) {
        const errorMessage = event.exception?.values?.[0]?.value || '';
        const errorType = event.exception?.values?.[0]?.type || '';

        // Drop all development environment events — not actionable in Sentry
        if (event.environment === 'development') {
          return null;
        }

        // Check if this is a device storage space error (user's device is full)
        const isStorageSpaceError =
          errorMessage.includes('out of space') ||
          errorMessage.includes('No space left on device') ||
          errorMessage.includes('Code=640') ||
          errorMessage.includes('Code=28');

        if (isStorageSpaceError) {
          // Drop entirely — device is out of space, not actionable
          return null;
        }

        // Drop all ANRs — nearly always system/device issues, not actionable from app code
        // Covers: background ANRs, AppExitInfo reports, low-end device stalls,
        // malloc stalls, Vsync deadlocks, Choreographer hangs, etc.
        if (errorType === 'ApplicationNotResponding') {
          return null;
        }

        // Drop iOS AppHang events — almost always system-level stalls, not actionable
        // Covers: UIKeyboardTaskQueue deadlocks, CFRunLoop stalls, UIKit snapshotting, etc.
        if (errorType === 'App Hanging') {
          return null;
        }

        // Drop Android SplashScreenView NPE — OEM firmware bug, no app frames
        if (errorType === 'NullPointerException' && errorMessage.includes('SplashScreenView')) {
          return null;
        }

        // Drop known React Native framework crashes — not actionable
        // IndexOutOfBoundsException in ReactViewGroup drawing order race condition
        if (errorType === 'IndexOutOfBoundsException' && errorMessage.includes('getChildDrawingOrder')) {
          return null;
        }

        // Drop Fabric renderer race condition — view unmounted before mounting completes
        if (errorType === 'RetryableMountingLayerException') {
          return null;
        }

        // Drop RenderScript context crashes from expo-blur on older Android devices
        if (errorType === 'RSInvalidStateException') {
          return null;
        }

        // Drop native crashes with no app frames (system-only stack traces)
        // e.g., EXC_BAD_ACCESS in UIKit, SIGABRT in libc — not actionable
        if (errorType === 'EXC_BAD_ACCESS' || errorType === 'SIGABRT') {
          const frames = event.exception?.values?.[0]?.stacktrace?.frames || [];
          const hasAppFrames = frames.some((f: any) => f.in_app === true);
          if (!hasAppFrames) {
            return null;
          }
        }

        // Drop all SIGSEGV crashes with no app frames — system/driver bugs, not actionable
        // Covers RenderScript (libRSDriver.so), GPU drivers, libc, etc.
        if (errorType === 'SIGSEGV') {
          const frames = event.exception?.values?.[0]?.stacktrace?.frames || [];
          const hasAppFrames = frames.some((f: any) => f.in_app === true);
          if (!hasAppFrames) {
            return null;
          }
        }

        // Drop React Native animated node race conditions — Fabric renderer timing issue
        if (errorType === 'JSApplicationIllegalArgumentException' &&
            errorMessage.includes('connectAnimatedNodes')) {
          return null;
        }

        // Drop iOS CALayerInvalid — Core Animation layer cycle, system/RN bug
        if (errorType === 'CALayerInvalid') {
          return null;
        }

        // Drop NativeEventEmitter null argument — deprecated RN modules on newer OS versions
        if (errorType === 'Invariant Violation' &&
            errorMessage.includes('NativeEventEmitter') &&
            errorMessage.includes('non-null argument')) {
          return null;
        }

        // Remove potentially sensitive user data
        if (event.user) {
          delete event.user.email;
          delete event.user.ip_address;
        }

        // Filter out password fields from breadcrumbs
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map((breadcrumb: any) => {
            if (breadcrumb.data) {
              const sanitized = { ...breadcrumb.data };
              if ('password' in sanitized) delete sanitized.password;
              if ('token' in sanitized) delete sanitized.token;
              breadcrumb.data = sanitized;
            }
            return breadcrumb;
          });
        }

        return event;
      },
    });

  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
  }
};

/**
 * Capture an exception manually
 */
export const captureException = (error: Error, context?: Record<string, any>) => {
  if (!SENTRY_DSN) {
    console.error('Exception (Sentry not configured):', error, context);
    return;
  }

  Sentry.captureException(error, {
    extra: context,
  });
};

/**
 * Capture a message (non-error event)
 */
export const captureMessage = (message: string, level: 'info' | 'warning' | 'error' = 'info', context?: Record<string, any>) => {
  if (!SENTRY_DSN) {
    return;
  }

  Sentry.captureMessage(message, {
    level,
    extra: context,
  });
};

/**
 * Set user context for error reports
 */
export const setUser = (user: { id: string; email?: string; username?: string } | null) => {
  if (!SENTRY_DSN || __DEV__) return;

  if (user) {
    Sentry.setUser({
      id: user.id,
      // Don't send email to Sentry for privacy
      username: user.username,
    });
  } else {
    Sentry.setUser(null);
  }
};

/**
 * Add breadcrumb (trail of events leading to an error)
 */
export const addBreadcrumb = (category: string, message: string, data?: Record<string, any>) => {
  if (!SENTRY_DSN || __DEV__) return;

  Sentry.addBreadcrumb({
    category,
    message,
    data,
    level: 'info',
  });
};

/**
 * Set custom context/tags for error reports
 */
export const setContext = (key: string, value: Record<string, any>) => {
  if (!SENTRY_DSN || __DEV__) return;

  Sentry.setContext(key, value);
};

export const setTag = (key: string, value: string) => {
  if (!SENTRY_DSN || __DEV__) return;

  Sentry.setTag(key, value);
};

// Export Sentry for advanced use cases
export { Sentry };
