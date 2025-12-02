import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import StarRating from '@/components/reviews/StarRating';
import ReviewSubmissionModal from '@/components/reviews/ReviewSubmissionModal';

interface ReviewData {
  id: string;
  reviewer_name: string;
  reviewer_photo_url?: string;
  overall_rating: number;
  communication_responsiveness: number;
  honesty_authenticity: number;
  respect_boundaries: number;
  compatibility_intent: number;
  reliability_followthrough: number;
  feedback_text?: string;
  created_at: string;
  revealed_at: string;
  review_window_expires_at: string;
  is_revealed: boolean;
  match_date?: string;
  compatibility_score?: number;
}

interface PendingReview {
  match_id: string;
  window_expires_at: string;
  other_profile_name: string;
  other_profile_id: string;
  other_profile_photo_url?: string;
  has_submitted: boolean;
  other_has_submitted: boolean;
  match_date?: string;
  compatibility_score?: number;
}

export default function MyReviewsScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([]);
  const [aggregateScore, setAggregateScore] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedReview, setSelectedReview] = useState<PendingReview | null>(null);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, review_aggregate_score, review_count')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      setCurrentProfileId(profile.id);
      setAggregateScore(profile.review_aggregate_score);
      setReviewCount(profile.review_count);

      // Get all visible reviews for this user with match data
      const { data: reviewsData, error } = await supabase
        .from('reviews')
        .select(`
          id,
          overall_rating,
          communication_responsiveness,
          honesty_authenticity,
          respect_boundaries,
          compatibility_intent,
          reliability_followthrough,
          feedback_text,
          created_at,
          revealed_at,
          review_window_expires_at,
          is_revealed,
          match_id,
          reviewer:profiles!reviews_reviewer_id_fkey(
            display_name,
            photos(url, is_primary)
          )
        `)
        .eq('reviewee_id', profile.id)
        .eq('is_visible', true)
        .eq('is_revealed', true)
        .order('revealed_at', { ascending: false });

      if (error) {
        console.error('Error fetching reviews:', error);
        return;
      }

      // Get match data for each review
      const reviewsWithMatchData = await Promise.all(
        (reviewsData || []).map(async (review: any) => {
          const { data: matchData } = await supabase
            .from('matches')
            .select('matched_at, compatibility_score')
            .eq('id', review.match_id)
            .single();

          const primaryPhoto = review.reviewer.photos?.find((p: any) => p.is_primary);
          const photoUrl = primaryPhoto?.url || review.reviewer.photos?.[0]?.url;

          return {
            ...review,
            reviewer_name: review.reviewer.display_name,
            reviewer_photo_url: photoUrl,
            match_date: matchData?.matched_at,
            compatibility_score: matchData?.compatibility_score,
          };
        })
      );

      const formattedReviews = reviewsWithMatchData;

      setReviews(formattedReviews);

      // Get pending review prompts (not yet revealed) with match data
      const { data: promptsData } = await supabase
        .from('review_prompts')
        .select(`
          match_id,
          window_expires_at,
          profile1_id,
          profile2_id,
          profile1_reviewed,
          profile2_reviewed,
          reviews_revealed,
          match:matches!review_prompts_match_id_fkey(
            matched_at,
            compatibility_score,
            profile1:profiles!matches_profile1_id_fkey(
              display_name,
              photos(url, is_primary)
            ),
            profile2:profiles!matches_profile2_id_fkey(
              display_name,
              photos(url, is_primary)
            )
          )
        `)
        .or(`profile1_id.eq.${profile.id},profile2_id.eq.${profile.id}`)
        .eq('reviews_revealed', false)
        .gt('window_expires_at', new Date().toISOString());

      const formattedPending = (promptsData || []).map((prompt: any) => {
        const isProfile1 = prompt.profile1_id === profile.id;
        const otherProfileId = isProfile1 ? prompt.profile2_id : prompt.profile1_id;
        const otherProfile = isProfile1 ? prompt.match.profile2 : prompt.match.profile1;

        const primaryPhoto = otherProfile.photos?.find((p: any) => p.is_primary);
        const photoUrl = primaryPhoto?.url || otherProfile.photos?.[0]?.url;

        return {
          match_id: prompt.match_id,
          window_expires_at: prompt.window_expires_at,
          other_profile_name: otherProfile.display_name,
          other_profile_id: otherProfileId,
          other_profile_photo_url: photoUrl,
          has_submitted: isProfile1 ? prompt.profile1_reviewed : prompt.profile2_reviewed,
          other_has_submitted: isProfile1 ? prompt.profile2_reviewed : prompt.profile1_reviewed,
          match_date: prompt.match.matched_at,
          compatibility_score: prompt.match.compatibility_score,
        };
      });

      setPendingReviews(formattedPending);
    } catch (error) {
      console.error('Error in fetchReviews:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    fetchReviews(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('reviews.today');
    if (diffDays === 1) return t('reviews.yesterday');
    if (diffDays < 7) return t('reviews.daysAgo', { days: diffDays });
    if (diffDays < 30) return t('reviews.weeksAgo', { weeks: Math.floor(diffDays / 7) });
    return t('reviews.monthsAgo', { months: Math.floor(diffDays / 30) });
  };

  const formatTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();

    if (diffMs <= 0) return 'Expired';

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours >= 24) {
      const days = Math.floor(diffHours / 24);
      return `${days}d ${diffHours % 24}h remaining`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMins}m remaining`;
    } else {
      return `${diffMins}m remaining`;
    }
  };

  const handleReviewNow = (pending: PendingReview) => {
    setSelectedReview(pending);
    setShowReviewModal(true);
  };

  const handleReviewSubmitted = () => {
    setShowReviewModal(false);
    setSelectedReview(null);
    fetchReviews(true); // Refresh the list
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('reviews.myReviews')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A08AB7" />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Overall Stats Card */}
          {aggregateScore !== null && reviewCount >= 5 && (
            <MotiView
              from={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'spring' }}
              style={styles.statsCard}
            >
              <LinearGradient colors={['#A08AB7', '#A08AB7']} style={styles.statsGradient}>
                <Text style={styles.statsLabel}>{t('reviews.yourOverallRating')}</Text>
                <View style={styles.statsRow}>
                  <Text style={styles.statsScore}>{aggregateScore.toFixed(1)}</Text>
                  <StarRating rating={aggregateScore} size={32} color="#FFF" />
                </View>
                <Text style={styles.statsCount}>
                  {t('reviews.basedOnReviews', { count: reviewCount })}
                </Text>
              </LinearGradient>
            </MotiView>
          )}

          {/* Pending Reviews - Airbnb Style */}
          {pendingReviews.length > 0 && (
            <View style={styles.pendingSection}>
              <Text style={styles.sectionTitle}>{t('reviews.pendingReviews')}</Text>

              {pendingReviews.map((pending, index) => (
                <MotiView
                  key={pending.match_id}
                  from={{ opacity: 0, translateX: -20 }}
                  animate={{ opacity: 1, translateX: 0 }}
                  transition={{ type: 'timing', duration: 300, delay: index * 100 }}
                  style={styles.pendingCard}
                >
                  {/* Profile Header with Photo */}
                  <View style={styles.pendingHeader}>
                    <View style={styles.pendingProfileSection}>
                      {pending.other_profile_photo_url ? (
                        <Image
                          source={{ uri: pending.other_profile_photo_url }}
                          style={styles.pendingAvatar}
                        />
                      ) : (
                        <View style={[styles.pendingAvatar, styles.pendingAvatarPlaceholder]}>
                          <MaterialCommunityIcons name="account" size={32} color="#A08AB7" />
                        </View>
                      )}
                      <View style={styles.pendingInfo}>
                        <Text style={styles.pendingName}>{pending.other_profile_name}</Text>
                        <View style={styles.pendingMetaRow}>
                          {pending.match_date && (
                            <View style={styles.metaBadge}>
                              <MaterialCommunityIcons name="calendar-heart" size={12} color="#6B7280" />
                              <Text style={styles.metaText}>
                                {new Date(pending.match_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </Text>
                            </View>
                          )}
                          {pending.compatibility_score && (
                            <View style={[styles.metaBadge, styles.compatibilityBadge]}>
                              <MaterialCommunityIcons name="heart" size={12} color="#CDC2E5" />
                              <Text style={[styles.metaText, { color: '#CDC2E5', fontWeight: '600' }]}>
                                {pending.compatibility_score}% Match
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                    <MaterialCommunityIcons
                      name={pending.has_submitted ? "check-circle" : "clock-alert"}
                      size={28}
                      color={pending.has_submitted ? "#10B981" : "#F59E0B"}
                    />
                  </View>

                  {/* Status Banner */}
                  <View style={[
                    styles.statusBanner,
                    pending.has_submitted ? styles.statusBannerSubmitted : styles.statusBannerPending
                  ]}>
                    <Text style={styles.statusText}>
                      {pending.has_submitted
                        ? pending.other_has_submitted
                          ? t('reviews.bothSubmitted')
                          : t('reviews.waitingForOther')
                        : t('reviews.youNeedToReview')}
                    </Text>
                  </View>

                  {/* Countdown */}
                  <View style={styles.countdownBanner}>
                    <MaterialCommunityIcons name="timer-sand" size={16} color="#DC2626" />
                    <Text style={styles.countdownText}>
                      {formatTimeRemaining(pending.window_expires_at)}
                    </Text>
                  </View>

                  {/* Review Now Button */}
                  {!pending.has_submitted && (
                    <TouchableOpacity
                      style={styles.reviewNowButton}
                      onPress={() => handleReviewNow(pending)}
                    >
                      <MaterialCommunityIcons name="star" size={18} color="#fff" />
                      <Text style={styles.reviewNowText}>{t('reviews.reviewNow')}</Text>
                      <MaterialCommunityIcons name="arrow-right" size={18} color="#fff" />
                    </TouchableOpacity>
                  )}
                </MotiView>
              ))}
            </View>
          )}

          {/* Not Enough Reviews Notice */}
          {(aggregateScore === null || reviewCount < 5) && (
            <View style={styles.noticeCard}>
              <MaterialCommunityIcons name="information-outline" size={32} color="#6B7280" />
              <Text style={styles.noticeTitle}>{t('reviews.notEnoughReviews')}</Text>
              <Text style={styles.noticeText}>
                {t('reviews.notEnoughReviewsDesc', { count: reviewCount, required: 5 })}
              </Text>
            </View>
          )}

          {/* Reviews List */}
          {reviews.length > 0 ? (
            <View style={styles.reviewsList}>
              <Text style={styles.sectionTitle}>{t('reviews.allReviews')}</Text>

              {reviews.map((review, index) => (
                <MotiView
                  key={review.id}
                  from={{ opacity: 0, translateY: 20 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 300, delay: index * 100 }}
                  style={styles.reviewCard}
                >
                  {/* Review Header with Photo */}
                  <View style={styles.reviewHeader}>
                    <View style={styles.reviewerInfo}>
                      {review.reviewer_photo_url ? (
                        <Image
                          source={{ uri: review.reviewer_photo_url }}
                          style={styles.reviewerAvatar}
                        />
                      ) : (
                        <View style={styles.avatarPlaceholder}>
                          <MaterialCommunityIcons name="account" size={28} color="#A08AB7" />
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.reviewerName}>{review.reviewer_name}</Text>
                        <View style={styles.reviewMetaRow}>
                          {review.match_date && (
                            <View style={styles.metaBadge}>
                              <MaterialCommunityIcons name="calendar-heart" size={11} color="#6B7280" />
                              <Text style={styles.metaText}>
                                {new Date(review.match_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </Text>
                            </View>
                          )}
                          {review.compatibility_score && (
                            <View style={[styles.metaBadge, styles.compatibilityBadge]}>
                              <MaterialCommunityIcons name="heart" size={11} color="#CDC2E5" />
                              <Text style={[styles.metaText, { color: '#CDC2E5', fontWeight: '600' }]}>
                                {review.compatibility_score}%
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>
                    <View style={styles.overallRatingContainer}>
                      <LinearGradient
                        colors={['#A08AB7', '#CDC2E5']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.ratingBadge}
                      >
                        <Text style={styles.ratingBadgeText}>{review.overall_rating.toFixed(1)}</Text>
                        <MaterialCommunityIcons name="star" size={14} color="#FFF" />
                      </LinearGradient>
                    </View>
                  </View>

                  {/* Written Feedback */}
                  {review.feedback_text && (
                    <View style={styles.feedbackContainer}>
                      <MaterialCommunityIcons name="format-quote-open" size={16} color="#9CA3AF" />
                      <Text style={styles.feedbackText}>{review.feedback_text}</Text>
                    </View>
                  )}

                  {/* Category Ratings */}
                  <View style={styles.categoriesContainer}>
                    {[
                      { key: 'communication_responsiveness', icon: 'message-text', translationKey: 'communicationResponsiveness' },
                      { key: 'honesty_authenticity', icon: 'shield-check', translationKey: 'honestyAuthenticity' },
                      { key: 'respect_boundaries', icon: 'hand-heart', translationKey: 'respectBoundaries' },
                      { key: 'compatibility_intent', icon: 'heart-multiple', translationKey: 'compatibilityIntent' },
                      { key: 'reliability_followthrough', icon: 'check-circle', translationKey: 'reliabilityFollowthrough' },
                    ].map((category) => (
                      <View key={category.key} style={styles.categoryRow}>
                        <MaterialCommunityIcons
                          name={category.icon as any}
                          size={16}
                          color="#6B7280"
                        />
                        <Text style={styles.categoryLabel}>
                          {t(`reviews.categories.${category.translationKey}.short`)}
                        </Text>
                        <View style={styles.categoryRating}>
                          <StarRating
                            rating={review[category.key as keyof ReviewData] as number}
                            size={14}
                            color="#F59E0B"
                          />
                        </View>
                      </View>
                    ))}
                  </View>

                  {/* Revealed Date Footer */}
                  <View style={styles.reviewFooter}>
                    <MaterialCommunityIcons name="eye-check" size={14} color="#9CA3AF" />
                    <Text style={styles.reviewFooterText}>
                      {t('reviews.revealed')} {formatDate(review.revealed_at)}
                    </Text>
                  </View>
                </MotiView>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="star-off" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>{t('reviews.noReviewsYet')}</Text>
              <Text style={styles.emptyText}>{t('reviews.noReviewsDesc')}</Text>
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* Review Submission Modal */}
      {selectedReview && currentProfileId && (
        <ReviewSubmissionModal
          visible={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedReview(null);
          }}
          matchId={selectedReview.match_id}
          reviewerId={currentProfileId}
          revieweeId={selectedReview.other_profile_id}
          revieweeName={selectedReview.other_profile_name}
          onReviewSubmitted={handleReviewSubmitted}
        />
      )}
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
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
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
    fontWeight: '600',
    color: '#111827',
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  statsCard: {
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  statsGradient: {
    padding: 24,
    alignItems: 'center',
  },
  statsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    opacity: 0.9,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  statsScore: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFF',
  },
  statsCount: {
    fontSize: 13,
    color: '#FFF',
    opacity: 0.8,
  },
  noticeCard: {
    margin: 20,
    padding: 24,
    backgroundColor: '#FFF',
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 12,
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  reviewsList: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  reviewCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  reviewerAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: '#F3E8FF',
  },
  avatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  reviewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  reviewDate: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 2,
  },
  overallRatingContainer: {
    marginLeft: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    shadowColor: '#A08AB7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 2,
  },
  ratingBadgeText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  overallRating: {
    alignItems: 'flex-end',
  },
  overallRatingText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  feedbackContainer: {
    backgroundColor: '#F9FAFB',
    borderLeftWidth: 3,
    borderLeftColor: '#A08AB7',
    padding: 14,
    borderRadius: 12,
    marginBottom: 14,
    flexDirection: 'row',
    gap: 10,
  },
  feedbackText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    fontStyle: 'italic',
  },
  reviewFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  reviewFooterText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  categoriesContainer: {
    gap: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryLabel: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
  },
  categoryRating: {
    minWidth: 80,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
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
  pendingSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  pendingCard: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
  pendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  pendingProfileSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  pendingAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: '#F3E8FF',
  },
  pendingAvatarPlaceholder: {
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingInfo: {
    flex: 1,
  },
  pendingName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  pendingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  compatibilityBadge: {
    backgroundColor: '#FCE7F3',
  },
  metaText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6B7280',
  },
  statusBanner: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 12,
  },
  statusBannerPending: {
    backgroundColor: '#FEF3C7',
  },
  statusBannerSubmitted: {
    backgroundColor: '#D1FAE5',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
  },
  countdownBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  countdownText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#DC2626',
  },
  reviewNowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#A08AB7',
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#A08AB7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  reviewNowText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFF',
  },
});
