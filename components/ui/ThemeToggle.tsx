/**
 * ThemeToggle Component
 *
 * A simple toggle button for switching between light and dark modes.
 * Uses the app's color scheme hook for state management.
 */

import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useColorScheme } from '@/lib/useColorScheme';
import { cn } from '@/lib/cn';

interface ThemeToggleProps {
  /** Additional class names */
  className?: string;
  /** Size of the toggle icon */
  size?: number;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ThemeToggle({ className, size = 24 }: ThemeToggleProps) {
  const { colorScheme, isDarkColorScheme, toggleColorScheme, colors } = useColorScheme();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        rotate: withSpring(isDarkColorScheme ? '180deg' : '0deg', {
          damping: 15,
          stiffness: 100,
        }),
      },
      {
        scale: withTiming(1, { duration: 200 }),
      },
    ],
  }));

  return (
    <AnimatedPressable
      onPress={toggleColorScheme}
      className={cn(
        'items-center justify-center p-2 rounded-full',
        'active:opacity-70',
        className
      )}
      style={animatedStyle}
      accessibilityRole="button"
      accessibilityLabel={`Switch to ${isDarkColorScheme ? 'light' : 'dark'} mode`}
    >
      <Ionicons
        name={isDarkColorScheme ? 'moon' : 'sunny'}
        size={size}
        color={colors.foreground}
      />
    </AnimatedPressable>
  );
}

/**
 * ThemeToggleCard Component
 *
 * A card-style theme toggle with label, suitable for settings screens.
 */
interface ThemeToggleCardProps {
  /** Additional class names */
  className?: string;
}

export function ThemeToggleCard({ className }: ThemeToggleCardProps) {
  const { isDarkColorScheme, toggleColorScheme, colors } = useColorScheme();

  return (
    <Pressable
      onPress={toggleColorScheme}
      className={cn(
        'flex-row items-center justify-between',
        'bg-card p-4 rounded-xl border border-border',
        'active:opacity-80',
        className
      )}
    >
      <View className="flex-row items-center gap-3">
        <View className="w-10 h-10 items-center justify-center rounded-full bg-secondary">
          <Ionicons
            name={isDarkColorScheme ? 'moon' : 'sunny'}
            size={20}
            color={colors.primary}
          />
        </View>
        <View>
          <Animated.Text className="text-body font-sans-medium text-foreground">
            Dark Mode
          </Animated.Text>
          <Animated.Text className="text-body-sm text-muted-foreground">
            {isDarkColorScheme ? 'On' : 'Off'}
          </Animated.Text>
        </View>
      </View>

      {/* Toggle Switch Visual */}
      <View
        className={cn(
          'w-12 h-7 rounded-full p-0.5',
          isDarkColorScheme ? 'bg-primary' : 'bg-muted'
        )}
      >
        <Animated.View
          className={cn(
            'w-6 h-6 rounded-full bg-white',
            isDarkColorScheme ? 'ml-auto' : 'ml-0'
          )}
        />
      </View>
    </Pressable>
  );
}

export default ThemeToggle;
