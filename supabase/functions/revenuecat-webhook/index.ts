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
    id?: string; // RevenueCat's unique event id — used for dedup.
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
      environment: payload.event.environment,
    });

    // Idempotency: RC retries deliver the same event multiple times. Fall
    // back to a composite key if RC didn't provide event.id (older payloads).
    // Primary-key violation on insert = duplicate delivery → ack and exit.
    const eventDedupKey = payload.event.id
      ?? `${payload.event.type}:${payload.event.app_user_id}:${payload.event.purchased_at_ms}`;
    const { error: dedupError } = await supabase
      .from('revenuecat_webhook_events')
      .insert({
        event_id: eventDedupKey,
        event_type: payload.event.type,
        app_user_id: payload.event.app_user_id,
      });
    if (dedupError && dedupError.code === '23505') {
      // Unique violation on PK — we already processed this event.
      console.log('⏭️ Duplicate webhook event, skipping:', eventDedupKey);
      return new Response(
        JSON.stringify({ ok: true, ignored: 'duplicate_event', eventId: eventDedupKey }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else if (dedupError) {
      // Any OTHER insert failure: log and proceed anyway. Dedup is a nice-to-have,
      // not a blocker — reconcile-subscriptions catches drift weekly.
      console.warn('⚠️ webhook dedup insert failed, continuing:', dedupError);
    }

    // Sandbox events (TestFlight / dev test purchases) must not flip prod
    // is_premium flags. Without this guard a tester who buys in sandbox gets
    // production premium on the same Supabase project. Set
    // ALLOW_SANDBOX_SUBSCRIPTIONS=true in the function env if you run a single
    // Supabase for both prod + TestFlight and explicitly want sandbox entitlements
    // to reach the DB. Default: log and return 200 (ack so RC stops retrying).
    if (payload.event.environment === 'SANDBOX' &&
        Deno.env.get('ALLOW_SANDBOX_SUBSCRIPTIONS') !== 'true') {
      console.log('⚠️ Sandbox webhook ignored (prod safety):', {
        userId: payload.event.app_user_id,
        eventType: payload.event.type,
        product: payload.event.product_id,
      });
      return new Response(
        JSON.stringify({ ok: true, ignored: 'sandbox_event' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { type, app_user_id, entitlement_ids, expiration_at_ms } = payload.event;

    // Determine premium/platinum status based on entitlements.
    // Case-INSENSITIVE: RevenueCat entitlement ids have been configured with
    // inconsistent casing across this project's history ("Premium" vs
    // "premium"). An exact-match .includes('premium') misses a "Premium"
    // subscriber, and this handler then clears their premium flag — revoking
    // access someone is actively paying for. The client has matched
    // case-insensitively for a while (lib/revenue-cat.ts); this path had not.
    const entitlementIdsLower = (entitlement_ids ?? []).map((e) => e.toLowerCase());
    const hasPremium = entitlementIdsLower.includes('premium');
    const hasPlatinum = entitlementIdsLower.includes('platinum');

    // Check if subscription is active (not expired)
    // If no expiration date, treat as active (lifetime subscriptions have no expiry)
    const isActive = expiration_at_ms ? expiration_at_ms > Date.now() : true;

    // Get the user's profile ID and admin status from auth.users -> profiles
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, is_admin')
      .eq('user_id', app_user_id)
      .maybeSingle();

    if (profileError || !profile) {
      console.error('Profile not found for user:', app_user_id, profileError);
      // Log to dead-letter so we can audit/reconcile later. Return 200 so
      // RevenueCat stops retrying indefinitely — the client will call
      // sync-subscription on next launch, and reconcile-subscriptions covers
      // anything missed.
      await supabase.from('revenuecat_webhook_failures').insert({
        event_type: type,
        app_user_id,
        product_id: payload.event.product_id,
        entitlement_ids,
        reason: 'profile_not_found',
        error_details: profileError?.message ?? null,
        raw_payload: payload as unknown as Record<string, unknown>,
      });
      return new Response(
        JSON.stringify({ ok: true, logged: 'profile_not_found', userId: app_user_id }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
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
        await updateSubscriptionStatus(profile.id, hasPremium, hasPlatinum, true, expiration_at_ms, isTrial, app_user_id);
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
        // Grace period: payment failed but Apple/Google still considers the
        // subscription valid for a few days. Keep is_premium = true until the
        // eventual EXPIRATION event, but flag the status so clients can show
        // a "payment issue — update your card" banner and admins can see the
        // user is at risk. Also queue a push nudging them to fix payment.
        console.log('⚠️ Billing issue for user — entering grace:', app_user_id);
        await supabase.from('subscriptions')
          .update({ status: 'grace' })
          .eq('profile_id', profile.id);
        await supabase.from('notification_queue').insert({
          recipient_profile_id: profile.id,
          notification_type: 'billing_issue',
          title: 'Payment issue with your subscription',
          body: 'We had trouble charging your card. Update your payment method in the store to keep your Premium features.',
          data: { type: 'billing_issue', screen: 'subscription' },
          status: 'pending',
        });
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
    // Best-effort dead-letter log — swallow any failure of the log itself.
    try {
      const bodyText = await req.clone().text().catch(() => '');
      let parsed: any = null;
      try { parsed = JSON.parse(bodyText); } catch {}
      await supabase.from('revenuecat_webhook_failures').insert({
        event_type: parsed?.event?.type ?? null,
        app_user_id: parsed?.event?.app_user_id ?? null,
        product_id: parsed?.event?.product_id ?? null,
        entitlement_ids: parsed?.event?.entitlement_ids ?? null,
        reason: 'processing_error',
        error_details: (error as Error)?.message ?? String(error),
        raw_payload: parsed,
      });
    } catch (logError) {
      console.error('Failed to write webhook failure log:', logError);
    }
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
  isTrial: boolean = false,
  appUserId?: string
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
          ...(appUserId ? { revenuecat_customer_id: appUserId } : {}),
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
