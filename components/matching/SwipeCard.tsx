import { useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolate,
  withRepeat,
  withSequence,
  withDelay,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import ProfileReviewDisplay from '@/components/reviews/ProfileReviewDisplay';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DynamicWatermark } from '@/components/security/DynamicWatermark';
import { useWatermark } from '@/hooks/useWatermark';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.3;

interface Profile {
  id: string;
  display_name: string;
  age: number;
  location_city?: string;
  location_state?: string;
  bio?: string;
  photos?: Array<{ url: string; is_primary: boolean }>;
  compatibility_score?: number;
  is_verified?: boolean;
  occupation?: string;
  distance?: number;
  photo_blur_enabled?: boolean;
  hide_distance?: boolean;
  hide_last_active?: boolean;
}

interface SwipeCardProps {
  profile: Profile;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  onSwipeUp: () => void;
  onPress: () => void;
}

export default function SwipeCard({
  profile,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onPress,
}: SwipeCardProps) {
  const { viewerUserId, isReady: watermarkReady } = useWatermark();
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showNavigationHints, setShowNavigationHints] = useState(false);

  // Animation values for tutorial
  const tutorialOpacity = useSharedValue(0);
  const leftArrowScale = useSharedValue(1);
  const rightArrowScale = useSharedValue(1);

  // Check if user has seen the tutorial
  useEffect(() => {
    checkTutorialStatus();
  }, []);

  const checkTutorialStatus = async () => {
    try {
      const hasSeenTutorial = await AsyncStorage.getItem('hasSeenPhotoTutorial');
      if (!hasSeenTutorial) {
        // Show tutorial after a brief delay
        setTimeout(() => {
          setShowTutorial(true);
          tutorialOpacity.value = withTiming(1, { duration: 300 });

          // Pulse arrows to draw attention
          leftArrowScale.value = withRepeat(
            withSequence(
              withTiming(1.2, { duration: 600 }),
              withTiming(1, { duration: 600 })
            ),
            3
          );
          rightArrowScale.value = withRepeat(
            withSequence(
              withTiming(1.2, { duration: 600 }),
              withTiming(1, { duration: 600 })
            ),
            3
          );

          // Auto-dismiss tutorial after 5 seconds
          setTimeout(() => {
            dismissTutorial();
          }, 5000);
        }, 800);
      }
      // Always show navigation hints when there are multiple photos
      if (profile.photos && profile.photos.length > 1) {
        setShowNavigationHints(true);
      }
    } catch (error) {
      console.error('Error checking tutorial status:', error);
    }
  };

  const dismissTutorial = async () => {
    tutorialOpacity.value = withTiming(0, { duration: 300 });
    setTimeout(() => {
      setShowTutorial(false);
    }, 300);
    try {
      await AsyncStorage.setItem('hasSeenPhotoTutorial', 'true');
    } catch (error) {
      console.error('Error saving tutorial status:', error);
    }
  };

  // Reset animation values when profile changes
  useEffect(() => {
    console.log('🔄 SwipeCard: Profile changed to', profile.id, profile.display_name);
    translateX.value = 0;
    translateY.value = 0;
    setCurrentPhotoIndex(0);
    setShowNavigationHints(profile.photos && profile.photos.length > 1);
  }, [profile.id]);

  const allPhotos = profile.photos || [];
  const currentPhoto = allPhotos[currentPhotoIndex] || allPhotos[0];

  const handlePreviousPhoto = () => {
    if (currentPhotoIndex > 0) {
      setCurrentPhotoIndex(currentPhotoIndex - 1);
    }
  };

  const handleNextPhoto = () => {
    if (currentPhotoIndex < allPhotos.length - 1) {
      setCurrentPhotoIndex(currentPhotoIndex + 1);
    }
  };

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY;
    })
    .onEnd((event) => {
      // Swipe up for "Obsessed"
      if (translateY.value < -SWIPE_THRESHOLD && Math.abs(translateX.value) < SWIPE_THRESHOLD) {
        translateY.value = withTiming(-SCREEN_HEIGHT);
        runOnJS(onSwipeUp)();
      }
      // Swipe right for "Like"
      else if (translateX.value > SWIPE_THRESHOLD) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.5);
        runOnJS(onSwipeRight)();
      }
      // Swipe left for "Pass"
      else if (translateX.value < -SWIPE_THRESHOLD) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.5);
        runOnJS(onSwipeLeft)();
      }
      // Return to center if not swiped far enough
      else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      translateX.value,
      [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
      [-15, 0, 15],
      Extrapolate.CLAMP
    );

    const opacity = interpolate(
      Math.abs(translateX.value) + Math.abs(translateY.value),
      [0, SWIPE_THRESHOLD],
      [1, 0.8],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate: `${rotate}deg` },
      ],
      opacity,
    };
  });

  const likeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolate.CLAMP
    ),
  }));

  const nopeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolate.CLAMP
    ),
  }));

  const obsessedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateY.value,
      [-SWIPE_THRESHOLD, 0],
      [1, 0],
      Extrapolate.CLAMP
    ),
  }));

  const leftArrowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: leftArrowScale.value }],
  }));

  const rightArrowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: rightArrowScale.value }],
  }));

  const tutorialStyle = useAnimatedStyle(() => ({
    opacity: tutorialOpacity.value,
  }));

  const distance = profile.hide_distance
    ? 'Nearby'
    : profile.distance
    ? profile.distance < 1
      ? '< 1 mile away'
      : `${Math.round(profile.distance)} miles away`
    : '';

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View
        style={[cardStyle]}
        className="absolute w-full h-full px-4 pt-4"
      >
        <View className="flex-1 bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Main Photo */}
          <View className="relative flex-1">
            <Image
              source={{ uri: currentPhoto?.url || 'https://via.placeholder.com/400' }}
              className="w-full h-full"
              resizeMode="cover"
              blurRadius={profile.photo_blur_enabled ? 30 : 0}
            />

            {/* Dynamic Watermark - renders on top of the image */}
            {watermarkReady && (
              <DynamicWatermark
                userId={profile.id}
                viewerUserId={viewerUserId}
                visible={true}
              />
            )}

            {/* Photo Navigation Zones with Visible Hints */}
            {allPhotos.length > 1 && (
              <>
                {/* Left tap zone - previous photo */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handlePreviousPhoto}
                  className="absolute left-0 top-0 bottom-0 w-1/3"
                  style={{ zIndex: 10 }}
                >
                  {currentPhotoIndex > 0 && showNavigationHints && (
                    <LinearGradient
                      colors={['rgba(0,0,0,0.3)', 'transparent']}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: 60,
                        justifyContent: 'center',
                        alignItems: 'flex-start',
                        paddingLeft: 8,
                      }}
                    >
                      <Animated.View style={leftArrowStyle}>
                        <View
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            borderRadius: 20,
                            width: 40,
                            height: 40,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <MaterialCommunityIcons name="chevron-left" size={28} color="#111827" />
                        </View>
                      </Animated.View>
                    </LinearGradient>
                  )}
                </TouchableOpacity>

                {/* Right tap zone - next photo */}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={handleNextPhoto}
                  className="absolute right-0 top-0 bottom-0 w-1/3"
                  style={{ zIndex: 10 }}
                >
                  {currentPhotoIndex < allPhotos.length - 1 && showNavigationHints && (
                    <LinearGradient
                      colors={['transparent', 'rgba(0,0,0,0.3)']}
                      start={{ x: 0, y: 0.5 }}
                      end={{ x: 1, y: 0.5 }}
                      style={{
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 60,
                        justifyContent: 'center',
                        alignItems: 'flex-end',
                        paddingRight: 8,
                      }}
                    >
                      <Animated.View style={rightArrowStyle}>
                        <View
                          style={{
                            backgroundColor: 'rgba(255,255,255,0.9)',
                            borderRadius: 20,
                            width: 40,
                            height: 40,
                            justifyContent: 'center',
                            alignItems: 'center',
                          }}
                        >
                          <MaterialCommunityIcons name="chevron-right" size={28} color="#111827" />
                        </View>
                      </Animated.View>
                    </LinearGradient>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* Photo Progress Dots */}
            {allPhotos.length > 1 && (
              <View className="absolute top-4 left-0 right-0 flex-row justify-center gap-1 px-4">
                {allPhotos.map((_, index) => (
                  <View
                    key={index}
                    className={`h-1 flex-1 rounded-full ${
                      index === currentPhotoIndex ? 'bg-white' : 'bg-white/30'
                    }`}
                  />
                ))}
              </View>
            )}

            {/* Compatibility Badge - Top Right Corner */}
            {profile.compatibility_score && (
              <View className="absolute top-6 right-6" style={{ zIndex: 20 }}>
                <LinearGradient
                  colors={['#9B87CE', '#B8A9DD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    paddingVertical: 10,
                    paddingHorizontal: 16,
                    borderRadius: 20,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 8,
                    elevation: 8,
                  }}
                >
                  <View className="flex-row items-center gap-1">
                    <MaterialCommunityIcons name="heart" size={18} color="white" />
                    <Text className="text-white font-black text-lg">
                      {profile.compatibility_score}%
                    </Text>
                  </View>
                </LinearGradient>
              </View>
            )}

            {/* Swipe Overlays */}
            <Animated.View
              style={[likeStyle]}
              className="absolute top-16 right-8 bg-green-500 px-6 py-3 rounded-2xl border-4 border-white transform rotate-12"
            >
              <Text className="text-white font-black text-3xl">LIKE</Text>
            </Animated.View>

            <Animated.View
              style={[nopeStyle]}
              className="absolute top-16 left-8 bg-red-500 px-6 py-3 rounded-2xl border-4 border-white transform -rotate-12"
            >
              <Text className="text-white font-black text-3xl">NOPE</Text>
            </Animated.View>

            <Animated.View
              style={[obsessedStyle]}
              className="absolute top-1/3 left-0 right-0 items-center"
            >
              <View className="bg-primary-500 px-8 py-4 rounded-2xl border-4 border-white">
                <Text className="text-white font-black text-3xl">OBSESSED</Text>
              </View>
            </Animated.View>

            {/* Center tap zone - view full profile */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={onPress}
              className="absolute left-1/3 right-1/3 top-0 bottom-0"
              style={{ zIndex: 5 }}
            />

            {/* Dark Overlay for text readability */}
            <View className="absolute bottom-0 left-0 right-0 h-48 bg-black/60" style={{ opacity: 0.8 }} />

            {/* Profile Info - tappable to view full profile */}
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={onPress}
              className="absolute bottom-0 left-0 right-0 p-6"
              style={{ zIndex: 15 }}
            >
              <View className="flex-row items-center gap-2 mb-2">
                <Text className="text-white font-bold text-3xl">
                  {profile.display_name}, {profile.age}
                </Text>
                {profile.is_verified && (
                  <MaterialCommunityIcons name="check-decagram" size={28} color="#3B82F6" />
                )}
              </View>

              {profile.occupation && (
                <Text className="text-white/90 text-lg mb-1">
                  {profile.occupation}
                </Text>
              )}

              {(distance !== undefined && distance !== null) && (
                <Text className="text-white/80 text-base mb-3">
                  📍 {distance}
                </Text>
              )}

              {(profile.compatibility_score !== undefined && profile.compatibility_score !== null) && (
                <View className="flex-row items-center gap-2 mb-3">
                  <View className="bg-primary-500 px-3 py-1 rounded-full">
                    <Text className="text-white font-bold text-sm">
                      {profile.compatibility_score}% Match
                    </Text>
                  </View>
                </View>
              )}

              {/* Compact Review Display */}
              <ProfileReviewDisplay
                profileId={profile.id}
                compact={true}
              />
            </TouchableOpacity>

            {/* First-Time Tutorial Overlay */}
            {showTutorial && allPhotos.length > 1 && (
              <Animated.View
                style={[
                  tutorialStyle,
                  {
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.85)',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 100,
                  },
                ]}
              >
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={dismissTutorial}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  }}
                />
                <View
                  style={{
                    backgroundColor: 'white',
                    borderRadius: 24,
                    padding: 24,
                    marginHorizontal: 32,
                    maxWidth: 320,
                    alignItems: 'center',
                  }}
                >
                  <MaterialCommunityIcons name="gesture-tap" size={48} color="#9B87CE" />
                  <Text
                    style={{
                      fontSize: 22,
                      fontWeight: 'bold',
                      color: '#111827',
                      marginTop: 16,
                      marginBottom: 8,
                      textAlign: 'center',
                    }}
                  >
                    Browse Photos
                  </Text>
                  <Text
                    style={{
                      fontSize: 15,
                      color: '#6B7280',
                      textAlign: 'center',
                      lineHeight: 22,
                      marginBottom: 20,
                    }}
                  >
                    Tap the left or right side of the photo to see more pictures. Tap the center to view their full profile.
                  </Text>

                  {/* Visual Guide */}
                  <View
                    style={{
                      flexDirection: 'row',
                      gap: 12,
                      marginBottom: 20,
                      alignItems: 'center',
                    }}
                  >
                    <View style={{ alignItems: 'center' }}>
                      <View
                        style={{
                          backgroundColor: '#F3F4F6',
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        <MaterialCommunityIcons name="chevron-left" size={24} color="#9B87CE" />
                      </View>
                      <Text
                        style={{
                          fontSize: 12,
                          color: '#9CA3AF',
                          marginTop: 4,
                        }}
                      >
                        Previous
                      </Text>
                    </View>

                    <View style={{ alignItems: 'center' }}>
                      <View
                        style={{
                          backgroundColor: '#F3F4F6',
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        <MaterialCommunityIcons name="account" size={24} color="#9B87CE" />
                      </View>
                      <Text
                        style={{
                          fontSize: 12,
                          color: '#9CA3AF',
                          marginTop: 4,
                        }}
                      >
                        Profile
                      </Text>
                    </View>

                    <View style={{ alignItems: 'center' }}>
                      <View
                        style={{
                          backgroundColor: '#F3F4F6',
                          borderRadius: 12,
                          padding: 12,
                        }}
                      >
                        <MaterialCommunityIcons name="chevron-right" size={24} color="#9B87CE" />
                      </View>
                      <Text
                        style={{
                          fontSize: 12,
                          color: '#9CA3AF',
                          marginTop: 4,
                        }}
                      >
                        Next
                      </Text>
                    </View>
                  </View>

                  <TouchableOpacity
                    onPress={dismissTutorial}
                    style={{
                      backgroundColor: '#9B87CE',
                      paddingVertical: 14,
                      paddingHorizontal: 32,
                      borderRadius: 16,
                      width: '100%',
                    }}
                  >
                    <Text
                      style={{
                        color: 'white',
                        fontSize: 16,
                        fontWeight: '600',
                        textAlign: 'center',
                      }}
                    >
                      Got it!
                    </Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
