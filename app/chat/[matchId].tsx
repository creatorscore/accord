import React, { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
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
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';
import { useScreenProtection } from '@/hooks/useScreenProtection';
import * as ImagePicker from 'expo-image-picker';
import { DynamicWatermark } from '@/components/security/DynamicWatermark';
import { useWatermark } from '@/hooks/useWatermark';
import { Audio } from 'expo-av';
import { sendMessageNotification, sendReactionNotification } from '@/lib/notifications';
import BlockModal from '@/components/safety/BlockModal';
import { optimizeImage, uriToArrayBuffer, validateImage, IMAGE_CONFIG } from '@/lib/image-optimization';
import ReportModal from '@/components/safety/ReportModal';
import PremiumPaywall from '@/components/premium/PremiumPaywall';
import IntroMessages from '@/components/messaging/IntroMessages';
import ModerationMenu from '@/components/moderation/ModerationMenu';
import ReviewPromptBanner from '@/components/reviews/ReviewPromptBanner';
import ReviewSubmissionModal from '@/components/reviews/ReviewSubmissionModal';
import { validateMessage, containsContactInfo, validateContent } from '@/lib/content-moderation';
import { encryptMessage, decryptMessage, getPrivateKey, getLegacyPrivateKey } from '@/lib/encryption';
import { getLastActiveText, isOnline, getOnlineStatusColor } from '@/lib/online-status';
import { trackUserAction, trackFunnel } from '@/lib/analytics';
import { useColorScheme } from '@/lib/useColorScheme';
import { checkMessagingVersionRequirement, getCurrentVersion } from '@/lib/version-check';
import * as Linking from 'expo-linking';
import { useSafeBlur } from '@/hooks/useSafeBlur';
import EmojiPicker from 'rn-emoji-keyboard';

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
}

interface MatchProfile {
  id: string;
  display_name: string;
  age: number;
  photo_url?: string;
  is_verified?: boolean;
  occupation?: string;
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
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const { colors, isDarkColorScheme } = useColorScheme();

  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
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
  const [hasRevealedPhotos, setHasRevealedPhotos] = useState(false);
  const [otherUserRevealed, setOtherUserRevealed] = useState(false);
  const [currentUserPhotoBlur, setCurrentUserPhotoBlur] = useState(false);
  const [matchProfilePhotoBlur, setMatchProfilePhotoBlur] = useState(false);
  const [revealLoading, setRevealLoading] = useState(false);
  const { viewerUserId, isReady: watermarkReady } = useWatermark();

  // Safe blur hook - protects match privacy while preventing crashes
  const { blurRadius, onImageLoad, onImageError } = useSafeBlur({
    shouldBlur: matchProfilePhotoBlur && !otherUserRevealed,
    blurIntensity: 30,
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
        setVersionUpdateMessage(result.message || 'Please update your app to continue messaging.');
        setShowUpdateModal(true);
      }
    };
    checkVersion();
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
    loadCurrentProfile();
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
      cleanupAudio();
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
      // Clean up all scroll timeouts
      scrollTimeoutRefs.current.forEach(clearTimeout);
      scrollTimeoutRefs.current = [];
      // Clean up auto-stop recording timeout
      if (autoStopRecordingTimeoutRef.current) {
        clearTimeout(autoStopRecordingTimeoutRef.current);
        autoStopRecordingTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (currentProfileId && matchId) {
      loadMatchProfile();
      loadMessages();
      const unsubscribeMessages = subscribeToMessages();
      const unsubscribeReactions = subscribeToReactions();
      markMessagesAsRead();

      // Cleanup subscriptions when component unmounts or dependencies change
      return () => {
        if (unsubscribeMessages) {
          console.log('🔌 Unsubscribing from chat realtime channel');
          unsubscribeMessages();
        }
        if (unsubscribeReactions) {
          console.log('🔌 Unsubscribing from reactions realtime channel');
          unsubscribeReactions();
        }
      };
    }
  }, [currentProfileId, matchId]);

  // Reload messages when screen comes into focus (e.g., from notification tap)
  // This ensures messages are fresh when navigating from a push notification
  useFocusEffect(
    useCallback(() => {
      if (currentProfileId && !loading) {
        console.log('📱 Chat screen focused - refreshing messages');
        loadMessages();
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

  const setupAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('Error setting up audio:', error);
    }
  };

  const cleanupAudio = async () => {
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
      } catch (error) {
        console.error('Error cleaning up recording:', error);
      }
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

  const loadCurrentProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, photo_blur_enabled')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setCurrentProfileId(data.id);
      setCurrentProfileName(data.display_name);
      setCurrentUserPhotoBlur(data.photo_blur_enabled || false);
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const loadMatchProfile = async () => {
    try {
      console.log('🔍 Loading match profile for match:', matchId);

      // Get match details including status and compatibility score in one query
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('profile1_id, profile2_id, status, unmatched_by, unmatched_at, unmatch_reason, compatibility_score')
        .eq('id', matchId)
        .single();

      console.log('Match data:', { matchData, matchError });

      if (matchError) throw matchError;

      // Store match status
      setMatchStatus({
        status: matchData.status,
        unmatched_by: matchData.unmatched_by,
        unmatched_at: matchData.unmatched_at,
        unmatch_reason: matchData.unmatch_reason,
      });

      // If match is unmatched or blocked, stop here
      if (matchData.status !== 'active') {
        console.log('⚠️ Match is not active:', matchData.status);
        setLoading(false);
        return;
      }

      // Determine other profile ID
      const otherProfileId =
        matchData.profile1_id === currentProfileId
          ? matchData.profile2_id
          : matchData.profile1_id;

      console.log('Other profile ID:', otherProfileId);

      // Run all remaining queries in parallel for better performance
      const [banResult, profileResult, currentUserResult] = await Promise.all([
        // Check if other user is banned
        supabase
          .from('bans')
          .select('id')
          .eq('banned_profile_id', otherProfileId)
          .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
          .maybeSingle(),
        // Get profile details
        supabase
          .from('profiles')
          .select(`
            id,
            display_name,
            age,
            is_verified,
            occupation,
            location_city,
            latitude,
            longitude,
            last_active_at,
            hide_last_active,
            photo_blur_enabled,
            photos (
              url,
              is_primary,
              display_order
            )
          `)
          .eq('id', otherProfileId)
          .single(),
        // Get current user's location for distance calculation
        supabase
          .from('profiles')
          .select('latitude, longitude')
          .eq('id', currentProfileId)
          .single(),
      ]);

      // Check if other user is banned
      if (banResult.data) {
        Alert.alert(
          'Chat Unavailable',
          'This user is no longer available.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
        setLoading(false);
        return;
      }

      const profile = profileResult.data;
      if (profileResult.error || !profile) throw profileResult.error;

      console.log('Profile data:', { profile });

      const photos = profile.photos?.sort((a: any, b: any) => a.display_order - b.display_order);
      const primaryPhoto = photos?.find((p: any) => p.is_primary) || photos?.[0];

      // Calculate distance if both profiles have location
      let distance = null;
      const currentUserData = currentUserResult.data;
      if (profile.latitude && profile.longitude &&
          currentUserData?.latitude && currentUserData?.longitude) {
        const R = 3959; // Earth's radius in miles
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

      const matchProfileData: MatchProfile = {
        id: profile.id,
        display_name: profile.display_name,
        age: profile.age,
        photo_url: primaryPhoto?.url,
        is_verified: profile.is_verified,
        occupation: profile.occupation,
        location_city: profile.location_city,
        compatibility_score: matchData.compatibility_score,
        distance: distance ?? undefined,
        last_active_at: profile.last_active_at,
        hide_last_active: profile.hide_last_active,
      };

      console.log('✅ Match profile loaded:', matchProfileData);
      setMatchProfile(matchProfileData);
      setMatchProfilePhotoBlur(profile.photo_blur_enabled || false);

      // Check photo reveal status (async, non-blocking)
      checkPhotoRevealStatus(otherProfileId);
    } catch (error: any) {
      console.error('❌ Error loading match profile:', error);
      Alert.alert(t('common.error'), 'Failed to load chat. Please try again.');
      router.back();
    }
  };

  const loadMessages = async () => {
    try {
      console.log('Loading messages for match:', matchId);

      // Fetch messages and reactions in parallel
      const [messagesResult, reactionsResult] = await Promise.all([
        supabase
          .from('messages')
          .select('*')
          .eq('match_id', matchId)
          .order('created_at', { ascending: true }),
        supabase
          .from('message_reactions')
          .select('*')
          .in('message_id', (await supabase
            .from('messages')
            .select('id')
            .eq('match_id', matchId)
          ).data?.map(m => m.id) || [])
      ]);

      const { data, error } = messagesResult;
      const { data: reactionsData } = reactionsResult;

      console.log('Messages query result:', { data, error, count: data?.length });

      if (error) {
        console.error('ERROR LOADING MESSAGES:', error);
        throw error;
      }

      // Create a map of reactions by message ID
      const reactionsByMessage = new Map<string, MessageReaction[]>();
      if (reactionsData) {
        reactionsData.forEach((reaction: MessageReaction) => {
          const existing = reactionsByMessage.get(reaction.message_id) || [];
          reactionsByMessage.set(reaction.message_id, [...existing, reaction]);
        });
      }

      // Decrypt all text messages and attach reactions
      if (data && data.length > 0) {
        console.log('🔓 Decrypting', data.length, 'messages...');
        const decryptedMessages = await Promise.all(
          data.map(async (message) => {
            const decrypted = await decryptSingleMessage(message as Message);
            return {
              ...decrypted,
              reactions: reactionsByMessage.get(message.id) || []
            };
          })
        );
        setMessages(decryptedMessages);
        console.log('✅ All messages decrypted');
      } else {
        setMessages([]);
      }
    } catch (error: any) {
      console.error('CATCH Error loading messages:', error);
      Alert.alert(t('common.error'), 'Failed to load messages: ' + error.message);
    } finally {
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
          const decryptedMessage = await decryptSingleMessage(newMessage);

          setMessages((prev) => {
            // Check if message already exists to avoid duplicates
            const exists = prev.some(msg => msg.id === decryptedMessage.id);
            if (exists) {
              console.log('📭 Message already exists, skipping duplicate:', decryptedMessage.id);
              return prev;
            }
            console.log('📬 Adding new message from realtime:', decryptedMessage.id);
            return [...prev, { ...decryptedMessage, reactions: [] }];
          });

          // Mark as read if message is for current user
          if (newMessage.receiver_profile_id === currentProfileId) {
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
          console.log('📬 Reaction change received:', payload.eventType);

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

  // Subscribe to typing indicator events (Premium feature)
  const subscribeToTypingIndicator = useCallback(() => {
    if (!isPremium || !matchId || !currentProfileId) return;

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
  }, [isPremium, matchId, currentProfileId]);

  // Broadcast typing event with debounce (Premium feature)
  const broadcastTyping = useCallback(() => {
    if (!isPremium || !typingChannelRef.current || !currentProfileId) return;

    const now = Date.now();
    // Only broadcast every 2 seconds to avoid spamming
    if (now - lastTypingBroadcastRef.current < 2000) return;

    lastTypingBroadcastRef.current = now;
    typingChannelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: { profileId: currentProfileId },
    });
  }, [isPremium, currentProfileId]);

  // Subscribe to typing indicator for premium users
  // Note: We intentionally exclude subscribeToTypingIndicator from deps to avoid resubscription loop
  useEffect(() => {
    if (isPremium && currentProfileId && matchId) {
      const unsubscribe = subscribeToTypingIndicator();
      return () => {
        if (unsubscribe) {
          console.log('🔌 Unsubscribing from typing indicator channel');
          unsubscribe();
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium, currentProfileId, matchId]);

  const markMessagesAsRead = async () => {
    if (!currentProfileId) return;

    try {
      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('match_id', matchId)
        .eq('receiver_profile_id', currentProfileId)
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
      console.log('⚠️ Plain text message detected');
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

      // Determine if I'm the sender or recipient
      const iAmSender = message.sender_profile_id === currentProfileId;

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
          console.log('🔄 Current key decryption failed, trying legacy key...');
        }
      }

      // Fallback: Try legacy key for old messages
      if (myLegacyPrivateKey) {
        try {
          console.log('🔑 Attempting decryption with legacy key...');
          const decryptedContent = await decryptMessage(
            message.encrypted_content,
            myLegacyPrivateKey,
            otherProfile.encryption_public_key
          );

          // Check if decryption succeeded
          if (decryptedContent !== '[Unable to decrypt message]') {
            console.log('✅ Successfully decrypted with legacy key');
            return { ...message, decrypted_content: decryptedContent };
          }
        } catch (error) {
          console.log('❌ Legacy key decryption also failed');
        }
      }

      // Both keys failed
      console.log('⚠️ Unable to decrypt message with any available keys');
      return { ...message, decrypted_content: t('chat.unableToDecrypt') };
    } catch (error) {
      console.error('Error decrypting message:', error);
      // Show placeholder instead of encrypted gibberish
      return { ...message, decrypted_content: t('chat.unableToDecrypt') };
    }
  };

  const handleSendMessage = async () => {
    console.log('🚀 SEND BUTTON PRESSED!');
    console.log('New message:', newMessage);
    console.log('Current profile ID:', currentProfileId);
    console.log('Match profile:', matchProfile);

    // Check if match is still active
    if (matchStatus?.status !== 'active') {
      Alert.alert(t('chat.cannotSendMessage'), t('chat.conversationEnded'));
      return;
    }

    // Block sending if version check failed - ensures encryption compatibility
    if (!versionCheckPassed) {
      setShowUpdateModal(true);
      return;
    }

    if (!newMessage.trim() || !currentProfileId || !matchProfile || !user) {
      console.log('❌ VALIDATION FAILED - Missing required data');
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
      Alert.alert(t('chat.inappropriateContent'), messageValidation.error);
      return;
    }

    try {
      console.log('=== SENDING MESSAGE ===');
      console.log('Match ID:', matchId);
      console.log('Sender ID:', currentProfileId);
      console.log('Receiver ID:', matchProfile.id);

      let encryptedContent = messageContent; // Default to plain text

      // Try to encrypt the message
      const senderPrivateKey = await getPrivateKey(user.id);

      if (senderPrivateKey) {
        // Get recipient's public key for encryption
        const { data: recipientProfile } = await supabase
          .from('profiles')
          .select('encryption_public_key')
          .eq('id', matchProfile.id)
          .single();

        if (recipientProfile?.encryption_public_key) {
          // Both parties have keys - encrypt the message
          console.log('🔐 Encrypting message...');
          try {
            encryptedContent = await encryptMessage(
              messageContent,
              senderPrivateKey,
              recipientProfile.encryption_public_key
            );
            console.log('✅ Message encrypted successfully');
          } catch (encryptError: any) {
            console.warn('⚠️ Encryption failed, sending as plain text:', encryptError.message);
            // Fall back to plain text
            encryptedContent = messageContent;
          }
        } else {
          console.warn('⚠️ Recipient encryption keys not found, sending as plain text');
        }
      } else {
        console.warn('⚠️ Sender encryption keys not found, sending as plain text');
      }

      // Send message (encrypted if possible, plain text otherwise)
      const { data, error } = await supabase.from('messages').insert({
        match_id: matchId,
        sender_profile_id: currentProfileId,
        receiver_profile_id: matchProfile.id,
        encrypted_content: encryptedContent,
        content_type: 'text',
      }).select();

      console.log('Insert result:', { data, error });

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

      console.log('Message sent successfully!');

      // Add message to UI immediately (optimistic update)
      // Note: We already have the decrypted content (messageContent), so we don't need to decrypt
      if (data && data[0]) {
        console.log('Adding message to UI:', data[0]);
        // Replace encrypted content with plain text for display (since we just sent it)
        const displayMessage = { ...data[0], encrypted_content: messageContent } as Message;
        setMessages((prev) => [...prev, displayMessage]);
      }

      // Send push notification to recipient (skip in Expo Go)
      try {
        await sendMessageNotification(
          matchProfile.id,
          currentProfileName,
          messageContent,
          matchId as string
        );
      } catch (notifError) {
        console.log('Notification error (ignoring):', notifError);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      setNewMessage(messageContent); // Restore message on error
      Alert.alert(t('common.error'), t('chat.sendMessageError'));
    } finally {
      setSending(false);
    }
  };

  const handleImagePick = async () => {
    if (!currentProfileId || !matchProfile || !user) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true, // Enable photo editing/cropping
        aspect: [4, 3], // Standard photo aspect ratio
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
            Alert.alert('Invalid Image', validation.error || 'Please select a different photo');
            setSending(false);
            return;
          }

          // Optimize image for chat (smaller size for faster sending)
          const { optimized } = await optimizeImage(selectedUri, {
            maxWidth: IMAGE_CONFIG.chat.maxWidth,
            maxHeight: IMAGE_CONFIG.chat.maxHeight,
            quality: IMAGE_CONFIG.chat.quality,
          });

          console.log(`Optimized chat image: ${(optimized.size! / 1024).toFixed(0)}KB (${optimized.width}x${optimized.height})`);

          // Upload optimized image to Supabase Storage
          const fileName = `${matchId}_${Date.now()}.jpg`;
          const filePath = `chat-images/${fileName}`;

          // Convert to ArrayBuffer using optimized utility
          const arrayBuffer = await uriToArrayBuffer(optimized.uri);

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('chat-media')
            .upload(filePath, arrayBuffer, {
              contentType: 'image/jpeg',
              upsert: false,
            });

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('chat-media')
            .getPublicUrl(filePath);

          // Send image message
          console.log('📤 Sending image message:', { publicUrl, matchId, currentProfileId });

          const { data: insertedMessage, error: messageError } = await supabase
            .from('messages')
            .insert({
              match_id: matchId,
              sender_profile_id: currentProfileId,
              receiver_profile_id: matchProfile.id,
              encrypted_content: '[Photo]',
              content_type: 'image',
              media_url: publicUrl,
            })
            .select()
            .single();

          if (messageError) {
            console.error('❌ Message insert error:', messageError);
            throw messageError;
          }

          console.log('✅ Image message inserted:', insertedMessage);

          // Add message to local state immediately (realtime will handle duplicates)
          if (insertedMessage) {
            console.log('📝 Adding image message to state. Current messages:', messages.length);
            setMessages((prev) => {
              // Force a new array reference for React to detect the change
              const newMessages = [...prev, insertedMessage as Message];
              console.log('📝 New messages count:', newMessages.length);
              console.log('📝 New message details:', {
                id: insertedMessage.id,
                content_type: insertedMessage.content_type,
                media_url: insertedMessage.media_url
              });
              return newMessages;
            });

            // Force FlatList to scroll to bottom after state update
            // Store timeout refs for cleanup on unmount
            const scrollTimeout1 = setTimeout(() => {
              console.log('📜 Scrolling to end...');
              flatListRef.current?.scrollToEnd({ animated: true });
            }, 100);
            scrollTimeoutRefs.current.push(scrollTimeout1);

            // Try again after a bit longer in case the render hasn't completed
            const scrollTimeout2 = setTimeout(() => {
              flatListRef.current?.scrollToEnd({ animated: false });
            }, 500);
            scrollTimeoutRefs.current.push(scrollTimeout2);
          }

          // Send push notification (skip in Expo Go)
          try {
            await sendMessageNotification(
              matchProfile.id,
              currentProfileName,
              '📷 Sent a photo',
              matchId as string
            );
          } catch (notifError) {
            console.log('Notification error (ignoring):', notifError);
          }
        } catch (uploadError: any) {
          console.error('Error uploading image:', uploadError);
          Alert.alert(t('common.error'), t('chat.sendPhotoError'));
        } finally {
          setSending(false);
        }
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert(t('common.error'), t('chat.pickPhotoError'));
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
        Alert.alert(t('chat.permissionRequired'), t('chat.microphonePermission'));
        return;
      }

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
      Alert.alert(t('common.error'), t('chat.recordingError'));
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
        Alert.alert(t('common.error'), 'Failed to record voice message. Please try again.');
        return;
      }

      // Upload and send
      await handleVoiceSend(uri, duration);
    } catch (error: any) {
      console.error('Error stopping recording:', error);
      Alert.alert(t('common.error'), t('chat.stopRecordingError'));
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
          contentType: 'audio/m4a',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('chat-media')
        .getPublicUrl(filePath);

      // Send voice message
      const { error: messageError } = await supabase.from('messages').insert({
        match_id: matchId,
        sender_profile_id: currentProfileId,
        receiver_profile_id: matchProfile.id,
        encrypted_content: '[Voice Message]',
        content_type: 'voice',
        media_url: publicUrl,
        voice_duration: duration,
      });

      if (messageError) throw messageError;

      // Prevent match expiration if this is the first message
      if (messages.length === 0) {
        await supabase
          .from('matches')
          .update({ first_message_sent_at: new Date().toISOString() })
          .eq('id', matchId);
      }

      // Send push notification
      try {
        await sendMessageNotification(
          matchProfile.id,
          currentProfileName,
          '🎤 Sent a voice message',
          matchId as string
        );
      } catch (notifError) {
        console.log('Notification error (ignoring):', notifError);
      }
    } catch (error: any) {
      console.error('Error sending voice message:', error);
      Alert.alert(t('common.error'), t('chat.sendVoiceError'));
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

      // Load and play new sound
      const { sound } = await Audio.Sound.createAsync(
        { uri: message.media_url },
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
      Alert.alert(t('common.error'), t('chat.playVoiceError'));
    }
  };

  const checkPhotoRevealStatus = async (otherProfileId: string) => {
    if (!currentProfileId) return;

    try {
      // Check if current user has revealed photos to this profile
      const { data: myReveal } = await supabase
        .from('photo_reveals')
        .select('id')
        .eq('revealer_profile_id', currentProfileId)
        .eq('revealed_to_profile_id', otherProfileId)
        .maybeSingle();

      setHasRevealedPhotos(!!myReveal);

      // Check if other user has revealed photos to current user
      const { data: theirReveal } = await supabase
        .from('photo_reveals')
        .select('id')
        .eq('revealer_profile_id', otherProfileId)
        .eq('revealed_to_profile_id', currentProfileId)
        .maybeSingle();

      setOtherUserRevealed(!!theirReveal);
    } catch (error: any) {
      console.error('Error checking photo reveal status:', error);
    }
  };

  const togglePhotoReveal = async () => {
    if (!currentProfileId || !matchProfile?.id || !matchId) {
      Alert.alert(t('common.error'), 'Unable to toggle photo reveal');
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
        Alert.alert('Photos Blurred', 'Your photos are now blurred for this match');
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

        // Send push notification
        try {
          await sendMessageNotification(
            matchProfile.id,
            currentProfileName,
            `${currentProfileName} revealed their photos to you! 👀`,
            matchId as string
          );
        } catch (notifError) {
          console.log('Notification error (ignoring):', notifError);
        }

        Alert.alert('Photos Revealed', `Your photos are now visible to ${matchProfile.display_name}`);
      }
    } catch (error: any) {
      console.error('Error toggling photo reveal:', error);
      Alert.alert(t('common.error'), 'Failed to update photo visibility. Please try again.');
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

      Alert.alert(t('chat.blocked'), `You have blocked ${matchProfile.display_name}`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error blocking user:', error);
      Alert.alert(t('common.error'), 'Failed to block user. Please try again.');
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

      Alert.alert('Report Submitted', 'Thank you for helping keep Accord safe. Our team will review this report.');
    } catch (error) {
      console.error('Error reporting user:', error);
      Alert.alert(t('common.error'), 'Failed to submit report. Please try again.');
    }
  };

  const handleDeleteMessage = async (message: Message) => {
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }

    if (message.sender_profile_id !== currentProfileId) {
      Alert.alert(t('chat.cannotDelete'), t('chat.cannotDeleteMessage'));
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
              Alert.alert(t('common.error'), t('chat.deleteMessageError'));
            }
          },
        },
      ]
    );
  };

  const handleMessageLongPress = (message: Message, event?: any) => {
    const isMine = message.sender_profile_id === currentProfileId;

    if (isMine) {
      // For own messages, show delete option (premium only)
      setSelectedMessage(message);
      if (!isPremium) {
        Alert.alert(
          'Premium Feature',
          'Delete messages you\'ve sent! Upgrade to Premium to unlock message deletion.',
          [
            { text: 'Maybe Later', style: 'cancel' },
            {
              text: 'Upgrade',
              onPress: () => setShowPaywall(true),
            },
          ]
        );
        return;
      }
      Alert.alert(
        t('chat.messageOptions'),
        'What would you like to do?',
        [
          {
            text: t('chat.deleteMessage'),
            style: 'destructive',
            onPress: () => handleDeleteMessage(message),
          },
          { text: t('common.cancel'), style: 'cancel' },
        ]
      );
    } else {
      // For received messages, show reaction picker (premium only)
      if (!isPremium) {
        Alert.alert(
          'Premium Feature',
          'React to messages with emojis! Upgrade to Premium to unlock message reactions.',
          [
            { text: 'Maybe Later', style: 'cancel' },
            {
              text: 'Upgrade',
              onPress: () => router.push('/settings/subscription'),
            },
          ]
        );
        return;
      }
      setReactionTargetMessage(message);
      setShowReactionPicker(true);
    }
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
              currentProfileName || 'Someone',
              emoji,
              matchId as string
            );
          }
        }
      }
    } catch (error) {
      console.error('Error handling reaction:', error);
      Alert.alert(t('common.error'), 'Failed to add reaction');
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

  const showActionMenu = () => {
    if (!matchProfile) return;
    Alert.alert(
      matchProfile.display_name,
      'Choose an action',
      [
        {
          text: 'Report',
          onPress: () => setShowReportModal(true),
          style: 'destructive',
        },
        {
          text: 'Block',
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

  const handleMessagePress = (messageId: string) => {
    // Toggle full timestamp display
    setExpandedTimestampId(prev => prev === messageId ? null : messageId);
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    if (!item) {
      console.error('NULL ITEM in renderMessage');
      return null;
    }

    const isMine = item.sender_profile_id === currentProfileId;
    const isTimestampExpanded = expandedTimestampId === item.id;

    return (
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
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300 }}
          style={[styles.messageRow, isMine && styles.messageRowMine]}
        >
        {/* Message Bubble */}
        <View style={[styles.messageBubble, isMine ? styles.messageBubbleMine : [styles.messageBubbleTheirs, { backgroundColor: colors.card }]]}>
          {item.content_type === 'image' && item.media_url ? (
            // Image message
            <TouchableOpacity
              onPress={() => setViewingImageUrl(item.media_url || null)}
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
                {isMine && isPremium && (
                  <MaterialCommunityIcons
                    name={item.read_at ? "check-all" : "check"}
                    size={12}
                    color={item.read_at ? "#3B82F6" : "rgba(255,255,255,0.8)"}
                    style={styles.readReceipt}
                  />
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
                  <View style={styles.voiceMessageContent}>
                    <MaterialCommunityIcons
                      name={playingVoiceId === item.id ? "pause-circle" : "play-circle"}
                      size={32}
                      color="white"
                    />
                    <View style={styles.voiceMessageInfo}>
                      <View style={styles.voiceWaveform}>
                        {[...Array(20)].map((_, i) => (
                          <View
                            key={i}
                            style={[
                              styles.voiceWaveBar,
                              {
                                height: Math.random() * 20 + 10,
                                backgroundColor: 'rgba(255,255,255,0.6)',
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <Text style={styles.voiceDuration}>
                        {item.voice_duration ? `${Math.floor(item.voice_duration / 60)}:${String(item.voice_duration % 60).padStart(2, '0')}` : '0:00'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.messageFooter}>
                    <Text style={[styles.messageTime, styles.messageTimeMine]}>
                      {getTimeDisplay(item.created_at)}
                    </Text>
                    {isPremium && (
                      <MaterialCommunityIcons
                        name={item.read_at ? "check-all" : "check"}
                        size={12}
                        color={item.read_at ? "#60A5FA" : "rgba(255,255,255,0.7)"}
                        style={styles.readReceipt}
                      />
                    )}
                  </View>
                </LinearGradient>
              ) : (
                <View style={styles.voiceMessageBubbleTheirs}>
                  <View style={styles.voiceMessageContent}>
                    <MaterialCommunityIcons
                      name={playingVoiceId === item.id ? "pause-circle" : "play-circle"}
                      size={32}
                      color="#A08AB7"
                    />
                    <View style={styles.voiceMessageInfo}>
                      <View style={styles.voiceWaveform}>
                        {[...Array(20)].map((_, i) => (
                          <View
                            key={i}
                            style={[
                              styles.voiceWaveBar,
                              {
                                height: Math.random() * 20 + 10,
                                backgroundColor: '#D1D5DB',
                              },
                            ]}
                          />
                        ))}
                      </View>
                      <Text style={styles.voiceDurationTheirs}>
                        {item.voice_duration ? `${Math.floor(item.voice_duration / 60)}:${String(item.voice_duration % 60).padStart(2, '0')}` : '0:00'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.messageTime}>
                    {getTimeDisplay(item.created_at)}
                  </Text>
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
                  <Text style={styles.messageTextMine}>{item.decrypted_content || item.encrypted_content}</Text>
                  <View style={styles.messageFooter}>
                    <Text style={[styles.messageTime, styles.messageTimeMine]}>
                      {getTimeDisplay(item.created_at)}
                    </Text>
                    {isPremium && (
                      <MaterialCommunityIcons
                        name={item.read_at ? "check-all" : "check"}
                        size={14}
                        color={item.read_at ? "#60A5FA" : "rgba(255,255,255,0.7)"}
                        style={styles.readReceipt}
                      />
                    )}
                  </View>
                </LinearGradient>
              ) : (
                <>
                  <Text style={[styles.messageTextTheirs, { color: colors.foreground }]}>{item.decrypted_content || item.encrypted_content}</Text>
                  <Text style={[styles.messageTime, { color: colors.mutedForeground }]}>
                    {getTimeDisplay(item.created_at)}
                  </Text>
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
      </MotiView>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#A08AB7" />
        <Text style={{ marginTop: 16, color: colors.mutedForeground }}>{t('chat.loadingChat')}</Text>
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
          <Image
            source={{ uri: matchProfile?.photo_url || 'https://via.placeholder.com/40' }}
            style={styles.headerAvatar}
            blurRadius={blurRadius}
            onLoad={onImageLoad}
            onError={onImageError}
          />
          <View style={styles.headerInfo}>
            <View style={styles.headerNameRow}>
              <Text style={[styles.headerName, { color: colors.foreground }]}>{matchProfile?.display_name}</Text>
              {matchProfile?.is_verified && (
                <MaterialCommunityIcons name="check-decagram" size={16} color="#3B82F6" />
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

      {/* Premium Upsell Banner */}
      {!isPremium && messages.length >= 3 && (
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

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={{ flex: 1 }}
        contentContainerStyle={[styles.messagesList, { paddingBottom: 16, paddingRight: rightSafeArea }]}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#A08AB7"
            colors={['#A08AB7']}
          />
        }
        ListEmptyComponent={
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
        }
      />

      {/* Intro Messages */}
      {isPremium && (
        <IntroMessages
          visible={showIntroMessages}
          matchName={matchProfile?.display_name || ''}
          compatibilityScore={matchProfile?.compatibility_score}
          distance={matchProfile?.distance}
          occupation={matchProfile?.occupation}
          city={matchProfile?.location_city}
          onSelectMessage={handleSelectMessage}
          onClose={() => setShowIntroMessages(false)}
        />
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
            <MaterialCommunityIcons name="image-outline" size={24} color={sending ? colors.mutedForeground : "#A08AB7"} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.voiceButton, { backgroundColor: isDarkColorScheme ? '#2D2D30' : '#F3F4F6' }]}
            onPress={handleVoiceRecordStart}
            onLongPress={handleVoiceRecordStart}
            disabled={sending}
          >
            <MaterialCommunityIcons name="microphone" size={24} color={sending ? colors.mutedForeground : "#A08AB7"} />
          </TouchableOpacity>

          <View style={[styles.inputWrapper, { backgroundColor: isDarkColorScheme ? '#2D2D30' : '#F3F4F6' }]}>
            <TextInput
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
                Linking.openURL(storeUrl);
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
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  messageBubbleGradient: {
    padding: 12,
  },
  messageTextMine: {
    fontSize: 15,
    color: '#fff',
    lineHeight: 20,
  },
  messageTextTheirs: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 20,
  },
  messageTime: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  messageTimeMine: {
    color: 'rgba(255,255,255,0.8)',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
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
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 12,
    gap: 8,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  imageButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  voiceButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
    maxHeight: 100,
  },
  input: {
    fontSize: 15,
    color: '#111827',
    lineHeight: 20,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    width: 40,
    height: 40,
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
    padding: 12,
    minWidth: 200,
  },
  voiceMessageBubbleTheirs: {
    padding: 12,
    minWidth: 200,
  },
  voiceMessageContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  voiceMessageInfo: {
    flex: 1,
  },
  voiceWaveform: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 30,
    marginBottom: 4,
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
});
