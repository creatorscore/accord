import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useProfileData } from '@/contexts/ProfileDataContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useToast } from '@/contexts/ToastContext';
import { SafeBlurImage } from '@/components/shared/SafeBlurImage';
import { signPhotoUrls } from '@/lib/signed-urls';
import { calculateCompatibilityScore } from '@/lib/matching-algorithm';
import PremiumPaywall from '@/components/premium/PremiumPaywall';
import MatchModal from '@/components/matching/MatchModal';

const DAILY_LIKE_LIMIT = 5;
const PAGE_SIZE = 30;

interface PassedProfile {
  pass_id: string;
  passed_profile_id: string;
  passed_at: string;
  display_name: string;
  age: number;
  location_city: string | null;
  location_state: string | null;
  photo_url: string | null;
  photo_storage_path: string | null;
  photo_blur_enabled: boolean;
  is_active: boolean;
}

export default function PassedProfiles() {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { user } = useAuth();
  const { showToast } = useToast();
  const profileData = useProfileData();
  const { isPremium, isPlatinum } = useSubscription();
  const [profiles, setProfiles] = useState<PassedProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedProfile, setMatchedProfile] = useState<{ display_name: string; photo_url?: string; compatibility_score?: number } | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);

  useEffect(() => {
    loadPasses();
  }, []);

  const loadPasses = async () => {
    try {
      const profileId = profileData?.profileId;
      if (!profileId) return;

      const { data, error } = await supabase.rpc('get_passed_profiles', {
        p_profile_id: profileId,
        p_limit: PAGE_SIZE,
      });

      if (error) throw error;

      // Sign photo URLs
      if (data && data.length > 0) {
        const photosToSign = data
          .filter((p: any) => p.photo_url)
          .map((p: any) => ({ url: p.photo_url, storage_path: p.photo_storage_path || p.photo_url }));

        if (photosToSign.length > 0) {
          const signed = await signPhotoUrls(photosToSign);
          const signedMap = new Map(photosToSign.map((p: any, i: number) => [p.url, signed[i]?.url]));
          data.forEach((p: any) => {
            if (p.photo_url && signedMap.has(p.photo_url)) {
              p.photo_url = signedMap.get(p.photo_url);
            }
          });
        }
      }

      setProfiles(data || []);
    } catch (error) {
      console.error('Error loading passed profiles:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadPasses();
  }, []);

  const handleUndoPass = async (profile: PassedProfile) => {
    const currentProfileId = profileData?.profileId;
    if (!currentProfileId || undoingId) return;

    // Check daily like limit for free users
    if (!isPremium && !isPlatinum) {
      const stored = await AsyncStorage.getItem('like_data');
      const currentCount = stored
        ? (() => { const d = JSON.parse(stored); return d.date === new Date().toDateString() ? d.count : 0; })()
        : 0;

      if (currentCount >= DAILY_LIKE_LIMIT) {
        showToast({ type: 'info', title: t('passed.likeLimitReached'), message: t('likes.freeUser.dailyLimitMessage') });
        setShowPaywall(true);
        return;
      }
    }

    setUndoingId(profile.pass_id);

    try {
      // 1. Delete the pass
      const { error: deleteError } = await supabase
        .from('passes')
        .delete()
        .eq('id', profile.pass_id);

      if (deleteError) throw deleteError;

      // 2. Create a like
      const { error: likeError } = await supabase
        .from('likes')
        .insert({
          liker_profile_id: currentProfileId,
          liked_profile_id: profile.passed_profile_id,
          like_type: 'standard',
        });

      if (likeError) {
        if (likeError.code === 'P0001' && likeError.message?.includes('Daily like limit')) {
          setShowPaywall(true);
          setUndoingId(null);
          return;
        }
        // If duplicate, that's fine — they already liked this person
        if (!likeError.message?.includes('duplicate') && likeError.code !== '23505') {
          throw likeError;
        }
      }

      // 3. Increment daily like count locally
      if (!isPremium && !isPlatinum) {
        const stored = await AsyncStorage.getItem('like_data');
        const today = new Date().toDateString();
        const currentCount = stored
          ? (() => { const d = JSON.parse(stored); return d.date === today ? d.count : 0; })()
          : 0;
        await AsyncStorage.setItem('like_data', JSON.stringify({ date: today, count: currentCount + 1 }));
      }

      // 4. Remove from list optimistically
      setProfiles(prev => prev.filter(p => p.pass_id !== profile.pass_id));

      // 5. Check for mutual match
      const { data: mutualLikeId } = await supabase
        .rpc('check_mutual_like', { p_target_profile_id: profile.passed_profile_id });

      if (mutualLikeId) {
        // Create the match
        const profile1Id = currentProfileId < profile.passed_profile_id ? currentProfileId : profile.passed_profile_id;
        const profile2Id = currentProfileId < profile.passed_profile_id ? profile.passed_profile_id : currentProfileId;

        // Calculate compatibility
        const [{ data: myProfile }, { data: otherProfile }] = await Promise.all([
          supabase.from('profiles').select('*, preferences (*)').eq('id', currentProfileId).single(),
          supabase.from('profiles').select('*, preferences (*)').eq('id', profile.passed_profile_id).single(),
        ]);

        let compatibilityScore: number | null = null;
        if (myProfile && otherProfile) {
          const myPrefs = Array.isArray(myProfile.preferences) ? myProfile.preferences[0] : myProfile.preferences;
          const otherPrefs = Array.isArray(otherProfile.preferences) ? otherProfile.preferences[0] : otherProfile.preferences;
          if (myPrefs && otherPrefs) {
            compatibilityScore = calculateCompatibilityScore(myProfile, otherProfile, myPrefs, otherPrefs);
          }
        }

        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .insert({
            profile1_id: profile1Id,
            profile2_id: profile2Id,
            initiated_by: currentProfileId,
            compatibility_score: compatibilityScore,
          })
          .select('id')
          .single();

        if (!matchError && matchData) {
          setMatchedProfile({
            display_name: profile.display_name,
            photo_url: profile.photo_url || undefined,
            compatibility_score: compatibilityScore || undefined,
          });
          setMatchId(matchData.id);
          setShowMatchModal(true);
        } else if (matchError?.message?.includes('MATCH_LIMIT_REACHED')) {
          Alert.alert(t('likes.matchLimitTitle'), t('likes.matchLimitMessage'));
        }
      } else {
        showToast({ type: 'success', title: t('passed.undone'), message: t('passed.undoneMessage', { name: profile.display_name }) });
      }
    } catch (error: any) {
      console.error('Error undoing pass:', error);
      showToast({ type: 'error', title: t('common.error'), message: t('passed.errorUndoing') });
      // Reload to restore state
      loadPasses();
    } finally {
      setUndoingId(null);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return t('passed.timeJustNow');
    if (diffMins < 60) return t('passed.timeMinutes', { count: diffMins });
    if (diffHours < 24) return t('passed.timeHours', { count: diffHours });
    if (diffDays === 1) return t('passed.timeYesterday');
    if (diffDays < 7) return t('passed.timeDays', { count: diffDays });
    return date.toLocaleDateString();
  };

  const renderProfile = ({ item }: { item: PassedProfile }) => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
      }}
    >
      <TouchableOpacity
        onPress={() => router.push(`/profile/${item.passed_profile_id}`)}
        style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}
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
          <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
            {t('passed.passedTime', { time: formatTime(item.passed_at) })}
          </Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => handleUndoPass(item)}
        disabled={undoingId === item.pass_id}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          backgroundColor: undoingId === item.pass_id ? '#E5E7EB' : '#F5F0FF',
          borderRadius: 20,
          marginLeft: 12,
        }}
        activeOpacity={0.7}
      >
        {undoingId === item.pass_id ? (
          <ActivityIndicator size="small" color="#A08AB7" />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <MaterialCommunityIcons name="heart-outline" size={18} color="#A08AB7" />
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#A08AB7' }}>
              {t('passed.like')}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
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
            {t('passed.title')}
          </Text>
          <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>
            {loading ? t('passed.loading') : t('passed.subtitle', { count: profiles.length })}
          </Text>
        </View>
        <View style={{ padding: 8, backgroundColor: 'rgba(160, 138, 183, 0.1)', borderRadius: 12 }}>
          <MaterialCommunityIcons name="undo-variant" size={22} color="#A08AB7" />
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#A08AB7" />
        </View>
      ) : profiles.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <MaterialCommunityIcons name="heart-off-outline" size={64} color="#D1D5DB" />
          <Text style={{ fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 16, textAlign: 'center' }}>
            {t('passed.empty')}
          </Text>
          <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 8, textAlign: 'center', lineHeight: 20 }}>
            {t('passed.emptyDescription')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={profiles}
          keyExtractor={(item) => item.pass_id}
          renderItem={renderProfile}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#A08AB7" colors={['#A08AB7']} />
          }
        />
      )}

      {showPaywall && (
        <PremiumPaywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
        />
      )}

      {showMatchModal && matchedProfile && (
        <MatchModal
          visible={showMatchModal}
          matchedProfile={matchedProfile}
          onClose={() => { setShowMatchModal(false); setMatchedProfile(null); setMatchId(null); }}
          onSendMessage={() => {
            setShowMatchModal(false);
            if (matchId) router.push(`/chat/${matchId}`);
            setMatchedProfile(null);
            setMatchId(null);
          }}
        />
      )}
    </View>
  );
}
