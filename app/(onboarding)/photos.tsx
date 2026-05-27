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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { optimizeImage, uriToArrayBuffer, validateImage, generateImageHash, generateBlurDataUri, cleanupOptimizedImages } from '@/lib/image-optimization';
import { signPhotoUrls } from '@/lib/signed-urls';
import { captureException } from '@/lib/sentry';
import { goToPreviousOnboardingStep, goToNextOnboardingStep } from '@/lib/onboarding-navigation';
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
  // True once this photo has been uploaded + moderated successfully. Used to
  // skip re-uploading on retry after a partial failure (e.g. another photo
  // was rejected mid-loop). The local URI stays as-is so the grid keeps
  // rendering the same image without a flicker.
  uploaded?: boolean;
}

interface PhotosProps {
  embedded?: boolean;
  onContinue?: () => void;
  onBack?: () => void;
  // When embedded inside the unified onboarding flow, the parent already
  // knows the profile id (it created the row at step 3). Passing it down
  // skips a redundant SELECT roundtrip on mount — meaningful when the
  // user is on a flaky connection or the chunk just loaded.
  initialProfileId?: string | null;
}

export default function Photos({ embedded, onContinue: parentContinue, onBack: parentBack, initialProfileId }: PhotosProps = {}) {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(initialProfileId ?? null);
  const [photoBlurEnabled, setPhotoBlurEnabled] = useState(false);
  const [processingImage, setProcessingImage] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  // Skeleton slots shown while existing photos load — prevents grid pop-in flicker.
  // Start at 3 (the minimum required) so first paint never shows an empty grid.
  const [skeletonCount, setSkeletonCount] = useState(3);
  const [initialLoading, setInitialLoading] = useState(true);
  const isMounted = useRef(true);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Re-run loadProfile when auth becomes available. Previous empty-deps
  // useEffect fired once at mount and silently no-op'd if user wasn't
  // hydrated yet, leaving profileId=null forever and surfacing
  // "Profile not found" when the user hit Continue.
  //
  // Fast path: when the parent passed initialProfileId, skip the profile
  // SELECT entirely and go straight to fetching existing photos (the
  // common case for embedded onboarding — the parent already created the
  // row at step 3 and has its id in state).
  //
  // Sync local profileId whenever the parent's initialProfileId transitions
  // from null → real id. useState only captures the FIRST prop value, so a
  // late-arriving parent profileId (e.g. parent's initial profile load
  // finishes after Photos mounts) would otherwise leave us locked at null
  // — handleContinue then fires the no-profile guard and surfaces
  // "Profile not found" to a user whose row actually exists.
  useEffect(() => {
    if (initialProfileId) {
      console.log('[photos] using initialProfileId from parent =', initialProfileId);
      setProfileId(initialProfileId);
      loadExistingPhotos(initialProfileId).finally(() => {
        if (isMounted.current) setInitialLoading(false);
      });
      return;
    }
    if (user?.id) {
      loadProfile();
    }
  }, [user?.id, initialProfileId]);

  const loadProfile = async () => {
    const t0 = Date.now();
    console.log('[photos.loadProfile] start, user?.id =', user?.id);
    try {
      if (!user?.id) {
        const err = new Error('photos.loadProfile called without user.id (auth not ready)');
        console.warn('[photos.loadProfile]', err.message);
        captureException(err, { context: 'photos_loadProfile_no_user' });
        return;
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, photo_blur_enabled')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      if (!isMounted.current) return;
      console.log('[photos.loadProfile] got profileId =', data.id, 'in', Date.now() - t0, 'ms');
      setProfileId(data.id);

      if (data.photo_blur_enabled !== null) {
        setPhotoBlurEnabled(data.photo_blur_enabled);
      }

      await loadExistingPhotos(data.id);
    } catch (error: any) {
      console.error('[photos.loadProfile] failed in', Date.now() - t0, 'ms:', error?.code, error?.message);
      captureException(error instanceof Error ? error : new Error(error?.message || 'photos.loadProfile failed'), {
        context: 'photos_loadProfile',
        code: error?.code,
        userId: user?.id,
      });
      showToast({ type: 'error', title: t('common.error'), message: t('toast.profileLoadError') });
    } finally {
      if (isMounted.current) setInitialLoading(false);
    }
  };

  const loadExistingPhotos = async (profileId: string) => {
    try {
      // Exclude rejected photos so the count the user sees matches what
      // actually counts toward the 3-photo minimum. Otherwise a user with
      // 2 approved + 1 rejected sees "3 photos", taps Continue, and is
      // either rejected again or advances with an invisible-in-discovery
      // photo. 'pending' is included so that in-flight moderations still
      // appear during the brief window before the edge function returns.
      const { data: existingPhotos, error } = await supabase
        .from('photos')
        .select('url, storage_path, display_order, content_hash, moderation_status')
        .eq('profile_id', profileId)
        .neq('moderation_status', 'rejected')
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error loading existing photos:', error);
        setSkeletonCount(0);
        return;
      }

      if (existingPhotos && existingPhotos.length > 0) {
        // Reserve skeleton slots immediately so the grid doesn't jump from 0 → N
        setSkeletonCount(existingPhotos.length);
        const signedPhotos = await signPhotoUrls(existingPhotos);
        if (!isMounted.current) return;
        const photoUris = signedPhotos.map(photo => ({
          uri: photo.url!,
          contentHash: photo.content_hash,
        }));
        setPhotos(photoUris);
        setSkeletonCount(0);
      } else {
        setSkeletonCount(0);
      }
    } catch (error) {
      console.error('Failed to load existing photos:', error);
      setSkeletonCount(0);
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

            // Hash the ORIGINAL picker URI before optimization — optimization output
            // can vary run-to-run (metadata timestamps, JPEG quantization) which would
            // produce different hashes for the same source image and let duplicates slip.
            const contentHash = await generateImageHash(selectedUri);

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

            const { optimized } = await optimizeImage(selectedUri, {
              generateThumbnail: true,
            });

            const blurDataUri = await generateBlurDataUri(optimized.uri).catch(() => undefined);

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
    setSelectedPhotoIndex(null);
  };

  const handlePhotoTap = (index: number) => {
    if (selectedPhotoIndex === null) {
      // First tap: select this photo for reorder
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setSelectedPhotoIndex(index);
    } else if (selectedPhotoIndex === index) {
      // Tap same photo: deselect
      setSelectedPhotoIndex(null);
    } else {
      // Tap different photo: swap positions
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const newPhotos = [...photos];
      const temp = newPhotos[selectedPhotoIndex];
      newPhotos[selectedPhotoIndex] = newPhotos[index];
      newPhotos[index] = temp;
      setPhotos(newPhotos);
      setSelectedPhotoIndex(null);
    }
  };

  const handleContinue = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (photos.length < 3) {
      showToast({ type: 'info', title: t('toast.morePhotosNeeded'), message: t('toast.morePhotosNeeded') });
      return;
    }

    if (!profileId) {
      console.error('[photos.handleContinue] profileId is null at Continue — embedded =', embedded, 'user?.id =', user?.id);
      captureException(new Error('photos.handleContinue fired with null profileId'), {
        context: 'photos_continue_no_profile',
        embedded,
        userId: user?.id,
        photosCount: photos.length,
      });
      showToast({ type: 'error', title: t('common.error'), message: t('toast.profileNotFound') });
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // Photos that need uploading: not already a remote URL AND not already
      // marked uploaded from a prior partial-failure retry.
      const newPhotos = photos.filter(photo => !photo.uri.startsWith('http') && !photo.uploaded);
      // Track which local photos have been successfully uploaded+moderated so
      // a partial-failure retry doesn't try to re-upload them and trigger a
      // duplicate constraint or a redundant moderation call. Keyed by
      // contentHash because the local URI is the only stable per-photo id.
      const uploadedHashes: Set<string> = new Set();

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
                if (moderationResult?.approved === false && moderationResult.reason === 'contact_info') {
                  throw new Error(t('onboardingPhotos.contactInfoDetected'));
                }
              } catch (moderationError: any) {
                if (moderationError.message?.includes('inappropriate content') || moderationError.message?.includes('contact info')) {
                  throw moderationError;
                }
                console.error('Moderation check failed:', moderationError);
              }
            }

            // Mark this photo as uploaded — on a later retry (e.g. moderation
            // rejected a different photo) we'll skip re-uploading it.
            if (photo.contentHash) {
              uploadedHashes.add(photo.contentHash);
            }
            setUploadProgress(Math.round(((i + 1) / newPhotos.length) * 100));
          } catch (photoError: any) {
            console.error(`Error processing photo ${i}:`, photoError);
            throw photoError;
          }
        }
      }

      if (!embedded) {
        const { error: updateError } = await supabase
          .from('profiles')
          .update({
            onboarding_step: 3,
            photo_blur_enabled: photoBlurEnabled,
          })
          .eq('id', profileId);

        if (updateError) {
          console.error('Error updating onboarding step:', updateError);
        }
      } else {
        // In embedded mode, just save blur preference
        await supabase
          .from('profiles')
          .update({ photo_blur_enabled: photoBlurEnabled })
          .eq('id', profileId);
      }

      // Mark uploaded photos in local state so a subsequent retry skips them
      // (the filter at the top of this handler checks both `uri` and
      // `uploaded`). Keeps the original local URI for rendering — no
      // flicker on partial-failure retries.
      if (uploadedHashes.size > 0 && isMounted.current) {
        setPhotos(prev => prev.map(p =>
          p.contentHash && uploadedHashes.has(p.contentHash) ? { ...p, uploaded: true } : p
        ));
      }

      // Clean up persisted optimized images now that they're uploaded
      cleanupOptimizedImages().catch(() => {});

      setUploading(false);
      setUploadProgress(0);

      if (embedded && parentContinue) {
        parentContinue();
      } else {
        router.push('/(onboarding)/onboarding');
      }
    } catch (error: any) {
      console.error('Upload failed:', error);
      if (isMounted.current) {
        showToast({ type: 'error', title: t('common.error'), message: error.message || t('toast.uploadFailed') });
        setUploading(false);
        setUploadProgress(0);
      }
    }
  };

  const showSkeleton = initialLoading && photos.length === 0;
  const hintText = selectedPhotoIndex !== null
    ? 'Tap another photo to swap positions'
    : photos.length < 3
      ? `Add ${3 - photos.length} more — 3 required, up to 6. First photo is your primary.`
      : 'Tap a photo to reorder. First photo is your primary.';

  const content = (
    <>
      {/* Single hint line (replaces counter + reorder tip + tips card) */}
      <View style={styles.hintRow}>
        <MaterialCommunityIcons
          name={selectedPhotoIndex !== null ? 'swap-horizontal' : 'information-outline'}
          size={14}
          color={isDark ? '#D4C4E8' : '#8B72A8'}
        />
        <Text style={[styles.hintText, { color: isDark ? '#D4C4E8' : '#8B72A8' }]} numberOfLines={2}>
          {hintText}
        </Text>
        {selectedPhotoIndex !== null && (
          <TouchableOpacity onPress={() => setSelectedPhotoIndex(null)}>
            <Text style={[styles.reorderCancel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Cancel</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Photo Grid — tap to select, tap another to swap */}
      <View style={styles.photoGrid}>
        {showSkeleton && Array.from({ length: skeletonCount }).map((_, i) => (
          <View
            key={`skeleton-${i}`}
            style={[styles.photoImage, styles.photoSkeleton, { backgroundColor: isDark ? '#1F2937' : '#E5E7EB' }]}
          />
        ))}
        {!showSkeleton && photos.map((photo, index) => {
          const isSelected = selectedPhotoIndex === index;
          const isSwapTarget = selectedPhotoIndex !== null && selectedPhotoIndex !== index;
          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.photoWrapper,
                isSelected && styles.photoSelected,
                isSwapTarget && styles.photoSwapTarget,
              ]}
              onPress={() => handlePhotoTap(index)}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Photo ${index + 1}${index === 0 ? ', primary' : ''}${isSelected ? ', selected for reorder' : ''}`}
              accessibilityHint={isSelected ? 'Tap another photo to swap' : 'Tap to select for reordering'}
            >
              <Image
                source={{ uri: photo.uri }}
                style={[styles.photoImage, { backgroundColor: isDark ? '#374151' : '#E5E7EB' }]}
              />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removePhoto(index)}
                accessibilityRole="button"
                accessibilityLabel={`Remove photo ${index + 1}`}
              >
                <MaterialCommunityIcons name="close" size={14} color="white" />
              </TouchableOpacity>
              {index === 0 && (
                <View style={styles.primaryBadge}>
                  <Text style={styles.primaryBadgeText}>{t('onboardingPhotos.primary')}</Text>
                </View>
              )}
              {isSelected && (
                <View style={styles.selectedOverlay}>
                  <MaterialCommunityIcons name="swap-horizontal" size={24} color="#FFFFFF" />
                </View>
              )}
              {/* Position indicator */}
              <View style={styles.positionBadge}>
                <Text style={styles.positionText}>{index + 1}</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        {!showSkeleton && photos.length < 6 && (
          <TouchableOpacity
            style={[
              styles.addPhotoButton,
              {
                borderColor: isDark ? '#A08AB7' : '#D1D5DB',
                backgroundColor: isDark ? 'rgba(160, 138, 183, 0.12)' : '#F9FAFB',
              },
            ]}
            onPress={pickImage}
            disabled={processingImage}
            accessibilityRole="button"
            accessibilityLabel={processingImage ? 'Processing photo' : `Add photo. ${photos.length} of 6 added`}
            accessibilityState={{ disabled: processingImage }}
          >
            {processingImage ? (
              <>
                <ActivityIndicator size="large" color="#A08AB7" />
                <Text style={[styles.addPhotoText, { color: isDark ? '#D4C4E8' : '#6B7280' }]}>{t('onboardingPhotos.processing')}</Text>
              </>
            ) : (
              <>
                <MaterialCommunityIcons name="plus" size={28} color={isDark ? '#A08AB7' : '#9CA3AF'} />
                <Text style={[styles.addPhotoText, { color: isDark ? '#D4C4E8' : '#6B7280' }]}>{t('onboardingPhotos.addPhoto')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Upload Progress Bar */}
      {uploading && (
        <View style={styles.uploadProgressContainer}>
          <View style={styles.uploadProgressRow}>
            <ActivityIndicator size="small" color="#A08AB7" />
            <Text style={styles.uploadProgressText}>
              {t('onboardingPhotos.uploading', { progress: uploadProgress })}
            </Text>
          </View>
          <View style={styles.uploadProgressBarBg}>
            <View style={[styles.uploadProgressBarFill, { width: `${uploadProgress}%` }]} />
          </View>
        </View>
      )}

      {/* Privacy mode card — sits below the photo grid */}
      <View
        style={[
          styles.privacyCard,
          {
            backgroundColor: isDark ? '#1A1A2D' : '#F9F8FB',
            borderColor: isDark ? '#2C2C3E' : '#F0EDF4',
          },
        ]}
      >
        <View style={styles.privacyIconWell}>
          <MaterialCommunityIcons name="eye-off-outline" size={20} color="#A08AB7" />
        </View>
        <View style={styles.privacyTextCompact}>
          <Text style={[styles.privacyLabel, { color: isDark ? '#F5F5F7' : '#1F2937' }]} numberOfLines={1}>
            {t('onboarding.photos.privacyMode')}
          </Text>
          <Text style={[styles.privacyDescCompact, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
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
    </>
  );

  if (embedded) {
    const continueDisabled = uploading || photos.length < 3;
    return (
      <View style={{ flex: 1 }}>
        {/* Embedded title */}
        <Text style={[styles.embeddedTitle, { color: isDark ? '#F5F5F7' : '#1A1A2E' }]}>{t('onboarding.photos.title')}</Text>
        <Text style={[styles.embeddedSubtitle, { color: isDark ? '#8E8E93' : '#71717A' }]}>{t('onboardingPhotos.subtitle')}</Text>
        <View style={{ flex: 1 }}>
          {content}
        </View>
        {/* Bottom bar matching OnboardingLayout */}
        <View style={[
          styles.embeddedBottomBar,
          {
            paddingBottom: Math.max(insets.bottom, 20) + 16,
            borderTopColor: isDark ? '#1F2937' : '#F3F4F6',
          },
        ]}>
          <TouchableOpacity
            style={[styles.embeddedBackCircle, {
              backgroundColor: isDark ? '#1F2937' : '#F5F3F8',
              borderColor: isDark ? '#374151' : '#E8E3F0',
            }]}
            onPress={parentBack}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={isDark ? '#D1D5DB' : '#6B7280'} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.embeddedContinueCircle, continueDisabled && styles.embeddedButtonDisabled]}
            onPress={handleContinue}
            disabled={continueDisabled}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="arrow-right" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <OnboardingLayout
      currentStep={getGlobalStep('photos', 0)}
      title={t('onboarding.photos.title')}
      subtitle={t('onboardingPhotos.subtitle')}
      onBack={() => goToPreviousOnboardingStep('/(onboarding)/photos')}
      onContinue={handleContinue}
      continueDisabled={uploading || photos.length < 3}
      continueLabel={uploading ? t('onboardingPhotos.uploading', { progress: uploadProgress }) : t('common.continue')}
      noScroll
    >
      {content}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
    justifyContent: 'flex-start',
  },
  photoWrapper: {
    position: 'relative',
  },
  photoImage: {
    width: 98,
    height: 126,
    borderRadius: 14,
  },
  photoSkeleton: {
    opacity: 0.6,
  },
  photoSelected: {
    borderWidth: 3,
    borderColor: '#A08AB7',
    borderRadius: 17,
  },
  photoSwapTarget: {
    opacity: 0.7,
  },
  selectedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(160, 138, 183, 0.4)',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  positionText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  hintText: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },
  reorderCancel: {
    fontSize: 13,
    fontWeight: '600',
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
    width: 98,
    height: 126,
    borderRadius: 14,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPhotoText: {
    fontSize: 12,
    marginTop: 4,
  },
  privacyCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 16,
  },
  privacyIconWell: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(160, 138, 183, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyTextCompact: {
    flex: 1,
  },
  privacyLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  privacyDescCompact: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  uploadProgressContainer: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  uploadProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  uploadProgressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#A08AB7',
  },
  uploadProgressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#E5E7EB',
    overflow: 'hidden',
  },
  uploadProgressBarFill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: '#A08AB7',
  },
  embeddedTitle: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
    letterSpacing: -0.5,
    color: '#1A1A2E',
    marginBottom: 6,
  },
  embeddedSubtitle: {
    fontSize: 15,
    lineHeight: 20,
    color: '#71717A',
    marginBottom: 20,
  },
  embeddedBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    marginTop: 8,
  },
  embeddedBackCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#F5F3F8',
    borderWidth: 1.5,
    borderColor: '#E8E3F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  embeddedContinueCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#A08AB7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  embeddedButtonDisabled: {
    opacity: 0.4,
  },
});
