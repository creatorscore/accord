#!/usr/bin/env node

/**
 * Generate App Store Connect Price Schedule CSV
 *
 * This script generates a CSV file that can be uploaded directly to
 * App Store Connect to update subscription prices for all territories.
 *
 * The CSV format matches App Store Connect's bulk price upload format.
 *
 * Usage:
 *   node scripts/generate-asc-price-csv.js
 *
 * Output:
 *   - scripts/asc-monthly-prices.csv
 *   - scripts/asc-3month-prices.csv
 *   - scripts/asc-annual-prices.csv
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  pricingCsvPath: path.join(__dirname, '..', 'complete-regional-pricing.csv'),
  outputDir: __dirname
};

// Country name to App Store territory code mapping (ISO 3166-1 alpha-2)
// App Store Connect uses alpha-2 codes in their CSV exports
const COUNTRY_TO_TERRITORY_ALPHA2 = {
  'United States': 'US',
  'Albania': 'AL',
  'Algeria': 'DZ',
  'Angola': 'AO',
  'Antigua & Barbuda': 'AG',
  'Argentina': 'AR',
  'Armenia': 'AM',
  'Australia': 'AU',
  'Austria': 'AT',
  'Azerbaijan': 'AZ',
  'Bahamas': 'BS',
  'Bahrain': 'BH',
  'Bangladesh': 'BD',
  'Belarus': 'BY',
  'Belgium': 'BE',
  'Belize': 'BZ',
  'Benin': 'BJ',
  'Bermuda': 'BM',
  'Bolivia': 'BO',
  'Bosnia & Herzegovina': 'BA',
  'Botswana': 'BW',
  'Brazil': 'BR',
  'British Virgin Islands': 'VG',
  'Bulgaria': 'BG',
  'Burkina Faso': 'BF',
  'Cambodia': 'KH',
  'Cameroon': 'CM',
  'Canada': 'CA',
  'Cape Verde': 'CV',
  'Cayman Islands': 'KY',
  'Chad': 'TD',
  'Chile': 'CL',
  'China': 'CN',
  'Colombia': 'CO',
  'Costa Rica': 'CR',
  "Côte d'Ivoire": 'CI',
  'Croatia': 'HR',
  'Cyprus': 'CY',
  'Czech Republic': 'CZ',
  'Denmark': 'DK',
  'Dominica': 'DM',
  'Dominican Republic': 'DO',
  'Ecuador': 'EC',
  'Egypt': 'EG',
  'El Salvador': 'SV',
  'Estonia': 'EE',
  'Eswatini': 'SZ',
  'Fiji': 'FJ',
  'Finland': 'FI',
  'France': 'FR',
  'Gabon': 'GA',
  'Gambia': 'GM',
  'Georgia': 'GE',
  'Germany': 'DE',
  'Ghana': 'GH',
  'Greece': 'GR',
  'Grenada': 'GD',
  'Guatemala': 'GT',
  'Guinea': 'GN',
  'Honduras': 'HN',
  'Hong Kong': 'HK',
  'Hungary': 'HU',
  'Iceland': 'IS',
  'India': 'IN',
  'Indonesia': 'ID',
  'Iraq': 'IQ',
  'Ireland': 'IE',
  'Israel': 'IL',
  'Italy': 'IT',
  'Jamaica': 'JM',
  'Japan': 'JP',
  'Jordan': 'JO',
  'Kazakhstan': 'KZ',
  'Kenya': 'KE',
  'Kuwait': 'KW',
  'Kyrgyzstan': 'KG',
  'Laos': 'LA',
  'Latvia': 'LV',
  'Lebanon': 'LB',
  'Liberia': 'LR',
  'Libya': 'LY',
  'Lithuania': 'LT',
  'Luxembourg': 'LU',
  'Madagascar': 'MG',
  'Malawi': 'MW',
  'Malaysia': 'MY',
  'Maldives': 'MV',
  'Mali': 'ML',
  'Malta': 'MT',
  'Mauritania': 'MR',
  'Mauritius': 'MU',
  'Mexico': 'MX',
  'Moldova': 'MD',
  'Mongolia': 'MN',
  'Morocco': 'MA',
  'Mozambique': 'MZ',
  'Myanmar': 'MM',
  'Namibia': 'NA',
  'Nepal': 'NP',
  'Netherlands': 'NL',
  'New Zealand': 'NZ',
  'Nicaragua': 'NI',
  'Niger': 'NE',
  'Nigeria': 'NG',
  'North Macedonia': 'MK',
  'Norway': 'NO',
  'Oman': 'OM',
  'Pakistan': 'PK',
  'Panama': 'PA',
  'Papua New Guinea': 'PG',
  'Paraguay': 'PY',
  'Peru': 'PE',
  'Philippines': 'PH',
  'Poland': 'PL',
  'Portugal': 'PT',
  'Qatar': 'QA',
  'Romania': 'RO',
  'Russia': 'RU',
  'Rwanda': 'RW',
  'Saudi Arabia': 'SA',
  'Senegal': 'SN',
  'Serbia': 'RS',
  'Seychelles': 'SC',
  'Sierra Leone': 'SL',
  'Singapore': 'SG',
  'Slovakia': 'SK',
  'Slovenia': 'SI',
  'Solomon Islands': 'SB',
  'South Africa': 'ZA',
  'South Korea': 'KR',
  'Spain': 'ES',
  'Sri Lanka': 'LK',
  'St Kitts & Nevis': 'KN',
  'St Lucia': 'LC',
  'Suriname': 'SR',
  'Sweden': 'SE',
  'Switzerland': 'CH',
  'Taiwan': 'TW',
  'Tajikistan': 'TJ',
  'Tanzania': 'TZ',
  'Thailand': 'TH',
  'Tonga': 'TO',
  'Trinidad & Tobago': 'TT',
  'Tunisia': 'TN',
  'Turkey': 'TR',
  'Turkmenistan': 'TM',
  'Uganda': 'UG',
  'Ukraine': 'UA',
  'United Arab Emirates': 'AE',
  'United Kingdom': 'GB',
  'Uruguay': 'UY',
  'Uzbekistan': 'UZ',
  'Vanuatu': 'VU',
  'Venezuela': 'VE',
  'Vietnam': 'VN',
  'Yemen': 'YE',
  'Zambia': 'ZM',
  'Zimbabwe': 'ZW',
  'Macao': 'MO',
  'Micronesia': 'FM',
  'Monaco': 'MC',
  'Liechtenstein': 'LI',
  'Gibraltar': 'GI',
  'San Marino': 'SM',
  'Vatican City': 'VA',
  'Turks and Caicos Islands': 'TC',
  'Aruba': 'AW',
  // Additional
  'Afghanistan': 'AF',
  'Anguilla': 'AI',
  'Barbados': 'BB',
  'Bhutan': 'BT',
  'Brunei': 'BN',
  'Guinea-Bissau': 'GW',
  'Guyana': 'GY',
  'Kosovo': 'XK',
  'Montserrat': 'MS',
  'Nauru': 'NR',
  'Palau': 'PW',
  'São Tomé and Príncipe': 'ST',
  'Congo - Kinshasa': 'CD',
  'Congo - Brazzaville': 'CG'
};

// Apple's available price tiers (USD equivalents for subscription pricing)
// These are the prices customers see (including tax in some regions)
const APPLE_PRICE_TIERS_USD = [
  0.29, 0.49, 0.99, 1.49, 1.99, 2.49, 2.99, 3.49, 3.99, 4.49, 4.99,
  5.49, 5.99, 6.49, 6.99, 7.49, 7.99, 8.49, 8.99, 9.49, 9.99,
  10.99, 11.99, 12.99, 13.99, 14.99, 15.99, 16.99, 17.99, 18.99, 19.99,
  20.99, 21.99, 22.99, 23.99, 24.99, 25.99, 26.99, 27.99, 28.99, 29.99,
  30.99, 31.99, 32.99, 33.99, 34.99, 35.99, 36.99, 37.99, 38.99, 39.99,
  44.99, 49.99, 54.99, 59.99, 64.99, 69.99, 74.99, 79.99, 84.99, 89.99,
  94.99, 99.99, 109.99, 119.99, 129.99, 139.99, 149.99, 159.99, 169.99,
  179.99, 189.99, 199.99
];

/**
 * Find closest Apple price tier for a given USD equivalent price
 */
function findClosestPriceTier(targetUsdEquivalent) {
  let closest = APPLE_PRICE_TIERS_USD[0];
  let minDiff = Math.abs(closest - targetUsdEquivalent);

  for (const tier of APPLE_PRICE_TIERS_USD) {
    const diff = Math.abs(tier - targetUsdEquivalent);
    if (diff < minDiff) {
      minDiff = diff;
      closest = tier;
    }
  }

  return closest;
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
 * Parse regional pricing CSV
 */
function parsePricingCsv(csvPath) {
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());

  const pricing = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length < 7) continue;

    const country = values[0].trim();
    const currencyCode = values[1].trim();
    const monthlyPrice = parseFloat(values[2]) || 0;
    const threeMonthPrice = parseFloat(values[3]) || 0;
    const annualPrice = parseFloat(values[4]) || 0;
    const monthlyUsdEquiv = parseFloat(values[5]) || 0;
    const threeMonthMonthlyEquiv = parseFloat(values[6]) || 0;
    const annualMonthlyEquiv = parseFloat(values[7]) || 0;

    const territoryCode = COUNTRY_TO_TERRITORY_ALPHA2[country];

    pricing.push({
      country,
      territoryCode,
      currency: currencyCode,
      monthly: {
        localPrice: monthlyPrice,
        usdEquiv: monthlyUsdEquiv
      },
      threeMonth: {
        localPrice: threeMonthPrice,
        usdEquiv: threeMonthMonthlyEquiv * 3 // Convert monthly equiv to 3-month price
      },
      annual: {
        localPrice: annualPrice,
        usdEquiv: annualMonthlyEquiv * 12 // Convert monthly equiv to annual price
      }
    });
  }

  return pricing;
}

/**
 * Generate price schedule summary
 */
function generatePriceSummary(pricing) {
  console.log('\nPricing Summary by Income Tier:');
  console.log('='.repeat(60));

  const byUsdRange = {
    'Very Low ($2-3/mo)': [],
    'Low ($4-5/mo)': [],
    'Lower-Middle ($5-7/mo)': [],
    'Upper-Middle ($7-10/mo)': [],
    'High ($10-17/mo)': []
  };

  for (const p of pricing) {
    const usd = p.monthly.usdEquiv;
    if (usd <= 3.5) {
      byUsdRange['Very Low ($2-3/mo)'].push(p.country);
    } else if (usd <= 5.5) {
      byUsdRange['Low ($4-5/mo)'].push(p.country);
    } else if (usd <= 7.5) {
      byUsdRange['Lower-Middle ($5-7/mo)'].push(p.country);
    } else if (usd <= 10.5) {
      byUsdRange['Upper-Middle ($7-10/mo)'].push(p.country);
    } else {
      byUsdRange['High ($10-17/mo)'].push(p.country);
    }
  }

  for (const [tier, countries] of Object.entries(byUsdRange)) {
    console.log(`\n${tier}: ${countries.length} countries`);
    console.log(`  ${countries.slice(0, 5).join(', ')}${countries.length > 5 ? '...' : ''}`);
  }
}

/**
 * Main function
 */
function main() {
  console.log('='.repeat(60));
  console.log('App Store Connect Price Schedule Generator');
  console.log('='.repeat(60));

  // Load pricing data
  console.log('\nLoading regional pricing data...');

  if (!fs.existsSync(CONFIG.pricingCsvPath)) {
    console.error(`Error: Pricing CSV not found at ${CONFIG.pricingCsvPath}`);
    process.exit(1);
  }

  const pricing = parsePricingCsv(CONFIG.pricingCsvPath);
  console.log(`Loaded pricing for ${pricing.length} countries`);

  // Generate summary
  generatePriceSummary(pricing);

  // Generate CSV for each subscription type
  const subscriptionTypes = [
    { key: 'monthly', name: 'Monthly', filename: 'asc-monthly-prices.csv' },
    { key: 'threeMonth', name: '3-Month', filename: 'asc-3month-prices.csv' },
    { key: 'annual', name: 'Annual', filename: 'asc-annual-prices.csv' }
  ];

  for (const subType of subscriptionTypes) {
    console.log(`\nGenerating ${subType.name} price schedule...`);

    // CSV format for App Store Connect
    const rows = [
      ['Countries or Regions', 'Currency Code', 'Price', 'Apple Price Tier (USD)', 'Original USD Equiv', 'Diff %']
    ];

    let unmappedCount = 0;

    for (const p of pricing) {
      if (!p.territoryCode) {
        unmappedCount++;
        continue;
      }

      const priceData = p[subType.key];
      const appleTier = findClosestPriceTier(priceData.usdEquiv);
      const diffPercent = ((appleTier - priceData.usdEquiv) / priceData.usdEquiv * 100).toFixed(1);

      rows.push([
        p.country,
        p.currency,
        priceData.localPrice.toFixed(2),
        appleTier.toFixed(2),
        priceData.usdEquiv.toFixed(2),
        `${diffPercent}%`
      ]);
    }

    // Write CSV
    const csvContent = rows.map(row => row.join(',')).join('\n');
    const outputPath = path.join(CONFIG.outputDir, subType.filename);
    fs.writeFileSync(outputPath, csvContent);

    console.log(`  Saved to: ${outputPath}`);
    console.log(`  Countries: ${rows.length - 1}`);
    if (unmappedCount > 0) {
      console.log(`  Skipped (no territory code): ${unmappedCount}`);
    }
  }

  // Generate a combined reference sheet
  console.log('\nGenerating combined reference sheet...');

  const refRows = [
    ['Country', 'Territory', 'Currency', 'Monthly Local', 'Monthly USD', 'Apple Tier', '3-Mo Local', '3-Mo USD', 'Apple Tier', 'Annual Local', 'Annual USD', 'Apple Tier']
  ];

  for (const p of pricing) {
    if (!p.territoryCode) continue;

    const monthlyTier = findClosestPriceTier(p.monthly.usdEquiv);
    const threeMonthTier = findClosestPriceTier(p.threeMonth.usdEquiv);
    const annualTier = findClosestPriceTier(p.annual.usdEquiv);

    refRows.push([
      p.country,
      p.territoryCode,
      p.currency,
      p.monthly.localPrice.toFixed(2),
      p.monthly.usdEquiv.toFixed(2),
      monthlyTier.toFixed(2),
      p.threeMonth.localPrice.toFixed(2),
      p.threeMonth.usdEquiv.toFixed(2),
      threeMonthTier.toFixed(2),
      p.annual.localPrice.toFixed(2),
      p.annual.usdEquiv.toFixed(2),
      annualTier.toFixed(2)
    ]);
  }

  const refCsvContent = refRows.map(row => row.join(',')).join('\n');
  const refOutputPath = path.join(CONFIG.outputDir, 'asc-all-prices-reference.csv');
  fs.writeFileSync(refOutputPath, refCsvContent);
  console.log(`  Saved to: ${refOutputPath}`);

  console.log('\n' + '='.repeat(60));
  console.log('DONE');
  console.log('='.repeat(60));
  console.log(`
Next Steps:
1. Review the generated CSV files in: ${CONFIG.outputDir}
2. In App Store Connect:
   - Go to your app > Subscriptions
   - Select a subscription product
   - Click "Subscription Prices"
   - Use "Set Prices for Other Storefronts" to set regional prices

Note: App Store Connect's web UI allows setting prices per territory.
The Apple Price Tier column shows the closest available tier for each
target price. Some prices may differ from your target due to Apple's
predefined price tiers.

For bulk updates, you can also use the App Store Connect API with
the update-ios-pricing.js script.
`);
}

main();
