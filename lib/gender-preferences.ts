/**
 * Gender matching preferences.
 *
 * Users choose from 4 simple options (Men, Women, Non-binary, Everyone)
 * which map to the 3 gender identity values (Man, Woman, Non-binary).
 */

// Simplified UI options for matching preferences
export const GENDER_PREF_OPTIONS = ['Men', 'Women', 'Non-binary', 'Everyone'] as const;

// Which gender identities each simplified preference matches
const MEN_IDENTITIES = ['Man'];
const WOMEN_IDENTITIES = ['Woman'];
const NB_IDENTITIES = ['Non-binary'];

/**
 * Expand simplified UI preferences to canonical gender identity values for DB storage.
 * Idempotent: accepts both UI labels (Men/Women) and already-canonical values (Man/Woman),
 * so callers that pass through DB-loaded values don't accidentally wipe the array.
 *
 * - "Everyone" anywhere in the input → empty array (matching logic skips gender filter)
 * - "Men" → "Man", "Women" → "Woman" (UI → canonical)
 * - "Man" / "Woman" / "Non-binary" → preserved as-is (canonical pass-through)
 * - Empty input → empty output (caller's intent unchanged)
 *
 * The previous version dropped canonical values silently, which silently wiped
 * gender_preference whenever FilterModal output (canonical) flowed into a save
 * — that bug had cleared 1,338 users' preferences in production.
 */
export function expandGenderPreference(input: string[]): string[] {
  if (!input || input.length === 0) return [];
  if (input.includes('Everyone')) return [];
  const result = new Set<string>();
  for (const v of input) {
    if (v === 'Men') result.add('Man');
    else if (v === 'Women') result.add('Woman');
    else if (v) result.add(v); // canonical (Man/Woman/Non-binary) and any unknown values pass through
  }
  return Array.from(result);
}

/**
 * Collapse canonical DB gender_preference values back to simplified UI options.
 * Idempotent: accepts both canonical (Man/Woman) and UI labels (Men/Women) so
 * passing already-collapsed values through doesn't corrupt them.
 *
 * - Empty array → ["Everyone"]
 * - "Everyone" anywhere → ["Everyone"] (preserved)
 * - "Man" / "Men" → "Men", "Woman" / "Women" → "Women"
 * - "Non-binary" → "Non-binary"
 */
export function collapseGenderPreference(input: string[]): string[] {
  if (!input || input.length === 0) return ['Everyone'];
  if (input.includes('Everyone')) return ['Everyone'];
  const result = new Set<string>();
  for (const v of input) {
    if (v === 'Man' || v === 'Men') result.add('Men');
    else if (v === 'Woman' || v === 'Women') result.add('Women');
    else if (v === 'Non-binary') result.add('Non-binary');
    // Drop unknown legacy values (e.g. removed gender options)
  }
  if (result.size === 0) return ['Everyone'];
  return Array.from(result);
}
