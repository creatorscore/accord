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
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
    console.log('sp-react-native-in-app-updates not available');
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
        console.log('No app version config found, trying native update check');
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
            console.log('Admin test update mode - skipping for non-admin');
            return; // Not an admin, skip update check
          }
          console.log('Admin test update mode - showing update dialog');
        } else {
          return; // No user, skip
        }
      }

      // Get platform-specific minimum version
      const minimumVersion = Platform.OS === 'ios'
        ? (config.minimum_version_ios || config.minimum_version)
        : (config.minimum_version_android || config.minimum_version);

      // Check if update is required (forced)
      const isForcedUpdate = compareVersions(CURRENT_VERSION, minimumVersion) < 0 || config.admin_test_update;
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
      console.log('Native in-app updates not available');
      return false;
    }

    try {
      // Check if there's an update available from the store
      const result = await inAppUpdates.current.checkNeedsUpdate({
        curVersion: CURRENT_VERSION,
      });

      console.log('Native update check result:', result);

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
    Linking.openURL(storeUrl);
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
      transparent
      animationType="fade"
      onRequestClose={handleLater}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <LinearGradient
              colors={['#9B87CE', '#B8A9DD']}
              style={styles.iconGradient}
            >
              <MaterialCommunityIcons
                name={isForced ? 'alert-circle' : 'arrow-up-circle'}
                size={48}
                color="#FFF"
              />
            </LinearGradient>
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {isForced ? 'Update Required' : 'Update Available'}
          </Text>

          {/* Version info */}
          <Text style={styles.versionText}>
            Version {updateInfo.latest_version} is available
          </Text>
          <Text style={styles.currentVersion}>
            You have version {CURRENT_VERSION}
          </Text>

          {/* Message */}
          {updateInfo.update_message && (
            <Text style={styles.message}>{updateInfo.update_message}</Text>
          )}

          {/* Forced update warning */}
          {isForced && (
            <View style={styles.warningBox}>
              <MaterialCommunityIcons name="information" size={20} color="#DC2626" />
              <Text style={styles.warningText}>
                This update is required to continue using Accord
              </Text>
            </View>
          )}

          {/* Buttons */}
          <TouchableOpacity style={styles.updateButton} onPress={handleUpdate}>
            <Text style={styles.updateButtonText}>Update Now</Text>
          </TouchableOpacity>

          {(!isForced || isAdminTest) && (
            <TouchableOpacity style={styles.laterButton} onPress={handleLater}>
              <Text style={styles.laterButtonText}>
                {isAdminTest ? 'Close (Admin Test)' : 'Maybe Later'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: 20,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  versionText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 4,
  },
  currentVersion: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  message: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    gap: 8,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
  },
  updateButton: {
    backgroundColor: '#9B87CE',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 24,
    width: '100%',
    marginBottom: 12,
  },
  updateButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  laterButton: {
    paddingVertical: 12,
  },
  laterButtonText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '500',
  },
});
