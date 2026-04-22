#!/usr/bin/env node
/**
 * Phase 3 of i18n backfill: merges onboarding.options translations for 13 locales
 * that didn't have them yet (de, es, fr, he, id, it, ka, pl, pt, ru, tr, uk, zh).
 *
 * Reads per-locale data from scripts/phase3-data/<locale>.json (one file per
 * locale, containing JUST the 19 namespaces — no "onboarding" / "options"
 * wrapper). Merges into json.onboarding.options in each locale file.
 *
 * Leaves ar/bn/en/fa/hi/ur untouched — they were seeded earlier.
 *
 * Run: node scripts/seed-phase3-options.js
 */

const fs = require('fs');
const path = require('path');

const LOCALES = ['de', 'es', 'fr', 'he', 'id', 'it', 'ka', 'pl', 'pt', 'ru', 'tr', 'uk', 'zh'];

const localesDir = path.join(__dirname, '..', 'locales');
const dataDir = path.join(__dirname, 'phase3-data');

const enOptions = JSON.parse(fs.readFileSync(path.join(localesDir, 'en.json'), 'utf8')).onboarding.options;
const expectedNs = Object.keys(enOptions);

let totalKeys = 0;

for (const locale of LOCALES) {
  const dataPath = path.join(dataDir, `${locale}.json`);
  const localePath = path.join(localesDir, `${locale}.json`);

  if (!fs.existsSync(dataPath)) {
    console.warn(`  skip ${locale} (no data file at ${dataPath})`);
    continue;
  }
  if (!fs.existsSync(localePath)) {
    console.warn(`  skip ${locale} (no locale file at ${localePath})`);
    continue;
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  const json = JSON.parse(fs.readFileSync(localePath, 'utf8'));

  // Sanity check — every namespace present
  const missing = expectedNs.filter((ns) => !data[ns]);
  if (missing.length) {
    console.warn(`  skip ${locale} (missing namespaces: ${missing.join(', ')})`);
    continue;
  }

  json.onboarding = json.onboarding || {};
  json.onboarding.options = data;

  fs.writeFileSync(localePath, JSON.stringify(json, null, 2) + '\n');

  const keyCount = Object.values(data).reduce((sum, ns) => sum + Object.keys(ns).length, 0);
  totalKeys += keyCount;
  console.log(`  ${locale}.json: +${keyCount} option translations`);
}

console.log(`\nDone. ${totalKeys} total translations across ${LOCALES.length} locales.`);
