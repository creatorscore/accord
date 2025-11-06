/**
 * Seed Script for Test Profiles
 *
 * This script creates realistic, fully-filled-out test profiles for Accord
 * Run with: npx ts-node scripts/seedTestProfiles.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
config();

// Initialize Supabase client
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials. Set EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Sample data arrays
const names = {
  male: ['Alex', 'Jordan', 'Morgan', 'Taylor', 'Casey', 'Riley', 'Quinn', 'Avery'],
  female: ['Jamie', 'Sam', 'Drew', 'Blake', 'Reese', 'Cameron', 'Skylar', 'Finley'],
};

const occupations = [
  'Software Engineer',
  'Marketing Manager',
  'Graphic Designer',
  'Teacher',
  'Nurse',
  'Accountant',
  'Sales Manager',
  'Data Analyst',
  'Product Manager',
  'Consultant',
];

const educations = [
  "Bachelor's in Computer Science",
  "Master's in Business Administration",
  "Bachelor's in Psychology",
  "Bachelor's in Engineering",
  "Master's in Education",
  "Bachelor's in Marketing",
  "Master's in Public Health",
  "Bachelor's in Finance",
];

const bios = [
  "Looking for someone to build a life with on our own terms. I value honesty, independence, and mutual respect. Let's create a partnership that works for both of us.",
  "Seeking a practical arrangement with genuine friendship at its core. I'm career-focused, love travel, and believe in living authentically while maintaining appearances for family.",
  "Family-oriented but living my truth. I want to find someone who understands the need for a traditional-looking marriage while we both pursue our own happiness.",
  "Professional and grounded, seeking a mutually beneficial partnership. I value communication, trust, and building something meaningful together.",
  "Creative soul looking for a lavender marriage with someone who shares my values. Let's support each other's dreams while navigating society's expectations together.",
  "Down-to-earth and ambitious, I'm seeking a partnership based on friendship and shared goals. I believe we can have the family life we want while being true to ourselves.",
];

const prompts = [
  {
    prompt: "My ideal weekend involves...",
    answers: [
      "Brunch with friends, hiking in nature, and catching up on my favorite shows",
      "Exploring local farmer's markets, trying new restaurants, and relaxing at home",
      "Working on creative projects, spending time outdoors, and having game nights",
      "Traveling to new places, reading in coffee shops, and hosting dinner parties",
    ],
  },
  {
    prompt: "The key to a successful partnership is...",
    answers: [
      "Open communication, mutual respect, and supporting each other's individual goals",
      "Honesty, trust, and understanding that we're a team navigating life together",
      "Clear boundaries, shared values, and the freedom to be our authentic selves",
      "Strong friendship, aligned life goals, and unwavering support for one another",
    ],
  },
  {
    prompt: "I'm looking for someone who...",
    answers: [
      "Understands the value of a practical arrangement while still building genuine friendship",
      "Is mature, family-oriented, and ready to create a life partnership on our terms",
      "Values independence, has their own passions, and wants to build something meaningful",
      "Is honest, ambitious, and seeking a mutually beneficial relationship",
    ],
  },
];

const cities = [
  { city: 'San Francisco', state: 'CA', lat: 37.7749, lon: -122.4194 },
  { city: 'New York', state: 'NY', lat: 40.7128, lon: -74.0060 },
  { city: 'Los Angeles', state: 'CA', lat: 34.0522, lon: -118.2437 },
  { city: 'Chicago', state: 'IL', lat: 41.8781, lon: -87.6298 },
  { city: 'Seattle', state: 'WA', lat: 47.6062, lon: -122.3321 },
  { city: 'Austin', state: 'TX', lat: 30.2672, lon: -97.7431 },
  { city: 'Denver', state: 'CO', lat: 39.7392, lon: -104.9903 },
  { city: 'Portland', state: 'OR', lat: 45.5152, lon: -122.6784 },
];

const primaryReasons = [
  'financial',
  'immigration',
  'family_pressure',
  'legal_benefits',
  'companionship',
  'safety',
  'other',
];

const relationshipTypes = ['platonic', 'romantic', 'open'];

const housingPreferences = ['separate_spaces', 'roommates', 'separate_homes', 'shared_bedroom', 'flexible'];
const financialArrangements = ['separate', 'shared_expenses', 'joint', 'prenup_required', 'flexible'];

const religions = ['Christian', 'Catholic', 'Protestant', 'Muslim', 'Jewish', 'Hindu', 'Buddhist', 'Atheist', 'Agnostic', 'Spiritual but not religious', 'Prefer not to say'];
const politicalViews = ['Liberal', 'Progressive', 'Moderate', 'Conservative', 'Libertarian', 'Socialist', 'Apolitical', 'Prefer not to say'];

function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBoolean(): boolean {
  return Math.random() > 0.5;
}

async function createTestProfile(index: number) {
  console.log(`Creating test profile ${index + 1}...`);

  // Random data
  const gender = randomElement(['man', 'woman', 'non-binary']);
  const nameList = gender === 'man' ? names.male : names.female;
  const displayName = randomElement(nameList);
  const age = randomInt(25, 40);
  const location = randomElement(cities);
  const heightInches = randomInt(60, 77); // 5'0" (60") to 6'5" (77")

  // Create test user account (using service role key to bypass auth)
  const email = `test${index + 1}@accord.app`;
  const password = 'TestUser123!';

  try {
    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('display_name', displayName)
      .single();

    if (existingUser) {
      console.log(`Profile ${displayName} already exists, skipping...`);
      return;
    }

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError) {
      console.error(`Error creating auth user: ${authError.message}`);
      return;
    }

    const userId = authData.user.id;

    // Create profile with ALL onboarding fields
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: userId,
        display_name: displayName,
        age,
        gender,
        sexual_orientation: randomElement(['lesbian', 'gay', 'bisexual', 'queer', 'pansexual']),
        location_city: location.city,
        location_state: location.state,
        location_country: 'US',
        latitude: location.lat,
        longitude: location.lon,
        bio: randomElement(bios),
        occupation: randomElement(occupations),
        education: randomElement(educations),
        height_inches: heightInches,
        zodiac_sign: randomElement(['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']),
        personality_type: randomElement(['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP']),
        love_language: randomElement(['Words of Affirmation', 'Quality Time', 'Receiving Gifts', 'Acts of Service', 'Physical Touch']),
        languages_spoken: [randomElement(['English', 'Spanish', 'French', 'Mandarin']), randomElement(['German', 'Italian', 'Portuguese', 'Japanese'])],
        religion: randomElement(religions),
        political_views: randomElement(politicalViews),
        my_story: `This is my story about seeking a lavender marriage. I'm looking for a genuine partnership built on mutual respect and understanding. ${randomElement(['I value honesty and open communication.', 'Family acceptance is important to me.', 'I want to build a life with someone who gets it.'])}`,
        is_verified: randomBoolean(),
        is_active: true,
        profile_complete: true,
      })
      .select()
      .single();

    if (profileError) {
      console.error(`Error creating profile: ${profileError.message}`);
      return;
    }

    const profileId = profile.id;

    // Create preferences with all fields
    const wantsChildren = randomBoolean();
    await supabase.from('preferences').insert({
      profile_id: profileId,
      max_distance_miles: randomElement([25, 50, 100, 250]),
      willing_to_relocate: randomBoolean(),
      primary_reason: randomElement(primaryReasons),
      relationship_type: randomElement(relationshipTypes),
      wants_children: wantsChildren,
      children_arrangement: wantsChildren ? randomElement(['adopt', 'surrogate', 'coparent', 'foster', 'open']) : null,
      financial_arrangement: randomElement(financialArrangements),
      housing_preference: randomElement(housingPreferences),
      age_min: 22,
      age_max: 50,
      gender_preference: [randomElement(['Man', 'Woman', 'Non-binary'])],
    });

    // Create prompt answers
    const selectedPrompts = [
      { prompt: prompts[0].prompt, answer: randomElement(prompts[0].answers) },
      { prompt: prompts[1].prompt, answer: randomElement(prompts[1].answers) },
      { prompt: prompts[2].prompt, answer: randomElement(prompts[2].answers) },
    ];

    await supabase.from('prompt_answers').insert(
      selectedPrompts.map((p, idx) => ({
        profile_id: profileId,
        prompt: p.prompt,
        answer: p.answer,
        display_order: idx,
      }))
    );

    // Note: Photos would need to be uploaded to Supabase Storage
    // For now, we'll create placeholder photo records
    const placeholderPhotos = [
      `https://i.pravatar.cc/400?img=${index * 3 + 1}`,
      `https://i.pravatar.cc/400?img=${index * 3 + 2}`,
      `https://i.pravatar.cc/400?img=${index * 3 + 3}`,
    ];

    await supabase.from('photos').insert(
      placeholderPhotos.map((url, idx) => ({
        profile_id: profileId,
        storage_path: url,
        url: url,
        display_order: idx,
        is_primary: idx === 0,
        is_public: true,
      }))
    );

    console.log(`✅ Successfully created profile: ${displayName} (${email})`);
  } catch (error: any) {
    console.error(`Error creating test profile: ${error.message}`);
  }
}

async function main() {
  console.log('🌱 Starting to seed test profiles...\n');

  const numberOfProfiles = 10;

  for (let i = 0; i < numberOfProfiles; i++) {
    await createTestProfile(i);
  }

  console.log('\n✨ Finished seeding test profiles!');
  console.log('\nTest user credentials:');
  console.log('Email: test1@accord.app through test10@accord.app');
  console.log('Password: TestUser123!');
}

main();
