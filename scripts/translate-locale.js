#!/usr/bin/env node
/**
 * translate-locale.js
 *
 * Usage: node scripts/translate-locale.js <locale> <translated-keys-json-file>
 *
 * This script:
 * 1. Reads en.json and the target locale file
 * 2. Identifies missing keys in the target locale
 * 3. Deep-merges translated keys from the provided JSON file into the locale
 * 4. Writes the updated locale file
 *
 * OR: node scripts/translate-locale.js --extract <locale>
 * Extracts the missing English keys as a JSON object to stdout
 */

const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'locales');

function getLeafKeys(obj, prefix = '') {
  let keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys.push(...getLeafKeys(v, p));
    } else {
      keys.push(p);
    }
  }
  return keys;
}

function getValueByPath(obj, dotPath) {
  return dotPath.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj);
}

function setValueByPath(obj, dotPath, value) {
  const parts = dotPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
      current[parts[i]] = {};
    }
    current = current[parts[i]];
  }
  current[parts[parts.length - 1]] = value;
}

function deepMerge(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key], value);
    } else {
      // Only set if not already present (don't overwrite existing translations)
      if (target[key] === undefined) {
        target[key] = value;
      }
    }
  }
  return target;
}

const args = process.argv.slice(2);

if (args[0] === '--extract') {
  // Extract mode: output missing English keys as JSON
  const locale = args[1];
  if (!locale) {
    console.error('Usage: node scripts/translate-locale.js --extract <locale>');
    process.exit(1);
  }

  const en = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8'));
  const target = JSON.parse(fs.readFileSync(path.join(localesDir, `${locale}.json`), 'utf8'));

  const enKeys = getLeafKeys(en);
  const targetKeys = new Set(getLeafKeys(target));
  const missingKeys = enKeys.filter(k => !targetKeys.has(k));

  // Build a nested object of just the missing keys with English values
  const missingObj = {};
  for (const key of missingKeys) {
    setValueByPath(missingObj, key, getValueByPath(en, key));
  }

  console.log(JSON.stringify(missingObj, null, 2));
  process.exit(0);
}

// Merge mode
const locale = args[0];
const translatedFile = args[1];

if (!locale || !translatedFile) {
  console.error('Usage: node scripts/translate-locale.js <locale> <translated-keys-json-file>');
  console.error('       node scripts/translate-locale.js --extract <locale>');
  process.exit(1);
}

const targetPath = path.join(localesDir, `${locale}.json`);
const target = JSON.parse(fs.readFileSync(targetPath, 'utf8'));
const translated = JSON.parse(fs.readFileSync(translatedFile, 'utf8'));

deepMerge(target, translated);

fs.writeFileSync(targetPath, JSON.stringify(target, null, 2) + '\n', 'utf8');

const newKeys = getLeafKeys(target);
console.log(`✅ ${locale}.json updated: ${newKeys.length} total keys`);
