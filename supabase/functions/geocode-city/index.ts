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

    const params = new URLSearchParams({
      format: 'jsonv2',
      limit: '1',
      'accept-language': 'en',
    });
    if (city) params.set('city', city);
    if (state) params.set('state', state);
    if (country) params.set('country', country);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': NOMINATIM_USER_AGENT,
        'Accept': 'application/json',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `geocoder returned ${response.status}` }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results = (await response.json()) as Array<{ lat: string; lon: string }>;
    const first = results?.[0];
    if (!first || !first.lat || !first.lon) {
      return new Response(JSON.stringify({ error: 'no results' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const latitude = parseFloat(first.lat);
    const longitude = parseFloat(first.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return new Response(JSON.stringify({ error: 'invalid coordinates returned' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ latitude, longitude }), {
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
