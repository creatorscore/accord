import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { signPhotoUrls } from '@/lib/signed-urls';

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
    photos: { url: string; storage_path?: string | null; is_primary: boolean }[];
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

export function useActivityFeed(profileId: string | null, _userId?: string | null): UseActivityFeedReturn {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  if (__DEV__) {
    console.log('🔔 useActivityFeed called with profileId:', profileId);
  }

  // Group activities by time period (memoized to avoid recomputing on every render)
  const groupedActivities: GroupedActivities = useMemo(() => {
    const groups: GroupedActivities = { today: [], yesterday: [], thisWeek: [], earlier: [] };
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);

    activities.forEach((activity) => {
      const activityDate = new Date(activity.created_at);
      if (activityDate >= todayStart) {
        groups.today.push(activity);
      } else if (activityDate >= yesterdayStart) {
        groups.yesterday.push(activity);
      } else if (activityDate >= weekStart) {
        groups.thisWeek.push(activity);
      } else {
        groups.earlier.push(activity);
      }
    });
    return groups;
  }, [activities]);

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

        // Fetch activities with actor profile info (encryption keys only fetched in chat context)
        const { data, error: fetchError } = await supabase
          .from('activity_feed')
          .select(
            `
            *,
            actor:profiles!activity_feed_actor_profile_id_fkey (
              id,
              display_name,
              photos (url, storage_path, is_primary),
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

        // Batch sign all photo URLs at once (avoid N+1 sequential signing)
        const allPhotos: { url: string; storage_path?: string }[] = [];
        const photoIndexMap: { activityIdx: number; photoIdx: number }[] = [];
        for (let i = 0; i < newActivities.length; i++) {
          const photos = newActivities[i].actor?.photos;
          if (photos?.length) {
            for (let j = 0; j < photos.length; j++) {
              allPhotos.push(photos[j]);
              photoIndexMap.push({ activityIdx: i, photoIdx: j });
            }
          }
        }
        if (allPhotos.length > 0) {
          const signedPhotos = await signPhotoUrls(allPhotos);
          for (let k = 0; k < signedPhotos.length; k++) {
            const { activityIdx, photoIdx } = photoIndexMap[k];
            newActivities[activityIdx].actor.photos[photoIdx] = signedPhotos[k];
          }
        }

        // Message previews are not decrypted in the activity feed — encryption keys
        // are only fetched in the chat context to minimize key exposure surface

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
    [profileId, offset]
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
