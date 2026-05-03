#!/usr/bin/env node
/**
 * One-shot utility: insert a "Weekly Price" column into apple-regional-pricing.csv
 * positioned between "Apple Currency" and "Monthly Price".
 *
 * Anchor ratio: 5.99 / 14.99 (US weekly / US monthly) = 0.3996. Each country's
 * weekly target = (its localized monthly) * ratio, then snapped to a price
 * point that matches the country's typical pricing convention (decimal vs
 * whole-number currencies).
 *
 * Rerunnable: detects an existing "Weekly Price" header and rewrites it in
 * place. The Apple update script's findBestPricePoint will further snap each
 * target to the nearest Apple-supported tier when prices are pushed.
 */

const fs = require('fs');
const path = require('path');

const CSV_PATH = path.join(__dirname, 'apple-regional-pricing.csv');
const RATIO = 5.99 / 14.99;

// Currencies that Apple bills in whole-number units (no fractional digits).
const WHOLE_NUMBER_CURRENCIES = new Set([
  'JPY', 'KRW', 'IDR', 'VND', 'COP', 'CLP', 'HUF', 'TWD', 'KZT', 'NGN',
  'PKR', 'TZS', 'INR', 'PHP', 'EGP', 'ISK', 'CRC', 'PYG', 'IQD', 'UZS',
]);

// Decimal-currency price points (covers nearly every Apple subscription tier
// in the sub-$15 range). Targets are snapped to the closest entry.
const DECIMAL_PRICE_POINTS = [
  0.99, 1.49, 1.99, 2.49, 2.99, 3.49, 3.99, 4.49, 4.99, 5.49,
  5.99, 6.49, 6.99, 7.49, 7.99, 8.49, 8.99, 9.49, 9.99, 10.99,
  11.99, 12.99,
];

function snapDecimal(target) {
  if (target <= 0) return 0.99;
  let best = DECIMAL_PRICE_POINTS[0];
  let bestDiff = Math.abs(best - target);
  for (const p of DECIMAL_PRICE_POINTS) {
    const d = Math.abs(p - target);
    if (d < bestDiff) { best = p; bestDiff = d; }
  }
  return best;
}

function snapWhole(target) {
  if (target <= 0) return 1;
  // Pick the magnitude bucket so the result "looks like" a normal price for
  // currencies of this scale.
  if (target >= 5000) {
    // e.g. IDR/VND/COP — round to nearest 1000, end in -000
    return Math.round(target / 1000) * 1000;
  }
  if (target >= 500) {
    // e.g. JPY 800, KRW 7500, INR 159 → 999 ends, 99 ends
    return Math.round(target / 100) * 100 - 1; // ends in 99
  }
  if (target >= 50) {
    // e.g. INR 159 → 159
    return Math.round(target / 10) * 10 - 1; // ends in 9
  }
  return Math.max(1, Math.round(target));
}

function calculateWeekly(monthlyPrice, currency) {
  const target = monthlyPrice * RATIO;
  if (WHOLE_NUMBER_CURRENCIES.has(currency)) {
    return snapWhole(target);
  }
  return snapDecimal(target);
}

function formatPrice(value, currency) {
  if (WHOLE_NUMBER_CURRENCIES.has(currency)) {
    return String(Math.round(value));
  }
  return value.toFixed(2);
}

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
  return out;
}

function quoteIfNeeded(s) {
  return s.includes(',') ? `"${s}"` : s;
}

function main() {
  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = raw.split(/\r?\n/);
  const headerCols = parseCSVLine(lines[0]);

  const alreadyHasWeekly = headerCols.includes('Weekly Price');
  const monthlyIdx = headerCols.indexOf('Monthly Price');
  const currencyIdx = headerCols.indexOf('Apple Currency');
  if (monthlyIdx === -1 || currencyIdx === -1) {
    console.error('Could not find required columns in header:', headerCols);
    process.exit(1);
  }

  const newHeader = [...headerCols];
  if (!alreadyHasWeekly) {
    newHeader.splice(monthlyIdx, 0, 'Weekly Price');
  }

  const outLines = [newHeader.map(quoteIfNeeded).join(',')];

  let updated = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = parseCSVLine(line);
    if (cols.length < headerCols.length) {
      // Pad short rows so index math works.
      while (cols.length < headerCols.length) cols.push('');
    }

    const currency = cols[currencyIdx].trim();
    const monthly = parseFloat(cols[monthlyIdx]);
    if (isNaN(monthly) || monthly <= 0) {
      // Preserve untouched
      outLines.push(cols.map(quoteIfNeeded).join(','));
      continue;
    }

    const weekly = calculateWeekly(monthly, currency);
    const weeklyStr = formatPrice(weekly, currency);

    const newCols = [...cols];
    if (alreadyHasWeekly) {
      newCols[monthlyIdx] = weeklyStr; // when re-running, weekly sits where monthly used to be (no, actually keep at monthlyIdx position which is Weekly column now)
      // Re-running case: the existing CSV already has the Weekly column; just
      // overwrite it. Find the actual Weekly Price index.
      const weeklyIdx = headerCols.indexOf('Weekly Price');
      newCols[weeklyIdx] = weeklyStr;
    } else {
      newCols.splice(monthlyIdx, 0, weeklyStr);
    }
    outLines.push(newCols.map(quoteIfNeeded).join(','));
    updated++;
  }

  fs.writeFileSync(CSV_PATH, outLines.join('\n') + '\n');
  console.log(`Updated ${updated} rows. Header is now:`);
  console.log('  ' + newHeader.join(', '));
}

main();
