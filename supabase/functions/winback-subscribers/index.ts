import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Win-back Subscribers
 *
 * Targets expired subscribers who are still actively using the app.
 * Sends push notifications + email with re-subscription prompts.
 *
 * Schedule: Run daily at 2:00 PM (after peak morning usage)
 *
 * Segments:
 * - Recently expired (1-3 days): Urgent "don't lose your features" messaging
 * - Medium expired (4-7 days): Value reminder with engagement stats
 * - Long expired (8-14 days): Discount/incentive offer
 */

type WinbackSegment = 'recent' | 'medium' | 'long';

interface WinbackTarget {
  profileId: string;
  userId: string;
  displayName: string;
  email: string;
  segment: WinbackSegment;
  daysSinceExpiry: number;
  likesReceived: number;
  matchCount: number;
  preferredLanguage: string;
}

function getSegment(daysSinceExpiry: number): WinbackSegment | null {
  if (daysSinceExpiry >= 1 && daysSinceExpiry <= 3) return 'recent';
  if (daysSinceExpiry >= 4 && daysSinceExpiry <= 7) return 'medium';
  if (daysSinceExpiry >= 8 && daysSinceExpiry <= 14) return 'long';
  return null;
}

function getPushContent(target: WinbackTarget): { title: string; body: string } {
  const lang = target.preferredLanguage || 'en';

  if (lang === 'es') {
    switch (target.segment) {
      case 'recent':
        return {
          title: 'Tu suscripcion expiro',
          body: target.likesReceived > 0
            ? `${target.likesReceived} personas te dieron like mientras eras Premium. No pierdas esas conexiones.`
            : 'Tus filtros avanzados y likes ilimitados ya no estan disponibles. Reactivar es facil.',
        };
      case 'medium':
        return {
          title: 'Tus matches te extranan',
          body: `Tienes ${target.matchCount} matches esperando. Los miembros Premium tienen 3x mas conversaciones.`,
        };
      case 'long':
        return {
          title: 'Oferta especial para ti',
          body: 'Ha pasado un tiempo. Vuelve a Premium con un descuento especial, solo por tiempo limitado.',
        };
    }
  }

  switch (target.segment) {
    case 'recent':
      return {
        title: 'Your subscription expired',
        body: target.likesReceived > 0
          ? `${target.likesReceived} people liked you while you were Premium. Don't lose those connections.`
          : 'Your advanced filters and unlimited likes are no longer available. Reactivating is easy.',
      };
    case 'medium':
      return {
        title: 'Your matches miss you',
        body: `You have ${target.matchCount} matches waiting. Premium members have 3x more conversations.`,
      };
    case 'long':
      return {
        title: 'Special offer just for you',
        body: "It's been a while. Come back to Premium with a special discount - limited time only.",
      };
  }
}

function generateWinbackEmail(target: WinbackTarget): { html: string; text: string; subject: string } {
  const templates = {
    recent: {
      emoji: '💜',
      headline: "Your Premium Features Expired",
      subheadline: "But your connections don't have to",
      statsMessage: target.likesReceived > 0
        ? `<strong>${target.likesReceived} people</strong> liked your profile while you had Premium. Without it, you can't see who they are.`
        : "You're missing out on advanced filters, unlimited likes, and seeing who liked you.",
      cta: 'Reactivate Premium',
    },
    medium: {
      emoji: '✨',
      headline: 'Premium Members Match 3x More',
      subheadline: "Your connections are waiting",
      statsMessage: `You have <strong>${target.matchCount} matches</strong> and the people who find you are still swiping. Premium members start 3x more conversations.`,
      cta: 'Get Premium Back',
    },
    long: {
      emoji: '🎁',
      headline: 'A Special Offer, Just for You',
      subheadline: "We'd love to have you back",
      statsMessage: "We've been making Accord better every day. Come back and see what's new - with a special returning member offer.",
      cta: 'See My Offer',
    },
  };

  const t = templates[target.segment];

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="x-apple-disable-message-reformatting">
      <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
      <title>${t.headline}</title>
      <style>
        * { box-sizing: border-box; }
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table { border-collapse: collapse !important; }
        body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
        @media only screen and (max-width: 620px) {
          .mobile-padding { padding-left: 16px !important; padding-right: 16px !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <div style="display: none; max-height: 0; overflow: hidden;">
        ${t.subheadline}
        &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
      </div>

      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
        <tr>
          <td align="center" style="padding: 20px 10px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #A08AB7 0%, #B8A9DD 100%); padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0;">
                  <div style="font-size: 56px; line-height: 1;">${t.emoji}</div>
                  <h1 style="color: white; margin: 15px 0 0 0; font-size: 28px; font-weight: 700; line-height: 1.2;">${t.headline}</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; line-height: 1.4;">${t.subheadline}</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="background: #ffffff; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td class="mobile-padding" style="padding: 35px 40px;">
                        <p style="font-size: 18px; margin: 0 0 20px 0; color: #333; line-height: 1.5;">Hi ${target.displayName}!</p>

                        <p style="font-size: 16px; margin: 0 0 25px 0; color: #555; line-height: 1.6;">
                          ${t.statsMessage}
                        </p>

                        <!-- What you're missing -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0;">
                          <tr>
                            <td style="background: #F3E8FF; border-radius: 12px; padding: 20px;">
                              <p style="font-size: 14px; font-weight: 700; color: #6B21A8; margin: 0 0 12px 0;">What you're missing without Premium:</p>
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                                <tr><td style="padding: 4px 0; font-size: 14px; color: #555;">&#10005; See who liked you</td></tr>
                                <tr><td style="padding: 4px 0; font-size: 14px; color: #555;">&#10005; Unlimited likes</td></tr>
                                <tr><td style="padding: 4px 0; font-size: 14px; color: #555;">&#10005; Advanced filters</td></tr>
                                <tr><td style="padding: 4px 0; font-size: 14px; color: #555;">&#10005; Rewind last swipe</td></tr>
                                <tr><td style="padding: 4px 0; font-size: 14px; color: #555;">&#10005; Read receipts</td></tr>
                              </table>
                            </td>
                          </tr>
                        </table>

                        <!-- CTA -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0;">
                          <tr>
                            <td style="text-align: center;">
                              <p style="font-size: 16px; color: #6B21A8; font-weight: 600; margin: 0 0 10px 0;">
                                Open the Accord app to ${t.cta.toLowerCase()}!
                              </p>
                            </td>
                          </tr>
                        </table>

                        <!-- Divider -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 30px 0;">
                          <tr><td style="border-top: 1px solid #e0e0e0;"></td></tr>
                        </table>

                        <!-- Footer -->
                        <p style="font-size: 13px; color: #888; text-align: center; margin: 0; line-height: 1.6;">
                          To manage email preferences, open the Accord app and go to Settings &gt; Notifications
                        </p>
                        <p style="font-size: 13px; color: #888; text-align: center; margin: 15px 0 0 0; line-height: 1.6;">
                          Accord - Safe Connections for Meaningful Partnerships<br>
                          <a href="https://joinaccord.app" style="color: #A08AB7; text-decoration: none;">joinaccord.app</a>
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `Hi ${target.displayName}!

${t.headline}

${t.subheadline}

${t.statsMessage.replace(/<\/?strong>/g, '')}

What you're missing without Premium:
- See who liked you
- Unlimited likes
- Advanced filters
- Rewind last swipe
- Read receipts

Open the Accord app to ${t.cta.toLowerCase()}!

---
To manage email preferences, open the Accord app and go to Settings > Notifications

Accord - Safe Connections for Meaningful Partnerships
joinaccord.app`;

  const subject = `${t.emoji} ${t.headline} - Accord`;

  return { html, text, subject };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Running subscriber win-back check...');

    const now = new Date();
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Find expired subscriptions where the user was active in the last 7 days
    const { data: expiredSubs, error: subsError } = await supabase
      .from('subscriptions')
      .select(`
        profile_id,
        expires_at,
        profiles!inner (
          id,
          user_id,
          display_name,
          last_active_at,
          preferred_language,
          push_token,
          push_enabled,
          email_unsubscribed_at,
          email_bounced,
          email_spam_complaint
        )
      `)
      .eq('status', 'expired')
      .gte('expires_at', fourteenDaysAgo)
      .gte('profiles.last_active_at', sevenDaysAgo);

    if (subsError) {
      console.error('Error fetching expired subscriptions:', subsError);
      throw subsError;
    }

    if (!expiredSubs || expiredSubs.length === 0) {
      console.log('No win-back targets found');
      return new Response(
        JSON.stringify({ success: true, message: 'No win-back targets', sent: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${expiredSubs.length} potential win-back targets`);

    let pushSent = 0;
    let emailsSent = 0;
    let skipped = 0;

    for (const sub of expiredSubs) {
      const profile = sub.profiles as any;
      if (!profile) continue;

      const expiresAt = new Date(sub.expires_at);
      const daysSinceExpiry = Math.floor((now.getTime() - expiresAt.getTime()) / (1000 * 60 * 60 * 24));
      const segment = getSegment(daysSinceExpiry);

      if (!segment) {
        skipped++;
        continue;
      }

      // Check if we already sent a winback notification today
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const { data: alreadySent } = await supabase
        .from('notification_queue')
        .select('id')
        .eq('recipient_profile_id', profile.id)
        .eq('notification_type', 'winback_subscriber')
        .gte('created_at', todayStart.toISOString())
        .limit(1);

      if (alreadySent && alreadySent.length > 0) {
        skipped++;
        continue;
      }

      // Get engagement stats
      const [likesResult, matchesResult] = await Promise.all([
        supabase
          .from('likes')
          .select('id', { count: 'exact' })
          .eq('liked_profile_id', profile.id)
          .gte('created_at', fourteenDaysAgo),
        supabase
          .from('matches')
          .select('id', { count: 'exact' })
          .or(`profile1_id.eq.${profile.id},profile2_id.eq.${profile.id}`)
          .eq('status', 'active'),
      ]);

      const target: WinbackTarget = {
        profileId: profile.id,
        userId: profile.user_id,
        displayName: profile.display_name || 'there',
        email: '', // filled below
        segment,
        daysSinceExpiry,
        likesReceived: likesResult.count || 0,
        matchCount: matchesResult.count || 0,
        preferredLanguage: profile.preferred_language || 'en',
      };

      // Send push notification
      const pushContent = getPushContent(target);
      if (profile.push_token && profile.push_enabled) {
        await supabase.from('notification_queue').insert({
          recipient_profile_id: profile.id,
          notification_type: 'winback_subscriber',
          title: pushContent.title,
          body: pushContent.body,
          data: { type: 'winback', segment, screen: 'settings/subscription' },
        });
        pushSent++;
      }

      // Send email via Resend (skip if bounced/unsubscribed/spam)
      const canEmail = !profile.email_unsubscribed_at && !profile.email_bounced && !profile.email_spam_complaint;

      if (canEmail) {
        // Look up email
        try {
          const { data: userData } = await supabase.auth.admin.getUserById(profile.user_id);
          if (userData?.user?.email) {
            target.email = userData.user.email;

            const { html, text, subject } = generateWinbackEmail(target);

            // Call the central send-email function
            await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
                },
                body: JSON.stringify({
                  userId: profile.user_id,
                  emailType: 'inactive_reminder', // reuse cooldown slot
                  recipientEmail: target.email,
                  recipientName: target.displayName,
                  subject,
                  htmlContent: html,
                  textContent: text,
                }),
              }
            );
            emailsSent++;
          }
        } catch (e) {
          console.error(`Error sending email for ${profile.id}:`, e);
        }
      }

      console.log(`Win-back ${segment} (${daysSinceExpiry}d expired): ${profile.display_name} - push: ${profile.push_token ? 'yes' : 'no'}, email: ${canEmail ? 'yes' : 'no'}`);
    }

    const result = {
      success: true,
      targets: expiredSubs.length,
      pushSent,
      emailsSent,
      skipped,
    };

    console.log('Win-back complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Error in winback-subscribers:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
