import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BanUserPayload {
  banned_profile_id: string; // Only need this - we'll fetch the rest
  ban_reason: string;
  banned_by_profile_id: string;
  report_id?: string;
  admin_notes?: string;
  // New fields for temporary bans and custom messages
  ban_duration_hours?: number; // null/undefined = permanent, otherwise hours (24, 72, 168, 720)
  user_message?: string; // Custom message shown to the banned user
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
    const payload: BanUserPayload = await req.json();

    console.log('[Ban User] ========== BAN REQUEST STARTED ==========');
    console.log('[Ban User] Payload:', JSON.stringify(payload));
    console.log('[Ban User] banned_profile_id:', payload.banned_profile_id);
    console.log('[Ban User] banned_profile_id type:', typeof payload.banned_profile_id);

    // Fetch profile details using service role (bypasses RLS)
    console.log('[Ban User] About to query profiles table...');
    const { data: profile, error: profileFetchError } = await supabaseAdmin
      .from('profiles')
      .select('id, user_id, device_id')
      .eq('id', payload.banned_profile_id)
      .single();

    console.log('[Ban User] Query completed');
    console.log('[Ban User] Profile data:', profile ? JSON.stringify(profile) : 'NULL');
    console.log('[Ban User] Profile error:', profileFetchError ? JSON.stringify(profileFetchError) : 'NONE');

    if (profileFetchError || !profile) {
      console.error('[Ban User] ❌ FAILED - Profile not found');
      console.error('[Ban User] Error details:', JSON.stringify(profileFetchError, null, 2));
      return new Response(JSON.stringify({
        error: 'Profile not found',
        details: profileFetchError?.message || 'Profile does not exist',
        raw_error: profileFetchError,
        searched_for_id: payload.banned_profile_id
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Get user's email and check if already banned
    const { data: { user: targetUser }, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
    const userEmail = targetUser?.email || null;
    const isAlreadyBanned = targetUser?.banned_until !== null;

    console.log('[Ban User] Profile found:', {
      user_id: profile.user_id,
      email: userEmail,
      already_banned: isAlreadyBanned,
      banned_until: targetUser?.banned_until
    });

    // Calculate ban duration and expiry
    const isPermanent = !payload.ban_duration_hours;
    const banDurationHours = payload.ban_duration_hours || 876000; // ~100 years if permanent
    const expiresAt = isPermanent ? null : new Date(Date.now() + banDurationHours * 60 * 60 * 1000);

    console.log('[Ban User] Ban type:', isPermanent ? 'PERMANENT' : `TEMPORARY (${banDurationHours}h)`);
    if (expiresAt) {
      console.log('[Ban User] Expires at:', expiresAt.toISOString());
    }

    // 1. BAN USER IN SUPABASE AUTH (CRITICAL - prevents all future logins)
    let authBanError = null;

    if (isAlreadyBanned) {
      console.log('[Ban User] ⚠️ User already banned in Auth - updating ban duration');
      // Update ban duration even if already banned
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        profile.user_id,
        {
          ban_duration: `${banDurationHours}h`,
        }
      );
      if (error) {
        console.warn('[Ban User] Could not update existing ban:', error);
      }
    } else {
      console.log('[Ban User] Banning user in Auth...');
      const { error } = await supabaseAdmin.auth.admin.updateUserById(
        profile.user_id,
        {
          ban_duration: `${banDurationHours}h`,
        }
      );
      authBanError = error;

      if (authBanError) {
        console.error('[Ban User] Failed to ban in Auth:', authBanError);
        return new Response(JSON.stringify({
          error: 'Failed to ban user in authentication system',
          details: authBanError.message
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 500,
        });
      }

      console.log('[Ban User] ✓ User banned in Auth successfully');
    }

    // 2. DEACTIVATE PROFILE (prevents discovery, matching, messaging)
    console.log('[Ban User] Deactivating profile...');
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        is_active: false,
        ban_reason: payload.ban_reason,
        ban_expires_at: expiresAt?.toISOString() || null,
        ban_user_message: payload.user_message || null,
      })
      .eq('id', payload.banned_profile_id);

    if (profileError) {
      console.error('[Ban User] Failed to deactivate profile:', profileError);
      // Continue - auth ban is most critical
    } else {
      console.log('[Ban User] ✓ Profile deactivated');
    }

    // 3. CREATE COMPREHENSIVE BAN RECORD (for tracking/appeal)
    console.log('[Ban User] Creating ban record...');
    const { error: banRecordError } = await supabaseAdmin
      .from('bans')
      .insert({
        banned_user_id: profile.user_id,
        banned_profile_id: payload.banned_profile_id,
        banned_email: userEmail,
        banned_phone_hash: null, // Phone not stored in profiles table
        banned_device_id: profile.device_id, // Device fingerprint for permanent bans
        ban_reason: payload.ban_reason,
        banned_by: payload.banned_by_profile_id,
        report_id: payload.report_id,
        is_permanent: isPermanent,
        expires_at: expiresAt?.toISOString() || null,
        ban_duration_hours: payload.ban_duration_hours || null,
        user_message: payload.user_message || null,
        admin_notes: payload.admin_notes,
        appeal_status: 'none',
      });

    if (banRecordError) {
      console.warn('[Ban User] Failed to create ban record:', banRecordError);
      // Continue - auth ban is most critical
    } else {
      console.log('[Ban User] ✓ Ban record created');
    }

    // 4. TERMINATE ALL ACTIVE SESSIONS (kick user out immediately)
    console.log('[Ban User] Terminating all active sessions...');
    try {
      // Sign out all sessions for this user
      const { error: signOutError } = await supabaseAdmin.auth.admin.signOut(
        profile.user_id,
        'global' // Sign out from all devices
      );

      if (signOutError) {
        console.warn('[Ban User] Failed to terminate sessions:', signOutError);
      } else {
        console.log('[Ban User] ✓ All sessions terminated');
      }
    } catch (signOutErr) {
      console.warn('[Ban User] Error terminating sessions:', signOutErr);
    }

    console.log('[Ban User] ✅ Ban complete!');

    return new Response(JSON.stringify({
      success: true,
      message: isAlreadyBanned ? 'User was already banned - updated ban record' : 'User banned successfully',
      banned_user_id: profile.user_id,
      banned_profile_id: payload.banned_profile_id,
      banned_email: userEmail,
      auth_banned: isAlreadyBanned || !authBanError,
      was_already_banned: isAlreadyBanned,
      profile_deactivated: !profileError,
      ban_record_created: !banRecordError,
      is_permanent: isPermanent,
      expires_at: expiresAt?.toISOString() || null,
      ban_duration_hours: payload.ban_duration_hours || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[Ban User] Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
