import { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { Image } from '@/components/shared/ConditionalImage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import ConfettiCannon from 'react-native-confetti-cannon';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface MatchModalProps {
  visible: boolean;
  onClose: () => void;
  onSendMessage: () => void;
  matchedProfile: {
    display_name: string;
    photo_url?: string;
    compatibility_score?: number;
  };
  currentUserPhoto?: string;
}

export default function MatchModal({
  visible,
  onClose,
  onSendMessage,
  matchedProfile,
  currentUserPhoto,
}: MatchModalProps) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const heartScale = useSharedValue(0);
  const confettiRef = useRef<any>(null);

  useEffect(() => {
    if (visible) {
      // Animate modal entrance
      opacity.value = withTiming(1, { duration: 300 });
      scale.value = withSequence(
        withSpring(1.1, { damping: 10 }),
        withSpring(1, { damping: 8 })
      );

      // Animate heart icon
      heartScale.value = withDelay(
        200,
        withSequence(
          withSpring(1.3, { damping: 8 }),
          withSpring(1, { damping: 6 })
        )
      );

      // Trigger confetti after a slight delay
      setTimeout(() => {
        confettiRef.current?.start();
      }, 400);
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      scale.value = withTiming(0, { duration: 200 });
      heartScale.value = 0;
    }
  }, [visible]);

  const modalStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/70 items-center justify-center px-6">
        <Animated.View
          style={[modalStyle]}
          className="bg-white rounded-3xl p-8 w-full max-w-sm"
        >
          {/* Close Button */}
          <TouchableOpacity
            className="absolute top-4 right-4 z-10"
            onPress={onClose}
          >
            <MaterialCommunityIcons name="close" size={24} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Header */}
          <View className="items-center mb-6">
            <Text className="text-4xl font-black text-primary-500 mb-2 text-center">
              IT'S A MATCH! 🎉
            </Text>
            <Text className="text-gray-600 text-center text-base">
              You and {matchedProfile.display_name} liked each other!
            </Text>
          </View>

          {/* Profile Photos */}
          <View className="flex-row justify-center items-center mb-6 relative">
            {/* Current User Photo */}
            <View className="bg-white rounded-full border-4 border-primary-500 overflow-hidden shadow-lg">
              {currentUserPhoto ? (
                <Image
                  source={{ uri: currentUserPhoto }}
                  style={{ width: 112, height: 112 }}
                  {...(__DEV__ ? { resizeMode: 'cover' } : { contentFit: 'cover' })}
                />
              ) : (
                <View className="w-28 h-28 bg-gray-200 items-center justify-center">
                  <MaterialCommunityIcons name="account" size={50} color="#9CA3AF" />
                </View>
              )}
            </View>

            {/* Heart Icon in Center */}
            <Animated.View
              style={[heartStyle]}
              className="absolute bg-primary-500 rounded-full w-16 h-16 items-center justify-center shadow-xl"
              pointerEvents="none"
            >
              <MaterialCommunityIcons name="heart" size={32} color="white" />
            </Animated.View>

            {/* Matched Profile Photo */}
            <View className="bg-white rounded-full border-4 border-pink-500 overflow-hidden shadow-lg">
              {matchedProfile.photo_url ? (
                <Image
                  source={{ uri: matchedProfile.photo_url }}
                  style={{ width: 112, height: 112 }}
                  {...(__DEV__ ? { resizeMode: 'cover' } : { contentFit: 'cover' })}
                />
              ) : (
                <View className="w-28 h-28 bg-gray-200 items-center justify-center">
                  <MaterialCommunityIcons name="account" size={50} color="#9CA3AF" />
                </View>
              )}
            </View>
          </View>

          {/* Compatibility Score */}
          {(matchedProfile.compatibility_score !== undefined && matchedProfile.compatibility_score !== null) && (
            <View className="bg-purple-100 rounded-2xl p-4 mb-6">
              <View className="flex-row items-center justify-center">
                <MaterialCommunityIcons name="star-circle" size={24} color="#9B87CE" />
                <Text className="text-primary-500 font-bold text-lg ml-2">
                  {matchedProfile.compatibility_score}% Compatible
                </Text>
              </View>
              <Text className="text-purple-700 text-center text-sm mt-1">
                You have great potential together!
              </Text>
            </View>
          )}

          {/* Action Buttons */}
          <View className="gap-3">
            <TouchableOpacity
              className="bg-primary-500 rounded-full py-4 px-6 shadow-lg"
              onPress={onSendMessage}
            >
              <Text className="text-white font-bold text-lg text-center">
                Send Message 💬
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-gray-100 rounded-full py-4 px-6"
              onPress={onClose}
            >
              <Text className="text-gray-700 font-semibold text-lg text-center">
                Keep Swiping
              </Text>
            </TouchableOpacity>
          </View>

          {/* Fun Message */}
          <Text className="text-gray-500 text-xs text-center mt-4">
            ✨ Don't keep them waiting - say hi! ✨
          </Text>
        </Animated.View>

        {/* Floating Hearts Background Animation */}
        <FloatingHearts visible={visible} />

        {/* Confetti Cannon */}
        <ConfettiCannon
          ref={confettiRef}
          count={200}
          origin={{ x: SCREEN_WIDTH / 2, y: SCREEN_HEIGHT / 2 }}
          autoStart={false}
          fadeOut
          colors={['#9B87CE', '#B8A9DD', '#F59E0B', '#10B981', '#3B82F6', '#EF4444']}
          explosionSpeed={350}
          fallSpeed={2500}
        />
      </View>
    </Modal>
  );
}

// Floating hearts background effect
function FloatingHearts({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <View className="absolute inset-0" pointerEvents="none">
      {[...Array(12)].map((_, i) => (
        <FloatingHeart key={i} delay={i * 100} />
      ))}
    </View>
  );
}

function FloatingHeart({ delay }: { delay: number }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const randomX = Math.random() * SCREEN_WIDTH;
  const randomRotation = Math.random() * 360;

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(0.6, { duration: 500 }));
    translateY.value = withDelay(
      delay,
      withTiming(-800, { duration: 3000 })
    );

    setTimeout(() => {
      opacity.value = withTiming(0, { duration: 500 });
    }, delay + 2500);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { rotate: `${randomRotation}deg` },
    ],
  }));

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          position: 'absolute',
          bottom: 0,
          left: randomX,
        },
      ]}
    >
      <Text style={{ fontSize: 30 }}>💜</Text>
    </Animated.View>
  );
}
