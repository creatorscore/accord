import React, { useState, useRef, useCallback, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Animated,
  Modal,
  Pressable,
  RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import { getHobbyIcon } from '@/lib/hobby-options';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal, BottomSheetView, BottomSheetTextInput, BottomSheetBackdrop, BottomSheetBackdropProps } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { formatDistance, DistanceUnit } from '@/lib/distance-utils';
import { formatHeight, HeightUnit } from '@/lib/height-utils';
import { DynamicWatermark } from '@/components/security/DynamicWatermark';
import { useWatermark } from '@/hooks/useWatermark';
import ProfileReviewDisplay from '@/components/reviews/ProfileReviewDisplay';
import { useSafeBlur } from '@/hooks/useSafeBlur';
import { usePhotoBlur } from '@/hooks/usePhotoBlur';
import { SafeBlurImage } from '@/components/shared/SafeBlurImage';
import { useScreenCaptureProtection } from '@/hooks/useScreenCaptureProtection';
import { getSignedUrl } from '@/lib/signed-urls';
import { isFieldVisible } from '@/lib/field-visibility';
import { translateProfileValue, translateProfileArray } from '@/lib/translate-profile-values';
import { ZoomablePhotoWrapper } from '@/components/shared/ZoomablePhotoWrapper';
import { useTranslation } from 'react-i18next';

const { width: _SCREEN_WIDTH, height: _SCREEN_HEIGHT } = Dimensions.get('window');

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
  hide_distance?: boolean;
  photos?: { url: string; is_primary: boolean; blur_data_uri?: string | null }[];
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
  bio?: string;
  hometown?: string;
  occupation?: string;
  education?: string;
  photo_blur_enabled?: boolean;
  field_visibility?: Record<string, boolean>;
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
  onLike?: (likedContent?: string, message?: string, likedContentData?: { type: string; prompt?: string; answer?: string; index?: number }) => void;
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
  renderHeader?: () => React.ReactNode; // Custom header content rendered inside ScrollView (scrolls with content)
  isPhotoRevealed?: boolean; // Whether profile owner has revealed photos to viewer (for matched users)
  isOwnProfile?: boolean; // Whether viewer is viewing their own profile (never blur own photos)
  onRefresh?: () => void; // Pull-to-refresh callback
  refreshing?: boolean; // Whether refresh is in progress
}

// Helper functions
const formatArrayOrString = (value?: string | string[]): string => {
  if (!value) return '';
  if (Array.isArray(value)) return value.join(', ');
  return value;
};

// PREFERENCE_LABELS is now generated inside the component via getPreferenceLabels() for i18n support.
// formatLabel is also defined inside the component to access the translated labels.

// Fallback formatLabel for use outside the component (used by formatArrayWithLabels and VitalsSection)
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
  // Filter out empty/null/undefined items before mapping to prevent errors
  return items.filter(item => item && typeof item === 'string').map(formatLabelFallback).join(', ');
};

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

// Like Button Component - appears on photos and prompts
const LikeButton = React.memo(function LikeButton({ onPress, size = 48 }: { onPress: () => void; size?: number }) {
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
const PhotoCard = React.memo(function PhotoCard({
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
  blurDataUri,
  shouldBlur = false,
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
  blurDataUri?: string | null;
  shouldBlur?: boolean;
}) {
  const photoBlur = usePhotoBlur({
    shouldBlur,
    photoUrl: uri,
    blurDataUri,
  });
  const imageUri = photoBlur.imageUri;
  const effectiveBlurRadius = photoBlur.blurRadius;

  return (
  <View style={styles.photoCard}>
    <ZoomablePhotoWrapper enabled={!shouldBlur}>
      <SafeBlurImage
        source={{ uri: imageUri }}
        style={styles.photoImage}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={200}
        blurRadius={effectiveBlurRadius}
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
    </ZoomablePhotoWrapper>
    {showLikeButton && (
      <View style={styles.photoLikeContainer}>
        <LikeButton onPress={onLike} />
      </View>
    )}
  </View>
  );
});

// Prompt Card with Like Button
const PromptCard = React.memo(function PromptCard({
  prompt,
  answer,
  onLike,
  showLikeButton = true,
}: {
  prompt: string;
  answer: string;
  onLike: () => void;
  showLikeButton?: boolean;
}) {
  return (
  <View style={styles.promptCard}>
    <Text style={styles.promptQuestion}>{prompt}</Text>
    <Text style={styles.promptAnswer}>{answer}</Text>
    {showLikeButton && (
      <View style={styles.promptLikeContainer}>
        <LikeButton onPress={onLike} size={44} />
      </View>
    )}
  </View>
  );
});

// Vitals Chip Component (for horizontal scroll row - Hinge style with dividers)
const VitalsChip = React.memo(function VitalsChip({ icon, value, isLast }: { icon: string; value: string; isLast?: boolean }) {
  return (
  <View style={styles.vitalsChipContainer}>
    <View style={styles.vitalsChip}>
      <MaterialCommunityIcons name={icon as any} size={20} color="#374151" />
      <Text style={styles.vitalsChipText}>{value}</Text>
    </View>
    {!isLast && <View style={styles.vitalsChipDivider} />}
  </View>
  );
});

// Vitals Row Item Component (for vertical list - Hinge style with separators)
const VitalsRowItem = React.memo(function VitalsRowItem({ icon, value, isLast }: { icon: string; value: string; isLast?: boolean }) {
  return (
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
});

// Hinge-Style Vitals Section
const VitalsSection = React.memo(function VitalsSection({
  profile,
  preferences,
  heightUnit,
  distanceUnit,
}: {
  profile: Profile;
  preferences?: Preferences;
  heightUnit: HeightUnit;
  distanceUnit: DistanceUnit;
}) {
  const { t } = useTranslation();
  const fv = profile.field_visibility;

  // i18n preference labels for VitalsSection
  const preferenceLabels: { [key: string]: string } = useMemo(() => ({
    'separate': t('profileCard.preferences.financial.separate'),
    'shared_expenses': t('profileCard.preferences.financial.sharedExpenses'),
    'joint': t('profileCard.preferences.financial.joint'),
    'prenup_required': t('profileCard.preferences.financial.prenupRequired'),
    'flexible': t('profileCard.preferences.financial.flexible'),
    'separate_spaces': t('profileCard.preferences.housing.separateSpaces'),
    'roommates': t('profileCard.preferences.housing.roommates'),
    'separate_homes': t('profileCard.preferences.housing.separateHomes'),
    'shared_bedroom': t('profileCard.preferences.housing.sharedBedroom'),
    'biological': t('profileCard.preferences.children.biological'),
    'adoption': t('profileCard.preferences.children.adoption'),
    'co_parenting': t('profileCard.preferences.children.coParenting'),
    'surrogacy': t('profileCard.preferences.children.surrogacy'),
    'ivf': t('profileCard.preferences.children.ivf'),
    'already_have': t('profileCard.preferences.children.alreadyHave'),
    'open_discussion': t('profileCard.preferences.children.openDiscussion'),
    'financial': t('profileCard.preferences.reasons.financial'),
    'immigration': t('profileCard.preferences.reasons.immigration'),
    'family_pressure': t('profileCard.preferences.reasons.familyPressure'),
    'legal_benefits': t('profileCard.preferences.reasons.legalBenefits'),
    'companionship': t('profileCard.preferences.reasons.companionship'),
    'safety': t('profileCard.preferences.reasons.safety'),
    'platonic': t('profileCard.preferences.relationship.platonic'),
    'romantic': t('profileCard.preferences.relationship.romantic'),
    'open': t('profileCard.preferences.relationship.open'),
  }), [t]);

  const formatLabelI18n = useCallback((value: any): string => {
    try {
      if (!value) return '';
      if (Array.isArray(value)) return value.filter(Boolean).map(formatLabelI18n).join(', ');
      if (typeof value !== 'string') return String(value);
      if (preferenceLabels[value]) return preferenceLabels[value];
      return value.split('_').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    } catch {
      return typeof value === 'string' ? value : '';
    }
  }, [preferenceLabels]);

  const formatArrayWithLabelsI18n = useCallback((value?: string | string[]): string => {
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
    return items.filter(item => item && typeof item === 'string').map(formatLabelI18n).join(', ');
  }, [formatLabelI18n]);

  // Build pills for horizontal scroll (using outline icons for clean Hinge look)
  const pills: { icon: string; value: string }[] = [];

  if (profile.age) pills.push({ icon: 'cake-variant-outline', value: String(profile.age) });
  if (profile.gender && isFieldVisible(fv, 'gender')) pills.push({ icon: 'account-outline', value: translateProfileArray(t, 'gender', profile.gender) });
  if (profile.sexual_orientation && isFieldVisible(fv, 'sexual_orientation')) pills.push({ icon: 'magnet', value: translateProfileArray(t, 'sexual_orientation', profile.sexual_orientation) });
  if (profile.height_inches) pills.push({ icon: 'human-male-height-variant', value: formatHeight(profile.height_inches, heightUnit) });
  if (profile.occupation) pills.push({ icon: 'briefcase-outline', value: profile.occupation });
  if (profile.education) pills.push({ icon: 'school-outline', value: profile.education });
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
  if (profile.zodiac_sign) pills.push({ icon: 'star-four-points-outline', value: translateProfileValue(t, 'zodiac_sign', profile.zodiac_sign) });
  if (profile.personality_type) pills.push({ icon: 'head-outline', value: profile.personality_type });
  // Note: pronouns are already shown in the header, so not duplicated here
  // Lifestyle preferences
  if (preferences?.lifestyle_preferences?.drinking && isFieldVisible(fv, 'drinking')) pills.push({ icon: 'glass-wine', value: formatLabelI18n(preferences.lifestyle_preferences.drinking) });
  if (preferences?.lifestyle_preferences?.smoking && isFieldVisible(fv, 'smoking')) pills.push({ icon: 'smoking-off', value: formatLabelI18n(preferences.lifestyle_preferences.smoking) });
  if (preferences?.lifestyle_preferences?.pets) pills.push({ icon: 'paw-outline', value: formatLabelI18n(preferences.lifestyle_preferences.pets) });
  // Children
  if (isFieldVisible(fv, 'wants_children')) {
    if (preferences?.wants_children === true) {
      const childrenText = preferences.children_arrangement
        ? t('profileCard.vitals.wantsChildrenWith', { arrangement: formatArrayWithLabelsI18n(preferences.children_arrangement) })
        : t('profileCard.vitals.wantsChildren');
      pills.push({ icon: 'baby-face-outline', value: childrenText });
    } else if (preferences?.wants_children === false) {
      pills.push({ icon: 'cancel', value: t('profileCard.vitals.doesntWantChildren') });
    }
  }

  // Build rows for vertical list (using outline icons for clean Hinge look)
  const rows: { icon: string; value: string }[] = [];

  if (profile.hometown) rows.push({ icon: 'home-outline', value: profile.hometown });
  if (profile.religion && isFieldVisible(fv, 'religion')) rows.push({ icon: 'book-open-outline', value: translateProfileValue(t, 'religion', profile.religion) });
  if (profile.ethnicity && isFieldVisible(fv, 'ethnicity') && (Array.isArray(profile.ethnicity) ? !profile.ethnicity.includes('Prefer not to say') : profile.ethnicity !== 'Prefer not to say')) {
    rows.push({ icon: 'account-circle-outline', value: translateProfileArray(t, 'ethnicity', profile.ethnicity) });
  }
  if (preferences?.relationship_type && isFieldVisible(fv, 'relationship_type')) rows.push({ icon: 'account-multiple-outline', value: formatLabelI18n(preferences.relationship_type) });
  if (preferences?.primary_reason || preferences?.primary_reasons?.length) {
    const goalText = preferences?.primary_reasons?.length
      ? preferences.primary_reasons.map(formatLabelI18n).join(', ')
      : formatLabelI18n(preferences?.primary_reason || '');
    rows.push({ icon: 'magnify', value: goalText });
  }
  if (profile.languages_spoken && profile.languages_spoken.length > 0) {
    rows.push({ icon: 'translate', value: translateProfileArray(t, 'languages_spoken', profile.languages_spoken) });
  }
  if (profile.love_language) {
    rows.push({ icon: 'heart-outline', value: translateProfileArray(t, 'love_language', profile.love_language) });
  }
  if (profile.political_views && isFieldVisible(fv, 'political_views')) {
    rows.push({ icon: 'vote-outline', value: translateProfileValue(t, 'political_views', profile.political_views) });
  }
  // Living & Finances (in vitals area alongside other profile details)
  if (preferences?.financial_arrangement) {
    rows.push({ icon: 'cash-multiple', value: formatArrayWithLabelsI18n(preferences.financial_arrangement) });
  }
  if (preferences?.housing_preference) {
    rows.push({ icon: 'home-city-outline', value: formatArrayWithLabelsI18n(preferences.housing_preference) });
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
  compatibilityBreakdown: compatibilityBreakdownProp,
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
  renderHeader,
  isPhotoRevealed = false,
  isOwnProfile = false,
  onRefresh,
  refreshing = false,
}, ref) => {
  const { t } = useTranslation();

  // Fall back to profile's embedded breakdown if prop not provided
  const compatibilityBreakdown = compatibilityBreakdownProp || (profile as any).compatibilityBreakdown;
  const { viewerUserId, isReady: watermarkReady } = useWatermark();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  const shouldBlurPhotos = (profile.photo_blur_enabled || false) && !isPhotoRevealed && !isOwnProfile && !isAdmin;

  const { blurRadius, onImageLoad, onImageError } = useSafeBlur({
    shouldBlur: shouldBlurPhotos,
    blurIntensity: 50,
  });

  // Enable screenshot protection when profile is visible
  useScreenCaptureProtection(true);

  const [showStickyHeader, setShowStickyHeader] = useState(false);
  const profileHeaderBottomY = useRef(0);

  const [isVoicePlaying, setIsVoicePlaying] = useState(false);
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(profile.voice_intro_duration ? profile.voice_intro_duration * 1000 : 0);
  const [signedVoiceUrl, setSignedVoiceUrl] = useState<string | null>(null);
  const [pendingLikeContent, setPendingLikeContent] = useState<string | null>(null);
  const [pendingLikeContentData, setPendingLikeContentData] = useState<{ type: string; prompt?: string; answer?: string; index?: number } | null>(null);
  const [likeMessage, setLikeMessage] = useState('');
  const likeSheetRef = useRef<BottomSheetModal>(null);

  const renderLikeSheetBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
    ),
    [],
  );

  const photos = useMemo(() => profile.photos || [], [profile.photos]);
  const promptAnswers = useMemo(() => profile.prompt_answers || [], [profile.prompt_answers]);
  const lastActiveText = getLastActiveText(profile.last_active_at, profile.hide_last_active, t);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  // Sign voice intro URL for private bucket playback
  useEffect(() => {
    if (profile.voice_intro_url) {
      getSignedUrl('voice-intros', profile.voice_intro_url).then((url) => {
        setSignedVoiceUrl(url);
      });
    } else {
      setSignedVoiceUrl(null);
    }
  }, [profile.voice_intro_url]);

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

  const formatTime = useCallback((ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    return `${Math.floor(totalSeconds / 60)}:${(totalSeconds % 60).toString().padStart(2, '0')}`;
  }, []);

  const handleVoicePlayPause = async () => {
    if (!signedVoiceUrl) return;
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
    }
  };

  const handleLikeContent = useCallback((contentType: string, contentData?: { type: string; prompt?: string; answer?: string; index?: number }) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingLikeContent(contentType);
    setPendingLikeContentData(contentData || null);
    setLikeMessage('');
    likeSheetRef.current?.present();
  }, []);

  // Stable onLike callbacks for PhotoCard/PromptCard so React.memo works
  const onLikePhoto0 = useCallback(() => handleLikeContent('photo_1', { type: 'photo', index: 0 }), [handleLikeContent]);
  const onLikePhoto1 = useCallback(() => handleLikeContent('photo_2', { type: 'photo', index: 1 }), [handleLikeContent]);
  const onLikePhoto2 = useCallback(() => handleLikeContent('photo_3', { type: 'photo', index: 2 }), [handleLikeContent]);

  const onLikePrompt0 = useCallback(() => {
    if (promptAnswers[0]) handleLikeContent('prompt_1', { type: 'prompt', prompt: promptAnswers[0].prompt, answer: promptAnswers[0].answer });
  }, [handleLikeContent, promptAnswers]);
  const onLikePrompt1 = useCallback(() => {
    if (promptAnswers[1]) handleLikeContent('prompt_2', { type: 'prompt', prompt: promptAnswers[1].prompt, answer: promptAnswers[1].answer });
  }, [handleLikeContent, promptAnswers]);
  const onLikePrompt2 = useCallback(() => {
    if (promptAnswers[2]) handleLikeContent('prompt_3', { type: 'prompt', prompt: promptAnswers[2].prompt, answer: promptAnswers[2].answer });
  }, [handleLikeContent, promptAnswers]);

  const handleLikeChoice = (isObsessed: boolean) => {
    likeSheetRef.current?.dismiss();
    const trimmedMessage = likeMessage.trim() || undefined;
    if (isObsessed) {
      onSuperLike?.();
    } else {
      onLike?.(pendingLikeContent || undefined, trimmedMessage, pendingLikeContentData || undefined);
    }
    setPendingLikeContent(null);
    setPendingLikeContentData(null);
    setLikeMessage('');
  };

  const handlePass = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPass?.();
  }, [onPass]);

  const handleProfileHeaderLayout = useCallback((event: any) => {
    const { y, height } = event.nativeEvent.layout;
    // y is relative to the ScrollView content — store the bottom edge
    profileHeaderBottomY.current = y + height;
  }, []);

  const handleScroll = useCallback((event: any) => {
    const scrollY = event.nativeEvent.contentOffset.y;
    // Show sticky header once the profile name has scrolled past the top safe area
    const threshold = profileHeaderBottomY.current > 0
      ? profileHeaderBottomY.current - insets.top
      : 120; // fallback
    setShowStickyHeader(scrollY > threshold);
  }, [insets.top]);

  return (
    <View style={styles.container}>
      {/* Sticky Header Bar - appears when profile name scrolls out of view */}
      {showStickyHeader && (
        <View style={[styles.stickyHeader, { paddingTop: insets.top + 8 }]}>
          <View style={styles.stickyHeaderContent}>
            <Text style={styles.stickyHeaderName} numberOfLines={1}>{profile.display_name}</Text>
            {(profile.photo_verified || profile.is_verified) && (
              <MaterialCommunityIcons name="check-decagram" size={18} color="#A08AB7" style={{ marginLeft: 6 }} />
            )}
          </View>
        </View>
      )}

      {/* Scrollable Content */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100, paddingTop: insets.top }]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews={true}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        refreshControl={onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#999" />
        ) : undefined}
      >
        {/* Discovery header (filters/search) - scrolls with content */}
        {renderHeader?.()}
        {/* Profile Header - Scrolls with content */}
        <View onLayout={handleProfileHeaderLayout} style={styles.profileHeaderInline}>
          <View style={styles.headerTopRow}>
            <View style={styles.nameRow}>
              <Text style={styles.profileName}>{profile.display_name}</Text>
              {(profile.photo_verified || profile.is_verified) && (
                <MaterialCommunityIcons name="check-decagram" size={24} color="#A08AB7" style={{ marginLeft: 6 }} />
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
              <Text style={styles.pronounsText}>{translateProfileValue(t, 'pronouns', profile.pronouns)}</Text>
            )}
            {profile.pronouns && profile.pronouns.trim() !== '' && lastActiveText && (
              <Text style={styles.divider}>|</Text>
            )}
            {lastActiveText && (
              <Text style={[styles.activeText, lastActiveText === t('profileCard.activity.activeNow') && styles.activeNow]}>
                {lastActiveText}
              </Text>
            )}
          </View>
        </View>

        {/* First Photo */}
        {photos[0] && (
          <PhotoCard
            uri={photos[0].url}
            onLike={onLikePhoto0}
            blurRadius={blurRadius}

            onImageLoad={onImageLoad}
            onImageError={onImageError}
            watermarkReady={watermarkReady}
            profileId={profile.id}
            viewerUserId={viewerUserId}
            showLikeButton={!hideActions}
            photoIndex={0}
            blurDataUri={(photos[0] as any).blur_data_uri}
            shouldBlur={shouldBlurPhotos}
          />
        )}

        {/* Voice Intro - Right after first photo */}
        {profile.voice_intro_url && (
          <View style={styles.voiceContainer}>
            <Text style={styles.voicePromptText}>
              {profile.voice_intro_prompt || t('profileCard.voice.introFallback', { name: profile.display_name })}
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

        {/* First Prompt */}
        {promptAnswers[0] && (
          <PromptCard
            prompt={promptAnswers[0].prompt}
            answer={promptAnswers[0].answer}
            onLike={onLikePrompt0}
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
            onLike={onLikePhoto1}
            blurRadius={blurRadius}

            onImageLoad={onImageLoad}
            onImageError={onImageError}
            watermarkReady={watermarkReady}
            profileId={profile.id}
            viewerUserId={viewerUserId}
            showLikeButton={!hideActions}
            photoIndex={1}
            blurDataUri={(photos[1] as any).blur_data_uri}
            shouldBlur={shouldBlurPhotos}
          />
        )}

        {/* Second Prompt */}
        {promptAnswers[1] && (
          <PromptCard
            prompt={promptAnswers[1].prompt}
            answer={promptAnswers[1].answer}
            onLike={onLikePrompt1}
            showLikeButton={!hideActions}
          />
        )}

        {/* Third Photo */}
        {photos[2] && (
          <PhotoCard
            uri={photos[2].url}
            onLike={onLikePhoto2}
            blurRadius={blurRadius}

            onImageLoad={onImageLoad}
            onImageError={onImageError}
            watermarkReady={watermarkReady}
            profileId={profile.id}
            viewerUserId={viewerUserId}
            showLikeButton={!hideActions}
            photoIndex={2}
            blurDataUri={(photos[2] as any).blur_data_uri}
            shouldBlur={shouldBlurPhotos}
          />
        )}

        {/* Hobbies Section */}
        {profile.hobbies && profile.hobbies.length > 0 && (
          <View style={styles.hobbiesSection}>
            <View style={styles.hobbiesSectionHeader}>
              <MaterialCommunityIcons name="palette" size={24} color="#A08AB7" />
              <Text style={styles.hobbiesSectionTitle}>{t('profileCard.section.hobbiesInterests')}</Text>
            </View>
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
              <Text style={styles.favoritesSectionTitle}>{t('profileCard.section.favorites')}</Text>
            </View>

            {profile.interests.movies && profile.interests.movies.length > 0 && (
              <View style={styles.favoriteCategory}>
                <View style={styles.favoriteCategoryHeader}>
                  <MaterialCommunityIcons name="movie-open" size={20} color="#CDC2E5" />
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
                  <MaterialCommunityIcons name="music" size={20} color="#A08AB7" />
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
                  <MaterialCommunityIcons name="book-open-page-variant" size={20} color="#3B82F6" />
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
                  <MaterialCommunityIcons name="television" size={20} color="#10B981" />
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

        {/* Location Preferences Section */}
        {(preferences?.max_distance_miles || preferences?.willing_to_relocate !== undefined || preferences?.preferred_cities?.length) && (
          <View style={styles.locationSection}>
            <View style={styles.locationSectionHeader}>
              <MaterialCommunityIcons name="map-marker-radius" size={24} color="#F59E0B" />
              <Text style={styles.locationSectionTitle}>{t('profileCard.section.locationRelocation')}</Text>
            </View>

            {preferences?.max_distance_miles && (
              <View style={styles.locationItem}>
                <Text style={styles.locationLabel}>{t('profileCard.location.maxDistance')}</Text>
                <Text style={styles.locationValue}>{t('profileCard.location.upToMiles', { miles: preferences.max_distance_miles })}</Text>
              </View>
            )}

            {preferences?.willing_to_relocate !== undefined && (
              <View style={styles.locationItem}>
                <Text style={styles.locationLabel}>{t('profileCard.location.willingToRelocate')}</Text>
                <Text style={styles.locationValue}>
                  {preferences.willing_to_relocate ? t('profileCard.location.openToMoving') : t('profileCard.location.stayLocal')}
                </Text>
              </View>
            )}

            {preferences?.preferred_cities && preferences.preferred_cities.length > 0 && (
              <View style={styles.locationItem}>
                <Text style={styles.locationLabel}>{t('profileCard.location.preferredCities')}</Text>
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
              <Text style={styles.mustHavesSectionTitle}>{t('profileCard.section.mustHaves')}</Text>
            </View>
            <Text style={styles.mustHavesSubtitle}>{t('profileCard.section.mustHavesSubtitle')}</Text>
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
              <Text style={styles.dealbreakersTitle}>{t('profileCard.section.dealbreakers')}</Text>
            </View>
            <Text style={styles.dealbreakersSubtitle}>{t('profileCard.section.dealbreakersSubtitle')}</Text>
            {preferences.dealbreakers.map((item, index) => (
              <View key={index} style={styles.dealbreakersItem}>
                <Text style={styles.dealbreakersBullet}>•</Text>
                <Text style={styles.dealbreakersText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Third Prompt */}
        {promptAnswers[2] && (
          <PromptCard
            prompt={promptAnswers[2].prompt}
            answer={promptAnswers[2].answer}
            onLike={onLikePrompt2}
            showLikeButton={!hideActions}
          />
        )}

        {/* Remaining Prompts (4th, 5th, etc.) */}
        {promptAnswers.slice(3).map((promptItem, index) => (
          <PromptCard
            key={`prompt_${index + 4}`}
            prompt={promptItem.prompt}
            answer={promptItem.answer}
            onLike={() => handleLikeContent(`prompt_${index + 4}`, { type: 'prompt', prompt: promptItem.prompt, answer: promptItem.answer })}
            showLikeButton={!hideActions}
          />
        ))}

        {/* Remaining Photos */}
        {photos.slice(3).map((photo, index) => (
          <PhotoCard
            key={index}
            uri={photo.url}
            onLike={() => handleLikeContent(`photo_${index + 4}`, { type: 'photo', index: index + 3 })}
            blurRadius={blurRadius}

            onImageLoad={onImageLoad}
            onImageError={onImageError}
            watermarkReady={watermarkReady}
            profileId={profile.id}
            viewerUserId={viewerUserId}
            showLikeButton={!hideActions}
            photoIndex={index + 3}
            blurDataUri={(photo as any).blur_data_uri}
            shouldBlur={shouldBlurPhotos}
          />
        ))}

        {/* Compatibility Score */}
        {!hideCompatibilityScore && profile.compatibility_score != null && profile.compatibility_score > 0 && (
          <View style={styles.compatSection}>
            <View style={styles.compatHeader}>
              <MaterialCommunityIcons name="heart-circle" size={32} color="#A08AB7" />
              <View>
                <Text style={styles.compatScore}>{profile.compatibility_score}%</Text>
                <Text style={styles.compatLabel}>{t('profileCard.compatibility.compatible')}</Text>
              </View>
            </View>
            {compatibilityBreakdown && (
              <View style={styles.compatBars}>
                <CompatBar label={t('profileCard.compatibility.goals')} score={compatibilityBreakdown.goals || 0} />
                <CompatBar label={t('profileCard.compatibility.location')} score={compatibilityBreakdown.location || 0} />
                <CompatBar label={t('profileCard.compatibility.lifestyle')} score={compatibilityBreakdown.lifestyle || 0} />
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
                  <Text style={styles.actionText}>{t('profileCard.actions.report')}</Text>
                </TouchableOpacity>
              )}
              {onBlock && (
                <TouchableOpacity
                  style={[styles.actionItem, styles.actionItemDanger]}
                  onPress={() => { setShowActionSheet(false); setTimeout(() => onBlock(), 100); }}
                >
                  <MaterialCommunityIcons name="block-helper" size={24} color="#EF4444" />
                  <Text style={[styles.actionText, styles.actionTextDanger]}>{t('profileCard.actions.block')}</Text>
                </TouchableOpacity>
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Like/Obsessed Choice — Gorhom Bottom Sheet */}
      <BottomSheetModal
        ref={likeSheetRef}
        enableDynamicSizing
        enablePanDownToClose
        backdropComponent={renderLikeSheetBackdrop}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        handleIndicatorStyle={styles.likeSheetHandle}
        backgroundStyle={styles.likeSheetBackground}
      >
        <BottomSheetView style={[styles.likeChoiceSheet, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]}>
          {/* Liked content preview */}
          {pendingLikeContentData?.type === 'prompt' && pendingLikeContentData.prompt && (
            <View style={styles.likeChoicePromptPreview}>
              <Text style={styles.likeChoicePromptQuestion} numberOfLines={1}>{pendingLikeContentData.prompt}</Text>
              <Text style={styles.likeChoicePromptAnswer} numberOfLines={2}>{pendingLikeContentData.answer}</Text>
            </View>
          )}
          {pendingLikeContentData?.type === 'photo' && pendingLikeContentData.index != null && photos[pendingLikeContentData.index] && (
            <View style={styles.likeChoicePhotoPreview}>
              <Image
                source={{ uri: photos[pendingLikeContentData.index].url }}
                style={styles.likeChoicePhotoThumb}
                contentFit="cover"
                cachePolicy="memory-disk"
              />
              <Text style={styles.likeChoicePhotoLabel}>{t('discover.like.likedPhoto')}</Text>
            </View>
          )}

          {/* Message input */}
          <View style={styles.likeChoiceInputContainer}>
            <BottomSheetTextInput
              style={styles.likeChoiceInput}
              placeholder={t('discover.like.placeholder')}
              placeholderTextColor="#B0A4C0"
              value={likeMessage}
              onChangeText={setLikeMessage}
              maxLength={150}
              multiline
              numberOfLines={3}
            />
            {likeMessage.length > 0 && (
              <View style={styles.likeChoiceCharCountContainer}>
                <Text style={[
                  styles.likeChoiceCharCount,
                  likeMessage.length > 130 && { color: '#F59E0B' },
                  likeMessage.length >= 150 && { color: '#EF4444' },
                ]}>{likeMessage.length}/150</Text>
              </View>
            )}
          </View>

          {/* Action buttons */}
          <View style={styles.likeChoiceButtons}>
            <TouchableOpacity
              style={styles.likeChoicePrimaryButton}
              onPress={() => handleLikeChoice(false)}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={['#A08AB7', '#8B6FA8']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.likeChoicePrimaryGradient}
              >
                <Ionicons name="heart" size={20} color="white" />
                <Text style={styles.likeChoicePrimaryText}>
                  {likeMessage.trim() ? t('discover.like.sendWithComment') : t('discover.like.sendLike')}
                </Text>
              </LinearGradient>
              {!isPremium && (
                <Text style={styles.likeChoicePrimarySubtext}>{t('discover.likesRemaining', { count: likesRemaining, limit: dailyLikeLimit })}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.likeChoiceSecondaryButton, superLikesRemaining === 0 && styles.likeChoiceButtonDisabled]}
              onPress={() => handleLikeChoice(true)}
              activeOpacity={0.85}
              disabled={superLikesRemaining === 0}
            >
              <LinearGradient
                colors={superLikesRemaining > 0 ? ['#FEF3C7', '#FDE68A'] : ['#F3F4F6', '#E5E7EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.likeChoiceSecondaryGradient}
              >
                <MaterialCommunityIcons name="star" size={20} color={superLikesRemaining > 0 ? '#D97706' : '#9CA3AF'} />
                <Text style={[
                  styles.likeChoiceSecondaryText,
                  superLikesRemaining === 0 && { color: '#9CA3AF' },
                ]}>{t('discover.like.obsessed')}</Text>
                <View style={[
                  styles.likeChoiceCountBadge,
                  superLikesRemaining === 0 && { backgroundColor: '#E5E7EB' },
                ]}>
                  <Text style={[
                    styles.likeChoiceCountBadgeText,
                    superLikesRemaining === 0 && { color: '#9CA3AF' },
                  ]}>{superLikesRemaining}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  );
});

DiscoveryProfileView.displayName = 'DiscoveryProfileView';

// Compatibility Bar Component
const CompatBar = React.memo(function CompatBar({ label, score }: { label: string; score: number }) {
  return (
  <View style={styles.compatBarRow}>
    <Text style={styles.compatBarLabel}>{label}</Text>
    <View style={styles.compatBarBg}>
      <View style={[styles.compatBarFill, { width: `${Math.round(score)}%` }]} />
    </View>
    <Text style={styles.compatBarScore}>{Math.round(score)}%</Text>
  </View>
  );
});

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
    zIndex: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    paddingBottom: 16,
  },
  stickyHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
  },
  stickyHeaderName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
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
    width: '100%',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  photoImage: {
    width: '100%',
    aspectRatio: 0.8,
    backgroundColor: '#F3F4F6',
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
    marginTop: 40,
    marginBottom: 24,
  },
  promptAnswer: {
    fontSize: 22,
    fontWeight: '600',
    color: '#000000',
    lineHeight: 30,
    paddingRight: 50,
    marginBottom: 40,
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  // Like/Obsessed Choice — Bottom Sheet styles
  likeSheetHandle: {
    backgroundColor: '#D1D5DB',
    width: 36,
    height: 4,
  },
  likeSheetBackground: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  likeChoiceSheet: {
    paddingTop: 8,
    paddingHorizontal: 24,
  },
  likeChoicePromptPreview: {
    backgroundColor: '#FAFAFA',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: '#A08AB7',
  },
  likeChoicePromptQuestion: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8B7FA0',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  likeChoicePromptAnswer: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: 21,
  },
  likeChoicePhotoPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  likeChoicePhotoThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
  },
  likeChoicePhotoLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  likeChoiceInputContainer: {
    marginBottom: 20,
  },
  likeChoiceInput: {
    backgroundColor: '#F9F7FC',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 15,
    color: '#1F2937',
    borderWidth: 1.5,
    borderColor: '#E8E0F0',
    minHeight: 56,
    maxHeight: 100,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  likeChoiceCharCountContainer: {
    alignItems: 'flex-end',
    marginTop: 6,
    paddingRight: 4,
  },
  likeChoiceCharCount: {
    fontSize: 12,
    fontWeight: '500',
    color: '#B0A4C0',
  },
  likeChoiceButtons: {
    gap: 10,
  },
  likeChoicePrimaryButton: {
    alignItems: 'center',
  },
  likeChoicePrimaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 56,
    borderRadius: 28,
    width: '100%',
    shadowColor: '#A08AB7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  likeChoicePrimaryText: {
    fontSize: 17,
    fontWeight: '700',
    color: 'white',
    letterSpacing: 0.2,
  },
  likeChoicePrimarySubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: '#9CA3AF',
    marginTop: 6,
  },
  likeChoiceSecondaryButton: {
    alignItems: 'center',
  },
  likeChoiceSecondaryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
    width: '100%',
  },
  likeChoiceSecondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#92400E',
    letterSpacing: 0.2,
  },
  likeChoiceCountBadge: {
    backgroundColor: 'rgba(217, 119, 6, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 2,
  },
  likeChoiceCountBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#D97706',
  },
  likeChoiceButtonDisabled: {
    opacity: 0.5,
  },
});

export default DiscoveryProfileView;
