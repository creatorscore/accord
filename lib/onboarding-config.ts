/**
 * Onboarding configuration — 34 steps (0-33), one question per screen. Pets added after family plans.
 * Languages / must-haves / dealbreakers appended at the end (31-33) — all optional/skippable.
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
  /** Section this step belongs to (for grouped progress display) */
  section: OnboardingSection;
}

/** Logical sections for grouped progress display */
export type OnboardingSection = 'basics' | 'identity' | 'goals' | 'background' | 'lifestyle' | 'profile' | 'preferences';

export const ONBOARDING_SECTIONS: { key: OnboardingSection; label: string }[] = [
  { key: 'basics', label: 'Basics' },
  { key: 'identity', label: 'Identity' },
  { key: 'goals', label: 'Goals' },
  { key: 'background', label: 'About You' },
  { key: 'lifestyle', label: 'Lifestyle' },
  { key: 'profile', label: 'Profile' },
  { key: 'preferences', label: 'Preferences' },
];

/** Get the section index and progress within that section for a given step */
export function getSectionProgress(stepIndex: number): { sectionIndex: number; sectionLabel: string; sectionProgress: number; totalSections: number } {
  const step = ONBOARDING_STEPS[stepIndex];
  if (!step) return { sectionIndex: 0, sectionLabel: 'Basics', sectionProgress: 0, totalSections: ONBOARDING_SECTIONS.length };

  const sectionIndex = ONBOARDING_SECTIONS.findIndex(s => s.key === step.section);
  const sectionSteps = ONBOARDING_STEPS.filter(s => s.section === step.section);
  const stepWithinSection = sectionSteps.findIndex(s => s.key === step.key);
  const sectionProgress = (stepWithinSection + 1) / sectionSteps.length;

  return {
    sectionIndex,
    sectionLabel: ONBOARDING_SECTIONS[sectionIndex]?.label || '',
    sectionProgress,
    totalSections: ONBOARDING_SECTIONS.length,
  };
}

export const ONBOARDING_STEPS: OnboardingStepConfig[] = [
  // ── Basics (0-3) ──
  { key: 'name', title: "What's your first name?", subtitle: "This can't be changed later, so pick a good one.", skippable: false, previewAvailable: false, hasVisibility: false, section: 'basics' },
  { key: 'dob', title: "When's your birthday?", subtitle: "Your age will be shown on your profile. We'll also grab your zodiac sign.", skippable: false, previewAvailable: false, hasVisibility: false, section: 'basics' },
  { key: 'notifications', title: 'Turn on notifications', subtitle: "Get notified when you get a match, message, or like.", skippable: true, previewAvailable: false, hasVisibility: false, section: 'basics' },
  // Preview ("Take a look around") is gated until step 8 — the user must
  // have completed location, gender, gender_preference, etc. so Discovery
  // has the data to filter matches. Previously preview was available from
  // step 3 onward, which meant discovery would load zero profiles (no lat/lng
  // saved yet, no gender_pref picked, no preferences row) and look frozen.
  { key: 'location', title: 'Where are you based?', subtitle: "We use this to find people near you.", skippable: false, previewAvailable: false, hasVisibility: false, section: 'basics' },
  // ── Identity (4-7) ──
  { key: 'pronouns', title: 'What are your pronouns?', subtitle: "This helps others know how to refer to you.", skippable: false, previewAvailable: false, hasVisibility: false, section: 'identity' },
  { key: 'gender', title: 'Choose your gender', subtitle: "Pick the gender you identify as — trans women choose Woman, trans men choose Man.", skippable: false, previewAvailable: false, hasVisibility: false, section: 'identity' },
  { key: 'sexuality', title: "What's your sexuality?", subtitle: "Pick the one that fits best.", skippable: false, previewAvailable: false, hasVisibility: false, section: 'identity' },
  { key: 'gender_pref', title: 'Who would you like to meet?', subtitle: "Pick any that apply — select all three to see everyone.", skippable: false, previewAvailable: false, hasVisibility: false, section: 'identity' },
  // ── Goals (8-13) ──
  { key: 'relationship_type', title: 'What type of relationship are you looking for?', subtitle: "This helps us match you with compatible people.", skippable: false, previewAvailable: true, hasVisibility: false, section: 'goals' },
  { key: 'intention', title: 'What brings you to Accord?', subtitle: "Pick the one that fits best.", skippable: false, previewAvailable: true, hasVisibility: false, section: 'goals' },
  { key: 'height', title: 'How tall are you?', subtitle: "Optional — you can hide this from your profile.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'height', section: 'goals' },
  { key: 'ethnicity', title: "What's your ethnicity?", subtitle: "Select all that apply.", skippable: true, previewAvailable: true, hasVisibility: false, section: 'goals' },
  { key: 'children', title: 'Do you want children?', subtitle: "This is important for compatibility.", skippable: false, previewAvailable: true, hasVisibility: false, section: 'goals' },
  { key: 'family_plans', title: 'What are your family plans?', subtitle: "How would you like to grow your family?", skippable: true, previewAvailable: true, hasVisibility: false, section: 'goals' },
  { key: 'pets', title: 'How do you feel about pets?', subtitle: "This helps with lifestyle compatibility.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'pets', section: 'goals' },
  // ── Background (15-20) ──
  { key: 'hometown', title: 'Where are you from?', subtitle: "Your hometown helps others connect with you.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'hometown', section: 'background' },
  { key: 'job_title', title: "What's your job title?", subtitle: "Share your role or profession.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'job_title', section: 'background' },
  { key: 'school', title: 'Where did you go to school?', subtitle: "Your school, university, or program.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'education', section: 'background' },
  { key: 'education_level', title: "What's the highest level you attained?", subtitle: "Select your education level.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'education_level', section: 'background' },
  { key: 'religion', title: 'Are you religious?', subtitle: "Optional — you can hide this from your profile.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'religion', section: 'background' },
  { key: 'politics', title: 'Political beliefs?', subtitle: "Optional — you can hide this from your profile.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'political_views', section: 'background' },
  // ── Lifestyle (20-25) ──
  { key: 'financial', title: 'Financial arrangement?', subtitle: "How would you like to handle finances?", skippable: false, previewAvailable: true, hasVisibility: false, section: 'lifestyle' },
  { key: 'housing', title: 'Housing preference?', subtitle: "What living arrangement works for you?", skippable: false, previewAvailable: true, hasVisibility: false, section: 'lifestyle' },
  { key: 'drinking', title: 'Do you drink?', subtitle: "Optional — you can hide this from your profile.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'drinking', section: 'lifestyle' },
  { key: 'smoking', title: 'Do you smoke?', subtitle: "Optional — you can hide this from your profile.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'smoking', section: 'lifestyle' },
  { key: 'weed', title: 'Do you smoke weed?', subtitle: "Optional — you can hide this from your profile.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'smokes_weed', section: 'lifestyle' },
  { key: 'drugs', title: 'Do you do drugs?', subtitle: "Optional — you can hide this from your profile.", skippable: true, previewAvailable: true, hasVisibility: true, visibilityKey: 'does_drugs', section: 'lifestyle' },
  // ── Profile (26-28) ──
  { key: 'photos', title: 'Add your photos', subtitle: "Add at least 3 photos. Your first photo is your main profile photo.", skippable: false, previewAvailable: true, hasVisibility: false, section: 'profile' },
  { key: 'prompts', title: 'Answer some prompts', subtitle: "Choose at least 2 prompts to help others get to know you.", skippable: false, previewAvailable: true, hasVisibility: false, section: 'profile' },
  { key: 'voice_note', title: 'Record a voice intro', subtitle: "Let others hear your voice. 30 seconds max.", skippable: true, previewAvailable: true, hasVisibility: false, section: 'profile' },
  // ── Preferences (30) ──
  { key: 'matching_prefs', title: 'Set your preferences', subtitle: "Set your age range and distance preferences.", skippable: false, previewAvailable: false, hasVisibility: false, section: 'preferences' },
  // ── Preferences — optional extras (31-33) ──
  // Appended at the END so existing users' saved `onboarding_step` indices
  // never shift. All three are skippable multi-select chip steps that write
  // to columns onboarding previously never collected (languages_spoken on
  // profiles; must_haves + dealbreakers on preferences).
  { key: 'languages', title: 'What languages do you speak?', subtitle: "Select up to 5.", skippable: true, previewAvailable: true, hasVisibility: false, section: 'preferences' },
  { key: 'must_haves', title: 'What are your must-haves?', subtitle: "Pick what matters most — optional.", skippable: true, previewAvailable: true, hasVisibility: false, section: 'preferences' },
  { key: 'dealbreakers', title: 'Any dealbreakers?', subtitle: "Pick what you can't accept — optional.", skippable: true, previewAvailable: true, hasVisibility: false, section: 'preferences' },
];

export const TOTAL_ONBOARDING_STEPS = ONBOARDING_STEPS.length; // 34

/** Checkpoint steps where accumulated form state is saved to DB */
export const SAVE_CHECKPOINTS = [3, 14, 26] as const;

// ─── Option Constants ────────────────────────────────────────────────────────

export const GENDERS = ['Man', 'Woman', 'Non-binary'] as const;

// 'prefer not to say' lives at index 0 intentionally: pronouns is the
// first identity question in onboarding (step 4 — name/DOB/location
// before it are all neutral) and a measurable 13% of users who reach
// this screen bail without picking anything. Putting the explicit
// opt-out first gives nervous or uncertain users a visible escape
// instead of forcing them through a 1-of-7 commitment to advance.
// Stored DB values are unchanged; only the chip render order moves.
export const PRONOUNS = [
  'prefer not to say', 'she/her', 'he/him', 'they/them',
  'she/they', 'he/they', 'any pronouns', 'ask me',
] as const;

export const ORIENTATIONS = [
  'Lesbian', 'Gay', 'Bisexual', 'Straight', 'Queer', 'Asexual',
  'Pansexual', 'Demisexual', 'Questioning', 'Omnisexual', 'Polysexual',
  'Androsexual', 'Gynesexual', 'Sapiosexual', 'Heteroflexible',
  'Homoflexible', 'Prefer not to say', 'Other',
] as const;

// "Everyone" intentionally removed from onboarding — users pick specific
// gender(s); selecting all three is equivalent to the old "Everyone". The
// backward-compat handling of a stored "Everyone"/[] value still lives in
// lib/gender-preferences.ts (expand/collapse) for existing users.
export const GENDER_PREF_OPTIONS = ['Men', 'Women', 'Non-binary'] as const;

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

export const PETS_OPTIONS = [
  { value: 'love_them', label: 'Love Them' },
  { value: 'like_them', label: 'Like Them' },
  { value: 'indifferent', label: 'Indifferent' },
  { value: 'allergic', label: 'Allergic' },
  { value: 'dont_like', label: "Don't Like Them" },
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

// Shared language list — used by both onboarding (languages step, cap 5) and
// settings/edit-profile. Single source of truth so the two surfaces stay in sync.
export const COMMON_LANGUAGES = [
  'English', 'Spanish', 'Mandarin', 'French', 'German', 'Italian',
  'Portuguese', 'Russian', 'Japanese', 'Korean', 'Arabic', 'Hindi', 'Other',
] as const;

export const DEALBREAKER_OPTIONS = [
  'Smoking', 'Heavy drinking', 'Recreational drugs', 'Wants biological children',
  'Does not want children', 'Not out publicly', 'Wants a romantic relationship',
  'Long-distance only', 'Not verified', 'Different core values', 'Poor communication',
  'Not financially stable',
] as const;

export const MUST_HAVE_OPTIONS = [
  'Verified profile', 'Financial independence', 'Discretion & privacy',
  'Shared family goals', 'Similar timeline', 'Lives nearby', 'Open to relocation',
  'Prenup agreement', 'Separate finances', 'Honest communication', 'Mutual respect',
  'Clear expectations',
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
 * Map old onboarding_step values (0-9) to new step indices (0-30)
 * for existing users who are mid-onboarding on the old flow.
 *
 * Callers should prefer `resolveResumeStep` (below) which overrides the map
 * when critical fields are missing — the bare map can skip required content
 * that the old flow never collected (gender_preference, relationship_type,
 * primary_reasons, etc.), which let ~400 legacy users finish onboarding with
 * null relationship_type before this fix.
 */
export function mapOldStepToNew(oldStep: number): number {
  // Old flow screens: basic-info (→1), photos (→3), voice (→7),
  // marriage-preferences (→8), matching-preferences / notifications (→9).
  // Steps 2/4/5/6 come from retired versions (personality, interests, prompts)
  // and are treated as equivalent to their nearest surviving neighbor.
  const mapping: Record<number, number> = {
    0: 0,   // Not started → start from beginning
    1: 4,   // Basic info done → Identity section (pronouns..gender_pref..goals)
    2: 4,   // Personality (removed) → Identity
    3: 4,   // Photos done (but Identity+Goals+Lifestyle never collected) → Identity
    4: 4,   // Legacy → Identity
    5: 4,   // Interests (removed) → Identity
    6: 4,   // Prompts done (old order) → Identity
    7: 4,   // Voice done (old order) → Identity
    8: 4,   // Marriage prefs done (still missing gender_pref + identity) → Identity
    9: 30,  // Matching prefs done → final Matching Prefs step in new flow
  };
  return mapping[oldStep] ?? 0;
}

/**
 * Inspect a legacy user's actual DB state and return the earliest new-flow
 * step index they still need to fill out. Beats `mapOldStepToNew` alone when
 * the user has partial data that doesn't match any neat old-step marker —
 * e.g. marriage-prefs done but relationship_type somehow null, or an abandoned
 * signup where onboarding_step was never bumped past 1.
 *
 * Returns `null` if every required field is present (caller should fall back
 * to the map or the stored step).
 */
export function earliestMissingRequiredStep(profile: {
  display_name?: string | null;
  birth_date?: string | null;
  age?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  location_city?: string | null;
  location_state?: string | null;
  pronouns?: string | null;
  gender?: string[] | null;
  sexual_orientation?: string[] | null;
}, preferences: {
  gender_preference?: string[] | null;
  relationship_type?: string | null;
  primary_reasons?: string[] | null;
  wants_children?: boolean | null;
  financial_arrangement?: string[] | null;
  housing_preference?: string[] | null;
} | null | undefined): number | null {
  if (!profile.display_name || profile.display_name.trim().length === 0) return 0;
  if (!profile.birth_date || !profile.age) return 1;
  // Location: require city OR state; do NOT require lat/lng. LocationStep's
  // dropdown picker saves city/state/country only — lat/lng is populated only
  // by the GPS path. Requiring lat/lng here would loop the user back to step 3
  // after every resume, even though they already entered a valid city.
  if (!profile.location_city && !profile.location_state) return 3;
  if (!profile.pronouns) return 4;
  if (!profile.gender || profile.gender.length === 0) return 5;
  if (!profile.sexual_orientation || profile.sexual_orientation.length === 0) return 6;
  // gender_preference: empty array is valid (= "Everyone"). Only null is missing.
  if (!preferences || preferences.gender_preference == null) return 7;
  if (!preferences.relationship_type) return 8;
  if (!preferences.primary_reasons || preferences.primary_reasons.length === 0) return 9;
  if (preferences.wants_children == null) return 12;
  if (!preferences.financial_arrangement || preferences.financial_arrangement.length === 0) return 21;
  if (!preferences.housing_preference || preferences.housing_preference.length === 0) return 22;
  return null;
}

/**
 * Final resume step: earliest missing required field wins; otherwise use the
 * legacy map (for 0-9) or the stored step (for 10+). Callers pass the raw
 * `profile.onboarding_step` and the hydrated profile/preferences.
 */
export function resolveResumeStep(
  storedStep: number,
  profile: Parameters<typeof earliestMissingRequiredStep>[0],
  preferences: Parameters<typeof earliestMissingRequiredStep>[1],
  total: number
): number {
  const missing = earliestMissingRequiredStep(profile, preferences);
  if (missing !== null) return missing;
  if (storedStep <= 9) return mapOldStepToNew(storedStep);
  return Math.min(storedStep, total - 1);
}
