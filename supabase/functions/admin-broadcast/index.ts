// Edge Function: admin-broadcast
// Send push notifications to all users (admin only)
// Usage: POST with { title, body, data? }

import { createClient } from 'jsr:@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify user is admin
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Not authenticated');
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (!profile?.is_admin) {
      throw new Error('Admin access required');
    }

    // Parse request
    const { title, body, data, target } = await req.json();

    if (!title || !body) {
      throw new Error('Title and body are required');
    }

    // Use service role for fetching all users
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all users with push tokens
    let query = supabaseAdmin
      .from('profiles')
      .select('id, push_token, push_enabled')
      .eq('push_enabled', true)
      .not('push_token', 'is', null);

    // Optional: target specific users
    if (target === 'premium') {
      query = query.or('is_premium.eq.true,is_platinum.eq.true');
    }

    const { data: profiles, error: profilesError } = await query;

    if (profilesError) {
      throw profilesError;
    }

    // Send notifications in batches (Expo recommends max 100 per request)
    const BATCH_SIZE = 100;
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < profiles.length; i += BATCH_SIZE) {
      const batch = profiles.slice(i, i + BATCH_SIZE);
      const messages = batch.map((p) => ({
        to: p.push_token,
        sound: 'default',
        title,
        body,
        data: data || {},
        priority: 'high',
        badge: 1,
      }));

      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(messages),
        });

        const results = await response.json();

        // Count successes and failures
        if (Array.isArray(results.data)) {
          results.data.forEach((r: any) => {
            if (r.status === 'ok') sent++;
            else failed++;
          });
        } else {
          sent += batch.length;
        }
      } catch (error) {
        console.error('Batch send error:', error);
        failed += batch.length;
      }
    }

    // Log the broadcast
    await supabaseAdmin.from('admin_broadcasts').insert({
      admin_user_id: user.id,
      title,
      body,
      data,
      recipients_count: profiles.length,
      sent_count: sent,
      failed_count: failed,
    }).catch(() => {
      // Table might not exist, that's ok
    });

    return new Response(
      JSON.stringify({
        success: true,
        total_recipients: profiles.length,
        sent,
        failed,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
