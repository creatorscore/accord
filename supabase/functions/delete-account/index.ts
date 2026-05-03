// Edge Function: delete-account
// Permanently deletes a user's account and all associated data
// Requires authenticated user - users can only delete their own account

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Create client with user's auth token to verify identity
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Get the authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Get request body
    const { reason, feedback } = await req.json();

    // Create admin client with service role key for deletion
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Get user's profile ID (may not exist if deleting from welcome screen before onboarding)
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, voice_intro_url')
      .eq('user_id', user.id)
      .maybeSingle();

    // Save deletion feedback (optional - for analytics)
    try {
      await supabaseAdmin.from('account_deletions').insert({
        profile_id: profile?.id || null,
        user_id: user.id,
        reason: reason || 'not_specified',
        feedback: feedback || null,
        email: user.email,
      });
    } catch (feedbackError) {
      // Ignore feedback errors - continue with deletion
      console.log('Could not save deletion feedback:', feedbackError);
    }

    // Only clean up profile data if a profile exists
    if (profile) {
      // 1. Delete photos from Supabase Storage
      try {
        const { data: photos } = await supabaseAdmin
          .from('photos')
          .select('storage_path')
          .eq('profile_id', profile.id);

        if (photos && photos.length > 0) {
          const storagePaths = photos.map((p: any) => p.storage_path).filter(Boolean);
          if (storagePaths.length > 0) {
            const { error: storageError } = await supabaseAdmin.storage
              .from('profile-photos')
              .remove(storagePaths);
            if (storageError) {
              console.error('Error deleting photos from storage:', storageError);
            } else {
              console.log(`Deleted ${storagePaths.length} photos from storage`);
            }
          }
        }
      } catch (e) {
        console.error('Error cleaning up photo storage:', e);
      }

      // 2. Delete voice intro from Supabase Storage
      try {
        if (profile.voice_intro_url) {
          const voicePath = `${profile.id}/voice-intro.m4a`;
          await supabaseAdmin.storage.from('voice-intros').remove([voicePath]);
          console.log('Deleted voice intro from storage');
        }
      } catch (e) {
        console.error('Error cleaning up voice intro storage:', e);
      }

      // 3. Cancel RevenueCat subscription (best-effort)
      try {
        const revenueCatSecretKey = Deno.env.get('REVENUECAT_SECRET_KEY');
        if (revenueCatSecretKey) {
          const rcResponse = await fetch(
            `https://api.revenuecat.com/v1/subscribers/${user.id}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${revenueCatSecretKey}`,
                'Content-Type': 'application/json',
              },
            }
          );
          console.log(`RevenueCat subscriber deletion: ${rcResponse.status}`);
        }
      } catch (e) {
        console.error('Error deleting RevenueCat subscriber:', e);
      }

      // 4. Delete profile (cascade delete will handle related data via FK constraints)
      const { error: deleteProfileError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .eq('id', profile.id);

      if (deleteProfileError) {
        console.error('Error deleting profile:', deleteProfileError);
        return new Response(
          JSON.stringify({ error: 'Failed to delete profile data' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    } else {
      console.log('No profile found - skipping profile cleanup, deleting auth user only');
    }

    // 5. Delete auth user using admin API
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(user.id);

    if (deleteUserError) {
      console.error('Error deleting auth user:', deleteUserError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete auth user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log(`Successfully deleted account for user ${user.id} (${user.email})`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Account deleted successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in delete-account:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to delete account' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
