import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WaitlistRecord {
  email: string;
  created_at?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, type } = await req.json()

    // Get MailerLite API key from environment
    const MAILERLITE_API_KEY = Deno.env.get('MAILERLITE_API_KEY')
    if (!MAILERLITE_API_KEY) {
      throw new Error('MailerLite API key not configured')
    }

    console.log(`Syncing ${email} to MailerLite (type: ${type || 'waitlist'})`)

    // Determine which group to add to
    const groupId = type === 'user'
      ? Deno.env.get('MAILERLITE_USERS_GROUP_ID')
      : Deno.env.get('MAILERLITE_WAITLIST_GROUP_ID')

    // Add subscriber to MailerLite
    const mailerLiteResponse = await fetch('https://connect.mailerlite.com/api/subscribers', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MAILERLITE_API_KEY}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        email,
        groups: groupId ? [groupId] : undefined,
        fields: {
          source: type || 'waitlist',
          signup_date: new Date().toISOString()
        },
        status: 'active' // active, unsubscribed, unconfirmed, bounced, or junk
      })
    })

    const responseData = await mailerLiteResponse.json()

    if (!mailerLiteResponse.ok) {
      console.error('MailerLite error:', responseData)

      // If subscriber already exists, that's ok
      if (mailerLiteResponse.status === 422 && responseData.message?.includes('already exists')) {
        console.log('Subscriber already exists in MailerLite - skipping')
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Subscriber already exists',
            data: responseData
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
          }
        )
      }

      throw new Error(`MailerLite API error: ${JSON.stringify(responseData)}`)
    }

    console.log('Successfully synced to MailerLite:', responseData)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Successfully synced to MailerLite',
        data: responseData
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error) {
    console.error('Error syncing to MailerLite:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
