/**
 * Zustand store for onboarding form state.
 * Accumulates answers across all 30 steps and persists via checkpoints.
 */

import { create } from 'zustand';

export interface OnboardingFormState {
  // Step 0 - Name
  displayName: string;
  // Step 1 - DOB
  birthDate: Date | null;
  age: number | null;
  zodiacSign: string;
  // Step 2 - Notifications (handled by system, no form state)
  // Step 3 - Location
  locationCity: string;
  locationState: string;
  locationCountry: string;
  latitude: number | null;
  longitude: number | null;
  // Step 4 - Pronouns
  pronouns: string;
  // Step 5 - Gender
  gender: string[];
  // Step 6 - Sexuality
  sexualOrientation: string[];
  // Step 7 - Gender Preference
  genderPreference: string[];
  // Step 8 - Relationship Type
  relationshipType: string;
  // Step 9 - Intention / Primary Reasons
  primaryReasons: string[];
  // Step 10 - Height
  heightInches: number | null;
  heightUnit: 'imperial' | 'metric';
  // Step 11 - Ethnicity
  ethnicity: string[];
  // Step 12 - Children
  wantsChildren: string; // 'yes' | 'no' | 'maybe'
  // Step 13 - Family Plans
  childrenArrangement: string[];
  // Step 14 - Hometown
  hometown: string;
  // Step 15 - Job Title
  jobTitle: string;
  // Step 16 - School
  education: string; // school name (free text)
  // Step 17 - Education Level
  educationLevel: string;
  // Step 18 - Religion
  religion: string;
  // Step 19 - Politics
  politicalViews: string;
  // Step 20 - Financial Arrangement
  financialArrangement: string[];
  // Step 21 - Housing
  housingPreference: string[];
  // Step 22 - Drinking
  drinking: string;
  // Step 23 - Smoking
  smoking: string;
  // Step 24 - Weed
  smokesWeed: string;
  // Step 25 - Drugs
  doesDrugs: string;
  // Steps 26-28 (Photos, Prompts, Voice) manage their own state via supabase
  // Step 29 - Matching Preferences
  ageMin: number;
  ageMax: number;
  maxDistanceMiles: number;
  distanceUnit: 'miles' | 'km';

  // Field visibility toggles
  fieldVisibility: Record<string, boolean>;
}

interface OnboardingStore extends OnboardingFormState {
  /** Update one or more form fields */
  setField: <K extends keyof OnboardingFormState>(key: K, value: OnboardingFormState[K]) => void;
  /** Update multiple fields at once */
  setFields: (fields: Partial<OnboardingFormState>) => void;
  /** Toggle a field visibility setting */
  toggleVisibility: (field: string) => void;
  /** Set visibility for a field */
  setVisibility: (field: string, visible: boolean) => void;
  /** Reset all form state */
  reset: () => void;
  /** Hydrate from existing profile data (for resume) */
  hydrate: (data: Partial<OnboardingFormState>) => void;
}

const initialState: OnboardingFormState = {
  displayName: '',
  birthDate: null,
  age: null,
  zodiacSign: '',
  locationCity: '',
  locationState: '',
  locationCountry: 'US',
  latitude: null,
  longitude: null,
  pronouns: '',
  gender: [],
  sexualOrientation: [],
  genderPreference: [],
  relationshipType: '',
  primaryReasons: [],
  heightInches: null,
  heightUnit: 'imperial',
  ethnicity: [],
  wantsChildren: '',
  childrenArrangement: [],
  hometown: '',
  jobTitle: '',
  education: '',
  educationLevel: '',
  religion: '',
  politicalViews: '',
  financialArrangement: [],
  housingPreference: [],
  drinking: '',
  smoking: '',
  smokesWeed: '',
  doesDrugs: '',
  ageMin: 22,
  ageMax: 45,
  maxDistanceMiles: 50,
  distanceUnit: 'miles',
  fieldVisibility: {},
};

export const useOnboardingStore = create<OnboardingStore>((set) => ({
  ...initialState,

  setField: (key, value) => set({ [key]: value }),

  setFields: (fields) => set(fields),

  toggleVisibility: (field) =>
    set((state) => ({
      fieldVisibility: {
        ...state.fieldVisibility,
        [field]: !(state.fieldVisibility[field] ?? true),
      },
    })),

  setVisibility: (field, visible) =>
    set((state) => ({
      fieldVisibility: {
        ...state.fieldVisibility,
        [field]: visible,
      },
    })),

  reset: () => set(initialState),

  hydrate: (data) => set(data),
}));
