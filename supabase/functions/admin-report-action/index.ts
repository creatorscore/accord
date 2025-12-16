import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ActionType = 'photo_review' | 'verify_identity' | 'dismiss' | 'warn';

interface ReportActionPayload {
  action: ActionType;
  report_id: string;
  reported_profile_id: string;
  reason: string;
  details?: string;
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
    const payload: ReportActionPayload = await req.json();
    console.log('[Admin Report Action] Processing:', payload.action, 'for profile:', payload.reported_profile_id);

    let profileUpdateResult = null;
    let reportUpdateResult = null;

    switch (payload.action) {
      case 'photo_review':
        // Flag the profile for photo review - hides from discovery
        console.log('[Admin Report Action] Setting photo_review_required = true');
        const { error: photoReviewError } = await supabaseAdmin
          .from('profiles')
          .update({
            photo_review_required: true,
            photo_review_reason: `${payload.reason}: ${payload.details || 'Photo review required'}`,
            photo_review_requested_at: new Date().toISOString(),
          })
          .eq('id', payload.reported_profile_id);

        if (photoReviewError) {
          console.error('[Admin Report Action] Failed to flag for photo review:', photoReviewError);
          throw photoReviewError;
        }
        profileUpdateResult = { photo_review_required: true };
        console.log('[Admin Report Action] ✓ Profile flagged for photo review');
        break;

      case 'verify_identity':
        // Flag for identity verification - also hides from discovery
        console.log('[Admin Report Action] Requiring identity verification');
        const { error: verifyError } = await supabaseAdmin
          .from('profiles')
          .update({
            photo_verified: false,
            photo_verification_status: 'admin_required',
            is_verified: false,
            photo_review_required: true,
            photo_review_reason: `Identity verification required: ${payload.reason}`,
            photo_review_requested_at: new Date().toISOString(),
          })
          .eq('id', payload.reported_profile_id);

        if (verifyError) {
          console.error('[Admin Report Action] Failed to require verification:', verifyError);
          throw verifyError;
        }
        profileUpdateResult = { verification_required: true, photo_review_required: true };
        console.log('[Admin Report Action] ✓ Profile flagged for identity verification');
        break;

      case 'warn':
        // Send a warning notification (profile stays visible)
        console.log('[Admin Report Action] Sending warning to user');
        // Just update the report status - notification is handled separately
        profileUpdateResult = { warned: true };
        break;

      case 'dismiss':
        // Just dismiss the report, no profile changes
        console.log('[Admin Report Action] Dismissing report');
        profileUpdateResult = { dismissed: true };
        break;

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
    }

    // Mark ALL pending reports for this profile as resolved
    const newStatus = payload.action === 'dismiss' ? 'dismissed' : 'resolved';
    const { error: reportError, count: resolvedCount } = await supabaseAdmin
      .from('reports')
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminProfile.id,
      })
      .eq('reported_profile_id', payload.reported_profile_id)
      .eq('status', 'pending');

    if (reportError) {
      console.error('[Admin Report Action] Failed to update reports:', reportError);
      throw reportError;
    }

    reportUpdateResult = { status: newStatus, count: resolvedCount };
    console.log(`[Admin Report Action] ✓ Updated ${resolvedCount || 0} report(s) to ${newStatus}`);

    return new Response(JSON.stringify({
      success: true,
      action: payload.action,
      profile_update: profileUpdateResult,
      reports_updated: reportUpdateResult,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[Admin Report Action] Error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to execute action',
      details: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
