import { useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, Dimensions } from 'react-native';
import { Image } from '@/components/shared/ConditionalImage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_SIZE = SCREEN_WIDTH * 0.38;

interface MatchModalProps {
  visible: boolean;
  onClose: () => void;
  onSendMessage: () => void;
  matchedProfile: {
    display_name: string;
    photo_url?: string;
    compatibility_score?: number;
  };
  currentUserPhoto?: string;
}

export default function MatchModal({
  visible,
  onClose,
  onSendMessage,
  matchedProfile,
  currentUserPhoto,
}: MatchModalProps) {
  const progress = useSharedValue(0);
  const photoLeft = useSharedValue(-50);
  const photoRight = useSharedValue(50);

  useEffect(() => {
    if (visible) {
      // Smooth entrance
      progress.value = withTiming(1, {
        duration: 400,
        easing: Easing.out(Easing.cubic)
      });
      // Photos slide gently toward each other
      photoLeft.value = withDelay(100, withTiming(0, {
        duration: 500,
        easing: Easing.out(Easing.cubic)
      }));
      photoRight.value = withDelay(100, withTiming(0, {
        duration: 500,
        easing: Easing.out(Easing.cubic)
      }));
    } else {
      progress.value = withTiming(0, { duration: 200 });
      photoLeft.value = -50;
      photoRight.value = 50;
    }
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
  }));

  const contentStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: interpolate(progress.value, [0, 1], [30, 0]) }
    ],
  }));

  const leftPhotoStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: photoLeft.value }],
    opacity: interpolate(photoLeft.value, [-50, 0], [0, 1]),
  }));

  const rightPhotoStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: photoRight.value }],
    opacity: interpolate(photoRight.value, [50, 0], [0, 1]),
  }));

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop with gradient */}
      <Animated.View style={[{ flex: 1 }, backdropStyle]}>
        <LinearGradient
          colors={['#745f8d', '#8B6BA3', '#A08AB7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        >
          {/* Close button - top right */}
          <TouchableOpacity
            onPress={onClose}
            style={{
              position: 'absolute',
              top: 60,
              right: 24,
              zIndex: 10,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <MaterialCommunityIcons name="close" size={22} color="white" />
          </TouchableOpacity>

          {/* Main content */}
          <Animated.View
            style={[contentStyle, { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }]}
          >
            {/* The headline - fun & queer */}
            <Text style={{
              fontSize: 16,
              fontWeight: '500',
              color: 'rgba(255,255,255,0.7)',
              letterSpacing: 3,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              oh hey there
            </Text>

            <Text style={{
              fontSize: 42,
              fontWeight: '300',
              color: 'white',
              marginBottom: 12,
              letterSpacing: -1,
            }}>
              You clicked!
            </Text>

            <Text style={{
              fontSize: 16,
              color: 'rgba(255,255,255,0.8)',
              marginBottom: 40,
              textAlign: 'center',
            }}>
              The feeling is mutual ✨
            </Text>

            {/* Photos - the hero moment */}
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 48,
            }}>
              {/* Your photo */}
              <Animated.View style={[leftPhotoStyle]}>
                <View style={{
                  width: PHOTO_SIZE,
                  height: PHOTO_SIZE,
                  borderRadius: PHOTO_SIZE / 2,
                  borderWidth: 3,
                  borderColor: 'rgba(255,255,255,0.4)',
                  overflow: 'hidden',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                }}>
                  {currentUserPhoto ? (
                    <Image
                      source={{ uri: currentUserPhoto }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialCommunityIcons name="account" size={50} color="rgba(255,255,255,0.5)" />
                    </View>
                  )}
                </View>
              </Animated.View>

              {/* Subtle heart connector */}
              <View style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: 'white',
                alignItems: 'center',
                justifyContent: 'center',
                marginHorizontal: -22,
                zIndex: 10,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
              }}>
                <MaterialCommunityIcons name="heart" size={22} color="#A08AB7" />
              </View>

              {/* Their photo */}
              <Animated.View style={[rightPhotoStyle]}>
                <View style={{
                  width: PHOTO_SIZE,
                  height: PHOTO_SIZE,
                  borderRadius: PHOTO_SIZE / 2,
                  borderWidth: 3,
                  borderColor: 'rgba(255,255,255,0.4)',
                  overflow: 'hidden',
                  backgroundColor: 'rgba(255,255,255,0.1)',
                }}>
                  {matchedProfile.photo_url ? (
                    <Image
                      source={{ uri: matchedProfile.photo_url }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                    />
                  ) : (
                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialCommunityIcons name="account" size={50} color="rgba(255,255,255,0.5)" />
                    </View>
                  )}
                </View>
              </Animated.View>
            </View>

            {/* Their name */}
            <Text style={{
              fontSize: 28,
              fontWeight: '700',
              color: 'white',
              marginBottom: 8,
              letterSpacing: 0.5,
            }}>
              {matchedProfile.display_name}
            </Text>

            {/* Compatibility - eye-catching pill */}
            {matchedProfile.compatibility_score !== undefined && matchedProfile.compatibility_score !== null && (
              <View style={{
                backgroundColor: 'rgba(255,255,255,0.2)',
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                marginBottom: 48,
              }}>
                <Text style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: 'white',
                }}>
                  {matchedProfile.compatibility_score}% your type
                </Text>
              </View>
            )}

            {/* Primary action - one clear choice */}
            <TouchableOpacity
              onPress={onSendMessage}
              style={{
                backgroundColor: 'white',
                paddingVertical: 18,
                paddingHorizontal: 48,
                borderRadius: 30,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.15,
                shadowRadius: 12,
                elevation: 8,
                marginBottom: 16,
              }}
            >
              <Text style={{
                fontSize: 17,
                fontWeight: '600',
                color: '#745f8d',
                letterSpacing: 0.3,
              }}>
                Slide into their DMs
              </Text>
            </TouchableOpacity>

            {/* Secondary action - outlined button */}
            <TouchableOpacity
              onPress={onClose}
              style={{
                borderWidth: 2,
                borderColor: 'rgba(255,255,255,0.5)',
                paddingVertical: 14,
                paddingHorizontal: 32,
                borderRadius: 30,
              }}
            >
              <Text style={{
                fontSize: 16,
                color: 'white',
                fontWeight: '600',
              }}>
                Play it cool for now
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </LinearGradient>
      </Animated.View>
    </Modal>
  );
}
