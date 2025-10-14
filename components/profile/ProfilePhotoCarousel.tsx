import React, { useState, useRef } from 'react';
import {
  View,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Text,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { MotiView } from 'moti';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PHOTO_HEIGHT = SCREEN_WIDTH * 1.3;

interface Photo {
  url: string;
  caption?: string;
  is_primary?: boolean;
  display_order?: number;
}

interface ProfilePhotoCarouselProps {
  photos: Photo[];
  name?: string;
  age?: number;
  isVerified?: boolean;
  distance?: number;
  compatibilityScore?: number;
}

export default function ProfilePhotoCarousel({
  photos,
  name,
  age,
  isVerified,
  distance,
  compatibilityScore,
}: ProfilePhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setCurrentIndex(newIndex);
  };

  const scrollToIndex = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * SCREEN_WIDTH, animated: true });
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        scrollEventThrottle={16}
      >
        {photos.map((photo, index) => (
          <View key={index} style={styles.photoContainer}>
            <Image
              source={{ uri: photo.url }}
              style={styles.photo}
              resizeMode="cover"
            />

            {/* Gradient Overlay */}
            <LinearGradient
              colors={['transparent', 'transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
              style={styles.gradientOverlay}
            />

            {/* Photo Caption */}
            {photo.caption && (
              <MotiView
                from={{ opacity: 0, translateY: 10 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ type: 'timing', duration: 400, delay: 200 }}
                style={styles.captionContainer}
              >
                <Text style={styles.caption}>{photo.caption}</Text>
              </MotiView>
            )}

            {/* Info Overlay on First Photo */}
            {index === 0 && (
              <View style={styles.infoOverlay}>
                <MotiView
                  from={{ opacity: 0, translateY: 20 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'spring' }}
                  style={styles.nameContainer}
                >
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>
                      {name}, {age}
                    </Text>
                    {isVerified && (
                      <MotiView
                        from={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', delay: 300 }}
                      >
                        <MaterialCommunityIcons
                          name="check-decagram"
                          size={28}
                          color="#3B82F6"
                        />
                      </MotiView>
                    )}
                  </View>
                  {distance && (
                    <Text style={styles.distance}>
                      📍 {distance < 1 ? '< 1 mile away' : `${Math.round(distance)} miles away`}
                    </Text>
                  )}
                </MotiView>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Photo Indicators */}
      {photos.length > 1 && (
        <View style={styles.indicators}>
          {photos.map((_, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => scrollToIndex(index)}
              style={[
                styles.indicator,
                currentIndex === index && styles.indicatorActive,
              ]}
            >
              <MotiView
                animate={{
                  width: currentIndex === index ? 28 : 8,
                  backgroundColor: currentIndex === index ? '#fff' : 'rgba(255,255,255,0.5)',
                }}
                transition={{ type: 'spring' }}
                style={styles.indicatorDot}
              />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Compatibility Score Badge */}
      {compatibilityScore && (
        <MotiView
          from={{ scale: 0, rotate: '-15deg' }}
          animate={{ scale: 1, rotate: '0deg' }}
          transition={{ type: 'spring', delay: 500 }}
          style={styles.compatibilityBadge}
        >
          <LinearGradient
            colors={['#8B5CF6', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.compatibilityGradient}
          >
            <Text style={styles.compatibilityScore}>{compatibilityScore}%</Text>
            <Text style={styles.compatibilityLabel}>Match</Text>
          </LinearGradient>
        </MotiView>
      )}

      {/* Photo Counter */}
      <View style={styles.photoCounter}>
        <Text style={styles.photoCounterText}>
          {currentIndex + 1} / {photos.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  photoContainer: {
    width: SCREEN_WIDTH,
    height: PHOTO_HEIGHT,
    position: 'relative',
  },
  photo: {
    width: SCREEN_WIDTH,
    height: PHOTO_HEIGHT,
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: PHOTO_HEIGHT / 2,
  },
  captionContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
  },
  caption: {
    fontSize: 16,
    color: 'white',
    fontStyle: 'italic',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 24,
  },
  nameContainer: {
    marginBottom: 20,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  name: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  distance: {
    fontSize: 18,
    color: 'rgba(255, 255, 255, 0.95)',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  indicators: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  indicator: {
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  indicatorDot: {
    height: 3,
    borderRadius: 2,
  },
  indicatorActive: {
    flex: 0,
  },
  compatibilityBadge: {
    position: 'absolute',
    top: 60,
    right: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  compatibilityGradient: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compatibilityScore: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  compatibilityLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: -2,
  },
  photoCounter: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  photoCounterText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
  },
});