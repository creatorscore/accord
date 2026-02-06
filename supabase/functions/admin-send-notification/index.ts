import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationPayload {
  title: string;
  body: string;
  targetAudience: 'all' | 'premium' | 'free' | 'verified' | 'custom';
  customProfileIds?: string[];
  data?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin status
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const payload: NotificationPayload = await req.json();

    // Validate payload
    if (!payload.title || !payload.body) {
      return new Response(JSON.stringify({ error: 'Title and body are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Build query based on target audience
    let query = supabaseClient
      .from('profiles')
      .select('id')
      .eq('push_enabled', true);

    switch (payload.targetAudience) {
      case 'premium':
        query = query.or('is_premium.eq.true,is_platinum.eq.true');
        break;
      case 'free':
        query = query.eq('is_premium', false).eq('is_platinum', false);
        break;
      case 'verified':
        query = query.eq('photo_verified', true);
        break;
      case 'custom':
        if (!payload.customProfileIds || payload.customProfileIds.length === 0) {
          return new Response(JSON.stringify({ error: 'Custom profile IDs required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
        }
        query = query.in('id', payload.customProfileIds);
        break;
      case 'all':
        // No additional filters
        break;
    }

    // Fetch ALL recipient profile IDs with pagination (Supabase defaults to 1000 row limit)
    let recipientIds: string[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data: page, error: pageError } = await query.range(from, from + pageSize - 1);
      if (pageError) throw pageError;
      if (!page || page.length === 0) break;
      recipientIds = recipientIds.concat(page.map((p: { id: string }) => p.id));
      if (page.length < pageSize) break;
      from += pageSize;
    }

    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No recipients found matching criteria',
        queued: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Insert into notification_queue in batches (avoid payload size limits)
    const insertBatchSize = 500;
    let queuedCount = 0;

    for (let i = 0; i < recipientIds.length; i += insertBatchSize) {
      const batch = recipientIds.slice(i, i + insertBatchSize);
      const queueItems = batch.map(profileId => ({
        recipient_profile_id: profileId,
        notification_type: 'admin_notification',
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        status: 'pending',
        attempts: 0,
      }));

      const { error: insertError } = await supabaseClient
        .from('notification_queue')
        .insert(queueItems);

      if (insertError) {
        console.error('Error inserting notification batch:', insertError);
        // Continue with remaining batches even if one fails
      } else {
        queuedCount += batch.length;
      }
    }

    // Log the notification send
    await supabaseClient.from('admin_notification_logs').insert({
      admin_user_id: user.id,
      title: payload.title,
      body: payload.body,
      target_audience: payload.targetAudience,
      recipients_count: recipientIds.length,
      sent_count: queuedCount, // queued count for backward compatibility
      failed_count: recipientIds.length - queuedCount,
      data: payload.data,
    });

    return new Response(JSON.stringify({
      success: true,
      message: `Notification queued for ${queuedCount} users. Delivery within 1-2 minutes.`,
      queued: queuedCount,
      totalUsers: recipientIds.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Error queuing notifications:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
