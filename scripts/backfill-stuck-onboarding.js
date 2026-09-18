#!/usr/bin/env node
/**
 * Backfill stuck-onboarding users
 *
 * Audit (2026-05-05) found ~135 users who completed all of onboarding
 * (3+ photos, 2+ prompts, full prefs, custom matching prefs that can only be
 * set on step 30) but whose profile_complete flag never flipped to true.
 * The root cause was the saveCheckpoint helper treating an HTTP timeout as
 * "write likely succeeded" and continuing — when in fact the profile upsert
 * never landed. The 11 users with lat/lng were already fixed via direct
 * UPDATE; the remaining 124 are blocked by the location_required_when_complete
 * CHECK constraint because they picked a city from the dropdown without
 * granting location permission, leaving lat/lng null.
 *
 * This script forward-geocodes each stuck user's city/state/country via
 * Nominatim, fills lat/lng, and flips profile_complete=true. Nominatim's
 * usage policy caps requests at 1/sec from a single source, so we sleep
 * 1.1s between calls to stay safely under the limit.
 *
 * Usage:
 *   node scripts/backfill-stuck-onboarding.js [--dry-run] [--limit=N]
 *
 * Requires .env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1).replace(/^['"]|['"]$/g, '');
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const LIMIT_ARG = args.find((a) => a.startsWith('--limit='));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split('=')[1], 10) : null;

const NOMINATIM_USER_AGENT = 'AccordApp/1.0 (https://privy.reviews; hello@privy.reviews)';
const SLEEP_MS = 1100;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchStuckUsers() {
  const sql = `
    SELECT p.id, p.display_name, p.location_city, p.location_state, p.location_country
    FROM profiles p
    LEFT JOIN preferences prefs ON prefs.profile_id = p.id
    WHERE p.profile_complete = false
      AND p.onboarding_step >= 27
      AND prefs.financial_arrangement IS NOT NULL
      AND prefs.housing_preference IS NOT NULL
      AND prefs.gender_preference IS NOT NULL
      AND (SELECT COUNT(*) FROM photos ph WHERE ph.profile_id = p.id AND ph.moderation_status='approved') >= 3
      AND jsonb_array_length(COALESCE(p.prompt_answers, '[]'::jsonb)) >= 2
      AND p.display_name IS NOT NULL AND p.display_name <> ''
      AND p.age IS NOT NULL AND p.age >= 18
      AND p.pronouns IS NOT NULL
      AND array_length(p.gender, 1) >= 1
      AND array_length(p.sexual_orientation, 1) >= 1
      AND (p.latitude IS NULL OR p.longitude IS NULL)
      AND p.location_city IS NOT NULL AND p.location_city <> ''
    ORDER BY p.created_at ASC
    ${LIMIT ? `LIMIT ${LIMIT}` : ''};
  `.trim();

  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/sql_exec_admin`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!res.ok) {
    // Fallback: there's no sql_exec_admin RPC by default. Use PostgREST's
    // straightforward filtering on the profiles table — the join requires
    // a view we don't have, so do two queries.
    return fetchStuckUsersViaRest();
  }
  return res.json();
}

async function fetchStuckUsersViaRest() {
  // Step 1: profiles where profile_complete=false and onboarding_step>=27 and lat/lng null
  const profileRes = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?select=id,display_name,location_city,location_state,location_country,age,pronouns,gender,sexual_orientation,prompt_answers&profile_complete=eq.false&onboarding_step=gte.27&latitude=is.null&location_city=not.is.null`,
    {
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
    }
  );
  const profiles = await profileRes.json();

  // Step 2: filter client-side by remaining identity guards
  const candidates = profiles.filter(
    (p) =>
      p.location_city &&
      p.display_name &&
      p.age &&
      p.age >= 18 &&
      p.pronouns &&
      Array.isArray(p.gender) &&
      p.gender.length >= 1 &&
      Array.isArray(p.sexual_orientation) &&
      p.sexual_orientation.length >= 1 &&
      Array.isArray(p.prompt_answers) &&
      p.prompt_answers.length >= 2
  );

  // Step 3: filter by photo + preferences requirements
  const result = [];
  for (const profile of candidates) {
    const [photoRes, prefRes] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/photos?select=id&profile_id=eq.${profile.id}&moderation_status=eq.approved`,
        { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
      ),
      fetch(
        `${SUPABASE_URL}/rest/v1/preferences?select=financial_arrangement,housing_preference,gender_preference&profile_id=eq.${profile.id}`,
        { headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` } }
      ),
    ]);
    const photos = await photoRes.json();
    const [prefs] = await prefRes.json();
    if (
      photos.length >= 3 &&
      prefs &&
      prefs.financial_arrangement &&
      prefs.housing_preference &&
      prefs.gender_preference !== null
    ) {
      result.push({
        id: profile.id,
        display_name: profile.display_name,
        location_city: profile.location_city,
        location_state: profile.location_state,
        location_country: profile.location_country,
      });
    }
    if (LIMIT && result.length >= LIMIT) break;
  }
  return result;
}

async function geocode(city, state, country) {
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    'accept-language': 'en',
  });
  if (city) params.set('city', city);
  if (state) params.set('state', state);
  if (country) params.set('country', country);

  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: {
      'User-Agent': NOMINATIM_USER_AGENT,
      Accept: 'application/json',
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const first = data?.[0];
  if (!first || !first.lat || !first.lon) return null;
  const lat = parseFloat(first.lat);
  const lng = parseFloat(first.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

async function updateProfile(id, lat, lng) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${id}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({
        latitude: lat,
        longitude: lng,
        profile_complete: true,
        onboarding_step: 31,
        updated_at: new Date().toISOString(),
      }),
    }
  );
  return res.ok;
}

async function main() {
  console.log(`Backfill stuck-onboarding users — ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  if (LIMIT) console.log(`Limit: ${LIMIT}`);
  console.log('---');

  const users = await fetchStuckUsersViaRest();
  console.log(`Found ${users.length} candidates\n`);

  const stats = { fixed: 0, no_geocode: 0, no_update: 0 };
  for (const [i, user] of users.entries()) {
    const label = `[${i + 1}/${users.length}] ${user.display_name} — ${user.location_city}, ${user.location_state || '?'}, ${user.location_country || '?'}`;

    const result = await geocode(user.location_city, user.location_state, user.location_country);
    if (!result) {
      console.log(`${label} — geocode FAILED`);
      stats.no_geocode++;
      await sleep(SLEEP_MS);
      continue;
    }

    if (DRY_RUN) {
      console.log(`${label} -> ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)} [DRY]`);
    } else {
      const ok = await updateProfile(user.id, result.lat, result.lng);
      if (ok) {
        console.log(`${label} -> ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)} ✓`);
        stats.fixed++;
      } else {
        console.log(`${label} -> ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)} (update FAILED)`);
        stats.no_update++;
      }
    }
    await sleep(SLEEP_MS);
  }

  console.log('\n---');
  console.log(`Fixed: ${stats.fixed}`);
  console.log(`Geocode failures: ${stats.no_geocode}`);
  console.log(`Update failures: ${stats.no_update}`);
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
