import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface TableSize {
  schemaname: string;
  tablename: string;
  size: string;
  size_bytes: number;
}

interface StorageLog {
  id: string;
  total_photos: number;
  total_users: number;
  avg_photos_per_user: number;
  logged_at: string;
}

interface CostAlert {
  id: string;
  alert_type: string;
  threshold_value: number;
  current_value: number;
  alert_message: string;
  created_at: string;
}

export default function CostMonitoring() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tableSizes, setTableSizes] = useState<TableSize[]>([]);
  const [storageLogs, setStorageLogs] = useState<StorageLog[]>([]);
  const [costAlerts, setCostAlerts] = useState<CostAlert[]>([]);
  const [totalDbSize, setTotalDbSize] = useState('0 MB');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load table sizes (using admin-only function)
      const { data: sizes, error: sizesError } = await supabase.rpc('get_table_sizes');

      if (sizesError) {
        console.error('Error loading table sizes:', sizesError);
      } else {
        setTableSizes(sizes || []);

        // Calculate total DB size
        const totalBytes = (sizes || []).reduce((sum, t) => sum + t.size_bytes, 0);
        const totalGB = (totalBytes / (1024 * 1024 * 1024)).toFixed(2);
        setTotalDbSize(`${totalGB} GB`);
      }

      // Load storage usage logs (last 7 days)
      const { data: logs, error: logsError } = await supabase
        .from('storage_usage_log')
        .select('*')
        .order('logged_at', { ascending: false })
        .limit(7);

      if (logsError) {
        console.error('Error loading storage logs:', logsError);
      } else {
        setStorageLogs(logs || []);
      }

      // Load cost alerts (last 30 days)
      const { data: alerts, error: alertsError } = await supabase
        .from('cost_alerts')
        .select('*')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (alertsError) {
        console.error('Error loading cost alerts:', alertsError);
      } else {
        setCostAlerts(alerts || []);
      }
    } catch (error) {
      console.error('Error loading cost monitoring data:', error);
      Alert.alert('Error', 'Failed to load cost monitoring data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const runCleanup = async (cleanupType: string) => {
    Alert.alert(
      'Run Cleanup?',
      `This will run the ${cleanupType} cleanup function. Continue?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase.rpc(cleanupType);

              if (error) {
                Alert.alert('Error', error.message);
              } else {
                Alert.alert('Success', `${cleanupType} completed successfully`);
                loadData(); // Reload data
              }
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const checkThresholds = async () => {
    try {
      const { error } = await supabase.rpc('check_cost_thresholds');

      if (error) {
        Alert.alert('Error', error.message);
      } else {
        Alert.alert('Success', 'Threshold check completed');
        loadData(); // Reload to show any new alerts
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#8B5CF6" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#374151" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cost Monitoring</Text>
        <TouchableOpacity onPress={checkThresholds}>
          <MaterialCommunityIcons name="refresh" size={24} color="#8B5CF6" />
        </TouchableOpacity>
      </View>

      {/* Cost Alerts */}
      {costAlerts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚠️ Recent Alerts</Text>
          {costAlerts.map((alert) => (
            <View key={alert.id} style={[styles.card, styles.alertCard]}>
              <Text style={styles.alertType}>{alert.alert_type.toUpperCase()}</Text>
              <Text style={styles.alertMessage}>{alert.alert_message}</Text>
              <Text style={styles.alertMeta}>
                Threshold: {alert.threshold_value} | Current: {alert.current_value.toFixed(2)}
              </Text>
              <Text style={styles.alertDate}>
                {new Date(alert.created_at).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Database Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💾 Database Size</Text>
        <View style={styles.card}>
          <Text style={styles.statLabel}>Total Database Size</Text>
          <Text style={styles.statValue}>{totalDbSize}</Text>
          <Text style={styles.statSubtext}>Limit: 8 GB on Pro plan</Text>
        </View>
      </View>

      {/* Table Sizes */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📊 Top 10 Tables by Size</Text>
        {tableSizes.slice(0, 10).map((table, index) => (
          <View key={table.tablename} style={styles.tableRow}>
            <View style={styles.tableRank}>
              <Text style={styles.rankText}>{index + 1}</Text>
            </View>
            <View style={styles.tableInfo}>
              <Text style={styles.tableName}>{table.tablename}</Text>
              <Text style={styles.tableSize}>{table.size}</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Storage Growth */}
      {storageLogs.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📈 Storage Growth (Last 7 Days)</Text>
          {storageLogs.map((log) => (
            <View key={log.id} style={styles.logRow}>
              <Text style={styles.logDate}>
                {new Date(log.logged_at).toLocaleDateString()}
              </Text>
              <View style={styles.logStats}>
                <Text style={styles.logStat}>👥 {log.total_users} users</Text>
                <Text style={styles.logStat}>📸 {log.total_photos} photos</Text>
                <Text style={styles.logStat}>
                  📊 {log.avg_photos_per_user.toFixed(1)} avg/user
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Cleanup Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🧹 Cleanup Actions</Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => runCleanup('cleanup_old_messages')}
        >
          <MaterialCommunityIcons name="message-minus" size={24} color="#8B5CF6" />
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Delete Old Messages</Text>
            <Text style={styles.actionDesc}>Remove messages older than 90 days</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => runCleanup('cleanup_orphaned_photos')}
        >
          <MaterialCommunityIcons name="image-broken" size={24} color="#8B5CF6" />
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Delete Orphaned Photos</Text>
            <Text style={styles.actionDesc}>Remove photos without profiles</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => runCleanup('cleanup_inactive_matches')}
        >
          <MaterialCommunityIcons name="account-cancel" size={24} color="#8B5CF6" />
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Delete Inactive Matches</Text>
            <Text style={styles.actionDesc}>Remove matches with no activity (6 months)</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => runCleanup('cleanup_old_bans')}
        >
          <MaterialCommunityIcons name="shield-remove" size={24} color="#8B5CF6" />
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Delete Old Bans</Text>
            <Text style={styles.actionDesc}>Hard delete banned users (1 year old)</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#EEF2FF' }]}
          onPress={checkThresholds}
        >
          <MaterialCommunityIcons name="alert-circle" size={24} color="#8B5CF6" />
          <View style={styles.actionInfo}>
            <Text style={styles.actionTitle}>Check Thresholds</Text>
            <Text style={styles.actionDesc}>Manually check for cost alerts</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    fontWeight: '700',
    color: '#111827',
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  card: {
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
  alertCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  alertType: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EF4444',
    marginBottom: 4,
  },
  alertMessage: {
    fontSize: 14,
    color: '#111827',
    marginBottom: 8,
  },
  alertMeta: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  alertDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  statLabel: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: '#8B5CF6',
    marginBottom: 4,
  },
  statSubtext: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  tableRank: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#8B5CF6',
  },
  tableInfo: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  tableSize: {
    fontSize: 14,
    color: '#6B7280',
  },
  logRow: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  logDate: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  logStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  logStat: {
    fontSize: 13,
    color: '#111827',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  actionInfo: {
    marginLeft: 12,
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  actionDesc: {
    fontSize: 13,
    color: '#6B7280',
  },
});
