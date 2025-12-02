const fs = require('fs');
const path = require('path');

// Read English as baseline
const en = JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/en.json'), 'utf8'));

// Function to get all keys from nested object
function getAllKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      keys = keys.concat(getAllKeys(obj[key], fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const enKeys = getAllKeys(en);
console.log('English has', enKeys.length, 'translation keys');
console.log('');

// Check each locale file
const locales = ['ar', 'hi', 'ur', 'fa', 'he', 'tr', 'bn', 'id', 'ru', 'zh', 'fr', 'de', 'pl', 'ka', 'es', 'it', 'pt', 'uk'];

const results = {};

for (const locale of locales) {
  try {
    const localeData = JSON.parse(fs.readFileSync(path.join(__dirname, `../locales/${locale}.json`), 'utf8'));
    const localeKeys = getAllKeys(localeData);

    const missingKeys = enKeys.filter(k => !localeKeys.includes(k));
    const extraKeys = localeKeys.filter(k => !enKeys.includes(k));

    results[locale] = { total: localeKeys.length, missing: missingKeys, extra: extraKeys };

    if (missingKeys.length > 0 || extraKeys.length > 0) {
      console.log(`${locale.toUpperCase()}: ${localeKeys.length} keys`);
      if (missingKeys.length > 0) {
        console.log(`  Missing ${missingKeys.length} keys:`);
        missingKeys.slice(0, 10).forEach(k => console.log(`    - ${k}`));
        if (missingKeys.length > 10) console.log(`    ... and ${missingKeys.length - 10} more`);
      }
      if (extraKeys.length > 0) {
        console.log(`  Extra ${extraKeys.length} keys:`);
        extraKeys.slice(0, 5).forEach(k => console.log(`    + ${k}`));
      }
      console.log('');
    } else {
      console.log(`${locale.toUpperCase()}: OK (${localeKeys.length} keys)`);
    }
  } catch (err) {
    console.log(`${locale.toUpperCase()}: Error - ${err.message}`);
    results[locale] = { error: err.message };
  }
}

// Summary
console.log('\n--- SUMMARY ---');
const incomplete = Object.entries(results).filter(([_, r]) => r.missing && r.missing.length > 0);
if (incomplete.length > 0) {
  console.log(`${incomplete.length} locales need updates:`);
  incomplete.forEach(([locale, r]) => console.log(`  - ${locale}: missing ${r.missing.length} keys`));
} else {
  console.log('All locales are complete!');
}
