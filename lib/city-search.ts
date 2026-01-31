/**
 * Offline City Search Utility
 *
 * Uses cities.json database (154,000+ cities worldwide) for location search
 * that works without GPS or Google services.
 *
 * This enables users in any country to find their city, even if:
 * - GPS is not working
 * - Google Play Services is restricted
 * - Location permissions are denied
 */

// Import city data - this is a large dataset (~22MB) but gets tree-shaken in production
import citiesData from 'cities.json';
import admin1Data from 'cities.json/admin1.json';
import countries from 'i18n-iso-countries';
import enLocale from 'i18n-iso-countries/langs/en.json';

// Register English locale for country names
countries.registerLocale(enLocale);

// Type definitions
interface CityRaw {
  name: string;
  lat: string;
  lng: string;
  country: string;
  admin1: string;
  admin2: string;
}

interface Admin1Entry {
  code: string;
  name: string;
}

export interface CityResult {
  city: string;
  state: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  displayName: string; // "City, State, Country" formatted string
}

// Build admin1 lookup map (state/province names by code)
const admin1ByCode: Record<string, string> = {};
Object.values(admin1Data as unknown as Record<string, Admin1Entry>).forEach((entry) => {
  admin1ByCode[entry.code] = entry.name;
});

// Cache for frequently accessed country names
const countryNameCache: Record<string, string> = {};

/**
 * Get country name from ISO 2-letter code
 */
function getCountryName(countryCode: string): string {
  if (countryNameCache[countryCode]) {
    return countryNameCache[countryCode];
  }

  let name = countries.getName(countryCode, 'en') || countryCode;

  // Shorten some long country names for display
  const shortNames: Record<string, string> = {
    'United States of America': 'United States',
    'United Republic of Tanzania': 'Tanzania',
    'United Kingdom of Great Britain and Northern Ireland': 'United Kingdom',
    'Russian Federation': 'Russia',
    'Korea, Republic of': 'South Korea',
    "Korea, Democratic People's Republic of": 'North Korea',
    'Iran, Islamic Republic of': 'Iran',
    'Venezuela, Bolivarian Republic of': 'Venezuela',
    'Bolivia, Plurinational State of': 'Bolivia',
    'Viet Nam': 'Vietnam',
    'Lao People\'s Democratic Republic': 'Laos',
    'Syrian Arab Republic': 'Syria',
    'Taiwan, Province of China': 'Taiwan',
    'Palestine, State of': 'Palestine',
    'Micronesia, Federated States of': 'Micronesia',
    'Moldova, Republic of': 'Moldova',
    'Congo, Democratic Republic of the': 'DR Congo',
    'Congo': 'Republic of Congo',
    'Tanzania, United Republic of': 'Tanzania',
    'Côte d\'Ivoire': 'Ivory Coast',
    'Czechia': 'Czech Republic',
  };

  name = shortNames[name] || name;
  countryNameCache[countryCode] = name;
  return name;
}

/**
 * Get state/province name from country code and admin1 code
 */
function getStateName(countryCode: string, admin1Code: string): string {
  if (!admin1Code) return '';
  const code = `${countryCode}.${admin1Code}`;
  return admin1ByCode[code] || '';
}

/**
 * Convert raw city data to CityResult
 */
function cityToCityResult(city: CityRaw): CityResult {
  const state = getStateName(city.country, city.admin1);
  const country = getCountryName(city.country);

  // Build display name
  let displayName = city.name;
  if (state) {
    displayName += `, ${state}`;
  }
  displayName += `, ${country}`;

  return {
    city: city.name,
    state,
    country,
    countryCode: city.country,
    latitude: parseFloat(city.lat),
    longitude: parseFloat(city.lng),
    displayName,
  };
}

/**
 * Search for cities by name
 *
 * @param query - Search query (city name)
 * @param limit - Maximum number of results (default 20)
 * @returns Array of matching cities, sorted by relevance
 */
export function searchCities(query: string, limit: number = 20): CityResult[] {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchTerm = query.toLowerCase().trim();
  const cities = citiesData as CityRaw[];

  // Separate exact matches, starts-with matches, and contains matches
  const exactMatches: CityRaw[] = [];
  const startsWithMatches: CityRaw[] = [];
  const containsMatches: CityRaw[] = [];

  for (const city of cities) {
    const cityName = city.name.toLowerCase();

    if (cityName === searchTerm) {
      exactMatches.push(city);
    } else if (cityName.startsWith(searchTerm)) {
      startsWithMatches.push(city);
    } else if (cityName.includes(searchTerm)) {
      containsMatches.push(city);
    }

    // Early exit if we have enough results
    if (exactMatches.length + startsWithMatches.length >= limit * 2) {
      break;
    }
  }

  // Combine and limit results (prioritize exact and starts-with matches)
  const combined = [
    ...exactMatches,
    ...startsWithMatches,
    ...containsMatches,
  ].slice(0, limit);

  return combined.map(cityToCityResult);
}

/**
 * Search for cities by country
 * Returns popular/major cities in a country
 *
 * @param countryCode - ISO 2-letter country code
 * @param limit - Maximum number of results (default 50)
 * @returns Array of cities in the country
 */
export function getCitiesByCountry(countryCode: string, limit: number = 50): CityResult[] {
  const cities = citiesData as CityRaw[];
  const countryUpper = countryCode.toUpperCase();

  const countryCities = cities.filter(city => city.country === countryUpper);

  // Return first N cities (they're generally sorted by importance/population)
  return countryCities.slice(0, limit).map(cityToCityResult);
}

/**
 * Search cities with country filter
 *
 * @param query - Search query (city name)
 * @param countryCode - Optional ISO 2-letter country code to filter by
 * @param limit - Maximum number of results
 */
export function searchCitiesInCountry(
  query: string,
  countryCode?: string,
  limit: number = 20
): CityResult[] {
  if (!query || query.trim().length < 2) {
    return [];
  }

  const searchTerm = query.toLowerCase().trim();
  const cities = citiesData as CityRaw[];
  const countryUpper = countryCode?.toUpperCase();

  const matches: CityRaw[] = [];

  for (const city of cities) {
    // Filter by country if specified
    if (countryUpper && city.country !== countryUpper) {
      continue;
    }

    const cityName = city.name.toLowerCase();
    if (cityName.includes(searchTerm)) {
      matches.push(city);
    }

    if (matches.length >= limit) {
      break;
    }
  }

  // Sort by relevance (exact match first, then starts-with, then contains)
  matches.sort((a, b) => {
    const aName = a.name.toLowerCase();
    const bName = b.name.toLowerCase();

    const aExact = aName === searchTerm;
    const bExact = bName === searchTerm;
    if (aExact && !bExact) return -1;
    if (!aExact && bExact) return 1;

    const aStarts = aName.startsWith(searchTerm);
    const bStarts = bName.startsWith(searchTerm);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;

    return 0;
  });

  return matches.map(cityToCityResult);
}

/**
 * Get all available countries
 *
 * @returns Array of country objects with code and name
 */
export function getAllCountries(): Array<{ code: string; name: string }> {
  const cities = citiesData as CityRaw[];
  const countryCodesSet = new Set<string>();

  for (const city of cities) {
    countryCodesSet.add(city.country);
  }

  const countriesList = Array.from(countryCodesSet).map(code => ({
    code,
    name: getCountryName(code),
  }));

  // Sort alphabetically by name
  countriesList.sort((a, b) => a.name.localeCompare(b.name));

  return countriesList;
}

/**
 * Get total number of cities in database
 */
export function getTotalCityCount(): number {
  return (citiesData as CityRaw[]).length;
}
