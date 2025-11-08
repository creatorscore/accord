/**
 * Screenshot tracking and notification system
 *
 * Logs when users take screenshots of profiles and sends notifications
 * to the profile owner so they can block the screenshot taker if desired.
 */

import { supabase } from './supabase';
import { Platform } from 'react-native';

/**
 * Log a screenshot event to the database
 *
 * @param screenshotterProfileId - Profile ID of the user who took the screenshot
 * @param screenshotProfileId - Profile ID of the user whose profile was screenshot
 * @param context - Where the screenshot was taken ('swipe_card', 'profile_view', 'chat')
 */
export async function logScreenshotEvent(
  screenshotterProfileId: string,
  screenshotProfileId: string,
  context: 'swipe_card' | 'profile_view' | 'chat'
) {
  try {
    // Don't log if user screenshots their own profile (e.g., in preview mode)
    if (screenshotterProfileId === screenshotProfileId) {
      console.log('[Screenshot] User screenshot their own profile, not logging');
      return;
    }

    // Insert screenshot event
    const { data: event, error } = await supabase
      .from('screenshot_events')
      .insert({
        screenshotter_profile_id: screenshotterProfileId,
        screenshot_profile_id: screenshotProfileId,
        context,
        platform: Platform.OS,
      })
      .select()
      .single();

    if (error) {
      console.error('[Screenshot] Error logging event:', error);
      return;
    }

    console.log('[Screenshot] Event logged:', event.id);

    // Send notification to the profile owner
    await sendScreenshotNotification(screenshotProfileId, screenshotterProfileId, context);

  } catch (error) {
    console.error('[Screenshot] Unexpected error:', error);
  }
}

/**
 * Send a push notification to the profile owner that their profile was screenshot
 */
async function sendScreenshotNotification(
  screenshotProfileId: string,
  screenshotterProfileId: string,
  context: 'swipe_card' | 'profile_view' | 'chat'
) {
  try {
    // Get the screenshotter's display name
    const { data: screenshotterProfile } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', screenshotterProfileId)
      .single();

    // Get the profile owner's push token
    const { data: profileOwner } = await supabase
      .from('profiles')
      .select('push_token, push_enabled')
      .eq('id', screenshotProfileId)
      .single();

    if (!profileOwner?.push_enabled || !profileOwner?.push_token) {
      console.log('[Screenshot] Profile owner has push notifications disabled');
      return;
    }

    const contextText = context === 'swipe_card' ? 'your swipe card' :
                       context === 'profile_view' ? 'your profile' : 'your chat';

    // Queue notification
    await supabase
      .from('notification_queue')
      .insert({
        recipient_profile_id: screenshotProfileId,
        notification_type: 'screenshot_alert',
        title: '📸 Screenshot Alert',
        body: `${screenshotterProfile?.display_name || 'Someone'} took a screenshot of ${contextText}`,
        data: {
          type: 'screenshot_alert',
          screenshotter_profile_id: screenshotterProfileId,
          context,
        },
      });

    console.log('[Screenshot] Notification queued for profile owner');

  } catch (error) {
    console.error('[Screenshot] Error sending notification:', error);
  }
}

/**
 * Get all screenshot events for the current user's profile
 */
export async function getMyScreenshotAlerts(profileId: string) {
  try {
    const { data, error } = await supabase
      .from('screenshot_events')
      .select(`
        *,
        screenshotter:screenshotter_profile_id (
          id,
          display_name,
          photos (url, is_primary)
        )
      `)
      .eq('screenshot_profile_id', profileId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error('[Screenshot] Error fetching alerts:', error);
    return [];
  }
}

/**
 * Mark screenshot alerts as viewed
 */
export async function markScreenshotAlertsAsViewed(profileId: string) {
  try {
    await supabase
      .from('screenshot_events')
      .update({
        viewed: true,
        viewed_at: new Date().toISOString(),
      })
      .eq('screenshot_profile_id', profileId)
      .eq('viewed', false);

    console.log('[Screenshot] Alerts marked as viewed');
  } catch (error) {
    console.error('[Screenshot] Error marking alerts as viewed:', error);
  }
}

/**
 * Get count of unviewed screenshot alerts
 */
export async function getUnviewedScreenshotCount(profileId: string): Promise<number> {
  try {
    const { count, error } = await supabase
      .from('screenshot_events')
      .select('*', { count: 'exact', head: true })
      .eq('screenshot_profile_id', profileId)
      .eq('viewed', false);

    if (error) throw error;

    return count || 0;
  } catch (error) {
    console.error('[Screenshot] Error getting unviewed count:', error);
    return 0;
  }
}
