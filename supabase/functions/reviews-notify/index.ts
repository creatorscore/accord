// Edge Function: reviews-notify
// Sends push notifications when users can submit reviews (7 days after matching)
// Should be triggered by a cron job (e.g., every hour)

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const REVIEW_TRIGGER_DAYS = 7;

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Use service role for admin access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date();

    // Find matches where:
    // 1. 7 days have passed since matching (trigger_date <= now)
    // 2. Review window hasn't expired yet
    // 3. Users haven't been notified yet
    // 4. Reviews haven't been revealed yet (match is still in review period)

    // First, get all active matches that are 7+ days old but don't have review_prompts yet
    const sevenDaysAgo = new Date(now.getTime() - REVIEW_TRIGGER_DAYS * 24 * 60 * 60 * 1000);

    const { data: matchesWithoutPrompts, error: matchError } = await supabase
      .from('matches')
      .select(`
        id,
        profile1_id,
        profile2_id,
        matched_at,
        profile1:profiles!matches_profile1_id_fkey(display_name, push_token, push_enabled),
        profile2:profiles!matches_profile2_id_fkey(display_name, push_token, push_enabled)
      `)
      .eq('status', 'active')
      .lte('matched_at', sevenDaysAgo.toISOString());

    if (matchError) {
      console.error('Error fetching matches:', matchError);
      throw matchError;
    }

    let notificationsSent = 0;
    let promptsCreated = 0;

    // Process matches that need review prompts created and notifications sent
    for (const match of matchesWithoutPrompts || []) {
      // Check if review_prompt already exists for this match
      const { data: existingPrompt } = await supabase
        .from('review_prompts')
        .select('id, profile1_notified, profile2_notified')
        .eq('match_id', match.id)
        .single();

      let promptId: string;
      let profile1Notified = false;
      let profile2Notified = false;

      if (!existingPrompt) {
        // Create review prompt
        const triggerDate = new Date(match.matched_at);
        triggerDate.setDate(triggerDate.getDate() + REVIEW_TRIGGER_DAYS);

        const expiresAt = new Date(triggerDate);
        expiresAt.setDate(expiresAt.getDate() + 3); // 3-day window after trigger

        const { data: newPrompt, error: createError } = await supabase
          .from('review_prompts')
          .insert({
            match_id: match.id,
            profile1_id: match.profile1_id,
            profile2_id: match.profile2_id,
            trigger_date: triggerDate.toISOString(),
            window_expires_at: expiresAt.toISOString(),
          })
          .select()
          .single();

        if (createError) {
          console.error(`Error creating review prompt for match ${match.id}:`, createError);
          continue;
        }

        promptId = newPrompt.id;
        promptsCreated++;
      } else {
        promptId = existingPrompt.id;
        profile1Notified = existingPrompt.profile1_notified;
        profile2Notified = existingPrompt.profile2_notified;
      }

      // Send notification to profile1 if not already notified
      if (!profile1Notified && match.profile1?.push_enabled && match.profile1?.push_token) {
        const sent = await sendPushNotification(
          match.profile1.push_token,
          'Time to Review! ⭐',
          `Share your experience with ${match.profile2?.display_name || 'your match'}. Your review helps build trust in our community.`,
          { type: 'review_ready', match_id: match.id }
        );

        if (sent) {
          await supabase
            .from('review_prompts')
            .update({ profile1_notified: true })
            .eq('id', promptId);

          // Also add to notification queue for in-app
          await supabase.from('notification_queue').insert({
            recipient_profile_id: match.profile1_id,
            notification_type: 'review_ready',
            title: 'Time to Review! ⭐',
            body: `Share your experience with ${match.profile2?.display_name || 'your match'}. Your review helps build trust in our community.`,
            data: { type: 'review_ready', match_id: match.id },
            status: 'sent', // Already sent via push
          });

          notificationsSent++;
        }
      }

      // Send notification to profile2 if not already notified
      if (!profile2Notified && match.profile2?.push_enabled && match.profile2?.push_token) {
        const sent = await sendPushNotification(
          match.profile2.push_token,
          'Time to Review! ⭐',
          `Share your experience with ${match.profile1?.display_name || 'your match'}. Your review helps build trust in our community.`,
          { type: 'review_ready', match_id: match.id }
        );

        if (sent) {
          await supabase
            .from('review_prompts')
            .update({ profile2_notified: true })
            .eq('id', promptId);

          // Also add to notification queue for in-app
          await supabase.from('notification_queue').insert({
            recipient_profile_id: match.profile2_id,
            notification_type: 'review_ready',
            title: 'Time to Review! ⭐',
            body: `Share your experience with ${match.profile1?.display_name || 'your match'}. Your review helps build trust in our community.`,
            data: { type: 'review_ready', match_id: match.id },
            status: 'sent', // Already sent via push
          });

          notificationsSent++;
        }
      }
    }

    // Also check for reminder notifications (e.g., 1 day before window expires)
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: promptsNeedingReminder } = await supabase
      .from('review_prompts')
      .select(`
        id,
        match_id,
        profile1_id,
        profile2_id,
        profile1_reviewed,
        profile2_reviewed,
        reminder_sent,
        window_expires_at,
        match:matches!review_prompts_match_id_fkey(
          profile1:profiles!matches_profile1_id_fkey(display_name, push_token, push_enabled),
          profile2:profiles!matches_profile2_id_fkey(display_name, push_token, push_enabled)
        )
      `)
      .eq('reviews_revealed', false)
      .eq('reminder_sent', false)
      .lte('window_expires_at', oneDayFromNow.toISOString())
      .gte('window_expires_at', now.toISOString());

    let remindersSent = 0;

    for (const prompt of promptsNeedingReminder || []) {
      const match = prompt.match;
      if (!match) continue;

      // Send reminder to profile1 if they haven't reviewed yet
      if (!prompt.profile1_reviewed && match.profile1?.push_enabled && match.profile1?.push_token) {
        await sendPushNotification(
          match.profile1.push_token,
          'Last Chance to Review! ⏰',
          `Your review window for ${match.profile2?.display_name || 'your match'} expires soon. Don't miss out!`,
          { type: 'review_reminder', match_id: prompt.match_id }
        );
        remindersSent++;
      }

      // Send reminder to profile2 if they haven't reviewed yet
      if (!prompt.profile2_reviewed && match.profile2?.push_enabled && match.profile2?.push_token) {
        await sendPushNotification(
          match.profile2.push_token,
          'Last Chance to Review! ⏰',
          `Your review window for ${match.profile1?.display_name || 'your match'} expires soon. Don't miss out!`,
          { type: 'review_reminder', match_id: prompt.match_id }
        );
        remindersSent++;
      }

      // Mark reminder as sent
      await supabase
        .from('review_prompts')
        .update({ reminder_sent: true })
        .eq('id', prompt.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        prompts_created: promptsCreated,
        notifications_sent: notificationsSent,
        reminders_sent: remindersSent,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in reviews-notify:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});

async function sendPushNotification(
  pushToken: string,
  title: string,
  body: string,
  data: Record<string, any>
): Promise<boolean> {
  try {
    const message = {
      to: pushToken,
      sound: 'default',
      title,
      body,
      data,
      priority: 'high',
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
      console.error('Push notification error:', result.data.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}
