/**
 * Prompt i18n keys — shared between onboarding and edit-profile.
 * Values are keys into the `prompts` namespace in locales/*.json.
 */
export const PROMPT_KEYS = [
  'idealMarriage',
  'lookingFor',
  'bestPartnership',
  'perfectSunday',
  'togetherWeCould',
  'partnerUnderstands',
  'idealLiving',
  'financialGoals',
  'mostImportant',
  'canOffer',
  'dealBreakers',
  'futureVision',
  'greatPartner',
  'passionateAbout',
  'greenFlags',
  'funFact',
  'loveLanguage',
  'secretlyGoodAt',
  'keyToHeart',
  'guiltyPleasure',
] as const;

export type PromptKey = typeof PROMPT_KEYS[number];
