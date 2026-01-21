#!/usr/bin/env node

/**
 * App Store Connect API - Subscription Price Updater v2
 *
 * Uses the correct API flow:
 * 1. Get subscriptions for the app
 * 2. For each subscription, get the base price point
 * 3. Get price point equalizations for all territories
 * 4. Find closest price point for each territory based on target USD equivalent
 * 5. Create subscription prices for each territory
 *
 * Prerequisites:
 * - APP_STORE_KEY_ID, APP_STORE_ISSUER_ID, APP_STORE_PRIVATE_KEY, APP_STORE_APP_ID
 *
 * Usage:
 *   node scripts/update-ios-pricing-v2.js --dry-run
 *   node scripts/update-ios-pricing-v2.js
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const CONFIG = {
  apiBaseUrl: 'https://api.appstoreconnect.apple.com/v1',
  pricingCsvPath: path.join(__dirname, '..', 'complete-regional-pricing.csv'),
  tokenExpiration: 20 * 60
};

// Territory code to country name mapping for our CSV
const TERRITORY_TO_COUNTRY = {
  'USA': 'United States',
  'ALB': 'Albania',
  'DZA': 'Algeria',
  'AGO': 'Angola',
  'ATG': 'Antigua & Barbuda',
  'ARG': 'Argentina',
  'ARM': 'Armenia',
  'AUS': 'Australia',
  'AUT': 'Austria',
  'AZE': 'Azerbaijan',
  'BHS': 'Bahamas',
  'BHR': 'Bahrain',
  'BGD': 'Bangladesh',
  'BLR': 'Belarus',
  'BEL': 'Belgium',
  'BLZ': 'Belize',
  'BEN': 'Benin',
  'BMU': 'Bermuda',
  'BOL': 'Bolivia',
  'BIH': 'Bosnia & Herzegovina',
  'BWA': 'Botswana',
  'BRA': 'Brazil',
  'VGB': 'British Virgin Islands',
  'BGR': 'Bulgaria',
  'BFA': 'Burkina Faso',
  'KHM': 'Cambodia',
  'CMR': 'Cameroon',
  'CAN': 'Canada',
  'CPV': 'Cape Verde',
  'CYM': 'Cayman Islands',
  'TCD': 'Chad',
  'CHL': 'Chile',
  'CHN': 'China',
  'COL': 'Colombia',
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
  'GIN': 'Guinea',
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
  'KWT': 'Kuwait',
  'KGZ': 'Kyrgyzstan',
  'LAO': 'Laos',
  'LVA': 'Latvia',
  'LBN': 'Lebanon',
  'LBR': 'Liberia',
  'LBY': 'Libya',
  'LTU': 'Lithuania',
  'LUX': 'Luxembourg',
  'MDG': 'Madagascar',
  'MWI': 'Malawi',
  'MYS': 'Malaysia',
  'MDV': 'Maldives',
  'MLI': 'Mali',
  'MLT': 'Malta',
  'MRT': 'Mauritania',
  'MUS': 'Mauritius',
  'MEX': 'Mexico',
  'MDA': 'Moldova',
  'MNG': 'Mongolia',
  'MAR': 'Morocco',
  'MOZ': 'Mozambique',
  'MMR': 'Myanmar',
  'NAM': 'Namibia',
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
  'KOR': 'South Korea',
  'ESP': 'Spain',
  'LKA': 'Sri Lanka',
  'KNA': 'St Kitts & Nevis',
  'LCA': 'St Lucia',
  'SUR': 'Suriname',
  'SWE': 'Sweden',
  'CHE': 'Switzerland',
  'TWN': 'Taiwan',
  'TJK': 'Tajikistan',
  'TZA': 'Tanzania',
  'THA': 'Thailand',
  'TON': 'Tonga',
  'TTO': 'Trinidad & Tobago',
  'TUN': 'Tunisia',
  'TUR': 'Turkey',
  'TKM': 'Turkmenistan',
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
  'ZWE': 'Zimbabwe',
  'MAC': 'Macao',
  'FSM': 'Micronesia'
};

/**
 * Generate JWT token for App Store Connect API
 */
function generateToken(keyId, issuerId, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + CONFIG.tokenExpiration,
    aud: 'appstoreconnect-v1'
  };
  return jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    header: { alg: 'ES256', kid: keyId, typ: 'JWT' }
  });
}

/**
 * Make authenticated API request
 */
async function apiRequest(token, endpoint, method = 'GET', body = null) {
  const fetch = (await import('node-fetch')).default;

  const url = endpoint.startsWith('http') ? endpoint : `${CONFIG.apiBaseUrl}${endpoint}`;

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API ${method} ${endpoint}: ${response.status} - ${errorText}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

/**
 * Parse CSV line handling quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') inQuotes = !inQuotes;
    else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else current += char;
  }
  result.push(current.trim());
  return result;
}

/**
 * Parse regional pricing CSV - returns map by country name
 */
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
      threeMonthMonthlyUsd: parseFloat(values[6]) || 0,
      annualMonthlyUsd: parseFloat(values[7]) || 0
    };
  }
  return pricing;
}

/**
 * Determine subscription duration type from name
 */
function getSubscriptionType(name) {
  const nameLower = name.toLowerCase();
  if (nameLower.includes('month') && !nameLower.includes('3') && !nameLower.includes('three')) {
    return 'monthly';
  } else if (nameLower.includes('3') || nameLower.includes('three') || nameLower.includes('quarter')) {
    return 'threeMonth';
  } else if (nameLower.includes('year') || nameLower.includes('annual')) {
    return 'annual';
  }
  return 'monthly'; // default
}

/**
 * Get target USD price for a subscription type and country
 */
function getTargetPrice(pricingData, country, subscriptionType) {
  const countryPricing = pricingData[country];
  if (!countryPricing) return null;

  switch (subscriptionType) {
    case 'monthly':
      return countryPricing.monthlyUsd;
    case 'threeMonth':
      // The CSV has monthly equivalent, multiply by 3 for actual 3-month price
      return countryPricing.threeMonthMonthlyUsd * 3;
    case 'annual':
      // The CSV has monthly equivalent, multiply by 12 for actual annual price
      return countryPricing.annualMonthlyUsd * 12;
    default:
      return countryPricing.monthlyUsd;
  }
}

/**
 * Get all subscription groups for an app
 */
async function getSubscriptionGroups(token, appId) {
  return apiRequest(token, `/apps/${appId}/subscriptionGroups`);
}

/**
 * Get all subscriptions in a group
 */
async function getSubscriptions(token, groupId) {
  return apiRequest(token, `/subscriptionGroups/${groupId}/subscriptions`);
}

/**
 * Get price points for a subscription filtered by territory
 */
async function getSubscriptionPricePoints(token, subscriptionId, territory) {
  try {
    const response = await apiRequest(
      token,
      `/subscriptions/${subscriptionId}/pricePoints?filter[territory]=${territory}&include=territory`
    );
    return response;
  } catch (err) {
    console.log(`    Warning: Could not get price points for ${territory}: ${err.message}`);
    return null;
  }
}

/**
 * Get current subscription prices
 */
async function getCurrentPrices(token, subscriptionId) {
  return apiRequest(token, `/subscriptions/${subscriptionId}/prices?include=subscriptionPricePoint,territory`);
}

/**
 * Create a new subscription price for a territory
 */
async function createSubscriptionPrice(token, subscriptionId, pricePointId, startDate = null) {
  const body = {
    data: {
      type: 'subscriptionPrices',
      attributes: {
        startDate: startDate || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
        preserveCurrentPrice: false
      },
      relationships: {
        subscription: {
          data: { type: 'subscriptions', id: subscriptionId }
        },
        subscriptionPricePoint: {
          data: { type: 'subscriptionPricePoints', id: pricePointId }
        }
      }
    }
  };

  return apiRequest(token, '/subscriptionPrices', 'POST', body);
}

/**
 * Find closest price point from available options
 */
function findClosestPricePoint(pricePoints, targetUsd) {
  if (!pricePoints || pricePoints.length === 0) return null;

  let closest = null;
  let minDiff = Infinity;

  for (const point of pricePoints) {
    // Price points have customerPrice in local currency
    // We need to look at the USD equivalent or use proceeds as approximation
    const proceeds = parseFloat(point.attributes?.proceeds || 0);
    // Apple takes ~30%, so customer price ≈ proceeds / 0.7
    const estimatedCustomerUsd = proceeds / 0.7;

    const diff = Math.abs(estimatedCustomerUsd - targetUsd);
    if (diff < minDiff) {
      minDiff = diff;
      closest = point;
    }
  }

  return closest;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('App Store Connect Subscription Price Updater v2');
  console.log('='.repeat(60));
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('');

  // Environment variables
  const keyId = process.env.APP_STORE_KEY_ID;
  const issuerId = process.env.APP_STORE_ISSUER_ID;
  let privateKey = process.env.APP_STORE_PRIVATE_KEY;
  const appId = process.env.APP_STORE_APP_ID;

  const missing = [];
  if (!keyId) missing.push('APP_STORE_KEY_ID');
  if (!issuerId) missing.push('APP_STORE_ISSUER_ID');
  if (!privateKey) missing.push('APP_STORE_PRIVATE_KEY');
  if (!appId) missing.push('APP_STORE_APP_ID');

  if (missing.length > 0) {
    console.error('Missing environment variables:', missing.join(', '));
    process.exit(1);
  }

  // Load pricing data
  console.log('Loading regional pricing data...');
  const pricingData = parsePricingCsv(CONFIG.pricingCsvPath);
  console.log(`Loaded pricing for ${Object.keys(pricingData).length} countries`);

  // Generate token
  console.log('Generating API token...');
  const token = generateToken(keyId, issuerId, privateKey);

  // Get subscription groups
  console.log('Fetching subscription groups...');
  const groups = await getSubscriptionGroups(token, appId);

  if (!groups?.data?.length) {
    console.error('No subscription groups found');
    process.exit(1);
  }

  console.log(`Found ${groups.data.length} subscription group(s)`);

  const results = {
    updated: [],
    skipped: [],
    errors: []
  };

  // Process each group
  for (const group of groups.data) {
    console.log(`\nProcessing group: ${group.attributes?.referenceName || group.id}`);

    // Get subscriptions in group
    const subs = await getSubscriptions(token, group.id);
    if (!subs?.data?.length) continue;

    console.log(`  Found ${subs.data.length} subscription(s)`);

    // Process each subscription
    for (const sub of subs.data) {
      const subName = sub.attributes?.name || sub.id;
      const subType = getSubscriptionType(subName);

      console.log(`\n  Subscription: ${subName} (type: ${subType})`);
      console.log('  ' + '-'.repeat(50));

      // Get current prices
      const currentPrices = await getCurrentPrices(token, sub.id);
      const currentPriceMap = new Map();

      if (currentPrices?.included) {
        for (const item of currentPrices.included) {
          if (item.type === 'territories') {
            currentPriceMap.set(item.id, item.attributes);
          }
        }
      }

      // Process key territories
      const territoriesToProcess = Object.keys(TERRITORY_TO_COUNTRY);

      for (const territory of territoriesToProcess) {
        const country = TERRITORY_TO_COUNTRY[territory];
        const targetUsd = getTargetPrice(pricingData, country, subType);

        if (!targetUsd) {
          results.skipped.push({ subscription: subName, territory, reason: 'No pricing data' });
          continue;
        }

        try {
          // Get available price points for this territory
          const pricePointsResponse = await getSubscriptionPricePoints(token, sub.id, territory);

          if (!pricePointsResponse?.data?.length) {
            results.skipped.push({ subscription: subName, territory, reason: 'No price points available' });
            continue;
          }

          // Find closest price point to target
          const bestPricePoint = findClosestPricePoint(pricePointsResponse.data, targetUsd);

          if (!bestPricePoint) {
            results.skipped.push({ subscription: subName, territory, reason: 'Could not find suitable price point' });
            continue;
          }

          const customerPrice = bestPricePoint.attributes?.customerPrice || 'N/A';
          const proceeds = bestPricePoint.attributes?.proceeds || 'N/A';

          console.log(`    ${territory} (${country}): Target $${targetUsd.toFixed(2)} → ${customerPrice} (proceeds: ${proceeds})`);

          if (!isDryRun) {
            try {
              await createSubscriptionPrice(token, sub.id, bestPricePoint.id);
              results.updated.push({
                subscription: subName,
                territory,
                country,
                targetUsd,
                pricePointId: bestPricePoint.id,
                customerPrice
              });
            } catch (err) {
              results.errors.push({
                subscription: subName,
                territory,
                error: err.message
              });
            }
          } else {
            results.updated.push({
              subscription: subName,
              territory,
              country,
              targetUsd,
              pricePointId: bestPricePoint.id,
              customerPrice,
              dryRun: true
            });
          }

          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (err) {
          results.errors.push({
            subscription: subName,
            territory,
            error: err.message
          });
        }
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Price updates ${isDryRun ? 'planned' : 'applied'}: ${results.updated.length}`);
  console.log(`Skipped: ${results.skipped.length}`);
  console.log(`Errors: ${results.errors.length}`);

  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.slice(0, 10).forEach(e => {
      console.log(`  ${e.subscription} / ${e.territory}: ${e.error}`);
    });
    if (results.errors.length > 10) {
      console.log(`  ... and ${results.errors.length - 10} more`);
    }
  }

  // Save results
  const outputPath = path.join(__dirname, 'pricing-update-results.json');
  fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to: ${outputPath}`);

  if (isDryRun) {
    console.log('\nDRY RUN complete. Run without --dry-run to apply changes.');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
