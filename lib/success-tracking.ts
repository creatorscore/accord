/**
 * Success Tracking Utilities
 * Helper functions to record success events (dates, marriages, etc.)
 */

import { supabase } from './supabase';

export type SuccessEventType =
  | 'first_message_sent'
  | 'first_message_received'
  | 'date_scheduled'
  | 'date_completed'
  | 'marriage_arranged'
  | 'relationship_ended';

interface RecordEventParams {
  profileId: string;
  matchId: string;
  eventType: SuccessEventType;
  eventData?: Record<string, any>;
}

/**
 * Record a success event
 * This calls the database function to track milestones
 */
export async function recordSuccessEvent({
  profileId,
  matchId,
  eventType,
  eventData = {},
}: RecordEventParams): Promise<{ success: boolean; eventId?: string; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('record_success_event', {
      p_profile_id: profileId,
      p_match_id: matchId,
      p_event_type: eventType,
      p_event_data: eventData,
    });

    if (error) {
      console.error('Error recording success event:', error);
      return { success: false, error: error.message };
    }

    return { success: true, eventId: data };
  } catch (error: any) {
    console.error('Error recording success event:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Record a date being scheduled
 */
export async function recordDateScheduled(
  profileId: string,
  matchId: string,
  dateInfo: {
    scheduledFor?: string; // ISO date string
    location?: string;
    notes?: string;
  }
): Promise<{ success: boolean }> {
  const result = await recordSuccessEvent({
    profileId,
    matchId,
    eventType: 'date_scheduled',
    eventData: dateInfo,
  });

  return { success: result.success };
}

/**
 * Record a date being completed
 */
export async function recordDateCompleted(
  profileId: string,
  matchId: string,
  feedback?: {
    rating?: number; // 1-5
    wentWell?: boolean;
    notes?: string;
  }
): Promise<{ success: boolean }> {
  const result = await recordSuccessEvent({
    profileId,
    matchId,
    eventType: 'date_completed',
    eventData: feedback,
  });

  return { success: result.success };
}

/**
 * Record a marriage being arranged
 */
export async function recordMarriageArranged(
  profileId: string,
  matchId: string,
  marriageInfo: {
    marriageDate?: string; // ISO date string
    location?: string;
    type?: 'civil' | 'religious' | 'both';
    notes?: string;
  }
): Promise<{ success: boolean }> {
  const result = await recordSuccessEvent({
    profileId,
    matchId,
    eventType: 'marriage_arranged',
    eventData: marriageInfo,
  });

  return { success: result.success };
}

/**
 * Get user's own success stats
 */
export async function getUserSuccessStats(profileId: string): Promise<{
  success: boolean;
  stats?: {
    totalMatches: number;
    totalMessages: number;
    totalDates: number;
    totalMarriages: number;
    matchRate: number;
    responseRate: number;
  };
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('profile_success_stats')
      .select('*')
      .eq('profile_id', profileId)
      .single();

    if (error) {
      console.error('Error fetching success stats:', error);
      return { success: false, error: error.message };
    }

    return {
      success: true,
      stats: {
        totalMatches: data.total_matches || 0,
        totalMessages: data.total_messages_sent + data.total_messages_received || 0,
        totalDates: data.total_dates_scheduled || 0,
        totalMarriages: data.total_marriages_arranged || 0,
        matchRate: data.match_rate || 0,
        responseRate: data.response_rate || 0,
      },
    };
  } catch (error: any) {
    console.error('Error fetching success stats:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update user's last active timestamp
 * Call this when app opens or user performs significant actions
 */
export async function updateLastActive(profileId: string): Promise<void> {
  try {
    await supabase
      .from('profiles')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', profileId);

    // Also update in profile_success_stats
    await supabase
      .from('profile_success_stats')
      .update({
        last_active_at: new Date().toISOString(),
        total_sessions: supabase.rpc('increment_sessions', { profile_id: profileId }),
      })
      .eq('profile_id', profileId);
  } catch (error) {
    console.error('Error updating last active:', error);
  }
}

/**
 * Track a swipe action (for engagement metrics)
 */
export async function trackSwipe(profileId: string): Promise<void> {
  try {
    await supabase.rpc('increment', {
      table_name: 'profile_success_stats',
      column_name: 'total_swipes',
      row_id: profileId,
    });
  } catch (error) {
    console.error('Error tracking swipe:', error);
  }
}
