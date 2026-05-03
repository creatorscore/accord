import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { MotiView } from 'moti';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';

interface VerificationBannerProps {
  onDismiss?: () => void;
}

export default function VerificationBanner({ onDismiss }: VerificationBannerProps) {
  const { t } = useTranslation();
  const translateX = useSharedValue(0);

  const handleVerify = () => {
    router.push('/settings/privacy?scrollTo=verification');
  };

  const dismiss = () => {
    onDismiss?.();
  };

  const swipeGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) > 100) {
        translateX.value = withTiming(e.translationX > 0 ? 400 : -400, { duration: 200 });
        runOnJS(dismiss)();
      } else {
        translateX.value = withTiming(0, { duration: 200 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: 1 - Math.abs(translateX.value) / 400,
  }));

  return (
    <MotiView
      from={{ opacity: 0, translateY: -10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300 }}
      className="mt-2"
    >
      <GestureDetector gesture={swipeGesture}>
        <Animated.View style={animatedStyle}>
          <TouchableOpacity
            onPress={handleVerify}
            activeOpacity={0.9}
            style={{ backgroundColor: '#A08AB7', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center' }}
          >
            {/* Left: Verify Button */}
            <View style={{ backgroundColor: '#FFFFFF', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 10, marginRight: 12 }}>
              <MaterialCommunityIcons name="shield-check" size={22} color="#A08AB7" />
            </View>

            {/* Right: Text */}
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: '700', fontSize: 15 }}>
                {t('verification.banner.getVerified')}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 2 }}>
                {t('verification.banner.subtitle')}
              </Text>
            </View>

            <MaterialCommunityIcons name="chevron-right" size={22} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </Animated.View>
      </GestureDetector>
    </MotiView>
  );
}
