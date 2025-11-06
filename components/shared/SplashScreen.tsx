import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface SplashScreenProps {
  onFinish: () => void;
}

export function SplashScreen({ onFinish }: SplashScreenProps) {
  useEffect(() => {
    // Auto-finish after 2 seconds (faster load)
    const timer = setTimeout(() => {
      onFinish();
    }, 2000);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <LinearGradient
      colors={['#9B87CE', '#B8A9DD']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      {/* Animated Logo Container */}
      <MotiView
        from={{
          opacity: 0,
          scale: 0.8,
        }}
        animate={{
          opacity: 1,
          scale: 1,
        }}
        transition={{
          type: 'spring',
          damping: 12,
          stiffness: 100,
          mass: 0.8,
        }}
        style={styles.logoContainer}
      >
        {/* Heart Icon */}
        <View style={styles.heartCircle}>
          <MaterialCommunityIcons name="cards-heart" size={56} color="#FFFFFF" />
        </View>

        {/* App Name - Fade in */}
        <MotiView
          from={{
            opacity: 0,
            translateY: 10,
          }}
          animate={{
            opacity: 1,
            translateY: 0,
          }}
          transition={{
            type: 'timing',
            duration: 500,
            delay: 200,
            easing: Easing.out(Easing.ease),
          }}
        >
          <Text style={styles.appName}>Accord</Text>
        </MotiView>

        {/* Tagline - Fade in */}
        <MotiView
          from={{
            opacity: 0,
          }}
          animate={{
            opacity: 0.95,
          }}
          transition={{
            type: 'timing',
            duration: 400,
            delay: 500,
          }}
        >
          <Text style={styles.tagline}>Find your perfect arrangement</Text>
        </MotiView>
      </MotiView>

      {/* Subtle shimmer effect - left to right */}
      <MotiView
        from={{
          translateX: -300,
          opacity: 0.3,
        }}
        animate={{
          translateX: 300,
          opacity: 0,
        }}
        transition={{
          type: 'timing',
          duration: 1500,
          delay: 400,
          easing: Easing.out(Easing.ease),
        }}
        style={styles.shimmer}
      />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9B87CE',
    zIndex: 9999,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
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
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 200,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    transform: [{ skewX: '-20deg' }],
  },
});
