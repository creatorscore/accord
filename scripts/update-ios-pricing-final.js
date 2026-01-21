#!/usr/bin/env node

/**
 * App Store Connect API - Subscription Price Updater FINAL
 *
 * Handles ALL countries by:
 * 1. Matching local currency prices when available
 * 2. For territories where Apple uses USD, match USD equivalent
 * 3. Paginate through ALL price points to find the best match
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const CONFIG = {
  apiBaseUrl: 'https://api.appstoreconnect.apple.com/v1',
  pricingCsvPath: path.join(__dirname, '..', 'complete-regional-pricing.csv'),
  tokenExpiration: 20 * 60
};

// All territories we want to update
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

function parsePricingCsv(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const pricing = {};

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 7) continue;
    const country = values[0].trim();
    pricing[country] = {
      currency: values[1].trim(),
      monthly: parseFloat(values[2]) || 0,
      threeMonth: parseFloat(values[3]) || 0,
      annual: parseFloat(values[4]) || 0,
      monthlyUsd: parseFloat(values[5]) || 0,
      threeMonthUsd: (parseFloat(values[6]) || 0) * 3, // CSV has monthly equiv
      annualUsd: (parseFloat(values[7]) || 0) * 12     // CSV has monthly equiv
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

/**
 * Get ALL price points for a territory (with pagination)
 */
async function getAllPricePoints(token, subscriptionId, territory) {
  let allPoints = [];
  let nextUrl = `/subscriptions/${subscriptionId}/pricePoints?filter[territory]=${territory}&limit=200`;

  while (nextUrl) {
    try {
      const response = await apiRequest(token, nextUrl);
      if (response?.data) {
        allPoints = allPoints.concat(response.data);
      }
      // Check for next page
      nextUrl = response?.links?.next || null;
      if (nextUrl && nextUrl.startsWith('https://')) {
        // Convert full URL to relative path
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
 * Find the best price point - tries local currency first, then USD equivalent
 */
function findBestPricePoint(pricePoints, targetLocalPrice, targetUsdPrice) {
  if (!pricePoints || pricePoints.length === 0) return null;

  // First, try to find exact or close match in local currency
  let bestMatch = null;
  let bestDiff = Infinity;

  for (const pp of pricePoints) {
    const price = parseFloat(pp.attributes.customerPrice);
    const diff = Math.abs(price - targetLocalPrice);
    const diffPercent = (diff / targetLocalPrice) * 100;

    if (diffPercent < 5 && diff < bestDiff) { // Within 5%
      bestDiff = diff;
      bestMatch = pp;
    }
  }

  if (bestMatch) {
    return {
      pricePoint: bestMatch,
      matchType: 'local',
      actualPrice: bestMatch.attributes.customerPrice,
      diffPercent: ((bestDiff / targetLocalPrice) * 100).toFixed(1)
    };
  }

  // If no good local match, find by USD equivalent using proceeds
  // Apple takes ~30%, so customerPrice ≈ proceeds / 0.7
  bestDiff = Infinity;
  for (const pp of pricePoints) {
    const proceeds = parseFloat(pp.attributes.proceeds) || 0;
    const estimatedUsd = proceeds / 0.7;
    const diff = Math.abs(estimatedUsd - targetUsdPrice);

    if (diff < bestDiff) {
      bestDiff = diff;
      bestMatch = pp;
    }
  }

  if (bestMatch) {
    const proceeds = parseFloat(bestMatch.attributes.proceeds) || 0;
    const estimatedUsd = proceeds / 0.7;
    return {
      pricePoint: bestMatch,
      matchType: 'usd-equiv',
      actualPrice: bestMatch.attributes.customerPrice,
      actualUsd: estimatedUsd.toFixed(2),
      targetUsd: targetUsdPrice.toFixed(2),
      diffPercent: ((Math.abs(estimatedUsd - targetUsdPrice) / targetUsdPrice) * 100).toFixed(1)
    };
  }

  return null;
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
  const applyChanges = args.includes('--apply');

  console.log('='.repeat(70));
  console.log('App Store Connect Subscription Price Updater - FINAL VERSION');
  console.log('='.repeat(70));

  if (!isDryRun && !applyChanges) {
    console.log('\nUsage:');
    console.log('  --dry-run   Preview all changes without applying');
    console.log('  --apply     Actually apply the price changes');
    console.log('\nRun with --dry-run first to preview changes.\n');
    process.exit(0);
  }

  console.log(`Mode: ${isDryRun ? 'DRY RUN (preview only)' : 'APPLYING CHANGES'}`);
  console.log('');

  const keyId = process.env.APP_STORE_KEY_ID;
  const issuerId = process.env.APP_STORE_ISSUER_ID;
  const privateKey = process.env.APP_STORE_PRIVATE_KEY;
  const appId = process.env.APP_STORE_APP_ID;

  if (!keyId || !issuerId || !privateKey || !appId) {
    console.error('Missing environment variables: APP_STORE_KEY_ID, APP_STORE_ISSUER_ID, APP_STORE_PRIVATE_KEY, APP_STORE_APP_ID');
    process.exit(1);
  }

  console.log('Loading regional pricing data...');
  const pricingData = parsePricingCsv(CONFIG.pricingCsvPath);
  console.log(`Loaded ${Object.keys(pricingData).length} countries\n`);

  console.log('Generating API token...');
  const token = generateToken(keyId, issuerId, privateKey);

  console.log('Fetching subscription groups...\n');
  const groups = await apiRequest(token, `/apps/${appId}/subscriptionGroups`);

  if (!groups?.data?.length) {
    console.error('No subscription groups found');
    process.exit(1);
  }

  const results = {
    updated: [],
    skipped: [],
    errors: [],
    noMatch: []
  };

  const territories = Object.keys(TERRITORY_TO_COUNTRY);
  let totalProcessed = 0;
  let totalToProcess = 0;

  // Count total
  for (const group of groups.data) {
    const subs = await apiRequest(token, `/subscriptionGroups/${group.id}/subscriptions`);
    if (subs?.data) totalToProcess += subs.data.length * territories.length;
  }

  console.log(`Processing ${totalToProcess} subscription-territory combinations...\n`);

  for (const group of groups.data) {
    const subs = await apiRequest(token, `/subscriptionGroups/${group.id}/subscriptions`);
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
        if (!country) continue;

        const countryData = pricingData[country];
        if (!countryData) {
          results.skipped.push({ sub: subName, territory, reason: 'No pricing data for country' });
          continue;
        }

        // Get target prices
        let targetLocal, targetUsd;
        if (subType === 'monthly') {
          targetLocal = countryData.monthly;
          targetUsd = countryData.monthlyUsd;
        } else if (subType === 'threeMonth') {
          targetLocal = countryData.threeMonth;
          targetUsd = countryData.threeMonthUsd;
        } else {
          targetLocal = countryData.annual;
          targetUsd = countryData.annualUsd;
        }

        if (!targetLocal || targetLocal <= 0) {
          results.skipped.push({ sub: subName, territory, reason: 'No target price' });
          continue;
        }

        try {
          // Get all price points for this territory
          const pricePoints = await getAllPricePoints(token, sub.id, territory);

          if (pricePoints.length === 0) {
            results.noMatch.push({ sub: subName, territory, country, reason: 'No price points available' });
            process.stdout.write(`  ${territory}: No price points\n`);
            continue;
          }

          // Find best match
          const match = findBestPricePoint(pricePoints, targetLocal, targetUsd);

          if (!match) {
            results.noMatch.push({ sub: subName, territory, country, targetLocal, targetUsd, reason: 'Could not find suitable price' });
            process.stdout.write(`  ${territory}: No suitable price found\n`);
            continue;
          }

          const logMsg = match.matchType === 'local'
            ? `${territory} (${country}): ${countryData.currency} ${targetLocal} → ${match.actualPrice} (${match.diffPercent}% diff)`
            : `${territory} (${country}): ~$${match.targetUsd} → ${match.actualPrice} (~$${match.actualUsd}, ${match.diffPercent}% diff)`;

          console.log(`  ${logMsg}`);

          if (!isDryRun) {
            try {
              await createSubscriptionPrice(token, sub.id, match.pricePoint.id);
              results.updated.push({
                subscription: subName,
                territory,
                country,
                targetLocal,
                targetUsd,
                actualPrice: match.actualPrice,
                matchType: match.matchType
              });
            } catch (err) {
              console.log(`    ERROR: ${err.message.slice(0, 100)}`);
              results.errors.push({ sub: subName, territory, error: err.message });
            }
          } else {
            results.updated.push({
              subscription: subName,
              territory,
              country,
              targetLocal,
              targetUsd,
              actualPrice: match.actualPrice,
              matchType: match.matchType,
              dryRun: true
            });
          }

          // Rate limit - small delay between requests
          await new Promise(r => setTimeout(r, 30));

        } catch (err) {
          results.errors.push({ sub: subName, territory, error: err.message });
          console.log(`  ${territory}: ERROR - ${err.message.slice(0, 50)}`);
        }

        // Progress indicator every 50 items
        if (totalProcessed % 50 === 0) {
          console.log(`\n--- Progress: ${totalProcessed}/${totalToProcess} (${((totalProcessed/totalToProcess)*100).toFixed(0)}%) ---\n`);
        }
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('FINAL SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Successfully ${isDryRun ? 'matched' : 'updated'}: ${results.updated.length}`);
  console.log(`Skipped (no data): ${results.skipped.length}`);
  console.log(`No match found: ${results.noMatch.length}`);
  console.log(`Errors: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\nFirst 10 errors:');
    results.errors.slice(0, 10).forEach(e => console.log(`  ${e.sub}/${e.territory}: ${e.error.slice(0, 80)}`));
  }

  if (results.noMatch.length > 0) {
    console.log('\nTerritories with no price match:');
    results.noMatch.slice(0, 20).forEach(e => console.log(`  ${e.territory} (${e.country})`));
    if (results.noMatch.length > 20) console.log(`  ... and ${results.noMatch.length - 20} more`);
  }

  // Save results
  const outputPath = path.join(__dirname, 'pricing-final-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nDetailed results saved to: ${outputPath}`);

  if (isDryRun) {
    console.log('\n' + '='.repeat(70));
    console.log('DRY RUN COMPLETE - No changes were applied');
    console.log('Run with --apply to actually update prices');
    console.log('='.repeat(70));
  } else {
    console.log('\n' + '='.repeat(70));
    console.log('PRICE UPDATES APPLIED');
    console.log('Changes will take effect within 24 hours');
    console.log('='.repeat(70));
  }
}

main().catch(err => {
  console.error('\nFATAL ERROR:', err);
  process.exit(1);
});
