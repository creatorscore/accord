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
 * VPN/proxy/Tor is NOT a fraud signal here and disables the other IP checks —
 * our members use VPNs for personal safety. See the block around `onVpn`.
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

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    // Identify the caller from their token. Pass the token EXPLICITLY to
    // getUser() — a server-side client has no stored session, so the no-arg
    // getUser() form returns "Auth session missing" and 401s every call (this
    // is what silently broke IP verification for the entire user base). This
    // matches the working pattern in admin-* functions.
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }

    const { force, gps_lat, gps_lon } = await req.json().catch(() => ({} as any));

    const { data: profile } = await admin
      .from('profiles')
      .select('id, latitude, longitude, location_country, location_verified_at, location_flagged, location_flag_reason')
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

    // A VPN/proxy/Tor exit makes EVERY other IP signal meaningless, so it is not
    // itself a fraud signal and it suppresses the rest of the IP checks:
    //   - the exit node's country/coords are the VPN's, not the user's, so
    //     country_mismatch / location_mismatch would just be detecting the VPN;
    //   - IPQS scores VPN ranges as high-risk by definition, so fraud_score
    //     would be re-detecting the VPN too (this is what defeated the previous
    //     "VPN stays flag-only" carve-out and auto-suppressed real members);
    //   - commercial VPNs exit through datacenters, so datacenter_ip likewise.
    // Our users are LGBTQ+ people in countries where a VPN is a safety measure.
    // Penalising it is penalising exactly the protection this app exists to give.
    // GPS spoofing is still caught by the `guard_location_change` teleport
    // trigger, which is GPS-based and unaffected by any of this.
    const onVpn = !!(ipq.vpn || ipq.proxy || ipq.tor || ipq.active_vpn || ipq.active_tor);

    const reasons: string[] = [];
    if (!onVpn) {
      // Real users aren't on datacenter IPs without a VPN — that's bots/scrapers.
      if ((ipq.connection_type || '').toLowerCase() === 'data center') reasons.push('datacenter_ip');
      if (typeof ipq.fraud_score === 'number' && ipq.fraud_score >= FRAUD_SCORE_FLAG) reasons.push('high_fraud_score');
      // IP location doesn't match the stated location (country or >300mi apart).
      const claimLat = typeof gps_lat === 'number' ? gps_lat : (profile.latitude != null ? Number(profile.latitude) : null);
      const claimLon = typeof gps_lon === 'number' ? gps_lon : (profile.longitude != null ? Number(profile.longitude) : null);
      if (ipCountry && profile.location_country && ipCountry.toUpperCase() !== String(profile.location_country).toUpperCase()) {
        reasons.push('country_mismatch');
      } else if (ipLat != null && ipLon != null && claimLat != null && claimLon != null
                 && milesBetween(ipLat, ipLon, claimLat, claimLon) > MISMATCH_MILES) {
        reasons.push('location_mismatch');
      }
    }

    const ipFlagged = reasons.length > 0;

    // COLLISION GUARD: the BEFORE-UPDATE trigger `guard_location_change` also
    // writes location_flagged/location_flag_reason when it detects an impossible
    // GPS "jump" (teleport). Those flags carry reasons like "Jump 4738 mi ...".
    // A GPS-spoofing scammer can still connect from a clean residential IP, so
    // the IP check alone would find nothing and MUST NOT erase an existing
    // teleport flag. Preserve any prior non-IP (jump) flag and OR it with ours.
    const priorReason: string | null = (profile as any).location_flag_reason ?? null;
    const priorIsJump = (profile as any).location_flagged === true
      && !!priorReason && /^Jump /.test(priorReason);

    const flagged = ipFlagged || priorIsJump;
    const reasonParts: string[] = [];
    if (ipFlagged) reasonParts.push(reasons.join(','));
    if (priorIsJump && priorReason) reasonParts.push(priorReason);
    const flagReason = flagged ? reasonParts.join(' | ') : null;

    // AUTOMATED ENFORCEMENT: only high-confidence IP signals auto-suppress from
    // discovery — the provider's high fraud score, or a datacenter IP. Both are
    // only ever recorded for non-VPN connections (see above), so a member on a
    // VPN can no longer be auto-suppressed. A bare country/location mismatch
    // stays flag-only (legit travellers). A prior teleport suppression persists;
    // only our own ip_fraud verdict is lifted, in the self-heal step below.
    const strongIp = !onVpn && (reasons.includes('high_fraud_score') || reasons.includes('datacenter_ip'));
    const suppressPatch = strongIp
      ? {
          discovery_suppressed: true,
          discovery_suppressed_reason: 'ip_fraud',
          discovery_suppressed_at: new Date().toISOString(),
        }
      : {};

    await admin.from('profiles').update({
      ip_country: ipCountry,
      ip_latitude: ipLat,
      ip_longitude: ipLon,
      location_flagged: flagged,
      location_flag_reason: flagReason,
      location_verified: !flagged,
      location_verified_at: new Date().toISOString(),
      ...suppressPatch,
    }).eq('id', profile.id);

    // Self-heal: an ip_fraud suppression must lift as soon as the connection no
    // longer shows a signal strong enough to suppress, otherwise one bad reading
    // hides a member permanently — that is how members ended up suppressed with
    // no flag reason left on the row.
    //
    // The condition is NOT `!flagged`, deliberately. A flag-only reason
    // (country_mismatch / location_mismatch) never justifies suppression on its
    // own, so gating the heal on an unflagged row left mismatch-flagged members
    // hidden forever: the flag they carry was exactly what stopped the heal from
    // running. Suppression and flagging are separate severities, and the heal
    // must key off the suppression one.
    //
    // `priorIsJump` IS still excluded: a GPS teleport is the one genuine
    // spoofing signal we have, and it is not ours to clear from an IP reading —
    // only a new clean GPS history or an admin dismissal should lift it.
    //
    // Scoped by .eq('discovery_suppressed_reason','ip_fraud') so a teleport or
    // scam-report suppression, which this function does not own, is untouched.
    let unsuppressed = false;
    if (!strongIp && !priorIsJump) {
      const { data: healed } = await admin
        .from('profiles')
        .update({
          discovery_suppressed: false,
          discovery_suppressed_reason: null,
          discovery_suppressed_at: null,
        })
        .eq('id', profile.id)
        .eq('discovery_suppressed_reason', 'ip_fraud')
        .select('id');
      unsuppressed = !!healed?.length;
    }

    return new Response(JSON.stringify({ verified: !flagged, flagged, reasons, on_vpn: onVpn, unsuppressed, preserved_jump_flag: priorIsJump }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error: any) {
    console.error('[verify-location] unexpected (fail-open):', error?.message ?? error);
    // Fail open — never block a user on our error.
    return new Response(JSON.stringify({ skipped: true, reason: 'error' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  }
});
