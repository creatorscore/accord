import { useState, useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { registerForPushNotifications } from '@/lib/notifications';
import { openAppSettings } from '@/lib/open-settings';

interface Props {
  onGranted: () => void;
  onContinue?: () => void;
  granted?: boolean;
}

export default function NotificationsStep({ onGranted, onContinue, granted = false }: Props) {
  const isDark = useColorScheme() === 'dark';
  const [requesting, setRequesting] = useState(false);
  const [denied, setDenied] = useState(false);
  const advanceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (advanceTimeoutRef.current) clearTimeout(advanceTimeoutRef.current);
  }, []);

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const token = await registerForPushNotifications();
      if (token) {
        onGranted();
        if (onContinue) {
          advanceTimeoutRef.current = setTimeout(onContinue, 700);
        }
      } else {
        setDenied(true);
      }
    } catch (error: any) {
      console.error('[NotificationsStep] ERROR:', error?.message, error);
      setDenied(true);
    } finally {
      setRequesting(false);
    }
  };

  const iconName = granted ? 'bell-check' : denied ? 'bell-off-outline' : 'bell-ring-outline';

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: isDark ? '#2C2C3E' : '#F5F2F7' }]}>
        <MaterialCommunityIcons name={iconName} size={52} color="#A08AB7" />
      </View>

      <Text style={[styles.description, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
        We'll notify you when someone likes you, matches with you, or sends you a message.
      </Text>

      {granted ? (
        <View style={[styles.statusCard, { backgroundColor: isDark ? 'rgba(160,138,183,0.12)' : '#F3F0F7' }]}>
          <MaterialCommunityIcons name="check-circle" size={24} color="#A08AB7" />
          <Text style={[styles.statusText, { color: isDark ? '#D4C4E8' : '#A08AB7' }]}>
            Notifications enabled
          </Text>
        </View>
      ) : denied ? (
        <>
          <View style={[styles.statusCard, { backgroundColor: isDark ? 'rgba(156,163,175,0.12)' : '#F3F4F6' }]}>
            <MaterialCommunityIcons name="bell-off-outline" size={22} color={isDark ? '#9CA3AF' : '#6B7280'} />
            <Text style={[styles.statusText, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
              Notifications off
            </Text>
          </View>
          <Text style={[styles.deniedHint, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            No problem — tap Continue to keep going. You can enable notifications anytime in Settings.
          </Text>
          <TouchableOpacity
            onPress={openAppSettings}
            activeOpacity={0.7}
            style={styles.linkButton}
            accessibilityRole="button"
            accessibilityLabel="Open device settings to enable notifications"
          >
            <Text style={styles.linkText}>Open Settings</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <TouchableOpacity
            style={[styles.button, requesting && styles.buttonDisabled]}
            onPress={handleEnable}
            disabled={requesting}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={requesting ? 'Enabling notifications' : 'Enable push notifications'}
            accessibilityState={{ disabled: requesting }}
          >
            <MaterialCommunityIcons name="bell" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>
              {requesting ? 'Enabling...' : 'Enable Notifications'}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.skipHint, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
            You can always enable this later in Settings
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingTop: 32,
  },
  iconCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 36,
    paddingHorizontal: 8,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#A08AB7',
    paddingHorizontal: 36,
    paddingVertical: 18,
    borderRadius: 50,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 17,
    fontWeight: '600',
  },
  deniedHint: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 16,
    paddingHorizontal: 24,
  },
  linkButton: {
    marginTop: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  linkText: {
    color: '#A08AB7',
    fontSize: 15,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  skipHint: {
    fontSize: 13,
    marginTop: 20,
    textAlign: 'center',
  },
});
