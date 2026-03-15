import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, RefreshControl, TextInput, Modal, Image, Dimensions } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getSignedUrls } from '@/lib/signed-urls';

interface FlaggedPhoto {
  url: string;
  reason: string;
  confidence: number;
  labels: string[];
}

interface Appeal {
  id: string;
  banned_email: string | null;
  banned_profile_id: string | null;
  ban_reason: string;
  is_permanent: boolean | null;
  expires_at: string | null;
  ban_duration_hours: number | null;
  user_message: string | null;
  appeal_status: string;
  appeal_message: string | null;
  appeal_submitted_at: string | null;
  appeal_response: string | null;
  appeal_responded_at: string | null;
  created_at: string | null;
  banned_profile: {
    id: string;
    display_name: string;
  } | null;
  banner: {
    display_name: string;
  } | null;
  responder: {
    display_name: string;
  } | null;
  flagged_photos: FlaggedPhoto[];
}

export default function AdminAppeals() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'all' | 'approved' | 'denied'>('pending');
  const [selectedAppeal, setSelectedAppeal] = useState<Appeal | null>(null);
  const [showResponseModal, setShowResponseModal] = useState(false);
  const [responseMessage, setResponseMessage] = useState('');
  const [responding, setResponding] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadAppeals();
    }
  }, [isAdmin, filterStatus]);

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

  const loadAppeals = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('bans')
        .select(`
          id,
          banned_email,
          banned_profile_id,
          ban_reason,
          is_permanent,
          expires_at,
          ban_duration_hours,
          user_message,
          appeal_status,
          appeal_message,
          appeal_submitted_at,
          appeal_response,
          appeal_responded_at,
          created_at,
          banned_profile:banned_profile_id(id, display_name),
          banner:banned_by(display_name),
          responder:appeal_responded_by(display_name)
        `)
        .not('appeal_status', 'eq', 'none')
        .order('appeal_submitted_at', { ascending: false });

      if (filterStatus !== 'all') {
        query = query.eq('appeal_status', filterStatus);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Transform the data to handle Supabase joined data
      const transformedAppeals: Appeal[] = (data || []).map((appeal: any) => ({
        id: appeal.id,
        banned_email: appeal.banned_email,
        banned_profile_id: appeal.banned_profile_id,
        ban_reason: appeal.ban_reason,
        is_permanent: appeal.is_permanent,
        expires_at: appeal.expires_at,
        ban_duration_hours: appeal.ban_duration_hours,
        user_message: appeal.user_message,
        appeal_status: appeal.appeal_status,
        appeal_message: appeal.appeal_message,
        appeal_submitted_at: appeal.appeal_submitted_at,
        appeal_response: appeal.appeal_response,
        appeal_responded_at: appeal.appeal_responded_at,
        created_at: appeal.created_at,
        banned_profile: Array.isArray(appeal.banned_profile) ? appeal.banned_profile[0] || null : appeal.banned_profile,
        banner: Array.isArray(appeal.banner) ? appeal.banner[0] || null : appeal.banner,
        responder: Array.isArray(appeal.responder) ? appeal.responder[0] || null : appeal.responder,
        flagged_photos: [],
      }));

      // Fetch flagged photos from moderation_logs for NSFW auto-bans
      const profileIds = transformedAppeals
        .filter(a => a.ban_reason?.includes('NSFW') || a.ban_reason?.includes('Explicit'))
        .map(a => a.banned_profile_id)
        .filter(Boolean);

      if (profileIds.length > 0) {
        const { data: moderationLogs } = await supabase
          .from('moderation_logs')
          .select('profile_id, reason, details')
          .in('profile_id', profileIds)
          .eq('action', 'photo_rejected')
          .order('created_at', { ascending: false });

        if (moderationLogs) {
          const photosByProfile = new Map<string, FlaggedPhoto[]>();
          for (const log of moderationLogs) {
            const photos = photosByProfile.get(log.profile_id) || [];
            const details = log.details as any;
            if (details?.photo_url) {
              // Avoid duplicates by URL
              if (!photos.some(p => p.url === details.photo_url)) {
                photos.push({
                  url: details.photo_url,
                  reason: log.reason || 'Explicit content',
                  confidence: details?.highest_confidence || 0,
                  labels: (details?.labels || [])
                    .filter((l: any) => (l.Confidence || 0) >= 70)
                    .map((l: any) => `${l.Name} (${Math.round(l.Confidence)}%)`),
                });
              }
              photosByProfile.set(log.profile_id, photos);
            }
          }

          for (const appeal of transformedAppeals) {
            if (appeal.banned_profile_id && photosByProfile.has(appeal.banned_profile_id)) {
              appeal.flagged_photos = photosByProfile.get(appeal.banned_profile_id) || [];
            }
          }
        }
      }

      // Batch sign all flagged photo URLs across all appeals (1 RPC call)
      const flaggedPaths: string[] = [];
      const flaggedEntries: { appealIdx: number; fpIdx: number }[] = [];
      for (let a = 0; a < transformedAppeals.length; a++) {
        for (let f = 0; f < transformedAppeals[a].flagged_photos.length; f++) {
          const fp = transformedAppeals[a].flagged_photos[f];
          if (fp.url) {
            flaggedPaths.push(fp.url);
            flaggedEntries.push({ appealIdx: a, fpIdx: f });
          }
        }
      }
      if (flaggedPaths.length > 0) {
        const signedFlagged = await getSignedUrls('profile-photos', flaggedPaths);
        for (let j = 0; j < flaggedEntries.length; j++) {
          if (signedFlagged[j]) {
            const { appealIdx, fpIdx } = flaggedEntries[j];
            transformedAppeals[appealIdx].flagged_photos[fpIdx].url = signedFlagged[j]!;
          }
        }
      }

      setAppeals(transformedAppeals);
    } catch (error: any) {
      console.error('Error loading appeals:', error);
      Alert.alert('Error', 'Failed to load appeals.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAppeals();
  };

  const openResponseModal = (appeal: Appeal) => {
    setSelectedAppeal(appeal);
    setResponseMessage('');
    setShowResponseModal(true);
  };

  const handleRespondToAppeal = async (decision: 'approved' | 'denied') => {
    if (!selectedAppeal) return;

    if (!responseMessage.trim()) {
      Alert.alert('Error', 'Please provide a response message.');
      return;
    }

    setResponding(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      const { data, error } = await supabase.functions.invoke('admin-respond-appeal', {
        body: {
          ban_id: selectedAppeal.id,
          decision,
          response_message: responseMessage.trim(),
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      Alert.alert(
        'Success',
        decision === 'approved'
          ? 'Appeal approved - user has been unbanned.'
          : 'Appeal denied - user remains banned.'
      );

      setShowResponseModal(false);
      setSelectedAppeal(null);
      setResponseMessage('');
      loadAppeals();
    } catch (error: any) {
      console.error('Error responding to appeal:', error);
      Alert.alert('Error', error.message || 'Failed to respond to appeal.');
    } finally {
      setResponding(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Unknown';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const formatDuration = (hours: number | null) => {
    if (!hours) return 'Permanent';
    if (hours === 24) return '1 day';
    if (hours === 72) return '3 days';
    if (hours === 168) return '7 days';
    if (hours === 720) return '30 days';
    return `${hours} hours`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return { bg: '#FEF3C7', text: '#92400E', icon: 'clock-outline' };
      case 'approved':
        return { bg: '#D1FAE5', text: '#047857', icon: 'check-circle-outline' };
      case 'denied':
        return { bg: '#FEE2E2', text: '#DC2626', icon: 'close-circle-outline' };
      default:
        return { bg: '#F3F4F6', text: '#6B7280', icon: 'help-circle-outline' };
    }
  };

  const pendingCount = appeals.filter(a => a.appeal_status === 'pending').length;

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#A08AB7', '#B8A9DD']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ban Appeals</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A08AB7" />
        </View>
      </View>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#A08AB7', '#B8A9DD']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ban Appeals</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      {/* Filter tabs */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterTab, filterStatus === 'pending' && styles.filterTabActive]}
          onPress={() => setFilterStatus('pending')}
        >
          <Text style={[styles.filterTabText, filterStatus === 'pending' && styles.filterTabTextActive]}>
            Pending
          </Text>
          {pendingCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filterStatus === 'approved' && styles.filterTabActive]}
          onPress={() => setFilterStatus('approved')}
        >
          <Text style={[styles.filterTabText, filterStatus === 'approved' && styles.filterTabTextActive]}>
            Approved
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filterStatus === 'denied' && styles.filterTabActive]}
          onPress={() => setFilterStatus('denied')}
        >
          <Text style={[styles.filterTabText, filterStatus === 'denied' && styles.filterTabTextActive]}>
            Denied
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filterStatus === 'all' && styles.filterTabActive]}
          onPress={() => setFilterStatus('all')}
        >
          <Text style={[styles.filterTabText, filterStatus === 'all' && styles.filterTabTextActive]}>
            All
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#A08AB7" />
        }
      >
        {appeals.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="inbox-outline" size={64} color="#D1D5DB" />
            <Text style={styles.emptyStateText}>
              {filterStatus === 'pending' ? 'No pending appeals' : 'No appeals found'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              {filterStatus === 'pending'
                ? 'New appeals will appear here'
                : 'Appeals matching your filter will appear here'}
            </Text>
          </View>
        ) : (
          appeals.map((appeal) => {
            const statusStyle = getStatusColor(appeal.appeal_status);
            return (
              <View key={appeal.id} style={styles.appealCard}>
                {/* Header with status */}
                <View style={styles.appealHeader}>
                  <View style={styles.appealHeaderLeft}>
                    <MaterialCommunityIcons name="account-alert" size={24} color="#6B7280" />
                    <View style={{ marginLeft: 12, flex: 1 }}>
                      <Text style={styles.appealName}>
                        {appeal.banned_profile?.display_name || 'Unknown User'}
                      </Text>
                      <Text style={styles.appealEmail}>{appeal.banned_email || 'No email'}</Text>
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <MaterialCommunityIcons
                      name={statusStyle.icon as any}
                      size={14}
                      color={statusStyle.text}
                    />
                    <Text style={[styles.statusText, { color: statusStyle.text }]}>
                      {appeal.appeal_status.charAt(0).toUpperCase() + appeal.appeal_status.slice(1)}
                    </Text>
                  </View>
                </View>

                {/* Ban details */}
                <View style={styles.banDetailsContainer}>
                  <View style={styles.banDetailRow}>
                    <Text style={styles.banDetailLabel}>Ban Reason:</Text>
                    <Text style={styles.banDetailValue}>{appeal.ban_reason}</Text>
                  </View>
                  <View style={styles.banDetailRow}>
                    <Text style={styles.banDetailLabel}>Duration:</Text>
                    <Text style={styles.banDetailValue}>
                      {appeal.is_permanent ? 'Permanent' : formatDuration(appeal.ban_duration_hours)}
                    </Text>
                  </View>
                  <View style={styles.banDetailRow}>
                    <Text style={styles.banDetailLabel}>Banned By:</Text>
                    <Text style={styles.banDetailValue}>
                      {appeal.banner?.display_name || 'System'}
                    </Text>
                  </View>
                  <View style={styles.banDetailRow}>
                    <Text style={styles.banDetailLabel}>Banned At:</Text>
                    <Text style={styles.banDetailValue}>{formatDate(appeal.created_at)}</Text>
                  </View>
                </View>

                {/* Flagged photos for NSFW auto-bans */}
                {appeal.flagged_photos.length > 0 && (
                  <View style={styles.flaggedPhotosContainer}>
                    <Text style={styles.flaggedPhotosLabel}>
                      Flagged Photo{appeal.flagged_photos.length > 1 ? 's' : ''} ({appeal.flagged_photos.length})
                    </Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.flaggedPhotosScroll}>
                      {appeal.flagged_photos.map((photo, index) => (
                        <View key={index} style={styles.flaggedPhotoCard}>
                          <Image
                            source={{ uri: photo.url }}
                            style={styles.flaggedPhotoImage}
                            resizeMode="cover"
                          />
                          <View style={styles.flaggedPhotoInfo}>
                            <Text style={styles.flaggedPhotoConfidence}>
                              {Math.round(photo.confidence)}% confidence
                            </Text>
                            {photo.labels.slice(0, 3).map((label, i) => (
                              <Text key={i} style={styles.flaggedPhotoLabel}>{label}</Text>
                            ))}
                          </View>
                        </View>
                      ))}
                    </ScrollView>
                    <Text style={styles.flaggedPhotosHint}>
                      Review the photo to determine if this is a false positive
                    </Text>
                  </View>
                )}

                {/* User message from ban (if any) */}
                {appeal.user_message && (
                  <View style={styles.messageContainer}>
                    <Text style={styles.messageLabel}>Message to User:</Text>
                    <Text style={styles.messageText}>{appeal.user_message}</Text>
                  </View>
                )}

                {/* Appeal message */}
                <View style={[styles.messageContainer, styles.appealMessageContainer]}>
                  <Text style={styles.messageLabel}>Appeal Message:</Text>
                  <Text style={styles.messageText}>{appeal.appeal_message}</Text>
                  <Text style={styles.messageDate}>
                    Submitted: {formatDate(appeal.appeal_submitted_at)}
                  </Text>
                </View>

                {/* Response (if already responded) */}
                {appeal.appeal_response && (
                  <View style={[styles.messageContainer, styles.responseContainer]}>
                    <Text style={styles.messageLabel}>Admin Response:</Text>
                    <Text style={styles.messageText}>{appeal.appeal_response}</Text>
                    <Text style={styles.messageDate}>
                      By {appeal.responder?.display_name || 'Admin'} on{' '}
                      {formatDate(appeal.appeal_responded_at)}
                    </Text>
                  </View>
                )}

                {/* Action buttons for pending appeals */}
                {appeal.appeal_status === 'pending' && (
                  <View style={styles.actionButtons}>
                    <TouchableOpacity
                      style={styles.viewProfileButton}
                      onPress={() => router.push(`/profile/${appeal.banned_profile?.id}`)}
                    >
                      <MaterialCommunityIcons name="account-eye" size={18} color="#6B7280" />
                      <Text style={styles.viewProfileText}>View Profile</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.respondButton}
                      onPress={() => openResponseModal(appeal)}
                    >
                      <MaterialCommunityIcons name="reply" size={18} color="white" />
                      <Text style={styles.respondButtonText}>Respond</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Response Modal */}
      <Modal
        visible={showResponseModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowResponseModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Respond to Appeal</Text>
              <TouchableOpacity onPress={() => setShowResponseModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            {selectedAppeal && (
              <>
                <View style={styles.appealSummary}>
                  <Text style={styles.appealSummaryName}>
                    {selectedAppeal.banned_profile?.display_name}
                  </Text>
                  <Text style={styles.appealSummaryReason}>
                    Banned for: {selectedAppeal.ban_reason}
                  </Text>
                </View>

                {/* Show flagged photo in modal for review */}
                {selectedAppeal.flagged_photos.length > 0 && (
                  <View style={styles.modalPhotoContainer}>
                    <Text style={styles.modalPhotoLabel}>Flagged Photo:</Text>
                    <Image
                      source={{ uri: selectedAppeal.flagged_photos[0].url }}
                      style={styles.modalPhotoImage}
                      resizeMode="contain"
                    />
                    <Text style={styles.modalPhotoDetails}>
                      {selectedAppeal.flagged_photos[0].labels.join(', ')}
                    </Text>
                  </View>
                )}

                <View style={styles.appealQuoteContainer}>
                  <Text style={styles.appealQuoteLabel}>Their appeal:</Text>
                  <Text style={styles.appealQuoteText}>"{selectedAppeal.appeal_message}"</Text>
                </View>

                <Text style={styles.inputLabel}>Your Response</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Explain your decision to the user..."
                  value={responseMessage}
                  onChangeText={setResponseMessage}
                  multiline
                  numberOfLines={4}
                />

                {/* Quick response templates */}
                <View style={styles.templatesContainer}>
                  <Text style={styles.templatesLabel}>Quick responses:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <TouchableOpacity
                      style={styles.templateChip}
                      onPress={() =>
                        setResponseMessage(
                          'After reviewing your photo, we determined this was a false positive by our automated system. We apologize for the inconvenience and have restored your account.'
                        )
                      }
                    >
                      <Text style={styles.templateChipText}>Approve - False Positive</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.templateChip}
                      onPress={() =>
                        setResponseMessage(
                          'After reviewing your appeal and the evidence, we have decided to lift your ban. Please ensure you follow our community guidelines going forward.'
                        )
                      }
                    >
                      <Text style={styles.templateChipText}>Approve - Guidelines</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.templateChip}
                      onPress={() =>
                        setResponseMessage(
                          'We have reviewed your appeal carefully. Unfortunately, based on the severity of the violation, we cannot lift this ban at this time.'
                        )
                      }
                    >
                      <Text style={styles.templateChipText}>Deny - Severity</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.templateChip}
                      onPress={() =>
                        setResponseMessage(
                          'After a thorough review of your case, we have determined that your ban was appropriate given the circumstances. This decision is final.'
                        )
                      }
                    >
                      <Text style={styles.templateChipText}>Deny - Final</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </View>

                <View style={styles.decisionButtons}>
                  <TouchableOpacity
                    style={[styles.decisionButton, styles.denyButton, responding && styles.buttonDisabled]}
                    onPress={() => handleRespondToAppeal('denied')}
                    disabled={responding}
                  >
                    {responding ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="close-circle" size={20} color="white" />
                        <Text style={styles.decisionButtonText}>Deny Appeal</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.decisionButton,
                      styles.approveButton,
                      responding && styles.buttonDisabled,
                    ]}
                    onPress={() => handleRespondToAppeal('approved')}
                    disabled={responding}
                  >
                    {responding ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="check-circle" size={20} color="white" />
                        <Text style={styles.decisionButtonText}>Approve & Unban</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#F3E8FF',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#A08AB7',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 6,
  },
  badgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: 6,
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
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 8,
    textAlign: 'center',
  },
  appealCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  appealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  appealHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  appealName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  appealEmail: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  banDetailsContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  banDetailRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  banDetailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    width: 90,
  },
  banDetailValue: {
    fontSize: 13,
    color: '#111827',
    flex: 1,
  },
  messageContainer: {
    backgroundColor: '#FEF3C7',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  appealMessageContainer: {
    backgroundColor: '#F3E8FF',
  },
  responseContainer: {
    backgroundColor: '#D1FAE5',
  },
  messageLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 6,
  },
  messageText: {
    fontSize: 14,
    color: '#111827',
    lineHeight: 20,
  },
  messageDate: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  viewProfileButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  viewProfileText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  respondButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#A08AB7',
    borderRadius: 8,
  },
  respondButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  appealSummary: {
    marginBottom: 16,
  },
  appealSummaryName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  appealSummaryReason: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  appealQuoteContainer: {
    backgroundColor: '#F3E8FF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  appealQuoteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#A08AB7',
    marginBottom: 8,
  },
  appealQuoteText: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
    lineHeight: 22,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  templatesContainer: {
    marginBottom: 20,
  },
  templatesLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 8,
  },
  templateChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginRight: 8,
  },
  templateChipText: {
    fontSize: 13,
    color: '#374151',
  },
  decisionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  decisionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  denyButton: {
    backgroundColor: '#EF4444',
  },
  approveButton: {
    backgroundColor: '#10B981',
  },
  decisionButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: 'white',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  flaggedPhotosContainer: {
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  flaggedPhotosLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 8,
  },
  flaggedPhotosScroll: {
    marginBottom: 8,
  },
  flaggedPhotoCard: {
    marginRight: 12,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  flaggedPhotoImage: {
    width: 140,
    height: 180,
  },
  flaggedPhotoInfo: {
    padding: 8,
    width: 140,
  },
  flaggedPhotoConfidence: {
    fontSize: 12,
    fontWeight: '700',
    color: '#DC2626',
    marginBottom: 4,
  },
  flaggedPhotoLabel: {
    fontSize: 11,
    color: '#6B7280',
    lineHeight: 16,
  },
  flaggedPhotosHint: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  modalPhotoContainer: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalPhotoLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
    padding: 12,
    paddingBottom: 8,
  },
  modalPhotoImage: {
    width: '100%',
    height: 250,
    backgroundColor: '#F3F4F6',
  },
  modalPhotoDetails: {
    fontSize: 12,
    color: '#6B7280',
    padding: 12,
    paddingTop: 8,
  },
});
