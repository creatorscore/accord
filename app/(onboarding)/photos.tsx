import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Switch,
  InteractionManager,
  ActivityIndicator,
  StyleSheet,
  useColorScheme,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { optimizeImage, uriToArrayBuffer, validateImage, generateImageHash, generateBlurDataUri, cleanupOptimizedImages } from '@/lib/image-optimization';
import { signPhotoUrls } from '@/lib/signed-urls';
import { goToPreviousOnboardingStep, skipToDiscovery } from '@/lib/onboarding-navigation';
import { getGlobalStep } from '@/lib/onboarding-steps';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';

interface Photo {
  uri: string;
  originalUri?: string; // Original source URI for re-optimization fallback
  id?: string;
  contentHash?: string;
  blurDataUri?: string;
}

export default function Photos() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [photoBlurEnabled, setPhotoBlurEnabled] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    loadProfile();
    return () => {
      isMounted.current = false;
    };
  }, []);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, photo_blur_enabled')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setProfileId(data.id);

      if (data.photo_blur_enabled !== null) {
        setPhotoBlurEnabled(data.photo_blur_enabled);
      }

      await loadExistingPhotos(data.id);
    } catch (error: any) {
      showToast({ type: 'error', title: t('common.error'), message: t('toast.profileLoadError') });
    }
  };

  const loadExistingPhotos = async (profileId: string) => {
    try {
      const { data: existingPhotos, error } = await supabase
        .from('photos')
        .select('url, storage_path, display_order, content_hash')
        .eq('profile_id', profileId)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error loading existing photos:', error);
        return;
      }

      if (existingPhotos && existingPhotos.length > 0) {
        const signedPhotos = await signPhotoUrls(existingPhotos);
        const photoUris = signedPhotos.map(photo => ({
          uri: photo.url!,
          contentHash: photo.content_hash,
        }));
        setPhotos(photoUris);
      }
    } catch (error) {
      console.error('Failed to load existing photos:', error);
    }
  };

  const pickImage = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (photos.length >= 6) {
      showToast({ type: 'info', title: t('toast.photoLimitTitle'), message: t('toast.photoLimitMessage') });
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showToast({ type: 'error', title: t('toast.permissionDenied'), message: t('toast.needPhotoAccess') });
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const selectedUri = result.assets[0].uri;
        setProcessingImage(true);

        InteractionManager.runAfterInteractions(async () => {
          try {
            const validation = await validateImage(selectedUri);
            if (!validation.isValid) {
              setProcessingImage(false);
              showToast({ type: 'error', title: t('toast.invalidImage'), message: validation.error || t('toast.invalidImage') });
              return;
            }

            const { optimized } = await optimizeImage(selectedUri, {
              generateThumbnail: true,
            });

            const [contentHash, blurDataUri] = await Promise.all([
              generateImageHash(optimized.uri),
              generateBlurDataUri(optimized.uri).catch(() => undefined),
            ]);

            const isDuplicateLocal = photos.some(p => p.contentHash === contentHash);
            if (isDuplicateLocal) {
              setProcessingImage(false);
              showToast({ type: 'info', title: t('toast.photoAlreadyAdded'), message: t('toast.photoAlreadyAdded') });
              return;
            }

            if (profileId) {
              const { data: existingPhoto } = await supabase
                .from('photos')
                .select('id')
                .eq('profile_id', profileId)
                .eq('content_hash', contentHash)
                .maybeSingle();

              if (existingPhoto) {
                setProcessingImage(false);
                showToast({ type: 'info', title: t('toast.photoAlreadyAdded'), message: t('toast.photoAlreadyAdded') });
                return;
              }
            }

            if (isMounted.current) {
              setPhotos(prev => [...prev, { uri: optimized.uri, originalUri: selectedUri, contentHash, blurDataUri }]);
              setProcessingImage(false);
            }
          } catch (error: any) {
            console.error('Error processing image:', error);
            setProcessingImage(false);
            showToast({ type: 'error', title: t('common.error'), message: t('toast.photoProcessError') });
          }
        });
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      setProcessingImage(false);
      showToast({ type: 'error', title: t('common.error'), message: t('toast.selectPhotoError') });
    }
  }, [photos, profileId]);

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleContinue = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (photos.length < 2) {
      showToast({ type: 'info', title: t('toast.morePhotosNeeded'), message: t('toast.morePhotosNeeded') });
      return;
    }

    if (!profileId) {
      showToast({ type: 'error', title: t('common.error'), message: t('toast.profileNotFound') });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      const newPhotos = photos.filter(photo => !photo.uri.startsWith('http'));

      if (newPhotos.length === 0) {
        setUploadProgress(100);
      } else {
        for (let i = 0; i < newPhotos.length; i++) {
          const photo = newPhotos[i];
          const timestamp = Date.now();
          const fileExt = 'jpg';
          const fileName = `${profileId}/${timestamp}_${i}.${fileExt}`;

          try {
            const arrayBuffer = await uriToArrayBuffer(photo.uri, photo.originalUri);

            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('profile-photos')
              .upload(fileName, arrayBuffer, {
                contentType: 'image/jpeg',
                upsert: true,
              });

            if (uploadError) {
              console.error(`Upload error for photo ${i}:`, uploadError);
              throw new Error(`Failed to upload photo ${i + 1}: ${uploadError.message}`);
            }

            const { data: signedData } = await supabase.storage
              .from('profile-photos')
              .createSignedUrl(fileName, 600);
            const signedUrl = signedData?.signedUrl || '';

            const { data: photoData, error: dbError } = await supabase
              .from('photos')
              .insert({
                profile_id: profileId,
                storage_path: fileName,
                url: fileName,
                display_order: photos.length - newPhotos.length + i,
                is_primary: photos.length - newPhotos.length + i === 0,
                content_hash: photo.contentHash,
                blur_data_uri: photo.blurDataUri || null,
                moderation_status: 'pending',
              })
              .select('id')
              .single();

            if (dbError) {
              if (dbError.code === '23505' || dbError.message?.includes('duplicate') || dbError.message?.includes('unique constraint')) {
                // Photo already exists, skip
              } else {
                console.error(`Database error for photo ${i}:`, dbError);
                throw new Error(`Failed to save photo ${i + 1}. Please try again.`);
              }
            } else {
              try {
                const { data: moderationResult, error: moderationError } = await supabase.functions.invoke('moderate-photo', {
                  body: {
                    photo_url: signedUrl,
                    photo_id: photoData?.id,
                    profile_id: profileId,
                  },
                });

                if (moderationError) {
                  console.error('Moderation service error:', moderationError);
                }

                if (moderationResult?.approved === false && (moderationResult.reason === 'explicit_content' || moderationResult.reason === 'needs_review')) {
                  throw new Error(t('onboardingPhotos.inappropriateContent'));
                }
              } catch (moderationError: any) {
                if (moderationError.message?.includes('inappropriate content')) {
                  throw moderationError;
                }
                console.error('Moderation check failed:', moderationError);
              }
            }

            setUploadProgress(Math.round(((i + 1) / newPhotos.length) * 100));
          } catch (photoError: any) {
            console.error(`Error processing photo ${i}:`, photoError);
            throw photoError;
          }
        }
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          onboarding_step: 3,
          photo_blur_enabled: photoBlurEnabled,
          profile_complete: true, // Enable discovery access after photos (trigger requires 2+ photos)
        })
        .eq('id', profileId);

      if (updateError) {
        console.error('Error updating onboarding step:', updateError);
      }

      // Clean up persisted optimized images now that they're uploaded
      cleanupOptimizedImages().catch(() => {});

      setUploading(false);
      setUploadProgress(0);

      router.push('/(onboarding)/interests');
    } catch (error: any) {
      console.error('Upload failed:', error);
      if (isMounted.current) {
        showToast({ type: 'error', title: t('common.error'), message: error.message || t('toast.uploadFailed') });
        setUploading(false);
        setUploadProgress(0);
      }
    }
  };

  return (
    <OnboardingLayout
      currentStep={getGlobalStep('photos', 0)}
      title={t('onboarding.photos.title')}
      subtitle={t('onboardingPhotos.subtitle')}
      onBack={() => goToPreviousOnboardingStep('/(onboarding)/photos')}
      onSkip={skipToDiscovery}
      onContinue={handleContinue}
      continueDisabled={uploading || photos.length < 2}
      continueLabel={uploading ? t('onboardingPhotos.uploading', { progress: uploadProgress }) : t('common.continue')}
      currentRoute="/(onboarding)/photos"
    >
      {/* Photo Grid */}
      <View style={styles.photoGrid}>
        {photos.map((photo, index) => (
          <View key={index} style={styles.photoWrapper}>
            <Image
              source={{ uri: photo.uri }}
              style={[styles.photoImage, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}
            />
            <TouchableOpacity style={styles.removeButton} onPress={() => removePhoto(index)}>
              <MaterialCommunityIcons name="close" size={14} color="white" />
            </TouchableOpacity>
            {index === 0 && (
              <View style={styles.primaryBadge}>
                <Text style={styles.primaryBadgeText}>{t('onboardingPhotos.primary')}</Text>
              </View>
            )}
          </View>
        ))}

        {photos.length < 6 && (
          <TouchableOpacity
            style={[
              styles.addPhotoButton,
              {
                borderColor: isDark ? '#4B5563' : '#D1D5DB',
                backgroundColor: isDark ? '#1F2937' : '#F9FAFB',
              },
            ]}
            onPress={pickImage}
            disabled={processingImage}
          >
            {processingImage ? (
              <>
                <ActivityIndicator size="large" color="#A08AB7" />
                <Text style={[styles.addPhotoText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{t('onboardingPhotos.processing')}</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="plus" size={28} color={isDark ? '#6B7280' : '#9CA3AF'} />
                <Text style={[styles.addPhotoText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>{t('onboardingPhotos.addPhoto')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Photo Counter */}
      <Text style={[styles.photoCounter, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
        {t('onboardingPhotos.counter', { count: photos.length })} {photos.length < 2 ? t('onboardingPhotos.minimumTwo') : ''}
      </Text>

      {/* Tips */}
      <View style={[styles.card, { backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA', borderColor: isDark ? '#2C2C3E' : '#E8E3F0' }]}>
        <View style={styles.cardHeader}>
          <MaterialCommunityIcons name="lightbulb-outline" size={22} color="#A08AB7" />
          <Text style={[styles.cardTitle, { color: isDark ? '#E5E7EB' : '#1F2937' }]}>{t('onboardingPhotos.tipsTitle')}</Text>
        </View>
        <Text style={[styles.tipItem, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>{t('onboardingPhotos.tip1')}</Text>
        <Text style={[styles.tipItem, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>{t('onboardingPhotos.tip2')}</Text>
        <Text style={[styles.tipItem, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>{t('onboardingPhotos.tip3')}</Text>
        <Text style={[styles.tipItem, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>{t('onboardingPhotos.tip4')}</Text>
      </View>

      {/* Privacy Toggle */}
      <View style={[styles.card, { backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA', borderColor: isDark ? '#2C2C3E' : '#E8E3F0' }]}>
        <View style={styles.privacyRow}>
          <View style={styles.privacyTextContainer}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="eye-off-outline" size={22} color="#A08AB7" />
              <Text style={[styles.cardTitle, { color: isDark ? '#E5E7EB' : '#1F2937' }]}>{t('onboarding.photos.privacyMode')}</Text>
            </View>
            <Text style={[styles.privacyDesc, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              {t('onboarding.photos.privacyModeDesc')}
            </Text>
          </View>
          <Switch
            value={photoBlurEnabled}
            onValueChange={async (value) => {
              setPhotoBlurEnabled(value);
              if (profileId) {
                try {
                  await supabase.from('profiles').update({ photo_blur_enabled: value }).eq('id', profileId);
                } catch (error) {
                  console.error('Error saving photo blur preference:', error);
                  setPhotoBlurEnabled(!value);
                }
              }
            }}
            trackColor={{ false: '#D1D5DB', true: '#A08AB7' }}
            thumbColor={photoBlurEnabled ? '#ffffff' : '#f4f3f4'}
          />
        </View>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  photoWrapper: {
    position: 'relative',
  },
  photoImage: {
    width: 112,
    height: 144,
    borderRadius: 16,
  },
  removeButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 999,
    padding: 4,
  },
  primaryBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: '#A08AB7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  primaryBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  addPhotoButton: {
    width: 112,
    height: 144,
    borderRadius: 16,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    fontSize: 12,
    marginTop: 4,
  },
  photoCounter: {
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 24,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 20,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  cardTitle: {
    fontWeight: '700',
    fontSize: 17,
  },
  tipItem: {
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
    paddingLeft: 4,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  privacyTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  privacyDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
});
