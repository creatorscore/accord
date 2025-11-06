import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Animated,
  Platform,
  StatusBar,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { formatDistance } from '@/lib/geolocation';

const { width, height } = Dimensions.get('window');
const HERO_HEIGHT = height * 0.6;

interface Profile {
  id: string;
  display_name: string;
  age: number;
  gender?: string | string[]; // Can be single or array for multi-select
  pronouns?: string;
  ethnicity?: string | string[]; // Can be single or array for multi-select
  sexual_orientation?: string | string[]; // Can be single or array for multi-select
  location_city?: string;
  location_state?: string;
  location_country?: string;
  latitude?: number | null;
  longitude?: number | null;
  hide_distance?: boolean;
  bio?: string;
  occupation?: string;
  education?: string;
  photos?: Array<{ url: string; is_primary: boolean }>;
  compatibility_score?: number;
  is_verified?: boolean;
  distance?: number;
  height_inches?: number;
  zodiac_sign?: string;
  personality_type?: string;
  love_language?: string | string[]; // Can be single or array for multi-select
  languages_spoken?: string[];
  my_story?: string;
  religion?: string;
  political_views?: string;
  prompt_answers?: Array<{ prompt: string; answer: string }>;
  voice_intro_url?: string;
  voice_intro_duration?: number;
  hobbies?: string[];
  interests?: {
    movies?: string[];
    music?: string[];
    books?: string[];
    tv_shows?: string[];
  };
  photo_blur_enabled?: boolean; // Privacy: blur photos until matched
  preferences?: any; // Add preferences for compatibility
}

interface Preferences {
  primary_reason?: string;
  relationship_type?: string;
  wants_children?: boolean;
  children_arrangement?: string | string[]; // Can be single or array for multi-select
  housing_preference?: string | string[]; // Can be single or array for multi-select
  financial_arrangement?: string | string[]; // Can be single or array for multi-select
  income_level?: string;
  religion?: string;
  political_views?: string;
  drinking?: string;
  smoking?: string;
  pets?: string;
  max_distance_miles?: number;
  willing_to_relocate?: boolean;
  preferred_cities?: string[];
  public_relationship?: boolean;
  family_involvement?: string;
}

interface CompatibilityBreakdown {
  overall: number;
  location: number;
  goals: number;
  lifestyle: number;
  personality: number;
  demographics: number;
  orientation: number;
}

interface ImmersiveProfileCardProps {
  profile: Profile;
  preferences?: Preferences;
  compatibilityBreakdown?: CompatibilityBreakdown; // Real compatibility data
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSuperLike?: () => void;
  onClose: () => void;
  visible: boolean;
  isMatched?: boolean; // Hide swipe actions if already matched
  onSendMessage?: () => void; // Show "Send Message" button instead
  onBlock?: () => void; // Block user
  onReport?: () => void; // Report user
}

// Helper function to format array or string values for display
const formatArrayOrString = (value?: string | string[]): string => {
  if (!value) return '';
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return value;
};

// Value-to-label mappings for preferences
const PREFERENCE_LABELS: { [key: string]: string } = {
  // Financial arrangements
  'separate': 'Keep Finances Separate',
  'shared_expenses': 'Share Living Expenses',
  'joint': 'Fully Joint Finances',
  'prenup_required': 'Prenup Required',
  'flexible': 'Flexible/Open to Discussion',

  // Housing preferences
  'separate_spaces': 'Separate Bedrooms/Spaces',
  'roommates': 'Roommate-Style Arrangement',
  'separate_homes': 'Separate Homes Nearby',
  'shared_bedroom': 'Shared Bedroom',

  // Children arrangements
  'biological': 'Biological Children',
  'adoption': 'Adoption',
  'co_parenting': 'Co-Parenting Agreement',
  'surrogacy': 'Surrogacy',
  'ivf': 'IVF',
  'already_have': 'Already Have Children',
  'open_discussion': 'Open to Discussion',

  // Primary reasons
  'financial': 'Financial Stability',
  'immigration': 'Immigration/Visa',
  'family_pressure': 'Family Pressure',
  'legal_benefits': 'Legal Benefits',
  'companionship': 'Companionship',
  'safety': 'Safety & Protection',

  // Relationship types
  'platonic': 'Platonic Only',
  'romantic': 'Romantic Partnership',
  'open': 'Open Arrangement',
};

// Helper to convert database values to display labels
const formatLabel = (value: string) => {
  // First try to get from mapping
  if (PREFERENCE_LABELS[value]) {
    return PREFERENCE_LABELS[value];
  }

  // Fallback to Title Case conversion for unmapped values
  return value
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Helper to format array fields and apply formatLabel to each item
const formatArrayWithLabels = (value?: string | string[]): string => {
  if (!value) return '';

  let items: string[] = [];

  // Handle actual arrays
  if (Array.isArray(value)) {
    items = value;
  }
  // Handle PostgreSQL array format strings like "{value1,value2}"
  else if (typeof value === 'string') {
    if (value.startsWith('{') && value.endsWith('}')) {
      items = value.slice(1, -1).split(',');
    }
    // Check if it's a JSON array string
    else if (value.startsWith('[') && value.endsWith(']')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          items = parsed;
        } else {
          items = [value];
        }
      } catch (e) {
        items = [value];
      }
    } else {
      items = [value];
    }
  }

  return items.map(formatLabel).join(', ');
};

export default function ImmersiveProfileCard({
  profile,
  preferences,
  compatibilityBreakdown,
  onSwipeLeft,
  onSwipeRight,
  onSuperLike,
  onClose,
  visible,
  isMatched = false,
  onSendMessage,
  onBlock,
  onReport,
}: ImmersiveProfileCardProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  const photos = profile.photos || [];
  const heroPhoto = photos[0]?.url || 'https://via.placeholder.com/400x600';

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const playVoiceIntro = async () => {
    try {
      if (isPlaying && sound) {
        await sound.pauseAsync();
        setIsPlaying(false);
        return;
      }

      if (!profile.voice_intro_url) return;

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      if (!sound) {
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: profile.voice_intro_url },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded && status.durationMillis) {
              setPlaybackProgress(status.positionMillis / status.durationMillis);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPlaybackProgress(0);
              }
            }
          }
        );
        setSound(newSound);
        setIsPlaying(true);
      } else {
        await sound.playAsync();
        setIsPlaying(true);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not play voice intro');
    }
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const handleAction = useCallback((action: 'pass' | 'like' | 'superlike') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (action === 'pass') onSwipeLeft();
    else if (action === 'like') onSwipeRight();
    else if (action === 'superlike' && onSuperLike) onSuperLike();
  }, [onSwipeLeft, onSwipeRight, onSuperLike]);

  if (!visible) return null;

  // Intersperse photos with content
  const photoIndexes = [1, 2, 3, 4, 5].filter(i => photos[i]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, { opacity: headerOpacity }]}>
        <BlurView intensity={90} tint="light" style={styles.headerBlur}>
          <SafeAreaView edges={['top']} style={styles.headerContent}>
            <Image
              source={{ uri: heroPhoto }}
              style={styles.headerAvatar}
              blurRadius={profile.photo_blur_enabled ? 20 : 0}
            />
            <View style={styles.headerInfo}>
              <Text style={styles.headerName} numberOfLines={1}>
                {profile.display_name}, {profile.age}
              </Text>
              {profile.compatibility_score && (
                <Text style={styles.headerMatch}>{profile.compatibility_score}% Match</Text>
              )}
            </View>
          </SafeAreaView>
        </BlurView>
      </Animated.View>

      {/* Close Button & Menu */}
      <View style={[styles.closeContainer, { top: insets.top + 8 }]}>
        <View style={styles.topButtonsRow}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <BlurView intensity={80} tint="dark" style={styles.closeBlur}>
              <Ionicons name="close" size={26} color="white" />
            </BlurView>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowActionSheet(true)} style={styles.menuButton}>
            <BlurView intensity={80} tint="dark" style={styles.closeBlur}>
              <MaterialCommunityIcons name="dots-vertical" size={26} color="white" />
            </BlurView>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Photo */}
        <View style={styles.heroContainer}>
          <Image
            source={{ uri: heroPhoto }}
            style={styles.heroImage}
            resizeMode="cover"
            blurRadius={profile.photo_blur_enabled ? 20 : 0}
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.heroGradient}
          />
          <View style={styles.heroInfo}>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroName}>{profile.display_name}, {profile.age}</Text>
              {profile.is_verified && (
                <MaterialCommunityIcons name="check-decagram" size={28} color="#3B82F6" />
              )}
            </View>
            {(profile.gender || profile.pronouns || profile.ethnicity) && (
              <View style={styles.heroIdentity}>
                <Text style={styles.heroIdentityText}>
                  {[
                    formatArrayOrString(profile.gender),
                    profile.pronouns,
                    profile.ethnicity && (Array.isArray(profile.ethnicity) ? !profile.ethnicity.includes('Prefer not to say') : profile.ethnicity !== 'Prefer not to say') ? formatArrayOrString(profile.ethnicity) : null
                  ].filter(Boolean).join(' • ')}
                </Text>
              </View>
            )}
            {profile.location_city && (
              <View style={styles.heroLocation}>
                <Ionicons name="location" size={18} color="white" />
                <Text style={styles.heroLocationText}>
                  {profile.location_city}, {profile.location_state}
                  {profile.distance && ` • ${formatDistance(profile.distance, profile.hide_distance, preferences?.willing_to_relocate)}`}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.content}>
          {/* Voice Intro */}
          {profile.voice_intro_url && (
            <TouchableOpacity onPress={playVoiceIntro} style={styles.voiceCard} activeOpacity={0.8}>
              <LinearGradient
                colors={['#9B87CE', '#9B87CE']}
                style={styles.voiceGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <View style={styles.voiceLeft}>
                  <View style={styles.voiceIconContainer}>
                    <Ionicons name={isPlaying ? 'pause' : 'play'} size={24} color="white" />
                  </View>
                  <View style={styles.voiceTextContainer}>
                    <Text style={styles.voiceTitle}>🎤 Voice Intro</Text>
                    <Text style={styles.voiceDuration}>
                      {profile.voice_intro_duration ? `${profile.voice_intro_duration}s` : 'Tap to hear my voice'}
                    </Text>
                  </View>
                </View>
                {isPlaying && (
                  <View style={styles.waveform}>
                    {[...Array(4)].map((_, i) => (
                      <Animated.View key={i} style={styles.waveBar} />
                    ))}
                  </View>
                )}
              </LinearGradient>
              {playbackProgress > 0 && (
                <View style={styles.progressBar}>
                  <View style={[styles.progressFill, { width: `${playbackProgress * 100}%` }]} />
                </View>
              )}
            </TouchableOpacity>
          )}

          {/* Compatibility Score */}
          {profile.compatibility_score && (
            <View style={styles.compatibilityCard}>
              <View style={styles.compatibilityHeader}>
                <MaterialCommunityIcons name="heart-circle" size={36} color="#9B87CE" />
                <View style={styles.compatibilityTextBox}>
                  <Text style={styles.compatibilityScore}>{profile.compatibility_score}%</Text>
                  <Text style={styles.compatibilityLabel}>Compatibility Match</Text>
                </View>
              </View>
              <View style={styles.compatibilityBreakdown}>
                {compatibilityBreakdown ? (
                  <>
                    <CompFactorBar label="Marriage Goals" score={Math.round(compatibilityBreakdown.goals)} color="#9B87CE" />
                    <CompFactorBar label="Location" score={Math.round(compatibilityBreakdown.location)} color="#3B82F6" />
                    <CompFactorBar label="Lifestyle" score={Math.round(compatibilityBreakdown.lifestyle)} color="#10B981" />
                    <CompFactorBar label="Personality" score={Math.round(compatibilityBreakdown.personality)} color="#F59E0B" />
                  </>
                ) : (
                  <>
                    <CompFactorBar label="Marriage Goals" score={92} color="#9B87CE" />
                    <CompFactorBar label="Location" score={85} color="#3B82F6" />
                    <CompFactorBar label="Lifestyle" score={88} color="#10B981" />
                    <CompFactorBar label="Personality" score={90} color="#F59E0B" />
                  </>
                )}
              </View>
            </View>
          )}

          {/* About */}
          {profile.bio && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About {profile.display_name}</Text>
              <Text style={styles.bioText}>{profile.bio}</Text>
            </View>
          )}

          {/* My Story - Longer narrative */}
          {profile.my_story && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Story</Text>
              <Text style={styles.bioText}>{profile.my_story}</Text>
            </View>
          )}

          {/* Photo 2 */}
          {photos[1] && (
            <Image
              source={{ uri: photos[1].url }}
              style={styles.storyPhoto}
              resizeMode="cover"
              blurRadius={profile.photo_blur_enabled ? 20 : 0}
            />
          )}

          {/* MARRIAGE GOALS - MOST IMPORTANT */}
          <View style={styles.criticalSection}>
            <View style={styles.criticalHeader}>
              <MaterialCommunityIcons name="ring" size={28} color="#9B87CE" />
              <Text style={styles.criticalTitle}>Marriage Goals & Expectations</Text>
            </View>

            {preferences?.primary_reason && (
              <View style={styles.criticalItem}>
                <Text style={styles.criticalLabel}>Primary reason for partnership</Text>
                <Text style={styles.criticalValue}>
                  {formatLabel(preferences.primary_reason)}
                </Text>
              </View>
            )}

            {preferences?.relationship_type && (
              <View style={styles.criticalItem}>
                <Text style={styles.criticalLabel}>Relationship dynamic</Text>
                <Text style={styles.criticalValue}>
                  {formatLabel(preferences.relationship_type)}
                </Text>
              </View>
            )}

            {preferences?.wants_children !== undefined && preferences?.wants_children !== null && (
              <View style={styles.criticalItem}>
                <Text style={styles.criticalLabel}>Children</Text>
                <Text style={styles.criticalValue}>
                  {preferences.wants_children === true ? `Yes${preferences.children_arrangement ? ` - ${formatArrayWithLabels(preferences.children_arrangement)}` : ''}` :
                   preferences.wants_children === false ? 'No children' :
                   'Maybe/Open to discussion'}
                </Text>
              </View>
            )}

            {preferences?.public_relationship !== undefined && (
              <View style={styles.criticalItem}>
                <Text style={styles.criticalLabel}>Public as a couple?</Text>
                <Text style={styles.criticalValue}>
                  {preferences.public_relationship ? 'Yes, we\'d appear as a couple publicly' : 'Prefer to keep it private'}
                </Text>
              </View>
            )}

            {preferences?.family_involvement && (
              <View style={styles.criticalItem}>
                <Text style={styles.criticalLabel}>Family involvement</Text>
                <Text style={styles.criticalValue}>{preferences.family_involvement}</Text>
              </View>
            )}
          </View>

          {/* Prompt + Photo */}
          {profile.prompt_answers?.[0] && (
            <View style={styles.promptPhotoSection}>
              <View style={styles.promptCard}>
                <Text style={styles.promptQuestion}>{profile.prompt_answers[0].prompt}</Text>
                <Text style={styles.promptAnswer}>{profile.prompt_answers[0].answer}</Text>
              </View>
              {photos[2] && (
                <Image
                  source={{ uri: photos[2].url }}
                  style={styles.promptPhoto}
                  resizeMode="cover"
                  blurRadius={profile.photo_blur_enabled ? 20 : 0}
                />
              )}
            </View>
          )}

          {/* FINANCIAL EXPECTATIONS - CRITICAL */}
          <View style={styles.criticalSection}>
            <View style={styles.criticalHeader}>
              <MaterialCommunityIcons name="currency-usd" size={28} color="#10B981" />
              <Text style={styles.criticalTitle}>Financial Expectations</Text>
            </View>

            {preferences?.income_level && (
              <View style={styles.criticalItem}>
                <Text style={styles.criticalLabel}>Income level</Text>
                <Text style={styles.criticalValue}>{preferences.income_level}</Text>
              </View>
            )}

            {preferences?.financial_arrangement && (
              <View style={styles.criticalItem}>
                <Text style={styles.criticalLabel}>Financial arrangement</Text>
                <Text style={styles.criticalValue}>{formatArrayWithLabels(preferences.financial_arrangement)}</Text>
              </View>
            )}

            {preferences?.housing_preference && (
              <View style={styles.criticalItem}>
                <Text style={styles.criticalLabel}>Living situation</Text>
                <Text style={styles.criticalValue}>{formatArrayWithLabels(preferences.housing_preference)}</Text>
              </View>
            )}
          </View>

          {/* Photo 4 */}
          {photos[3] && (
            <Image
              source={{ uri: photos[3].url }}
              style={styles.storyPhoto}
              resizeMode="cover"
              blurRadius={profile.photo_blur_enabled ? 20 : 0}
            />
          )}

          {/* LIFESTYLE COMPATIBILITY */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Lifestyle & Values</Text>
            <View style={styles.lifestyleGrid}>
              {profile.gender && (
                <LifestyleItem icon="gender-male-female" label="Gender" value={formatArrayOrString(profile.gender)} />
              )}
              {profile.pronouns && (
                <LifestyleItem icon="account" label="Pronouns" value={profile.pronouns} />
              )}
              {profile.sexual_orientation && (
                <LifestyleItem icon="heart-multiple" label="Orientation" value={formatArrayOrString(profile.sexual_orientation)} />
              )}
              {profile.ethnicity && (Array.isArray(profile.ethnicity) ? !profile.ethnicity.includes('Prefer not to say') : profile.ethnicity !== 'Prefer not to say') && (
                <LifestyleItem icon="earth" label="Ethnicity" value={formatArrayOrString(profile.ethnicity)} />
              )}
              {profile.occupation && (
                <LifestyleItem icon="briefcase" label="Work" value={profile.occupation} />
              )}
              {profile.education && (
                <LifestyleItem icon="school" label="Education" value={profile.education} />
              )}
              {profile.height_inches && (
                <LifestyleItem
                  icon="human-male-height"
                  label="Height"
                  value={`${Math.floor(profile.height_inches / 12)}'${profile.height_inches % 12}"`}
                />
              )}
              {profile.zodiac_sign && (
                <LifestyleItem icon="zodiac-gemini" label="Zodiac" value={profile.zodiac_sign} />
              )}
              {profile.personality_type && (
                <LifestyleItem icon="brain" label="Personality" value={profile.personality_type} />
              )}
              {profile.love_language && (
                <LifestyleItem icon="heart" label="Love Language" value={formatArrayOrString(profile.love_language)} />
              )}
              {profile.languages_spoken && profile.languages_spoken.length > 0 && (
                <LifestyleItem icon="translate" label="Languages" value={profile.languages_spoken.join(', ')} />
              )}
              {profile.religion && (
                <LifestyleItem icon="hands-pray" label="Religion" value={profile.religion} />
              )}
              {profile.political_views && (
                <LifestyleItem icon="vote" label="Politics" value={profile.political_views} />
              )}
              {(preferences?.drinking || preferences?.lifestyle_preferences?.drinking) && (
                <LifestyleItem icon="glass-wine" label="Drinking" value={formatLabel(preferences?.drinking || preferences?.lifestyle_preferences?.drinking)} />
              )}
              {(preferences?.smoking || preferences?.lifestyle_preferences?.smoking) && (
                <LifestyleItem icon="smoking" label="Smoking" value={formatLabel(preferences?.smoking || preferences?.lifestyle_preferences?.smoking)} />
              )}
              {(preferences?.pets || preferences?.lifestyle_preferences?.pets) && (
                <LifestyleItem icon="paw" label="Pets" value={formatLabel(preferences?.pets || preferences?.lifestyle_preferences?.pets)} />
              )}
            </View>
          </View>

          {/* Hobbies & Interests */}
          {profile.hobbies && profile.hobbies.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Hobbies & Interests</Text>
              <View style={styles.hobbiesContainer}>
                {profile.hobbies.map((hobby, index) => (
                  <View key={index} style={styles.hobbyTag}>
                    <Text style={styles.hobbyText}>{hobby}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Favorites - Movies, Music, Books, TV Shows */}
          {profile.interests && (
            profile.interests.movies?.length > 0 ||
            profile.interests.music?.length > 0 ||
            profile.interests.books?.length > 0 ||
            profile.interests.tv_shows?.length > 0
          ) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Favorites</Text>

              {profile.interests.movies && profile.interests.movies.length > 0 && (
                <View style={styles.favoriteCategory}>
                  <View style={styles.favoriteCategoryHeader}>
                    <MaterialCommunityIcons name="movie-open" size={22} color="#B8A9DD" />
                    <Text style={styles.favoriteCategoryTitle}>Movies</Text>
                  </View>
                  <View style={styles.favoritesList}>
                    {profile.interests.movies.map((movie, index) => (
                      <Text key={index} style={styles.favoriteItem}>• {movie}</Text>
                    ))}
                  </View>
                </View>
              )}

              {profile.interests.music && profile.interests.music.length > 0 && (
                <View style={styles.favoriteCategory}>
                  <View style={styles.favoriteCategoryHeader}>
                    <MaterialCommunityIcons name="music" size={22} color="#9B87CE" />
                    <Text style={styles.favoriteCategoryTitle}>Music Artists</Text>
                  </View>
                  <View style={styles.favoritesList}>
                    {profile.interests.music.map((artist, index) => (
                      <Text key={index} style={styles.favoriteItem}>• {artist}</Text>
                    ))}
                  </View>
                </View>
              )}

              {profile.interests.books && profile.interests.books.length > 0 && (
                <View style={styles.favoriteCategory}>
                  <View style={styles.favoriteCategoryHeader}>
                    <MaterialCommunityIcons name="book-open-page-variant" size={22} color="#3B82F6" />
                    <Text style={styles.favoriteCategoryTitle}>Books</Text>
                  </View>
                  <View style={styles.favoritesList}>
                    {profile.interests.books.map((book, index) => (
                      <Text key={index} style={styles.favoriteItem}>• {book}</Text>
                    ))}
                  </View>
                </View>
              )}

              {profile.interests.tv_shows && profile.interests.tv_shows.length > 0 && (
                <View style={styles.favoriteCategory}>
                  <View style={styles.favoriteCategoryHeader}>
                    <MaterialCommunityIcons name="television" size={22} color="#10B981" />
                    <Text style={styles.favoriteCategoryTitle}>TV Shows</Text>
                  </View>
                  <View style={styles.favoritesList}>
                    {profile.interests.tv_shows.map((show, index) => (
                      <Text key={index} style={styles.favoriteItem}>• {show}</Text>
                    ))}
                  </View>
                </View>
              )}
            </View>
          )}

          {/* More Prompts + Photos */}
          {profile.prompt_answers?.slice(1).map((prompt, index) => (
            <View key={index} style={styles.promptPhotoSection}>
              <View style={styles.promptCard}>
                <Text style={styles.promptQuestion}>{prompt.prompt}</Text>
                <Text style={styles.promptAnswer}>{prompt.answer}</Text>
              </View>
              {photos[4 + index] && (
                <Image
                  source={{ uri: photos[4 + index].url }}
                  style={styles.promptPhoto}
                  resizeMode="cover"
                  blurRadius={profile.photo_blur_enabled ? 20 : 0}
                />
              )}
            </View>
          ))}

          {/* LOCATION PREFERENCES */}
          {(preferences?.max_distance_miles || preferences?.willing_to_relocate || preferences?.preferred_cities) && (
            <View style={styles.criticalSection}>
              <View style={styles.criticalHeader}>
                <MaterialCommunityIcons name="map-marker-radius" size={28} color="#F59E0B" />
                <Text style={styles.criticalTitle}>Location & Relocation</Text>
              </View>

              {preferences?.max_distance_miles && (
                <View style={styles.criticalItem}>
                  <Text style={styles.criticalLabel}>Maximum distance</Text>
                  <Text style={styles.criticalValue}>Up to {preferences.max_distance_miles} miles</Text>
                </View>
              )}

              {preferences?.willing_to_relocate !== undefined && (
                <View style={styles.criticalItem}>
                  <Text style={styles.criticalLabel}>Willing to relocate?</Text>
                  <Text style={styles.criticalValue}>
                    {preferences.willing_to_relocate ? 'Yes, open to moving' : 'Prefer to stay local'}
                  </Text>
                </View>
              )}

              {preferences?.preferred_cities && preferences.preferred_cities.length > 0 && (
                <View style={styles.criticalItem}>
                  <Text style={styles.criticalLabel}>Preferred cities</Text>
                  <Text style={styles.criticalValue}>{preferences.preferred_cities.join(', ')}</Text>
                </View>
              )}
            </View>
          )}

          {/* Remaining photos */}
          {photos.slice(5).map((photo, index) => (
            <Image
              key={index}
              source={{ uri: photo.url }}
              style={styles.storyPhoto}
              resizeMode="cover"
              blurRadius={profile.photo_blur_enabled ? 20 : 0}
            />
          ))}

          <View style={{ height: 120 }} />
        </View>
      </Animated.ScrollView>

      {/* Action Buttons */}
      {!isMatched ? (
        // Swipe actions for discovery
        <SafeAreaView edges={['bottom']} style={styles.actionContainer}>
          <BlurView intensity={95} tint="light" style={styles.actionBlur}>
            <View style={styles.actionButtons}>
              <TouchableOpacity onPress={() => handleAction('pass')} style={styles.actionButton}>
                <LinearGradient colors={['#FEE2E2', '#FCA5A5']} style={styles.actionGradient}>
                  <Ionicons name="close" size={32} color="#EF4444" />
                </LinearGradient>
              </TouchableOpacity>

              {onSuperLike && (
                <TouchableOpacity onPress={() => handleAction('superlike')} style={styles.actionButton}>
                  <LinearGradient colors={['#DBEAFE', '#93C5FD']} style={styles.actionGradient}>
                    <Ionicons name="star" size={30} color="#3B82F6" />
                  </LinearGradient>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={() => handleAction('like')} style={styles.actionButton}>
                <LinearGradient colors={['#D1FAE5', '#6EE7B7']} style={styles.actionGradient}>
                  <Ionicons name="heart" size={32} color="#10B981" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </SafeAreaView>
      ) : onSendMessage ? (
        // Message button for matched profiles
        <SafeAreaView edges={['bottom']} style={styles.actionContainer}>
          <BlurView intensity={95} tint="light" style={styles.actionBlur}>
            <View style={styles.matchedActionContainer}>
              <TouchableOpacity onPress={onSendMessage} style={styles.messageButton}>
                <LinearGradient
                  colors={['#9B87CE', '#B8A9DD']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.messageButtonGradient}
                >
                  <Ionicons name="chatbubble" size={22} color="white" />
                  <Text style={styles.messageButtonText}>Send Message</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </SafeAreaView>
      ) : null}

      {/* Action Sheet Modal */}
      <Modal
        visible={showActionSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionSheet(false)}
        presentationStyle="overFullScreen"
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowActionSheet(false)}
        >
          <Pressable style={styles.actionSheet} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>
                {profile.display_name}
              </Text>
              <Pressable onPress={() => setShowActionSheet(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* Actions */}
            <View style={styles.actionsList}>
              {onReport && (
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => {
                    setShowActionSheet(false);
                    setTimeout(() => onReport(), 100);
                  }}
                >
                  <MaterialCommunityIcons name="flag" size={24} color="#6B7280" />
                  <Text style={styles.actionText}>Report</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#D1D5DB" />
                </TouchableOpacity>
              )}

              {onBlock && (
                <TouchableOpacity
                  style={[styles.actionItem, styles.actionItemDanger]}
                  onPress={() => {
                    setShowActionSheet(false);
                    setTimeout(() => onBlock(), 100);
                  }}
                >
                  <MaterialCommunityIcons name="block-helper" size={24} color="#EF4444" />
                  <Text style={[styles.actionText, styles.actionTextDanger]}>Block</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const CompFactorBar = ({ label, score, color }: { label: string; score: number; color: string }) => (
  <View style={styles.factorRow}>
    <Text style={styles.factorLabel}>{label}</Text>
    <View style={styles.factorBarContainer}>
      <View style={[styles.factorBar, { width: `${score}%`, backgroundColor: color }]} />
    </View>
    <Text style={[styles.factorScore, { color }]}>{score}%</Text>
  </View>
);

const LifestyleItem = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={styles.lifestyleItem}>
    <MaterialCommunityIcons name={icon as any} size={22} color="#9B87CE" />
    <View style={styles.lifestyleText}>
      <Text style={styles.lifestyleLabel}>{label}</Text>
      <Text style={styles.lifestyleValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  stickyHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
  },
  headerBlur: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
  },
  headerInfo: {
    flex: 1,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerMatch: {
    fontSize: 13,
    color: '#9B87CE',
    fontWeight: '600',
  },
  closeContainer: {
    position: 'absolute',
    // top is set dynamically using insets
    right: 16,
    zIndex: 1001,
  },
  topButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  closeButton: {
    // marginTop removed, now in topButtonsRow
  },
  menuButton: {
    // Same styling as close button
  },
  closeBlur: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 34,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  actionSheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  actionsList: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 12,
  },
  actionItemDanger: {
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
    marginTop: 8,
  },
  actionText: {
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  actionTextDanger: {
    color: '#EF4444',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  heroContainer: {
    height: HERO_HEIGHT,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E5E7EB',
  },
  heroGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 180,
  },
  heroInfo: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
  },
  heroNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  heroName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroIdentity: {
    marginBottom: 6,
  },
  heroIdentityText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.95)',
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  heroLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroLocationText: {
    fontSize: 17,
    color: 'white',
    fontWeight: '500',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  content: {
    padding: 20,
  },
  voiceCard: {
    marginBottom: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#9B87CE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  voiceGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
  },
  voiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  voiceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceTextContainer: {
    flex: 1,
  },
  voiceTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  voiceDuration: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  waveform: {
    flexDirection: 'row',
    gap: 3,
    alignItems: 'center',
  },
  waveBar: {
    width: 3,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: 1.5,
  },
  progressBar: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
  },
  compatibilityCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  compatibilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
  },
  compatibilityTextBox: {
    flex: 1,
  },
  compatibilityScore: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#9B87CE',
  },
  compatibilityLabel: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  compatibilityBreakdown: {
    gap: 14,
  },
  factorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  factorLabel: {
    width: 120,
    fontSize: 14,
    color: '#4B5563',
    fontWeight: '600',
  },
  factorBarContainer: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  factorBar: {
    height: '100%',
    borderRadius: 4,
  },
  factorScore: {
    width: 45,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 14,
  },
  bioText: {
    fontSize: 17,
    lineHeight: 26,
    color: '#4B5563',
  },
  storyPhoto: {
    width: '100%',
    height: width * 1.2,
    borderRadius: 16,
    marginBottom: 24,
    backgroundColor: '#E5E7EB',
  },
  criticalSection: {
    backgroundColor: '#FEFCE8',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#FDE047',
  },
  criticalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 18,
  },
  criticalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    flex: 1,
  },
  criticalItem: {
    marginBottom: 16,
  },
  criticalLabel: {
    fontSize: 14,
    color: '#78716C',
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  criticalValue: {
    fontSize: 17,
    color: '#1F2937',
    fontWeight: '600',
    lineHeight: 24,
  },
  promptPhotoSection: {
    marginBottom: 24,
  },
  promptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  promptQuestion: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 10,
  },
  promptAnswer: {
    fontSize: 18,
    color: '#1F2937',
    lineHeight: 26,
    fontWeight: '500',
  },
  promptPhoto: {
    width: '100%',
    height: width * 1.1,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  lifestyleGrid: {
    gap: 12,
  },
  lifestyleItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    gap: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  lifestyleText: {
    flex: 1,
  },
  lifestyleLabel: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '600',
    marginBottom: 4,
  },
  lifestyleValue: {
    fontSize: 16,
    color: '#1F2937',
    fontWeight: '600',
  },
  actionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1001,
  },
  actionBlur: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 18,
    gap: 28,
  },
  actionButton: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  actionGradient: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchedActionContainer: {
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  messageButton: {
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#9B87CE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  messageButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 32,
  },
  messageButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  hobbiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  hobbyTag: {
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },
  hobbyText: {
    fontSize: 15,
    color: '#9B87CE',
    fontWeight: '600',
  },
  favoriteCategory: {
    marginBottom: 20,
  },
  favoriteCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  favoriteCategoryTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  favoritesList: {
    gap: 6,
    paddingLeft: 8,
  },
  favoriteItem: {
    fontSize: 16,
    color: '#4B5563',
    lineHeight: 24,
  },
});
