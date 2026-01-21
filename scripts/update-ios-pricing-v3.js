#!/usr/bin/env node

/**
 * App Store Connect API - Subscription Price Updater v3
 *
 * Correctly matches LOCAL CURRENCY prices from regional pricing CSV
 * to Apple's available price points per territory.
 *
 * Usage:
 *   node scripts/update-ios-pricing-v3.js --dry-run
 *   node scripts/update-ios-pricing-v3.js
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const CONFIG = {
  apiBaseUrl: 'https://api.appstoreconnect.apple.com/v1',
  pricingCsvPath: path.join(__dirname, '..', 'complete-regional-pricing.csv'),
  tokenExpiration: 20 * 60
};

// Territory code to country name mapping
const TERRITORY_TO_COUNTRY = {
  'USA': 'United States', 'ALB': 'Albania', 'DZA': 'Algeria', 'AGO': 'Angola',
  'ATG': 'Antigua & Barbuda', 'ARG': 'Argentina', 'ARM': 'Armenia', 'AUS': 'Australia',
  'AUT': 'Austria', 'AZE': 'Azerbaijan', 'BHS': 'Bahamas', 'BHR': 'Bahrain',
  'BGD': 'Bangladesh', 'BLR': 'Belarus', 'BEL': 'Belgium', 'BLZ': 'Belize',
  'BEN': 'Benin', 'BMU': 'Bermuda', 'BOL': 'Bolivia', 'BIH': 'Bosnia & Herzegovina',
  'BWA': 'Botswana', 'BRA': 'Brazil', 'VGB': 'British Virgin Islands', 'BGR': 'Bulgaria',
  'BFA': 'Burkina Faso', 'KHM': 'Cambodia', 'CMR': 'Cameroon', 'CAN': 'Canada',
  'CPV': 'Cape Verde', 'CYM': 'Cayman Islands', 'TCD': 'Chad', 'CHL': 'Chile',
  'CHN': 'China', 'COL': 'Colombia', 'CRI': 'Costa Rica', 'CIV': "Côte d'Ivoire",
  'HRV': 'Croatia', 'CYP': 'Cyprus', 'CZE': 'Czech Republic', 'DNK': 'Denmark',
  'DMA': 'Dominica', 'DOM': 'Dominican Republic', 'ECU': 'Ecuador', 'EGY': 'Egypt',
  'SLV': 'El Salvador', 'EST': 'Estonia', 'SWZ': 'Eswatini', 'FJI': 'Fiji',
  'FIN': 'Finland', 'FRA': 'France', 'GAB': 'Gabon', 'GMB': 'Gambia',
  'GEO': 'Georgia', 'DEU': 'Germany', 'GHA': 'Ghana', 'GRC': 'Greece',
  'GRD': 'Grenada', 'GTM': 'Guatemala', 'GIN': 'Guinea', 'HND': 'Honduras',
  'HKG': 'Hong Kong', 'HUN': 'Hungary', 'ISL': 'Iceland', 'IND': 'India',
  'IDN': 'Indonesia', 'IRQ': 'Iraq', 'IRL': 'Ireland', 'ISR': 'Israel',
  'ITA': 'Italy', 'JAM': 'Jamaica', 'JPN': 'Japan', 'JOR': 'Jordan',
  'KAZ': 'Kazakhstan', 'KEN': 'Kenya', 'KWT': 'Kuwait', 'KGZ': 'Kyrgyzstan',
  'LAO': 'Laos', 'LVA': 'Latvia', 'LBN': 'Lebanon', 'LBR': 'Liberia',
  'LBY': 'Libya', 'LTU': 'Lithuania', 'LUX': 'Luxembourg', 'MDG': 'Madagascar',
  'MWI': 'Malawi', 'MYS': 'Malaysia', 'MDV': 'Maldives', 'MLI': 'Mali',
  'MLT': 'Malta', 'MRT': 'Mauritania', 'MUS': 'Mauritius', 'MEX': 'Mexico',
  'MDA': 'Moldova', 'MNG': 'Mongolia', 'MAR': 'Morocco', 'MOZ': 'Mozambique',
  'MMR': 'Myanmar', 'NAM': 'Namibia', 'NPL': 'Nepal', 'NLD': 'Netherlands',
  'NZL': 'New Zealand', 'NIC': 'Nicaragua', 'NER': 'Niger', 'NGA': 'Nigeria',
  'MKD': 'North Macedonia', 'NOR': 'Norway', 'OMN': 'Oman', 'PAK': 'Pakistan',
  'PAN': 'Panama', 'PNG': 'Papua New Guinea', 'PRY': 'Paraguay', 'PER': 'Peru',
  'PHL': 'Philippines', 'POL': 'Poland', 'PRT': 'Portugal', 'QAT': 'Qatar',
  'ROU': 'Romania', 'RUS': 'Russia', 'RWA': 'Rwanda', 'SAU': 'Saudi Arabia',
  'SEN': 'Senegal', 'SRB': 'Serbia', 'SYC': 'Seychelles', 'SLE': 'Sierra Leone',
  'SGP': 'Singapore', 'SVK': 'Slovakia', 'SVN': 'Slovenia', 'SLB': 'Solomon Islands',
  'ZAF': 'South Africa', 'KOR': 'South Korea', 'ESP': 'Spain', 'LKA': 'Sri Lanka',
  'KNA': 'St Kitts & Nevis', 'LCA': 'St Lucia', 'SUR': 'Suriname', 'SWE': 'Sweden',
  'CHE': 'Switzerland', 'TWN': 'Taiwan', 'TJK': 'Tajikistan', 'TZA': 'Tanzania',
  'THA': 'Thailand', 'TON': 'Tonga', 'TTO': 'Trinidad & Tobago', 'TUN': 'Tunisia',
  'TUR': 'Turkey', 'TKM': 'Turkmenistan', 'UGA': 'Uganda', 'UKR': 'Ukraine',
  'ARE': 'United Arab Emirates', 'GBR': 'United Kingdom', 'URY': 'Uruguay',
  'UZB': 'Uzbekistan', 'VUT': 'Vanuatu', 'VEN': 'Venezuela', 'VNM': 'Vietnam',
  'YEM': 'Yemen', 'ZMB': 'Zambia', 'ZWE': 'Zimbabwe', 'MAC': 'Macao', 'FSM': 'Micronesia'
};

function generateToken(keyId, issuerId, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign({
    iss: issuerId, iat: now, exp: now + CONFIG.tokenExpiration, aud: 'appstoreconnect-v1'
  }, privateKey, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: keyId, typ: 'JWT' }
  });
}

async function apiRequest(token, endpoint, method = 'GET', body = null) {
  const fetch = (await import('node-fetch')).default;
  const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.apiBaseUrl}${endpoint}`;
  const options = {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API ${method} ${endpoint}: ${response.status} - ${errorText}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else current += char;
  }
  result.push(current.trim());
  return result;
}

function parsePricingCsv(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const pricing = {};

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 5) continue;
    const country = values[0].trim();
    pricing[country] = {
      currency: values[1].trim(),
      monthly: parseFloat(values[2]) || 0,
      threeMonth: parseFloat(values[3]) || 0,
      annual: parseFloat(values[4]) || 0
    };
  }
  return pricing;
}

function getSubscriptionType(name) {
  const n = name.toLowerCase();
  if (n.includes('3') || n.includes('three') || n.includes('quarter')) return 'threeMonth';
  if (n.includes('year') || n.includes('annual')) return 'annual';
  return 'monthly';
}

function getTargetLocalPrice(pricingData, country, subType) {
  const p = pricingData[country];
  if (!p) return null;
  return { price: p[subType], currency: p.currency };
}

/**
 * Find the closest price point to target local currency price
 */
function findClosestPricePoint(pricePoints, targetPrice) {
  if (!pricePoints || pricePoints.length === 0) return null;

  let closest = null;
  let minDiff = Infinity;

  for (const pp of pricePoints) {
    const price = parseFloat(pp.attributes.customerPrice);
    const diff = Math.abs(price - targetPrice);
    if (diff < minDiff) {
      minDiff = diff;
      closest = pp;
    }
  }

  return { pricePoint: closest, diff: minDiff, diffPercent: (minDiff / targetPrice * 100).toFixed(1) };
}

async function getAllPricePoints(token, subscriptionId, territory) {
  // Need to paginate to get all price points
  let allPoints = [];
  let nextUrl = `/subscriptions/${subscriptionId}/pricePoints?filter[territory]=${territory}&limit=200`;

  while (nextUrl) {
    try {
      const response = await apiRequest(token, nextUrl);
      if (response?.data) {
        allPoints = allPoints.concat(response.data);
      }
      nextUrl = response?.links?.next || null;
    } catch (err) {
      break;
    }
  }

  return allPoints;
}

async function createSubscriptionPrice(token, subscriptionId, pricePointId) {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const body = {
    data: {
      type: 'subscriptionPrices',
      attributes: {
        startDate: tomorrow,
        preserveCurrentPrice: false
      },
      relationships: {
        subscription: { data: { type: 'subscriptions', id: subscriptionId } },
        subscriptionPricePoint: { data: { type: 'subscriptionPricePoints', id: pricePointId } }
      }
    }
  };

  return apiRequest(token, '/subscriptionPrices', 'POST', body);
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const specificTerritory = args.find(a => a.startsWith('--territory='))?.split('=')[1];

  console.log('='.repeat(60));
  console.log('App Store Connect Subscription Price Updater v3');
  console.log('='.repeat(60));
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  if (specificTerritory) console.log(`Territory filter: ${specificTerritory}`);
  console.log('');

  const keyId = process.env.APP_STORE_KEY_ID;
  const issuerId = process.env.APP_STORE_ISSUER_ID;
  const privateKey = process.env.APP_STORE_PRIVATE_KEY;
  const appId = process.env.APP_STORE_APP_ID;

  if (!keyId || !issuerId || !privateKey || !appId) {
    console.error('Missing environment variables');
    process.exit(1);
  }

  console.log('Loading regional pricing data...');
  const pricingData = parsePricingCsv(CONFIG.pricingCsvPath);
  console.log(`Loaded ${Object.keys(pricingData).length} countries`);

  console.log('Generating API token...');
  const token = generateToken(keyId, issuerId, privateKey);

  console.log('Fetching subscription groups...');
  const groups = await apiRequest(token, `/apps/${appId}/subscriptionGroups`);

  if (!groups?.data?.length) {
    console.error('No subscription groups found');
    process.exit(1);
  }

  const results = { updated: [], skipped: [], errors: [] };
  const territories = specificTerritory ? [specificTerritory] : Object.keys(TERRITORY_TO_COUNTRY);

  for (const group of groups.data) {
    const subs = await apiRequest(token, `/subscriptionGroups/${group.id}/subscriptions`);
    if (!subs?.data?.length) continue;

    for (const sub of subs.data) {
      const subName = sub.attributes?.name || sub.id;
      const subType = getSubscriptionType(subName);

      console.log(`\n${'='.repeat(60)}`);
      console.log(`Subscription: ${subName} (${subType})`);
      console.log('='.repeat(60));

      for (const territory of territories) {
        const country = TERRITORY_TO_COUNTRY[territory];
        if (!country) continue;

        const target = getTargetLocalPrice(pricingData, country, subType);
        if (!target || target.price <= 0) {
          results.skipped.push({ sub: subName, territory, reason: 'No target price' });
          continue;
        }

        try {
          const pricePoints = await getAllPricePoints(token, sub.id, territory);

          if (pricePoints.length === 0) {
            results.skipped.push({ sub: subName, territory, reason: 'No price points' });
            continue;
          }

          const match = findClosestPricePoint(pricePoints, target.price);

          if (!match.pricePoint) {
            results.skipped.push({ sub: subName, territory, reason: 'No suitable price point' });
            continue;
          }

          const actualPrice = match.pricePoint.attributes.customerPrice;
          const currency = match.pricePoint.attributes.customerPrice.includes('.') ? target.currency : target.currency;

          console.log(`  ${territory} (${country}): ${target.currency} ${target.price} → ${actualPrice} (${match.diffPercent}% diff)`);

          if (!isDryRun) {
            try {
              await createSubscriptionPrice(token, sub.id, match.pricePoint.id);
              results.updated.push({
                subscription: subName,
                territory,
                country,
                targetPrice: target.price,
                actualPrice,
                currency: target.currency
              });
            } catch (err) {
              console.log(`    ERROR: ${err.message}`);
              results.errors.push({ sub: subName, territory, error: err.message });
            }
          } else {
            results.updated.push({
              subscription: subName,
              territory,
              country,
              targetPrice: target.price,
              actualPrice,
              currency: target.currency,
              dryRun: true
            });
          }

          // Rate limit
          await new Promise(r => setTimeout(r, 50));

        } catch (err) {
          results.errors.push({ sub: subName, territory, error: err.message });
        }
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Updates ${isDryRun ? 'planned' : 'applied'}: ${results.updated.length}`);
  console.log(`Skipped: ${results.skipped.length}`);
  console.log(`Errors: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\nFirst 10 errors:');
    results.errors.slice(0, 10).forEach(e => console.log(`  ${e.sub}/${e.territory}: ${e.error}`));
  }

  const outputPath = path.join(__dirname, 'pricing-results-v3.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults: ${outputPath}`);

  if (isDryRun) console.log('\nRun without --dry-run to apply changes.');
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
