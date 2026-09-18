module.exports = {
  expo: {
    name: "Accord - Lavender Marriage",
    slug: "accord",
    version: "2.0.6",
    orientation: "default",
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    splash: {
      image: "./assets/icon.png",
      resizeMode: "contain",
      backgroundColor: "#000000"
    },
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      deploymentTarget: "16.0",
      supportsTablet: true,
      bundleIdentifier: "com.privyreviews.accord",
      buildNumber: "70",
      icon: "./assets/icon.png",
      infoPlist: {
        NSPhotoLibraryUsageDescription: "Accord needs access to your photos to upload profile pictures.",
        NSCameraUsageDescription: "Accord needs access to your camera to take profile photos.",
        NSLocationWhenInUseUsageDescription: "Accord uses your precise location to find compatible matches nearby and show accurate distances. Your exact coordinates are never shared with other users.",
        NSLocationDefaultAccuracyReduced: false,
        NSLocationTemporaryUsageDescriptionDictionary: {
          PreciseLocationPrompt: "Accord needs precise location to accurately calculate distances to potential matches. We respect your privacy and never share your exact coordinates."
        },
        NSMicrophoneUsageDescription: "Accord needs access to your microphone to record your voice introduction.",
        NSContactsUsageDescription: "Accord uses your contacts to help you avoid seeing people you know in your discovery feed. Phone numbers are encrypted on your device and never shared.",
        NSUserTrackingUsageDescription: "We use this to understand which features work best and improve your match quality. Your personal information always stays private.",
        CFBundleURLTypes: [
          {
            CFBundleURLSchemes: [
              "accord",
              "com.googleusercontent.apps.609854216709-81grqvlc66iahvd56749ot511p9agh09"
            ]
          }
        ]
      },
      config: {
        usesNonExemptEncryption: false
      },
      entitlements: {
        "com.apple.developer.applesignin": [
          "Default"
        ]
      },
      privacyManifests: {
        NSPrivacyTracking: false,
        NSPrivacyTrackingDomains: [],
        NSPrivacyCollectedDataTypes: [
          {
            NSPrivacyCollectedDataType: "NSPrivacyCollectedDataTypePreciseLocation",
            NSPrivacyCollectedDataTypeLinked: false,
            NSPrivacyCollectedDataTypeTracking: false,
            NSPrivacyCollectedDataTypePurposes: [
              "NSPrivacyCollectedDataTypePurposeAppFunctionality"
            ]
          }
        ]
      }
    },
    android: {
      minSdkVersion: 26,
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#9B87CE"
      },
      package: "com.privyreviews.accord",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      versionCode: 63,
      softwareKeyboardLayoutMode: "resize",
      permissions: [
        "android.permission.CAMERA",
        "android.permission.READ_MEDIA_IMAGES",
        "android.permission.ACCESS_FINE_LOCATION",
        "android.permission.ACCESS_COARSE_LOCATION",
        "android.permission.RECORD_AUDIO",
        "android.permission.READ_CONTACTS",
        "android.permission.POST_NOTIFICATIONS"
      ]
    },
    web: {
      bundler: "metro"
    },
    scheme: "accord",
    plugins: [
      [
        "react-native-edge-to-edge",
        {
          android: {
            parentTheme: "Default",
            enforceNavigationBarContrast: false
          }
        }
      ],
      "expo-router",
      "expo-dev-client",
      [
        "expo-image-picker",
        {
          photosPermission: "Accord needs access to your photos to upload profile pictures."
        }
      ],
      [
        "expo-location",
        {
          locationWhenInUsePermission: "Accord uses your location to find compatible matches nearby."
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/icon.png",
          color: "#9B87CE",
          sounds: [
            "./assets/notification_sound.wav"
          ],
          mode: "production"
        }
      ],
      "expo-secure-store",
      "expo-tracking-transparency",
      [
        "expo-contacts",
        {
          contactsPermission: "Accord uses your contacts to help you avoid seeing people you know in your discovery feed. Phone numbers are encrypted on your device and never shared."
        }
      ],
      [
        "react-native-capture-protection",
        {
          captureType: "callbackTiramisu"
        }
      ],
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme: "com.googleusercontent.apps.609854216709-81grqvlc66iahvd56749ot511p9agh09"
        }
      ],
      // AdMob (react-native-google-mobile-ads) REMOVED 2026-08-10 — it broke the
      // first native build it was ever included in, on BOTH platforms:
      //   Android: play-services-ads 25.4.0 is built with Kotlin 2.3.0, but
      //            Expo SDK 54 / RN 0.81 compiles with Kotlin 2.1.0.
      //   iOS:     pod install fails — AppCheckCore depends on GoogleUtilities
      //            and RecaptchaInterop, which don't define modules (needs
      //            use_modular_headers! / static frameworks).
      // It was added in July but never built, and rewarded ads can't ship
      // regardless (see FeatureFlags.REWARDED_LIKES_ENABLED — no SSV, no consent
      // flow). Rather than block a fix release on two speculative native fixes,
      // it comes out until the ads workstream is actually picked up.
      // To restore: re-add the dep + this plugin block, and recover lib/ads.ts
      // from commit 755b3bc. Pin play-services-ads to a Kotlin-2.1-compatible
      // release and solve the pod modular-headers issue at the same time.
      [
        // iOS pod install fails without this:
        //   "The Swift pod `AppCheckCore` depends upon `GoogleUtilities` and
        //    `RecaptchaInterop`, which do not define modules."
        // AppCheckCore arrives transitively via @react-native-google-signin.
        // ios/ is not checked in, so there's no Podfile.lock and pods re-resolve
        // on every build — a newer GoogleSignIn started pulling AppCheckCore,
        // which is why the May 2.0.5 build succeeded and 2.0.6 did not.
        //
        // Declaring the two offending pods with modular_headers generates the
        // module maps Swift needs. Deliberately NOT using
        // ios.useFrameworks:'static' — that is the broader documented fix, but it
        // changes linkage for EVERY pod and risks breaking Sentry, Skia and
        // quick-crypto. Escalate to it only if this proves insufficient.
        "expo-build-properties",
        {
          ios: {
            extraPods: [
              { name: "GoogleUtilities", modular_headers: true },
              { name: "RecaptchaInterop", modular_headers: true }
            ]
          }
        }
      ],
      "expo-font",
      "expo-localization",
      "expo-web-browser",
      "./plugins/withAndroidManifestFix.js",
      "./plugins/withDarkNavigationBar.js"
    ],
    extra: {
      router: {
        origin: false
      },
      eas: {
        projectId: "71ca414e-ff65-488b-97f6-9150455475a0"
      },
      // Keys are read from environment variables (set via `eas secret:create` for builds).
      // Fallbacks are provided for local development only.
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || "https://xcaktvlosjsaxcntxbyf.supabase.co",
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjYWt0dmxvc2pzYXhjbnR4YnlmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3ODIzOTIsImV4cCI6MjA3NTM1ODM5Mn0.XFYpZEcKiH8MQPDbONBBTqmXJ9KeUbbn5-ARGavXjKg",
      googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "609854216709-81grqvlc66iahvd56749ot511p9agh09.apps.googleusercontent.com",
      googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || "609854216709-ff54d58803kcbvpudv7aet8vo1bpq07g.apps.googleusercontent.com",
      revenueCatAppleApiKey: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY || "appl_enRnexAwhhNNHTGSZFUKzQBQefF",
      revenueCatGoogleApiKey: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY || "goog_mVpASFlCoMcDalaCseIhNnrnGto",
      postHogApiKey: process.env.EXPO_PUBLIC_POSTHOG_API_KEY || "phc_3KdZG8HkLD0v1YIGuR6khBLQGO41A8cerUmxa6EIEUG",
      postHogHost: process.env.EXPO_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com"
    },
    owner: "vfranz",
    // DELIBERATELY held at "2.0.5" while app version moves to 2.0.6, so a single
    // `eas update` still reaches BOTH the 2.0.5 and 2.0.6 binaries — the 2.0.5
    // install base stays the majority for weeks after a store release, and
    // splitting runtimes previously meant an update reaching only one platform.
    // 2.0.6 adds no new native modules (only the AdMob iOS App ID string, which
    // JS never reads — ads are behind a disabled flag), so JS stays compatible
    // with both binaries. BUMP THIS the moment a real native module is added,
    // or an OTA will crash 2.0.5 clients that lack the native code.
    runtimeVersion: "2.0.5",
    updates: {
      url: "https://u.expo.dev/71ca414e-ff65-488b-97f6-9150455475a0"
    }
  }
};
