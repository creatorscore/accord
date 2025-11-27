import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, RefreshControl, TextInput, Modal } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { sendBanNotification } from '@/lib/notifications';

interface Ban {
  id: string;
  banned_email: string | null;
  banned_phone_hash: string | null;
  banned_device_id: string | null;
  ban_reason: string;
  is_permanent: boolean | null;
  expires_at: string | null;
  created_at: string | null;
  banned_profile: {
    display_name: string;
  } | null;
  banner: {
    display_name: string;
  } | null;
}

export default function AdminBans() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bans, setBans] = useState<Ban[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showAddBanModal, setShowAddBanModal] = useState(false);
  const [newBanEmail, setNewBanEmail] = useState('');
  const [newBanReason, setNewBanReason] = useState('');
  const [addingBan, setAddingBan] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadBans();
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

  const loadBans = async () => {
    try {
      setLoading(true);

      const { data, error} = await supabase
        .from('bans')
        .select(`
          id,
          banned_email,
          banned_phone_hash,
          banned_device_id,
          ban_reason,
          is_permanent,
          expires_at,
          created_at,
          banned_profile:banned_profile_id(display_name),
          banner:banned_by(display_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the data to handle Supabase joined data (returns arrays)
      const transformedBans: Ban[] = (data || []).map((ban: any) => ({
        id: ban.id,
        banned_email: ban.banned_email,
        banned_phone_hash: ban.banned_phone_hash,
        banned_device_id: ban.banned_device_id,
        ban_reason: ban.ban_reason,
        is_permanent: ban.is_permanent,
        expires_at: ban.expires_at,
        created_at: ban.created_at,
        banned_profile: Array.isArray(ban.banned_profile) ? ban.banned_profile[0] || null : ban.banned_profile,
        banner: Array.isArray(ban.banner) ? ban.banner[0] || null : ban.banner,
      }));

      setBans(transformedBans);
    } catch (error: any) {
      console.error('Error loading bans:', error);
      Alert.alert('Error', 'Failed to load bans.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadBans();
  };

  const handleUnban = (banId: string) => {
    Alert.alert(
      'Unban User',
      'Are you sure you want to remove this ban? The user will be able to register again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unban',
          style: 'destructive',
          onPress: () => executeUnban(banId),
        },
      ]
    );
  };

  const executeUnban = async (banId: string) => {
    try {
      const { error } = await supabase
        .from('bans')
        .delete()
        .eq('id', banId);

      if (error) throw error;

      Alert.alert('Success', 'Ban has been removed.');
      loadBans();
    } catch (error: any) {
      console.error('Error unbanning:', error);
      Alert.alert('Error', 'Failed to remove ban.');
    }
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) {
      console.log('Search query is empty');
      return;
    }

    console.log('🔍 Searching for:', searchQuery.trim());
    setSearching(true);
    try {
      // Use RPC function to search users (includes email from auth.users)
      const { data: results, error } = await supabase.rpc('search_users_for_ban', {
        search_name: searchQuery.trim(),
      });

      console.log('🔍 Search results:', results);
      console.log('🔍 Search error:', error);

      if (error) throw error;

      // Map to expected format
      const formattedResults = results?.map((result: any) => ({
        id: result.profile_id,
        user_id: result.user_id,
        display_name: result.display_name,
        email: result.email || 'Email not found',
        phone: result.phone || null,
        device_id: result.device_id,
        is_active: result.is_active,
      })) || [];

      console.log('✅ Formatted results:', formattedResults.length, 'users found');
      setSearchResults(formattedResults);
    } catch (error: any) {
      console.error('❌ Error searching users:', error);
      Alert.alert('Error', error.message || 'Failed to search users');
    } finally {
      setSearching(false);
    }
  };

  const handleBanFromSearch = (selectedUser: any) => {
    // Pre-fill the ban modal with the selected user's email
    setNewBanEmail(selectedUser.email);
    setShowSearchModal(false);
    setShowAddBanModal(true);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleAddBan = async () => {
    if (!newBanEmail.trim()) {
      Alert.alert('Error', 'Please enter an email address.');
      return;
    }

    if (!newBanReason.trim()) {
      Alert.alert('Error', 'Please enter a ban reason.');
      return;
    }

    setAddingBan(true);
    try {
      // Get admin profile
      const { data: adminProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!adminProfile) throw new Error('Admin profile not found');

      const emailToCheck = newBanEmail.toLowerCase().trim();

      // Step 1: Check if user exists by email using RPC function
      let existingUser = null;
      let existingUserProfile = null;

      try {
        // Use our RPC function to get user by email (it can access auth.users)
        const { data: searchResults, error: searchError } = await supabase.rpc('get_user_by_email', {
          search_email: emailToCheck,
        });

        if (searchError) {
          console.error('Error searching users:', searchError);
        } else if (searchResults && searchResults.length > 0) {
          const matchedUser = searchResults[0];

          existingUser = {
            id: matchedUser.user_id,
            email: matchedUser.email
          };
          existingUserProfile = {
            id: matchedUser.profile_id,
            user_id: matchedUser.user_id,
            device_id: matchedUser.device_id,
            display_name: matchedUser.display_name,
            phone_number: matchedUser.phone || null,
          };

          console.log('✅ Found existing user:', matchedUser.display_name);
        } else {
          console.log('ℹ️ No user found with email:', emailToCheck);
        }
      } catch (searchError) {
        console.log('Error searching for user:', searchError);
      }

      if (existingUser && existingUserProfile) {
        // USER EXISTS - Execute full ban using Edge Function
        console.log('⚠️ User exists - executing full ban via Edge Function');

        // Get current session for Edge Function auth
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error('No active session');
        }

        // Call admin-ban-user Edge Function (handles auth ban, profile deactivation, ban record creation)
        const { data: banResponse, error: banError } = await supabase.functions.invoke('admin-ban-user', {
          body: {
            banned_profile_id: existingUserProfile.id,
            ban_reason: `Manually banned by admin: ${newBanReason.trim()}`,
            banned_by_profile_id: adminProfile.id,
            admin_notes: `Manual ban from bans.tsx of existing user "${existingUserProfile.display_name}"`,
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        console.log('🔍 Edge Function response:', { banResponse, banError });

        if (banError) {
          // Try to read the response body from the error context
          let errorBody = null;
          try {
            if (banError.context && banError.context._bodyInit) {
              const response = banError.context;
              if (response && !response.bodyUsed) {
                errorBody = await response.json();
                console.log('🔍 Parsed error body:', errorBody);
              }
            }
          } catch (parseError) {
            console.warn('⚠️ Could not parse error body:', parseError);
          }

          // Show detailed error from Edge Function
          const errorDetails = errorBody?.error || banError.message;
          const errorContext = errorBody?.details || '';
          const searchedId = errorBody?.searched_for_id || '';
          const rawError = errorBody?.raw_error || '';

          throw new Error(
            `Failed to ban user: ${errorDetails}\n` +
            `Details: ${errorContext}\n` +
            `Searched for ID: ${searchedId}\n` +
            `Raw error: ${JSON.stringify(rawError)}`
          );
        }

        if (!banResponse || !banResponse.success) {
          console.error('Ban failed:', banResponse);
          throw new Error('Failed to ban user in authentication system');
        }

        console.log('✅ User banned successfully via Edge Function:', banResponse);

        // Step 2d: Send ban notifications (push + email)
        try {
          // Send push notification
          await sendBanNotification(existingUserProfile.id, newBanReason.trim());

          // Send email notification
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            await supabase.functions.invoke('send-ban-email', {
              body: {
                email: emailToCheck,
                displayName: existingUserProfile.display_name,
                banReason: newBanReason.trim(),
              },
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });
          }

          console.log('✅ Ban notifications sent (push + email)');
        } catch (notifError) {
          console.error('⚠️ Failed to send ban notifications:', notifError);
          // Don't block the ban if notifications fail
        }

        Alert.alert(
          '✅ User Banned',
          `${existingUserProfile.display_name} (${emailToCheck}) has been completely banned:\n\n• Auth banned: ${banResponse.auth_banned ? '✅' : '❌'}\n• Profile deactivated: ${banResponse.profile_deactivated ? '✅' : '❌'}\n• Ban record created: ${banResponse.ban_record_created ? '✅' : '❌'}\n• Sessions terminated: ✅\n• Notifications sent`
        );
      } else {
        // USER DOESN'T EXIST - Create preventive ban
        console.log('ℹ️ No existing user - creating preventive ban');

        const { error } = await supabase
          .from('bans')
          .insert({
            banned_email: emailToCheck,
            ban_reason: newBanReason.trim(),
            banned_by: adminProfile.id,
            is_permanent: true,
            admin_notes: 'Preventive ban - user does not exist yet',
          });

        if (error) throw error;

        Alert.alert(
          '✅ Preventive Ban Added',
          `${emailToCheck} has been banned and cannot register in the future.`
        );
      }

      // Reset form and reload
      setShowAddBanModal(false);
      setNewBanEmail('');
      setNewBanReason('');
      loadBans();
    } catch (error: any) {
      console.error('Error adding ban:', error);
      Alert.alert('Error', error.message || 'Failed to add ban.');
    } finally {
      setAddingBan(false);
    }
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

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#9B87CE', '#B8A9DD']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Ban Management</Text>
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
        <Text style={styles.headerTitle}>Ban Management</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity onPress={() => setShowSearchModal(true)}>
            <MaterialCommunityIcons name="account-search" size={24} color="white" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowAddBanModal(true)}>
            <MaterialCommunityIcons name="plus-circle" size={24} color="white" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="shield-off" size={32} color="#EF4444" />
          <Text style={styles.statNumber}>{bans.length}</Text>
          <Text style={styles.statLabel}>Total Bans</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="email-off" size={32} color="#F59E0B" />
          <Text style={styles.statNumber}>{bans.filter(b => b.banned_email).length}</Text>
          <Text style={styles.statLabel}>Email Bans</Text>
        </View>
        <View style={styles.statCard}>
          <MaterialCommunityIcons name="phone-off" size={32} color="#8B5CF6" />
          <Text style={styles.statNumber}>{bans.filter(b => b.banned_phone_hash).length}</Text>
          <Text style={styles.statLabel}>Phone Bans</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#9B87CE" />
        }
      >
        {bans.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="shield-check" size={64} color="#D1D5DB" />
            <Text style={styles.emptyStateText}>No bans yet</Text>
            <Text style={styles.emptyStateSubtext}>Banned users will appear here</Text>
          </View>
        ) : (
          bans.map((ban) => (
            <View key={ban.id} style={styles.banCard}>
              {/* Header */}
              <View style={styles.banHeader}>
                <View style={styles.banHeaderLeft}>
                  <MaterialCommunityIcons name="account-cancel" size={24} color="#EF4444" />
                  <View style={{ marginLeft: 12, flex: 1 }}>
                    <Text style={styles.banEmail}>{ban.banned_email || 'Manual Ban'}</Text>
                    {ban.banned_profile && (
                      <Text style={styles.banSubtext}>{ban.banned_profile.display_name}</Text>
                    )}
                  </View>
                </View>
              </View>

              {/* Ban Identifiers */}
              <View style={styles.identifiersContainer}>
                {ban.banned_email && (
                  <View style={styles.identifier}>
                    <MaterialCommunityIcons name="email" size={16} color="#6B7280" />
                    <Text style={styles.identifierText}>Email</Text>
                  </View>
                )}
                {ban.banned_phone_hash && (
                  <View style={styles.identifier}>
                    <MaterialCommunityIcons name="phone" size={16} color="#6B7280" />
                    <Text style={styles.identifierText}>Phone</Text>
                  </View>
                )}
                {ban.banned_device_id && (
                  <View style={styles.identifier}>
                    <MaterialCommunityIcons name="cellphone" size={16} color="#6B7280" />
                    <Text style={styles.identifierText}>Device</Text>
                  </View>
                )}
              </View>

              {/* Reason */}
              <View style={styles.reasonContainer}>
                <Text style={styles.reasonLabel}>Reason:</Text>
                <Text style={styles.reasonText}>{ban.ban_reason}</Text>
              </View>

              {/* Meta */}
              <View style={styles.metaContainer}>
                <Text style={styles.metaText}>
                  Banned by: {ban.banner?.display_name || 'System'}
                </Text>
                <Text style={styles.metaText}>
                  {ban.created_at ? formatDate(ban.created_at) : 'Unknown date'}
                </Text>
              </View>

              {/* Unban Button */}
              <TouchableOpacity
                style={styles.unbanButton}
                onPress={() => handleUnban(ban.id)}
              >
                <MaterialCommunityIcons name="account-check" size={18} color="#10B981" />
                <Text style={styles.unbanButtonText}>Unban</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Search User Modal */}
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
          <View style={[styles.modalContent, { maxHeight: '80%', minHeight: 400 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Search User to Ban</Text>
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
                style={[styles.modalButton, styles.banButton, { flex: 0, paddingHorizontal: 16 }]}
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

            {/* Search Results */}
            <View style={{ flex: 1, minHeight: 200 }}>
              <ScrollView contentContainerStyle={{ paddingBottom: 20 }}>
              {console.log('📱 Rendering search results UI, count:', searchResults.length)}
              {searchResults.length === 0 && searchQuery && !searching && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <MaterialCommunityIcons name="account-off" size={48} color="#D1D5DB" />
                  <Text style={{ color: '#6B7280', marginTop: 12 }}>No users found</Text>
                </View>
              )}

              {searchResults.length > 0 && (
                <View style={{ paddingTop: 8 }}>
                  <Text style={{ fontSize: 12, color: '#6B7280', marginBottom: 8, paddingHorizontal: 4 }}>
                    {searchResults.length} user{searchResults.length > 1 ? 's' : ''} found - tap to ban
                  </Text>
                </View>
              )}

              {searchResults.map((user, index) => {
                console.log('🎨 Rendering user card:', index, user.display_name);
                return (
                  <TouchableOpacity
                    key={user.id}
                    style={styles.searchResultCard}
                    onPress={() => handleBanFromSearch(user)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.searchResultName}>{user.display_name}</Text>
                      <Text style={styles.searchResultEmail}>{user.email}</Text>
                      <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                        {user.device_id && (
                          <View style={styles.identifier}>
                            <MaterialCommunityIcons name="cellphone" size={12} color="#6B7280" />
                            <Text style={styles.identifierText}>Device</Text>
                          </View>
                        )}
                        {user.phone && (
                          <View style={styles.identifier}>
                            <MaterialCommunityIcons name="phone" size={12} color="#6B7280" />
                            <Text style={styles.identifierText}>Phone</Text>
                          </View>
                        )}
                        {!user.is_active && (
                          <View style={[styles.identifier, { backgroundColor: '#FEE2E2' }]}>
                            <MaterialCommunityIcons name="account-off" size={12} color="#DC2626" />
                            <Text style={[styles.identifierText, { color: '#DC2626' }]}>Inactive</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={24} color="#9B87CE" />
                  </TouchableOpacity>
                );
              })}
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Ban Modal */}
      <Modal
        visible={showAddBanModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddBanModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Manual Ban</Text>
              <TouchableOpacity onPress={() => setShowAddBanModal(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.inputLabel}>Email Address</Text>
            <TextInput
              style={styles.input}
              placeholder="user@example.com"
              value={newBanEmail}
              onChangeText={setNewBanEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.inputLabel}>Ban Reason</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g., Terms of service violation"
              value={newBanReason}
              onChangeText={setNewBanReason}
              multiline
              numberOfLines={3}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowAddBanModal(false)}
                disabled={addingBan}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.banButton, addingBan && styles.buttonDisabled]}
                onPress={handleAddBan}
                disabled={addingBan}
              >
                {addingBan ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="account-cancel" size={18} color="white" />
                    <Text style={styles.banButtonText}>Add Ban</Text>
                  </>
                )}
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
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
  banCard: {
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
  banHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  banHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  banEmail: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  banSubtext: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  identifiersContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  identifier: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  identifierText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  reasonContainer: {
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  reasonLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  metaText: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  unbanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
  },
  unbanButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10B981',
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
    marginBottom: 16,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  banButton: {
    backgroundColor: '#EF4444',
  },
  banButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  buttonDisabled: {
    opacity: 0.5,
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
  searchResultEmail: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
});
