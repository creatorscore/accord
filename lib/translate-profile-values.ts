import { TFunction } from 'i18next';

/**
 * Maps DB column names to profileValues translation section names.
 * Only fields with enumerated/known values are included.
 * Free-text fields (occupation, education, hometown, personality_type) are excluded.
 */
const FIELD_TO_SECTION: Record<string, string> = {
  gender: 'gender',
  sexual_orientation: 'orientation',
  pronouns: 'pronouns',
  ethnicity: 'ethnicity',
  love_language: 'loveLanguage',
  religion: 'religion',
  political_views: 'politics',
  zodiac_sign: 'zodiac',
  languages_spoken: 'language',
};

/**
 * Translates a single DB-stored profile value to the current locale.
 * Falls back to the raw value if no translation key exists.
 */
export function translateProfileValue(
  t: TFunction,
  field: string,
  value: string
): string {
  const section = FIELD_TO_SECTION[field];
  if (!section) return value;
  return t(`profileValues.${section}.${value}`, { defaultValue: value });
}

/**
 * Translates a profile field that may be a string or string array.
 * Returns a comma-separated translated string.
 */
export function translateProfileArray(
  t: TFunction,
  field: string,
  values: string | string[] | undefined | null
): string {
  if (!values) return '';
  if (Array.isArray(values)) {
    return values.map((v) => translateProfileValue(t, field, v)).join(', ');
  }
  return translateProfileValue(t, field, values);
}
