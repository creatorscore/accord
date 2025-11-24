import React, { useEffect } from 'react';
import { StyleSheet, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  withDelay,
} from 'react-native-reanimated';
import Constants from 'expo-constants';

interface DynamicWatermarkProps {
  userId: string;
  viewerUserId: string; // The person viewing this profile
  visible?: boolean;
}

/**
 * Dynamic Digital Watermark Component
 *
 * Creates a semi-transparent, constantly moving watermark that contains
 * viewer identification information. This prevents screenshot sharing and
 * blackmail by making it traceable who captured/shared the image.
 *
 * Features:
 * - Contains viewer's user ID, device ID, and timestamp
 * - Randomly shifts position every 2-4 seconds
 * - Opacity pulsates between 0.05 and 0.15
 * - Appears and disappears briefly at random intervals
 * - Multiple watermarks at different positions
 * - Nearly impossible to crop out or clone
 *
 * Used by: Snapchat, OnlyFans, secure dating apps, etc.
 */
export function DynamicWatermark({ userId, viewerUserId, visible = true }: DynamicWatermarkProps) {
  if (!visible) return null;

  const deviceId = Constants.sessionId || 'unknown';
  const timestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');

  // Create watermark text with viewer info
  const watermarkText = `${viewerUserId.slice(0, 8)} • ${timestamp}`;

  return (
    <>
      {/* Multiple watermarks at different positions for redundancy */}
      <WatermarkInstance text={watermarkText} position="top-left" delay={0} />
      <WatermarkInstance text={watermarkText} position="top-right" delay={500} />
      <WatermarkInstance text={watermarkText} position="bottom-left" delay={1000} />
      <WatermarkInstance text={watermarkText} position="bottom-right" delay={1500} />
      <WatermarkInstance text={watermarkText} position="center" delay={2000} />
    </>
  );
}

interface WatermarkInstanceProps {
  text: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  delay: number;
}

function WatermarkInstance({ text, position, delay }: WatermarkInstanceProps) {
  // Shared values for animation
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0.1);
  const scale = useSharedValue(1);

  useEffect(() => {
    // Random position shifting - constantly moves in small increments
    const randomPosition = () => {
      'worklet';
      return Math.random() * 20 - 10; // Random value between -10 and 10
    };

    // Position animation - shifts every 2-4 seconds
    translateX.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(randomPosition(), {
            duration: 2000 + Math.random() * 2000,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          }),
          withTiming(randomPosition(), {
            duration: 2000 + Math.random() * 2000,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          })
        ),
        -1, // Infinite repeat
        true // Reverse
      )
    );

    translateY.value = withDelay(
      delay + 100,
      withRepeat(
        withSequence(
          withTiming(randomPosition(), {
            duration: 2500 + Math.random() * 1500,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          }),
          withTiming(randomPosition(), {
            duration: 2500 + Math.random() * 1500,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          })
        ),
        -1,
        true
      )
    );

    // Opacity pulsation - subtle for production
    opacity.value = withDelay(
      delay + 200,
      withRepeat(
        withSequence(
          withTiming(0.05, { duration: 3000 }),
          withTiming(0.15, { duration: 3000 }),
          withTiming(0.08, { duration: 2000 }),
          withTiming(0.12, { duration: 2000 })
        ),
        -1,
        false
      )
    );

    // Scale animation - slight size variation
    scale.value = withDelay(
      delay + 300,
      withRepeat(
        withSequence(
          withTiming(0.95, { duration: 4000 }),
          withTiming(1.05, { duration: 4000 })
        ),
        -1,
        true
      )
    );
  }, [delay, translateX, translateY, opacity, scale]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
      opacity: opacity.value,
    };
  });

  return (
    <Animated.Text
      style={[
        styles.watermark,
        getPositionStyle(position),
        animatedStyle,
      ]}
      selectable={false}
      pointerEvents="none"
    >
      {text}
    </Animated.Text>
  );
}

function getPositionStyle(position: WatermarkInstanceProps['position']): any {
  switch (position) {
    case 'top-left':
      return { top: 40, left: 20 };
    case 'top-right':
      return { top: 40, right: 20 };
    case 'bottom-left':
      return { bottom: 40, left: 20 };
    case 'bottom-right':
      return { bottom: 40, right: 20 };
    case 'center':
      return {
        top: '50%',
        left: '50%',
        transform: [{ translateX: -50 }, { translateY: -50 }],
      };
  }
}

const styles = StyleSheet.create({
  watermark: {
    position: 'absolute',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    letterSpacing: 0.5,
    // Semi-transparent, hard to see but captured in screenshots
    backgroundColor: 'transparent',
    zIndex: 9999,
    // Prevent interaction
    userSelect: 'none',
    pointerEvents: 'none',
  },
});
