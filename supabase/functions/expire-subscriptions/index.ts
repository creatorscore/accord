import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

/**
 * Expire Subscriptions - Safety Net Job
 *
 * This function runs on a schedule (via pg_cron or external scheduler) to:
 * 1. Find subscriptions with expired `expires_at` that still have active status
 * 2. Revoke premium status from profiles with expired subscriptions
 * 3. Handle any edge cases where webhook might have failed
 *
 * This is a SAFETY NET - the primary expiration should happen via RevenueCat webhook.
 * This job catches any that slip through.
 *
 * Schedule: Run every hour via pg_cron or external scheduler
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔄 Running subscription expiration check...');

    const now = new Date().toISOString();

    // Find subscriptions that have expired but are still marked as active
    const { data: expiredSubscriptions, error: fetchError } = await supabase
      .from('subscriptions')
      .select('id, profile_id, tier, expires_at, status')
      .eq('status', 'active')
      .not('expires_at', 'is', null)
      .lt('expires_at', now);

    if (fetchError) {
      console.error('Error fetching expired subscriptions:', fetchError);
      throw fetchError;
    }

    console.log(`Found ${expiredSubscriptions?.length || 0} expired subscriptions to process`);

    let processed = 0;
    let errors = 0;

    // Get list of admin profile IDs to skip (admins always keep premium)
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_admin', true);

    const adminProfileIds = new Set((adminProfiles || []).map(p => p.id));
    console.log(`Found ${adminProfileIds.size} admin accounts to skip`);

    for (const subscription of expiredSubscriptions || []) {
      try {
        // Skip admin accounts - they always keep premium
        if (adminProfileIds.has(subscription.profile_id)) {
          console.log(`⏭️ Skipping admin account ${subscription.profile_id}`);
          continue;
        }

        console.log(`Processing expired subscription for profile ${subscription.profile_id}:`, {
          tier: subscription.tier,
          expiredAt: subscription.expires_at,
        });

        // Update subscription status to expired
        const { error: subError } = await supabase
          .from('subscriptions')
          .update({
            status: 'expired',
            auto_renew: false,
          })
          .eq('id', subscription.id);

        if (subError) {
          console.error(`Error updating subscription ${subscription.id}:`, subError);
          errors++;
          continue;
        }

        // Revoke premium status from profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            is_premium: false,
            is_platinum: false,
          })
          .eq('id', subscription.profile_id);

        if (profileError) {
          console.error(`Error updating profile ${subscription.profile_id}:`, profileError);
          errors++;
          continue;
        }

        console.log(`✅ Expired subscription for profile ${subscription.profile_id}`);
        processed++;
      } catch (error) {
        console.error(`Error processing subscription ${subscription.id}:`, error);
        errors++;
      }
    }

    // Also check for profiles that have is_premium=true but no active subscription
    // This catches cases where the subscription record was updated but profile wasn't
    const { data: orphanedPremiumProfiles, error: orphanError } = await supabase
      .from('profiles')
      .select(`
        id,
        is_premium,
        is_platinum,
        subscriptions!inner(status, expires_at)
      `)
      .or('is_premium.eq.true,is_platinum.eq.true');

    if (!orphanError && orphanedPremiumProfiles) {
      for (const profile of orphanedPremiumProfiles) {
        // Skip admin accounts - they always keep premium
        if (adminProfileIds.has(profile.id)) {
          console.log(`⏭️ Skipping admin account ${profile.id} in orphan check`);
          continue;
        }

        const subscription = (profile as any).subscriptions;

        // Check if subscription is expired or doesn't exist
        const isExpired = subscription?.status === 'expired' ||
          (subscription?.expires_at && new Date(subscription.expires_at) < new Date());

        if (isExpired) {
          console.log(`Found orphaned premium profile ${profile.id} with expired subscription`);

          const { error: fixError } = await supabase
            .from('profiles')
            .update({
              is_premium: false,
              is_platinum: false,
            })
            .eq('id', profile.id);

          if (!fixError) {
            console.log(`✅ Fixed orphaned premium status for profile ${profile.id}`);
            processed++;
          } else {
            console.error(`Error fixing profile ${profile.id}:`, fixError);
            errors++;
          }
        }
      }
    }

    const result = {
      success: true,
      processed,
      errors,
      timestamp: now,
    };

    console.log('✅ Subscription expiration check complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('❌ Error in expire-subscriptions:', error);

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
