import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform, Linking } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { registerForPushNotifications, savePushToken, removePushToken } from '@/lib/notifications';
import * as Notifications from 'expo-notifications';

export default function NotificationSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  useEffect(() => {
    loadSettings();
    checkPermissionStatus();
  }, []);

  const checkPermissionStatus = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      setPermissionStatus(status as any);
    } catch (error) {
      console.error('Error checking permissions:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('push_enabled, push_token')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      setPushEnabled(data?.push_enabled || false);
      setHasToken(!!data?.push_token);
    } catch (error: any) {
      console.error('Error loading notification settings:', error);
      Alert.alert('Error', 'Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleNotifications = async () => {
    if (pushEnabled) {
      // User wants to disable notifications
      Alert.alert(
        'Disable Notifications',
        'You won\'t receive alerts about matches, messages, or activity. You can re-enable anytime.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Disable',
            style: 'destructive',
            onPress: async () => {
              try {
                setSaving(true);
                await supabase
                  .from('profiles')
                  .update({ push_enabled: false })
                  .eq('user_id', user?.id);

                setPushEnabled(false);
                Alert.alert('Success', 'Notifications disabled');
              } catch (error: any) {
                Alert.alert('Error', 'Failed to update settings');
              } finally {
                setSaving(false);
              }
            },
          },
        ]
      );
    } else {
      // User wants to enable notifications
      await enableNotifications();
    }
  };

  const enableNotifications = async () => {
    try {
      setSaving(true);

      // Check current permission status
      const { status: currentStatus } = await Notifications.getPermissionsAsync();

      if (currentStatus === 'denied') {
        // Permission was previously denied - need to open settings
        Alert.alert(
          'Permission Denied',
          'Notifications are disabled in your device settings. Please enable them to receive alerts.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
        return;
      }

      // Request permissions and get token
      const token = await registerForPushNotifications();

      if (!token) {
        Alert.alert(
          'Unable to Enable',
          Platform.OS === 'ios'
            ? 'Push notifications require a physical device and proper permissions.'
            : 'Failed to get notification token. Please try again.'
        );
        return;
      }

      // Save token to database
      if (user?.id) {
        await savePushToken(user.id, token);
      }

      // Update local state
      setPushEnabled(true);
      setHasToken(true);
      setPermissionStatus('granted');

      Alert.alert(
        'Notifications Enabled! 🎉',
        'You\'ll now receive updates about matches, messages, and activity.'
      );
    } catch (error: any) {
      console.error('Error enabling notifications:', error);
      Alert.alert('Error', 'Failed to enable notifications. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    if (!pushEnabled || !hasToken) {
      Alert.alert('Notifications Disabled', 'Please enable notifications first.');
      return;
    }

    Alert.alert(
      'Test Notification',
      'Send a test notification to all your devices?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Test',
          onPress: async () => {
            try {
              setSaving(true);

              // Get profile ID
              const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('id, push_token')
                .eq('user_id', user?.id)
                .single();

              if (profileError || !profile) {
                Alert.alert('Error', 'Profile not found');
                setSaving(false);
                return;
              }

              // Get all device tokens for this user (multi-device support)
              const { data: deviceTokens } = await supabase
                .from('device_tokens')
                .select('push_token, device_type')
                .eq('profile_id', profile.id);

              // Collect all tokens (from both device_tokens and profiles.push_token)
              const tokens = new Set<string>();
              if (deviceTokens) {
                deviceTokens.forEach(dt => tokens.add(dt.push_token));
              }
              if (profile.push_token) {
                tokens.add(profile.push_token);
              }

              if (tokens.size === 0) {
                Alert.alert('Error', 'No push tokens found. Try logging out and back in.');
                setSaving(false);
                return;
              }

              console.log(`📤 Sending test to ${tokens.size} device(s)...`);

              // Create messages for all devices
              const messages = Array.from(tokens).map(token => ({
                to: token,
                sound: 'default',
                title: 'Test Notification 🔔',
                body: 'Your notifications are working perfectly!',
                data: { type: 'test', timestamp: new Date().toISOString() },
                priority: 'high' as const,
              }));

              // Send to all devices with timeout
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 15000);

              const response = await fetch('https://exp.host/--/api/v2/push/send', {
                method: 'POST',
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(messages),
                signal: controller.signal,
              });

              clearTimeout(timeoutId);

              const result = await response.json();
              console.log('📬 Expo Push API response:', JSON.stringify(result, null, 2));

              // Analyze results
              let successCount = 0;
              let errorMessages: string[] = [];

              if (result.data) {
                result.data.forEach((item: any, index: number) => {
                  if (item.status === 'ok') {
                    successCount++;
                    console.log(`✅ Device ${index + 1}: Success (ticket: ${item.id})`);
                  } else {
                    const errorDetail = item.details?.error || item.message || 'Unknown error';
                    errorMessages.push(errorDetail);
                    console.error(`❌ Device ${index + 1}: ${errorDetail}`);

                    // Check for specific errors
                    if (errorDetail === 'DeviceNotRegistered') {
                      console.warn('⚠️ Token is invalid - device may have uninstalled app or token expired');
                    }
                  }
                });
              }

              setSaving(false);

              if (successCount > 0 && errorMessages.length === 0) {
                Alert.alert(
                  'Success! ✅',
                  `Test notification sent to ${successCount} device${successCount > 1 ? 's' : ''}! You should receive it within a few seconds.`
                );
              } else if (successCount > 0) {
                Alert.alert(
                  'Partial Success',
                  `Sent to ${successCount} device${successCount > 1 ? 's' : ''}, but ${errorMessages.length} failed.\n\nErrors: ${errorMessages.join(', ')}`
                );
              } else {
                Alert.alert(
                  'Failed to Send ❌',
                  `Expo returned errors:\n\n${errorMessages.join('\n')}\n\nTry logging out and back in to refresh your push token.`
                );
              }
            } catch (error: any) {
              setSaving(false);
              console.error('Error sending test notification:', error);
              if (error.name === 'AbortError') {
                Alert.alert('Timeout', 'Request timed out. Check your internet connection.');
              } else {
                Alert.alert('Error', `Failed to send: ${error.message || 'Unknown error'}`);
              }
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <ActivityIndicator size="large" color="#A08AB7" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white">
      {/* Header */}
      <View className="px-6 pt-16 pb-6 bg-lavender-500">
        <TouchableOpacity
          onPress={() => router.back()}
          className="mb-6 w-10 h-10 items-center justify-center rounded-full bg-white/20"
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text className="text-3xl font-bold text-white mb-2">Notifications</Text>
        <Text className="text-lavender-100 text-base">
          Manage your notification preferences
        </Text>
      </View>

      <View className="px-6 py-6">
        {/* Main Toggle */}
        <View className="bg-gray-50 rounded-2xl p-5 mb-6">
          <View className="flex-row items-center mb-3">
            <View className="w-12 h-12 bg-lavender-100 rounded-full items-center justify-center mr-3">
              <MaterialCommunityIcons name="bell" size={24} color="#A08AB7" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-900 mb-1">
                Push Notifications
              </Text>
              <Text className="text-sm text-gray-600">
                {pushEnabled ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleToggleNotifications}
              disabled={saving}
              className={`w-14 h-8 rounded-full ${
                pushEnabled ? 'bg-lavender-500' : 'bg-gray-300'
              }`}
            >
              <View
                className={`w-6 h-6 rounded-full bg-white mt-1 ${
                  pushEnabled ? 'ml-7' : 'ml-1'
                }`}
              />
            </TouchableOpacity>
          </View>

          {saving && (
            <View className="mt-2">
              <ActivityIndicator size="small" color="#A08AB7" />
            </View>
          )}
        </View>

        {/* Status Info */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-gray-700 mb-3">Status</Text>
          <View className="bg-gray-50 rounded-xl p-4 space-y-2">
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-gray-600">Device Permissions</Text>
              <View className={`px-3 py-1 rounded-full ${
                permissionStatus === 'granted' ? 'bg-green-100' : 'bg-yellow-100'
              }`}>
                <Text className={`text-xs font-semibold ${
                  permissionStatus === 'granted' ? 'text-green-800' : 'text-yellow-800'
                }`}>
                  {permissionStatus === 'granted' ? 'Allowed' :
                   permissionStatus === 'denied' ? 'Denied' : 'Not Set'}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-gray-600">Push Token</Text>
              <View className={`px-3 py-1 rounded-full ${
                hasToken ? 'bg-green-100' : 'bg-gray-200'
              }`}>
                <Text className={`text-xs font-semibold ${
                  hasToken ? 'text-green-800' : 'text-gray-600'
                }`}>
                  {hasToken ? 'Registered' : 'Not Registered'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* What You'll Receive */}
        {pushEnabled && (
          <View className="mb-6">
            <Text className="text-sm font-semibold text-gray-700 mb-3">
              You'll be notified about:
            </Text>
            <View className="space-y-2">
              {[
                { icon: 'heart', text: 'New matches', color: '#F43F5E' },
                { icon: 'message', text: 'New messages', color: '#A08AB7' },
                { icon: 'star', text: 'Someone likes you', color: '#F59E0B' },
                { icon: 'shield-check', text: 'Safety alerts', color: '#10B981' },
              ].map((item, index) => (
                <View key={index} className="flex-row items-center bg-gray-50 rounded-xl p-4">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: `${item.color}20` }}
                  >
                    <MaterialCommunityIcons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <Text className="text-gray-700 font-medium">{item.text}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Test Notification Button */}
        {pushEnabled && hasToken && (
          <TouchableOpacity
            onPress={handleTestNotification}
            className="bg-gray-100 border border-gray-300 py-4 rounded-xl mb-6"
          >
            <Text className="text-gray-900 text-center font-semibold">
              Send Test Notification
            </Text>
          </TouchableOpacity>
        )}

        {/* Help Text */}
        <View className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <View className="flex-row items-start">
            <MaterialCommunityIcons name="information" size={20} color="#3B82F6" style={{ marginTop: 2, marginRight: 8 }} />
            <View className="flex-1">
              <Text className="text-blue-900 font-semibold mb-1">About Notifications</Text>
              <Text className="text-blue-800 text-sm leading-5">
                Notifications help you stay connected with matches and never miss important activity.
                {'\n\n'}
                {permissionStatus === 'denied' &&
                  'To enable, you\'ll need to allow notifications in your device settings.'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
