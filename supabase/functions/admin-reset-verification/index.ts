// Edge Function: admin-reset-verification
// Resets photo verification attempts for a user (admin only)

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

    // Create admin client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the requester is an admin
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (adminError || !adminProfile?.is_admin) {
      return new Response(
        JSON.stringify({ error: 'Admin privileges required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Get request body
    const { profileId } = await req.json();

    if (!profileId) {
      return new Response(
        JSON.stringify({ error: 'Profile ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Reset verification attempts using admin client
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        photo_verification_attempts: 0,
        photo_verification_status: 'unverified',
        photo_verified: false,
        photo_verification_started_at: null,
        photo_verification_completed_at: null
      })
      .eq('id', profileId);

    if (updateError) {
      console.error('Error resetting verification:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to reset verification' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Queue notification for the user
    await supabaseAdmin.from('notification_queue').insert({
      recipient_profile_id: profileId,
      notification_type: 'photo_verification_reset',
      title: 'Photo Verification Reset',
      body: 'Your photo verification attempts have been reset. You can now try verifying your photos again.',
      data: { type: 'photo_verification_reset' },
      status: 'pending'
    });

    console.log(`Admin ${user.id} reset verification for profile ${profileId}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Verification reset successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in admin-reset-verification:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to reset verification' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
