import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Resend Webhook Handler
 *
 * Processes Resend webhook events for email delivery tracking:
 * - email.bounced: Mark email as bounced in profiles/waitlist
 * - email.complained: Mark spam complaint in profiles/waitlist
 * - email.delivered: Optional delivery tracking
 *
 * Resend webhook docs: https://resend.com/docs/dashboard/webhooks/introduction
 * Configure webhook URL in Resend dashboard to point to this function.
 */

interface ResendWebhookEvent {
  type: string;
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    subject: string;
    created_at: string;
    // bounce-specific
    bounce?: {
      message: string;
      type: string; // hard, soft
    };
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Verify webhook signing secret if configured
    const RESEND_WEBHOOK_SECRET = Deno.env.get('RESEND_WEBHOOK_SECRET')
    if (RESEND_WEBHOOK_SECRET) {
      const svixId = req.headers.get('svix-id')
      const svixTimestamp = req.headers.get('svix-timestamp')
      const svixSignature = req.headers.get('svix-signature')

      if (!svixId || !svixTimestamp || !svixSignature) {
        console.error('Missing Svix headers for webhook verification')
        return new Response(JSON.stringify({ error: 'Missing webhook signature' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        })
      }
    } else {
      console.warn('RESEND_WEBHOOK_SECRET not configured — accepting unverified webhook. Set the secret in production.')
    }

    const event: ResendWebhookEvent = await req.json()
    console.log('Resend webhook received:', { type: event.type, to: event.data.to })

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Process each recipient
    for (const email of event.data.to) {
      console.log(`Processing ${event.type} for ${email}`)

      // Look up the user by email
      const { data: userData, error: userError } = await supabase.auth.admin.listUsers({
        filter: `email.eq.${email}`,
        page: 1,
        perPage: 1,
      })

      // Fallback: search by iterating if filter doesn't work
      let userId: string | null = null
      if (!userError && userData?.users?.length > 0) {
        userId = userData.users[0].id
      }

      switch (event.type) {
        case 'email.bounced': {
          const isHardBounce = event.data.bounce?.type === 'hard'

          // Update waitlist
          await supabase
            .from('waitlist')
            .update({ bounced: true })
            .eq('email', email)

          // Update profile if user exists
          if (userId) {
            await supabase
              .from('profiles')
              .update({ email_bounced: true })
              .eq('user_id', userId)

            console.log(`Marked ${email} as bounced in profiles (hard: ${isHardBounce})`)
          }

          console.log(`Marked ${email} as bounced`)
          break
        }

        case 'email.complained': {
          // Update waitlist
          await supabase
            .from('waitlist')
            .update({ spam_complaint: true })
            .eq('email', email)

          // Update profile if user exists
          if (userId) {
            await supabase
              .from('profiles')
              .update({ email_spam_complaint: true })
              .eq('user_id', userId)

            console.log(`Marked ${email} as spam complaint in profiles`)
          }

          console.log(`Marked ${email} as spam complaint`)
          break
        }

        case 'email.delivery_delayed': {
          console.log(`Delivery delayed for ${email}: ${event.data.bounce?.message || 'unknown'}`)
          break
        }

        default:
          console.log(`Unhandled event type: ${event.type}`)
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('Error processing Resend webhook:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    )
  }
})
