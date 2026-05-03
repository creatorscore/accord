import { View } from 'react-native';
import LottieView from 'lottie-react-native';

/**
 * Two-hands high-five motion graphic. Source: After Effects export, recolored
 * in-place to brand palette (#A08AB7 outlines, white fills).
 */
export default function HandshakeLoader({ size = 320 }: { size?: number }) {
  return (
    <View
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Two hands meeting in a high five"
    >
      <LottieView
        source={require('@/assets/animations/handshake.json')}
        autoPlay
        loop
        style={{ width: size, height: size }}
      />
    </View>
  );
}
