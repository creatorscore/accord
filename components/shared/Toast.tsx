import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type ToastType = 'message' | 'like' | 'match' | 'reaction' | 'info' | 'success' | 'error';

interface ToastProps {
  visible: boolean;
  type: ToastType;
  title: string;
  message: string;
  onPress?: () => void;
  onDismiss: () => void;
  duration?: number;
  avatar?: string;
}

const toastConfig: Record<ToastType, { icon: string; color: string; bgColor: string }> = {
  message: { icon: 'message', color: '#A08AB7', bgColor: '#F3F0F7' },
  like: { icon: 'heart', color: '#F43F5E', bgColor: '#FEF2F2' },
  match: { icon: 'heart-multiple', color: '#A08AB7', bgColor: '#F3F0F7' },
  reaction: { icon: 'emoticon-happy', color: '#F59E0B', bgColor: '#FFFBEB' },
  info: { icon: 'information', color: '#3B82F6', bgColor: '#EFF6FF' },
  success: { icon: 'check-circle', color: '#10B981', bgColor: '#ECFDF5' },
  error: { icon: 'alert-circle', color: '#EF4444', bgColor: '#FEF2F2' },
};

export default function Toast({
  visible,
  type,
  title,
  message,
  onPress,
  onDismiss,
  duration = 4000,
}: ToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-150);
  const opacity = useSharedValue(0);

  const config = toastConfig[type];

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 15, stiffness: 150 });
      opacity.value = withTiming(1, { duration: 200 });

      // Auto-dismiss
      const timer = setTimeout(() => {
        dismissToast();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      translateY.value = withTiming(-150, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const dismissToast = () => {
    translateY.value = withTiming(-150, { duration: 200 });
    opacity.value = withTiming(0, { duration: 200 }, () => {
      runOnJS(onDismiss)();
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + 10 },
        animatedStyle,
      ]}
    >
      <TouchableOpacity
        style={[styles.toast, { backgroundColor: config.bgColor }]}
        onPress={() => {
          if (onPress) {
            dismissToast();
            onPress();
          }
        }}
        activeOpacity={onPress ? 0.8 : 1}
      >
        <View style={[styles.iconContainer, { backgroundColor: config.color + '20' }]}>
          <MaterialCommunityIcons name={config.icon as any} size={24} color={config.color} />
        </View>
        <View style={styles.content}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {message}
          </Text>
        </View>
        <TouchableOpacity onPress={dismissToast} style={styles.closeButton}>
          <MaterialCommunityIcons name="close" size={20} color="#9CA3AF" />
        </TouchableOpacity>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  message: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  closeButton: {
    padding: 4,
    marginLeft: 8,
  },
});
