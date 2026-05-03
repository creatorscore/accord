#!/usr/bin/env node

/**
 * App Store Connect API - Subscription Price Updater v2
 *
 * FIXED VERSION: Correctly handles territories where Apple uses USD
 * by matching the customerPrice directly in the currency Apple uses
 * for that territory.
 *
 * Key insight: Apple only supports specific currencies per territory.
 * For most territories, Apple uses USD. For some, they use local currency.
 * This script uses a new CSV that specifies the APPLE currency for each
 * territory, not the country's local currency.
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const CONFIG = {
  apiBaseUrl: 'https://api.appstoreconnect.apple.com/v1',
  pricingCsvPath: path.join(__dirname, 'apple-regional-pricing.csv'),
  tokenExpiration: 20 * 60,
  tokenRefreshInterval: 15 * 60 * 1000
};

let currentToken = null;
let tokenCreatedAt = null;
let credentials = null;

// Territory codes to country names mapping (matching CSV)
const TERRITORY_TO_COUNTRY = {
  'USA': 'United States',
  'AFG': 'Afghanistan',
  'ALB': 'Albania',
  'DZA': 'Algeria',
  'AGO': 'Angola',
  'AIA': 'Anguilla',
  'ATG': 'Antigua and Barbuda',
  'ARG': 'Argentina',
  'ARM': 'Armenia',
  'AUS': 'Australia',
  'AUT': 'Austria',
  'AZE': 'Azerbaijan',
  'BHS': 'Bahamas',
  'BHR': 'Bahrain',
  'BRB': 'Barbados',
  'BLR': 'Belarus',
  'BEL': 'Belgium',
  'BLZ': 'Belize',
  'BEN': 'Benin',
  'BMU': 'Bermuda',
  'BTN': 'Bhutan',
  'BOL': 'Bolivia',
  'BIH': 'Bosnia and Herzegovina',
  'BWA': 'Botswana',
  'BRA': 'Brazil',
  'VGB': 'British Virgin Islands',
  'BRN': 'Brunei',
  'BGR': 'Bulgaria',
  'BFA': 'Burkina Faso',
  'KHM': 'Cambodia',
  'CMR': 'Cameroon',
  'CAN': 'Canada',
  'CPV': 'Cape Verde',
  'CYM': 'Cayman Islands',
  'TCD': 'Chad',
  'CHL': 'Chile',
  'CHN': 'China mainland',
  'COL': 'Colombia',
  'COD': 'Congo Democratic Republic of the',
  'COG': 'Congo Republic of the',
  'CRI': 'Costa Rica',
  'CIV': "Côte d'Ivoire",
  'HRV': 'Croatia',
  'CYP': 'Cyprus',
  'CZE': 'Czech Republic',
  'DNK': 'Denmark',
  'DMA': 'Dominica',
  'DOM': 'Dominican Republic',
  'ECU': 'Ecuador',
  'EGY': 'Egypt',
  'SLV': 'El Salvador',
  'EST': 'Estonia',
  'SWZ': 'Eswatini',
  'FJI': 'Fiji',
  'FIN': 'Finland',
  'FRA': 'France',
  'GAB': 'Gabon',
  'GMB': 'Gambia',
  'GEO': 'Georgia',
  'DEU': 'Germany',
  'GHA': 'Ghana',
  'GRC': 'Greece',
  'GRD': 'Grenada',
  'GTM': 'Guatemala',
  'GNB': 'Guinea-Bissau',
  'GUY': 'Guyana',
  'HND': 'Honduras',
  'HKG': 'Hong Kong',
  'HUN': 'Hungary',
  'ISL': 'Iceland',
  'IND': 'India',
  'IDN': 'Indonesia',
  'IRQ': 'Iraq',
  'IRL': 'Ireland',
  'ISR': 'Israel',
  'ITA': 'Italy',
  'JAM': 'Jamaica',
  'JPN': 'Japan',
  'JOR': 'Jordan',
  'KAZ': 'Kazakhstan',
  'KEN': 'Kenya',
  'KOR': 'Korea Republic of',
  'XKS': 'Kosovo',
  'KWT': 'Kuwait',
  'KGZ': 'Kyrgyzstan',
  'LAO': 'Laos',
  'LVA': 'Latvia',
  'LBN': 'Lebanon',
  'LBR': 'Liberia',
  'LBY': 'Libya',
  'LTU': 'Lithuania',
  'LUX': 'Luxembourg',
  'MAC': 'Macau',
  'MDG': 'Madagascar',
  'MWI': 'Malawi',
  'MYS': 'Malaysia',
  'MDV': 'Maldives',
  'MLI': 'Mali',
  'MLT': 'Malta',
  'MRT': 'Mauritania',
  'MUS': 'Mauritius',
  'MEX': 'Mexico',
  'FSM': 'Micronesia',
  'MDA': 'Moldova',
  'MNG': 'Mongolia',
  'MNE': 'Montenegro',
  'MSR': 'Montserrat',
  'MAR': 'Morocco',
  'MOZ': 'Mozambique',
  'MMR': 'Myanmar',
  'NAM': 'Namibia',
  'NRU': 'Nauru',
  'NPL': 'Nepal',
  'NLD': 'Netherlands',
  'NZL': 'New Zealand',
  'NIC': 'Nicaragua',
  'NER': 'Niger',
  'NGA': 'Nigeria',
  'MKD': 'North Macedonia',
  'NOR': 'Norway',
  'OMN': 'Oman',
  'PAK': 'Pakistan',
  'PLW': 'Palau',
  'PAN': 'Panama',
  'PNG': 'Papua New Guinea',
  'PRY': 'Paraguay',
  'PER': 'Peru',
  'PHL': 'Philippines',
  'POL': 'Poland',
  'PRT': 'Portugal',
  'QAT': 'Qatar',
  'ROU': 'Romania',
  'RUS': 'Russia',
  'RWA': 'Rwanda',
  'STP': 'São Tomé and Príncipe',
  'SAU': 'Saudi Arabia',
  'SEN': 'Senegal',
  'SRB': 'Serbia',
  'SYC': 'Seychelles',
  'SLE': 'Sierra Leone',
  'SGP': 'Singapore',
  'SVK': 'Slovakia',
  'SVN': 'Slovenia',
  'SLB': 'Solomon Islands',
  'ZAF': 'South Africa',
  'ESP': 'Spain',
  'LKA': 'Sri Lanka',
  'KNA': 'St. Kitts and Nevis',
  'LCA': 'St. Lucia',
  'VCT': 'St. Vincent and the Grenadines',
  'SUR': 'Suriname',
  'SWE': 'Sweden',
  'CHE': 'Switzerland',
  'TWN': 'Taiwan',
  'TJK': 'Tajikistan',
  'TZA': 'Tanzania',
  'THA': 'Thailand',
  'TON': 'Tonga',
  'TTO': 'Trinidad and Tobago',
  'TUN': 'Tunisia',
  'TUR': 'Türkiye',
  'TKM': 'Turkmenistan',
  'TCA': 'Turks and Caicos Islands',
  'UGA': 'Uganda',
  'UKR': 'Ukraine',
  'ARE': 'United Arab Emirates',
  'GBR': 'United Kingdom',
  'URY': 'Uruguay',
  'UZB': 'Uzbekistan',
  'VUT': 'Vanuatu',
  'VEN': 'Venezuela',
  'VNM': 'Vietnam',
  'YEM': 'Yemen',
  'ZMB': 'Zambia',
  'ZWE': 'Zimbabwe'
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

function getToken() {
  const now = Date.now();
  if (!currentToken || !tokenCreatedAt || (now - tokenCreatedAt) > CONFIG.tokenRefreshInterval) {
    console.log('\n🔄 Generating new API token...');
    currentToken = generateToken(credentials.keyId, credentials.issuerId, credentials.privateKey);
    tokenCreatedAt = now;
  }
  return currentToken;
}

async function apiRequest(endpoint, method = 'GET', body = null) {
  const fetch = (await import('node-fetch')).default;
  const token = getToken();
  const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.apiBaseUrl}${endpoint}`;
  const options = {
    method,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
  };
  if (body) options.body = JSON.stringify(body);

  const response = await fetch(url, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${response.status}: ${errorText.slice(0, 200)}`);
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

/**
 * Parse the apple-regional-pricing.csv
 * Format: Country,Apple Currency,Monthly Price,3-Month Price,Annual Price,Monthly USD Equiv,Notes
 */
function parsePricingCsv(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const pricing = {};

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 6) continue;
    const country = values[0].trim();
    pricing[country] = {
      currency: values[1].trim(),
      monthly: parseFloat(values[2]) || 0,
      threeMonth: parseFloat(values[3]) || 0,
      annual: parseFloat(values[4]) || 0,
      monthlyUsd: parseFloat(values[5]) || 0
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

async function getAllPricePoints(subscriptionId, territory) {
  let allPoints = [];
  let nextUrl = `/subscriptions/${subscriptionId}/pricePoints?filter[territory]=${territory}&limit=200`;

  while (nextUrl) {
    try {
      const response = await apiRequest(nextUrl);
      if (response?.data) {
        allPoints = allPoints.concat(response.data);
      }
      nextUrl = response?.links?.next || null;
      if (nextUrl && nextUrl.startsWith('https://')) {
        nextUrl = nextUrl.replace(CONFIG.apiBaseUrl, '');
      }
    } catch (err) {
      console.log(`      Warning getting price points: ${err.message.slice(0, 100)}`);
      break;
    }
  }

  return allPoints;
}

/**
 * Find the best price point matching our target price.
 * Matches customerPrice directly since our CSV now uses Apple's currency.
 */
function findBestPricePoint(pricePoints, targetPrice, currency) {
  if (!pricePoints || pricePoints.length === 0) return null;

  let bestMatch = null;
  let bestDiff = Infinity;

  for (const pp of pricePoints) {
    const customerPrice = parseFloat(pp.attributes.customerPrice);
    const diff = Math.abs(customerPrice - targetPrice);

    if (diff < bestDiff) {
      bestDiff = diff;
      bestMatch = pp;
    }
  }

  if (bestMatch) {
    const actualPrice = parseFloat(bestMatch.attributes.customerPrice);
    const diffPercent = targetPrice > 0 ? ((Math.abs(actualPrice - targetPrice) / targetPrice) * 100).toFixed(1) : '0';
    return {
      pricePoint: bestMatch,
      actualPrice: bestMatch.attributes.customerPrice,
      targetPrice: targetPrice,
      currency: currency,
      diffPercent: diffPercent,
      isExact: bestDiff < 0.01,
      isClose: bestDiff <= Math.max(targetPrice * 0.15, 1.0)
    };
  }

  return null;
}

/**
 * Get all scheduled/future prices for a subscription in a specific territory
 */
async function getSubscriptionPrices(subscriptionId, territory) {
  let allPrices = [];
  let nextUrl = `/subscriptions/${subscriptionId}/prices?filter[territory]=${territory}&limit=200`;

  while (nextUrl) {
    try {
      const response = await apiRequest(nextUrl);
      if (response?.data) {
        allPrices = allPrices.concat(response.data);
      }
      nextUrl = response?.links?.next || null;
      if (nextUrl && nextUrl.startsWith('https://')) {
        nextUrl = nextUrl.replace(CONFIG.apiBaseUrl, '');
      }
    } catch (err) {
      // 404 means no prices exist, which is fine
      if (!err.message.includes('404')) {
        console.log(`      Warning getting prices: ${err.message.slice(0, 100)}`);
      }
      break;
    }
  }

  return allPrices;
}

/**
 * Delete a scheduled subscription price
 */
async function deleteSubscriptionPrice(priceId) {
  return apiRequest(`/subscriptionPrices/${priceId}`, 'DELETE');
}

/**
 * Delete any future-dated prices for a subscription/territory to avoid 409 conflicts
 */
async function deleteScheduledPrices(subscriptionId, territory, isDryRun = false) {
  const prices = await getSubscriptionPrices(subscriptionId, territory);
  const today = new Date().toISOString().split('T')[0];
  let deletedCount = 0;

  for (const price of prices) {
    const startDate = price.attributes?.startDate;
    // Delete prices that start today or in the future (these cause conflicts)
    if (startDate && startDate >= today) {
      if (!isDryRun) {
        try {
          await deleteSubscriptionPrice(price.id);
          deletedCount++;
        } catch (err) {
          // Some prices may not be deletable, that's okay
          if (!err.message.includes('404') && !err.message.includes('409')) {
            console.log(`      Warning deleting price ${price.id}: ${err.message.slice(0, 50)}`);
          }
        }
      } else {
        deletedCount++;
      }
    }
  }

  return deletedCount;
}

async function createSubscriptionPrice(subscriptionId, pricePointId, territory) {
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
        subscriptionPricePoint: { data: { type: 'subscriptionPricePoints', id: pricePointId } },
        territory: { data: { type: 'territories', id: territory } }
      }
    }
  };

  return apiRequest('/subscriptionPrices', 'POST', body);
}

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const applyChanges = args.includes('--apply');
  const singleCountry = args.find(a => a.startsWith('--country='))?.split('=')[1];

  console.log('='.repeat(70));
  console.log('App Store Connect Subscription Price Updater v2 (FIXED)');
  console.log('='.repeat(70));
  console.log('This version uses the correct Apple currencies per territory.');
  console.log('');

  if (!isDryRun && !applyChanges) {
    console.log('Usage:');
    console.log('  --dry-run              Preview all changes without applying');
    console.log('  --apply                Actually apply the price changes');
    console.log('  --country=TERRITORY    Only update specific territory (e.g., --country=USA)');
    console.log('');
    console.log('Run with --dry-run first to preview changes.');
    process.exit(0);
  }

  console.log(`Mode: ${isDryRun ? 'DRY RUN (preview only)' : 'APPLYING CHANGES'}`);
  if (singleCountry) console.log(`Filtering to territory: ${singleCountry}`);
  console.log('');

  const keyId = process.env.APP_STORE_KEY_ID;
  const issuerId = process.env.APP_STORE_ISSUER_ID;
  const privateKey = process.env.APP_STORE_PRIVATE_KEY;
  const appId = process.env.APP_STORE_APP_ID;

  if (!keyId || !issuerId || !privateKey || !appId) {
    console.error('Missing environment variables: APP_STORE_KEY_ID, APP_STORE_ISSUER_ID, APP_STORE_PRIVATE_KEY, APP_STORE_APP_ID');
    process.exit(1);
  }

  credentials = { keyId, issuerId, privateKey };

  console.log('Loading regional pricing data from apple-regional-pricing.csv...');
  const pricingData = parsePricingCsv(CONFIG.pricingCsvPath);
  console.log(`Loaded pricing for ${Object.keys(pricingData).length} countries\n`);

  console.log('Fetching subscription groups...\n');
  const groups = await apiRequest(`/apps/${appId}/subscriptionGroups`);

  if (!groups?.data?.length) {
    console.error('No subscription groups found');
    process.exit(1);
  }

  const results = {
    updated: [],
    skipped: [],
    errors: [],
    noMatch: [],
    warnings: []
  };

  let territories = Object.keys(TERRITORY_TO_COUNTRY);
  if (singleCountry) {
    territories = territories.filter(t => t === singleCountry);
  }

  let totalProcessed = 0;

  for (const group of groups.data) {
    const subs = await apiRequest(`/subscriptionGroups/${group.id}/subscriptions`);
    if (!subs?.data?.length) continue;

    for (const sub of subs.data) {
      const subName = sub.attributes?.name || sub.id;
      const subProductId = sub.attributes?.productId || '';

      // ONLY process Premium plans, skip Platinum
      const isPremium = subName.toLowerCase().includes('premium') ||
                        subProductId.toLowerCase().includes('premium');
      const isPlatinum = subName.toLowerCase().includes('platinum') ||
                         subProductId.toLowerCase().includes('platinum');

      if (isPlatinum || !isPremium) {
        console.log(`\nSkipping: ${subName} (${subProductId}) - Not a Premium plan`);
        continue;
      }

      const subType = getSubscriptionType(subName);

      console.log(`\n${'='.repeat(70)}`);
      console.log(`SUBSCRIPTION: ${subName} (${subType})`);
      console.log('='.repeat(70));

      for (const territory of territories) {
        totalProcessed++;
        const country = TERRITORY_TO_COUNTRY[territory];
        if (!country) {
          console.log(`  ${territory}: Unknown territory`);
          continue;
        }

        const countryData = pricingData[country];
        if (!countryData) {
          results.skipped.push({ sub: subName, territory, country, reason: 'No pricing data in CSV' });
          console.log(`  ${territory} (${country}): ⚠️ No pricing data in CSV`);
          continue;
        }

        // Get target price based on subscription type
        let targetPrice;
        if (subType === 'monthly') {
          targetPrice = countryData.monthly;
        } else if (subType === 'threeMonth') {
          targetPrice = countryData.threeMonth;
        } else {
          targetPrice = countryData.annual;
        }

        if (!targetPrice || targetPrice <= 0) {
          results.skipped.push({ sub: subName, territory, country, reason: 'No target price for this subscription type' });
          continue;
        }

        const currency = countryData.currency;

        try {
          const pricePoints = await getAllPricePoints(sub.id, territory);

          if (pricePoints.length === 0) {
            results.noMatch.push({ sub: subName, territory, country, reason: 'No price points available from Apple' });
            console.log(`  ${territory} (${country}): ❌ No price points available`);
            continue;
          }

          const match = findBestPricePoint(pricePoints, targetPrice, currency);

          if (!match) {
            results.noMatch.push({ sub: subName, territory, country, targetPrice, currency, reason: 'Could not find any price point' });
            console.log(`  ${territory} (${country}): ❌ No price point found for ${currency} ${targetPrice}`);
            continue;
          }

          // Determine status icon
          let statusIcon = '✓';
          if (!match.isClose) {
            statusIcon = '⚠️';
            results.warnings.push({
              sub: subName,
              territory,
              country,
              currency,
              targetPrice,
              actualPrice: match.actualPrice,
              diffPercent: match.diffPercent
            });
          }

          console.log(`  ${statusIcon} ${territory} (${country}): ${currency} ${targetPrice} → ${match.actualPrice} (${match.diffPercent}% diff)`);

          if (!isDryRun) {
            try {
              // Delete any existing scheduled prices first to avoid 409 conflicts
              const deletedCount = await deleteScheduledPrices(sub.id, territory, false);
              if (deletedCount > 0) {
                console.log(`    🗑️ Deleted ${deletedCount} existing scheduled price(s)`);
              }

              await createSubscriptionPrice(sub.id, match.pricePoint.id, territory);
              results.updated.push({
                subscription: subName,
                territory,
                country,
                currency,
                targetPrice,
                actualPrice: match.actualPrice,
                diffPercent: match.diffPercent
              });
            } catch (err) {
              console.log(`    ❌ ERROR: ${err.message.slice(0, 100)}`);
              results.errors.push({ sub: subName, territory, country, error: err.message });
            }
          } else {
            results.updated.push({
              subscription: subName,
              territory,
              country,
              currency,
              targetPrice,
              actualPrice: match.actualPrice,
              diffPercent: match.diffPercent,
              dryRun: true
            });
          }

          await new Promise(r => setTimeout(r, 30));

        } catch (err) {
          results.errors.push({ sub: subName, territory, country, error: err.message });
          console.log(`  ${territory} (${country}): ❌ ERROR - ${err.message.slice(0, 50)}`);
        }

        if (totalProcessed % 50 === 0) {
          console.log(`\n--- Progress: ${totalProcessed} processed ---\n`);
        }
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Successfully ${isDryRun ? 'matched' : 'updated'}: ${results.updated.length}`);
  console.log(`Skipped (no data): ${results.skipped.length}`);
  console.log(`No match found: ${results.noMatch.length}`);
  console.log(`Warnings (large diff): ${results.warnings.length}`);
  console.log(`Errors: ${results.errors.length}`);

  if (results.warnings.length > 0) {
    console.log('\n⚠️ Prices with >15% difference from target:');
    results.warnings.forEach(w => {
      console.log(`  ${w.territory} (${w.country}): Target ${w.currency} ${w.targetPrice} → Actual ${w.actualPrice} (${w.diffPercent}% diff)`);
    });
  }

  if (results.errors.length > 0) {
    console.log('\n❌ Errors:');
    results.errors.slice(0, 10).forEach(e => console.log(`  ${e.territory} (${e.country}): ${e.error.slice(0, 80)}`));
  }

  if (results.noMatch.length > 0) {
    console.log('\n❌ No match found:');
    results.noMatch.slice(0, 10).forEach(e => console.log(`  ${e.territory} (${e.country}): ${e.currency || 'N/A'} ${e.targetPrice || 'N/A'}`));
  }

  // Save results
  const outputPath = path.join(__dirname, 'pricing-v2-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);

  if (isDryRun) {
    console.log('\n' + '='.repeat(70));
    console.log('DRY RUN COMPLETE - No changes were applied');
    console.log('Run with --apply to actually update prices');
    console.log('='.repeat(70));
  }
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err);
  process.exit(1);
});
