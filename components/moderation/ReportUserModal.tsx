import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

interface ReportUserModalProps {
  visible: boolean;
  onClose: () => void;
  reportedProfileId: string;
  reportedProfileName: string;
}

const REPORT_REASONS = [
  {
    id: 'inappropriate_content',
    label: 'Inappropriate Content',
    icon: 'alert-circle',
    description: 'Photos, bio, or messages contain inappropriate content',
  },
  {
    id: 'harassment',
    label: 'Harassment',
    icon: 'account-alert',
    description: 'Threatening, harassing, or bullying behavior',
  },
  {
    id: 'fake_profile',
    label: 'Fake Profile',
    icon: 'account-remove',
    description: 'Profile appears to be fake or impersonating someone',
  },
  {
    id: 'scam',
    label: 'Scam or Fraud',
    icon: 'cash-remove',
    description: 'Asking for money or appears to be a scam',
  },
  {
    id: 'spam',
    label: 'Spam',
    icon: 'message-alert',
    description: 'Sending spam or promotional messages',
  },
  {
    id: 'underage',
    label: 'Underage User',
    icon: 'shield-alert',
    description: 'User appears to be under 18',
  },
  {
    id: 'hate_speech',
    label: 'Hate Speech',
    icon: 'thumb-down',
    description: 'Discriminatory or hateful language',
  },
  {
    id: 'other',
    label: 'Other',
    icon: 'dots-horizontal',
    description: 'Other reason not listed above',
  },
];

export default function ReportUserModal({
  visible,
  onClose,
  reportedProfileId,
  reportedProfileName,
}: ReportUserModalProps) {
  const { user } = useAuth();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason for reporting');
      return;
    }

    if (!user) {
      Alert.alert('Error', 'You must be logged in to report a user');
      return;
    }

    setLoading(true);

    try {
      // Get reporter's profile ID
      const { data: reporterProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (profileError) throw profileError;

      // Submit report
      const { error: reportError } = await supabase
        .from('reports')
        .insert({
          reporter_profile_id: reporterProfile.id,
          reported_profile_id: reportedProfileId,
          reason: selectedReason,
          details: details.trim() || null,
          status: 'pending',
        });

      if (reportError) throw reportError;

      Alert.alert(
        'Report Submitted',
        'Thank you for helping keep Accord safe. Our moderation team will review this report.',
        [
          {
            text: 'OK',
            onPress: () => {
              setSelectedReason(null);
              setDetails('');
              onClose();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error submitting report:', error);
      Alert.alert('Error', 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDetails('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Report {reportedProfileName}</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content}>
            <Text style={styles.subtitle}>
              Please select the reason you're reporting this user:
            </Text>

            {/* Report Reasons */}
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason.id}
                style={[
                  styles.reasonCard,
                  selectedReason === reason.id && styles.reasonCardSelected,
                ]}
                onPress={() => setSelectedReason(reason.id)}
              >
                <View style={styles.reasonIcon}>
                  <MaterialCommunityIcons
                    name={reason.icon as any}
                    size={24}
                    color={selectedReason === reason.id ? '#9B87CE' : '#6B7280'}
                  />
                </View>
                <View style={styles.reasonContent}>
                  <Text style={[
                    styles.reasonLabel,
                    selectedReason === reason.id && styles.reasonLabelSelected
                  ]}>
                    {reason.label}
                  </Text>
                  <Text style={styles.reasonDescription}>{reason.description}</Text>
                </View>
                {selectedReason === reason.id && (
                  <MaterialCommunityIcons
                    name="check-circle"
                    size={24}
                    color="#9B87CE"
                  />
                )}
              </TouchableOpacity>
            ))}

            {/* Additional Details */}
            <View style={styles.detailsSection}>
              <Text style={styles.detailsLabel}>
                Additional Details (Optional)
              </Text>
              <TextInput
                style={styles.detailsInput}
                placeholder="Provide any additional context that might help our team..."
                value={details}
                onChangeText={setDetails}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
              <Text style={styles.characterCount}>{details.length}/500</Text>
            </View>

            {/* Privacy Notice */}
            <View style={styles.noticeBox}>
              <MaterialCommunityIcons name="shield-check" size={20} color="#9B87CE" />
              <Text style={styles.noticeText}>
                Your report is anonymous. The reported user will not be notified.
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedReason || loading) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedReason || loading}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Report</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 16,
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    marginBottom: 12,
    backgroundColor: 'white',
  },
  reasonCardSelected: {
    borderColor: '#9B87CE',
    backgroundColor: '#F3E8FF',
  },
  reasonIcon: {
    marginRight: 12,
  },
  reasonContent: {
    flex: 1,
  },
  reasonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  reasonLabelSelected: {
    color: '#9B87CE',
  },
  reasonDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  detailsSection: {
    marginTop: 20,
    marginBottom: 16,
  },
  detailsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  detailsInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#111827',
    minHeight: 100,
  },
  characterCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 4,
  },
  noticeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 20,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    marginLeft: 8,
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  submitButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#9B87CE',
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
