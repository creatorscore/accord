// Edge Function: backfill-stuck-onboarding
//
// ⚠️ DEPLOYED VERSION IS A 410-GONE STUB (retired 2026-05-13 after the
// rescue rescued 301 users). This file is the maintained source kept for
// future resurrection. To bring it back: rotate BACKFILL_TOKEN, redeploy
// via supabase MCP, then stub it again when done.
//
// One-shot rescue tool for users who completed all 30 onboarding steps but
// never got profile_complete=true because the location_required_when_complete
// CHECK constraint fired (lat/lng were null after a dropdown-picker selection
// where geocoding silently failed). See audit 2026-05-13 + Sentry issue
// JAVASCRIPT-REACT-71.
//
// Usage (POST):
//   curl -X POST <fn-url> \
//     -H 'x-backfill-token: <TOKEN>' \
//     -H 'content-type: application/json' \
//     -d '{"limit": 30, "dry_run": false}'
//
// Processes up to `limit` stuck users per invocation, grouped by unique
// (city, state, country) tuples so each tuple is geocoded once. Nominatim's
// usage policy caps requests at 1/sec — we sleep 1.2s between geocode calls
// to stay safely under. Returns stats and remaining count so the caller can
// loop until drained.
//
// SECURITY: protected by x-backfill-token header. After the backfill is
// complete, redeploy this function as a 410-Gone stub or remove the token
// check entirely — there is no /functions delete API surfaced via MCP.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const BACKFILL_TOKEN = 'PVrH_pUOJ2a3YCmo-b1oI8vs0yiAiYNL';
const NOMINATIM_USER_AGENT = 'AccordApp/1.0 (https://privy.reviews; hello@privy.reviews)';
const SLEEP_MS = 1200;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-backfill-token',
};

interface Body {
  profile_ids?: string[];
  dry_run?: boolean;
}

interface StuckUser {
  id: string;
  location_city: string;
  location_state: string | null;
  location_country: string | null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function tryNominatim(
  city: string,
  state: string | null,
  country: string | null,
  mode: 'structured' | 'freetext',
): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({ format: 'jsonv2', limit: '1', 'accept-language': 'en' });
  if (mode === 'structured') {
    if (city) params.set('city', city);
    if (state) params.set('state', state);
    if (country) params.set('country', country);
  } else {
    const q = [city, state, country].filter(Boolean).join(', ');
    if (!q) return null;
    params.set('q', q);
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      signal: controller.signal,
      headers: { 'User-Agent': NOMINATIM_USER_AGENT, Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    const first = data?.[0];
    if (!first?.lat || !first?.lon) return null;
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function geocode(city: string, state: string | null, country: string | null): Promise<{ lat: number; lng: number } | null> {
  // Three-pass: structured → freetext (city, state, country) → freetext
  // (city, country). The third pass rescues users whose state field is
  // malformed in our cities dataset (e.g. accented French regions).
  const structured = await tryNominatim(city, state, country, 'structured');
  if (structured) return structured;
  await sleep(SLEEP_MS);
  const freetext = await tryNominatim(city, state, country, 'freetext');
  if (freetext) return freetext;
  if (!state) return null;
  await sleep(SLEEP_MS);
  return await tryNominatim(city, null, country, 'freetext');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  if (req.headers.get('x-backfill-token') !== BACKFILL_TOKEN) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const ids = Array.isArray(body.profile_ids) ? body.profile_ids.slice(0, 100) : [];
  const dryRun = body.dry_run === true;

  if (ids.length === 0) {
    return new Response(JSON.stringify({ error: 'profile_ids required (array, max 100)' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Caller is responsible for vetting eligibility — we just resolve city
  // tuples for the IDs they passed and only touch rows that still need it.
  const { data: rawProfiles, error: fetchErr } = await admin
    .from('profiles')
    .select('id, location_city, location_state, location_country, latitude, longitude, profile_complete')
    .in('id', ids);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const candidates: StuckUser[] = [];
  for (const p of rawProfiles ?? []) {
    if (p.profile_complete === true) continue;
    if (p.latitude != null && p.longitude != null) continue;
    if (!p.location_city) continue;
    candidates.push({
      id: p.id,
      location_city: p.location_city,
      location_state: p.location_state,
      location_country: p.location_country,
    });
  }

  // Group unique (city, state, country) tuples
  const tupleKey = (u: StuckUser) => `${u.location_city}|${u.location_state ?? ''}|${u.location_country ?? ''}`;
  const uniqueTuples = new Map<string, { city: string; state: string | null; country: string | null }>();
  for (const u of candidates) {
    if (!uniqueTuples.has(tupleKey(u))) {
      uniqueTuples.set(tupleKey(u), { city: u.location_city, state: u.location_state, country: u.location_country });
    }
  }

  const coordsByKey = new Map<string, { lat: number; lng: number }>();
  let geocodeFailed = 0;
  let i = 0;
  for (const [key, t] of uniqueTuples) {
    if (i > 0) await sleep(SLEEP_MS);
    const c = await geocode(t.city, t.state, t.country);
    if (c) coordsByKey.set(key, c);
    else geocodeFailed++;
    i++;
  }

  // Apply updates
  let updated = 0;
  let updateFailed = 0;
  for (const u of candidates) {
    const c = coordsByKey.get(tupleKey(u));
    if (!c) continue;
    if (dryRun) {
      updated++;
      continue;
    }
    const { error: upErr } = await admin
      .from('profiles')
      .update({
        latitude: c.lat,
        longitude: c.lng,
        profile_complete: true,
        onboarding_step: 31,
        updated_at: new Date().toISOString(),
      })
      .eq('id', u.id);
    if (upErr) updateFailed++;
    else updated++;
  }

  return new Response(
    JSON.stringify({
      requested_ids: ids.length,
      candidates: candidates.length,
      unique_tuples: uniqueTuples.size,
      geocode_failed: geocodeFailed,
      updated,
      update_failed: updateFailed,
      dry_run: dryRun,
    }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
});
