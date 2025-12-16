import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
  withRepeat,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';

const { width } = Dimensions.get('window');

interface PopularityInsightsModalProps {
  visible: boolean;
  onClose: () => void;
  newLikesCount: number;
  totalLikes: number;
  percentileRank?: number; // Top X% (e.g., 10 means top 10%)
  isPremium?: boolean;
  streak?: number; // Days in a row with likes
}

// Confetti particle component
const ConfettiParticle = ({ delay, startX }: { delay: number; startX: number }) => {
  const translateY = useSharedValue(-50);
  const translateX = useSharedValue(startX);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withDelay(
      delay,
      withTiming(600, { duration: 3000, easing: Easing.out(Easing.quad) })
    );
    translateX.value = withDelay(
      delay,
      withTiming(startX + (Math.random() - 0.5) * 100, { duration: 3000 })
    );
    rotate.value = withDelay(
      delay,
      withRepeat(withTiming(360, { duration: 1000 }), -1)
    );
    opacity.value = withDelay(2000 + delay, withTiming(0, { duration: 1000 }));
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { translateX: translateX.value },
      { rotate: `${rotate.value}deg` },
    ],
    opacity: opacity.value,
  }));

  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#A08AB7', '#FF9F43', '#FF6B9D'];
  const color = colors[Math.floor(Math.random() * colors.length)];

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: 10,
          height: 10,
          backgroundColor: color,
          borderRadius: 2,
        },
        style,
      ]}
    />
  );
};

export default function PopularityInsightsModal({
  visible,
  onClose,
  newLikesCount,
  totalLikes,
  percentileRank,
  isPremium = false,
  streak = 0,
}: PopularityInsightsModalProps) {
  const scale = useSharedValue(0);
  const fireScale = useSharedValue(1);
  const statsOpacity = useSharedValue(0);
  const buttonsY = useSharedValue(100);

  useEffect(() => {
    if (visible) {
      // Reset values
      scale.value = 0;
      fireScale.value = 1;
      statsOpacity.value = 0;
      buttonsY.value = 100;

      // Animate in sequence
      scale.value = withSpring(1, { damping: 12, stiffness: 100 });

      // Pulsing fire animation
      fireScale.value = withDelay(
        300,
        withRepeat(
          withSequence(
            withTiming(1.2, { duration: 500 }),
            withTiming(1, { duration: 500 })
          ),
          -1
        )
      );

      statsOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
      buttonsY.value = withDelay(600, withSpring(0, { damping: 15 }));
    }
  }, [visible]);

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  const fireStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fireScale.value }],
  }));

  const statsStyle = useAnimatedStyle(() => ({
    opacity: statsOpacity.value,
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: buttonsY.value }],
    opacity: buttonsY.value === 0 ? 1 : 0,
  }));

  // Determine the message based on performance
  const getMessage = () => {
    if (newLikesCount >= 5) {
      return { emoji: '🔥', title: "You're on Fire!", subtitle: 'Your profile is getting lots of attention!' };
    } else if (newLikesCount >= 3) {
      return { emoji: '✨', title: "You're Getting Noticed!", subtitle: 'People are loving your profile!' };
    } else if (newLikesCount >= 1) {
      return { emoji: '💜', title: 'New Admirers!', subtitle: 'Someone liked your profile!' };
    }
    return { emoji: '👋', title: 'Welcome Back!', subtitle: 'Keep swiping to find your match!' };
  };

  const message = getMessage();

  // Get ranking message
  const getRankingMessage = () => {
    if (!percentileRank) return null;
    if (percentileRank <= 5) return "You're in the top 5%! ";
    if (percentileRank <= 10) return "You're in the top 10%! ";
    if (percentileRank <= 25) return "You're in the top 25%! ";
    return null;
  };

  const rankingMessage = getRankingMessage();

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <BlurView intensity={30} style={styles.container}>
        {/* Confetti */}
        {newLikesCount >= 3 && (
          <View style={styles.confettiContainer}>
            {[...Array(20)].map((_, i) => (
              <ConfettiParticle
                key={i}
                delay={i * 100}
                startX={(i % 5) * (width / 5) + 20}
              />
            ))}
          </View>
        )}

        <LinearGradient
          colors={
            newLikesCount >= 5
              ? ['rgba(255, 107, 107, 0.95)', 'rgba(255, 159, 67, 0.95)']
              : newLikesCount >= 3
              ? ['rgba(160, 138, 183, 0.95)', 'rgba(128, 100, 162, 0.95)']
              : ['rgba(78, 205, 196, 0.95)', 'rgba(160, 138, 183, 0.95)']
          }
          style={styles.gradient}
        >
          {/* Fire/Emoji Icon */}
          <Animated.View style={[styles.emojiContainer, fireStyle]}>
            <Text style={styles.emoji}>{message.emoji}</Text>
          </Animated.View>

          {/* Title */}
          <Animated.View style={[styles.titleContainer, titleStyle]}>
            <Text style={styles.title}>{message.title}</Text>
            <Text style={styles.subtitle}>{message.subtitle}</Text>
          </Animated.View>

          {/* Stats */}
          <Animated.View style={[styles.statsContainer, statsStyle]}>
            {/* New Likes */}
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <MaterialCommunityIcons name="heart" size={24} color="#FF6B6B" />
              </View>
              <Text style={styles.statNumber}>{newLikesCount}</Text>
              <Text style={styles.statLabel}>New {newLikesCount === 1 ? 'Like' : 'Likes'}</Text>
            </View>

            {/* Total Likes */}
            <View style={styles.statCard}>
              <View style={styles.statIconContainer}>
                <MaterialCommunityIcons name="heart-multiple" size={24} color="#A08AB7" />
              </View>
              <Text style={styles.statNumber}>{totalLikes}</Text>
              <Text style={styles.statLabel}>Total Likes</Text>
            </View>

            {/* Streak or Ranking */}
            {streak > 1 ? (
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <MaterialCommunityIcons name="fire" size={24} color="#FF9F43" />
                </View>
                <Text style={styles.statNumber}>{streak}</Text>
                <Text style={styles.statLabel}>Day Streak</Text>
              </View>
            ) : percentileRank && percentileRank <= 25 ? (
              <View style={styles.statCard}>
                <View style={styles.statIconContainer}>
                  <MaterialCommunityIcons name="trophy" size={24} color="#FFD700" />
                </View>
                <Text style={styles.statNumber}>Top {percentileRank}%</Text>
                <Text style={styles.statLabel}>This Week</Text>
              </View>
            ) : null}
          </Animated.View>

          {/* Ranking Badge */}
          {rankingMessage && (
            <Animated.View style={[styles.rankingBadge, statsStyle]}>
              <MaterialCommunityIcons name="star" size={16} color="#FFD700" />
              <Text style={styles.rankingText}>{rankingMessage}</Text>
            </Animated.View>
          )}

          {/* Buttons */}
          <Animated.View style={[styles.buttonsContainer, buttonsStyle]}>
            {/* Premium Upsell - Only show for non-premium users with likes */}
            {!isPremium && newLikesCount > 0 && (
              <TouchableOpacity
                style={styles.premiumButton}
                onPress={() => {
                  onClose();
                  router.push('/settings/subscription');
                }}
              >
                <LinearGradient
                  colors={['#FFD700', '#FFA500']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.premiumButtonGradient}
                >
                  <MaterialCommunityIcons name="crown" size={20} color="#fff" />
                  <Text style={styles.premiumButtonText}>See Who Liked You</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.primaryButton} onPress={onClose}>
              <Text style={styles.primaryButtonText}>
                {newLikesCount > 0 ? 'Start Swiping' : 'Continue'}
              </Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#A08AB7" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
              <Text style={styles.secondaryButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  confettiContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    zIndex: 10,
    pointerEvents: 'none',
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  emojiContainer: {
    marginBottom: 16,
  },
  emoji: {
    fontSize: 72,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 36,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 8,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 24,
  },
  statCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    minWidth: 90,
  },
  statIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
  },
  statLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  rankingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 32,
    gap: 6,
  },
  rankingText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  buttonsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  premiumButton: {
    width: '100%',
    marginBottom: 12,
    borderRadius: 30,
    overflow: 'hidden',
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  premiumButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    gap: 10,
  },
  premiumButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: '100%',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#A08AB7',
  },
  secondaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.8)',
  },
});
