/**
 * Accord Compatibility Matching Algorithm - Lavender Marriage Edition
 *
 * This algorithm calculates compatibility for LAVENDER MARRIAGES - marriages of
 * convenience between LGBTQ+ individuals. Unlike traditional dating apps, this
 * algorithm prioritizes PRACTICAL COMPATIBILITY over romantic attraction.
 *
 * WEIGHT DISTRIBUTION (Optimized for Lavender Marriages):
 * - Marriage Goals & Practical Arrangements: 37% (PRIMARY FACTOR)
 * - Lifestyle & Values: 27% (Daily life compatibility)
 * - Location & Distance: 21% (Logistics)
 * - Demographics (Age/Gender Preferences): 15% (Basic compatibility)
 *
 * KEY FEATURES FOR LAVENDER MARRIAGES:
 * ✅ Practical Arrangement Compatibility (financial, housing, children)
 * ✅ Marriage Goals Alignment (why seeking lavender marriage)
 * ✅ Lifestyle Compatibility (smoking, drinking, pets, daily habits)
 * ✅ Location & Relocation Flexibility
 * ✅ Gender Preference Matching (what gender seeking in partner)
 * ✅ Age Compatibility
 * ✅ Political & Religious Values Alignment
 *
 * REMOVED FOR LAVENDER MARRIAGES:
 * ❌ Sexual Orientation Compatibility - DIFFERENT orientations are IDEAL!
 *    (gay man + straight woman = perfect lavender marriage)
 * ❌ Strict Relationship Type Filtering - People need flexibility to negotiate
 * ❌ Romantic Compatibility Factors - This is about practical arrangements
 *
 * FIELDS USED (Comprehensive):
 * Profile Fields:
 * - Basic: age, gender, pronouns, sexual_orientation, ethnicity
 * - Location: city, state, coordinates, distance
 * - Physical: height_inches
 * - Values: religion, political_views, languages_spoken[]
 *
 * Preferences Fields:
 * - Marriage: primary_reason, relationship_type, wants_children, children_arrangement
 * - Financial: financial_arrangement, housing_preference
 * - Lifestyle: smoking, drinking, pets
 * - Matching: age_min/max, gender_preference, max_distance_miles
 * - Location: willing_to_relocate, search_globally, preferred_cities[]
 *
 * SCORING PHILOSOPHY:
 * 90-100: Exceptional Match (very rare, <5% of matches)
 * 80-89: Excellent Match (highly compatible, <15% of matches)
 * 70-79: Great Match (strong compatibility, ~25% of matches)
 * 60-69: Good Match (decent compatibility, ~30% of matches)
 * 50-59: Moderate Match (some compatibility, ~20% of matches)
 * <50: Low Match (limited compatibility, ~5% of matches)
 */

interface Profile {
  id: string;
  age: number;
  gender: string | string[]; // Multi-select support
  pronouns?: string | null;
  sexual_orientation: string | string[]; // Multi-select support
  ethnicity: string | string[] | null; // Multi-select support
  location_city: string | null;
  latitude: number | null;
  longitude: number | null;
  height_inches?: number | null;
  prompt_answers?: { prompt: string; answer: string }[] | null;
  zodiac_sign: string | null;
  languages_spoken: string[] | null;
  religion: string | null;
  political_views: string | null;
}

interface Preferences {
  max_distance_miles: number;
  willing_to_relocate: boolean;
  search_globally: boolean;
  preferred_cities: string[] | null;
  primary_reason: string;
  relationship_type: string;
  wants_children: boolean | null;
  children_arrangement: string | string[] | null; // Multi-select support
  financial_arrangement: string | string[] | null; // Multi-select support
  housing_preference: string | string[] | null; // Multi-select support
  lifestyle_preferences?: {
    smoking?: string;
    drinking?: string;
    pets?: string;
  } | null;
  age_min: number;
  age_max: number;
  gender_preference: string[]; // Array of genders this user is interested in matching with
}

/**
 * Helper function to normalize values to arrays for comparison
 */
function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

/**
 * Helper function to check if arrays have any overlap
 */
function hasArrayOverlap<T>(arr1: T | T[] | null | undefined, arr2: T | T[] | null | undefined): boolean {
  const a1 = toArray(arr1);
  const a2 = toArray(arr2);
  return a1.some(item => a2.includes(item));
}

/**
 * Helper function to calculate overlap percentage between arrays
 * Returns 0-100 representing percentage of overlap
 */
function calculateArrayOverlapScore<T>(arr1: T | T[] | null | undefined, arr2: T | T[] | null | undefined): number {
  const a1 = toArray(arr1);
  const a2 = toArray(arr2);

  if (a1.length === 0 || a2.length === 0) return 0;

  const overlap = a1.filter(item => a2.includes(item)).length;
  const maxPossible = Math.max(a1.length, a2.length);

  return Math.round((overlap / maxPossible) * 100);
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
 *
 * Now supports:
 * - Global search (search_globally = true)
 * - Multi-city search (preferred_cities array)
 * - Standard distance-based matching
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

  // GLOBAL SEARCH MODE: If either user is searching globally
  if (prefs1.search_globally || prefs2.search_globally) {
    // Both searching globally - excellent for international matches
    if (prefs1.search_globally && prefs2.search_globally) {
      // Still give bonus for being closer
      if (distance < 50) return 95; // Nearby is still great
      if (distance < 500) return 85; // Same country
      if (prefs1.willing_to_relocate && prefs2.willing_to_relocate) return 80; // Both flexible
      if (prefs1.willing_to_relocate || prefs2.willing_to_relocate) return 70; // One flexible
      return 60; // Far but both open to global search
    }

    // One searching globally, one not - still good match
    if (prefs1.willing_to_relocate || prefs2.willing_to_relocate) {
      return 75; // Global searcher + willing to relocate
    }
    return 65; // Global searcher, may need to convince the other
  }

  // PREFERRED CITIES MODE: Check if users are in each other's preferred cities
  // This is perfect for "student abroad looking to return home" scenario
  const profile1InPreferredCity = prefs2.preferred_cities?.some(city =>
    // Check if profile1's location matches any of profile2's preferred cities
    // This is a simple string match - you could enhance with geocoding API
    city.toLowerCase().includes(profile1.location_city?.toLowerCase() || '') ||
    (profile1.location_city?.toLowerCase() || '').includes(city.toLowerCase())
  );

  const profile2InPreferredCity = prefs1.preferred_cities?.some(city =>
    city.toLowerCase().includes(profile2.location_city?.toLowerCase() || '') ||
    (profile2.location_city?.toLowerCase() || '').includes(city.toLowerCase())
  );

  // Both users are in each other's preferred cities - perfect match!
  if (profile1InPreferredCity && profile2InPreferredCity) {
    return 100;
  }

  // One user is in the other's preferred city - very good
  if (profile1InPreferredCity || profile2InPreferredCity) {
    return 90;
  }

  // STANDARD DISTANCE-BASED MATCHING
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

  // Primary reason alignment (35 points)
  if (prefs1.primary_reason === prefs2.primary_reason) {
    score += 35;
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
      score += 18;
    }
  }

  // Relationship type compatibility (30 points)
  // NOTE: For lavender marriages, this should be FLEXIBLE - people negotiate arrangements
  // Don't penalize mismatches too heavily since these are practical arrangements, not romance
  const typeCompatibility: { [key: string]: { [key: string]: number } } = {
    platonic: { platonic: 30, romantic: 20, open: 25 }, // Increased romantic from 8 to 20
    romantic: { platonic: 20, romantic: 30, open: 25 }, // Increased platonic from 8 to 20
    open: { platonic: 25, romantic: 25, open: 30 },
  };
  score += typeCompatibility[prefs1.relationship_type]?.[prefs2.relationship_type] || 15;

  // Children compatibility (20 points - whether they want children)
  if (prefs1.wants_children === prefs2.wants_children) {
    score += 20;
  } else if (prefs1.wants_children === null || prefs2.wants_children === null) {
    score += 12; // One is open/unsure
  }

  // Children arrangement compatibility (15 points - HOW they want children)
  // Only consider if both want children
  if (prefs1.wants_children && prefs2.wants_children &&
      prefs1.children_arrangement && prefs2.children_arrangement) {

    const arr1 = toArray(prefs1.children_arrangement);
    const arr2 = toArray(prefs2.children_arrangement);

    // Check for any overlap
    if (hasArrayOverlap(arr1, arr2)) {
      // Calculate score based on overlap percentage
      const overlapScore = calculateArrayOverlapScore(arr1, arr2);
      score += Math.round((overlapScore / 100) * 15); // Scale to max 15 points
    } else {
      // No overlap - check for compatible arrangements
      const arrangementCompatibility: { [key: string]: { [key: string]: number } } = {
        biological: { biological: 15, adoption: 8, foster: 8, 'step-parenting': 10, surrogacy: 12, open: 12 },
        adoption: { biological: 8, adoption: 15, foster: 12, 'step-parenting': 10, surrogacy: 8, open: 12 },
        foster: { biological: 8, adoption: 12, foster: 15, 'step-parenting': 10, surrogacy: 6, open: 12 },
        'step-parenting': { biological: 10, adoption: 10, foster: 10, 'step-parenting': 15, surrogacy: 8, open: 12 },
        surrogacy: { biological: 12, adoption: 8, foster: 6, 'step-parenting': 8, surrogacy: 15, open: 12 },
        open: { biological: 12, adoption: 12, foster: 12, 'step-parenting': 12, surrogacy: 12, open: 15 }
      };

      // FIX #4: Optimize nested loop - check for exact matches first (O(n) instead of O(n²))
      const set2 = new Set(arr2);
      let bestScore = 0;
      let foundExactMatch = false;

      // First pass: check for exact matches (O(n))
      for (const a1 of arr1) {
        if (set2.has(a1)) {
          bestScore = Math.max(bestScore, arrangementCompatibility[a1]?.[a1] || 15);
          foundExactMatch = true;
        }
      }

      // Only do nested loop if no exact match found
      if (!foundExactMatch) {
        for (const a1 of arr1) {
          for (const a2 of arr2) {
            const pairScore = arrangementCompatibility[a1]?.[a2] || 8;
            bestScore = Math.max(bestScore, pairScore);
          }
        }
      }
      score += bestScore;
    }
  } else if (prefs1.wants_children && prefs2.wants_children) {
    // Both want children but at least one hasn't specified arrangement
    score += 10; // Partial credit
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
    const arr1 = toArray(prefs1.housing_preference);
    const arr2 = toArray(prefs2.housing_preference);

    // Check for any overlap
    if (hasArrayOverlap(arr1, arr2)) {
      // Calculate score based on overlap percentage
      const overlapScore = calculateArrayOverlapScore(arr1, arr2);
      score += Math.round((overlapScore / 100) * 25); // Scale to max 25 points
    } else {
      // No overlap - find best compatibility score between any pair
      // FIX #4: Optimize nested loop - check for exact matches first
      const set2 = new Set(arr2);
      let bestScore = 0;
      let foundExactMatch = false;

      for (const h1 of arr1) {
        if (set2.has(h1)) {
          bestScore = Math.max(bestScore, housingCompatibility[h1]?.[h1] || 25);
          foundExactMatch = true;
        }
      }

      if (!foundExactMatch) {
        for (const h1 of arr1) {
          for (const h2 of arr2) {
            const pairScore = housingCompatibility[h1]?.[h2] || 10;
            bestScore = Math.max(bestScore, pairScore);
          }
        }
      }
      score += bestScore;
    }
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
    const arr1 = toArray(prefs1.financial_arrangement);
    const arr2 = toArray(prefs2.financial_arrangement);

    // Check for any overlap
    if (hasArrayOverlap(arr1, arr2)) {
      // Calculate score based on overlap percentage
      const overlapScore = calculateArrayOverlapScore(arr1, arr2);
      score += Math.round((overlapScore / 100) * 25); // Scale to max 25 points
    } else {
      // No overlap - find best compatibility score between any pair
      // FIX #4: Optimize nested loop - check for exact matches first
      const set2 = new Set(arr2);
      let bestScore = 0;
      let foundExactMatch = false;

      for (const f1 of arr1) {
        if (set2.has(f1)) {
          bestScore = Math.max(bestScore, financialCompatibility[f1]?.[f1] || 25);
          foundExactMatch = true;
        }
      }

      if (!foundExactMatch) {
        for (const f1 of arr1) {
          for (const f2 of arr2) {
            const pairScore = financialCompatibility[f1]?.[f2] || 10;
            bestScore = Math.max(bestScore, pairScore);
          }
        }
      }
      score += bestScore;
    }
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
  // Note: languages_spoken is not currently collected during onboarding,
  // so this only scores for profiles that manually added it via edit-profile.
  if (profile1.languages_spoken?.length && profile2.languages_spoken?.length) {
    const sharedLanguages = profile1.languages_spoken.filter((lang) =>
      profile2.languages_spoken?.includes(lang)
    );
    if (sharedLanguages.length > 0) {
      score += Math.min(10, sharedLanguages.length * 3);
    }
  }

  // Smoking compatibility (10 points) - NEW
  if (prefs1.lifestyle_preferences?.smoking && prefs2.lifestyle_preferences?.smoking) {
    const smokingCompatibility: { [key: string]: { [key: string]: number } } = {
      never: { never: 10, socially: 5, regularly: 0, trying_to_quit: 7 },
      socially: { never: 5, socially: 10, regularly: 6, trying_to_quit: 8 },
      regularly: { never: 0, socially: 6, regularly: 10, trying_to_quit: 7 },
      trying_to_quit: { never: 7, socially: 8, regularly: 7, trying_to_quit: 10 },
    };
    score += smokingCompatibility[prefs1.lifestyle_preferences.smoking]?.[prefs2.lifestyle_preferences.smoking] || 5;
  } else {
    score += 5; // Neutral if not specified
  }

  // Drinking compatibility (10 points) - NEW
  if (prefs1.lifestyle_preferences?.drinking && prefs2.lifestyle_preferences?.drinking) {
    const drinkingCompatibility: { [key: string]: { [key: string]: number } } = {
      never: { never: 10, rarely: 7, socially: 4, regularly: 1 },
      rarely: { never: 7, rarely: 10, socially: 8, regularly: 5 },
      socially: { never: 4, rarely: 8, socially: 10, regularly: 8 },
      regularly: { never: 1, rarely: 5, socially: 8, regularly: 10 },
    };
    score += drinkingCompatibility[prefs1.lifestyle_preferences.drinking]?.[prefs2.lifestyle_preferences.drinking] || 5;
  } else {
    score += 5; // Neutral if not specified
  }

  // Pets compatibility (10 points) - NEW
  if (prefs1.lifestyle_preferences?.pets && prefs2.lifestyle_preferences?.pets) {
    const petsCompatibility: { [key: string]: { [key: string]: number } } = {
      love_them: { love_them: 10, like_them: 9, indifferent: 8, allergic: 0, dont_like: 2 },
      like_them: { love_them: 9, like_them: 10, indifferent: 8, allergic: 1, dont_like: 3 },
      indifferent: { love_them: 8, like_them: 8, indifferent: 10, allergic: 7, dont_like: 7 },
      allergic: { love_them: 0, like_them: 1, indifferent: 7, allergic: 10, dont_like: 8 },
      dont_like: { love_them: 2, like_them: 3, indifferent: 7, allergic: 8, dont_like: 10 },
    };
    score += petsCompatibility[prefs1.lifestyle_preferences.pets]?.[prefs2.lifestyle_preferences.pets] || 5;
  } else {
    score += 5; // Neutral if not specified
  }

  // Ethnicity compatibility (10 points - cultural background)
  // Weighted carefully: provides small bonus for shared backgrounds without penalizing differences
  if (profile1.ethnicity && profile2.ethnicity) {
    const arr1 = toArray(profile1.ethnicity).filter(e => e !== 'Prefer not to say');
    const arr2 = toArray(profile2.ethnicity).filter(e => e !== 'Prefer not to say');

    if (arr1.length > 0 && arr2.length > 0) {
      // Check for any overlap
      if (hasArrayOverlap(arr1, arr2)) {
        // Shared ethnicity/ies - bonus for potential shared cultural understanding
        const overlapScore = calculateArrayOverlapScore(arr1, arr2);
        score += Math.round((overlapScore / 100) * 10); // Scale to max 10 points
      } else if (arr1.includes('Multiracial') || arr2.includes('Multiracial')) {
        // One is multiracial - may have experience with multiple cultures
        score += 8;
      } else {
        // Different ethnicities - neutral, no penalty
        score += 7; // Small base score for cultural diversity appreciation
      }
    } else {
      // One or both prefer not to say - neutral
      score += 7;
    }
  } else {
    // One or both prefer not to say - neutral
    score += 7;
  }

  return Math.min(Math.max(score, 0), 100);
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
 * Calculate orientation & identity respect score (0-100)
 * Weight: 0% of total score - NOT USED FOR LAVENDER MARRIAGES
 *
 * IMPORTANT: For lavender marriages, DIFFERENT sexual orientations are IDEAL!
 * A gay man and a straight woman is a PERFECT match for a lavender marriage.
 * Therefore, this function returns a NEUTRAL score and is NOT included in final calculation.
 *
 * This function is kept for potential future use but does NOT affect compatibility scoring.
 */
function calculateOrientationScore(
  profile1: Profile,
  profile2: Profile,
  prefs1: Preferences,
  prefs2: Preferences
): number {
  // Return neutral score - sexual orientation should NOT affect lavender marriage compatibility
  // Different orientations (gay + straight) are actually IDEAL for these arrangements!
  return 50; // Always neutral - not used in final calculation
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

  // HARD FILTER: age must mutually fit both users' ranges.
  // DB-level filters already enforce this, so out-of-range profiles shouldn't
  // reach the algorithm. The hard-fail here aligns with CLAUDE.md Golden Rule #1
  // and makes any DB-bypass immediately visible (score collapses to 0).
  const ageMutualMatch =
    profile1.age >= prefs2.age_min &&
    profile1.age <= prefs2.age_max &&
    profile2.age >= prefs1.age_min &&
    profile2.age <= prefs1.age_max;

  if (!ageMutualMatch) {
    return 0;
  }
  score += 50;

  // HARD FILTER: gender preference must be mutually satisfied (or "Everyone").
  // Same reasoning — DB filter is authoritative, algorithm aligns.
  const gender1Array = toArray(profile1.gender);
  const gender2Array = toArray(profile2.gender);

  const genderPref2 = toArray(prefs2.gender_preference);
  const profile1MatchesPrefs =
    genderPref2.length === 0 ||
    genderPref2.includes('Everyone') ||
    gender1Array.some(g => genderPref2.includes(g));

  const genderPref1 = toArray(prefs1.gender_preference);
  const profile2MatchesPrefs =
    genderPref1.length === 0 ||
    genderPref1.includes('Everyone') ||
    gender2Array.some(g => genderPref1.includes(g));

  if (!profile1MatchesPrefs || !profile2MatchesPrefs) {
    return 0;
  }
  score += 50;

  return Math.min(score, 100);
}

/**
 * Main function: Calculate overall compatibility score for LAVENDER MARRIAGES
 * Returns a score from 0-100
 *
 * Weight Distribution (Optimized for Practical Arrangements):
 * - Marriage Goals & Arrangements: 37% (PRIMARY - why they're here, children, finances)
 * - Lifestyle & Values: 27% (Daily compatibility - housing, politics, religion, habits)
 * - Location & Distance: 21% (Logistics - where they live, relocation)
 * - Demographics: 15% (Age/Gender preferences)
 * - Sexual Orientation: 0% (REMOVED - different orientations are IDEAL!)
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
  const demographicsScore = calculateDemographicsScore(profile1, profile2, prefs1, prefs2);

  // Weighted average optimized for practical lavender marriage arrangements
  const totalScore =
    goalsScore * 0.37 +        // PRIMARY: Marriage goals & practical arrangements
    lifestyleScore * 0.27 +    // Daily life compatibility
    locationScore * 0.21 +     // Logistics
    demographicsScore * 0.15;  // Age/Gender match

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
 * Get compatibility breakdown by category (Lavender Marriage Edition)
 * Note: Orientation is NOT included as it doesn't affect lavender marriage compatibility
 */
export function getCompatibilityBreakdown(
  profile1: Profile,
  profile2: Profile,
  prefs1: Preferences,
  prefs2: Preferences,
  preCalculatedScore?: number
): {
  location: number;
  goals: number;
  lifestyle: number;
  personality: number;
  demographics: number;
  orientation: number;
  total: number;
} {
  const goals = calculateGoalsScore(prefs1, prefs2);
  const lifestyle = calculateLifestyleScore(profile1, profile2, prefs1, prefs2);
  const location = calculateLocationScore(profile1, profile2, prefs1, prefs2);
  const demographics = calculateDemographicsScore(profile1, profile2, prefs1, prefs2);

  return {
    goals, // PRIMARY FACTOR (37%)
    lifestyle, // 27%
    location, // 21%
    demographics, // 15%
    personality: 0, // Removed - kept for interface compatibility
    orientation: 100, // Orientation compatibility is factored into demographics score
    total: preCalculatedScore ?? Math.round(
      goals * 0.37 + lifestyle * 0.27 + location * 0.21 + demographics * 0.15
    ),
  };
}

/**
 * PERF: Calculate score + breakdown in a single pass (avoids double-calculating all sub-scores)
 */
export function calculateScoreAndBreakdown(
  profile1: Profile,
  profile2: Profile,
  prefs1: Preferences,
  prefs2: Preferences
): { score: number; breakdown: { location: number; goals: number; lifestyle: number; personality: number; demographics: number; orientation: number; total: number } } {
  const goals = calculateGoalsScore(prefs1, prefs2);
  const lifestyle = calculateLifestyleScore(profile1, profile2, prefs1, prefs2);
  const location = calculateLocationScore(profile1, profile2, prefs1, prefs2);
  const demographics = calculateDemographicsScore(profile1, profile2, prefs1, prefs2);

  const total = Math.round(
    goals * 0.37 + lifestyle * 0.27 + location * 0.21 + demographics * 0.15
  );

  return {
    score: total,
    breakdown: { goals, lifestyle, location, demographics, personality: 0, orientation: 100, total },
  };
}
