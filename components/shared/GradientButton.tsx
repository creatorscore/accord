import { TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

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
  const gradientColors = {
    primary: ['#A78BFA', '#EC4899'] as const, // Lavender to Hot Pink
    sunset: ['#FB923C', '#EC4899'] as const, // Orange to Pink
    twilight: ['#7C3AED', '#3B82F6'] as const, // Deep Purple to Electric Blue
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={className}
      activeOpacity={0.8}
      style={{
        shadowColor: gradientColors[variant][1],
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 12,
      }}
    >
      <LinearGradient
        colors={gradientColors[variant]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        className={`rounded-full py-5 px-8 items-center ${
          disabled || loading ? 'opacity-50' : ''
        }`}
        style={{
          minHeight: 56,
          justifyContent: 'center',
        }}
      >
        {loading ? (
          <ActivityIndicator color="white" />
        ) : (
          <Text className="text-white font-bold text-lg tracking-wide">{title}</Text>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}
