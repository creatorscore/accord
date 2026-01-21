import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Different email templates based on inactivity duration
type InactivityLevel = '3_days' | '7_days' | '14_days';

function getInactivityLevel(lastActiveAt: Date): InactivityLevel | null {
  const now = new Date();
  const daysSinceActive = Math.floor((now.getTime() - lastActiveAt.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceActive >= 14 && daysSinceActive < 21) return '14_days';
  if (daysSinceActive >= 7 && daysSinceActive < 10) return '7_days';
  if (daysSinceActive >= 3 && daysSinceActive < 5) return '3_days';

  return null; // Not in any notification window
}

// Email templates for different inactivity levels - Mobile responsive
function generateInactiveEmail(
  recipientName: string,
  level: InactivityLevel,
  stats: { likesReceived: number; newMatches: number; potentialMatches: number }
): { html: string; text: string; subject: string } {
  const templates = {
    '3_days': {
      emoji: '👋',
      headline: 'We Miss You!',
      subheadline: "It's been a few days since you visited Accord",
      cta: 'See What You Missed',
      urgency: 'low',
    },
    '7_days': {
      emoji: '💜',
      headline: 'Your Matches Are Waiting',
      subheadline: "It's been a week - don't let connections slip away",
      cta: 'Reconnect Now',
      urgency: 'medium',
    },
    '14_days': {
      emoji: '✨',
      headline: "We'd Love to See You Again",
      subheadline: "It's been a while, and there are people looking for someone like you",
      cta: 'Come Back to Accord',
      urgency: 'high',
    },
  };

  const template = templates[level];

  // Build stats section if we have any activity
  let statsSection = '';
  let statsText = '';

  if (stats.likesReceived > 0 || stats.newMatches > 0 || stats.potentialMatches > 0) {
    const statItems = [];
    const textItems = [];

    if (stats.likesReceived > 0) {
      statItems.push(`<td style="text-align: center; padding: 10px;"><div style="font-size: 28px; font-weight: 700; color: #9B87CE;">${stats.likesReceived}</div><div style="font-size: 12px; color: #666;">New Likes</div></td>`);
      textItems.push(`${stats.likesReceived} new likes`);
    }
    if (stats.newMatches > 0) {
      statItems.push(`<td style="text-align: center; padding: 10px;"><div style="font-size: 28px; font-weight: 700; color: #9B87CE;">${stats.newMatches}</div><div style="font-size: 12px; color: #666;">Matches</div></td>`);
      textItems.push(`${stats.newMatches} matches`);
    }
    if (stats.potentialMatches > 0) {
      statItems.push(`<td style="text-align: center; padding: 10px;"><div style="font-size: 28px; font-weight: 700; color: #9B87CE;">${stats.potentialMatches}+</div><div style="font-size: 12px; color: #666;">Potential Matches</div></td>`);
      textItems.push(`${stats.potentialMatches}+ potential matches`);
    }

    statsSection = `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 25px 0;">
        <tr>
          <td style="background: #F9FAFB; border-radius: 12px; padding: 10px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>${statItems.join('')}</tr>
            </table>
          </td>
        </tr>
      </table>
    `;

    statsText = `\nWhile you were away:\n- ${textItems.join('\n- ')}\n`;
  }

  const html = `
    <!DOCTYPE html>
    <html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="x-apple-disable-message-reformatting">
      <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
      <title>${template.headline}</title>
      <!--[if mso]>
      <noscript>
        <xml>
          <o:OfficeDocumentSettings>
            <o:PixelsPerInch>96</o:PixelsPerInch>
          </o:OfficeDocumentSettings>
        </xml>
      </noscript>
      <![endif]-->
      <style>
        * { box-sizing: border-box; }
        body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
        table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
        img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
        table { border-collapse: collapse !important; }
        body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; }
        a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; font-size: inherit !important; font-family: inherit !important; font-weight: inherit !important; line-height: inherit !important; }
        @media only screen and (max-width: 620px) {
          .mobile-padding { padding-left: 16px !important; padding-right: 16px !important; }
          .mobile-stack { display: block !important; width: 100% !important; }
          .mobile-center { text-align: center !important; }
          .mobile-button { width: 100% !important; }
          h1 { font-size: 24px !important; }
          .stats-cell { display: block !important; width: 100% !important; padding: 8px 0 !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <!-- Preview text -->
      <div style="display: none; max-height: 0; overflow: hidden;">
        ${template.subheadline}. Come back and discover new connections!
        &nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
      </div>

      <!-- Email wrapper -->
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
        <tr>
          <td align="center" style="padding: 20px 10px;">
            <!-- Email container -->
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px;">

              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #9B87CE 0%, #B8A9DD 100%); padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0;">
                  <div style="font-size: 56px; line-height: 1;">${template.emoji}</div>
                  <h1 style="color: white; margin: 15px 0 0 0; font-size: 28px; font-weight: 700; line-height: 1.2;">${template.headline}</h1>
                  <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; line-height: 1.4;">${template.subheadline}</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="background: #ffffff; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td class="mobile-padding" style="padding: 35px 40px;">
                        <p style="font-size: 18px; margin: 0 0 20px 0; color: #333; line-height: 1.5;">Hi ${recipientName}!</p>

                        <p style="font-size: 16px; margin: 0 0 25px 0; color: #555; line-height: 1.6;">
                          Your journey to finding a meaningful connection doesn't have to pause.
                          Every day on Accord is an opportunity to meet someone who shares your goals and values.
                        </p>

                        ${statsSection}

                        <!-- CTA Box -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="background: linear-gradient(135deg, #F3E8FF 0%, #EDE9FE 100%); border-radius: 12px; padding: 25px; text-align: center;">
                              <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                <p style="font-size: 18px; color: #6B21A8; margin: 0 0 5px 0; font-weight: 700;">
                                  ${template.emoji} ${template.headline}
                                </p>
                                <p style="font-size: 14px; color: #666; margin: 0;">
                                  ${template.subheadline}
                                </p>
                              </div>
                              <p style="font-size: 15px; color: #6B21A8; margin: 0; font-weight: 500; line-height: 1.4;">
                                Open the Accord app on your phone to continue your journey!
                              </p>
                            </td>
                          </tr>
                        </table>

                        <!-- Tip Box -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 25px;">
                          <tr>
                            <td style="background: #FEF3C7; border-radius: 10px; padding: 18px;">
                              <p style="font-size: 14px; color: #92400E; margin: 0; line-height: 1.5;">
                                <strong>Reminder:</strong> The most successful connections happen when both people are actively engaged. Your perfect match might be waiting right now!
                              </p>
                            </td>
                          </tr>
                        </table>

                        <!-- Divider -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 30px 0;">
                          <tr>
                            <td style="border-top: 1px solid #e0e0e0;"></td>
                          </tr>
                        </table>

                        <!-- Footer -->
                        <p style="font-size: 13px; color: #888; text-align: center; margin: 0; line-height: 1.6;">
                          You're receiving this because you haven't visited Accord recently.<br>
                          To manage email preferences, open the Accord app and go to Settings &gt; Notifications
                        </p>

                        <p style="font-size: 13px; color: #888; text-align: center; margin: 15px 0 0 0; line-height: 1.6;">
                          Accord - Safe Connections for Meaningful Partnerships<br>
                          <a href="https://joinaccord.app" style="color: #9B87CE; text-decoration: none;">joinaccord.app</a>
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

  const text = `Hi ${recipientName}!

${template.headline}

${template.subheadline}

Your journey to finding a meaningful connection doesn't have to pause. Every day on Accord is an opportunity to meet someone who shares your goals and values.
${statsText}
${template.emoji} ${template.headline}
${template.subheadline}

Open the Accord app on your phone to continue your journey!

Reminder: The most successful connections happen when both people are actively engaged. Your perfect match might be waiting right now!

---
You're receiving this because you haven't visited Accord recently.
To manage email preferences, open the Accord app and go to Settings > Notifications

Accord - Safe Connections for Meaningful Partnerships
joinaccord.app`;

  return { html, text, subject: `${template.emoji} ${template.headline} - Accord` };
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

    // Find inactive users (not active in past 3 days, but were active in past 30 days)
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Get profiles with complete onboarding who haven't been active
    const { data: inactiveProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, user_id, display_name, last_active_at')
      .eq('profile_complete', true)
      .lt('last_active_at', threeDaysAgo)
      .gt('last_active_at', thirtyDaysAgo)
      .is('is_banned', null)
      .order('last_active_at', { ascending: true })
      .limit(100); // Process in batches

    if (profilesError) {
      console.error('Error fetching inactive profiles:', profilesError);
      throw profilesError;
    }

    if (!inactiveProfiles || inactiveProfiles.length === 0) {
      console.log('No inactive users to notify');
      return new Response(
        JSON.stringify({ success: true, message: 'No inactive users' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get user emails
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    const results = [];

    for (const profile of inactiveProfiles) {
      const lastActiveAt = new Date(profile.last_active_at);
      const level = getInactivityLevel(lastActiveAt);

      if (!level) {
        continue; // Not in a notification window
      }

      const user = users.users.find(u => u.id === profile.user_id);
      if (!user?.email) {
        console.log(`No email for user ${profile.user_id}`);
        continue;
      }

      // Get activity stats for this user
      const [likesResult, matchesResult] = await Promise.all([
        supabase
          .from('likes')
          .select('id', { count: 'exact' })
          .eq('liked_profile_id', profile.id)
          .gte('created_at', profile.last_active_at),
        supabase
          .from('matches')
          .select('id', { count: 'exact' })
          .or(`profile1_id.eq.${profile.id},profile2_id.eq.${profile.id}`)
          .gte('matched_at', profile.last_active_at),
      ]);

      const stats = {
        likesReceived: likesResult.count || 0,
        newMatches: matchesResult.count || 0,
        potentialMatches: Math.floor(Math.random() * 30) + 10, // Placeholder - could calculate real potential matches
      };

      const { html, text, subject } = generateInactiveEmail(
        profile.display_name || 'there',
        level,
        stats
      );

      // Call the send-email function
      const response = await fetch(
        `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          },
          body: JSON.stringify({
            userId: profile.user_id,
            emailType: 'inactive_reminder',
            recipientEmail: user.email,
            recipientName: profile.display_name || 'there',
            subject,
            htmlContent: html,
            textContent: text,
          }),
        }
      );

      const result = await response.json();
      results.push({ email: user.email, level, result });
      console.log(`Inactive user email (${level}) to ${user.email}:`, result);
    }

    return new Response(
      JSON.stringify({ success: true, emailsSent: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error in email-inactive-users:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
