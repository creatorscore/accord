// Edge Function: Process Notification Queue
// This function is triggered by a cron job every minute to process pending notifications
// Optimized for high throughput using Expo's batch API (up to 100 per request)
// NOW WITH: Push receipt verification and automatic stale token cleanup

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

interface DeviceToken {
  profile_id: string
  push_token: string
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

interface ExpoPushTicket {
  status: 'ok' | 'error'
  id?: string // Ticket ID for checking receipt later
  message?: string
  details?: {
    error?: string
  }
}

interface ExpoPushReceipt {
  status: 'ok' | 'error'
  message?: string
  details?: {
    error?: string
  }
}

/**
 * Remove invalid push tokens from database
 * Called when we get DeviceNotRegistered error
 */
async function removeInvalidToken(supabase: any, token: string): Promise<void> {
  console.log(`🗑️ Removing invalid token: ${token.substring(0, 30)}...`)

  try {
    // Remove from device_tokens table
    const { error: deviceError } = await supabase
      .from('device_tokens')
      .delete()
      .eq('push_token', token)

    if (deviceError) {
      console.error('Error removing from device_tokens:', deviceError)
    }

    // Clear from profiles table if it matches
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ push_token: null })
      .eq('push_token', token)

    if (profileError) {
      console.error('Error clearing from profiles:', profileError)
    }

    console.log(`✅ Removed invalid token from database`)
  } catch (error) {
    console.error('Error removing invalid token:', error)
  }
}

/**
 * Check push receipts for a batch of ticket IDs
 * Returns map of token -> error type (if any)
 */
async function checkPushReceipts(
  ticketIds: string[],
  ticketToTokenMap: Map<string, string>
): Promise<Map<string, string>> {
  const invalidTokens = new Map<string, string>()

  if (ticketIds.length === 0) return invalidTokens

  try {
    // Wait a bit for receipts to be available
    await new Promise(resolve => setTimeout(resolve, 1000))

    const response = await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ids: ticketIds }),
    })

    const result = await response.json()

    if (result.data) {
      for (const [ticketId, receipt] of Object.entries(result.data)) {
        const pushReceipt = receipt as ExpoPushReceipt
        if (pushReceipt.status === 'error') {
          const token = ticketToTokenMap.get(ticketId)
          if (token && pushReceipt.details?.error === 'DeviceNotRegistered') {
            console.log(`❌ DeviceNotRegistered for ticket ${ticketId}`)
            invalidTokens.set(token, 'DeviceNotRegistered')
          }
        }
      }
    }
  } catch (error) {
    console.error('Error checking push receipts:', error)
  }

  return invalidTokens
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

    // ALSO fetch device_tokens for multi-device support
    // This catches tokens that may not be in profiles.push_token
    const { data: deviceTokens, error: deviceTokensError } = await supabase
      .from('device_tokens')
      .select('profile_id, push_token')
      .in('profile_id', profileIds)

    if (deviceTokensError) {
      console.error('Error fetching device tokens:', deviceTokensError)
      // Continue anyway - we still have profiles.push_token as fallback
    }

    // Create a map of profile_id -> all push tokens (from both sources)
    const tokenMap = new Map<string, Set<string>>()

    // Add tokens from device_tokens table
    for (const dt of (deviceTokens || []) as DeviceToken[]) {
      if (!tokenMap.has(dt.profile_id)) {
        tokenMap.set(dt.profile_id, new Set())
      }
      tokenMap.get(dt.profile_id)!.add(dt.push_token)
    }

    // Add tokens from profiles.push_token (legacy, ensures backward compat)
    for (const profile of (profiles || [])) {
      if (profile.push_token) {
        if (!tokenMap.has(profile.id)) {
          tokenMap.set(profile.id, new Set())
        }
        tokenMap.get(profile.id)!.add(profile.push_token)
      }
    }

    let successCount = 0
    let failureCount = 0
    let skippedCount = 0
    let invalidTokensRemoved = 0

    // Prepare notifications for batch sending
    const toSend: { notification: NotificationQueueItem; message: ExpoMessage; token: string }[] = []
    const toSkip: { id: string; reason: string }[] = []
    const toFail: { id: string; error: string; attempts: number }[] = []

    for (const notification of notifications as NotificationQueueItem[]) {
      const profile = profileMap.get(notification.recipient_profile_id)

      if (!profile) {
        toFail.push({ id: notification.id, error: 'Profile not found', attempts: notification.attempts })
        continue
      }

      if (!profile.push_enabled) {
        toSkip.push({ id: notification.id, reason: 'Notifications disabled' })
        continue
      }

      // Get ALL tokens for this user (from both device_tokens and profiles.push_token)
      const tokens = tokenMap.get(notification.recipient_profile_id)

      if (!tokens || tokens.size === 0) {
        toSkip.push({ id: notification.id, reason: 'No push tokens found' })
        continue
      }

      // Send to ALL devices for this user (multi-device support)
      for (const token of tokens) {
        toSend.push({
          notification,
          token,
          message: {
            to: token,
            sound: 'default',
            title: notification.title,
            body: notification.body,
            data: notification.data || {},
            priority: 'high',
            badge: 1,
          }
        })
      }
    }

    // Track ticket IDs for receipt verification
    const allTicketIds: string[] = []
    const ticketToTokenMap = new Map<string, string>()

    // Send notifications in batches of 100 (Expo's limit)
    for (let i = 0; i < toSend.length; i += BATCH_SIZE) {
      const batch = toSend.slice(i, i + BATCH_SIZE)
      const messages = batch.map(b => b.message)

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
        const tickets = (result.data || []) as ExpoPushTicket[]

        // Process tickets - Expo returns array in same order as sent
        const successIds = new Set<string>()
        const failedUpdates: { id: string; error: string; attempts: number }[] = []
        const tokensToRemove: string[] = []

        for (let j = 0; j < batch.length; j++) {
          const notification = batch[j].notification
          const token = batch[j].token
          const ticket = tickets[j]

          if (ticket?.status === 'error') {
            // Check for DeviceNotRegistered error - token is invalid, remove it
            if (ticket.details?.error === 'DeviceNotRegistered') {
              console.log(`❌ DeviceNotRegistered error for token: ${token.substring(0, 30)}...`)
              tokensToRemove.push(token)
            }

            // Only count notification as failed if ALL devices failed
            if (!successIds.has(notification.id)) {
              failedUpdates.push({
                id: notification.id,
                error: ticket.message || 'Unknown error',
                attempts: notification.attempts
              })
            }
            failureCount++
          } else if (ticket?.status === 'ok') {
            successIds.add(notification.id)
            successCount++

            // Track ticket ID for later receipt verification
            if (ticket.id) {
              allTicketIds.push(ticket.id)
              ticketToTokenMap.set(ticket.id, token)
            }
          }
        }

        // Remove invalid tokens immediately
        for (const token of tokensToRemove) {
          await removeInvalidToken(supabase, token)
          invalidTokensRemoved++
        }

        // Batch update successful notifications
        const successIdArray = Array.from(successIds)
        if (successIdArray.length > 0) {
          await supabase
            .from('notification_queue')
            .update({
              status: 'sent',
              processed_at: new Date().toISOString(),
            })
            .in('id', successIdArray)
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
      } catch (error: any) {
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
    }

    // CRITICAL: Check push receipts after a delay to catch DeviceNotRegistered errors
    // that only appear in receipts (not in initial ticket response)
    if (allTicketIds.length > 0) {
      console.log(`Checking ${allTicketIds.length} push receipts for delivery errors...`)

      // Check receipts in batches of 1000 (Expo's limit)
      for (let i = 0; i < allTicketIds.length; i += 1000) {
        const ticketBatch = allTicketIds.slice(i, i + 1000)
        const invalidTokens = await checkPushReceipts(ticketBatch, ticketToTokenMap)

        // Remove any invalid tokens found in receipts
        for (const [token, error] of invalidTokens) {
          console.log(`❌ Receipt error (${error}) for token: ${token.substring(0, 30)}...`)
          await removeInvalidToken(supabase, token)
          invalidTokensRemoved++
        }
      }
    }

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

    console.log(`Processed: ${notifications.length}, Sent: ${successCount}, Skipped: ${skippedCount}, Failed: ${failureCount}, Invalid tokens removed: ${invalidTokensRemoved}`)

    return new Response(
      JSON.stringify({
        message: 'Notification processing complete',
        processed: notifications.length,
        sent: successCount,
        skipped: skippedCount,
        failed: failureCount,
        invalidTokensRemoved,
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('Error in process-notifications function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
