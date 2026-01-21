import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Server-side notification for new likes
 * Called by database trigger on likes INSERT
 *
 * Premium users: See who liked them
 * Free users: Get FOMO message to drive upgrades
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

    const { liker_profile_id, liked_profile_id, like_type } = await req.json();

    if (!liker_profile_id || !liked_profile_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log(`[Like Notification] Processing like from ${liker_profile_id} to ${liked_profile_id}`);

    // Get liked user's profile (recipient)
    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from('profiles')
      .select('push_token, push_enabled, is_premium, is_platinum, last_active_at')
      .eq('id', liked_profile_id)
      .single();

    if (recipientError || !recipient?.push_enabled || !recipient?.push_token) {
      console.log('[Like Notification] Recipient not found or notifications disabled');
      return new Response(JSON.stringify({ success: true, skipped: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Skip if user is currently active (likely in-app)
    if (recipient.last_active_at) {
      const lastActive = new Date(recipient.last_active_at);
      const now = new Date();
      const secondsSinceActive = (now.getTime() - lastActive.getTime()) / 1000;

      if (secondsSinceActive < 30) {
        console.log(`[Like Notification] Skipping - user active ${Math.round(secondsSinceActive)}s ago`);
        return new Response(JSON.stringify({ success: true, skipped: true, reason: 'user_active' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }

    // Get liker's name
    const { data: liker } = await supabaseAdmin
      .from('profiles')
      .select('display_name')
      .eq('id', liker_profile_id)
      .single();

    const isPremium = recipient.is_premium || recipient.is_platinum;
    const likerName = liker?.display_name || 'Someone';

    // Different messaging based on subscription status
    let title: string;
    let body: string;

    if (isPremium) {
      if (like_type === 'super') {
        title = `${likerName} super liked you! ⭐`;
        body = 'They really want to connect with you!';
      } else {
        title = `${likerName} likes you! 💜`;
        body = 'See who liked you and match instantly.';
      }
    } else {
      if (like_type === 'super') {
        title = 'Someone super liked you! ⭐';
        body = 'Upgrade to Premium to see who really wants to match with you.';
      } else {
        title = 'Someone likes you! 💜';
        body = 'Upgrade to Premium to see who liked you and match instantly.';
      }
    }

    // Get all device tokens for this user
    const { data: deviceTokens } = await supabaseAdmin
      .from('device_tokens')
      .select('push_token')
      .eq('profile_id', liked_profile_id);

    // Collect all tokens
    const tokens = new Set<string>();
    if (deviceTokens) {
      deviceTokens.forEach(dt => tokens.add(dt.push_token));
    }
    if (recipient.push_token) {
      tokens.add(recipient.push_token);
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
            type: 'new_like',
            likerProfileId: isPremium ? liker_profile_id : undefined,
            isPremium,
            screen: 'likes',
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
      profile_id: liked_profile_id,
      notification_type: 'new_like',
      title,
      body,
      data: {
        likerProfileId: isPremium ? liker_profile_id : undefined,
        type: 'new_like',
        isPremium,
      },
    });

    // Insert into activity_feed for Activity Center display
    // 1. Create like_received for the recipient (person who was liked)
    const receivedActivityType = like_type === 'super' ? 'super_like_received' : 'like_received';
    await supabaseAdmin.from('activity_feed').insert({
      profile_id: liked_profile_id,
      activity_type: receivedActivityType,
      actor_profile_id: liker_profile_id,
      reference_id: null,
      metadata: {
        like_type: like_type || 'standard',
      },
      is_read: false,
    });

    // 2. Create like_sent for the sender (person who sent the like)
    const sentActivityType = like_type === 'super' ? 'super_like_sent' : 'like_sent';
    await supabaseAdmin.from('activity_feed').insert({
      profile_id: liker_profile_id,
      activity_type: sentActivityType,
      actor_profile_id: liked_profile_id,
      reference_id: null,
      metadata: {
        like_type: like_type || 'standard',
      },
      is_read: true, // Mark as read since the user initiated the action
    });

    console.log(`[Like Notification] Activity feed entries created for recipient ${liked_profile_id} and sender ${liker_profile_id}`);
    console.log(`[Like Notification] Sent to ${successCount}/${tokens.size} devices`);

    return new Response(JSON.stringify({
      success: true,
      sent: successCount,
      total_devices: tokens.size
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[Like Notification] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
