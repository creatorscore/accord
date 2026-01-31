import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const SKELETON_BASE = '#EDE9FE';     // lavender-100
const SKELETON_HIGHLIGHT = '#F5F3FF'; // lavender-50

function ShimmerOverlay({ width }: { width: number }) {
  const translateX = useSharedValue(-width);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(width, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, [width]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }, animatedStyle]}>
      <LinearGradient
        colors={['transparent', SKELETON_HIGHLIGHT, 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ width, height: '100%' }}
      />
    </Animated.View>
  );
}

interface SkeletonRectProps {
  width: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}

export function SkeletonRect({ width, height, borderRadius = 8, style }: SkeletonRectProps) {
  const numericWidth = typeof width === 'number' ? width : 200;

  return (
    <View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: SKELETON_BASE,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <ShimmerOverlay width={numericWidth} />
    </View>
  );
}

interface SkeletonCircleProps {
  size: number;
  style?: any;
}

export function SkeletonCircle({ size, style }: SkeletonCircleProps) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: SKELETON_BASE,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <ShimmerOverlay width={size} />
    </View>
  );
}

interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  lastLineWidth?: string;
  style?: any;
}

export function SkeletonText({ lines = 2, lineHeight = 14, lastLineWidth = '60%', style }: SkeletonTextProps) {
  return (
    <View style={[{ gap: 8 }, style]}>
      {Array.from({ length: lines }).map((_, i) => (
        <View
          key={i}
          style={{
            height: lineHeight,
            borderRadius: lineHeight / 2,
            backgroundColor: SKELETON_BASE,
            width: i === lines - 1 ? lastLineWidth as any : '100%',
            overflow: 'hidden',
          }}
        >
          <ShimmerOverlay width={200} />
        </View>
      ))}
    </View>
  );
}
