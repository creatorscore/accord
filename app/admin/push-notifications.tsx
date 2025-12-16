import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, TextInput, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import Constants from 'expo-constants';

type TargetAudience = 'all' | 'premium' | 'free' | 'verified';

export default function AdminPushNotifications() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetAudience, setTargetAudience] = useState<TargetAudience>('all');

  // Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    premiumUsers: 0,
    freeUsers: 0,
    verifiedUsers: 0,
    usersWithTokens: 0,
  });

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      loadStats();
    }
  }, [isAdmin]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      if (!data?.is_admin) {
        Alert.alert('Access Denied', 'You do not have admin privileges.');
        router.back();
        return;
      }

      setIsAdmin(true);
      setLoading(false);
    } catch (error: any) {
      console.error('Error checking admin status:', error);
      Alert.alert('Error', 'Failed to verify admin access.');
      router.back();
    }
  };

  const loadStats = async () => {
    try {
      // Get total users
      const { count: totalUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get premium users
      const { count: premiumUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .or('is_premium.eq.true,is_platinum.eq.true');

      // Get free users
      const { count: freeUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('is_premium', false)
        .eq('is_platinum', false);

      // Get verified users (photo verified)
      const { count: verifiedUsers } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('photo_verified', true);

      // Get users with push tokens
      const { count: usersWithTokens } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .not('push_token', 'is', null)
        .eq('push_enabled', true);

      setStats({
        totalUsers: totalUsers || 0,
        premiumUsers: premiumUsers || 0,
        freeUsers: freeUsers || 0,
        verifiedUsers: verifiedUsers || 0,
        usersWithTokens: usersWithTokens || 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const getRecipientCount = () => {
    switch (targetAudience) {
      case 'all':
        return stats.usersWithTokens;
      case 'premium':
        return Math.round(stats.premiumUsers * (stats.usersWithTokens / stats.totalUsers));
      case 'free':
        return Math.round(stats.freeUsers * (stats.usersWithTokens / stats.totalUsers));
      case 'verified':
        return Math.round(stats.verifiedUsers * (stats.usersWithTokens / stats.totalUsers));
      default:
        return 0;
    }
  };

  const sendNotification = async () => {
    if (!title.trim() || !body.trim()) {
      Alert.alert('Error', 'Please enter both title and message');
      return;
    }

    Alert.alert(
      'Confirm Send',
      `Send notification to ${getRecipientCount()} ${targetAudience === 'all' ? 'users' : `${targetAudience} users`}?\n\nTitle: ${title}\n\nMessage: ${body}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          style: 'destructive',
          onPress: async () => {
            try {
              setSending(true);

              const { data: { session } } = await supabase.auth.getSession();
              if (!session) {
                throw new Error('No session found');
              }

              // Get Supabase URL with fallback to app.json extra config
              const supabaseUrl =
                process.env.EXPO_PUBLIC_SUPABASE_URL ||
                Constants.expoConfig?.extra?.supabaseUrl ||
                '';

              if (!supabaseUrl) {
                throw new Error('Supabase URL not configured');
              }

              console.log('🔔 Sending notification to:', targetAudience);
              console.log('📡 URL:', `${supabaseUrl}/functions/v1/admin-send-notification`);

              // Add timeout to fetch (30 seconds)
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 30000);

              let result;
              try {
                const response = await fetch(
                  `${supabaseUrl}/functions/v1/admin-send-notification`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                      title,
                      body,
                      targetAudience,
                      data: {
                        type: 'admin_announcement',
                        screen: 'discover',
                      },
                    }),
                    signal: controller.signal,
                  }
                );

                clearTimeout(timeoutId);

                console.log('📥 Response status:', response.status);

                result = await response.json();
                console.log('📥 Response data:', result);

                if (!response.ok) {
                  throw new Error(result.error || `Server error: ${response.status}`);
                }
              } catch (fetchError: any) {
                clearTimeout(timeoutId);
                console.error('❌ Fetch error details:', fetchError);
                if (fetchError.name === 'AbortError') {
                  throw new Error('Request timed out after 30 seconds. Please try again.');
                }
                throw new Error(`Network error: ${fetchError.message}\n\nPlease check:\n1. Internet connection\n2. Supabase edge function is deployed\n3. Edge function URL is correct`);
              }

              Alert.alert(
                'Success!',
                `Notification sent to ${result.sent} users${result.failed > 0 ? ` (${result.failed} failed)` : ''}`,
                [
                  {
                    text: 'OK',
                    onPress: () => {
                      // Clear form
                      setTitle('');
                      setBody('');
                      setTargetAudience('all');
                    },
                  },
                ]
              );
            } catch (error: any) {
              console.error('Error sending notification:', error);
              Alert.alert('Error', error.message || 'Failed to send notification');
            } finally {
              setSending(false);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#9B87CE" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#9B87CE', '#B8A9DD']}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Push Notifications</Text>
        <View style={styles.headerSubtitle}>
          <MaterialCommunityIcons name="bell-ring" size={20} color="white" />
          <Text style={styles.headerSubtitleText}>
            {stats.usersWithTokens} users ready to receive
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Stats Cards */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="account-group" size={24} color="#9B87CE" />
            <Text style={styles.statValue}>{stats.totalUsers}</Text>
            <Text style={styles.statLabel}>Total Users</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="bell-check" size={24} color="#10B981" />
            <Text style={styles.statValue}>{stats.usersWithTokens}</Text>
            <Text style={styles.statLabel}>With Notifications</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="crown" size={24} color="#F59E0B" />
            <Text style={styles.statValue}>{stats.premiumUsers}</Text>
            <Text style={styles.statLabel}>Premium</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="check-decagram" size={24} color="#3B82F6" />
            <Text style={styles.statValue}>{stats.verifiedUsers}</Text>
            <Text style={styles.statLabel}>Verified</Text>
          </View>
        </View>

        {/* Compose Form */}
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Compose Notification</Text>

          {/* Target Audience */}
          <Text style={styles.label}>Target Audience</Text>
          <View style={styles.audienceButtons}>
            {[
              { value: 'all', label: 'All Users', icon: 'account-group' },
              { value: 'premium', label: 'Premium', icon: 'crown' },
              { value: 'free', label: 'Free Users', icon: 'account' },
              { value: 'verified', label: 'Verified', icon: 'check-decagram' },
            ].map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.audienceButton,
                  targetAudience === option.value && styles.audienceButtonActive,
                ]}
                onPress={() => setTargetAudience(option.value as TargetAudience)}
              >
                <MaterialCommunityIcons
                  name={option.icon as any}
                  size={20}
                  color={targetAudience === option.value ? 'white' : '#9B87CE'}
                />
                <Text
                  style={[
                    styles.audienceButtonText,
                    targetAudience === option.value && styles.audienceButtonTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.recipientCount}>
            <MaterialCommunityIcons name="send" size={16} color="#6B7280" />
            <Text style={styles.recipientCountText}>
              Will send to ~{getRecipientCount()} users
            </Text>
          </View>

          {/* Title Input */}
          <Text style={styles.label}>Notification Title</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., New Features Available!"
            placeholderTextColor="#9CA3AF"
            value={title}
            onChangeText={setTitle}
            maxLength={50}
          />
          <Text style={styles.charCount}>{title.length}/50</Text>

          {/* Body Input */}
          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Enter your message here..."
            placeholderTextColor="#9CA3AF"
            value={body}
            onChangeText={setBody}
            multiline
            numberOfLines={4}
            maxLength={200}
          />
          <Text style={styles.charCount}>{body.length}/200</Text>

          {/* Preview */}
          {(title || body) && (
            <View style={styles.preview}>
              <Text style={styles.previewLabel}>Preview:</Text>
              <View style={styles.previewCard}>
                <View style={styles.previewHeader}>
                  <MaterialCommunityIcons name="heart" size={20} color="#9B87CE" />
                  <Text style={styles.previewAppName}>Accord</Text>
                  <Text style={styles.previewTime}>now</Text>
                </View>
                {title && <Text style={styles.previewTitle}>{title}</Text>}
                {body && <Text style={styles.previewBody}>{body}</Text>}
              </View>
            </View>
          )}

          {/* Send Button */}
          <TouchableOpacity
            style={[styles.sendButton, sending && styles.sendButtonDisabled]}
            onPress={sendNotification}
            disabled={sending || !title || !body}
          >
            {sending ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <MaterialCommunityIcons name="send" size={20} color="white" />
                <Text style={styles.sendButtonText}>Send Notification</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Warning */}
        <View style={styles.warning}>
          <MaterialCommunityIcons name="alert-circle" size={20} color="#F59E0B" />
          <Text style={styles.warningText}>
            Notifications are sent immediately and cannot be recalled. Use responsibly.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
  },
  backButton: {
    marginBottom: 10,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  headerSubtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerSubtitleText: {
    fontSize: 16,
    color: 'white',
    opacity: 0.9,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
  },
  formCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  formTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: 16,
  },
  audienceButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  audienceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: 'white',
  },
  audienceButtonActive: {
    backgroundColor: '#9B87CE',
    borderColor: '#9B87CE',
  },
  audienceButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9B87CE',
  },
  audienceButtonTextActive: {
    color: 'white',
  },
  recipientCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
  },
  recipientCountText: {
    fontSize: 14,
    color: '#6B7280',
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  preview: {
    marginTop: 24,
  },
  previewLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  previewCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  previewAppName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  previewTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  previewBody: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  sendButton: {
    backgroundColor: '#9B87CE',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF3C7',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 40,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#92400E',
    lineHeight: 20,
  },
});
