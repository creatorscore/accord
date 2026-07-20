import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Anti-scam Phase 1 — verify a user's real location from their IP and flag
 * spoofing. Called by the app on open + on location change (with force=true).
 *
 * Uses IPQualityScore (IPQS_API_KEY secret): one HTTPS call returns the IP's
 * country + coordinates AND whether it's a VPN/proxy/Tor/datacenter plus a fraud
 * score — the strongest signals for catching a scammer pretending to be local.
 *
 * We SOFT-FLAG (per product decision), never hard-block: set location_flagged +
 * reason and location_verified. Reduced reach / hiding is enforced elsewhere off
 * these columns. Fails OPEN: any error (no key, IPQS down) leaves the account
 * unflagged so we never lock out a legit user on an infra hiccup.
 *
 * Throttle: skips the paid lookup if verified within THROTTLE_DAYS unless
 * force=true (location change), to stay inside the lookup quota.
 */

const THROTTLE_DAYS = 5;
const FRAUD_SCORE_FLAG = 88;        // IPQS 0-100; >=88 is high risk
const MISMATCH_MILES = 300;         // IP vs stated location gap that counts as a move/spoof

function milesBetween(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 3959;
  const dLat = (bLat - aLat) * Math.PI / 180;
  const dLon = (bLon - aLon) * Math.PI / 180;
  const s = Math.sin(dLat/2)**2 + Math.cos(aLat*Math.PI/180)*Math.cos(bLat*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }
    // Identify the caller from their token.
    const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userErr } = await asUser.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const { force, gps_lat, gps_lon } = await req.json().catch(() => ({} as any));

    const { data: profile } = await admin
      .from('profiles')
      .select('id, latitude, longitude, location_country, location_verified_at')
      .eq('user_id', user.id)
      .maybeSingle();
    if (!profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
    }

    // Throttle: skip the paid lookup if recently verified and not forced.
    if (!force && profile.location_verified_at) {
      const ageMs = Date.now() - new Date(profile.location_verified_at).getTime();
      if (ageMs < THROTTLE_DAYS * 86400_000) {
        return new Response(JSON.stringify({ skipped: true, reason: 'recently_verified' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
      }
    }

    const apiKey = Deno.env.get('IPQS_API_KEY');
    if (!apiKey) {
      console.warn('[verify-location] IPQS_API_KEY not set — skipping (fail-open).');
      return new Response(JSON.stringify({ skipped: true, reason: 'no_provider_key' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // Client IP: first entry of x-forwarded-for.
    const xff = req.headers.get('x-forwarded-for') || '';
    const ip = xff.split(',')[0].trim();
    if (!ip) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no_ip' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // IPQS lookup (5s timeout, fail-open on error).
    let ipq: any = null;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5000);
      try {
        const url = `https://ipqualityscore.com/api/json/ip/${apiKey}/${encodeURIComponent(ip)}?strictness=1&allow_public_access_points=true&fast=false&mobile=true`;
        const resp = await fetch(url, { signal: ctrl.signal });
        ipq = await resp.json();
      } finally { clearTimeout(timer); }
    } catch (e) {
      console.error('[verify-location] IPQS call failed (fail-open):', e);
      return new Response(JSON.stringify({ skipped: true, reason: 'provider_error' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    if (!ipq || ipq.success === false) {
      console.error('[verify-location] IPQS returned failure (fail-open):', ipq?.message);
      return new Response(JSON.stringify({ skipped: true, reason: 'provider_failure' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    const ipCountry: string | null = ipq.country_code ?? null;
    const ipLat: number | null = typeof ipq.latitude === 'number' ? ipq.latitude : null;
    const ipLon: number | null = typeof ipq.longitude === 'number' ? ipq.longitude : null;

    const reasons: string[] = [];
    // 1) Hiding behind VPN/proxy/Tor/datacenter — the classic scammer setup.
    if (ipq.vpn || ipq.proxy || ipq.tor || ipq.active_vpn || ipq.active_tor) reasons.push('vpn_or_proxy');
    if ((ipq.connection_type || '').toLowerCase() === 'data center') reasons.push('datacenter_ip');
    // 2) High fraud score from the provider.
    if (typeof ipq.fraud_score === 'number' && ipq.fraud_score >= FRAUD_SCORE_FLAG) reasons.push('high_fraud_score');
    // 3) IP location doesn't match the stated location (country or >300mi apart).
    const claimLat = typeof gps_lat === 'number' ? gps_lat : (profile.latitude != null ? Number(profile.latitude) : null);
    const claimLon = typeof gps_lon === 'number' ? gps_lon : (profile.longitude != null ? Number(profile.longitude) : null);
    if (ipCountry && profile.location_country && ipCountry.toUpperCase() !== String(profile.location_country).toUpperCase()) {
      reasons.push('country_mismatch');
    } else if (ipLat != null && ipLon != null && claimLat != null && claimLon != null
               && milesBetween(ipLat, ipLon, claimLat, claimLon) > MISMATCH_MILES) {
      reasons.push('location_mismatch');
    }

    const flagged = reasons.length > 0;

    await admin.from('profiles').update({
      ip_country: ipCountry,
      ip_latitude: ipLat,
      ip_longitude: ipLon,
      location_flagged: flagged,
      location_flag_reason: flagged ? reasons.join(',') : null,
      location_verified: !flagged,
      location_verified_at: new Date().toISOString(),
    }).eq('id', profile.id);

    return new Response(JSON.stringify({ verified: !flagged, flagged, reasons }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error: any) {
    console.error('[verify-location] unexpected (fail-open):', error?.message ?? error);
    // Fail open — never block a user on our error.
    return new Response(JSON.stringify({ skipped: true, reason: 'error' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  }
});
