/**
 * Reset Swipes for Testing
 *
 * This script clears all likes and passes for a specific profile
 * Run with: npx ts-node --project tsconfig.node.json scripts/resetSwipes.ts <profile_id>
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

async function resetSwipes(profileId?: string) {
  console.log('🔄 Resetting swipes...\n');

  try {
    if (profileId) {
      // Reset swipes for specific profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('display_name')
        .eq('id', profileId)
        .single();

      console.log(`Resetting swipes for: ${profile?.display_name || profileId}\n`);

      // Delete likes
      const { error: likesError } = await supabase
        .from('likes')
        .delete()
        .eq('liker_profile_id', profileId);

      if (likesError) throw likesError;

      // Delete passes
      const { error: passesError } = await supabase
        .from('passes')
        .delete()
        .eq('passer_profile_id', profileId);

      if (passesError) throw passesError;

      console.log('✅ Swipe history cleared!');
      console.log('You can now see all profiles again in the discover screen.');
    } else {
      // Reset all swipes for all profiles
      console.log('Resetting ALL swipes for ALL profiles...\n');

      const { error: likesError } = await supabase
        .from('likes')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (likesError) throw likesError;

      const { error: passesError } = await supabase
        .from('passes')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (passesError) throw passesError;

      console.log('✅ All swipe history cleared for all users!');
    }
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

// Get profile ID from command line argument
const profileId = process.argv[2];

if (profileId && profileId !== 'all') {
  resetSwipes(profileId);
} else if (profileId === 'all') {
  resetSwipes();
} else {
  console.log('Usage:');
  console.log('  Reset specific profile: npx ts-node --project tsconfig.node.json scripts/resetSwipes.ts <profile_id>');
  console.log('  Reset all profiles:     npx ts-node --project tsconfig.node.json scripts/resetSwipes.ts all');
  console.log('\nYour profile ID: 38b19907-c265-4b2c-9a51-435191f60120');
  process.exit(1);
}
