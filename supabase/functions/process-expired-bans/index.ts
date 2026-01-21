import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Process Expired Bans
 *
 * This function runs on a schedule (every hour) to:
 * 1. Find temporary bans that have expired
 * 2. Reactivate the user's profile (set is_active = true)
 * 3. Remove the ban from Supabase Auth
 * 4. Clean up the ban record
 *
 * This ensures temporary bans actually expire and users can return to the app.
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

    console.log('[Process Expired Bans] Starting scan for expired bans...');

    // Find all expired temporary bans
    const { data: expiredBans, error: fetchError } = await supabaseAdmin
      .from('bans')
      .select(`
        id,
        banned_user_id,
        banned_profile_id,
        banned_email,
        expires_at,
        ban_reason
      `)
      .eq('is_permanent', false)
      .not('expires_at', 'is', null)
      .lt('expires_at', new Date().toISOString());

    if (fetchError) {
      console.error('[Process Expired Bans] Error fetching expired bans:', fetchError);
      throw fetchError;
    }

    if (!expiredBans || expiredBans.length === 0) {
      console.log('[Process Expired Bans] No expired bans found');
      return new Response(JSON.stringify({
        success: true,
        message: 'No expired bans to process',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    console.log(`[Process Expired Bans] Found ${expiredBans.length} expired ban(s) to process`);

    const results = {
      processed: 0,
      reactivated: 0,
      authUnbanned: 0,
      errors: [] as string[],
    };

    for (const ban of expiredBans) {
      console.log(`[Process Expired Bans] Processing ban ${ban.id} for profile ${ban.banned_profile_id}`);

      try {
        // 1. Reactivate the profile
        if (ban.banned_profile_id) {
          const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
              is_active: true,
              ban_reason: null,
              ban_expires_at: null,
              ban_user_message: null,
            })
            .eq('id', ban.banned_profile_id);

          if (profileError) {
            console.error(`[Process Expired Bans] Failed to reactivate profile ${ban.banned_profile_id}:`, profileError);
            results.errors.push(`Profile ${ban.banned_profile_id}: ${profileError.message}`);
          } else {
            console.log(`[Process Expired Bans] ✓ Reactivated profile ${ban.banned_profile_id}`);
            results.reactivated++;
          }
        }

        // 2. Remove ban from Supabase Auth
        if (ban.banned_user_id) {
          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            ban.banned_user_id,
            {
              ban_duration: 'none', // Remove the auth ban
            }
          );

          if (authError) {
            console.error(`[Process Expired Bans] Failed to unban in Auth for user ${ban.banned_user_id}:`, authError);
            results.errors.push(`Auth ${ban.banned_user_id}: ${authError.message}`);
          } else {
            console.log(`[Process Expired Bans] ✓ Removed Auth ban for user ${ban.banned_user_id}`);
            results.authUnbanned++;
          }
        }

        // 3. Delete the expired ban record (or mark as processed)
        const { error: deleteError } = await supabaseAdmin
          .from('bans')
          .delete()
          .eq('id', ban.id);

        if (deleteError) {
          console.error(`[Process Expired Bans] Failed to delete ban record ${ban.id}:`, deleteError);
          results.errors.push(`Delete ban ${ban.id}: ${deleteError.message}`);
        } else {
          console.log(`[Process Expired Bans] ✓ Deleted expired ban record ${ban.id}`);
        }

        results.processed++;
      } catch (err: any) {
        console.error(`[Process Expired Bans] Error processing ban ${ban.id}:`, err);
        results.errors.push(`Ban ${ban.id}: ${err.message}`);
      }
    }

    console.log(`[Process Expired Bans] Complete. Processed: ${results.processed}, Reactivated: ${results.reactivated}, Auth Unbanned: ${results.authUnbanned}`);

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${results.processed} expired ban(s)`,
      ...results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[Process Expired Bans] Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
