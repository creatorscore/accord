/**
 * Zustand store for onboarding form state.
 * Accumulates answers across all 31 steps and persists via checkpoints.
 *
 * The store is also persisted to AsyncStorage via zustand's `persist` middleware
 * so a user's in-progress answers survive an app kill/background even between
 * DB checkpoints (which only fire at steps 3, 14, 26, 30). Without this, users
 * who close the app between e.g. gender (step 5) and pets (step 14) would lose
 * every answer in that block and end up re-entering them on next launch, which
 * manifested as the "onboarding keeps saying my profile is incomplete" bug.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
  // Step 14 - Pets
  pets: string;
  // Step 15 - Hometown
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
  // Step 30 - Matching Preferences
  ageMin: number;
  ageMax: number;
  maxDistanceMiles: number;
  distanceUnit: 'miles' | 'km';
  willingToRelocate: boolean;
  // Step 31 - Languages spoken (profiles.languages_spoken, max 5) — optional
  languagesSpoken: string[];
  // Step 32 - Must-haves (preferences.must_haves, max 10) — optional
  mustHaves: string[];
  // Step 33 - Dealbreakers (preferences.dealbreakers, max 10) — optional
  dealbreakers: string[];

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
  /** Hydrate from existing profile data (for resume) — overwrites unconditionally. */
  hydrate: (data: Partial<OnboardingFormState>) => void;
  /**
   * Hydrate from DB but preserve any field the user has already changed locally.
   * Only overwrites fields that are still at their initial default (i.e. the
   * user has not touched them in this or a previous session).
   * Prevents a fresh DB fetch from wiping a persisted in-progress draft.
   */
  hydrateIfEmpty: (data: Partial<OnboardingFormState>) => void;
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
  pets: '',
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
  willingToRelocate: false,
  languagesSpoken: [],
  mustHaves: [],
  dealbreakers: [],
  fieldVisibility: {},
};

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
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

      hydrateIfEmpty: (data) =>
        set((state) => {
          const merged: Partial<OnboardingFormState> = {};
          (Object.keys(data) as Array<keyof OnboardingFormState>).forEach((key) => {
            const dbVal = data[key];
            if (dbVal === undefined) return;
            const stateVal = state[key];
            const initialVal = initialState[key];
            // Determine whether the current state value is still at its initial default.
            // Arrays compare by shallow equality on length+contents (empty array === default).
            let isAtDefault: boolean;
            if (Array.isArray(stateVal) && Array.isArray(initialVal)) {
              isAtDefault =
                stateVal.length === initialVal.length &&
                stateVal.every((v, i) => v === (initialVal as any[])[i]);
            } else if (
              stateVal !== null &&
              typeof stateVal === 'object' &&
              initialVal !== null &&
              typeof initialVal === 'object'
            ) {
              // fieldVisibility is an object — treat an empty object as default.
              isAtDefault = Object.keys(stateVal).length === Object.keys(initialVal).length;
            } else {
              isAtDefault = stateVal === initialVal;
            }
            if (isAtDefault) (merged as any)[key] = dbVal;
          });
          return merged;
        }),
    }),
    {
      name: 'accord-onboarding-draft',
      storage: createJSONStorage(() => AsyncStorage),
      // Only persist form fields, not the action functions.
      partialize: (state): OnboardingFormState => ({
        displayName: state.displayName,
        birthDate: state.birthDate,
        age: state.age,
        zodiacSign: state.zodiacSign,
        locationCity: state.locationCity,
        locationState: state.locationState,
        locationCountry: state.locationCountry,
        latitude: state.latitude,
        longitude: state.longitude,
        pronouns: state.pronouns,
        gender: state.gender,
        sexualOrientation: state.sexualOrientation,
        genderPreference: state.genderPreference,
        relationshipType: state.relationshipType,
        primaryReasons: state.primaryReasons,
        heightInches: state.heightInches,
        heightUnit: state.heightUnit,
        ethnicity: state.ethnicity,
        wantsChildren: state.wantsChildren,
        childrenArrangement: state.childrenArrangement,
        pets: state.pets,
        hometown: state.hometown,
        jobTitle: state.jobTitle,
        education: state.education,
        educationLevel: state.educationLevel,
        religion: state.religion,
        politicalViews: state.politicalViews,
        financialArrangement: state.financialArrangement,
        housingPreference: state.housingPreference,
        drinking: state.drinking,
        smoking: state.smoking,
        smokesWeed: state.smokesWeed,
        doesDrugs: state.doesDrugs,
        ageMin: state.ageMin,
        ageMax: state.ageMax,
        maxDistanceMiles: state.maxDistanceMiles,
        distanceUnit: state.distanceUnit,
        willingToRelocate: state.willingToRelocate,
        languagesSpoken: state.languagesSpoken,
        mustHaves: state.mustHaves,
        dealbreakers: state.dealbreakers,
        fieldVisibility: state.fieldVisibility,
      }),
      // birthDate round-trips through JSON as an ISO string; rehydrate as a Date
      // so downstream code (validation, DOB rendering) keeps working.
      onRehydrateStorage: () => (state) => {
        if (state?.birthDate && typeof state.birthDate === 'string') {
          const d = new Date(state.birthDate);
          if (!isNaN(d.getTime())) state.birthDate = d;
        }
      },
    }
  )
);
