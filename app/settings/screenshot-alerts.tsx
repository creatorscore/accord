import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, RefreshControl, Image } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { getMyScreenshotAlerts, markScreenshotAlertsAsViewed } from '@/lib/screenshot-tracking';
import { formatDistanceToNow } from 'date-fns';

interface ScreenshotEvent {
  id: string;
  screenshotter_profile_id: string;
  screenshot_profile_id: string;
  context: 'swipe_card' | 'profile_view' | 'chat';
  created_at: string;
  viewed: boolean;
  screenshotter: {
    id: string;
    display_name: string;
    photos: Array<{ url: string; is_primary: boolean }>;
  };
}

export default function ScreenshotAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<ScreenshotEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myProfileId, setMyProfileId] = useState<string | null>(null);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      // Get current user's profile ID
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (!profile) return;

      setMyProfileId(profile.id);

      // Load screenshot alerts
      const events = await getMyScreenshotAlerts(profile.id);
      setAlerts(events as ScreenshotEvent[]);

      // Mark as viewed
      await markScreenshotAlertsAsViewed(profile.id);
    } catch (error) {
      console.error('Error loading screenshot alerts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadAlerts();
  };

  const handleBlock = async (screenshotEvent: ScreenshotEvent) => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${screenshotEvent.screenshotter.display_name}? They will no longer be able to see your profile or contact you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!myProfileId) return;

              // Create block record
              const { error } = await supabase
                .from('blocks')
                .insert({
                  blocker_profile_id: myProfileId,
                  blocked_profile_id: screenshotEvent.screenshotter_profile_id,
                });

              if (error) throw error;

              Alert.alert('Blocked', `${screenshotEvent.screenshotter.display_name} has been blocked.`);

              // Reload alerts
              loadAlerts();
            } catch (error: any) {
              console.error('Error blocking user:', error);
              Alert.alert('Error', 'Failed to block user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const getContextLabel = (context: string) => {
    switch (context) {
      case 'swipe_card':
        return 'your swipe card';
      case 'profile_view':
        return 'your full profile';
      case 'chat':
        return 'your chat';
      default:
        return 'your profile';
    }
  };

  const getContextIcon = (context: string) => {
    switch (context) {
      case 'swipe_card':
        return 'cards';
      case 'profile_view':
        return 'account';
      case 'chat':
        return 'message';
      default:
        return 'shield-alert';
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center' }}>
        <MaterialCommunityIcons name="loading" size={32} color="#A08AB7" />
        <Text style={{ color: '#6B7280', marginTop: 16 }}>Loading alerts...</Text>
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
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginRight: 16 }}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111827' }}>
              Screenshot Alerts
            </Text>
            <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 4 }}>
              {alerts.length} {alerts.length === 1 ? 'alert' : 'alerts'}
            </Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 20 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#A08AB7" />
        }
      >
        {/* Info Card */}
        <View style={{
          backgroundColor: '#FEF3C7',
          borderRadius: 12,
          padding: 16,
          marginBottom: 20,
          borderWidth: 1,
          borderColor: '#FDE68A'
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <MaterialCommunityIcons name="information" size={20} color="#D97706" style={{ marginRight: 12, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#92400E', marginBottom: 4 }}>
                Screenshot Detection
              </Text>
              <Text style={{ fontSize: 13, color: '#78350F', lineHeight: 18 }}>
                On iOS, we detect when someone takes a screenshot of your profile. You'll be notified here so you can block them if needed. On Android, screenshots are completely blocked.
              </Text>
            </View>
          </View>
        </View>

        {/* Alerts List */}
        {alerts.length === 0 ? (
          <View style={{
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 60
          }}>
            <MaterialCommunityIcons name="shield-check" size={64} color="#D1D5DB" />
            <Text style={{ fontSize: 18, fontWeight: '600', color: '#6B7280', marginTop: 16 }}>
              No Screenshot Alerts
            </Text>
            <Text style={{ fontSize: 14, color: '#9CA3AF', marginTop: 8, textAlign: 'center' }}>
              You'll be notified here when someone{'\n'}takes a screenshot of your profile
            </Text>
          </View>
        ) : (
          alerts.map((alert) => {
            const primaryPhoto = alert.screenshotter.photos?.find(p => p.is_primary)?.url ||
                                alert.screenshotter.photos?.[0]?.url;

            return (
              <View
                key={alert.id}
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
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                  {/* Profile Photo */}
                  <View style={{ marginRight: 12 }}>
                    {primaryPhoto ? (
                      <Image
                        source={{ uri: primaryPhoto }}
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          backgroundColor: '#F3F4F6',
                        }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          backgroundColor: '#E5E7EB',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <MaterialCommunityIcons name="account" size={32} color="#9CA3AF" />
                      </View>
                    )}

                    {/* Screenshot Icon Badge */}
                    <View
                      style={{
                        position: 'absolute',
                        bottom: -4,
                        right: -4,
                        backgroundColor: '#EF4444',
                        borderRadius: 12,
                        width: 24,
                        height: 24,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderWidth: 2,
                        borderColor: 'white',
                      }}
                    >
                      <MaterialCommunityIcons name="camera" size={12} color="white" />
                    </View>
                  </View>

                  {/* Content */}
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827', flex: 1 }}>
                        {alert.screenshotter.display_name}
                      </Text>
                      <MaterialCommunityIcons
                        name={getContextIcon(alert.context)}
                        size={16}
                        color="#9CA3AF"
                        style={{ marginLeft: 8 }}
                      />
                    </View>

                    <Text style={{ fontSize: 14, color: '#6B7280', marginBottom: 8 }}>
                      Took a screenshot of {getContextLabel(alert.context)}
                    </Text>

                    <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
                      {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                    </Text>

                    {/* Actions */}
                    <View style={{ flexDirection: 'row', marginTop: 12, gap: 8 }}>
                      <TouchableOpacity
                        onPress={() => router.push(`/profile/${alert.screenshotter.id}`)}
                        style={{
                          flex: 1,
                          backgroundColor: '#F3F4F6',
                          paddingVertical: 8,
                          paddingHorizontal: 16,
                          borderRadius: 8,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>
                          View Profile
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleBlock(alert)}
                        style={{
                          flex: 1,
                          backgroundColor: '#FEE2E2',
                          paddingVertical: 8,
                          paddingHorizontal: 16,
                          borderRadius: 8,
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ fontSize: 14, fontWeight: '600', color: '#DC2626' }}>
                          Block User
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}
