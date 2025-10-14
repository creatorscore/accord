import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
  Alert,
  RefreshControl,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { sendMessageNotification } from '@/lib/notifications';
import BlockModal from '@/components/safety/BlockModal';
import ReportModal from '@/components/safety/ReportModal';
import PremiumPaywall from '@/components/premium/PremiumPaywall';
import IntroMessages from '@/components/messaging/IntroMessages';

interface Message {
  id: string;
  encrypted_content: string;
  sender_profile_id: string;
  receiver_profile_id: string;
  created_at: string;
  read_at: string | null;
  content_type: 'text' | 'image' | 'voice';
  media_url?: string;
  voice_duration?: number;
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
}

export default function Chat() {
  const { matchId } = useLocalSearchParams();
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const flatListRef = useRef<FlatList>(null);

  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [currentProfileName, setCurrentProfileName] = useState<string>('');
  const [matchProfile, setMatchProfile] = useState<MatchProfile | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
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

  useEffect(() => {
    loadCurrentProfile();
    setupAudio();
    return () => {
      cleanupAudio();
    };
  }, []);

  useEffect(() => {
    if (currentProfileId) {
      loadMatchProfile();
      loadMessages();
      subscribeToMessages();
      markMessagesAsRead();
    }
  }, [currentProfileId]);

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
        .select('id, display_name')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setCurrentProfileId(data.id);
      setCurrentProfileName(data.display_name);
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const loadMatchProfile = async () => {
    try {
      console.log('🔍 Loading match profile for match:', matchId);

      // Get match details
      const { data: matchData, error: matchError } = await supabase
        .from('matches')
        .select('profile1_id, profile2_id')
        .eq('id', matchId)
        .single();

      console.log('Match data:', { matchData, matchError });

      if (matchError) throw matchError;

      // Determine other profile ID
      const otherProfileId =
        matchData.profile1_id === currentProfileId
          ? matchData.profile2_id
          : matchData.profile1_id;

      console.log('Other profile ID:', otherProfileId);

      // Get profile details with additional data for intro messages
      const { data: profile, error: profileError } = await supabase
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
          photos (
            url,
            is_primary,
            display_order
          )
        `)
        .eq('id', otherProfileId)
        .single();

      console.log('Profile data:', { profile, profileError });

      if (profileError) throw profileError;

      const photos = profile.photos?.sort((a: any, b: any) => a.display_order - b.display_order);
      const primaryPhoto = photos?.find((p: any) => p.is_primary) || photos?.[0];

      // Calculate distance if both profiles have location
      let distance = null;
      if (profile.latitude && profile.longitude) {
        // Get current user's location
        const { data: currentUserData } = await supabase
          .from('profiles')
          .select('latitude, longitude')
          .eq('id', currentProfileId)
          .single();

        if (currentUserData?.latitude && currentUserData?.longitude) {
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
      }

      // Get compatibility score from match
      const { data: matchCompatibility } = await supabase
        .from('matches')
        .select('compatibility_score')
        .eq('id', matchId)
        .single();

      const matchProfileData = {
        id: profile.id,
        display_name: profile.display_name,
        age: profile.age,
        photo_url: primaryPhoto?.url,
        is_verified: profile.is_verified,
        occupation: profile.occupation,
        location_city: profile.location_city,
        compatibility_score: matchCompatibility?.compatibility_score,
        distance: distance,
      };

      console.log('✅ Match profile loaded:', matchProfileData);
      setMatchProfile(matchProfileData);
    } catch (error: any) {
      console.error('❌ Error loading match profile:', error);
      Alert.alert('Error', 'Failed to load chat. Please try again.');
      router.back();
    }
  };

  const loadMessages = async () => {
    try {
      console.log('Loading messages for match:', matchId);
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('match_id', matchId)
        .order('created_at', { ascending: true });

      console.log('Messages query result:', { data, error, count: data?.length });

      if (error) {
        console.error('ERROR LOADING MESSAGES:', error);
        throw error;
      }

      setMessages(data || []);
    } catch (error: any) {
      console.error('CATCH Error loading messages:', error);
      Alert.alert('Error', 'Failed to load messages: ' + error.message);
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
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
          // Mark as read if message is for current user
          if (payload.new.receiver_profile_id === currentProfileId) {
            markMessageAsRead(payload.new.id);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const markMessagesAsRead = async () => {
    if (!currentProfileId) return;

    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('match_id', matchId)
        .eq('receiver_profile_id', currentProfileId)
        .is('read_at', null);
    } catch (error: any) {
      console.error('Error marking messages as read:', error);
    }
  };

  const markMessageAsRead = async (messageId: string) => {
    try {
      await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('id', messageId);
    } catch (error: any) {
      console.error('Error marking message as read:', error);
    }
  };

  const handleSendMessage = async () => {
    console.log('🚀 SEND BUTTON PRESSED!');
    console.log('New message:', newMessage);
    console.log('Current profile ID:', currentProfileId);
    console.log('Match profile:', matchProfile);

    if (!newMessage.trim() || !currentProfileId || !matchProfile || !user) {
      console.log('❌ VALIDATION FAILED - Missing required data');
      return;
    }

    const messageContent = newMessage.trim();
    setNewMessage('');
    setSending(true);
    Keyboard.dismiss();

    try {
      console.log('=== SENDING MESSAGE ===');
      console.log('Match ID:', matchId);
      console.log('Sender ID:', currentProfileId);
      console.log('Receiver ID:', matchProfile.id);
      console.log('Content:', messageContent);

      // Send message (plain text for MVP)
      const { data, error } = await supabase.from('messages').insert({
        match_id: matchId,
        sender_profile_id: currentProfileId,
        receiver_profile_id: matchProfile.id,
        encrypted_content: messageContent,
        content_type: 'text',
      }).select();

      console.log('Insert result:', { data, error });

      if (error) {
        console.error('DATABASE ERROR:', error);
        throw error;
      }

      console.log('Message sent successfully!');

      // Add message to UI immediately (optimistic update)
      if (data && data[0]) {
        console.log('Adding message to UI:', data[0]);
        setMessages((prev) => [...prev, data[0] as Message]);
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
      Alert.alert('Error', 'Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleImagePick = async () => {
    if (!currentProfileId || !matchProfile || !user) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        setSending(true);

        try {
          // Upload image to Supabase Storage
          const fileExt = asset.uri.split('.').pop();
          const fileName = `${matchId}_${Date.now()}.${fileExt}`;
          const filePath = `chat-images/${fileName}`;

          // Read file as ArrayBuffer (React Native compatible)
          const response = await fetch(asset.uri);
          const arrayBuffer = await response.arrayBuffer();

          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('chat-media')
            .upload(filePath, arrayBuffer, {
              contentType: asset.mimeType || 'image/jpeg',
              upsert: false,
            });

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('chat-media')
            .getPublicUrl(filePath);

          // Send image message
          const { error: messageError } = await supabase.from('messages').insert({
            match_id: matchId,
            sender_profile_id: currentProfileId,
            receiver_profile_id: matchProfile.id,
            encrypted_content: '[Photo]',
            content_type: 'image',
            media_url: publicUrl,
          });

          if (messageError) throw messageError;

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
          Alert.alert('Error', 'Failed to send photo. Please try again.');
        } finally {
          setSending(false);
        }
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick photo. Please try again.');
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
        Alert.alert('Permission Required', 'Please enable microphone access to send voice messages.');
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

      // Auto-stop at 2 minutes
      setTimeout(() => {
        if (isRecording) {
          handleVoiceRecordStop();
        }
      }, 120000);
    } catch (error: any) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
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

      setIsRecording(false);
      const duration = recordingDuration;
      setRecordingDuration(0);

      if (!uri) {
        Alert.alert('Error', 'Failed to record voice message.');
        return;
      }

      // Upload and send
      await handleVoiceSend(uri, duration);
    } catch (error: any) {
      console.error('Error stopping recording:', error);
      Alert.alert('Error', 'Failed to stop recording. Please try again.');
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
      Alert.alert('Error', 'Failed to send voice message. Please try again.');
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
      Alert.alert('Error', 'Failed to play voice message.');
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

      Alert.alert('Blocked', `You have blocked ${matchProfile.display_name}`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (error) {
      console.error('Error blocking user:', error);
      Alert.alert('Error', 'Failed to block user. Please try again.');
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
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    }
  };

  const handleDeleteMessage = async (message: Message) => {
    if (!isPremium) {
      setShowPaywall(true);
      return;
    }

    if (message.sender_profile_id !== currentProfileId) {
      Alert.alert('Cannot Delete', 'You can only delete your own messages.');
      return;
    }

    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
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
              Alert.alert('Error', 'Failed to delete message. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleMessageLongPress = (message: Message) => {
    if (message.sender_profile_id !== currentProfileId) return;

    setSelectedMessage(message);
    Alert.alert(
      'Message Options',
      'What would you like to do?',
      [
        {
          text: 'Delete Message',
          style: 'destructive',
          onPress: () => handleDeleteMessage(message),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
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
          text: 'Cancel',
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

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;

    // Format as time if today, date if older
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    }

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    if (!item) {
      console.error('NULL ITEM in renderMessage');
      return null;
    }

    const isMine = item.sender_profile_id === currentProfileId;
    const showAvatar = !isMine && (index === messages.length - 1 || messages[index + 1]?.sender_profile_id !== item.sender_profile_id);

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() => handleMessageLongPress(item)}
        delayLongPress={400}
      >
        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300 }}
          style={[styles.messageRow, isMine && styles.messageRowMine]}
        >
        {/* Avatar for received messages */}
        {showAvatar && !isMine && (
          <Image
            source={{ uri: matchProfile?.photo_url || 'https://via.placeholder.com/36' }}
            style={styles.messageAvatar}
          />
        )}
        {!showAvatar && !isMine && <View style={styles.messageAvatarSpacer} />}

        {/* Message Bubble */}
        <View style={[styles.messageBubble, isMine ? styles.messageBubbleMine : styles.messageBubbleTheirs]}>
          {item.content_type === 'image' && item.media_url ? (
            // Image message
            <View>
              {isMine ? (
                <LinearGradient
                  colors={['#8B5CF6', '#EC4899']}
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
            </View>
          ) : item.content_type === 'voice' && item.media_url ? (
            // Voice message
            <TouchableOpacity onPress={() => handleVoicePlay(item)} activeOpacity={0.7}>
              {isMine ? (
                <LinearGradient
                  colors={['#8B5CF6', '#EC4899']}
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
                      color="#8B5CF6"
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
                  colors={['#8B5CF6', '#EC4899']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.messageBubbleGradient}
                >
                  <Text style={styles.messageTextMine}>{item.encrypted_content}</Text>
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
                  <Text style={styles.messageTextTheirs}>{item.encrypted_content}</Text>
                  <Text style={styles.messageTime}>
                    {getTimeDisplay(item.created_at)}
                  </Text>
                </>
              )}
            </>
          )}
        </View>
      </MotiView>
      </TouchableOpacity>
    );
  };

  if (loading || !matchProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8B5CF6" />
        <Text style={{ marginTop: 16, color: '#6B7280' }}>
          {!matchProfile ? 'Loading chat...' : 'Loading messages...'}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerProfile}
          onPress={() => router.push(`/profile/${matchProfile?.id}`)}
        >
          <Image
            source={{ uri: matchProfile?.photo_url || 'https://via.placeholder.com/40' }}
            style={styles.headerAvatar}
          />
          <View style={styles.headerInfo}>
            <View style={styles.headerNameRow}>
              <Text style={styles.headerName}>{matchProfile?.display_name}</Text>
              {matchProfile?.is_verified && (
                <MaterialCommunityIcons name="check-decagram" size={16} color="#3B82F6" />
              )}
            </View>
            <View style={styles.encryptionRow}>
              <MaterialCommunityIcons name="shield-check" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={styles.encryptionText}>Secure messaging</Text>
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.headerRight} onPress={showActionMenu}>
          <MaterialCommunityIcons name="dots-vertical" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Premium Upsell Banner */}
      {!isPremium && messages.length >= 3 && (
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setShowPaywall(true)}
          style={styles.premiumBanner}
        >
          <LinearGradient
            colors={['#8B5CF6', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumBannerGradient}
          >
            <View style={styles.premiumBannerContent}>
              <MaterialCommunityIcons name="crown" size={20} color="#FFD700" />
              <Text style={styles.premiumBannerText}>
                Unlock read receipts, voice messages & delete messages
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="rgba(255,255,255,0.8)" />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* Messages List */}
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.messagesList}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#8B5CF6"
            colors={['#8B5CF6']}
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
                <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.emptyIcon}>
                  <MaterialCommunityIcons name="message-text-outline" size={40} color="white" />
                </LinearGradient>
              </View>
              <Text style={styles.emptyTitle}>Say hello!</Text>
              <Text style={styles.emptyText}>
                You matched with {matchProfile?.display_name}. {'\n'}
                Start the conversation!
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
        <View style={styles.recordingContainer}>
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
            <Text style={styles.recordingHint}>Slide to cancel</Text>
          </View>

          <TouchableOpacity style={styles.stopButton} onPress={handleVoiceRecordStop}>
            <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.stopButtonGradient}>
              <MaterialCommunityIcons name="send" size={20} color="white" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      ) : (
        // Normal input UI
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.imageButton} onPress={handleImagePick} disabled={sending}>
            <MaterialCommunityIcons name="image-outline" size={24} color={sending ? "#D1D5DB" : "#8B5CF6"} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.voiceButton}
            onPress={handleVoiceRecordStart}
            onLongPress={handleVoiceRecordStart}
            disabled={sending}
          >
            <MaterialCommunityIcons name="microphone" size={24} color={sending ? "#D1D5DB" : "#8B5CF6"} />
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.input}
              placeholder="Type a message..."
              placeholderTextColor="#9CA3AF"
              value={newMessage}
              onChangeText={(text) => {
                console.log('TEXT INPUT CHANGED:', text);
                setNewMessage(text);
              }}
              onFocus={() => console.log('TEXT INPUT FOCUSED')}
              onBlur={() => console.log('TEXT INPUT BLURRED')}
              multiline
              maxLength={1000}
              editable={!sending}
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
              <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.sendButtonGradient}>
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

      {/* Premium Paywall */}
      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        variant="premium"
        feature="messaging"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    backgroundColor: '#8B5CF6',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    gap: 12,
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
    color: '#fff',
  },
  encryptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  encryptionText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  headerRight: {
    width: 40,
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
    padding: 16,
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
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
  },
  messageAvatarSpacer: {
    width: 32,
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
});
