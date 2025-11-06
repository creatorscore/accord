import Filter from 'bad-words';

// LGBTQ+-specific terms that should NOT be filtered
const lgbtqAllowList = [
  'queer',
  'gay',
  'lesbian',
  'trans',
  'transgender',
  'bisexual',
  'pansexual',
  'asexual',
  'nonbinary',
  'genderqueer',
];

// Additional inappropriate terms specific to dating apps
const datingAppBlockList = [
  // Scam-related
  'sugar daddy',
  'sugar baby',
  'findom',
  'paypig',
  'cashapp',
  'venmo',
  'paypal',
  // Explicit solicitation
  'hookup',
  'netflix and chill',
  'dtf',
  'nsa',
  'fwb',
];

// Lazy initialization of filter (with fallback for Expo Go)
let filter: any = null;
let filterInitialized = false;

function getFilter() {
  if (filterInitialized) return filter;

  try {
    filter = new Filter();

    // Remove LGBTQ+ terms from the filter's word list
    lgbtqAllowList.forEach(word => {
      filter.removeWords(word);
    });

    // Add dating app specific terms
    filter.addWords(...datingAppBlockList);

    filterInitialized = true;
    return filter;
  } catch (error) {
    // Fallback for Expo Go - bad-words not available
    console.log('bad-words package not available, using basic fallback');
    filterInitialized = true;
    return null;
  }
}

// Fallback profanity check for when bad-words is not available
function fallbackProfanityCheck(text: string): { isProfane: boolean; words: string[] } {
  if (!text) return { isProfane: false, words: [] };

  const lowerText = text.toLowerCase();
  const foundWords: string[] = [];

  // Check against block list
  for (const word of datingAppBlockList) {
    if (lowerText.includes(word.toLowerCase())) {
      foundWords.push(word);
    }
  }

  return {
    isProfane: foundWords.length > 0,
    words: foundWords
  };
}

// Fallback text cleaning
function fallbackCleanText(text: string): string {
  if (!text) return text;

  let cleanedText = text;

  for (const word of datingAppBlockList) {
    const regex = new RegExp(word, 'gi');
    cleanedText = cleanedText.replace(regex, '*'.repeat(word.length));
  }

  return cleanedText;
}

export interface ModerationResult {
  isClean: boolean;
  profaneWords?: string[];
  cleanedText?: string;
}

/**
 * Check if text contains profanity or inappropriate content
 * @param text - The text to check
 * @returns ModerationResult with isClean flag and detected words
 */
export function moderateText(text: string): ModerationResult {
  if (!text || text.trim().length === 0) {
    return { isClean: true };
  }

  const filterInstance = getFilter();

  // Use fallback if bad-words is not available
  if (!filterInstance) {
    const fallbackResult = fallbackProfanityCheck(text);
    return {
      isClean: !fallbackResult.isProfane,
      profaneWords: fallbackResult.words
    };
  }

  const isProfane = filterInstance.isProfane(text);

  if (!isProfane) {
    return { isClean: true };
  }

  // Get the profane words that were detected
  const words = text.toLowerCase().split(/\s+/);
  const profaneWords = words.filter(word => filterInstance.isProfane(word));

  return {
    isClean: false,
    profaneWords: [...new Set(profaneWords)], // Remove duplicates
  };
}

/**
 * Clean text by replacing profanity with asterisks
 * @param text - The text to clean
 * @returns Cleaned text with profanity replaced
 */
export function cleanText(text: string): string {
  if (!text || text.trim().length === 0) {
    return text;
  }

  const filterInstance = getFilter();

  // Use fallback if bad-words is not available
  if (!filterInstance) {
    return fallbackCleanText(text);
  }

  return filterInstance.clean(text);
}

/**
 * Validate profile display name
 * @param displayName - The display name to validate
 * @returns ModerationResult
 */
export function validateDisplayName(displayName: string): ModerationResult {
  const result = moderateText(displayName);

  if (!result.isClean) {
    return {
      ...result,
      cleanedText: cleanText(displayName),
    };
  }

  return result;
}

/**
 * Validate profile bio
 * @param bio - The bio text to validate
 * @returns ModerationResult
 */
export function validateBio(bio: string): ModerationResult {
  const result = moderateText(bio);

  if (!result.isClean) {
    return {
      ...result,
      cleanedText: cleanText(bio),
    };
  }

  return result;
}

/**
 * Validate prompt answer
 * @param answer - The prompt answer to validate
 * @returns ModerationResult
 */
export function validatePromptAnswer(answer: string): ModerationResult {
  const result = moderateText(answer);

  if (!result.isClean) {
    return {
      ...result,
      cleanedText: cleanText(answer),
    };
  }

  return result;
}

/**
 * Validate chat message
 * @param message - The message to validate
 * @returns ModerationResult
 */
export function validateMessage(message: string): ModerationResult {
  const result = moderateText(message);

  if (!result.isClean) {
    return {
      ...result,
      cleanedText: cleanText(message),
    };
  }

  return result;
}

/**
 * Get user-friendly error message for moderation failure
 * @param fieldName - The name of the field that failed moderation
 * @returns User-friendly error message
 */
export function getModerationErrorMessage(fieldName: string = 'text'): string {
  return `Your ${fieldName} contains inappropriate language. Please remove any offensive words and try again.`;
}

/**
 * Check if text contains contact information (phone, email, social media)
 * This helps prevent users from sharing contact info too early
 * @param text - The text to check
 * @returns true if contact info detected
 */
export function containsContactInfo(text: string): boolean {
  if (!text) return false;

  const patterns = {
    phone: /(\+?1[-.]?)?\(?\d{3}\)?[-.]?\d{3}[-.]?\d{4}/,
    email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/,
    instagram: /@[\w.]+|instagram\.com\/[\w.]+/i,
    snapchat: /snapchat|snap\s*:/i,
    whatsapp: /whatsapp|wa\.me/i,
    telegram: /telegram|t\.me/i,
  };

  return Object.values(patterns).some(pattern => pattern.test(text));
}

/**
 * Comprehensive content validation for user-generated content
 * @param text - The text to validate
 * @param options - Validation options
 * @returns Validation result with specific error messages
 */
export function validateContent(
  text: string,
  options: {
    checkProfanity?: boolean;
    checkContactInfo?: boolean;
    fieldName?: string;
  } = {}
): {
  isValid: boolean;
  error?: string;
  moderationResult?: ModerationResult;
} {
  const {
    checkProfanity = true,
    checkContactInfo = false,
    fieldName = 'text',
  } = options;

  if (!text || text.trim().length === 0) {
    return { isValid: true };
  }

  // Check profanity
  if (checkProfanity) {
    const moderationResult = moderateText(text);
    if (!moderationResult.isClean) {
      return {
        isValid: false,
        error: getModerationErrorMessage(fieldName),
        moderationResult,
      };
    }
  }

  // Check contact information
  if (checkContactInfo && containsContactInfo(text)) {
    return {
      isValid: false,
      error: `Please don't share contact information in your ${fieldName}. Use in-app messaging to get to know matches first.`,
    };
  }

  return { isValid: true };
}
