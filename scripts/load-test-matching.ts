/**
 * Load Testing Script for Matching Algorithm
 *
 * This script generates test profiles and measures matching algorithm performance
 *
 * Usage:
 *   npx tsx scripts/load-test-matching.ts --profiles=1000 --iterations=100
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { calculateCompatibilityScore } from '../lib/matching-algorithm';

// Load environment variables from .env file
config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface LoadTestConfig {
  numProfiles: number;
  numIterations: number;
  cleanupAfter: boolean;
}

interface TestProfile {
  id: string;
  display_name: string;
  age: number;
  gender: string[];
  sexual_orientation: string[];
  location_city: string;
  location_state: string;
  latitude: number;
  longitude: number;
}

interface TestPreferences {
  profile_id: string;
  primary_reason: string;
  relationship_type: string;
  age_min: number;
  age_max: number;
  max_distance_miles: number;
  willing_to_relocate: boolean;
  financial_arrangement: string[];
  housing_preference: string[];
  gender_preference: string[];
}

const CITIES = [
  { city: 'New York', state: 'NY', lat: 40.7128, lng: -74.0060 },
  { city: 'Los Angeles', state: 'CA', lat: 34.0522, lng: -118.2437 },
  { city: 'Chicago', state: 'IL', lat: 41.8781, lng: -87.6298 },
  { city: 'Houston', state: 'TX', lat: 29.7604, lng: -95.3698 },
  { city: 'Phoenix', state: 'AZ', lat: 33.4484, lng: -112.0740 },
  { city: 'Philadelphia', state: 'PA', lat: 39.9526, lng: -75.1652 },
  { city: 'San Antonio', state: 'TX', lat: 29.4241, lng: -98.4936 },
  { city: 'San Diego', state: 'CA', lat: 32.7157, lng: -117.1611 },
  { city: 'Dallas', state: 'TX', lat: 32.7767, lng: -96.7970 },
  { city: 'Austin', state: 'TX', lat: 30.2672, lng: -97.7431 },
];

const GENDERS = ['Man', 'Woman', 'Non-binary'];
const ORIENTATIONS = ['Gay', 'Lesbian', 'Straight', 'Bisexual', 'Queer'];
const RELATIONSHIP_TYPES = ['platonic', 'romantic', 'open'];
const PRIMARY_REASONS = ['financial', 'immigration', 'family_pressure', 'legal_benefits', 'safety'];
const FINANCIAL_ARRANGEMENTS = ['separate', 'shared_expenses', 'joint', 'prenup_required', 'flexible'];
const HOUSING_PREFERENCES = ['separate_spaces', 'roommates', 'separate_homes', 'shared_bedroom', 'flexible'];

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateTestProfile(): { profile: Partial<TestProfile>; preferences: Partial<TestPreferences> } {
  const city = randomElement(CITIES);
  const gender = randomElement(GENDERS);
  const age = randomInt(22, 50);

  // Determine seeking gender based on realistic patterns
  let seekingGender: string;
  if (gender === 'Man') {
    seekingGender = Math.random() < 0.5 ? 'Woman' : 'Man';
  } else if (gender === 'Woman') {
    seekingGender = Math.random() < 0.5 ? 'Man' : 'Woman';
  } else {
    seekingGender = randomElement(['Man', 'Woman', 'Non-binary']);
  }

  const profile: Partial<TestProfile> = {
    display_name: `LoadTest_${Math.random().toString(36).substring(7)}`,
    age,
    gender: [gender], // Gender is now an array
    sexual_orientation: [randomElement(ORIENTATIONS)], // Sexual orientation is now an array
    location_city: city.city,
    location_state: city.state,
    latitude: city.lat + (Math.random() - 0.5) * 0.5, // Add random variance
    longitude: city.lng + (Math.random() - 0.5) * 0.5,
  };

  const preferences: Partial<TestPreferences> = {
    primary_reason: randomElement(PRIMARY_REASONS),
    relationship_type: randomElement(RELATIONSHIP_TYPES),
    age_min: Math.max(18, age - randomInt(5, 15)),
    age_max: Math.min(70, age + randomInt(5, 15)),
    max_distance_miles: randomInt(10, 100),
    willing_to_relocate: Math.random() < 0.3, // 30% willing to relocate
    financial_arrangement: [randomElement(FINANCIAL_ARRANGEMENTS)], // Now an array
    housing_preference: [randomElement(HOUSING_PREFERENCES)], // Now an array
    gender_preference: [seekingGender], // Moved from profile to preferences as array
  };

  return { profile, preferences };
}

async function createTestProfiles(count: number): Promise<string[]> {
  console.log(`📝 Generating ${count} test profiles...`);
  const profileIds: string[]= [];

  // Create test user accounts and profiles
  for (let i = 0; i < count; i++) {
    const { profile, preferences } = generateTestProfile();

    try {
      // Create auth user
      const email = `loadtest_${Date.now()}_${i}@test.accord.app`;
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: 'LoadTest123!',
        email_confirm: true,
      });

      if (authError || !authData.user) {
        console.error(`❌ Failed to create auth user ${i}:`, authError);
        continue;
      }

      // Create profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: authData.user.id,
          ...profile,
        })
        .select('id')
        .single();

      if (profileError || !profileData) {
        console.error(`❌ Failed to create profile ${i}:`, profileError);
        continue;
      }

      // Create preferences
      const { error: prefsError } = await supabase
        .from('preferences')
        .insert({
          profile_id: profileData.id,
          ...preferences,
        });

      if (prefsError) {
        console.error(`❌ Failed to create preferences ${i}:`, prefsError);
        continue;
      }

      profileIds.push(profileData.id);

      if ((i + 1) % 100 === 0) {
        console.log(`✅ Created ${i + 1} / ${count} profiles`);
      }
    } catch (error) {
      console.error(`❌ Error creating profile ${i}:`, error);
    }
  }

  console.log(`✅ Successfully created ${profileIds.length} test profiles`);
  return profileIds;
}

async function runPerformanceTests(profileIds: string[], iterations: number) {
  console.log(`\n🚀 Running performance tests with ${iterations} iterations...`);

  const results = {
    compatibilityScores: [] as number[],
    discoveryQueries: [] as number[],
    avgCompatibilityScore: 0,
    avgDiscoveryTime: 0,
    minCompatibilityTime: Infinity,
    maxCompatibilityTime: 0,
    minDiscoveryTime: Infinity,
    maxDiscoveryTime: 0,
  };

  for (let i = 0; i < iterations; i++) {
    // Test 1: Calculate compatibility score between two random profiles
    const profile1Id = randomElement(profileIds);
    const profile2Id = randomElement(profileIds.filter(id => id !== profile1Id));

    const compatibilityStart = Date.now();
    const { data: profile1Data } = await supabase
      .from('profiles')
      .select('*, preferences(*)')
      .eq('id', profile1Id)
      .single();

    const { data: profile2Data } = await supabase
      .from('profiles')
      .select('*, preferences(*)')
      .eq('id', profile2Id)
      .single();

    if (profile1Data && profile2Data) {
      const prefs1 = Array.isArray(profile1Data.preferences)
        ? profile1Data.preferences[0]
        : profile1Data.preferences;
      const prefs2 = Array.isArray(profile2Data.preferences)
        ? profile2Data.preferences[0]
        : profile2Data.preferences;

      calculateCompatibilityScore(profile1Data, profile2Data, prefs1, prefs2);
    }

    const compatibilityTime = Date.now() - compatibilityStart;
    results.compatibilityScores.push(compatibilityTime);

    // Test 2: Run discovery query for random profile
    const testProfileId = randomElement(profileIds);
    const discoveryStart = Date.now();

    await supabase
      .from('profiles')
      .select('*, preferences(*)')
      .not('id', 'eq', testProfileId)
      .limit(20);

    const discoveryTime = Date.now() - discoveryStart;
    results.discoveryQueries.push(discoveryTime);

    // Update min/max
    results.minCompatibilityTime = Math.min(results.minCompatibilityTime, compatibilityTime);
    results.maxCompatibilityTime = Math.max(results.maxCompatibilityTime, compatibilityTime);
    results.minDiscoveryTime = Math.min(results.minDiscoveryTime, discoveryTime);
    results.maxDiscoveryTime = Math.max(results.maxDiscoveryTime, discoveryTime);

    if ((i + 1) % 10 === 0) {
      console.log(`⏱️  Completed ${i + 1} / ${iterations} iterations`);
    }
  }

  // Calculate averages
  results.avgCompatibilityScore =
    results.compatibilityScores.reduce((a, b) => a + b, 0) / results.compatibilityScores.length;
  results.avgDiscoveryTime =
    results.discoveryQueries.reduce((a, b) => a + b, 0) / results.discoveryQueries.length;

  return results;
}

async function cleanup(profileIds: string[]) {
  console.log(`\n🧹 Cleaning up ${profileIds.length} test profiles...`);

  // Delete profiles (cascades to preferences due to foreign key)
  const { error: deleteError } = await supabase
    .from('profiles')
    .delete()
    .in('id', profileIds);

  if (deleteError) {
    console.error('❌ Error during cleanup:', deleteError);
  } else {
    console.log(`✅ Cleaned up ${profileIds.length} profiles`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const config: LoadTestConfig = {
    numProfiles: 100,
    numIterations: 50,
    cleanupAfter: true,
  };

  // Parse command line arguments
  args.forEach(arg => {
    if (arg.startsWith('--profiles=')) {
      config.numProfiles = parseInt(arg.split('=')[1]);
    }
    if (arg.startsWith('--iterations=')) {
      config.numIterations = parseInt(arg.split('=')[1]);
    }
    if (arg === '--no-cleanup') {
      config.cleanupAfter = false;
    }
  });

  console.log('🧪 Accord Matching Algorithm Load Test');
  console.log('=====================================');
  console.log(`Profiles: ${config.numProfiles}`);
  console.log(`Iterations: ${config.numIterations}`);
  console.log(`Cleanup after: ${config.cleanupAfter}\n`);

  try {
    // Step 1: Create test profiles
    const profileIds = await createTestProfiles(config.numProfiles);

    if (profileIds.length === 0) {
      console.error('❌ No profiles created. Exiting.');
      return;
    }

    // Step 2: Run performance tests
    const results = await runPerformanceTests(profileIds, config.numIterations);

    // Step 3: Display results
    console.log('\n📊 Load Test Results');
    console.log('====================');
    console.log(`\nCompatibility Score Calculation:`);
    console.log(`  Average: ${results.avgCompatibilityScore.toFixed(2)}ms`);
    console.log(`  Min: ${results.minCompatibilityTime}ms`);
    console.log(`  Max: ${results.maxCompatibilityTime}ms`);
    console.log(`\nDiscovery Query:`);
    console.log(`  Average: ${results.avgDiscoveryTime.toFixed(2)}ms`);
    console.log(`  Min: ${results.minDiscoveryTime}ms`);
    console.log(`  Max: ${results.maxDiscoveryTime}ms`);

    // Performance assessment
    console.log(`\n🎯 Performance Assessment:`);
    if (results.avgCompatibilityScore < 100) {
      console.log(`  ✅ Compatibility calculation: EXCELLENT (<100ms)`);
    } else if (results.avgCompatibilityScore < 200) {
      console.log(`  ⚠️  Compatibility calculation: GOOD (100-200ms)`);
    } else {
      console.log(`  ❌ Compatibility calculation: NEEDS OPTIMIZATION (>200ms)`);
    }

    if (results.avgDiscoveryTime < 500) {
      console.log(`  ✅ Discovery query: EXCELLENT (<500ms)`);
    } else if (results.avgDiscoveryTime < 1000) {
      console.log(`  ⚠️  Discovery query: ACCEPTABLE (500-1000ms)`);
    } else {
      console.log(`  ❌ Discovery query: NEEDS OPTIMIZATION (>1000ms)`);
    }

    // Step 4: Cleanup
    if (config.cleanupAfter) {
      await cleanup(profileIds);
    } else {
      console.log(`\n⚠️  Skipping cleanup. ${profileIds.length} test profiles remain in database.`);
      console.log('Run with cleanup later: npx ts-node scripts/cleanup-load-test.ts');
    }

    console.log('\n✅ Load test complete!');
  } catch (error) {
    console.error('❌ Load test failed:', error);
    process.exit(1);
  }
}

main();
