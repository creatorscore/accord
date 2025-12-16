// Edge Function: Process Notification Queue
// This function is triggered by a cron job every minute to process pending notifications
// Optimized for high throughput using Expo's batch API (up to 100 per request)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Process up to 1000 notifications per run
// Expo allows batches of 100, so we'll send 10 batch requests
const BATCH_SIZE = 100
const MAX_NOTIFICATIONS = 1000

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
  id: string
  push_token: string | null
  push_enabled: boolean
}

interface ExpoMessage {
  to: string
  sound: string
  title: string
  body: string
  data: any
  priority: string
  badge: number
}

serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get pending notifications
    const { data: notifications, error: fetchError } = await supabase
      .from('notification_queue')
      .select('*')
      .eq('status', 'pending')
      .lt('attempts', 3)
      .order('created_at', { ascending: true })
      .limit(MAX_NOTIFICATIONS)

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

    // Get all unique profile IDs
    const profileIds = [...new Set(notifications.map((n: NotificationQueueItem) => n.recipient_profile_id))]

    // Batch fetch all profiles at once
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, push_token, push_enabled')
      .in('id', profileIds)

    if (profilesError) {
      throw profilesError
    }

    // Create a map for quick profile lookup
    const profileMap = new Map<string, Profile>()
    for (const profile of (profiles || [])) {
      profileMap.set(profile.id, profile as Profile)
    }

    let successCount = 0
    let failureCount = 0
    let skippedCount = 0

    // Prepare notifications for batch sending
    const toSend: { notification: NotificationQueueItem; message: ExpoMessage }[] = []
    const toSkip: { id: string; reason: string }[] = []
    const toFail: { id: string; error: string; attempts: number }[] = []

    for (const notification of notifications as NotificationQueueItem[]) {
      const profile = profileMap.get(notification.recipient_profile_id)

      if (!profile) {
        toFail.push({ id: notification.id, error: 'Profile not found', attempts: notification.attempts })
        continue
      }

      if (!profile.push_enabled || !profile.push_token) {
        toSkip.push({ id: notification.id, reason: 'Notifications disabled or no token' })
        continue
      }

      toSend.push({
        notification,
        message: {
          to: profile.push_token,
          sound: 'default',
          title: notification.title,
          body: notification.body,
          data: notification.data || {},
          priority: 'high',
          badge: 1,
        }
      })
    }

    // Send notifications in batches of 100 (Expo's limit)
    const sendBatches: Promise<void>[] = []

    for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
      const batch = toSend.slice(i, i + BATCH_SIZE)
      const messages = batch.map(b => b.message)

      sendBatches.push((async () => {
        try {
          const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              Accept: 'application/json',
              'Accept-Encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
          })

          const result = await response.json()
          const results = result.data || []

          // Process results - Expo returns array in same order as sent
          const successIds: string[] = []
          const failedUpdates: { id: string; error: string; attempts: number }[] = []

          for (let j = 0; j < batch.length; j++) {
            const notification = batch[j].notification
            const ticketResult = results[j]

            if (ticketResult?.status === 'error') {
              failedUpdates.push({
                id: notification.id,
                error: ticketResult.message || 'Unknown error',
                attempts: notification.attempts
              })
              failureCount++
            } else {
              successIds.push(notification.id)
              successCount++
            }
          }

          // Batch update successful notifications
          if (successIds.length > 0) {
            await supabase
              .from('notification_queue')
              .update({
                status: 'sent',
                processed_at: new Date().toISOString(),
                attempts: supabase.rpc ? undefined : 1 // Will be handled below
              })
              .in('id', successIds)

            // Increment attempts for all - wrapped in try/catch since RPC may not exist
            try {
              await supabase.rpc('increment_notification_attempts', { notification_ids: successIds })
            } catch {
              // If RPC doesn't exist, that's ok - we already updated status
            }
          }

          // Batch update failed notifications
          for (const failed of failedUpdates) {
            await supabase
              .from('notification_queue')
              .update({
                status: failed.attempts + 1 >= 3 ? 'failed' : 'pending',
                error: failed.error,
                attempts: failed.attempts + 1
              })
              .eq('id', failed.id)
          }
        } catch (error) {
          console.error('Batch send error:', error)
          // Mark all in this batch as failed
          for (const item of batch) {
            await supabase
              .from('notification_queue')
              .update({
                status: item.notification.attempts + 1 >= 3 ? 'failed' : 'pending',
                error: error.message,
                attempts: item.notification.attempts + 1
              })
              .eq('id', item.notification.id)
            failureCount++
          }
        }
      })())
    }

    // Wait for all batches to complete
    await Promise.all(sendBatches)

    // Handle skipped notifications (no token/disabled)
    if (toSkip.length > 0) {
      const skipIds = toSkip.map(s => s.id)
      await supabase
        .from('notification_queue')
        .update({
          status: 'sent',
          processed_at: new Date().toISOString()
        })
        .in('id', skipIds)
      skippedCount = toSkip.length
    }

    // Handle failed notifications (no profile)
    for (const failed of toFail) {
      await supabase
        .from('notification_queue')
        .update({
          status: 'failed',
          error: failed.error,
          processed_at: new Date().toISOString(),
          attempts: failed.attempts + 1
        })
        .eq('id', failed.id)
      failureCount++
    }

    console.log(`Processed: ${notifications.length}, Sent: ${successCount}, Skipped: ${skippedCount}, Failed: ${failureCount}`)

    return new Response(
      JSON.stringify({
        message: 'Notification processing complete',
        processed: notifications.length,
        sent: successCount,
        skipped: skippedCount,
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
