import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

/**
 * Policy Restriction Deactivate (Day 14)
 *
 * Final step: Deactivates accounts that:
 * - Were policy restricted 14+ days ago
 * - Still identify as straight men (haven't updated profile)
 *
 * Sets is_active = false but does NOT ban from auth
 * (they didn't violate rules, just aren't target audience)
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

    // Parse request body for options
    let dryRun = false;
    try {
      const body = await req.json();
      dryRun = body.dry_run === true;
    } catch {
      // No body provided
    }

    console.log(`[Policy Deactivate] Starting ${dryRun ? 'DRY RUN' : 'LIVE RUN'}...`);

    // Find users restricted 14+ days ago who are still straight men
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data: eligibleProfiles, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select(`
        id,
        user_id,
        display_name,
        gender,
        sexual_orientation,
        policy_restricted_at,
        is_active
      `)
      .eq('policy_restricted', true)
      .eq('policy_restricted_reason', 'straight_man')
      .or('is_active.is.null,is_active.eq.true') // Not already deactivated
      .lt('policy_restricted_at', fourteenDaysAgo.toISOString())
      .not('policy_restricted_at', 'is', null);

    if (fetchError) {
      console.error('[Policy Deactivate] Error fetching profiles:', fetchError);
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

    console.log(`[Policy Deactivate] Found ${targetProfiles.length} profiles to deactivate`);

    if (dryRun) {
      return new Response(JSON.stringify({
        success: true,
        dry_run: true,
        would_deactivate: targetProfiles.length,
        sample_profiles: targetProfiles.slice(0, 10).map(p => ({
          id: p.id,
          display_name: p.display_name,
          restricted_at: p.policy_restricted_at
        }))
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const results = {
      total: targetProfiles.length,
      deactivated: 0,
      emails_sent: 0,
      errors: [] as string[],
    };

    for (const profile of targetProfiles) {
      try {
        // 1. Deactivate the profile (NOT ban from auth)
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({
            is_active: false,
            // Note: We don't set ban_reason - this is a policy restriction, not a ban
          })
          .eq('id', profile.id);

        if (updateError) {
          console.error(`[Policy Deactivate] Failed to deactivate ${profile.id}:`, updateError);
          results.errors.push(`Deactivate ${profile.id}: ${updateError.message}`);
          continue;
        }

        results.deactivated++;

        // 2. Get user email for final notification
        const { data: { user: authUser } } = await supabaseAdmin.auth.admin.getUserById(profile.user_id);
        const userEmail = authUser?.email;

        // 3. Send final email
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
                subject: 'Your Accord Account Has Been Deactivated',
                html: generateDeactivationEmailHtml(profile.display_name),
                text: generateDeactivationEmailText(profile.display_name),
              }),
            });

            if (emailResponse.ok) {
              results.emails_sent++;
            } else {
              const errorText = await emailResponse.text();
              console.error(`[Policy Deactivate] Email failed for ${profile.id}:`, errorText);
            }
          } catch (emailErr: any) {
            console.error(`[Policy Deactivate] Email error for ${profile.id}:`, emailErr);
          }
        }

      } catch (err: any) {
        console.error(`[Policy Deactivate] Error processing ${profile.id}:`, err);
        results.errors.push(`Process ${profile.id}: ${err.message}`);
      }
    }

    console.log(`[Policy Deactivate] Complete. Deactivated: ${results.deactivated}, Emails: ${results.emails_sent}`);

    return new Response(JSON.stringify({
      success: true,
      ...results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[Policy Deactivate] Unexpected error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error',
      details: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

function generateDeactivationEmailHtml(displayName: string): string {
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
                As communicated two weeks ago, your Accord account has been deactivated because our platform is specifically designed for LGBTQ+ individuals seeking lavender marriages.
              </p>

              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                We wish you the best in finding a platform that better suits your dating goals.
              </p>

              <div style="background-color: #F3F4F6; padding: 20px; margin: 25px 0; border-radius: 8px;">
                <p style="color: #4B5563; margin: 0; font-size: 14px;">
                  If you believe this was done in error, please contact us at <a href="mailto:hello@joinaccord.app" style="color: #9B87CE;">hello@joinaccord.app</a>
                </p>
              </div>

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

function generateDeactivationEmailText(displayName: string): string {
  return `
Hi ${displayName},

As communicated two weeks ago, your Accord account has been deactivated because our platform is specifically designed for LGBTQ+ individuals seeking lavender marriages.

We wish you the best in finding a platform that better suits your dating goals.

If you believe this was done in error, please contact hello@joinaccord.app.

The Accord Team

---
© ${new Date().getFullYear()} Accord. All rights reserved.
  `.trim();
}
