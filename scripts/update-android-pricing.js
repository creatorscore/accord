#!/usr/bin/env node

/**
 * Google Play Subscription Price Updater
 *
 * Mirrors update-ios-pricing-v2.js for the Play Store. Reads the same
 * apple-regional-pricing.csv (with the Weekly column added in feat/weekly-
 * pricing-localization) and pushes localized prices to each subscription's
 * basePlans regionalConfigs via the Play Monetization API.
 *
 * Auth: Google service account JWT (RS256) → OAuth2 access token. No external
 * Google libs required — we sign with the already-vendored `jsonwebtoken`
 * dep, then POST to Google's token endpoint.
 *
 * Usage:
 *   --dry-run                  Preview all changes without applying
 *   --apply                    Actually push the price changes
 *   --product=accord_premium_weekly   Only update one productId
 *   --region=IN                Only update one region
 *
 * Required env vars:
 *   GOOGLE_PLAY_SERVICE_ACCOUNT_JSON  Path to the service account .json key,
 *                                     OR the raw JSON string itself.
 *   GOOGLE_PLAY_PACKAGE_NAME          Defaults to com.privyreviews.accord.
 *
 * The service account needs the "Manage store presence" + "Manage products"
 * permissions in Play Console under Users and permissions.
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const CONFIG = {
  apiBaseUrl: 'https://androidpublisher.googleapis.com/androidpublisher/v3',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  scope: 'https://www.googleapis.com/auth/androidpublisher',
  pricingCsvPath: path.join(__dirname, 'apple-regional-pricing.csv'),
  packageName: process.env.GOOGLE_PLAY_PACKAGE_NAME || 'com.privyreviews.accord',
  tokenLifetimeSec: 3600,
  tokenRefreshIntervalMs: 50 * 60 * 1000,
};

// ─── Country → ISO 3166-1 alpha-2 region codes (Google's region format) ───
// Synced with the COUNTRY_TO_TERRITORY_ALPHA2 map in generate-asc-price-csv.js
// so iOS + Android stay in lockstep when adding new markets.
const COUNTRY_TO_REGION = {
  'United States': 'US', 'Afghanistan': 'AF', 'Albania': 'AL', 'Algeria': 'DZ',
  'Angola': 'AO', 'Anguilla': 'AI', 'Antigua and Barbuda': 'AG', 'Argentina': 'AR',
  'Armenia': 'AM', 'Australia': 'AU', 'Austria': 'AT', 'Azerbaijan': 'AZ',
  'Bahamas': 'BS', 'Bahrain': 'BH', 'Barbados': 'BB', 'Belarus': 'BY',
  'Belgium': 'BE', 'Belize': 'BZ', 'Benin': 'BJ', 'Bermuda': 'BM',
  'Bhutan': 'BT', 'Bolivia': 'BO', 'Bosnia and Herzegovina': 'BA', 'Botswana': 'BW',
  'Brazil': 'BR', 'British Virgin Islands': 'VG', 'Brunei': 'BN', 'Bulgaria': 'BG',
  'Burkina Faso': 'BF', 'Cambodia': 'KH', 'Cameroon': 'CM', 'Canada': 'CA',
  'Cape Verde': 'CV', 'Cayman Islands': 'KY', 'Chad': 'TD', 'Chile': 'CL',
  'China mainland': 'CN', 'Colombia': 'CO',
  'Congo Democratic Republic of the': 'CD', 'Congo Republic of the': 'CG',
  'Costa Rica': 'CR', "Côte d'Ivoire": 'CI', 'Croatia': 'HR', 'Cyprus': 'CY',
  'Czech Republic': 'CZ', 'Denmark': 'DK', 'Dominica': 'DM', 'Dominican Republic': 'DO',
  'Ecuador': 'EC', 'Egypt': 'EG', 'El Salvador': 'SV', 'Estonia': 'EE',
  'Eswatini': 'SZ', 'Fiji': 'FJ', 'Finland': 'FI', 'France': 'FR',
  'Gabon': 'GA', 'Gambia': 'GM', 'Georgia': 'GE', 'Germany': 'DE',
  'Ghana': 'GH', 'Greece': 'GR', 'Grenada': 'GD', 'Guatemala': 'GT',
  'Guinea-Bissau': 'GW', 'Guyana': 'GY', 'Honduras': 'HN', 'Hong Kong': 'HK',
  'Hungary': 'HU', 'Iceland': 'IS', 'India': 'IN', 'Indonesia': 'ID',
  'Iraq': 'IQ', 'Ireland': 'IE', 'Israel': 'IL', 'Italy': 'IT',
  'Jamaica': 'JM', 'Japan': 'JP', 'Jordan': 'JO', 'Kazakhstan': 'KZ',
  'Kenya': 'KE', 'Korea Republic of': 'KR', 'Kosovo': 'XK', 'Kuwait': 'KW',
  'Kyrgyzstan': 'KG', 'Laos': 'LA', 'Latvia': 'LV', 'Lebanon': 'LB',
  'Liberia': 'LR', 'Libya': 'LY', 'Lithuania': 'LT', 'Luxembourg': 'LU',
  'Macau': 'MO', 'Madagascar': 'MG', 'Malawi': 'MW', 'Malaysia': 'MY',
  'Maldives': 'MV', 'Mali': 'ML', 'Malta': 'MT', 'Mauritania': 'MR',
  'Mauritius': 'MU', 'Mexico': 'MX', 'Micronesia': 'FM', 'Moldova': 'MD',
  'Mongolia': 'MN', 'Montenegro': 'ME', 'Montserrat': 'MS', 'Morocco': 'MA',
  'Mozambique': 'MZ', 'Myanmar': 'MM', 'Namibia': 'NA', 'Nauru': 'NR',
  'Nepal': 'NP', 'Netherlands': 'NL', 'New Zealand': 'NZ', 'Nicaragua': 'NI',
  'Niger': 'NE', 'Nigeria': 'NG', 'North Macedonia': 'MK', 'Norway': 'NO',
  'Oman': 'OM', 'Pakistan': 'PK', 'Palau': 'PW', 'Panama': 'PA',
  'Papua New Guinea': 'PG', 'Paraguay': 'PY', 'Peru': 'PE', 'Philippines': 'PH',
  'Poland': 'PL', 'Portugal': 'PT', 'Qatar': 'QA', 'Romania': 'RO',
  'Russia': 'RU', 'Rwanda': 'RW', 'São Tomé and Príncipe': 'ST', 'Saudi Arabia': 'SA',
  'Senegal': 'SN', 'Serbia': 'RS', 'Seychelles': 'SC', 'Sierra Leone': 'SL',
  'Singapore': 'SG', 'Slovakia': 'SK', 'Slovenia': 'SI', 'Solomon Islands': 'SB',
  'South Africa': 'ZA', 'Spain': 'ES', 'Sri Lanka': 'LK',
  'St. Kitts and Nevis': 'KN', 'St. Lucia': 'LC', 'St. Vincent and the Grenadines': 'VC',
  'Suriname': 'SR', 'Sweden': 'SE', 'Switzerland': 'CH', 'Taiwan': 'TW',
  'Tajikistan': 'TJ', 'Tanzania': 'TZ', 'Thailand': 'TH', 'Tonga': 'TO',
  'Trinidad and Tobago': 'TT', 'Tunisia': 'TN', 'Türkiye': 'TR', 'Turkmenistan': 'TM',
  'Turks and Caicos Islands': 'TC', 'Uganda': 'UG', 'Ukraine': 'UA',
  'United Arab Emirates': 'AE', 'United Kingdom': 'GB', 'Uruguay': 'UY',
  'Uzbekistan': 'UZ', 'Vanuatu': 'VU', 'Venezuela': 'VE', 'Vietnam': 'VN',
  'Yemen': 'YE', 'Zambia': 'ZM', 'Zimbabwe': 'ZW',
};

// ─── Currency formatting ────────────────────────────────────────────────────
// Currencies that Google bills in whole-number units (no fractional part).
// Mirrors the list in add-weekly-pricing-column.js so the two scripts stay
// consistent when picking targets and converting to Money.
const WHOLE_NUMBER_CURRENCIES = new Set([
  'JPY', 'KRW', 'IDR', 'VND', 'COP', 'CLP', 'HUF', 'TWD', 'KZT', 'NGN',
  'PKR', 'TZS', 'INR', 'PHP', 'EGP', 'ISK', 'CRC', 'PYG', 'IQD', 'UZS',
]);

/** Convert a decimal price into Google's Money type ({ currencyCode, units, nanos }). */
function priceToMoney(price, currencyCode) {
  if (!isFinite(price) || price <= 0) return null;
  if (WHOLE_NUMBER_CURRENCIES.has(currencyCode)) {
    return { currencyCode, units: String(Math.round(price)), nanos: 0 };
  }
  const units = Math.floor(price);
  const nanos = Math.round((price - units) * 1_000_000_000);
  return { currencyCode, units: String(units), nanos };
}

/** Pretty-print a Money for log output. */
function formatMoney(money) {
  if (!money) return '—';
  // Google's protobuf JSON omits `nanos` when it's zero, so default it.
  const frac = (money.nanos || 0) / 1_000_000_000;
  const value = parseInt(money.units, 10) + frac;
  return `${money.currencyCode} ${value.toFixed(WHOLE_NUMBER_CURRENCIES.has(money.currencyCode) ? 0 : 2)}`;
}

// ─── CSV parsing (header-name resolution; tolerates column reorders) ────────
function parseCSVLine(line) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

function parsePricingCsv(csvPath) {
  const lines = fs.readFileSync(csvPath, 'utf-8').split('\n').filter(l => l.trim());
  const header = parseCSVLine(lines[0]);
  const idx = (name) => header.indexOf(name);
  const COUNTRY = idx('Country');
  const CURRENCY = idx('Apple Currency');
  const WEEKLY = idx('Weekly Price');
  const MONTHLY = idx('Monthly Price');
  const THREE_MONTH = idx('3-Month Price');
  const ANNUAL = idx('Annual Price');
  const USD = idx('Monthly USD Equiv');
  if (COUNTRY === -1 || CURRENCY === -1 || MONTHLY === -1) {
    throw new Error(`Pricing CSV missing required columns: ${header.join(', ')}`);
  }

  const pricing = {};
  for (let i = 1; i < lines.length; i++) {
    const v = parseCSVLine(lines[i]);
    if (v.length <= MONTHLY) continue;
    const country = v[COUNTRY];
    pricing[country] = {
      currency: v[CURRENCY],
      weekly: WEEKLY !== -1 ? parseFloat(v[WEEKLY]) || 0 : 0,
      monthly: parseFloat(v[MONTHLY]) || 0,
      threeMonth: THREE_MONTH !== -1 ? parseFloat(v[THREE_MONTH]) || 0 : 0,
      annual: ANNUAL !== -1 ? parseFloat(v[ANNUAL]) || 0 : 0,
      monthlyUsd: USD !== -1 ? parseFloat(v[USD]) || 0 : 0,
    };
  }
  return pricing;
}

// ─── Service account JWT → OAuth2 access token ──────────────────────────────
let cachedToken = null;
let cachedTokenAt = null;
let serviceAccount = null;

function loadServiceAccount() {
  const raw = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not set (path or raw JSON)');
  }
  // Detect: path on disk vs inline JSON string
  const isPath = !raw.trim().startsWith('{');
  const json = isPath ? fs.readFileSync(raw, 'utf-8') : raw;
  const parsed = JSON.parse(json);
  if (!parsed.client_email || !parsed.private_key) {
    throw new Error('Service account JSON missing client_email or private_key');
  }
  return parsed;
}

async function getAccessToken() {
  const now = Date.now();
  if (cachedToken && cachedTokenAt && (now - cachedTokenAt) < CONFIG.tokenRefreshIntervalMs) {
    return cachedToken;
  }
  console.log('🔄 Exchanging service account JWT for OAuth2 access token…');
  const iat = Math.floor(now / 1000);
  const assertion = jwt.sign({
    iss: serviceAccount.client_email,
    scope: CONFIG.scope,
    aud: CONFIG.tokenUrl,
    iat,
    exp: iat + CONFIG.tokenLifetimeSec,
  }, serviceAccount.private_key, { algorithm: 'RS256' });

  const fetch = (await import('node-fetch')).default;
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion,
  });
  const res = await fetch(CONFIG.tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${t.slice(0, 200)}`);
  }
  const json = await res.json();
  cachedToken = json.access_token;
  cachedTokenAt = now;
  return cachedToken;
}

async function api(method, endpoint, body) {
  const fetch = (await import('node-fetch')).default;
  const token = await getAccessToken();
  const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.apiBaseUrl}${endpoint}`;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${method} ${endpoint} → ${res.status}: ${t.slice(0, 300)}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ─── Subscription helpers ───────────────────────────────────────────────────
async function listSubscriptions() {
  // Lists subscription products for the package. Pagination via `pageToken`.
  const out = [];
  let pageToken = null;
  do {
    const qs = pageToken ? `?pageToken=${encodeURIComponent(pageToken)}` : '';
    const res = await api('GET', `/applications/${CONFIG.packageName}/subscriptions${qs}`);
    if (res?.subscriptions) out.push(...res.subscriptions);
    pageToken = res?.nextPageToken || null;
  } while (pageToken);
  return out;
}

/** Determine subscription type from a basePlan's billing period. */
function getBasePlanType(basePlan) {
  const dur = basePlan?.autoRenewingBasePlanType?.billingPeriodDuration
           || basePlan?.prepaidBasePlanType?.billingPeriodDuration
           || '';
  // ISO-8601: P1W, P1M, P3M, P1Y
  if (dur.includes('W')) return 'weekly';
  if (dur === 'P1M') return 'monthly';
  if (dur === 'P3M') return 'threeMonth';
  if (dur === 'P1Y' || dur === 'P12M') return 'annual';
  return null;
}

/** Build the new regionalConfigs array for a basePlan. */
function buildRegionalConfigs(subType, pricing, regionFilter) {
  const configs = [];
  const skipped = [];
  for (const [country, region] of Object.entries(COUNTRY_TO_REGION)) {
    if (regionFilter && region !== regionFilter) continue;
    const data = pricing[country];
    if (!data) { skipped.push({ country, region, reason: 'no row in CSV' }); continue; }
    const targetPrice = data[subType];
    if (!targetPrice || targetPrice <= 0) { skipped.push({ country, region, reason: `no ${subType} price` }); continue; }
    const money = priceToMoney(targetPrice, data.currency);
    if (!money) { skipped.push({ country, region, reason: 'invalid Money' }); continue; }
    configs.push({
      regionCode: region,
      newSubscriberAvailability: true,
      price: money,
    });
  }
  return { configs, skipped };
}

async function patchSubscription(productId, updatedBasePlans, rebuiltBasePlanIds = new Set(), originalConfigsById = new Map()) {
  // Updates only the basePlans on the subscription. We retry up to 25 times,
  // peeling off any region Google rejects as not-billable for the current
  // regions version. Google's billable region list shifts over time
  // (sanctions, market exits) so the CSV inevitably includes some regions
  // that don't ship to Play Console — easier to discover them at runtime
  // than to maintain a static skip list.
  const endpoint = `/applications/${CONFIG.packageName}/subscriptions/${productId}`
                 + `?updateMask=basePlans&latencyTolerance=PRODUCT_UPDATE_LATENCY_TOLERANCE_LATENCY_TOLERANT`
                 + `&regionsVersion.version=2025/03`;
  const droppedRegions = new Set();
  let plans = updatedBasePlans;
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const result = await api('PATCH', endpoint, {
        packageName: CONFIG.packageName,
        productId,
        basePlans: plans,
      });
      if (droppedRegions.size > 0) {
        console.log(`    ⓘ Skipped ${droppedRegions.size} non-billable region(s): ${[...droppedRegions].sort().join(', ')}`);
      }
      return result;
    } catch (err) {
      // Two retryable failure modes per region:
      //   1. "Region code XX is not billable"        — sanctioned / unsupported markets
      //   2. "Invalid currency for region code XX"   — our Apple-derived currency
      //      doesn't match what Google bills in for that region (e.g. Apple
      //      uses USD for Algeria, Google requires DZD). Cleanest fix is to
      //      drop the region; Google's auto-converted "other regions" price
      //      kicks in for it instead of our localized target.
      const m = err.message.match(/(?:Region code|for region code) ([A-Z]{2}) is not billable|Invalid currency for region code ([A-Z]{2})/);
      const bad = m && (m[1] || m[2]);
      if (!bad) throw err;
      droppedRegions.add(bad);
      // For rebuilt base plans, swap our custom config for the region with
      // its original Google-set config. We can't simply DELETE the region —
      // PATCH treats basePlans as the complete new state, so a missing
      // region trips "Regional configs were removed". The original config
      // (preserved from the GET) is the safest fallback. If Google had no
      // config for the region, drop it entirely.
      plans = plans.map(bp => {
        if (!rebuiltBasePlanIds.has(bp.basePlanId)) return bp;
        const original = originalConfigsById.get(bp.basePlanId) || [];
        const originalForBad = original.find(c => c.regionCode === bad);
        const without = (bp.regionalConfigs || []).filter(c => c.regionCode !== bad);
        return {
          ...bp,
          regionalConfigs: originalForBad ? [...without, originalForBad] : without,
        };
      });
    }
  }
  throw new Error(`Gave up after stripping ${droppedRegions.size} non-billable regions; still failing.`);
}

// ─── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const apply = args.includes('--apply');
  const productFilter = args.find(a => a.startsWith('--product='))?.split('=')[1];
  const regionFilter = args.find(a => a.startsWith('--region='))?.split('=')[1];

  if (!isDryRun && !apply) {
    console.log('Google Play Subscription Price Updater');
    console.log('Usage:');
    console.log('  --dry-run                       Preview changes without applying');
    console.log('  --apply                         Push changes to Play Console');
    console.log('  --product=accord_premium_weekly Limit to one productId');
    console.log('  --region=IN                     Limit to one region (alpha-2)');
    console.log('');
    console.log('Required env: GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
    process.exit(0);
  }

  console.log('='.repeat(70));
  console.log(`Google Play pricing update — ${isDryRun ? 'DRY RUN' : 'APPLY'}`);
  console.log('='.repeat(70));
  console.log(`Package: ${CONFIG.packageName}`);
  if (productFilter) console.log(`Product filter: ${productFilter}`);
  if (regionFilter) console.log(`Region filter: ${regionFilter}`);
  console.log('');

  serviceAccount = loadServiceAccount();
  console.log(`Authenticating as: ${serviceAccount.client_email}\n`);

  console.log('Loading pricing data…');
  const pricing = parsePricingCsv(CONFIG.pricingCsvPath);
  console.log(`  ${Object.keys(pricing).length} countries loaded\n`);

  console.log('Listing subscription products from Play Console…');
  const subs = await listSubscriptions();
  console.log(`  Found ${subs.length} subscription product(s)\n`);

  const results = { updated: [], skipped: [], errors: [], previews: [] };

  for (const sub of subs) {
    const productId = sub.productId;
    if (productFilter && productId !== productFilter) continue;

    // Premium only — skip Platinum, matching the iOS script's policy.
    const lower = productId.toLowerCase();
    const isPremium = lower.includes('premium');
    const isPlatinum = lower.includes('platinum');
    if (isPlatinum || !isPremium) {
      console.log(`Skipping ${productId} (not a Premium plan)`);
      continue;
    }

    console.log('='.repeat(70));
    console.log(`SUBSCRIPTION: ${productId}`);
    console.log('='.repeat(70));

    const newBasePlans = [];
    const rebuiltBasePlanIds = new Set();
    const originalConfigsById = new Map();
    let touched = false;

    for (const basePlan of sub.basePlans || []) {
      // Skip non-ACTIVE base plans — they're either deactivated (no new
      // subscribers, but Google still returns them) or in some other state we
      // shouldn't touch. Pass them through verbatim so the PATCH doesn't drop
      // them from the subscription.
      if (basePlan.state && basePlan.state !== 'ACTIVE') {
        console.log(`  basePlan ${basePlan.basePlanId} (state=${basePlan.state}): leaving untouched`);
        newBasePlans.push(basePlan);
        continue;
      }
      const subType = getBasePlanType(basePlan);
      if (!subType) {
        console.log(`  basePlan ${basePlan.basePlanId}: unknown billing period, leaving as-is`);
        newBasePlans.push(basePlan);
        continue;
      }

      const { configs: customConfigs, skipped } = buildRegionalConfigs(subType, pricing, regionFilter);
      // Merge: regions in our CSV get the localized price; regions Google
      // already had but we don't customize are preserved as-is. Without this,
      // Google rejects the PATCH with "Regional configs were removed" because
      // PATCH on basePlans is interpreted as the complete new state.
      const customRegions = new Set(customConfigs.map(c => c.regionCode));
      const preserved = (basePlan.regionalConfigs || []).filter(c => !customRegions.has(c.regionCode));
      const configs = [...customConfigs, ...preserved];
      console.log(`  basePlan ${basePlan.basePlanId} (${subType}): ${customConfigs.length} customized + ${preserved.length} preserved (skipped ${skipped.length} from CSV)`);

      // Preview a few rows so the dry run is easy to eyeball.
      const sample = ['US', 'IN', 'NG', 'BR', 'DE', 'GB', 'JP'].filter(r => !regionFilter || r === regionFilter);
      for (const region of sample) {
        const cfg = configs.find(c => c.regionCode === region);
        const old = (basePlan.regionalConfigs || []).find(c => c.regionCode === region);
        const oldStr = old?.price ? formatMoney(old.price) : '(not set)';
        const newStr = cfg ? formatMoney(cfg.price) : '(not in CSV)';
        if (cfg) {
          results.previews.push({ productId, basePlanId: basePlan.basePlanId, region, old: oldStr, new: newStr });
          console.log(`    ${region}: ${oldStr.padEnd(14)} →  ${newStr}`);
        }
      }

      // Replace regionalConfigs entirely. Preserve other basePlan fields verbatim
      // so we don't accidentally clobber offer tags, grace periods, etc.
      newBasePlans.push({ ...basePlan, regionalConfigs: configs });
      rebuiltBasePlanIds.add(basePlan.basePlanId);
      originalConfigsById.set(basePlan.basePlanId, basePlan.regionalConfigs || []);
      touched = true;
    }

    if (!touched) {
      console.log('  No matching basePlans, nothing to update.');
      continue;
    }

    if (isDryRun) {
      console.log('  ✓ DRY RUN — would PATCH this subscription');
      results.updated.push({ productId, dryRun: true, basePlans: newBasePlans.length });
    } else {
      try {
        await patchSubscription(productId, newBasePlans, rebuiltBasePlanIds, originalConfigsById);
        console.log('  ✓ APPLIED');
        results.updated.push({ productId, basePlans: newBasePlans.length });
      } catch (err) {
        console.log(`  ❌ ERROR: ${err.message}`);
        results.errors.push({ productId, error: err.message });
      }
    }
    console.log('');
  }

  console.log('='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Updated: ${results.updated.length}`);
  console.log(`Errors:  ${results.errors.length}`);
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(e => console.log(`  ${e.productId}: ${e.error.slice(0, 160)}`));
  }

  const out = path.join(__dirname, 'play-pricing-results.json');
  fs.writeFileSync(out, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${out}`);

  if (isDryRun) {
    console.log('\nDRY RUN COMPLETE — no changes were applied.');
    console.log('Review play-pricing-results.json, then re-run with --apply.');
  }
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  process.exit(1);
});
