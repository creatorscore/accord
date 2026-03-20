import { createClient } from 'jsr:@supabase/supabase-js@2';

// Inline translation for deploy independence from _shared
function t(lang: string, key: string, vars?: Record<string, string>): string {
  const msgs: Record<string, Record<string, string>> = {
    en: { 'message.title': 'New message from {{name}}', 'message.bodyText': 'Sent you a message', 'message.bodyPhoto': 'Sent you a photo', 'message.bodyVoice': 'Sent you a voice message', 'message.bodyVideo': 'Sent you a video' },
    fr: { 'message.title': 'Nouveau message de {{name}}', 'message.bodyText': "T'a envoyé un message", 'message.bodyPhoto': "T'a envoyé une photo", 'message.bodyVoice': "T'a envoyé un message vocal", 'message.bodyVideo': "T'a envoyé une vidéo" },
    es: { 'message.title': 'Nuevo mensaje de {{name}}', 'message.bodyText': 'Te envió un mensaje', 'message.bodyPhoto': 'Te envió una foto', 'message.bodyVoice': 'Te envió un mensaje de voz', 'message.bodyVideo': 'Te envió un video' },
    ar: { 'message.title': 'رسالة جديدة من {{name}}', 'message.bodyText': 'أرسل لك رسالة', 'message.bodyPhoto': 'أرسل لك صورة', 'message.bodyVoice': 'أرسل لك رسالة صوتية', 'message.bodyVideo': 'أرسل لك فيديو' },
    de: { 'message.title': 'Neue Nachricht von {{name}}', 'message.bodyText': 'Hat dir eine Nachricht geschickt', 'message.bodyPhoto': 'Hat dir ein Foto geschickt', 'message.bodyVoice': 'Hat dir eine Sprachnachricht geschickt', 'message.bodyVideo': 'Hat dir ein Video geschickt' },
  };
  let text = msgs[lang]?.[key] || msgs.en[key] || key;
  if (vars) Object.entries(vars).forEach(([k, v]) => { text = text.replace(`{{${k}}}`, v); });
  return text;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Base64-encode a UUID to prevent casual inspection of push payloads */
function obfuscateId(id: string): string {
  return btoa(id);
}

/**
 * Server-side notification for new messages
 * Called by database trigger on messages INSERT
 *
 * Skips notification if user was active in the last 30 seconds
 * (they're likely in-app and will see the realtime notification)
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const reqBody = await req.json();
    // Support both direct payload and trigger payload (nested in "record")
    const record = reqBody.record || reqBody;
    const { sender_profile_id, receiver_profile_id, match_id, content_type } = record;

    if (!sender_profile_id || !receiver_profile_id || !match_id) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log(`[Message Notification] Processing message from ${sender_profile_id} to ${receiver_profile_id}`);

    // Get receiver's profile (including preferred_language for localization)
    // Use maybeSingle() to avoid throwing if the receiver profile was deleted
    const { data: receiver, error: receiverError } = await supabaseAdmin
      .from('profiles')
      .select('push_token, push_enabled, last_active_at, preferred_language')
      .eq('id', receiver_profile_id)
      .maybeSingle();

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
      .maybeSingle();

    const senderName = sender?.display_name || 'Someone';
    const lang = receiver.preferred_language || 'en';

    // Determine preview based on content type (localized)
    let bodyKey: string;
    switch (content_type) {
      case 'image':
        bodyKey = 'message.bodyPhoto';
        break;
      case 'voice':
        bodyKey = 'message.bodyVoice';
        break;
      case 'video':
        bodyKey = 'message.bodyVideo';
        break;
      default:
        bodyKey = 'message.bodyText';
    }

    const title = t(lang, 'message.title', { name: senderName });
    const body = t(lang, bodyKey);

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
            matchId: obfuscateId(match_id),
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
