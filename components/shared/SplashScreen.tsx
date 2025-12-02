import { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MotiView } from 'moti';
import { Easing } from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
    <View style={styles.container}>
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
        {/* Purple Heart Icon */}
        <MotiView
          from={{
            scale: 0,
            rotate: '-20deg',
          }}
          animate={{
            scale: 1,
            rotate: '0deg',
          }}
          transition={{
            type: 'spring',
            damping: 10,
            stiffness: 80,
            delay: 100,
          }}
        >
          <MaterialCommunityIcons name="cards-heart" size={80} color="#A08AB7" />
        </MotiView>

        {/* Tagline in pill outline - Fade in */}
        <MotiView
          from={{
            opacity: 0,
            translateY: 20,
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
          style={styles.pillContainer}
        >
          <Text style={styles.pillEmoji}>✊</Text>
          <Text style={styles.tagline}>Together against the system</Text>
        </MotiView>
      </MotiView>
    </View>
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
    backgroundColor: '#000000',
    zIndex: 9999,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#A08AB7',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 40,
  },
  pillEmoji: {
    fontSize: 18,
    marginRight: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.3,
  },
});
