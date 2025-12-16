import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

// Get current app version from app.json
const CURRENT_VERSION = Constants.expoConfig?.version || '1.0.0';

// Store links - verified URLs
const APP_STORE_URL = 'https://apps.apple.com/ca/app/accord-lavender-marriage/id6753855469';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.privyreviews.accord';

interface UpdateInfo {
  latest_version: string;
  minimum_version: string;
  minimum_version_ios?: string;
  minimum_version_android?: string;
  update_message?: string;
  is_forced: boolean;
}

export default function AppUpdateChecker() {
  const [showModal, setShowModal] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [isForced, setIsForced] = useState(false);

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      // Fetch latest version info from database
      const { data, error } = await supabase
        .from('app_config')
        .select('*')
        .eq('key', 'app_version')
        .single();

      if (error || !data) {
        console.log('No app version config found');
        return;
      }

      const config = data.value as UpdateInfo;

      // Get platform-specific minimum version, fallback to general minimum_version
      const minimumVersion = Platform.OS === 'ios'
        ? (config.minimum_version_ios || config.minimum_version)
        : (config.minimum_version_android || config.minimum_version);

      // Compare versions
      const needsUpdate = compareVersions(CURRENT_VERSION, config.latest_version) < 0;
      const isForcedUpdate = compareVersions(CURRENT_VERSION, minimumVersion) < 0;

      if (needsUpdate) {
        setUpdateInfo(config);
        setIsForced(isForcedUpdate);
        setShowModal(true);
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
    }
  };

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

  const handleUpdate = () => {
    const storeUrl = Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
    Linking.openURL(storeUrl);
  };

  const handleLater = () => {
    if (!isForced) {
      setShowModal(false);
    }
  };

  if (!showModal || !updateInfo) {
    return null;
  }

  return (
    <Modal
      visible={showModal}
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

          {!isForced && (
            <TouchableOpacity style={styles.laterButton} onPress={handleLater}>
              <Text style={styles.laterButtonText}>Maybe Later</Text>
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
