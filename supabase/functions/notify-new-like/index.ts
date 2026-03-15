import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Inline like notification translations (subset of _shared/translations.ts)
const likeTranslations: Record<string, Record<string, string>> = {
  en: {
    premiumTitle: '{{name}} likes you! 💜',
    premiumBody: 'See who liked you and match instantly.',
    premiumSuperTitle: '{{name}} super liked you! ⭐',
    premiumSuperBody: 'They really want to connect with you!',
    freeTitle: 'Someone likes you! 💜',
    freeBody: 'Upgrade to Premium to see who liked you and match instantly.',
    freeSuperTitle: 'Someone super liked you! ⭐',
    freeSuperBody: 'Upgrade to Premium to see who really wants to match with you.',
  },
  es: {
    premiumTitle: '¡A {{name}} le gustas! 💜',
    premiumBody: 'Ve quién te dio like y haz match al instante.',
    premiumSuperTitle: '¡{{name}} te dio super like! ⭐',
    premiumSuperBody: '¡Realmente quieren conectar contigo!',
    freeTitle: '¡A alguien le gustas! 💜',
    freeBody: 'Actualiza a Premium para ver quién te dio like y hacer match al instante.',
    freeSuperTitle: '¡Alguien te dio super like! ⭐',
    freeSuperBody: 'Actualiza a Premium para ver quién realmente quiere hacer match contigo.',
  },
  fr: {
    premiumTitle: '{{name}} vous aime ! 💜',
    premiumBody: 'Voyez qui vous a liké et matchez instantanément.',
    premiumSuperTitle: '{{name}} vous a super liké ! ⭐',
    premiumSuperBody: 'Cette personne veut vraiment se connecter avec vous !',
    freeTitle: 'Quelqu\'un vous aime ! 💜',
    freeBody: 'Passez à Premium pour voir qui vous a liké et matcher instantanément.',
    freeSuperTitle: 'Quelqu\'un vous a super liké ! ⭐',
    freeSuperBody: 'Passez à Premium pour voir qui veut vraiment matcher avec vous.',
  },
  de: {
    premiumTitle: '{{name}} mag dich! 💜',
    premiumBody: 'Sieh, wer dich geliked hat und matche sofort.',
    premiumSuperTitle: '{{name}} hat dir ein Super-Like gegeben! ⭐',
    premiumSuperBody: 'Diese Person möchte sich wirklich mit dir verbinden!',
    freeTitle: 'Jemand mag dich! 💜',
    freeBody: 'Upgrade auf Premium, um zu sehen, wer dich geliked hat.',
    freeSuperTitle: 'Jemand hat dir ein Super-Like gegeben! ⭐',
    freeSuperBody: 'Upgrade auf Premium, um zu sehen, wer wirklich mit dir matchen möchte.',
  },
  pt: {
    premiumTitle: '{{name}} gostou de você! 💜',
    premiumBody: 'Veja quem te curtiu e faça match instantaneamente.',
    premiumSuperTitle: '{{name}} te deu um super like! ⭐',
    premiumSuperBody: 'Essa pessoa quer muito se conectar com você!',
    freeTitle: 'Alguém gostou de você! 💜',
    freeBody: 'Atualize para Premium para ver quem te curtiu e fazer match instantaneamente.',
    freeSuperTitle: 'Alguém te deu um super like! ⭐',
    freeSuperBody: 'Atualize para Premium para ver quem realmente quer fazer match com você.',
  },
};

function getLikeText(lang: string, key: string, replacements?: Record<string, string>): string {
  const translations = likeTranslations[lang] || likeTranslations['en'];
  let text = translations[key] || likeTranslations['en'][key] || key;

  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      text = text.replace(`{{${k}}}`, v);
    }
  }

  return text;
}

/** Base64-encode a UUID to prevent casual inspection of push payloads */
function obfuscateId(id: string): string {
  return btoa(id);
}

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

    // Get liked user's profile (recipient, including preferred_language for localization)
    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from('profiles')
      .select('push_token, push_enabled, is_premium, is_platinum, last_active_at, preferred_language')
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
      .maybeSingle();

    const isPremium = recipient.is_premium || recipient.is_platinum;
    const likerName = liker?.display_name || 'Someone';
    const lang = recipient.preferred_language || 'en';

    // Different messaging based on subscription status (localized)
    let title: string;
    let body: string;

    if (isPremium) {
      if (like_type === 'super_like') {
        title = getLikeText(lang, 'premiumSuperTitle', { name: likerName });
        body = getLikeText(lang, 'premiumSuperBody');
      } else {
        title = getLikeText(lang, 'premiumTitle', { name: likerName });
        body = getLikeText(lang, 'premiumBody');
      }
    } else {
      if (like_type === 'super_like') {
        title = getLikeText(lang, 'freeSuperTitle');
        body = getLikeText(lang, 'freeSuperBody');
      } else {
        title = getLikeText(lang, 'freeTitle');
        body = getLikeText(lang, 'freeBody');
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
            likerProfileId: isPremium ? obfuscateId(liker_profile_id) : undefined,
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

    // NOTE: Activity feed entries are created by database triggers:
    // - trigger_like_received_activity → insert_like_received_activity()
    // - trigger_like_sent_activity → insert_like_sent_activity()
    // Do NOT create them here to avoid duplicates.
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
