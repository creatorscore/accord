import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const REVENUECAT_WEBHOOK_SECRET = Deno.env.get('REVENUECAT_WEBHOOK_SECRET');

// Initialize Supabase client with service role key for admin operations
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// RevenueCat event types
type RevenueCatEventType =
  | 'INITIAL_PURCHASE'
  | 'RENEWAL'
  | 'CANCELLATION'
  | 'UNCANCELLATION'
  | 'NON_RENEWING_PURCHASE'
  | 'SUBSCRIPTION_PAUSED'
  | 'EXPIRATION'
  | 'BILLING_ISSUE'
  | 'PRODUCT_CHANGE';

interface RevenueCatWebhookEvent {
  event: {
    type: RevenueCatEventType;
    app_user_id: string;
    product_id: string;
    period_type: 'TRIAL' | 'INTRO' | 'NORMAL';
    purchased_at_ms: number;
    expiration_at_ms: number | null;
    store: 'APP_STORE' | 'PLAY_STORE' | 'STRIPE' | 'PROMOTIONAL';
    environment: 'SANDBOX' | 'PRODUCTION';
    entitlement_ids: string[];
    is_trial_conversion: boolean;
  };
}

serve(async (req) => {
  try {
    // Only accept POST requests
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Verify webhook authorization - RevenueCat sends the secret directly without "Bearer " prefix
    const authHeader = req.headers.get('Authorization');

    if (REVENUECAT_WEBHOOK_SECRET && authHeader !== REVENUECAT_WEBHOOK_SECRET) {
      console.error('Invalid webhook secret');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const payload: RevenueCatWebhookEvent = await req.json();
    console.log('RevenueCat webhook received:', {
      eventType: payload.event.type,
      userId: payload.event.app_user_id,
      productId: payload.event.product_id,
      entitlements: payload.event.entitlement_ids,
    });

    const { type, app_user_id, entitlement_ids, expiration_at_ms } = payload.event;

    // Determine premium/platinum status based on entitlements
    const hasPremium = entitlement_ids?.includes('premium') || false;
    const hasPlatinum = entitlement_ids?.includes('platinum') || false;

    // Check if subscription is active (not expired)
    const isActive = expiration_at_ms ? expiration_at_ms > Date.now() : false;

    // Get the user's profile ID and admin status from auth.users -> profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, is_admin')
      .eq('user_id', app_user_id)
      .single();

    if (profileError || !profile) {
      console.error('Profile not found for user:', app_user_id, profileError);
      return new Response(
        JSON.stringify({ error: 'Profile not found', userId: app_user_id }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Check if user is admin (admins always keep premium)
    const isAdmin = profile.is_admin === true;

    // Determine if this is a trial subscription
    const isTrial = payload.event.period_type === 'TRIAL';

    // Update subscription status based on event type
    switch (type) {
      case 'INITIAL_PURCHASE':
      case 'RENEWAL':
      case 'UNCANCELLATION':
      case 'PRODUCT_CHANGE':
        // Activate subscription with expiration date
        await updateSubscriptionStatus(profile.id, hasPremium, hasPlatinum, true, expiration_at_ms, isTrial);
        console.log('✅ Subscription activated:', {
          userId: app_user_id,
          hasPremium,
          hasPlatinum,
          expiresAt: expiration_at_ms ? new Date(expiration_at_ms).toISOString() : null,
          periodType: payload.event.period_type, // TRIAL, INTRO, or NORMAL
          isTrial,
        });
        break;

      case 'CANCELLATION':
        // Keep subscription active until expiration, but update auto_renew to false
        console.log('⚠️ Subscription cancelled (will expire at ' + (expiration_at_ms ? new Date(expiration_at_ms).toISOString() : 'unknown') + '):', app_user_id);
        // Update subscription to show it won't renew
        await supabase
          .from('subscriptions')
          .update({ auto_renew: false })
          .eq('profile_id', profile.id);
        break;

      case 'EXPIRATION':
        // Skip expiration for admin accounts - they always keep premium
        if (isAdmin) {
          console.log('⏭️ Skipping expiration for admin account:', app_user_id);
          break;
        }
        // Deactivate subscription - this is critical for trial expirations
        await updateSubscriptionStatus(profile.id, false, false, false);
        console.log('❌ Subscription/trial expired:', {
          userId: app_user_id,
          periodType: payload.event.period_type,
          wasTrialConversion: payload.event.is_trial_conversion,
        });
        break;

      case 'BILLING_ISSUE':
        // Keep subscription active temporarily, but log for monitoring
        console.log('⚠️ Billing issue for user:', app_user_id);
        // Could add notification to user here
        break;

      default:
        console.log('Unhandled event type:', type);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Update subscription status in profiles table and subscriptions table
 */
async function updateSubscriptionStatus(
  profileId: string,
  isPremium: boolean,
  isPlatinum: boolean,
  isActive: boolean,
  expirationMs?: number | null,
  isTrial: boolean = false
) {
  try {
    // Update profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        is_premium: isPremium || isPlatinum,
        is_platinum: isPlatinum,
      })
      .eq('id', profileId);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw profileError;
    }

    // Update or insert into subscriptions table
    const tier = isPlatinum ? 'platinum' : isPremium ? 'premium' : null;
    const expiresAt = expirationMs ? new Date(expirationMs).toISOString() : null;
    // Set status to 'trial' for trial periods, 'active' for paid subscriptions
    const status = isTrial ? 'trial' : 'active';

    if (isActive && tier) {
      const { error: subscriptionError } = await supabase.from('subscriptions').upsert(
        {
          profile_id: profileId,
          tier,
          status,
          auto_renew: true,
          expires_at: expiresAt,
        },
        { onConflict: 'profile_id' }
      );

      if (subscriptionError) {
        console.error('Error updating subscription:', subscriptionError);
        throw subscriptionError;
      }
    } else if (!isActive) {
      // Mark subscription as expired and clear premium status
      const { error: subscriptionError } = await supabase
        .from('subscriptions')
        .update({
          status: 'expired',
          auto_renew: false,
        })
        .eq('profile_id', profileId);

      if (subscriptionError) {
        console.error('Error expiring subscription:', subscriptionError);
      }
    }

    console.log('✅ Database updated successfully:', {
      profileId,
      isPremium,
      isPlatinum,
      isActive,
      isTrial,
      status,
      expiresAt,
    });
  } catch (error) {
    console.error('Failed to update subscription status:', error);
    throw error;
  }
}
