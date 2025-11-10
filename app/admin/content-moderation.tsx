import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl, Image, TextInput } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface Report {
  id: string;
  reporter_profile_id: string;
  reported_profile_id: string;
  reason: string;
  details: string;
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  reporter: {
    id: string;
    display_name: string;
    photos: Array<{ url: string; is_primary: boolean }>;
  };
  reported: {
    id: string;
    display_name: string;
    user_id: string;
    photos: Array<{ url: string; is_primary: boolean }>;
  };
}

export default function ContentModeration() {
  const { user } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewing' | 'resolved' | 'dismissed'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  const [adminProfileId, setAdminProfileId] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, is_admin')
        .eq('user_id', user?.id)
        .single();

      if (!profile?.is_admin) {
        Alert.alert('Access Denied', 'You do not have admin access');
        router.back();
        return;
      }

      setIsAdmin(true);
      setAdminProfileId(profile.id);
      loadReports();
    } catch (error) {
      console.error('Error checking admin access:', error);
      router.back();
    }
  };

  const loadReports = async () => {
    try {
      let query = supabase
        .from('reports')
        .select(`
          *,
          reporter:reporter_profile_id (
            id,
            display_name,
            photos (url, is_primary)
          ),
          reported:reported_profile_id (
            id,
            display_name,
            user_id,
            photos (url, is_primary)
          )
        `)
        .order('created_at', { ascending: false });

      // Apply status filter
      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) throw error;

      setReports(data as Report[] || []);
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadReports();
    }
  }, [filter, isAdmin]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadReports();
  };

  const updateReportStatus = async (reportId: string, status: 'reviewing' | 'resolved' | 'dismissed') => {
    try {
      const { error } = await supabase
        .from('reports')
        .update({
          status,
          reviewed_by: adminProfileId,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', reportId);

      if (error) throw error;

      Alert.alert('Success', `Report marked as ${status}`);
      loadReports();
    } catch (error) {
      console.error('Error updating report:', error);
      Alert.alert('Error', 'Failed to update report status');
    }
  };

  const handleBanUser = async (report: Report) => {
    Alert.alert(
      'Ban User',
      `Are you sure you want to ban ${report.reported.display_name}? This will permanently remove them from the platform.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban User',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete the user's auth account (will cascade delete profile)
              const { error: deleteError } = await supabase.auth.admin.deleteUser(
                report.reported.user_id
              );

              if (deleteError) throw deleteError;

              // Mark report as resolved
              await updateReportStatus(report.id, 'resolved');

              Alert.alert('Success', 'User has been banned and removed from the platform');
            } catch (error: any) {
              console.error('Error banning user:', error);
              Alert.alert('Error', 'Failed to ban user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getReasonLabel = (reason: string) => {
    const labels: { [key: string]: string } = {
      harassment: 'Harassment',
      fake_profile: 'Fake Profile',
      inappropriate_content: 'Inappropriate Content',
      scam: 'Scam',
      other: 'Other',
    };
    return labels[reason] || reason;
  };

  const getReasonIcon = (reason: string) => {
    const icons: { [key: string]: string } = {
      harassment: 'alert-circle',
      fake_profile: 'account-alert',
      inappropriate_content: 'image-off',
      scam: 'cash-remove',
      other: 'help-circle',
    };
    return icons[reason] || 'flag';
  };

  const getReasonColor = (reason: string) => {
    const colors: { [key: string]: string } = {
      harassment: '#DC2626',
      fake_profile: '#EA580C',
      inappropriate_content: '#D97706',
      scam: '#EF4444',
      other: '#6B7280',
    };
    return colors[reason] || '#6B7280';
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: '#F59E0B',
      reviewing: '#3B82F6',
      resolved: '#10B981',
      dismissed: '#6B7280',
    };
    return colors[status] || '#6B7280';
  };

  const filteredReports = reports.filter(report => {
    if (!searchQuery) return true;
    return report.reported.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           report.reporter.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           report.details?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="loading" size={32} color="#9B87CE" />
        <Text style={{ color: '#6B7280', marginTop: 16 }}>Loading reports...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
      {/* Header */}
      <View style={{
        backgroundColor: 'white',
        paddingTop: 60,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB'
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 16 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827' }}>
              Content Moderation
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>
              {filteredReports.length} {filteredReports.length === 1 ? 'report' : 'reports'}
            </Text>
          </View>
        </View>

        {/* Search */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: '#F3F4F6',
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 8,
          marginBottom: 12
        }}>
          <MaterialCommunityIcons name="magnify" size={20} color="#6B7280" />
          <TextInput
            style={{ flex: 1, marginLeft: 8, fontSize: 16, color: '#111827' }}
            placeholder="Search reports..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Filter Tabs */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {['pending', 'reviewing', 'resolved', 'dismissed', 'all'].map((status) => (
              <TouchableOpacity
                key={status}
                onPress={() => setFilter(status as any)}
                style={{
                  paddingVertical: 8,
                  paddingHorizontal: 16,
                  borderRadius: 20,
                  backgroundColor: filter === status ? '#9B87CE' : '#F3F4F6',
                }}
              >
                <Text style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: filter === status ? 'white' : '#6B7280',
                  textTransform: 'capitalize',
                }}>
                  {status}
                  {status !== 'all' && reports.filter(r => r.status === status).length > 0 && (
                    ` (${reports.filter(r => r.status === status).length})`
                  )}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#9B87CE" />
        }
      >
        {filteredReports.length === 0 ? (
          <View style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 60
          }}>
            <MaterialCommunityIcons name="shield-check" size={64} color="#D1D5DB" />
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#6B7280', marginTop: 16 }}>
              No Reports
            </Text>
            <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 8 }}>
              {filter === 'all' ? 'No reports have been submitted' : `No ${filter} reports`}
            </Text>
          </View>
        ) : (
          filteredReports.map((report) => {
            const reporterPhoto = report.reporter.photos?.find(p => p.is_primary)?.url ||
                                  report.reporter.photos?.[0]?.url;
            const reportedPhoto = report.reported.photos?.find(p => p.is_primary)?.url ||
                                 report.reported.photos?.[0]?.url;

            return (
              <View
                key={report.id}
                style={{
                  backgroundColor: 'white',
                  borderRadius: 16,
                  padding: 16,
                  marginBottom: 16,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.1,
                  shadowRadius: 3,
                  elevation: 2,
                  borderLeftWidth: 4,
                  borderLeftColor: getReasonColor(report.reason),
                }}
              >
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <MaterialCommunityIcons
                    name={getReasonIcon(report.reason) as any}
                    size={20}
                    color={getReasonColor(report.reason)}
                    style={{ marginRight: 8 }}
                  />
                  <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 }}>
                    {getReasonLabel(report.reason)}
                  </Text>
                  <View style={{
                    backgroundColor: `${getStatusColor(report.status)}20`,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                  }}>
                    <Text style={{
                      fontSize: 11,
                      fontWeight: '600',
                      color: getStatusColor(report.status),
                      textTransform: 'capitalize',
                    }}>
                      {report.status}
                    </Text>
                  </View>
                </View>

                {/* Reporter → Reported */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  {/* Reporter */}
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    {reporterPhoto ? (
                      <Image
                        source={{ uri: reporterPhoto }}
                        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6' }}
                      />
                    ) : (
                      <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#E5E7EB',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <MaterialCommunityIcons name="account" size={24} color="#9CA3AF" />
                      </View>
                    )}
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#111827', marginTop: 4 }}>
                      {report.reporter.display_name}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#6B7280' }}>Reporter</Text>
                  </View>

                  {/* Arrow */}
                  <View style={{ paddingHorizontal: 12 }}>
                    <MaterialCommunityIcons name="arrow-right" size={20} color="#DC2626" />
                  </View>

                  {/* Reported */}
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    {reportedPhoto ? (
                      <Image
                        source={{ uri: reportedPhoto }}
                        style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6' }}
                      />
                    ) : (
                      <View style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: '#E5E7EB',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <MaterialCommunityIcons name="account" size={24} color="#9CA3AF" />
                      </View>
                    )}
                    <Text style={{ fontSize: 12, fontWeight: '600', color: '#111827', marginTop: 4 }}>
                      {report.reported.display_name}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#6B7280' }}>Reported</Text>
                  </View>
                </View>

                {/* Details */}
                {report.details && (
                  <View style={{
                    backgroundColor: '#F9FAFB',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 12,
                  }}>
                    <Text style={{ fontSize: 13, color: '#374151', lineHeight: 18 }}>
                      "{report.details}"
                    </Text>
                  </View>
                )}

                {/* Timestamp */}
                <Text style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>
                  Reported {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
                </Text>

                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => router.push(`/profile/${report.reported.id}`)}
                    style={{
                      flex: 1,
                      backgroundColor: '#F3F4F6',
                      paddingVertical: 10,
                      paddingHorizontal: 12,
                      borderRadius: 8,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>
                      View Profile
                    </Text>
                  </TouchableOpacity>

                  {report.status === 'pending' && (
                    <TouchableOpacity
                      onPress={() => updateReportStatus(report.id, 'reviewing')}
                      style={{
                        flex: 1,
                        backgroundColor: '#DBEAFE',
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        borderRadius: 8,
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 13, fontWeight: '600', color: '#1D4ED8' }}>
                        Review
                      </Text>
                    </TouchableOpacity>
                  )}

                  {(report.status === 'pending' || report.status === 'reviewing') && (
                    <>
                      <TouchableOpacity
                        onPress={() => updateReportStatus(report.id, 'dismissed')}
                        style={{
                          flex: 1,
                          backgroundColor: '#F3F4F6',
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#6B7280' }}>
                          Dismiss
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleBanUser(report)}
                        style={{
                          flex: 1,
                          backgroundColor: '#FEE2E2',
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          borderRadius: 8,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#DC2626' }}>
                          🔨 Ban
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
