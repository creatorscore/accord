import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl, Image, TextInput } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatDistanceToNow } from 'date-fns';

interface ScreenshotEvent {
  id: string;
  screenshotter_profile_id: string;
  screenshot_profile_id: string;
  context: 'swipe_card' | 'profile_view' | 'chat';
  created_at: string;
  platform: string;
  screenshotter: {
    id: string;
    display_name: string;
    user_id: string;
    photos: Array<{ url: string; is_primary: boolean }>;
  };
  screenshot_profile: {
    id: string;
    display_name: string;
    photos: Array<{ url: string; is_primary: boolean }>;
  };
}

export default function ScreenshotMonitor() {
  const { user } = useAuth();
  const [events, setEvents] = useState<ScreenshotEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'repeat_offenders'>('all');

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', user?.id)
        .single();

      if (!profile?.is_admin) {
        Alert.alert('Access Denied', 'You do not have admin access');
        router.back();
        return;
      }

      setIsAdmin(true);
      loadEvents();
    } catch (error) {
      console.error('Error checking admin access:', error);
      router.back();
    }
  };

  const loadEvents = async () => {
    try {
      let query = supabase
        .from('screenshot_events')
        .select(`
          *,
          screenshotter:screenshotter_profile_id (
            id,
            display_name,
            user_id,
            photos (url, is_primary)
          ),
          screenshot_profile:screenshot_profile_id (
            id,
            display_name,
            photos (url, is_primary)
          )
        `)
        .order('created_at', { ascending: false });

      if (filter === 'repeat_offenders') {
        // Get users with more than 3 screenshot events
        const { data: offenders } = await supabase
          .from('screenshot_events')
          .select('screenshotter_profile_id')
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

        if (offenders) {
          const counts: { [key: string]: number } = {};
          offenders.forEach(o => {
            counts[o.screenshotter_profile_id] = (counts[o.screenshotter_profile_id] || 0) + 1;
          });

          const repeatOffenderIds = Object.keys(counts).filter(id => counts[id] > 3);
          query = query.in('screenshotter_profile_id', repeatOffenderIds);
        }
      }

      query = query.limit(100);

      const { data, error } = await query;

      if (error) throw error;

      setEvents(data as ScreenshotEvent[] || []);
    } catch (error) {
      console.error('Error loading screenshot events:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadEvents();
  };

  const handleBanUser = async (event: ScreenshotEvent) => {
    Alert.alert(
      'Ban User',
      `Are you sure you want to ban ${event.screenshotter.display_name}? This will permanently remove them from the platform.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Ban User',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete the user's auth account (will cascade delete profile)
              const { error: deleteError } = await supabase.auth.admin.deleteUser(
                event.screenshotter.user_id
              );

              if (deleteError) throw deleteError;

              Alert.alert('Success', 'User has been banned and removed from the platform');
              loadEvents();
            } catch (error: any) {
              console.error('Error banning user:', error);
              Alert.alert('Error', 'Failed to ban user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getScreenshotCount = (profileId: string) => {
    return events.filter(e => e.screenshotter_profile_id === profileId).length;
  };

  const getContextLabel = (context: string) => {
    switch (context) {
      case 'swipe_card':
        return 'Swipe Card';
      case 'profile_view':
        return 'Profile View';
      case 'chat':
        return 'Chat';
      default:
        return context;
    }
  };

  const filteredEvents = events.filter(event => {
    if (!searchQuery) return true;
    return event.screenshotter.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           event.screenshot_profile.display_name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (!isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="loading" size={32} color="#9B87CE" />
        <Text style={{ color: '#6B7280', marginTop: 16 }}>Loading screenshot events...</Text>
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
              Screenshot Monitor
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>
              {events.length} total events
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
            placeholder="Search by name..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Filter Tabs */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity
            onPress={() => setFilter('all')}
            style={{
              flex: 1,
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: filter === 'all' ? '#9B87CE' : '#F3F4F6',
              alignItems: 'center',
            }}
          >
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: filter === 'all' ? 'white' : '#6B7280'
            }}>
              All Events
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              setFilter('repeat_offenders');
              loadEvents();
            }}
            style={{
              flex: 1,
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 8,
              backgroundColor: filter === 'repeat_offenders' ? '#EF4444' : '#F3F4F6',
              alignItems: 'center',
            }}
          >
            <Text style={{
              fontSize: 14,
              fontWeight: '600',
              color: filter === 'repeat_offenders' ? 'white' : '#6B7280'
            }}>
              Repeat Offenders (3+)
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#9B87CE" />
        }
      >
        {filteredEvents.length === 0 ? (
          <View style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 60
          }}>
            <MaterialCommunityIcons name="shield-check" size={64} color="#D1D5DB" />
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#6B7280', marginTop: 16 }}>
              No Screenshot Events
            </Text>
          </View>
        ) : (
          filteredEvents.map((event) => {
            const screenshotterPhoto = event.screenshotter.photos?.find(p => p.is_primary)?.url ||
                                       event.screenshotter.photos?.[0]?.url;
            const victimPhoto = event.screenshot_profile.photos?.find(p => p.is_primary)?.url ||
                               event.screenshot_profile.photos?.[0]?.url;
            const screenshotCount = getScreenshotCount(event.screenshotter_profile_id);

            return (
              <View
                key={event.id}
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
                  borderLeftColor: screenshotCount > 3 ? '#EF4444' : '#9B87CE',
                }}
              >
                {/* Header with count badge */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: '#6B7280', flex: 1 }}>
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                  </Text>
                  {screenshotCount > 1 && (
                    <View style={{
                      backgroundColor: screenshotCount > 3 ? '#FEE2E2' : '#FEF3C7',
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 12,
                    }}>
                      <Text style={{
                        fontSize: 11,
                        fontWeight: '600',
                        color: screenshotCount > 3 ? '#DC2626' : '#D97706'
                      }}>
                        {screenshotCount} screenshots
                      </Text>
                    </View>
                  )}
                </View>

                {/* Screenshotter → Victim */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  {/* Screenshotter */}
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    {screenshotterPhoto ? (
                      <Image
                        source={{ uri: screenshotterPhoto }}
                        style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6' }}
                      />
                    ) : (
                      <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: '#E5E7EB',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <MaterialCommunityIcons name="account" size={28} color="#9CA3AF" />
                      </View>
                    )}
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827', marginTop: 4 }}>
                      {event.screenshotter.display_name}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#6B7280' }}>Screenshotter</Text>
                  </View>

                  {/* Arrow */}
                  <View style={{ paddingHorizontal: 12 }}>
                    <MaterialCommunityIcons name="camera" size={20} color="#EF4444" />
                  </View>

                  {/* Victim */}
                  <View style={{ alignItems: 'center', flex: 1 }}>
                    {victimPhoto ? (
                      <Image
                        source={{ uri: victimPhoto }}
                        style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6' }}
                      />
                    ) : (
                      <View style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        backgroundColor: '#E5E7EB',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        <MaterialCommunityIcons name="account" size={28} color="#9CA3AF" />
                      </View>
                    )}
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827', marginTop: 4 }}>
                      {event.screenshot_profile.display_name}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#6B7280' }}>Victim</Text>
                  </View>
                </View>

                {/* Context & Platform */}
                <View style={{
                  flexDirection: 'row',
                  backgroundColor: '#F9FAFB',
                  borderRadius: 8,
                  padding: 8,
                  marginBottom: 12,
                  gap: 8
                }}>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#6B7280' }}>Context</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
                      {getContextLabel(event.context)}
                    </Text>
                  </View>
                  <View style={{ width: 1, backgroundColor: '#E5E7EB' }} />
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#6B7280' }}>Platform</Text>
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827' }}>
                      {event.platform === 'ios' ? 'iOS' : 'Android'}
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    onPress={() => router.push(`/profile/${event.screenshotter.id}`)}
                    style={{
                      flex: 1,
                      backgroundColor: '#F3F4F6',
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 8,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#374151' }}>
                      View Profile
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleBanUser(event)}
                    style={{
                      flex: 1,
                      backgroundColor: '#FEE2E2',
                      paddingVertical: 10,
                      paddingHorizontal: 16,
                      borderRadius: 8,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '600', color: '#DC2626' }}>
                      🔨 Ban User
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
