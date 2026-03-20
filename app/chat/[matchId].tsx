import React, { useState, useEffect, useRef, useLayoutEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
  Alert,
  RefreshControl,
  Modal,
  InteractionManager,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ChatSkeleton } from '@/components/shared/SkeletonScreens';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';
import { useScreenProtection } from '@/hooks/useScreenProtection';
import * as ImagePicker from 'expo-image-picker';
import { DynamicWatermark } from '@/components/security/DynamicWatermark';
import { useWatermark } from '@/hooks/useWatermark';
import { Audio } from 'expo-av';
import { sendReactionNotification } from '@/lib/notifications';
import BlockModal from '@/components/safety/BlockModal';
import { optimizeImage, uriToArrayBuffer, validateImage, IMAGE_CONFIG } from '@/lib/image-optimization';
import ReportModal from '@/components/safety/ReportModal';
import PremiumPaywall from '@/components/premium/PremiumPaywall';
import IntroMessages from '@/components/messaging/IntroMessages';
import ModerationMenu from '@/components/moderation/ModerationMenu';
import ReviewPromptBanner from '@/components/reviews/ReviewPromptBanner';
import ReviewSubmissionModal from '@/components/reviews/ReviewSubmissionModal';
import { useToast } from '@/contexts/ToastContext';
import { validateMessage, containsContactInfo, validateContent } from '@/lib/content-moderation';
import { encryptMessage, decryptMessage, getPrivateKey, getLegacyPrivateKey } from '@/lib/encryption';
import { getLastActiveText, isOnline, getOnlineStatusColor } from '@/lib/online-status';
import { trackUserAction, trackFunnel } from '@/lib/analytics';
import { useColorScheme } from '@/lib/useColorScheme';
import { checkMessagingVersionRequirement, getCurrentVersion } from '@/lib/version-check';
import * as Linking from 'expo-linking';
import * as Clipboard from 'expo-clipboard';
import { usePhotoBlur } from '@/hooks/usePhotoBlur';
import { SafeBlurImage } from '@/components/shared/SafeBlurImage';
import { getSignedUrl, getSignedUrls } from '@/lib/signed-urls';
import { extractUrls, type LinkPreviewData } from '@/lib/link-preview';
import EmojiPicker from 'rn-emoji-keyboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import SwipeableMessageBubble from '@/components/messaging/SwipeableMessageBubble';

interface MessageReaction {
  id: string;
  message_id: string;
  profile_id: string;
  emoji: string;
  created_at: string;
}

interface Message {
  id: string;
  encrypted_content: string;
  decrypted_content?: string;  // Store decrypted content separately
  sender_profile_id: string;
  receiver_profile_id: string;
  created_at: string;
  read_at: string | null;
  content_type: 'text' | 'image' | 'voice';
  media_url?: string;
  voice_duration?: number;
  reactions?: MessageReaction[];  // Reactions on this message
  reply_to_message_id?: string | null;
  reply_to_message?: {
    id: string;
    encrypted_content: string;
    sender_profile_id: string;
    content_type: string;
    decrypted_content?: string;
    media_url?: string;
  } | null;
  link_preview?: LinkPreviewData | null;
}

interface MatchProfile {
  id: string;
  display_name: string;
  age: number;
  photo_url?: string;
  photo_blur_data_uri?: string | null;
  is_verified?: boolean;
  photo_verified?: boolean;
  encryption_public_key?: string;
  location_city?: string;
  compatibility_score?: number;
  distance?: number;
  last_active_at?: string | null;
  hide_last_active?: boolean;
}

interface MatchStatus {
  status: 'active' | 'unmatched' | 'blocked';
  unmatched_by?: string | null;
  unmatched_at?: string | null;
  unmatch_reason?: string | null;
}

export default function Chat() {
  // Enable screenshot and screen recording protection for privacy
  useScreenProtection(true);

  const { t } = useTranslation();
  const { matchId } = useLocalSearchParams();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const { refreshUnreadCount } = useNotifications();
  const flatListRef = useRef<FlatList>(null);
  // Ref-based set to track message IDs we've already added to state.
  // This survives React state batching and prevents duplicates from
  // optimistic updates + Realtime events racing each other.
  const knownMessageIds = useRef(new Set<string>());
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { colors, isDarkColorScheme } = useColorScheme();
  const { showToast } = useToast();

  // Memoize voice waveform heights to prevent re-render jitter
  const voiceWaveHeights = useMemo(() => [...Array(20)].map(() => Math.random() * 20 + 10), []);

  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const currentProfileIdRef = useRef<string | null>(null); // Ref for async callbacks (subscriptions)
  const [currentProfileName, setCurrentProfileName] = useState<string>('');
  const [matchProfile, setMatchProfile] = useState<MatchProfile | null>(null);
  const [matchStatus, setMatchStatus] = useState<MatchStatus | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [pendingReviewData, setPendingReviewData] = useState<{
    matchId: string;
    revieweeId: string;
    revieweeName: string;
  } | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Voice message state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const [showIntroMessages, setShowIntroMessages] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);

  // Photo reveal state
  // Like intro context (shows what was liked + comment at top of chat)
  const [likeIntro, setLikeIntro] = useState<{
    senderName: string;
    senderId: string;
    message?: string;
    likedContent?: { type: string; prompt?: string; answer?: string; index?: number };
    photoUrl?: string;
    createdAt: string;
  } | null>(null);

  const [hasRevealedPhotos, setHasRevealedPhotos] = useState(false);
  const [otherUserRevealed, setOtherUserRevealed] = useState(false);
  const [currentUserPhotoBlur, setCurrentUserPhotoBlur] = useState(false);
  const [matchProfilePhotoBlur, setMatchProfilePhotoBlur] = useState(false);
  const [revealLoading, setRevealLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const { viewerUserId, isReady: watermarkReady } = useWatermark();

  // Photo blur - uses server-side data URI when available, falls back to legacy blur
  const { imageUri: matchPhotoUri, blurRadius, onImageLoad, onImageError } = usePhotoBlur({
    shouldBlur: matchProfilePhotoBlur && !otherUserRevealed && !isAdmin,
    photoUrl: matchProfile?.photo_url || 'https://via.placeholder.com/40',
    blurDataUri: matchProfile?.photo_blur_data_uri,
    blurIntensity: 20,
  });

  // Typing indicator state (Premium feature)
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastTypingBroadcastRef = useRef<number>(0);
  const typingChannelRef = useRef<any>(null);

  // Refs for timeout cleanup to prevent memory leaks
  const autoStopRecordingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scrollTimeoutRefs = useRef<NodeJS.Timeout[]>([]);

  // Reaction picker state
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [reactionTargetMessage, setReactionTargetMessage] = useState<Message | null>(null);
  const [reactionPickerPosition, setReactionPickerPosition] = useState({ top: 0, left: 0 });
  const [showFullEmojiPicker, setShowFullEmojiPicker] = useState(false);
  const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '🔥'];

  // Timestamp display state - which message is showing full timestamp
  const [expandedTimestampId, setExpandedTimestampId] = useState<string | null>(null);

  // Reply state
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const textInputRef = useRef<TextInput>(null);

  // Premium banner dismiss state
  const [premiumBannerDismissed, setPremiumBannerDismissed] = useState(false);

  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResultIds, setSearchResultIds] = useState<string[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const searchInputRef = useRef<TextInput>(null);

  // Track whether initial load completed (prevents useFocusEffect double-load)
  const initialLoadDone = useRef(false);

  // Android layout fix - force re-layout after initial mount
  const [androidLayoutReady, setAndroidLayoutReady] = useState(Platform.OS !== 'android');

  // Version check state - ensures encryption compatibility
  const [versionCheckPassed, setVersionCheckPassed] = useState(true);
  const [versionUpdateMessage, setVersionUpdateMessage] = useState<string | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Check messaging version requirement on mount
  useEffect(() => {
    const checkVersion = async () => {
      const result = await checkMessagingVersionRequirement();
      if (!result.allowed) {
        setVersionCheckPassed(false);
        setVersionUpdateMessage(result.message || t('chat.version.updateRequired'));
        setShowUpdateModal(true);
      }
    };
    checkVersion();
  }, []);

  // Check if premium banner was recently dismissed (reshow after 4 days)
  useEffect(() => {
    if (isPremium) return;
    AsyncStorage.getItem('premiumBannerDismissedAt').then((val) => {
      if (val) {
        const dismissed = new Date(val).getTime();
        const fourDays = 4 * 24 * 60 * 60 * 1000;
        if (Date.now() - dismissed < fourDays) {
          setPremiumBannerDismissed(true);
        }
      }
    });
  }, [isPremium]);

  const handleDismissPremiumBanner = useCallback(() => {
    setPremiumBannerDismissed(true);
    AsyncStorage.setItem('premiumBannerDismissedAt', new Date().toISOString());
  }, []);

  // Android layout fix - trigger re-layout after interactions complete
  useLayoutEffect(() => {
    if (Platform.OS === 'android') {
      const handle = InteractionManager.runAfterInteractions(() => {
        setAndroidLayoutReady(true);
      });
      return () => handle.cancel();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let unsubMessages: (() => void) | null = null;
    let unsubReactions: (() => void) | null = null;

    const initChat = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      try {
        // ═══ Phase 1: All independent queries in parallel ═══
        // Current profile, match data, messages, and encryption keys all start simultaneously
        const [profileResult, matchResult, messagesResult, myPrivateKey, myLegacyPrivateKey] = await Promise.all([
          supabase.from('profiles')
            .select('id, display_name, photo_blur_enabled, is_admin')
            .eq('user_id', user.id)
            .single(),
          supabase.from('matches')
            .select('profile1_id, profile2_id, status, unmatched_by, unmatched_at, unmatch_reason, compatibility_score')
            .eq('id', matchId)
            .single(),
          supabase.from('messages')
            .select('*, reply_to:reply_to_message_id(id, encrypted_content, sender_profile_id, content_type, media_url)')
            .eq('match_id', matchId)
            .order('created_at', { ascending: false })
            .limit(100),
          getPrivateKey(user?.id || ''),
          getLegacyPrivateKey(user?.id || ''),
        ]);

        if (cancelled) return;

        // Extract current profile
        if (profileResult.error) throw profileResult.error;
        const myProfileId = profileResult.data.id;
        currentProfileIdRef.current = myProfileId;
        setCurrentProfileId(myProfileId);
        setCurrentProfileName(profileResult.data.display_name);
        setCurrentUserPhotoBlur(profileResult.data.photo_blur_enabled || false);
        setIsAdmin(profileResult.data.is_admin || false);

        // Process match data
        if (matchResult.error) throw matchResult.error;
        const matchData = matchResult.data;
        setMatchStatus({
          status: matchData.status,
          unmatched_by: matchData.unmatched_by,
          unmatched_at: matchData.unmatched_at,
          unmatch_reason: matchData.unmatch_reason,
        });

        if (matchData.status !== 'active') {
          setLoading(false);
          return;
        }

        const otherProfileId = matchData.profile1_id === myProfileId
          ? matchData.profile2_id
          : matchData.profile1_id;

        // Collect message IDs for reactions query
        const messagesData = messagesResult.data || [];
        const messageIds = messagesData.map((m: any) => m.id);

        // ═══ Phase 2: Queries that need otherProfileId / messageIds ═══
        // Ban check, other profile (with encryption key), location, reactions, photo reveals — all parallel
        const [banResult, otherProfileResult, myLocationResult, reactionsResult, revealResults] = await Promise.all([
          supabase.from('bans')
            .select('id')
            .eq('banned_profile_id', otherProfileId)
            .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
            .maybeSingle(),
          supabase.from('profiles')
            .select(`
              id, display_name, age, is_verified, photo_verified,
              location_city, latitude, longitude, last_active_at,
              hide_last_active, photo_blur_enabled, encryption_public_key,
              photos (url, storage_path, is_primary, display_order, blur_data_uri)
            `)
            .eq('id', otherProfileId)
            .single(),
          supabase.from('profiles')
            .select('latitude, longitude')
            .eq('id', myProfileId)
            .single(),
          messageIds.length > 0
            ? supabase.from('message_reactions').select('*').in('message_id', messageIds)
            : Promise.resolve({ data: [] as MessageReaction[] }),
          Promise.all([
            supabase.from('photo_reveals').select('id')
              .eq('revealer_profile_id', myProfileId)
              .eq('revealed_to_profile_id', otherProfileId)
              .maybeSingle(),
            supabase.from('photo_reveals').select('id')
              .eq('revealer_profile_id', otherProfileId)
              .eq('revealed_to_profile_id', myProfileId)
              .maybeSingle(),
          ]),
        ]);

        if (cancelled) return;

        // ═══ Process ban check ═══
        if (banResult.data) {
          Alert.alert(
            t('chat.unavailable.title'),
            t('chat.unavailable.message'),
            [{ text: 'OK', onPress: () => router.back() }]
          );
          setLoading(false);
          return;
        }

        // ═══ Process match profile ═══
        const profile = otherProfileResult.data;
        if (otherProfileResult.error || !profile) throw otherProfileResult.error;

        const photos = profile.photos?.sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
        const primaryPhoto = photos?.find((p: any) => p.is_primary) || photos?.[0];

        let signedPhotoUrl = primaryPhoto?.url;
        if (primaryPhoto) {
          const pathOrUrl = primaryPhoto.storage_path || primaryPhoto.url;
          if (pathOrUrl) {
            const signed = await getSignedUrl('profile-photos', pathOrUrl);
            if (signed) signedPhotoUrl = signed;
          }
        }

        let distance = null;
        const currentUserData = myLocationResult.data;
        if (profile.latitude && profile.longitude &&
            currentUserData?.latitude && currentUserData?.longitude) {
          const R = 3959;
          const dLat = ((profile.latitude - currentUserData.latitude) * Math.PI) / 180;
          const dLon = ((profile.longitude - currentUserData.longitude) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((currentUserData.latitude * Math.PI) / 180) *
              Math.cos((profile.latitude * Math.PI) / 180) *
              Math.sin(dLon / 2) *
              Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          distance = Math.round(R * c);
        }

        setMatchProfile({
          id: profile.id,
          display_name: profile.display_name,
          age: profile.age,
          photo_url: signedPhotoUrl,
          photo_blur_data_uri: primaryPhoto?.blur_data_uri,
          is_verified: profile.is_verified,
          photo_verified: profile.photo_verified,
          location_city: profile.location_city,
          compatibility_score: matchData.compatibility_score,
          distance: distance ?? undefined,
          last_active_at: profile.last_active_at,
          hide_last_active: profile.hide_last_active,
        });
        setMatchProfilePhotoBlur(profile.photo_blur_enabled || false);

        // Photo reveal status
        setHasRevealedPhotos(!!revealResults[0].data);
        setOtherUserRevealed(!!revealResults[1].data);

        // Non-blocking: like intro
        loadLikeIntro(otherProfileId, profile.display_name);

        // ═══ Process messages ═══
        const otherPublicKey = profile.encryption_public_key;

        if (messagesData.length === 0) {
          setMessages([]);
          setLoading(false);
          initialLoadDone.current = true;

          // Set up subscriptions + mark as read even when no messages
          unsubMessages = subscribeToMessages();
          unsubReactions = subscribeToReactions();
          supabase.from('messages')
            .update({ read_at: new Date().toISOString() })
            .eq('match_id', matchId)
            .eq('receiver_profile_id', myProfileId)
            .is('read_at', null)
            .then(({ error: readError }) => { if (!readError) refreshUnreadCount(); });
          return;
        }

        // Build reactions map
        const { data: reactionsData } = reactionsResult;
        const reactionsByMessage = new Map<string, MessageReaction[]>();
        if (reactionsData) {
          (reactionsData as MessageReaction[]).forEach((reaction) => {
            const existing = reactionsByMessage.get(reaction.message_id) || [];
            reactionsByMessage.set(reaction.message_id, [...existing, reaction]);
          });
        }

        // Build messages in newest-first order (matches inverted FlatList)
        const quickMessages: Message[] = messagesData.map((message: any) => {
          const msg = message as Message;
          let decryptedContent: string | undefined;

          if (msg.content_type !== 'text') {
            decryptedContent = undefined;
          } else {
            const content = msg.encrypted_content;
            if (content && content.includes(':') && /^[A-Za-z0-9+/=]+:/.test(content)) {
              decryptedContent = '\u00A0';
            } else {
              decryptedContent = content;
            }
          }

          return {
            ...msg,
            decrypted_content: decryptedContent,
            reactions: reactionsByMessage.get(message.id) || [],
            reply_to_message_id: message.reply_to_message_id || null,
            reply_to_message: message.reply_to || null,
            link_preview: message.link_preview || null,
          };
        });

        // Sign media URLs for image/voice messages
        const signedMessages = await signMessageMediaUrls(quickMessages);

        // Show UI immediately with plaintext + placeholders
        signedMessages.forEach(m => knownMessageIds.current.add(m.id));
        setMessages(signedMessages);
        setLoading(false);
        initialLoadDone.current = true;

        // Set up subscriptions
        unsubMessages = subscribeToMessages();
        unsubReactions = subscribeToReactions();

        // Mark messages as read (non-blocking)
        supabase.from('messages')
          .update({ read_at: new Date().toISOString() })
          .eq('match_id', matchId)
          .eq('receiver_profile_id', myProfileId)
          .is('read_at', null)
          .then(({ error: readError }) => { if (!readError) refreshUnreadCount(); });

        // PERFORMANCE: Defer decryption until after UI is responsive
        InteractionManager.runAfterInteractions(async () => {
          try {
            if (!myPrivateKey && !myLegacyPrivateKey) return;
            if (!otherPublicKey) return;

            const needsDecryption = signedMessages.filter(
              (m) => m.content_type === 'text' && m.encrypted_content.includes(':') && /^[A-Za-z0-9+/=]+:/.test(m.encrypted_content)
            );

            const decryptedMap = new Map<string, string>();
            if (needsDecryption.length > 0) {
              await Promise.all(
                needsDecryption.map(async (msg) => {
                  let decryptedContent: string | undefined;
                  if (myPrivateKey) {
                    try {
                      const result = await decryptMessage(msg.encrypted_content, myPrivateKey, otherPublicKey);
                      if (result !== '[Unable to decrypt message]') decryptedContent = result;
                    } catch {}
                  }
                  if (!decryptedContent && myLegacyPrivateKey) {
                    try {
                      const result = await decryptMessage(msg.encrypted_content, myLegacyPrivateKey, otherPublicKey);
                      if (result !== '[Unable to decrypt message]') decryptedContent = result;
                    } catch {}
                  }
                  decryptedMap.set(msg.id, decryptedContent || t('chat.unableToDecrypt'));
                })
              );
            }

            // Decrypt reply_to_message content that isn't in the current batch
            const replyDecryptedMap = new Map<string, string>();
            const uniqueReplyEncrypted = new Map<string, string>();
            for (const m of signedMessages) {
              if (m.reply_to_message?.content_type === 'text' &&
                  m.reply_to_message.encrypted_content?.includes(':') &&
                  /^[A-Za-z0-9+/=]+:/.test(m.reply_to_message.encrypted_content) &&
                  !decryptedMap.has(m.reply_to_message.id) &&
                  !uniqueReplyEncrypted.has(m.reply_to_message.id)) {
                uniqueReplyEncrypted.set(m.reply_to_message.id, m.reply_to_message.encrypted_content);
              }
            }
            if (uniqueReplyEncrypted.size > 0) {
              await Promise.all(
                Array.from(uniqueReplyEncrypted.entries()).map(async ([replyId, encContent]) => {
                  let decryptedContent: string | undefined;
                  if (myPrivateKey) {
                    try {
                      const result = await decryptMessage(encContent, myPrivateKey, otherPublicKey);
                      if (result !== '[Unable to decrypt message]') decryptedContent = result;
                    } catch {}
                  }
                  if (!decryptedContent && myLegacyPrivateKey) {
                    try {
                      const result = await decryptMessage(encContent, myLegacyPrivateKey, otherPublicKey);
                      if (result !== '[Unable to decrypt message]') decryptedContent = result;
                    } catch {}
                  }
                  if (decryptedContent) replyDecryptedMap.set(replyId, decryptedContent);
                })
              );
            }

            // Check if anything needs patching
            if (decryptedMap.size === 0 && replyDecryptedMap.size === 0) return;

            setMessages((prev) => {
              const allDecrypted = new Map(decryptedMap);
              for (const m of prev) {
                if (m.decrypted_content && !allDecrypted.has(m.id)) {
                  allDecrypted.set(m.id, m.decrypted_content);
                }
              }
              for (const [id, content] of replyDecryptedMap) {
                if (!allDecrypted.has(id)) allDecrypted.set(id, content);
              }
              return prev.map((m) => {
                const decrypted = decryptedMap.get(m.id);
                const updated = decrypted ? { ...m, decrypted_content: decrypted } : m;
                if (updated.reply_to_message?.id) {
                  const replyDecrypted = allDecrypted.get(updated.reply_to_message.id);
                  if (replyDecrypted && updated.reply_to_message.decrypted_content !== replyDecrypted) {
                    return { ...updated, reply_to_message: { ...updated.reply_to_message, decrypted_content: replyDecrypted } };
                  }
                }
                return updated;
              });
            });
          } catch (error) {
            console.error('Error decrypting messages:', error);
          }
        });
      } catch (error: any) {
        console.error('Error initializing chat:', error);
        showToast({ type: 'error', title: t('common.error'), message: t('toast.chatLoadError') });
        setLoading(false);
      }
    };

    initChat();
    setupAudio();

    // Track keyboard visibility and height (for manual handling on both platforms)
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      (e) => {
        setKeyboardVisible(true);
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
        setKeyboardHeight(0);
      }
    );

    return () => {
      cancelled = true;
      cleanupAudio();
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
      unsubMessages?.();
      unsubReactions?.();
      knownMessageIds.current.clear();
      // Clean up all scroll timeouts
      scrollTimeoutRefs.current.forEach(clearTimeout);
      scrollTimeoutRefs.current = [];
      // Clean up auto-stop recording timeout
      if (autoStopRecordingTimeoutRef.current) {
        clearTimeout(autoStopRecordingTimeoutRef.current);
        autoStopRecordingTimeoutRef.current = null;
      }
    };
  }, [matchId]);

  // Reload messages when screen regains focus (e.g., from notification tap)
  // Skip the initial mount — initChat already handles that
  useFocusEffect(
    useCallback(() => {
      if (initialLoadDone.current && currentProfileId && !loading) {
        // Only mark as read on refocus — don't reload all messages.
        // The realtime subscription handles new incoming messages.
        markMessagesAsRead();
      }
    }, [currentProfileId, loading])
  );

  useEffect(() => {
    // Auto-show intro messages for Premium users when chat is empty
    if (isPremium && messages.length === 0 && !loading && matchProfile) {
      setShowIntroMessages(true);
    }
  }, [isPremium, messages.length, loading, matchProfile]);

  const setupAudio = async (forRecording = false) => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: forRecording,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('Error setting up audio:', error);
    }
  };

  const cleanupAudio = async () => {
    if (recordingRef.current) {
      try {
        const status = await recordingRef.current.getStatusAsync();
        if (status.canRecord || status.isRecording) {
          await recordingRef.current.stopAndUnloadAsync();
        }
      } catch (error) {
        // Already unloaded, ignore
      }
      recordingRef.current = null;
    }
    if (soundRef.current) {
      try {
        await soundRef.current.unloadAsync();
      } catch (error) {
        console.error('Error cleaning up sound:', error);
      }
    }
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }
  };

  const loadLikeIntro = async (otherProfileId: string, otherDisplayName: string) => {
    const myProfileId = currentProfileIdRef.current || currentProfileId;
    try {
      // Find the like between these two profiles that has a message or liked_content
      // Check both directions (either user could have liked first)
      const { data: likes, error } = await supabase
        .from('likes')
        .select('liker_profile_id, message, liked_content, created_at')
        .or(
          `and(liker_profile_id.eq.${myProfileId},liked_profile_id.eq.${otherProfileId}),` +
          `and(liker_profile_id.eq.${otherProfileId},liked_profile_id.eq.${myProfileId})`
        )
        .not('message', 'is', null)
        .order('created_at', { ascending: true })
        .limit(1);

      if (error || !likes?.length) {
        // Also check for likes with liked_content but no message
        const { data: contentLikes, error: contentError } = await supabase
          .from('likes')
          .select('liker_profile_id, message, liked_content, created_at')
          .or(
            `and(liker_profile_id.eq.${myProfileId},liked_profile_id.eq.${otherProfileId}),` +
            `and(liker_profile_id.eq.${otherProfileId},liked_profile_id.eq.${myProfileId})`
          )
          .not('liked_content', 'is', null)
          .order('created_at', { ascending: true })
          .limit(1);

        if (contentError || !contentLikes?.length) return;

        const like = contentLikes[0];
        const isFromMe = like.liker_profile_id === myProfileId;
        const parsedContent = like.liked_content ? (() => { try { return JSON.parse(like.liked_content); } catch { return null; } })() : null;

        // If it's just a photo like with no message, skip — not interesting enough for intro
        if (parsedContent?.type === 'photo' && !like.message) return;

        let photoUrl: string | undefined;
        if (parsedContent?.type === 'photo' && typeof parsedContent.index === 'number') {
          const { data: photos } = await supabase
            .from('photos')
            .select('url, storage_path')
            .eq('profile_id', isFromMe ? otherProfileId : myProfileId)
            .order('display_order', { ascending: true });
          if (photos?.[parsedContent.index]) {
            const photo = photos[parsedContent.index];
            const signed = await getSignedUrl('profile-photos', photo.storage_path || photo.url);
            photoUrl = signed || photo.url;
          }
        }

        setLikeIntro({
          senderName: isFromMe ? currentProfileName : otherDisplayName,
          senderId: like.liker_profile_id,
          message: like.message || undefined,
          likedContent: parsedContent || undefined,
          photoUrl,
          createdAt: like.created_at,
        });
        return;
      }

      const like = likes[0];
      const isFromMe = like.liker_profile_id === myProfileId;
      const parsedContent = like.liked_content ? (() => { try { return JSON.parse(like.liked_content); } catch { return null; } })() : null;

      let photoUrl: string | undefined;
      if (parsedContent?.type === 'photo' && typeof parsedContent.index === 'number') {
        const { data: photos } = await supabase
          .from('photos')
          .select('url, storage_path')
          .eq('profile_id', isFromMe ? otherProfileId : myProfileId)
          .order('display_order', { ascending: true });
        if (photos?.[parsedContent.index]) {
          const photo = photos[parsedContent.index];
          const signed = await getSignedUrl('profile-photos', photo.storage_path || photo.url);
          photoUrl = signed || photo.url;
        }
      }

      setLikeIntro({
        senderName: isFromMe ? currentProfileName : otherDisplayName,
        senderId: like.liker_profile_id,
        message: like.message || undefined,
        likedContent: parsedContent || undefined,
        photoUrl,
        createdAt: like.created_at,
      });
    } catch (error) {
      // Non-critical — silently fail
      console.error('Error loading like intro:', error);
    }
  };

  /**
   * Batch-sign media_url for image/voice messages using the chat-media bucket.
   * Messages without media or with text content_type are returned unchanged.
   */
  const signMessageMediaUrls = async (msgs: Message[]): Promise<Message[]> => {
    // Collect indices and paths of messages that need signing
    const mediaEntries: { idx: number; path: string }[] = [];
    // Also collect reply-to image paths that need signing
    const replyMediaEntries: { idx: number; path: string }[] = [];
    for (let i = 0; i < msgs.length; i++) {
      const m = msgs[i];
      if (m.media_url && (m.content_type === 'image' || m.content_type === 'voice')) {
        mediaEntries.push({ idx: i, path: m.media_url });
      }
      if (m.reply_to_message?.media_url && m.reply_to_message.content_type === 'image') {
        replyMediaEntries.push({ idx: i, path: m.reply_to_message.media_url });
      }
    }
    if (mediaEntries.length === 0 && replyMediaEntries.length === 0) return msgs;

    // Sign all paths in a single batch
    const allPaths = [
      ...mediaEntries.map((e) => e.path),
      ...replyMediaEntries.map((e) => e.path),
    ];
    const allSignedUrls = await getSignedUrls('chat-media', allPaths);

    const result = [...msgs];
    // Apply signed URLs to top-level media
    for (let j = 0; j < mediaEntries.length; j++) {
      const { idx } = mediaEntries[j];
      if (allSignedUrls[j]) {
        result[idx] = { ...result[idx], media_url: allSignedUrls[j]! };
      }
    }
    // Apply signed URLs to reply-to media
    const replyOffset = mediaEntries.length;
    for (let j = 0; j < replyMediaEntries.length; j++) {
      const { idx } = replyMediaEntries[j];
      if (allSignedUrls[replyOffset + j]) {
        result[idx] = {
          ...result[idx],
          reply_to_message: {
            ...result[idx].reply_to_message!,
            media_url: allSignedUrls[replyOffset + j]!,
          },
        };
      }
    }
    return result;
  };

  const loadMessages = async () => {
    try {
      // Fetch the most recent 100 messages (paginated to prevent RAM bloat)
      const MESSAGE_PAGE_SIZE = 100;

      // Fetch messages + keys in parallel (keys needed later for decryption)
      const [messagesResult, myPrivateKey, myLegacyPrivateKey] = await Promise.all([
        supabase
          .from('messages')
          .select('*, reply_to:reply_to_message_id(id, encrypted_content, sender_profile_id, content_type, media_url)')
          .eq('match_id', matchId)
          .order('created_at', { ascending: false })
          .limit(MESSAGE_PAGE_SIZE),
        getPrivateKey(user?.id || ''),
        getLegacyPrivateKey(user?.id || ''),
      ]);

      const { data, error } = messagesResult;

      if (error) {
        console.error('ERROR LOADING MESSAGES:', error);
        throw error;
      }

      if (!data || data.length === 0) {
        setMessages([]);
        return;
      }

      // Determine other profile ID from first message (use ref for async contexts)
      const myId = currentProfileIdRef.current || currentProfileId;
      const otherProfileId = data[0].sender_profile_id === myId
        ? data[0].receiver_profile_id
        : data[0].sender_profile_id;

      // Fetch reactions + other profile's public key in parallel
      const messageIds = data.map(m => m.id);
      const [reactionsResult, otherProfileResult] = await Promise.all([
        messageIds.length > 0
          ? supabase
              .from('message_reactions')
              .select('*')
              .in('message_id', messageIds)
          : Promise.resolve({ data: [] as MessageReaction[] }),
        supabase
          .from('profiles')
          .select('encryption_public_key')
          .eq('id', otherProfileId)
          .single(),
      ]);

      const { data: reactionsData } = reactionsResult;
      const otherPublicKey = otherProfileResult.data?.encryption_public_key;

      // Create a map of reactions by message ID
      const reactionsByMessage = new Map<string, MessageReaction[]>();
      if (reactionsData) {
        (reactionsData as MessageReaction[]).forEach((reaction) => {
          const existing = reactionsByMessage.get(reaction.message_id) || [];
          reactionsByMessage.set(reaction.message_id, [...existing, reaction]);
        });
      }

      // Build messages in newest-first order (matches inverted FlatList)
      const quickMessages: Message[] = data.map((message) => {
        const msg = message as Message;
        let decryptedContent: string | undefined;

        if (msg.content_type !== 'text') {
          // Non-text messages don't need decryption
          decryptedContent = undefined;
        } else {
          const content = msg.encrypted_content;
          if (content && content.includes(':') && /^[A-Za-z0-9+/=]+:/.test(content)) {
            // Looks encrypted — use invisible placeholder, decryption fills in real text
            decryptedContent = '\u00A0';
          } else {
            // Plaintext — use directly
            decryptedContent = content;
          }
        }

        return {
          ...msg,
          decrypted_content: decryptedContent,
          reactions: reactionsByMessage.get(message.id) || [],
          reply_to_message_id: (message as any).reply_to_message_id || null,
          reply_to_message: (message as any).reply_to || null,
          link_preview: (message as any).link_preview || null,
        };
      });

      // Sign media URLs for image/voice messages (private bucket)
      const signedMessages = await signMessageMediaUrls(quickMessages);

      // Show UI immediately with plaintext + placeholders
      setMessages(signedMessages);
      setLoading(false);
      setRefreshing(false);

      // PERFORMANCE: Defer decryption until after UI is responsive
      InteractionManager.runAfterInteractions(async () => {
        try {
          if (!myPrivateKey && !myLegacyPrivateKey) return;
          if (!otherPublicKey) return;

          // Only decrypt messages that still show placeholders
          const needsDecryption = signedMessages.filter(
            (m) => m.content_type === 'text' && m.encrypted_content.includes(':') && /^[A-Za-z0-9+/=]+:/.test(m.encrypted_content)
          );

          const decryptedMap = new Map<string, string>();
          if (needsDecryption.length > 0) {
            await Promise.all(
              needsDecryption.map(async (msg) => {
                let decryptedContent: string | undefined;
                if (myPrivateKey) {
                  try {
                    const result = await decryptMessage(msg.encrypted_content, myPrivateKey, otherPublicKey);
                    if (result !== '[Unable to decrypt message]') decryptedContent = result;
                  } catch {}
                }
                if (!decryptedContent && myLegacyPrivateKey) {
                  try {
                    const result = await decryptMessage(msg.encrypted_content, myLegacyPrivateKey, otherPublicKey);
                    if (result !== '[Unable to decrypt message]') decryptedContent = result;
                  } catch {}
                }
                decryptedMap.set(msg.id, decryptedContent || t('chat.unableToDecrypt'));
              })
            );
          }

          // Decrypt reply_to_message content that isn't in the current batch
          const replyDecryptedMap = new Map<string, string>();
          const uniqueReplyEncrypted = new Map<string, string>();
          for (const m of signedMessages) {
            if (m.reply_to_message?.content_type === 'text' &&
                m.reply_to_message.encrypted_content?.includes(':') &&
                /^[A-Za-z0-9+/=]+:/.test(m.reply_to_message.encrypted_content) &&
                !decryptedMap.has(m.reply_to_message.id) &&
                !uniqueReplyEncrypted.has(m.reply_to_message.id)) {
              uniqueReplyEncrypted.set(m.reply_to_message.id, m.reply_to_message.encrypted_content);
            }
          }
          if (uniqueReplyEncrypted.size > 0) {
            await Promise.all(
              Array.from(uniqueReplyEncrypted.entries()).map(async ([replyId, encContent]) => {
                let decryptedContent: string | undefined;
                if (myPrivateKey) {
                  try {
                    const result = await decryptMessage(encContent, myPrivateKey, otherPublicKey);
                    if (result !== '[Unable to decrypt message]') decryptedContent = result;
                  } catch {}
                }
                if (!decryptedContent && myLegacyPrivateKey) {
                  try {
                    const result = await decryptMessage(encContent, myLegacyPrivateKey, otherPublicKey);
                    if (result !== '[Unable to decrypt message]') decryptedContent = result;
                  } catch {}
                }
                if (decryptedContent) replyDecryptedMap.set(replyId, decryptedContent);
              })
            );
          }

          // Check if anything needs patching
          if (decryptedMap.size === 0 && replyDecryptedMap.size === 0) return;

          // Batch-update all decrypted messages at once
          setMessages((prev) => {
            const allDecrypted = new Map(decryptedMap);
            for (const m of prev) {
              if (m.decrypted_content && !allDecrypted.has(m.id)) {
                allDecrypted.set(m.id, m.decrypted_content);
              }
            }
            for (const [id, content] of replyDecryptedMap) {
              if (!allDecrypted.has(id)) allDecrypted.set(id, content);
            }
            return prev.map((m) => {
              const decrypted = decryptedMap.get(m.id);
              const updated = decrypted ? { ...m, decrypted_content: decrypted } : m;
              if (updated.reply_to_message?.id) {
                const replyDecrypted = allDecrypted.get(updated.reply_to_message.id);
                if (replyDecrypted && updated.reply_to_message.decrypted_content !== replyDecrypted) {
                  return { ...updated, reply_to_message: { ...updated.reply_to_message, decrypted_content: replyDecrypted } };
                }
              }
              return updated;
            });
          });
        } catch (error) {
          console.error('Error decrypting messages:', error);
        }
      });
    } catch (error: any) {
      console.error('CATCH Error loading messages:', error);
      showToast({ type: 'error', title: t('common.error'), message: t('toast.messagesLoadError') });
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadMessages();
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`chat-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `match_id=eq.${matchId}`,
        },
        async (payload) => {
          // Decrypt the new message before adding to state
          const newMessage = payload.new as Message;
          let decryptedMessage = await decryptSingleMessage(newMessage);

          // Sign media URL for image/voice messages (private bucket)
          if (decryptedMessage.media_url && (decryptedMessage.content_type === 'image' || decryptedMessage.content_type === 'voice')) {
            const signedUrl = await getSignedUrl('chat-media', decryptedMessage.media_url);
            if (signedUrl) {
              decryptedMessage = { ...decryptedMessage, media_url: signedUrl };
            }
          }

          setMessages((prev) => {
            // Check ref-based set first (survives React batching), then state
            if (knownMessageIds.current.has(decryptedMessage.id)) {
              return prev;
            }
            knownMessageIds.current.add(decryptedMessage.id);

            // Look up reply-to message from local state
            let replyToMessage = null;
            if (decryptedMessage.reply_to_message_id) {
              const referencedMsg = prev.find(m => m.id === decryptedMessage.reply_to_message_id);
              if (referencedMsg) {
                replyToMessage = {
                  id: referencedMsg.id,
                  encrypted_content: referencedMsg.encrypted_content,
                  sender_profile_id: referencedMsg.sender_profile_id,
                  content_type: referencedMsg.content_type,
                  decrypted_content: referencedMsg.decrypted_content,
                  media_url: referencedMsg.media_url,
                };
              }
            }

            return [{ ...decryptedMessage, reactions: [], reply_to_message: replyToMessage }, ...prev];
          });

          // Mark as read if message is for current user (use ref for async callbacks)
          if (newMessage.receiver_profile_id === (currentProfileIdRef.current || currentProfileId)) {
            markMessageAsRead(newMessage.id);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  // Subscribe to reaction changes in real-time
  const subscribeToReactions = () => {
    const channel = supabase
      .channel(`reactions-${matchId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'message_reactions',
        },
        async (payload) => {


          if (payload.eventType === 'INSERT') {
            const newReaction = payload.new as MessageReaction;
            // Update local message with new reaction
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id === newReaction.message_id) {
                  const exists = msg.reactions?.some((r) => r.id === newReaction.id);
                  if (exists) return msg;
                  return {
                    ...msg,
                    reactions: [...(msg.reactions || []), newReaction],
                  };
                }
                return msg;
              })
            );
          } else if (payload.eventType === 'UPDATE') {
            const updatedReaction = payload.new as MessageReaction;
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id === updatedReaction.message_id) {
                  return {
                    ...msg,
                    reactions: msg.reactions?.map((r) =>
                      r.id === updatedReaction.id ? updatedReaction : r
                    ),
                  };
                }
                return msg;
              })
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedReaction = payload.old as MessageReaction;
            setMessages((prev) =>
              prev.map((msg) => {
                if (msg.id === deletedReaction.message_id) {
                  return {
                    ...msg,
                    reactions: msg.reactions?.filter((r) => r.id !== deletedReaction.id),
                  };
                }
                return msg;
              })
            );
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  // Subscribe to typing indicator channel (all users join to broadcast; premium users see indicators)
  const subscribeToTypingIndicator = useCallback(() => {
    if (!matchId || !currentProfileId) return;

    const channel = supabase.channel(`typing-${matchId}`, {
      config: {
        broadcast: { self: false },
      },
    });

    channel
      .on('broadcast', { event: 'typing' }, (payload) => {
        // Only show typing if it's from the other user
        if (payload.payload?.profileId && payload.payload.profileId !== currentProfileId) {
          setIsOtherUserTyping(true);

          // Clear existing timeout
          if (typingTimeoutRef.current) {
            clearTimeout(typingTimeoutRef.current);
          }

          // Hide typing indicator after 3 seconds of no typing events
          typingTimeoutRef.current = setTimeout(() => {
            setIsOtherUserTyping(false);
          }, 3000);
        }
      })
      .subscribe();

    typingChannelRef.current = channel;

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      channel.unsubscribe();
    };
  }, [matchId, currentProfileId]);

  // Broadcast typing event with debounce (all users broadcast, premium users see)
  const broadcastTyping = useCallback(() => {
    if (!typingChannelRef.current || !currentProfileId) return;

    const now = Date.now();
    // Only broadcast every 2 seconds to avoid spamming
    if (now - lastTypingBroadcastRef.current < 2000) return;

    lastTypingBroadcastRef.current = now;
    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { profileId: currentProfileId },
    });
  }, [currentProfileId]);

  // Subscribe to typing indicator channel for all users (premium users see it, all users broadcast)
  // Note: We intentionally exclude subscribeToTypingIndicator from deps to avoid resubscription loop
  useEffect(() => {
    if (currentProfileId && matchId) {
      const unsubscribe = subscribeToTypingIndicator();
      return () => {
        if (unsubscribe) {
          unsubscribe();
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentProfileId, matchId]);

  const markMessagesAsRead = async () => {
    const profileId = currentProfileIdRef.current || currentProfileId;
    if (!profileId) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('match_id', matchId)
        .eq('receiver_profile_id', profileId)
        .is('read_at', null);

      if (!error) {
        // Refresh the unread message count in the tab bar badge
        refreshUnreadCount();
      }
    } catch (error: any) {
      console.error('Error marking messages as read:', error);
    }
  };

  const markMessageAsRead = async (messageId: string) => {
    try {
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId);

      if (!error) {
        // Refresh the unread message count in the tab bar badge
        refreshUnreadCount();
      }
    } catch (error: any) {
      console.error('Error marking message as read:', error);
    }
  };

  /**
   * Decrypt a single message
   * Returns the message with decrypted content, or error message if decryption fails
   *
   * IMPORTANT: ECDH key derivation requires:
   * - If I'm the RECIPIENT: use my private key + sender's public key
   * - If I'm the SENDER: use my private key + recipient's public key
   *
   * BACKWARDS COMPATIBILITY: Tries current deterministic key first, then falls back
   * to legacy random key for old messages encrypted before the migration.
   */
  const decryptSingleMessage = async (message: Message): Promise<Message> => {
    // Don't decrypt image or voice messages
    if (message.content_type !== 'text') {
      return message;
    }

    // Check if message appears to be encrypted or plain text
    const encryptedParts = message.encrypted_content.split(':');
    if (encryptedParts.length < 2) {
      // Plain text message (no colon separators)

      return { ...message, decrypted_content: message.encrypted_content };
    }

    try {
      // Get current user's private key
      const myPrivateKey = await getPrivateKey(user?.id || '');
      // Also get legacy key for backwards compatibility with old messages
      const myLegacyPrivateKey = await getLegacyPrivateKey(user?.id || '');

      if (!myPrivateKey && !myLegacyPrivateKey) {
        console.error('❌ No private keys found for decryption');
        return { ...message, decrypted_content: t('chat.unableToDecrypt') };
      }

      // Determine if I'm the sender or recipient (use ref for async subscription callbacks)
      const iAmSender = message.sender_profile_id === (currentProfileIdRef.current || currentProfileId);

      // Get the OTHER person's public key (the one we need for ECDH)
      // If I'm the sender, I need the recipient's public key
      // If I'm the recipient, I need the sender's public key
      const otherProfileId = iAmSender
        ? message.receiver_profile_id
        : message.sender_profile_id;

      const { data: otherProfile, error: otherError } = await supabase
        .from('profiles')
        .select('encryption_public_key')
        .eq('id', otherProfileId)
        .single();

      if (otherError || !otherProfile?.encryption_public_key) {
        console.error('❌ Other party public key not found');
        return { ...message, decrypted_content: t('chat.unableToDecrypt') };
      }

      // Try decrypting with current key first
      if (myPrivateKey) {
        try {
          const decryptedContent = await decryptMessage(
            message.encrypted_content,
            myPrivateKey,
            otherProfile.encryption_public_key
          );

          // Check if decryption succeeded (not error message)
          if (decryptedContent !== '[Unable to decrypt message]') {
            return { ...message, decrypted_content: decryptedContent };
          }
        } catch (error) {

        }
      }

      // Fallback: Try legacy key for old messages
      if (myLegacyPrivateKey) {
        try {

          const decryptedContent = await decryptMessage(
            message.encrypted_content,
            myLegacyPrivateKey,
            otherProfile.encryption_public_key
          );

          // Check if decryption succeeded
          if (decryptedContent !== '[Unable to decrypt message]') {

            return { ...message, decrypted_content: decryptedContent };
          }
        } catch (error) {

        }
      }

      // Both keys failed

      return { ...message, decrypted_content: t('chat.unableToDecrypt') };
    } catch (error) {
      console.error('Error decrypting message:', error);
      // Show placeholder instead of encrypted gibberish
      return { ...message, decrypted_content: t('chat.unableToDecrypt') };
    }
  };

  const handleSendMessage = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);


    // Check if match is still active
    if (matchStatus?.status !== 'active') {
      showToast({ type: 'info', title: t('chat.cannotSendMessage'), message: t('chat.conversationEnded') });
      return;
    }

    // Block sending if version check failed - ensures encryption compatibility
    if (!versionCheckPassed) {
      setShowUpdateModal(true);
      return;
    }

    if (!newMessage.trim() || !currentProfileId || !matchProfile || !user) {

      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);
    Keyboard.dismiss();

    // Validate message content before sending
    const messageValidation = validateContent(messageContent, {
      checkProfanity: true,
      checkContactInfo: true,
      fieldName: 'message',
    });

    if (!messageValidation.isValid) {
      setNewMessage(messageContent); // Restore message to input
      setSending(false);
      showToast({ type: 'error', title: t('chat.inappropriateContent'), message: messageValidation.error || t('toast.genericError') });
      return;
    }

    try {


      let encryptedContent = messageContent; // Default to plain text

      // PERFORMANCE: Use cached keys — don't fetch per message.
      // senderPrivateKey and otherPublicKey are already loaded at chat init.
      const senderPrivateKey = await getPrivateKey(user.id);
      const recipientPublicKey = matchProfile.encryption_public_key;

      if (senderPrivateKey && recipientPublicKey) {
        try {
          encryptedContent = await encryptMessage(
            messageContent,
            senderPrivateKey,
            recipientPublicKey
          );
        } catch (encryptError: any) {
          console.warn('⚠️ Encryption failed, sending as plain text:', encryptError.message);
          encryptedContent = messageContent;
        }
      }

      // Send message (encrypted if possible, plain text otherwise)
      const { data, error } = await supabase.from('messages').insert({
        match_id: matchId,
        sender_profile_id: currentProfileId,
        receiver_profile_id: matchProfile.id,
        encrypted_content: encryptedContent,
        content_type: 'text',
        ...(replyingTo ? { reply_to_message_id: replyingTo.id } : {}),
      }).select();



      if (error) {
        console.error('DATABASE ERROR:', error);
        throw error;
      }

      // Track message sent
      trackUserAction.messageSent(matchId as string, 'text');

      // Track first message in funnel if this is the first message
      if (messages.length === 0) {
        trackFunnel.firstMessageSent();

        // Prevent match expiration by setting first_message_sent_at
        await supabase
          .from('matches')
          .update({ first_message_sent_at: new Date().toISOString() })
          .eq('id', matchId);
      }



      // Add message to UI immediately (optimistic update)
      // Note: We already have the decrypted content (messageContent), so we don't need to decrypt
      if (data && data[0]) {

        // Replace encrypted content with plain text for display (since we just sent it)
        const displayMessage = {
          ...data[0],
          encrypted_content: messageContent,
          decrypted_content: messageContent,
          reply_to_message_id: replyingTo?.id || null,
          reply_to_message: replyingTo ? {
            id: replyingTo.id,
            encrypted_content: replyingTo.encrypted_content,
            sender_profile_id: replyingTo.sender_profile_id,
            content_type: replyingTo.content_type,
            decrypted_content: replyingTo.decrypted_content,
            media_url: replyingTo.media_url,
          } : null,
        } as Message;
        setMessages((prev) => {
          // Prevent duplicate if Realtime already delivered this message
          if (knownMessageIds.current.has(displayMessage.id)) return prev;
          knownMessageIds.current.add(displayMessage.id);
          return [displayMessage, ...prev];
        });

        // Clear reply state
        setReplyingTo(null);

        // Fetch link preview non-blocking if message contains URLs
        const urls = extractUrls(messageContent);
        if (urls.length > 0) {
          fetchAndStoreLinkPreview(data[0].id, urls[0]);
        }
      }

      // Push notification handled by database trigger (notify-new-message edge function)
    } catch (error: any) {
      console.error('Error sending message:', error);
      setNewMessage(messageContent); // Restore message on error
      showToast({ type: 'error', title: t('common.error'), message: t('chat.sendMessageError') });
    } finally {
      setSending(false);
    }
  };

  const handleImagePick = async () => {
    if (!currentProfileId || !matchProfile || !user) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        // Disable cropping on Android — the native canhub/cropper crashes with
        // FileNotFoundException on low-end devices with limited storage.
        // iOS uses its own stable UIImagePickerController so cropping is safe there.
        allowsEditing: Platform.OS === 'ios',
        aspect: [4, 3],
        quality: 0.8,
        exif: false, // Don't include EXIF data for privacy
      });

      if (!result.canceled && result.assets[0]) {
        const selectedUri = result.assets[0].uri;
        setSending(true);

        try {
          // Validate image before processing
          const validation = await validateImage(selectedUri);
          if (!validation.isValid) {
            showToast({ type: 'error', title: t('toast.invalidImage'), message: validation.error || t('chat.chatPhoto.selectDifferent') });
            setSending(false);
            return;
          }

          // Optimize image for chat (smaller size for faster sending)
          const { optimized } = await optimizeImage(selectedUri, {
            maxWidth: IMAGE_CONFIG.chat.maxWidth,
            maxHeight: IMAGE_CONFIG.chat.maxHeight,
            quality: IMAGE_CONFIG.chat.quality,
          });



          // Upload optimized image to Supabase Storage
          const fileName = `${matchId}_${Date.now()}.jpg`;
          const filePath = `chat-images/${fileName}`;

          // Convert to ArrayBuffer (pass original URI for re-optimization fallback)
          const arrayBuffer = await uriToArrayBuffer(optimized.uri, selectedUri);

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('chat-media')
            .upload(filePath, arrayBuffer, {
              contentType: 'image/jpeg',
              upsert: false,
            });

          if (uploadError) throw uploadError;

          // Store the storage path (buckets are private, URLs are signed on demand)
          const mediaStoragePath = filePath;

          // Send image message


          const { data: insertedMessage, error: messageError } = await supabase
            .from('messages')
            .insert({
              match_id: matchId,
              sender_profile_id: currentProfileId,
              receiver_profile_id: matchProfile.id,
              encrypted_content: t('chat.photo'),
              content_type: 'image',
              media_url: mediaStoragePath,
            })
            .select()
            .single();

          if (messageError) {
            console.error('❌ Message insert error:', messageError);
            throw messageError;
          }

          // Run NSFW moderation check on chat photos (non-blocking)
          try {
            // Generate signed URL for moderation (buckets are private)
            const { data: signedData } = await supabase.storage
              .from('chat-media')
              .createSignedUrl(filePath, 600);
            const signedUrl = signedData?.signedUrl || '';

            const { data: moderationResult } = await supabase.functions.invoke('moderate-photo', {
              body: {
                photo_url: signedUrl,
                profile_id: currentProfileId,
              },
            });

            if (moderationResult?.approved === false && moderationResult.reason === 'explicit_content') {
              // Delete the message and media
              await supabase.from('messages').delete().eq('id', insertedMessage?.id);
              await supabase.storage.from('chat-media').remove([filePath]);
              Alert.alert(t('chat.chatPhoto.rejectedTitle'), t('chat.chatPhoto.rejectedMessage'));
              return;
            }
          } catch (moderationError) {
            console.error('Chat photo moderation check failed:', moderationError);
          }

          // Add message to local state immediately with signed URL
          if (insertedMessage) {
            const signedMediaUrl = await getSignedUrl('chat-media', filePath);
            const displayMessage = { ...insertedMessage, media_url: signedMediaUrl || insertedMessage.media_url } as Message;

            setMessages((prev) => {
              const exists = prev.some(m => m.id === displayMessage.id);
              if (exists) return prev;
              return [displayMessage, ...prev];
            });
          }

          // Push notification handled by database trigger (notify-new-message edge function)
        } catch (uploadError: any) {
          console.error('Error uploading image:', uploadError);
          showToast({ type: 'error', title: t('common.error'), message: t('chat.sendPhotoError') });
        } finally {
          setSending(false);
        }
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      showToast({ type: 'error', title: t('common.error'), message: t('chat.pickPhotoError') });
    }
  };

  const handleVoiceRecordStart = async () => {
    // Premium feature gate
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }

    if (!currentProfileId || !matchProfile || !user) return;

    try {
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        showToast({ type: 'error', title: t('chat.permissionRequired'), message: t('chat.microphonePermission') });
        return;
      }

      // Switch to recording mode (enables microphone input on iOS)
      await setupAudio(true);

      // Start recording
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      });

      await recording.startAsync();
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);

      // Update duration every second
      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);

      // Auto-stop at 2 minutes - store ref for cleanup
      if (autoStopRecordingTimeoutRef.current) {
        clearTimeout(autoStopRecordingTimeoutRef.current);
      }
      autoStopRecordingTimeoutRef.current = setTimeout(() => {
        if (recordingRef.current) {
          handleVoiceRecordStop();
        }
      }, 120000);
    } catch (error: any) {
      console.error('Error starting recording:', error);
      showToast({ type: 'error', title: t('common.error'), message: t('chat.recordingError') });
    }
  };

  const handleVoiceRecordStop = async () => {
    if (!recordingRef.current || !isRecording) return;

    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      // Clear auto-stop timeout since we're stopping manually
      if (autoStopRecordingTimeoutRef.current) {
        clearTimeout(autoStopRecordingTimeoutRef.current);
        autoStopRecordingTimeoutRef.current = null;
      }

      setIsRecording(false);
      const duration = recordingDuration;
      setRecordingDuration(0);

      if (!uri) {
        showToast({ type: 'error', title: t('common.error'), message: t('toast.voiceRecordError') });
        return;
      }

      // Upload and send
      await handleVoiceSend(uri, duration);
    } catch (error: any) {
      console.error('Error stopping recording:', error);
      showToast({ type: 'error', title: t('common.error'), message: t('chat.stopRecordingError') });
    }
  };

  const handleVoiceRecordCancel = async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (error) {
        console.error('Error cancelling recording:', error);
      }
    }

    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    // Clear auto-stop timeout on cancel
    if (autoStopRecordingTimeoutRef.current) {
      clearTimeout(autoStopRecordingTimeoutRef.current);
      autoStopRecordingTimeoutRef.current = null;
    }

    setIsRecording(false);
    setRecordingDuration(0);
  };

  const handleVoiceSend = async (uri: string, duration: number) => {
    if (!currentProfileId || !matchProfile) return;

    setSending(true);

    try {
      // Upload voice file to Supabase Storage
      const fileName = `${matchId}_${Date.now()}.m4a`;
      const filePath = `chat-voice/${fileName}`;

      // Read file as ArrayBuffer
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, arrayBuffer, {
          contentType: 'audio/mp4',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Store the storage path (buckets are private, URLs are signed on demand)
      const mediaStoragePath = filePath;

      // Send voice message
      const { data: insertedVoice, error: messageError } = await supabase.from('messages').insert({
        match_id: matchId,
        sender_profile_id: currentProfileId,
        receiver_profile_id: matchProfile.id,
        encrypted_content: t('chat.voiceMessage'),
        content_type: 'voice',
        media_url: mediaStoragePath,
        voice_duration: duration,
      }).select().single();

      if (messageError) throw messageError;

      // Add to local state with signed URL
      if (insertedVoice) {
        const signedUrl = await getSignedUrl('chat-media', mediaStoragePath);
        const displayMessage = { ...insertedVoice, media_url: signedUrl || mediaStoragePath } as Message;
        setMessages((prev) => {
          const exists = prev.some(m => m.id === displayMessage.id);
          if (exists) return prev;
          return [displayMessage, ...prev];
        });
      }

      // Prevent match expiration if this is the first message
      if (messages.length === 0) {
        await supabase
          .from('matches')
          .update({ first_message_sent_at: new Date().toISOString() })
          .eq('id', matchId);
      }

      // Push notification handled by database trigger (notify-new-message edge function)
    } catch (error: any) {
      console.error('Error sending voice message:', error);
      if (error?.code === 'P0001' && error?.message?.includes('Premium subscription')) {
        Alert.alert(
          t('subscription.upgradeToPremium'),
          t('chat.premiumFeature.voiceMessagesMessage'),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('common.upgrade'), onPress: () => router.push('/settings/subscription') },
          ]
        );
      } else {
        showToast({ type: 'error', title: t('common.error'), message: t('chat.sendVoiceError') });
      }
    } finally {
      setSending(false);
    }
  };

  const handleVoicePlay = async (message: Message) => {
    if (!message.media_url) return;

    try {
      // Stop current sound if playing
      if (soundRef.current) {
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }

      // If already playing this message, stop
      if (playingVoiceId === message.id) {
        setPlayingVoiceId(null);
        return;
      }

      // Switch to playback mode (routes audio to main speaker instead of earpiece)
      await setupAudio(false);

      // Re-sign the URL in case it expired (cache will return instantly if still valid)
      const signedUrl = await getSignedUrl('chat-media', message.media_url) || message.media_url;

      // Load and play new sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: signedUrl },
        { shouldPlay: true },
        (status) => {
          if (status.isLoaded && status.didJustFinish) {
            setPlayingVoiceId(null);
          }
        }
      );

      soundRef.current = sound;
      setPlayingVoiceId(message.id);
    } catch (error: any) {
      console.error('Error playing voice message:', error);
      showToast({ type: 'error', title: t('common.error'), message: t('chat.playVoiceError') });
    }
  };

  const togglePhotoReveal = async () => {
    if (!currentProfileId || !matchProfile?.id || !matchId) {
      showToast({ type: 'error', title: t('common.error'), message: t('toast.photoRevealError') });
      return;
    }

    setRevealLoading(true);

    try {
      if (hasRevealedPhotos) {
        // Re-blur: Delete the reveal
        const { error } = await supabase
          .from('photo_reveals')
          .delete()
          .eq('revealer_profile_id', currentProfileId)
          .eq('revealed_to_profile_id', matchProfile.id);

        if (error) throw error;

        setHasRevealedPhotos(false);
        showToast({ type: 'info', title: t('toast.photosBlurred'), message: t('toast.photosBlurred') });
      } else {
        // Reveal: Insert new reveal
        const { error } = await supabase
          .from('photo_reveals')
          .insert({
            revealer_profile_id: currentProfileId,
            revealed_to_profile_id: matchProfile.id,
            match_id: matchId as string,
          });

        if (error) throw error;

        setHasRevealedPhotos(true);

        // Push notification handled by database trigger (notify-new-message edge function)

        showToast({ type: 'success', title: t('toast.photosRevealed'), message: t('toast.photosRevealed', { name: matchProfile.display_name }) });
      }
    } catch (error: any) {
      console.error('Error toggling photo reveal:', error);
      showToast({ type: 'error', title: t('common.error'), message: t('toast.photoRevealError') });
    } finally {
      setRevealLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!currentProfileId || !matchProfile) return;

    try {
      // Insert block record
      await supabase.from('blocks').insert({
        blocker_profile_id: currentProfileId,
        blocked_profile_id: matchProfile.id,
      });

      // Update match status to blocked
      await supabase
        .from('matches')
        .update({ status: 'blocked' })
        .eq('id', matchId);

      Alert.alert(t('chat.blocked'), t('chat.blockedConfirmation', { name: matchProfile.display_name }), [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error blocking user:', error);
      showToast({ type: 'error', title: t('common.error'), message: t('toast.blockError') });
    }
  };

  const handleReport = async (reason: string, description: string) => {
    if (!currentProfileId || !matchProfile) return;

    try {
      await supabase.from('reports').insert({
        reporter_profile_id: currentProfileId,
        reported_profile_id: matchProfile.id,
        reason,
        details: description,
        status: 'pending',
      });

      showToast({ type: 'success', title: t('toast.reportSubmitted'), message: t('toast.reportSubmitted') });
    } catch (error) {
      console.error('Error reporting user:', error);
      showToast({ type: 'error', title: t('common.error'), message: t('toast.reportError') });
    }
  };

  const handleDeleteMessage = async (message: Message) => {
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }

    if (message.sender_profile_id !== currentProfileId) {
      showToast({ type: 'error', title: t('chat.cannotDelete'), message: t('chat.cannotDeleteMessage') });
      return;
    }

    Alert.alert(
      t('chat.deleteMessage'),
      t('chat.deleteMessageConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('messages')
                .delete()
                .eq('id', message.id);

              if (error) throw error;

              // Remove from local state
              setMessages((prev) => prev.filter((m) => m.id !== message.id));
            } catch (error) {
              console.error('Error deleting message:', error);
              showToast({ type: 'error', title: t('common.error'), message: t('chat.deleteMessageError') });
            }
          },
        },
      ]
    );
  };

  const handleCopyMessage = async (message: Message) => {
    const textToCopy = message.decrypted_content || message.encrypted_content;
    await Clipboard.setStringAsync(textToCopy);
    showToast({ type: 'success', title: t('chat.messageCopied'), message: '' });
  };

  // Get reply preview text — used by both renderMessage and reply preview bar
  const getReplyPreviewText = (replyMsg: Message['reply_to_message']) => {
    if (!replyMsg) return '';
    if (replyMsg.content_type === 'image') return t('chat.photo');
    if (replyMsg.content_type === 'voice') return t('chat.voiceMessage');
    const text = replyMsg.decrypted_content;
    if (text && text.trim() && text !== '\u00A0') return text;
    const enc = replyMsg.encrypted_content;
    if (enc && !enc.includes(':')) return enc;
    return '...';
  };

  const handleReplyTo = (message: Message) => {
    setReplyingTo(message);
    textInputRef.current?.focus();
  };

  const scrollToMessage = (messageId: string) => {
    const index = messages.findIndex(m => m.id === messageId);
    if (index !== -1) {
      flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      // Briefly highlight the message
      setExpandedTimestampId(messageId);
      setTimeout(() => setExpandedTimestampId(null), 2000);
    }
  };

  const handleMessageLongPress = (message: Message, event?: any) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const isMine = message.sender_profile_id === currentProfileId;
    const isTextMessage = message.content_type === 'text';

    const buttons: any[] = [];

    // Reply (free for all)
    buttons.push({
      text: t('chat.reply'),
      onPress: () => handleReplyTo(message),
    });

    // Copy (only for text messages, free for all)
    if (isTextMessage) {
      buttons.push({
        text: t('chat.copyMessage'),
        onPress: () => handleCopyMessage(message),
      });
    }

    if (isMine) {
      // Delete (premium)
      buttons.push({
        text: t('chat.deleteMessage'),
        style: 'destructive' as const,
        onPress: () => {
          if (!isPremium) {
            setShowPaywall(true);
            return;
          }
          handleDeleteMessage(message);
        },
      });
    } else {
      // React (premium)
      buttons.push({
        text: t('chat.react'),
        onPress: () => {
          if (!isPremium) {
            Alert.alert(
              t('chat.premiumFeature.featureTitle'),
              t('chat.premiumFeature.reactionsMessage'),
              [
                { text: t('common.maybeLater'), style: 'cancel' },
                {
                  text: t('common.upgrade'),
                  onPress: () => router.push('/settings/subscription'),
                },
              ]
            );
            return;
          }
          setReactionTargetMessage(message);
          setShowReactionPicker(true);
        },
      });
    }

    buttons.push({ text: t('common.cancel'), style: 'cancel' as const });

    Alert.alert(t('chat.messageOptions'), undefined, buttons, { cancelable: true });
  };

  // Handle adding/removing a reaction to a message
  const handleReaction = async (emoji: string) => {
    if (!reactionTargetMessage || !currentProfileId) return;

    try {
      // Check if user already has this reaction on this message
      const existingReaction = reactionTargetMessage.reactions?.find(
        r => r.profile_id === currentProfileId && r.emoji === emoji
      );

      if (existingReaction) {
        // Remove reaction (toggle off)
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existingReaction.id);

        if (error) throw error;

        // Update local state
        setMessages(prev => prev.map(msg => {
          if (msg.id === reactionTargetMessage.id) {
            return {
              ...msg,
              reactions: msg.reactions?.filter(r => r.id !== existingReaction.id)
            };
          }
          return msg;
        }));
      } else {
        // Check if user has a different reaction, if so update it
        const userExistingReaction = reactionTargetMessage.reactions?.find(
          r => r.profile_id === currentProfileId
        );

        if (userExistingReaction) {
          // Update existing reaction
          const { data, error } = await supabase
            .from('message_reactions')
            .update({ emoji })
            .eq('id', userExistingReaction.id)
            .select()
            .single();

          if (error) throw error;

          // Update local state
          setMessages(prev => prev.map(msg => {
            if (msg.id === reactionTargetMessage.id) {
              return {
                ...msg,
                reactions: msg.reactions?.map(r =>
                  r.id === userExistingReaction.id ? { ...r, emoji } : r
                )
              };
            }
            return msg;
          }));
        } else {
          // Add new reaction
          const { data, error } = await supabase
            .from('message_reactions')
            .insert({
              message_id: reactionTargetMessage.id,
              profile_id: currentProfileId,
              emoji,
            })
            .select()
            .single();

          if (error) throw error;

          // Update local state
          setMessages(prev => prev.map(msg => {
            if (msg.id === reactionTargetMessage.id) {
              return {
                ...msg,
                reactions: [...(msg.reactions || []), data as MessageReaction]
              };
            }
            return msg;
          }));

          // Send push notification to the message sender (the person who wrote the message)
          // Only send if the message was sent by the other person (not reacting to own message)
          if (reactionTargetMessage.sender_profile_id !== currentProfileId) {
            sendReactionNotification(
              reactionTargetMessage.sender_profile_id,
              currentProfileName || t('common.someone'),
              emoji,
              matchId as string
            );
          }
        }
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
      showToast({ type: 'error', title: t('common.error'), message: t('toast.reactionError') });
    } finally {
      setShowReactionPicker(false);
      setShowFullEmojiPicker(false);
      setReactionTargetMessage(null);
    }
  };

  // Handle emoji selection from full picker
  const handleFullEmojiSelect = (emojiObject: { emoji: string }) => {
    handleReaction(emojiObject.emoji);
  };

  // Open full emoji picker
  const openFullEmojiPicker = () => {
    setShowReactionPicker(false);
    setShowFullEmojiPicker(true);
  };

  const handleSelectMessage = (message: string) => {
    setNewMessage(message);
    setShowIntroMessages(false);
  };

  // Fetch link preview via edge function and update message in DB + local state
  const fetchAndStoreLinkPreview = async (messageId: string, url: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('fetch-link-preview', {
        body: { url },
      });
      if (error || !data?.title) return;

      const preview: LinkPreviewData = {
        url: data.url || url,
        title: data.title,
        description: data.description || undefined,
        image: data.image || undefined,
      };

      // Update in database
      await supabase
        .from('messages')
        .update({ link_preview: preview })
        .eq('id', messageId);

      // Update local state
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, link_preview: preview } : m))
      );
    } catch {
      // Non-critical, silently fail
    }
  };

  // Search within conversation
  const handleSearchToggle = () => {
    if (isSearching) {
      // Clear search state in a single batch to avoid intermediate re-renders
      // that can cause removeClippedSubviews to hide all messages on Android
      setSearchQuery('');
      setSearchResultIds([]);
      setCurrentSearchIndex(0);
      // Delay closing search UI to let the FlatList settle
      setTimeout(() => setIsSearching(false), 50);
    } else {
      setIsSearching(true);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  };

  const handleSearchQueryChange = (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResultIds([]);
      setCurrentSearchIndex(0);
      return;
    }
    // Use word boundary matching: match whole words only
    // Escape regex special chars in query, then wrap with \b (word boundary)
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const wordRegex = new RegExp(`\\b${escaped}\\b`, 'i');
    const results = messages
      .filter((m) => {
        const text = m.decrypted_content || m.encrypted_content;
        return wordRegex.test(text);
      })
      .map((m) => m.id);
    setSearchResultIds(results);
    setCurrentSearchIndex(0);
    // Scroll to first result
    if (results.length > 0) {
      scrollToMessage(results[0]);
    }
  };

  const handleSearchNext = () => {
    if (searchResultIds.length === 0) return;
    const next = (currentSearchIndex + 1) % searchResultIds.length;
    setCurrentSearchIndex(next);
    scrollToMessage(searchResultIds[next]);
  };

  const handleSearchPrev = () => {
    if (searchResultIds.length === 0) return;
    const prev = (currentSearchIndex - 1 + searchResultIds.length) % searchResultIds.length;
    setCurrentSearchIndex(prev);
    scrollToMessage(searchResultIds[prev]);
  };

  const showActionMenu = () => {
    if (!matchProfile) return;
    Alert.alert(
      matchProfile.display_name,
      t('chat.messageActions.chooseAction'),
      [
        {
          text: t('chat.messageActions.report'),
          onPress: () => setShowReportModal(true),
          style: 'destructive',
        },
        {
          text: t('chat.messageActions.block'),
          onPress: () => setShowBlockModal(true),
          style: 'destructive',
        },
        {
          text: t('common.cancel'),
          style: 'cancel',
        },
      ]
    );
  };

  const getTimeDisplay = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return t('chat.timeAgo.justNow');
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;

    // Format as time if today, date if older
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getFullTimestamp = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const messageKeyExtractor = useCallback((item: Message) => item.id, []);

  const handleMessagePress = useCallback((messageId: string) => {
    // Toggle full timestamp display
    setExpandedTimestampId(prev => prev === messageId ? null : messageId);
  }, []);

  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    if (!item) {
      console.error('NULL ITEM in renderMessage');
      return null;
    }

    const isMine = item.sender_profile_id === currentProfileId;
    const isTimestampExpanded = expandedTimestampId === item.id;
    const isSearchHighlighted = searchResultIds.includes(item.id);
    const isCurrentSearchResult = searchResultIds[currentSearchIndex] === item.id;

    // Resolve reply sender name
    const getReplyAuthorName = (replyMsg: Message['reply_to_message']) => {
      if (!replyMsg) return '';
      if (replyMsg.sender_profile_id === currentProfileId) return t('chat.you');
      return matchProfile?.display_name || '';
    };

    // getReplyPreviewText is defined at component level (used by both renderMessage and reply preview bar)

    const quotedReplyBlock = item.reply_to_message ? (
      <TouchableOpacity
        onPress={() => scrollToMessage(item.reply_to_message!.id)}
        activeOpacity={0.7}
        style={[styles.quotedReply, isMine ? styles.quotedReplyMine : { backgroundColor: isDarkColorScheme ? '#2A2433' : '#EDE8F3' }]}
      >
        <View style={[styles.quotedReplyAccent, isMine && styles.quotedReplyAccentMine]} />
        <View style={styles.quotedReplyBody}>
          <Text style={[styles.quotedReplyAuthor, isMine && styles.quotedReplyAuthorMine]}>
            {getReplyAuthorName(item.reply_to_message)}
          </Text>
          <Text style={[styles.quotedReplyText, isMine && styles.quotedReplyTextMine]} numberOfLines={2}>
            {getReplyPreviewText(item.reply_to_message)}
          </Text>
        </View>
        {item.reply_to_message.content_type === 'image' && item.reply_to_message.media_url && (
          <Image
            source={{ uri: item.reply_to_message.media_url }}
            style={styles.quotedReplyImage}
            resizeMode="cover"
          />
        )}
      </TouchableOpacity>
    ) : null;

    const messageBubbleContent = (
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => handleMessagePress(item.id)}
        onLongPress={() => handleMessageLongPress(item)}
        delayLongPress={400}
      >
        {/* Expanded timestamp shown above the message */}
        {isTimestampExpanded && (
          <View style={[styles.expandedTimestampContainer, isMine && styles.expandedTimestampContainerMine]}>
            <Text style={styles.expandedTimestampText}>
              {getFullTimestamp(item.created_at)}
            </Text>
          </View>
        )}
        <View
          style={[styles.messageRow, isMine && styles.messageRowMine]}
        >
        {/* Message Bubble */}
        <View style={[
          styles.messageBubble,
          isMine ? styles.messageBubbleMine : styles.messageBubbleTheirs,
          isSearchHighlighted && styles.searchHighlightedBubble,
          isCurrentSearchResult && styles.searchCurrentBubble,
        ]}>
          {item.content_type === 'image' && item.media_url ? (
            // Image message
            <TouchableOpacity
              onPress={async () => {
                if (!item.media_url) return;
                // Re-sign in case the URL expired (cache returns instantly if still valid)
                const signedUrl = await getSignedUrl('chat-media', item.media_url) || item.media_url;
                setViewingImageUrl(signedUrl);
              }}
              activeOpacity={0.9}
            >
              {isMine ? (
                <LinearGradient
                  colors={['#A08AB7', '#CDC2E5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.imageMessageGradient}
                >
                  <Image
                    source={{ uri: item.media_url }}
                    style={styles.messageImage}
                    resizeMode="cover"
                  />
                </LinearGradient>
              ) : (
                <Image
                  source={{ uri: item.media_url }}
                  style={styles.messageImage}
                  resizeMode="cover"
                />
              )}
              <View style={[styles.messageFooter, styles.imageMessageFooter]}>
                <Text style={[styles.messageTime, isMine && styles.messageTimeMine, styles.imageMessageTime]}>
                  {getTimeDisplay(item.created_at)}
                </Text>
                {isMine && (
                  isPremium ? (
                    <MaterialCommunityIcons
                      name={item.read_at ? "check-all" : "check"}
                      size={12}
                      color={item.read_at ? "#3B82F6" : "rgba(0,0,0,0.3)"}
                      style={styles.readReceipt}
                    />
                  ) : (
                    <TouchableOpacity onPress={() => setShowPaywall(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <MaterialCommunityIcons name="check" size={12} color="rgba(0,0,0,0.2)" style={styles.readReceipt} />
                    </TouchableOpacity>
                  )
                )}
              </View>
            </TouchableOpacity>
          ) : item.content_type === 'voice' && item.media_url ? (
            // Voice message
            <TouchableOpacity onPress={() => handleVoicePlay(item)} activeOpacity={0.7}>
              {isMine ? (
                <LinearGradient
                  colors={['#A08AB7', '#CDC2E5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.voiceMessageBubble}
                >
                  {quotedReplyBlock}
                  <View style={styles.voiceMessageContent}>
                    <MaterialCommunityIcons
                      name={playingVoiceId === item.id ? "pause-circle" : "play-circle"}
                      size={32}
                      color="white"
                    />
                    <View style={styles.voiceMessageInfo}>
                      <View style={styles.voiceWaveform}>
                        {voiceWaveHeights.map((h, i) => (
                          <View
                            key={i}
                            style={[
                              styles.voiceWaveBar,
                              {
                                height: h,
                                backgroundColor: 'rgba(255,255,255,0.6)',
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <View style={styles.voiceFooterRow}>
                        <Text style={styles.voiceDuration}>
                          {item.voice_duration ? `${Math.floor(item.voice_duration / 60)}:${String(item.voice_duration % 60).padStart(2, '0')}` : '0:00'}
                        </Text>
                        <View style={styles.inlineTimeStamp}>
                          <Text style={[styles.messageTime, styles.messageTimeMine, { marginTop: 0 }]}>
                            {getTimeDisplay(item.created_at)}
                          </Text>
                          {isPremium ? (
                            <MaterialCommunityIcons
                              name={item.read_at ? "check-all" : "check"}
                              size={12}
                              color={item.read_at ? "#3B82F6" : "rgba(0,0,0,0.3)"}
                              style={styles.readReceipt}
                            />
                          ) : (
                            <TouchableOpacity onPress={() => setShowPaywall(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                              <MaterialCommunityIcons name="check" size={12} color="rgba(0,0,0,0.2)" style={styles.readReceipt} />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    </View>
                  </View>
                </LinearGradient>
              ) : (
                <View style={styles.voiceMessageBubbleTheirs}>
                  {quotedReplyBlock}
                  <View style={styles.voiceMessageContent}>
                    <MaterialCommunityIcons
                      name={playingVoiceId === item.id ? "pause-circle" : "play-circle"}
                      size={32}
                      color="#A08AB7"
                    />
                    <View style={styles.voiceMessageInfo}>
                      <View style={styles.voiceWaveform}>
                        {voiceWaveHeights.map((h, i) => (
                          <View
                            key={i}
                            style={[
                              styles.voiceWaveBar,
                              {
                                height: h,
                                backgroundColor: '#D1D5DB',
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <View style={styles.voiceFooterRow}>
                        <Text style={styles.voiceDurationTheirs}>
                          {item.voice_duration ? `${Math.floor(item.voice_duration / 60)}:${String(item.voice_duration % 60).padStart(2, '0')}` : '0:00'}
                        </Text>
                        <Text style={[styles.messageTime, { marginTop: 0 }]}>
                          {getTimeDisplay(item.created_at)}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            // Text message
            <>
              {isMine ? (
                <LinearGradient
                  colors={['#A08AB7', '#CDC2E5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.messageBubbleGradient}
                >
                  {quotedReplyBlock}
                  {/* Link Preview */}
                  {item.link_preview && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(item.link_preview!.url)}
                      activeOpacity={0.8}
                      style={styles.linkPreviewMine}
                    >
                      {item.link_preview.image && (
                        <Image source={{ uri: item.link_preview.image }} style={styles.linkPreviewImage} resizeMode="cover" />
                      )}
                      <View style={styles.linkPreviewTextContainer}>
                        <Text style={styles.linkPreviewTitleMine} numberOfLines={2}>{item.link_preview.title}</Text>
                        {item.link_preview.description && (
                          <Text style={styles.linkPreviewDescMine} numberOfLines={2}>{item.link_preview.description}</Text>
                        )}
                        <Text style={styles.linkPreviewHostMine} numberOfLines={1}>
                          {new URL(item.link_preview.url).hostname}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.messageTextMine}>{item.decrypted_content || item.encrypted_content}</Text>
                  <View style={styles.bubbleFooter}>
                    <View style={styles.inlineTimeStamp}>
                      <Text style={[styles.messageTime, styles.messageTimeMine]}>
                        {getTimeDisplay(item.created_at)}
                      </Text>
                      {isPremium ? (
                        <MaterialCommunityIcons
                          name={item.read_at ? "check-all" : "check"}
                          size={14}
                          color={item.read_at ? "#3B82F6" : "rgba(0,0,0,0.3)"}
                          style={styles.readReceipt}
                        />
                      ) : (
                        <TouchableOpacity onPress={() => setShowPaywall(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <MaterialCommunityIcons name="check" size={14} color="rgba(0,0,0,0.2)" style={styles.readReceipt} />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </LinearGradient>
              ) : (
                <>
                  {quotedReplyBlock}
                  {/* Link Preview */}
                  {item.link_preview && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(item.link_preview!.url)}
                      activeOpacity={0.8}
                      style={[styles.linkPreviewTheirs, { borderColor: colors.border }]}
                    >
                      {item.link_preview.image && (
                        <Image source={{ uri: item.link_preview.image }} style={styles.linkPreviewImage} resizeMode="cover" />
                      )}
                      <View style={styles.linkPreviewTextContainer}>
                        <Text style={styles.linkPreviewTitleTheirs} numberOfLines={2}>{item.link_preview.title}</Text>
                        {item.link_preview.description && (
                          <Text style={styles.linkPreviewDescTheirs} numberOfLines={2}>{item.link_preview.description}</Text>
                        )}
                        <Text style={styles.linkPreviewHostTheirs} numberOfLines={1}>
                          {new URL(item.link_preview.url).hostname}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}
                  <Text style={styles.messageTextTheirs}>{item.decrypted_content || item.encrypted_content}</Text>
                  <View style={styles.bubbleFooter}>
                    <View style={styles.inlineTimeStamp}>
                      <Text style={styles.messageTime}>
                        {getTimeDisplay(item.created_at)}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </>
          )}
        </View>

        {/* Reactions Display */}
        {item.reactions && item.reactions.length > 0 && (
          <View style={[
            styles.reactionsContainer,
            isMine ? styles.reactionsContainerMine : styles.reactionsContainerTheirs
          ]}>
            {item.reactions.map((reaction, idx) => (
              <View key={reaction.id} style={styles.reactionBubble}>
                <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
      </TouchableOpacity>
    );

    return (
      <SwipeableMessageBubble onReply={() => handleReplyTo(item)}>
        {messageBubbleContent}
      </SwipeableMessageBubble>
    );
  }, [currentProfileId, expandedTimestampId, searchResultIds, currentSearchIndex, matchProfile, colors, isDarkColorScheme, isPremium, playingVoiceId, voiceWaveHeights, handleMessagePress, t]);

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <ChatSkeleton />
      </View>
    );
  }

  // Show unmatched/blocked screen if match is not active
  if (matchStatus && matchStatus.status !== 'active') {
    const isUnmatched = matchStatus.status === 'unmatched';
    const isBlocked = matchStatus.status === 'blocked';
    const wasUnmatchedByMe = matchStatus.unmatched_by === currentProfileId;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Header with back button */}
        <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#A08AB7" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            {isBlocked ? t('chat.blocked') : t('chat.conversationEnded')}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Centered message */}
        <View style={styles.unmatchedContainer}>
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'timing', duration: 300 }}
          >
            <View style={styles.unmatchedIconContainer}>
              <MaterialCommunityIcons
                name={isBlocked ? "cancel" : "heart-broken"}
                size={64}
                color="#9CA3AF"
              />
            </View>

            <Text style={[styles.unmatchedTitle, { color: colors.foreground }]}>
              {isBlocked ? t('chat.thisUserIsBlocked') : t('chat.thisConversationHasEnded')}
            </Text>

            <Text style={[styles.unmatchedMessage, { color: colors.mutedForeground }]}>
              {isBlocked
                ? t('chat.blockedUserMessage')
                : isUnmatched && wasUnmatchedByMe
                  ? t('chat.youUnmatchedMessage')
                  : t('chat.matchUnmatchedMessage')
              }
            </Text>

            {isUnmatched && (
              <Text style={[styles.unmatchedSubtext, { color: colors.mutedForeground }]}>
                {t('chat.messagesPreservedMessage')}
              </Text>
            )}

            <TouchableOpacity
              style={styles.unmatchedButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={styles.unmatchedButtonText}>{t('chat.backToMatches')}</Text>
            </TouchableOpacity>
          </MotiView>
        </View>
      </View>
    );
  }

  if (!matchProfile) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#A08AB7" />
        <Text style={{ marginTop: 16, color: colors.mutedForeground }}>{t('chat.loading')}</Text>
      </View>
    );
  }

  // In landscape mode on Android, navigation bar is on the right side
  // Use right inset to prevent message bubbles from being cut off
  const rightSafeArea = isLandscape ? Math.max(insets.right, Platform.OS === 'android' ? 48 : 0) : 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Dynamic Watermark Overlay for chat */}
      {watermarkReady && matchProfile && (
        <DynamicWatermark
          userId={matchProfile.id}
          viewerUserId={viewerUserId}
          visible={true}
        />
      )}

      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#A08AB7" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerProfile}
          onPress={() => router.push(`/profile/${matchProfile?.id}`)}
        >
          <View style={{ position: 'relative' }}>
            <SafeBlurImage
              source={{ uri: matchPhotoUri }}
              style={styles.headerAvatar}
              blurRadius={blurRadius}
              onLoad={onImageLoad}
              onError={onImageError}
            />
          </View>
          <View style={styles.headerInfo}>
            <View style={styles.headerNameRow}>
              <Text style={[styles.headerName, { color: colors.foreground }]}>{matchProfile?.display_name}</Text>
              {(matchProfile?.photo_verified || matchProfile?.is_verified) && (
                <MaterialCommunityIcons name="check-decagram" size={16} color="#A08AB7" />
              )}
            </View>
            <View style={styles.encryptionRow}>
              {/* Typing indicator or online status */}
              {isOtherUserTyping && isPremium ? (
                <>
                  <View style={styles.typingDots}>
                    <MotiView
                      from={{ opacity: 0.4 }}
                      animate={{ opacity: 1 }}
                      transition={{ type: 'timing', duration: 400, loop: true }}
                      style={styles.typingDot}
                    />
                    <MotiView
                      from={{ opacity: 0.4 }}
                      animate={{ opacity: 1 }}
                      transition={{ type: 'timing', duration: 400, delay: 150, loop: true }}
                      style={styles.typingDot}
                    />
                    <MotiView
                      from={{ opacity: 0.4 }}
                      animate={{ opacity: 1 }}
                      transition={{ type: 'timing', duration: 400, delay: 300, loop: true }}
                      style={styles.typingDot}
                    />
                  </View>
                  <Text style={[styles.typingText, { color: '#A08AB7' }]}>
                    {t('chat.typing')}
                  </Text>
                </>
              ) : (
                <>
                  {/* Online status indicator */}
                  {isOnline(matchProfile?.last_active_at || null) && !matchProfile?.hide_last_active && (
                    <View style={styles.onlineDot} />
                  )}
                  <Text style={[styles.encryptionText, { color: colors.mutedForeground }]}>
                    {getLastActiveText(matchProfile?.last_active_at || null, matchProfile?.hide_last_active) || t('chat.secureMessaging')}
                  </Text>
                </>
              )}
            </View>
          </View>
        </TouchableOpacity>

        <View style={styles.headerRight}>
          {/* Search button */}
          <TouchableOpacity
            onPress={handleSearchToggle}
            style={[styles.revealButton, { backgroundColor: isDarkColorScheme ? '#2D2D30' : '#F5F2F7' }]}
          >
            <MaterialCommunityIcons
              name={isSearching ? "close" : "magnify"}
              size={22}
              color="#A08AB7"
            />
          </TouchableOpacity>

          {/* Photo Reveal Button - Only show if current user has photo blur enabled */}
          {currentUserPhotoBlur && (
            <TouchableOpacity
              onPress={togglePhotoReveal}
              disabled={revealLoading}
              style={[styles.revealButton, { backgroundColor: isDarkColorScheme ? '#2D2D30' : '#F5F2F7' }]}
            >
              {revealLoading ? (
                <ActivityIndicator size="small" color="#A08AB7" />
              ) : (
                <MaterialCommunityIcons
                  name={hasRevealedPhotos ? "eye-off" : "eye"}
                  size={24}
                  color={hasRevealedPhotos ? "#A08AB7" : "#D1D5DB"}
                />
              )}
            </TouchableOpacity>
          )}
          <ModerationMenu
            profileId={matchProfile?.id || ''}
            profileName={matchProfile?.display_name || ''}
            matchId={matchId as string}
            currentProfileId={currentProfileId || ''}
            onBlock={() => router.back()}
            onUnmatch={() => router.back()}
          />
        </View>
      </View>

      {/* Premium Upsell Banner — swipe to dismiss */}
      {!isPremium && !premiumBannerDismissed && messages.length >= 3 && (
        <ReanimatedSwipeable
          friction={2}
          leftThreshold={60}
          rightThreshold={60}
          overshootLeft={false}
          overshootRight={false}
          onSwipeableOpen={handleDismissPremiumBanner}
          renderLeftActions={() => (
            <View style={styles.bannerSwipeHint}>
              <MaterialCommunityIcons name="close" size={18} color="#9CA3AF" />
            </View>
          )}
          renderRightActions={() => (
            <View style={styles.bannerSwipeHint}>
              <MaterialCommunityIcons name="close" size={18} color="#9CA3AF" />
            </View>
          )}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setShowPaywall(true)}
            style={styles.premiumBanner}
          >
            <LinearGradient
              colors={['#A08AB7', '#CDC2E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.premiumBannerGradient}
            >
              <View style={styles.premiumBannerContent}>
                <MaterialCommunityIcons name="crown" size={20} color="#FFD700" />
                <Text style={styles.premiumBannerText}>
                  {t('chat.unlockFeatures')}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(255,255,255,0.8)" />
            </LinearGradient>
          </TouchableOpacity>
        </ReanimatedSwipeable>
      )}

      {/* Review Prompt Banner */}
      {matchProfile && (
        <ReviewPromptBanner
          onReviewPress={(prompt) => {
            // Open review modal when user taps review prompt
            const revieweeId = prompt.profile1_id === currentProfileId ? prompt.profile2_id : prompt.profile1_id;
            setPendingReviewData({
              matchId: prompt.match_id,
              revieweeId,
              revieweeName: prompt.reviewee_name || matchProfile.display_name,
            });
            setShowReviewModal(true);
          }}
        />
      )}

      {/* Search Bar */}
      {isSearching && (
        <View style={[styles.searchBar, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={handleSearchToggle} style={styles.searchBackButton}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <View style={[styles.searchInputWrapper, { backgroundColor: isDarkColorScheme ? '#2D2D30' : '#F3F4F6' }]}>
            <MaterialCommunityIcons name="magnify" size={18} color={colors.mutedForeground} />
            <TextInput
              ref={searchInputRef}
              style={[styles.searchInput, { color: colors.foreground }]}
              placeholder={t('chat.searchMessages')}
              placeholderTextColor={colors.mutedForeground}
              value={searchQuery}
              onChangeText={handleSearchQueryChange}
              autoFocus
              returnKeyType="search"
            />
          </View>
          {searchResultIds.length > 0 && (
            <View style={styles.searchNav}>
              <Text style={[styles.searchCount, { color: colors.mutedForeground }]}>
                {currentSearchIndex + 1}/{searchResultIds.length}
              </Text>
              <TouchableOpacity onPress={handleSearchPrev} style={styles.searchNavButton}>
                <MaterialCommunityIcons name="chevron-up" size={22} color="#A08AB7" />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSearchNext} style={styles.searchNavButton}>
                <MaterialCommunityIcons name="chevron-down" size={22} color="#A08AB7" />
              </TouchableOpacity>
            </View>
          )}
          {searchQuery.length >= 2 && searchResultIds.length === 0 && (
            <Text style={[styles.searchCount, { color: colors.mutedForeground }]}>
              {t('chat.noResults')}
            </Text>
          )}
        </View>
      )}

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={messageKeyExtractor}
        inverted={true}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.messagesList, rightSafeArea > 0 && { paddingRight: 12 + rightSafeArea }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={20}
        maxToRenderPerBatch={10}
        windowSize={11}
        removeClippedSubviews={Platform.OS === 'ios'}
        updateCellsBatchingPeriod={50}
        ListHeaderComponent={isOtherUserTyping && isPremium ? (
          <View style={styles.typingBubbleContainer}>
            <View style={[styles.messageBubble, styles.messageBubbleTheirs, styles.typingBubble]}>
              <View style={styles.typingBubbleDots}>
                <MotiView
                  from={{ opacity: 0.3, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'timing', duration: 500, loop: true }}
                  style={styles.typingBubbleDot}
                />
                <MotiView
                  from={{ opacity: 0.3, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'timing', duration: 500, delay: 150, loop: true }}
                  style={styles.typingBubbleDot}
                />
                <MotiView
                  from={{ opacity: 0.3, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'timing', duration: 500, delay: 300, loop: true }}
                  style={styles.typingBubbleDot}
                />
              </View>
            </View>
          </View>
        ) : null}
        onScrollToIndexFailed={(info) => {
          // Fallback: scroll to closest visible offset then retry
          flatListRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true });
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({ index: info.index, animated: true, viewPosition: 0.5 });
          }, 200);
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#A08AB7"
            colors={['#A08AB7']}
          />
        }
        ListFooterComponent={likeIntro ? (
          <MotiView
            from={{ opacity: 0, translateY: 10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 400 }}
            style={[styles.likeIntroCard, { backgroundColor: isDarkColorScheme ? '#2A2235' : '#F8F5FB' }]}
          >
            <Text style={[styles.likeIntroLabel, { color: colors.mutedForeground }]}>
              {likeIntro.senderId === currentProfileId
                ? (likeIntro.likedContent?.type === 'prompt'
                    ? t('chat.youLikedPrompt', { name: matchProfile?.display_name })
                    : likeIntro.likedContent?.type === 'photo'
                      ? t('chat.youLikedPhoto', { name: matchProfile?.display_name })
                      : t('chat.youLikedProfile', { name: matchProfile?.display_name }))
                : (likeIntro.likedContent?.type === 'prompt'
                    ? t('chat.theyLikedPrompt', { name: likeIntro.senderName })
                    : likeIntro.likedContent?.type === 'photo'
                      ? t('chat.theyLikedPhoto', { name: likeIntro.senderName })
                      : t('chat.theyLikedProfile', { name: likeIntro.senderName }))}
            </Text>

            {likeIntro.likedContent?.type === 'prompt' && likeIntro.likedContent.prompt && (
              <View style={[styles.likeIntroPromptCard, { backgroundColor: isDarkColorScheme ? '#1E1A26' : '#FFFFFF' }]}>
                <View style={styles.likeIntroPromptBorder} />
                <View style={styles.likeIntroPromptContent}>
                  <Text style={[styles.likeIntroPromptQuestion, { color: colors.mutedForeground }]}>
                    {likeIntro.likedContent.prompt}
                  </Text>
                  {likeIntro.likedContent.answer && (
                    <Text style={[styles.likeIntroPromptAnswer, { color: colors.foreground }]}>
                      {likeIntro.likedContent.answer}
                    </Text>
                  )}
                </View>
              </View>
            )}

            {likeIntro.likedContent?.type === 'photo' && likeIntro.photoUrl && (
              <Image
                source={{ uri: likeIntro.photoUrl }}
                style={styles.likeIntroPhoto}
                resizeMode="cover"
              />
            )}

            {likeIntro.message && (
              <View style={styles.likeIntroMessageRow}>
                <MaterialCommunityIcons name="comment-text-outline" size={16} color="#A08AB7" />
                <Text style={[styles.likeIntroMessage, { color: colors.foreground }]}>
                  "{likeIntro.message}"
                </Text>
              </View>
            )}

            <Text style={[styles.likeIntroTime, { color: colors.mutedForeground }]}>
              {new Date(likeIntro.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </Text>
          </MotiView>
        ) : null}
        ListEmptyComponent={
          likeIntro ? null : (
            <View style={styles.emptyContainer}>
              <MotiView
                from={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring' }}
              >
                <View style={styles.emptyIconContainer}>
                  <LinearGradient colors={['#A08AB7', '#CDC2E5']} style={styles.emptyIcon}>
                    <MaterialCommunityIcons name="message-text-outline" size={40} color="white" />
                  </LinearGradient>
                </View>
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{t('chat.sayHello')}</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  {t('chat.youMatchedWith', { name: matchProfile?.display_name })} {'\n'}
                  {t('chat.startConversation')}
                </Text>
              </MotiView>
            </View>
          )
        }
      />

      {/* Intro Messages */}
      {isPremium && (
        <IntroMessages
          visible={showIntroMessages}
          matchName={matchProfile?.display_name || ''}
          compatibilityScore={matchProfile?.compatibility_score}
          distance={matchProfile?.distance}
          city={matchProfile?.location_city}
          onSelectMessage={handleSelectMessage}
          onClose={() => setShowIntroMessages(false)}
        />
      )}

      {/* Reply Preview Bar */}
      {replyingTo && (
        <View style={[styles.replyPreviewBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <View style={styles.replyPreviewBorder} />
          <View style={styles.replyPreviewContent}>
            <Text style={[styles.replyPreviewAuthor, { color: '#A08AB7' }]}>
              {replyingTo.sender_profile_id === currentProfileId ? t('chat.you') : matchProfile?.display_name}
            </Text>
            <Text style={[styles.replyPreviewText, { color: colors.mutedForeground }]} numberOfLines={1}>
              {getReplyPreviewText({
                id: replyingTo.id,
                encrypted_content: replyingTo.encrypted_content,
                sender_profile_id: replyingTo.sender_profile_id,
                content_type: replyingTo.content_type,
                decrypted_content: replyingTo.decrypted_content,
                media_url: replyingTo.media_url,
              })}
            </Text>
          </View>
          {replyingTo.content_type === 'image' && replyingTo.media_url && (
            <Image
              source={{ uri: replyingTo.media_url }}
              style={styles.replyPreviewImage}
              resizeMode="cover"
            />
          )}
          <TouchableOpacity onPress={() => setReplyingTo(null)} style={styles.replyPreviewClose}>
            <MaterialCommunityIcons name="close" size={20} color={colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input Bar */}
      {isRecording ? (
        // Recording UI
        <View
          key={`recording-${androidLayoutReady}`}
          style={[styles.recordingContainer, {
            marginBottom: keyboardHeight > 0 ? keyboardHeight + 40 : insets.bottom,
            // In landscape, add right padding for navigation bar
            paddingRight: rightSafeArea > 0 ? rightSafeArea + 12 : 12,
            backgroundColor: isDarkColorScheme ? '#3D1F1F' : '#FEF2F2',
            borderTopColor: isDarkColorScheme ? '#5C2C2C' : '#FEE2E2'
          }]}>
          <TouchableOpacity style={styles.cancelButton} onPress={handleVoiceRecordCancel}>
            <MaterialCommunityIcons name="close" size={24} color="#EF4444" />
          </TouchableOpacity>

          <View style={styles.recordingContent}>
            <MotiView
              from={{ scale: 1 }}
              animate={{ scale: 1.2 }}
              transition={{
                type: 'timing',
                duration: 800,
                loop: true,
              }}
            >
              <MaterialCommunityIcons name="microphone" size={24} color="#EF4444" />
            </MotiView>
            <Text style={styles.recordingTime}>
              {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
            </Text>
            <Text style={[styles.recordingHint, { color: colors.mutedForeground }]}>{t('chat.slideToCancel')}</Text>
          </View>

          <TouchableOpacity style={styles.stopButton} onPress={handleVoiceRecordStop}>
            <LinearGradient colors={['#A08AB7', '#CDC2E5']} style={styles.stopButtonGradient}>
              <MaterialCommunityIcons name="send" size={20} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        // Normal input UI
        <View
          key={`input-${androidLayoutReady}`}
          style={[styles.inputContainer, {
            // Add 40px buffer above keyboard, or use bottom inset when keyboard is hidden
            marginBottom: keyboardHeight > 0 ? keyboardHeight + 40 : insets.bottom,
            // In landscape, add right padding for navigation bar
            paddingRight: rightSafeArea > 0 ? rightSafeArea + 12 : 12,
            backgroundColor: colors.card,
            borderTopColor: colors.border
          }]}>
          <TouchableOpacity style={[styles.imageButton, { backgroundColor: isDarkColorScheme ? '#2D2D30' : '#F3F4F6' }]} onPress={handleImagePick} disabled={sending}>
            <MaterialCommunityIcons name="image-outline" size={22} color={sending ? colors.mutedForeground : "#A08AB7"} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.voiceButton, { backgroundColor: isDarkColorScheme ? '#2D2D30' : '#F3F4F6' }]}
            onPress={handleVoiceRecordStart}
            onLongPress={handleVoiceRecordStart}
            disabled={sending}
          >
            <MaterialCommunityIcons name="microphone" size={22} color={sending ? colors.mutedForeground : "#A08AB7"} />
          </TouchableOpacity>

          <View style={[styles.inputWrapper, { backgroundColor: isDarkColorScheme ? '#2D2D30' : '#F3F4F6' }]}>
            <TextInput
              ref={textInputRef}
              style={[styles.input, { color: colors.foreground }]}
              placeholder={t('chat.typeMessage')}
              placeholderTextColor={colors.mutedForeground}
              value={newMessage}
              onChangeText={(text) => {
                setNewMessage(text);
                // Broadcast typing event for premium users
                if (text.length > 0) {
                  broadcastTyping();
                }
              }}
              multiline
              maxLength={1000}
              editable={!sending}
              underlineColorAndroid="transparent"
              returnKeyType="default"
              blurOnSubmit={false}
              textAlignVertical="center"
            />
          </View>

          <TouchableOpacity
            style={[styles.sendButton, (!newMessage.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <LinearGradient colors={['#A08AB7', '#CDC2E5']} style={styles.sendButtonGradient}>
                <MaterialCommunityIcons name="send" size={20} color="white" />
              </LinearGradient>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Safety Modals */}
      <BlockModal
        visible={showBlockModal}
        onClose={() => setShowBlockModal(false)}
        onConfirm={handleBlock}
        profileName={matchProfile?.display_name || ''}
      />
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        profileName={matchProfile?.display_name || ''}
      />

      {/* Reaction Picker Modal */}
      <Modal
        visible={showReactionPicker}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setShowReactionPicker(false);
          setReactionTargetMessage(null);
        }}
      >
        <TouchableOpacity
          style={styles.reactionPickerOverlay}
          activeOpacity={1}
          onPress={() => {
            setShowReactionPicker(false);
            setReactionTargetMessage(null);
          }}
        >
          <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'timing', duration: 200 }}
            style={[styles.reactionPickerContainer, { backgroundColor: colors.card }]}
          >
            {REACTION_EMOJIS.map((emoji) => {
              const isSelected = reactionTargetMessage?.reactions?.some(
                r => r.profile_id === currentProfileId && r.emoji === emoji
              );
              return (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => handleReaction(emoji)}
                  style={[
                    styles.reactionPickerEmoji,
                    isSelected && styles.reactionPickerEmojiSelected
                  ]}
                >
                  <Text style={styles.reactionPickerEmojiText}>{emoji}</Text>
                </TouchableOpacity>
              );
            })}
            {/* Plus button to open full emoji picker */}
            <TouchableOpacity
              onPress={openFullEmojiPicker}
              style={[styles.reactionPickerEmoji, styles.reactionPickerPlusButton]}
            >
              <MaterialCommunityIcons name="plus" size={24} color={colors.mutedForeground} />
            </TouchableOpacity>
          </MotiView>
        </TouchableOpacity>
      </Modal>

      {/* Full Emoji Picker */}
      <EmojiPicker
        onEmojiSelected={handleFullEmojiSelect}
        open={showFullEmojiPicker}
        onClose={() => {
          setShowFullEmojiPicker(false);
          setReactionTargetMessage(null);
        }}
        theme={{
          backdrop: 'rgba(0, 0, 0, 0.5)',
          knob: '#A08AB7',
          container: colors.card,
          header: colors.foreground,
          skinTonesContainer: colors.card,
          category: {
            icon: colors.mutedForeground,
            iconActive: '#A08AB7',
            container: colors.card,
            containerActive: 'rgba(160, 138, 183, 0.2)',
          },
          search: {
            background: isDarkColorScheme ? '#2D2D30' : '#F3F4F6',
            text: colors.foreground,
            placeholder: colors.mutedForeground,
          },
          emoji: {
            selected: 'rgba(160, 138, 183, 0.3)',
          },
        }}
      />

      {/* Premium Paywall */}
      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        variant="premium"
        feature="messaging"
      />

      {/* Review Submission Modal */}
      {pendingReviewData && (
        <ReviewSubmissionModal
          visible={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setPendingReviewData(null);
          }}
          matchId={pendingReviewData.matchId}
          reviewerId={currentProfileId || ''}
          revieweeId={pendingReviewData.revieweeId}
          revieweeName={pendingReviewData.revieweeName}
          onReviewSubmitted={() => {
            // Modal handles success alert internally
          }}
        />
      )}

      {/* Image Viewer Modal */}
      <Modal
        visible={!!viewingImageUrl}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setViewingImageUrl(null)}
      >
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity
            style={styles.imageViewerCloseButton}
            onPress={() => setViewingImageUrl(null)}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="close" size={32} color="#fff" />
          </TouchableOpacity>
          {viewingImageUrl && (
            <Image
              source={{ uri: viewingImageUrl }}
              style={styles.imageViewerImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Update Required Modal */}
      <Modal
        visible={showUpdateModal}
        transparent
        animationType="fade"
        onRequestClose={() => {}}
      >
        <View style={styles.updateModalOverlay}>
          <View style={[styles.updateModalContent, { backgroundColor: colors.card }]}>
            <MaterialCommunityIcons name="update" size={48} color="#A08AB7" />
            <Text style={[styles.updateModalTitle, { color: colors.foreground }]}>
              {t('chat.updateRequired')}
            </Text>
            <Text style={[styles.updateModalMessage, { color: colors.mutedForeground }]}>
              {versionUpdateMessage}
            </Text>
            <Text style={[styles.updateModalVersion, { color: colors.mutedForeground }]}>
              {t('chat.currentVersion')}: {getCurrentVersion()}
            </Text>
            <TouchableOpacity
              style={styles.updateButton}
              onPress={() => {
                // Open app store - verified store URLs
                const storeUrl = Platform.OS === 'ios'
                  ? 'https://apps.apple.com/ca/app/accord-lavender-marriage/id6753855469'
                  : 'https://play.google.com/store/apps/details?id=com.privyreviews.accord';
                Linking.openURL(storeUrl).catch(() => {});
              }}
            >
              <LinearGradient colors={['#A08AB7', '#8B7AA5']} style={styles.updateButtonGradient}>
                <MaterialCommunityIcons name="download" size={20} color="#fff" />
                <Text style={styles.updateButtonText}>{t('chat.updateNow')}</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.goBackButton}
              onPress={() => router.back()}
            >
              <Text style={[styles.goBackButtonText, { color: colors.mutedForeground }]}>
                {t('common.goBack')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  expandedTimestampContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginBottom: 4,
    marginLeft: 12,
  },
  expandedTimestampContainerMine: {
    alignSelf: 'flex-end',
    marginLeft: 0,
    marginRight: 12,
  },
  expandedTimestampText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerInfo: {
    flex: 1,
  },
  headerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1F2937',
  },
  encryptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  encryptionText: {
    fontSize: 12,
    color: '#71717A',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  revealButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#F5F2F7',
  },
  premiumBanner: {
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  premiumBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  premiumBannerContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  premiumBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  bannerSwipeHint: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 48,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginVertical: 2,
  },
  messageRowMine: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '70%',
    borderRadius: 20,
    overflow: 'hidden',
  },
  messageBubbleMine: {
    borderBottomRightRadius: 4,
  },
  messageBubbleTheirs: {
    backgroundColor: '#E8E8ED',
    borderBottomLeftRadius: 4,
    padding: 12,
  },
  messageBubbleGradient: {
    padding: 12,
  },
  messageTextMine: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 20,
    flexShrink: 1,
  },
  messageTextTheirs: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 20,
    flexShrink: 1,
  },
  messageTime: {
    fontSize: 11,
    color: '#6B7280',
  },
  messageTimeMine: {
    color: 'rgba(0,0,0,0.5)',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  inlineTextRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  bubbleFooter: {
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  inlineTimeStamp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  voiceFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  readReceipt: {
    marginLeft: 2,
  },
  imageMessageFooter: {
    position: 'absolute',
    bottom: 8,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    marginBottom: 20,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  likeIntroCard: {
    alignSelf: 'center',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    maxWidth: '85%',
    width: '85%',
  },
  likeIntroLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 10,
  },
  likeIntroPromptCard: {
    flexDirection: 'row',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
    width: '100%',
  },
  likeIntroPromptBorder: {
    width: 3,
    backgroundColor: '#A08AB7',
  },
  likeIntroPromptContent: {
    flex: 1,
    padding: 10,
  },
  likeIntroPromptQuestion: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  likeIntroPromptAnswer: {
    fontSize: 14,
    lineHeight: 20,
  },
  likeIntroPhoto: {
    width: 120,
    height: 120,
    borderRadius: 12,
    marginBottom: 10,
  },
  likeIntroMessageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 6,
  },
  likeIntroMessage: {
    fontSize: 14,
    fontStyle: 'italic',
    lineHeight: 20,
    flex: 1,
  },
  likeIntroTime: {
    fontSize: 11,
    marginTop: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  imageButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
  },
  voiceButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 36,
    maxHeight: 100,
    justifyContent: 'center',
  },
  input: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 20,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageMessageGradient: {
    padding: 3,
    borderRadius: 16,
  },
  messageImage: {
    width: 220,
    height: 165,
    borderRadius: 14,
  },
  imageMessageTime: {
    color: 'rgba(255,255,255,0.95)',
  },
  // Voice message styles
  voiceMessageBubble: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 200,
  },
  voiceMessageBubbleTheirs: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    minWidth: 200,
  },
  voiceMessageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  voiceMessageInfo: {
    flex: 1,
  },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 28,
    marginBottom: 2,
  },
  voiceWaveBar: {
    width: 3,
    borderRadius: 2,
  },
  voiceDuration: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontWeight: '600',
  },
  voiceDurationTheirs: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  // Recording UI styles
  recordingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    backgroundColor: '#FEF2F2',
    borderTopWidth: 1,
    borderTopColor: '#FEE2E2',
  },
  recordingContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recordingTime: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#EF4444',
  },
  recordingHint: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  cancelButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
  },
  stopButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  stopButtonGradient: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unmatchedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#F9FAFB',
  },
  unmatchedIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    alignSelf: 'center',
  },
  unmatchedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 12,
  },
  unmatchedMessage: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  unmatchedSubtext: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    fontStyle: 'italic',
  },
  unmatchedButton: {
    backgroundColor: '#A08AB7',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    alignSelf: 'center',
  },
  unmatchedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    flex: 1,
    textAlign: 'center',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 2,
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 10,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: '100%',
    height: '100%',
  },
  // Update Required Modal styles
  updateModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  updateModalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  updateModalTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  updateModalMessage: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  updateModalVersion: {
    fontSize: 13,
    textAlign: 'center',
  },
  updateButton: {
    width: '100%',
    marginTop: 8,
  },
  updateButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  updateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  goBackButton: {
    paddingVertical: 12,
  },
  goBackButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  // Typing indicator styles
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginRight: 4,
  },
  typingDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#A08AB7',
  },
  typingBubbleContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  typingBubble: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    minWidth: 64,
  },
  typingBubbleDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  typingBubbleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
  typingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  // Reaction styles
  reactionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: -8,
    marginBottom: 4,
    gap: 4,
  },
  reactionsContainerMine: {
    justifyContent: 'flex-end',
    paddingRight: 8,
  },
  reactionsContainerTheirs: {
    justifyContent: 'flex-start',
    paddingLeft: 8,
  },
  reactionBubble: {
    backgroundColor: 'rgba(160, 138, 183, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(160, 138, 183, 0.3)',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  // Reaction Picker Modal styles
  reactionPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionPickerContainer: {
    flexDirection: 'row',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    gap: 4,
  },
  reactionPickerEmoji: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reactionPickerEmojiSelected: {
    backgroundColor: 'rgba(160, 138, 183, 0.3)',
  },
  reactionPickerEmojiText: {
    fontSize: 24,
  },
  reactionPickerPlusButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderStyle: 'dashed',
  },
  // Reply preview bar styles
  replyPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    gap: 8,
  },
  replyPreviewBorder: {
    width: 3,
    backgroundColor: '#A08AB7',
    borderRadius: 2,
    alignSelf: 'stretch',
  },
  replyPreviewContent: {
    flex: 1,
  },
  replyPreviewAuthor: {
    fontSize: 13,
    fontWeight: '600',
  },
  replyPreviewText: {
    fontSize: 13,
    marginTop: 2,
  },
  replyPreviewImage: {
    width: 56,
    height: 56,
    borderRadius: 8,
    marginRight: 8,
  },
  replyPreviewClose: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Quoted reply in bubble styles (WhatsApp-style)
  quotedReply: {
    flexDirection: 'row',
    borderRadius: 8,
    marginTop: -4,
    marginHorizontal: -4,
    marginBottom: 6,
    overflow: 'hidden',
    minWidth: 200,
  },
  quotedReplyMine: {
    backgroundColor: '#8B73A8',
  },
  quotedReplyAccent: {
    width: 4,
    backgroundColor: '#A08AB7',
  },
  quotedReplyAccentMine: {
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  quotedReplyBody: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  quotedReplyAuthor: {
    fontSize: 13,
    fontWeight: '700',
    color: '#A08AB7',
    marginBottom: 2,
  },
  quotedReplyAuthorMine: {
    color: 'rgba(255,255,255,0.95)',
  },
  quotedReplyText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 19,
  },
  quotedReplyTextMine: {
    color: 'rgba(255,255,255,0.7)',
  },
  quotedReplyImage: {
    width: 54,
    height: 54,
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
  },
  // Search bar styles
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  searchBackButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 2,
  },
  searchNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  searchCount: {
    fontSize: 12,
    fontWeight: '500',
    marginHorizontal: 4,
  },
  searchNavButton: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchHighlightedBubble: {
    borderWidth: 1.5,
    borderColor: 'rgba(160, 138, 183, 0.4)',
  },
  searchCurrentBubble: {
    borderWidth: 2,
    borderColor: '#A08AB7',
  },
  // Link preview styles
  linkPreviewMine: {
    marginTop: 8,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  linkPreviewTheirs: {
    marginTop: 8,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
  },
  linkPreviewImage: {
    width: '100%',
    height: 120,
  },
  linkPreviewTextContainer: {
    padding: 8,
  },
  linkPreviewTitleMine: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  linkPreviewDescMine: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  linkPreviewHostMine: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 4,
  },
  linkPreviewTitleTheirs: {
    fontSize: 13,
    fontWeight: '600',
  },
  linkPreviewDescTheirs: {
    fontSize: 12,
    marginTop: 2,
  },
  linkPreviewHostTheirs: {
    fontSize: 11,
    marginTop: 4,
  },
});
