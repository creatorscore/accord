import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, FlatList, Alert, RefreshControl, StyleSheet } from 'react-native';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { useScreenProtection } from '@/hooks/useScreenProtection';
import { usePhotoBlur } from '@/hooks/usePhotoBlur';
import { SafeBlurImage } from '@/components/shared/SafeBlurImage';
import { useColorScheme } from '@/lib/useColorScheme';
import MatchModal from '@/components/matching/MatchModal';
import PremiumPaywall from '@/components/premium/PremiumPaywall';
import LavenderPacksModal from '@/components/premium/LavenderPacksModal';
import { getSuperLikePackage, getSuperLikePackages, getPriceString } from '@/lib/revenue-cat';
import { sendSuperLike, purchaseSuperLikeCredits, WEEKLY_SUPER_LIKE_LIMIT } from '@/lib/super-like';
import { getSignedUrls } from '@/lib/signed-urls';
import { trackEvent } from '@/lib/analytics';
import HandshakeLoader from '@/components/shared/HandshakeLoader';

// Standouts: the top profiles in the member's area, refreshed every 8 hours
// (server-side TTL in the get_standouts RPC — see the standouts_cache table).
// Liking from this surface is Lavender-only, Hinge-Rose style: the only
// action on a card is sending a Lavender. Hard filters (gender pref, age
// range, max distance) are enforced by the RPC, never widened.

interface Standout {
  candidate_id: string;
  display_name: string;
  age: number;
  location_city?: string | null;
  location_state?: string | null;
  occupation?: string | null;
  bio?: string | null;
  my_story?: string | null;
  prompt_answers?: { prompt: string; answer: string }[] | null;
  voice_intro_url?: string | null;
  is_verified: boolean;
  photo_verified: boolean;
  distance_miles?: number | null;
  photo_url?: string | null;
  photo_storage_path?: string | null;
  photo_blur_enabled: boolean;
  standout_position: number;
  computed_at: string;
}

const LAVENDER = '#8B6FA8';
const LAVENDER_DEEP = '#6D28D9';
const LAVENDER_PALE = '#EDE9FE';

function StandoutCard({
  standout,
  sent,
  onLavender,
  onOpenProfile,
  isDark,
}: {
  standout: Standout;
  sent: boolean;
  onLavender: (s: Standout) => void;
  onOpenProfile: (s: Standout) => void;
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const { imageUri, blurRadius, onImageLoad, onImageError } = usePhotoBlur({
    shouldBlur: standout.photo_blur_enabled,
    photoUrl: standout.photo_url || 'https://via.placeholder.com/400x600?text=No+Photo',
    blurDataUri: null,
    blurIntensity: 30,
  });

  const firstPrompt = Array.isArray(standout.prompt_answers) && standout.prompt_answers.length > 0
    ? standout.prompt_answers[0]
    : null;
  const snippet = standout.bio || firstPrompt?.answer || standout.my_story || null;
  const place = [standout.location_city, standout.location_state].filter(Boolean).join(', ');

  return (
    <View style={[styles.card, { backgroundColor: isDark ? '#1C1B22' : '#FFFFFF' }]}>
      <TouchableOpacity activeOpacity={0.92} onPress={() => onOpenProfile(standout)}>
        <View style={styles.photoWrap}>
          <SafeBlurImage
            source={{ uri: imageUri }}
            style={styles.photo}
            resizeMode="cover"
            blurRadius={blurRadius}
            onLoad={onImageLoad}
            onError={onImageError}
          />
          <View style={styles.photoOverlay} pointerEvents="none">
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {standout.display_name}, {standout.age}
              </Text>
              {(standout.photo_verified || standout.is_verified) && (
                <MaterialCommunityIcons name="check-decagram" size={20} color="#60A5FA" style={{ marginLeft: 6 }} />
              )}
            </View>
            <View style={styles.metaRow}>
              {!!place && (
                <Text style={styles.metaText} numberOfLines={1}>
                  <Ionicons name="location-sharp" size={12} color="rgba(255,255,255,0.9)" /> {place}
                </Text>
              )}
              {standout.voice_intro_url ? (
                <View style={styles.voicePill}>
                  <Ionicons name="mic" size={11} color="#FFFFFF" />
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.cardBody}>
        {firstPrompt?.prompt && snippet === firstPrompt.answer ? (
          <Text style={[styles.promptLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1}>
            {firstPrompt.prompt}
          </Text>
        ) : null}
        {!!snippet && (
          <Text style={[styles.snippet, { color: isDark ? '#E5E7EB' : '#1F2937' }]} numberOfLines={3}>
            {snippet}
          </Text>
        )}
        {!!standout.occupation && (
          <Text style={[styles.occupation, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1}>
            {standout.occupation}
          </Text>
        )}

        <TouchableOpacity
          activeOpacity={0.85}
          disabled={sent}
          onPress={() => onLavender(standout)}
          style={[styles.lavenderButton, sent ? styles.lavenderButtonSent : null]}
        >
          <MaterialCommunityIcons
            name={sent ? 'check' : 'flower'}
            size={20}
            color={sent ? '#059669' : LAVENDER_DEEP}
          />
          <Text style={[styles.lavenderButtonText, { color: sent ? '#059669' : LAVENDER_DEEP }]}>
            {sent
              ? t('standouts.lavenderSent', { defaultValue: 'Lavender sent' })
              : t('standouts.sendLavender', { defaultValue: 'Send a Lavender' })}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function Standouts() {
  useScreenProtection();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { isPremium, isPlatinum } = useSubscription();
  const { showToast } = useToast();
  const { colorScheme, colors } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const entitled = isPremium || isPlatinum;

  const [profileId, setProfileId] = useState<string | null>(null);
  const [standouts, setStandouts] = useState<Standout[]>([]);
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [superLikeCredits, setSuperLikeCredits] = useState(0);
  const [superLikesUsed, setSuperLikesUsed] = useState(0);
  const [superLikePackage, setSuperLikePackage] = useState<any>(null);
  const [superLikePackages, setSuperLikePackages] = useState<any[]>([]);
  const [showLavenderPacks, setShowLavenderPacks] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showMatchModal, setShowMatchModal] = useState(false);
  const [matchedStandout, setMatchedStandout] = useState<Standout | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const profileIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSuperLikePackages()
      .then((pkgs) => {
        if (cancelled || pkgs.length === 0) return;
        setSuperLikePackages(pkgs);
        setSuperLikePackage(pkgs[0]);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const loadStandouts = useCallback(async (isRefresh = false) => {
    if (!user) return;
    try {
      if (isRefresh) setRefreshing(true);

      let pid = profileIdRef.current;
      if (!pid) {
        const { data: me, error: meError } = await supabase
          .from('profiles')
          .select('id, super_like_credits, super_likes_count, super_likes_reset_date')
          .eq('user_id', user.id)
          .maybeSingle();
        if (meError || !me) {
          if (meError) console.error('Standouts profile lookup failed:', meError);
          return;
        }
        pid = me.id;
        profileIdRef.current = pid;
        setProfileId(pid);
        setSuperLikeCredits(me.super_like_credits || 0);
        const resetDate = new Date(me.super_likes_reset_date);
        const stale = (Date.now() - resetDate.getTime()) / (1000 * 60 * 60 * 24) >= 7;
        setSuperLikesUsed(stale ? 0 : (me.super_likes_count || 0));
      } else {
        const { data: me } = await supabase
          .from('profiles')
          .select('super_like_credits, super_likes_count, super_likes_reset_date')
          .eq('id', pid)
          .maybeSingle();
        if (me) {
          setSuperLikeCredits(me.super_like_credits || 0);
          const resetDate = new Date(me.super_likes_reset_date);
          const stale = (Date.now() - resetDate.getTime()) / (1000 * 60 * 60 * 24) >= 7;
          setSuperLikesUsed(stale ? 0 : (me.super_likes_count || 0));
        }
      }

      const { data, error } = await supabase.rpc('get_standouts', {
        p_profile_id: pid,
        p_limit: 10,
      });
      if (error) {
        console.error('get_standouts failed:', error);
        showToast({ type: 'error', title: t('common.error'), message: t('standouts.loadError', { defaultValue: 'Couldn’t load standouts. Pull to retry.' }) });
        return;
      }

      // Raw photos.url is not reliable — re-sign storage paths in one batch,
      // exactly like the matches/messages screens do.
      const rows = (data as Standout[]) || [];
      const photoPaths = rows.map((r) => r.photo_storage_path || r.photo_url || '');
      const validIndices: number[] = [];
      const validPaths: string[] = [];
      photoPaths.forEach((p, i) => {
        if (p) { validIndices.push(i); validPaths.push(p); }
      });
      if (validPaths.length > 0) {
        try {
          const signed = await getSignedUrls('profile-photos', validPaths);
          for (let j = 0; j < signed.length; j++) {
            if (signed[j]) rows[validIndices[j]] = { ...rows[validIndices[j]], photo_url: signed[j] };
          }
        } catch (e) {
          console.error('Standouts photo signing failed:', e);
        }
      }
      setStandouts(rows);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, showToast, t]);

  useEffect(() => {
    loadStandouts();
  }, [loadStandouts]);

  useFocusEffect(
    useCallback(() => {
      // Refresh silently on focus: the 8h TTL means this is almost always a
      // cheap cache read; it also picks up credit changes after a purchase.
      if (!loading) loadStandouts();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const nextRefreshLabel = useCallback(() => {
    if (standouts.length === 0) return null;
    const computedAt = new Date(standouts[0].computed_at).getTime();
    const msLeft = computedAt + 8 * 60 * 60 * 1000 - Date.now();
    if (msLeft <= 0) return t('standouts.refreshSoon', { defaultValue: 'New standouts soon' });
    const hours = Math.floor(msLeft / (60 * 60 * 1000));
    const minutes = Math.ceil((msLeft % (60 * 60 * 1000)) / (60 * 1000));
    const label = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
    return t('standouts.refreshIn', { time: label, defaultValue: 'New in {{time}}' });
  }, [standouts, t]);

  const purchasePack = useCallback(async (pkg: any) => {
    const pid = profileIdRef.current;
    if (!pid) return;
    const result = await purchaseSuperLikeCredits(pkg, pid);
    if (result.status === 'granted') {
      setSuperLikeCredits(result.credits);
      showToast({
        type: 'success',
        title: t('discover.superlike.readyTitle', { defaultValue: 'Super Like ready!' }),
        message: t('standouts.creditsReady', { defaultValue: 'Your Lavenders are ready to send.' }),
      });
    } else if (result.status === 'pending') {
      showToast({
        type: 'info',
        title: t('discover.superlike.pendingTitle', { defaultValue: 'Purchase received' }),
        message: t('discover.superlike.pendingMessage', { defaultValue: 'Your Super Like will appear in a moment.' }),
      });
    } else if (result.status === 'failed') {
      showToast({
        type: 'error',
        title: t('common.error'),
        message: t('discover.superlike.purchaseFailed', { defaultValue: 'Purchase didn’t go through. You were not charged.' }),
      });
    }
  }, [showToast, t]);

  const offerLavenderPurchase = useCallback(async () => {
    let pkg = superLikePackage;
    if (!pkg) {
      pkg = await getSuperLikePackage().catch(() => null);
      if (pkg) setSuperLikePackage(pkg);
    }
    if (superLikePackages.length > 1) {
      Alert.alert(
        t('discover.premium.upgradeTitle'),
        t('discover.superlike.buyMessage', { defaultValue: 'Premium includes 5 Lavenders a week — or send just this one.' }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('discover.superlike.packsTitle', { defaultValue: 'Get Lavenders' }), onPress: () => setShowLavenderPacks(true) },
          { text: t('common.upgrade'), onPress: () => setShowPaywall(true) },
        ]
      );
    } else if (pkg) {
      Alert.alert(
        t('discover.premium.upgradeTitle'),
        t('discover.superlike.buyMessage', { defaultValue: 'Premium includes 5 Lavenders a week — or send just this one.' }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('discover.superlike.buyOne', { price: getPriceString(pkg), defaultValue: 'Buy 1 · {{price}}' }), onPress: () => purchasePack(pkg) },
          { text: t('common.upgrade'), onPress: () => setShowPaywall(true) },
        ]
      );
    } else {
      Alert.alert(
        t('discover.premium.upgradeTitle'),
        t('discover.premium.superLikesMessage'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('common.upgrade'), onPress: () => setShowPaywall(true) },
        ]
      );
    }
  }, [superLikePackage, superLikePackages, purchasePack, t]);

  const handleLavender = useCallback(async (standout: Standout) => {
    const pid = profileIdRef.current;
    if (!pid || sending) return;

    // Entitlement gate mirrors discover's handleSwipeUp: free members need
    // purchased credits; premium members use weekly allowance then credits.
    if (!entitled && superLikeCredits <= 0) {
      offerLavenderPurchase();
      return;
    }

    setSending(true);
    try {
      const outcome = await sendSuperLike({
        currentProfileId: pid,
        targetProfileId: standout.candidate_id,
        isPremium: entitled,
        superLikeCredits,
      });

      switch (outcome.status) {
        case 'sent': {
          trackEvent('standout_lavender_sent', { target: standout.candidate_id, matched: outcome.matched });
          setSentIds((prev) => new Set(prev).add(standout.candidate_id));
          if (outcome.usedWeeklyAllowance) {
            setSuperLikesUsed((u) => u + 1);
          } else {
            setSuperLikeCredits((c) => Math.max(0, c - 1));
          }
          if (outcome.matched) {
            setMatchedStandout(standout);
            setMatchId(outcome.matchId);
            setShowMatchModal(true);
          } else {
            showToast({
              type: 'success',
              title: t('toast.obsessedTitle'),
              message: outcome.usedWeeklyAllowance
                ? t('toast.obsessedWithRemaining', { name: standout.display_name, remaining: outcome.weeklyRemaining })
                : t('toast.obsessedBasic', { name: standout.display_name }),
            });
          }
          break;
        }
        case 'weekly_limit':
          if (superLikeCredits > 0) break; // shouldn't happen; credits cover it
          Alert.alert(
            t('discover.premium.superLikeLimitTitle'),
            t('discover.premium.superLikeLimitMessage', { day: '' }),
            superLikePackages.length > 0
              ? [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('discover.superlike.packsTitle', { defaultValue: 'Get Lavenders' }), onPress: () => setShowLavenderPacks(true) },
                ]
              : [{ text: t('common.ok', { defaultValue: 'OK' }) }]
          );
          break;
        case 'premium_required':
          offerLavenderPurchase();
          break;
        case 'match_limit':
          setSentIds((prev) => new Set(prev).add(standout.candidate_id));
          Alert.alert(t('likes.matchLimitTitle'), t('likes.matchLimitMessage'), [{ text: t('common.ok', { defaultValue: 'OK' }) }]);
          break;
        case 'photos_under_review':
          showToast({
            type: 'info',
            title: t('discover.photosUnderReviewTitle', { defaultValue: 'Photos under review' }),
            message: t('discover.photosUnderReviewMessage', { defaultValue: 'One of your photos is still being reviewed — this usually takes a minute. Please try again shortly.' }),
          });
          break;
        case 'server_rejected':
          showToast({ type: 'error', title: t('common.error'), message: outcome.message });
          break;
        default:
          showToast({ type: 'error', title: t('common.error'), message: t('toast.superLikeError') });
      }
    } finally {
      setSending(false);
    }
  }, [entitled, superLikeCredits, superLikePackages, sending, offerLavenderPurchase, showToast, t]);

  const openProfile = useCallback((standout: Standout) => {
    router.push(`/profile/${standout.candidate_id}`);
  }, []);

  const lavendersLeft = entitled
    ? Math.max(0, WEEKLY_SUPER_LIKE_LIMIT - superLikesUsed) + superLikeCredits
    : superLikeCredits;

  const refreshChip = nextRefreshLabel();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {t('standouts.title', { defaultValue: 'Standouts' })}
          </Text>
          <Text style={[styles.headerSubtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            {t('standouts.subtitle', { defaultValue: 'Top profiles in your area, refreshed every 8 hours' })}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          {refreshChip ? (
            <View style={[styles.refreshChip, { backgroundColor: isDark ? 'rgba(139,111,168,0.25)' : LAVENDER_PALE }]}>
              <Ionicons name="time-outline" size={12} color={isDark ? '#C4B5FD' : LAVENDER_DEEP} />
              <Text style={[styles.refreshChipText, { color: isDark ? '#C4B5FD' : LAVENDER_DEEP }]}>{refreshChip}</Text>
            </View>
          ) : null}
          <TouchableOpacity
            onPress={() => (superLikePackages.length > 0 ? setShowLavenderPacks(true) : setShowPaywall(true))}
            style={[styles.countChip, { backgroundColor: isDark ? 'rgba(139,111,168,0.25)' : LAVENDER_PALE }]}
          >
            <MaterialCommunityIcons name="flower" size={13} color={isDark ? '#C4B5FD' : LAVENDER_DEEP} />
            <Text style={[styles.refreshChipText, { color: isDark ? '#C4B5FD' : LAVENDER_DEEP }]}>{lavendersLeft}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <HandshakeLoader />
        </View>
      ) : standouts.length === 0 ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: isDark ? 'rgba(139,111,168,0.2)' : LAVENDER_PALE }]}>
            <MaterialCommunityIcons name="flower-outline" size={40} color={LAVENDER} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
            {t('standouts.emptyTitle', { defaultValue: 'No standouts right now' })}
          </Text>
          <Text style={[styles.emptyText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            {t('standouts.emptyText', { defaultValue: 'Standouts come from active members who match your preferences. Try widening your distance or age range.' })}
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: LAVENDER }]}
            onPress={() => router.push('/settings/matching-preferences')}
          >
            <Text style={styles.emptyButtonText}>
              {t('standouts.adjustPreferences', { defaultValue: 'Adjust preferences' })}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={standouts}
          keyExtractor={(item) => item.candidate_id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => loadStandouts(true)} tintColor={LAVENDER} />
          }
          renderItem={({ item }) => (
            <StandoutCard
              standout={item}
              sent={sentIds.has(item.candidate_id)}
              onLavender={handleLavender}
              onOpenProfile={openProfile}
              isDark={isDark}
            />
          )}
        />
      )}

      {/* Match modal */}
      {matchedStandout && (
        <MatchModal
          visible={showMatchModal}
          onClose={() => {
            setShowMatchModal(false);
            setMatchedStandout(null);
            setMatchId(null);
          }}
          onSendMessage={() => {
            setShowMatchModal(false);
            if (matchId) router.push(`/chat/${matchId}`);
            setMatchedStandout(null);
            setMatchId(null);
          }}
          matchedProfile={{
            display_name: matchedStandout.display_name,
            photo_url: matchedStandout.photo_url || undefined,
          }}
        />
      )}

      <LavenderPacksModal
        visible={showLavenderPacks}
        onClose={() => setShowLavenderPacks(false)}
        packages={superLikePackages}
        onBuy={purchasePack}
        cardColor={colors.card}
        textColor={colors.foreground}
      />

      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        variant="premium"
        feature="super_likes"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans-Bold',
  },
  headerSubtitle: {
    fontSize: 13,
    marginTop: 2,
    fontFamily: 'Inter',
  },
  refreshChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  refreshChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  card: {
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  photoWrap: {
    width: '100%',
    aspectRatio: 4 / 5,
    backgroundColor: '#111',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 14,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  metaText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    flexShrink: 1,
  },
  voicePill: {
    backgroundColor: 'rgba(139,111,168,0.9)',
    borderRadius: 999,
    padding: 4,
  },
  cardBody: {
    padding: 14,
    gap: 6,
  },
  promptLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  snippet: {
    fontSize: 15,
    lineHeight: 21,
  },
  occupation: {
    fontSize: 13,
  },
  lavenderButton: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: LAVENDER_PALE,
    borderRadius: 999,
    paddingVertical: 13,
  },
  lavenderButtonSent: {
    backgroundColor: 'rgba(5,150,105,0.1)',
  },
  lavenderButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 20,
  },
  emptyButton: {
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
