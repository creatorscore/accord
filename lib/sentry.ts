import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

// UUID pattern for redaction (prevents identifying users from breadcrumb URLs)
const UUID_REGEX = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

function redactUUIDs(value: string): string {
  return value.replace(UUID_REGEX, '[REDACTED]');
}

// Identity fields that must never leak to error tracking — exposure = prosecution risk
const SENSITIVE_IDENTITY_KEYS = [
  'gender', 'sexual_orientation', 'ethnicity', 'religion', 'political_views',
  'display_name', 'occupation', 'education', 'hometown', 'pronouns',
  'latitude', 'longitude', 'location_city', 'location_state', 'location_country',
  'bio', 'my_story', 'birth_date',
];

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
        // Can appear as JS "Invariant Violation" or native C++ exception (N8facebook3jsi7JSErrorE)
        if ((errorType === 'Invariant Violation' || errorType === 'C++ Exception') &&
            errorMessage.includes('NativeEventEmitter') &&
            errorMessage.includes('non-null argument')) {
          return null;
        }

        // Drop C++ JSI bridge crashes with no useful JS stack — native RN internals
        // The type/message split varies: type may be "C++ Exception" with message containing the
        // mangled name, OR type may be the mangled name itself (e.g. "N8facebook3jsi7JSErrorE")
        const fullErrorStr = `${errorType}: ${errorMessage}`;
        if ((fullErrorStr.includes('N8facebook3jsi7JSErrorE') || fullErrorStr.includes('jsi7JSError')) &&
            (errorMessage === '(null)' || errorMessage === '' || fullErrorStr.includes('(null)'))) {
          const frames = event.exception?.values?.[0]?.stacktrace?.frames || [];
          const hasAppFrames = frames.some((f: any) => f.in_app === true && f.filename && !f.filename.includes('node_modules'));
          if (!hasAppFrames) {
            return null;
          }
        }

        // Drop RenderScript crashes — Android blur effects on older/low-end devices, not actionable
        // These can appear as errorType or errorMessage depending on the crash variant
        if (errorType.includes('rsdScript') || errorType.includes('renderscript') ||
            errorMessage.includes('rsdScriptSetGlobalVar') || errorMessage.includes('rsdScriptSetGlobalObj') ||
            (errorType === 'SIGSEGV' && errorMessage.includes('RsdCpuScriptImpl'))) {
          return null;
        }

        // Drop android::renderscript::ObjectBase crashes — RenderScript destructor/lock failures
        if (errorType.includes('ObjectBase') && errorType.includes('renderscript')) {
          return null;
        }

        // Drop OS watchdog terminations — device killed app for RAM pressure, not actionable
        if (errorType === 'WatchdogTermination' || errorMessage.includes('The OS watchdog terminated')) {
          return null;
        }

        // Drop Android SurfaceControl NPE — framework bug in view lifecycle
        if (errorType === 'NullPointerException' && errorMessage.includes('SurfaceControl')) {
          return null;
        }

        // Drop JSApplicationIllegalArgumentException for animated nodes —
        // Fabric renderer race condition (addAnimatedEventToView, similar to connectAnimatedNodes)
        if (errorType === 'JSApplicationIllegalArgumentException' &&
            errorMessage.includes('addAnimatedEventToView')) {
          return null;
        }

        // Drop native abort() crashes with no app frames — system/driver bugs
        if (errorType === 'abort' || (errorType === 'SIGABRT' && errorMessage === 'abort')) {
          const frames = event.exception?.values?.[0]?.stacktrace?.frames || [];
          const hasAppFrames = frames.some((f: any) => f.in_app === true);
          if (!hasAppFrames) {
            return null;
          }
        }

        // Drop Expo asset download failures — font/asset bundling issues on specific devices
        if (errorMessage.includes('ExpoAsset.downloadAsync') ||
            errorMessage.includes('Unable to download asset from url')) {
          return null;
        }

        // Drop DeadSystemException — Android OS process died, app can't recover
        if (errorType === 'DeadSystemRuntimeException' || errorMessage.includes('DeadSystemException')) {
          return null;
        }

        // Drop NSInternalInconsistencyException — iOS UIKit internal assertion failures
        if (errorType === 'NSInternalInconsistencyException') {
          return null;
        }

        // Drop React Native ShadowNode destructor crashes — Fabric renderer internals
        if (errorType.includes('ShadowNode') || errorType.includes('facebook::react::')) {
          return null;
        }

        // Drop "navigate before Root Layout" — Expo Router timing race on cold start
        if (errorMessage.includes('Attempted to navigate before mounting the Root Layout')) {
          return null;
        }

        // Drop ExpoFontLoader crashes — font file empty/corrupt on budget devices (storage issue)
        if (errorMessage.includes('ExpoFontLoader.loadAsync') || errorMessage.includes('Font file for')) {
          return null;
        }

        // Drop RNCDatePicker Activity detachment — OS destroyed Activity while picker was open
        if (errorMessage.includes('RNCDatePicker') && errorMessage.includes('not attached to an Activity')) {
          return null;
        }

        // Drop IllegalStateException onSaveInstanceState — Android fragment lifecycle race
        // errorType can be "IllegalStateException" (native) or just "Error" when bridged to JS
        // via onunhandledrejection, so also check the message for the Java class name
        if ((errorType.includes('IllegalStateException') || errorMessage.includes('IllegalStateException')) && errorMessage.includes('onSaveInstanceState')) {
          return null;
        }

        // Drop JNI_OnLoad native crashes — library initialization failures, not actionable
        if (errorType === 'JNI_OnLoad') {
          return null;
        }

        // Drop C++ JSI bridge errors more broadly — check type directly
        // Covers mangled C++ names like N8facebook3jsi*, facebook::react::*, etc.
        if (errorType.includes('N8facebook') || errorType.includes('jsi7JSError') ||
            errorType.includes('facebook::react')) {
          const frames = event.exception?.values?.[0]?.stacktrace?.frames || [];
          const hasAppFrames = frames.some((f: any) => f.in_app === true && f.filename && !f.filename.includes('node_modules'));
          if (!hasAppFrames) {
            return null;
          }
        }

        // Remove potentially sensitive user data
        if (event.user) {
          delete event.user.email;
          delete event.user.ip_address;
          delete event.user.username;
        }

        // Sanitize breadcrumbs — strip identity data, redact UUIDs, remove request/response bodies
        if (event.breadcrumbs) {
          event.breadcrumbs = event.breadcrumbs.map((breadcrumb: any) => {
            // Redact UUIDs from navigation breadcrumbs (profile/chat URLs contain user IDs)
            if (breadcrumb.category === 'navigation' || breadcrumb.category === 'route') {
              if (breadcrumb.message) {
                breadcrumb.message = redactUUIDs(breadcrumb.message);
              }
              if (breadcrumb.data) {
                const sanitized = { ...breadcrumb.data };
                for (const key of Object.keys(sanitized)) {
                  if (typeof sanitized[key] === 'string') {
                    sanitized[key] = redactUUIDs(sanitized[key]);
                  }
                }
                breadcrumb.data = sanitized;
              }
            }

            if (breadcrumb.data) {
              const sanitized = { ...breadcrumb.data };

              // Remove auth/credential fields
              for (const key of ['password', 'token', 'authorization', 'cookie', 'secret', 'api_key', 'apiKey']) {
                delete sanitized[key];
              }

              // Remove request/response bodies (may contain profile data with orientation/gender)
              for (const key of ['request', 'response', 'body', 'requestBody', 'responseBody', 'request_body', 'response_body']) {
                delete sanitized[key];
              }

              // Strip LGBTQ+ identity fields if they appear in breadcrumb data
              for (const key of SENSITIVE_IDENTITY_KEYS) {
                delete sanitized[key];
              }

              breadcrumb.data = sanitized;
            }

            return breadcrumb;
          });
        }

        // Strip identity fields from event extras/contexts
        if (event.extra) {
          for (const key of SENSITIVE_IDENTITY_KEYS) {
            delete event.extra[key];
          }
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
