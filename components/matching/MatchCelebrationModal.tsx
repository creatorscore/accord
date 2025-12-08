import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Image,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

const { width, height } = Dimensions.get('window');

interface MatchCelebrationModalProps {
  visible: boolean;
  matchedUser: {
    id: string;
    displayName: string;
    photoUrl?: string;
  } | null;
  currentUserPhoto?: string;
  onSendMessage: () => void;
  onKeepSwiping: () => void;
}

export default function MatchCelebrationModal({
  visible,
  matchedUser,
  currentUserPhoto,
  onSendMessage,
  onKeepSwiping,
}: MatchCelebrationModalProps) {
  const scale = useSharedValue(0);
  const heartScale = useSharedValue(0);
  const leftPhotoX = useSharedValue(-width);
  const rightPhotoX = useSharedValue(width);
  const buttonsY = useSharedValue(100);
  const buttonsOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      // Reset values
      scale.value = 0;
      heartScale.value = 0;
      leftPhotoX.value = -width;
      rightPhotoX.value = width;
      buttonsY.value = 100;
      buttonsOpacity.value = 0;

      // Animate in sequence
      scale.value = withSpring(1, { damping: 12, stiffness: 100 });

      leftPhotoX.value = withDelay(200, withSpring(0, { damping: 15, stiffness: 120 }));
      rightPhotoX.value = withDelay(200, withSpring(0, { damping: 15, stiffness: 120 }));

      heartScale.value = withDelay(
        500,
        withSequence(
          withSpring(1.3, { damping: 8, stiffness: 200 }),
          withSpring(1, { damping: 10, stiffness: 150 })
        )
      );

      buttonsY.value = withDelay(700, withSpring(0, { damping: 15 }));
      buttonsOpacity.value = withDelay(700, withTiming(1, { duration: 300 }));
    }
  }, [visible]);

  const titleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  const leftPhotoStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: leftPhotoX.value }],
  }));

  const rightPhotoStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: rightPhotoX.value }],
  }));

  const heartStyle = useAnimatedStyle(() => ({
    transform: [{ scale: heartScale.value }],
    opacity: heartScale.value,
  }));

  const buttonsStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: buttonsY.value }],
    opacity: buttonsOpacity.value,
  }));

  if (!matchedUser) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <BlurView intensity={30} style={styles.container}>
        <LinearGradient
          colors={['rgba(160, 138, 183, 0.95)', 'rgba(128, 100, 162, 0.95)']}
          style={styles.gradient}
        >
          {/* Title */}
          <Animated.View style={[styles.titleContainer, titleStyle]}>
            <Text style={styles.itsA}>It's a</Text>
            <Text style={styles.match}>Match!</Text>
            <Text style={styles.subtitle}>
              You and {matchedUser.displayName} liked each other
            </Text>
          </Animated.View>

          {/* Photos */}
          <View style={styles.photosContainer}>
            <Animated.View style={[styles.photoWrapper, styles.leftPhoto, leftPhotoStyle]}>
              {currentUserPhoto ? (
                <Image source={{ uri: currentUserPhoto }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.placeholderPhoto]}>
                  <MaterialCommunityIcons name="account" size={50} color="#fff" />
                </View>
              )}
            </Animated.View>

            <Animated.View style={[styles.heartContainer, heartStyle]}>
              <View style={styles.heartBg}>
                <MaterialCommunityIcons name="heart" size={36} color="#F43F5E" />
              </View>
            </Animated.View>

            <Animated.View style={[styles.photoWrapper, styles.rightPhoto, rightPhotoStyle]}>
              {matchedUser.photoUrl ? (
                <Image source={{ uri: matchedUser.photoUrl }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.placeholderPhoto]}>
                  <MaterialCommunityIcons name="account" size={50} color="#fff" />
                </View>
              )}
            </Animated.View>
          </View>

          {/* Buttons */}
          <Animated.View style={[styles.buttonsContainer, buttonsStyle]}>
            <TouchableOpacity style={styles.messageButton} onPress={onSendMessage}>
              <MaterialCommunityIcons name="message-text" size={22} color="#A08AB7" />
              <Text style={styles.messageButtonText}>Send a Message</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.keepSwipingButton} onPress={onKeepSwiping}>
              <Text style={styles.keepSwipingText}>Keep Swiping</Text>
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  itsA: {
    fontSize: 28,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: -5,
  },
  match: {
    fontSize: 52,
    fontWeight: '800',
    color: '#fff',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 12,
    textAlign: 'center',
  },
  photosContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 50,
  },
  photoWrapper: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  leftPhoto: {
    transform: [{ rotate: '-8deg' }],
    marginRight: -20,
    zIndex: 1,
  },
  rightPhoto: {
    transform: [{ rotate: '8deg' }],
    marginLeft: -20,
    zIndex: 1,
  },
  photo: {
    width: 130,
    height: 170,
    borderRadius: 16,
    borderWidth: 4,
    borderColor: '#fff',
  },
  placeholderPhoto: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartContainer: {
    zIndex: 10,
    position: 'absolute',
  },
  heartBg: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F43F5E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonsContainer: {
    width: '100%',
    alignItems: 'center',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    width: '100%',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  messageButtonText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#A08AB7',
    marginLeft: 10,
  },
  keepSwipingButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  keepSwipingText: {
    fontSize: 16,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.9)',
  },
});
