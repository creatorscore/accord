// Edge Function: Check Expiring Matches
// Runs on cron schedule to check for matches expiring soon
// Sends notifications at 5 days, 3 days, and 1 day before expiration

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface Match {
  id: string
  profile1_id: string
  profile2_id: string
  expires_at: string
  notified_5_days: boolean
  notified_3_days: boolean
  notified_1_day: boolean
}

interface Profile {
  id: string
  display_name: string
}

serve(async (req) => {
  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const now = new Date()

    // Calculate threshold dates for each notification window
    const fiveDaysFromNow = new Date(now.getTime() + (5 * 24 * 60 * 60 * 1000))
    const threeDaysFromNow = new Date(now.getTime() + (3 * 24 * 60 * 60 * 1000))
    const oneDayFromNow = new Date(now.getTime() + (24 * 60 * 60 * 1000))

    // 4.5 days from now (start of 5-day window)
    const fiveDayWindowStart = new Date(now.getTime() + (4.5 * 24 * 60 * 60 * 1000))
    // 2.5 days from now (start of 3-day window)
    const threeDayWindowStart = new Date(now.getTime() + (2.5 * 24 * 60 * 60 * 1000))
    // 23 hours from now (start of 1-day window)
    const oneDayWindowStart = new Date(now.getTime() + (23 * 60 * 60 * 1000))

    let totalNotifications = 0
    let fiveDayCount = 0
    let threeDayCount = 0
    let oneDayCount = 0

    // Query for matches that need notifications
    const { data: expiringMatches, error: matchError } = await supabase
      .from('matches')
      .select('id, profile1_id, profile2_id, expires_at, notified_5_days, notified_3_days, notified_1_day')
      .eq('status', 'active')
      .is('first_message_sent_at', null) // No message sent yet
      .not('expires_at', 'is', null) // Has expiration set
      .gt('expires_at', now.toISOString()) // Not yet expired

    if (matchError) {
      throw matchError
    }

    if (!expiringMatches || expiringMatches.length === 0) {
      console.log('No expiring matches found')
      return new Response(
        JSON.stringify({ message: 'No expiring matches', processed: 0 }),
        { headers: { 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log(`Checking ${expiringMatches.length} expiring matches...`)

    // Process each match
    for (const match of expiringMatches as Match[]) {
      const expiresAt = new Date(match.expires_at)

      // Get both profile names for personalized messages
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', [match.profile1_id, match.profile2_id])

      if (!profiles || profiles.length !== 2) continue

      const profile1 = profiles.find((p: Profile) => p.id === match.profile1_id)
      const profile2 = profiles.find((p: Profile) => p.id === match.profile2_id)

      if (!profile1 || !profile2) continue

      // Check 5-day notification
      if (!match.notified_5_days && expiresAt >= fiveDayWindowStart && expiresAt <= fiveDaysFromNow) {
        // Send to both users
        await queueNotification(supabase, match.profile1_id, profile2.display_name, 5, match.id)
        await queueNotification(supabase, match.profile2_id, profile1.display_name, 5, match.id)

        // Mark as notified
        await supabase
          .from('matches')
          .update({ notified_5_days: true })
          .eq('id', match.id)

        fiveDayCount += 2
        totalNotifications += 2
      }
      // Check 3-day notification
      else if (!match.notified_3_days && expiresAt >= threeDayWindowStart && expiresAt <= threeDaysFromNow) {
        // Send to both users
        await queueNotification(supabase, match.profile1_id, profile2.display_name, 3, match.id)
        await queueNotification(supabase, match.profile2_id, profile1.display_name, 3, match.id)

        // Mark as notified
        await supabase
          .from('matches')
          .update({ notified_3_days: true })
          .eq('id', match.id)

        threeDayCount += 2
        totalNotifications += 2
      }
      // Check 1-day notification
      else if (!match.notified_1_day && expiresAt >= oneDayWindowStart && expiresAt <= oneDayFromNow) {
        // Send to both users
        await queueNotification(supabase, match.profile1_id, profile2.display_name, 1, match.id)
        await queueNotification(supabase, match.profile2_id, profile1.display_name, 1, match.id)

        // Mark as notified
        await supabase
          .from('matches')
          .update({ notified_1_day: true })
          .eq('id', match.id)

        oneDayCount += 2
        totalNotifications += 2
      }
    }

    console.log(`Queued ${totalNotifications} notifications (5-day: ${fiveDayCount}, 3-day: ${threeDayCount}, 1-day: ${oneDayCount})`)

    return new Response(
      JSON.stringify({
        message: 'Expiring match check complete',
        totalNotifications,
        breakdown: {
          fiveDays: fiveDayCount,
          threeDays: threeDayCount,
          oneDay: oneDayCount
        }
      }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error in check-expiring-matches function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function queueNotification(
  supabase: any,
  recipientProfileId: string,
  otherPersonName: string,
  daysRemaining: number,
  matchId: string
) {
  const title = daysRemaining === 1
    ? '⏰ Match expires in 24 hours!'
    : `⏰ Match expires in ${daysRemaining} days`

  const body = daysRemaining === 1
    ? `Your match with ${otherPersonName} expires tomorrow! Send a message now to keep the connection.`
    : `Your match with ${otherPersonName} expires in ${daysRemaining} days. Don't miss out - send a message!`

  await supabase
    .from('notification_queue')
    .insert({
      recipient_profile_id: recipientProfileId,
      notification_type: 'match_expiring',
      title,
      body,
      data: {
        type: 'match_expiring',
        match_id: matchId,
        days_remaining: daysRemaining,
        screen: 'matches'
      },
      status: 'pending',
      attempts: 0
    })
}
