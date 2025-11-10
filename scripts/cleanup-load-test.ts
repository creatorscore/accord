/**
 * Cleanup Script for Load Test Profiles
 *
 * Removes all profiles created by load testing scripts
 *
 * Usage:
 *   npx tsx scripts/cleanup-load-test.ts
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function cleanupLoadTestProfiles() {
  console.log('🧹 Finding load test profiles...');

  try {
    // Find all profiles created by load test (display_name starts with LoadTest_)
    const { data: profiles, error: fetchError } = await supabase
      .from('profiles')
      .select('id, display_name, user_id')
      .like('display_name', 'LoadTest_%');

    if (fetchError) {
      console.error('❌ Error fetching profiles:', fetchError);
      return;
    }

    if (!profiles || profiles.length === 0) {
      console.log('✅ No load test profiles found. Database is clean.');
      return;
    }

    console.log(`Found ${profiles.length} load test profiles to delete.`);

    // Delete profiles (this will cascade to preferences, likes, matches, etc.)
    const profileIds = profiles.map(p => p.id);
    const { error: deleteProfilesError } = await supabase
      .from('profiles')
      .delete()
      .in('id', profileIds);

    if (deleteProfilesError) {
      console.error('❌ Error deleting profiles:', deleteProfilesError);
      return;
    }

    console.log(`✅ Deleted ${profiles.length} profiles`);

    // Delete auth users
    console.log('🧹 Cleaning up auth users...');
    const userIds = profiles.map(p => p.user_id);

    for (const userId of userIds) {
      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch (error) {
        console.error(`⚠️  Could not delete user ${userId}:`, error);
      }
    }

    console.log(`✅ Deleted ${userIds.length} auth users`);
    console.log('\n✅ Cleanup complete!');
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupLoadTestProfiles();
