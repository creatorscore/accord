import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface BanInfo {
  id: string;
  ban_reason: string;
  is_permanent: boolean;
  expires_at: string | null;
  ban_duration_hours: number | null;
  user_message: string | null;
  appeal_status: string;
  appeal_message: string | null;
  appeal_submitted_at: string | null;
  appeal_response: string | null;
}

export default function BannedScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ email?: string; userId?: string }>();
  const [loading, setLoading] = useState(true);
  const [banInfo, setBanInfo] = useState<BanInfo | null>(null);
  const [appealMessage, setAppealMessage] = useState('');
  const [submittingAppeal, setSubmittingAppeal] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<string | null>(null);

  useEffect(() => {
    loadBanInfo();
  }, [params.email, params.userId]);

  // Countdown timer for temporary bans
  useEffect(() => {
    if (!banInfo?.expires_at) return;

    const updateCountdown = () => {
      const now = new Date();
      const expiresAt = new Date(banInfo.expires_at!);
      const diff = expiresAt.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeRemaining('Expired');
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) {
        setTimeRemaining(`${days}d ${hours}h ${minutes}m`);
      } else if (hours > 0) {
        setTimeRemaining(`${hours}h ${minutes}m`);
      } else {
        setTimeRemaining(`${minutes}m`);
      }
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [banInfo?.expires_at]);

  const loadBanInfo = async () => {
    try {
      setLoading(true);

      // Try to get ban info using email or user ID
      let query = supabase
        .from('bans')
        .select(`
          id,
          ban_reason,
          is_permanent,
          expires_at,
          ban_duration_hours,
          user_message,
          appeal_status,
          appeal_message,
          appeal_submitted_at,
          appeal_response
        `)
        .is('unbanned_at', null)
        .order('created_at', { ascending: false })
        .limit(1);

      if (params.email) {
        query = query.eq('banned_email', params.email.toLowerCase());
      } else if (params.userId) {
        query = query.eq('banned_user_id', params.userId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        console.error('Error loading ban info:', error);
      }

      if (data) {
        setBanInfo(data);
      }
    } catch (error) {
      console.error('Error in loadBanInfo:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAppeal = async () => {
    if (!appealMessage.trim()) {
      Alert.alert('Error', 'Please enter your appeal message.');
      return;
    }

    if (appealMessage.trim().length < 10) {
      Alert.alert('Error', 'Please provide more detail in your appeal (at least 10 characters).');
      return;
    }

    if (!banInfo) {
      Alert.alert('Error', 'Could not find your ban record.');
      return;
    }

    setSubmittingAppeal(true);
    try {
      // Get session (if user is still authenticated)
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        // Use the edge function
        const { data, error } = await supabase.functions.invoke('submit-ban-appeal', {
          body: {
            appeal_message: appealMessage.trim(),
          },
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (error) throw error;

        Alert.alert(
          'Appeal Submitted',
          'Your appeal has been submitted. We will review it and respond as soon as possible.',
          [{ text: 'OK', onPress: loadBanInfo }]
        );
        setAppealMessage('');
      } else {
        // If not authenticated, update directly (less secure, but allows appeals)
        const { error } = await supabase
          .from('bans')
          .update({
            appeal_status: 'pending',
            appeal_message: appealMessage.trim(),
            appeal_submitted_at: new Date().toISOString(),
          })
          .eq('id', banInfo.id);

        if (error) throw error;

        Alert.alert(
          'Appeal Submitted',
          'Your appeal has been submitted. We will review it and respond as soon as possible.',
          [{ text: 'OK', onPress: loadBanInfo }]
        );
        setAppealMessage('');
      }
    } catch (error: any) {
      console.error('Error submitting appeal:', error);
      Alert.alert('Error', error.message || 'Failed to submit appeal. Please try again.');
    } finally {
      setSubmittingAppeal(false);
    }
  };

  const formatDuration = (hours: number | null) => {
    if (!hours) return 'Permanent';
    if (hours === 24) return '1 day';
    if (hours === 72) return '3 days';
    if (hours === 168) return '7 days';
    if (hours === 720) return '30 days';
    return `${hours} hours`;
  };

  const canAppeal = banInfo?.appeal_status === 'none' || !banInfo?.appeal_status;
  const hasAppealed = banInfo?.appeal_status === 'pending';
  const appealDenied = banInfo?.appeal_status === 'denied';
  const appealApproved = banInfo?.appeal_status === 'approved';

  if (loading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9B87CE" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Icon */}
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={['#EF4444', '#DC2626']}
            style={styles.iconGradient}
          >
            <MaterialCommunityIcons name="account-cancel" size={48} color="white" />
          </LinearGradient>
        </View>

        {/* Title */}
        <Text style={styles.title}>Account Restricted</Text>
        <Text style={styles.subtitle}>
          Your account has been temporarily or permanently restricted from using Accord.
        </Text>

        {/* Ban Details Card */}
        {banInfo && (
          <View style={styles.banCard}>
            {/* Duration */}
            <View style={styles.banRow}>
              <Text style={styles.banLabel}>Duration</Text>
              <View style={styles.durationContainer}>
                <Text style={[
                  styles.banValue,
                  banInfo.is_permanent && styles.permanentText
                ]}>
                  {banInfo.is_permanent ? 'Permanent' : formatDuration(banInfo.ban_duration_hours)}
                </Text>
                {!banInfo.is_permanent && timeRemaining && (
                  <Text style={styles.countdownText}>
                    {timeRemaining === 'Expired' ? 'Restriction ended' : `${timeRemaining} remaining`}
                  </Text>
                )}
              </View>
            </View>

            {/* Reason */}
            <View style={styles.banRow}>
              <Text style={styles.banLabel}>Reason</Text>
              <Text style={styles.banValue}>{banInfo.ban_reason}</Text>
            </View>

            {/* Message from Admin */}
            {banInfo.user_message && (
              <View style={styles.messageBox}>
                <MaterialCommunityIcons name="message-text" size={20} color="#6B7280" />
                <Text style={styles.messageText}>{banInfo.user_message}</Text>
              </View>
            )}
          </View>
        )}

        {/* Appeal Section */}
        <View style={styles.appealSection}>
          <Text style={styles.sectionTitle}>Appeal Your Restriction</Text>

          {canAppeal && (
            <>
              <Text style={styles.appealDescription}>
                If you believe this restriction was made in error, you may submit an appeal. Please explain your situation clearly and provide any relevant context.
              </Text>

              <TextInput
                style={styles.appealInput}
                placeholder="Explain why you believe this restriction should be lifted..."
                placeholderTextColor="#9CA3AF"
                value={appealMessage}
                onChangeText={setAppealMessage}
                multiline
                numberOfLines={5}
                maxLength={2000}
              />

              <Text style={styles.charCount}>{appealMessage.length}/2000</Text>

              <TouchableOpacity
                style={[styles.submitButton, submittingAppeal && styles.buttonDisabled]}
                onPress={handleSubmitAppeal}
                disabled={submittingAppeal}
              >
                {submittingAppeal ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="send" size={20} color="white" />
                    <Text style={styles.submitButtonText}>Submit Appeal</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {hasAppealed && (
            <View style={styles.appealStatusBox}>
              <MaterialCommunityIcons name="clock-outline" size={32} color="#F59E0B" />
              <Text style={styles.appealStatusTitle}>Appeal Pending</Text>
              <Text style={styles.appealStatusText}>
                Your appeal has been submitted and is being reviewed. We'll notify you once a decision has been made.
              </Text>
              {banInfo?.appeal_message && (
                <View style={styles.yourAppealBox}>
                  <Text style={styles.yourAppealLabel}>Your appeal:</Text>
                  <Text style={styles.yourAppealText}>"{banInfo.appeal_message}"</Text>
                </View>
              )}
            </View>
          )}

          {appealDenied && (
            <View style={[styles.appealStatusBox, styles.deniedBox]}>
              <MaterialCommunityIcons name="close-circle" size={32} color="#DC2626" />
              <Text style={[styles.appealStatusTitle, styles.deniedTitle]}>Appeal Denied</Text>
              <Text style={styles.appealStatusText}>
                After reviewing your case, we have determined that the restriction will remain in place.
              </Text>
              {banInfo?.appeal_response && (
                <View style={styles.responseBox}>
                  <Text style={styles.responseLabel}>Admin response:</Text>
                  <Text style={styles.responseText}>{banInfo.appeal_response}</Text>
                </View>
              )}
            </View>
          )}

          {appealApproved && (
            <View style={[styles.appealStatusBox, styles.approvedBox]}>
              <MaterialCommunityIcons name="check-circle" size={32} color="#10B981" />
              <Text style={[styles.appealStatusTitle, styles.approvedTitle]}>Appeal Approved</Text>
              <Text style={styles.appealStatusText}>
                Your appeal has been approved. You can now sign in to your account.
              </Text>
              <TouchableOpacity
                style={styles.signInButton}
                onPress={() => router.replace('/(auth)/sign-in')}
              >
                <Text style={styles.signInButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Contact Support */}
        <View style={styles.supportSection}>
          <Text style={styles.supportText}>
            If you have questions, contact us at{' '}
            <Text style={styles.supportEmail}>hello@joinaccord.app</Text>
          </Text>
        </View>

        {/* Back to Sign In */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.replace('/(auth)/sign-in')}
        >
          <MaterialCommunityIcons name="arrow-left" size={20} color="#6B7280" />
          <Text style={styles.backButtonText}>Back to Sign In</Text>
        </TouchableOpacity>
      </ScrollView>
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
  },
  loadingText: {
    marginTop: 12,
    color: '#6B7280',
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  banCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  banRow: {
    marginBottom: 16,
  },
  banLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  banValue: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  permanentText: {
    color: '#DC2626',
    fontWeight: '700',
  },
  durationContainer: {
    flexDirection: 'column',
  },
  countdownText: {
    fontSize: 14,
    color: '#F59E0B',
    fontWeight: '600',
    marginTop: 4,
  },
  messageBox: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    gap: 12,
    alignItems: 'flex-start',
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    color: '#374151',
    lineHeight: 22,
  },
  appealSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  appealDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: 16,
  },
  appealInput: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#111827',
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 16,
  },
  submitButton: {
    backgroundColor: '#9B87CE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  appealStatusBox: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  deniedBox: {
    backgroundColor: '#FEE2E2',
  },
  approvedBox: {
    backgroundColor: '#D1FAE5',
  },
  appealStatusTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#92400E',
    marginTop: 12,
    marginBottom: 8,
  },
  deniedTitle: {
    color: '#DC2626',
  },
  approvedTitle: {
    color: '#047857',
  },
  appealStatusText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
    lineHeight: 22,
  },
  yourAppealBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    width: '100%',
  },
  yourAppealLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#92400E',
    marginBottom: 8,
  },
  yourAppealText: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  responseBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    width: '100%',
  },
  responseLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  responseText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  signInButton: {
    backgroundColor: '#10B981',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  signInButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  supportSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  supportText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  supportEmail: {
    color: '#9B87CE',
    fontWeight: '600',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  backButtonText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
});
