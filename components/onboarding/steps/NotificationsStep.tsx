import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, Platform, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { registerForPushNotifications } from '@/lib/notifications';
import { openAppSettings } from '@/lib/open-settings';

interface Props {
  onGranted: () => void;
}

export default function NotificationsStep({ onGranted }: Props) {
  const isDark = useColorScheme() === 'dark';
  const [requesting, setRequesting] = useState(false);

  const handleEnable = async () => {
    setRequesting(true);
    try {
      const token = await registerForPushNotifications();
      if (token) {
        onGranted();
      } else {
        Alert.alert(
          'Notifications Disabled',
          'Please enable notifications in your device settings to continue.',
          [
            { text: 'Open Settings', onPress: openAppSettings },
            { text: 'Try Again', onPress: handleEnable },
          ]
        );
      }
    } catch {
      Alert.alert('Error', 'Failed to enable notifications. Please try again.');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: isDark ? '#2C2C3E' : '#F5F2F7' }]}>
        <MaterialCommunityIcons name="bell-ring-outline" size={48} color="#A08AB7" />
      </View>
      <Text style={[styles.description, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>
        We'll notify you when someone likes you, matches with you, or sends you a message.
      </Text>
      <TouchableOpacity
        style={[styles.button, requesting && styles.buttonDisabled]}
        onPress={handleEnable}
        disabled={requesting}
        activeOpacity={0.8}
      >
        <MaterialCommunityIcons name="bell" size={20} color="#FFFFFF" />
        <Text style={styles.buttonText}>
          {requesting ? 'Enabling...' : 'Enable Notifications'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  description: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 32, paddingHorizontal: 16 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#A08AB7', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 50 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
