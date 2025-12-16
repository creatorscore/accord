import Expo
import React
import ReactAppDependencyProvider
import TikTokBusinessSDK
import AppTrackingTransparency

@UIApplicationMain
public class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

#if os(iOS) || os(tvOS)
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "main",
      in: window,
      launchOptions: launchOptions)
#endif

    // Initialize TikTok Business SDK
    // Use configWithAccessToken to set access token during initialization (it's readonly after)
    let tiktokConfig = TikTokConfig(accessToken: "TTU0EP4k4Xx9xe1fx1FMX62rCgMI0KaU", appId: "7582252261456281618", tiktokAppId: "7582252261456281618")

    // TEMPORARY: Enable debug mode for TikTok verification
    // TODO: Set debugModeEnabled to false after TikTok verifies events are received correctly
    tiktokConfig?.enableDebugMode()  // Enables debug mode - test events will appear in TikTok Events Manager
    tiktokConfig?.setLogLevel(TikTokLogLevelDebug) // Enable verbose logging

    tiktokConfig?.disableAutomaticTracking()
    TikTokBusiness.initializeSdk(tiktokConfig) { success, error in
      if success {
        print("[TikTok SDK] Initialized successfully (DEBUG MODE ENABLED)")
        // Get the test event code for reference
        let testCode = TikTokBusiness.getTestEventCode() ?? "none"
        print("[TikTok SDK] Test Event Code: \(testCode)")
        // Send a test LaunchApp event to verify integration
        let launchEvent = TikTokBaseEvent(eventName: "LaunchAPP")
        TikTokBusiness.trackTTEvent(launchEvent)
        print("[TikTok SDK] Test LaunchAPP event sent")
      } else {
        print("[TikTok SDK] Initialization failed: \(error?.localizedDescription ?? "unknown error")")
      }
    }

    // Request ATT permission after a short delay (best practice for user experience)
    DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) {
      if #available(iOS 14, *) {
        ATTrackingManager.requestTrackingAuthorization { status in
          switch status {
          case .authorized:
            print("[ATT] User authorized tracking")
            TikTokBusiness.setTrackingEnabled(true)
          case .denied, .restricted:
            print("[ATT] User denied/restricted tracking")
            TikTokBusiness.setTrackingEnabled(false)
          case .notDetermined:
            print("[ATT] Not determined")
          @unknown default:
            break
          }
        }
      }
    }

    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  // Linking API
  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    return super.application(app, open: url, options: options) || RCTLinkingManager.application(app, open: url, options: options)
  }

  // Universal Links
  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let result = RCTLinkingManager.application(application, continue: userActivity, restorationHandler: restorationHandler)
    return super.application(application, continue: userActivity, restorationHandler: restorationHandler) || result
  }
}

class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  // Extension point for config-plugins

  override func sourceURL(for bridge: RCTBridge) -> URL? {
    // needed to return the correct URL for expo-dev-client.
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    return Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
