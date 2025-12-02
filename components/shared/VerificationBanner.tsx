import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { MotiView } from 'moti';

interface VerificationBannerProps {
  onDismiss?: () => void;
}

/**
 * Compact banner prompting unverified users to verify their photos
 * Verified users get more matches and trust from other users
 */
export default function VerificationBanner({ onDismiss }: VerificationBannerProps) {
  const handleVerify = () => {
    // Navigate to privacy settings and scroll to verification section
    router.push('/settings/privacy?scrollTo=verification');
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: -10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 300 }}
      className="mx-4 mt-2"
    >
      <View
        className="rounded-full px-3 py-2 flex-row items-center"
        style={{ backgroundColor: '#A08AB7' }}
      >
        {/* Icon */}
        <MaterialCommunityIcons name="shield-check" size={18} color="white" />

        {/* Text */}
        <Text className="text-white font-semibold text-sm flex-1 ml-2">
          Get verified for 3x more matches
        </Text>

        {/* CTA Button */}
        <TouchableOpacity
          onPress={handleVerify}
          className="bg-white rounded-full px-3 py-1.5 flex-row items-center"
          activeOpacity={0.8}
        >
          <Text className="font-bold text-sm" style={{ color: '#A08AB7' }}>
            Verify
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color="#A08AB7" />
        </TouchableOpacity>

        {/* Dismiss Button */}
        {onDismiss && (
          <TouchableOpacity
            onPress={onDismiss}
            className="ml-2"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="close" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        )}
      </View>
    </MotiView>
  );
}
