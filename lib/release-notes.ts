/**
 * Release Notes Configuration
 *
 * Add new versions at the TOP of the RELEASE_NOTES array.
 * Each version should include a list of features with:
 * - icon: MaterialCommunityIcons name
 * - titleKey: translation key for the feature title
 * - descriptionKey: translation key for the feature description
 * - isNew: (optional) shows a "NEW" badge on the feature
 * - isPremium: (optional) shows a "PREMIUM" badge on the feature
 */

export interface ReleaseFeature {
  icon: string;
  titleKey: string;
  descriptionKey: string;
  isNew?: boolean;
  isPremium?: boolean;
}

export interface ReleaseNote {
  version: string;
  date: string; // Format: "December 2024"
  headlineKey: string; // Main headline translation key
  features: ReleaseFeature[];
}

// Add new versions at the TOP of this array
export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: '1.1.0',
    date: 'December 2024',
    headlineKey: 'whatsNew.v109.headline',
    features: [
      {
        icon: 'bell-ring',
        titleKey: 'whatsNew.v109.features.activityCenter.title',
        descriptionKey: 'whatsNew.v109.features.activityCenter.description',
        isNew: true,
      },
      {
        icon: 'map-marker-radius',
        titleKey: 'whatsNew.v109.features.betterLocation.title',
        descriptionKey: 'whatsNew.v109.features.betterLocation.description',
      },
      {
        icon: 'translate',
        titleKey: 'whatsNew.v109.features.moreLanguages.title',
        descriptionKey: 'whatsNew.v109.features.moreLanguages.description',
      },
      {
        icon: 'bug-outline',
        titleKey: 'whatsNew.v109.features.bugFixes.title',
        descriptionKey: 'whatsNew.v109.features.bugFixes.description',
      },
    ],
  },
  {
    version: '1.0.8',
    date: 'December 2024',
    headlineKey: 'whatsNew.v108.headline',
    features: [
      {
        icon: 'camera-account',
        titleKey: 'whatsNew.v108.features.photoVerification.title',
        descriptionKey: 'whatsNew.v108.features.photoVerification.description',
        isNew: true,
      },
      {
        icon: 'cellphone-screenshot',
        titleKey: 'whatsNew.v108.features.screenshotProtection.title',
        descriptionKey: 'whatsNew.v108.features.screenshotProtection.description',
      },
      {
        icon: 'shield-check',
        titleKey: 'whatsNew.v108.features.improvedSafety.title',
        descriptionKey: 'whatsNew.v108.features.improvedSafety.description',
      },
    ],
  },
  {
    version: '1.0.4',
    date: 'December 2024',
    headlineKey: 'whatsNew.v104.headline',
    features: [
      {
        icon: 'magnify',
        titleKey: 'whatsNew.v104.features.searchImprovements.title',
        descriptionKey: 'whatsNew.v104.features.searchImprovements.description',
      },
      {
        icon: 'lock',
        titleKey: 'whatsNew.v104.features.encryptionFix.title',
        descriptionKey: 'whatsNew.v104.features.encryptionFix.description',
      },
      {
        icon: 'bug-outline',
        titleKey: 'whatsNew.v104.features.bugFixes.title',
        descriptionKey: 'whatsNew.v104.features.bugFixes.description',
      },
    ],
  },
];

/**
 * Get release notes for a specific version
 */
export function getReleaseNotes(version: string): ReleaseNote | undefined {
  return RELEASE_NOTES.find(note => note.version === version);
}

/**
 * Get the latest release notes
 */
export function getLatestReleaseNotes(): ReleaseNote | undefined {
  return RELEASE_NOTES[0];
}

/**
 * Check if a version has release notes
 */
export function hasReleaseNotes(version: string): boolean {
  return RELEASE_NOTES.some(note => note.version === version);
}
