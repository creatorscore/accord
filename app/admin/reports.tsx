import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, RefreshControl, Image, Modal, Dimensions, TextInput } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getDeviceFingerprint } from '@/lib/device-fingerprint';
import { sendReportActionNotification, sendBanNotification, sendPhotoReviewNotification, sendIdentityVerificationNotification } from '@/lib/notifications';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Ban duration options
const BAN_DURATIONS = [
  { label: '1 Day', hours: 24, description: 'Short suspension' },
  { label: '3 Days', hours: 72, description: 'Minor violation' },
  { label: '7 Days', hours: 168, description: 'Moderate violation' },
  { label: '30 Days', hours: 720, description: 'Serious violation' },
  { label: 'Permanent', hours: null, description: 'Severe/repeat offender' },
];

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
  evidence_urls?: string[];
}

interface PastReport {
  id: string;
  reason: string;
  details: string;
  status: string;
  created_at: string;
  reporter_name: string;
}

export default function AdminReports() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('pending');
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Ban modal state
  const [showBanModal, setShowBanModal] = useState(false);
  const [banningReport, setBanningReport] = useState<Report | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null); // null = permanent
  const [userMessage, setUserMessage] = useState('');
  const [isBanning, setIsBanning] = useState(false);

  // Report history modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyProfileId, setHistoryProfileId] = useState<string | null>(null);
  const [historyProfileName, setHistoryProfileName] = useState<string>('');
  const [pastReports, setPastReports] = useState<PastReport[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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
          evidence_urls,
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
        evidence_urls: report.evidence_urls || [],
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
    if (action === 'ban') {
      // Show ban modal instead of immediate ban
      const report = reports.find(r => r.id === reportId);
      if (report) {
        setBanningReport(report);
        setSelectedDuration(null); // Default to permanent
        setUserMessage('');
        setShowBanModal(true);
      }
      return;
    }

    Alert.alert(
      'Confirm Action',
      `Are you sure you want to ${action} this report?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'default',
          onPress: () => executeReportAction(reportId, action),
        },
      ]
    );
  };

  const closeBanModal = () => {
    setShowBanModal(false);
    setBanningReport(null);
    setSelectedDuration(null);
    setUserMessage('');
  };

  const executeBan = async () => {
    if (!banningReport) return;

    setIsBanning(true);

    try {
      // Get current admin profile ID
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!adminProfile) throw new Error('Admin profile not found');

      // Get admin's device ID for logging
      const adminDeviceId = await getDeviceFingerprint();

      // Call Edge Function to perform the ban
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const durationLabel = selectedDuration
        ? BAN_DURATIONS.find(d => d.hours === selectedDuration)?.label || `${selectedDuration}h`
        : 'Permanent';

      console.log('🔍 Calling admin-ban-user Edge Function...');
      console.log('🔍 Ban duration:', durationLabel);

      const { data: banResponse, error: banError } = await supabase.functions.invoke('admin-ban-user', {
        body: {
          banned_profile_id: banningReport.reported_profile_id,
          ban_reason: `${banningReport.reason}: ${banningReport.details || 'No additional details'}`,
          banned_by_profile_id: adminProfile.id,
          report_id: banningReport.id,
          admin_notes: `Banned from device: ${adminDeviceId}`,
          ban_duration_hours: selectedDuration,
          user_message: userMessage || undefined,
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (banError) {
        throw new Error(banError.message || 'Failed to ban user');
      }

      if (!banResponse?.success) {
        throw new Error(`Ban operation failed: ${JSON.stringify(banResponse)}`);
      }

      console.log('✅ User banned successfully:', banResponse);

      // Mark ALL pending reports for this profile as resolved
      await supabase
        .from('reports')
        .update({
          status: 'resolved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('reported_profile_id', banningReport.reported_profile_id)
        .eq('status', 'pending');

      // Send notifications
      try {
        await sendBanNotification(
          banningReport.reported_profile_id,
          `${banningReport.reason}: ${banningReport.details || 'No additional details'}`
        );
        await sendReportActionNotification(banningReport.reporter_profile_id, 'banned');
      } catch (notifyError) {
        console.warn('Notification error:', notifyError);
      }

      closeBanModal();

      const expiryText = selectedDuration
        ? `Ban expires in ${durationLabel.toLowerCase()}.`
        : 'This is a permanent ban.';

      Alert.alert(
        '✅ User Banned',
        `${banningReport.reported_name} has been banned.\n\n${expiryText}\n\n${userMessage ? 'Custom message sent to user.' : ''}`
      );

      loadReports();
    } catch (error: any) {
      console.error('Error banning user:', error);
      Alert.alert('Error', error.message || 'Failed to ban user. Please try again.');
    } finally {
      setIsBanning(false);
    }
  };

  const executeReportAction = async (reportId: string, action: 'resolve' | 'dismiss') => {
    try {
      const report = reports.find(r => r.id === reportId);
      if (!report) return;

      const newStatus = action === 'resolve' ? 'resolved' : 'dismissed';

      // Update ALL pending reports for this profile, not just the one clicked
      const { error: reportError, count } = await supabase
        .from('reports')
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
        })
        .eq('reported_profile_id', report.reported_profile_id)
        .eq('status', 'pending');

      if (reportError) throw reportError;

      const reportsResolved = count && count > 1 ? ` (${count} reports resolved)` : '';
      Alert.alert('Report Updated', `Report has been marked as ${newStatus}.${reportsResolved}`);
      loadReports();
    } catch (error: any) {
      console.error('Error executing action:', error);
      Alert.alert('Error', 'Failed to complete action. Please try again.');
    }
  };

  const handlePhotoReview = (reportId: string) => {
    Alert.alert(
      'Require New Photos',
      'This will hide the profile from discovery until they upload new photos. The user will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Require Photos',
          style: 'default',
          onPress: () => executePhotoReview(reportId),
        },
      ]
    );
  };

  const executePhotoReview = async (reportId: string) => {
    try {
      const report = reports.find(r => r.id === reportId);
      if (!report) return;

      // Get auth session for Edge Function call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Call Edge Function to flag profile (bypasses RLS)
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xcaktvlosjsaxcntxbyf.supabase.co'}/functions/v1/admin-report-action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'photo_review',
            report_id: report.id,
            reported_profile_id: report.reported_profile_id,
            reason: report.reason,
            details: report.details,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to flag profile');
      }

      console.log('✅ Photo review action result:', result);

      // Send push notification to the user
      try {
        await sendPhotoReviewNotification(
          report.reported_profile_id,
          `${report.reason}: ${report.details || 'Photo review required'}`
        );
      } catch (notifyError) {
        console.warn('Could not send photo review notification:', notifyError);
        // Don't fail if notification fails
      }

      // Notify reporter that action was taken
      try {
        await sendReportActionNotification(report.reporter_profile_id, 'resolved');
      } catch (notifyError) {
        console.warn('Could not notify reporter:', notifyError);
      }

      Alert.alert(
        'Profile Flagged',
        `${report.reported_name}'s profile has been hidden from discovery.\n\nThey have been notified to upload new photos.`
      );

      loadReports();
    } catch (error: any) {
      console.error('Error flagging profile for photo review:', error);
      Alert.alert('Error', error.message || 'Failed to flag profile. Please try again.');
    }
  };

  const handleVerifyIdentity = (reportId: string) => {
    Alert.alert(
      'Require Identity Verification',
      'This will hide the profile from discovery until they complete photo verification. The user will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Require Verification',
          style: 'default',
          onPress: () => executeVerifyIdentity(reportId),
        },
      ]
    );
  };

  const executeVerifyIdentity = async (reportId: string) => {
    try {
      const report = reports.find(r => r.id === reportId);
      if (!report) return;

      // Get auth session for Edge Function call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      // Call Edge Function to require verification (bypasses RLS)
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xcaktvlosjsaxcntxbyf.supabase.co'}/functions/v1/admin-report-action`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            action: 'verify_identity',
            report_id: report.id,
            reported_profile_id: report.reported_profile_id,
            reason: report.reason,
            details: report.details,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to require verification');
      }

      console.log('✅ Verify identity action result:', result);

      // Send push notification to the user
      try {
        await sendIdentityVerificationNotification(
          report.reported_profile_id,
          `${report.reason}: ${report.details || 'Identity verification required'}`
        );
      } catch (notifyError) {
        console.warn('Could not send identity verification notification:', notifyError);
      }

      // Notify reporter that action was taken
      try {
        await sendReportActionNotification(report.reporter_profile_id, 'resolved');
      } catch (notifyError) {
        console.warn('Could not notify reporter:', notifyError);
      }

      Alert.alert(
        'Verification Required',
        `${report.reported_name}'s profile has been hidden from discovery.\n\nThey must complete identity verification to restore visibility.`
      );

      loadReports();
    } catch (error: any) {
      console.error('Error flagging profile for identity verification:', error);
      Alert.alert('Error', error.message || 'Failed to require verification. Please try again.');
    }
  };

  const handleViewHistory = async (profileId: string, profileName: string) => {
    setHistoryProfileId(profileId);
    setHistoryProfileName(profileName);
    setShowHistoryModal(true);
    setLoadingHistory(true);

    try {
      const { data, error } = await supabase
        .from('reports')
        .select(`
          id,
          reason,
          details,
          status,
          created_at,
          reporter:reporter_profile_id(display_name)
        `)
        .eq('reported_profile_id', profileId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const transformedReports: PastReport[] = (data || []).map((report: any) => ({
        id: report.id,
        reason: report.reason,
        details: report.details,
        status: report.status,
        created_at: report.created_at,
        reporter_name: report.reporter?.display_name || 'Unknown',
      }));

      setPastReports(transformedReports);
    } catch (error: any) {
      console.error('Error loading report history:', error);
      Alert.alert('Error', 'Failed to load report history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setHistoryProfileId(null);
    setHistoryProfileName('');
    setPastReports([]);
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
      blackmail: 'Blackmail / Screenshot Sharing',
      harassment: 'Harassment',
      fake_profile: 'Fake Profile',
      inappropriate_content: 'Inappropriate Content',
      scam: 'Scam',
      underage: 'Underage',
      spam: 'Spam',
      hate_speech: 'Hate Speech',
      other: 'Other',
    };
    return labels[reason] || reason;
  };

  const getReasonIcon = (reason: string) => {
    const icons: { [key: string]: string } = {
      blackmail: 'shield-alert',
      harassment: 'bullhorn',
      fake_profile: 'account-alert',
      inappropriate_content: 'alert-circle',
      scam: 'cash-remove',
      underage: 'account-cancel',
      spam: 'message-alert',
      hate_speech: 'thumb-down',
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
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={() => router.push('/admin/appeals')} style={styles.headerBtn}>
            <MaterialCommunityIcons name="message-reply-text" size={22} color="white" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/admin/bans')} style={styles.headerBtn}>
            <MaterialCommunityIcons name="shield-off" size={22} color="white" />
          </TouchableOpacity>
        </View>
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
                    name={getReasonIcon(report.reason) as any}
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

              {/* Evidence Photos */}
              {report.evidence_urls && report.evidence_urls.length > 0 && (
                <View style={styles.evidenceContainer}>
                  <Text style={styles.detailsLabel}>Evidence:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.evidenceScroll}>
                    {report.evidence_urls.map((url, index) => (
                      <TouchableOpacity
                        key={index}
                        onPress={() => setViewingImage(url)}
                        style={styles.evidenceThumbnailContainer}
                      >
                        <Image source={{ uri: url }} style={styles.evidenceThumbnail} />
                        <View style={styles.evidenceBadge}>
                          <MaterialCommunityIcons name="magnify-plus" size={16} color="white" />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                  {report.reason === 'blackmail' && (
                    <View style={styles.watermarkHint}>
                      <MaterialCommunityIcons name="water" size={14} color="#9B87CE" />
                      <Text style={styles.watermarkHintText}>
                        Look for watermarks in corners showing user ID + timestamp
                      </Text>
                    </View>
                  )}
                </View>
              )}

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
                <View style={styles.actionsWrapper}>
                  {/* Primary Actions Row */}
                  <View style={styles.actionsContainer}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.dismissButton]}
                      onPress={() => handleReportAction(report.id, 'dismiss')}
                    >
                      <MaterialCommunityIcons name="close" size={18} color="#6B7280" />
                      <Text style={styles.dismissButtonText}>Dismiss</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.photoReviewButton]}
                      onPress={() => handlePhotoReview(report.id)}
                    >
                      <MaterialCommunityIcons name="camera-off" size={18} color="#F59E0B" />
                      <Text style={styles.photoReviewButtonText}>Photos</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.banButton]}
                      onPress={() => handleReportAction(report.id, 'ban')}
                    >
                      <MaterialCommunityIcons name="account-cancel" size={18} color="white" />
                      <Text style={styles.banButtonText}>Ban</Text>
                    </TouchableOpacity>
                  </View>
                  {/* Secondary Actions Row */}
                  <View style={styles.secondaryActionsContainer}>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.verifyButton]}
                      onPress={() => handleVerifyIdentity(report.id)}
                    >
                      <MaterialCommunityIcons name="account-check" size={18} color="#8B5CF6" />
                      <Text style={styles.verifyButtonText}>Verify ID</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.actionButton, styles.historyButton]}
                      onPress={() => handleViewHistory(report.reported_profile_id, report.reported_name)}
                    >
                      <MaterialCommunityIcons name="history" size={18} color="#3B82F6" />
                      <Text style={styles.historyButtonText}>History</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Image Viewer Modal */}
      <Modal
        visible={!!viewingImage}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setViewingImage(null)}
      >
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity
            style={styles.imageViewerCloseButton}
            onPress={() => setViewingImage(null)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {viewingImage && (
            <Image
              source={{ uri: viewingImage }}
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          )}
          <Text style={styles.imageViewerHint}>
            💡 Tip: Increase brightness to see watermark more clearly
          </Text>
        </View>
      </Modal>

      {/* Ban Options Modal */}
      <Modal
        visible={showBanModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeBanModal}
      >
        <View style={styles.banModalOverlay}>
          <View style={styles.banModalContainer}>
            {/* Header */}
            <View style={styles.banModalHeader}>
              <Text style={styles.banModalTitle}>Ban User</Text>
              <TouchableOpacity onPress={closeBanModal} style={styles.banModalCloseBtn}>
                <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {banningReport && (
              <Text style={styles.banModalSubtitle}>
                Banning: <Text style={{ fontWeight: '700', color: '#EF4444' }}>{banningReport.reported_name}</Text>
              </Text>
            )}

            <ScrollView style={styles.banModalContent} showsVerticalScrollIndicator={false}>
              {/* Duration Selection */}
              <Text style={styles.banModalSectionTitle}>Ban Duration</Text>
              <View style={styles.durationOptions}>
                {BAN_DURATIONS.map((duration) => (
                  <TouchableOpacity
                    key={duration.label}
                    style={[
                      styles.durationOption,
                      (selectedDuration === duration.hours) && styles.durationOptionSelected,
                      duration.hours === null && styles.durationOptionPermanent,
                    ]}
                    onPress={() => setSelectedDuration(duration.hours)}
                  >
                    <Text style={[
                      styles.durationLabel,
                      (selectedDuration === duration.hours) && styles.durationLabelSelected,
                    ]}>
                      {duration.label}
                    </Text>
                    <Text style={[
                      styles.durationDesc,
                      (selectedDuration === duration.hours) && styles.durationDescSelected,
                    ]}>
                      {duration.description}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Custom Message */}
              <Text style={styles.banModalSectionTitle}>Message to User (Optional)</Text>
              <Text style={styles.banModalHint}>
                This message will be shown to the user when they try to access the app.
              </Text>
              <TextInput
                style={styles.messageInput}
                placeholder="Explain why they're being banned and what they can do..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                value={userMessage}
                onChangeText={setUserMessage}
                textAlignVertical="top"
              />

              {/* Quick Message Templates */}
              <View style={styles.templateButtons}>
                <TouchableOpacity
                  style={styles.templateBtn}
                  onPress={() => setUserMessage('Your account has been temporarily suspended due to violating our community guidelines. Please review our terms of service before your suspension ends.')}
                >
                  <Text style={styles.templateBtnText}>Guidelines Violation</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.templateBtn}
                  onPress={() => setUserMessage('Your profile photos do not meet our requirements. Please upload clear, recent photos of yourself when your suspension ends.')}
                >
                  <Text style={styles.templateBtnText}>Photo Issue</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.templateBtn}
                  onPress={() => setUserMessage('Your account has been suspended due to reports from other users. If you believe this is an error, you may submit an appeal.')}
                >
                  <Text style={styles.templateBtnText}>User Reports</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* Actions */}
            <View style={styles.banModalActions}>
              <TouchableOpacity
                style={styles.banModalCancelBtn}
                onPress={closeBanModal}
                disabled={isBanning}
              >
                <Text style={styles.banModalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.banModalConfirmBtn, isBanning && { opacity: 0.6 }]}
                onPress={executeBan}
                disabled={isBanning}
              >
                {isBanning ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="account-cancel" size={18} color="white" />
                    <Text style={styles.banModalConfirmText}>
                      {selectedDuration ? `Ban for ${BAN_DURATIONS.find(d => d.hours === selectedDuration)?.label}` : 'Ban Permanently'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Report History Modal */}
      <Modal
        visible={showHistoryModal}
        transparent={true}
        animationType="slide"
        onRequestClose={closeHistoryModal}
      >
        <View style={styles.historyModalOverlay}>
          <View style={styles.historyModalContainer}>
            {/* Header */}
            <View style={styles.historyModalHeader}>
              <Text style={styles.historyModalTitle}>Report History</Text>
              <TouchableOpacity onPress={closeHistoryModal} style={styles.historyModalCloseBtn}>
                <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.historyModalSubtitle}>
              All reports against: <Text style={{ fontWeight: '700', color: '#EF4444' }}>{historyProfileName}</Text>
            </Text>

            <ScrollView style={styles.historyModalContent} showsVerticalScrollIndicator={false}>
              {loadingHistory ? (
                <View style={styles.historyLoadingContainer}>
                  <ActivityIndicator size="large" color="#9B87CE" />
                </View>
              ) : pastReports.length === 0 ? (
                <View style={styles.historyEmptyState}>
                  <MaterialCommunityIcons name="check-circle-outline" size={48} color="#D1D5DB" />
                  <Text style={styles.historyEmptyText}>No previous reports</Text>
                </View>
              ) : (
                <>
                  <View style={styles.historySummary}>
                    <Text style={styles.historySummaryText}>
                      {pastReports.length} total report{pastReports.length !== 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.historySummarySubtext}>
                      {pastReports.filter(r => r.status === 'pending').length} pending
                      {' '}{pastReports.filter(r => r.status === 'resolved').length} resolved
                      {' '}{pastReports.filter(r => r.status === 'dismissed').length} dismissed
                    </Text>
                  </View>

                  {pastReports.map((pastReport) => (
                    <View key={pastReport.id} style={styles.historyReportCard}>
                      <View style={styles.historyReportHeader}>
                        <View style={styles.historyReportLeft}>
                          <MaterialCommunityIcons
                            name={getReasonIcon(pastReport.reason) as any}
                            size={20}
                            color="#EF4444"
                          />
                          <Text style={styles.historyReportReason}>{getReasonLabel(pastReport.reason)}</Text>
                        </View>
                        <View
                          style={[
                            styles.historyStatusBadge,
                            { backgroundColor: `${getStatusColor(pastReport.status)}20` },
                          ]}
                        >
                          <Text style={[styles.historyStatusText, { color: getStatusColor(pastReport.status) }]}>
                            {pastReport.status}
                          </Text>
                        </View>
                      </View>
                      {pastReport.details && (
                        <Text style={styles.historyReportDetails} numberOfLines={2}>
                          {pastReport.details}
                        </Text>
                      )}
                      <View style={styles.historyReportFooter}>
                        <Text style={styles.historyReportDate}>{formatDate(pastReport.created_at)}</Text>
                        <Text style={styles.historyReportReporter}>by {pastReport.reporter_name}</Text>
                      </View>
                    </View>
                  ))}
                </>
              )}
            </ScrollView>

            {/* Close Button */}
            <View style={styles.historyModalActions}>
              <TouchableOpacity
                style={styles.historyModalCloseButton}
                onPress={closeHistoryModal}
              >
                <Text style={styles.historyModalCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  headerBtn: {
    padding: 4,
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
  photoReviewButton: {
    backgroundColor: '#FEF3C7',
  },
  photoReviewButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F59E0B',
  },
  banButton: {
    backgroundColor: '#EF4444',
  },
  banButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: 'white',
  },
  evidenceContainer: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  evidenceScroll: {
    marginTop: 8,
  },
  evidenceThumbnailContainer: {
    position: 'relative',
    marginRight: 8,
  },
  evidenceThumbnail: {
    width: 100,
    height: 150,
    borderRadius: 8,
    backgroundColor: '#E5E7EB',
  },
  evidenceBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(155, 135, 206, 0.9)',
    borderRadius: 12,
    padding: 4,
  },
  watermarkHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F3E8FF',
    borderRadius: 6,
  },
  watermarkHintText: {
    flex: 1,
    fontSize: 11,
    color: '#6B7280',
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: SCREEN_WIDTH,
    height: '80%',
  },
  imageViewerHint: {
    position: 'absolute',
    bottom: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    fontSize: 14,
    color: 'white',
  },
  // Ban Modal Styles
  banModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  banModalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    paddingBottom: 34,
  },
  banModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  banModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  banModalCloseBtn: {
    padding: 4,
  },
  banModalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  banModalContent: {
    paddingHorizontal: 20,
  },
  banModalSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
    marginTop: 8,
  },
  banModalHint: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 12,
  },
  durationOptions: {
    gap: 8,
    marginBottom: 20,
  },
  durationOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  durationOptionSelected: {
    borderColor: '#9B87CE',
    backgroundColor: '#F3F0F7',
  },
  durationOptionPermanent: {
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  durationLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  durationLabelSelected: {
    color: '#9B87CE',
  },
  durationDesc: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  durationDescSelected: {
    color: '#9B87CE',
  },
  messageInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#111827',
    backgroundColor: '#F9FAFB',
    minHeight: 100,
    marginBottom: 12,
  },
  templateButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  templateBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  templateBtnText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  banModalActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  banModalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  banModalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  banModalConfirmBtn: {
    flex: 2,
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  banModalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
  // Actions Wrapper for two rows
  actionsWrapper: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 12,
    gap: 8,
  },
  secondaryActionsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  // Verify ID Button
  verifyButton: {
    backgroundColor: '#F3E8FF',
  },
  verifyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8B5CF6',
  },
  // History Button
  historyButton: {
    backgroundColor: '#DBEAFE',
  },
  historyButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B82F6',
  },
  // History Modal Styles
  historyModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  historyModalContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 34,
  },
  historyModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  historyModalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  historyModalCloseBtn: {
    padding: 4,
  },
  historyModalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  historyModalContent: {
    paddingHorizontal: 20,
    maxHeight: 400,
  },
  historyLoadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  historyEmptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  historyEmptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 12,
  },
  historySummary: {
    backgroundColor: '#F3F4F6',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  historySummaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
  historySummarySubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  historyReportCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyReportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  historyReportLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  historyReportReason: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    flex: 1,
  },
  historyStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  historyStatusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  historyReportDetails: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 8,
    lineHeight: 18,
  },
  historyReportFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  historyReportDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  historyReportReporter: {
    fontSize: 11,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  historyModalActions: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  historyModalCloseButton: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#9B87CE',
    alignItems: 'center',
  },
  historyModalCloseButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
});
