import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Email template for unread messages reminder - Mobile responsive
function generateUnreadMessagesEmail(
  recipientName: string,
  unreadCount: number,
  senderNames: string[]
): { html: string; text: string } {
  const senderList = senderNames.slice(0, 3).join(', ');
  const andMore = senderNames.length > 3 ? ` and ${senderNames.length - 3} more` : '';

  const html = `
    <!DOCTYPE html>
    <html lang="en" xmlns:v="urn:schemas-microsoft-com:vml">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <meta name="x-apple-disable-message-reformatting">
      <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
      <title>You Have Unread Messages!</title>
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
        You have ${unreadCount} unread message${unreadCount > 1 ? 's' : ''} from ${senderList}${andMore}. Don't leave them hanging!
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
                  <div style="font-size: 56px; line-height: 1;">💬</div>
                  <h1 style="color: white; margin: 15px 0 0 0; font-size: 28px; font-weight: 700; line-height: 1.2;">You Have Unread Messages!</h1>
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
                          You have <strong style="color: #9B87CE;">${unreadCount} unread message${unreadCount > 1 ? 's' : ''}</strong>
                          waiting for you from:
                        </p>

                        <!-- Message Preview Box -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                          <tr>
                            <td style="background: linear-gradient(135deg, #F3E8FF 0%, #EDE9FE 100%); border-radius: 12px; padding: 25px;">
                              ${senderNames.map(name => `
                                <div style="background: white; border-radius: 8px; padding: 15px; margin-bottom: 10px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                  <p style="font-size: 15px; color: #6B21A8; margin: 0; font-weight: 600;">
                                    💬 ${name}
                                  </p>
                                  <p style="font-size: 13px; color: #666; margin: 5px 0 0 0;">
                                    sent you a message
                                  </p>
                                </div>
                              `).join('')}
                              ${senderNames.length > 3 ? `
                                <div style="text-align: center; padding: 10px;">
                                  <p style="font-size: 14px; color: #6B21A8; margin: 0; font-weight: 500;">
                                    and ${senderNames.length - 3} more...
                                  </p>
                                </div>
                              ` : ''}
                              <p style="font-size: 15px; color: #6B21A8; margin: 15px 0 0 0; font-weight: 500; text-align: center; line-height: 1.4;">
                                Open the Accord app on your phone to reply!
                              </p>
                            </td>
                          </tr>
                        </table>

                        <!-- Tip Box -->
                        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-top: 25px;">
                          <tr>
                            <td style="background: #ECFDF5; border-radius: 10px; padding: 18px;">
                              <p style="font-size: 14px; color: #047857; margin: 0; line-height: 1.5;">
                                <strong>Did you know?</strong> Responding within 24 hours increases your chances of building a meaningful connection by 3x!
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
                          You're receiving this because you have unread messages on Accord.<br>
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

You Have Unread Messages! 💬

You have ${unreadCount} unread message${unreadCount > 1 ? 's' : ''} waiting for you from:

${senderNames.slice(0, 5).map(name => `💬 ${name} sent you a message`).join('\n')}${senderNames.length > 5 ? `\n...and ${senderNames.length - 5} more` : ''}

Open the Accord app on your phone to reply!

Did you know? Responding within 24 hours increases your chances of building a meaningful connection by 3x!

---
You're receiving this because you have unread messages on Accord.
To manage email preferences, open the Accord app and go to Settings > Notifications

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

    // Find users with unread messages older than 2 hours but less than 48 hours
    // This gives users time to see push notifications first
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // Get unread messages grouped by receiver
    const { data: unreadMessages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        receiver_profile_id,
        sender_profile_id,
        created_at,
        sender:profiles!messages_sender_profile_id_fkey(display_name)
      `)
      .is('read_at', null)
      .lt('created_at', twoHoursAgo)
      .gt('created_at', fortyEightHoursAgo)
      .order('created_at', { ascending: false });

    if (messagesError) {
      console.error('Error fetching unread messages:', messagesError);
      throw messagesError;
    }

    if (!unreadMessages || unreadMessages.length === 0) {
      console.log('No unread messages to notify about');
      return new Response(
        JSON.stringify({ success: true, message: 'No unread messages' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Group by receiver
    const messagesByReceiver = new Map<string, { count: number; senderNames: Set<string> }>();

    for (const msg of unreadMessages) {
      const receiverId = msg.receiver_profile_id;
      const senderName = (msg.sender as any)?.display_name || 'Someone';

      if (!messagesByReceiver.has(receiverId)) {
        messagesByReceiver.set(receiverId, { count: 0, senderNames: new Set() });
      }

      const data = messagesByReceiver.get(receiverId)!;
      data.count++;
      data.senderNames.add(senderName);
    }

    // Get profile and user info for each receiver
    const receiverIds = Array.from(messagesByReceiver.keys());

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, user_id, display_name')
      .in('id', receiverIds);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      throw profilesError;
    }

    // Get user emails
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw usersError;
    }

    const results = [];

    // Send emails to each user with unread messages
    for (const profile of profiles || []) {
      const userData = messagesByReceiver.get(profile.id);
      if (!userData) continue;

      const user = users.users.find(u => u.id === profile.user_id);
      if (!user?.email) {
        console.log(`No email for user ${profile.user_id}`);
        continue;
      }

      const { html, text } = generateUnreadMessagesEmail(
        profile.display_name || 'there',
        userData.count,
        Array.from(userData.senderNames)
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
            emailType: 'unread_messages',
            recipientEmail: user.email,
            recipientName: profile.display_name || 'there',
            subject: `💬 You have ${userData.count} unread message${userData.count > 1 ? 's' : ''} on Accord`,
            htmlContent: html,
            textContent: text,
          }),
        }
      );

      const result = await response.json();
      results.push({ email: user.email, count: userData.count, result });
      console.log(`Unread messages email to ${user.email}:`, result);
    }

    return new Response(
      JSON.stringify({ success: true, emailsSent: results.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error in email-unread-messages:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
