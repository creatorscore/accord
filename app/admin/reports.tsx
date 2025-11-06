import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getDeviceFingerprint } from '@/lib/device-fingerprint';

interface Report {
  id: string;
  reason: string;
  details: string;
  status: string;
  created_at: string;
  reporter_name: string;
  reported_name: string;
  reported_profile_id: string;
  reporter_profile_id: string;
}

export default function AdminReports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('pending');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadReports();
    }
  }, [isAdmin, filter]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      if (!data?.is_admin) {
        Alert.alert('Access Denied', 'You do not have admin privileges.');
        router.back();
        return;
      }

      setIsAdmin(true);
    } catch (error: any) {
      console.error('Error checking admin status:', error);
      Alert.alert('Error', 'Failed to verify admin access.');
      router.back();
    }
  };

  const loadReports = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('reports')
        .select(`
          id,
          reason,
          details,
          status,
          created_at,
          reporter:reporter_profile_id(id, display_name),
          reported:reported_profile_id(id, display_name)
        `)
        .order('created_at', { ascending: false });

      if (filter === 'pending') {
        query = query.eq('status', 'pending');
      } else if (filter === 'reviewed') {
        query = query.in('status', ['reviewed', 'resolved', 'dismissed']);
      }

      const { data, error } = await query;

      if (error) throw error;

      const transformedReports: Report[] = (data || []).map((report: any) => ({
        id: report.id,
        reason: report.reason,
        details: report.details,
        status: report.status,
        created_at: report.created_at,
        reporter_name: report.reporter?.display_name || 'Unknown',
        reported_name: report.reported?.display_name || 'Unknown',
        reported_profile_id: report.reported?.id,
        reporter_profile_id: report.reporter?.id,
      }));

      setReports(transformedReports);
    } catch (error: any) {
      console.error('Error loading reports:', error);
      Alert.alert('Error', 'Failed to load reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const handleReportAction = (reportId: string, action: 'resolve' | 'dismiss' | 'ban') => {
    Alert.alert(
      'Confirm Action',
      `Are you sure you want to ${action} this report?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'ban' ? 'Ban User' : 'Confirm',
          style: action === 'ban' ? 'destructive' : 'default',
          onPress: () => executeReportAction(reportId, action),
        },
      ]
    );
  };

  const executeReportAction = async (reportId: string, action: 'resolve' | 'dismiss' | 'ban') => {
    try {
      const report = reports.find(r => r.id === reportId);
      if (!report) return;

      // Get current admin profile ID
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!adminProfile) throw new Error('Admin profile not found');

      // Update report status
      const newStatus = action === 'resolve' ? 'resolved' : action === 'dismiss' ? 'dismissed' : 'resolved';

      const { error: reportError } = await supabase
        .from('reports')
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (reportError) throw reportError;

      // If banning user, create comprehensive ban record
      if (action === 'ban') {
        // Get reported user's full details
        const { data: reportedProfile } = await supabase
          .from('profiles')
          .select('id, user_id, phone_number, device_id')
          .eq('id', report.reported_profile_id)
          .single();

        if (!reportedProfile) throw new Error('Reported user not found');

        // Get user's email from auth.users
        const { data: authUser } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('id', report.reported_profile_id)
          .single();

        let userEmail = null;
        if (authUser?.user_id) {
          const { data } = await supabase.auth.admin.getUserById(authUser.user_id);
          userEmail = data?.user?.email;
        }

        // Get admin's device ID for logging
        const adminDeviceId = await getDeviceFingerprint();

        // Create comprehensive ban record
        const { error: banInsertError } = await supabase
          .from('bans')
          .insert({
            banned_user_id: reportedProfile.user_id,
            banned_profile_id: reportedProfile.id,
            banned_email: userEmail,
            banned_phone_hash: reportedProfile.phone_number, // Already hashed in DB
            banned_device_id: reportedProfile.device_id, // Device fingerprint
            ban_reason: `${report.reason}: ${report.details || 'No additional details'}`,
            banned_by: adminProfile.id,
            report_id: reportId,
            is_permanent: true,
            admin_notes: `Banned from device: ${adminDeviceId}`,
          });

        if (banInsertError) {
          console.warn('Failed to create ban record:', banInsertError);
          // Continue with profile deactivation even if ban record fails
        }

        // Deactivate profile
        const { error: profileError } = await supabase
          .from('profiles')
          .update({
            is_active: false,
            ban_reason: `Banned by admin for: ${report.reason}`,
          })
          .eq('id', report.reported_profile_id);

        if (profileError) throw profileError;

        Alert.alert(
          '✅ User Banned',
          `${report.reported_name} has been permanently banned.\n\n` +
          `🔒 Banned by: Email${userEmail ? ', Phone' : ''}${reportedProfile.phone_number ? ', Device ID' : ''}\n\n` +
          `They cannot re-register with the same credentials.`
        );
      } else {
        Alert.alert('Report Updated', `Report has been marked as ${newStatus}.`);
      }

      // Reload reports
      loadReports();
    } catch (error: any) {
      console.error('Error executing action:', error);
      Alert.alert('Error', 'Failed to complete action. Please try again.');
    }
  };

  const viewProfile = (profileId: string) => {
    router.push(`/profile/${profileId}`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const getReasonLabel = (reason: string) => {
    const labels: { [key: string]: string } = {
      harassment: 'Harassment',
      fake_profile: 'Fake Profile',
      inappropriate_content: 'Inappropriate Content',
      scam: 'Scam',
      underage: 'Underage',
      other: 'Other',
    };
    return labels[reason] || reason;
  };

  const getReasonIcon = (reason: string) => {
    const icons: { [key: string]: string } = {
      harassment: 'bullhorn',
      fake_profile: 'account-alert',
      inappropriate_content: 'alert-circle',
      scam: 'cash-remove',
      underage: 'account-cancel',
      other: 'help-circle',
    };
    return icons[reason] || 'alert';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#F59E0B';
      case 'resolved':
        return '#10B981';
      case 'dismissed':
        return '#6B7280';
      default:
        return '#9B87CE';
    }
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#9B87CE', '#B8A9DD']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Admin: Reports</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9B87CE" />
        </View>
      </View>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#9B87CE', '#B8A9DD']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Admin: Reports</Text>
        <TouchableOpacity onPress={() => router.push('/admin/bans')}>
          <MaterialCommunityIcons name="shield-off" size={24} color="white" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'pending' && styles.filterTabActive]}
          onPress={() => setFilter('pending')}
        >
          <Text style={[styles.filterTabText, filter === 'pending' && styles.filterTabTextActive]}>
            Pending
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filter === 'reviewed' && styles.filterTabActive]}
          onPress={() => setFilter('reviewed')}
        >
          <Text style={[styles.filterTabText, filter === 'reviewed' && styles.filterTabTextActive]}>
            Reviewed
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#9B87CE" />
        }
      >
        {reports.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="check-circle" size={64} color="#D1D5DB" />
            <Text style={styles.emptyStateText}>No {filter} reports</Text>
          </View>
        ) : (
          reports.map((report) => (
            <View key={report.id} style={styles.reportCard}>
              {/* Header */}
              <View style={styles.reportHeader}>
                <View style={styles.reportHeaderLeft}>
                  <MaterialCommunityIcons
                    name={getReasonIcon(report.reason)}
                    size={24}
                    color="#EF4444"
                  />
                  <View style={{ marginLeft: 12 }}>
                    <Text style={styles.reportReason}>{getReasonLabel(report.reason)}</Text>
                    <Text style={styles.reportDate}>{formatDate(report.created_at)}</Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.statusBadge,
                    { backgroundColor: `${getStatusColor(report.status)}20` },
                  ]}
                >
                  <Text style={[styles.statusBadgeText, { color: getStatusColor(report.status) }]}>
                    {report.status}
                  </Text>
                </View>
              </View>

              {/* Details */}
              {report.details && (
                <View style={styles.detailsContainer}>
                  <Text style={styles.detailsLabel}>Details:</Text>
                  <Text style={styles.detailsText}>{report.details}</Text>
                </View>
              )}

              {/* Profiles */}
              <View style={styles.profilesContainer}>
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Reporter:</Text>
                  <TouchableOpacity
                    style={styles.profileButton}
                    onPress={() => viewProfile(report.reporter_profile_id)}
                  >
                    <Text style={styles.profileName}>{report.reporter_name}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={16} color="#9B87CE" />
                  </TouchableOpacity>
                </View>
                <View style={styles.profileRow}>
                  <Text style={styles.profileLabel}>Reported:</Text>
                  <TouchableOpacity
                    style={styles.profileButton}
                    onPress={() => viewProfile(report.reported_profile_id)}
                  >
                    <Text style={[styles.profileName, { color: '#EF4444' }]}>
                      {report.reported_name}
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Actions (only for pending reports) */}
              {report.status === 'pending' && (
                <View style={styles.actionsContainer}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.dismissButton]}
                    onPress={() => handleReportAction(report.id, 'dismiss')}
                  >
                    <MaterialCommunityIcons name="close" size={18} color="#6B7280" />
                    <Text style={styles.dismissButtonText}>Dismiss</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.resolveButton]}
                    onPress={() => handleReportAction(report.id, 'resolve')}
                  >
                    <MaterialCommunityIcons name="check" size={18} color="#10B981" />
                    <Text style={styles.resolveButtonText}>Resolve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.banButton]}
                    onPress={() => handleReportAction(report.id, 'ban')}
                  >
                    <MaterialCommunityIcons name="account-cancel" size={18} color="white" />
                    <Text style={styles.banButtonText}>Ban User</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
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
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterTab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: '#9B87CE',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginTop: 16,
  },
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reportHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  reportReason: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  reportDate: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  detailsContainer: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  detailsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  detailsText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  profilesContainer: {
    gap: 8,
    marginBottom: 12,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  profileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  profileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  profileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9B87CE',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  dismissButton: {
    backgroundColor: '#F3F4F6',
  },
  dismissButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
  },
  resolveButton: {
    backgroundColor: '#D1FAE5',
  },
  resolveButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#10B981',
  },
  banButton: {
    backgroundColor: '#EF4444',
  },
  banButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
  },
});
