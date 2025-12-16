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
      .select('id, push_token, push_enabled, display_name, is_premium, is_platinum, photo_verified')
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

    const { data: recipients, error: recipientsError } = await query;

    if (recipientsError) throw recipientsError;

    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No recipients found matching criteria',
        sent: 0,
        failed: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Get all device tokens for these users (multi-device support)
    const profileIds = recipients.map(r => r.id);
    const { data: deviceTokens, error: deviceTokensError } = await supabaseClient
      .from('device_tokens')
      .select('profile_id, push_token')
      .in('profile_id', profileIds);

    if (deviceTokensError) {
      console.error('Error fetching device tokens:', deviceTokensError);
      // Continue anyway - we'll fall back to profiles.push_token
    }

    // Build complete list of tokens (from both device_tokens table AND profiles.push_token)
    const tokenSet = new Set<string>();
    const tokenToProfileMap = new Map<string, string>(); // Track which profile each token belongs to

    // Add tokens from device_tokens table (new multi-device system)
    if (deviceTokens) {
      deviceTokens.forEach(dt => {
        if (dt.push_token) {
          tokenSet.add(dt.push_token);
          tokenToProfileMap.set(dt.push_token, dt.profile_id);
        }
      });
    }

    // Add tokens from profiles table (legacy system - for backward compatibility)
    recipients.forEach(recipient => {
      if (recipient.push_token) {
        tokenSet.add(recipient.push_token);
        tokenToProfileMap.set(recipient.push_token, recipient.id);
      }
    });

    const allTokens = Array.from(tokenSet);

    if (allTokens.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No push tokens found for recipients',
        sent: 0,
        failed: 0,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Prepare notification messages (one per token, supporting multi-device)
    const messages = allTokens.map(token => ({
      to: token,
      sound: 'default',
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      priority: 'high' as const,
      badge: 1,
    }));

    // Send notifications in batches (Expo allows up to 100 per request)
    const batchSize = 100;
    let sentCount = 0;
    let failedCount = 0;
    const failedTokens: string[] = [];

    for (let i = 0; i < messages.length; i += batchSize) {
      const batch = messages.slice(i, i + batchSize);

      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(batch),
        });

        const result = await response.json();

        // Check individual results
        if (result.data) {
          for (let j = 0; j < result.data.length; j++) {
            const item = result.data[j];
            if (item.status === 'ok') {
              sentCount++;
            } else {
              failedCount++;
              failedTokens.push(batch[j].to);
              console.error('Failed to send notification:', item);
            }
          }
        }
      } catch (error) {
        console.error('Error sending batch:', error);
        failedCount += batch.length;
      }
    }

    // Log the notification send
    await supabaseClient.from('admin_notification_logs').insert({
      admin_user_id: user.id,
      title: payload.title,
      body: payload.body,
      target_audience: payload.targetAudience,
      recipients_count: recipients.length,
      sent_count: sentCount,
      failed_count: failedCount,
      data: payload.data,
    });

    return new Response(JSON.stringify({
      success: true,
      message: `Notification sent to ${sentCount}/${allTokens.length} devices (${recipients.length} users)`,
      sent: sentCount,
      failed: failedCount,
      totalTokens: allTokens.length,
      totalUsers: recipients.length,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Error sending notifications:', error);
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
