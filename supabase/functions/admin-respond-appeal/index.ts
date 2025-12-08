import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RespondAppealPayload {
  ban_id: string;
  decision: 'approved' | 'denied';
  response_message: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with SERVICE_ROLE_KEY for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the requesting user is authenticated
    const authHeader = req.headers.get('Authorization')!;
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
    const payload: RespondAppealPayload = await req.json();

    if (!payload.ban_id) {
      return new Response(JSON.stringify({ error: 'ban_id is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (!['approved', 'denied'].includes(payload.decision)) {
      return new Response(JSON.stringify({ error: 'decision must be "approved" or "denied"' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Fetch the ban record
    const { data: ban, error: banFetchError } = await supabaseAdmin
      .from('bans')
      .select('*, banned_profile_id, banned_user_id')
      .eq('id', payload.ban_id)
      .single();

    if (banFetchError || !ban) {
      return new Response(JSON.stringify({ error: 'Ban record not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Check if appeal is pending
    if (ban.appeal_status !== 'pending') {
      return new Response(JSON.stringify({
        error: 'This appeal has already been processed or no appeal was submitted',
        current_status: ban.appeal_status
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const now = new Date().toISOString();

    if (payload.decision === 'approved') {
      // UNBAN THE USER
      console.log('[Respond Appeal] Approving appeal - unbanning user');

      // 1. Update ban record
      const { error: banUpdateError } = await supabaseAdmin
        .from('bans')
        .update({
          appeal_status: 'approved',
          appeal_response: payload.response_message || 'Your appeal has been approved.',
          appeal_responded_at: now,
          appeal_responded_by: adminProfile.id,
          unbanned_at: now,
          unbanned_by: adminProfile.id,
          unban_reason: 'Appeal approved',
        })
        .eq('id', payload.ban_id);

      if (banUpdateError) {
        console.error('[Respond Appeal] Failed to update ban record:', banUpdateError);
        throw banUpdateError;
      }

      // 2. Reactivate profile
      const { error: profileUpdateError } = await supabaseAdmin
        .from('profiles')
        .update({
          is_active: true,
          ban_reason: null,
          ban_expires_at: null,
          ban_user_message: null,
        })
        .eq('id', ban.banned_profile_id);

      if (profileUpdateError) {
        console.error('[Respond Appeal] Failed to reactivate profile:', profileUpdateError);
        // Continue - ban record update is most important
      }

      // 3. Unban in Supabase Auth
      const { error: authUnbanError } = await supabaseAdmin.auth.admin.updateUserById(
        ban.banned_user_id,
        { ban_duration: 'none' }
      );

      if (authUnbanError) {
        console.error('[Respond Appeal] Failed to unban in Auth:', authUnbanError);
        // Continue - the user might still be able to log in after ban expiry
      }

      console.log('[Respond Appeal] User unbanned successfully');

      return new Response(JSON.stringify({
        success: true,
        message: 'Appeal approved - user has been unbanned',
        decision: 'approved',
        banned_profile_id: ban.banned_profile_id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });

    } else {
      // DENY THE APPEAL
      console.log('[Respond Appeal] Denying appeal');

      const { error: banUpdateError } = await supabaseAdmin
        .from('bans')
        .update({
          appeal_status: 'denied',
          appeal_response: payload.response_message || 'Your appeal has been reviewed and denied.',
          appeal_responded_at: now,
          appeal_responded_by: adminProfile.id,
        })
        .eq('id', payload.ban_id);

      if (banUpdateError) {
        console.error('[Respond Appeal] Failed to update ban record:', banUpdateError);
        throw banUpdateError;
      }

      console.log('[Respond Appeal] Appeal denied');

      return new Response(JSON.stringify({
        success: true,
        message: 'Appeal denied',
        decision: 'denied',
        banned_profile_id: ban.banned_profile_id,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

  } catch (error: any) {
    console.error('[Respond Appeal] Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
