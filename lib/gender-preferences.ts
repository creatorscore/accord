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
 * Expand simplified preferences to full gender identity values for DB storage.
 * "Everyone" → empty array (no filter applied by matching logic).
 */
export function expandGenderPreference(simplified: string[]): string[] {
  if (simplified.includes('Everyone')) return [];
  const expanded: string[] = [];
  if (simplified.includes('Men')) expanded.push(...MEN_IDENTITIES);
  if (simplified.includes('Women')) expanded.push(...WOMEN_IDENTITIES);
  if (simplified.includes('Non-binary')) expanded.push(...NB_IDENTITIES);
  return expanded;
}

/**
 * Collapse DB gender_preference values back to simplified UI options.
 * Empty array → ["Everyone"].
 */
export function collapseGenderPreference(dbValues: string[]): string[] {
  if (!dbValues || dbValues.length === 0) return ['Everyone'];
  const result: string[] = [];
  if (dbValues.some(g => MEN_IDENTITIES.includes(g))) result.push('Men');
  if (dbValues.some(g => WOMEN_IDENTITIES.includes(g))) result.push('Women');
  if (dbValues.some(g => NB_IDENTITIES.includes(g))) result.push('Non-binary');
  // If someone had old values that don't map to any bucket, default to Everyone
  if (result.length === 0) return ['Everyone'];
  return result;
}
