import { useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { optimizeImage, uriToArrayBuffer } from '@/lib/image-optimization';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string, description: string, evidenceUrls?: string[]) => Promise<void>;
  profileName: string;
}

const REPORT_REASONS = [
  { id: 'blackmail', label: 'Blackmail / Screenshot sharing', icon: 'shield-alert', requiresEvidence: true },
  { id: 'harassment', label: 'Harassment or bullying', icon: 'alert-circle' },
  { id: 'fake_profile', label: 'Fake profile or scam', icon: 'account-alert' },
  { id: 'inappropriate_content', label: 'Inappropriate photos or messages', icon: 'image-off' },
  { id: 'spam', label: 'Spam or solicitation', icon: 'email-alert' },
  { id: 'underage', label: 'Underage user', icon: 'account-cancel' },
  { id: 'safety_concern', label: 'Safety concern', icon: 'shield-alert' },
  { id: 'other', label: 'Other', icon: 'dots-horizontal' },
];

export default function ReportModal({
  visible,
  onClose,
  onSubmit,
  profileName,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [evidencePhotos, setEvidencePhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const handlePickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please allow access to your photo library to upload evidence.');
        return;
      }

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.8,
        exif: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        setUploadingPhoto(true);

        // Upload each selected image
        const uploadedUrls: string[] = [];
        for (const asset of result.assets) {
          try {
            // Optimize image
            const { optimized } = await optimizeImage(asset.uri, {
              maxWidth: 1200,
              maxHeight: 1600,
              quality: 0.8,
            });

            // Upload to Supabase Storage
            const fileName = `evidence_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
            const filePath = `report-evidence/${fileName}`;
            const arrayBuffer = await uriToArrayBuffer(optimized.uri);

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('reports')
              .upload(filePath, arrayBuffer, {
                contentType: 'image/jpeg',
                upsert: false,
              });

            if (uploadError) throw uploadError;

            // Get public URL
            const { data: { publicUrl } } = supabase.storage
              .from('reports')
              .getPublicUrl(filePath);

            uploadedUrls.push(publicUrl);
          } catch (error: any) {
            console.error('Error uploading photo:', error);
            Alert.alert('Upload Failed', 'Failed to upload one or more photos. Please try again.');
          }
        }

        // Add uploaded URLs to evidence photos
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
    if (!selectedReason || !description.trim()) return;

    // Check if blackmail report requires evidence
    const reason = REPORT_REASONS.find(r => r.id === selectedReason);
    if (reason?.requiresEvidence && evidencePhotos.length === 0) {
      Alert.alert(
        'Evidence Required',
        'Blackmail reports require screenshot evidence. Please upload at least one photo.'
      );
      return;
    }

    try {
      setSubmitting(true);
      await onSubmit(selectedReason, description.trim(), evidencePhotos);
      // Reset form
      setSelectedReason(null);
      setDescription('');
      setEvidencePhotos([]);
      onClose();
    } catch (error) {
      console.error('Error submitting report:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDescription('');
    setEvidencePhotos([]);
    onClose();
  };

  const canSubmit = selectedReason && description.trim().length >= 10;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <MotiView
          from={{ opacity: 0, translateY: 100 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'spring', damping: 20 }}
          style={styles.container}
        >
          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Report {profileName}</Text>
              <Text style={styles.subtitle}>Help us keep Accord safe</Text>
            </View>
            <TouchableOpacity onPress={handleClose} disabled={submitting}>
              <MaterialCommunityIcons name="close" size={24} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Reasons */}
            <Text style={styles.sectionTitle}>Why are you reporting this profile?</Text>
            <View style={styles.reasonsList}>
              {REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  style={[
                    styles.reasonItem,
                    selectedReason === reason.id && styles.reasonItemSelected,
                  ]}
                  onPress={() => setSelectedReason(reason.id)}
                  disabled={submitting}
                  activeOpacity={0.7}
                >
                  <View style={styles.reasonIcon}>
                    <MaterialCommunityIcons
                      name={reason.icon as any}
                      size={20}
                      color={selectedReason === reason.id ? '#9B87CE' : '#6B7280'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.reasonLabel,
                      selectedReason === reason.id && styles.reasonLabelSelected,
                    ]}
                  >
                    {reason.label}
                  </Text>
                  {selectedReason === reason.id && (
                    <MaterialCommunityIcons name="check-circle" size={20} color="#9B87CE" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Description */}
            <Text style={styles.sectionTitle}>
              Please provide details <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.textAreaContainer}>
              <TextInput
                style={styles.textArea}
                placeholder="Help us understand what happened (minimum 10 characters)"
                placeholderTextColor="#9CA3AF"
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={500}
                editable={!submitting}
              />
              <Text style={styles.charCount}>{description.length}/500</Text>
            </View>

            {/* Photo Evidence Upload */}
            <View style={styles.evidenceSection}>
              <View style={styles.evidenceHeader}>
                <Text style={styles.sectionTitle}>
                  Evidence Photos
                  {REPORT_REASONS.find(r => r.id === selectedReason)?.requiresEvidence && (
                    <Text style={styles.required}> *</Text>
                  )}
                </Text>
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handlePickImage}
                  disabled={submitting || uploadingPhoto}
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

              {selectedReason === 'blackmail' && (
                <View style={styles.evidenceInfo}>
                  <MaterialCommunityIcons name="information" size={16} color="#3B82F6" />
                  <Text style={styles.evidenceInfoText}>
                    Upload screenshots showing your profile with watermark visible. This helps us identify who shared it.
                  </Text>
                </View>
              )}

              {/* Evidence Photos Grid */}
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

            {/* Info */}
            <View style={styles.infoBox}>
              <MaterialCommunityIcons name="information" size={20} color="#3B82F6" />
              <Text style={styles.infoText}>
                Reports are reviewed by our team. False reports may result in account suspension.
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
            >
              {submitting ? (
                <ActivityIndicator color="white" />
              ) : (
                <LinearGradient
                  colors={canSubmit ? ['#EF4444', '#DC2626'] : ['#D1D5DB', '#9CA3AF']}
                  style={styles.submitButtonGradient}
                >
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                </LinearGradient>
              )}
            </TouchableOpacity>
          </View>
        </MotiView>
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 0,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  required: {
    color: '#EF4444',
  },
  reasonsList: {
    gap: 8,
    marginBottom: 24,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reasonItemSelected: {
    backgroundColor: '#F3E8FF',
    borderColor: '#9B87CE',
  },
  reasonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reasonLabel: {
    flex: 1,
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  reasonLabelSelected: {
    color: '#111827',
    fontWeight: '600',
  },
  textAreaContainer: {
    marginBottom: 16,
  },
  textArea: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#111827',
    minHeight: 120,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  charCount: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'right',
    marginTop: 8,
  },
  infoBox: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#1E40AF',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  submitButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonGradient: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  evidenceSection: {
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
