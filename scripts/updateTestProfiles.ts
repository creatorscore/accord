/**
 * Update Existing Test Profiles with Complete Data
 *
 * This script updates all existing test profiles with complete onboarding data
 * Run with: npx ts-node --project tsconfig.node.json scripts/updateTestProfiles.ts
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

// Helper functions
function randomElement<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomBoolean(): boolean {
  return Math.random() > 0.5;
}

const religions = ['Christian', 'Catholic', 'Protestant', 'Muslim', 'Jewish', 'Hindu', 'Buddhist', 'Atheist', 'Agnostic', 'Spiritual but not religious', 'Prefer not to say'];
const politicalViews = ['Liberal', 'Progressive', 'Moderate', 'Conservative', 'Libertarian', 'Socialist', 'Apolitical', 'Prefer not to say'];
const housingPreferences = ['separate_spaces', 'roommates', 'separate_homes', 'shared_bedroom', 'flexible'];
const financialArrangements = ['separate', 'shared_expenses', 'joint', 'prenup_required', 'flexible'];
const primaryReasons = ['financial', 'immigration', 'family_pressure', 'legal_benefits', 'companionship', 'safety', 'other'];
const relationshipTypes = ['platonic', 'romantic', 'open'];

async function updateProfile(profileId: string, profileNumber: number) {
  console.log(`Updating profile ${profileNumber}...`);

  try {
    const heightInches = randomInt(60, 77); // 5'0" to 6'5"

    // Update profile with ALL onboarding fields
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        height_inches: heightInches,
        zodiac_sign: randomElement(['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces']),
        personality_type: randomElement(['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP']),
        love_language: randomElement(['Words of Affirmation', 'Quality Time', 'Receiving Gifts', 'Acts of Service', 'Physical Touch']),
        languages_spoken: [randomElement(['English', 'Spanish', 'French', 'Mandarin']), randomElement(['German', 'Italian', 'Portuguese', 'Japanese'])],
        religion: randomElement(religions),
        political_views: randomElement(politicalViews),
        my_story: `This is my story about seeking a lavender marriage. I'm looking for a genuine partnership built on mutual respect and understanding. ${randomElement(['I value honesty and open communication.', 'Family acceptance is important to me.', 'I want to build a life with someone who gets it.'])}`,
        profile_complete: true,
      })
      .eq('id', profileId);

    if (profileError) {
      console.error(`Error updating profile ${profileNumber}:`, profileError.message);
      return;
    }

    // Update or create preferences
    const wantsChildren = randomBoolean();
    const { error: prefsError } = await supabase
      .from('preferences')
      .upsert({
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
      }, {
        onConflict: 'profile_id'
      });

    if (prefsError) {
      console.error(`Error updating preferences for profile ${profileNumber}:`, prefsError.message);
      return;
    }

    console.log(`✅ Successfully updated profile ${profileNumber}`);
  } catch (error: any) {
    console.error(`Error updating profile ${profileNumber}:`, error.message);
  }
}

async function main() {
  console.log('🔄 Starting to update test profiles...\\n');

  try {
    // Get all test user profiles
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, display_name')
      .limit(15);

    if (error) throw error;

    if (!profiles || profiles.length === 0) {
      console.log('No profiles found to update.');
      return;
    }

    console.log(`Found ${profiles.length} profiles to update.\\n`);

    for (let i = 0; i < profiles.length; i++) {
      await updateProfile(profiles[i].id, i + 1);
    }

    console.log('\\n✨ Finished updating test profiles!');
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

main();
