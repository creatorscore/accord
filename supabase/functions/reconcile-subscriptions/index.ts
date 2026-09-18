import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Reconcile Subscriptions
 *
 * Checks every "active" subscription in the database against RevenueCat's API
 * to find and fix mismatches. Also checks expired subs that may have been renewed.
 *
 * Run manually or on a weekly cron to keep the database in sync.
 *
 * Requires: REVENUECAT_API_KEY (secret API key from RevenueCat dashboard)
 */

interface RevenueCatSubscriber {
  subscriber: {
    entitlements: Record<string, {
      expires_date: string | null;
      purchase_date: string;
      product_identifier: string;
      period_type: string; // normal, trial, intro
    }>;
    subscriptions: Record<string, {
      expires_date: string | null;
      purchase_date: string;
      period_type: string;
      unsubscribe_detected_at: string | null;
      billing_issues_detected_at: string | null;
      is_sandbox: boolean;
      store: string;
    }>;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const REVENUECAT_API_KEY = Deno.env.get('REVENUECAT_SECRET_KEY');
    if (!REVENUECAT_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'REVENUECAT_SECRET_KEY not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Parse optional query params
    const url = new URL(req.url);
    const dryRun = url.searchParams.get('dry_run') === 'true';
    const checkExpired = url.searchParams.get('check_expired') === 'true';

    console.log(`🔄 Starting subscription reconciliation (dry_run: ${dryRun}, check_expired: ${checkExpired})`);

    // Get admin profile IDs to skip
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('id')
      .eq('is_admin', true);
    const adminIds = new Set((adminProfiles || []).map(p => p.id));

    // Fetch subscriptions to check
    let query = supabase
      .from('subscriptions')
      .select('id, profile_id, revenuecat_customer_id, status, tier, expires_at, auto_renew')
      .not('revenuecat_customer_id', 'is', null);

    if (checkExpired) {
      // Check both active and recently expired (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      query = query.or(`status.eq.active,and(status.eq.expired,expires_at.gte.${thirtyDaysAgo})`);
    } else {
      query = query.eq('status', 'active');
    }

    const { data: subscriptions, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    console.log(`Found ${subscriptions?.length || 0} subscriptions to check`);

    const results = {
      checked: 0,
      matched: 0,
      fixed: {
        activated: 0,    // Was expired in DB, actually active in RC
        deactivated: 0,  // Was active in DB, actually expired in RC
        tier_corrected: 0,
        expiry_updated: 0,
      },
      errors: 0,
      skipped_admin: 0,
      details: [] as any[],
    };

    for (const sub of subscriptions || []) {
      // Skip admins
      if (adminIds.has(sub.profile_id)) {
        results.skipped_admin++;
        continue;
      }

      results.checked++;

      try {
        // Call RevenueCat API for this subscriber
        const rcResponse = await fetch(
          `https://api.revenuecat.com/v1/subscribers/${sub.revenuecat_customer_id}`,
          {
            headers: {
              'Authorization': `Bearer ${REVENUECAT_API_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!rcResponse.ok) {
          if (rcResponse.status === 404) {
            // Subscriber not found in RevenueCat — they never purchased
            console.log(`⚠️ Subscriber ${sub.revenuecat_customer_id} not found in RevenueCat`);
            results.details.push({
              profile_id: sub.profile_id,
              rc_id: sub.revenuecat_customer_id,
              issue: 'not_found_in_revenuecat',
              db_status: sub.status,
            });

            if (!dryRun && sub.status === 'active') {
              await supabase.from('subscriptions').update({ status: 'expired', auto_renew: false }).eq('id', sub.id);
              await supabase.from('profiles').update({ is_premium: false, is_platinum: false }).eq('id', sub.profile_id);
              results.fixed.deactivated++;
            }
            continue;
          }
          console.error(`RC API error for ${sub.revenuecat_customer_id}: ${rcResponse.status}`);
          results.errors++;
          continue;
        }

        const rcData: RevenueCatSubscriber = await rcResponse.json();
        const entitlements = rcData.subscriber.entitlements ?? {};

        // Match entitlement identifiers case-INSENSITIVELY. RevenueCat entitlement
        // ids have been configured with inconsistent casing across this project's
        // history ("Premium" vs "premium"). This function writes is_premium:false
        // across EVERY subscription it walks, so an exact-match miss here doesn't
        // just fail to grant — it mass-revokes people who are actively paying.
        // The client has matched case-insensitively for a while
        // (lib/revenue-cat.ts hasActiveEntitlement); this path had not.
        const findEnt = (name: string) => {
          const target = name.toLowerCase();
          const key = Object.keys(entitlements).find((k) => k.toLowerCase() === target);
          return key ? entitlements[key] : undefined;
        };
        const premiumEnt = findEnt('premium');
        const platinumEnt = findEnt('platinum');

        // Check if they have active entitlements
        const now = new Date();
        const hasPremium = !!premiumEnt &&
          (premiumEnt.expires_date === null || new Date(premiumEnt.expires_date) > now);
        const hasPlatinum = !!platinumEnt &&
          (platinumEnt.expires_date === null || new Date(platinumEnt.expires_date) > now);
        const rcIsActive = hasPremium || hasPlatinum;
        const rcTier = hasPlatinum ? 'platinum' : hasPremium ? 'premium' : null;

        // Get expiry date from RC
        const rcExpiry = hasPremium
          ? premiumEnt?.expires_date
          : hasPlatinum
            ? platinumEnt?.expires_date
            : null;

        // Check for unsubscribe (cancelled but still active until expiry)
        const activeSubscriptions = Object.values(rcData.subscriber.subscriptions);
        const hasUnsubscribed = activeSubscriptions.some(s => s.unsubscribe_detected_at !== null);
        const hasBillingIssue = activeSubscriptions.some(s => s.billing_issues_detected_at !== null);

        const dbIsActive = sub.status === 'active';

        // Compare and fix
        if (rcIsActive && !dbIsActive) {
          // RC says active, DB says expired — reactivate
          console.log(`🔧 Reactivating ${sub.profile_id}: RC active, DB expired`);
          results.details.push({
            profile_id: sub.profile_id,
            issue: 'should_be_active',
            db_status: sub.status,
            rc_tier: rcTier,
            rc_expiry: rcExpiry,
          });

          if (!dryRun) {
            await supabase.from('subscriptions').update({
              status: 'active',
              tier: rcTier!,
              auto_renew: !hasUnsubscribed,
              expires_at: rcExpiry,
            }).eq('id', sub.id);
            await supabase.from('profiles').update({
              is_premium: true,
              is_platinum: rcTier === 'platinum',
            }).eq('id', sub.profile_id);
            results.fixed.activated++;
          }
        } else if (!rcIsActive && dbIsActive) {
          // RC says expired, DB says active — deactivate
          console.log(`🔧 Deactivating ${sub.profile_id}: RC expired, DB active`);
          results.details.push({
            profile_id: sub.profile_id,
            issue: 'should_be_expired',
            db_status: sub.status,
            rc_status: 'expired',
          });

          if (!dryRun) {
            await supabase.from('subscriptions').update({
              status: 'expired',
              auto_renew: false,
            }).eq('id', sub.id);
            await supabase.from('profiles').update({
              is_premium: false,
              is_platinum: false,
            }).eq('id', sub.profile_id);
            results.fixed.deactivated++;
          }
        } else if (rcIsActive && dbIsActive) {
          // Both agree active — check tier and expiry match
          if (rcTier && rcTier !== sub.tier) {
            results.details.push({
              profile_id: sub.profile_id,
              issue: 'tier_mismatch',
              db_tier: sub.tier,
              rc_tier: rcTier,
            });
            if (!dryRun) {
              await supabase.from('subscriptions').update({ tier: rcTier }).eq('id', sub.id);
              await supabase.from('profiles').update({
                is_premium: true,
                is_platinum: rcTier === 'platinum',
              }).eq('id', sub.profile_id);
              results.fixed.tier_corrected++;
            }
          }

          // Update expiry if different
          if (rcExpiry && rcExpiry !== sub.expires_at) {
            if (!dryRun) {
              await supabase.from('subscriptions').update({
                expires_at: rcExpiry,
                auto_renew: !hasUnsubscribed,
              }).eq('id', sub.id);
              results.fixed.expiry_updated++;
            }
          }

          // Update auto_renew based on unsubscribe status
          if (hasUnsubscribed && sub.auto_renew) {
            if (!dryRun) {
              await supabase.from('subscriptions').update({ auto_renew: false }).eq('id', sub.id);
            }
          }

          results.matched++;
        } else {
          // Both agree expired
          results.matched++;
        }

        // Rate limit: RevenueCat allows ~10 req/sec
        if (results.checked % 10 === 0) {
          await new Promise(r => setTimeout(r, 1100));
        }
      } catch (err) {
        console.error(`Error checking ${sub.revenuecat_customer_id}:`, err);
        results.errors++;
      }
    }

    const summary = {
      success: true,
      dry_run: dryRun,
      ...results,
    };

    console.log('✅ Reconciliation complete:', JSON.stringify(summary, null, 2));

    return new Response(JSON.stringify(summary, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('❌ Reconciliation error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
