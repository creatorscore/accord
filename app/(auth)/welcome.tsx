import { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

function AnimatedButton({ onPress, style, children }: { onPress: () => void; style: any; children: React.ReactNode }) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
        onPressIn={() => {
          Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true, speed: 50 }).start();
        }}
        onPressOut={() => {
          Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 8 }).start();
        }}
        style={style}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export default function Welcome() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#A08AB7', '#CDC2E5']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 10 }]}
    >
      <StatusBar style="light" />

      {/* Hero Section */}
      <View style={styles.heroSection}>
        <MaterialCommunityIcons name="heart" size={56} color="#FFFFFF" style={styles.heroIcon} />
        <Text style={styles.title}>
          {t('auth.welcome.title')}
        </Text>
        <Text style={styles.tagline}>
          {t('auth.welcome.tagline')}
        </Text>
        <Text style={styles.subtitle}>
          {t('auth.welcome.subtitle')}
        </Text>
      </View>

      {/* Value Props */}
      <View style={styles.valuePropsContainer}>
        <View style={styles.valuePropsRow}>
          <View style={styles.valueProp}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="shield-check-outline" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.propText}>
              {t('auth.welcome.verifiedSafe')}
            </Text>
          </View>

          <View style={styles.valueProp}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="cards-heart-outline" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.propText}>
              {t('auth.welcome.smartMatching')}
            </Text>
          </View>

          <View style={styles.valueProp}>
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="lock-outline" size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.propText}>
              {t('auth.welcome.privacyFirst')}
            </Text>
          </View>
        </View>

        {/* Trust Badge */}
        <View style={styles.trustBadge}>
          <MaterialCommunityIcons name="handshake-outline" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
          <Text style={styles.badgeText}>
            {t('auth.welcome.trustBadge')}
          </Text>
        </View>
      </View>

      {/* CTA Buttons */}
      <View style={styles.ctaContainer}>
        <AnimatedButton
          onPress={() => router.push('/(auth)/sign-up')}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>
            {t('auth.welcome.getStarted')}
          </Text>
        </AnimatedButton>

        <AnimatedButton
          onPress={() => router.push('/(auth)/sign-in')}
          style={styles.secondaryButton}
        >
          <Text style={styles.secondaryButtonText}>
            {t('auth.welcome.signIn')}
          </Text>
        </AnimatedButton>

        <Text style={styles.footerText}>
          {t('auth.welcome.footer')}
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  heroSection: {
    flex: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 160,
  },
  heroIcon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 40,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 24,
    fontFamily: 'PlusJakartaSans-SemiBold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter',
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 24,
  },
  valuePropsContainer: {
    marginBottom: 24,
    flex: 0.8,
    justifyContent: 'center',
  },
  valuePropsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
  },
  valueProp: {
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 50,
    height: 50,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  propText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
    textAlign: 'center',
  },
  trustBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    fontSize: 16,
  },
  ctaContainer: {
    paddingBottom: 8,
    minHeight: 200,
    justifyContent: 'flex-end',
  },
  primaryButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    color: '#A08AB7',
    fontFamily: 'Inter-Bold',
    fontSize: 18,
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    fontSize: 18,
  },
  footerText: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontSize: 14,
    fontFamily: 'Inter',
  },
});
