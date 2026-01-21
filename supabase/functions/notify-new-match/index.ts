import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Server-side notification for new matches
 * Called by database trigger on matches INSERT
 *
 * Notifies BOTH users when they match
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

    const { profile1_id, profile2_id, match_id } = await req.json();

    if (!profile1_id || !profile2_id || !match_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log(`[Match Notification] Processing match ${match_id} between ${profile1_id} and ${profile2_id}`);

    // Get both profiles
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, display_name, push_token, push_enabled, last_active_at')
      .in('id', [profile1_id, profile2_id]);

    if (profilesError || !profiles || profiles.length !== 2) {
      console.error('[Match Notification] Error fetching profiles:', profilesError);
      return new Response(JSON.stringify({ error: 'Profiles not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const profile1 = profiles.find(p => p.id === profile1_id);
    const profile2 = profiles.find(p => p.id === profile2_id);

    // Send notification to each user about their match
    const sendNotification = async (recipient: any, matcherName: string) => {
      if (!recipient?.push_enabled) {
        console.log(`[Match Notification] Skipping ${recipient?.id} - notifications disabled`);
        return { skipped: true, reason: 'disabled' };
      }

      // Skip if user is currently active (likely already seeing the match celebration)
      if (recipient.last_active_at) {
        const lastActive = new Date(recipient.last_active_at);
        const now = new Date();
        const secondsSinceActive = (now.getTime() - lastActive.getTime()) / 1000;

        if (secondsSinceActive < 30) {
          console.log(`[Match Notification] Skipping ${recipient.id} - user active ${Math.round(secondsSinceActive)}s ago`);
          return { skipped: true, reason: 'user_active' };
        }
      }

      // Get all device tokens for this user
      const { data: deviceTokens } = await supabaseAdmin
        .from('device_tokens')
        .select('push_token')
        .eq('profile_id', recipient.id);

      // Collect all tokens
      const tokens = new Set<string>();
      if (deviceTokens) {
        deviceTokens.forEach(dt => tokens.add(dt.push_token));
      }
      if (recipient.push_token) {
        tokens.add(recipient.push_token);
      }

      if (tokens.size === 0) {
        console.log(`[Match Notification] Skipping ${recipient.id} - no push tokens`);
        return { skipped: true, reason: 'no_tokens' };
      }

      const title = "It's a Match! 💜";
      const body = `You matched with ${matcherName}! Start chatting now.`;

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
              type: 'new_match',
              matchId: match_id,
              screen: 'matches',
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
        profile_id: recipient.id,
        notification_type: 'new_match',
        title,
        body,
        data: { matchId: match_id, type: 'new_match' },
      });

      // Insert into activity_feed for Activity Center display
      // Find the other profile ID for this recipient
      const otherProfileId = recipient.id === profile1_id ? profile2_id : profile1_id;
      await supabaseAdmin.from('activity_feed').insert({
        profile_id: recipient.id,
        activity_type: 'match',
        actor_profile_id: otherProfileId,
        reference_id: match_id,
        metadata: {
          match_id: match_id,
        },
        is_read: false,
      });

      console.log(`[Match Notification] Activity feed entry created for ${recipient.id}`);

      return { sent: successCount, total: tokens.size };
    };

    // Send notifications to both users
    const [result1, result2] = await Promise.all([
      sendNotification(profile1, profile2?.display_name || 'Someone'),
      sendNotification(profile2, profile1?.display_name || 'Someone'),
    ]);

    console.log(`[Match Notification] Complete. Profile1: ${JSON.stringify(result1)}, Profile2: ${JSON.stringify(result2)}`);

    return new Response(JSON.stringify({
      success: true,
      profile1: result1,
      profile2: result2,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[Match Notification] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
