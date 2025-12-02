import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useTranslation } from 'react-i18next';
import Constants from 'expo-constants';
import ReviewCategorySlider from './ReviewCategorySlider';
import StarRating from './StarRating';
import { supabase } from '@/lib/supabase';

interface ReviewSubmissionModalProps {
  visible: boolean;
  onClose: () => void;
  matchId: string;
  reviewerId: string;
  revieweeId: string;
  revieweeName: string;
  onReviewSubmitted?: () => void;
}

interface ReviewRatings {
  communication_responsiveness: number;
  honesty_authenticity: number;
  respect_boundaries: number;
  compatibility_intent: number;
  reliability_followthrough: number;
}

const REVIEW_CATEGORIES = [
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

export default function ReviewSubmissionModal({
  visible,
  onClose,
  matchId,
  reviewerId,
  revieweeId,
  revieweeName,
  onReviewSubmitted,
}: ReviewSubmissionModalProps) {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [ratings, setRatings] = useState<ReviewRatings>({
    communication_responsiveness: 3,
    honesty_authenticity: 3,
    respect_boundaries: 3,
    compatibility_intent: 3,
    reliability_followthrough: 3,
  });

  const calculateOverallRating = () => {
    const values = Object.values(ratings);
    const sum = values.reduce((acc, val) => acc + val, 0);
    return (sum / values.length).toFixed(2);
  };

  const handleRatingChange = (category: keyof ReviewRatings, value: number) => {
    setRatings((prev) => ({
      ...prev,
      [category]: value,
    }));
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);

      // Get Supabase URL with fallback to app.json extra config
      const supabaseUrl =
        process.env.EXPO_PUBLIC_SUPABASE_URL ||
        Constants.expoConfig?.extra?.supabaseUrl ||
        '';

      if (!supabaseUrl) {
        console.error('[Reviews] Supabase URL not configured');
        Alert.alert('Error', 'Configuration error. Please try again later.');
        setIsSubmitting(false);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Not authenticated');
      }

      // Call Edge Function to submit review
      const response = await fetch(`${supabaseUrl}/functions/v1/reviews-submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          match_id: matchId,
          reviewer_id: reviewerId,
          reviewee_id: revieweeId,
          ratings,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit review');
      }

      Alert.alert(
        t('common.success'),
        result.revealed
          ? t('reviews.reviewSubmittedAndRevealed')
          : t('reviews.reviewSubmittedPending'),
        [
          {
            text: t('common.continue'),
            onPress: () => {
              onClose();
              onReviewSubmitted?.();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error submitting review:', error);
      Alert.alert(t('common.error'), error.message || t('reviews.submitError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const overallRating = calculateOverallRating();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('reviews.reviewTitle', { name: revieweeName })}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Overall Preview */}
          <MotiView
            from={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring' }}
            style={styles.overallCard}
          >
            <LinearGradient colors={['#A08AB7', '#A08AB7']} style={styles.overallGradient}>
              <Text style={styles.overallLabel}>{t('reviews.overallRating')}</Text>
              <View style={styles.overallScoreRow}>
                <Text style={styles.overallScore}>{overallRating}</Text>
                <StarRating rating={parseFloat(overallRating)} size={32} color="#FFF" />
              </View>
              <Text style={styles.overallHint}>{t('reviews.rateEachCategory')}</Text>
            </LinearGradient>
          </MotiView>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <MaterialCommunityIcons name="information" size={20} color="#3B82F6" />
            <Text style={styles.infoText}>{t('reviews.mutualRevealInfo')}</Text>
          </View>

          {/* Category Ratings */}
          <View style={styles.categoriesContainer}>
            {REVIEW_CATEGORIES.map((category, index) => (
              <MotiView
                key={category.key}
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 300, delay: index * 100 }}
              >
                <ReviewCategorySlider
                  categoryKey={category.key}
                  categoryName={t(`reviews.categories.${category.translationKey}.name`)}
                  description={t(`reviews.categories.${category.translationKey}.description`)}
                  icon={category.icon}
                  value={ratings[category.key as keyof ReviewRatings]}
                  onValueChange={(value) =>
                    handleRatingChange(category.key as keyof ReviewRatings, value)
                  }
                />
              </MotiView>
            ))}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <LinearGradient colors={['#A08AB7', '#A08AB7']} style={styles.submitGradient}>
              {isSubmitting ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="send" size={20} color="#FFF" />
                  <Text style={styles.submitButtonText}>{t('reviews.submitReview')}</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Disclaimer */}
          <Text style={styles.disclaimer}>{t('reviews.disclaimer')}</Text>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
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
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  overallCard: {
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
  overallGradient: {
    padding: 24,
    alignItems: 'center',
  },
  overallLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
    opacity: 0.9,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  overallScoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 8,
  },
  overallScore: {
    fontSize: 48,
    fontWeight: '700',
    color: '#FFF',
  },
  overallHint: {
    fontSize: 13,
    color: '#FFF',
    opacity: 0.8,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#EFF6FF',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3B82F6',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  categoriesContainer: {
    paddingHorizontal: 20,
  },
  submitButton: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#A08AB7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  disclaimer: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    lineHeight: 18,
  },
});
