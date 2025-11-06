import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

interface ReviewPrompt {
  id: string;
  match_id: string;
  profile1_id: string;
  profile2_id: string;
  profile1_reviewed: boolean;
  profile2_reviewed: boolean;
  window_expires_at: string;
  trigger_date: string;
  reviewee_name?: string;
}

interface ReviewPromptBannerProps {
  onReviewPress: (prompt: ReviewPrompt) => void;
}

export default function ReviewPromptBanner({ onReviewPress }: ReviewPromptBannerProps) {
  const { t } = useTranslation();
  const [pendingReviews, setPendingReviews] = useState<ReviewPrompt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingReviews();

    // Refresh every minute
    const interval = setInterval(fetchPendingReviews, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchPendingReviews = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current user's profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      // Get pending review prompts
      const { data: prompts, error } = await supabase
        .from('review_prompts')
        .select(`
          *,
          match:matches!inner(
            profile1:profiles!matches_profile1_id_fkey(display_name),
            profile2:profiles!matches_profile2_id_fkey(display_name)
          )
        `)
        .eq('reviews_revealed', false)
        .lte('trigger_date', new Date().toISOString())
        .gte('window_expires_at', new Date().toISOString())
        .or(`profile1_id.eq.${profile.id},profile2_id.eq.${profile.id}`);

      if (error) {
        console.error('Error fetching review prompts:', error);
        return;
      }

      // Filter out prompts where user has already reviewed
      const pending = (prompts || []).filter((prompt: any) => {
        const isProfile1 = prompt.profile1_id === profile.id;
        const hasReviewed = isProfile1 ? prompt.profile1_reviewed : prompt.profile2_reviewed;

        if (hasReviewed) return false;

        // Get reviewee name
        const revieweeName = isProfile1
          ? prompt.match.profile2.display_name
          : prompt.match.profile1.display_name;

        prompt.reviewee_name = revieweeName;
        return true;
      });

      setPendingReviews(pending);
    } catch (error) {
      console.error('Error in fetchPendingReviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const hoursRemaining = Math.floor((expires.getTime() - now.getTime()) / (1000 * 60 * 60));

    if (hoursRemaining < 1) {
      return t('reviews.lessThanHour');
    } else if (hoursRemaining < 24) {
      return t('reviews.hoursRemaining', { hours: hoursRemaining });
    } else {
      const daysRemaining = Math.floor(hoursRemaining / 24);
      return t('reviews.daysRemaining', { days: daysRemaining });
    }
  };

  if (loading || pendingReviews.length === 0) {
    return null;
  }

  // Show only the first pending review (to avoid clutter)
  const prompt = pendingReviews[0];
  const timeRemaining = getTimeRemaining(prompt.window_expires_at);

  return (
    <MotiView
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', delay: 300 }}
      style={styles.container}
    >
      <TouchableOpacity
        style={styles.banner}
        onPress={() => onReviewPress(prompt)}
        activeOpacity={0.9}
      >
        <LinearGradient colors={['#9B87CE', '#9B87CE']} style={styles.gradient}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="star-circle" size={40} color="#FFF" />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>
              {t('reviews.reviewPromptTitle', { name: prompt.reviewee_name })}
            </Text>
            <Text style={styles.subtitle}>
              {t('reviews.reviewPromptSubtitle', { time: timeRemaining })}
            </Text>
            {pendingReviews.length > 1 && (
              <Text style={styles.badge}>
                +{pendingReviews.length - 1} {t('reviews.moreReviews')}
              </Text>
            )}
          </View>

          {/* Arrow */}
          <MaterialCommunityIcons name="chevron-right" size={28} color="#FFF" />
        </LinearGradient>
      </TouchableOpacity>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 20,
    marginVertical: 16,
  },
  banner: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#9B87CE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#FFF',
    opacity: 0.9,
    marginBottom: 4,
  },
  badge: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    opacity: 0.8,
    marginTop: 4,
  },
});
