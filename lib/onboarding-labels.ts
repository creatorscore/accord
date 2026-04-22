/**
 * Translation helper for onboarding option chips.
 *
 * Option arrays in `onboarding-config.ts` store the canonical value that
 * lands in Supabase (e.g. 'Man', 'platonic', 'Never'). We translate the
 * UI label at render time without touching those stored values — call
 * `tOptions(t, 'genders', GENDERS)` and pass the result to ChipSelect.
 *
 * i18n key convention: `onboarding.options.<namespace>.<slug>`. The slug
 * is derived from the value so the same helper works for plain string
 * arrays (GENDERS, RELIGIONS, etc.) and {value,label} arrays
 * (RELATIONSHIP_TYPES, FAMILY_PLANS, etc.) uniformly.
 */

import type { TFunction } from 'i18next';

export type RawOption = string | { readonly value: string; readonly label: string };

/**
 * Slugify a value or display string into a safe i18n key fragment.
 * Examples:
 *   'Man'                           → 'man'
 *   'she/her'                       → 'she_her'
 *   'Middle Eastern/North African'  → 'middle_eastern_north_african'
 *   "Don't Like Them"               → 'dont_like_them'
 *   'Spiritual but not religious'   → 'spiritual_but_not_religious'
 */
export function slugifyOption(input: string): string {
  return input
    .toLowerCase()
    .replace(/['']/g, '')     // drop apostrophes
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Resolve a single option's translated label. Falls back to the raw value
 * (or the explicit label on {value,label} objects) when the key isn't
 * present in the active locale — so non-translated locales degrade
 * gracefully to English instead of showing the raw key string.
 */
export function tOption(
  t: TFunction,
  namespace: string,
  opt: RawOption,
): { value: string; label: string } {
  const value = typeof opt === 'string' ? opt : opt.value;
  const fallbackLabel = typeof opt === 'string' ? opt : opt.label;
  // For object arrays the slug comes from the VALUE (stable), for plain
  // string arrays the slug comes from the string itself.
  const slug = slugifyOption(typeof opt === 'string' ? value : value);
  return {
    value,
    label: t(`onboarding.options.${namespace}.${slug}`, fallbackLabel),
  };
}

/**
 * Map an array of options to translated {value, label} pairs, ready to
 * pass to ChipSelect.
 */
export function tOptions(
  t: TFunction,
  namespace: string,
  options: readonly RawOption[],
): { value: string; label: string }[] {
  return options.map((opt) => tOption(t, namespace, opt));
}
