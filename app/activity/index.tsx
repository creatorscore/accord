import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useActivityFeed, ActivityItem as ActivityItemType } from '@/hooks/useActivityFeed';
import ActivityItem from '@/components/activity/ActivityItem';
import UnmatchModal from '@/components/moderation/UnmatchModal';
import { supabase } from '@/lib/supabase';

// Interface for unmatch modal state
interface UnmatchTarget {
  matchId: string;
  actorProfileId: string;
  actorName: string;
}

export default function ActivityScreen() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isPremium, isPlatinum } = useSubscription();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [unmatchTarget, setUnmatchTarget] = useState<UnmatchTarget | null>(null);

  // Fetch user's profile ID from database
  useEffect(() => {
    const fetchProfileId = async () => {
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setProfileId(data.id);
      }
    };

    fetchProfileId();
  }, [user]);

  const {
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
  } = useActivityFeed(profileId, user?.id);

  // Check if user has premium access (from SubscriptionContext which handles admin logic)
  const hasPremium = isPremium || isPlatinum;

  const handleActivityPress = useCallback(
    (activity: ActivityItemType) => {
      if (!activity.is_read) {
        markAsRead(activity.id);
      }
    },
    [markAsRead]
  );

  const handleUnmatch = useCallback((activity: ActivityItemType) => {
    if (activity.reference_id && activity.actor_profile_id) {
      setUnmatchTarget({
        matchId: activity.reference_id,
        actorProfileId: activity.actor_profile_id,
        actorName: activity.actor?.display_name || 'this person',
      });
    }
  }, []);

  const handleUnmatchSuccess = useCallback(() => {
    setUnmatchTarget(null);
    // Refresh the activity feed to reflect the change
    refresh();
  }, [refresh]);

  const renderSectionHeader = (title: string, items: ActivityItemType[]) => {
    if (items.length === 0) return null;
    return (
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionCount}>{items.length}</Text>
      </View>
    );
  };

  const renderActivityItem = ({ item }: { item: ActivityItemType }) => (
    <ActivityItem activity={item} onPress={() => handleActivityPress(item)} />
  );

  // Build flat list data with section headers
  const buildListData = () => {
    const data: { type: 'header' | 'item'; title?: string; count?: number; item?: ActivityItemType }[] = [];

    if (groupedActivities.today.length > 0) {
      data.push({ type: 'header', title: t('activity.today'), count: groupedActivities.today.length });
      groupedActivities.today.forEach((item) => data.push({ type: 'item', item }));
    }

    if (groupedActivities.yesterday.length > 0) {
      data.push({ type: 'header', title: t('activity.yesterday'), count: groupedActivities.yesterday.length });
      groupedActivities.yesterday.forEach((item) => data.push({ type: 'item', item }));
    }

    if (groupedActivities.thisWeek.length > 0) {
      data.push({ type: 'header', title: t('activity.thisWeek'), count: groupedActivities.thisWeek.length });
      groupedActivities.thisWeek.forEach((item) => data.push({ type: 'item', item }));
    }

    if (groupedActivities.earlier.length > 0) {
      data.push({ type: 'header', title: t('activity.earlier'), count: groupedActivities.earlier.length });
      groupedActivities.earlier.forEach((item) => data.push({ type: 'item', item }));
    }

    return data;
  };

  const listData = buildListData();

  // Premium gate
  if (!hasPremium) {
    return (
      <>
        <Stack.Screen
          options={{
            title: t('activity.title'),
            headerShown: true,
            headerBackTitle: t('activity.back'),
            headerLeft: () => (
              <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
              </TouchableOpacity>
            ),
          }}
        />
        <SafeAreaView style={styles.container} edges={['bottom']}>
          <View style={styles.premiumGate}>
            <View style={styles.premiumIconContainer}>
              <MaterialCommunityIcons name="bell-ring" size={48} color="#A08AB7" />
            </View>
            <Text style={styles.premiumTitle}>{t('activity.premiumTitle')}</Text>
            <Text style={styles.premiumDescription}>
              {t('activity.premiumDescription')}
            </Text>
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => router.push('/settings/subscription')}
            >
              <MaterialCommunityIcons name="crown" size={20} color="white" />
              <Text style={styles.upgradeButtonText}>{t('activity.upgradeToPremium')}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: t('activity.title'),
          headerShown: true,
          headerBackTitle: t('activity.back'),
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
            </TouchableOpacity>
          ),
          headerRight: () =>
            unreadCount > 0 ? (
              <TouchableOpacity onPress={markAllAsRead} style={styles.markAllButton}>
                <Text style={styles.markAllText}>{t('activity.markAllRead')}</Text>
              </TouchableOpacity>
            ) : null,
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {loading && listData.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#A08AB7" />
            <Text style={styles.loadingText}>{t('activity.loading')}</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={refresh}>
              <Text style={styles.retryButtonText}>{t('activity.tryAgain')}</Text>
            </TouchableOpacity>
          </View>
        ) : listData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="bell-sleep-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>{t('activity.noActivityYet')}</Text>
            <Text style={styles.emptyDescription}>
              {t('activity.noActivityDescription')}
            </Text>
          </View>
        ) : (
          <FlatList
            data={listData}
            keyExtractor={(item, index) =>
              item.type === 'header' ? `header-${item.title}-${index}` : `item-${item.item?.id}-${index}`
            }
            renderItem={({ item }) => {
              if (item.type === 'header') {
                return (
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>{item.title}</Text>
                    <Text style={styles.sectionCount}>{item.count}</Text>
                  </View>
                );
              }
              return (
                <ActivityItem
                  activity={item.item!}
                  onPress={() => handleActivityPress(item.item!)}
                  onUnmatch={handleUnmatch}
                />
              );
            }}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#A08AB7" />
            }
            onEndReached={hasMore ? loadMore : undefined}
            onEndReachedThreshold={0.3}
            ListFooterComponent={
              hasMore ? (
                <View style={styles.loadingMore}>
                  <ActivityIndicator size="small" color="#A08AB7" />
                </View>
              ) : null
            }
          />
        )}
      </SafeAreaView>

      {/* Unmatch Modal */}
      {unmatchTarget && profileId && (
        <UnmatchModal
          visible={!!unmatchTarget}
          onClose={() => setUnmatchTarget(null)}
          matchId={unmatchTarget.matchId}
          matchedProfileId={unmatchTarget.actorProfileId}
          matchedProfileName={unmatchTarget.actorName}
          currentProfileId={profileId}
          onUnmatchSuccess={handleUnmatchSuccess}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 12,
    color: '#9CA3AF',
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    marginTop: 12,
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#A08AB7',
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 15,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    marginTop: 16,
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
  },
  emptyDescription: {
    marginTop: 8,
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  loadingMore: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  markAllButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  markAllText: {
    color: '#A08AB7',
    fontSize: 14,
    fontWeight: '500',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  // Premium gate styles
  premiumGate: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  premiumIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F5F0FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  premiumTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  premiumDescription: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  upgradeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#A08AB7',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  upgradeButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});
