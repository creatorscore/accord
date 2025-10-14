import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function Welcome() {
  return (
    <LinearGradient
      colors={['#A78BFA', '#EC4899']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <StatusBar style="light" />

      {/* Hero Section */}
      <View style={styles.hero}>
        <Text style={styles.emoji}>💜</Text>
        <Text style={styles.title}>Accord</Text>
        <Text style={styles.tagline}>Find your perfect arrangement.</Text>
        <Text style={styles.subtitle}>The verified platform for lavender marriages</Text>
      </View>

      {/* Value Props */}
      <View style={styles.valueProps}>
        <View style={styles.propRow}>
          <View style={styles.prop}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>🛡️</Text>
            </View>
            <Text style={styles.propText}>Verified{'\n'}& Safe</Text>
          </View>

          <View style={styles.prop}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>💖</Text>
            </View>
            <Text style={styles.propText}>Smart{'\n'}Matching</Text>
          </View>

          <View style={styles.prop}>
            <View style={styles.iconBox}>
              <Text style={styles.icon}>🔒</Text>
            </View>
            <Text style={styles.propText}>Privacy{'\n'}First</Text>
          </View>
        </View>

        {/* Trust Badge */}
        <View style={styles.trustBadge}>
          <Text style={styles.rainbow}>✊</Text>
          <Text style={styles.trustText}>Together against the system</Text>
        </View>
      </View>

      {/* CTA Buttons */}
      <View style={styles.ctaContainer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(auth)/sign-up')}
          activeOpacity={0.9}
        >
          <Text style={styles.primaryButtonText}>Get Started</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={() => router.push('/(auth)/sign-in')}
          activeOpacity={0.9}
        >
          <Text style={styles.secondaryButtonText}>Sign In</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>
          Your privacy is our priority. Your happiness is our mission.
        </Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  hero: {
    flex: 2,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
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
    flex: 1,
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
    color: '#7C3AED',
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
