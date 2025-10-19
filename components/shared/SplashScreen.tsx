import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';

interface SplashScreenProps {
  onFinish: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  useEffect(() => {
    // Auto-finish after 2.5 seconds
    const timer = setTimeout(() => {
      onFinish();
    }, 2500);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <LinearGradient
      colors={['#A78BFA', '#EC4899']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Animated Heart - Scale up */}
      <MotiView
        from={{
          opacity: 0,
          scale: 0.3,
        }}
        animate={{
          opacity: 1,
          scale: 1,
        }}
        transition={{
          type: 'timing',
          duration: 800,
          easing: Easing.out(Easing.back(1.5)),
        }}
      >
        <Text style={styles.heart}>💜</Text>
      </MotiView>

      {/* Animated App Name - Fade in and slide up */}
      <MotiView
        from={{
          opacity: 0,
          translateY: 30,
        }}
        animate={{
          opacity: 1,
          translateY: 0,
        }}
        transition={{
          type: 'timing',
          duration: 600,
          delay: 400,
          easing: Easing.out(Easing.ease),
        }}
      >
        <Text style={styles.appName}>Accord</Text>
      </MotiView>

      {/* Animated Tagline - Fade in */}
      <MotiView
        from={{
          opacity: 0,
        }}
        animate={{
          opacity: 1,
        }}
        transition={{
          type: 'timing',
          duration: 500,
          delay: 800,
        }}
      >
        <Text style={styles.tagline}>Find your perfect arrangement</Text>
      </MotiView>

      {/* Pulsing Ring Animation around heart */}
      <MotiView
        from={{
          opacity: 0.7,
          scale: 1,
        }}
        animate={{
          opacity: 0,
          scale: 2.5,
        }}
        transition={{
          type: 'timing',
          duration: 1500,
          loop: true,
          easing: Easing.out(Easing.ease),
        }}
        style={styles.pulseRing}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A78BFA',
  },
  heart: {
    fontSize: 100,
    marginBottom: 24,
  },
  appName: {
    fontSize: 56,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -1,
  },
  tagline: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.95)',
    textAlign: 'center',
    fontWeight: '500',
  },
  pulseRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
});
