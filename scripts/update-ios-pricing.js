#!/usr/bin/env node

/**
 * App Store Connect API - Subscription Price Updater
 *
 * This script updates subscription prices for all territories based on
 * the regional pricing CSV to ensure fair worldwide pricing.
 *
 * Prerequisites:
 * 1. Create an API key in App Store Connect:
 *    - Go to Users and Access > Keys > App Store Connect API
 *    - Generate a new key with "Admin" or "App Manager" access
 *    - Download the .p8 file and note the Key ID and Issuer ID
 *
 * 2. Set environment variables:
 *    - APP_STORE_KEY_ID: Your API key ID
 *    - APP_STORE_ISSUER_ID: Your issuer ID
 *    - APP_STORE_PRIVATE_KEY: Contents of your .p8 file (or path to it)
 *
 * 3. Install dependencies: npm install jsonwebtoken node-fetch csv-parse
 *
 * Usage:
 *   node scripts/update-ios-pricing.js --dry-run    # Preview changes
 *   node scripts/update-ios-pricing.js              # Apply changes
 */

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

// Configuration
const CONFIG = {
  // App Store Connect API base URL
  apiBaseUrl: 'https://api.appstoreconnect.apple.com/v1',

  // Your subscription product IDs (update these with your actual IDs)
  subscriptions: {
    monthly: 'accord_premium_monthly',
    threeMonth: 'accord_premium_3month',
    annual: 'accord_premium_annual'
  },

  // Path to regional pricing CSV
  pricingCsvPath: path.join(__dirname, '..', 'complete-regional-pricing.csv'),

  // JWT token expiration (max 20 minutes for App Store Connect)
  tokenExpiration: 20 * 60 // 20 minutes in seconds
};

// Country name to App Store territory code mapping
// App Store uses ISO 3166-1 alpha-3 codes for territories
const COUNTRY_TO_TERRITORY = {
  'United States': 'USA',
  'Albania': 'ALB',
  'Algeria': 'DZA',
  'Angola': 'AGO',
  'Antigua & Barbuda': 'ATG',
  'Argentina': 'ARG',
  'Armenia': 'ARM',
  'Australia': 'AUS',
  'Austria': 'AUT',
  'Azerbaijan': 'AZE',
  'Bahamas': 'BHS',
  'Bahrain': 'BHR',
  'Bangladesh': 'BGD',
  'Belarus': 'BLR',
  'Belgium': 'BEL',
  'Belize': 'BLZ',
  'Benin': 'BEN',
  'Bermuda': 'BMU',
  'Bolivia': 'BOL',
  'Bosnia & Herzegovina': 'BIH',
  'Botswana': 'BWA',
  'Brazil': 'BRA',
  'British Virgin Islands': 'VGB',
  'Bulgaria': 'BGR',
  'Burkina Faso': 'BFA',
  'Cambodia': 'KHM',
  'Cameroon': 'CMR',
  'Canada': 'CAN',
  'Cape Verde': 'CPV',
  'Cayman Islands': 'CYM',
  'Chad': 'TCD',
  'Chile': 'CHL',
  'China': 'CHN',
  'Colombia': 'COL',
  'Costa Rica': 'CRI',
  "Côte d'Ivoire": 'CIV',
  'Croatia': 'HRV',
  'Cyprus': 'CYP',
  'Czech Republic': 'CZE',
  'Denmark': 'DNK',
  'Dominica': 'DMA',
  'Dominican Republic': 'DOM',
  'Ecuador': 'ECU',
  'Egypt': 'EGY',
  'El Salvador': 'SLV',
  'Estonia': 'EST',
  'Eswatini': 'SWZ',
  'Fiji': 'FJI',
  'Finland': 'FIN',
  'France': 'FRA',
  'Gabon': 'GAB',
  'Gambia': 'GMB',
  'Georgia': 'GEO',
  'Germany': 'DEU',
  'Ghana': 'GHA',
  'Greece': 'GRC',
  'Grenada': 'GRD',
  'Guatemala': 'GTM',
  'Guinea': 'GIN',
  'Honduras': 'HND',
  'Hong Kong': 'HKG',
  'Hungary': 'HUN',
  'Iceland': 'ISL',
  'India': 'IND',
  'Indonesia': 'IDN',
  'Iraq': 'IRQ',
  'Ireland': 'IRL',
  'Israel': 'ISR',
  'Italy': 'ITA',
  'Jamaica': 'JAM',
  'Japan': 'JPN',
  'Jordan': 'JOR',
  'Kazakhstan': 'KAZ',
  'Kenya': 'KEN',
  'Kuwait': 'KWT',
  'Kyrgyzstan': 'KGZ',
  'Laos': 'LAO',
  'Latvia': 'LVA',
  'Lebanon': 'LBN',
  'Liberia': 'LBR',
  'Libya': 'LBY',
  'Lithuania': 'LTU',
  'Luxembourg': 'LUX',
  'Madagascar': 'MDG',
  'Malawi': 'MWI',
  'Malaysia': 'MYS',
  'Maldives': 'MDV',
  'Mali': 'MLI',
  'Malta': 'MLT',
  'Mauritania': 'MRT',
  'Mauritius': 'MUS',
  'Mexico': 'MEX',
  'Moldova': 'MDA',
  'Mongolia': 'MNG',
  'Morocco': 'MAR',
  'Mozambique': 'MOZ',
  'Myanmar': 'MMR',
  'Namibia': 'NAM',
  'Nepal': 'NPL',
  'Netherlands': 'NLD',
  'New Zealand': 'NZL',
  'Nicaragua': 'NIC',
  'Niger': 'NER',
  'Nigeria': 'NGA',
  'North Macedonia': 'MKD',
  'Norway': 'NOR',
  'Oman': 'OMN',
  'Pakistan': 'PAK',
  'Panama': 'PAN',
  'Papua New Guinea': 'PNG',
  'Paraguay': 'PRY',
  'Peru': 'PER',
  'Philippines': 'PHL',
  'Poland': 'POL',
  'Portugal': 'PRT',
  'Qatar': 'QAT',
  'Romania': 'ROU',
  'Russia': 'RUS',
  'Rwanda': 'RWA',
  'Saudi Arabia': 'SAU',
  'Senegal': 'SEN',
  'Serbia': 'SRB',
  'Seychelles': 'SYC',
  'Sierra Leone': 'SLE',
  'Singapore': 'SGP',
  'Slovakia': 'SVK',
  'Slovenia': 'SVN',
  'Solomon Islands': 'SLB',
  'South Africa': 'ZAF',
  'South Korea': 'KOR',
  'Spain': 'ESP',
  'Sri Lanka': 'LKA',
  'St Kitts & Nevis': 'KNA',
  'St Lucia': 'LCA',
  'Suriname': 'SUR',
  'Sweden': 'SWE',
  'Switzerland': 'CHE',
  'Taiwan': 'TWN',
  'Tajikistan': 'TJK',
  'Tanzania': 'TZA',
  'Thailand': 'THA',
  'Tonga': 'TON',
  'Trinidad & Tobago': 'TTO',
  'Tunisia': 'TUN',
  'Turkey': 'TUR',
  'Turkmenistan': 'TKM',
  'Uganda': 'UGA',
  'Ukraine': 'UKR',
  'United Arab Emirates': 'ARE',
  'United Kingdom': 'GBR',
  'Uruguay': 'URY',
  'Uzbekistan': 'UZB',
  'Vanuatu': 'VUT',
  'Venezuela': 'VEN',
  'Vietnam': 'VNM',
  'Yemen': 'YEM',
  'Zambia': 'ZMB',
  'Zimbabwe': 'ZWE',
  'Macao': 'MAC',
  'Micronesia': 'FSM',
  'Monaco': 'MCO',
  'Liechtenstein': 'LIE',
  'Gibraltar': 'GIB',
  'San Marino': 'SMR',
  'Vatican City': 'VAT',
  'Turks and Caicos Islands': 'TCA',
  'Aruba': 'ABW',
  // Additional mappings for countries in starting price CSV
  'Afghanistan': 'AFG',
  'Anguilla': 'AIA',
  'Barbados': 'BRB',
  'Bhutan': 'BTN',
  'Brunei': 'BRN',
  'Congo, Democratic Republic of the': 'COD',
  'Congo, Republic of the': 'COG',
  'Guyana': 'GUY',
  'Kosovo': 'XKX',
  'Macau': 'MAC',
  'Montserrat': 'MSR',
  'Nauru': 'NRU',
  'Palau': 'PLW',
  'São Tomé and Príncipe': 'STP',
  'St. Kitts and Nevis': 'KNA',
  'St. Lucia': 'LCA',
  'St. Vincent and the Grenadines': 'VCT',
  'Türkiye': 'TUR',
  'Korea, Republic of': 'KOR',
  'China mainland': 'CHN'
};

// Currency code mapping (App Store uses specific currency codes)
const CURRENCY_MAPPING = {
  'USD': 'USD',
  'EUR': 'EUR',
  'GBP': 'GBP',
  'AUD': 'AUD',
  'CAD': 'CAD',
  'JPY': 'JPY',
  'CNY': 'CNY',
  'INR': 'INR',
  'BRL': 'BRL',
  'MXN': 'MXN',
  'KRW': 'KRW',
  'SGD': 'SGD',
  'HKD': 'HKD',
  'TWD': 'TWD',
  'NZD': 'NZD',
  'CHF': 'CHF',
  'SEK': 'SEK',
  'NOK': 'NOK',
  'DKK': 'DKK',
  'PLN': 'PLN',
  'CZK': 'CZK',
  'HUF': 'HUF',
  'ILS': 'ILS',
  'ZAR': 'ZAR',
  'RUB': 'RUB',
  'TRY': 'TRY',
  'SAR': 'SAR',
  'AED': 'AED',
  'THB': 'THB',
  'MYR': 'MYR',
  'PHP': 'PHP',
  'IDR': 'IDR',
  'VND': 'VND',
  'EGP': 'EGP',
  'NGN': 'NGN',
  'PKR': 'PKR',
  'CLP': 'CLP',
  'COP': 'COP',
  'PEN': 'PEN',
  'ARS': 'ARS',
  'RON': 'RON',
  'BGN': 'BGN',
  'QAR': 'QAR',
  'KZT': 'KZT',
  'TZS': 'TZS'
};

/**
 * Generate JWT token for App Store Connect API authentication
 */
function generateToken(keyId, issuerId, privateKey) {
  const now = Math.floor(Date.now() / 1000);

  const payload = {
    iss: issuerId,
    iat: now,
    exp: now + CONFIG.tokenExpiration,
    aud: 'appstoreconnect-v1'
  };

  const header = {
    alg: 'ES256',
    kid: keyId,
    typ: 'JWT'
  };

  return jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    header
  });
}

/**
 * Parse the regional pricing CSV file
 */
function parsePricingCsv(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',');

  const pricing = {};

  for (let i = 1; i < lines.length; i++) {
    // Handle CSV with quoted fields containing commas
    const values = parseCSVLine(lines[i]);
    if (values.length < 5) continue;

    const country = values[0].trim();
    const currencyCode = values[1].trim();
    const monthlyPrice = parseFloat(values[2]) || 0;
    const threeMonthPrice = parseFloat(values[3]) || 0;
    const annualPrice = parseFloat(values[4]) || 0;

    const territoryCode = COUNTRY_TO_TERRITORY[country];
    if (!territoryCode) {
      console.warn(`Warning: No territory code mapping for "${country}"`);
      continue;
    }

    pricing[territoryCode] = {
      country,
      currency: currencyCode,
      monthly: monthlyPrice,
      threeMonth: threeMonthPrice,
      annual: annualPrice
    };
  }

  return pricing;
}

/**
 * Parse a single CSV line handling quoted fields
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Make authenticated request to App Store Connect API
 */
async function apiRequest(token, endpoint, method = 'GET', body = null) {
  const fetch = (await import('node-fetch')).default;

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

  const response = await fetch(`${CONFIG.apiBaseUrl}${endpoint}`, options);

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API request failed: ${response.status} ${response.statusText}\n${errorText}`);
  }

  // Handle 204 No Content responses
  if (response.status === 204) {
    return null;
  }

  return response.json();
}

/**
 * Get all subscriptions for the app
 */
async function getSubscriptions(token, appId) {
  const response = await apiRequest(
    token,
    `/apps/${appId}/subscriptionGroups?include=subscriptions`
  );

  return response;
}

/**
 * Get subscription price points for a territory
 */
async function getSubscriptionPricePoints(token, subscriptionId, territory) {
  const response = await apiRequest(
    token,
    `/subscriptions/${subscriptionId}/pricePoints?filter[territory]=${territory}&include=territory`
  );

  return response;
}

/**
 * Get current prices for a subscription
 */
async function getCurrentPrices(token, subscriptionId) {
  const response = await apiRequest(
    token,
    `/subscriptions/${subscriptionId}/prices?include=subscriptionPricePoint`
  );

  return response;
}

/**
 * Find the closest price point for a target price
 * App Store has predefined price tiers, so we need to find the closest one
 */
function findClosestPricePoint(pricePoints, targetPrice, currency) {
  // Filter price points by currency
  const matchingPoints = pricePoints.filter(point =>
    point.attributes.customerPrice.includes(currency)
  );

  if (matchingPoints.length === 0) {
    console.warn(`No price points found for currency ${currency}`);
    return null;
  }

  // Find closest price
  let closest = matchingPoints[0];
  let minDiff = Math.abs(parseFloat(closest.attributes.customerPrice) - targetPrice);

  for (const point of matchingPoints) {
    const price = parseFloat(point.attributes.customerPrice);
    const diff = Math.abs(price - targetPrice);
    if (diff < minDiff) {
      minDiff = diff;
      closest = point;
    }
  }

  return closest;
}

/**
 * Update subscription price for a territory
 */
async function updateSubscriptionPrice(token, subscriptionId, pricePointId, startDate = null) {
  const body = {
    data: {
      type: 'subscriptionPrices',
      attributes: {
        startDate: startDate || new Date().toISOString().split('T')[0] // Today
      },
      relationships: {
        subscription: {
          data: {
            type: 'subscriptions',
            id: subscriptionId
          }
        },
        subscriptionPricePoint: {
          data: {
            type: 'subscriptionPricePoints',
            id: pricePointId
          }
        }
      }
    }
  };

  return apiRequest(token, '/subscriptionPrices', 'POST', body);
}

/**
 * Main function to update all subscription prices
 */
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const showHelp = args.includes('--help') || args.includes('-h');

  if (showHelp) {
    console.log(`
App Store Connect Subscription Price Updater

Usage:
  node update-ios-pricing.js [options]

Options:
  --dry-run    Preview changes without applying them
  --help, -h   Show this help message

Environment Variables (required):
  APP_STORE_KEY_ID       Your API key ID from App Store Connect
  APP_STORE_ISSUER_ID    Your issuer ID from App Store Connect
  APP_STORE_PRIVATE_KEY  Your .p8 private key contents (or path to file)
  APP_STORE_APP_ID       Your app's ID in App Store Connect

Example:
  APP_STORE_KEY_ID=ABC123 \\
  APP_STORE_ISSUER_ID=DEF456 \\
  APP_STORE_PRIVATE_KEY="$(cat path/to/key.p8)" \\
  APP_STORE_APP_ID=1234567890 \\
  node update-ios-pricing.js --dry-run
`);
    process.exit(0);
  }

  console.log('='.repeat(60));
  console.log('App Store Connect Subscription Price Updater');
  console.log('='.repeat(60));
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be applied)'}`);
  console.log('');

  // Load environment variables
  const keyId = process.env.APP_STORE_KEY_ID;
  const issuerId = process.env.APP_STORE_ISSUER_ID;
  let privateKey = process.env.APP_STORE_PRIVATE_KEY;
  const appId = process.env.APP_STORE_APP_ID;

  // Check required environment variables
  const missing = [];
  if (!keyId) missing.push('APP_STORE_KEY_ID');
  if (!issuerId) missing.push('APP_STORE_ISSUER_ID');
  if (!privateKey) missing.push('APP_STORE_PRIVATE_KEY');
  if (!appId) missing.push('APP_STORE_APP_ID');

  if (missing.length > 0) {
    console.error('Error: Missing required environment variables:');
    missing.forEach(v => console.error(`  - ${v}`));
    console.error('\nRun with --help for usage information.');
    process.exit(1);
  }

  // If private key is a file path, read it
  // Check if it looks like a file path (not starting with -----BEGIN)
  if (!privateKey.startsWith('-----BEGIN') && (privateKey.endsWith('.p8') || privateKey.includes('/'))) {
    try {
      privateKey = fs.readFileSync(privateKey, 'utf-8');
    } catch (err) {
      console.error(`Error reading private key file: ${err.message}`);
      process.exit(1);
    }
  }

  // Load pricing data
  console.log('Loading regional pricing data...');
  const pricingPath = CONFIG.pricingCsvPath;

  if (!fs.existsSync(pricingPath)) {
    console.error(`Error: Pricing CSV not found at ${pricingPath}`);
    process.exit(1);
  }

  const regionalPricing = parsePricingCsv(pricingPath);
  console.log(`Loaded pricing for ${Object.keys(regionalPricing).length} territories`);
  console.log('');

  // Generate API token
  console.log('Generating API token...');
  const token = generateToken(keyId, issuerId, privateKey);
  console.log('Token generated successfully');
  console.log('');

  // Get subscriptions
  console.log('Fetching subscription information...');

  try {
    const subscriptionGroups = await getSubscriptions(token, appId);

    if (!subscriptionGroups || !subscriptionGroups.data || subscriptionGroups.data.length === 0) {
      console.error('No subscription groups found for this app.');
      console.log('Make sure you have set up subscriptions in App Store Connect.');
      process.exit(1);
    }

    console.log(`Found ${subscriptionGroups.data.length} subscription group(s)`);

    // Process each subscription
    const subscriptions = subscriptionGroups.included?.filter(item => item.type === 'subscriptions') || [];
    console.log(`Found ${subscriptions.length} subscription(s)`);
    console.log('');

    // Track changes
    const changes = [];
    const errors = [];

    for (const subscription of subscriptions) {
      const subId = subscription.id;
      const subName = subscription.attributes?.name || subId;

      console.log(`Processing subscription: ${subName}`);
      console.log('-'.repeat(40));

      // Determine which price column to use based on subscription name/duration
      let priceKey = 'monthly';
      if (subName.toLowerCase().includes('3') || subName.toLowerCase().includes('three') || subName.toLowerCase().includes('quarter')) {
        priceKey = 'threeMonth';
      } else if (subName.toLowerCase().includes('annual') || subName.toLowerCase().includes('year')) {
        priceKey = 'annual';
      }

      // Get current prices
      const currentPrices = await getCurrentPrices(token, subId);
      const currentPriceMap = {};

      if (currentPrices?.data) {
        for (const price of currentPrices.data) {
          const territory = price.relationships?.territory?.data?.id;
          if (territory) {
            currentPriceMap[territory] = price;
          }
        }
      }

      // Update prices for each territory
      for (const [territory, pricing] of Object.entries(regionalPricing)) {
        const targetPrice = pricing[priceKey];

        if (!targetPrice || targetPrice <= 0) {
          console.log(`  ${territory}: Skipping (no valid price)`);
          continue;
        }

        try {
          // Get available price points for this territory
          const pricePoints = await getSubscriptionPricePoints(token, subId, territory);

          if (!pricePoints?.data || pricePoints.data.length === 0) {
            console.log(`  ${territory}: No price points available`);
            continue;
          }

          // Find closest price point
          const closestPoint = findClosestPricePoint(
            pricePoints.data,
            targetPrice,
            pricing.currency
          );

          if (!closestPoint) {
            console.log(`  ${territory}: Could not find suitable price point`);
            continue;
          }

          const actualPrice = parseFloat(closestPoint.attributes.customerPrice);
          const priceDiff = Math.abs(actualPrice - targetPrice);
          const percentDiff = ((priceDiff / targetPrice) * 100).toFixed(1);

          const change = {
            territory,
            country: pricing.country,
            currency: pricing.currency,
            targetPrice,
            actualPrice,
            percentDiff,
            pricePointId: closestPoint.id,
            subscriptionId: subId,
            subscriptionName: subName
          };

          changes.push(change);

          console.log(`  ${territory} (${pricing.country}): ${pricing.currency} ${targetPrice} → ${actualPrice} (${percentDiff}% diff)`);

          // Apply change if not dry run
          if (!isDryRun) {
            try {
              await updateSubscriptionPrice(token, subId, closestPoint.id);
              change.applied = true;
            } catch (err) {
              change.error = err.message;
              errors.push({ territory, error: err.message });
            }
          }

          // Rate limiting - App Store Connect has rate limits
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (err) {
          console.log(`  ${territory}: Error - ${err.message}`);
          errors.push({ territory, error: err.message });
        }
      }

      console.log('');
    }

    // Summary
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total price changes: ${changes.length}`);

    if (isDryRun) {
      console.log('\nDRY RUN - No changes were applied.');
      console.log('Run without --dry-run to apply these changes.');
    } else {
      const applied = changes.filter(c => c.applied).length;
      const failed = changes.filter(c => c.error).length;
      console.log(`Successfully applied: ${applied}`);
      console.log(`Failed: ${failed}`);
    }

    if (errors.length > 0) {
      console.log('\nErrors encountered:');
      errors.forEach(({ territory, error }) => {
        console.log(`  ${territory}: ${error}`);
      });
    }

    // Export changes to JSON for reference
    const outputPath = path.join(__dirname, 'price-changes.json');
    fs.writeFileSync(outputPath, JSON.stringify({
      timestamp: new Date().toISOString(),
      isDryRun,
      changes,
      errors
    }, null, 2));
    console.log(`\nDetailed changes saved to: ${outputPath}`);

  } catch (err) {
    console.error('Error:', err.message);
    if (err.stack) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

// Run
main().catch(console.error);
