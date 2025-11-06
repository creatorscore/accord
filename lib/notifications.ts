import { Platform, LogBox } from 'react-native';
import { supabase } from './supabase';

// Suppress Expo Go notification warning (notifications work fine in dev/production builds)
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'Notifications not available in Expo Go',
]);

// Safely import notifications - will be null in Expo Go
let Notifications: any = null;
let Device: any = null;

try {
  Notifications = require('expo-notifications');
  Device = require('expo-device');

  // Configure how notifications are handled when app is in foreground
  if (Notifications) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
} catch (error) {
  // Silently fail - notifications will work in dev/production builds
  console.log('Notifications not available in Expo Go - will work in production build');
}

/**
 * Request notification permissions from the user
 * Returns true if granted, false otherwise
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    // Check if notifications are available
    if (!Notifications || !Device) {
      console.log('Notifications not available (Expo Go)');
      return false;
    }

    // Only request permissions on physical devices
    if (!Device.isDevice) {
      console.log('Notifications are not supported on simulator/emulator');
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // If not granted, ask for permission
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Notification permission denied');
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error requesting notification permissions:', error);
    return false;
  }
}

/**
 * Get the Expo Push Token for this device
 * Returns the token string or null if unavailable
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    // Check if notifications are available
    if (!Notifications || !Device) {
      console.log('Notifications not available (Expo Go)');
      return null;
    }

    // Only works on physical devices
    if (!Device.isDevice) {
      console.log('Push notifications require a physical device');
      return null;
    }

    // Request permissions first
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
      console.log('Push notification permissions not granted');
      return null;
    }

    // Configure notification channel for Android FIRST
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#9B87CE',
      });
    }

    // Get the push token (FCM will be used automatically if google-services.json exists)
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '71ca414e-ff65-488b-97f6-9150455475a0',
    });

    const token = tokenData.data;
    console.log('Push token registered successfully');

    return token;
  } catch (error: any) {
    // Log the error but don't crash the app
    console.warn('Push notifications setup failed (this is OK for development):', error?.message || error);
    // Return null so the app can continue without push notifications
    return null;
  }
}

/**
 * Save push token to user's profile in database
 */
export async function savePushToken(userId: string, token: string): Promise<void> {
  try {
    // Get profile ID from user ID
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    // If profile doesn't exist yet (user is in onboarding), silently return
    // The token will be saved when the profile is created during onboarding
    if (profileError) {
      if (profileError.code === 'PGRST116') {
        console.log('Profile not found yet - user likely in onboarding. Push token will be saved after profile creation.');
        return;
      }
      throw profileError;
    }

    // Update profile with push token
    const { error } = await supabase
      .from('profiles')
      .update({
        push_token: token,
        push_enabled: true,
      })
      .eq('id', profile.id);

    if (error) throw error;

    console.log('Push token saved successfully');
  } catch (error) {
    console.error('Error saving push token:', error);
    throw error;
  }
}

/**
 * Send a push notification using Expo Push Notification service
 */
export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: any
): Promise<void> {
  try {
    const message = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high' as const,
      badge: 1,
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (result.data?.status === 'error') {
      console.error('Error sending push notification:', result.data.message);
    } else {
      console.log('Push notification sent successfully');
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
}

/**
 * Send notification when a new match occurs
 */
export async function sendMatchNotification(
  recipientProfileId: string,
  matcherName: string,
  matchId: string
): Promise<void> {
  try {
    // Get recipient's push token
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('push_token, push_enabled')
      .eq('id', recipientProfileId)
      .single();

    if (error || !profile?.push_token || !profile.push_enabled) {
      console.log('Recipient does not have push notifications enabled');
      return;
    }

    // Send notification
    await sendPushNotification(
      profile.push_token,
      "It's a Match! 💜",
      `You matched with ${matcherName}! Start chatting now.`,
      {
        type: 'new_match',
        matchId,
        screen: 'matches',
      }
    );

    // Log notification
    await supabase.from('push_notifications').insert({
      profile_id: recipientProfileId,
      notification_type: 'new_match',
      title: "It's a Match! 💜",
      body: `You matched with ${matcherName}! Start chatting now.`,
      data: { matchId, type: 'new_match' },
    });
  } catch (error) {
    console.error('Error sending match notification:', error);
  }
}

/**
 * Send notification when a new message is received
 */
export async function sendMessageNotification(
  recipientProfileId: string,
  senderName: string,
  messagePreview: string,
  matchId: string
): Promise<void> {
  try {
    // Get recipient's push token
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('push_token, push_enabled')
      .eq('id', recipientProfileId)
      .single();

    if (error || !profile?.push_token || !profile.push_enabled) {
      return;
    }

    // Truncate message preview
    const preview = messagePreview.length > 50
      ? messagePreview.substring(0, 50) + '...'
      : messagePreview;

    // Send notification
    await sendPushNotification(
      profile.push_token,
      `New message from ${senderName}`,
      preview,
      {
        type: 'new_message',
        matchId,
        screen: 'chat',
      }
    );

    // Log notification
    await supabase.from('push_notifications').insert({
      profile_id: recipientProfileId,
      notification_type: 'new_message',
      title: `New message from ${senderName}`,
      body: preview,
      data: { matchId, type: 'new_message' },
    });
  } catch (error) {
    console.error('Error sending message notification:', error);
  }
}

/**
 * Send notification when someone likes your profile
 * Free users get FOMO notification to drive upgrades
 * Premium users get full details
 */
export async function sendLikeNotification(
  recipientProfileId: string,
  likerName: string,
  likerProfileId: string
): Promise<void> {
  try {
    // Get recipient's profile and subscription status
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('push_token, push_enabled, is_premium, is_platinum')
      .eq('id', recipientProfileId)
      .single();

    if (error || !profile?.push_token || !profile.push_enabled) {
      return;
    }

    const isPremium = profile.is_premium || profile.is_platinum;

    // Different messaging based on subscription status
    let title: string;
    let body: string;
    let screen: string;

    if (isPremium) {
      // Premium users: Show who liked them
      title = `${likerName} likes you! 💜`;
      body = 'See who liked you and match instantly.';
      screen = 'likes';
    } else {
      // Free users: FOMO message to drive upgrades
      title = 'Someone likes you! 💜';
      body = 'Upgrade to Premium to see who liked you and match instantly.';
      screen = 'likes'; // Will show paywall when they tap
    }

    // Send notification
    await sendPushNotification(
      profile.push_token,
      title,
      body,
      {
        type: 'new_like',
        likerProfileId: isPremium ? likerProfileId : undefined, // Only send ID to premium users
        screen,
        isPremium,
      }
    );

    // Log notification
    await supabase.from('push_notifications').insert({
      profile_id: recipientProfileId,
      notification_type: 'new_like',
      title,
      body,
      data: {
        likerProfileId: isPremium ? likerProfileId : undefined,
        type: 'new_like',
        isPremium,
      },
    });
  } catch (error) {
    console.error('Error sending like notification:', error);
  }
}

/**
 * Set up notification response listener
 * Handles what happens when user taps a notification
 */
export function setupNotificationListener(
  onNotificationTap: (data: any) => void
): any {
  if (!Notifications) {
    console.log('Notifications not available (Expo Go)');
    return { remove: () => {} }; // Return mock subscription
  }

  return Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    onNotificationTap(data);
  });
}

/**
 * Remove push token (on logout or disable notifications)
 */
export async function removePushToken(userId: string): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!profile) return;

    await supabase
      .from('profiles')
      .update({
        push_token: null,
        push_enabled: false,
      })
      .eq('id', profile.id);

    console.log('Push token removed');
  } catch (error) {
    console.error('Error removing push token:', error);
  }
}
