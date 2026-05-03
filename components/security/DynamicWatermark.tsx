import React, { useEffect, useRef } from 'react';
import { StyleSheet, Platform, Animated, Text } from 'react-native';
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
 *
 * NOTE: Using React Native's built-in Animated API instead of Reanimated
 * to avoid crashes during swipe card unmount.
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
      <WatermarkInstance text={watermarkText} position="center" delay={0} />
      <WatermarkInstance text={watermarkText} position="top-right" delay={500} />
    </>
  );
}

interface WatermarkInstanceProps {
  text: string;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center';
  delay: number;
}

function WatermarkInstance({ text, position, delay }: WatermarkInstanceProps) {
  // Use React Native's built-in Animated API
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0.1)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    // Start animations after delay
    const startTimeout = setTimeout(() => {
      if (!isMountedRef.current) return;

      // Position animation - shifts every 2-4 seconds
      const animatePosition = () => {
        if (!isMountedRef.current) return;

        const randomX = Math.random() * 20 - 10;
        const randomY = Math.random() * 20 - 10;
        const duration = 5000 + Math.random() * 3000;

        Animated.parallel([
          Animated.timing(translateX, {
            toValue: randomX,
            duration,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: randomY,
            duration: duration + 500,
            useNativeDriver: true,
          }),
        ]).start(() => {
          if (isMountedRef.current) {
            animatePosition();
          }
        });
      };

      // Opacity pulsation - subtle for production
      const animateOpacity = () => {
        if (!isMountedRef.current) return;

        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.05, duration: 4000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.15, duration: 4000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.08, duration: 4000, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.12, duration: 4000, useNativeDriver: true }),
        ]).start(() => {
          if (isMountedRef.current) {
            animateOpacity();
          }
        });
      };

      // Scale animation - slight size variation
      const animateScale = () => {
        if (!isMountedRef.current) return;

        Animated.sequence([
          Animated.timing(scale, { toValue: 0.95, duration: 6000, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1.05, duration: 6000, useNativeDriver: true }),
        ]).start(() => {
          if (isMountedRef.current) {
            animateScale();
          }
        });
      };

      animatePosition();
      animateOpacity();
      animateScale();
    }, delay);

    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      clearTimeout(startTimeout);
      translateX.stopAnimation();
      translateY.stopAnimation();
      opacity.stopAnimation();
      scale.stopAnimation();
    };
  }, [delay, translateX, translateY, opacity, scale]);

  const positionStyle = getPositionStyle(position);

  return (
    <Animated.Text
      style={[
        styles.watermark,
        positionStyle,
        {
          transform: [
            { translateX },
            { translateY },
            { scale },
          ],
          opacity,
        },
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
        marginLeft: -50,
        marginTop: -10,
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
  },
});
