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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';
import { optimizeImage, uriToArrayBuffer } from '@/lib/image-optimization';
import { useTranslation } from 'react-i18next';

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string, description: string, evidenceUrls?: string[]) => Promise<void>;
  profileName: string;
}

const REPORT_REASON_IDS = [
  { id: 'blackmail', labelKey: 'blackmail', icon: 'shield-alert', requiresEvidence: true },
  { id: 'harassment', labelKey: 'harassment', icon: 'alert-circle' },
  { id: 'fake_profile', labelKey: 'fakeProfile', icon: 'account-alert' },
  { id: 'inappropriate_content', labelKey: 'inappropriateContent', icon: 'image-off' },
  { id: 'spam', labelKey: 'spam', icon: 'email-alert' },
  { id: 'underage', labelKey: 'underage', icon: 'account-cancel' },
  { id: 'safety_concern', labelKey: 'safetyConcern', icon: 'shield-alert' },
  { id: 'other', labelKey: 'other', icon: 'dots-horizontal' },
];

export default function ReportModal({
  visible,
  onClose,
  onSubmit,
  profileName,
}: ReportModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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
        Alert.alert(t('moderation.report.permissionRequired'), t('moderation.report.permissionMessage'));
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

            // Store the storage path (buckets are private)
            uploadedUrls.push(filePath);
          } catch (error: any) {
            console.error('Error uploading photo:', error);
            Alert.alert(t('moderation.report.uploadFailed'), t('moderation.report.uploadFailedMessage'));
          }
        }

        // Add uploaded URLs to evidence photos
        setEvidencePhotos((prev) => [...prev, ...uploadedUrls]);
        setUploadingPhoto(false);
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert(t('common.error'), t('moderation.report.selectPhotoError'));
      setUploadingPhoto(false);
    }
  };

  const handleRemovePhoto = (index: number) => {
    setEvidencePhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedReason || !description.trim()) return;

    // Check if blackmail report requires evidence
    const reason = REPORT_REASON_IDS.find(r => r.id === selectedReason);
    if (reason?.requiresEvidence && evidencePhotos.length === 0) {
      Alert.alert(
        t('moderation.report.evidenceRequired'),
        t('moderation.reportAlt.evidenceRequiredMessage')
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
              <Text style={styles.title}>{t('moderation.reportAlt.title', { name: profileName })}</Text>
              <Text style={styles.subtitle}>{t('moderation.reportAlt.subtitle')}</Text>
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
            <Text style={styles.sectionTitle}>{t('moderation.reportAlt.whyReporting')}</Text>
            <View style={styles.reasonsList}>
              {REPORT_REASON_IDS.map((reason) => (
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
                      color={selectedReason === reason.id ? '#A08AB7' : '#6B7280'}
                    />
                  </View>
                  <Text
                    style={[
                      styles.reasonLabel,
                      selectedReason === reason.id && styles.reasonLabelSelected,
                    ]}
                  >
                    {t(`moderation.reportAlt.reasons.${reason.labelKey}`)}
                  </Text>
                  {selectedReason === reason.id && (
                    <MaterialCommunityIcons name="check-circle" size={20} color="#A08AB7" />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Description */}
            <Text style={styles.sectionTitle}>
              {t('moderation.reportAlt.provideDetails')} <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.textAreaContainer}>
              <TextInput
                style={styles.textArea}
                placeholder={t('moderation.reportAlt.detailsPlaceholder')}
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
                  {t('moderation.report.evidencePhotos')}
                  {REPORT_REASON_IDS.find(r => r.id === selectedReason)?.requiresEvidence && (
                    <Text style={styles.required}> *</Text>
                  )}
                </Text>
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handlePickImage}
                  disabled={submitting || uploadingPhoto}
                >
                  {uploadingPhoto ? (
                    <ActivityIndicator size="small" color="#A08AB7" />
                  ) : (
                    <>
                      <MaterialCommunityIcons name="camera-plus" size={20} color="#A08AB7" />
                      <Text style={styles.uploadButtonText}>{t('moderation.report.upload')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              {selectedReason === 'blackmail' && (
                <View style={styles.evidenceInfo}>
                  <MaterialCommunityIcons name="information" size={16} color="#3B82F6" />
                  <Text style={styles.evidenceInfoText}>
                    {t('moderation.reportAlt.evidenceInfo')}
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
                {t('moderation.reportAlt.infoNotice')}
              </Text>
            </View>
          </ScrollView>

          {/* Actions */}
          <View style={[styles.actions, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={submitting}
            >
              <Text style={styles.cancelButtonText}>{t('common.cancel')}</Text>
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
                  <Text style={styles.submitButtonText}>{t('moderation.report.submitReport')}</Text>
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
    borderColor: '#A08AB7',
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
    borderColor: '#A08AB7',
  },
  uploadButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A08AB7',
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
