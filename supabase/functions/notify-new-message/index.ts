import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Server-side notification for new messages
 * Called by database trigger on messages INSERT
 *
 * Skips notification if user was active in the last 30 seconds
 * (they're likely in-app and will see the realtime notification)
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

    const { sender_profile_id, receiver_profile_id, match_id, content_type } = await req.json();

    if (!sender_profile_id || !receiver_profile_id || !match_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log(`[Message Notification] Processing message from ${sender_profile_id} to ${receiver_profile_id}`);

    // Get receiver's profile
    const { data: receiver, error: receiverError } = await supabaseAdmin
      .from('profiles')
      .select('push_token, push_enabled, last_active_at')
      .eq('id', receiver_profile_id)
      .single();

    if (receiverError || !receiver?.push_enabled) {
      console.log('[Message Notification] Receiver not found or notifications disabled');
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Skip if user is currently active (likely in-app seeing realtime message)
    if (receiver.last_active_at) {
      const lastActive = new Date(receiver.last_active_at);
      const now = new Date();
      const secondsSinceActive = (now.getTime() - lastActive.getTime()) / 1000;

      if (secondsSinceActive < 30) {
        console.log(`[Message Notification] Skipping - user active ${Math.round(secondsSinceActive)}s ago`);
        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'user_active' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }

    // Get sender's name
    const { data: sender } = await supabaseAdmin
      .from('profiles')
      .select('display_name')
      .eq('id', sender_profile_id)
      .single();

    const senderName = sender?.display_name || 'Someone';

    // Determine preview based on content type
    let preview: string;
    switch (content_type) {
      case 'image':
        preview = 'Sent you a photo';
        break;
      case 'voice':
        preview = 'Sent you a voice message';
        break;
      case 'video':
        preview = 'Sent you a video';
        break;
      default:
        preview = 'Sent you a message';
    }

    const title = `New message from ${senderName}`;
    const body = preview;

    // Get all device tokens for this user
    const { data: deviceTokens } = await supabaseAdmin
      .from('device_tokens')
      .select('push_token')
      .eq('profile_id', receiver_profile_id);

    // Collect all tokens
    const tokens = new Set<string>();
    if (deviceTokens) {
      deviceTokens.forEach(dt => tokens.add(dt.push_token));
    }
    if (receiver.push_token) {
      tokens.add(receiver.push_token);
    }

    if (tokens.size === 0) {
      console.log('[Message Notification] No push tokens found');
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'no_tokens' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Send to all devices
    const sendPromises = Array.from(tokens).map(async (token) => {
      const response = await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          sound: 'default',
          title,
          body,
          data: {
            type: 'new_message',
            matchId: match_id,
            screen: 'chat',
          },
          priority: 'high',
          badge: 1,
        }),
      });
      return response.json();
    });

    const results = await Promise.allSettled(sendPromises);
    const successCount = results.filter(r => r.status === 'fulfilled').length;

    // Log notification
    await supabaseAdmin.from('push_notifications').insert({
      profile_id: receiver_profile_id,
      notification_type: 'new_message',
      title,
      body,
      data: { matchId: match_id, type: 'new_message' },
    });

    console.log(`[Message Notification] Sent to ${successCount}/${tokens.size} devices`);

    return new Response(JSON.stringify({
      success: true,
      sent: successCount,
      total_devices: tokens.size
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[Message Notification] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
