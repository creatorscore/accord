import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

/**
 * Policy Restrict Straight Men
 *
 * Phase 1 of the gradual removal process:
 * 1. Finds all active straight men profiles
 * 2. Sets policy_restricted = true (hides from discovery)
 * 3. Sends email notification explaining the policy
 * 4. Sends push notification
 *
 * Users can still log in and update their profile for 14 days.
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

    // Optional: Verify admin access if called manually
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

      if (!authError && user) {
        const { data: adminProfile } = await supabaseAdmin
          .from('profiles')
          .select('is_admin')
          .eq('user_id', user.id)
          .single();

        if (!adminProfile?.is_admin) {
          return new Response(JSON.stringify({ error: 'Admin access required' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 403,
          });
        }
      }
    }

    // Parse request body for options
    let dryRun = false;
    let limit = 1000;
    try {
      const body = await req.json();
      dryRun = body.dry_run === true;
      limit = body.limit || 1000;
    } catch {
      // No body provided, use defaults
    }

    console.log(`[Policy Restrict] Starting ${dryRun ? 'DRY RUN' : 'LIVE RUN'}...`);

    // Find all active straight men who haven't been restricted yet
    const { data: straightMen, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        user_id,
        display_name,
        gender,
        sexual_orientation,
        push_token
      `)
      .eq('is_active', true)
      .or('policy_restricted.is.null,policy_restricted.eq.false')
      .not('gender', 'is', null)
      .contains('sexual_orientation', ['Straight'])
      .limit(limit);

    if (fetchError) {
      console.error('[Policy Restrict] Error fetching profiles:', fetchError);
      throw fetchError;
    }

    // Filter to only exclusively male-identifying users
    const menOnlyGenders = ['Man', 'Trans Man'];
    const targetProfiles = (straightMen || []).filter(profile => {
      if (!profile.gender || !Array.isArray(profile.gender)) return false;
      // Check if ALL genders are male-identifying
      return profile.gender.length > 0 &&
             profile.gender.every((g: string) => menOnlyGenders.includes(g));
    });

    console.log(`[Policy Restrict] Found ${targetProfiles.length} straight men to restrict`);

    if (dryRun) {
      return new Response(JSON.stringify({
        success: true,
        dry_run: true,
        would_restrict: targetProfiles.length,
        sample_profiles: targetProfiles.slice(0, 10).map(p => ({
          id: p.id,
          display_name: p.display_name,
          gender: p.gender,
          orientation: p.sexual_orientation
        }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const results = {
      total: targetProfiles.length,
      restricted: 0,
      emails_sent: 0,
      push_sent: 0,
      errors: [] as string[],
    };

    const now = new Date().toISOString();

    for (const profile of targetProfiles) {
      try {
        // 1. Update profile to be policy restricted
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            policy_restricted: true,
            policy_restricted_reason: 'straight_man',
            policy_restricted_at: now,
          })
          .eq('id', profile.id);

        if (updateError) {
          console.error(`[Policy Restrict] Failed to restrict ${profile.id}:`, updateError);
          results.errors.push(`Restrict ${profile.id}: ${updateError.message}`);
          continue;
        }

        results.restricted++;

        // 2. Get user email for notification
        const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
        const userEmail = authUser?.email;

        // 3. Send email notification
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
                subject: 'Important Update About Your Accord Account',
                html: generateEmailHtml(profile.display_name),
                text: generateEmailText(profile.display_name),
              }),
            });

            if (emailResponse.ok) {
              results.emails_sent++;

              // Update notification timestamp
              await supabaseAdmin
                .from('profiles')
                .update({ policy_restriction_notified_at: now })
                .eq('id', profile.id);
            } else {
              const errorText = await emailResponse.text();
              console.error(`[Policy Restrict] Email failed for ${profile.id}:`, errorText);
            }
          } catch (emailErr: any) {
            console.error(`[Policy Restrict] Email error for ${profile.id}:`, emailErr);
          }
        }

        // 4. Send push notification
        if (profile.push_token) {
          try {
            const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: profile.push_token,
                sound: 'default',
                title: 'Action Required: Profile Update',
                body: 'Your profile has been hidden. Please check your email for important information about your Accord account.',
                data: { type: 'policy_restriction' },
              }),
            });

            if (pushResponse.ok) {
              results.push_sent++;
            }
          } catch (pushErr: any) {
            console.error(`[Policy Restrict] Push error for ${profile.id}:`, pushErr);
          }
        }

      } catch (err: any) {
        console.error(`[Policy Restrict] Error processing ${profile.id}:`, err);
        results.errors.push(`Process ${profile.id}: ${err.message}`);
      }
    }

    console.log(`[Policy Restrict] Complete. Restricted: ${results.restricted}, Emails: ${results.emails_sent}, Push: ${results.push_sent}`);

    return new Response(JSON.stringify({
      success: true,
      ...results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[Policy Restrict] Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

function generateEmailHtml(displayName: string): string {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 14);
  const formattedDate = expirationDate.toLocaleDateString('en-US', {
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
  <title>Important Update About Your Accord Account</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #9B87CE 0%, #B8A9DD 100%); padding: 40px 40px 30px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 600;">Accord</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0; font-size: 14px;">Meaningful Connections for the LGBTQ+ Community</p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1a1a1a; margin: 0 0 20px; font-size: 22px;">Hi ${displayName},</h2>

              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Accord was created specifically for LGBTQ+ individuals seeking lavender marriages — meaningful partnerships built on mutual understanding and shared goals within our community.
              </p>

              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Based on your profile (identifying as a straight man), it appears Accord may not be the right fit for your dating goals. Our platform is designed to serve a specific community with unique needs.
              </p>

              <!-- Info Box -->
              <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                <h3 style="color: #92400E; margin: 0 0 12px; font-size: 16px;">What This Means:</h3>
                <ul style="color: #92400E; margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.8;">
                  <li>Your profile is currently hidden from discovery</li>
                  <li>You have until <strong>${formattedDate}</strong> to update your profile if this was a mistake</li>
                  <li>After this date, your account will be deactivated</li>
                </ul>
              </div>

              <!-- Action Box -->
              <div style="background-color: #F0FDF4; border-left: 4px solid #10B981; padding: 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
                <h3 style="color: #065F46; margin: 0 0 12px; font-size: 16px;">If You Made a Mistake:</h3>
                <p style="color: #065F46; margin: 0; font-size: 14px; line-height: 1.6;">
                  If you incorrectly selected your gender or orientation, you can update your profile in the app within the next 14 days.
                </p>
                <p style="color: #065F46; margin: 15px 0 0; font-size: 14px;">
                  <strong>Go to:</strong> Settings → Edit Profile
                </p>
              </div>

              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 25px 0;">
                We understand this may be disappointing. If you have questions, please contact us at <a href="mailto:hello@joinaccord.app" style="color: #9B87CE;">hello@joinaccord.app</a>.
              </p>

              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0;">
                Thank you for understanding our mission to create a safe space for the LGBTQ+ community.
              </p>

              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 25px 0 0;">
                The Accord Team
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 25px 40px; text-align: center; border-top: 1px solid #eaeaea;">
              <p style="color: #999999; font-size: 12px; margin: 0;">
                &copy; ${new Date().getFullYear()} Accord. All rights reserved.
              </p>
              <p style="color: #999999; font-size: 12px; margin: 10px 0 0;">
                Questions? Contact <a href="mailto:hello@joinaccord.app" style="color: #9B87CE;">hello@joinaccord.app</a>
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

function generateEmailText(displayName: string): string {
  const expirationDate = new Date();
  expirationDate.setDate(expirationDate.getDate() + 14);
  const formattedDate = expirationDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  return `
Hi ${displayName},

Accord was created specifically for LGBTQ+ individuals seeking lavender marriages — meaningful partnerships built on mutual understanding and shared goals within our community.

Based on your profile (identifying as a straight man), it appears Accord may not be the right fit for your dating goals. Our platform is designed to serve a specific community with unique needs.

WHAT THIS MEANS:
- Your profile is currently hidden from discovery
- You have until ${formattedDate} to update your profile if this was a mistake
- After this date, your account will be deactivated

IF YOU MADE A MISTAKE:
If you incorrectly selected your gender or orientation, you can update your profile in the app within the next 14 days. Go to: Settings → Edit Profile

We understand this may be disappointing. If you have questions, please contact us at hello@joinaccord.app.

Thank you for understanding our mission to create a safe space for the LGBTQ+ community.

The Accord Team

---
© ${new Date().getFullYear()} Accord. All rights reserved.
Questions? Contact hello@joinaccord.app
  `.trim();
}
