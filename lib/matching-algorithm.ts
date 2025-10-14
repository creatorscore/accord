/**
 * Accord Compatibility Matching Algorithm
 *
 * Calculates a compatibility score (0-100) between two profiles based on:
 * - Location & Distance (25%)
 * - Marriage Goals & Preferences (30%)
 * - Lifestyle & Values (20%)
 * - Personality & Interests (15%)
 * - Demographics (10%)
 */

interface Profile {
  id: string;
  age: number;
  gender: string;
  sexual_orientation: string;
  latitude: number | null;
  longitude: number | null;
  hobbies: string[] | null;
  interests: any;
  zodiac_sign: string | null;
  personality_type: string | null;
  love_language: string | null;
  languages_spoken: string[] | null;
  religion: string | null;
  political_views: string | null;
}

interface Preferences {
  max_distance_miles: number;
  willing_to_relocate: boolean;
  primary_reason: string;
  relationship_type: string;
  wants_children: boolean | null;
  financial_arrangement: string | null;
  housing_preference: string | null;
  age_min: number;
  age_max: number;
  gender_preference: string[];
}

/**
 * Calculate distance between two coordinates in miles using Haversine formula
 */
function calculateDistance(
  lat1: number | null,
  lon1: number | null,
  lat2: number | null,
  lon2: number | null
): number {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 999999; // Return very large number if no coords

  const R = 3959; // Radius of Earth in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance);
}

/**
 * Calculate location compatibility score (0-100)
 * Weight: 25% of total score
 */
function calculateLocationScore(
  profile1: Profile,
  profile2: Profile,
  prefs1: Preferences,
  prefs2: Preferences
): number {
  const distance = calculateDistance(
    profile1.latitude,
    profile1.longitude,
    profile2.latitude,
    profile2.longitude
  );

  // Check if distance exceeds both users' max distance
  if (
    distance > prefs1.max_distance_miles &&
    distance > prefs2.max_distance_miles &&
    !prefs1.willing_to_relocate &&
    !prefs2.willing_to_relocate
  ) {
    return 0; // Hard fail - too far and neither willing to relocate
  }

  // Score based on distance ranges
  if (distance < 10) return 100; // Same city/neighborhood
  if (distance < 25) return 95; // Same metro area
  if (distance < 50) return 85; // Nearby cities
  if (distance < 100) return 70; // Same state/region
  if (distance < 200) return 55; // Adjacent states
  if (distance < 500) return 40; // Same country region

  // If far but both willing to relocate
  if (prefs1.willing_to_relocate && prefs2.willing_to_relocate) return 35;
  if (prefs1.willing_to_relocate || prefs2.willing_to_relocate) return 25;

  return 15; // Very far and neither willing to relocate
}

/**
 * Calculate marriage goals compatibility score (0-100)
 * Weight: 30% of total score
 */
function calculateGoalsScore(prefs1: Preferences, prefs2: Preferences): number {
  let score = 0;

  // Primary reason alignment (40 points)
  if (prefs1.primary_reason === prefs2.primary_reason) {
    score += 40;
  } else {
    // Partial credit for compatible reasons
    const compatibleReasons: { [key: string]: string[] } = {
      financial: ['legal_benefits', 'companionship'],
      legal_benefits: ['financial', 'immigration'],
      immigration: ['legal_benefits', 'safety'],
      companionship: ['financial', 'safety'],
      safety: ['immigration', 'companionship'],
    };
    if (compatibleReasons[prefs1.primary_reason]?.includes(prefs2.primary_reason)) {
      score += 20;
    }
  }

  // Relationship type compatibility (35 points)
  const typeCompatibility: { [key: string]: { [key: string]: number } } = {
    platonic: { platonic: 35, romantic: 10, open: 20 },
    romantic: { platonic: 10, romantic: 35, open: 25 },
    open: { platonic: 20, romantic: 25, open: 35 },
  };
  score += typeCompatibility[prefs1.relationship_type]?.[prefs2.relationship_type] || 0;

  // Children compatibility (25 points)
  if (prefs1.wants_children === prefs2.wants_children) {
    score += 25;
  } else if (prefs1.wants_children === null || prefs2.wants_children === null) {
    score += 15; // One is open/unsure
  }

  return Math.min(score, 100);
}

/**
 * Calculate lifestyle & values compatibility score (0-100)
 * Weight: 20% of total score
 */
function calculateLifestyleScore(
  profile1: Profile,
  profile2: Profile,
  prefs1: Preferences,
  prefs2: Preferences
): number {
  let score = 50; // Start at neutral

  // Housing preference compatibility (25 points)
  const housingCompatibility: { [key: string]: { [key: string]: number } } = {
    separate_spaces: { separate_spaces: 25, roommates: 20, separate_homes: 22, shared_bedroom: 5, flexible: 18 },
    roommates: { separate_spaces: 20, roommates: 25, separate_homes: 15, shared_bedroom: 10, flexible: 20 },
    separate_homes: { separate_spaces: 22, roommates: 15, separate_homes: 25, shared_bedroom: 0, flexible: 15 },
    shared_bedroom: { separate_spaces: 5, roommates: 10, separate_homes: 0, shared_bedroom: 25, flexible: 15 },
    flexible: { separate_spaces: 18, roommates: 20, separate_homes: 15, shared_bedroom: 15, flexible: 25 },
  };
  if (prefs1.housing_preference && prefs2.housing_preference) {
    score += housingCompatibility[prefs1.housing_preference]?.[prefs2.housing_preference] || 10;
  }

  // Financial arrangement compatibility (25 points)
  const financialCompatibility: { [key: string]: { [key: string]: number } } = {
    separate: { separate: 25, shared_expenses: 20, joint: 10, prenup_required: 18, flexible: 20 },
    shared_expenses: { separate: 20, shared_expenses: 25, joint: 20, prenup_required: 15, flexible: 22 },
    joint: { separate: 10, shared_expenses: 20, joint: 25, prenup_required: 15, flexible: 18 },
    prenup_required: { separate: 18, shared_expenses: 15, joint: 15, prenup_required: 25, flexible: 15 },
    flexible: { separate: 20, shared_expenses: 22, joint: 18, prenup_required: 15, flexible: 25 },
  };
  if (prefs1.financial_arrangement && prefs2.financial_arrangement) {
    score += financialCompatibility[prefs1.financial_arrangement]?.[prefs2.financial_arrangement] || 10;
  }

  // Religion compatibility (15 points)
  if (profile1.religion && profile2.religion) {
    if (profile1.religion === profile2.religion) {
      score += 15;
    } else if (
      profile1.religion === 'Prefer not to say' ||
      profile2.religion === 'Prefer not to say' ||
      profile1.religion === 'Agnostic' ||
      profile2.religion === 'Agnostic' ||
      profile1.religion === 'Spiritual but not religious' ||
      profile2.religion === 'Spiritual but not religious'
    ) {
      score += 10; // More flexible religions
    } else {
      score += 5; // Different religions but respect
    }
  }

  // Political views compatibility (15 points)
  if (profile1.political_views && profile2.political_views) {
    const politicalDistance: { [key: string]: { [key: string]: number } } = {
      Liberal: { Liberal: 15, Progressive: 12, Moderate: 8, Conservative: 2, Libertarian: 6, Socialist: 10, Apolitical: 7 },
      Progressive: { Liberal: 12, Progressive: 15, Moderate: 6, Conservative: 1, Libertarian: 4, Socialist: 13, Apolitical: 5 },
      Moderate: { Liberal: 8, Progressive: 6, Moderate: 15, Conservative: 8, Libertarian: 10, Socialist: 4, Apolitical: 12 },
      Conservative: { Liberal: 2, Progressive: 1, Moderate: 8, Conservative: 15, Libertarian: 10, Socialist: 0, Apolitical: 7 },
      Libertarian: { Liberal: 6, Progressive: 4, Moderate: 10, Conservative: 10, Libertarian: 15, Socialist: 2, Apolitical: 8 },
      Socialist: { Liberal: 10, Progressive: 13, Moderate: 4, Conservative: 0, Libertarian: 2, Socialist: 15, Apolitical: 3 },
      Apolitical: { Liberal: 7, Progressive: 5, Moderate: 12, Conservative: 7, Libertarian: 8, Socialist: 3, Apolitical: 15 },
    };
    if (profile1.political_views === 'Prefer not to say' || profile2.political_views === 'Prefer not to say') {
      score += 10;
    } else {
      score += politicalDistance[profile1.political_views]?.[profile2.political_views] || 7;
    }
  }

  // Languages compatibility (10 points)
  if (profile1.languages_spoken && profile2.languages_spoken) {
    const sharedLanguages = profile1.languages_spoken.filter((lang) =>
      profile2.languages_spoken?.includes(lang)
    );
    if (sharedLanguages.length > 0) {
      score += Math.min(10, sharedLanguages.length * 3); // More shared languages = higher score
    }
  }

  return Math.min(Math.max(score, 0), 100);
}

/**
 * Calculate personality & interests compatibility score (0-100)
 * Weight: 15% of total score
 */
function calculatePersonalityScore(profile1: Profile, profile2: Profile): number {
  let score = 40; // Start with base score

  // Shared hobbies (30 points max)
  if (profile1.hobbies && profile2.hobbies) {
    const sharedHobbies = profile1.hobbies.filter((hobby) => profile2.hobbies?.includes(hobby));
    score += Math.min(30, sharedHobbies.length * 5); // 5 points per shared hobby, max 30
  }

  // Zodiac compatibility (15 points)
  if (profile1.zodiac_sign && profile2.zodiac_sign) {
    const zodiacCompatibility = calculateZodiacCompatibility(
      profile1.zodiac_sign,
      profile2.zodiac_sign
    );
    score += zodiacCompatibility;
  }

  // MBTI compatibility (15 points)
  if (profile1.personality_type && profile2.personality_type) {
    const mbtiCompatibility = calculateMBTICompatibility(
      profile1.personality_type,
      profile2.personality_type
    );
    score += mbtiCompatibility;
  }

  // Love language compatibility (10 points)
  if (profile1.love_language && profile2.love_language) {
    if (profile1.love_language === profile2.love_language) {
      score += 10;
    } else {
      score += 5; // Different but still valuable to know
    }
  }

  return Math.min(score, 100);
}

/**
 * Zodiac sign compatibility (simplified)
 */
function calculateZodiacCompatibility(sign1: string, sign2: string): number {
  if (sign1 === 'Prefer not to say' || sign2 === 'Prefer not to say') return 8;

  const highCompatibility: { [key: string]: string[] } = {
    Aries: ['Leo', 'Sagittarius', 'Gemini', 'Aquarius'],
    Taurus: ['Virgo', 'Capricorn', 'Cancer', 'Pisces'],
    Gemini: ['Libra', 'Aquarius', 'Aries', 'Leo'],
    Cancer: ['Scorpio', 'Pisces', 'Taurus', 'Virgo'],
    Leo: ['Aries', 'Sagittarius', 'Gemini', 'Libra'],
    Virgo: ['Taurus', 'Capricorn', 'Cancer', 'Scorpio'],
    Libra: ['Gemini', 'Aquarius', 'Leo', 'Sagittarius'],
    Scorpio: ['Cancer', 'Pisces', 'Virgo', 'Capricorn'],
    Sagittarius: ['Aries', 'Leo', 'Libra', 'Aquarius'],
    Capricorn: ['Taurus', 'Virgo', 'Scorpio', 'Pisces'],
    Aquarius: ['Gemini', 'Libra', 'Aries', 'Sagittarius'],
    Pisces: ['Cancer', 'Scorpio', 'Taurus', 'Capricorn'],
  };

  if (sign1 === sign2) return 12; // Same sign
  if (highCompatibility[sign1]?.includes(sign2)) return 15; // Highly compatible
  return 7; // Neutral or challenging
}

/**
 * MBTI compatibility (simplified)
 */
function calculateMBTICompatibility(type1: string, type2: string): number {
  if (type1 === "Don't know" || type2 === "Don't know") return 8;
  if (type1 === type2) return 12; // Same type

  // Check for complementary pairs (e.g., INTJ + ENFP)
  const complementaryPairs: { [key: string]: string[] } = {
    INTJ: ['ENFP', 'ENTP'],
    INTP: ['ENFJ', 'ENTJ'],
    ENTJ: ['INFP', 'INTP'],
    ENTP: ['INFJ', 'INTJ'],
    INFJ: ['ENFP', 'ENTP'],
    INFP: ['ENFJ', 'ENTJ'],
    ENFJ: ['INFP', 'INTP'],
    ENFP: ['INFJ', 'INTJ'],
    ISTJ: ['ESFP', 'ESTP'],
    ISFJ: ['ESFP', 'ESTP'],
    ESTJ: ['ISFP', 'ISTP'],
    ESFJ: ['ISFP', 'ISTP'],
    ISTP: ['ESFJ', 'ESTJ'],
    ISFP: ['ESFJ', 'ESTJ'],
    ESTP: ['ISFJ', 'ISTJ'],
    ESFP: ['ISFJ', 'ISTJ'],
  };

  if (complementaryPairs[type1]?.includes(type2)) return 15; // Highly compatible

  // Same functions (e.g., both introverts or both extroverts)
  const firstLetter1 = type1[0];
  const firstLetter2 = type2[0];
  if (firstLetter1 === firstLetter2) return 10;

  return 7; // Neutral
}

/**
 * Calculate demographics compatibility score (0-100)
 * Weight: 10% of total score
 */
function calculateDemographicsScore(
  profile1: Profile,
  profile2: Profile,
  prefs1: Preferences,
  prefs2: Preferences
): number {
  let score = 0;

  // Age preference compatibility (50 points)
  if (
    profile1.age >= prefs2.age_min &&
    profile1.age <= prefs2.age_max &&
    profile2.age >= prefs1.age_min &&
    profile2.age <= prefs1.age_max
  ) {
    score += 50;
  } else if (
    profile1.age >= prefs2.age_min - 3 &&
    profile1.age <= prefs2.age_max + 3 &&
    profile2.age >= prefs1.age_min - 3 &&
    profile2.age <= prefs1.age_max + 3
  ) {
    score += 30; // Close to preferred range
  } else {
    score += 10; // Outside range but might still work
  }

  // Gender preference compatibility (50 points)
  const profile1MatchesPrefs =
    prefs2.gender_preference.length === 0 || prefs2.gender_preference.includes(profile1.gender);
  const profile2MatchesPrefs =
    prefs1.gender_preference.length === 0 || prefs1.gender_preference.includes(profile2.gender);

  if (profile1MatchesPrefs && profile2MatchesPrefs) {
    score += 50;
  } else if (profile1MatchesPrefs || profile2MatchesPrefs) {
    score += 25; // One-sided match
  }

  return Math.min(score, 100);
}

/**
 * Main function: Calculate overall compatibility score
 * Returns a score from 0-100
 */
export function calculateCompatibilityScore(
  profile1: Profile,
  profile2: Profile,
  prefs1: Preferences,
  prefs2: Preferences
): number {
  const locationScore = calculateLocationScore(profile1, profile2, prefs1, prefs2);
  const goalsScore = calculateGoalsScore(prefs1, prefs2);
  const lifestyleScore = calculateLifestyleScore(profile1, profile2, prefs1, prefs2);
  const personalityScore = calculatePersonalityScore(profile1, profile2);
  const demographicsScore = calculateDemographicsScore(profile1, profile2, prefs1, prefs2);

  // Weighted average
  const totalScore =
    locationScore * 0.25 +
    goalsScore * 0.3 +
    lifestyleScore * 0.2 +
    personalityScore * 0.15 +
    demographicsScore * 0.1;

  // Round to whole number
  return Math.round(totalScore);
}

/**
 * Get a human-readable explanation of compatibility
 */
export function getCompatibilityExplanation(score: number): string {
  if (score >= 90) return 'Exceptional Match! 🌟';
  if (score >= 80) return 'Excellent Match! 💜';
  if (score >= 70) return 'Great Match!';
  if (score >= 60) return 'Good Match';
  if (score >= 50) return 'Decent Match';
  if (score >= 40) return 'Moderate Match';
  return 'Low Match';
}

/**
 * Get compatibility breakdown by category
 */
export function getCompatibilityBreakdown(
  profile1: Profile,
  profile2: Profile,
  prefs1: Preferences,
  prefs2: Preferences
): {
  location: number;
  goals: number;
  lifestyle: number;
  personality: number;
  demographics: number;
  total: number;
} {
  return {
    location: calculateLocationScore(profile1, profile2, prefs1, prefs2),
    goals: calculateGoalsScore(prefs1, prefs2),
    lifestyle: calculateLifestyleScore(profile1, profile2, prefs1, prefs2),
    personality: calculatePersonalityScore(profile1, profile2),
    demographics: calculateDemographicsScore(profile1, profile2, prefs1, prefs2),
    total: calculateCompatibilityScore(profile1, profile2, prefs1, prefs2),
  };
}
