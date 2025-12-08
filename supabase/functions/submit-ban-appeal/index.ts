import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AppealPayload {
  appeal_message: string;
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

    // Get the user's profile
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, is_active, ban_reason, ban_expires_at')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile) {
      return new Response(JSON.stringify({ error: 'Profile not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Check if user is actually banned
    if (profile.is_active) {
      return new Response(JSON.stringify({ error: 'You are not banned' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Get request payload
    const payload: AppealPayload = await req.json();

    if (!payload.appeal_message || payload.appeal_message.trim().length < 10) {
      return new Response(JSON.stringify({ error: 'Appeal message must be at least 10 characters' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    if (payload.appeal_message.length > 2000) {
      return new Response(JSON.stringify({ error: 'Appeal message must be less than 2000 characters' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Find the most recent active ban for this user
    const { data: existingBan, error: banFetchError } = await supabaseAdmin
      .from('bans')
      .select('id, appeal_status, appeal_submitted_at')
      .eq('banned_user_id', user.id)
      .is('unbanned_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (banFetchError || !existingBan) {
      return new Response(JSON.stringify({ error: 'No active ban record found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404,
      });
    }

    // Check if appeal already submitted
    if (existingBan.appeal_status === 'pending') {
      return new Response(JSON.stringify({
        error: 'You have already submitted an appeal. Please wait for a response.',
        appeal_submitted_at: existingBan.appeal_submitted_at
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Check if appeal was already denied (only allow one appeal)
    if (existingBan.appeal_status === 'denied') {
      return new Response(JSON.stringify({
        error: 'Your appeal has already been reviewed and denied. No further appeals are allowed for this ban.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Submit the appeal
    const { error: updateError } = await supabaseAdmin
      .from('bans')
      .update({
        appeal_status: 'pending',
        appeal_message: payload.appeal_message.trim(),
        appeal_submitted_at: new Date().toISOString(),
      })
      .eq('id', existingBan.id);

    if (updateError) {
      console.error('[Submit Appeal] Failed to update ban record:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to submit appeal' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    console.log('[Submit Appeal] Appeal submitted successfully for ban:', existingBan.id);

    return new Response(JSON.stringify({
      success: true,
      message: 'Your appeal has been submitted. We will review it and respond as soon as possible.',
      ban_id: existingBan.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[Submit Appeal] Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
