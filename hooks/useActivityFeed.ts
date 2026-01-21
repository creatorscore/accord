import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { decryptMessage, getPrivateKey } from '@/lib/encryption';

export type ActivityType =
  | 'like_received'
  | 'super_like_received'
  | 'like_sent'
  | 'super_like_sent'
  | 'match'
  | 'message_received'
  | 'review_received'
  | 'profile_view'
  | 'verification_approved';

export interface ActivityItem {
  id: string;
  profile_id: string;
  activity_type: ActivityType;
  actor_profile_id: string | null;
  reference_id: string | null;
  metadata: Record<string, any>;
  is_read: boolean;
  created_at: string;
  actor?: {
    id: string;
    display_name: string;
    photos: { url: string; is_primary: boolean }[];
    encryption_public_key?: string;
  };
  decrypted_preview?: string; // Decrypted message preview for message_received type
}

export interface GroupedActivities {
  today: ActivityItem[];
  yesterday: ActivityItem[];
  thisWeek: ActivityItem[];
  earlier: ActivityItem[];
}

interface UseActivityFeedReturn {
  activities: ActivityItem[];
  groupedActivities: GroupedActivities;
  unreadCount: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  loadMore: () => Promise<void>;
  markAsRead: (activityId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  hasMore: boolean;
}

const PAGE_SIZE = 20;

export function useActivityFeed(profileId: string | null, userId?: string | null): UseActivityFeedReturn {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [privateKey, setPrivateKey] = useState<string | null>(null);

  if (__DEV__) {
    console.log('🔔 useActivityFeed called with profileId:', profileId);
  }

  // Fetch private key for decryption
  useEffect(() => {
    const fetchPrivateKey = async () => {
      if (!userId) return;
      try {
        const key = await getPrivateKey(userId);
        setPrivateKey(key);
      } catch (err) {
        console.error('Error fetching private key for activity feed:', err);
      }
    };
    fetchPrivateKey();
  }, [userId]);

  // Group activities by time period
  const groupedActivities: GroupedActivities = {
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: [],
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

  activities.forEach((activity) => {
    const activityDate = new Date(activity.created_at);
    if (activityDate >= todayStart) {
      groupedActivities.today.push(activity);
    } else if (activityDate >= yesterdayStart) {
      groupedActivities.yesterday.push(activity);
    } else if (activityDate >= weekStart) {
      groupedActivities.thisWeek.push(activity);
    } else {
      groupedActivities.earlier.push(activity);
    }
  });

  const fetchActivities = useCallback(
    async (isRefresh = false) => {
      if (__DEV__) {
        console.log('🔔 fetchActivities called', { profileId, isRefresh, offset });
      }

      if (!profileId) {
        if (__DEV__) {
          console.log('🔔 fetchActivities: No profileId, returning early');
        }
        setLoading(false);
        return;
      }

      try {
        if (isRefresh) {
          setRefreshing(true);
          setOffset(0);
        } else {
          setLoading(true);
        }
        setError(null);

        const currentOffset = isRefresh ? 0 : offset;

        if (__DEV__) {
          console.log('🔔 Fetching activities from offset:', currentOffset);
        }

        // Fetch activities with actor profile info (including encryption key for message decryption)
        const { data, error: fetchError } = await supabase
          .from('activity_feed')
          .select(
            `
            *,
            actor:profiles!activity_feed_actor_profile_id_fkey (
              id,
              display_name,
              photos (url, is_primary),
              encryption_public_key,
              photo_blur_enabled
            )
          `
          )
          .eq('profile_id', profileId)
          .order('created_at', { ascending: false })
          .range(currentOffset, currentOffset + PAGE_SIZE - 1);

        if (__DEV__) {
          console.log('🔔 Activity feed query result:', {
            dataLength: data?.length || 0,
            error: fetchError?.message,
            firstItem: data?.[0]
          });
        }

        if (fetchError) throw fetchError;

        let newActivities: ActivityItem[] = data || [];

        // Decrypt message previews for message_received activities
        if (privateKey) {
          newActivities = await Promise.all(
            newActivities.map(async (activity) => {
              if (
                activity.activity_type === 'message_received' &&
                activity.metadata?.preview &&
                activity.actor?.encryption_public_key
              ) {
                try {
                  // Check if preview looks encrypted (contains colon separator for iv:ciphertext:tag format)
                  const preview = activity.metadata.preview;
                  if (preview.includes(':')) {
                    const decrypted = await decryptMessage(
                      preview,
                      privateKey,
                      activity.actor.encryption_public_key
                    );
                    return { ...activity, decrypted_preview: decrypted };
                  }
                  // If not encrypted format, use as-is
                  return { ...activity, decrypted_preview: preview };
                } catch (err) {
                  console.error('Error decrypting activity preview:', err);
                  // Return activity without decrypted preview on error
                  return activity;
                }
              }
              return activity;
            })
          );
        }

        if (isRefresh) {
          setActivities(newActivities);
        } else if (currentOffset === 0) {
          setActivities(newActivities);
        } else {
          setActivities((prev) => [...prev, ...newActivities]);
        }

        setHasMore(newActivities.length === PAGE_SIZE);

        // Fetch unread count
        const { count } = await supabase
          .from('activity_feed')
          .select('*', { count: 'exact', head: true })
          .eq('profile_id', profileId)
          .eq('is_read', false);

        setUnreadCount(count || 0);
      } catch (err: any) {
        console.error('❌ Error fetching activities:', err);
        setError(err.message || 'Failed to load activities');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [profileId, offset, privateKey]
  );

  const refresh = useCallback(async () => {
    await fetchActivities(true);
  }, [fetchActivities]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setOffset((prev) => prev + PAGE_SIZE);
  }, [loading, hasMore]);

  const markAsRead = useCallback(
    async (activityId: string) => {
      if (!profileId) return;

      try {
        await supabase
          .from('activity_feed')
          .update({ is_read: true })
          .eq('id', activityId)
          .eq('profile_id', profileId);

        setActivities((prev) =>
          prev.map((a) => (a.id === activityId ? { ...a, is_read: true } : a))
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (err) {
        console.error('Error marking activity as read:', err);
      }
    },
    [profileId]
  );

  const markAllAsRead = useCallback(async () => {
    if (!profileId) return;

    try {
      await supabase
        .from('activity_feed')
        .update({ is_read: true })
        .eq('profile_id', profileId)
        .eq('is_read', false);

      setActivities((prev) => prev.map((a) => ({ ...a, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking all as read:', err);
    }
  }, [profileId]);

  // Initial fetch
  useEffect(() => {
    fetchActivities();
  }, [profileId]);

  // Refetch when offset changes
  useEffect(() => {
    if (offset > 0) {
      fetchActivities();
    }
  }, [offset]);

  return {
    activities,
    groupedActivities,
    unreadCount,
    loading,
    refreshing,
    error,
    refresh,
    loadMore,
    markAsRead,
    markAllAsRead,
    hasMore,
  };
}

// Hook to just get unread count (for badge)
export function useUnreadActivityCount(profileId: string | null): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!profileId) return;

    const fetchCount = async () => {
      const { count: unreadCount } = await supabase
        .from('activity_feed')
        .select('*', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .eq('is_read', false);

      setCount(unreadCount || 0);
    };

    fetchCount();

    // Subscribe to realtime updates
    const channel = supabase
      .channel(`activity_feed_${profileId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'activity_feed',
          filter: `profile_id=eq.${profileId}`,
        },
        () => {
          setCount((prev) => prev + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'activity_feed',
          filter: `profile_id=eq.${profileId}`,
        },
        () => {
          // Refetch count when activities are updated (e.g., marked as read)
          fetchCount();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [profileId]);

  return count;
}
