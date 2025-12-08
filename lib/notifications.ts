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
}

/**
 * Request notification permissions from the user
 * Returns true if granted, false otherwise
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    // Check if notifications are available
    if (!Notifications || !Device) {
      return false;
    }

    // Only request permissions on physical devices
    if (!Device.isDevice) {
      return false;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // If not granted, ask for permission
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (error: any) {
    console.error('Error requesting notification permissions:', error?.message);
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
      return null;
    }

    // Only works on physical devices
    if (!Device.isDevice) {
      return null;
    }

    // Request permissions first
    const hasPermission = await requestNotificationPermissions();
    if (!hasPermission) {
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

    return tokenData.data;
  } catch (error: any) {
    console.error('Push notifications setup failed:', error?.message);
    return null;
  }
}

/**
 * Save push token to user's profile in database
 * Writes to BOTH profiles.push_token (backward compat) AND device_tokens (multi-device support)
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
        return;
      }
      throw profileError;
    }

    const deviceType = Platform.OS === 'ios' ? 'ios' : 'android';

    // STEP 1: Update profile with push token (backward compatibility for old builds)
    const { error } = await supabase
      .from('profiles')
      .update({
        push_token: token,
        push_enabled: true,
      })
      .eq('id', profile.id);

    if (error) throw error;

    // STEP 2: Upsert to device_tokens table (multi-device support)
    const { error: deviceError } = await supabase
      .from('device_tokens')
      .upsert(
        {
          profile_id: profile.id,
          push_token: token,
          device_type: deviceType,
          last_used_at: new Date().toISOString(),
        },
        {
          onConflict: 'profile_id,push_token',
          ignoreDuplicates: false, // Update last_used_at if exists
        }
      );

    if (deviceError) {
      // Non-critical - profile token was saved successfully
    }
  } catch (error) {
    console.error('Error saving push token:', error);
    throw error;
  }
}

/**
 * Ensure push token is saved (returns true if saved, false if needs retry)
 * This is used by the retry mechanism to know when to stop retrying
 * Checks BOTH profiles.push_token (legacy) AND device_tokens table (multi-device)
 */
export async function ensurePushTokenSaved(userId: string, token: string): Promise<boolean> {
  try {
    // Get profile with current push token
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, push_token')
      .eq('user_id', userId)
      .single();

    // Profile doesn't exist yet - needs retry
    if (profileError) {
      if (profileError.code === 'PGRST116') {
        return false;
      }
      throw profileError;
    }

    const deviceType = Platform.OS === 'ios' ? 'ios' : 'android';

    // Check if token exists in device_tokens table (new multi-device system)
    const { data: deviceToken } = await supabase
      .from('device_tokens')
      .select('id')
      .eq('profile_id', profile.id)
      .eq('push_token', token)
      .single();

    // Token is already saved in new system
    if (deviceToken) {
      return true;
    }

    // Legacy check: token saved in old system
    if (profile.push_token === token) {
      // Migrate to new system while we're here
      await supabase
        .from('device_tokens')
        .upsert(
          {
            profile_id: profile.id,
            push_token: token,
            device_type: deviceType,
            last_used_at: new Date().toISOString(),
          },
          {
            onConflict: 'profile_id,push_token',
            ignoreDuplicates: false,
          }
        );
      return true;
    }

    // Token not saved - save to BOTH systems (backward compatibility)
    // STEP 1: Update profile (legacy system)
    const { error: profileError2 } = await supabase
      .from('profiles')
      .update({
        push_token: token,
        push_enabled: true,
      })
      .eq('id', profile.id);

    if (profileError2) throw profileError2;

    // STEP 2: Add to device_tokens (new system)
    const { error: deviceError } = await supabase
      .from('device_tokens')
      .upsert(
        {
          profile_id: profile.id,
          push_token: token,
          device_type: deviceType,
          last_used_at: new Date().toISOString(),
        },
        {
          onConflict: 'profile_id,push_token',
          ignoreDuplicates: false,
        }
      );

    if (deviceError) {
      // Non-critical - profile token was saved successfully
    }

    return true;
  } catch (error) {
    console.error('Error ensuring push token saved:', error);
    return false; // Will trigger retry
  }
}

/**
 * Send a push notification using Expo Push Notification service
 * Includes timeout and detailed error logging
 */
export async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data?: any
): Promise<{ success: boolean; error?: string; ticketId?: string }> {
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

    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const result = await response.json();

    // Check for errors in the response
    if (result.data?.status === 'error') {
      const errorMessage = result.data.message || 'Unknown error';
      const errorDetails = result.data.details?.error || '';
      return { success: false, error: `${errorMessage} ${errorDetails}`.trim() };
    }

    return { success: true, ticketId: result.data?.id };
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return { success: false, error: 'Request timed out' };
    }
    console.error('Error sending push notification:', error.message);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Send notification when a new match occurs
 * Sends to ALL devices for the user (multi-device support)
 */
export async function sendMatchNotification(
  recipientProfileId: string,
  matcherName: string,
  matchId: string
): Promise<void> {
  try {
    // Get recipient's push settings
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('push_token, push_enabled')
      .eq('id', recipientProfileId)
      .single();

    if (error || !profile?.push_enabled) {
      return;
    }

    // Get all device tokens for this user (new multi-device system)
    const { data: deviceTokens } = await supabase
      .from('device_tokens')
      .select('push_token')
      .eq('profile_id', recipientProfileId);

    // Collect all tokens (from both device_tokens and profiles.push_token)
    const tokens = new Set<string>();
    if (deviceTokens) {
      deviceTokens.forEach(dt => tokens.add(dt.push_token));
    }
    if (profile.push_token) {
      tokens.add(profile.push_token);
    }

    if (tokens.size === 0) {
      return;
    }

    // Send notification to all devices
    const notificationPromises = Array.from(tokens).map(token =>
      sendPushNotification(
        token,
        "It's a Match! 💜",
        `You matched with ${matcherName}! Start chatting now.`,
        {
          type: 'new_match',
          matchId,
          screen: 'matches',
        }
      )
    );

    await Promise.allSettled(notificationPromises);

    // Log notification (once per user, not per device)
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
 * Sends to ALL devices for the user (multi-device support)
 * Skips push notification if user was recently active (likely already in-app)
 */
export async function sendMessageNotification(
  recipientProfileId: string,
  senderName: string,
  messagePreview: string,
  matchId: string
): Promise<void> {
  try {
    // Get recipient's push settings and last active time
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('push_token, push_enabled, display_name, last_active_at')
      .eq('id', recipientProfileId)
      .single();

    if (error || !profile?.push_enabled) {
      return;
    }

    // Skip push notification if user was active within the last minute
    // They're likely in the app and will see the in-app notification
    if (profile.last_active_at) {
      const lastActive = new Date(profile.last_active_at);
      const now = new Date();
      const secondsSinceActive = (now.getTime() - lastActive.getTime()) / 1000;

      if (secondsSinceActive < 60) {
        console.log(`Skipping push notification for ${recipientProfileId} - user active ${Math.round(secondsSinceActive)}s ago`);
        return;
      }
    }

    // Get all device tokens for this user (new multi-device system)
    const { data: deviceTokens } = await supabase
      .from('device_tokens')
      .select('push_token')
      .eq('profile_id', recipientProfileId);

    // Collect all tokens (from both device_tokens and profiles.push_token)
    const tokens = new Set<string>();
    if (deviceTokens) {
      deviceTokens.forEach(dt => tokens.add(dt.push_token));
    }
    if (profile.push_token) {
      tokens.add(profile.push_token);
    }

    if (tokens.size === 0) {
      return;
    }

    // Truncate message preview
    const preview = messagePreview.length > 50
      ? messagePreview.substring(0, 50) + '...'
      : messagePreview;

    // Send notification to all devices
    const notificationPromises = Array.from(tokens).map(token =>
      sendPushNotification(
        token,
        `New message from ${senderName}`,
        preview,
        {
          type: 'new_message',
          matchId,
          screen: 'chat',
        }
      )
    );

    await Promise.allSettled(notificationPromises);

    // Log notification (once per user, not per device)
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
 * Sends to ALL devices for the user (multi-device support)
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

    if (error || !profile?.push_enabled) {
      return;
    }

    // Get all device tokens for this user (new multi-device system)
    const { data: deviceTokens } = await supabase
      .from('device_tokens')
      .select('push_token')
      .eq('profile_id', recipientProfileId);

    // Collect all tokens (from both device_tokens and profiles.push_token)
    const tokens = new Set<string>();
    if (deviceTokens) {
      deviceTokens.forEach(dt => tokens.add(dt.push_token));
    }
    if (profile.push_token) {
      tokens.add(profile.push_token);
    }

    if (tokens.size === 0) {
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

    // Send notification to all devices
    const notificationPromises = Array.from(tokens).map(token =>
      sendPushNotification(
        token,
        title,
        body,
        {
          type: 'new_like',
          likerProfileId: isPremium ? likerProfileId : undefined, // Only send ID to premium users
          screen,
          isPremium,
        }
      )
    );

    await Promise.allSettled(notificationPromises);

    // Log notification (once per user, not per device)
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
    return { remove: () => {} }; // Return mock subscription
  }

  return Notifications.addNotificationResponseReceivedListener((response: any) => {
    const data = response.notification.request.content.data;
    onNotificationTap(data);
  });
}

/**
 * Send notification to reporter when their report results in action (ban)
 * Sends to ALL devices for the user (multi-device support)
 */
export async function sendReportActionNotification(
  reporterProfileId: string,
  action: 'banned' | 'resolved'
): Promise<void> {
  try {
    // Get reporter's push settings
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('push_token, push_enabled')
      .eq('id', reporterProfileId)
      .single();

    if (error || !profile?.push_enabled) {
      return;
    }

    // Get all device tokens for this user (new multi-device system)
    const { data: deviceTokens } = await supabase
      .from('device_tokens')
      .select('push_token')
      .eq('profile_id', reporterProfileId);

    // Collect all tokens (from both device_tokens and profiles.push_token)
    const tokens = new Set<string>();
    if (deviceTokens) {
      deviceTokens.forEach(dt => tokens.add(dt.push_token));
    }
    if (profile.push_token) {
      tokens.add(profile.push_token);
    }

    if (tokens.size === 0) {
      return;
    }

    let title: string;
    let body: string;

    if (action === 'banned') {
      title = 'Thank you for keeping Accord safe 💜';
      body = 'The user you reported has been removed from our community. We appreciate you looking out for others.';
    } else {
      title = 'Report Update';
      body = 'We reviewed your report and have taken appropriate action. Thank you for helping keep Accord safe.';
    }

    // Send notification to all devices
    const notificationPromises = Array.from(tokens).map(token =>
      sendPushNotification(
        token,
        title,
        body,
        {
          type: 'report_action',
          action,
          screen: 'discover',
        }
      )
    );

    await Promise.allSettled(notificationPromises);

    // Log notification (once per user, not per device)
    await supabase.from('push_notifications').insert({
      profile_id: reporterProfileId,
      notification_type: 'report_action',
      title,
      body,
      data: { type: 'report_action', action },
    });
  } catch (error) {
    console.error('Error sending report action notification:', error);
  }
}

/**
 * Send notification when a user is banned
 * Sends to ALL devices for the user (multi-device support)
 */
export async function sendBanNotification(
  bannedProfileId: string,
  banReason: string
): Promise<void> {
  try {
    // Get banned user's push settings
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('push_token, push_enabled, display_name')
      .eq('id', bannedProfileId)
      .single();

    if (error || !profile?.push_enabled) {
      return;
    }

    // Get all device tokens for this user (new multi-device system)
    const { data: deviceTokens } = await supabase
      .from('device_tokens')
      .select('push_token')
      .eq('profile_id', bannedProfileId);

    // Collect all tokens (from both device_tokens and profiles.push_token)
    const tokens = new Set<string>();
    if (deviceTokens) {
      deviceTokens.forEach(dt => tokens.add(dt.push_token));
    }
    if (profile.push_token) {
      tokens.add(profile.push_token);
    }

    if (tokens.size === 0) {
      return;
    }

    // Send notification to all devices
    const notificationPromises = Array.from(tokens).map(token =>
      sendPushNotification(
        token,
        'Account Restricted',
        'Your Accord account has been restricted. If you believe this is an error, please contact support at hello@joinaccord.app.',
        {
          type: 'account_banned',
          banReason,
          screen: 'auth',
        }
      )
    );

    await Promise.allSettled(notificationPromises);

    // Log notification (once per user, not per device)
    await supabase.from('push_notifications').insert({
      profile_id: bannedProfileId,
      notification_type: 'account_banned',
      title: 'Account Restricted',
      body: 'Your Accord account has been restricted. If you believe this is an error, please contact support at hello@joinaccord.app.',
      data: { type: 'account_banned', banReason },
    });
  } catch (error) {
    console.error('Error sending ban notification:', error);
  }
}

/**
 * Send a test push notification to verify the setup works
 * Call this from settings or debug screen
 */
export async function sendTestNotification(userId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Get user's profile with push settings
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, push_token, push_enabled, display_name')
      .eq('user_id', userId)
      .single();

    if (profileError || !profile) {
      return { success: false, error: 'Profile not found' };
    }

    if (!profile.push_enabled) {
      return { success: false, error: 'Push notifications are disabled in your profile' };
    }

    if (!profile.push_token) {
      return { success: false, error: 'No push token found. Try logging out and back in.' };
    }

    // Send test notification
    const result = await sendPushNotification(
      profile.push_token,
      'Test Notification',
      'If you see this, push notifications are working!',
      {
        type: 'test',
        timestamp: new Date().toISOString(),
      }
    );

    if (result.success) {
      return { success: true };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error: any) {
    console.error('Error sending test notification:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

/**
 * Send notification when a profile is flagged for photo review
 * Tells the user they need to upload new photos to restore visibility
 * Sends to ALL devices for the user (multi-device support)
 */
export async function sendPhotoReviewNotification(
  profileId: string,
  reason: string
): Promise<void> {
  try {
    // Get user's push settings
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('push_token, push_enabled, display_name')
      .eq('id', profileId)
      .single();

    if (error || !profile?.push_enabled) {
      return;
    }

    // Get all device tokens for this user (new multi-device system)
    const { data: deviceTokens } = await supabase
      .from('device_tokens')
      .select('push_token')
      .eq('profile_id', profileId);

    // Collect all tokens (from both device_tokens and profiles.push_token)
    const tokens = new Set<string>();
    if (deviceTokens) {
      deviceTokens.forEach(dt => tokens.add(dt.push_token));
    }
    if (profile.push_token) {
      tokens.add(profile.push_token);
    }

    if (tokens.size === 0) {
      return;
    }

    const title = 'Action Required: Update Your Photos';
    const body = 'Your profile has been temporarily hidden. Please upload clear photos of yourself to restore visibility.';

    // Send notification to all devices
    const notificationPromises = Array.from(tokens).map(token =>
      sendPushNotification(
        token,
        title,
        body,
        {
          type: 'photo_review_required',
          reason,
          screen: 'photos',
        }
      )
    );

    await Promise.allSettled(notificationPromises);

    // Log notification (once per user, not per device)
    await supabase.from('push_notifications').insert({
      profile_id: profileId,
      notification_type: 'photo_review_required',
      title,
      body,
      data: { type: 'photo_review_required', reason },
    });
  } catch (error) {
    console.error('Error sending photo review notification:', error);
  }
}

/**
 * Send notification when a profile is flagged for identity verification
 * Tells the user they need to verify their identity to restore visibility
 * Sends to ALL devices for the user (multi-device support)
 */
export async function sendIdentityVerificationNotification(
  profileId: string,
  reason: string
): Promise<void> {
  try {
    // Get user's push settings
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('push_token, push_enabled, display_name')
      .eq('id', profileId)
      .single();

    if (error || !profile?.push_enabled) {
      return;
    }

    // Get all device tokens for this user (new multi-device system)
    const { data: deviceTokens } = await supabase
      .from('device_tokens')
      .select('push_token')
      .eq('profile_id', profileId);

    // Collect all tokens (from both device_tokens and profiles.push_token)
    const tokens = new Set<string>();
    if (deviceTokens) {
      deviceTokens.forEach(dt => tokens.add(dt.push_token));
    }
    if (profile.push_token) {
      tokens.add(profile.push_token);
    }

    if (tokens.size === 0) {
      return;
    }

    const title = 'Action Required: Verify Your Identity';
    const body = 'Your profile has been temporarily hidden. Please complete identity verification to restore visibility.';

    // Send notification to all devices
    const notificationPromises = Array.from(tokens).map(token =>
      sendPushNotification(
        token,
        title,
        body,
        {
          type: 'identity_verification_required',
          reason,
          screen: 'verification',
        }
      )
    );

    await Promise.allSettled(notificationPromises);

    // Log notification (once per user, not per device)
    await supabase.from('push_notifications').insert({
      profile_id: profileId,
      notification_type: 'identity_verification_required',
      title,
      body,
      data: { type: 'identity_verification_required', reason },
    });
  } catch (error) {
    console.error('Error sending identity verification notification:', error);
  }
}

/**
 * Remove push token (on logout or disable notifications)
 * Removes from BOTH profiles.push_token (legacy) AND device_tokens table (multi-device)
 */
export async function removePushToken(userId: string): Promise<void> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!profile) return;

    // STEP 1: Update profile (legacy system - clear token and disable push)
    await supabase
      .from('profiles')
      .update({
        push_token: null,
        push_enabled: false,
      })
      .eq('id', profile.id);

    // STEP 2: Delete all device tokens for this user (new multi-device system)
    await supabase
      .from('device_tokens')
      .delete()
      .eq('profile_id', profile.id);
  } catch (error) {
    console.error('Error removing push token:', error);
  }
}
