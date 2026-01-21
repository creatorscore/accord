import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, RefreshControl, Image } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { formatDistanceToNow } from 'date-fns';

interface PhotoReviewUser {
  id: string;
  display_name: string;
  photo_review_required: boolean;
  photo_review_reason: string | null;
  photo_review_requested_at: string | null;
  photo_verification_status: string | null;
  is_active: boolean;
  photos: Array<{ url: string; is_primary: boolean; display_order: number }>;
}

export default function AdminPhotoReviews() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState<PhotoReviewUser[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [clearing, setClearing] = useState<string | null>(null);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadPhotoReviewUsers();
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

  const loadPhotoReviewUsers = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          photo_review_required,
          photo_review_reason,
          photo_review_requested_at,
          photo_verification_status,
          is_active,
          photos (url, is_primary, display_order)
        `)
        .eq('photo_review_required', true)
        .order('photo_review_requested_at', { ascending: false });

      if (error) throw error;

      setUsers(data || []);
    } catch (error: any) {
      console.error('Error loading photo review users:', error);
      Alert.alert('Error', 'Failed to load users pending photo review.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadPhotoReviewUsers();
  };

  const handleClearPhotoReview = (profileId: string, displayName: string) => {
    Alert.alert(
      'Approve Photos',
      `Approve photos for ${displayName}? They will become visible in discovery again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve',
          style: 'default',
          onPress: () => executeClearPhotoReview(profileId, displayName),
        },
      ]
    );
  };

  const executeClearPhotoReview = async (profileId: string, displayName: string) => {
    setClearing(profileId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('No active session');
      }

      const response = await fetch(
        `${process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xcaktvlosjsaxcntxbyf.supabase.co'}/functions/v1/admin-clear-photo-review`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ profile_id: profileId }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to clear photo review');
      }

      Alert.alert('Success', `Photos approved for ${displayName}. They have been notified and are now visible in discovery.`);
      loadPhotoReviewUsers();
    } catch (error: any) {
      console.error('Error clearing photo review:', error);
      Alert.alert('Error', error.message || 'Failed to clear photo review.');
    } finally {
      setClearing(null);
    }
  };

  const handleViewProfile = (profileId: string) => {
    router.push(`/profile/${profileId}`);
  };

  const getPrimaryPhoto = (photos: PhotoReviewUser['photos']) => {
    if (!photos || photos.length === 0) return null;
    const primary = photos.find(p => p.is_primary);
    if (primary) return primary.url;
    const sorted = [...photos].sort((a, b) => a.display_order - b.display_order);
    return sorted[0]?.url || null;
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#9B87CE', '#B8A9DD']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Photo Reviews</Text>
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
        <Text style={styles.headerTitle}>Photo Reviews</Text>
        <TouchableOpacity onPress={handleRefresh}>
          <MaterialCommunityIcons name="refresh" size={24} color="white" />
        </TouchableOpacity>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="image-search" size={28} color="#F59E0B" />
          <Text style={styles.statNumber}>{users.length}</Text>
          <Text style={styles.statLabel}>Pending Review</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {users.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="check-circle" size={64} color="#10B981" />
            <Text style={styles.emptyText}>No profiles pending photo review</Text>
            <Text style={styles.emptySubtext}>All flagged profiles have been reviewed</Text>
          </View>
        ) : (
          users.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <TouchableOpacity
                style={styles.userInfo}
                onPress={() => handleViewProfile(user.id)}
              >
                {getPrimaryPhoto(user.photos) ? (
                  <Image
                    source={{ uri: getPrimaryPhoto(user.photos)! }}
                    style={styles.userPhoto}
                  />
                ) : (
                  <View style={[styles.userPhoto, styles.noPhoto]}>
                    <MaterialCommunityIcons name="account" size={30} color="#9CA3AF" />
                  </View>
                )}
                <View style={styles.userDetails}>
                  <Text style={styles.userName}>{user.display_name}</Text>
                  <Text style={styles.userReason} numberOfLines={2}>
                    {user.photo_review_reason || 'No reason provided'}
                  </Text>
                  {user.photo_review_requested_at && (
                    <Text style={styles.userDate}>
                      Flagged {formatDistanceToNow(new Date(user.photo_review_requested_at), { addSuffix: true })}
                    </Text>
                  )}
                  <View style={styles.statusBadges}>
                    {user.photo_verification_status === 'admin_required' && (
                      <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
                        <Text style={styles.badgeText}>ID Required</Text>
                      </View>
                    )}
                    {!user.is_active && (
                      <View style={[styles.badge, { backgroundColor: '#6B7280' }]}>
                        <Text style={styles.badgeText}>Inactive</Text>
                      </View>
                    )}
                  </View>
                </View>
              </TouchableOpacity>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.viewButton}
                  onPress={() => handleViewProfile(user.id)}
                >
                  <MaterialCommunityIcons name="eye" size={20} color="#9B87CE" />
                  <Text style={styles.viewButtonText}>View</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.approveButton, clearing === user.id && styles.disabledButton]}
                  onPress={() => handleClearPhotoReview(user.id, user.display_name)}
                  disabled={clearing === user.id}
                >
                  {clearing === user.id ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="check" size={20} color="white" />
                      <Text style={styles.approveButtonText}>Approve</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
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
    fontWeight: '600',
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
  },
  userCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  userPhoto: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 12,
  },
  noPhoto: {
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  userReason: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 4,
  },
  userDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 4,
  },
  statusBadges: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'white',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  viewButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9B87CE',
    gap: 6,
  },
  viewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9B87CE',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#10B981',
    gap: 6,
  },
  approveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'white',
  },
  disabledButton: {
    opacity: 0.6,
  },
});
