import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { signPhotoUrls } from '@/lib/signed-urls';

interface BlockedUser {
  id: string;
  blocked_profile_id: string;
  created_at: string;
  profile: {
    id: string;
    display_name: string;
    age: number;
    photo_url?: string;
    is_verified?: boolean;
    location_city?: string;
  };
}

export default function BlockedUsers() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [unblocking, setUnblocking] = useState<string | null>(null);

  useEffect(() => {
    loadCurrentProfile();
  }, []);

  useEffect(() => {
    if (currentProfileId) {
      loadBlockedUsers();
    }
  }, [currentProfileId]);

  const loadCurrentProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setCurrentProfileId(data.id);
    } catch (error: any) {
      console.error('Error loading profile:', error);
      Alert.alert(t('common.error'), t('settings.blockedUsers.loadProfileError'));
    }
  };

  const loadBlockedUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('blocks')
        .select(`
          id,
          blocked_profile_id,
          created_at,
          blocked_profile:profiles!blocks_blocked_profile_id_fkey (
            id,
            display_name,
            age,
            is_verified,
            location_city,
            photos (
              url,
              storage_path,
              is_primary,
              display_order,
              blur_data_uri
            )
          )
        `)
        .eq('blocker_profile_id', currentProfileId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Collect all primary photos for batch signing
      const allPrimaryPhotos: { storage_path?: string | null; url?: string | null }[] = [];
      const photoIndexMap: number[] = []; // maps block index → allPrimaryPhotos index (-1 if none)

      const blocks = data || [];
      for (let i = 0; i < blocks.length; i++) {
        const photos = (blocks[i] as any).blocked_profile.photos?.sort(
          (a: any, b: any) => a.display_order - b.display_order
        );
        const primaryPhoto = photos?.find((p: any) => p.is_primary) || photos?.[0];
        if (primaryPhoto) {
          photoIndexMap.push(allPrimaryPhotos.length);
          allPrimaryPhotos.push(primaryPhoto);
        } else {
          photoIndexMap.push(-1);
        }
      }

      // Batch sign all photos
      const signedPhotos = allPrimaryPhotos.length > 0
        ? await signPhotoUrls(allPrimaryPhotos)
        : [];

      // Transform the data to include signed photo_url
      const transformedData = blocks.map((block: any, i: number) => {
        const photoIdx = photoIndexMap[i];
        const signedPhotoUrl = (photoIdx >= 0 ? signedPhotos[photoIdx]?.url : undefined) ?? undefined;

        return {
          id: block.id,
          blocked_profile_id: block.blocked_profile_id,
          created_at: block.created_at,
          profile: {
            id: block.blocked_profile.id,
            display_name: block.blocked_profile.display_name,
            age: block.blocked_profile.age,
            photo_url: signedPhotoUrl,
            is_verified: block.blocked_profile.is_verified,
            location_city: block.blocked_profile.location_city,
          },
        };
      });

      setBlockedUsers(transformedData || []);
    } catch (error: any) {
      console.error('Error loading blocked users:', error);
      Alert.alert(t('common.error'), t('settings.blockedUsers.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleUnblock = async (block: BlockedUser) => {
    Alert.alert(
      t('settings.blockedUsers.unblockTitle'),
      t('settings.blockedUsers.unblockConfirm', { name: block.profile.display_name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.blockedUsers.unblock'),
          style: 'default',
          onPress: async () => {
            setUnblocking(block.id);

            try {
              const { error } = await supabase
                .from('blocks')
                .delete()
                .eq('id', block.id);

              if (error) throw error;

              // Remove from local state
              setBlockedUsers((prev) => prev.filter((b) => b.id !== block.id));

              Alert.alert(
                t('settings.blockedUsers.unblocked'),
                t('settings.blockedUsers.unblockedMsg', { name: block.profile.display_name })
              );
            } catch (error: any) {
              console.error('Error unblocking user:', error);
              Alert.alert(t('common.error'), t('settings.blockedUsers.unblockError'));
            } finally {
              setUnblocking(null);
            }
          },
        },
      ]
    );
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('common.time.today');
    if (diffDays === 1) return t('common.time.yesterday');
    if (diffDays < 7) return t('common.time.daysAgo', { count: diffDays });
    if (diffDays < 30) return t('common.time.weeksAgo', { count: Math.floor(diffDays / 7) });
    if (diffDays < 365) return t('common.time.monthsAgo', { count: Math.floor(diffDays / 30) });
    return t('common.time.yearsAgo', { count: Math.floor(diffDays / 365) });
  };

  const renderBlockedUser = ({ item }: { item: BlockedUser }) => (
    <View style={styles.userCard}>
      <Image
        source={{
          uri: item.profile.photo_url || 'https://via.placeholder.com/56',
        }}
        style={styles.avatar}
      />

      <View style={styles.userInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.name}>
            {item.profile.display_name}, {item.profile.age}
          </Text>
          {item.profile.is_verified && (
            <MaterialCommunityIcons
              name="check-decagram"
              size={16}
              color="#3B82F6"
            />
          )}
        </View>
        {item.profile.location_city && (
          <Text style={styles.location}>{item.profile.location_city}</Text>
        )}
        <Text style={styles.blockedDate}>{t('settings.blockedUsers.blockedDate', { time: getTimeAgo(item.created_at) })}</Text>
      </View>

      <TouchableOpacity
        style={[
          styles.unblockButton,
          unblocking === item.id && styles.unblockButtonDisabled,
        ]}
        onPress={() => handleUnblock(item)}
        disabled={unblocking === item.id}
      >
        {unblocking === item.id ? (
          <ActivityIndicator size="small" color="#A08AB7" />
        ) : (
          <Text style={styles.unblockButtonText}>{t('settings.blockedUsers.unblock')}</Text>
        )}
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#A08AB7" />
        <Text style={styles.loadingText}>{t('settings.blockedUsers.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="chevron-left" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('settings.blockedUsers.title')}</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Content */}
      <FlatList
        data={blockedUsers}
        renderItem={renderBlockedUser}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="cancel"
              size={64}
              color="#D1D5DB"
            />
            <Text style={styles.emptyTitle}>{t('settings.blockedUsers.emptyTitle')}</Text>
            <Text style={styles.emptyText}>
              {t('settings.blockedUsers.emptyText')}
            </Text>
          </View>
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 14,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  headerRight: {
    width: 40,
  },
  listContent: {
    padding: 20,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#E5E7EB',
  },
  userInfo: {
    flex: 1,
    marginLeft: 16,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  location: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
  },
  blockedDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  unblockButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#A08AB7',
    backgroundColor: '#fff',
  },
  unblockButtonDisabled: {
    borderColor: '#D1D5DB',
  },
  unblockButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A08AB7',
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
