import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { registerForPushNotifications } from '@/lib/notifications';
import { openAppSettings } from '@/lib/open-settings';

interface Props {
  onGranted: () => void;
  granted?: boolean;
}

export default function NotificationsStep({ onGranted, granted = false }: Props) {
  const isDark = useColorScheme() === 'dark';
  const [requesting, setRequesting] = useState(false);

  console.log('[NotificationsStep] render — granted prop:', granted);

  const handleEnable = async () => {
    console.log('[NotificationsStep] Enable button pressed');
    setRequesting(true);
    try {
      console.log('[NotificationsStep] Calling registerForPushNotifications...');
      const token = await registerForPushNotifications();
      console.log('[NotificationsStep] Token result:', token);
      if (token) {
        console.log('[NotificationsStep] Calling onGranted()');
        onGranted();
      } else {
        console.log('[NotificationsStep] No token returned');
        Alert.alert(
          'Notifications Disabled',
          'You can enable notifications later in Settings.',
          [
            { text: 'Open Settings', onPress: openAppSettings },
            { text: 'OK' },
          ]
        );
      }
    } catch (error: any) {
      console.error('[NotificationsStep] ERROR:', error.message, error);
      Alert.alert('Error', 'Failed to enable notifications. You can try again later in Settings.');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: isDark ? '#2C2C3E' : '#F5F2F7' }]}>
        <MaterialCommunityIcons name={granted ? 'bell-check' : 'bell-ring-outline'} size={52} color="#A08AB7" />
      </View>

      <Text style={[styles.description, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
        We'll notify you when someone likes you, matches with you, or sends you a message.
      </Text>

      {granted ? (
        <View style={[styles.enabledCard, { backgroundColor: isDark ? 'rgba(160,138,183,0.12)' : '#F3F0F7' }]}>
          <MaterialCommunityIcons name="check-circle" size={24} color="#A08AB7" />
          <Text style={[styles.enabledText, { color: isDark ? '#D4C4E8' : '#A08AB7' }]}>
            Notifications enabled
          </Text>
        </View>
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
  enabledCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
  },
  enabledText: {
    fontSize: 17,
    fontWeight: '600',
  },
  skipHint: {
    fontSize: 13,
    marginTop: 20,
    textAlign: 'center',
  },
});
