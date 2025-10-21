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
} from 'react-native-reanimated';

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
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // Reset animation values when profile changes
  useEffect(() => {
    console.log('🔄 SwipeCard: Profile changed to', profile.id, profile.display_name);
    translateX.value = 0;
    translateY.value = 0;
    setCurrentPhotoIndex(0);
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

            {/* Photo Navigation Zones - Invisible tap areas */}
            {allPhotos.length > 1 && (
              <>
                {/* Left tap zone - previous photo */}
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={handlePreviousPhoto}
                  className="absolute left-0 top-0 bottom-0 w-1/3"
                  style={{ zIndex: 10 }}
                />
                {/* Right tap zone - next photo */}
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={handleNextPhoto}
                  className="absolute right-0 top-0 bottom-0 w-1/3"
                  style={{ zIndex: 10 }}
                />
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
            <View className="absolute bottom-0 left-0 right-0 h-64 bg-black/60" style={{ opacity: 0.8 }} />

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

              {distance && (
                <Text className="text-white/80 text-base mb-3">
                  📍 {distance}
                </Text>
              )}

              {profile.compatibility_score && (
                <View className="flex-row items-center gap-2 mb-3">
                  <View className="bg-primary-500 px-3 py-1 rounded-full">
                    <Text className="text-white font-bold text-sm">
                      {profile.compatibility_score}% Match
                    </Text>
                  </View>
                </View>
              )}

              {profile.bio && (
                <Text className="text-white/90 text-base line-clamp-2">
                  {profile.bio}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
