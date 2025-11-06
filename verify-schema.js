/**
 * Verify Supabase database schema matches code expectations
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifySchema() {
  console.log('🔍 Verifying Database Schema\n');
  console.log('='.repeat(80) + '\n');

  try {
    // Query information_schema to get actual table columns
    const { data: profilesColumns, error: profilesError } = await supabase
      .rpc('get_table_columns', { table_name: 'profiles' })
      .catch(() => null);

    // Alternative: Query a sample record to see available columns
    console.log('📋 Step 1: Checking PROFILES table structure...\n');

    const { data: sampleProfile, error: sampleError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1)
      .single();

    if (sampleError) {
      console.log('Note: No profiles in database yet, will check schema via query\n');
    } else {
      console.log('✅ PROFILES table columns found:');
      const profileColumns = Object.keys(sampleProfile);
      profileColumns.sort().forEach(col => {
        console.log(`   - ${col}`);
      });
      console.log(`\nTotal: ${profileColumns.length} columns\n`);
    }

    // Check preferences table
    console.log('='.repeat(80) + '\n');
    console.log('📋 Step 2: Checking PREFERENCES table structure...\n');

    const { data: samplePreference, error: prefError } = await supabase
      .from('preferences')
      .select('*')
      .limit(1)
      .single();

    if (prefError) {
      console.log('Note: No preferences in database yet\n');
    } else {
      console.log('✅ PREFERENCES table columns found:');
      const prefColumns = Object.keys(samplePreference);
      prefColumns.sort().forEach(col => {
        console.log(`   - ${col}`);
      });
      console.log(`\nTotal: ${prefColumns.length} columns\n`);

      // Show lifestyle_preferences structure if it exists
      if (samplePreference.lifestyle_preferences) {
        console.log('📊 lifestyle_preferences JSONB structure:');
        console.log(JSON.stringify(samplePreference.lifestyle_preferences, null, 2));
        console.log('');
      }
    }

    // Now verify expected columns exist
    console.log('='.repeat(80) + '\n');
    console.log('📋 Step 3: Verifying EXPECTED columns exist...\n');

    // Expected preferences columns based on code
    const expectedPrefColumns = [
      'id',
      'profile_id',
      'max_distance_miles',
      'willing_to_relocate',
      'search_globally',
      'primary_reason',
      'relationship_type',
      'wants_children',
      'children_arrangement',
      'financial_arrangement',
      'housing_preference',
      'lifestyle_preferences',
      'age_min',
      'age_max',
      'gender_preference',
      'dealbreakers',
      'must_haves',
      'preferred_cities',
      'created_at',
      'updated_at'
    ];

    console.log('Checking if all expected PREFERENCES columns exist:\n');

    const { data: testQuery, error: testError } = await supabase
      .from('preferences')
      .select(expectedPrefColumns.join(', '))
      .limit(1);

    if (testError) {
      console.log('❌ ERROR: Some expected columns are missing!\n');
      console.log('Error message:', testError.message);
      console.log('\nExpected columns that might be missing:');

      // Try each column individually to find which ones are missing
      const missingColumns = [];
      for (const col of expectedPrefColumns) {
        const { error: colError } = await supabase
          .from('preferences')
          .select(col)
          .limit(1);

        if (colError && colError.message.includes('column')) {
          missingColumns.push(col);
          console.log(`   ❌ ${col} - NOT FOUND`);
        }
      }

      if (missingColumns.length > 0) {
        console.log(`\n⚠️  Found ${missingColumns.length} missing columns!`);
        console.log('\nMissing columns:', missingColumns.join(', '));
      }
    } else {
      console.log('✅ All expected PREFERENCES columns exist!\n');
    }

    // Check profiles table expected columns
    console.log('='.repeat(80) + '\n');
    console.log('📋 Step 4: Verifying PROFILES columns used in matching...\n');

    const expectedProfileColumns = [
      'id',
      'user_id',
      'display_name',
      'age',
      'gender',
      'latitude',
      'longitude',
      'location_city',
      'location_state',
      'religion',
      'political_views',
      'incognito_mode',
      'ethnicity',
      'languages_spoken',
      'hobbies',
      'interests',
      'zodiac_sign',
      'personality_type',
      'love_language',
      'bio',
      'my_story',
      'occupation',
      'education',
      'prompt_answers'
    ];

    const { data: profileTest, error: profileTestError } = await supabase
      .from('profiles')
      .select(expectedProfileColumns.join(', '))
      .limit(1);

    if (profileTestError) {
      console.log('❌ ERROR: Some profile columns are missing!\n');
      console.log('Error message:', profileTestError.message);
    } else {
      console.log('✅ All expected PROFILES columns exist!\n');
    }

    // Verify relationships work
    console.log('='.repeat(80) + '\n');
    console.log('📋 Step 5: Testing JOIN relationships...\n');

    const { data: joinTest, error: joinError } = await supabase
      .from('profiles')
      .select(`
        id,
        display_name,
        preferences:preferences(
          age_min,
          age_max,
          gender_preference,
          lifestyle_preferences
        )
      `)
      .limit(1)
      .single();

    if (joinError) {
      console.log('❌ ERROR: Cannot join profiles with preferences!');
      console.log('Error:', joinError.message);
    } else {
      console.log('✅ JOIN between profiles and preferences works!\n');
      if (joinTest.preferences) {
        console.log('Sample joined data:');
        console.log(JSON.stringify(joinTest, null, 2));
      }
    }

    // Check if preferred_cities column exists
    console.log('\n' + '='.repeat(80) + '\n');
    console.log('📋 Step 6: Checking PREFERRED_CITIES column (critical)...\n');

    const { data: cityTest, error: cityError } = await supabase
      .from('preferences')
      .select('preferred_cities')
      .limit(1);

    if (cityError) {
      console.log('❌ CRITICAL: preferred_cities column is MISSING!');
      console.log('   This column is used in matching-preferences.tsx but doesn\'t exist.');
      console.log('   Error:', cityError.message);
      console.log('\n   FIX: Run this SQL migration:');
      console.log('   ALTER TABLE preferences ADD COLUMN preferred_cities TEXT[];');
    } else {
      console.log('✅ preferred_cities column exists!');
    }

    // Summary
    console.log('\n' + '='.repeat(80) + '\n');
    console.log('📊 VERIFICATION SUMMARY\n');
    console.log('Database URL:', supabaseUrl);
    console.log('Connection: ✅ Successful');
    console.log('\nNext steps:');
    console.log('1. Review any missing columns above');
    console.log('2. If preferred_cities is missing, add it via SQL migration');
    console.log('3. Test the full flow: onboarding → settings → discover');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

verifySchema().catch(console.error);
