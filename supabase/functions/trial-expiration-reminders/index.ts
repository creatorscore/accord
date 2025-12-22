import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

/**
 * Trial Expiration Reminders - Scheduled Job
 *
 * This function runs on a schedule (daily) to:
 * 1. Find users with trials expiring in 3 days - send first reminder
 * 2. Find users with trials expiring in 1 day - send urgent reminder
 * 3. Find users with trials expiring today - send final reminder
 *
 * Uses the notification_queue table to queue push notifications
 * which are then processed by the process-notifications function.
 *
 * Schedule: Run daily at 10:00 AM via pg_cron or external scheduler
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TrialSubscription {
  id: string;
  profile_id: string;
  tier: string;
  expires_at: string;
  status: string;
}

interface ReminderConfig {
  daysBeforeExpiration: number;
  notificationType: string;
  title: string;
  body: string;
}

// Reminder configurations
const REMINDER_CONFIGS: ReminderConfig[] = [
  {
    daysBeforeExpiration: 3,
    notificationType: 'trial_expiring_3_days',
    title: 'Your free trial ends in 3 days',
    body: "Don't lose access to premium features! Subscribe now to keep finding your perfect match.",
  },
  {
    daysBeforeExpiration: 1,
    notificationType: 'trial_expiring_1_day',
    title: 'Your free trial ends tomorrow!',
    body: 'Last chance to subscribe and keep your premium features. Tap to upgrade now.',
  },
  {
    daysBeforeExpiration: 0,
    notificationType: 'trial_expiring_today',
    title: 'Your free trial ends today!',
    body: "Your premium access expires tonight. Subscribe now to continue your journey to finding your perfect match.",
  },
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔔 Running trial expiration reminder check...');

    const now = new Date();
    let totalQueued = 0;
    let errors = 0;

    for (const config of REMINDER_CONFIGS) {
      try {
        // Calculate the target date range for this reminder
        // We want subscriptions that expire on the target day
        const targetDate = new Date(now);
        targetDate.setDate(targetDate.getDate() + config.daysBeforeExpiration);

        // Set to start and end of the target day
        const startOfDay = new Date(targetDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(targetDate);
        endOfDay.setHours(23, 59, 59, 999);

        console.log(`📅 Checking for trials expiring in ${config.daysBeforeExpiration} days (${startOfDay.toISOString()} - ${endOfDay.toISOString()})`);

        // Find trial subscriptions expiring on this day that haven't been notified
        // Using status = 'trial' to identify trial subscriptions
        const { data: expiringTrials, error: fetchError } = await supabase
          .from('subscriptions')
          .select('id, profile_id, tier, expires_at, status')
          .eq('status', 'trial')
          .not('expires_at', 'is', null)
          .gte('expires_at', startOfDay.toISOString())
          .lte('expires_at', endOfDay.toISOString());

        if (fetchError) {
          console.error(`Error fetching trials for ${config.daysBeforeExpiration} day reminder:`, fetchError);
          errors++;
          continue;
        }

        if (!expiringTrials || expiringTrials.length === 0) {
          console.log(`No trials expiring in ${config.daysBeforeExpiration} days`);
          continue;
        }

        console.log(`Found ${expiringTrials.length} trials expiring in ${config.daysBeforeExpiration} days`);

        // Check which profiles already have this notification queued/sent today
        const profileIds = expiringTrials.map((t: TrialSubscription) => t.profile_id);

        // Get today's start for checking if notification was already sent
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const { data: existingNotifications } = await supabase
          .from('notification_queue')
          .select('recipient_profile_id')
          .in('recipient_profile_id', profileIds)
          .eq('notification_type', config.notificationType)
          .gte('created_at', todayStart.toISOString());

        const alreadyNotified = new Set(
          (existingNotifications || []).map((n: { recipient_profile_id: string }) => n.recipient_profile_id)
        );

        // Queue notifications for profiles that haven't been notified today
        const toNotify = expiringTrials.filter(
          (trial: TrialSubscription) => !alreadyNotified.has(trial.profile_id)
        );

        if (toNotify.length === 0) {
          console.log(`All profiles for ${config.daysBeforeExpiration} day reminder already notified today`);
          continue;
        }

        console.log(`Queuing ${toNotify.length} notifications for ${config.daysBeforeExpiration} day reminder`);

        // Queue notifications
        const notifications = toNotify.map((trial: TrialSubscription) => ({
          recipient_profile_id: trial.profile_id,
          notification_type: config.notificationType,
          title: config.title,
          body: config.body,
          data: {
            type: 'trial_expiring',
            days_remaining: config.daysBeforeExpiration,
            subscription_id: trial.id,
            tier: trial.tier,
            expires_at: trial.expires_at,
            action: 'open_subscription',
          },
          status: 'pending',
        }));

        const { error: insertError } = await supabase
          .from('notification_queue')
          .insert(notifications);

        if (insertError) {
          console.error(`Error queuing ${config.daysBeforeExpiration} day reminders:`, insertError);
          errors++;
        } else {
          totalQueued += notifications.length;
          console.log(`✅ Queued ${notifications.length} ${config.daysBeforeExpiration} day reminder(s)`);
        }
      } catch (error) {
        console.error(`Error processing ${config.daysBeforeExpiration} day reminder:`, error);
        errors++;
      }
    }

    const result = {
      success: true,
      totalQueued,
      errors,
      timestamp: now.toISOString(),
    };

    console.log('✅ Trial expiration reminder check complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('❌ Error in trial-expiration-reminders:', error);

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
