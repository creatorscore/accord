import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

const { width } = Dimensions.get('window');

interface DailyMetrics {
  date: string;
  total_matches: number;
  new_matches_today: number;
  total_conversations: number;
  new_conversations_today: number;
  total_dates_scheduled: number;
  new_dates_today: number;
  total_marriages_arranged: number;
  new_marriages_today: number;
  daily_active_users: number;
  weekly_active_users: number;
  monthly_active_users: number;
  match_to_date_conversion_rate: number;
  match_to_marriage_conversion_rate: number;
}

interface TopPerformer {
  profile_id: string;
  display_name: string;
  total_matches: number;
  total_messages_sent: number;
  match_rate: number;
}

export default function SuccessMetrics() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [todayMetrics, setTodayMetrics] = useState<DailyMetrics | null>(null);
  const [weekMetrics, setWeekMetrics] = useState<DailyMetrics[]>([]);
  const [topPerformers, setTopPerformers] = useState<TopPerformer[]>([]);
  const [selectedTab, setSelectedTab] = useState<'overview' | 'trends' | 'users'>('overview');

  useEffect(() => {
    checkAdminAndLoadMetrics();
  }, []);

  const checkAdminAndLoadMetrics = async () => {
    try {
      // Check if user is admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', user?.id)
        .single();

      if (!profile?.is_admin) {
        router.back();
        return;
      }

      await loadMetrics();
    } catch (error) {
      console.error('Error checking admin status:', error);
      router.back();
    }
  };

  const loadMetrics = async () => {
    try {
      setLoading(true);

      // Get today's metrics
      const today = new Date().toISOString().split('T')[0];
      const { data: todayData } = await supabase
        .from('success_metrics_daily')
        .select('*')
        .eq('date', today)
        .single();

      setTodayMetrics(todayData);

      // Get last 7 days metrics
      const { data: weekData } = await supabase
        .from('success_metrics_daily')
        .select('*')
        .order('date', { ascending: false })
        .limit(7);

      setWeekMetrics(weekData || []);

      // Get top performers
      const { data: performers } = await supabase
        .from('profile_success_stats')
        .select(`
          profile_id,
          total_matches,
          total_messages_sent,
          match_rate,
          profiles!inner(display_name)
        `)
        .order('total_matches', { ascending: false })
        .limit(10);

      const formattedPerformers = performers?.map((p: any) => ({
        profile_id: p.profile_id,
        display_name: p.profiles.display_name,
        total_matches: p.total_matches,
        total_messages_sent: p.total_messages_sent,
        match_rate: p.match_rate || 0,
      })) || [];

      setTopPerformers(formattedPerformers);
    } catch (error) {
      console.error('Error loading metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshMetrics = async () => {
    try {
      // Call the calculate_daily_metrics function to refresh today's data
      await supabase.rpc('calculate_daily_metrics');
      await loadMetrics();
    } catch (error) {
      console.error('Error refreshing metrics:', error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9B87CE" />
        <Text style={styles.loadingText}>Loading metrics...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Success Metrics</Text>
        <TouchableOpacity onPress={refreshMetrics} style={styles.refreshButton}>
          <Ionicons name="refresh" size={24} color="#9B87CE" />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'overview' && styles.activeTab]}
          onPress={() => setSelectedTab('overview')}
        >
          <Text style={[styles.tabText, selectedTab === 'overview' && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'trends' && styles.activeTab]}
          onPress={() => setSelectedTab('trends')}
        >
          <Text style={[styles.tabText, selectedTab === 'trends' && styles.activeTabText]}>
            Trends
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, selectedTab === 'users' && styles.activeTab]}
          onPress={() => setSelectedTab('users')}
        >
          <Text style={[styles.tabText, selectedTab === 'users' && styles.activeTabText]}>
            Top Users
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {selectedTab === 'overview' && (
          <View style={styles.section}>
            {/* Today's Snapshot */}
            <Text style={styles.sectionTitle}>Today's Snapshot</Text>
            <View style={styles.metricsGrid}>
              <MetricCard
                icon="people"
                label="Active Users"
                value={todayMetrics?.daily_active_users || 0}
                subtitle="today"
                color="#9B87CE"
              />
              <MetricCard
                icon="heart"
                label="New Matches"
                value={todayMetrics?.new_matches_today || 0}
                subtitle="today"
                color="#EC4899"
              />
              <MetricCard
                icon="chatbubbles"
                label="New Convos"
                value={todayMetrics?.new_conversations_today || 0}
                subtitle="today"
                color="#3B82F6"
              />
              <MetricCard
                icon="calendar"
                label="Dates Scheduled"
                value={todayMetrics?.new_dates_today || 0}
                subtitle="today"
                color="#10B981"
              />
            </View>

            {/* Cumulative Totals */}
            <Text style={styles.sectionTitle}>All-Time Totals</Text>
            <View style={styles.metricsGrid}>
              <MetricCard
                icon="heart-circle"
                label="Total Matches"
                value={todayMetrics?.total_matches || 0}
                subtitle="all time"
                color="#9B87CE"
              />
              <MetricCard
                icon="chatbubble-ellipses"
                label="Conversations"
                value={todayMetrics?.total_conversations || 0}
                subtitle="all time"
                color="#3B82F6"
              />
              <MetricCard
                icon="calendar-outline"
                label="Dates Scheduled"
                value={todayMetrics?.total_dates_scheduled || 0}
                subtitle="all time"
                color="#10B981"
              />
              <MetricCard
                icon="diamond"
                label="Marriages"
                value={todayMetrics?.total_marriages_arranged || 0}
                subtitle="all time"
                color="#F59E0B"
              />
            </View>

            {/* User Activity */}
            <Text style={styles.sectionTitle}>User Activity</Text>
            <View style={styles.activityCard}>
              <View style={styles.activityRow}>
                <Text style={styles.activityLabel}>Daily Active Users (DAU)</Text>
                <Text style={styles.activityValue}>{todayMetrics?.daily_active_users || 0}</Text>
              </View>
              <View style={styles.activityRow}>
                <Text style={styles.activityLabel}>Weekly Active Users (WAU)</Text>
                <Text style={styles.activityValue}>{todayMetrics?.weekly_active_users || 0}</Text>
              </View>
              <View style={styles.activityRow}>
                <Text style={styles.activityLabel}>Monthly Active Users (MAU)</Text>
                <Text style={styles.activityValue}>{todayMetrics?.monthly_active_users || 0}</Text>
              </View>
            </View>

            {/* Conversion Rates */}
            <Text style={styles.sectionTitle}>Conversion Rates</Text>
            <View style={styles.conversionCard}>
              <View style={styles.conversionRow}>
                <Text style={styles.conversionLabel}>Match → Date</Text>
                <Text style={styles.conversionValue}>
                  {((todayMetrics?.match_to_date_conversion_rate || 0) * 100).toFixed(1)}%
                </Text>
              </View>
              <View style={styles.conversionRow}>
                <Text style={styles.conversionLabel}>Match → Marriage</Text>
                <Text style={styles.conversionValue}>
                  {((todayMetrics?.match_to_marriage_conversion_rate || 0) * 100).toFixed(1)}%
                </Text>
              </View>
            </View>
          </View>
        )}

        {selectedTab === 'trends' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Last 7 Days</Text>
            {weekMetrics.map((day) => (
              <View key={day.date} style={styles.trendCard}>
                <Text style={styles.trendDate}>
                  {new Date(day.date).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </Text>
                <View style={styles.trendMetrics}>
                  <View style={styles.trendItem}>
                    <Ionicons name="people" size={16} color="#6B7280" />
                    <Text style={styles.trendValue}>{day.daily_active_users} DAU</Text>
                  </View>
                  <View style={styles.trendItem}>
                    <Ionicons name="heart" size={16} color="#EC4899" />
                    <Text style={styles.trendValue}>{day.new_matches_today} matches</Text>
                  </View>
                  <View style={styles.trendItem}>
                    <Ionicons name="chatbubbles" size={16} color="#3B82F6" />
                    <Text style={styles.trendValue}>{day.new_conversations_today} convos</Text>
                  </View>
                  <View style={styles.trendItem}>
                    <Ionicons name="calendar" size={16} color="#10B981" />
                    <Text style={styles.trendValue}>{day.new_dates_today} dates</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {selectedTab === 'users' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Top Performers</Text>
            {topPerformers.map((performer, index) => (
              <View key={performer.profile_id} style={styles.performerCard}>
                <View style={styles.performerRank}>
                  <Text style={styles.rankNumber}>#{index + 1}</Text>
                </View>
                <View style={styles.performerInfo}>
                  <Text style={styles.performerName}>{performer.display_name}</Text>
                  <View style={styles.performerStats}>
                    <Text style={styles.performerStat}>
                      {performer.total_matches} matches
                    </Text>
                    <Text style={styles.performerStat}>•</Text>
                    <Text style={styles.performerStat}>
                      {performer.total_messages_sent} messages
                    </Text>
                    <Text style={styles.performerStat}>•</Text>
                    <Text style={styles.performerStat}>
                      {(performer.match_rate * 100).toFixed(0)}% match rate
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

interface MetricCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number;
  subtitle: string;
  color: string;
}

function MetricCard({ icon, label, value, subtitle, color }: MetricCardProps) {
  return (
    <View style={styles.metricCard}>
      <Ionicons name={icon} size={24} color={color} />
      <Text style={styles.metricValue}>{value.toLocaleString()}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricSubtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  refreshButton: {
    padding: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tab: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#9B87CE',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  activeTabText: {
    color: '#9B87CE',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
    marginTop: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    width: (width - 44) / 2,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 4,
    textAlign: 'center',
  },
  metricSubtitle: {
    fontSize: 10,
    color: '#9CA3AF',
    marginTop: 2,
  },
  activityCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  activityLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  activityValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
  },
  conversionCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  conversionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  conversionLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  conversionValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#10B981',
  },
  trendCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  trendDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
  },
  trendMetrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  trendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendValue: {
    fontSize: 12,
    color: '#6B7280',
  },
  performerCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  performerRank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#9B87CE',
  },
  performerInfo: {
    flex: 1,
  },
  performerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  performerStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  performerStat: {
    fontSize: 12,
    color: '#6B7280',
  },
});
