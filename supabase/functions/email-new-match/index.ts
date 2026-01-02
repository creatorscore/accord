import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MatchPayload {
  type: 'INSERT';
  table: 'matches';
  record: {
    id: string;
    profile1_id: string;
    profile2_id: string;
    matched_at: string;
  };
}

// Email template for new match - Mobile responsive
function generateMatchEmail(recipientName: string, matchName: string): { html: string; text: string } {
  const html = `
    <!DOCTYPE html>
    <html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="x-apple-disable-message-reformatting">
      <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
      <title>It's a Match!</title>
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
        You and ${matchName} have matched on Accord! Start a conversation now.
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
                  <div style="font-size: 56px; line-height: 1;">💜</div>
                  <h1 style="color: white; margin: 15px 0 0 0; font-size: 28px; font-weight: 700; line-height: 1.2;">It's a Match!</h1>
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
                          Great news! You and <strong style="color: #9B87CE;">${matchName}</strong> have matched on Accord.
                          This could be the beginning of something meaningful.
                        </p>

                        <!-- CTA Box -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="background: linear-gradient(135deg, #F3E8FF 0%, #EDE9FE 100%); border-radius: 12px; padding: 25px; text-align: center;">
                              <p style="font-size: 15px; color: #6B21A8; margin: 0 0 15px 0; font-weight: 500; line-height: 1.4;">
                                Don't keep them waiting!
                              </p>
                              <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center">
                                <tr>
                                  <td style="border-radius: 50px; background: linear-gradient(135deg, #9B87CE 0%, #A08AB7 100%); box-shadow: 0 4px 15px rgba(155, 135, 206, 0.4);">
                                    <a href="accord://matches" target="_blank" style="display: inline-block; padding: 16px 40px; font-size: 16px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 50px; min-width: 200px; text-align: center;">
                                      Start a Conversation
                                    </a>
                                  </td>
                                </tr>
                              </table>
                            </td>
                          </tr>
                        </table>

                        <!-- Tip Box -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 25px;">
                          <tr>
                            <td style="background: #FEF3C7; border-radius: 10px; padding: 18px;">
                              <p style="font-size: 14px; color: #92400E; margin: 0; line-height: 1.5;">
                                <strong>Tip:</strong> The first message matters! Ask about something specific from their profile to show you're genuinely interested.
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
                          You're receiving this because you matched with someone on Accord.<br>
                          <a href="accord://settings/notifications" style="color: #9B87CE; text-decoration: none;">Manage email preferences</a>
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

It's a Match! 💜

Great news! You and ${matchName} have matched on Accord. This could be the beginning of something meaningful.

Don't keep them waiting - start a conversation now!

Open Accord: accord://matches

Tip: The first message matters! Ask about something specific from their profile to show you're genuinely interested.

---
You're receiving this because you matched with someone on Accord.
Manage email preferences: accord://settings/notifications

Accord - Safe Connections for Meaningful Partnerships
joinaccord.app`;

  return { html, text };
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

    // This function is called by a database webhook when a new match is created
    const payload: MatchPayload = await req.json();

    if (!payload.record) {
      return new Response(
        JSON.stringify({ error: 'No match record provided' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { profile1_id, profile2_id } = payload.record;

    // Get both profiles with their user emails
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, user_id, display_name')
      .in('id', [profile1_id, profile2_id]);

    if (profilesError || !profiles || profiles.length !== 2) {
      console.error('Error fetching profiles:', profilesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch profiles' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const profile1 = profiles.find(p => p.id === profile1_id)!;
    const profile2 = profiles.find(p => p.id === profile2_id)!;

    // Get user emails from auth.users
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch user emails' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const user1 = users.users.find(u => u.id === profile1.user_id);
    const user2 = users.users.find(u => u.id === profile2.user_id);

    if (!user1?.email || !user2?.email) {
      console.error('Missing email for one or both users');
      return new Response(
        JSON.stringify({ error: 'Missing user emails' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Prepare email content for both users
    const emailsToSend = [
      {
        userId: profile1.user_id,
        email: user1.email,
        name: profile1.display_name || 'there',
        matchName: profile2.display_name || 'Someone special',
      },
      {
        userId: profile2.user_id,
        email: user2.email,
        name: profile2.display_name || 'there',
        matchName: profile1.display_name || 'Someone special',
      },
    ];

    const results = [];

    // Send emails to both matched users
    for (const recipient of emailsToSend) {
      const { html, text } = generateMatchEmail(recipient.name, recipient.matchName);

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
            userId: recipient.userId,
            emailType: 'new_match',
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            subject: `💜 It's a Match! You connected with ${recipient.matchName}`,
            htmlContent: html,
            textContent: text,
          }),
        }
      );

      const result = await response.json();
      results.push({ email: recipient.email, result });
      console.log(`Match email to ${recipient.email}:`, result);
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error in email-new-match:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
