const fs = require('fs');
const path = require('path');

const enPath = path.join(__dirname, '..', 'locales', 'en.json');
const existing = JSON.parse(fs.readFileSync(enPath, 'utf8'));

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
      }
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

const newKeys = {
  common: {
    confirm: "Confirm",
    someone: "Someone",
    maybeLater: "Maybe Later",
    later: "Later",
    notNow: "Not Now",
    openSettings: "Open Settings",
    skipForNow: "Skip for now",
    saving: "Saving...",
    other: "Other",
    new: "NEW",
    required: "Required",
    goBack: "Go Back",
    report: "Report",
    block: "Block",
    time: {
      today: "Today",
      yesterday: "Yesterday",
      daysAgo: "{{count}} days ago",
      weeksAgo: "{{count}} weeks ago",
      monthsAgo: "{{count}} months ago",
      yearsAgo: "{{count}} years ago"
    },
    days: {
      sunday: "Sunday",
      monday: "Monday",
      tuesday: "Tuesday",
      wednesday: "Wednesday",
      thursday: "Thursday",
      friday: "Friday",
      saturday: "Saturday"
    }
  },

  profileCard: {
    preferences: {
      financial: {
        separate: "Keep Finances Separate",
        sharedExpenses: "Share Living Expenses",
        joint: "Fully Joint Finances",
        prenupRequired: "Prenup Required",
        flexible: "Flexible/Open to Discussion"
      },
      housing: {
        separateSpaces: "Separate Bedrooms/Spaces",
        roommates: "Roommate-Style Arrangement",
        separateHomes: "Separate Homes Nearby",
        sharedBedroom: "Shared Bedroom",
        flexible: "Flexible/Negotiable"
      },
      children: {
        biological: "Biological Children",
        adoption: "Adoption",
        coParenting: "Co-Parenting Agreement",
        surrogacy: "Surrogacy",
        ivf: "IVF",
        alreadyHave: "Already Have Children",
        openDiscussion: "Open to Discussion"
      },
      reasons: {
        financial: "Financial Stability",
        immigration: "Immigration/Visa",
        familyPressure: "Family Pressure",
        legalBenefits: "Legal Benefits",
        companionship: "Companionship",
        safety: "Safety & Protection"
      },
      relationship: {
        platonic: "Platonic Only",
        romantic: "Romantic Partnership",
        open: "Open Arrangement"
      }
    },
    activity: {
      activeNow: "Active now",
      minutesAgo: "Active {{count}}m ago",
      hoursAgo: "Active {{count}}h ago",
      yesterday: "Active yesterday",
      daysAgo: "Active {{count}}d ago"
    },
    section: {
      marriageGoals: "Marriage Goals & Expectations",
      mustHaves: "Must-Haves",
      mustHavesSubtitle: "Important qualities they're looking for",
      dealbreakers: "Dealbreakers",
      dealbreakersSubtitle: "Important boundaries to be aware of",
      lifestyleValues: "Lifestyle & Values",
      hobbiesInterests: "Hobbies & Interests",
      favorites: "Favorites",
      locationRelocation: "Location & Relocation"
    },
    vitals: {
      gender: "Gender",
      pronouns: "Pronouns",
      orientation: "Orientation",
      ethnicity: "Ethnicity",
      occupation: "Occupation",
      education: "Education",
      hometown: "Hometown",
      height: "Height",
      zodiac: "Zodiac",
      personality: "Personality",
      loveLanguage: "Love Language",
      languages: "Languages",
      religion: "Religion",
      politics: "Politics",
      drinking: "Drinking",
      smoking: "Smoking",
      pets: "Pets",
      finances: "Finances",
      living: "Living",
      wantsChildren: "Wants children",
      wantsChildrenWith: "Wants children - {{arrangement}}",
      doesntWantChildren: "Doesn't want children"
    },
    compatibility: {
      matchLabel: "{{score}}% Match",
      label: "Compatibility Match",
      compatible: "Compatible",
      marriageGoals: "Marriage Goals",
      goals: "Goals",
      location: "Location",
      lifestyle: "Lifestyle",
      personality: "Personality"
    },
    goals: {
      primaryReason: "Primary reason",
      primaryReasons: "Primary reasons for partnership",
      relationshipDynamic: "Relationship dynamic",
      children: "Children",
      noChildren: "No children",
      maybeChildren: "Maybe/Open to discussion",
      publicCouple: "Public as a couple?",
      publicYes: "Yes, we'd appear as a couple publicly",
      publicNo: "Prefer to keep it private",
      familyInvolvement: "Family involvement"
    },
    favorites: {
      movies: "Movies",
      musicArtists: "Music Artists",
      books: "Books",
      tvShows: "TV Shows"
    },
    location: {
      maxDistance: "Maximum distance",
      upToMiles: "Up to {{miles}} miles",
      willingToRelocate: "Willing to relocate?",
      openToMoving: "Yes, open to moving",
      stayLocal: "Prefer to stay local",
      preferredCities: "Preferred cities"
    },
    actions: {
      sendMessage: "Send Message",
      report: "Report",
      block: "Block"
    },
    voice: {
      playError: "Could not play voice intro",
      introFallback: "{{name}}'s voice intro"
    }
  },

  profileView: {
    invalidProfile: "Invalid Profile",
    invalidProfileMsg: "This profile link is invalid.",
    notMatched: "Not Matched",
    notMatchedMsg: "You can only view full profiles of your matches.",
    mustBeMatched: "You must be matched with this user to reveal photos",
    photosBlurred: "Photos Blurred",
    photosBlurredMsg: "Your photos are now blurred for this match",
    photosRevealed: "Photos Revealed",
    photosRevealedMsg: "Your photos are now visible to {{name}}",
    photoVisibilityError: "Failed to update photo visibility. Please try again.",
    profileUnavailable: "This profile is no longer available.",
    loadError: "Failed to load profile",
    alreadyMatched: "Already Matched!",
    alreadyMatchedMsg: "You're already matched with {{name}}!",
    likeError: "Failed to like profile",
    passError: "Failed to pass profile",
    obsessed: "Obsessed!",
    obsessedMsg: "{{name}} will be notified that you're interested!",
    superLikeError: "Failed to send super like",
    notFound: "Profile not found",
    actions: {
      pass: "Pass",
      obsessed: "Obsessed",
      like: "Like",
      blurPhotos: "Blur My Photos",
      revealPhotos: "Reveal My Photos",
      sendMessage: "Send Message"
    },
    revealedPhotos: "{{name}} revealed their photos to you",
    blurredPhotos: "{{name}}'s photos are blurred",
    viewingProfile: "Viewing Profile",
    compatibility: {
      whyWeMatch: "Why We Match",
      whatMakesYouCompatible: "What Makes You Compatible",
      locationDistance: "Location & Distance",
      locationHigh: "You're both in the same area, making it easier to build a meaningful connection.",
      locationMedium: "You're within a reasonable distance. One or both of you may be open to meeting halfway.",
      locationLow: "You're further apart, but distance doesn't have to be a barrier if the connection is right.",
      goalsVision: "Marriage Goals & Vision",
      goalsHigh: "Your marriage goals and expectations are well aligned for a compatible partnership.",
      goalsMedium: "You share some common goals. There may be areas to discuss and find common ground.",
      goalsLow: "Your goals differ in some areas, but open communication can help bridge the gap.",
      lifestyleValues: "Lifestyle & Values",
      lifestyleHigh: "Your lifestyle preferences and daily habits are very compatible.",
      lifestyleMedium: "You share some lifestyle preferences. Compromise in some areas may be needed.",
      lifestyleLow: "Your lifestyles differ, but that can bring balance and new experiences to a partnership.",
      personalityInterests: "Personality & Interests",
      personalityHigh: "Your personalities complement each other well, suggesting great interpersonal chemistry.",
      personalityMedium: "You have some personality traits in common. Differences can make things interesting!",
      personalityLow: "Your personalities are quite different, which can lead to growth and new perspectives.",
      backgroundValues: "Background & Values",
      backgroundHigh: "Your cultural backgrounds and values create a strong foundation for understanding.",
      backgroundMedium: "You share some cultural elements. Learning about each other's backgrounds can be enriching.",
      backgroundLow: "Your backgrounds are quite different, offering opportunities for cultural exchange and growth."
    }
  },

  onboarding: {
    common: {
      profileNotFound: "Profile not found. Please start over."
    },
    visibility: {
      alwaysVisible: "Always visible on profile"
    },
    basicInfoSteps: {
      nameTitle: "What should we call you?",
      nameSubtitle: "This is how you'll appear on Accord.",
      birthdayTitle: "What's your date of birth?",
      birthdaySubtitle: "You must be 18 or older to use Accord.",
      genderTitle: "Which gender best describes you?",
      genderSubtitle: "We use broad categories so everyone gets seen by more people. You can share more about yourself in your profile.",
      pronounsTitle: "What are your pronouns?",
      orientationTitle: "What's your orientation?",
      ethnicityTitle: "What's your ethnicity?",
      ethnicitySubtitle: "Select all that apply. This is optional.",
      locationTitle: "Where are you based?",
      locationSubtitle: "We use this to find people near you.",
      hometownTitle: "Where are you from?",
      hometownSubtitle: "Your hometown helps others connect with you.",
      occupationTitle: "What do you do?",
      occupationSubtitle: "Share your occupation or profession.",
      educationTitle: "Where did you study?",
      educationSubtitle: "Your school, university, or program.",
      namePlaceholder: "Your first name",
      nameHint: "This can't be changed later, so pick a good one.",
      selectBirthDate: "Select your birth date",
      birthDateModalTitle: "Birth Date",
      ageCertification: "I confirm I'm 18 years or older",
      genderInfoText: "Accord is built for LGBTQ+ individuals seeking lavender marriages. \"Man\" includes gay men, bisexual men, trans men, and other queer men \u2014 this space is not intended for cisgender heterosexual men.",
      hometownPlaceholder: "e.g. Los Angeles, CA",
      hometownHint: "This can be different from where you currently live.",
      occupationPlaceholder: "e.g. Software Engineer",
      educationPlaceholder: "e.g. UCLA, Harvard Business School"
    },
    genderOptions: {
      man: "Man",
      woman: "Woman",
      nonBinary: "Non-binary"
    },
    orientationOptions: {
      lesbian: "Lesbian",
      gay: "Gay",
      bisexual: "Bisexual",
      straight: "Straight",
      queer: "Queer",
      asexual: "Asexual",
      pansexual: "Pansexual",
      demisexual: "Demisexual",
      questioning: "Questioning",
      omnisexual: "Omnisexual",
      polysexual: "Polysexual",
      androsexual: "Androsexual",
      gynesexual: "Gynesexual",
      sapiosexual: "Sapiosexual",
      heteroflexible: "Heteroflexible",
      homoflexible: "Homoflexible",
      preferNotToSay: "Prefer not to say",
      other: "Other"
    },
    pronounOptions: {
      sheHer: "she/her",
      heHim: "he/him",
      theyThem: "they/them",
      sheThey: "she/they",
      heThey: "he/they",
      anyPronouns: "any pronouns",
      askMe: "ask me",
      preferNotToSay: "prefer not to say"
    },
    ethnicityOptions: {
      asian: "Asian",
      blackAfrican: "Black/African",
      hispanicLatinx: "Hispanic/Latinx",
      indigenousNative: "Indigenous/Native",
      middleEastern: "Middle Eastern/North African",
      pacificIslander: "Pacific Islander",
      southAsian: "South Asian",
      whiteCaucasian: "White/Caucasian",
      multiracial: "Multiracial",
      other: "Other",
      preferNotToSay: "Prefer not to say"
    },
    locationStep: {
      showDistance: "Show distance",
      showDistanceDesc: "Others see how far you are",
      hideDistance: "Hide distance",
      hideDistanceDesc: "Shows \"nearby\" instead",
      hideSearch: "Hide search",
      searchForCity: "Or search for your city",
      searchPlaceholder: "Search 150,000+ cities..."
    },
    interests: {
      title: "What do you love doing?",
      subtitle: "Select 1-10 hobbies that define you",
      favoritesTitle: "Share your favorites",
      favoritesSubtitle: "What movies, music, books, and shows do you love?",
      selectedCount: "{{count}} selected (1-10)",
      addHobbyPlaceholder: "Add your own hobby...",
      movies: "Movies",
      moviesPlaceholder: "e.g., Moonlight, Carol, The Half of It",
      musicArtists: "Music Artists",
      musicPlaceholder: "e.g., Hayley Kiyoko, Troye Sivan, Chappell Roan",
      books: "Books",
      booksPlaceholder: "e.g., Red White & Royal Blue, Stone Butch Blues",
      tvShows: "TV Shows",
      tvShowsPlaceholder: "e.g., Heartstopper, Pose, The L Word",
      separateWithCommas: "Separate with commas",
      maxHobbies: "Maximum Hobbies",
      maxHobbiesMsg: "You can select up to 10 hobbies",
      duplicateHobby: "Duplicate Hobby",
      duplicateHobbyMsg: "You've already added this hobby",
      selectOneHobby: "Please select at least one hobby",
      loadError: "Failed to load profile",
      saveError: "Failed to save interests"
    },
    personality: {
      heightTitle: "How tall are you?",
      mbtiTitle: "What's your personality type?",
      mbtiSubtitle: "Myers-Briggs helps predict compatibility",
      loveLanguageTitle: "What's your love language?",
      loveLanguageSubtitle: "Select all that resonate with you",
      languagesTitle: "What languages do you speak?",
      languagesSubtitle: "Select all that apply",
      faithTitle: "What's your faith?",
      faithSubtitle: "Shared values matter in a partnership",
      politicsTitle: "What are your political views?",
      politicsSubtitle: "Understanding each other's perspective",
      dontKnow: "Don't know",
      wordsOfAffirmation: "Words of Affirmation",
      qualityTime: "Quality Time",
      receivingGifts: "Receiving Gifts",
      actsOfService: "Acts of Service",
      physicalTouch: "Physical Touch",
      notSure: "Not sure",
      ft: "FT",
      cm: "CM",
      saveError: "Failed to save information",
      lang: {
        english: "English",
        spanish: "Spanish",
        french: "French",
        arabic: "Arabic",
        mandarin: "Mandarin",
        hindi: "Hindi",
        portuguese: "Portuguese",
        russian: "Russian",
        japanese: "Japanese",
        german: "German",
        korean: "Korean",
        italian: "Italian",
        turkish: "Turkish",
        persian: "Persian/Farsi",
        urdu: "Urdu",
        tagalog: "Tagalog",
        vietnamese: "Vietnamese",
        thai: "Thai",
        polish: "Polish",
        dutch: "Dutch",
        bengali: "Bengali",
        swahili: "Swahili",
        asl: "ASL (Sign Language)",
        other: "Other"
      },
      religion: {
        christian: "Christian",
        muslim: "Muslim",
        jewish: "Jewish",
        hindu: "Hindu",
        buddhist: "Buddhist",
        sikh: "Sikh",
        atheist: "Atheist",
        agnostic: "Agnostic",
        spiritual: "Spiritual but not religious",
        preferNotToSay: "Prefer not to say"
      },
      politics: {
        liberal: "Liberal",
        conservative: "Conservative",
        moderate: "Moderate",
        progressive: "Progressive",
        libertarian: "Libertarian",
        apolitical: "Apolitical",
        preferNotToSay: "Prefer not to say"
      }
    },
    notifications: {
      title: "Never miss a message",
      subtitle: "Get notified about matches and messages",
      finishing: "Finishing...",
      startMatching: "Start Matching!",
      neverMissMatch: "Never miss a match",
      enabledBadge: "Enabled",
      alertsDesc: "Get instant alerts when you match, receive messages, or someone likes your profile.",
      enableButton: "Enable Notifications",
      allSet: "You're all set!",
      almostThere: "Almost There!",
      almostThereDesc: "You're all set to start finding compatible partners. You can always update your preferences later in Settings.",
      enabled: "Notifications Enabled!",
      enabledMsg: "You'll now receive updates about matches, messages, and activity.",
      notAvailable: "Notifications Not Available",
      notAvailableMsg: "Notifications require a physical device. You can enable them later in Settings.",
      permissionDenied: "Permission Denied",
      permissionDeniedMsg: "Please enable notifications in your device settings to receive match alerts.",
      photosRequired: "Photos Required",
      photosRequiredMsg: "Please add at least 2 photos to complete your profile.",
      completeError: "Failed to complete onboarding"
    },
    matchingPreferences: {
      ageTitle: "Age preference",
      ageSubtitle: "Set the age range you're looking for",
      distanceTitle: "Search distance",
      distanceSubtitle: "How far are you willing to look?",
      genderTitle: "Who are you interested in?",
      genderSubtitle: "Select all that apply",
      lookingForAges: "Looking for ages {{min}} - {{max}}",
      minAge: "Minimum Age: {{age}}",
      maxAge: "Maximum Age: {{age}}",
      miles: "Miles",
      kilometers: "Kilometers",
      maxDistance: "Maximum Distance: {{distance}}",
      willingToRelocate: "Willing to relocate for the right match",
      selectGenderPreference: "Please select at least one gender preference",
      saveError: "Failed to save preferences"
    },
    marriagePreferences: {
      step0Title: "Why a lavender marriage?",
      step0Subtitle: "Select all reasons that apply to you",
      step1Title: "What type of relationship?",
      step1Subtitle: "Choose your preferred dynamic",
      step2Title: "Do you want children?",
      step2Subtitle: "This helps find compatible partners",
      step3Title: "Living arrangements",
      step3Subtitle: "Select all options you're open to",
      step4Title: "Financial expectations",
      step4Subtitle: "Select all arrangements you're open to",
      step5Title: "Lifestyle preferences",
      step5Subtitle: "These help refine your matches",
      step6Title: "Your non-negotiables",
      step6Subtitle: "What are your must-haves and dealbreakers?",
      reason: {
        financial: "Financial Stability",
        immigration: "Immigration/Visa",
        familyPressure: "Family Pressure",
        legalBenefits: "Legal Benefits",
        companionship: "Companionship",
        safety: "Safety & Protection"
      },
      relationship: {
        platonic: "Platonic Only",
        romantic: "Romantic Possible",
        open: "Open Arrangement"
      },
      children: {
        biological: "Biological Children",
        adoption: "Adoption",
        surrogacy: "Surrogacy",
        ivf: "IVF/Fertility Treatments",
        coParenting: "Co-Parenting",
        fostering: "Fostering",
        alreadyHave: "Already Have Children",
        openToDiscussion: "Open to Discussion",
        maybeOpen: "Maybe / Open"
      },
      childrenArrangementLabel: "How would you like to have children? (optional)",
      housing: {
        separateSpaces: "Separate Bedrooms/Spaces",
        roommates: "Live Like Roommates",
        separateHomes: "Separate Homes Nearby",
        sharedBedroom: "Shared Bedroom",
        flexible: "Flexible/Negotiable"
      },
      financial: {
        separate: "Keep Finances Separate",
        sharedExpenses: "Share Bills/Expenses",
        joint: "Joint Finances",
        prenupRequired: "Prenup Required",
        flexible: "Flexible/Negotiable"
      },
      lifestyle: {
        smokingTitle: "Smoking",
        drinkingTitle: "Drinking",
        petsTitle: "Pets",
        never: "Never",
        socially: "Socially",
        regularly: "Regularly",
        tryingToQuit: "Trying to Quit",
        preferNotToSay: "Prefer Not to Say",
        loveThem: "Love Them",
        likeThem: "Like Them",
        indifferent: "Indifferent",
        allergic: "Allergic",
        dontLike: "Don't Like"
      },
      mustHavesTitle: "Must-haves in a partner",
      mustHavesPlaceholder: "e.g., Good communication",
      dealbreakersTitle: "Dealbreakers",
      dealbreakersPlaceholder: "e.g., Smoking",
      errors: {
        selectReason: "Please select at least one reason",
        selectRelationship: "Please select your preferred relationship type",
        selectChildren: "Please indicate your preference about children",
        selectHousing: "Please select at least one housing preference",
        selectFinancial: "Please select at least one financial arrangement preference",
        saveFailed: "Failed to save preferences"
      }
    },
    promptsStep: {
      step0Title: "Tell your story",
      step0Subtitle: "Answer prompts to spark meaningful conversations",
      step1Title: "Add another prompt",
      step1Subtitle: "More prompts means more conversation starters",
      step2Title: "One more prompt",
      step2Subtitle: "Three prompts give the best results",
      writeYourOwn: "Write your own prompt",
      customLabel: "Create a unique question that helps showcase your personality",
      customPlaceholder: "e.g., What I'm most excited to share with a partner is...",
      useThisPrompt: "Use This Prompt",
      minimumChars: "Minimum 10 characters",
      choosePrompt: "Choose a prompt",
      answerPlaceholder: "Your answer...",
      proTips: "Pro Tips",
      tip1: "Be specific and authentic",
      tip2: "Show your personality - humor and honesty work",
      tip3: "Focus on what matters in a partnership",
      invalidPrompt: "Invalid Prompt",
      inappropriateContent: "Inappropriate Content",
      answerAtLeastOne: "Please answer at least one prompt",
      invalidResponse: "Invalid Response",
      saveFailed: "Failed to save prompts"
    },
    voiceIntro: {
      title: "Add your voice",
      subtitle: "Record a 30-second introduction to stand out",
      choosePrompt: "Choose a prompt to answer",
      writeMyOwn: "Write my own",
      customPlaceholder: "Type your own prompt...",
      recordingHint: "Recording... Tap to stop",
      tapToRecord: "Tap the microphone to start recording",
      yourVoiceIntro: "Your voice intro",
      deleteRerecord: "Delete & Re-record",
      tipsTitle: "Recording Tips",
      tip1: "Find a quiet space with minimal background noise",
      tip2: "Introduce yourself, share what you're looking for",
      tip3: "Be authentic - your voice shows personality",
      tip4: "Profiles with voice intros get 3x more matches",
      micPermissionTitle: "Microphone Permission Required",
      micPermissionMessage: "To record a voice intro, please enable microphone access in your device settings.",
      prompt1: "A story I love to tell...",
      prompt2: "My hot take is...",
      prompt3: "The way to my heart is...",
      prompt4: "I'm looking for someone who...",
      prompt5: "Something that always makes me laugh...",
      prompt6: "My perfect Sunday looks like...",
      prompt7: "I get way too excited about...",
      prompt8: "The best trip I ever took..."
    },
    additionalErrors: {
      enterHometown: "Please enter your hometown.",
      enterOccupation: "Please enter your occupation.",
      enterEducation: "Please enter your education.",
      notAuthenticatedMessage: "Not authenticated. Please sign in again."
    }
  },

  settings: {
    matchingPreferences: {
      title: "Matching Preferences",
      loading: "Loading preferences...",
      coreDealbreakers: "Core Dealbreakers",
      coreDealbreakerDesc: "These preferences automatically filter your matches to find the most compatible partners.",
      seeking: "Seeking",
      genderPreference: "Gender Preference",
      genderPreferenceDesc: "Who you're interested in matching with",
      children: "Children",
      wantChildren: "Do you want children?",
      childrenDesc: "Filter out incompatible matches",
      childrenYes: "Yes",
      childrenNo: "No",
      childrenMaybe: "Maybe",
      relationshipType: "Relationship Type",
      whatRelationship: "What type of relationship?",
      preferredArrangement: "Your preferred arrangement",
      platonic: "Platonic",
      romantic: "Romantic",
      open: "Open",
      ageRange: "Age Range",
      ageRangeDesc: "Show matches in this age range",
      yearsOld: "{{min}} - {{max}} years old",
      minAge: "Minimum Age: {{age}}",
      maxAge: "Maximum Age: {{age}}",
      distance: "Distance",
      maxDistanceDesc: "Maximum distance for matches",
      miles: "Miles",
      kilometers: "Kilometers",
      willingToRelocate: "Willing to relocate",
      relocateDesc: "Consider matches outside your max distance",
      searchGlobally: "Search globally",
      searchGloballyDesc: "Match with people anywhere in the world",
      locationPreferences: "Location Preferences",
      preferredCities: "Preferred Cities",
      preferredCitiesDesc: "Add cities you're interested in...",
      searchCitiesPlaceholder: "Search cities (e.g., Tokyo, Mumbai, NYC)",
      citiesAdded: "{{count}}/2 cities added",
      noCitiesEmpty: "No preferred cities yet. Add cities where you'd like to find matches!",
      lifestylePreferences: "Lifestyle Preferences",
      smoking: "Smoking",
      smokingNever: "Never",
      smokingSocially: "Socially",
      smokingRegularly: "Regularly",
      smokingTryingToQuit: "Trying to Quit",
      drinking: "Drinking",
      drinkingNever: "Never",
      drinkingSocially: "Socially",
      drinkingRegularly: "Regularly",
      drinkingPreferNotToSay: "Prefer Not to Say",
      pets: "Pets",
      petsLove: "Love Them",
      petsLike: "Like Them",
      petsIndifferent: "Indifferent",
      petsAllergic: "Allergic",
      petsDontLike: "Don't Like",
      save: "Save Preferences",
      loadError: "Failed to load matching preferences",
      profileNotFound: "Profile not found",
      saveSuccess: "Your matching preferences have been updated! Your discover feed will refresh.",
      saveError: "Failed to save preferences. Please try again.",
      limitReached: "Limit Reached",
      cityLimit: "You can add up to 2 preferred cities."
    },
    blockedUsers: {
      title: "Blocked Users",
      loading: "Loading blocked users...",
      emptyTitle: "No Blocked Users",
      emptyText: "You haven't blocked anyone yet.\nBlocked users will appear here.",
      unblockTitle: "Unblock User",
      unblockConfirm: "Are you sure you want to unblock {{name}}? They will be able to see your profile and send you messages again.",
      unblock: "Unblock",
      unblocked: "Unblocked",
      unblockedMsg: "{{name}} has been unblocked.",
      unblockError: "Failed to unblock user. Please try again.",
      loadProfileError: "Failed to load your profile. Please try again.",
      loadError: "Failed to load blocked users. Please try again.",
      blockedDate: "Blocked {{time}}"
    }
  },

  discover: {
    completeProfile: {
      title: "Complete Your Profile",
      message: "You need to finish setting up your profile before you can start matching.",
      button: "Complete Profile"
    },
    premium: {
      upgradeTitle: "Upgrade to Premium",
      superLikesMessage: "Super likes are a Premium feature! Upgrade to send 5 super likes per week.",
      superLikeLimitTitle: "Super Like Limit Reached",
      superLikeLimitMessage: "You've used all 5 super likes this week. Your super likes will reset next {{day}}.",
      rewindMessage: "Rewind is a Premium feature! Upgrade to undo your last swipe."
    },
    intention: {
      all: "All",
      platonic: "Platonic",
      romantic: "Romantic",
      open: "Open"
    },
    swipe: {
      like: "LIKE",
      nope: "NOPE",
      obsessed: "OBSESSED"
    },
    card: {
      matchPercent: "{{score}}% Match"
    },
    tutorial: {
      browsePhotos: "Browse Photos",
      instructions: "Tap the left or right side of the photo to see more pictures. Tap the center to view their full profile.",
      previous: "Previous",
      profile: "Profile",
      next: "Next",
      gotIt: "Got it!"
    },
    like: {
      likedPhoto: "Liked their photo",
      placeholder: "Say something nice...",
      sendWithComment: "Send Like with Comment",
      sendLike: "Send Like",
      obsessed: "Obsessed"
    }
  },

  chat: {
    unavailable: {
      title: "Chat Unavailable",
      message: "This user is no longer available."
    },
    version: {
      updateRequired: "Please update your app to continue messaging."
    },
    encryption: {
      sentWithout: "Message sent without encryption",
      restartToEnable: "Restart app to enable encryption."
    },
    chatPhoto: {
      selectDifferent: "Please select a different photo",
      rejectedTitle: "Photo Rejected",
      rejectedMessage: "This photo contains inappropriate content and cannot be sent."
    },
    chatNotification: {
      sentPhoto: "Sent a photo",
      sentVoice: "Sent a voice message"
    },
    premiumFeature: {
      featureTitle: "Premium Feature",
      voiceMessagesMessage: "Voice messages are a Premium feature. Upgrade to send voice messages.",
      deleteMessage: "Delete messages you've sent! Upgrade to Premium to unlock message deletion.",
      reactionsMessage: "React to messages with emojis! Upgrade to Premium to unlock message reactions."
    },
    messageActions: {
      whatToDo: "What would you like to do?",
      chooseAction: "Choose an action",
      report: "Report",
      block: "Block"
    }
  },

  likes: {
    freeUser: {
      dailyLimitTitle: "Daily limit reached",
      dailyLimitMessage: "You've used all 5 likes for today. Upgrade for unlimited!",
      revealPhoto: "Reveal Photo",
      likesRemaining: "{{count}} like(s) remaining today",
      noLikesRemaining: "No likes remaining today",
      upgradeBanner: "Upgrade to reveal photos & get unlimited likes"
    },
    likedYourPhoto: "Liked your photo"
  },

  profile: {
    sections: {
      activityMatching: "Activity & Matching",
      settings: "Settings",
      reviews: "Reviews",
      safetyPrivacy: "Safety & Privacy",
      subscription: "Subscription",
      support: "Support",
      adminTools: "Admin Tools"
    },
    support: {
      emailSubject: "Support Request",
      emailBody: "Hi Accord Team,\n\n",
      contactTitle: "Contact Support",
      contactMessage: "Email us at hello@joinaccord.app"
    },
    admin: {
      photoVerification: "Photo Verification",
      resetUserAttempts: "Reset user attempts",
      photoReviews: "Photo Reviews",
      reviewFlaggedPhotos: "Review flagged user photos",
      previewOnboarding: "Preview Onboarding",
      viewOnboardingScreens: "View all onboarding screens",
      previewForceUpdate: "Preview Force Update",
      viewUpdateModal: "View the update modal design"
    },
    preview: {
      loading: "Loading preview...",
      notFound: "Profile not found"
    }
  },

  auth: {
    restricted: {
      title: "Account Restricted",
      message: "This account has been restricted from using Accord. If you believe this is an error, please contact support at hello@joinaccord.app."
    }
  },

  onboardingPhotos: {
    subtitle: "Upload 2-6 photos. Your first photo will be your profile picture.",
    uploading: "Uploading... {{progress}}%",
    primary: "Primary",
    processing: "Processing...",
    addPhoto: "Add Photo",
    counter: "{{count}} of 6 photos",
    minimumTwo: "(minimum 2)",
    tipsTitle: "Photo Tips",
    tip1: "Use clear, recent photos",
    tip2: "Show your face clearly",
    tip3: "Include variety (close-up, full body, activity)",
    tip4: "Avoid group photos as your primary",
    inappropriateContent: "This photo contains inappropriate content and cannot be uploaded. Please choose a different photo."
  }
};

deepMerge(existing, newKeys);

fs.writeFileSync(enPath, JSON.stringify(existing, null, 2) + '\n');
console.log('Successfully merged', Object.keys(newKeys).length, 'top-level sections into en.json');

// Count total new keys added
function countKeys(obj) {
  let count = 0;
  for (const key of Object.keys(obj)) {
    if (typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      count += countKeys(obj[key]);
    } else {
      count++;
    }
  }
  return count;
}
console.log('Total new leaf keys:', countKeys(newKeys));
