import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Animated,
  StatusBar,
  Alert,
  Modal,
  Pressable,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { getHobbyIcon } from '@/lib/hobby-options';
import { SafeBlurView } from '@/components/shared/SafeBlurView';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { formatDistance, DistanceUnit } from '@/lib/distance-utils';
import { formatHeight, HeightUnit } from '@/lib/height-utils';
import { useScreenCaptureProtection } from '@/hooks/useScreenCaptureProtection';
import { DynamicWatermark } from '@/components/security/DynamicWatermark';
import { useWatermark } from '@/hooks/useWatermark';
import ProfileReviewDisplay from '@/components/reviews/ProfileReviewDisplay';
import { useSafeBlur } from '@/hooks/useSafeBlur';
import { SafeBlurImage } from '@/components/shared/SafeBlurImage';
import { getSignedUrl } from '@/lib/signed-urls';
import { isFieldVisible } from '@/lib/field-visibility';
import { translateProfileValue, translateProfileArray } from '@/lib/translate-profile-values';
import { ZoomablePhotoWrapper } from '@/components/shared/ZoomablePhotoWrapper';
import { useTranslation } from 'react-i18next';

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
  photos?: { url: string; is_primary: boolean; blur_data_uri?: string | null }[];
  compatibility_score?: number;
  compatibilityBreakdown?: CompatibilityBreakdown;
  is_verified?: boolean;
  photo_verified?: boolean;
  distance?: number;
  height_inches?: number;
  zodiac_sign?: string;
  personality_type?: string;
  love_language?: string | string[]; // Can be single or array for multi-select
  languages_spoken?: string[];
  religion?: string;
  political_views?: string;
  prompt_answers?: { prompt: string; answer: string }[];
  voice_intro_url?: string;
  voice_intro_duration?: number;
  voice_intro_prompt?: string;
  hobbies?: string[];
  interests?: {
    movies?: string[];
    music?: string[];
    books?: string[];
    tv_shows?: string[];
  };
  hometown?: string;
  occupation?: string;
  education?: string;
  photo_blur_enabled?: boolean; // Privacy: blur photos until matched
  field_visibility?: Record<string, boolean>;
  preferences?: any; // Add preferences for compatibility
  last_active_at?: string;
  hide_last_active?: boolean;
}

interface Preferences {
  primary_reason?: string;
  primary_reasons?: string[]; // New multi-select field
  relationship_type?: string;
  wants_children?: boolean;
  children_arrangement?: string | string[]; // Can be single or array for multi-select
  housing_preference?: string | string[]; // Can be single or array for multi-select
  financial_arrangement?: string | string[]; // Can be single or array for multi-select
  income_level?: string;
  religion?: string;
  political_views?: string;
  lifestyle_preferences?: { drinking?: string; smoking?: string; pets?: string };
  drinking?: string;
  smoking?: string;
  pets?: string;
  max_distance_miles?: number;
  willing_to_relocate?: boolean;
  preferred_cities?: string[];
  public_relationship?: boolean;
  family_involvement?: string;
  dealbreakers?: string[];
  must_haves?: string[];
}

interface CompatibilityBreakdown {
  total: number; // Changed from 'overall' to match matching-algorithm.ts
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
  heightUnit?: HeightUnit; // User's preferred height unit for display
  distanceUnit?: DistanceUnit; // User's preferred distance unit for display
  onSendMessage?: () => void; // Show "Send Message" button instead
  onBlock?: () => void; // Block user
  onReport?: () => void; // Report user
  currentProfileId?: string; // ID of the user viewing this profile (for screenshot tracking)
  isAdmin?: boolean; // Admin bypasses photo blur
}

// Helper function to format array or string values for display
const formatArrayOrString = (value?: string | string[]): string => {
  if (!value) return '';
  if (Array.isArray(value)) {
    return value.join(', ');
  }
  return value;
};

// PREFERENCE_LABELS is now generated inside the component via getPreferenceLabels() for i18n support.
// formatLabel is also defined inside the component to access the translated labels.

// Fallback formatLabel for use outside the component (used by formatArrayWithLabels below)
const formatLabelFallback = (value: any): string => {
  try {
    if (!value) return '';
    if (Array.isArray(value)) return value.filter(Boolean).map(formatLabelFallback).join(', ');
    if (typeof value !== 'string') return String(value);
    return value.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  } catch {
    return typeof value === 'string' ? value : '';
  }
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
      } catch {
        items = [value];
      }
    } else {
      items = [value];
    }
  }

  // Filter out empty/null/undefined items before mapping to prevent errors
  return items.filter(item => item && typeof item === 'string').map(formatLabelFallback).join(', ');
};

// Helper function to format last active time with i18n support
const getLastActiveText = (lastActiveAt: string | undefined, hideLastActive: boolean | undefined, t: (key: string, opts?: any) => string): string | null => {
  if (hideLastActive || !lastActiveAt) return null;

  const lastActive = new Date(lastActiveAt);
  const now = new Date();
  const diffMs = now.getTime() - lastActive.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 5) return t('profileCard.activity.activeNow');
  if (diffMins < 60) return t('profileCard.activity.minutesAgo', { count: diffMins });
  if (diffHours < 24) return t('profileCard.activity.hoursAgo', { count: diffHours });
  if (diffDays === 1) return t('profileCard.activity.yesterday');
  if (diffDays < 7) return t('profileCard.activity.daysAgo', { count: diffDays });
  return null;
};

export default function ImmersiveProfileCard({
  profile,
  preferences,
  compatibilityBreakdown: compatibilityBreakdownProp,
  onSwipeLeft,
  onSwipeRight,
  onSuperLike,
  onClose,
  visible,
  isMatched = false,
  heightUnit = 'imperial',
  distanceUnit = 'miles',
  onSendMessage,
  onBlock,
  onReport,
  currentProfileId,
  isAdmin = false,
}: ImmersiveProfileCardProps) {
  const { t } = useTranslation();

  // i18n preference labels
  const getPreferenceLabels = useCallback((): { [key: string]: string } => ({
    // Financial arrangements
    'separate': t('profileCard.preferences.financial.separate'),
    'shared_expenses': t('profileCard.preferences.financial.sharedExpenses'),
    'joint': t('profileCard.preferences.financial.joint'),
    'prenup_required': t('profileCard.preferences.financial.prenupRequired'),
    'flexible': t('profileCard.preferences.financial.flexible'),
    // Housing preferences
    'separate_spaces': t('profileCard.preferences.housing.separateSpaces'),
    'roommates': t('profileCard.preferences.housing.roommates'),
    'separate_homes': t('profileCard.preferences.housing.separateHomes'),
    'shared_bedroom': t('profileCard.preferences.housing.sharedBedroom'),
    // Children arrangements
    'biological': t('profileCard.preferences.children.biological'),
    'adoption': t('profileCard.preferences.children.adoption'),
    'co_parenting': t('profileCard.preferences.children.coParenting'),
    'surrogacy': t('profileCard.preferences.children.surrogacy'),
    'ivf': t('profileCard.preferences.children.ivf'),
    'already_have': t('profileCard.preferences.children.alreadyHave'),
    'open_discussion': t('profileCard.preferences.children.openDiscussion'),
    // Primary reasons
    'financial': t('profileCard.preferences.reasons.financial'),
    'immigration': t('profileCard.preferences.reasons.immigration'),
    'family_pressure': t('profileCard.preferences.reasons.familyPressure'),
    'legal_benefits': t('profileCard.preferences.reasons.legalBenefits'),
    'companionship': t('profileCard.preferences.reasons.companionship'),
    'safety': t('profileCard.preferences.reasons.safety'),
    // Relationship types
    'platonic': t('profileCard.preferences.relationship.platonic'),
    'romantic': t('profileCard.preferences.relationship.romantic'),
    'open': t('profileCard.preferences.relationship.open'),
  }), [t]);

  // i18n-aware formatLabel
  const formatLabel = useCallback((value: any): string => {
    try {
      if (!value) return '';
      if (Array.isArray(value)) return value.filter(Boolean).map(formatLabel).join(', ');
      if (typeof value !== 'string') return String(value);
      const labels = getPreferenceLabels();
      if (labels[value]) return labels[value];
      return value.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    } catch {
      return typeof value === 'string' ? value : '';
    }
  }, [getPreferenceLabels]);

  // i18n-aware formatArrayWithLabels
  const formatArrayWithLabelsI18n = useCallback((value?: string | string[]): string => {
    if (!value) return '';
    let items: string[] = [];
    if (Array.isArray(value)) {
      items = value;
    } else if (typeof value === 'string') {
      if (value.startsWith('{') && value.endsWith('}')) {
        items = value.slice(1, -1).split(',');
      } else if (value.startsWith('[') && value.endsWith(']')) {
        try {
          const parsed = JSON.parse(value);
          if (Array.isArray(parsed)) items = parsed;
          else items = [value];
        } catch {
          items = [value];
        }
      } else {
        items = [value];
      }
    }
    return items.filter(item => item && typeof item === 'string').map(formatLabel).join(', ');
  }, [formatLabel]);

  // Fall back to profile's embedded breakdown if prop not provided
  const compatibilityBreakdown = compatibilityBreakdownProp || profile.compatibilityBreakdown;
  const { viewerUserId, isReady: watermarkReady } = useWatermark();

  const shouldBlur = (profile.photo_blur_enabled || false) && !isAdmin;

  // iOS: native blurRadius (safe). Android: SafeBlurImage handles it.
  const { blurRadius, onImageLoad, onImageError } = useSafeBlur({
    shouldBlur,
    blurIntensity: 50,
  });

  // Always show original photo URL — blur is applied via SafeBlurImage
  const getPhotoUri = (photo: { url: string; blur_data_uri?: string | null }) => {
    return photo.url;
  };

  // Blur radius for all platforms — SafeBlurImage handles platform differences
  const getBlurRadius = (_photo: { url: string; blur_data_uri?: string | null }) => {
    return blurRadius;
  };

  const [isVoicePlaying, setIsVoicePlaying] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();

  // Audio state
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(profile.voice_intro_duration ? profile.voice_intro_duration * 1000 : 0);

  // Signed voice intro URL for private bucket playback
  const [signedVoiceUrl, setSignedVoiceUrl] = useState<string | null>(null);

  useEffect(() => {
    if (profile.voice_intro_url) {
      getSignedUrl('voice-intros', profile.voice_intro_url).then((url) => {
        setSignedVoiceUrl(url);
      });
    } else {
      setSignedVoiceUrl(null);
    }
  }, [profile.voice_intro_url]);

  const photos = profile.photos || [];
  const heroPhoto = photos[0] ? getPhotoUri(photos[0]) : 'https://via.placeholder.com/400x600';

  // Pre-computed waveform bars - use simple static pattern to avoid main thread blocking
  // This prevents ANR on Android by avoiding trigonometric calculations during render
  const waveformBars = useMemo(() => {
    // Use a simple hash to pick from pre-computed patterns
    const hash = (profile.voice_intro_url || profile.display_name || 'default')
      .split('')
      .reduce((acc, char, i) => (acc + char.charCodeAt(0) * (i + 1)) % 5, 0);

    // 5 pre-computed waveform patterns (avoids runtime trig calculations)
    const patterns = [
      [0.4, 0.6, 0.8, 0.5, 0.3, 0.7, 0.9, 0.6, 0.4, 0.5, 0.7, 0.8, 0.6, 0.4, 0.3, 0.5, 0.7, 0.9, 0.7, 0.5, 0.4, 0.6, 0.8, 0.7, 0.5, 0.4, 0.6, 0.8, 0.9, 0.7, 0.5, 0.4, 0.3, 0.5, 0.7, 0.8, 0.6, 0.4, 0.5, 0.7, 0.8, 0.6, 0.4, 0.5, 0.6],
      [0.3, 0.5, 0.7, 0.9, 0.7, 0.5, 0.4, 0.6, 0.8, 0.7, 0.5, 0.3, 0.4, 0.6, 0.8, 0.9, 0.7, 0.5, 0.4, 0.3, 0.5, 0.7, 0.8, 0.6, 0.4, 0.5, 0.7, 0.9, 0.8, 0.6, 0.4, 0.3, 0.5, 0.7, 0.8, 0.6, 0.4, 0.5, 0.6, 0.8, 0.7, 0.5, 0.4, 0.6, 0.7],
      [0.5, 0.7, 0.6, 0.4, 0.5, 0.8, 0.9, 0.7, 0.5, 0.4, 0.6, 0.7, 0.5, 0.4, 0.6, 0.8, 0.7, 0.5, 0.3, 0.5, 0.7, 0.9, 0.8, 0.6, 0.4, 0.3, 0.5, 0.7, 0.8, 0.6, 0.4, 0.5, 0.7, 0.8, 0.6, 0.4, 0.5, 0.7, 0.9, 0.7, 0.5, 0.4, 0.6, 0.8, 0.7],
      [0.6, 0.4, 0.5, 0.7, 0.9, 0.8, 0.6, 0.4, 0.3, 0.5, 0.7, 0.8, 0.6, 0.5, 0.7, 0.9, 0.7, 0.5, 0.4, 0.6, 0.8, 0.7, 0.5, 0.4, 0.6, 0.8, 0.9, 0.7, 0.5, 0.4, 0.3, 0.5, 0.7, 0.9, 0.8, 0.6, 0.4, 0.5, 0.7, 0.8, 0.6, 0.4, 0.5, 0.7, 0.8],
      [0.7, 0.5, 0.4, 0.6, 0.8, 0.7, 0.5, 0.3, 0.5, 0.7, 0.9, 0.8, 0.6, 0.4, 0.5, 0.7, 0.8, 0.6, 0.4, 0.5, 0.7, 0.9, 0.7, 0.5, 0.4, 0.6, 0.8, 0.7, 0.5, 0.4, 0.6, 0.8, 0.9, 0.7, 0.5, 0.4, 0.3, 0.5, 0.7, 0.8, 0.6, 0.4, 0.5, 0.6, 0.7],
    ];

    return patterns[hash];
  }, [profile.voice_intro_url, profile.display_name]);

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Enable screenshot protection when card is visible
  useScreenCaptureProtection(visible);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const handleVoicePlayPause = async () => {
    if (!signedVoiceUrl) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      if (sound && isVoicePlaying) {
        await sound.pauseAsync();
        setIsVoicePlaying(false);
      } else if (sound && !isVoicePlaying) {
        await sound.playAsync();
        setIsVoicePlaying(true);
      } else {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: signedVoiceUrl },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              if (status.durationMillis) {
                setPlaybackDuration(status.durationMillis);
                setPlaybackProgress(status.positionMillis / status.durationMillis);
              }
              if (status.didJustFinish) {
                setIsVoicePlaying(false);
                setPlaybackProgress(0);
              }
            }
          }
        );
        setSound(newSound);
        setIsVoicePlaying(true);
      }
    } catch (error) {
      console.error('Error playing voice intro:', error);
      Alert.alert(t('common.error'), t('profileCard.voice.playError'));
    }
  };

  const headerOpacity = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const handleAction = useCallback((action: 'pass' | 'like' | 'superlike') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (action === 'pass' && onSwipeLeft) onSwipeLeft();
    else if (action === 'like' && onSwipeRight) onSwipeRight();
    else if (action === 'superlike' && onSuperLike) onSuperLike();
  }, [onSwipeLeft, onSwipeRight, onSuperLike]);

  if (!visible) return null;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Sticky Header */}
      <Animated.View style={[styles.stickyHeader, { opacity: headerOpacity }]}>
        <SafeBlurView intensity={90} tint="light" style={styles.headerBlur}>
          <SafeAreaView edges={['top']} style={styles.headerContent}>
            <SafeBlurImage
              source={{ uri: heroPhoto }}
              style={styles.headerAvatar}
              cachePolicy="memory-disk"
              blurRadius={photos[0] ? getBlurRadius(photos[0]) : blurRadius}
              onLoad={onImageLoad}
              onError={onImageError}
            />
            <View style={styles.headerInfo}>
              <Text style={styles.headerName} numberOfLines={1}>
                {profile.display_name}, {profile.age}
              </Text>
              {profile.compatibility_score && (
                <Text style={styles.headerMatch}>{t('profileCard.compatibility.matchLabel', { score: profile.compatibility_score })}</Text>
              )}
            </View>
          </SafeAreaView>
        </SafeBlurView>
      </Animated.View>

      {/* Close Button & Menu */}
      <View style={[styles.closeContainer, { top: insets.top + 8 }]}>
        <View style={styles.topButtonsRow}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <SafeBlurView intensity={80} tint="dark" style={styles.closeBlur}>
              <Ionicons name="close" size={26} color="white" />
            </SafeBlurView>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowActionSheet(true)} style={styles.menuButton}>
            <SafeBlurView intensity={80} tint="dark" style={styles.closeBlur}>
              <MaterialCommunityIcons name="dots-vertical" size={26} color="white" />
            </SafeBlurView>
          </TouchableOpacity>
        </View>
      </View>

      <Animated.ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={Platform.OS === 'android'}
      >
        {/* Hero Photo */}
        <View style={[styles.heroContainer, { overflow: 'hidden' }]}>
          <ZoomablePhotoWrapper style={styles.heroImage} enabled={!shouldBlur}>
            <SafeBlurImage
              source={{ uri: heroPhoto }}
              style={styles.heroImage}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
              blurRadius={photos[0] ? getBlurRadius(photos[0]) : blurRadius}
              onLoad={onImageLoad}
              onError={onImageError}
            />
            {/* Dynamic Watermark over hero image */}
            {watermarkReady && (
              <DynamicWatermark
                userId={profile.id}
                viewerUserId={viewerUserId}
                visible={true}
              />
            )}
          </ZoomablePhotoWrapper>
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.8)']}
            style={styles.heroGradient}
          />
          <View style={styles.heroInfo}>
            <View style={styles.heroNameRow}>
              <Text style={styles.heroName}>{profile.display_name}, {profile.age}</Text>
              {(profile.photo_verified || profile.is_verified) && (
                <MaterialCommunityIcons name="check-decagram" size={28} color="#A08AB7" />
              )}
            </View>
            {getLastActiveText(profile.last_active_at, profile.hide_last_active, t) && (
              <View style={styles.lastActiveRow}>
                <View style={[styles.activeIndicator, { backgroundColor: getLastActiveText(profile.last_active_at, profile.hide_last_active, t) === t('profileCard.activity.activeNow') ? '#22c55e' : '#A08AB7' }]} />
                <Text style={styles.lastActiveText}>{getLastActiveText(profile.last_active_at, profile.hide_last_active, t)}</Text>
              </View>
            )}
            {(profile.gender || profile.pronouns || profile.ethnicity) && (
              <View style={styles.heroIdentity}>
                <Text style={styles.heroIdentityText}>
                  {[
                    isFieldVisible(profile.field_visibility, 'gender') ? translateProfileArray(t, 'gender', profile.gender) : null,
                    profile.pronouns ? translateProfileValue(t, 'pronouns', profile.pronouns) : null,
                    isFieldVisible(profile.field_visibility, 'ethnicity') && profile.ethnicity && (Array.isArray(profile.ethnicity) ? !profile.ethnicity.includes('Prefer not to say') : profile.ethnicity !== 'Prefer not to say') ? translateProfileArray(t, 'ethnicity', profile.ethnicity) : null
                  ].filter(Boolean).join(' • ')}
                </Text>
              </View>
            )}
            {profile.location_city && (
              <View style={styles.heroLocation}>
                <Ionicons name="location" size={18} color="white" />
                <Text style={styles.heroLocationText}>
                  {profile.location_city}, {profile.location_state}
                  {profile.distance && ` • ${formatDistance(profile.distance, distanceUnit, profile.hide_distance)}`}
                </Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.content}>
          {/* Voice Intro - Simple Hinge-style Design */}
          {profile.voice_intro_url && (
            <View style={styles.voiceContainer}>
              {/* Prompt Text */}
              <Text style={styles.voicePromptText}>
                {profile.voice_intro_prompt || t('profileCard.voice.introFallback', { name: profile.display_name })}
              </Text>

              {/* Audio Player with Real Waveform */}
              <View style={styles.voicePlayerContainer}>
                {/* Play/Pause Button */}
                <TouchableOpacity
                  style={styles.voicePlayButton}
                  onPress={handleVoicePlayPause}
                  activeOpacity={0.7}
                >
                  <Ionicons
                    name={isVoicePlaying ? "pause" : "play"}
                    size={20}
                    color="white"
                  />
                </TouchableOpacity>

                {/* Waveform */}
                <View style={styles.voiceWaveformContainer}>
                  <View style={styles.voiceWaveform}>
                    {waveformBars.map((barHeight, index) => {
                      const progressBarCount = Math.floor(playbackProgress * waveformBars.length);
                      const isPlayed = index < progressBarCount;
                      return (
                        <View
                          key={index}
                          style={[
                            styles.voiceWaveBar,
                            {
                              height: 28 * barHeight,
                              backgroundColor: isPlayed ? '#4D3A6B' : '#A08AB7',
                            },
                          ]}
                        />
                      );
                    })}
                  </View>
                </View>

                {/* Duration */}
                <Text style={styles.voiceDuration}>
                  {isVoicePlaying || playbackProgress > 0
                    ? formatTime(playbackProgress * playbackDuration)
                    : formatTime(playbackDuration)}
                </Text>
              </View>
            </View>
          )}

          {/* Compatibility Score */}
          {profile.compatibility_score && (
            <View style={styles.compatibilityCard}>
              <View style={styles.compatibilityHeader}>
                <MaterialCommunityIcons name="heart-circle" size={36} color="#A08AB7" />
                <View style={styles.compatibilityTextBox}>
                  <Text style={styles.compatibilityScore}>{profile.compatibility_score}%</Text>
                  <Text style={styles.compatibilityLabel}>{t('profileCard.compatibility.label')}</Text>
                </View>
              </View>
              {compatibilityBreakdown && (
                <View style={styles.compatibilityBreakdown}>
                  <CompFactorBar label={t('profileCard.compatibility.marriageGoals')} score={Math.round(compatibilityBreakdown.goals || 0)} color="#A08AB7" />
                  <CompFactorBar label={t('profileCard.compatibility.location')} score={Math.round(compatibilityBreakdown.location || 0)} color="#A08AB7" />
                  <CompFactorBar label={t('profileCard.compatibility.lifestyle')} score={Math.round(compatibilityBreakdown.lifestyle || 0)} color="#A08AB7" />
                  <CompFactorBar label={t('profileCard.compatibility.personality')} score={Math.round(compatibilityBreakdown.personality || 0)} color="#A08AB7" />
                </View>
              )}
            </View>
          )}

          {/* Reviews Section */}
          <ProfileReviewDisplay
            profileId={profile.id}
            isMatched={false}
            compact={false}
          />

          {/* Photo 2 */}
          {photos[1] && (
            <View style={[styles.storyPhoto, { overflow: 'hidden' }]}>
              <ZoomablePhotoWrapper style={{ width: '100%', height: '100%' }} enabled={!shouldBlur}>
                <SafeBlurImage
                  source={{ uri: getPhotoUri(photos[1]) }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                  blurRadius={getBlurRadius(photos[1])}
                  onLoad={onImageLoad}
                  onError={onImageError}
                />
              </ZoomablePhotoWrapper>
            </View>
          )}

          {/* MARRIAGE GOALS - MOST IMPORTANT */}
          <View style={styles.criticalSection}>
            <View style={styles.criticalHeader}>
              <MaterialCommunityIcons name="ring" size={28} color="#A08AB7" />
              <Text style={styles.criticalTitle}>{t('profileCard.section.marriageGoals')}</Text>
            </View>

            {(preferences?.primary_reasons?.length || preferences?.primary_reason) && (
              <View style={styles.criticalItem}>
                <Text style={styles.criticalLabel}>{preferences?.primary_reasons && preferences.primary_reasons.length > 1 ? t('profileCard.goals.primaryReasons') : t('profileCard.goals.primaryReason')}</Text>
                <Text style={styles.criticalValue}>
                  {preferences?.primary_reasons && preferences.primary_reasons.length > 0
                    ? preferences.primary_reasons.map(r => formatLabel(r)).join(', ')
                    : formatLabel(preferences.primary_reason || '')}
                </Text>
              </View>
            )}

            {preferences?.relationship_type && (
              <View style={styles.criticalItem}>
                <Text style={styles.criticalLabel}>{t('profileCard.goals.relationshipDynamic')}</Text>
                <Text style={styles.criticalValue}>
                  {formatLabel(preferences.relationship_type)}
                </Text>
              </View>
            )}

            {preferences?.wants_children !== undefined && preferences?.wants_children !== null && (
              <View style={styles.criticalItem}>
                <Text style={styles.criticalLabel}>{t('profileCard.goals.children')}</Text>
                <Text style={styles.criticalValue}>
                  {preferences.wants_children === true ? `${t('common.yes')}${preferences.children_arrangement ? ` - ${formatArrayWithLabelsI18n(preferences.children_arrangement)}` : ''}` :
                   preferences.wants_children === false ? t('profileCard.goals.noChildren') :
                   t('profileCard.goals.maybeChildren')}
                </Text>
              </View>
            )}

            {preferences?.public_relationship !== undefined && (
              <View style={styles.criticalItem}>
                <Text style={styles.criticalLabel}>{t('profileCard.goals.publicCouple')}</Text>
                <Text style={styles.criticalValue}>
                  {preferences.public_relationship ? t('profileCard.goals.publicYes') : t('profileCard.goals.publicNo')}
                </Text>
              </View>
            )}

            {preferences?.family_involvement && (
              <View style={styles.criticalItem}>
                <Text style={styles.criticalLabel}>{t('profileCard.goals.familyInvolvement')}</Text>
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
                <View style={[styles.promptPhoto, { overflow: 'hidden' }]}>
                  <ZoomablePhotoWrapper style={{ width: '100%', height: '100%' }} enabled={!shouldBlur}>
                    <SafeBlurImage
                      source={{ uri: getPhotoUri(photos[2]) }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={200}
                      blurRadius={getBlurRadius(photos[2])}
                      onLoad={onImageLoad}
                      onError={onImageError}
                    />
                  </ZoomablePhotoWrapper>
                </View>
              )}
            </View>
          )}

          {/* Must-Haves */}
          {preferences?.must_haves && preferences.must_haves.length > 0 && (
            <View style={[styles.section, { backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#86EFAC' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 24, marginRight: 8 }}>✅</Text>
                <Text style={[styles.sectionTitle, { color: '#166534', marginBottom: 0 }]}>{t('profileCard.section.mustHaves')}</Text>
              </View>
              <Text style={{ fontSize: 13, color: '#16A34A', marginBottom: 12, fontStyle: 'italic' }}>
                {t('profileCard.section.mustHavesSubtitle')}
              </Text>
              {preferences.must_haves.map((item, index) => (
                <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                  <Text style={{ fontSize: 15, color: '#15803D', marginRight: 8 }}>•</Text>
                  <Text style={{ fontSize: 14, color: '#15803D', flex: 1, lineHeight: 20 }}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Dealbreakers */}
          {preferences?.dealbreakers && preferences.dealbreakers.length > 0 && (
            <View style={[styles.section, { backgroundColor: '#FEF2F2', borderRadius: 16, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#FCA5A5' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 24, marginRight: 8 }}>🚫</Text>
                <Text style={[styles.sectionTitle, { color: '#991B1B', marginBottom: 0 }]}>{t('profileCard.section.dealbreakers')}</Text>
              </View>
              <Text style={{ fontSize: 13, color: '#DC2626', marginBottom: 12, fontStyle: 'italic' }}>
                {t('profileCard.section.dealbreakersSubtitle')}
              </Text>
              {preferences.dealbreakers.map((item, index) => (
                <View key={index} style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 }}>
                  <Text style={{ fontSize: 15, color: '#B91C1C', marginRight: 8 }}>•</Text>
                  <Text style={{ fontSize: 14, color: '#B91C1C', flex: 1, lineHeight: 20 }}>{item}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Photo 4 */}
          {photos[3] && (
            <View style={[styles.storyPhoto, { overflow: 'hidden' }]}>
              <ZoomablePhotoWrapper style={{ width: '100%', height: '100%' }} enabled={!shouldBlur}>
                <SafeBlurImage
                  source={{ uri: getPhotoUri(photos[3]) }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                  blurRadius={getBlurRadius(photos[3])}
                  onLoad={onImageLoad}
                  onError={onImageError}
                />
              </ZoomablePhotoWrapper>
            </View>
          )}

          {/* LIFESTYLE COMPATIBILITY */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('profileCard.section.lifestyleValues')}</Text>
            <View style={styles.lifestyleGrid}>
              {profile.gender && isFieldVisible(profile.field_visibility, 'gender') && (
                <LifestyleItem icon="gender-male-female" label={t('profileCard.vitals.gender')} value={translateProfileArray(t, 'gender', profile.gender)} />
              )}
              {profile.pronouns && (
                <LifestyleItem icon="account" label={t('profileCard.vitals.pronouns')} value={translateProfileValue(t, 'pronouns', profile.pronouns)} />
              )}
              {profile.sexual_orientation && isFieldVisible(profile.field_visibility, 'sexual_orientation') && (
                <LifestyleItem icon="heart-multiple" label={t('profileCard.vitals.orientation')} value={translateProfileArray(t, 'sexual_orientation', profile.sexual_orientation)} />
              )}
              {profile.ethnicity && isFieldVisible(profile.field_visibility, 'ethnicity') && (Array.isArray(profile.ethnicity) ? !profile.ethnicity.includes('Prefer not to say') : profile.ethnicity !== 'Prefer not to say') && (
                <LifestyleItem icon="earth" label={t('profileCard.vitals.ethnicity')} value={translateProfileArray(t, 'ethnicity', profile.ethnicity)} />
              )}
              {profile.occupation && (
                <LifestyleItem icon="briefcase" label={t('profileCard.vitals.occupation')} value={profile.occupation} />
              )}
              {profile.education && (
                <LifestyleItem icon="school" label={t('profileCard.vitals.education')} value={profile.education} />
              )}
              {profile.hometown && (
                <LifestyleItem icon="home" label={t('profileCard.vitals.hometown')} value={profile.hometown} />
              )}
              {profile.height_inches && (
                <LifestyleItem
                  icon="human-male-height"
                  label={t('profileCard.vitals.height')}
                  value={formatHeight(profile.height_inches, heightUnit)}
                />
              )}
              {profile.zodiac_sign && (
                <LifestyleItem icon="zodiac-gemini" label={t('profileCard.vitals.zodiac')} value={translateProfileValue(t, 'zodiac_sign', profile.zodiac_sign)} />
              )}
              {profile.personality_type && (
                <LifestyleItem icon="brain" label={t('profileCard.vitals.personality')} value={profile.personality_type} />
              )}
              {profile.love_language && (
                <LifestyleItem icon="heart" label={t('profileCard.vitals.loveLanguage')} value={translateProfileArray(t, 'love_language', profile.love_language)} />
              )}
              {profile.languages_spoken && profile.languages_spoken.length > 0 && (
                <LifestyleItem icon="translate" label={t('profileCard.vitals.languages')} value={translateProfileArray(t, 'languages_spoken', profile.languages_spoken)} />
              )}
              {profile.religion && isFieldVisible(profile.field_visibility, 'religion') && (
                <LifestyleItem icon="hands-pray" label={t('profileCard.vitals.religion')} value={translateProfileValue(t, 'religion', profile.religion)} />
              )}
              {profile.political_views && isFieldVisible(profile.field_visibility, 'political_views') && (
                <LifestyleItem icon="vote" label={t('profileCard.vitals.politics')} value={translateProfileValue(t, 'political_views', profile.political_views)} />
              )}
              {preferences?.lifestyle_preferences?.drinking && isFieldVisible(profile.field_visibility, 'drinking') && (
                <LifestyleItem icon="glass-wine" label={t('profileCard.vitals.drinking')} value={formatLabel(preferences.lifestyle_preferences.drinking)} />
              )}
              {preferences?.lifestyle_preferences?.smoking && isFieldVisible(profile.field_visibility, 'smoking') && (
                <LifestyleItem icon="smoking" label={t('profileCard.vitals.smoking')} value={formatLabel(preferences.lifestyle_preferences.smoking)} />
              )}
              {preferences?.lifestyle_preferences?.pets && (
                <LifestyleItem icon="paw" label={t('profileCard.vitals.pets')} value={formatLabel(preferences.lifestyle_preferences.pets)} />
              )}
              {preferences?.financial_arrangement && (
                <LifestyleItem icon="cash-multiple" label={t('profileCard.vitals.finances')} value={formatArrayWithLabelsI18n(preferences.financial_arrangement)} />
              )}
              {preferences?.housing_preference && (
                <LifestyleItem icon="home-city" label={t('profileCard.vitals.living')} value={formatArrayWithLabelsI18n(preferences.housing_preference)} />
              )}
            </View>
          </View>

          {/* Hobbies & Interests */}
          {profile.hobbies && profile.hobbies.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('profileCard.section.hobbiesInterests')}</Text>
              <View style={styles.hobbiesContainer}>
                {profile.hobbies.map((hobby, index) => (
                  <View key={index} style={styles.hobbyTag}>
                    <MaterialCommunityIcons name={getHobbyIcon(hobby) as any} size={16} color="#A08AB7" />
                    <Text style={styles.hobbyText}>{hobby}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Favorites - Movies, Music, Books, TV Shows */}
          {profile.interests && (
            (profile.interests.movies?.length ?? 0) > 0 ||
            (profile.interests.music?.length ?? 0) > 0 ||
            (profile.interests.books?.length ?? 0) > 0 ||
            (profile.interests.tv_shows?.length ?? 0) > 0
          ) && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>{t('profileCard.section.favorites')}</Text>

              {profile.interests.movies && profile.interests.movies.length > 0 && (
                <View style={styles.favoriteCategory}>
                  <View style={styles.favoriteCategoryHeader}>
                    <MaterialCommunityIcons name="movie-open" size={22} color="#CDC2E5" />
                    <Text style={styles.favoriteCategoryTitle}>{t('profileCard.favorites.movies')}</Text>
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
                    <MaterialCommunityIcons name="music" size={22} color="#A08AB7" />
                    <Text style={styles.favoriteCategoryTitle}>{t('profileCard.favorites.musicArtists')}</Text>
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
                    <Text style={styles.favoriteCategoryTitle}>{t('profileCard.favorites.books')}</Text>
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
                    <Text style={styles.favoriteCategoryTitle}>{t('profileCard.favorites.tvShows')}</Text>
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
                <View style={[styles.promptPhoto, { overflow: 'hidden' }]}>
                  <ZoomablePhotoWrapper style={{ width: '100%', height: '100%' }} enabled={!shouldBlur}>
                    <SafeBlurImage
                      source={{ uri: getPhotoUri(photos[4 + index]) }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={200}
                      blurRadius={getBlurRadius(photos[4 + index])}
                      onLoad={onImageLoad}
                      onError={onImageError}
                    />
                  </ZoomablePhotoWrapper>
                </View>
              )}
            </View>
          ))}

          {/* LOCATION PREFERENCES */}
          {(preferences?.max_distance_miles || preferences?.willing_to_relocate || preferences?.preferred_cities) && (
            <View style={styles.criticalSection}>
              <View style={styles.criticalHeader}>
                <MaterialCommunityIcons name="map-marker-radius" size={28} color="#F59E0B" />
                <Text style={styles.criticalTitle}>{t('profileCard.section.locationRelocation')}</Text>
              </View>

              {preferences?.max_distance_miles && (
                <View style={styles.criticalItem}>
                  <Text style={styles.criticalLabel}>{t('profileCard.location.maxDistance')}</Text>
                  <Text style={styles.criticalValue}>{t('profileCard.location.upToMiles', { miles: preferences.max_distance_miles })}</Text>
                </View>
              )}

              {preferences?.willing_to_relocate !== undefined && (
                <View style={styles.criticalItem}>
                  <Text style={styles.criticalLabel}>{t('profileCard.location.willingToRelocate')}</Text>
                  <Text style={styles.criticalValue}>
                    {preferences.willing_to_relocate ? t('profileCard.location.openToMoving') : t('profileCard.location.stayLocal')}
                  </Text>
                </View>
              )}

              {preferences?.preferred_cities && preferences.preferred_cities.length > 0 && (
                <View style={styles.criticalItem}>
                  <Text style={styles.criticalLabel}>{t('profileCard.location.preferredCities')}</Text>
                  <Text style={styles.criticalValue}>{preferences.preferred_cities.join(', ')}</Text>
                </View>
              )}
            </View>
          )}

          {/* Remaining photos */}
          {photos.slice(5).map((photo, index) => (
            <View key={index} style={[styles.storyPhoto, { overflow: 'hidden' }]}>
              <ZoomablePhotoWrapper style={{ width: '100%', height: '100%' }} enabled={!shouldBlur}>
                <SafeBlurImage
                  source={{ uri: getPhotoUri(photo) }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={200}
                  blurRadius={getBlurRadius(photo)}
                  onLoad={onImageLoad}
                  onError={onImageError}
                />
              </ZoomablePhotoWrapper>
            </View>
          ))}

          <View style={{ height: 120 }} />
        </View>
      </Animated.ScrollView>

      {/* Action Buttons */}
      {!isMatched ? (
        // Swipe actions for discovery
        <SafeAreaView edges={['bottom']} style={styles.actionContainer}>
          <SafeBlurView intensity={95} tint="light" style={styles.actionBlur}>
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
          </SafeBlurView>
        </SafeAreaView>
      ) : onSendMessage ? (
        // Message button for matched profiles
        <SafeAreaView edges={['bottom']} style={styles.actionContainer}>
          <SafeBlurView intensity={95} tint="light" style={styles.actionBlur}>
            <View style={styles.matchedActionContainer}>
              <TouchableOpacity onPress={onSendMessage} style={styles.messageButton}>
                <View style={styles.messageButtonInner}>
                  <Ionicons name="chatbubble" size={22} color="white" />
                  <Text style={styles.messageButtonText}>{t('profileCard.actions.sendMessage')}</Text>
                </View>
              </TouchableOpacity>
            </View>
          </SafeBlurView>
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
                  <Text style={styles.actionText}>{t('profileCard.actions.report')}</Text>
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
                  <Text style={[styles.actionText, styles.actionTextDanger]}>{t('profileCard.actions.block')}</Text>
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
    <MaterialCommunityIcons name={icon as any} size={22} color="#A08AB7" />
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
    color: '#A08AB7',
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
  lastActiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  activeIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lastActiveText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '500',
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
  voiceContainer: {
    marginBottom: 20,
  },
  voicePromptText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 10,
  },
  voicePlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 8,
    paddingRight: 16,
  },
  voicePlayButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#A08AB7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceWaveformContainer: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 28,
    flex: 1,
  },
  fallbackWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    gap: 2,
  },
  voiceWaveBar: {
    width: 2.5,
    borderRadius: 2,
  },
  voiceDuration: {
    fontSize: 13,
    fontWeight: '500',
    color: '#71717A',
    minWidth: 36,
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
    color: '#A08AB7',
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
    backgroundColor: '#CDC2E5',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
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
    fontSize: 14,
    color: '#000000',
    fontWeight: '700',
    marginTop: 40,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  promptAnswer: {
    fontSize: 22,
    color: '#000000',
    lineHeight: 32,
    fontWeight: '400',
    marginBottom: 40,
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
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  messageButton: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  messageButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 18,
    paddingHorizontal: 32,
    backgroundColor: '#1A1A1E',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F3E8FF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },
  hobbyText: {
    fontSize: 15,
    color: '#A08AB7',
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
