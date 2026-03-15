/**
 * Adds new i18n keys to en.json for discover, filters, and verification sections
 */
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'locales', 'en.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

// Add to discover section
Object.assign(data.discover, {
  dailyLimitTitle: 'Daily limit reached',
  dailyLimitMessage: "You've used all 5 likes for today. Upgrade for unlimited!",
  quickFilter: {
    age: 'Age',
    datingIntentions: 'Dating Intentions',
    activeToday: 'Active Today'
  },
  ageSlider: {
    ageRange: 'Age Range: {{min}} - {{max}}',
    minimum: 'Minimum: {{value}}',
    maximum: 'Maximum: {{value}}'
  },
  search: {
    placeholder: "Search by keyword (e.g., 'travel', 'vegan')",
    button: 'Search',
    tip: 'Like or pass to continue searching. Clear search to see all profiles.',
    noResults: 'No results for "{{keyword}}"',
    noResultsHint: 'Try different keywords or adjust your filters to find more matches.',
    clearSearch: 'Clear Search'
  },
  emptyState: {
    allCaughtUp: "You're all caught up",
    checkBack: 'New people join every day.\nCheck back soon or expand your preferences.'
  },
  premiumCta: {
    goPremium: 'Go Premium',
    description: 'See who liked you, unlimited likes, and more.',
    upgrade: 'Upgrade'
  },
  recommendations: {
    expandReach: 'Expand Your Reach',
    increaseDistance: 'Increase distance by {{count}} mi',
    widenAge: 'Widen age range by {{count}} yrs',
    includeGender: 'Include {{gender}}',
    searchGlobally: 'Search globally',
    expandSearch: 'Expand your search',
    newProfilesK: '{{count}}k+ new profiles',
    newProfiles: '{{count}} new profiles',
    newProfileSingular: '1 new profile',
    updatePreferencesTitle: 'Update Preferences?',
    updatePreferencesMessage: 'Add "{{gender}}" to your gender preferences? You can change this anytime in Settings > Matching Preferences.',
    add: 'Add'
  },
  banner: {
    photoBlurTitle: 'Why Some Photos Are Blurred',
    photoBlurDescription: 'Some users enable Photo Blur in their privacy settings to protect their identity until they match. Photos will be revealed once you connect!',
    profileHidden: 'Profile Hidden',
    profileHiddenDescription: 'Your profile is temporarily hidden. Tap to upload new photos.',
    completeProfileToMatch: 'Complete Your Profile to Match',
    completeProfile: 'Complete Your Profile',
    completeProfilePreview: 'You can browse freely! Complete onboarding to start liking and matching.',
    completeProfileDefault: "Finish setting up to start matching. You can browse but can't like or be seen yet."
  },
  premiumLocation: {
    title: 'Unlock Global Search',
    description: 'You have location preferences saved that require Premium to use:',
    searchGlobally: 'Search globally for matches',
    matchCities: 'Match in specific cities',
    upgradeMessage: 'Upgrade to Premium to activate these features and find matches anywhere in the world.',
    upgradeToPremium: 'Upgrade to Premium',
    maybeLater: 'Maybe Later'
  }
});

// Add to filters section
Object.assign(data.filters, {
  basicFilters: 'Basic Filters',
  minimum: 'Minimum',
  maximum: 'Maximum',
  activeToday: 'Active Today',
  activeTodayDescription: 'Only show users active in the last 24 hours',
  showBlurred: 'Show Blurred Photos',
  showBlurredDescription: 'Include profiles with photo blur enabled',
  advancedFilters: 'Advanced Filters',
  identityBackground: 'Identity & Background',
  gender: 'Gender',
  ethnicity: 'Ethnicity',
  sexualOrientation: 'Sexual Orientation',
  physicalPersonality: 'Physical & Personality',
  heightRange: 'Height Range',
  zodiacSign: 'Zodiac Sign',
  mbtiPersonality: 'MBTI Personality Type',
  loveLanguage: 'Love Language',
  lifestyle: 'Lifestyle',
  languagesSpoken: 'Languages Spoken',
  smoking: 'Smoking',
  drinking: 'Drinking',
  pets: 'Pets',
  marriageIntentions: 'Marriage Intentions',
  primaryReason: 'Primary Reason',
  relationshipType: 'Relationship Type',
  wantsChildren: 'Wants Children'
});

// Add verification section (new top-level section)
data.verification = {
  alreadyVerified: 'Already Verified',
  alreadyVerifiedMessage: 'Your photos are already verified!',
  tooManyAttempts: 'Too Many Attempts',
  tooManyAttemptsMessage: 'You have exceeded the maximum number of verification attempts (5). Please contact support at hello@joinaccord.app.',
  tooManyAttemptsMessageShort: 'You have exceeded the maximum number of verification attempts. Please contact support.',
  cameraPermission: 'Camera Permission Required',
  cameraPermissionMessage: 'Please allow camera access to take a verification selfie.',
  selfieError: 'Selfie Error',
  selfieErrorMessage: 'Something went wrong. Please try again.',
  success: 'Photos Verified!',
  successMessage: 'Your photos have been verified!\n\nMatch confidence: {{similarity}}%\n\nYour profile now shows a verified badge.',
  awesome: 'Awesome!',
  unsuccessful: 'Verification Unsuccessful',
  unsuccessfulMessage: '{{message}}\n\nTo improve your chances:\n\n\u2022 Take your selfie in bright, natural daylight\n\u2022 Make sure your primary profile photo is recent\n\u2022 Face the camera directly\n\u2022 Remove sunglasses, hats, or masks\n\u2022 Avoid shadows on your face',
  tryAgain: 'Try Again',
  noPhotos: 'No Profile Photos',
  noPhotosMessage: 'Please upload profile photos before verifying.',
  profileNotFound: 'Profile not found. Please try again.',
  error: 'Verification Error',
  errorMessage: 'Verification failed. Please try again later.',
  statusVerified: 'Verified',
  statusProcessing: 'Processing...',
  statusFailed: 'Failed',
  statusNotVerified: 'Not Verified',
  title: 'Photo Verification',
  verifiedDescription: 'Your photos are verified! This shows other users that your profile pictures accurately represent you.',
  unverifiedDescription: "Verify your photos by taking a selfie. We'll compare it to your profile photos using face recognition.",
  beforeYouStart: 'Before You Start',
  beforeYouStartDescription: 'Make sure your primary profile photo (first photo) is a recent, clear photo of your face. The selfie you take will be compared against your profile photos.',
  attemptsUsed: 'Attempts used: {{count}} / 5',
  unsuccessfulBanner: 'Verification Unsuccessful',
  unsuccessfulBannerMessage: "The selfie didn't match your profile photos well enough. For best results, take your selfie in bright natural daylight and make sure your primary profile photo is a recent, clear photo of your face.",
  verifying: 'Verifying...',
  takeVerificationSelfie: 'Take Verification Selfie',
  forBestResults: 'For best results:',
  tips: {
    daylight: 'Take your selfie in bright, natural daylight',
    faceCamera: 'Face the camera directly with a neutral expression',
    recentPhoto: 'Ensure your primary profile photo is recent and shows your face clearly',
    removeCoverings: 'Remove sunglasses, hats, and face coverings',
    avoidShadows: 'Avoid harsh shadows or backlit environments',
    mustMatch: 'Your selfie must match the person in your profile photos'
  },
  photosVerified: 'Photos Verified!',
  verifiedBadgeMessage: 'Your verified badge is now showing on your profile. This helps build trust with potential matches.',
  freeForAll: 'Free for all users'
};

fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
console.log('en.json updated with discover, filters, and verification keys');
