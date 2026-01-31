import { useRef } from 'react';
import { Pressable, Text, ActivityIndicator, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface GradientButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'sunset' | 'twilight';
  className?: string;
}

export function GradientButton({
  title,
  onPress,
  disabled = false,
  loading = false,
  variant = 'primary',
  className = '',
}: GradientButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const gradientColors = {
    primary: ['#CDC2E5', '#CDC2E5'] as const,
    sunset: ['#FB923C', '#CDC2E5'] as const,
    twilight: ['#A08AB7', '#3B82F6'] as const,
  };

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      speed: 50,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 8,
    }).start();
  };

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Animated.View
      className={className}
      style={{
        transform: [{ scale: scaleAnim }],
        shadowColor: gradientColors[variant][1],
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 12,
      }}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled || loading}
      >
        <LinearGradient
          colors={gradientColors[variant]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            minHeight: 56,
            borderRadius: 9999,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            paddingVertical: 16,
            paddingHorizontal: 32,
            opacity: disabled || loading ? 0.5 : 1,
          }}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text className="text-white font-bold text-lg text-center">{title}</Text>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}
