import { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  useColorScheme,
  StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { TOTAL_ONBOARDING_STEPS } from '@/lib/onboarding-steps';
import { usePreviewModeStore } from '@/stores/previewModeStore';

interface OnboardingLayoutProps {
  /** 0-based global step index across all screens */
  currentStep: number;
  /** Question / title text */
  title: string;
  /** Optional smaller description */
  subtitle?: string;
  /** Back button handler */
  onBack: () => void;
  /** Continue / next handler */
  onContinue: () => void;
  /** If provided, shows a Skip button instead of requiring continue */
  onSkip?: () => void;
  /** Disable the continue button */
  continueDisabled?: boolean;
  /** Custom label for the continue button */
  continueLabel?: string;
  /** Hide the bottom continue button (e.g. for photo/voice screens with custom actions) */
  hideContinue?: boolean;
  /** Current onboarding route — when provided, shows "Take a look around" preview link */
  currentRoute?: string;
  /** Content */
  children: React.ReactNode;
}

export default function OnboardingLayout({
  currentStep,
  title,
  subtitle,
  onBack,
  onContinue,
  onSkip,
  continueDisabled = false,
  continueLabel = 'Continue',
  hideContinue = false,
  currentRoute,
  children,
}: OnboardingLayoutProps) {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const enterPreviewMode = usePreviewModeStore((s) => s.enterPreviewMode);

  const handlePreviewPress = () => {
    if (currentRoute) {
      enterPreviewMode(currentRoute);
      router.push('/(tabs)/discover');
    }
  };

  // Animated progress bar
  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (currentStep + 1) / TOTAL_ONBOARDING_STEPS,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#0F0F1A' : '#FFFFFF' }]}>
      {/* Header: back + progress + skip */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialCommunityIcons
            name="chevron-left"
            size={28}
            color={isDark ? '#E5E7EB' : '#374151'}
          />
        </TouchableOpacity>

        {/* Progress bar */}
        <View style={[styles.progressTrack, { backgroundColor: isDark ? '#1F2937' : '#F0EDF4' }]}>
          <Animated.View
            style={[
              styles.progressFill,
              { width: progressWidth },
            ]}
          />
        </View>

        {/* Skip or spacer */}
        {onSkip ? (
          <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
            <Text style={[styles.skipText, { color: isDark ? '#A08AB7' : '#8B72A8' }]}>Skip</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.skipSpacer} />
        )}
      </View>

      {/* Scrollable content */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="interactive"
        >
          {/* Title */}
          <Text style={[styles.title, { color: isDark ? '#F5F5F7' : '#1A1A2E' }]}>
            {title}
          </Text>

          {subtitle && (
            <Text style={[styles.subtitle, { color: isDark ? '#8E8E93' : '#71717A' }]}>
              {subtitle}
            </Text>
          )}

          {/* Form content */}
          <View style={styles.content}>
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Bottom button */}
      {!hideContinue && (
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 24) + 12 }]}>
          {currentRoute ? (
            <TouchableOpacity onPress={handlePreviewPress} activeOpacity={0.7} style={styles.previewLink}>
              <Text style={[styles.previewLinkText, { color: isDark ? '#A08AB7' : '#8B72A8' }]}>
                Take a look around →
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.previewLinkSpacer} />
          )}
          <TouchableOpacity
            style={[
              styles.continueCircle,
              continueDisabled && styles.continueCircleDisabled,
            ]}
            onPress={onContinue}
            disabled={continueDisabled}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons
              name="arrow-right"
              size={28}
              color={continueDisabled ? '#F0EDF4' : '#FFFFFF'}
            />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#A08AB7',
  },
  skipButton: {
    width: 48,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
  },
  skipSpacer: {
    width: 48,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    lineHeight: 34,
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 8,
  },
  content: {
    marginTop: 28,
    flex: 1,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  previewLink: {
    paddingVertical: 8,
  },
  previewLinkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewLinkSpacer: {
    flex: 1,
  },
  continueCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#A08AB7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueCircleDisabled: {
    backgroundColor: '#D5CDE2',
  },
});
