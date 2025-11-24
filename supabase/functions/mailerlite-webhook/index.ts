import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const webhookData = await req.json()

    console.log('Received MailerLite webhook:', JSON.stringify(webhookData, null, 2))

    const { events } = webhookData

    if (!events || !Array.isArray(events)) {
      console.log('No events in webhook payload')
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Process each event
    for (const event of events) {
      const { type, data } = event
      const email = data?.subscriber?.email

      if (!email) {
        console.log('No email in event, skipping')
        continue
      }

      console.log(`Processing ${type} for ${email}`)

      switch (type) {
        case 'subscriber.unsubscribed':
          // Mark as unsubscribed in waitlist table
          const { data: waitlistUnsubData } = await supabase
            .from('waitlist')
            .update({
              notified: true,
              unsubscribed_at: new Date().toISOString()
            })
            .eq('email', email)

          // Also update profiles table for registered users
          // First get user_id from auth.users by email
          const { data: authUser } = await supabase.auth.admin.listUsers()
          const user = authUser.users.find(u => u.email === email)

          if (user) {
            await supabase
              .from('profiles')
              .update({
                email_unsubscribed_at: new Date().toISOString()
              })
              .eq('user_id', user.id)

            console.log(`Marked ${email} as unsubscribed in profiles`)
          }

          console.log(`Marked ${email} as unsubscribed in waitlist`)
          break

        case 'subscriber.bounced':
          // Mark bounced emails in waitlist
          await supabase
            .from('waitlist')
            .update({
              bounced: true,
              bounced_at: new Date().toISOString()
            })
            .eq('email', email)

          // Also update profiles table for registered users
          const { data: authUserBounce } = await supabase.auth.admin.listUsers()
          const userBounce = authUserBounce.users.find(u => u.email === email)

          if (userBounce) {
            await supabase
              .from('profiles')
              .update({
                email_bounced: true,
                email_bounced_at: new Date().toISOString()
              })
              .eq('user_id', userBounce.id)

            console.log(`Marked ${email} as bounced in profiles`)
          }

          console.log(`Marked ${email} as bounced in waitlist`)
          break

        case 'subscriber.spam_complaint':
          // Flag spam complaints in waitlist
          await supabase
            .from('waitlist')
            .update({
              spam_complaint: true,
              spam_complaint_at: new Date().toISOString()
            })
            .eq('email', email)

          // Also update profiles table for registered users
          const { data: authUserSpam } = await supabase.auth.admin.listUsers()
          const userSpam = authUserSpam.users.find(u => u.email === email)

          if (userSpam) {
            await supabase
              .from('profiles')
              .update({
                email_spam_complaint: true,
                email_spam_complaint_at: new Date().toISOString()
              })
              .eq('user_id', userSpam.id)

            console.log(`Marked ${email} as spam complaint in profiles`)
          }

          console.log(`Marked ${email} as spam complaint in waitlist`)
          break

        default:
          console.log(`Unhandled event type: ${type}`)
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error processing webhook:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
