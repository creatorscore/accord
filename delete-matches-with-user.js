/**
 * Delete all matches, likes, and passes with a specific user by email
 * This allows you to test matching flow again from scratch
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

// Email of the user to delete matches with
const TARGET_EMAIL = 'hello@fimgorgeous.com';

async function deleteMatchesWithUser() {
  try {
    console.log('🔍 Finding profile with email:', TARGET_EMAIL);
    console.log('='.repeat(80));

    // Step 1: Find the profile directly by joining with auth.users
    // Using RPC or direct query since we have service role key
    const { data: profiles, error: profileError } = await supabase
      .from('profiles')
      .select(`
        id,
        display_name,
        user_id
      `);

    if (profileError) {
      console.error('❌ Error fetching profiles:', profileError);
      return;
    }

    // Get all users to match email
    const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('❌ Error fetching auth users, trying alternate method...');
      console.log('Will search profiles by display name instead');

      // Fallback: ask user for the profile ID directly
      console.log('\n⚠️  Cannot access auth.users table.');
      console.log('Please provide the profile ID directly, or I can try searching by display name.');
      return;
    }

    const targetUser = users.find(u => u.email === TARGET_EMAIL);

    if (!targetUser) {
      console.error('❌ User not found with email:', TARGET_EMAIL);
      return;
    }

    const targetProfile = profiles.find(p => p.user_id === targetUser.id);

    if (!targetProfile) {
      console.error('❌ Profile not found for user:', targetUser.id);
      return;
    }

    console.log('✅ Found user:', {
      email: targetUser.email,
      user_id: targetUser.id,
      profile_id: targetProfile.id,
      display_name: targetProfile.display_name
    });

    if (profileError) {
      console.error('❌ Error fetching profile:', profileError);
      return;
    }

    console.log('✅ Found profile:', {
      profile_id: targetProfile.id,
      display_name: targetProfile.display_name
    });

    console.log('\n' + '='.repeat(80));
    console.log('🗑️  Deleting all match-related data...\n');

    const profileId = targetProfile.id;

    // Step 3: Delete matches (bidirectional)
    const { data: deletedMatches, error: matchesError } = await supabase
      .from('matches')
      .delete()
      .or(`profile1_id.eq.${profileId},profile2_id.eq.${profileId}`)
      .select();

    if (matchesError) {
      console.error('❌ Error deleting matches:', matchesError);
    } else {
      console.log(`✅ Deleted ${deletedMatches?.length || 0} matches`);
    }

    // Step 4: Delete likes sent TO this user
    const { data: deletedLikesReceived, error: likesReceivedError } = await supabase
      .from('likes')
      .delete()
      .eq('liked_profile_id', profileId)
      .select();

    if (likesReceivedError) {
      console.error('❌ Error deleting likes received:', likesReceivedError);
    } else {
      console.log(`✅ Deleted ${deletedLikesReceived?.length || 0} likes received by this user`);
    }

    // Step 5: Delete likes sent BY this user
    const { data: deletedLikesSent, error: likesSentError } = await supabase
      .from('likes')
      .delete()
      .eq('liker_profile_id', profileId)
      .select();

    if (likesSentError) {
      console.error('❌ Error deleting likes sent:', likesSentError);
    } else {
      console.log(`✅ Deleted ${deletedLikesSent?.length || 0} likes sent by this user`);
    }

    // Step 6: Delete passes (swipe left) received
    const { data: deletedPassesReceived, error: passesReceivedError } = await supabase
      .from('passes')
      .delete()
      .eq('passed_profile_id', profileId)
      .select();

    if (passesReceivedError) {
      console.error('❌ Error deleting passes received:', passesReceivedError);
    } else {
      console.log(`✅ Deleted ${deletedPassesReceived?.length || 0} passes received`);
    }

    // Step 7: Delete passes sent
    const { data: deletedPassesSent, error: passesSentError } = await supabase
      .from('passes')
      .delete()
      .eq('passer_profile_id', profileId)
      .select();

    if (passesSentError) {
      console.error('❌ Error deleting passes sent:', passesSentError);
    } else {
      console.log(`✅ Deleted ${deletedPassesSent?.length || 0} passes sent`);
    }

    // Step 8: Delete messages (optional - only if you want clean slate)
    const { data: deletedMessages, error: messagesError } = await supabase
      .from('messages')
      .delete()
      .or(`sender_profile_id.eq.${profileId},receiver_profile_id.eq.${profileId}`)
      .select();

    if (messagesError) {
      console.error('❌ Error deleting messages:', messagesError);
    } else {
      console.log(`✅ Deleted ${deletedMessages?.length || 0} messages`);
    }

    // Step 9: Delete review prompts
    const { data: deletedReviewPrompts, error: reviewPromptsError } = await supabase
      .from('review_prompts')
      .delete()
      .or(`profile1_id.eq.${profileId},profile2_id.eq.${profileId}`)
      .select();

    if (reviewPromptsError) {
      console.error('❌ Error deleting review prompts:', reviewPromptsError);
    } else {
      console.log(`✅ Deleted ${deletedReviewPrompts?.length || 0} review prompts`);
    }

    // Step 10: Delete reviews given/received
    const { data: deletedReviews, error: reviewsError } = await supabase
      .from('reviews')
      .delete()
      .or(`reviewer_id.eq.${profileId},reviewee_id.eq.${profileId}`)
      .select();

    if (reviewsError) {
      console.error('❌ Error deleting reviews:', reviewsError);
    } else {
      console.log(`✅ Deleted ${deletedReviews?.length || 0} reviews`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ DELETION COMPLETE!');
    console.log('\n📋 Summary:');
    console.log(`   - User: ${targetProfile.display_name} (${TARGET_EMAIL})`);
    console.log(`   - Matches: ${deletedMatches?.length || 0}`);
    console.log(`   - Likes Received: ${deletedLikesReceived?.length || 0}`);
    console.log(`   - Likes Sent: ${deletedLikesSent?.length || 0}`);
    console.log(`   - Passes Received: ${deletedPassesReceived?.length || 0}`);
    console.log(`   - Passes Sent: ${deletedPassesSent?.length || 0}`);
    console.log(`   - Messages: ${deletedMessages?.length || 0}`);
    console.log(`   - Review Prompts: ${deletedReviewPrompts?.length || 0}`);
    console.log(`   - Reviews: ${deletedReviews?.length || 0}`);
    console.log('\n🎯 You can now rematch with this user for testing!');

  } catch (error) {
    console.error('❌ Fatal error:', error);
  }
}

deleteMatchesWithUser().catch(console.error);
