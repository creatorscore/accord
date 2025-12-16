import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Platform, Linking, Switch } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { registerForPushNotifications, savePushToken } from '@/lib/notifications';
import * as Notifications from 'expo-notifications';

interface NotificationPreferences {
  push_new_match: boolean;
  push_new_message: boolean;
  push_new_like: boolean;
  push_swipes_refreshed: boolean;
  push_profile_views: boolean;
  push_review_reminders: boolean;
  push_safety_alerts: boolean;
  email_new_match: boolean;
  email_unread_messages: boolean;
  email_weekly_summary: boolean;
  email_inactive_reminder: boolean;
  email_promotions: boolean;
  email_product_updates: boolean;
}

const defaultPreferences: NotificationPreferences = {
  push_new_match: true,
  push_new_message: true,
  push_new_like: true,
  push_swipes_refreshed: true,
  push_profile_views: false,
  push_review_reminders: true,
  push_safety_alerts: true,
  email_new_match: true,
  email_unread_messages: true,
  email_weekly_summary: true,
  email_inactive_reminder: true,
  email_promotions: false,
  email_product_updates: true,
};

export default function NotificationSettings() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [isPremium, setIsPremium] = useState(false);

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
      // Get profile and push settings
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, push_enabled, push_token, is_premium, is_platinum')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;

      setProfileId(profile?.id || null);
      setPushEnabled(profile?.push_enabled || false);
      setHasToken(!!profile?.push_token);
      setIsPremium(profile?.is_premium || profile?.is_platinum || false);

      // Get notification preferences
      if (profile?.id) {
        const { data: prefs, error: prefsError } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('profile_id', profile.id)
          .single();

        if (!prefsError && prefs) {
          setPreferences({
            push_new_match: prefs.push_new_match ?? true,
            push_new_message: prefs.push_new_message ?? true,
            push_new_like: prefs.push_new_like ?? true,
            push_swipes_refreshed: prefs.push_swipes_refreshed ?? true,
            push_profile_views: prefs.push_profile_views ?? false,
            push_review_reminders: prefs.push_review_reminders ?? true,
            push_safety_alerts: prefs.push_safety_alerts ?? true,
            email_new_match: prefs.email_new_match ?? true,
            email_unread_messages: prefs.email_unread_messages ?? true,
            email_weekly_summary: prefs.email_weekly_summary ?? true,
            email_inactive_reminder: prefs.email_inactive_reminder ?? true,
            email_promotions: prefs.email_promotions ?? false,
            email_product_updates: prefs.email_product_updates ?? true,
          });
        }
      }
    } catch (error: any) {
      console.error('Error loading notification settings:', error);
      Alert.alert('Error', 'Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!profileId) return;

    // Optimistically update UI
    setPreferences(prev => ({ ...prev, [key]: value }));

    try {
      const { error } = await supabase
        .from('notification_preferences')
        .update({ [key]: value, updated_at: new Date().toISOString() })
        .eq('profile_id', profileId);

      if (error) throw error;
    } catch (error: any) {
      // Revert on error
      setPreferences(prev => ({ ...prev, [key]: !value }));
      Alert.alert('Error', 'Failed to update preference');
    }
  };

  const handleToggleNotifications = async () => {
    if (pushEnabled) {
      Alert.alert(
        'Disable Notifications',
        'You won\'t receive any push notifications. You can re-enable anytime.',
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
      await enableNotifications();
    }
  };

  const enableNotifications = async () => {
    try {
      setSaving(true);
      const { status: currentStatus } = await Notifications.getPermissionsAsync();

      if (currentStatus === 'denied') {
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

      const token = await registerForPushNotifications();

      if (!token) {
        Alert.alert(
          'Unable to Enable',
          'Push notifications require a physical device and proper permissions.'
        );
        return;
      }

      if (user?.id) {
        await savePushToken(user.id, token);
      }

      setPushEnabled(true);
      setHasToken(true);
      setPermissionStatus('granted');

      Alert.alert('Notifications Enabled!', 'You\'ll now receive updates about matches, messages, and activity.');
    } catch (error: any) {
      Alert.alert('Error', 'Failed to enable notifications. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const renderToggle = (
    label: string,
    description: string,
    key: keyof NotificationPreferences,
    icon: string,
    iconColor: string,
    disabled?: boolean,
    premiumOnly?: boolean
  ) => {
    const isLocked = premiumOnly && !isPremium;

    return (
      <View className={`flex-row items-center py-4 border-b border-gray-100 ${disabled ? 'opacity-50' : ''}`}>
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{ backgroundColor: `${iconColor}20` }}
        >
          <MaterialCommunityIcons name={icon as any} size={20} color={iconColor} />
        </View>
        <View className="flex-1 mr-3">
          <View className="flex-row items-center">
            <Text className="text-gray-900 font-medium">{label}</Text>
            {isLocked && (
              <View className="ml-2 bg-amber-100 px-2 py-0.5 rounded">
                <Text className="text-amber-700 text-xs font-semibold">PREMIUM</Text>
              </View>
            )}
          </View>
          <Text className="text-gray-500 text-sm mt-0.5">{description}</Text>
        </View>
        {isLocked ? (
          <TouchableOpacity
            onPress={() => router.push('/settings/subscription')}
            className="bg-amber-500 px-3 py-1.5 rounded-full"
          >
            <Text className="text-white text-xs font-semibold">Upgrade</Text>
          </TouchableOpacity>
        ) : (
          <Switch
            value={preferences[key]}
            onValueChange={(value) => updatePreference(key, value)}
            disabled={disabled}
            trackColor={{ false: '#D1D5DB', true: '#CDC2E5' }}
            thumbColor={preferences[key] ? '#A08AB7' : '#F3F4F6'}
          />
        )}
      </View>
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
          Control what notifications you receive
        </Text>
      </View>

      <View className="px-6 py-6">
        {/* Master Push Toggle */}
        <View className="bg-gray-50 rounded-2xl p-5 mb-6">
          <View className="flex-row items-center">
            <View className="w-12 h-12 bg-lavender-100 rounded-full items-center justify-center mr-3">
              <MaterialCommunityIcons name="bell" size={24} color="#A08AB7" />
            </View>
            <View className="flex-1">
              <Text className="text-lg font-bold text-gray-900 mb-1">Push Notifications</Text>
              <Text className="text-sm text-gray-600">
                {pushEnabled ? 'Enabled' : 'Disabled'} {!hasToken && pushEnabled && '(No token)'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={handleToggleNotifications}
              disabled={saving}
              className={`w-14 h-8 rounded-full justify-center ${pushEnabled ? 'bg-lavender-500' : 'bg-gray-300'}`}
            >
              <View className={`w-6 h-6 rounded-full bg-white ${pushEnabled ? 'ml-7' : 'ml-1'}`} />
            </TouchableOpacity>
          </View>
          {saving && <ActivityIndicator size="small" color="#A08AB7" className="mt-2" />}
        </View>

        {/* Push Notification Types */}
        {pushEnabled && (
          <View className="mb-6">
            <Text className="text-lg font-bold text-gray-900 mb-4">Push Notifications</Text>
            <View className="bg-gray-50 rounded-2xl px-4">
              {renderToggle('New Matches', 'When you match with someone', 'push_new_match', 'heart', '#F43F5E')}
              {renderToggle('New Messages', 'When you receive a message', 'push_new_message', 'message', '#A08AB7')}
              {renderToggle('New Likes', 'When someone likes your profile', 'push_new_like', 'star', '#F59E0B')}
              {renderToggle('Swipes Refreshed', 'Daily reminder when your swipes reset', 'push_swipes_refreshed', 'refresh', '#10B981')}
              {renderToggle('Profile Views', 'When someone views your profile', 'push_profile_views', 'eye', '#6366F1', false, true)}
              {renderToggle('Review Reminders', 'Reminders to review your matches', 'push_review_reminders', 'clipboard-check', '#8B5CF6')}
              {renderToggle('Safety Alerts', 'Important safety notifications', 'push_safety_alerts', 'shield-check', '#EF4444', false)}
            </View>
          </View>
        )}

        {/* Email Notification Types */}
        <View className="mb-6">
          <Text className="text-lg font-bold text-gray-900 mb-4">Email Notifications</Text>
          <View className="bg-gray-50 rounded-2xl px-4">
            {renderToggle('New Match Emails', 'Email when you get a new match', 'email_new_match', 'heart', '#F43F5E')}
            {renderToggle('Unread Messages', 'Digest of unread messages', 'email_unread_messages', 'email', '#A08AB7')}
            {renderToggle('Weekly Summary', 'Weekly activity summary', 'email_weekly_summary', 'calendar-week', '#10B981')}
            {renderToggle('Come Back Reminders', 'Reminders when you\'ve been away', 'email_inactive_reminder', 'account-alert', '#F59E0B')}
            {renderToggle('Product Updates', 'New features and improvements', 'email_product_updates', 'rocket-launch', '#6366F1')}
            {renderToggle('Promotions', 'Special offers and discounts', 'email_promotions', 'tag', '#EC4899')}
          </View>
        </View>

        {/* Status Info */}
        <View className="mb-6">
          <Text className="text-sm font-semibold text-gray-700 mb-3">Status</Text>
          <View className="bg-gray-50 rounded-xl p-4">
            <View className="flex-row items-center justify-between py-2 border-b border-gray-200">
              <Text className="text-gray-600">Device Permissions</Text>
              <View className={`px-3 py-1 rounded-full ${permissionStatus === 'granted' ? 'bg-green-100' : 'bg-yellow-100'}`}>
                <Text className={`text-xs font-semibold ${permissionStatus === 'granted' ? 'text-green-800' : 'text-yellow-800'}`}>
                  {permissionStatus === 'granted' ? 'Allowed' : permissionStatus === 'denied' ? 'Denied' : 'Not Set'}
                </Text>
              </View>
            </View>
            <View className="flex-row items-center justify-between py-2">
              <Text className="text-gray-600">Push Token</Text>
              <View className={`px-3 py-1 rounded-full ${hasToken ? 'bg-green-100' : 'bg-gray-200'}`}>
                <Text className={`text-xs font-semibold ${hasToken ? 'text-green-800' : 'text-gray-600'}`}>
                  {hasToken ? 'Registered' : 'Not Registered'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Help Text */}
        <View className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <View className="flex-row items-start">
            <MaterialCommunityIcons name="information" size={20} color="#3B82F6" style={{ marginTop: 2, marginRight: 8 }} />
            <View className="flex-1">
              <Text className="text-blue-900 font-semibold mb-1">About Notifications</Text>
              <Text className="text-blue-800 text-sm leading-5">
                Stay connected with matches and never miss important activity. Safety alerts cannot be disabled for your protection.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
