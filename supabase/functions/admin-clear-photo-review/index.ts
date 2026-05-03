import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Admin Clear Photo Review
 *
 * Allows admins to clear the photo_review_required flag for a user
 * after they have uploaded new/appropriate photos.
 *
 * This is the ONLY way to clear the flag - users cannot clear it themselves.
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the requesting user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Verify user is an admin
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, id')
      .eq('user_id', user.id)
      .single();

    if (adminError || !adminProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // Get request payload
    const { profile_id, admin_notes } = await req.json();

    if (!profile_id) {
      return new Response(JSON.stringify({ error: 'profile_id is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log(`[Admin Clear Photo Review] Admin ${adminProfile.id} clearing photo review for profile ${profile_id}`);

    // Get the profile to verify it exists and is flagged
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, photo_review_required, photo_review_reason')
      .eq('id', profile_id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    if (!profile.photo_review_required) {
      return new Response(JSON.stringify({
        error: 'Profile is not flagged for photo review',
        profile_id,
        display_name: profile.display_name
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Clear the photo review flag
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        photo_review_required: false,
        photo_review_reason: null,
        photo_review_requested_at: null,
        photo_review_cleared_by: adminProfile.id,
        photo_review_cleared_at: new Date().toISOString(),
      })
      .eq('id', profile_id);

    if (updateError) {
      console.error('[Admin Clear Photo Review] Failed to clear photo review:', updateError);
      return new Response(JSON.stringify({
        error: 'Failed to clear photo review',
        details: updateError.message
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Queue notification for the user
    await supabaseAdmin.from('notification_queue').insert({
      recipient_profile_id: profile_id,
      notification_type: 'photo_review_approved',
      title: 'Photos Approved',
      body: 'Your profile photos have been reviewed and approved. You are now visible in discovery again!',
      data: { type: 'photo_review_approved' },
      status: 'pending'
    });

    console.log(`[Admin Clear Photo Review] Successfully cleared photo review for ${profile.display_name}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Photo review cleared successfully',
      profile_id,
      display_name: profile.display_name,
      previous_reason: profile.photo_review_reason,
      cleared_by: adminProfile.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[Admin Clear Photo Review] Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
