import { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, RefreshControl, ActivityIndicator, StyleSheet, Alert, Modal, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import PremiumPaywall from '@/components/premium/PremiumPaywall';

interface Conversation {
  match_id: string;
  profile: {
    id: string;
    display_name: string;
    age: number;
    photo_url?: string;
    is_verified?: boolean;
  };
  last_message?: {
    encrypted_content: string;
    created_at: string;
    sender_profile_id: string;
    read_at: string | null;
  };
  unread_count: number;
  is_muted?: boolean;
  is_archived?: boolean;
  is_pinned?: boolean;
}

export default function Messages() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const insets = useSafeAreaInsets();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [showActionSheet, setShowActionSheet] = useState(false);

  useEffect(() => {
    loadCurrentProfile();
  }, []);

  useEffect(() => {
    if (currentProfileId) {
      loadConversations();
      subscribeToMessages();
    }
  }, [currentProfileId, showArchived]);

  const loadCurrentProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setCurrentProfileId(data.id);
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const loadConversations = async () => {
    try {
      if (!currentProfileId) return;

      // Get all matches (filtered by archived status)
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select('id, profile1_id, profile2_id, is_muted, is_archived, is_pinned')
        .or(`profile1_id.eq.${currentProfileId},profile2_id.eq.${currentProfileId}`)
        .eq('status', 'active')
        .eq('is_archived', showArchived);

      if (matchesError) throw matchesError;

      // For each match, get last message and profile
      const conversationsData = await Promise.all(
        (matches || []).map(async (match) => {
          const otherProfileId =
            match.profile1_id === currentProfileId ? match.profile2_id : match.profile1_id;

          // Get profile
          const { data: profile } = await supabase
            .from('profiles')
            .select(`
              id,
              display_name,
              age,
              is_verified,
              photos (
                url,
                is_primary,
                display_order
              )
            `)
            .eq('id', otherProfileId)
            .single();

          // Get last message
          const { data: lastMessage } = await supabase
            .from('messages')
            .select('encrypted_content, created_at, sender_profile_id, read_at')
            .eq('match_id', match.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          // Get unread count
          const { count: unreadCount } = await supabase
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('match_id', match.id)
            .eq('receiver_profile_id', currentProfileId)
            .is('read_at', null);

          const photos = profile?.photos?.sort((a: any, b: any) => a.display_order - b.display_order);
          const primaryPhoto = photos?.find((p: any) => p.is_primary) || photos?.[0];

          return {
            match_id: match.id,
            profile: {
              id: profile?.id || '',
              display_name: profile?.display_name || 'Unknown',
              age: profile?.age || 0,
              photo_url: primaryPhoto?.url,
              is_verified: profile?.is_verified,
            },
            last_message: lastMessage || undefined,
            unread_count: unreadCount || 0,
            is_muted: match.is_muted || false,
            is_archived: match.is_archived || false,
            is_pinned: match.is_pinned || false,
          };
        })
      );

      // Sort: pinned first, then by last message time (most recent first)
      const sorted = conversationsData.sort((a, b) => {
        // Pinned conversations always come first
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;

        // Then sort by last message time
        if (!a.last_message) return 1;
        if (!b.last_message) return -1;
        return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
      });

      setConversations(sorted);
    } catch (error: any) {
      console.error('Error loading conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel('messages-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadConversations();
  }, [currentProfileId]);

  const handleConversationPress = (conversation: Conversation) => {
    router.push(`/chat/${conversation.match_id}`);
  };

  const handleDeleteConversation = (conversation: Conversation) => {
    Alert.alert(
      'Delete Conversation',
      `Are you sure you want to delete your conversation with ${conversation.profile.display_name}? This will delete all messages in this thread.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete all messages in the conversation
              const { error: messagesError } = await supabase
                .from('messages')
                .delete()
                .eq('match_id', conversation.match_id);

              if (messagesError) throw messagesError;

              // Remove from local state immediately
              setConversations((prev) => prev.filter((c) => c.match_id !== conversation.match_id));

              // Show success message
              Alert.alert('Deleted', 'Conversation has been deleted');
            } catch (error: any) {
              console.error('Error deleting conversation:', error);
              Alert.alert('Error', 'Failed to delete conversation. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleBlock = (conversation: Conversation) => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${conversation.profile.display_name}? They will no longer be able to see your profile or contact you.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              // Get current profile ID
              const { data: currentProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', user?.id)
                .single();

              if (!currentProfile) {
                throw new Error('Could not find your profile');
              }

              // Insert block record
              const { error: blockError } = await supabase
                .from('blocks')
                .insert({
                  blocker_profile_id: currentProfile.id,
                  blocked_profile_id: conversation.profile.id,
                  reason: 'Blocked from messages',
                });

              if (blockError) throw blockError;

              // Update match status to blocked
              const { error: matchError } = await supabase
                .from('matches')
                .update({ status: 'blocked' })
                .eq('id', conversation.match_id);

              if (matchError) throw matchError;

              // Remove from local state
              setConversations((prev) => prev.filter((c) => c.match_id !== conversation.match_id));

              Alert.alert('Blocked', `You have blocked ${conversation.profile.display_name}`);
            } catch (error: any) {
              console.error('Error blocking user:', error);
              Alert.alert('Error', 'Failed to block user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleReport = (conversation: Conversation) => {
    Alert.prompt(
      'Report User',
      `Why are you reporting ${conversation.profile.display_name}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Submit',
          onPress: async (reason) => {
            if (!reason || reason.trim() === '') {
              Alert.alert('Error', 'Please provide a reason for reporting.');
              return;
            }

            try {
              // Get current profile ID
              const { data: currentProfile } = await supabase
                .from('profiles')
                .select('id')
                .eq('user_id', user?.id)
                .single();

              if (!currentProfile) {
                throw new Error('Could not find your profile');
              }

              // Insert report
              const { error } = await supabase
                .from('reports')
                .insert({
                  reporter_profile_id: currentProfile.id,
                  reported_profile_id: conversation.profile.id,
                  reason: reason.trim(),
                  status: 'pending',
                });

              if (error) throw error;

              Alert.alert(
                'Report Submitted',
                'Thank you for helping keep Accord safe. Our team will review this report.'
              );
            } catch (error: any) {
              console.error('Error reporting user:', error);
              Alert.alert('Error', 'Failed to submit report. Please try again.');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const handleMuteToggle = async (conversation: Conversation) => {
    try {
      const newMutedState = !conversation.is_muted;

      const { error } = await supabase
        .from('matches')
        .update({ is_muted: newMutedState })
        .eq('id', conversation.match_id);

      if (error) throw error;

      // Update local state
      setConversations((prev) =>
        prev.map((c) =>
          c.match_id === conversation.match_id ? { ...c, is_muted: newMutedState } : c
        )
      );

      Alert.alert('Success', `Notifications ${newMutedState ? 'muted' : 'unmuted'} for ${conversation.profile.display_name}`);
    } catch (error: any) {
      console.error('Error toggling mute:', error);
      Alert.alert('Error', 'Failed to update mute status. Please try again.');
    }
  };

  const handleArchiveToggle = async (conversation: Conversation) => {
    try {
      const newArchivedState = !conversation.is_archived;

      const { error } = await supabase
        .from('matches')
        .update({ is_archived: newArchivedState })
        .eq('id', conversation.match_id);

      if (error) throw error;

      // Remove from current view immediately
      setConversations((prev) => prev.filter((c) => c.match_id !== conversation.match_id));

      Alert.alert('Success', `Conversation ${newArchivedState ? 'archived' : 'unarchived'}`);
    } catch (error: any) {
      console.error('Error toggling archive:', error);
      Alert.alert('Error', 'Failed to update archive status. Please try again.');
    }
  };

  const handlePinToggle = async (conversation: Conversation) => {
    try {
      const newPinnedState = !conversation.is_pinned;

      const { error } = await supabase
        .from('matches')
        .update({ is_pinned: newPinnedState })
        .eq('id', conversation.match_id);

      if (error) throw error;

      // Update local state and re-sort
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.match_id === conversation.match_id ? { ...c, is_pinned: newPinnedState } : c
        );

        // Re-sort: pinned first, then by last message time
        return updated.sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          if (!a.last_message) return 1;
          if (!b.last_message) return -1;
          return new Date(b.last_message.created_at).getTime() - new Date(a.last_message.created_at).getTime();
        });
      });

      Alert.alert('Success', `Conversation ${newPinnedState ? 'pinned' : 'unpinned'}`);
    } catch (error: any) {
      console.error('Error toggling pin:', error);
      Alert.alert('Error', 'Failed to update pin status. Please try again.');
    }
  };

  const handleMarkAsUnread = async (conversation: Conversation) => {
    try {
      if (!conversation.last_message) return;

      // Mark the last message as unread
      const { error } = await supabase
        .from('messages')
        .update({ read_at: null })
        .eq('match_id', conversation.match_id)
        .eq('receiver_profile_id', currentProfileId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      // Reload conversations to update unread count
      await loadConversations();

      Alert.alert('Success', 'Marked as unread');
    } catch (error: any) {
      console.error('Error marking as unread:', error);
      Alert.alert('Error', 'Failed to mark as unread. Please try again.');
    }
  };

  const handleConversationLongPress = (conversation: Conversation) => {
    setSelectedConversation(conversation);
    setShowActionSheet(true);
  };

  const handleActionSelect = (action: string) => {
    if (!selectedConversation) return;

    setShowActionSheet(false);

    // Small delay to allow modal to close smoothly before action
    setTimeout(() => {
      switch (action) {
        case 'view_profile':
          router.push(`/profile/${selectedConversation.profile.id}`);
          break;
        case 'pin':
          handlePinToggle(selectedConversation);
          break;
        case 'mute':
          handleMuteToggle(selectedConversation);
          break;
        case 'mark_unread':
          handleMarkAsUnread(selectedConversation);
          break;
        case 'archive':
          handleArchiveToggle(selectedConversation);
          break;
        case 'report':
          handleReport(selectedConversation);
          break;
        case 'block':
          handleBlock(selectedConversation);
          break;
        case 'delete':
          handleDeleteConversation(selectedConversation);
          break;
      }
    }, 100);
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return `${Math.floor(seconds / 604800)}w ago`;
  };

  const renderUpgradeCard = () => {
    // Only show for free users with at least 2 conversations
    if (isPremium || conversations.length < 2) return null;

    return (
      <MotiView
        from={{ opacity: 0, scale: 0.95, translateY: -10 }}
        animate={{ opacity: 1, scale: 1, translateY: 0 }}
        transition={{ type: 'spring', delay: 200 }}
        style={styles.upgradeCardContainer}
      >
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={() => setShowPaywall(true)}
        >
          <LinearGradient
            colors={['#8B5CF6', '#EC4899']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.upgradeCard}
          >
            {/* Header */}
            <View style={styles.upgradeHeader}>
              <View style={styles.upgradeTitleRow}>
                <MaterialCommunityIcons name="crown" size={24} color="#FFD700" />
                <Text style={styles.upgradeTitle}>Upgrade Your Messages</Text>
              </View>
              <MaterialCommunityIcons name="close" size={20} color="rgba(255,255,255,0.8)" />
            </View>

            {/* Features */}
            <View style={styles.upgradeFeatures}>
              {[
                { icon: 'check-all', text: 'Read Receipts' },
                { icon: 'microphone', text: 'Voice Messages' },
                { icon: 'message-text', text: 'Intro Messages' },
              ].map((feature, i) => (
                <View key={i} style={styles.upgradeFeatureRow}>
                  <MaterialCommunityIcons name={feature.icon as any} size={18} color="white" />
                  <Text style={styles.upgradeFeatureText}>{feature.text}</Text>
                </View>
              ))}
            </View>

            {/* CTA */}
            <View style={styles.upgradeCTA}>
              <Text style={styles.upgradeCTAText}>Upgrade to Premium</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color="white" />
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </MotiView>
    );
  };

  const renderConversation = ({ item, index }: { item: Conversation; index: number }) => {
    const hasUnread = item.unread_count > 0;

    return (
      <MotiView
        from={{ opacity: 0, translateX: -20 }}
        animate={{ opacity: 1, translateX: 0 }}
        transition={{ type: 'timing', duration: 300, delay: index * 50 }}
      >
        <TouchableOpacity
          style={styles.conversationCard}
          onPress={() => handleConversationPress(item)}
          onLongPress={() => handleConversationLongPress(item)}
          activeOpacity={0.7}
        >
          {/* Profile Photo */}
          <View style={styles.photoContainer}>
            <Image
              source={{ uri: item.profile.photo_url || 'https://via.placeholder.com/64' }}
              style={styles.photo}
            />
            {item.profile.is_verified && (
              <View style={styles.verifiedBadge}>
                <MaterialCommunityIcons name="check-decagram" size={16} color="#3B82F6" />
              </View>
            )}
            {hasUnread && <View style={styles.unreadDot} />}
          </View>

          {/* Conversation Info */}
          <View style={styles.conversationInfo}>
            <View style={styles.conversationHeader}>
              <View style={styles.nameRow}>
                {item.is_pinned && (
                  <MaterialCommunityIcons name="pin" size={16} color="#8B5CF6" style={{ marginRight: 4 }} />
                )}
                <Text style={styles.conversationName} numberOfLines={1}>
                  {item.profile.display_name}
                </Text>
                {item.is_muted && (
                  <MaterialCommunityIcons name="bell-off" size={14} color="#9CA3AF" style={{ marginLeft: 6 }} />
                )}
              </View>
              {item.last_message && (
                <Text style={styles.timestamp}>{getTimeAgo(item.last_message.created_at)}</Text>
              )}
            </View>

            {/* Last Message */}
            {item.last_message ? (
              <View style={styles.messageRow}>
                <Text
                  style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]}
                  numberOfLines={2}
                >
                  {item.last_message.sender_profile_id === currentProfileId ? 'You: ' : ''}
                  {item.last_message.encrypted_content}
                </Text>
                {isPremium && item.last_message.sender_profile_id === currentProfileId && (
                  <MaterialCommunityIcons
                    name={item.last_message.read_at ? "check-all" : "check"}
                    size={16}
                    color={item.last_message.read_at ? "#3B82F6" : "#9CA3AF"}
                    style={{ marginLeft: 4 }}
                  />
                )}
                {hasUnread && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadCount}>{item.unread_count}</Text>
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.ctaRow}>
                <MaterialCommunityIcons name="chat-outline" size={14} color="#8B5CF6" />
                <Text style={styles.ctaText}>Start the conversation</Text>
              </View>
            )}
          </View>

          {/* Chevron */}
          <MaterialCommunityIcons name="chevron-right" size={24} color="#D1D5DB" />
        </TouchableOpacity>
      </MotiView>
    );
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>Your conversations</Text>
        </View>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={styles.loadingText}>Loading messages...</Text>
        </View>
      </View>
    );
  }

  // Empty state
  if (conversations.length === 0) {
    return (
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>Your conversations</Text>
        </View>

        <View style={styles.emptyContainer}>
          <MotiView
            from={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', delay: 200 }}
          >
            <View style={styles.emptyIconContainer}>
              <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.emptyIcon}>
                <MaterialCommunityIcons name="chat-outline" size={48} color="white" />
              </LinearGradient>
            </View>
            <Text style={styles.emptyTitle}>No messages yet</Text>
            <Text style={styles.emptyText}>
              Match with someone to start chatting!{'\n'}
              Your conversations will appear here.
            </Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/discover')}
            >
              <LinearGradient colors={['#8B5CF6', '#EC4899']} style={styles.emptyButtonGradient}>
                <MaterialCommunityIcons name="cards-heart" size={20} color="white" />
                <Text style={styles.emptyButtonText}>Find Matches</Text>
              </LinearGradient>
            </TouchableOpacity>
          </MotiView>
        </View>
      </View>
    );
  }

  // Conversations list
  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Messages</Text>
          <Text style={styles.headerSubtitle}>
            {showArchived ? 'Archived conversations' : `${conversations.length} ${conversations.length === 1 ? 'conversation' : 'conversations'}`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            setShowArchived(!showArchived);
            setConversations([]); // Clear to trigger reload
            setLoading(true);
          }}
          style={styles.archiveButton}
        >
          <MaterialCommunityIcons
            name={showArchived ? "inbox" : "archive"}
            size={24}
            color="white"
          />
          <Text style={styles.archiveButtonText}>
            {showArchived ? 'Active' : 'Archive'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Conversations List */}
      <FlatList
        data={conversations}
        renderItem={renderConversation}
        keyExtractor={(item) => item.match_id}
        ListHeaderComponent={renderUpgradeCard}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#8B5CF6"
            colors={['#8B5CF6']}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* Premium Paywall */}
      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        variant="premium"
        feature="read_receipts"
      />

      {/* Action Sheet Modal */}
      <Modal
        visible={showActionSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionSheet(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowActionSheet(false)}
        >
          <Pressable style={[styles.actionSheet, { paddingBottom: Math.max(insets.bottom, 20) + 20 }]} onPress={(e) => e.stopPropagation()}>
            {/* Header */}
            <View style={styles.actionSheetHeader}>
              <Text style={styles.actionSheetTitle}>
                {selectedConversation?.profile.display_name}
              </Text>
              <Pressable onPress={() => setShowActionSheet(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#9CA3AF" />
              </Pressable>
            </View>

            {/* Actions */}
            <View style={styles.actionsList}>
              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleActionSelect('view_profile')}
              >
                <MaterialCommunityIcons name="account" size={24} color="#6B7280" />
                <Text style={styles.actionText}>View Profile</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#D1D5DB" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleActionSelect('pin')}
              >
                <MaterialCommunityIcons
                  name="pin"
                  size={24}
                  color={selectedConversation?.is_pinned ? '#8B5CF6' : '#6B7280'}
                />
                <Text style={styles.actionText}>
                  {selectedConversation?.is_pinned ? 'Unpin Conversation' : 'Pin Conversation'}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#D1D5DB" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleActionSelect('mute')}
              >
                <MaterialCommunityIcons
                  name={selectedConversation?.is_muted ? 'bell-ring' : 'bell-off'}
                  size={24}
                  color="#6B7280"
                />
                <Text style={styles.actionText}>
                  {selectedConversation?.is_muted ? 'Unmute Notifications' : 'Mute Notifications'}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#D1D5DB" />
              </TouchableOpacity>

              {selectedConversation?.last_message && selectedConversation.unread_count === 0 && (
                <TouchableOpacity
                  style={styles.actionItem}
                  onPress={() => handleActionSelect('mark_unread')}
                >
                  <MaterialCommunityIcons name="email-mark-as-unread" size={24} color="#6B7280" />
                  <Text style={styles.actionText}>Mark as Unread</Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color="#D1D5DB" />
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleActionSelect('archive')}
              >
                <MaterialCommunityIcons
                  name={showArchived ? 'inbox' : 'archive'}
                  size={24}
                  color="#6B7280"
                />
                <Text style={styles.actionText}>
                  {showArchived ? 'Unarchive' : 'Archive'}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#D1D5DB" />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionItem}
                onPress={() => handleActionSelect('report')}
              >
                <MaterialCommunityIcons name="flag" size={24} color="#6B7280" />
                <Text style={styles.actionText}>Report</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#D1D5DB" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionItem, styles.actionItemDanger]}
                onPress={() => handleActionSelect('block')}
              >
                <MaterialCommunityIcons name="block-helper" size={24} color="#EF4444" />
                <Text style={[styles.actionText, styles.actionTextDanger]}>Block</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#EF4444" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionItem, styles.actionItemDanger]}
                onPress={() => handleActionSelect('delete')}
              >
                <MaterialCommunityIcons name="delete" size={24} color="#EF4444" />
                <Text style={[styles.actionText, styles.actionTextDanger]}>Delete Conversation</Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    backgroundColor: '#8B5CF6',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  archiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  archiveButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyIconContainer: {
    marginBottom: 24,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emptyButton: {
    borderRadius: 28,
    overflow: 'hidden',
  },
  emptyButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 16,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  photoContainer: {
    position: 'relative',
  },
  photo: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E5E7EB',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#fff',
  },
  conversationInfo: {
    flex: 1,
    gap: 6,
  },
  conversationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  conversationName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
    flexShrink: 1,
  },
  timestamp: {
    fontSize: 13,
    color: '#9CA3AF',
    marginLeft: 8,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lastMessage: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  lastMessageUnread: {
    color: '#111827',
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: '#EF4444',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  ctaText: {
    fontSize: 14,
    color: '#8B5CF6',
    fontWeight: '500',
  },
  upgradeCardContainer: {
    marginBottom: 16,
  },
  upgradeCard: {
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  upgradeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  upgradeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  upgradeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  upgradeFeatures: {
    gap: 12,
  },
  upgradeFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  upgradeFeatureText: {
    fontSize: 15,
    color: 'white',
    fontWeight: '500',
  },
  upgradeCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'white',
    paddingVertical: 14,
    borderRadius: 14,
    marginTop: 4,
  },
  upgradeCTAText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#8B5CF6',
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
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
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
    flex: 1,
    fontSize: 16,
    color: '#374151',
  },
  actionTextDanger: {
    color: '#EF4444',
  },
});
