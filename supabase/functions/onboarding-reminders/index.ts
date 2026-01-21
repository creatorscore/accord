import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Reminder levels based on time since signup
type ReminderLevel = '24_hours' | '3_days' | '7_days';

function getReminderLevel(createdAt: Date): ReminderLevel | null {
  const now = new Date();
  const hoursSinceSignup = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60));

  // 7 days (168 hours) - final reminder
  if (hoursSinceSignup >= 168 && hoursSinceSignup < 192) return '7_days';
  // 3 days (72 hours)
  if (hoursSinceSignup >= 72 && hoursSinceSignup < 84) return '3_days';
  // 24 hours
  if (hoursSinceSignup >= 24 && hoursSinceSignup < 30) return '24_hours';

  return null; // Not in any reminder window
}

// Get friendly name for onboarding step
function getStepName(step: number): string {
  const steps: Record<number, string> = {
    0: 'basic information',
    1: 'about yourself',
    2: 'your interests',
    3: 'personality details',
    4: 'matching preferences',
    5: 'marriage preferences',
    6: 'profile photos',
    7: 'profile prompts',
    8: 'voice introduction',
    9: 'language settings',
  };
  return steps[step] || 'your profile';
}

// Email templates for different reminder levels
function generateOnboardingEmail(
  recipientName: string,
  level: ReminderLevel,
  onboardingStep: number,
  totalSteps: number = 10
): { html: string; text: string; subject: string } {
  const stepsRemaining = totalSteps - onboardingStep;
  const stepName = getStepName(onboardingStep);
  const progressPercent = Math.round((onboardingStep / totalSteps) * 100);

  const templates = {
    '24_hours': {
      emoji: '👋',
      headline: 'Finish Setting Up Your Profile',
      subheadline: "You're so close to finding meaningful connections!",
      urgency: 'low',
    },
    '3_days': {
      emoji: '💜',
      headline: "Don't Miss Out on Connections",
      subheadline: 'People are waiting to meet someone like you',
      urgency: 'medium',
    },
    '7_days': {
      emoji: '✨',
      headline: 'Your Perfect Match is Waiting',
      subheadline: "Complete your profile and start your journey",
      urgency: 'high',
    },
  };

  const template = templates[level];

  // Progress bar HTML
  const progressBar = `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0;">
      <tr>
        <td style="background: #E5E7EB; border-radius: 10px; height: 12px; overflow: hidden;">
          <div style="background: linear-gradient(135deg, #9B87CE 0%, #A08AB7 100%); width: ${progressPercent}%; height: 12px; border-radius: 10px;"></div>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 8px; text-align: center;">
          <span style="font-size: 14px; color: #666;">${progressPercent}% complete - ${stepsRemaining} ${stepsRemaining === 1 ? 'step' : 'steps'} remaining</span>
        </td>
      </tr>
    </table>
  `;

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
        }
      </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
      <!-- Preview text -->
      <div style="display: none; max-height: 0; overflow: hidden;">
        ${template.subheadline}. You're ${progressPercent}% done with your profile!
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

                        <p style="font-size: 16px; margin: 0 0 20px 0; color: #555; line-height: 1.6;">
                          You started creating your Accord profile but haven't finished yet.
                          Complete your profile to start discovering people who share your values and goals.
                        </p>

                        <!-- Progress Bar -->
                        ${progressBar}

                        <p style="font-size: 16px; margin: 25px 0; color: #555; line-height: 1.6;">
                          <strong>Next step:</strong> Add ${stepName}
                        </p>

                        <!-- CTA Box -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="background: linear-gradient(135deg, #F3E8FF 0%, #EDE9FE 100%); border-radius: 12px; padding: 25px; text-align: center;">
                              <div style="background: white; border-radius: 8px; padding: 20px; margin-bottom: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                <p style="font-size: 18px; color: #6B21A8; margin: 0 0 5px 0; font-weight: 700;">
                                  ${template.emoji} ${progressPercent}% Complete
                                </p>
                                <p style="font-size: 14px; color: #666; margin: 0;">
                                  ${stepsRemaining} ${stepsRemaining === 1 ? 'step' : 'steps'} remaining
                                </p>
                              </div>
                              <p style="font-size: 15px; color: #6B21A8; margin: 0; font-weight: 500; line-height: 1.4;">
                                Open the Accord app on your phone to complete your profile!
                              </p>
                            </td>
                          </tr>
                        </table>

                        <!-- Benefits Box -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 25px;">
                          <tr>
                            <td style="background: #F0FDF4; border-radius: 10px; padding: 18px;">
                              <p style="font-size: 14px; color: #166534; margin: 0; line-height: 1.6;">
                                <strong>Why complete your profile?</strong><br>
                                Complete profiles get 5x more matches and are shown to more people in discovery.
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
                          You're receiving this because you started signing up for Accord.<br>
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

You started creating your Accord profile but haven't finished yet. Complete your profile to start discovering people who share your values and goals.

Progress: ${progressPercent}% complete - ${stepsRemaining} ${stepsRemaining === 1 ? 'step' : 'steps'} remaining

Next step: Add ${stepName}

${template.emoji} ${progressPercent}% Complete
${stepsRemaining} ${stepsRemaining === 1 ? 'step' : 'steps'} remaining

Open the Accord app on your phone to complete your profile!

Why complete your profile?
Complete profiles get 5x more matches and are shown to more people in discovery.

---
You're receiving this because you started signing up for Accord.
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

    // Find users who signed up but haven't completed onboarding
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Get incomplete profiles created in the last 7 days (but at least 24 hours ago)
    // Only include active users (is_active = true means not banned/deactivated)
    const { data: incompleteProfiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, user_id, display_name, onboarding_step, created_at')
      .eq('profile_complete', false)
      .lt('created_at', twentyFourHoursAgo)
      .gt('created_at', sevenDaysAgo)
      .eq('is_active', true)
      .order('created_at', { ascending: true })
      .limit(100);

    if (profilesError) {
      console.error('Error fetching incomplete profiles:', profilesError);
      throw profilesError;
    }

    if (!incompleteProfiles || incompleteProfiles.length === 0) {
      console.log('No incomplete profiles to notify');
      return new Response(
        JSON.stringify({ success: true, message: 'No incomplete profiles' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${incompleteProfiles.length} incomplete profiles`);

    // Get user emails
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    const results = [];

    for (const profile of incompleteProfiles) {
      const createdAt = new Date(profile.created_at);
      const level = getReminderLevel(createdAt);

      if (!level) {
        continue; // Not in a reminder window
      }

      const user = users.users.find(u => u.id === profile.user_id);
      if (!user?.email) {
        console.log(`No email for user ${profile.user_id}`);
        continue;
      }

      const { html, text, subject } = generateOnboardingEmail(
        profile.display_name || 'there',
        level,
        profile.onboarding_step || 0
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
            emailType: 'onboarding_reminder',
            recipientEmail: user.email,
            recipientName: profile.display_name || 'there',
            subject,
            htmlContent: html,
            textContent: text,
          }),
        }
      );

      const result = await response.json();
      results.push({
        email: user.email,
        level,
        onboardingStep: profile.onboarding_step,
        result
      });
      console.log(`Onboarding reminder (${level}) to ${user.email}:`, result);
    }

    return new Response(
      JSON.stringify({ success: true, emailsSent: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error in onboarding-reminders:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
