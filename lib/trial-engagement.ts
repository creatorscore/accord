/**
 * Trial Engagement Tracking
 *
 * This module tracks user engagement during their premium trial period
 * to help demonstrate value and reduce churn. Used by:
 * - TrialValueSummary component (shows stats during trial)
 * - Trial engagement notifications (sends contextual reminders)
 */

import { supabase } from './supabase';

export interface TrialUsageStats {
  // When the trial started
  trialStartDate: Date | null;

  // Likes received during trial (premium feature to see who)
  likesReceivedCount: number;

  // Super likes sent during trial
  superLikesSent: number;

  // Matches made during trial
  matchesMade: number;

  // Messages sent during trial
  messagesSent: number;

  // Voice messages sent (premium feature)
  voiceMessagesSent: number;

  // Rewinds used (premium feature)
  rewindsUsed: number;

  // Days active during trial
  daysActive: number;
}

/**
 * Get trial usage statistics for a profile
 * Retrieves engagement metrics from the trial period to show value
 */
export async function getTrialUsageStats(profileId: string): Promise<TrialUsageStats> {
  try {
    // Get subscription info to determine trial start date
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('started_at, status')
      .eq('profile_id', profileId)
      .eq('status', 'trial')
      .single();

    if (subError && subError.code !== 'PGRST116') {
      console.error('Error fetching subscription:', subError);
    }

    const trialStartDate = subscription?.started_at ? new Date(subscription.started_at) : null;

    // If no trial, return empty stats
    if (!trialStartDate) {
      return {
        trialStartDate: null,
        likesReceivedCount: 0,
        superLikesSent: 0,
        matchesMade: 0,
        messagesSent: 0,
        voiceMessagesSent: 0,
        rewindsUsed: 0,
        daysActive: 0,
      };
    }

    // Fetch all stats in parallel for performance
    const [
      likesResult,
      superLikesResult,
      matchesResult,
      messagesResult,
      voiceMessagesResult,
    ] = await Promise.all([
      // Likes received during trial
      supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('liked_profile_id', profileId)
        .gte('created_at', trialStartDate.toISOString()),

      // Super likes sent during trial
      supabase
        .from('likes')
        .select('id', { count: 'exact', head: true })
        .eq('liker_profile_id', profileId)
        .eq('like_type', 'super')
        .gte('created_at', trialStartDate.toISOString()),

      // Matches made during trial
      supabase
        .from('matches')
        .select('id', { count: 'exact', head: true })
        .or(`profile1_id.eq.${profileId},profile2_id.eq.${profileId}`)
        .gte('matched_at', trialStartDate.toISOString()),

      // Messages sent during trial
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_profile_id', profileId)
        .gte('created_at', trialStartDate.toISOString()),

      // Voice messages sent during trial
      supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('sender_profile_id', profileId)
        .eq('content_type', 'voice')
        .gte('created_at', trialStartDate.toISOString()),
    ]);

    // Calculate days active (simplified - just count days since trial started)
    const now = new Date();
    const daysSinceStart = Math.floor(
      (now.getTime() - trialStartDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const daysActive = Math.min(daysSinceStart + 1, 7); // Cap at 7 days (trial length)

    return {
      trialStartDate,
      likesReceivedCount: likesResult.count || 0,
      superLikesSent: superLikesResult.count || 0,
      matchesMade: matchesResult.count || 0,
      messagesSent: messagesResult.count || 0,
      voiceMessagesSent: voiceMessagesResult.count || 0,
      rewindsUsed: 0, // TODO: Track rewinds if we add a rewinds table
      daysActive,
    };
  } catch (error) {
    console.error('Error fetching trial usage stats:', error);
    return {
      trialStartDate: null,
      likesReceivedCount: 0,
      superLikesSent: 0,
      matchesMade: 0,
      messagesSent: 0,
      voiceMessagesSent: 0,
      rewindsUsed: 0,
      daysActive: 0,
    };
  }
}

/**
 * Get the count of people who liked this user (for teaser display)
 * Returns count without revealing who (that's a premium feature)
 */
export async function getPendingLikesCount(profileId: string): Promise<number> {
  try {
    // Get likes that haven't turned into matches yet
    const { data: likes, error } = await supabase
      .from('likes')
      .select(
        `
        id,
        liker_profile_id,
        created_at
      `
      )
      .eq('liked_profile_id', profileId);

    if (error) {
      console.error('Error fetching pending likes:', error);
      return 0;
    }

    if (!likes || likes.length === 0) {
      return 0;
    }

    // Get existing matches to exclude already-matched likes
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select('profile1_id, profile2_id')
      .or(`profile1_id.eq.${profileId},profile2_id.eq.${profileId}`);

    if (matchError) {
      console.error('Error fetching matches:', matchError);
      return likes.length;
    }

    // Create set of matched profile IDs
    const matchedProfileIds = new Set<string>();
    matches?.forEach((match) => {
      if (match.profile1_id === profileId) {
        matchedProfileIds.add(match.profile2_id);
      } else {
        matchedProfileIds.add(match.profile1_id);
      }
    });

    // Filter out likes from already-matched profiles
    const pendingLikes = likes.filter((like) => !matchedProfileIds.has(like.liker_profile_id));

    return pendingLikes.length;
  } catch (error) {
    console.error('Error fetching pending likes count:', error);
    return 0;
  }
}

/**
 * Get trial day number (1-7) for engagement notification scheduling
 */
export function getTrialDayNumber(trialStartDate: Date | null): number {
  if (!trialStartDate) return 0;

  const now = new Date();
  const daysSinceStart = Math.floor(
    (now.getTime() - trialStartDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  return Math.min(daysSinceStart + 1, 7); // 1-indexed, capped at 7
}

/**
 * Format trial stats for display in notifications
 */
export function formatTrialStatsForNotification(stats: TrialUsageStats): string {
  const highlights: string[] = [];

  if (stats.likesReceivedCount > 0) {
    highlights.push(
      `${stats.likesReceivedCount} ${stats.likesReceivedCount === 1 ? 'person' : 'people'} liked you`
    );
  }

  if (stats.superLikesSent > 0) {
    highlights.push(
      `sent ${stats.superLikesSent} Super ${stats.superLikesSent === 1 ? 'Like' : 'Likes'}`
    );
  }

  if (stats.matchesMade > 0) {
    highlights.push(`made ${stats.matchesMade} ${stats.matchesMade === 1 ? 'match' : 'matches'}`);
  }

  if (stats.voiceMessagesSent > 0) {
    highlights.push(`sent ${stats.voiceMessagesSent} voice messages`);
  }

  if (highlights.length === 0) {
    return 'Start exploring premium features today!';
  }

  if (highlights.length === 1) {
    return `You've ${highlights[0]} during your trial!`;
  }

  const lastHighlight = highlights.pop();
  return `You've ${highlights.join(', ')} and ${lastHighlight} during your trial!`;
}
