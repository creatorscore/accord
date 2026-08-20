import { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, RefreshControl, Image } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { getSignedUrls } from '@/lib/signed-urls';
import { formatDistanceToNow } from 'date-fns';
import { toUserMessage } from '@/lib/error-messages';

type Tab = 'scam' | 'location';

interface PhotoLite { url: string; is_primary: boolean; display_order: number; storage_path?: string | null; blur_data_uri?: string | null }

interface FlaggedUser {
  id: string;
  display_name: string;
  is_active: boolean;
  photos: PhotoLite[];
  // scam
  scam_signal_count?: number;
  scam_flag_categories?: string[] | null;
  scam_flagged_at?: string | null;
  // location
  location_flag_reason?: string | null;
  location_source?: string | null;
  location_city?: string | null;
  location_country?: string | null;
  ip_country?: string | null;
  location_updated_at?: string | null;
  // enforcement
  discovery_suppressed?: boolean;
  discovery_suppressed_reason?: string | null;
}

const CATEGORY_LABEL: Record<string, string> = {
  crypto_investment: 'Crypto / investment',
  money_transfer: 'Money transfer',
  off_platform_move: 'Off-platform',
};

export default function AdminScamReview() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [tab, setTab] = useState<Tab>('scam');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<FlaggedUser[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  // Distinguish a genuinely-empty result from a failed load so an error never
  // masquerades as "Nothing flagged".
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => { checkAdminStatus(); }, []);
  useEffect(() => { if (isAdmin) load(tab); }, [isAdmin, tab]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles').select('is_admin').eq('user_id', user?.id).single();
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

  const load = useCallback(async (which: Tab) => {
    try {
      setLoading(true);
      setLoadError(null);

      // Admin-gated SECURITY DEFINER RPC. Bypasses per-row RLS, fetches only the
      // primary photo's path (index-only, no fat blur_data_uri), and runs under a
      // 15s statement timeout — the direct PostgREST query timed out (~5.5s cold)
      // against the authenticated role's 8s limit.
      const { data, error } = await supabase.rpc('admin_list_flagged', { p_kind: which, p_limit: 100 });
      if (error) throw error;

      const raw = (data || []) as Array<Record<string, any>>;

      // Batch-sign the primary photo paths (private bucket), one round-trip.
      const paths = raw.map((r) => r.primary_photo_path).filter(Boolean) as string[];
      const signedByPath = new Map<string, string>();
      if (paths.length) {
        const signed = await getSignedUrls('profile-photos', paths);
        paths.forEach((p, i) => { if (signed[i]) signedByPath.set(p, signed[i]!); });
      }

      const rows: FlaggedUser[] = raw.map((r) => {
        const signedUrl = r.primary_photo_path ? signedByPath.get(r.primary_photo_path) : undefined;
        return {
          ...(r as FlaggedUser),
          photos: signedUrl ? [{ url: signedUrl, is_primary: true, display_order: 0 }] : [],
        };
      });
      setUsers(rows);
    } catch (error: any) {
      console.error('Error loading flagged accounts:', error);
      setLoadError(toUserMessage(error, 'Failed to load flagged accounts.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = () => { setRefreshing(true); load(tab); };

  const dismiss = (u: FlaggedUser) => {
    Alert.alert(
      'Dismiss flag',
      `Clear the ${tab === 'scam' ? 'scam' : 'location'} flag for ${u.display_name}? This treats it as a false positive.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Dismiss', style: 'default', onPress: () => executeDismiss(u) },
      ],
    );
  };

  const executeDismiss = async (u: FlaggedUser) => {
    setActing(u.id);
    try {
      const rpc = tab === 'scam' ? 'admin_clear_scam_flag' : 'admin_clear_location_flag';
      const { error } = await supabase.rpc(rpc, { p_profile_id: u.id });
      if (error) throw error;
      setUsers((prev) => prev.filter((x) => x.id !== u.id));
    } catch (error: any) {
      console.error('Error dismissing flag:', error);
      Alert.alert('Error', toUserMessage(error, 'Failed to dismiss flag.'));
    } finally {
      setActing(null);
    }
  };

  const getPrimaryPhoto = (photos: PhotoLite[]) => {
    if (!photos || photos.length === 0) return null;
    const primary = photos.find((p) => p.is_primary);
    if (primary) return primary.url;
    return [...photos].sort((a, b) => a.display_order - b.display_order)[0]?.url || null;
  };

  const renderHeader = () => (
    <LinearGradient colors={['#A08AB7', '#B8A9DD']} style={styles.header}>
      <TouchableOpacity onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Anti-Scam Review</Text>
      <TouchableOpacity onPress={handleRefresh}>
        <MaterialCommunityIcons name="refresh" size={24} color="white" />
      </TouchableOpacity>
    </LinearGradient>
  );

  if (!isAdmin) {
    return <View style={styles.container}>{renderHeader()}</View>;
  }

  return (
    <View style={styles.container}>
      {renderHeader()}

      {/* Segmented toggle */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'scam' && styles.tabActive]}
          onPress={() => setTab('scam')}
        >
          <MaterialCommunityIcons name="message-alert" size={18} color={tab === 'scam' ? '#fff' : '#A08AB7'} />
          <Text style={[styles.tabText, tab === 'scam' && styles.tabTextActive]}>Scam signals</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'location' && styles.tabActive]}
          onPress={() => setTab('location')}
        >
          <MaterialCommunityIcons name="map-marker-alert" size={18} color={tab === 'location' ? '#fff' : '#A08AB7'} />
          <Text style={[styles.tabText, tab === 'location' && styles.tabTextActive]}>Location</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="shield-alert" size={26} color="#EF4444" />
          <Text style={styles.statNumber}>{users.length}{users.length === 100 ? '+' : ''}</Text>
          <Text style={styles.statLabel}>{tab === 'scam' ? 'Flagged senders' : 'Flagged locations'}</Text>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A08AB7" />
        </View>
      ) : (
        <ScrollView
          style={styles.scrollView}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
        >
          {loadError ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="alert-circle" size={64} color="#EF4444" />
              <Text style={styles.emptyText}>Couldn’t load</Text>
              <Text style={styles.emptySubtext}>{loadError}</Text>
              <TouchableOpacity
                style={[styles.dismissButton, { marginTop: 20, paddingHorizontal: 24, flex: 0 }]}
                onPress={() => load(tab)}
              >
                <MaterialCommunityIcons name="refresh" size={20} color="white" />
                <Text style={styles.dismissButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : users.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="check-circle" size={64} color="#10B981" />
              <Text style={styles.emptyText}>Nothing flagged</Text>
              <Text style={styles.emptySubtext}>No accounts currently need review here</Text>
            </View>
          ) : (
            users.map((u) => (
              <View key={u.id} style={styles.userCard}>
                <TouchableOpacity style={styles.userInfo} onPress={() => router.push(`/profile/${u.id}`)}>
                  {getPrimaryPhoto(u.photos) ? (
                    <Image source={{ uri: getPrimaryPhoto(u.photos)! }} style={styles.userPhoto} />
                  ) : (
                    <View style={[styles.userPhoto, styles.noPhoto]}>
                      <MaterialCommunityIcons name="account" size={30} color="#9CA3AF" />
                    </View>
                  )}
                  <View style={styles.userDetails}>
                    <Text style={styles.userName}>{u.display_name}</Text>

                    {u.discovery_suppressed && (
                      <View style={styles.statusBadges}>
                        <View style={[styles.badge, { backgroundColor: '#DC2626', flexDirection: 'row', alignItems: 'center' }]}>
                          <MaterialCommunityIcons name="eye-off" size={11} color="white" />
                          <Text style={[styles.badgeText, { marginLeft: 4 }]}>Auto-hidden from discovery</Text>
                        </View>
                      </View>
                    )}

                    {tab === 'scam' ? (
                      <>
                        <Text style={styles.userReason}>
                          Reported by {u.scam_signal_count ?? 0} distinct {(u.scam_signal_count ?? 0) === 1 ? 'match' : 'matches'}
                        </Text>
                        <View style={styles.statusBadges}>
                          {(u.scam_flag_categories || []).map((c) => (
                            <View key={c} style={[styles.badge, { backgroundColor: '#7C3AED' }]}>
                              <Text style={styles.badgeText}>{CATEGORY_LABEL[c] || c}</Text>
                            </View>
                          ))}
                        </View>
                        {u.scam_flagged_at && (
                          <Text style={styles.userDate}>Flagged {formatDistanceToNow(new Date(u.scam_flagged_at), { addSuffix: true })}</Text>
                        )}
                      </>
                    ) : (
                      <>
                        <Text style={styles.userReason} numberOfLines={3}>
                          {u.location_flag_reason || 'No reason recorded'}
                        </Text>
                        <View style={styles.statusBadges}>
                          {u.location_source && (
                            <View style={[styles.badge, { backgroundColor: u.location_source === 'gps' ? '#6B7280' : '#F59E0B' }]}>
                              <Text style={styles.badgeText}>src: {u.location_source}</Text>
                            </View>
                          )}
                          {u.ip_country && (
                            <View style={[styles.badge, { backgroundColor: '#2563EB' }]}>
                              <Text style={styles.badgeText}>IP {u.ip_country}</Text>
                            </View>
                          )}
                          {(u.location_city || u.location_country) && (
                            <View style={[styles.badge, { backgroundColor: '#374151' }]}>
                              <Text style={styles.badgeText}>
                                says {[u.location_city, u.location_country].filter(Boolean).join(', ')}
                              </Text>
                            </View>
                          )}
                        </View>
                      </>
                    )}

                    {!u.is_active && (
                      <View style={styles.statusBadges}>
                        <View style={[styles.badge, { backgroundColor: '#6B7280' }]}>
                          <Text style={styles.badgeText}>Inactive</Text>
                        </View>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>

                <View style={styles.actions}>
                  <TouchableOpacity style={styles.viewButton} onPress={() => router.push(`/profile/${u.id}`)}>
                    <MaterialCommunityIcons name="eye" size={20} color="#A08AB7" />
                    <Text style={styles.viewButtonText}>View</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.dismissButton, acting === u.id && styles.disabledButton]}
                    onPress={() => dismiss(u)}
                    disabled={acting === u.id}
                  >
                    {acting === u.id ? (
                      <ActivityIndicator size="small" color="white" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="check" size={20} color="white" />
                        <Text style={styles.dismissButtonText}>Dismiss</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 60, paddingBottom: 20, paddingHorizontal: 20,
  },
  headerTitle: { fontSize: 20, fontWeight: '600', color: 'white' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#A08AB7', backgroundColor: 'white',
  },
  tabActive: { backgroundColor: '#A08AB7' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#A08AB7' },
  tabTextActive: { color: 'white' },
  statsContainer: { flexDirection: 'row', padding: 16, gap: 12 },
  statCard: {
    flex: 1, backgroundColor: 'white', borderRadius: 12, padding: 16, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  statNumber: { fontSize: 24, fontWeight: '700', color: '#1F2937', marginTop: 8 },
  statLabel: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  scrollView: { flex: 1, paddingHorizontal: 16 },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginTop: 16 },
  emptySubtext: { fontSize: 14, color: '#6B7280', marginTop: 8 },
  userCard: {
    backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  userInfo: { flexDirection: 'row', marginBottom: 12 },
  userPhoto: { width: 60, height: 60, borderRadius: 30, marginRight: 12 },
  noPhoto: { backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center' },
  userDetails: { flex: 1 },
  userName: { fontSize: 16, fontWeight: '600', color: '#1F2937' },
  userReason: { fontSize: 13, color: '#6B7280', marginTop: 4 },
  userDate: { fontSize: 12, color: '#9CA3AF', marginTop: 4 },
  statusBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: '600', color: 'white' },
  actions: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 12 },
  viewButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#A08AB7', gap: 6,
  },
  viewButtonText: { fontSize: 14, fontWeight: '600', color: '#A08AB7' },
  dismissButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderRadius: 8, backgroundColor: '#10B981', gap: 6,
  },
  dismissButtonText: { fontSize: 14, fontWeight: '600', color: 'white' },
  disabledButton: { opacity: 0.6 },
});
