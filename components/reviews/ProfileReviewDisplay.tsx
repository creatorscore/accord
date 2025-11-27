import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useTranslation } from 'react-i18next';
import StarRating from './StarRating';
import { supabase } from '@/lib/supabase';
import Constants from 'expo-constants';

interface ProfileReviewDisplayProps {
  profileId: string;
  isMatched?: boolean;
  compact?: boolean;
}

interface CategoryAverages {
  communication_responsiveness: number;
  honesty_authenticity: number;
  respect_boundaries: number;
  compatibility_intent: number;
  reliability_followthrough: number;
}

interface ReviewData {
  reviews_enabled: boolean;
  aggregate_score: number | null;
  review_count: number;
  has_matched: boolean;
  detailed_reviews?: {
    category_averages: CategoryAverages;
  };
}

const CATEGORY_INFO = [
  {
    key: 'communication_responsiveness',
    icon: 'message-text',
    translationKey: 'communicationResponsiveness',
  },
  {
    key: 'honesty_authenticity',
    icon: 'shield-check',
    translationKey: 'honestyAuthenticity',
  },
  {
    key: 'respect_boundaries',
    icon: 'hand-heart',
    translationKey: 'respectBoundaries',
  },
  {
    key: 'compatibility_intent',
    icon: 'heart-multiple',
    translationKey: 'compatibilityIntent',
  },
  {
    key: 'reliability_followthrough',
    icon: 'check-circle',
    translationKey: 'reliabilityFollowthrough',
  },
];

export default function ProfileReviewDisplay({
  profileId,
  isMatched = false,
  compact = false,
}: ProfileReviewDisplayProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [showDetailed, setShowDetailed] = useState(false);

  useEffect(() => {
    fetchReviewData();
  }, [profileId]);

  const fetchReviewData = async () => {
    try {
      setLoading(true);

      // Get Supabase URL with fallback to app.json extra config
      const supabaseUrl =
        process.env.EXPO_PUBLIC_SUPABASE_URL ||
        Constants.expoConfig?.extra?.supabaseUrl ||
        '';

      if (!supabaseUrl) {
        console.error('[Reviews] Supabase URL not configured');
        setReviewData(null);
        setLoading(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      const response = await fetch(
        `${supabaseUrl}/functions/v1/reviews-get-profile?profile_id=${profileId}`,
        {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
          },
        }
      );

      const result = await response.json();

      if (!response.ok) {
        // Edge function not deployed or other error - fail silently
        console.log('Reviews edge function not available - hiding reviews section');
        setReviewData(null);
        setLoading(false);
        return;
      }

      // Debug logging
      if (result.aggregate_score) {
        console.log(`[Reviews] Profile ${profileId}: ${result.aggregate_score.toFixed(1)} stars (${result.review_count} reviews)`);
      } else {
        console.log(`[Reviews] Profile ${profileId}: No reviews to display`);
      }

      setReviewData(result);
    } catch (error) {
      // Fail silently if edge function not deployed
      console.log('Reviews feature not available - edge function may not be deployed');
      setReviewData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#9B87CE" />
      </View>
    );
  }

  // Don't show if:
  // 1. No review data
  // 2. Reviews disabled
  // 3. No aggregate score OR it's not a valid number
  // 4. Review count is 0 or less than 1
  // 5. Aggregate score is less than 1 or greater than 5 (invalid)
  if (!reviewData ||
      !reviewData.reviews_enabled ||
      !reviewData.aggregate_score ||
      typeof reviewData.aggregate_score !== 'number' ||
      isNaN(reviewData.aggregate_score) ||
      reviewData.aggregate_score < 1 ||
      reviewData.aggregate_score > 5 ||
      reviewData.review_count < 1 ||
      typeof reviewData.review_count !== 'number') {
    return null; // Don't show anything if reviews disabled or not enough reviews
  }

  // Compact view (for profile cards in discovery)
  if (compact) {
    // Debug logging for compact badge
    const scoreText = reviewData.aggregate_score.toFixed(1);
    const countText = `(${reviewData.review_count})`;
    console.log(`[Reviews] Compact badge for ${profileId}: ${scoreText} ${countText}`);

    return (
      <View style={styles.compactContainer}>
        <View style={styles.compactBadge}>
          <MaterialCommunityIcons name="star" size={14} color="#F59E0B" />
          <Text style={styles.compactScore}>{scoreText}</Text>
          <Text style={styles.compactCount}>{countText}</Text>
        </View>
      </View>
    );
  }

  // Full view (for profile pages)
  return (
    <View style={styles.container}>
      {/* Aggregate Score Card */}
      <MotiView
        from={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring' }}
        style={styles.aggregateCard}
      >
        <LinearGradient colors={['#9B87CE', '#9B87CE']} style={styles.aggregateGradient}>
          <View style={styles.aggregateHeader}>
            <View>
              <Text style={styles.aggregateLabel}>{t('reviews.overallRating')}</Text>
              <Text style={styles.aggregateCount}>
                {t('reviews.basedOnReviews', { count: reviewData.review_count })}
              </Text>
            </View>
            <View style={styles.aggregateScoreContainer}>
              <Text style={styles.aggregateScore}>{reviewData.aggregate_score.toFixed(1)}</Text>
              <StarRating rating={reviewData.aggregate_score} size={24} color="#FFF" />
            </View>
          </View>
        </LinearGradient>
      </MotiView>

      {/* Detailed Breakdown (if matched) */}
      {reviewData.has_matched && reviewData.detailed_reviews && (
        <View style={styles.detailedContainer}>
          <TouchableOpacity
            style={styles.detailedHeader}
            onPress={() => setShowDetailed(!showDetailed)}
          >
            <Text style={styles.detailedTitle}>{t('reviews.categoryBreakdown')}</Text>
            <MaterialCommunityIcons
              name={showDetailed ? 'chevron-up' : 'chevron-down'}
              size={24}
              color="#6B7280"
            />
          </TouchableOpacity>

          {showDetailed && (
            <View style={styles.categoriesGrid}>
              {CATEGORY_INFO.map((category, index) => {
                const score =
                  reviewData.detailed_reviews!.category_averages[
                    category.key as keyof CategoryAverages
                  ];
                return (
                  <MotiView
                    key={category.key}
                    from={{ opacity: 0, translateY: 10 }}
                    animate={{ opacity: 1, translateY: 0 }}
                    transition={{ type: 'timing', duration: 300, delay: index * 50 }}
                    style={styles.categoryCard}
                  >
                    <View style={styles.categoryIconContainer}>
                      <MaterialCommunityIcons
                        name={category.icon as any}
                        size={20}
                        color="#9B87CE"
                      />
                    </View>
                    <Text style={styles.categoryName}>
                      {t(`reviews.categories.${category.translationKey}.name`)}
                    </Text>
                    <View style={styles.categoryRating}>
                      <StarRating rating={score} size={16} color="#F59E0B" />
                      <Text style={styles.categoryScore}>{score.toFixed(1)}</Text>
                    </View>
                  </MotiView>
                );
              })}
            </View>
          )}
        </View>
      )}

      {/* Not Matched Notice */}
      {!reviewData.has_matched && (
        <View style={styles.lockedNotice}>
          <MaterialCommunityIcons name="lock" size={20} color="#6B7280" />
          <Text style={styles.lockedText}>{t('reviews.matchToSeeDetails')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  compactContainer: {
    marginTop: 8,
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    alignSelf: 'flex-start',
  },
  compactScore: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  compactCount: {
    fontSize: 12,
    color: '#6B7280',
  },
  aggregateCard: {
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  aggregateGradient: {
    padding: 20,
  },
  aggregateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aggregateLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
  },
  aggregateCount: {
    fontSize: 13,
    color: '#FFF',
    opacity: 0.8,
  },
  aggregateScoreContainer: {
    alignItems: 'center',
    gap: 8,
  },
  aggregateScore: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFF',
  },
  detailedContainer: {
    marginTop: 16,
    marginHorizontal: 20,
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  detailedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
  },
  detailedTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  categoriesGrid: {
    gap: 12,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    gap: 12,
  },
  categoryIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  categoryRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryScore: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    minWidth: 32,
    textAlign: 'right',
  },
  lockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
    borderRadius: 12,
  },
  lockedText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
});
