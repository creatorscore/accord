module.exports = {
  expo: {
    name: "Accord - Lavender Marriage",
    slug: "accord",
    version: "2.0.3",
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
      supportsTablet: true,
      bundleIdentifier: "com.privyreviews.accord",
      buildNumber: "67",
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
      adaptiveIcon: {
        foregroundImage: "./assets/icon.png",
        backgroundColor: "#9B87CE"
      },
      package: "com.privyreviews.accord",
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON || "./google-services.json",
      versionCode: 59,
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
    runtimeVersion: "2.0.3",
    updates: {
      url: "https://u.expo.dev/71ca414e-ff65-488b-97f6-9150455475a0"
    }
  }
};
