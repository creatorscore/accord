import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

/**
 * Policy Restriction Reminder (Day 7)
 *
 * Sends reminder emails to users who:
 * - Were policy restricted 7+ days ago
 * - Haven't updated their profile to remove the restriction
 * - Haven't received a reminder yet
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

    console.log('[Policy Reminder] Starting reminder check...');

    // Find users restricted 7+ days ago who haven't received a reminder
    // and are still straight men (haven't updated their profile)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: eligibleProfiles, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        user_id,
        display_name,
        gender,
        sexual_orientation,
        policy_restricted_at,
        push_token
      `)
      .eq('policy_restricted', true)
      .eq('policy_restricted_reason', 'straight_man')
      .eq('policy_restriction_reminder_sent', false)
      .lt('policy_restricted_at', sevenDaysAgo.toISOString())
      .not('policy_restricted_at', 'is', null);

    if (fetchError) {
      console.error('[Policy Reminder] Error fetching profiles:', fetchError);
      throw fetchError;
    }

    // Filter to only those who are still straight men
    const menOnlyGenders = ['Man', 'Trans Man'];
    const targetProfiles = (eligibleProfiles || []).filter(profile => {
      if (!profile.gender || !Array.isArray(profile.gender)) return false;
      if (!profile.sexual_orientation || !profile.sexual_orientation.includes('Straight')) return false;
      return profile.gender.length > 0 &&
             profile.gender.every((g: string) => menOnlyGenders.includes(g));
    });

    console.log(`[Policy Reminder] Found ${targetProfiles.length} profiles needing reminder`);

    const results = {
      total: targetProfiles.length,
      reminders_sent: 0,
      push_sent: 0,
      errors: [] as string[],
    };

    for (const profile of targetProfiles) {
      try {
        // Get user email
        const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
        const userEmail = authUser?.email;

        // Calculate deactivation date (14 days from restriction)
        const restrictedAt = new Date(profile.policy_restricted_at);
        const deactivationDate = new Date(restrictedAt);
        deactivationDate.setDate(deactivationDate.getDate() + 14);

        // Send reminder email
        if (userEmail && RESEND_API_KEY) {
          try {
            const emailResponse = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: 'Accord <hello@news.joinaccord.app>',
                to: userEmail,
                subject: 'Reminder: Your Accord Account - 7 Days Remaining',
                html: generateReminderEmailHtml(profile.display_name, deactivationDate),
                text: generateReminderEmailText(profile.display_name, deactivationDate),
              }),
            });

            if (emailResponse.ok) {
              results.reminders_sent++;
            } else {
              const errorText = await emailResponse.text();
              console.error(`[Policy Reminder] Email failed for ${profile.id}:`, errorText);
            }
          } catch (emailErr: any) {
            console.error(`[Policy Reminder] Email error for ${profile.id}:`, emailErr);
          }
        }

        // Send push notification
        if (profile.push_token) {
          try {
            const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: profile.push_token,
                sound: 'default',
                title: 'Reminder: 7 Days Remaining',
                body: 'Your Accord profile is still hidden. Update your profile to remain on the platform.',
                data: { type: 'policy_restriction_reminder' },
              }),
            });

            if (pushResponse.ok) {
              results.push_sent++;
            }
          } catch (pushErr: any) {
            console.error(`[Policy Reminder] Push error for ${profile.id}:`, pushErr);
          }
        }

        // Mark reminder as sent
        await supabaseAdmin
          .from('profiles')
          .update({ policy_restriction_reminder_sent: true })
          .eq('id', profile.id);

      } catch (err: any) {
        console.error(`[Policy Reminder] Error processing ${profile.id}:`, err);
        results.errors.push(`Process ${profile.id}: ${err.message}`);
      }
    }

    console.log(`[Policy Reminder] Complete. Reminders: ${results.reminders_sent}, Push: ${results.push_sent}`);

    return new Response(JSON.stringify({
      success: true,
      ...results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[Policy Reminder] Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

function generateReminderEmailHtml(displayName: string, deactivationDate: Date): string {
  const formattedDate = deactivationDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden;">
          <tr>
            <td style="background: linear-gradient(135deg, #9B87CE 0%, #B8A9DD 100%); padding: 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">Accord</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1a1a1a; margin: 0 0 20px; font-size: 20px;">Hi ${displayName},</h2>

              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                This is a reminder that your Accord profile is currently hidden from discovery.
              </p>

              <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                <p style="color: #92400E; margin: 0; font-size: 16px; font-weight: 600;">
                  You have 7 days remaining to update your profile.
                </p>
                <p style="color: #92400E; margin: 10px 0 0; font-size: 14px;">
                  After <strong>${formattedDate}</strong>, your account will be deactivated.
                </p>
              </div>

              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                <strong>To update your profile:</strong><br>
                Open the Accord app → Settings → Edit Profile
              </p>

              <p style="color: #4a4a4a; font-size: 14px; line-height: 1.6; margin-top: 25px;">
                Questions? Contact <a href="mailto:hello@joinaccord.app" style="color: #9B87CE;">hello@joinaccord.app</a>
              </p>

              <p style="color: #4a4a4a; font-size: 16px; margin-top: 25px;">
                The Accord Team
              </p>
            </td>
          </tr>
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eaeaea;">
              <p style="color: #999999; font-size: 12px; margin: 0;">
                &copy; ${new Date().getFullYear()} Accord. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

function generateReminderEmailText(displayName: string, deactivationDate: Date): string {
  const formattedDate = deactivationDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return `
Hi ${displayName},

This is a reminder that your Accord profile is currently hidden from discovery.

You have 7 days remaining to update your profile if your gender or orientation was entered incorrectly.

After ${formattedDate}, your account will be deactivated.

To update your profile: Open the Accord app → Settings → Edit Profile

Questions? Contact hello@joinaccord.app

The Accord Team

---
© ${new Date().getFullYear()} Accord. All rights reserved.
  `.trim();
}
