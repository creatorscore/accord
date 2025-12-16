import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Email types that can be sent
type EmailType = 'new_match' | 'unread_messages' | 'inactive_reminder' | 'weekly_digest' | 'onboarding_reminder';

interface SendEmailPayload {
  userId: string;
  emailType: EmailType;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  metadata?: Record<string, any>;
}

// Check if user has opted out of this email type
async function checkEmailPreferences(
  supabase: any,
  userId: string,
  emailType: EmailType
): Promise<boolean> {
  const { data: prefs, error } = await supabase
    .from('email_preferences')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error) {
    console.log('No email preferences found, allowing email');
    return true; // Default to allowing if no preferences exist
  }

  // Check the specific email type preference
  switch (emailType) {
    case 'new_match':
      return prefs.match_notifications ?? true;
    case 'unread_messages':
      return prefs.message_notifications ?? true;
    case 'inactive_reminder':
      return prefs.inactive_reminders ?? true;
    case 'weekly_digest':
      return prefs.weekly_digest ?? true;
    case 'onboarding_reminder':
      return prefs.onboarding_reminders ?? true;
    default:
      return true;
  }
}

// Check if we've already sent this type of email recently
async function checkEmailCooldown(
  supabase: any,
  userId: string,
  emailType: EmailType
): Promise<boolean> {
  // Define cooldown periods for each email type
  const cooldownHours: Record<EmailType, number> = {
    new_match: 0, // No cooldown for match emails
    unread_messages: 24, // Max one per day
    inactive_reminder: 72, // Max one every 3 days
    weekly_digest: 168, // Weekly
    onboarding_reminder: 48, // Max one every 2 days
  };

  const cooldownMs = cooldownHours[emailType] * 60 * 60 * 1000;
  const cooldownDate = new Date(Date.now() - cooldownMs);

  const { data: recentEmail, error } = await supabase
    .from('email_logs')
    .select('id')
    .eq('user_id', userId)
    .eq('email_type', emailType)
    .eq('status', 'sent')
    .gte('sent_at', cooldownDate.toISOString())
    .limit(1)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('Error checking email cooldown:', error);
    return true; // Allow on error
  }

  // If we found a recent email, cooldown is active (should NOT send)
  return !recentEmail;
}

// Log the email send attempt
async function logEmailSend(
  supabase: any,
  userId: string,
  emailType: EmailType,
  recipientEmail: string,
  subject: string,
  status: 'sent' | 'failed' | 'skipped',
  resendId?: string,
  errorMessage?: string
): Promise<void> {
  await supabase.from('email_logs').insert({
    user_id: userId,
    email_type: emailType,
    recipient_email: recipientEmail,
    subject,
    status,
    resend_id: resendId,
    error_message: errorMessage,
    sent_at: status === 'sent' ? new Date().toISOString() : null,
  });
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

    const payload: SendEmailPayload = await req.json();

    // Validate payload
    if (!payload.userId || !payload.emailType || !payload.recipientEmail || !payload.subject) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Check if user has opted out
    const canSend = await checkEmailPreferences(supabase, payload.userId, payload.emailType);
    if (!canSend) {
      console.log(`User ${payload.userId} has opted out of ${payload.emailType} emails`);
      await logEmailSend(
        supabase,
        payload.userId,
        payload.emailType,
        payload.recipientEmail,
        payload.subject,
        'skipped',
        undefined,
        'User opted out'
      );
      return new Response(
        JSON.stringify({ success: false, reason: 'user_opted_out' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check cooldown (except for new match which has no cooldown)
    const cooldownOk = await checkEmailCooldown(supabase, payload.userId, payload.emailType);
    if (!cooldownOk) {
      console.log(`Cooldown active for ${payload.emailType} email to user ${payload.userId}`);
      await logEmailSend(
        supabase,
        payload.userId,
        payload.emailType,
        payload.recipientEmail,
        payload.subject,
        'skipped',
        undefined,
        'Cooldown active'
      );
      return new Response(
        JSON.stringify({ success: false, reason: 'cooldown_active' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get Resend API key
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) {
      console.error('Resend API key not configured');
      await logEmailSend(
        supabase,
        payload.userId,
        payload.emailType,
        payload.recipientEmail,
        payload.subject,
        'failed',
        undefined,
        'Resend API key not configured'
      );
      return new Response(
        JSON.stringify({ error: 'Email service not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Accord <hello@mail.joinaccord.app>',
        to: [payload.recipientEmail],
        subject: payload.subject,
        html: payload.htmlContent,
        text: payload.textContent,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error('Resend API error:', emailData);
      await logEmailSend(
        supabase,
        payload.userId,
        payload.emailType,
        payload.recipientEmail,
        payload.subject,
        'failed',
        undefined,
        JSON.stringify(emailData)
      );
      throw new Error(`Email send failed: ${JSON.stringify(emailData)}`);
    }

    // Log successful send
    await logEmailSend(
      supabase,
      payload.userId,
      payload.emailType,
      payload.recipientEmail,
      payload.subject,
      'sent',
      emailData.id
    );

    console.log(`Email sent successfully to ${payload.recipientEmail}:`, emailData);

    return new Response(
      JSON.stringify({ success: true, resendId: emailData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error('Error sending email:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
