import React, { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Animated,
  Platform,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { formatDistance, DistanceUnit } from '@/lib/distance-utils';
import { formatHeight, HeightUnit } from '@/lib/height-utils';
import { DynamicWatermark } from '@/components/security/DynamicWatermark';
import { useWatermark } from '@/hooks/useWatermark';
import ProfileReviewDisplay from '@/components/reviews/ProfileReviewDisplay';
import { useSafeBlur } from '@/hooks/useSafeBlur';
import { useScreenCaptureProtection } from '@/hooks/useScreenCaptureProtection';

const { width, height } = Dimensions.get('window');

interface Profile {
  id: string;
  display_name: string;
  age: number;
  gender?: string | string[];
  pronouns?: string;
  ethnicity?: string | string[];
  sexual_orientation?: string | string[];
  location_city?: string;
  location_state?: string;
  location_country?: string;
  hometown?: string;
  hide_distance?: boolean;
  bio?: string;
  occupation?: string;
  education?: string;
  photos?: Array<{ url: string; is_primary: boolean }>;
  compatibility_score?: number;
  is_verified?: boolean;
  photo_verified?: boolean;
  distance?: number;
  height_inches?: number;
  zodiac_sign?: string;
  personality_type?: string;
  love_language?: string | string[];
  languages_spoken?: string[];
  religion?: string;
  political_views?: string;
  prompt_answers?: Array<{ prompt: string; answer: string }>;
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
  photo_blur_enabled?: boolean;
  preferences?: any;
  last_active_at?: string;
  hide_last_active?: boolean;
}

interface Preferences {
  primary_reason?: string;
  primary_reasons?: string[];
  relationship_type?: string;
  wants_children?: boolean;
  children_arrangement?: string | string[];
  housing_preference?: string | string[];
  financial_arrangement?: string | string[];
  income_level?: string;
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
  total: number;
  location: number;
  goals: number;
  lifestyle: number;
  personality: number;
  demographics: number;
  orientation: number;
}

export interface DiscoveryProfileViewRef {
  scrollToTop: () => void;
}

interface DiscoveryProfileViewProps {
  profile: Profile;
  preferences?: Preferences;
  compatibilityBreakdown?: CompatibilityBreakdown;
  distanceUnit?: DistanceUnit;
  heightUnit?: HeightUnit;
  onBlock?: () => void;
  onReport?: () => void;
  onPass?: () => void;
  onLike?: (likedContent?: string) => void; // Optional: what content was liked (photo, prompt)
  onSuperLike?: () => void;
  onRewind?: () => void;
  canRewind?: boolean;
  isAdmin?: boolean;
  superLikesRemaining?: number;
  likesRemaining?: number; // Daily likes remaining for free users (X/5)
  dailyLikeLimit?: number; // Daily like limit (default 5 for free users)
  isPremium?: boolean; // Whether user has premium (unlimited likes)
  hideActions?: boolean; // Hide all action buttons (for preview mode)
  hideCompatibilityScore?: boolean; // Hide compatibility score section (for match profile view)
  renderAdditionalContent?: () => React.ReactNode; // Custom content to render after profile
  isPhotoRevealed?: boolean; // Whether profile owner has revealed photos to viewer (for matched users)
  isOwnProfile?: boolean; // Whether viewer is viewing their own profile (never blur own photos)
}

// Helper functions
const formatArrayOrString = (value?: string | string[]): string => {
  if (!value) return '';
  if (Array.isArray(value)) return value.join(', ');
  return value;
};

const PREFERENCE_LABELS: { [key: string]: string } = {
  'separate': 'Keep Finances Separate',
  'shared_expenses': 'Share Living Expenses',
  'joint': 'Fully Joint Finances',
  'prenup_required': 'Prenup Required',
  'flexible': 'Flexible/Open to Discussion',
  'separate_spaces': 'Separate Bedrooms/Spaces',
  'roommates': 'Roommate-Style Arrangement',
  'separate_homes': 'Separate Homes Nearby',
  'shared_bedroom': 'Shared Bedroom',
  'biological': 'Biological Children',
  'adoption': 'Adoption',
  'co_parenting': 'Co-Parenting Agreement',
  'surrogacy': 'Surrogacy',
  'ivf': 'IVF',
  'already_have': 'Already Have Children',
  'open_discussion': 'Open to Discussion',
  'financial': 'Financial Stability',
  'immigration': 'Immigration/Visa',
  'family_pressure': 'Family Pressure',
  'legal_benefits': 'Legal Benefits',
  'companionship': 'Companionship',
  'safety': 'Safety & Protection',
  'platonic': 'Platonic Only',
  'romantic': 'Romantic Partnership',
  'open': 'Open Arrangement',
};

const formatLabel = (value: string) => {
  if (!value) return '';
  if (PREFERENCE_LABELS[value]) return PREFERENCE_LABELS[value];
  return value.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

const formatArrayWithLabels = (value?: string | string[]): string => {
  if (!value) return '';
  let items: string[] = [];
  if (Array.isArray(value)) {
    items = value;
  } else if (typeof value === 'string') {
    if (value.startsWith('{') && value.endsWith('}')) {
      items = value.slice(1, -1).split(',');
    } else {
      items = [value];
    }
  }
  return items.map(formatLabel).join(', ');
};

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

// Like Button Component - appears on photos and prompts
const LikeButton = React.memo(({ onPress, size = 48 }: { onPress: () => void; size?: number }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.8, useNativeDriver: true, speed: 50 }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 12 }),
    ]).start();
    onPress();
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.9}>
      <Animated.View style={[styles.likeButton, { width: size, height: size, borderRadius: size / 2, transform: [{ scale: scaleAnim }] }]}>
        <MaterialCommunityIcons name="heart-outline" size={size * 0.6} color="#1F2937" style={{ fontWeight: 'bold' }} />
      </Animated.View>
    </TouchableOpacity>
  );
});

// Photo Card with Like Button
const PhotoCard = React.memo(({
  uri,
  onLike,
  blurRadius,
  onImageLoad,
  onImageError,
  watermarkReady,
  profileId,
  viewerUserId,
  showLikeButton = true,
  photoIndex = 0,
}: {
  uri: string;
  onLike: () => void;
  blurRadius: number;
  onImageLoad: () => void;
  onImageError: () => void;
  watermarkReady: boolean;
  profileId: string;
  viewerUserId: string | null;
  showLikeButton?: boolean;
  photoIndex?: number;
}) => (
  <View style={styles.photoCard}>
    <Image
      source={{ uri }}
      style={styles.photoImage}
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={200}
      blurRadius={blurRadius}
      onLoad={onImageLoad}
      onError={onImageError}
    />
    {watermarkReady && viewerUserId && (
      <DynamicWatermark
        key={`watermark-${profileId}-${photoIndex}`}
        userId={profileId}
        viewerUserId={viewerUserId}
        visible={true}
      />
    )}
    {showLikeButton && (
      <View style={styles.photoLikeContainer}>
        <LikeButton onPress={onLike} />
      </View>
    )}
  </View>
));

// Prompt Card with Like Button
const PromptCard = React.memo(({
  prompt,
  answer,
  onLike,
  showLikeButton = true,
}: {
  prompt: string;
  answer: string;
  onLike: () => void;
  showLikeButton?: boolean;
}) => (
  <View style={styles.promptCard}>
    <Text style={styles.promptQuestion}>{prompt}</Text>
    <Text style={styles.promptAnswer}>{answer}</Text>
    {showLikeButton && (
      <View style={styles.promptLikeContainer}>
        <LikeButton onPress={onLike} size={44} />
      </View>
    )}
  </View>
));

// Vitals Chip Component (for horizontal scroll row - Hinge style with dividers)
const VitalsChip = ({ icon, value, isLast }: { icon: string; value: string; isLast?: boolean }) => (
  <View style={styles.vitalsChipContainer}>
    <View style={styles.vitalsChip}>
      <MaterialCommunityIcons name={icon as any} size={20} color="#374151" />
      <Text style={styles.vitalsChipText}>{value}</Text>
    </View>
    {!isLast && <View style={styles.vitalsChipDivider} />}
  </View>
);

// Vitals Row Item Component (for vertical list - Hinge style with separators)
const VitalsRowItem = ({ icon, value, isLast }: { icon: string; value: string; isLast?: boolean }) => (
  <View style={styles.vitalsRowContainer}>
    <View style={styles.vitalsRowItem}>
      <View style={styles.vitalsRowIconContainer}>
        <MaterialCommunityIcons name={icon as any} size={24} color="#6B7280" />
      </View>
      <Text style={styles.vitalsRowText}>{value}</Text>
    </View>
    {!isLast && <View style={styles.vitalsRowSeparator} />}
  </View>
);

// Hinge-Style Vitals Section
const VitalsSection = React.memo(({
  profile,
  preferences,
  heightUnit,
  distanceUnit,
}: {
  profile: Profile;
  preferences?: Preferences;
  heightUnit: HeightUnit;
  distanceUnit: DistanceUnit;
}) => {
  // Build pills for horizontal scroll (using outline icons for clean Hinge look)
  const pills: { icon: string; value: string }[] = [];

  if (profile.age) pills.push({ icon: 'cake-variant-outline', value: String(profile.age) });
  if (profile.gender) pills.push({ icon: 'account-outline', value: formatArrayOrString(profile.gender) });
  if (profile.sexual_orientation) pills.push({ icon: 'magnet', value: formatArrayOrString(profile.sexual_orientation) });
  if (profile.height_inches) pills.push({ icon: 'human-male-height-variant', value: formatHeight(profile.height_inches, heightUnit) });
  // Current location
  if (profile.location_city) {
    const locationText = profile.location_state
      ? `${profile.location_city}, ${profile.location_state}`
      : profile.location_city;
    pills.push({ icon: 'map-marker-outline', value: locationText });
  }
  // Distance
  if (profile.distance) {
    pills.push({ icon: 'map-marker-distance', value: formatDistance(profile.distance, distanceUnit, profile.hide_distance) });
  }
  if (profile.zodiac_sign) pills.push({ icon: 'star-four-points-outline', value: profile.zodiac_sign });
  if (profile.personality_type) pills.push({ icon: 'head-outline', value: profile.personality_type });
  // Note: pronouns are already shown in the header, so not duplicated here
  // Lifestyle preferences
  if (preferences?.drinking) pills.push({ icon: 'glass-wine', value: formatLabel(preferences.drinking) });
  if (preferences?.smoking) pills.push({ icon: 'smoking-off', value: formatLabel(preferences.smoking) });
  if (preferences?.pets) pills.push({ icon: 'paw-outline', value: formatLabel(preferences.pets) });
  // Children
  if (preferences?.wants_children === true) {
    pills.push({ icon: 'baby-face-outline', value: 'Wants children' });
  } else if (preferences?.wants_children === false) {
    pills.push({ icon: 'cancel', value: "Doesn't want children" });
  }

  // Build rows for vertical list (using outline icons for clean Hinge look)
  const rows: { icon: string; value: string }[] = [];

  if (profile.occupation) rows.push({ icon: 'briefcase-outline', value: profile.occupation });
  if (profile.education) rows.push({ icon: 'school-outline', value: profile.education });
  if (profile.hometown) rows.push({ icon: 'home-outline', value: profile.hometown });
  if (profile.religion) rows.push({ icon: 'book-open-outline', value: profile.religion });
  if (profile.ethnicity && (Array.isArray(profile.ethnicity) ? !profile.ethnicity.includes('Prefer not to say') : profile.ethnicity !== 'Prefer not to say')) {
    rows.push({ icon: 'account-circle-outline', value: formatArrayOrString(profile.ethnicity) });
  }
  if (preferences?.relationship_type) rows.push({ icon: 'account-multiple-outline', value: formatLabel(preferences.relationship_type) });
  if (preferences?.primary_reason || preferences?.primary_reasons?.length) {
    const goalText = preferences?.primary_reasons?.length
      ? preferences.primary_reasons.map(formatLabel).join(', ')
      : formatLabel(preferences?.primary_reason || '');
    rows.push({ icon: 'magnify', value: goalText });
  }
  if (profile.languages_spoken && profile.languages_spoken.length > 0) {
    rows.push({ icon: 'translate', value: profile.languages_spoken.join(', ') });
  }
  if (profile.love_language) {
    rows.push({ icon: 'heart-outline', value: formatArrayOrString(profile.love_language) });
  }
  if (profile.political_views) {
    rows.push({ icon: 'vote-outline', value: profile.political_views });
  }

  if (pills.length === 0 && rows.length === 0) return null;

  return (
    <View style={styles.vitalsSection}>
      {/* Horizontal scrollable chips - Hinge style */}
      {pills.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.vitalsChipsScroll}
          contentContainerStyle={styles.vitalsChipsContainer}
        >
          {pills.map((pill, index) => (
            <VitalsChip
              key={index}
              icon={pill.icon}
              value={pill.value}
              isLast={index === pills.length - 1}
            />
          ))}
        </ScrollView>
      )}

      {/* Horizontal separator between chips and rows */}
      {pills.length > 0 && rows.length > 0 && (
        <View style={styles.vitalsSectionDivider} />
      )}

      {/* Vertical list with separators - Hinge style */}
      {rows.length > 0 && (
        <View style={styles.vitalsRowsContainer}>
          {rows.map((row, index) => (
            <VitalsRowItem
              key={index}
              icon={row.icon}
              value={row.value}
              isLast={index === rows.length - 1}
            />
          ))}
        </View>
      )}
    </View>
  );
});

const DiscoveryProfileView = forwardRef<DiscoveryProfileViewRef, DiscoveryProfileViewProps>(({
  profile,
  preferences,
  compatibilityBreakdown,
  distanceUnit = 'miles',
  heightUnit = 'imperial',
  onBlock,
  onReport,
  onPass,
  onLike,
  onSuperLike,
  onRewind,
  canRewind = false,
  isAdmin = false,
  superLikesRemaining = 0,
  likesRemaining = 0,
  dailyLikeLimit = 5,
  isPremium = false,
  hideActions = false,
  hideCompatibilityScore = false,
  renderAdditionalContent,
  isPhotoRevealed = false,
  isOwnProfile = false,
}, ref) => {
  const { viewerUserId, isReady: watermarkReady } = useWatermark();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  const { blurRadius, onImageLoad, onImageError } = useSafeBlur({
    shouldBlur: (profile.photo_blur_enabled || false) && !isAdmin && !isPhotoRevealed && !isOwnProfile,
    blurIntensity: 50,
  });

  // Enable screenshot protection when profile is visible
  useScreenCaptureProtection(true);

  const [isVoicePlaying, setIsVoicePlaying] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(profile.voice_intro_duration ? profile.voice_intro_duration * 1000 : 0);
  const [showLikeChoice, setShowLikeChoice] = useState(false);
  const [pendingLikeContent, setPendingLikeContent] = useState<string | null>(null);

  const photos = profile.photos || [];
  const lastActiveText = getLastActiveText(profile.last_active_at, profile.hide_last_active);

  useImperativeHandle(ref, () => ({
    scrollToTop: () => {
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    },
  }));

  useEffect(() => {
    return () => {
      if (sound) sound.unloadAsync();
    };
  }, [sound]);

  useEffect(() => {
    if (sound) {
      sound.unloadAsync();
      setSound(null);
    }
    setIsVoicePlaying(false);
    setPlaybackProgress(0);
  }, [profile.id]);

  const waveformBars = useMemo(() => {
    const seed = profile.voice_intro_url
      ? profile.voice_intro_url.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
      : profile.display_name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const bars = [];
    for (let i = 0; i < 45; i++) {
      const wave1 = Math.sin((seed * 0.01) + (i * 0.3)) * 0.3;
      const wave2 = Math.sin((seed * 0.02) + (i * 0.15)) * 0.2;
      const wave3 = Math.sin((seed * 0.005) + (i * 0.5)) * 0.15;
      const rand = Math.abs(Math.sin(seed + i * 7.3)) * 0.2;
      bars.push(Math.max(0.15, Math.min(1, 0.35 + wave1 + wave2 + wave3 + rand)));
    }
    return bars;
  }, [profile.voice_intro_url, profile.display_name]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
  };

  const handleVoicePlayPause = async () => {
    if (!profile.voice_intro_url) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      if (sound && isVoicePlaying) {
        await sound.pauseAsync();
        setIsVoicePlaying(false);
      } else if (sound) {
        await sound.playAsync();
        setIsVoicePlaying(true);
      } else {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: profile.voice_intro_url },
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
    }
  };

  const handleLikeContent = (contentType: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingLikeContent(contentType);
    setShowLikeChoice(true);
  };

  const handleLikeChoice = (isObsessed: boolean) => {
    setShowLikeChoice(false);
    if (isObsessed) {
      onSuperLike?.();
    } else {
      onLike?.(pendingLikeContent || undefined);
    }
    setPendingLikeContent(null);
  };

  const handlePass = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPass?.();
  };

  return (
    <View style={styles.container}>
      {/* Scrollable Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100, paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header - Scrolls with content */}
        <View style={styles.profileHeaderInline}>
          <View style={styles.headerTopRow}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>{profile.display_name}</Text>
              {profile.is_verified && (
                <MaterialCommunityIcons name="check-decagram" size={24} color="#A08AB7" style={{ marginLeft: 6 }} />
              )}
              {profile.photo_verified && (
                <MaterialCommunityIcons name="camera-account" size={20} color="#22c55e" style={{ marginLeft: 4 }} />
              )}
            </View>
            <View style={styles.headerButtons}>
              {onRewind && (
                <TouchableOpacity
                  onPress={canRewind ? onRewind : undefined}
                  style={[styles.headerButton, !canRewind && styles.headerButtonDisabled]}
                  disabled={!canRewind}
                >
                  <MaterialCommunityIcons
                    name="undo-variant"
                    size={20}
                    color={canRewind ? '#6B7280' : '#D1D5DB'}
                  />
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={() => setShowActionSheet(true)} style={styles.headerButton}>
                <MaterialCommunityIcons name="dots-horizontal" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.subInfoRow}>
            {profile.pronouns && profile.pronouns.trim() !== '' && (
              <Text style={styles.pronounsText}>{profile.pronouns}</Text>
            )}
            {profile.pronouns && profile.pronouns.trim() !== '' && lastActiveText && (
              <Text style={styles.divider}>|</Text>
            )}
            {lastActiveText && (
              <Text style={[styles.activeText, lastActiveText === 'Active now' && styles.activeNow]}>
                {lastActiveText}
              </Text>
            )}
          </View>
        </View>

        {/* First Photo */}
        {photos[0] && (
          <PhotoCard
            uri={photos[0].url}
            onLike={() => handleLikeContent('photo_1')}
            blurRadius={blurRadius}
            onImageLoad={onImageLoad}
            onImageError={onImageError}
            watermarkReady={watermarkReady}
            profileId={profile.id}
            viewerUserId={viewerUserId}
            showLikeButton={!hideActions}
            photoIndex={0}
          />
        )}

        {/* Voice Intro - Right after first photo */}
        {profile.voice_intro_url && (
          <View style={styles.voiceContainer}>
            <Text style={styles.voicePromptText}>
              {profile.voice_intro_prompt || `${profile.display_name}'s voice intro`}
            </Text>
            <View style={styles.voicePlayerContainer}>
              <TouchableOpacity style={styles.voicePlayButton} onPress={handleVoicePlayPause}>
                <Ionicons name={isVoicePlaying ? "pause" : "play"} size={20} color="white" />
              </TouchableOpacity>
              <View style={styles.voiceWaveformContainer}>
                <View style={styles.voiceWaveform}>
                  {waveformBars.map((h, i) => (
                    <View
                      key={i}
                      style={[styles.voiceWaveBar, {
                        height: 28 * h,
                        backgroundColor: i < Math.floor(playbackProgress * waveformBars.length) ? '#4D3A6B' : '#A08AB7',
                      }]}
                    />
                  ))}
                </View>
              </View>
              <Text style={styles.voiceDuration}>
                {isVoicePlaying || playbackProgress > 0 ? formatTime(playbackProgress * playbackDuration) : formatTime(playbackDuration)}
              </Text>
            </View>
          </View>
        )}

        {/* About Me Section */}
        {profile.bio && (
          <View style={styles.bioSection}>
            <Text style={styles.bioSectionTitle}>About {profile.display_name}</Text>
            <Text style={styles.bioText}>{profile.bio}</Text>
          </View>
        )}

        {/* First Prompt - Right after About Me */}
        {profile.prompt_answers?.[0] && (
          <PromptCard
            prompt={profile.prompt_answers[0].prompt}
            answer={profile.prompt_answers[0].answer}
            onLike={() => handleLikeContent('prompt_1')}
            showLikeButton={!hideActions}
          />
        )}

        {/* Hinge-Style Vitals Section */}
        <VitalsSection
          profile={profile}
          preferences={preferences}
          heightUnit={heightUnit}
          distanceUnit={distanceUnit}
        />

        {/* Second Photo */}
        {photos[1] && (
          <PhotoCard
            uri={photos[1].url}
            onLike={() => handleLikeContent('photo_2')}
            blurRadius={blurRadius}
            onImageLoad={onImageLoad}
            onImageError={onImageError}
            watermarkReady={watermarkReady}
            profileId={profile.id}
            viewerUserId={viewerUserId}
            showLikeButton={!hideActions}
            photoIndex={1}
          />
        )}

        {/* Second Prompt */}
        {profile.prompt_answers?.[1] && (
          <PromptCard
            prompt={profile.prompt_answers[1].prompt}
            answer={profile.prompt_answers[1].answer}
            onLike={() => handleLikeContent('prompt_2')}
            showLikeButton={!hideActions}
          />
        )}

        {/* Third Photo */}
        {photos[2] && (
          <PhotoCard
            uri={photos[2].url}
            onLike={() => handleLikeContent('photo_3')}
            blurRadius={blurRadius}
            onImageLoad={onImageLoad}
            onImageError={onImageError}
            watermarkReady={watermarkReady}
            profileId={profile.id}
            viewerUserId={viewerUserId}
            showLikeButton={!hideActions}
            photoIndex={2}
          />
        )}

        {/* Marriage Goals Section */}
        {(preferences?.primary_reasons?.length || preferences?.primary_reason || preferences?.relationship_type ||
          preferences?.wants_children === true || preferences?.wants_children === false || preferences?.children_arrangement ||
          preferences?.public_relationship !== undefined || preferences?.family_involvement) && (
          <View style={styles.goalsSection}>
            <View style={styles.goalsSectionHeader}>
              <MaterialCommunityIcons name="ring" size={24} color="#A08AB7" />
              <Text style={styles.goalsSectionTitle}>Marriage Goals</Text>
            </View>
            {(preferences?.primary_reasons?.length || preferences?.primary_reason) && (
              <View style={styles.goalsItem}>
                <Text style={styles.goalsLabel}>Looking for</Text>
                <Text style={styles.goalsValue}>
                  {preferences?.primary_reasons?.length
                    ? preferences.primary_reasons.map(formatLabel).join(', ')
                    : formatLabel(preferences?.primary_reason || '')}
                </Text>
              </View>
            )}
            {preferences?.relationship_type && (
              <View style={styles.goalsItem}>
                <Text style={styles.goalsLabel}>Relationship type</Text>
                <Text style={styles.goalsValue}>{formatLabel(preferences.relationship_type)}</Text>
              </View>
            )}
            {(preferences?.wants_children === true || preferences?.wants_children === false || preferences?.children_arrangement) && (
              <View style={styles.goalsItem}>
                <Text style={styles.goalsLabel}>Children</Text>
                <Text style={[
                  styles.goalsValue,
                  preferences?.wants_children === false && styles.goalsValueNo
                ]}>
                  {preferences?.wants_children === true
                    ? `Yes, wants children${preferences.children_arrangement ? ` - ${formatArrayWithLabels(preferences.children_arrangement)}` : ''}`
                    : preferences?.wants_children === false
                      ? 'Does not want children'
                      : preferences?.children_arrangement
                        ? formatArrayWithLabels(preferences.children_arrangement)
                        : 'Open to discussion'}
                </Text>
              </View>
            )}
            {preferences?.public_relationship !== undefined && (
              <View style={styles.goalsItem}>
                <Text style={styles.goalsLabel}>Public as a couple?</Text>
                <Text style={styles.goalsValue}>
                  {preferences.public_relationship ? "Yes, we'd appear as a couple publicly" : 'Prefer to keep it private'}
                </Text>
              </View>
            )}
            {preferences?.family_involvement && (
              <View style={styles.goalsItem}>
                <Text style={styles.goalsLabel}>Family involvement</Text>
                <Text style={styles.goalsValue}>{preferences.family_involvement}</Text>
              </View>
            )}
          </View>
        )}

        {/* Living & Finances Section */}
        {(preferences?.income_level || preferences?.financial_arrangement || preferences?.housing_preference) && (
          <View style={styles.financesSection}>
            <View style={styles.financesSectionHeader}>
              <MaterialCommunityIcons name="home-city" size={24} color="#A08AB7" />
              <Text style={styles.financesSectionTitle}>Living & Finances</Text>
            </View>
            {preferences?.income_level && (
              <View style={styles.financesItem}>
                <Text style={styles.financesLabel}>Income level</Text>
                <Text style={styles.financesValue}>{formatLabel(preferences.income_level)}</Text>
              </View>
            )}
            {preferences?.financial_arrangement && (
              <View style={styles.financesItem}>
                <Text style={styles.financesLabel}>Financial arrangement</Text>
                <Text style={styles.financesValue}>{formatArrayWithLabels(preferences.financial_arrangement)}</Text>
              </View>
            )}
            {preferences?.housing_preference && (
              <View style={styles.financesItem}>
                <Text style={styles.financesLabel}>Living situation</Text>
                <Text style={styles.financesValue}>{formatArrayWithLabels(preferences.housing_preference)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Hobbies Section */}
        {profile.hobbies && profile.hobbies.length > 0 && (
          <View style={styles.hobbiesSection}>
            <View style={styles.hobbiesSectionHeader}>
              <MaterialCommunityIcons name="palette" size={24} color="#A08AB7" />
              <Text style={styles.hobbiesSectionTitle}>Hobbies & Interests</Text>
            </View>
            <View style={styles.hobbiesContainer}>
              {profile.hobbies.map((hobby, index) => (
                <View key={index} style={styles.hobbyTag}>
                  <Text style={styles.hobbyText}>{hobby}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Favorites Section */}
        {profile.interests && (
          (profile.interests.movies?.length ?? 0) > 0 ||
          (profile.interests.music?.length ?? 0) > 0 ||
          (profile.interests.books?.length ?? 0) > 0 ||
          (profile.interests.tv_shows?.length ?? 0) > 0
        ) && (
          <View style={styles.favoritesSection}>
            <View style={styles.favoritesSectionHeader}>
              <MaterialCommunityIcons name="star-circle" size={24} color="#A08AB7" />
              <Text style={styles.favoritesSectionTitle}>Favorites</Text>
            </View>

            {profile.interests.movies && profile.interests.movies.length > 0 && (
              <View style={styles.favoriteCategory}>
                <View style={styles.favoriteCategoryHeader}>
                  <MaterialCommunityIcons name="movie-open" size={20} color="#CDC2E5" />
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
                  <MaterialCommunityIcons name="music" size={20} color="#A08AB7" />
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
                  <MaterialCommunityIcons name="book-open-page-variant" size={20} color="#3B82F6" />
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
                  <MaterialCommunityIcons name="television" size={20} color="#10B981" />
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

        {/* Location Preferences Section */}
        {(preferences?.max_distance_miles || preferences?.willing_to_relocate !== undefined || preferences?.preferred_cities?.length) && (
          <View style={styles.locationSection}>
            <View style={styles.locationSectionHeader}>
              <MaterialCommunityIcons name="map-marker-radius" size={24} color="#F59E0B" />
              <Text style={styles.locationSectionTitle}>Location & Relocation</Text>
            </View>

            {preferences?.max_distance_miles && (
              <View style={styles.locationItem}>
                <Text style={styles.locationLabel}>Maximum distance</Text>
                <Text style={styles.locationValue}>Up to {preferences.max_distance_miles} miles</Text>
              </View>
            )}

            {preferences?.willing_to_relocate !== undefined && (
              <View style={styles.locationItem}>
                <Text style={styles.locationLabel}>Willing to relocate?</Text>
                <Text style={styles.locationValue}>
                  {preferences.willing_to_relocate ? 'Yes, open to moving' : 'Prefer to stay local'}
                </Text>
              </View>
            )}

            {preferences?.preferred_cities && preferences.preferred_cities.length > 0 && (
              <View style={styles.locationItem}>
                <Text style={styles.locationLabel}>Preferred cities</Text>
                <Text style={styles.locationValue}>{preferences.preferred_cities.join(', ')}</Text>
              </View>
            )}
          </View>
        )}

        {/* Must-Haves Section */}
        {preferences?.must_haves && preferences.must_haves.length > 0 && (
          <View style={styles.mustHavesSection}>
            <View style={styles.mustHavesSectionHeader}>
              <Text style={styles.mustHavesEmoji}>✅</Text>
              <Text style={styles.mustHavesSectionTitle}>Must-Haves</Text>
            </View>
            <Text style={styles.mustHavesSubtitle}>Important qualities they're looking for</Text>
            {preferences.must_haves.map((item, index) => (
              <View key={index} style={styles.mustHavesItem}>
                <Text style={styles.mustHavesBullet}>•</Text>
                <Text style={styles.mustHavesText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Dealbreakers Section */}
        {preferences?.dealbreakers && preferences.dealbreakers.length > 0 && (
          <View style={styles.dealbreakersSection}>
            <View style={styles.dealbreakersHeader}>
              <Text style={styles.dealbreakersEmoji}>🚫</Text>
              <Text style={styles.dealbreakersTitle}>Dealbreakers</Text>
            </View>
            <Text style={styles.dealbreakersSubtitle}>Important boundaries to be aware of</Text>
            {preferences.dealbreakers.map((item, index) => (
              <View key={index} style={styles.dealbreakersItem}>
                <Text style={styles.dealbreakersBullet}>•</Text>
                <Text style={styles.dealbreakersText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Third Prompt */}
        {profile.prompt_answers?.[2] && (
          <PromptCard
            prompt={profile.prompt_answers[2].prompt}
            answer={profile.prompt_answers[2].answer}
            onLike={() => handleLikeContent('prompt_3')}
            showLikeButton={!hideActions}
          />
        )}

        {/* Remaining Prompts (4th, 5th, etc.) */}
        {profile.prompt_answers?.slice(3).map((promptItem, index) => (
          <PromptCard
            key={`prompt_${index + 4}`}
            prompt={promptItem.prompt}
            answer={promptItem.answer}
            onLike={() => handleLikeContent(`prompt_${index + 4}`)}
            showLikeButton={!hideActions}
          />
        ))}

        {/* Remaining Photos */}
        {photos.slice(3).map((photo, index) => (
          <PhotoCard
            key={index}
            uri={photo.url}
            onLike={() => handleLikeContent(`photo_${index + 4}`)}
            blurRadius={blurRadius}
            onImageLoad={onImageLoad}
            onImageError={onImageError}
            watermarkReady={watermarkReady}
            profileId={profile.id}
            viewerUserId={viewerUserId}
            showLikeButton={!hideActions}
            photoIndex={index + 3}
          />
        ))}

        {/* Compatibility Score */}
        {!hideCompatibilityScore && profile.compatibility_score && (
          <View style={styles.compatSection}>
            <View style={styles.compatHeader}>
              <MaterialCommunityIcons name="heart-circle" size={32} color="#A08AB7" />
              <View>
                <Text style={styles.compatScore}>{profile.compatibility_score}%</Text>
                <Text style={styles.compatLabel}>Compatible</Text>
              </View>
            </View>
            {compatibilityBreakdown && (
              <View style={styles.compatBars}>
                <CompatBar label="Goals" score={compatibilityBreakdown.goals} />
                <CompatBar label="Location" score={compatibilityBreakdown.location} />
                <CompatBar label="Lifestyle" score={compatibilityBreakdown.lifestyle} />
              </View>
            )}
          </View>
        )}

        {/* Reviews */}
        <ProfileReviewDisplay profileId={profile.id} isMatched={false} compact={false} />

        {/* Additional Content (e.g., Why We Match section) */}
        {renderAdditionalContent?.()}
      </ScrollView>

      {/* Floating Pass Button - Bottom Left */}
      {!hideActions && (
        <View style={[styles.floatingPassContainer, { bottom: insets.bottom + 20 }]}>
          <TouchableOpacity onPress={handlePass} style={styles.floatingPassButton} activeOpacity={0.9}>
            <MaterialCommunityIcons name="close" size={34} color="#000000" />
          </TouchableOpacity>
        </View>
      )}

      {/* Action Sheet Modal */}
      <Modal
        visible={showActionSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionSheet(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowActionSheet(false)}>
          <Pressable style={styles.actionSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>{profile.display_name}</Text>
              <Pressable onPress={() => setShowActionSheet(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#9CA3AF" />
              </Pressable>
            </View>
            <View style={styles.actionsList}>
              {onReport && (
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => { setShowActionSheet(false); setTimeout(() => onReport(), 100); }}
                >
                  <MaterialCommunityIcons name="flag" size={24} color="#6B7280" />
                  <Text style={styles.actionText}>Report</Text>
                </TouchableOpacity>
              )}
              {onBlock && (
                <TouchableOpacity
                  style={[styles.actionItem, styles.actionItemDanger]}
                  onPress={() => { setShowActionSheet(false); setTimeout(() => onBlock(), 100); }}
                >
                  <MaterialCommunityIcons name="block-helper" size={24} color="#EF4444" />
                  <Text style={[styles.actionText, styles.actionTextDanger]}>Block</Text>
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Like/Obsessed Choice Modal */}
      <Modal
        visible={showLikeChoice}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLikeChoice(false)}
      >
        <Pressable style={styles.likeChoiceOverlay} onPress={() => setShowLikeChoice(false)}>
          <Pressable style={styles.likeChoiceSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.likeChoiceTitle}>How do you feel?</Text>
            <View style={styles.likeChoiceButtons}>
              <TouchableOpacity
                style={styles.likeChoiceButton}
                onPress={() => handleLikeChoice(false)}
                activeOpacity={0.8}
              >
                <View style={styles.likeChoiceIconContainer}>
                  <MaterialCommunityIcons name="heart" size={32} color="#A08AB7" />
                </View>
                <Text style={styles.likeChoiceLabel}>Like</Text>
                {!isPremium && (
                  <Text style={styles.likeChoiceCount}>{likesRemaining}/{dailyLikeLimit} today</Text>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.likeChoiceButton, superLikesRemaining === 0 && styles.likeChoiceButtonDisabled]}
                onPress={() => handleLikeChoice(true)}
                activeOpacity={0.8}
                disabled={superLikesRemaining === 0}
              >
                <View style={[styles.likeChoiceIconContainer, styles.obsessedIconContainer, superLikesRemaining === 0 && styles.obsessedIconDisabled]}>
                  <MaterialCommunityIcons name="star" size={32} color={superLikesRemaining > 0 ? "#F59E0B" : "#D1D5DB"} />
                </View>
                <Text style={[styles.likeChoiceLabel, superLikesRemaining === 0 && styles.likeChoiceLabelDisabled]}>Obsessed</Text>
                <Text style={styles.likeChoiceCount}>{superLikesRemaining} remaining</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
});

// Compatibility Bar Component
const CompatBar = ({ label, score }: { label: string; score: number }) => (
  <View style={styles.compatBarRow}>
    <Text style={styles.compatBarLabel}>{label}</Text>
    <View style={styles.compatBarBg}>
      <View style={[styles.compatBarFill, { width: `${Math.round(score)}%` }]} />
    </View>
    <Text style={styles.compatBarScore}>{Math.round(score)}%</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  // Profile header - scrolls with content, seamless with first photo
  profileHeaderInline: {
    backgroundColor: '#FFFFFF',
    paddingTop: 0,
    paddingBottom: 2,
    paddingHorizontal: 16,
    marginHorizontal: -16,
    marginBottom: -4,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  profileName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
  },
  subInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  pronounsText: {
    fontSize: 12,
    color: '#000000',
  },
  divider: {
    fontSize: 12,
    color: '#D1D5DB',
    marginHorizontal: 8,
  },
  activeText: {
    fontSize: 12,
    color: '#3E1444',
  },
  activeNow: {
    color: '#3E1444',
  },
  headerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  // Scroll content
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
    backgroundColor: '#FFFFFF',
  },
  // Photo Card styles
  photoCard: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  photoImage: {
    width: '100%',
    aspectRatio: 0.8,
  },
  photoLikeContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  // Like Button styles
  likeButton: {
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  // Prompt Card styles
  promptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  promptQuestion: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 24,
  },
  promptAnswer: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000000',
    lineHeight: 30,
    paddingRight: 50,
  },
  promptLikeContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  // Voice intro styles
  voiceContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  voicePromptText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
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
  },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 28,
  },
  voiceWaveBar: {
    width: 2.5,
    borderRadius: 2,
  },
  voiceDuration: {
    fontSize: 13,
    fontWeight: '500',
    color: '#000000',
  },
  voiceLikeContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  // Vitals section styles (Hinge-style - clean, minimal)
  vitalsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  // Chips (horizontal scroll row)
  vitalsChipsScroll: {
    marginBottom: 0,
  },
  vitalsChipsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  vitalsChipContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vitalsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  vitalsChipText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  vitalsChipDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 16,
  },
  // Section divider between chips and rows
  vitalsSectionDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 20,
    marginVertical: 4,
  },
  // Rows (vertical list)
  vitalsRowsContainer: {
    paddingHorizontal: 20,
  },
  vitalsRowContainer: {
    // Container for row + separator
  },
  vitalsRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
  },
  vitalsRowIconContainer: {
    width: 32,
    alignItems: 'flex-start',
  },
  vitalsRowText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    flex: 1,
    marginLeft: 12,
  },
  vitalsRowSeparator: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginLeft: 44, // Align with text, not icon
  },
  // Goals section styles
  goalsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  goalsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  goalsSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  goalsItem: {
    marginBottom: 12,
  },
  goalsLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  goalsValue: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  goalsValueNo: {
    color: '#DC2626',
    fontWeight: '600',
  },
  goalsLikeContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
  },
  // Living & Finances section styles
  financesSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  financesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  financesSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  financesItem: {
    marginBottom: 12,
  },
  financesLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  financesValue: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  // Bio section styles
  bioSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  bioSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  bioSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  bioText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    lineHeight: 24,
  },
  // Hobbies section styles
  hobbiesSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  hobbiesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  hobbiesSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  hobbiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  hobbyTag: {
    backgroundColor: '#F3F0F8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  hobbyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  // Favorites section styles
  favoritesSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  favoritesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  favoritesSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  favoriteCategory: {
    marginBottom: 16,
  },
  favoriteCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  favoriteCategoryTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
  },
  favoritesList: {
    paddingLeft: 28,
  },
  favoriteItem: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    lineHeight: 24,
  },
  // Location section styles
  locationSection: {
    backgroundColor: '#FFFBEB',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FEF3C7',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  locationSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  locationSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  locationItem: {
    marginBottom: 12,
  },
  locationLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  locationValue: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '500',
  },
  // Must-Haves section styles
  mustHavesSection: {
    backgroundColor: '#F0FDF4',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#86EFAC',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  mustHavesSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  mustHavesEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  mustHavesSectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  mustHavesSubtitle: {
    fontSize: 13,
    color: '#000000',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  mustHavesItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  mustHavesBullet: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginRight: 8,
  },
  mustHavesText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    flex: 1,
    lineHeight: 24,
  },
  // Dealbreakers section styles
  dealbreakersSection: {
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  dealbreakersHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dealbreakersEmoji: {
    fontSize: 24,
    marginRight: 8,
  },
  dealbreakersTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
  },
  dealbreakersSubtitle: {
    fontSize: 13,
    color: '#000000',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  dealbreakersItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  dealbreakersBullet: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    marginRight: 8,
  },
  dealbreakersText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#000000',
    flex: 1,
    lineHeight: 24,
  },
  // Compatibility section styles
  compatSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  compatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  compatScore: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#A08AB7',
  },
  compatLabel: {
    fontSize: 14,
    color: '#000000',
  },
  compatBars: {
    gap: 10,
  },
  compatBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  compatBarLabel: {
    width: 70,
    fontSize: 14,
    color: '#000000',
  },
  compatBarBg: {
    flex: 1,
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  compatBarFill: {
    height: '100%',
    backgroundColor: '#A08AB7',
    borderRadius: 4,
  },
  compatBarScore: {
    width: 40,
    fontSize: 14,
    fontWeight: '600',
    color: '#A08AB7',
    textAlign: 'right',
  },
  // Floating Pass Button styles
  floatingPassContainer: {
    position: 'absolute',
    left: 20,
  },
  floatingPassButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  // Modal styles
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
    color: '#000000',
  },
  actionsList: {
    paddingTop: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  actionItemDanger: {
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
    marginTop: 8,
  },
  actionText: {
    fontSize: 16,
    color: '#000000',
  },
  actionTextDanger: {
    color: '#EF4444',
  },
  // Like/Obsessed Choice Modal styles
  likeChoiceOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  likeChoiceSheet: {
    backgroundColor: 'white',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    minWidth: 240,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  likeChoiceTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 24,
  },
  likeChoiceButtons: {
    flexDirection: 'row',
    gap: 32,
  },
  likeChoiceButton: {
    alignItems: 'center',
    gap: 8,
  },
  likeChoiceIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#F3F0F8',
    justifyContent: 'center',
    alignItems: 'center',
  },
  obsessedIconContainer: {
    backgroundColor: '#FEF3C7',
  },
  likeChoiceLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  likeChoiceLabelDisabled: {
    color: '#9CA3AF',
  },
  likeChoiceCount: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
    marginTop: 2,
  },
  likeChoiceButtonDisabled: {
    opacity: 0.6,
  },
  obsessedIconDisabled: {
    backgroundColor: '#F3F4F6',
  },
});

export default DiscoveryProfileView;
