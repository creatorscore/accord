import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BanEmailPayload {
  email: string;
  displayName: string;
  banReason: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin status
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.is_admin) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    const payload: BanEmailPayload = await req.json();

    // Validate payload
    if (!payload.email || !payload.displayName || !payload.banReason) {
      return new Response(JSON.stringify({ error: 'Email, display name, and ban reason are required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Get Resend API key from environment
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('Resend API key not configured - ban email not sent');
      return new Response(JSON.stringify({
        success: false,
        error: 'Email service not configured',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Accord <hello@joinaccord.app>',
        to: [payload.email],
        subject: 'Your Accord Account Has Been Restricted',
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #9B87CE 0%, #B8A9DD 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Account Restricted</h1>
            </div>

            <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Hello ${payload.displayName},</p>

              <p style="font-size: 16px; margin-bottom: 20px;">
                Your Accord account has been restricted from accessing our platform. This action was taken to maintain the safety and integrity of our community.
              </p>

              <div style="background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; font-weight: 600; color: #92400E;">Reason for restriction:</p>
                <p style="margin: 5px 0 0 0; color: #78350F;">${payload.banReason}</p>
              </div>

              <p style="font-size: 16px; margin-bottom: 20px;">
                As a result of this restriction:
              </p>

              <ul style="font-size: 16px; margin-bottom: 20px; padding-left: 20px;">
                <li>You will no longer be able to access your account</li>
                <li>Your profile has been removed from discovery</li>
                <li>You cannot create a new account with this email or device</li>
              </ul>

              <p style="font-size: 16px; margin-bottom: 20px;">
                If you believe this restriction was made in error, please contact our support team at
                <a href="mailto:hello@joinaccord.app" style="color: #9B87CE; text-decoration: none;">hello@joinaccord.app</a>
                with a detailed explanation. We review all appeals carefully.
              </p>

              <p style="font-size: 16px; margin-bottom: 20px;">
                We take the safety of our community seriously and appreciate your understanding.
              </p>

              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">

              <p style="font-size: 14px; color: #666; text-align: center; margin: 0;">
                Accord - Safe Connections for Meaningful Partnerships<br>
                <a href="https://joinaccord.app" style="color: #9B87CE; text-decoration: none;">joinaccord.app</a>
              </p>
            </div>
          </body>
          </html>
        `,
        text: `Hello ${payload.displayName},

Your Accord account has been restricted from accessing our platform. This action was taken to maintain the safety and integrity of our community.

Reason for restriction: ${payload.banReason}

As a result of this restriction:
• You will no longer be able to access your account
• Your profile has been removed from discovery
• You cannot create a new account with this email or device

If you believe this restriction was made in error, please contact our support team at hello@joinaccord.app with a detailed explanation. We review all appeals carefully.

We take the safety of our community seriously and appreciate your understanding.

---
Accord - Safe Connections for Meaningful Partnerships
joinaccord.app`,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error('Resend API error:', emailData);
      throw new Error(`Email send failed: ${JSON.stringify(emailData)}`);
    }

    console.log('Ban email sent successfully:', emailData);

    return new Response(JSON.stringify({
      success: true,
      message: 'Ban email sent successfully',
      data: emailData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error: any) {
    console.error('Error sending ban email:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
