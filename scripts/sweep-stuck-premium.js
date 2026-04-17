#!/usr/bin/env node
/**
 * Sweep stuck-premium users
 *
 * Finds users whose RevenueCat state says they're premium but whose Supabase
 * row doesn't reflect it (because the webhook missed / failed / the profile
 * didn't exist yet). Reconciles each via the sync-subscription edge function.
 *
 * Usage:
 *   node scripts/sweep-stuck-premium.js [--days=30] [--dry-run] [--limit=N]
 *
 * Requires .env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, REVENUECAT_SECRET_KEY.
 */

const fs = require('fs');
const path = require('path');

// --- Load .env --------------------------------------------------------------
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
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const RC_KEY = env.REVENUECAT_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !RC_KEY) {
  console.error('Missing required env: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / REVENUECAT_SECRET_KEY');
  process.exit(1);
}

// --- Args -------------------------------------------------------------------
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const daysArg = args.find((a) => a.startsWith('--days='));
const DAYS = daysArg ? parseInt(daysArg.split('=')[1], 10) : 30;
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg ? parseInt(limitArg.split('=')[1], 10) : null;

// --- RC rate limit (under 10/sec) -------------------------------------------
const RC_DELAY_MS = 120;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// --- Supabase REST helpers --------------------------------------------------
async function sbSelect(query) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql: query }),
  });
  if (!res.ok) throw new Error(`sbSelect failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function fetchCandidates() {
  // Use PostgREST directly. Pulls user_id + email + profile_id for audit.
  const url = new URL(`${SUPABASE_URL}/rest/v1/profiles`);
  url.searchParams.set(
    'select',
    'id,user_id,is_premium,is_platinum,last_active_at,created_at'
  );
  url.searchParams.set('is_premium', 'eq.false');
  url.searchParams.set('last_active_at', `gte.${new Date(Date.now() - 14 * 864e5).toISOString()}`);
  url.searchParams.set('created_at', `gte.${new Date(Date.now() - DAYS * 864e5).toISOString()}`);
  url.searchParams.set('order', 'created_at.desc');
  if (LIMIT) url.searchParams.set('limit', String(LIMIT));

  const all = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const res = await fetch(url, {
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        Range: `${from}-${from + pageSize - 1}`,
      },
    });
    if (!res.ok) throw new Error(`fetchCandidates: ${res.status} ${await res.text()}`);
    const rows = await res.json();
    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
    if (LIMIT && all.length >= LIMIT) break;
  }
  return LIMIT ? all.slice(0, LIMIT) : all;
}

async function hasActiveSubRow(profileId) {
  const url = new URL(`${SUPABASE_URL}/rest/v1/subscriptions`);
  url.searchParams.set('select', 'id');
  url.searchParams.set('profile_id', `eq.${profileId}`);
  url.searchParams.set('status', 'eq.active');
  const res = await fetch(url, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) return false;
  const rows = await res.json();
  return rows.length > 0;
}

async function getRcEntitlement(userId) {
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${userId}`, {
    headers: { Authorization: `Bearer ${RC_KEY}`, 'Content-Type': 'application/json' },
  });
  if (res.status === 404) return { exists: false };
  if (!res.ok) {
    console.warn(`  RC ${userId}: ${res.status}`);
    return { exists: false, error: true };
  }
  const data = await res.json();
  const ents = data?.subscriber?.entitlements || {};
  const now = Date.now();
  const premium = ents.premium;
  const platinum = ents.platinum;
  const isActive = (e) => e && (e.expires_date === null || new Date(e.expires_date).getTime() > now);
  return {
    exists: true,
    hasPremium: isActive(premium),
    hasPlatinum: isActive(platinum),
    premiumExpires: premium?.expires_date || null,
    platinumExpires: platinum?.expires_date || null,
  };
}

async function reconcile(userId) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/sync-subscription`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

// --- Main -------------------------------------------------------------------
async function main() {
  console.log(`Sweep: days=${DAYS}, dryRun=${DRY_RUN}, limit=${LIMIT || 'none'}`);
  console.log('Fetching candidates…');
  const candidates = await fetchCandidates();
  console.log(`Got ${candidates.length} candidates. Filtering to those without an active subscription row…`);

  const withoutRow = [];
  for (const c of candidates) {
    const has = await hasActiveSubRow(c.id);
    if (!has) withoutRow.push(c);
  }
  console.log(`${withoutRow.length} candidates to check against RevenueCat.\n`);

  const stats = {
    checked: 0,
    rcNotFound: 0,
    rcNoEntitlement: 0,
    fixed: 0,
    wouldFix: 0,
    reconcileFailed: 0,
    rcErrors: 0,
  };
  const fixed = [];

  for (let i = 0; i < withoutRow.length; i++) {
    const p = withoutRow[i];
    stats.checked++;
    const rc = await getRcEntitlement(p.user_id);
    await sleep(RC_DELAY_MS);

    if (!rc.exists) {
      if (rc.error) stats.rcErrors++;
      else stats.rcNotFound++;
      if (i % 100 === 0) {
        process.stdout.write(`\r[${i + 1}/${withoutRow.length}] checked=${stats.checked} fixed=${stats.fixed} notFound=${stats.rcNotFound} noEnt=${stats.rcNoEntitlement}`);
      }
      continue;
    }

    if (!rc.hasPremium && !rc.hasPlatinum) {
      stats.rcNoEntitlement++;
      continue;
    }

    // RC says active — we need to reconcile
    const tier = rc.hasPlatinum ? 'platinum' : 'premium';
    const expires = rc.hasPlatinum ? rc.platinumExpires : rc.premiumExpires;
    console.log(`\n🎯 STUCK: ${p.user_id} tier=${tier} expires=${expires}`);

    if (DRY_RUN) {
      stats.wouldFix++;
      fixed.push({ user_id: p.user_id, tier, expires, action: 'dry-run' });
      continue;
    }

    const result = await reconcile(p.user_id);
    if (result.status === 200) {
      stats.fixed++;
      fixed.push({ user_id: p.user_id, tier, expires, action: 'reconciled' });
      console.log(`   ✅ reconciled`);
    } else {
      stats.reconcileFailed++;
      console.log(`   ❌ reconcile failed: ${result.status} ${result.body}`);
    }
  }

  console.log('\n\n===== RESULTS =====');
  console.log(JSON.stringify(stats, null, 2));
  console.log('\nFixed users:');
  for (const f of fixed) console.log(`  ${f.user_id}  ${f.tier}  ${f.expires}  [${f.action}]`);

  // Write results to file for audit
  const outPath = path.join(__dirname, `sweep-results-${Date.now()}.json`);
  fs.writeFileSync(outPath, JSON.stringify({ stats, fixed, dryRun: DRY_RUN }, null, 2));
  console.log(`\nResults saved to ${outPath}`);
}

main().catch((err) => {
  console.error('Sweep failed:', err);
  process.exit(1);
});
