import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { t, getPersonWord, buildEngagementHighlights } from '../_shared/translations.ts';

/**
 * Trial Engagement Notifications - Scheduled Job
 *
 * This function runs daily to send engagement-based notifications during trials:
 * - Day 1: "Your premium trial is active! Here's what you can do..."
 * - Day 3: "You have X people who liked you - see them now!"
 * - Day 5: "Only 2 days left! You've used [feature] X times"
 * - Day 6: "Last day tomorrow - lock in your 33% annual discount"
 *
 * These complement the trial-expiration-reminders which focus on expiry warnings.
 * This function focuses on VALUE demonstration and engagement.
 *
 * Schedule: Run daily at 11:00 AM (after expiration reminders at 10:00 AM)
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TrialSubscription {
  id: string;
  profile_id: string;
  tier: string;
  started_at: string;
  expires_at: string;
  status: string;
}

interface EngagementNotification {
  dayNumber: number;
  notificationType: string;
  getTitle: (stats: EngagementStats, lang: string) => string;
  getBody: (stats: EngagementStats, lang: string) => string;
}

interface EngagementStats {
  likesReceived: number;
  superLikesSent: number;
  matchesMade: number;
  messagesSent: number;
  voiceMessagesSent: number;
}

// Engagement notification configurations by trial day (localized)
const ENGAGEMENT_NOTIFICATIONS: EngagementNotification[] = [
  {
    dayNumber: 1,
    notificationType: 'trial_day1_welcome',
    getTitle: (_stats, lang) => t(lang, 'trialEngagement.day1Title'),
    getBody: (_stats, lang) => t(lang, 'trialEngagement.day1Body'),
  },
  {
    dayNumber: 3,
    notificationType: 'trial_day3_likes',
    getTitle: (stats, lang) =>
      stats.likesReceived > 0
        ? t(lang, 'trialEngagement.day3TitleWithLikes', {
            count: stats.likesReceived,
            person: getPersonWord(lang, stats.likesReceived),
          })
        : t(lang, 'trialEngagement.day3TitleNoLikes'),
    getBody: (stats, lang) =>
      stats.likesReceived > 0
        ? t(lang, 'trialEngagement.day3BodyWithLikes')
        : t(lang, 'trialEngagement.day3BodyNoLikes'),
  },
  {
    dayNumber: 5,
    notificationType: 'trial_day5_value',
    getTitle: (_stats, lang) => t(lang, 'trialEngagement.day5Title'),
    getBody: (stats, lang) => {
      const highlights = buildEngagementHighlights(lang, stats);
      if (highlights) {
        return t(lang, 'trialEngagement.day5BodyWithStats', { highlights });
      }
      return t(lang, 'trialEngagement.day5BodyNoStats');
    },
  },
  {
    dayNumber: 6,
    notificationType: 'trial_day6_discount',
    getTitle: (_stats, lang) => t(lang, 'trialEngagement.day6Title'),
    getBody: (_stats, lang) => t(lang, 'trialEngagement.day6Body'),
  },
];

/**
 * Get engagement stats for a profile during their trial period
 */
async function getEngagementStats(profileId: string, trialStartDate: Date): Promise<EngagementStats> {
  const startIso = trialStartDate.toISOString();

  const [likesResult, superLikesResult, matchesResult, messagesResult, voiceMessagesResult] =
    await Promise.all([
      supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('liked_profile_id', profileId)
        .gte('created_at', startIso),

      supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('liker_profile_id', profileId)
        .eq('like_type', 'super')
        .gte('created_at', startIso),

      supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .or(`profile1_id.eq.${profileId},profile2_id.eq.${profileId}`)
        .gte('matched_at', startIso),

      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_profile_id', profileId)
        .gte('created_at', startIso),

      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_profile_id', profileId)
        .eq('content_type', 'voice')
        .gte('created_at', startIso),
    ]);

  return {
    likesReceived: likesResult.count || 0,
    superLikesSent: superLikesResult.count || 0,
    matchesMade: matchesResult.count || 0,
    messagesSent: messagesResult.count || 0,
    voiceMessagesSent: voiceMessagesResult.count || 0,
  };
}

/**
 * Calculate what day of trial a subscription is on
 */
function getTrialDayNumber(startedAt: Date, now: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysSinceStart = Math.floor((now.getTime() - startedAt.getTime()) / msPerDay);
  return daysSinceStart + 1; // 1-indexed
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('📱 Running trial engagement notification check...');

    const now = new Date();
    let totalQueued = 0;
    let errors = 0;

    // Get all active trial subscriptions
    const { data: trialSubscriptions, error: fetchError } = await supabase
      .from('subscriptions')
      .select('id, profile_id, tier, started_at, expires_at, status')
      .eq('status', 'trial')
      .not('started_at', 'is', null);

    if (fetchError) {
      console.error('Error fetching trial subscriptions:', fetchError);
      throw fetchError;
    }

    if (!trialSubscriptions || trialSubscriptions.length === 0) {
      console.log('No active trial subscriptions found');
      return new Response(
        JSON.stringify({ success: true, totalQueued: 0, message: 'No trials to process' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${trialSubscriptions.length} active trial subscriptions`);

    // Process each trial subscription
    for (const trial of trialSubscriptions as TrialSubscription[]) {
      try {
        const startedAt = new Date(trial.started_at);
        const dayNumber = getTrialDayNumber(startedAt, now);

        console.log(`Processing trial for profile ${trial.profile_id}, day ${dayNumber}`);

        // Find matching notification config for this day
        const notificationConfig = ENGAGEMENT_NOTIFICATIONS.find((n) => n.dayNumber === dayNumber);

        if (!notificationConfig) {
          // No notification scheduled for this day
          continue;
        }

        // Check if this notification was already sent today
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const { data: existingNotification } = await supabase
          .from('notification_queue')
          .select('id')
          .eq('recipient_profile_id', trial.profile_id)
          .eq('notification_type', notificationConfig.notificationType)
          .gte('created_at', todayStart.toISOString())
          .limit(1);

        if (existingNotification && existingNotification.length > 0) {
          console.log(
            `Notification ${notificationConfig.notificationType} already sent to ${trial.profile_id} today`
          );
          continue;
        }

        // Get user's preferred language
        const { data: profileData } = await supabase
          .from('profiles')
          .select('preferred_language')
          .eq('id', trial.profile_id)
          .single();

        const lang = profileData?.preferred_language || 'en';

        // Get engagement stats for personalized messages
        const stats = await getEngagementStats(trial.profile_id, startedAt);

        // Generate notification content (localized)
        const title = notificationConfig.getTitle(stats, lang);
        const body = notificationConfig.getBody(stats, lang);

        // Queue the notification
        const { error: insertError } = await supabase.from('notification_queue').insert({
          recipient_profile_id: trial.profile_id,
          notification_type: notificationConfig.notificationType,
          title,
          body,
          data: {
            type: 'trial_engagement',
            day_number: dayNumber,
            subscription_id: trial.id,
            tier: trial.tier,
            stats: {
              likes_received: stats.likesReceived,
              super_likes_sent: stats.superLikesSent,
              matches_made: stats.matchesMade,
            },
            action: 'open_subscription',
          },
          status: 'pending',
        });

        if (insertError) {
          console.error(
            `Error queuing notification for ${trial.profile_id}:`,
            insertError
          );
          errors++;
        } else {
          totalQueued++;
          console.log(
            `✅ Queued ${notificationConfig.notificationType} for ${trial.profile_id}: "${title}"`
          );
        }
      } catch (error) {
        console.error(`Error processing trial ${trial.id}:`, error);
        errors++;
      }
    }

    const result = {
      success: true,
      totalQueued,
      errors,
      timestamp: now.toISOString(),
    };

    console.log('✅ Trial engagement notification check complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('❌ Error in trial-engagement-notifications:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
