// Edge Function: delete-account (hardened, self-verifying)
// Permanently deletes a user's account via a verified in-DB RPC. The previous
// version used a PostgREST delete + GoTrue admin.deleteUser that reported
// success while silently deleting nothing for ~2.4% of users. This version
// deletes via delete_user_account() (which cascades auth.users -> profile ->
// all data and RAISEs if the user survives) and re-verifies before returning
// success. Best-effort storage/RevenueCat cleanup runs AFTER the delete.

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

    // Verify identity with the caller's token.
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const { reason, feedback } = await req.json().catch(() => ({ reason: null, feedback: null }));

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Look up profile + photo storage paths BEFORE deletion so we can clean up
    // storage afterward (rows are gone once the profile cascades).
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, voice_intro_url')
      .eq('user_id', user.id)
      .maybeSingle();

    let photoPaths: string[] = [];
    if (profile) {
      const { data: photos } = await supabaseAdmin
        .from('photos')
        .select('storage_path')
        .eq('profile_id', profile.id);
      photoPaths = (photos ?? []).map((p: any) => p.storage_path).filter(Boolean);
    }

    // Save deletion feedback (best-effort, non-blocking).
    try {
      await supabaseAdmin.from('account_deletions').insert({
        profile_id: profile?.id ?? null,
        user_id: user.id,
        reason: reason || 'not_specified',
        feedback: feedback || null,
        email: user.email,
      });
    } catch (feedbackError) {
      console.log('Could not save deletion feedback:', feedbackError);
    }

    // CRITICAL: delete the account in-DB via the verified RPC.
    const { data: rpcOk, error: rpcError } = await supabaseAdmin
      .rpc('delete_user_account', { p_user_id: user.id });

    if (rpcError || rpcOk !== true) {
      console.error('delete_user_account RPC failed for', user.id, rpcError);
      return new Response(
        JSON.stringify({ error: 'Failed to delete account', detail: rpcError?.message ?? 'rpc did not confirm deletion' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Defensive re-verify: never report success unless the profile is truly gone.
    const { data: stillThere } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();
    if (stillThere) {
      console.error('Account deletion did not persist for user', user.id);
      return new Response(
        JSON.stringify({ error: 'Account deletion did not complete' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Best-effort external cleanup AFTER the account is verifiably deleted.
    // Failures here never fail the deletion.
    if (photoPaths.length > 0) {
      try {
        await supabaseAdmin.storage.from('profile-photos').remove(photoPaths);
      } catch (e) { console.error('photo storage cleanup failed:', e); }
    }
    if (profile?.voice_intro_url) {
      try {
        await supabaseAdmin.storage.from('voice-intros').remove([profile.id + '/voice-intro.m4a']);
      } catch (e) { console.error('voice storage cleanup failed:', e); }
    }
    try {
      const rcKey = Deno.env.get('REVENUECAT_SECRET_KEY');
      if (rcKey) {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 5000);
        try {
          const rc = await fetch('https://api.revenuecat.com/v1/subscribers/' + user.id, {
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + rcKey, 'Content-Type': 'application/json' },
            signal: ctrl.signal,
          });
          console.log('RevenueCat subscriber deletion:', rc.status);
        } finally { clearTimeout(timer); }
      }
    } catch (e) { console.error('RevenueCat cleanup failed:', e); }

    console.log('Successfully deleted account for user', user.id, '(' + user.email + ')');
    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
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
