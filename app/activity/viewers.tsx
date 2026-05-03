import { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileData } from '@/contexts/ProfileDataContext';
import { SafeBlurImage } from '@/components/shared/SafeBlurImage';
import { signPhotoUrls } from '@/lib/signed-urls';

interface Viewer {
  viewer_profile_id: string;
  viewed_at: string;
  display_name: string;
  age: number;
  location_city: string | null;
  location_state: string | null;
  photo_url: string | null;
  photo_blur_enabled: boolean;
}

export default function ProfileViewers() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const profileData = useProfileData();
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadViewers();
  }, []);

  const loadViewers = async () => {
    try {
      const profileId = profileData?.profileId;
      if (!profileId) return;

      const { data, error } = await supabase.rpc('get_profile_viewers', {
        p_profile_id: profileId,
        p_limit: 50,
      });

      if (error) throw error;

      // Sign photo URLs
      if (data && data.length > 0) {
        const photosToSign = data
          .filter((v: any) => v.photo_url)
          .map((v: any) => ({ url: v.photo_url, storage_path: v.photo_url }));

        if (photosToSign.length > 0) {
          const signed = await signPhotoUrls(photosToSign);
          const signedMap = new Map(photosToSign.map((p: any, i: number) => [p.url, signed[i]?.url]));
          data.forEach((v: any) => {
            if (v.photo_url && signedMap.has(v.photo_url)) {
              v.photo_url = signedMap.get(v.photo_url);
            }
          });
        }
      }

      setViewers(data || []);
    } catch (error) {
      console.error('Error loading viewers:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const renderViewer = ({ item }: { item: Viewer }) => (
    <TouchableOpacity
      onPress={() => router.push(`/profile/${item.viewer_profile_id}`)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
      }}
      activeOpacity={0.7}
    >
      <View style={{ width: 56, height: 56, borderRadius: 28, overflow: 'hidden', backgroundColor: '#E5E7EB' }}>
        {item.photo_url ? (
          <SafeBlurImage
            source={{ uri: item.photo_url }}
            style={{ width: 56, height: 56 }}
            resizeMode="cover"
            blurRadius={item.photo_blur_enabled ? 20 : 0}
          />
        ) : (
          <View style={{ width: 56, height: 56, alignItems: 'center', justifyContent: 'center' }}>
            <MaterialCommunityIcons name="account" size={32} color="#9CA3AF" />
          </View>
        )}
      </View>

      <View style={{ flex: 1, marginLeft: 14 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
          {item.display_name}, {item.age}
        </Text>
        {(item.location_city || item.location_state) && (
          <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
            {[item.location_city, item.location_state].filter(Boolean).join(', ')}
          </Text>
        )}
      </View>

      <Text style={{ fontSize: 12, color: '#9CA3AF' }}>
        {formatTime(item.viewed_at)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {/* Header */}
      <View style={{
        paddingTop: insets.top + 12,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
        flexDirection: 'row',
        alignItems: 'center',
      }}>
        <TouchableOpacity onPress={() => router.back()} style={{ marginRight: 16 }}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827' }}>
            Who Viewed You
          </Text>
          <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
            {loading ? 'Loading...' : `${viewers.length} ${viewers.length === 1 ? 'person' : 'people'} this week`}
          </Text>
        </View>
        <View style={{ padding: 8, backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: 12 }}>
          <MaterialCommunityIcons name="eye" size={22} color="#F59E0B" />
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#A08AB7" />
        </View>
      ) : viewers.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <MaterialCommunityIcons name="eye-off-outline" size={64} color="#D1D5DB" />
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 16, textAlign: 'center' }}>
            No views yet
          </Text>
          <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
            When someone views your profile, they'll appear here. Make sure your profile is complete to attract more views!
          </Text>
        </View>
      ) : (
        <FlatList
          data={viewers}
          keyExtractor={(item) => item.viewer_profile_id}
          renderItem={renderViewer}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        />
      )}
    </View>
  );
}
