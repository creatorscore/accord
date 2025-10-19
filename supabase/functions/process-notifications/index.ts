// Edge Function: Process Notification Queue
// This function is triggered by a cron job every minute to process pending notifications

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface NotificationQueueItem {
  id: string
  recipient_profile_id: string
  notification_type: string
  title: string
  body: string
  data: any
  attempts: number
}

interface Profile {
  push_token: string | null
  push_enabled: boolean
}

serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get pending notifications (limit to 50 per run to avoid timeouts)
    const { data: notifications, error: fetchError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', 3) // Max 3 attempts
      .order('created_at', { ascending: true })
      .limit(50)

    if (fetchError) {
      throw fetchError
    }

    if (!notifications || notifications.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No pending notifications', processed: 0 }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log(`Processing ${notifications.length} notifications...`)

    let successCount = 0
    let failureCount = 0

    // Process each notification
    for (const notification of notifications as NotificationQueueItem[]) {
      try {
        // Get recipient's push token
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('push_token, push_enabled')
          .eq('id', notification.recipient_profile_id)
          .single()

        if (profileError || !profile) {
          console.error(`Profile not found for notification ${notification.id}`)
          // Mark as failed
          await supabase
            .from('notification_queue')
            .update({
              status: 'failed',
              error: 'Profile not found',
              processed_at: new Date().toISOString(),
              attempts: notification.attempts + 1
            })
            .eq('id', notification.id)
          failureCount++
          continue
        }

        const typedProfile = profile as Profile

        // Check if user has notifications enabled and has a push token
        if (!typedProfile.push_enabled || !typedProfile.push_token) {
          console.log(`User ${notification.recipient_profile_id} has notifications disabled or no token`)
          // Mark as sent (no point retrying)
          await supabase
            .from('notification_queue')
            .update({
              status: 'sent',
              processed_at: new Date().toISOString(),
              attempts: notification.attempts + 1
            })
            .eq('id', notification.id)
          successCount++
          continue
        }

        // Send push notification via Expo Push API
        const message = {
          to: typedProfile.push_token,
          sound: 'default',
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          priority: 'high',
          badge: 1,
        }

        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        })

        const result = await response.json()

        if (result.data?.status === 'error') {
          console.error(`Failed to send notification ${notification.id}:`, result.data.message)
          // Mark as failed, will retry
          await supabase
            .from('notification_queue')
            .update({
              status: notification.attempts + 1 >= 3 ? 'failed' : 'pending',
              error: result.data.message,
              attempts: notification.attempts + 1
            })
            .eq('id', notification.id)
          failureCount++
        } else {
          console.log(`Successfully sent notification ${notification.id}`)
          // Mark as sent
          await supabase
            .from('notification_queue')
            .update({
              status: 'sent',
              processed_at: new Date().toISOString(),
              attempts: notification.attempts + 1
            })
            .eq('id', notification.id)
          successCount++
        }
      } catch (error) {
        console.error(`Error processing notification ${notification.id}:`, error)
        // Mark as failed
        await supabase
          .from('notification_queue')
          .update({
            status: notification.attempts + 1 >= 3 ? 'failed' : 'pending',
            error: error.message,
            attempts: notification.attempts + 1
          })
          .eq('id', notification.id)
        failureCount++
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Notification processing complete',
        processed: notifications.length,
        success: successCount,
        failed: failureCount
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error in process-notifications function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
