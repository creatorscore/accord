import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ActionType = 'photo_review' | 'verify_identity' | 'dismiss' | 'warn';

interface ReportActionPayload {
  action: ActionType;
  report_id: string;
  reported_profile_id: string;
  reason: string;
  details?: string;
}

// Generate photo verification required email
function generatePhotoVerificationEmail(recipientName: string, isIdentityRequired: boolean): { html: string; text: string } {
  const title = isIdentityRequired ? 'Identity Verification Required' : 'Photo Verification Required';
  const message = isIdentityRequired
    ? 'To continue using Accord, we need you to verify your identity. This helps us maintain a safe and authentic community for everyone.'
    : 'To continue using Accord, we need you to re-upload your photos for verification. This helps us maintain a safe and authentic community for everyone.';

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        * { box-sizing: border-box; }
        body { margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; }
        @media only screen and (max-width: 620px) {
          .mobile-padding { padding-left: 16px !important; padding-right: 16px !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
        <tr>
          <td align="center" style="padding: 20px 10px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #A08AB7 0%, #B8A9DD 100%); padding: 40px 30px; text-align: center; border-radius: 16px 16px 0 0;">
                  <div style="font-size: 56px; line-height: 1;">📸</div>
                  <h1 style="color: white; margin: 15px 0 0 0; font-size: 24px; font-weight: 700;">${title}</h1>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="background: #ffffff; border-radius: 0 0 16px 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                    <tr>
                      <td class="mobile-padding" style="padding: 35px 40px;">
                        <p style="font-size: 18px; margin: 0 0 20px 0; color: #333;">Hi ${recipientName},</p>
                        <p style="font-size: 16px; margin: 0 0 25px 0; color: #555; line-height: 1.6;">${message}</p>
                        <p style="font-size: 16px; margin: 0 0 25px 0; color: #555; line-height: 1.6;">
                          <strong>What you need to do:</strong>
                        </p>
                        <ol style="font-size: 16px; color: #555; line-height: 1.8; padding-left: 20px; margin: 0 0 25px 0;">
                          <li>Open the Accord app</li>
                          <li>You'll see a verification prompt</li>
                          <li>Follow the steps to ${isIdentityRequired ? 'verify your identity' : 'upload new photos'}</li>
                        </ol>
                        <p style="font-size: 16px; margin: 0 0 30px 0; color: #555; line-height: 1.6;">
                          Your profile will be hidden from discovery until verification is complete.
                        </p>
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td align="center">
                              <a href="https://joinaccord.app" style="background: linear-gradient(135deg, #A08AB7 0%, #B8A9DD 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 30px; font-weight: 600; font-size: 16px; display: inline-block;">Open Accord</a>
                            </td>
                          </tr>
                        </table>
                        <p style="font-size: 14px; margin: 30px 0 0 0; color: #888; line-height: 1.6;">
                          If you have any questions, please contact us at support@joinaccord.app
                        </p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding: 30px; text-align: center;">
                  <p style="font-size: 13px; color: #888; margin: 0;">© 2025 Accord. All rights reserved.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  const text = `Hi ${recipientName},

${message}

What you need to do:
1. Open the Accord app
2. You'll see a verification prompt
3. Follow the steps to ${isIdentityRequired ? 'verify your identity' : 'upload new photos'}

Your profile will be hidden from discovery until verification is complete.

If you have any questions, please contact us at support@joinaccord.app

- The Accord Team`;

  return { html, text };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Create Supabase client with SERVICE_ROLE_KEY for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify the requesting user is authenticated
    const authHeader = req.headers.get('Authorization')!;
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Verify user is an admin
    const { data: adminProfile, error: adminError } = await supabaseAdmin
      .from('profiles')
      .select('is_admin, id')
      .eq('user_id', user.id)
      .single();

    if (adminError || !adminProfile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    // Get request payload
    const payload: ReportActionPayload = await req.json();
    console.log('[Admin Report Action] Processing:', payload.action, 'for profile:', payload.reported_profile_id);

    let profileUpdateResult = null;
    let reportUpdateResult = null;

    switch (payload.action) {
      case 'photo_review':
        // Flag the profile for photo review - hides from discovery
        console.log('[Admin Report Action] Setting photo_review_required = true');
        const { error: photoReviewError } = await supabaseAdmin
          .from('profiles')
          .update({
            photo_review_required: true,
            photo_review_reason: `${payload.reason}: ${payload.details || 'Photo review required'}`,
            photo_review_requested_at: new Date().toISOString(),
          })
          .eq('id', payload.reported_profile_id);

        if (photoReviewError) {
          console.error('[Admin Report Action] Failed to flag for photo review:', photoReviewError);
          throw photoReviewError;
        }
        profileUpdateResult = { photo_review_required: true };
        console.log('[Admin Report Action] ✓ Profile flagged for photo review');
        break;

      case 'verify_identity':
        // Flag for identity verification - also hides from discovery
        console.log('[Admin Report Action] Requiring identity verification');
        const { error: verifyError } = await supabaseAdmin
          .from('profiles')
          .update({
            photo_verified: false,
            photo_verification_status: 'admin_required',
            is_verified: false,
            photo_review_required: true,
            photo_review_reason: `Identity verification required: ${payload.reason}`,
            photo_review_requested_at: new Date().toISOString(),
          })
          .eq('id', payload.reported_profile_id);

        if (verifyError) {
          console.error('[Admin Report Action] Failed to require verification:', verifyError);
          throw verifyError;
        }
        profileUpdateResult = { verification_required: true, photo_review_required: true };
        console.log('[Admin Report Action] ✓ Profile flagged for identity verification');
        break;

      case 'warn':
        // Send a warning notification (profile stays visible)
        console.log('[Admin Report Action] Sending warning to user');
        // Just update the report status - notification is handled separately
        profileUpdateResult = { warned: true };
        break;

      case 'dismiss':
        // Just dismiss the report, no profile changes
        console.log('[Admin Report Action] Dismissing report');
        profileUpdateResult = { dismissed: true };
        break;

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
    }

    // Send push notification and email for photo_review and verify_identity actions
    if (payload.action === 'photo_review' || payload.action === 'verify_identity') {
      const isIdentityRequired = payload.action === 'verify_identity';

      // Get the user's profile info (display_name and user_id for email lookup)
      const { data: targetProfile, error: profileFetchError } = await supabaseAdmin
        .from('profiles')
        .select('display_name, user_id')
        .eq('id', payload.reported_profile_id)
        .single();

      if (profileFetchError) {
        console.error('[Admin Report Action] Failed to fetch target profile:', profileFetchError);
      } else {
        const displayName = targetProfile.display_name || 'there';
        const notificationTitle = isIdentityRequired ? 'Identity Verification Required' : 'Photo Verification Required';
        const notificationBody = isIdentityRequired
          ? 'Please verify your identity to continue using Accord. Open the app to get started.'
          : 'Please verify your photos to continue using Accord. Open the app to get started.';

        // 1. Add push notification to queue
        const { error: notifError } = await supabaseAdmin
          .from('notification_queue')
          .insert({
            recipient_profile_id: payload.reported_profile_id,
            notification_type: 'photo_verification_required',
            title: notificationTitle,
            body: notificationBody,
            data: {
              type: 'photo_verification_required',
              isIdentityRequired,
              screen: 'profile',
            },
            status: 'pending',
          });

        if (notifError) {
          console.error('[Admin Report Action] Failed to queue push notification:', notifError);
        } else {
          console.log('[Admin Report Action] ✓ Push notification queued');
        }

        // 2. Send email notification
        try {
          // Get user email from auth.users
          const { data: { user: targetUser }, error: userError } = await supabaseAdmin.auth.admin.getUserById(targetProfile.user_id);

          if (userError || !targetUser?.email) {
            console.error('[Admin Report Action] Failed to get user email:', userError);
          } else {
            const { html, text } = generatePhotoVerificationEmail(displayName, isIdentityRequired);
            const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

            if (!RESEND_API_KEY) {
              console.error('[Admin Report Action] Resend API key not configured');
            } else {
              const emailResponse = await fetch('https://api.resend.com/emails', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                  from: 'Accord <hello@news.joinaccord.app>',
                  to: [targetUser.email],
                  subject: notificationTitle,
                  html,
                  text,
                }),
              });

              if (!emailResponse.ok) {
                const emailError = await emailResponse.json();
                console.error('[Admin Report Action] Failed to send email:', emailError);
              } else {
                console.log('[Admin Report Action] ✓ Email sent to', targetUser.email);
              }
            }
          }
        } catch (emailError) {
          console.error('[Admin Report Action] Email error:', emailError);
        }
      }
    }

    // Mark ALL pending reports for this profile as resolved
    const newStatus = payload.action === 'dismiss' ? 'dismissed' : 'resolved';
    const { error: reportError, count: resolvedCount } = await supabaseAdmin
      .from('reports')
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminProfile.id,
      })
      .eq('reported_profile_id', payload.reported_profile_id)
      .eq('status', 'pending');

    if (reportError) {
      console.error('[Admin Report Action] Failed to update reports:', reportError);
      throw reportError;
    }

    reportUpdateResult = { status: newStatus, count: resolvedCount };
    console.log(`[Admin Report Action] ✓ Updated ${resolvedCount || 0} report(s) to ${newStatus}`);

    return new Response(JSON.stringify({
      success: true,
      action: payload.action,
      profile_update: profileUpdateResult,
      reports_updated: reportUpdateResult,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('[Admin Report Action] Error:', error);
    return new Response(JSON.stringify({
      error: 'Failed to execute action',
      details: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
