// Edge Function: admin-broadcast
// Send push notifications to all users (admin only)
// Usage: POST with { title, body, data?, target? }
// Now uses queue-based delivery via process-notifications cron

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

    // Get all user profile IDs with push enabled
    let query = supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('push_enabled', true);

    // Optional: target specific users
    if (target === 'premium') {
      query = query.or('is_premium.eq.true,is_platinum.eq.true');
    }

    // Fetch ALL profile IDs with pagination (Supabase defaults to 1000 row limit)
    let profileIds: string[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data: page, error: pageError } = await query.range(from, from + pageSize - 1);
      if (pageError) throw pageError;
      if (!page || page.length === 0) break;
      profileIds = profileIds.concat(page.map((p: { id: string }) => p.id));
      if (page.length < pageSize) break;
      from += pageSize;
    }

    if (profileIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No recipients found',
          queued: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Insert into notification_queue in batches (avoid payload size limits)
    const insertBatchSize = 500;
    let queuedCount = 0;

    for (let i = 0; i < profileIds.length; i += insertBatchSize) {
      const batch = profileIds.slice(i, i + insertBatchSize);
      const queueItems = batch.map(profileId => ({
        recipient_profile_id: profileId,
        notification_type: 'admin_broadcast',
        title,
        body,
        data: data || {},
        status: 'pending',
        attempts: 0,
      }));

      const { error: insertError } = await supabaseAdmin
        .from('notification_queue')
        .insert(queueItems);

      if (insertError) {
        console.error('Error inserting notification batch:', insertError);
        // Continue with remaining batches even if one fails
      } else {
        queuedCount += batch.length;
      }
    }

    // Log the broadcast
    await supabaseAdmin.from('admin_broadcasts').insert({
      admin_user_id: user.id,
      title,
      body,
      data,
      recipients_count: profileIds.length,
      sent_count: queuedCount, // queued count for backward compatibility
      failed_count: profileIds.length - queuedCount,
    }).catch(() => {
      // Table might not exist, that's ok
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Broadcast queued for ${queuedCount} users. Delivery within 1-2 minutes.`,
        queued: queuedCount,
        total_recipients: profileIds.length,
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
