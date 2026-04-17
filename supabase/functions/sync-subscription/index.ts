import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Sync Subscription
 *
 * Server-authoritative post-purchase sync. The client calls this after a
 * successful RevenueCat purchase/restore. We fetch CustomerInfo from the
 * RevenueCat REST API (not from the client) and upsert subscriptions +
 * profiles using the service role.
 *
 * This is a safety net for:
 *   - Webhook delivery failures / missed retries
 *   - Webhook arriving before the profile row exists
 *   - Client-side RLS update failures silently swallowed
 *
 * Auth modes:
 *   - User JWT: syncs the caller's own subscription (user_id = auth.uid())
 *   - Service role: accepts { user_id } in body, for admin reconciliation
 *
 * Requires: REVENUECAT_SECRET_KEY
 */

interface RevenueCatSubscriber {
  subscriber: {
    entitlements: Record<string, {
      expires_date: string | null;
      purchase_date: string;
      product_identifier: string;
      period_type: string;
    }>;
    subscriptions: Record<string, {
      expires_date: string | null;
      purchase_date: string;
      period_type: string;
      unsubscribe_detected_at: string | null;
      billing_issues_detected_at: string | null;
      store: string;
    }>;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const rcKey = Deno.env.get('REVENUECAT_SECRET_KEY');

    if (!rcKey) {
      return new Response(
        JSON.stringify({ error: 'REVENUECAT_SECRET_KEY not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve target user id from the caller's JWT. If the JWT's role claim is
    // service_role, the caller is admin and may specify any user_id in the body.
    // Otherwise they're a normal user and we sync their own subscription.
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Missing Authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    let jwtRole: string | null = null;
    let jwtSub: string | null = null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      jwtRole = payload.role ?? null;
      jwtSub = payload.sub ?? null;
    } catch {
      return new Response(
        JSON.stringify({ error: 'Invalid JWT' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    let targetUserId: string | null = null;
    const callerIsServiceRole = jwtRole === 'service_role';

    if (callerIsServiceRole) {
      const body = await req.json().catch(() => ({}));
      targetUserId = body?.user_id ?? null;
      if (!targetUserId) {
        return new Response(
          JSON.stringify({ error: 'user_id required when calling with service role' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    } else {
      // Verify the user JWT properly via Auth API
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData?.user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
        );
      }
      targetUserId = userData.user.id;
    }

    // Look up profile
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, is_admin')
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: 'Profile not found', user_id: targetUserId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Fetch from RevenueCat
    const rcResponse = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${targetUserId}`,
      {
        headers: {
          'Authorization': `Bearer ${rcKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!rcResponse.ok) {
      const errText = await rcResponse.text();
      console.error(`RC API error for ${targetUserId}: ${rcResponse.status} ${errText}`);
      return new Response(
        JSON.stringify({
          error: 'RevenueCat lookup failed',
          status: rcResponse.status,
          details: errText,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 }
      );
    }

    const rcData: RevenueCatSubscriber = await rcResponse.json();
    const entitlements = rcData.subscriber.entitlements ?? {};
    const subs = rcData.subscriber.subscriptions ?? {};

    const now = new Date();
    const premiumEnt = entitlements.premium;
    const platinumEnt = entitlements.platinum;

    const hasPremium = !!premiumEnt &&
      (premiumEnt.expires_date === null || new Date(premiumEnt.expires_date) > now);
    const hasPlatinum = !!platinumEnt &&
      (platinumEnt.expires_date === null || new Date(platinumEnt.expires_date) > now);

    const tier = hasPlatinum ? 'platinum' : hasPremium ? 'premium' : null;
    const expiresAt = hasPlatinum
      ? platinumEnt!.expires_date
      : hasPremium
        ? premiumEnt!.expires_date
        : null;

    const periodType = hasPlatinum
      ? platinumEnt!.period_type
      : hasPremium
        ? premiumEnt!.period_type
        : null;
    const isTrial = periodType === 'trial' || periodType === 'intro';

    const activeSubs = Object.values(subs);
    const hasUnsubscribed = activeSubs.some((s) => s.unsubscribe_detected_at !== null);

    // Update profiles (skip for admins — they always keep premium)
    if (!profile.is_admin) {
      const { error: profileUpdateError } = await admin
        .from('profiles')
        .update({
          is_premium: hasPremium || hasPlatinum,
          is_platinum: hasPlatinum,
        })
        .eq('id', profile.id);

      if (profileUpdateError) {
        console.error('Profile update failed:', profileUpdateError);
        throw profileUpdateError;
      }
    }

    // Upsert or expire subscription row
    if (tier) {
      const { error: upsertError } = await admin.from('subscriptions').upsert(
        {
          profile_id: profile.id,
          tier,
          status: isTrial ? 'trial' : 'active',
          auto_renew: !hasUnsubscribed,
          expires_at: expiresAt,
          revenuecat_customer_id: targetUserId,
        },
        { onConflict: 'profile_id' }
      );

      if (upsertError) {
        console.error('Subscription upsert failed:', upsertError);
        throw upsertError;
      }
    } else {
      // No active entitlement — mark any existing row as expired
      const { error: expireError } = await admin
        .from('subscriptions')
        .update({ status: 'expired', auto_renew: false })
        .eq('profile_id', profile.id);

      if (expireError) {
        console.error('Subscription expire failed:', expireError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: targetUserId,
        profile_id: profile.id,
        tier,
        is_trial: isTrial,
        expires_at: expiresAt,
        auto_renew: !hasUnsubscribed,
        caller_is_service_role: callerIsServiceRole,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('sync-subscription error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
