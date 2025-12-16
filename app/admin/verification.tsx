import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, RefreshControl, TextInput, Modal } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface VerificationUser {
  id: string;
  display_name: string;
  photo_verification_attempts: number;
  photo_verification_status: string | null;
  photo_verified: boolean;
  location_city: string | null;
  location_state: string | null;
  email?: string;
}

export default function AdminVerification() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<VerificationUser[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<VerificationUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadVerificationUsers();
    }
  }, [isAdmin]);

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

  const loadVerificationUsers = async () => {
    try {
      setLoading(true);

      // Load users who have attempted verification
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, photo_verification_attempts, photo_verification_status, photo_verified, location_city, location_state')
        .gt('photo_verification_attempts', 0)
        .order('photo_verification_attempts', { ascending: false });

      if (error) throw error;

      setUsers(data || []);
    } catch (error: any) {
      console.error('Error loading verification users:', error);
      Alert.alert('Error', 'Failed to load verification data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadVerificationUsers();
  };

  const handleResetVerification = (userId: string, displayName: string) => {
    Alert.alert(
      'Reset Verification',
      `Reset photo verification attempts for ${displayName}? They will be able to try again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'default',
          onPress: () => executeReset(userId, displayName),
        },
      ]
    );
  };

  const executeReset = async (profileId: string, displayName: string) => {
    setResetting(profileId);
    try {
      // Get auth token for the Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      // Call the admin-reset-verification Edge Function
      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xcaktvlosjsaxcntxbyf.supabase.co'}/functions/v1/admin-reset-verification`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ profileId }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to reset verification');
      }

      Alert.alert('Success', `Verification reset for ${displayName}. They have been notified.`);
      loadVerificationUsers();
    } catch (error: any) {
      console.error('Error resetting verification:', error);
      Alert.alert('Error', error.message || 'Failed to reset verification.');
    } finally {
      setResetting(null);
    }
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) return;

    setSearching(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, photo_verification_attempts, photo_verification_status, photo_verified, location_city, location_state')
        .ilike('display_name', `%${searchQuery.trim()}%`)
        .limit(20);

      if (error) throw error;

      setSearchResults(data || []);
    } catch (error: any) {
      console.error('Error searching users:', error);
      Alert.alert('Error', 'Failed to search users.');
    } finally {
      setSearching(false);
    }
  };

  const getStatusColor = (status: string | null, verified: boolean) => {
    if (verified) return '#10B981';
    if (status === 'failed') return '#EF4444';
    if (status === 'pending') return '#F59E0B';
    return '#6B7280';
  };

  const getStatusText = (status: string | null, verified: boolean, attempts: number) => {
    if (verified) return 'Verified';
    if (attempts >= 5) return 'Max Attempts';
    if (status === 'failed') return 'Failed';
    if (status === 'pending') return 'Pending';
    return 'Not Started';
  };

  const stats = {
    total: users.length,
    verified: users.filter(u => u.photo_verified).length,
    failed: users.filter(u => !u.photo_verified && u.photo_verification_status === 'failed').length,
    maxAttempts: users.filter(u => u.photo_verification_attempts >= 5 && !u.photo_verified).length,
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#9B87CE', '#B8A9DD']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Verification</Text>
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
        <Text style={styles.headerTitle}>Photo Verification</Text>
        <TouchableOpacity onPress={() => setShowSearchModal(true)}>
          <MaterialCommunityIcons name="account-search" size={24} color="white" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="account-multiple" size={28} color="#9B87CE" />
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Attempted</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="check-decagram" size={28} color="#10B981" />
          <Text style={styles.statNumber}>{stats.verified}</Text>
          <Text style={styles.statLabel}>Verified</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="close-circle" size={28} color="#EF4444" />
          <Text style={styles.statNumber}>{stats.failed}</Text>
          <Text style={styles.statLabel}>Failed</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="lock" size={28} color="#F59E0B" />
          <Text style={styles.statNumber}>{stats.maxAttempts}</Text>
          <Text style={styles.statLabel}>Blocked</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#9B87CE" />
        }
      >
        {users.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="camera-account" size={64} color="#D1D5DB" />
            <Text style={styles.emptyStateText}>No verification attempts</Text>
            <Text style={styles.emptyStateSubtext}>Users who attempt verification will appear here</Text>
          </View>
        ) : (
          users.map((u) => (
            <View key={u.id} style={styles.userCard}>
              <View style={styles.userHeader}>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>{u.display_name}</Text>
                  <Text style={styles.userLocation}>
                    {u.location_city ? `${u.location_city}, ${u.location_state}` : 'Location not set'}
                  </Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusColor(u.photo_verification_status, u.photo_verified) + '20' }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(u.photo_verification_status, u.photo_verified) }]}>
                    {getStatusText(u.photo_verification_status, u.photo_verified, u.photo_verification_attempts)}
                  </Text>
                </View>
              </View>

              <View style={styles.attemptsContainer}>
                <MaterialCommunityIcons name="reload" size={16} color="#6B7280" />
                <Text style={styles.attemptsText}>
                  {u.photo_verification_attempts}/5 attempts used
                </Text>
                {u.photo_verification_attempts >= 5 && !u.photo_verified && (
                  <View style={styles.blockedBadge}>
                    <MaterialCommunityIcons name="lock" size={12} color="#DC2626" />
                    <Text style={styles.blockedText}>Blocked</Text>
                  </View>
                )}
              </View>

              {!u.photo_verified && (
                <TouchableOpacity
                  style={[styles.resetButton, resetting === u.id && styles.buttonDisabled]}
                  onPress={() => handleResetVerification(u.id, u.display_name)}
                  disabled={resetting === u.id}
                >
                  {resetting === u.id ? (
                    <ActivityIndicator size="small" color="#9B87CE" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="refresh" size={18} color="#9B87CE" />
                      <Text style={styles.resetButtonText}>Reset Attempts</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Search Modal */}
      <Modal
        visible={showSearchModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowSearchModal(false);
          setSearchQuery('');
          setSearchResults([]);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search Users</Text>
              <TouchableOpacity onPress={() => {
                setShowSearchModal(false);
                setSearchQuery('');
                setSearchResults([]);
              }}>
                <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Search by Name</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              <TextInput
                style={[styles.input, { flex: 1, marginBottom: 0 }]}
                placeholder="Enter display name..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="words"
                autoCorrect={false}
                onSubmitEditing={handleSearchUsers}
              />
              <TouchableOpacity
                style={[styles.searchButton, (!searchQuery.trim() || searching) && styles.buttonDisabled]}
                onPress={handleSearchUsers}
                disabled={searching || !searchQuery.trim()}
              >
                {searching ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <MaterialCommunityIcons name="magnify" size={20} color="white" />
                )}
              </TouchableOpacity>
            </View>

            <ScrollView style={{ flex: 1 }}>
              {searchResults.length === 0 && searchQuery && !searching && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <MaterialCommunityIcons name="account-off" size={48} color="#D1D5DB" />
                  <Text style={{ color: '#6B7280', marginTop: 12 }}>No users found</Text>
                </View>
              )}

              {searchResults.map((u) => (
                <View key={u.id} style={styles.searchResultCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.searchResultName}>{u.display_name}</Text>
                    <Text style={styles.searchResultMeta}>
                      {u.photo_verification_attempts}/5 attempts • {getStatusText(u.photo_verification_status, u.photo_verified, u.photo_verification_attempts)}
                    </Text>
                  </View>
                  {!u.photo_verified && (
                    <TouchableOpacity
                      style={styles.resetButtonSmall}
                      onPress={() => {
                        setShowSearchModal(false);
                        setSearchQuery('');
                        setSearchResults([]);
                        handleResetVerification(u.id, u.display_name);
                      }}
                    >
                      <MaterialCommunityIcons name="refresh" size={16} color="#9B87CE" />
                    </TouchableOpacity>
                  )}
                  {u.photo_verified && (
                    <MaterialCommunityIcons name="check-decagram" size={24} color="#10B981" />
                  )}
                </View>
              ))}
            </ScrollView>
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
  statsContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 4,
  },
  statLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
    textAlign: 'center',
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
  },
  userCard: {
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
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  userLocation: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  attemptsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  attemptsText: {
    fontSize: 14,
    color: '#6B7280',
  },
  blockedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    marginLeft: 8,
  },
  blockedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#DC2626',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
  },
  resetButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9B87CE',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    minHeight: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
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
  },
  searchButton: {
    backgroundColor: '#9B87CE',
    borderRadius: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchResultCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  searchResultMeta: {
    fontSize: 12,
    color: '#6B7280',
  },
  resetButtonSmall: {
    padding: 8,
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
  },
});
