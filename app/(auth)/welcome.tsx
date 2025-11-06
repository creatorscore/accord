import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from 'react-i18next';

export default function Welcome() {
  const { t } = useTranslation();
  return (
    <LinearGradient
      colors={['#A78BFA', '#B8A9DD']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <StatusBar style="light" />

      {/* Hero Section */}
      <View style={styles.hero}>
        <Text style={styles.emoji}>💜</Text>
        <Text style={styles.title}>{t('auth.welcome.title')}</Text>
        <Text style={styles.tagline}>{t('auth.welcome.tagline')}</Text>
        <Text style={styles.subtitle}>{t('auth.welcome.subtitle')}</Text>
      </View>

      {/* Value Props */}
      <View style={styles.valueProps}>
        <View style={styles.propRow}>
          <View style={styles.prop}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>🛡️</Text>
            </View>
            <Text style={styles.propText}>{t('auth.welcome.verifiedSafe')}</Text>
          </View>

          <View style={styles.prop}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>💖</Text>
            </View>
            <Text style={styles.propText}>{t('auth.welcome.smartMatching')}</Text>
          </View>

          <View style={styles.prop}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>🔒</Text>
            </View>
            <Text style={styles.propText}>{t('auth.welcome.privacyFirst')}</Text>
          </View>
        </View>

        {/* Trust Badge */}
        <View style={styles.trustBadge}>
          <Text style={styles.rainbow}>✊</Text>
          <Text style={styles.trustText}>{t('auth.welcome.trustBadge')}</Text>
        </View>
      </View>

      {/* CTA Buttons */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/sign-up')}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryButtonText}>{t('auth.welcome.getStarted')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(auth)/sign-in')}
          activeOpacity={0.9}
        >
          <Text style={styles.secondaryButtonText}>{t('auth.welcome.signIn')}</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
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
    paddingTop: 40,
    paddingBottom: 40,
  },
  hero: {
    flex: 1.2,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 160,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 24,
    fontWeight: '600',
    color: 'white',
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  valueProps: {
    marginBottom: 24,
    flex: 0.8,
    justifyContent: 'center',
  },
  propRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 32,
  },
  prop: {
    alignItems: 'center',
    flex: 1,
  },
  iconBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  icon: {
    fontSize: 24,
  },
  propText: {
    color: 'white',
    fontWeight: '600',
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
  rainbow: {
    fontSize: 20,
    marginRight: 8,
  },
  trustText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  ctaContainer: {
    paddingBottom: 8,
    minHeight: 200,
    justifyContent: 'flex-end',
  },
  primaryButton: {
    backgroundColor: 'white',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryButtonText: {
    color: '#9B87CE',
    fontWeight: 'bold',
    fontSize: 18,
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: 'white',
    borderRadius: 100,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  secondaryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  footer: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    fontSize: 14,
  },
});
