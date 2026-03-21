/**
 * Onboarding configuration — 31 steps (0-30), one question per screen.
 * Each step defines its key, UI metadata, validation rules, and save behavior.
 */

// ─── Step Definitions ────────────────────────────────────────────────────────

export interface OnboardingStepConfig {
  key: string;
  title: string;
  subtitle?: string;
  /** Whether the step can be skipped (skip = advance without answering) */
  skippable: boolean;
  /** Whether "Take a look around" preview link is available */
  previewAvailable: boolean;
  /** Whether the step has a "Show on profile" visibility toggle */
  hasVisibility: boolean;
  /** The field_visibility key (if hasVisibility is true) */
  visibilityKey?: string;
}

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  // 0 - Name
  { key: 'name', title: "What's your first name?", subtitle: "This can't be changed later, so pick a good one.", skippable: false, previewAvailable: false, hasVisibility: false },
  // 1 - DOB
  { key: 'dob', title: "When's your birthday?", subtitle: "Your age will be shown on your profile. We'll also grab your zodiac sign.", skippable: false, previewAvailable: false, hasVisibility: false },
  // 2 - Push Notifications
  { key: 'notifications', title: 'Turn on notifications', subtitle: "Get notified when you get a match, message, or like.", skippable: false, previewAvailable: false, hasVisibility: false },
  // 3 - Location
  { key: 'location', title: 'Where are you based?', subtitle: "We use this to find people near you.", skippable: false, previewAvailable: true, hasVisibility: false },
  // 4 - Pronouns
  { key: 'pronouns', title: 'What are your pronouns?', subtitle: "This helps others know how to refer to you.", skippable: true, previewAvailable: true, hasVisibility: false },
  // 5 - Gender
  { key: 'gender', title: 'Choose your gender', subtitle: "Select all that apply.", skippable: false, previewAvailable: true, hasVisibility: false },
  // 6 - Sexuality
  { key: 'sexuality', title: "What's your sexuality?", subtitle: "Select all that apply.", skippable: false, previewAvailable: true, hasVisibility: false },
  // 7 - Gender Preference
  { key: 'gender_pref', title: 'Who would you like to date?', subtitle: "Who would you like to see in your feed?", skippable: false, previewAvailable: true, hasVisibility: false },
  // 8 - Relationship Type
  { key: 'relationship_type', title: 'What type of relationship are you looking for?', subtitle: "This helps us match you with compatible people.", skippable: false, previewAvailable: true, hasVisibility: false },
  // 9 - Intention / Primary Reasons
  { key: 'intention', title: 'What brings you to Accord?', subtitle: "Select all that apply.", skippable: false, previewAvailable: true, hasVisibility: false },
  // 10 - Height
  { key: 'height', title: 'How tall are you?', subtitle: "Optional — you can hide this from your profile.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'height' },
  // 11 - Ethnicity
  { key: 'ethnicity', title: "What's your ethnicity?", subtitle: "Select all that apply.", skippable: true, previewAvailable: true, hasVisibility: false },
  // 12 - Children
  { key: 'children', title: 'Do you want children?', subtitle: "This is important for compatibility.", skippable: false, previewAvailable: true, hasVisibility: false },
  // 13 - Family Plans
  { key: 'family_plans', title: 'What are your family plans?', subtitle: "How would you like to grow your family?", skippable: true, previewAvailable: true, hasVisibility: false },
  // 14 - Hometown
  { key: 'hometown', title: 'Where are you from?', subtitle: "Your hometown helps others connect with you.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'hometown' },
  // 15 (index 15) - Job Title
  { key: 'job_title', title: "What's your job title?", subtitle: "Share your role or profession.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'job_title' },
  // 16 (index 16) - School
  { key: 'school', title: 'Where did you go to school?', subtitle: "Your school, university, or program.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'education' },
  // 17 (index 17) - Education Level
  { key: 'education_level', title: "What's the highest level you attained?", subtitle: "Select your education level.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'education_level' },
  // 18 (index 18) - Religion
  { key: 'religion', title: 'Are you religious?', subtitle: "Optional — you can hide this from your profile.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'religion' },
  // 19 (index 19) - Political Beliefs
  { key: 'politics', title: 'Political beliefs?', subtitle: "Optional — you can hide this from your profile.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'political_views' },
  // 20 (index 20) - Financial Arrangement
  { key: 'financial', title: 'Financial arrangement?', subtitle: "How would you like to handle finances?", skippable: false, previewAvailable: true, hasVisibility: false },
  // 21 (index 21) - Housing
  { key: 'housing', title: 'Housing preference?', subtitle: "What living arrangement works for you?", skippable: false, previewAvailable: true, hasVisibility: false },
  // 22 (index 22) - Drinking
  { key: 'drinking', title: 'Do you drink?', subtitle: "Optional — you can hide this from your profile.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'drinking' },
  // 23 (index 23) - Smoking
  { key: 'smoking', title: 'Do you smoke?', subtitle: "Optional — you can hide this from your profile.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'smoking' },
  // 24 (index 24) - Weed
  { key: 'weed', title: 'Do you smoke weed?', subtitle: "Optional — you can hide this from your profile.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'smokes_weed' },
  // 25 (index 25) - Drugs
  { key: 'drugs', title: 'Do you do drugs?', subtitle: "Optional — you can hide this from your profile.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'does_drugs' },
  // 26 (index 26) - Photos
  { key: 'photos', title: 'Add your photos', subtitle: "Add at least 2 photos. Your first photo is your main profile photo.", skippable: false, previewAvailable: true, hasVisibility: false },
  // 27 (index 27) - Prompts
  { key: 'prompts', title: 'Answer some prompts', subtitle: "Choose at least 2 prompts to help others get to know you.", skippable: false, previewAvailable: true, hasVisibility: false },
  // 28 (index 28) - Voice Note
  { key: 'voice_note', title: 'Record a voice intro', subtitle: "Let others hear your voice. 30 seconds max.", skippable: true, previewAvailable: true, hasVisibility: false },
  // 29 (index 29) - Matching Preferences
  { key: 'matching_prefs', title: 'Set your preferences', subtitle: "Set your age range and distance preferences.", skippable: false, previewAvailable: true, hasVisibility: false },
];

export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS.length; // 30

/** Checkpoint steps where accumulated form state is saved to DB */
export const SAVE_CHECKPOINTS = [3, 13, 25] as const;

// ─── Option Constants ────────────────────────────────────────────────────────

export const GENDERS = ['Man', 'Woman', 'Non-binary'] as const;

export const PRONOUNS = [
  'she/her', 'he/him', 'they/them', 'she/they',
  'he/they', 'any pronouns', 'ask me', 'prefer not to say',
] as const;

export const ORIENTATIONS = [
  'Lesbian', 'Gay', 'Bisexual', 'Straight', 'Queer', 'Asexual',
  'Pansexual', 'Demisexual', 'Questioning', 'Omnisexual', 'Polysexual',
  'Androsexual', 'Gynesexual', 'Sapiosexual', 'Heteroflexible',
  'Homoflexible', 'Prefer not to say', 'Other',
] as const;

export const GENDER_PREF_OPTIONS = ['Men', 'Women', 'Non-binary', 'Everyone'] as const;

export const ETHNICITIES = [
  'Asian', 'Black/African', 'Hispanic/Latinx', 'Indigenous/Native',
  'Middle Eastern/North African', 'Pacific Islander', 'South Asian',
  'White/Caucasian', 'Multiracial', 'Other', 'Prefer not to say',
] as const;

export const RELIGIONS = [
  'Christian', 'Catholic', 'Protestant', 'Muslim', 'Jewish', 'Hindu',
  'Buddhist', 'Sikh', 'Atheist', 'Agnostic', 'Spiritual but not religious',
  'Other', 'Prefer not to say',
] as const;

export const POLITICAL_VIEWS = [
  'Liberal', 'Progressive', 'Moderate', 'Conservative', 'Libertarian',
  'Socialist', 'Apolitical', 'Other', 'Prefer not to say',
] as const;

export const RELATIONSHIP_TYPES = [
  { value: 'platonic', label: 'Platonic Only' },
  { value: 'romantic', label: 'Romantic Possible' },
  { value: 'open', label: 'Open Arrangement' },
] as const;

export const PRIMARY_REASONS = [
  { value: 'financial', label: 'Financial Stability' },
  { value: 'immigration', label: 'Immigration/Visa' },
  { value: 'family_pressure', label: 'Family Pressure' },
  { value: 'legal_benefits', label: 'Legal Benefits' },
  { value: 'companionship', label: 'Companionship' },
  { value: 'safety', label: 'Safety & Protection' },
  { value: 'other', label: 'Other' },
] as const;

export const CHILDREN_OPTIONS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'maybe', label: 'Maybe / Open to it' },
] as const;

export const FAMILY_PLANS = [
  { value: 'biological', label: 'Biological Children' },
  { value: 'adoption', label: 'Adoption' },
  { value: 'surrogacy', label: 'Surrogacy' },
  { value: 'ivf', label: 'IVF/Fertility Treatments' },
  { value: 'co_parenting', label: 'Co-Parenting' },
  { value: 'fostering', label: 'Fostering' },
  { value: 'already_have', label: 'Already Have Children' },
  { value: 'open_discussion', label: 'Open to Discussion' },
  { value: 'other', label: 'Other' },
] as const;

export const HOUSING_PREFERENCES = [
  { value: 'separate_spaces', label: 'Separate Bedrooms/Spaces' },
  { value: 'roommates', label: 'Live Like Roommates' },
  { value: 'separate_homes', label: 'Separate Homes Nearby' },
  { value: 'shared_bedroom', label: 'Shared Bedroom' },
  { value: 'flexible', label: 'Flexible/Negotiable' },
] as const;

export const FINANCIAL_ARRANGEMENTS = [
  { value: 'separate', label: 'Keep Finances Separate' },
  { value: 'shared_expenses', label: 'Share Bills/Expenses' },
  { value: 'joint', label: 'Joint Finances' },
  { value: 'prenup_required', label: 'Prenup Required' },
  { value: 'flexible', label: 'Flexible/Negotiable' },
] as const;

export const EDUCATION_LEVELS = [
  { value: 'high_school', label: 'High School' },
  { value: 'associates', label: "Associate's Degree" },
  { value: 'bachelors', label: "Bachelor's Degree" },
  { value: 'masters', label: "Master's Degree" },
  { value: 'doctorate', label: 'Doctorate / PhD' },
  { value: 'trade_school', label: 'Trade School' },
  { value: 'self_taught', label: 'Self-Taught' },
  { value: 'other', label: 'Other' },
] as const;

export const DRINKING_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'socially', label: 'Socially' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'prefer_not_to_say', label: 'Prefer Not to Say' },
] as const;

export const SMOKING_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'socially', label: 'Socially' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'trying_to_quit', label: 'Trying to Quit' },
] as const;

export const WEED_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'socially', label: 'Socially' },
  { value: 'regularly', label: 'Regularly' },
] as const;

export const DRUG_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'socially', label: 'Socially' },
  { value: 'regularly', label: 'Regularly' },
] as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Filter orientations based on selected gender (Hinge-style) */
export function getAvailableOrientations(selectedGender: string): readonly string[] {
  if (selectedGender === 'Man') {
    return ORIENTATIONS.filter(o => o !== 'Straight' && o !== 'Lesbian');
  }
  return ORIENTATIONS;
}

/** Calculate zodiac sign from a birth date */
export function calculateZodiac(birthDate: Date): string {
  const month = birthDate.getMonth() + 1;
  const day = birthDate.getDate();
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries';
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus';
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini';
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer';
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo';
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo';
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra';
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio';
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius';
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricorn';
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius';
  return 'Pisces';
}

/** Calculate age from birth date */
export function calculateAge(birthDate: Date): number {
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

/** Generate height options for picker */
export function getHeightOptions(unit: 'imperial' | 'metric'): { value: number; label: string }[] {
  if (unit === 'imperial') {
    const options = [];
    for (let inches = 48; inches <= 87; inches++) {
      const feet = Math.floor(inches / 12);
      const rem = inches % 12;
      options.push({ value: inches, label: `${feet}'${rem}"` });
    }
    return options;
  } else {
    const options = [];
    for (let cm = 120; cm <= 220; cm++) {
      options.push({ value: cm, label: `${cm} cm` });
    }
    return options;
  }
}

/**
 * Map old onboarding_step values (0-9) to new step indices (0-29)
 * for existing users who are mid-onboarding on the old flow.
 */
export function mapOldStepToNew(oldStep: number): number {
  // Old flow: 0=not started, 1=basic-info done, 2=personality done,
  // 3=photos done, 5=interests done, 6=prompts done, 7=voice done,
  // 8=marriage-prefs done, 9=matching-prefs done
  const mapping: Record<number, number> = {
    0: 0,   // Not started → start from beginning
    1: 10,  // Basic info done (name/DOB/gender/pronouns/orientation/ethnicity/location/hometown/occupation/education) → height
    2: 10,  // Personality done → height (personality removed)
    3: 27,  // Photos done → prompts
    4: 27,  // Legacy → prompts
    5: 27,  // Interests done → prompts
    6: 28,  // Prompts done → voice note
    7: 20,  // Voice done → financial arrangement
    8: 29,  // Marriage prefs done → matching prefs
    9: 29,  // Matching prefs done → matching prefs (last step)
  };
  return mapping[oldStep] ?? 0;
}
