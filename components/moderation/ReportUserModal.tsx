import React, { useState, useRef } from 'react';
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
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { optimizeImage, uriToArrayBuffer } from '@/lib/image-optimization';

interface ReportUserModalProps {
  visible: boolean;
  onClose: () => void;
  reportedProfileId: string;
  reportedProfileName: string;
}

const REPORT_REASONS = [
  {
    id: 'blackmail',
    label: 'Blackmail / Screenshot Sharing',
    icon: 'shield-alert',
    description: 'Someone shared your watermarked profile screenshot',
    requiresEvidence: true,
  },
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
  const insets = useSafeAreaInsets();
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handlePickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload evidence.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        setUploadingPhoto(true);

        const uploadedUrls: string[] = [];
        for (const asset of result.assets) {
          try {
            const { optimized } = await optimizeImage(asset.uri, {
              maxWidth: 1200,
              maxHeight: 1600,
              quality: 0.8,
            });

            const fileName = `evidence_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const filePath = `report-evidence/${fileName}`;
            const arrayBuffer = await uriToArrayBuffer(optimized.uri);

            const { error: uploadError } = await supabase.storage
              .from('reports')
              .upload(filePath, arrayBuffer, {
                contentType: 'image/jpeg',
                upsert: false,
              });

            if (uploadError) throw uploadError;

            const { data: { publicUrl } } = supabase.storage
              .from('reports')
              .getPublicUrl(filePath);

            uploadedUrls.push(publicUrl);
          } catch (error: any) {
            console.error('Error uploading photo:', error);
            Alert.alert('Upload Failed', 'Failed to upload one or more photos. Please try again.');
          }
        }

        setEvidencePhotos((prev) => [...prev, ...uploadedUrls]);
        setUploadingPhoto(false);
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select photos. Please try again.');
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setEvidencePhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason for reporting');
      return;
    }

    // Require explanation for all reports
    if (!details.trim() || details.trim().length < 20) {
      Alert.alert(
        'Explanation Required',
        'Please provide a detailed explanation (at least 20 characters) of why you are reporting this user.'
      );
      return;
    }

    // Check if blackmail report requires evidence
    const reason = REPORT_REASONS.find(r => r.id === selectedReason);
    if (reason?.requiresEvidence && evidencePhotos.length === 0) {
      Alert.alert(
        'Evidence Required',
        'Blackmail reports require screenshot evidence. Please upload at least one photo showing the watermark.'
      );
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
          evidence_urls: evidencePhotos.length > 0 ? evidencePhotos : null,
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
              setEvidencePhotos([]);
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
    setEvidencePhotos([]);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
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

            {/* Evidence Photos */}
            {selectedReason === 'blackmail' && (
              <View style={styles.evidenceSection}>
                <View style={styles.evidenceHeader}>
                  <Text style={styles.detailsLabel}>
                    Evidence Photos <Text style={{ color: '#EF4444' }}>*</Text>
                  </Text>
                  <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={handlePickImage}
                    disabled={loading || uploadingPhoto}
                  >
                    {uploadingPhoto ? (
                      <ActivityIndicator size="small" color="#9B87CE" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="camera-plus" size={20} color="#9B87CE" />
                        <Text style={styles.uploadButtonText}>Upload</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>

                <View style={styles.evidenceInfo}>
                  <MaterialCommunityIcons name="information" size={16} color="#3B82F6" />
                  <Text style={styles.evidenceInfoText}>
                    Upload screenshots showing your profile with watermark visible. Look for faint text in corners showing user ID and timestamp.
                  </Text>
                </View>

                {evidencePhotos.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoGrid}>
                    {evidencePhotos.map((uri, index) => (
                      <View key={index} style={styles.photoContainer}>
                        <Image source={{ uri }} style={styles.evidencePhoto} />
                        <TouchableOpacity
                          style={styles.removePhotoButton}
                          onPress={() => handleRemovePhoto(index)}
                        >
                          <MaterialCommunityIcons name="close-circle" size={24} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Additional Details */}
            <View style={styles.detailsSection}>
              <Text style={styles.detailsLabel}>
                Explain why you're reporting <Text style={{ color: '#EF4444' }}>*</Text>
              </Text>
              <Text style={styles.detailsHint}>
                Please describe the specific behavior or content that violates our guidelines.
              </Text>
              <TextInput
                style={[
                  styles.detailsInput,
                  details.trim().length > 0 && details.trim().length < 20 && styles.detailsInputError
                ]}
                placeholder="What did this user do? Be specific - include dates, messages, or behavior details..."
                value={details}
                onChangeText={setDetails}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
              />
              <View style={styles.detailsFooter}>
                <Text style={[
                  styles.characterCount,
                  details.trim().length > 0 && details.trim().length < 20 && { color: '#EF4444' }
                ]}>
                  {details.trim().length < 20 ? `${20 - details.trim().length} more characters needed` : `${details.length}/500`}
                </Text>
              </View>
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
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) }]}>
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
                (!selectedReason || loading || details.trim().length < 20) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedReason || loading || details.trim().length < 20}
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
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardAvoid: {
    flex: 1,
  },
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
    marginBottom: 4,
  },
  detailsHint: {
    fontSize: 12,
    color: '#6B7280',
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
  detailsInputError: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  detailsFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  characterCount: {
    fontSize: 12,
    color: '#9CA3AF',
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
  evidenceSection: {
    marginTop: 20,
    marginBottom: 16,
  },
  evidenceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F3E8FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9B87CE',
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9B87CE',
  },
  evidenceInfo: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    marginBottom: 12,
  },
  evidenceInfoText: {
    flex: 1,
    fontSize: 12,
    color: '#1E40AF',
    lineHeight: 16,
  },
  photoGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  photoContainer: {
    position: 'relative',
    marginRight: 8,
  },
  evidencePhoto: {
    width: 100,
    height: 150,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  removePhotoButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
});
