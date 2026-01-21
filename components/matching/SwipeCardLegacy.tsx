import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Dimensions, StyleSheet, PanResponder, Animated as RNAnimated } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
// Using React Native's built-in PanResponder and Animated instead of Reanimated
// to avoid SIGABRT crashes during swipe card unmount (react-native-reanimated worklet issue)
import { LinearGradient } from 'expo-linear-gradient';
import ProfileReviewDisplay from '@/components/reviews/ProfileReviewDisplay';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DynamicWatermark } from '@/components/security/DynamicWatermark';
import { useWatermark } from '@/hooks/useWatermark';
import { useSafeBlur } from '@/hooks/useSafeBlur';
import { formatDistance, DistanceUnit } from '@/lib/distance-utils';
import { Image, normalizeImageProps } from '@/components/shared/ConditionalImage';

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
  photo_verified?: boolean;
  occupation?: string;
  distance?: number;
  photo_blur_enabled?: boolean;
  hide_distance?: boolean;
  hide_last_active?: boolean;
  last_active_at?: string;
}

interface SwipeCardProps {
  profile: Profile;
  onSwipeLeft: () => Promise<boolean> | void;
  onSwipeRight: () => Promise<boolean> | void;
  onSwipeUp: () => Promise<boolean> | void;
  onPress: () => void;
  distanceUnit?: DistanceUnit;
  isAdmin?: boolean;
}

// Helper function to format last active time
const getLastActiveText = (lastActiveAt: string | undefined, hideLastActive: boolean | undefined): string | null => {
  if (hideLastActive || !lastActiveAt) return null;

  const lastActive = new Date(lastActiveAt);
  const now = new Date();
  const diffMs = now.getTime() - lastActive.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 5) return 'Active now';
  if (diffMins < 60) return `Active ${diffMins}m ago`;
  if (diffHours < 24) return `Active ${diffHours}h ago`;
  if (diffDays === 1) return 'Active yesterday';
  if (diffDays < 7) return `Active ${diffDays}d ago`;
  return null;
};

export default function SwipeCard({
  profile,
  onSwipeLeft,
  onSwipeRight,
  onSwipeUp,
  onPress,
  distanceUnit = 'miles',
  isAdmin = false,
}: SwipeCardProps) {
  const { viewerUserId, isReady: watermarkReady } = useWatermark();
  const lastActiveText = getLastActiveText(profile.last_active_at, profile.hide_last_active);

  // Safe blur hook - ensures privacy while preventing crashes
  const { blurRadius, onImageLoad, onImageError, resetBlur } = useSafeBlur({
    shouldBlur: (profile.photo_blur_enabled || false) && !isAdmin,
    blurIntensity: 30,
  });

  // Use React Native's built-in Animated API instead of Reanimated
  const pan = useRef(new RNAnimated.ValueXY()).current;
  const tutorialOpacityRN = useRef(new RNAnimated.Value(0)).current;
  const leftArrowScaleRN = useRef(new RNAnimated.Value(1)).current;
  const rightArrowScaleRN = useRef(new RNAnimated.Value(1)).current;

  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);
  const [showNavigationHints, setShowNavigationHints] = useState(false);

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

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
          if (!isMountedRef.current) return;
          setShowTutorial(true);
          RNAnimated.timing(tutorialOpacityRN, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }).start();

          // Pulse arrows to draw attention
          RNAnimated.loop(
            RNAnimated.sequence([
              RNAnimated.timing(leftArrowScaleRN, { toValue: 1.2, duration: 600, useNativeDriver: true }),
              RNAnimated.timing(leftArrowScaleRN, { toValue: 1, duration: 600, useNativeDriver: true }),
            ]),
            { iterations: 3 }
          ).start();
          RNAnimated.loop(
            RNAnimated.sequence([
              RNAnimated.timing(rightArrowScaleRN, { toValue: 1.2, duration: 600, useNativeDriver: true }),
              RNAnimated.timing(rightArrowScaleRN, { toValue: 1, duration: 600, useNativeDriver: true }),
            ]),
            { iterations: 3 }
          ).start();

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
    RNAnimated.timing(tutorialOpacityRN, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      if (isMountedRef.current) {
        setShowTutorial(false);
      }
    });
    try {
      await AsyncStorage.setItem('hasSeenPhotoTutorial', 'true');
    } catch (error) {
      console.error('Error saving tutorial status:', error);
    }
  };

  // Reset animation values when profile changes
  useEffect(() => {
    console.log('🔄 SwipeCard: Profile changed to', profile.id, profile.display_name);
    pan.setValue({ x: 0, y: 0 });
    setCurrentPhotoIndex(0);
    setShowNavigationHints(!!(profile.photos && profile.photos.length > 1));
  }, [profile.id]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      pan.stopAnimation();
      tutorialOpacityRN.stopAnimation();
      leftArrowScaleRN.stopAnimation();
      rightArrowScaleRN.stopAnimation();
    };
  }, []);

  const allPhotos = profile.photos || [];
  const currentPhoto = allPhotos[currentPhotoIndex] || allPhotos[0] || { url: 'https://via.placeholder.com/400' };

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

  // Simple swipe handlers - just call the callback
  const handleSwipe = useCallback((direction: 'left' | 'right' | 'up') => {
    if (!isMountedRef.current) return;

    // Spring back to center first
    RNAnimated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
      friction: 7,
      tension: 100,
    }).start();

    // Then call the appropriate callback
    if (direction === 'up') {
      onSwipeUp();
    } else if (direction === 'right') {
      onSwipeRight();
    } else {
      onSwipeLeft();
    }
  }, [onSwipeLeft, onSwipeRight, onSwipeUp]);

  // Create PanResponder using React Native's built-in API
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        // Only respond to significant movements
        return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        // Extract the current offset and set it
        pan.setOffset({
          x: (pan.x as any)._value || 0,
          y: (pan.y as any)._value || 0,
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: RNAnimated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: (_, gestureState) => {
        pan.flattenOffset();

        const { dx, dy } = gestureState;

        // Determine swipe direction
        if (dy < -SWIPE_THRESHOLD && Math.abs(dx) < SWIPE_THRESHOLD) {
          handleSwipe('up');
        } else if (dx > SWIPE_THRESHOLD) {
          handleSwipe('right');
        } else if (dx < -SWIPE_THRESHOLD) {
          handleSwipe('left');
        } else {
          // Spring back to center
          RNAnimated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: true,
            friction: 7,
            tension: 100,
          }).start();
        }
      },
    })
  ).current;

  // Interpolate rotation from pan.x
  const rotate = pan.x.interpolate({
    inputRange: [-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2],
    outputRange: ['-15deg', '0deg', '15deg'],
    extrapolate: 'clamp',
  });

  // Like/Nope/Obsessed opacity interpolations
  const likeOpacity = pan.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const nopeOpacity = pan.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const obsessedOpacity = pan.y.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const distance = formatDistance(profile.distance, distanceUnit, profile.hide_distance);

  // Reset blur state when photo changes
  useEffect(() => {
    resetBlur();
  }, [currentPhotoIndex, resetBlur]);

  return (
    <RNAnimated.View
      {...panResponder.panHandlers}
      style={[
        styles.cardContainer,
        {
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
            { rotate: rotate },
          ],
        },
      ]}
    >
      <View className="flex-1 bg-white rounded-3xl shadow-2xl overflow-hidden">
        {/* Main Photo */}
        <View className="relative flex-1">
          <Image
            {...normalizeImageProps({
              source: { uri: currentPhoto?.url || 'https://via.placeholder.com/400' },
              style: styles.cardImage,
              contentFit: 'cover',
              blurRadius: blurRadius, // Safe blur - protects privacy while preventing crashes
              // expo-image specific props for better performance
              cachePolicy: 'memory-disk',
              transition: 200,
              placeholder: { blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' },
              onLoad: onImageLoad,
              onError: onImageError,
            })}
          />

          {/* Dynamic Watermark - prevents screenshot sharing by embedding viewer ID */}
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
                    <RNAnimated.View style={{ transform: [{ scale: leftArrowScaleRN }] }}>
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
                    </RNAnimated.View>
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
                    <RNAnimated.View style={{ transform: [{ scale: rightArrowScaleRN }] }}>
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
                    </RNAnimated.View>
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

          {/* Swipe Overlays */}
          <RNAnimated.View
            style={[
              styles.likeOverlay,
              { opacity: likeOpacity },
            ]}
          >
            <Text className="text-white font-black text-3xl">LIKE</Text>
          </RNAnimated.View>

          <RNAnimated.View
            style={[
              styles.nopeOverlay,
              { opacity: nopeOpacity },
            ]}
          >
            <Text className="text-white font-black text-3xl">NOPE</Text>
          </RNAnimated.View>

          <RNAnimated.View
            style={[
              styles.obsessedOverlay,
              { opacity: obsessedOpacity },
            ]}
          >
            <View className="bg-lavender-500 px-8 py-4 rounded-2xl border-4 border-white">
              <Text className="text-white font-black text-3xl">OBSESSED</Text>
            </View>
          </RNAnimated.View>

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
              {profile.photo_verified && (
                <MaterialCommunityIcons name="camera-account" size={28} color="#22c55e" />
              )}
            </View>

            {lastActiveText && (
              <View className="flex-row items-center gap-1 mb-2">
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: lastActiveText === 'Active now' ? '#22c55e' : '#A08AB7' }} />
                <Text className="text-white/80 text-sm">{lastActiveText}</Text>
              </View>
            )}

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
                <View className="bg-lavender-500 px-3 py-1 rounded-full">
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
            <RNAnimated.View
              style={[
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
                  opacity: tutorialOpacityRN,
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
                <MaterialCommunityIcons name="gesture-tap" size={48} color="#A08AB7" />
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
                      <MaterialCommunityIcons name="chevron-left" size={24} color="#A08AB7" />
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
                      <MaterialCommunityIcons name="account" size={24} color="#A08AB7" />
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
                      <MaterialCommunityIcons name="chevron-right" size={24} color="#A08AB7" />
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
                    backgroundColor: '#A08AB7',
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
            </RNAnimated.View>
          )}
        </View>
      </View>
    </RNAnimated.View>
  );
}

// StyleSheet for image styling
const styles = StyleSheet.create({
  cardContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  likeOverlay: {
    position: 'absolute',
    top: 64,
    right: 32,
    backgroundColor: '#22c55e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 4,
    borderColor: 'white',
    transform: [{ rotate: '12deg' }],
  },
  nopeOverlay: {
    position: 'absolute',
    top: 64,
    left: 32,
    backgroundColor: '#ef4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 4,
    borderColor: 'white',
    transform: [{ rotate: '-12deg' }],
  },
  obsessedOverlay: {
    position: 'absolute',
    top: '33%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
