/**
 * Content Moderation for Accord
 *
 * POLICY: Only block words that would get you demonetized on YouTube.
 * We want to be permissive and allow normal conversation.
 *
 * This means we ONLY block:
 * - Racial/ethnic slurs
 * - Severe profanity (F-word, C-word, etc.)
 * - Hate speech terms
 *
 * We DO NOT block:
 * - Mild profanity (damn, hell, crap, etc.)
 * - Normal English words that happen to contain "bad" substrings
 * - Dating-related terms (users can discuss what they're looking for)
 * - Contact information (phone, email, social media) - users can share freely
 *
 * NOTE: Contact info detection has been DISABLED to match industry standard
 * (Hinge, Tinder, Bumble don't block contact sharing either).
 */

// Severe profanity and slurs that would get you demonetized on YouTube
// Based on YouTube's Community Guidelines for demonetization
// NOTE: We deliberately EXCLUDE words that are commonly used in LGBTQ+ spaces
// or could cause false positives in normal dating conversation
const severeBlockList = [
  // === RACIAL/ETHNIC SLURS ===
  'nigger', 'nigga', 'nigg3r', 'n1gger', 'n1gga', 'n!gger', 'n!gga',
  'chink', 'ch1nk',
  'spic', 'sp1c', 'spick',
  'wetback', 'wet back',
  'kike', 'k1ke', 'kyke',
  'gook', 'g00k',
  'raghead', 'rag head',
  'towelhead', 'towel head',
  'beaner',
  'coon',
  'darkie', 'darky',
  'jigaboo', 'jiggaboo',
  'porch monkey',
  'jungle bunny',
  'sand nigger', 'sand n1gger',
  'zipperhead',
  'camel jockey',
  'chinaman',
  'redskin',
  'injun',
  'squaw',

  // === HOMOPHOBIC/TRANSPHOBIC SLURS ===
  // Note: We do NOT block "queer", "homo", "gay" as these are reclaimed terms
  // and this is an LGBTQ+ dating app
  'faggot', 'f4ggot', 'fagg0t', 'fgt',
  'dyke', 'd1ke', // when used as slur
  'tranny', 'tr4nny',
  'shemale', 'she-male', 'sh3male',

  // === SEVERE PROFANITY (YouTube demonetization level) ===
  // F-word and variants
  'fuck', 'f*ck', 'fck', 'f-ck', 'fuk', 'fuq', 'fvck', 'phuck', 'phuk',
  'fucked', 'fucker', 'fucking', 'fuckhead', 'fuckface', 'fuckwit',
  'motherfucker', 'motherfucking',

  // C-word (always blocked)
  'cunt', 'c-unt', 'cvnt', 'c*nt', 'kunt',

  // S-word (shit) - YouTube does demonetize for this
  'shit', 'sh1t', 'sh!t', 'shyt',
  'bullshit', 'bullsh1t',
  'shithead', 'shitface',

  // A-hole variants
  'asshole', 'a$$hole', 'arsehole',

  // Slurs used against women
  'whore', 'wh0re',
  'slut', 'sl*t',

  // === HATE SPEECH / ABLEIST TERMS ===
  'retard', 'retarded', 'r3tard', 'r3tarded',
  'spaz', 'spastic',

  // === VIOLENT/THREATENING ===
  'kill yourself', 'kys',
  'neck yourself',
];

// Dating app specific scam terms (keep blocking these for safety)
const scamTerms = [
  'sugar daddy',
  'sugar baby',
  'findom',
  'paypig',
  'pay pig',
  'send me money',
  'cashapp me',
  'venmo me',
  'paypal me',
];

export interface ModerationResult {
  isClean: boolean;
  profaneWords?: string[];
  cleanedText?: string;
  isGibberish?: boolean;
}

/**
 * Detect if text is gibberish (keyboard mashing, random characters)
 *
 * Gibberish indicators:
 * - Very low vowel ratio (real text has ~40% vowels)
 * - Long sequences of consonants (8+ in a row)
 * - Repeated character patterns
 * - No recognizable words
 */
export function detectGibberish(text: string): boolean {
  if (!text || text.trim().length < 10) {
    return false; // Too short to determine
  }

  const cleanText = text.toLowerCase().replace(/[^a-z]/g, '');

  if (cleanText.length < 5) {
    return false; // Not enough letters to analyze
  }

  const vowels = cleanText.match(/[aeiou]/g) || [];
  const consonants = cleanText.match(/[bcdfghjklmnpqrstvwxyz]/g) || [];

  // Check vowel ratio - real English text has ~38-42% vowels
  // Gibberish typically has <15% vowels
  const vowelRatio = vowels.length / cleanText.length;
  if (vowelRatio < 0.15) {
    return true;
  }

  // Check for long consonant sequences (8+ consonants in a row is very rare in real text)
  const longConsonantSequence = /[bcdfghjklmnpqrstvwxyz]{8,}/i;
  if (longConsonantSequence.test(cleanText)) {
    return true;
  }

  // Check for repeated character patterns (e.g., "bbbbb", "xyzxyz")
  const repeatedChars = /(.)\1{4,}/; // Same character 5+ times
  if (repeatedChars.test(cleanText)) {
    return true;
  }

  // Check for repeated 2-3 char patterns (e.g., "hshshshs", "xyzxyzxyz")
  const repeatedPatterns = /(.{2,3})\1{3,}/;
  if (repeatedPatterns.test(cleanText)) {
    return true;
  }

  // Check against common English words - if none found in a long text, likely gibberish
  const commonWords = [
    'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
    'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how',
    'its', 'may', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy',
    'did', 'own', 'say', 'she', 'too', 'use', 'your', 'each', 'make',
    'like', 'look', 'more', 'want', 'give', 'most', 'only', 'over', 'such',
    'take', 'than', 'them', 'well', 'were', 'what', 'when', 'will', 'with',
    'have', 'this', 'from', 'they', 'been', 'call', 'come', 'could', 'find',
    'first', 'into', 'just', 'know', 'long', 'made', 'many', 'much', 'need',
    'part', 'people', 'some', 'then', 'these', 'thing', 'think', 'time',
    'very', 'work', 'would', 'year', 'about', 'after', 'being', 'good',
    'great', 'little', 'love', 'partner', 'together', 'life', 'live',
    'home', 'family', 'friend', 'marriage', 'relationship', 'support',
    // Spanish common words (for international users)
    'que', 'con', 'una', 'por', 'para', 'como', 'pero', 'sus', 'mas',
    // French common words
    'les', 'des', 'est', 'pas', 'que', 'une', 'sur', 'pour', 'avec',
  ];

  const words = text.toLowerCase().split(/\s+/);
  const recognizedWords = words.filter(word => {
    const cleanWord = word.replace(/[^a-z]/g, '');
    return cleanWord.length >= 2 && commonWords.includes(cleanWord);
  });

  // If text is longer than 30 chars but has no common words, likely gibberish
  if (cleanText.length > 30 && recognizedWords.length === 0) {
    // Double check - maybe it's a different language with proper structure
    // Real text (even non-English) will have vowel patterns
    if (vowelRatio < 0.25) {
      return true;
    }
  }

  return false;
}

/**
 * Check if text contains severely inappropriate content
 * Only blocks YouTube-demonetization-level words
 */
export function moderateText(text: string): ModerationResult {
  if (!text || text.trim().length === 0) {
    return { isClean: true };
  }

  const lowerText = text.toLowerCase();
  const foundWords: string[] = [];

  // Check against severe block list
  for (const word of severeBlockList) {
    // Use word boundary check to avoid false positives
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lowerText)) {
      foundWords.push(word);
    }
  }

  // Check against scam terms
  for (const term of scamTerms) {
    if (lowerText.includes(term.toLowerCase())) {
      foundWords.push(term);
    }
  }

  if (foundWords.length > 0) {
    return {
      isClean: false,
      profaneWords: [...new Set(foundWords)],
    };
  }

  return { isClean: true };
}

/**
 * Clean text by replacing profanity with asterisks
 */
export function cleanText(text: string): string {
  if (!text || text.trim().length === 0) {
    return text;
  }

  let cleanedText = text;

  for (const word of severeBlockList) {
    const regex = new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    cleanedText = cleanedText.replace(regex, '*'.repeat(word.length));
  }

  return cleanedText;
}

/**
 * Validate profile display name
 */
export function validateDisplayName(displayName: string): ModerationResult {
  return moderateText(displayName);
}

/**
 * Validate profile bio
 */
export function validateBio(bio: string): ModerationResult {
  return moderateText(bio);
}

/**
 * Validate prompt answer
 */
export function validatePromptAnswer(answer: string): ModerationResult {
  return moderateText(answer);
}

/**
 * Validate chat message
 */
export function validateMessage(message: string): ModerationResult {
  return moderateText(message);
}

/**
 * Get user-friendly error message for moderation failure
 */
export function getModerationErrorMessage(fieldName: string = 'text'): string {
  return `Your ${fieldName} contains inappropriate language. Please remove any offensive words and try again.`;
}

/**
 * Check if text contains contact information
 *
 * DISABLED: Like Hinge, Tinder, and Bumble, we no longer block contact sharing.
 * Users should be free to exchange contact info when they're ready.
 * This function is kept for API compatibility but always returns false.
 */
export function containsContactInfo(text: string): boolean {
  // Contact info detection is disabled - users can share freely like on other dating apps
  return false;
}

/**
 * Comprehensive content validation for user-generated content
 */
export function validateContent(
  text: string,
  options: {
    checkProfanity?: boolean;
    checkContactInfo?: boolean;
    checkGibberish?: boolean;
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
    checkGibberish = false,
    fieldName = 'text',
  } = options;

  if (!text || text.trim().length === 0) {
    return { isValid: true };
  }

  // Check for gibberish (keyboard mashing)
  if (checkGibberish && detectGibberish(text)) {
    return {
      isValid: false,
      error: `Your ${fieldName} doesn't appear to contain meaningful text. Please write a real response that others can understand.`,
      moderationResult: { isClean: false, isGibberish: true },
    };
  }

  // Check profanity (YouTube-level only)
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
