import { useRef, useEffect, useState } from 'react';
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
import { useTranslation } from 'react-i18next';
import { TOTAL_ONBOARDING_STEPS } from '@/lib/onboarding-steps';
import { getSectionProgress, ONBOARDING_SECTIONS } from '@/lib/onboarding-config';
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
  /** Hide the back button (e.g. on the first step) */
  hideBack?: boolean;
  /** Hide the title/subtitle (e.g. for embedded steps that manage their own header) */
  hideTitle?: boolean;
  /** Disable scrolling — use for screens where content must fit the viewport */
  noScroll?: boolean;
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
  hideBack = false,
  hideTitle = false,
  noScroll = false,
  currentRoute,
  children,
}: OnboardingLayoutProps) {
  const { t } = useTranslation();
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

  // Section-based progress
  const sectionInfo = getSectionProgress(currentStep);

  // Animated progress for current section segment
  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: sectionInfo.sectionProgress,
      duration: 350,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [currentStep]);

  // Step content fade transition
  const contentOpacity = useRef(new Animated.Value(1)).current;
  const [prevStep, setPrevStep] = useState(currentStep);
  useEffect(() => {
    if (currentStep !== prevStep) {
      Animated.sequence([
        Animated.timing(contentOpacity, {
          toValue: 0,
          duration: 100,
          useNativeDriver: true,
        }),
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
      setPrevStep(currentStep);
    }
  }, [currentStep]);

  const isLastStep = currentStep >= TOTAL_ONBOARDING_STEPS - 1;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.root, { backgroundColor: isDark ? '#0F0F1A' : '#FFFFFF' }]}>
      {/* Header: progress + skip */}
      <View style={[styles.header, { paddingTop: insets.top + 20 }]}>
        {/* Section progress bar — centered */}
        <View
          style={styles.progressContainer}
          accessibilityRole="progressbar"
          accessibilityLabel={`${sectionInfo.sectionLabel}: step ${currentStep + 1} of ${TOTAL_ONBOARDING_STEPS}`}
          accessibilityValue={{ min: 0, max: TOTAL_ONBOARDING_STEPS, now: currentStep + 1 }}
        >
          <View style={styles.sectionSegments}>
            {ONBOARDING_SECTIONS.map((section, i) => {
              const isComplete = i < sectionInfo.sectionIndex;
              const isCurrent = i === sectionInfo.sectionIndex;
              return (
                <View
                  key={section.key}
                  style={[
                    styles.sectionSegment,
                    { backgroundColor: isDark ? '#2A2A3D' : '#EDE9F3' },
                  ]}
                >
                  {isComplete ? (
                    <View style={[styles.segmentFill, { width: '100%' }]} />
                  ) : isCurrent ? (
                    <Animated.View style={[styles.segmentFill, { width: progressWidth }]} />
                  ) : null}
                </View>
              );
            })}
          </View>
          <Text style={[styles.sectionLabel, { color: isDark ? '#8E8E93' : '#A08AB7' }]}>
            {/* Section label (Basics, Identity, Goals, etc.) routed through
                i18n so non-English locales show a translated label. Falls
                back to the hardcoded English from ONBOARDING_SECTIONS. */}
            {t(`onboarding.sections.${ONBOARDING_SECTIONS.find(s => s.label === sectionInfo.sectionLabel)?.key ?? 'basics'}`, sectionInfo.sectionLabel)}
          </Text>
        </View>

        {/* Skip button — absolutely positioned so it doesn't affect centering */}
        {onSkip && (
          <TouchableOpacity
            onPress={onSkip}
            style={styles.skipButton}
            accessibilityRole="button"
            accessibilityLabel="Skip this step"
          >
            <Text style={[styles.skipText, { color: isDark ? '#A08AB7' : '#8B72A8' }]}>Skip</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content (scrollable or fixed) */}
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {noScroll ? (
          <Animated.View style={[styles.noScrollContent, { opacity: contentOpacity }]}>
            {!hideTitle && (
              <Text
                style={[styles.title, { color: isDark ? '#F5F5F7' : '#1A1A2E' }]}
                accessibilityRole="header"
              >
                {title}
              </Text>
            )}
            {!hideTitle && subtitle && (
              <Text style={[styles.subtitle, { color: isDark ? '#8E8E93' : '#71717A' }]}>
                {subtitle}
              </Text>
            )}
            <View style={hideTitle ? styles.contentNoTitle : styles.content}>
              {children}
            </View>
          </Animated.View>
        ) : (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            keyboardDismissMode="interactive"
          >
            <Animated.View style={{ opacity: contentOpacity }}>
              {!hideTitle && (
                <Text
                  style={[styles.title, { color: isDark ? '#F5F5F7' : '#1A1A2E' }]}
                  accessibilityRole="header"
                >
                  {title}
                </Text>
              )}
              {!hideTitle && subtitle && (
                <Text style={[styles.subtitle, { color: isDark ? '#8E8E93' : '#71717A' }]}>
                  {subtitle}
                </Text>
              )}
              <View style={hideTitle ? styles.contentNoTitle : styles.content}>
                {children}
              </View>
            </Animated.View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* Bottom nav bar */}
      {!hideContinue && (
        <View style={[
          styles.bottomBar,
          {
            paddingBottom: Math.max(insets.bottom, 20) + 16,
            borderTopColor: isDark ? '#1F2937' : '#F3F4F6',
          },
        ]}>
          {/* Back circle — when hidden, render an invisible spacer (no
              border / no background) so the preview link stays centered.
              Previously the placeholder inherited the backCircle style's
              borderWidth with no explicit borderColor, which rendered as
              a black ring on Android. */}
          {hideBack ? (
            <View style={[styles.backCircle, { borderWidth: 0, backgroundColor: 'transparent' }]} />
          ) : (
            <TouchableOpacity
              style={[styles.backCircle, {
                backgroundColor: isDark ? '#1F2937' : '#F5F3F8',
                borderColor: isDark ? '#374151' : '#E8E3F0',
              }]}
              onPress={onBack}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color={isDark ? '#D1D5DB' : '#6B7280'}
              />
            </TouchableOpacity>
          )}

          {/* Preview link (centered) */}
          {currentRoute ? (
            <TouchableOpacity onPress={handlePreviewPress} activeOpacity={0.7} style={styles.previewLink}>
              <Text style={[styles.previewLinkText, { color: isDark ? '#A08AB7' : '#8B72A8' }]}>
                {t('onboarding.previewLink', 'Take a look around \u2192')}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.previewLinkSpacer} />
          )}

          {/* Continue — last step renders a wide labeled "Finish" pill so
              users don't miss that the matching-prefs sliders are submitted
              by tapping a button (previously just a small circle with a
              check icon, which was indistinguishable from the per-step
              continue circle and led to a chunk of users abandoning at
              step 30 with all their data filled in). */}
          {isLastStep ? (
            <TouchableOpacity
              style={[styles.finishButton, continueDisabled && styles.buttonDisabled]}
              onPress={onContinue}
              disabled={continueDisabled}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={continueLabel || t('onboarding.finish', 'Finish')}
              accessibilityState={{ disabled: continueDisabled }}
            >
              <Text style={styles.finishButtonText}>
                {continueLabel || t('onboarding.finish', 'Finish')}
              </Text>
              <MaterialCommunityIcons
                name="check"
                size={20}
                color={continueDisabled ? '#F0EDF4' : '#FFFFFF'}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.continueCircle,
                continueDisabled && styles.buttonDisabled,
              ]}
              onPress={onContinue}
              disabled={continueDisabled}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={continueLabel || 'Continue to next step'}
              accessibilityState={{ disabled: continueDisabled }}
            >
              <MaterialCommunityIcons
                name="arrow-right"
                size={24}
                color={continueDisabled ? '#F0EDF4' : '#FFFFFF'}
              />
            </TouchableOpacity>
          )}
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

  // ── Header ──────────────────────────────────────────────
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  progressContainer: {
    width: '100%',
    gap: 6,
  },
  sectionSegments: {
    flexDirection: 'row',
    gap: 5,
  },
  sectionSegment: {
    flex: 1,
    height: 5,
    borderRadius: 2.5,
    overflow: 'hidden',
  },
  segmentFill: {
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#A08AB7',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  skipButton: {
    position: 'absolute',
    right: 24,
    bottom: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  skipText: {
    fontSize: 16,
    fontWeight: '600',
  },

  // ── Scroll content ──────────────────────────────────────
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
    flexGrow: 1,
  },
  noScrollContent: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  content: {
    marginTop: 24,
    flex: 1,
  },
  contentNoTitle: {
    marginTop: 8,
    flex: 1,
  },

  // ── Bottom bar ──────────────────────────────────────────
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 14,
    borderTopWidth: 1,
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
  backCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#A08AB7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#A08AB7',
    paddingHorizontal: 28,
    height: 52,
    borderRadius: 26,
  },
  finishButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
});
