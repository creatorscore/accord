import { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
  AppState,
  AppStateStatus,
} from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

// Native in-app updates - uses Google Play Core on Android, App Store on iOS
// Only load on native platforms to avoid web bundling errors
let SpInAppUpdates: any = null;
let IAUUpdateKind: any = null;

if (Platform.OS !== 'web') {
  try {
    const inAppUpdatesModule = require('sp-react-native-in-app-updates');
    SpInAppUpdates = inAppUpdatesModule.default;
    IAUUpdateKind = inAppUpdatesModule.IAUUpdateKind;
  } catch (e) {
  }
}

// Get current app version from app.json
const CURRENT_VERSION = Constants.expoConfig?.version || '1.0.0';

// Store links - fallback if native update fails
const APP_STORE_URL = 'https://apps.apple.com/ca/app/accord-lavender-marriage/id6753855469';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.privyreviews.accord';

interface UpdateInfo {
  latest_version: string;
  minimum_version: string;
  minimum_version_ios?: string;
  minimum_version_android?: string;
  update_message?: string;
  is_forced: boolean;
  admin_test_update?: boolean; // Only show update modal to admins for testing
}

// Preview component for admins to test the update modal
export function UpdateModalPreview({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const mockInfo: UpdateInfo = {
    latest_version: '99.0.0',
    minimum_version: '99.0.0',
    is_forced: true,
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.screen}>
        <View style={styles.content}>
          <View style={styles.dots}>
            <View style={[styles.dot, styles.dotSmall, { left: '15%', top: 0 }]} />
            <View style={[styles.dot, styles.dotMedium, { right: '20%', top: 20 }]} />
            <View style={[styles.dot, styles.dotSmall, { left: '35%', top: 40 }]} />
          </View>
          <Text style={styles.emoji}>{'\u{1F527}'}</Text>
          <Text style={styles.title}>{"We've made some\nimportant changes"}</Text>
          <Text style={styles.body}>
            This version of Accord is no longer supported. Update to keep your conversations safe and everything running smoothly.
          </Text>
          <View style={styles.versionPill}>
            <Text style={styles.versionPillText}>
              v{CURRENT_VERSION}  →  v{mockInfo.latest_version}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity style={styles.updateButton} onPress={onClose} activeOpacity={0.85}>
            <Text style={styles.updateButtonText}>Update Accord</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.laterButton} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.laterButtonText}>Close Preview</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export default function AppUpdateChecker() {
  const [showFallbackModal, setShowFallbackModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isForced, setIsForced] = useState(false);
  const [isAdminTest, setIsAdminTest] = useState(false);
  const appState = useRef<AppStateStatus>(AppState.currentState);
  const inAppUpdates = useRef<any>(null);

  useEffect(() => {
    // Initialize native in-app updates
    if (SpInAppUpdates) {
      inAppUpdates.current = new SpInAppUpdates(false); // false = not debug mode
    }

    checkForUpdates();

    // Also check when app comes to foreground (user might have updated)
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        checkForUpdates();
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const compareVersions = (v1: string, v2: string): number => {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 < p2) return -1;
      if (p1 > p2) return 1;
    }
    return 0;
  };

  const checkForUpdates = async () => {
    try {
      // First, check our database for version requirements
      const { data, error } = await supabase
        .from('app_config')
        .select('*')
        .eq('key', 'app_version')
        .single();

      if (error || !data) {
        // Fall back to native store check
        await checkNativeUpdate(false);
        return;
      }

      const config = data.value as UpdateInfo;

      // Check if this is admin-only test mode
      if (config.admin_test_update) {
        // Only show to admins - check current user's admin status
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('user_id', user.id)
            .single();

          if (!profile?.is_admin) {
            return; // Not an admin, skip update check
          }
        } else {
          return; // No user, skip
        }
      }

      // Get platform-specific minimum version
      const minimumVersion = Platform.OS === 'ios'
        ? (config.minimum_version_ios || config.minimum_version)
        : (config.minimum_version_android || config.minimum_version);

      // Check if update is required (forced)
      const isForcedUpdate = compareVersions(CURRENT_VERSION, minimumVersion) < 0 || !!config.admin_test_update;
      const needsUpdate = compareVersions(CURRENT_VERSION, config.latest_version) < 0 || config.admin_test_update;

      if (!needsUpdate) {
        return; // Already up to date
      }

      setUpdateInfo(config);
      setIsForced(isForcedUpdate);
      setIsAdminTest(!!config.admin_test_update);

      // Try native in-app update first (skip for admin test since no real update exists)
      if (!config.admin_test_update) {
        const nativeUpdateShown = await checkNativeUpdate(isForcedUpdate);
        if (nativeUpdateShown) {
          return;
        }
      }

      // Show fallback modal for forced updates or admin test
      if (isForcedUpdate) {
        setShowFallbackModal(true);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  };

  const checkNativeUpdate = async (isForced: boolean): Promise<boolean> => {
    if (!inAppUpdates.current) {
      return false;
    }

    try {
      // Check if there's an update available from the store
      const result = await inAppUpdates.current.checkNeedsUpdate({
        curVersion: CURRENT_VERSION,
      });

      if (result.shouldUpdate) {
        // Show native update dialog
        if (Platform.OS === 'android') {
          // Android: Use Google Play Core In-App Updates
          // IMMEDIATE = full screen, blocks app until updated (for forced updates)
          // FLEXIBLE = shows banner, allows user to continue using app
          await inAppUpdates.current.startUpdate({
            updateType: isForced ? IAUUpdateKind.IMMEDIATE : IAUUpdateKind.FLEXIBLE,
          });
        } else {
          // iOS: Show App Store prompt
          await inAppUpdates.current.startUpdate({
            title: isForced ? 'Update Required' : 'Update Available',
            message: isForced
              ? 'A new version of Accord is required to continue. Please update now.'
              : 'A new version of Accord is available with improvements and bug fixes.',
            buttonUpgradeText: 'Update Now',
            buttonCancelText: isForced ? undefined : 'Later',
            forceUpgrade: isForced,
          });
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('Native update check failed:', error);
      return false;
    }
  };

  const handleUpdate = () => {
    const storeUrl = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    Linking.openURL(storeUrl).catch(() => {});
  };

  const handleLater = () => {
    if (!isForced || isAdminTest) {
      setShowFallbackModal(false);
    }
  };

  // Fallback modal - only shown if native update dialog fails
  if (!showFallbackModal || !updateInfo) {
    return null;
  }

  return (
    <Modal
      visible={showFallbackModal}
      animationType="fade"
      onRequestClose={handleLater}
      statusBarTranslucent
    >
      <View style={styles.screen}>
        <View style={styles.content}>
          {/* Decorative dots */}
          <View style={styles.dots}>
            <View style={[styles.dot, styles.dotSmall, { left: '15%', top: 0 }]} />
            <View style={[styles.dot, styles.dotMedium, { right: '20%', top: 20 }]} />
            <View style={[styles.dot, styles.dotSmall, { left: '35%', top: 40 }]} />
          </View>

          {/* Emoji — simple, human, no gradient blob */}
          <Text style={styles.emoji}>
            {isForced ? '\u{1F527}' : '\u{2728}'}
          </Text>

          {/* Headline */}
          <Text style={styles.title}>
            {isForced
              ? "We've made some\nimportant changes"
              : "Something new\nis waiting for you"}
          </Text>

          {/* Body */}
          <Text style={styles.body}>
            {updateInfo.update_message
              ? updateInfo.update_message
              : isForced
                ? "This version of Accord is no longer supported. Update to keep your conversations safe and everything running smoothly."
                : "A newer version of Accord is available with improvements you'll appreciate."}
          </Text>

          {/* Version pill */}
          <View style={styles.versionPill}>
            <Text style={styles.versionPillText}>
              v{CURRENT_VERSION}  →  v{updateInfo.latest_version}
            </Text>
          </View>
        </View>

        {/* Bottom actions — anchored to bottom */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.updateButton}
            onPress={handleUpdate}
            activeOpacity={0.85}
          >
            <Text style={styles.updateButtonText}>Update Accord</Text>
          </TouchableOpacity>

          {(!isForced || isAdminTest) && (
            <TouchableOpacity
              style={styles.laterButton}
              onPress={handleLater}
              activeOpacity={0.7}
            >
              <Text style={styles.laterButtonText}>
                {isAdminTest ? 'Close (Admin Test)' : 'Not now'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FAFAFA',
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  dots: {
    position: 'absolute',
    top: '18%',
    left: 0,
    right: 0,
    height: 60,
  },
  dot: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: '#E8E0F0',
  },
  dotSmall: {
    width: 8,
    height: 8,
  },
  dotMedium: {
    width: 12,
    height: 12,
    backgroundColor: '#D5CAE8',
  },
  emoji: {
    fontSize: 56,
    marginBottom: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A2E',
    textAlign: 'center',
    lineHeight: 36,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    color: '#6B6B80',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
    marginBottom: 24,
  },
  versionPill: {
    backgroundColor: '#F0ECF5',
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  versionPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B7AAD',
    letterSpacing: 0.3,
  },
  actions: {
    paddingHorizontal: 24,
    paddingBottom: 48,
    paddingTop: 12,
  },
  updateButton: {
    backgroundColor: '#1A1A2E',
    paddingVertical: 18,
    borderRadius: 16,
    width: '100%',
    marginBottom: 12,
  },
  updateButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  laterButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  laterButtonText: {
    color: '#9B9BAD',
    fontSize: 15,
    fontWeight: '500',
  },
});
