// Edge Function: geocode-city
// Forward-geocodes a city/state/country tuple to lat/lng using OpenStreetMap
// Nominatim. Used by the onboarding LocationStep when the device-side
// Location.geocodeAsync() returns no results — typically because the user
// denied location permission, picked a city from the dropdown, and would
// otherwise advance with null lat/lng. The location_required_when_complete
// CHECK constraint on profiles then traps them in preview-mode purgatory at
// the final save (see audit 2026-05-05).
//
// Nominatim is free; their usage policy requires a descriptive User-Agent
// and ≤1 req/sec from a single source. Edge Functions are stateless across
// invocations, so we trust per-user pacing (each user only hits this 0–1
// times per signup) rather than enforcing a server-side rate limit.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOMINATIM_USER_AGENT = 'AccordApp/1.0 (https://privy.reviews; hello@privy.reviews)';

interface GeocodeRequest {
  city?: string;
  state?: string;
  country?: string;
}

async function tryQuery(
  input: { city: string; state: string; country: string },
  mode: 'structured' | 'freetext',
): Promise<{ lat: number; lng: number } | null> {
  const params = new URLSearchParams({ format: 'jsonv2', limit: '1', 'accept-language': 'en' });

  if (mode === 'structured') {
    if (input.city) params.set('city', input.city);
    if (input.state) params.set('state', input.state);
    if (input.country) params.set('country', input.country);
  } else {
    // Free-text — concatenate everything we have. Nominatim's q= is the same
    // engine OSM's website uses and tolerates typos / wrong admin levels.
    const q = [input.city, input.state, input.country].filter(Boolean).join(', ');
    if (!q) return null;
    params.set('q', q);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      signal: controller.signal,
      headers: { 'User-Agent': NOMINATIM_USER_AGENT, Accept: 'application/json' },
    });
    if (!response.ok) return null;
    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    const first = results?.[0];
    if (!first?.lat || !first?.lon) return null;
    const lat = parseFloat(first.lat);
    const lng = parseFloat(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = (await req.json()) as GeocodeRequest;
    const city = (body.city || '').trim();
    const state = (body.state || '').trim();
    const country = (body.country || '').trim();

    if (!city && !state) {
      return new Response(JSON.stringify({ error: 'city or state is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Three-pass strategy. 2026-05-13 backfill audit found that some users
    // have admin1 strings our cities dataset stores with missing apostrophes
    // or accents (e.g. "Provence-Alpes-Cote dAzur"), and these poison both
    // structured and free-text queries even for famous cities. So:
    //   1. Structured city+state+country (most precise when inputs are clean)
    //   2. Free-text "city, state, country" (forgiving of Unicode/typos)
    //   3. Free-text "city, country" (last resort — drops the bad state)
    const coords =
      (await tryQuery({ city, state, country }, 'structured'))
      ?? (await tryQuery({ city, state, country }, 'freetext'))
      ?? (state ? await tryQuery({ city, state: '', country }, 'freetext') : null);

    if (!coords) {
      return new Response(JSON.stringify({ error: 'no results' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ latitude: coords.lat, longitude: coords.lng }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
