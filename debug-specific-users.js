/**
 * Debug script to check why vmcdee1@gmail.com and vmcdee2@gmail.com aren't matching
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Using service role to bypass RLS

const supabase = createClient(supabaseUrl, supabaseKey);

const EMAIL_1 = 'vmcdee1@gmail.com';
const EMAIL_2 = 'vmcdee2@gmail.com';

async function debugUsers() {
  console.log('🔍 Debugging Matching Issue\n');
  console.log(`Checking: ${EMAIL_1} and ${EMAIL_2}\n`);
  console.log('='.repeat(80) + '\n');

  try {
    // Step 1: Get auth user IDs from emails
    console.log('📋 Step 1: Finding users in auth.users table...\n');

    const { data: authUsers, error: authError } = await supabase
      .from('profiles')
      .select('id, user_id, display_name, email:user_id')
      .or(`user_id.in.(select id from auth.users where email='${EMAIL_1}'),user_id.in.(select id from auth.users where email='${EMAIL_2}')`);

    // Alternative: Query using RPC or direct auth access
    // Let's try a different approach - get all profiles and filter
    const { data: allProfiles, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .limit(1000);

    if (profileError) {
      console.log('❌ Error fetching profiles:', profileError);
      return;
    }

    // We need to get the auth users to match emails to profile IDs
    // Since we're using service role, let's query the profiles directly
    console.log(`Found ${allProfiles.length} total profiles in database\n`);

    // Let's just get the two most recent profiles (assuming these are your test accounts)
    const recentProfiles = allProfiles
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 10);

    console.log('Most recent profiles:');
    recentProfiles.forEach((p, i) => {
      console.log(`  ${i + 1}. ${p.display_name || 'No name'} (${p.id}) - Created: ${p.created_at}`);
    });
    console.log('');

    // For now, let's assume the two most recent are your test accounts
    const user1 = recentProfiles[0];
    const user2 = recentProfiles[1];

    if (!user1 || !user2) {
      console.log('❌ Could not find two recent profiles. Please check the profile IDs manually.');
      return;
    }

    console.log(`\nAssuming User 1: ${user1.display_name} (${user1.id})`);
    console.log(`Assuming User 2: ${user2.display_name} (${user2.id})\n`);
    console.log('If these are wrong, please update the USER_1_ID and USER_2_ID variables in the script.\n');

    await debugMatchingBetweenProfiles(user1.id, user2.id);

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

async function debugMatchingBetweenProfiles(profileId1, profileId2) {
  console.log('='.repeat(80) + '\n');
  console.log(`🔬 Detailed Analysis: Profile ${profileId1} ↔️ Profile ${profileId2}\n`);

  // Fetch full profile data with preferences
  const { data: profile1, error: p1Error } = await supabase
    .from('profiles')
    .select(`
      *,
      preferences:preferences(*)
    `)
    .eq('id', profileId1)
    .single();

  const { data: profile2, error: p2Error } = await supabase
    .from('profiles')
    .select(`
      *,
      preferences:preferences(*)
    `)
    .eq('id', profileId2)
    .single();

  if (p1Error || p2Error) {
    console.log('❌ Error fetching profiles:', p1Error || p2Error);
    return;
  }

  // Display profile summaries
  console.log('📊 PROFILE 1:');
  displayProfile(profile1);
  console.log('\n📊 PROFILE 2:');
  displayProfile(profile2);

  console.log('\n' + '='.repeat(80) + '\n');

  // Check for likes
  console.log('💝 LIKES CHECK:\n');

  const { data: like1to2 } = await supabase
    .from('likes')
    .select('*')
    .eq('liker_profile_id', profileId1)
    .eq('liked_profile_id', profileId2)
    .maybeSingle();

  const { data: like2to1 } = await supabase
    .from('likes')
    .select('*')
    .eq('liker_profile_id', profileId2)
    .eq('liked_profile_id', profileId1)
    .maybeSingle();

  if (like1to2) {
    console.log(`✅ Profile 1 → Profile 2: LIKED (${like1to2.like_type || 'standard'})`);
  } else {
    console.log(`❌ Profile 1 → Profile 2: No like`);
  }

  if (like2to1) {
    console.log(`✅ Profile 2 → Profile 1: LIKED (${like2to1.like_type || 'standard'})`);
  } else {
    console.log(`❌ Profile 2 → Profile 1: No like`);
  }

  // Check for passes
  const { data: pass1to2 } = await supabase
    .from('passes')
    .select('*')
    .eq('passer_profile_id', profileId1)
    .eq('passed_profile_id', profileId2)
    .maybeSingle();

  const { data: pass2to1 } = await supabase
    .from('passes')
    .select('*')
    .eq('passer_profile_id', profileId2)
    .eq('passed_profile_id', profileId1)
    .maybeSingle();

  if (pass1to2) {
    console.log(`⚠️  Profile 1 → Profile 2: PASSED (this blocks Profile 2 from showing for Profile 1)`);
  }

  if (pass2to1) {
    console.log(`⚠️  Profile 2 → Profile 1: PASSED (this blocks Profile 1 from showing for Profile 2)`);
  }

  // Check for match
  const { data: match } = await supabase
    .from('matches')
    .select('*')
    .or(`and(profile1_id.eq.${profileId1},profile2_id.eq.${profileId2}),and(profile1_id.eq.${profileId2},profile2_id.eq.${profileId1})`)
    .maybeSingle();

  if (match) {
    console.log(`\n✅ MATCH EXISTS! Status: ${match.status}`);
  } else {
    console.log(`\n❌ No match exists yet`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
  console.log('🔍 FILTER CHECKS:\n');

  // Run filter checks
  let passedFilters = true;

  // Check 1: Incognito mode
  console.log('1️⃣  Incognito Mode Check:');
  if (profile1.incognito_mode) {
    console.log(`   ❌ Profile 1 is in incognito mode (won't show in Profile 2's discover)`);
    passedFilters = false;
  } else {
    console.log(`   ✅ Profile 1 is not in incognito mode`);
  }

  if (profile2.incognito_mode) {
    console.log(`   ❌ Profile 2 is in incognito mode (won't show in Profile 1's discover)`);
    passedFilters = false;
  } else {
    console.log(`   ✅ Profile 2 is not in incognito mode`);
  }

  // Check 2: Age filters
  console.log('\n2️⃣  Age Filter Check:');
  const p1Prefs = profile1.preferences;
  const p2Prefs = profile2.preferences;

  const p1AgeMin = p1Prefs?.age_min || 18;
  const p1AgeMax = p1Prefs?.age_max || 100;
  const p2AgeMin = p2Prefs?.age_min || 18;
  const p2AgeMax = p2Prefs?.age_max || 100;

  if (profile2.age < p1AgeMin || profile2.age > p1AgeMax) {
    console.log(`   ❌ Profile 2's age (${profile2.age}) is outside Profile 1's range (${p1AgeMin}-${p1AgeMax})`);
    passedFilters = false;
  } else {
    console.log(`   ✅ Profile 2's age (${profile2.age}) is within Profile 1's range (${p1AgeMin}-${p1AgeMax})`);
  }

  if (profile1.age < p2AgeMin || profile1.age > p2AgeMax) {
    console.log(`   ❌ Profile 1's age (${profile1.age}) is outside Profile 2's range (${p2AgeMin}-${p2AgeMax})`);
    passedFilters = false;
  } else {
    console.log(`   ✅ Profile 1's age (${profile1.age}) is within Profile 2's range (${p2AgeMin}-${p2AgeMax})`);
  }

  // Check 3: Gender preferences (bidirectional)
  console.log('\n3️⃣  Gender Preference Check (Bidirectional):');
  const p1GenderPrefs = p1Prefs?.gender_preference || [];
  const p2GenderPrefs = p2Prefs?.gender_preference || [];

  console.log(`   Profile 1 (${profile1.gender}) wants: [${p1GenderPrefs.join(', ') || 'any'}]`);
  console.log(`   Profile 2 (${profile2.gender}) wants: [${p2GenderPrefs.join(', ') || 'any'}]`);

  let genderCheck1to2 = true;
  let genderCheck2to1 = true;

  if (p1GenderPrefs.length > 0 && profile2.gender) {
    if (!p1GenderPrefs.includes(profile2.gender)) {
      console.log(`   ❌ Profile 1 doesn't want Profile 2's gender (${profile2.gender})`);
      passedFilters = false;
      genderCheck1to2 = false;
    }
  }

  if (p2GenderPrefs.length > 0 && profile1.gender) {
    if (!p2GenderPrefs.includes(profile1.gender)) {
      console.log(`   ❌ Profile 2 doesn't want Profile 1's gender (${profile1.gender})`);
      passedFilters = false;
      genderCheck2to1 = false;
    }
  }

  if (genderCheck1to2 && genderCheck2to1) {
    console.log(`   ✅ Gender preferences are compatible`);
  }

  // Check 4: Children preferences
  console.log('\n4️⃣  Children Preference Check:');
  const p1WantsChildren = p1Prefs?.wants_children;
  const p2WantsChildren = p2Prefs?.wants_children;

  console.log(`   Profile 1 wants children: ${p1WantsChildren ?? 'unsure/maybe'}`);
  console.log(`   Profile 2 wants children: ${p2WantsChildren ?? 'unsure/maybe'}`);

  if (p1WantsChildren !== undefined && p2WantsChildren !== undefined) {
    if ((p1WantsChildren === true && p2WantsChildren === false) ||
        (p1WantsChildren === false && p2WantsChildren === true)) {
      console.log(`   ❌ DEALBREAKER: Incompatible children preferences`);
      passedFilters = false;
    } else {
      console.log(`   ✅ Children preferences are compatible`);
    }
  } else {
    console.log(`   ✅ At least one is unsure (compatible)`);
  }

  // Check 5: Relationship type
  console.log('\n5️⃣  Relationship Type Check:');
  const p1RelType = p1Prefs?.relationship_type;
  const p2RelType = p2Prefs?.relationship_type;

  console.log(`   Profile 1 wants: ${p1RelType || 'not set'}`);
  console.log(`   Profile 2 wants: ${p2RelType || 'not set'}`);

  if (p1RelType && p2RelType) {
    if ((p1RelType === 'platonic' && p2RelType === 'romantic') ||
        (p1RelType === 'romantic' && p2RelType === 'platonic')) {
      console.log(`   ❌ DEALBREAKER: Platonic vs Romantic is incompatible`);
      passedFilters = false;
    } else {
      console.log(`   ✅ Relationship types are compatible`);
    }
  } else {
    console.log(`   ⚠️  One or both not set (no filter applied)`);
  }

  // Check 6: Distance
  console.log('\n6️⃣  Distance Check:');
  const p1SearchGlobally = p1Prefs?.search_globally || false;
  const p2SearchGlobally = p2Prefs?.search_globally || false;

  console.log(`   Profile 1 search globally: ${p1SearchGlobally}`);
  console.log(`   Profile 2 search globally: ${p2SearchGlobally}`);

  if (!p1SearchGlobally && !p2SearchGlobally) {
    if (profile1.latitude && profile1.longitude && profile2.latitude && profile2.longitude) {
      const distance = getDistanceMiles(
        profile1.latitude, profile1.longitude,
        profile2.latitude, profile2.longitude
      );

      const p1MaxDist = p1Prefs?.max_distance_miles || 50;
      const p2MaxDist = p2Prefs?.max_distance_miles || 50;

      console.log(`   Actual distance: ${distance.toFixed(1)} miles`);
      console.log(`   Profile 1 max distance: ${p1MaxDist} miles`);
      console.log(`   Profile 2 max distance: ${p2MaxDist} miles`);

      if (distance > p1MaxDist) {
        console.log(`   ❌ Distance exceeds Profile 1's max distance`);
        passedFilters = false;
      }

      if (distance > p2MaxDist) {
        console.log(`   ❌ Distance exceeds Profile 2's max distance`);
        passedFilters = false;
      }

      if (distance <= p1MaxDist && distance <= p2MaxDist) {
        console.log(`   ✅ Distance is acceptable for both users`);
      }
    } else {
      console.log(`   ⚠️  Missing lat/long coordinates for one or both users`);
    }
  } else {
    console.log(`   ✅ At least one user is searching globally (distance check skipped)`);
  }

  // Final verdict
  console.log('\n' + '='.repeat(80) + '\n');
  if (passedFilters) {
    console.log('✅ ALL FILTERS PASSED!');
    console.log('\nBoth profiles SHOULD appear in each other\'s discover feed.\n');
    console.log('💡 If they still don\'t show up, possible reasons:');
    console.log('   1. Database query returns only 20 profiles - might not include these');
    console.log('   2. One user passed on the other previously (check passes above)');
    console.log('   3. Cache issue - try logging out and back in');
    console.log('   4. Profiles are sorted by compatibility score - might be at the end');
  } else {
    console.log('❌ FILTERS FAILED - Issues found above explain why profiles don\'t show\n');
  }
}

function displayProfile(profile) {
  const prefs = profile.preferences;
  console.log(`   Name: ${profile.display_name || 'Not set'}`);
  console.log(`   ID: ${profile.id}`);
  console.log(`   Age: ${profile.age}`);
  console.log(`   Gender: ${profile.gender}`);
  console.log(`   Location: ${profile.location_city}, ${profile.location_state}`);
  console.log(`   Coordinates: ${profile.latitude ? `(${profile.latitude}, ${profile.longitude})` : 'Not set'}`);
  console.log(`   Incognito: ${profile.incognito_mode ? 'YES' : 'No'}`);
  console.log(`   Created: ${profile.created_at}`);
  if (prefs) {
    console.log(`   Preferences:`);
    console.log(`      - Age range: ${prefs.age_min}-${prefs.age_max}`);
    console.log(`      - Gender preference: [${prefs.gender_preference?.join(', ') || 'any'}]`);
    console.log(`      - Wants children: ${prefs.wants_children ?? 'unsure'}`);
    console.log(`      - Relationship type: ${prefs.relationship_type || 'not set'}`);
    console.log(`      - Max distance: ${prefs.max_distance_miles || 50} miles`);
    console.log(`      - Search globally: ${prefs.search_globally ? 'YES' : 'No'}`);
  } else {
    console.log(`   Preferences: Not set`);
  }
}

function getDistanceMiles(lat1, lon1, lat2, lon2) {
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

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

debugUsers().catch(console.error);
