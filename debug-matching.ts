/**
 * Debug script to identify why a profile isn't showing in discover
 *
 * Usage:
 * 1. Replace USER_B_ID with the profile ID of the user viewing discover
 * 2. Replace USER_A_ID with the profile ID that should appear but doesn't
 * 3. Run: npx ts-node debug-matching.ts
 */

import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

// TEST PROFILE IDS (replace with your test account IDs)
const USER_B_ID = 'your-user-b-profile-id'; // The one who should see the other user
const USER_A_ID = 'your-user-a-profile-id'; // The one who liked User B

async function debugMatching() {
  console.log('🔍 DEBUG: Matching Algorithm Issue\n');
  console.log(`Checking why User A (${USER_A_ID}) doesn't appear for User B (${USER_B_ID})\n`);

  // Step 1: Verify the like exists
  console.log('📋 Step 1: Checking if like was recorded...');
  const { data: like, error: likeError } = await supabase
    .from('likes')
    .select('*')
    .eq('liker_profile_id', USER_A_ID)
    .eq('liked_profile_id', USER_B_ID)
    .single();

  if (likeError || !like) {
    console.log('❌ ISSUE FOUND: Like was not recorded in database!');
    console.log('Error:', likeError);
    return;
  }
  console.log('✅ Like exists:', like);
  console.log('');

  // Step 2: Check if User B has already swiped on User A
  console.log('📋 Step 2: Checking if User B already swiped on User A...');

  const { data: existingLike } = await supabase
    .from('likes')
    .select('*')
    .eq('liker_profile_id', USER_B_ID)
    .eq('liked_profile_id', USER_A_ID)
    .single();

  const { data: existingPass } = await supabase
    .from('passes')
    .select('*')
    .eq('passer_profile_id', USER_B_ID)
    .eq('passed_profile_id', USER_A_ID)
    .single();

  if (existingLike) {
    console.log('✅ User B already liked User A (should be matched)');
  } else if (existingPass) {
    console.log('❌ ISSUE FOUND: User B previously passed on User A!');
    console.log('Pass record:', existingPass);
    console.log('Solution: Delete this pass record or implement "undo" feature');
    return;
  } else {
    console.log('✅ User B has not swiped on User A yet (good)');
  }
  console.log('');

  // Step 3: Fetch both profiles
  console.log('📋 Step 3: Fetching both profiles...');
  const { data: userB, error: userBError } = await supabase
    .from('profiles')
    .select('*, preferences(*)')
    .eq('id', USER_B_ID)
    .single();

  const { data: userA, error: userAError } = await supabase
    .from('profiles')
    .select('*, preferences(*)')
    .eq('id', USER_A_ID)
    .single();

  if (userBError || userAError) {
    console.log('❌ Error fetching profiles:', userBError || userAError);
    return;
  }

  console.log('User B Profile:', {
    id: userB.id,
    display_name: userB.display_name,
    age: userB.age,
    gender: userB.gender,
    incognito_mode: userB.incognito_mode,
    location: `${userB.location_city}, ${userB.location_state}`,
  });

  console.log('User A Profile:', {
    id: userA.id,
    display_name: userA.display_name,
    age: userA.age,
    gender: userA.gender,
    incognito_mode: userA.incognito_mode,
    location: `${userA.location_city}, ${userA.location_state}`,
  });
  console.log('');

  // Step 4: Check incognito mode
  console.log('📋 Step 4: Checking incognito mode...');
  if (userA.incognito_mode === true) {
    console.log('❌ ISSUE FOUND: User A is in incognito mode!');
    console.log('   Incognito profiles are excluded from discover (line 268 in discover.tsx)');
    return;
  }
  console.log('✅ User A is not in incognito mode');
  console.log('');

  // Step 5: Check age filters
  console.log('📋 Step 5: Checking age compatibility...');
  const userBMinAge = userB.preferences?.age_min || 18;
  const userBMaxAge = userB.preferences?.age_max || 100;

  if (userA.age < userBMinAge || userA.age > userBMaxAge) {
    console.log(`❌ ISSUE FOUND: User A's age (${userA.age}) is outside User B's age range (${userBMinAge}-${userBMaxAge})`);
    console.log('   Age filters are applied at database level (line 282 in discover.tsx)');
    return;
  }
  console.log(`✅ User A's age (${userA.age}) is within User B's range (${userBMinAge}-${userBMaxAge})`);
  console.log('');

  // Step 6: Check gender preferences (bidirectional)
  console.log('📋 Step 6: Checking gender preferences...');

  // Check if User B's gender is in User A's gender preferences
  const userAGenderPrefs = userA.preferences?.gender_preference || [];
  if (userAGenderPrefs.length > 0 && userB.gender) {
    if (!userAGenderPrefs.includes(userB.gender)) {
      console.log(`❌ ISSUE FOUND: User B's gender (${userB.gender}) is not in User A's preferences`);
      console.log(`   User A is looking for: ${userAGenderPrefs.join(', ')}`);
      console.log('   This is a bidirectional check (line 423 in discover.tsx)');
      return;
    }
  }

  // Check if User A's gender is in User B's gender preferences
  const userBGenderPrefs = userB.preferences?.gender_preference || [];
  if (userBGenderPrefs.length > 0 && userA.gender) {
    if (!userBGenderPrefs.includes(userA.gender)) {
      console.log(`❌ ISSUE FOUND: User A's gender (${userA.gender}) is not in User B's preferences`);
      console.log(`   User B is looking for: ${userBGenderPrefs.join(', ')}`);
      return;
    }
  }

  console.log('✅ Gender preferences are compatible');
  console.log(`   User A (${userA.gender}) wants: ${userAGenderPrefs.join(', ')}`);
  console.log(`   User B (${userB.gender}) wants: ${userBGenderPrefs.join(', ')}`);
  console.log('');

  // Step 7: Check children preferences
  console.log('📋 Step 7: Checking children preferences...');
  const userBWantsChildren = userB.preferences?.wants_children;
  const userAWantsChildren = userA.preferences?.wants_children;

  if (userBWantsChildren !== undefined && userAWantsChildren !== undefined) {
    if ((userBWantsChildren === true && userAWantsChildren === false) ||
        (userBWantsChildren === false && userAWantsChildren === true)) {
      console.log('❌ ISSUE FOUND: Children preferences are incompatible!');
      console.log(`   User B wants children: ${userBWantsChildren}`);
      console.log(`   User A wants children: ${userAWantsChildren}`);
      console.log('   This is a hard dealbreaker (line 429 in discover.tsx)');
      return;
    }
  }

  console.log('✅ Children preferences are compatible');
  console.log(`   User B wants children: ${userBWantsChildren ?? 'maybe/unsure'}`);
  console.log(`   User A wants children: ${userAWantsChildren ?? 'maybe/unsure'}`);
  console.log('');

  // Step 8: Check relationship type
  console.log('📋 Step 8: Checking relationship type...');
  const userBRelType = userB.preferences?.relationship_type;
  const userARelType = userA.preferences?.relationship_type;

  if (userBRelType && userARelType) {
    const incompatiblePairs = [
      ['platonic', 'romantic'],
      ['romantic', 'platonic']
    ];

    const isIncompatible = incompatiblePairs.some(
      ([type1, type2]) =>
        (userBRelType === type1 && userARelType === type2)
    );

    if (isIncompatible) {
      console.log('❌ ISSUE FOUND: Relationship types are incompatible!');
      console.log(`   User B wants: ${userBRelType}`);
      console.log(`   User A wants: ${userARelType}`);
      console.log('   Platonic and Romantic are dealbreakers (line 444 in discover.tsx)');
      return;
    }
  }

  console.log('✅ Relationship types are compatible');
  console.log(`   User B wants: ${userBRelType || 'not set'}`);
  console.log(`   User A wants: ${userARelType || 'not set'}`);
  console.log('');

  // Step 9: Check distance
  console.log('📋 Step 9: Checking distance...');
  const userBSearchGlobally = userB.preferences?.search_globally || false;
  const userASearchGlobally = userA.preferences?.search_globally || false;

  if (!userBSearchGlobally && !userASearchGlobally) {
    // Calculate distance
    if (userB.latitude && userB.longitude && userA.latitude && userA.longitude) {
      const distance = getDistanceMiles(
        userB.latitude, userB.longitude,
        userA.latitude, userA.longitude
      );

      const maxDistance = userB.preferences?.max_distance_miles || 50;

      if (distance > maxDistance) {
        console.log(`❌ ISSUE FOUND: Distance too far!`);
        console.log(`   Actual distance: ${distance.toFixed(1)} miles`);
        console.log(`   User B's max distance: ${maxDistance} miles`);
        console.log('   Solution: Either user should enable "search_globally" or increase max_distance');
        return;
      }

      console.log(`✅ Distance is acceptable: ${distance.toFixed(1)} miles (max: ${maxDistance})`);
    } else {
      console.log('⚠️  Warning: One or both users missing lat/long coordinates');
    }
  } else {
    console.log('✅ At least one user is searching globally (distance filter skipped)');
  }
  console.log('');

  // Step 10: Final summary
  console.log('🎉 ALL CHECKS PASSED!');
  console.log('');
  console.log('User A should appear in User B\'s discover feed.');
  console.log('');
  console.log('💡 Possible reasons it still doesn\'t show:');
  console.log('1. Database query limit (only 20 profiles loaded) - User A might be profile #21+');
  console.log('2. Sorting issue - User A has low compatibility score and appears later');
  console.log('3. Cache issue - Try logging out and back in');
  console.log('4. Race condition - Try refreshing the discover page multiple times');
  console.log('');
  console.log('🔧 Debugging steps:');
  console.log('1. Check how many profiles are being returned in total');
  console.log('2. Check User A\'s compatibility score relative to other profiles');
  console.log('3. Add console.log to discover.tsx line 269 to see full query results');
}

// Haversine formula to calculate distance between two lat/long points
function getDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Radius of Earth in miles
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Run the debug script
debugMatching().catch(console.error);
