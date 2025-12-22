import { Filter } from 'bad-words';

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

// Number word mappings for detection (including common variations)
const numberWords: { [key: string]: string } = {
  // Standard words
  'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
  'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
  'ten': '10',
  // Common substitutes
  'oh': '0', 'o': '0', 'nil': '0', 'nada': '0',
  'won': '1', 'wan': '1',
  'to': '2', 'too': '2', 'tu': '2',
  'tree': '3', 'free': '3', 'tre': '3',
  'fo': '4', 'for': '4', 'fore': '4', 'fourr': '4',
  'fiv': '5', 'fife': '5',
  'siks': '6', 'sic': '6', 'sixx': '6',
  'sevn': '7', 'sven': '7',
  'ate': '8', 'eit': '8', 'eigt': '8',
  'nein': '9', 'nyne': '9', 'nin': '9',
};

// Common character substitutions
const charSubstitutions: { [key: string]: string } = {
  '@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i', '0': 'o',
  '$': 's', '5': 's', '7': 't', '+': 't', '8': 'b',
};

/**
 * Normalize text by converting spelled-out numbers to digits
 * and removing common obfuscation characters
 */
function normalizeText(text: string): string {
  let normalized = text.toLowerCase();

  // Replace spelled-out numbers with digits
  for (const [word, digit] of Object.entries(numberWords)) {
    normalized = normalized.replace(new RegExp(`\\b${word}\\b`, 'gi'), digit);
  }

  // Remove common separators used to obfuscate
  normalized = normalized.replace(/[\s\-_.()\/\\,]+/g, '');

  return normalized;
}

/**
 * Extract a potential phone number from mixed digit/word sequences
 * Handles cases like "1, eight, 4, seven, seven, 5, six, 6, 8"
 */
function extractMixedPhoneNumber(text: string): string {
  const lowerText = text.toLowerCase();
  let result = '';

  // Split by common separators but keep the tokens
  const tokens = lowerText.split(/[\s,\-_.()\/\\]+/).filter(t => t.length > 0);

  for (const token of tokens) {
    // Check if it's a single digit
    if (/^\d$/.test(token)) {
      result += token;
    }
    // Check if it's a number word
    else if (numberWords[token]) {
      result += numberWords[token];
    }
    // Check for multi-digit numbers (like area codes written as "555")
    else if (/^\d+$/.test(token)) {
      result += token;
    }
  }

  return result;
}

/**
 * Normalize text with character substitutions for platform detection
 */
function normalizeForPlatformDetection(text: string): string {
  let normalized = text.toLowerCase();

  // Replace common character substitutions
  for (const [char, replacement] of Object.entries(charSubstitutions)) {
    normalized = normalized.replace(new RegExp(`\\${char}`, 'g'), replacement);
  }

  // Remove separators
  normalized = normalized.replace(/[\s\-_.]+/g, '');

  return normalized;
}

/**
 * Check if text contains contact information (phone, email, social media)
 * This helps prevent users from sharing contact info too early
 * Uses advanced detection to catch common evasion techniques like:
 * - Spaced numbers (5 5 5 - 1 2 3 - 4 5 6 7)
 * - Spelled out numbers (five five five...)
 * - Character substitutions (1nst@gram, wh@ts@pp)
 * - More social platforms (TikTok, Discord, Twitter, etc.)
 * @param text - The text to check
 * @returns true if contact info detected
 */
export function containsContactInfo(text: string): boolean {
  if (!text) return false;

  const lowerText = text.toLowerCase();
  const normalizedText = normalizeText(text);
  const platformNormalized = normalizeForPlatformDetection(text);
  const mixedPhoneDigits = extractMixedPhoneNumber(text);

  // === PHONE NUMBER DETECTION ===

  // Check for mixed digit/word phone numbers (like "1, eight, 4, seven, seven, 5, six, 6, 8")
  if (mixedPhoneDigits.length >= 7 && mixedPhoneDigits.length <= 15) {
    // If we extracted 7+ digits from mixed tokens, it's likely a phone number
    return true;
  }

  const phonePatterns = [
    // Standard formats (already normalized)
    /\d{10,11}/,
    // With country code
    /\+?\d{11,13}/,
    // Partial numbers that might be completed later
    /\d{7,}/,
  ];

  // Check normalized text for phone numbers
  if (phonePatterns.some(pattern => pattern.test(normalizedText))) {
    // Verify it looks like a phone number (not just any 7+ digit sequence)
    const digits = normalizedText.match(/\d+/g)?.join('') || '';
    if (digits.length >= 7 && digits.length <= 15) {
      // Additional check: look for phone-related context
      const phoneContextPatterns = [
        /call\s*me/i, /text\s*me/i, /my\s*(phone|number|cell|mobile)/i,
        /reach\s*(me|out)/i, /contact/i, /\#/i,
        /\d[\s\-_.]*\d[\s\-_.]*\d[\s\-_.]*\d[\s\-_.]*\d[\s\-_.]*\d[\s\-_.]*\d/,
      ];
      if (phoneContextPatterns.some(p => p.test(text)) || digits.length >= 10) {
        return true;
      }
    }
  }

  // === EMAIL DETECTION ===

  // Normalize text for email provider detection (remove spaces, common substitutions)
  const emailNormalized = lowerText
    .replace(/\s+/g, '')           // Remove spaces: "g mail" -> "gmail"
    .replace(/male$/g, 'mail')     // "gmale" -> "gmail"
    .replace(/mai1/g, 'mail')      // "gmai1" -> "gmail"
    .replace(/ma1l/g, 'mail')      // "gma1l" -> "gmail"
    .replace(/m@il/g, 'mail')      // "gm@il" -> "gmail"
    .replace(/meil/g, 'mail');     // "gmeil" -> "gmail"

  const emailPatterns = [
    // Standard email
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i,
    // Obfuscated @ symbol
    /[a-zA-Z0-9._%+-]+\s*(\(at\)|\[at\]|at|@)\s*[a-zA-Z0-9.-]+\s*(\(dot\)|\[dot\]|dot|\.)\s*[a-zA-Z]{2,}/i,
    // "email me" with potential handle
    /email\s*(me\s*)?[:@]?\s*[a-zA-Z0-9._-]+/i,
  ];

  if (emailPatterns.some(pattern => pattern.test(text))) {
    return true;
  }

  // Email provider detection with space/character variations
  // Catches: "g mail", "g mal", "g male", "gee mail", "ji mail", etc.
  const emailProviderPatterns = [
    // Gmail variations
    /\b(g\s*mail|g\s*male|g\s*mal|gee\s*mail|ji\s*mail|gm\s*ail|gmail)\b/i,
    /\bg[\s\-_.]*m[\s\-_.]*a[\s\-_.]*i[\s\-_.]*l\b/i,
    // Yahoo variations
    /\b(ya\s*hoo|yah\s*oo|y\s*a\s*h\s*o\s*o|yahoo)\b/i,
    // Hotmail variations
    /\b(hot\s*mail|hot\s*male|h\s*o\s*t\s*m\s*a\s*i\s*l|hotmail)\b/i,
    // Outlook variations
    /\b(out\s*look|out\s*lok|outlook)\b/i,
    // iCloud variations
    /\b(i\s*cloud|eye\s*cloud|icloud)\b/i,
    // Protonmail variations
    /\b(proton\s*mail|proton\s*male|protonmail)\b/i,
    // AOL
    /\b(a\s*o\s*l|aol)\b/i,
  ];

  if (emailProviderPatterns.some(pattern => pattern.test(lowerText))) {
    return true;
  }

  // Check normalized version for providers
  if (/gmail|yahoo|hotmail|outlook|icloud|protonmail|aol/.test(emailNormalized)) {
    return true;
  }

  // === SOCIAL MEDIA PLATFORMS ===
  const socialPatterns = [
    // Instagram
    { pattern: /\b(instagram|insta|ig)\b/i, normalized: /instagram|insta/ },
    { pattern: /@[\w.]{3,30}/i }, // Generic @ handles

    // Snapchat
    { pattern: /\b(snapchat|snap\s*chat|snap)\b/i, normalized: /snapchat|snap/ },
    { pattern: /\badd\s*(me\s*on\s*)?(snap|sc)\b/i },

    // WhatsApp
    { pattern: /\b(whatsapp|whats\s*app|wa)\b/i, normalized: /whatsapp|whatsap/ },
    { pattern: /wa\.me/i },

    // Telegram
    { pattern: /\b(telegram|tele\s*gram|tg)\b/i, normalized: /telegram/ },
    { pattern: /t\.me\//i },

    // TikTok
    { pattern: /\b(tiktok|tik\s*tok|tt)\b/i, normalized: /tiktok|tiktak/ },

    // Discord
    { pattern: /\b(discord|disc)\b/i, normalized: /discord|disc0rd/ },
    { pattern: /[\w]+#\d{4}/i }, // Discord username#1234

    // Twitter/X
    { pattern: /\b(twitter|tweet|x\.com)\b/i, normalized: /twitter/ },

    // Facebook
    { pattern: /\b(facebook|fb|messenger)\b/i, normalized: /facebook|faceb00k/ },
    { pattern: /fb\.me\//i },

    // Signal
    { pattern: /\bsignal\s*(app)?\b/i },

    // Line
    { pattern: /\bline\s*(id|app)\b/i },
    { pattern: /line\.me\//i },

    // WeChat
    { pattern: /\b(wechat|we\s*chat|weixin)\b/i, normalized: /wechat/ },

    // Kik
    { pattern: /\bkik\b/i },

    // Viber
    { pattern: /\bviber\b/i },

    // Other dating apps (trying to move off platform)
    { pattern: /\b(tinder|bumble|hinge|grindr|her\s*app|okcupid)\b/i },
  ];

  for (const { pattern, normalized } of socialPatterns) {
    if (pattern.test(text)) {
      return true;
    }
    if (normalized && normalized.test(platformNormalized)) {
      return true;
    }
  }

  // === URL DETECTION ===
  const urlPatterns = [
    // Any URLs with protocols
    /https?:\/\//i,
    // Common URL patterns without protocol
    /\b[\w-]+\.(com|net|org|io|co|me|app|link|ly|bio)\b/i,
    // Linktr.ee, linktree, etc.
    /link\s*(tree|\.bio|in\s*bio)/i,
    // "check my bio/link"
    /\b(check|see|visit)\s*(my\s*)?(bio|link|profile)\b/i,
  ];

  if (urlPatterns.some(pattern => pattern.test(text))) {
    return true;
  }

  // === CONTEXT PHRASES (asking to move off platform) ===
  const offPlatformPhrases = [
    /\b(text|message|hit|dm)\s*(me\s*)?(off|outside|on)\s*(this\s*)?(app|here|accord)/i,
    /\b(find|add|follow)\s*(me\s*)?(on|@)/i,
    /\bmy\s*(handle|username|@|user\s*name)\b/i,
    /\blet'?s?\s*(talk|chat|connect)\s*(somewhere\s*else|off\s*app|outside)/i,
    /\bhmu\s*(at|on)\b/i, // "hmu at" or "hmu on"
  ];

  if (offPlatformPhrases.some(pattern => pattern.test(lowerText))) {
    return true;
  }

  return false;
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
