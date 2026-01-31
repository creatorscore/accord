import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Switch, Platform, InteractionManager, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { optimizeImage, uriToArrayBuffer, validateImage, generateImageHash } from '@/lib/image-optimization';
import { goToPreviousOnboardingStep } from '@/lib/onboarding-navigation';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

interface Photo {
  uri: string;
  id?: string;
  contentHash?: string;
}

export default function Photos() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
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

      // Set photo blur preference if it exists
      if (data.photo_blur_enabled !== null) {
        setPhotoBlurEnabled(data.photo_blur_enabled);
      }

      // Load existing photos
      await loadExistingPhotos(data.id);
    } catch (error: any) {
      showToast({ type: 'error', title: t('common.error'), message: t('toast.profileLoadError') });
    }
  };

  const loadExistingPhotos = async (profileId: string) => {
    try {
      const { data: existingPhotos, error } = await supabase
        .from('photos')
        .select('url, display_order, content_hash')
        .eq('profile_id', profileId)
        .order('display_order', { ascending: true });

      if (error) {
        console.error('Error loading existing photos:', error);
        return;
      }

      if (existingPhotos && existingPhotos.length > 0) {
        console.log('📸 Loaded existing photos:', existingPhotos.length);
        const photoUris = existingPhotos.map(photo => ({
          uri: photo.url,
          contentHash: photo.content_hash // Include hash for deduplication
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

        // ANR FIX: Set processing state to show loading indicator
        setProcessingImage(true);

        // ANR FIX: Defer heavy image processing until after UI interactions complete
        InteractionManager.runAfterInteractions(async () => {
          try {
            // Validate image before processing
            const validation = await validateImage(selectedUri);
            if (!validation.isValid) {
              setProcessingImage(false);
              showToast({ type: 'error', title: t('toast.invalidImage'), message: validation.error || t('toast.invalidImage') });
              return;
            }

            // Optimize image with better compression and memory management
            const { optimized } = await optimizeImage(selectedUri, {
              generateThumbnail: true, // Generate thumbnail for faster loading
            });

            console.log(`Optimized image: ${(optimized.size! / 1024).toFixed(0)}KB (${optimized.width}x${optimized.height})`);

            // Generate hash for duplicate detection
            const contentHash = await generateImageHash(optimized.uri);
            console.log(`Generated content hash: ${contentHash.substring(0, 16)}...`);

            // Check for duplicate in current selection (local check)
            const isDuplicateLocal = photos.some(p => p.contentHash === contentHash);
            if (isDuplicateLocal) {
              setProcessingImage(false);
              showToast({ type: 'info', title: t('toast.photoAlreadyAdded'), message: t('toast.photoAlreadyAdded') });
              return;
            }

            // Check for duplicate in database (already uploaded photos)
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

            // Update state if component is still mounted
            if (isMounted.current) {
              setPhotos(prev => [...prev, { uri: optimized.uri, contentHash }]);
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
    if (photos.length < 4) {
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

      // Filter out photos that are already uploaded (have http URLs)
      const newPhotos = photos.filter(photo => !photo.uri.startsWith('http'));

      if (newPhotos.length === 0) {
        console.log('✅ All photos already uploaded, skipping upload step');
        setUploadProgress(100);
      } else {
        console.log(`📤 Uploading ${newPhotos.length} new photos...`);

        // Upload each new photo to Supabase Storage
        for (let i = 0; i < newPhotos.length; i++) {
          const photo = newPhotos[i];
          const timestamp = Date.now();
          const fileExt = 'jpg';
          const fileName = `${profileId}/${timestamp}_${i}.${fileExt}`;

          try {
            // Convert URI to ArrayBuffer using optimized utility
            const arrayBuffer = await uriToArrayBuffer(photo.uri);

            // Upload to Supabase Storage (use upsert to handle re-uploads gracefully)
            const { data: uploadData, error: uploadError } = await supabase.storage
              .from('profile-photos')
              .upload(fileName, arrayBuffer, {
                contentType: 'image/jpeg',
                upsert: true, // Allow re-upload if file exists (handles going back scenario)
              });

            if (uploadError) {
              console.error(`Upload error for photo ${i}:`, uploadError);
              throw new Error(`Failed to upload photo ${i + 1}: ${uploadError.message}`);
            }

            // Get public URL for the photo
            const { data: { publicUrl } } = supabase.storage
              .from('profile-photos')
              .getPublicUrl(fileName);

            // Save to photos table with content hash for duplicate detection
            // Use upsert-like behavior: check first, then insert, and handle constraint errors gracefully
            const { data: photoData, error: dbError } = await supabase
              .from('photos')
              .insert({
                profile_id: profileId,
                storage_path: fileName,
                url: publicUrl,
                display_order: photos.length - newPhotos.length + i,
                is_primary: photos.length - newPhotos.length + i === 0,
                content_hash: photo.contentHash,
                moderation_status: 'pending', // Start as pending until moderation completes
              })
              .select('id')
              .single();

            if (dbError) {
              // If it's a duplicate constraint error, just skip - photo already exists
              if (dbError.code === '23505' || dbError.message?.includes('duplicate') || dbError.message?.includes('unique constraint')) {
                console.log(`📸 Photo ${i + 1} already exists in database, skipping`);
              } else {
                console.error(`Database error for photo ${i}:`, dbError);
                throw new Error(`Failed to save photo ${i + 1}. Please try again.`);
              }
            } else {
              console.log(`✅ Photo ${i + 1} saved to database`);

              // Run NSFW moderation check - BLOCKING
              // This uses AWS Rekognition to detect explicit content
              try {
                const moderationResponse = await fetch(
                  `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/moderate-photo`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({
                      photo_url: publicUrl,
                      photo_id: photoData?.id,
                      profile_id: profileId,
                    }),
                  }
                );

                const moderationResult = await moderationResponse.json();
                console.log(`🔍 Moderation result for photo ${i + 1}:`, moderationResult);

                // If moderation endpoint returned an error (e.g. AWS creds not configured),
                // keep the photo as pending but don't block upload - RLS will hide rejected photos
                if (moderationResult.error) {
                  console.error('Moderation service error:', moderationResult.error);
                }

                // If photo was rejected for explicit content, alert user and remove photo
                if (moderationResult.approved === false && (moderationResult.reason === 'explicit_content' || moderationResult.reason === 'needs_review')) {
                  // Delete the photo from storage and database
                  await supabase.storage.from('profile-photos').remove([fileName]);
                  await supabase.from('photos').delete().eq('id', photoData?.id);

                  throw new Error('This photo contains inappropriate content and cannot be uploaded. Please choose a different photo.');
                }
              } catch (moderationError: any) {
                // If it's our explicit content error, re-throw it
                if (moderationError.message?.includes('inappropriate content')) {
                  throw moderationError;
                }
                // Log moderation failure but don't block upload
                // The RLS policy will hide rejected photos, and pending photos
                // can be re-moderated via admin tools
                console.error('Moderation check failed:', moderationError);
              }
            }

            // Update progress
            setUploadProgress(Math.round(((i + 1) / newPhotos.length) * 100));
          } catch (photoError: any) {
            console.error(`Error processing photo ${i}:`, photoError);
            throw photoError;
          }
        }
      }

      // Update onboarding step and photo blur preference
      console.log('💠 Photo blur setting:', photoBlurEnabled ? 'ENABLED' : 'DISABLED');
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          onboarding_step: 2,
          photo_blur_enabled: photoBlurEnabled,
        })
        .eq('id', profileId);

      if (updateError) {
        console.error('Error updating onboarding step:', updateError);
      } else {
        console.log('✅ Photo blur preference saved:', photoBlurEnabled);
      }

      // Reset upload state
      setUploading(false);
      setUploadProgress(0);

      // Navigate to next step
      router.push('/(onboarding)/about');
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
    <ScrollView className="flex-1 bg-purple-50 dark:bg-gray-900">
      <View className="px-6" style={{ paddingTop: Platform.OS === 'android' ? 8 : 64, paddingBottom: insets.bottom + 16 }}>
        {/* Progress */}
        <View className="mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-gray-600 dark:text-gray-400 font-medium">Step 2 of 8</Text>
            <Text className="text-sm text-lavender-500 font-bold">25%</Text>
          </View>
          <View className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <View
              className="h-3 bg-lavender-500 rounded-full"
              style={{ width: '25%' }}
            />
          </View>
        </View>

        {/* Header */}
        <View className="mb-8">
          <Text className="text-4xl font-bold text-gray-900 dark:text-white mb-3">
            Show yourself 📸
          </Text>
          <Text className="text-gray-600 dark:text-gray-300 text-lg">
            Upload 2-6 photos. Your first photo will be your profile picture.
          </Text>
        </View>

        {/* Photo Grid */}
        <View className="flex-row flex-wrap gap-3 mb-8">
          {photos.map((photo, index) => (
            <View key={index} className="relative">
              <Image
                source={{ uri: photo.uri }}
                className="w-28 h-36 rounded-2xl bg-gray-200 dark:bg-gray-700"
              />
              <TouchableOpacity
                className="absolute top-2 right-2 bg-black/50 rounded-full p-1"
                onPress={() => removePhoto(index)}
              >
                <MaterialCommunityIcons name="close" size={16} color="white" />
              </TouchableOpacity>
              {index === 0 && (
                <View className="absolute bottom-2 left-2 bg-lavender-500 px-2 py-1 rounded">
                  <Text className="text-white text-xs font-semibold">Primary</Text>
                </View>
              )}
            </View>
          ))}

          {/* Add Photo Button */}
          {photos.length < 6 && (
            <TouchableOpacity
              className="w-28 h-36 rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 items-center justify-center bg-gray-50 dark:bg-gray-800"
              onPress={pickImage}
              disabled={processingImage}
            >
              {processingImage ? (
                <>
                  <ActivityIndicator size="large" color="#A08AB7" />
                  <Text className="text-gray-500 dark:text-gray-400 text-xs mt-2">Processing...</Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="plus" size={32} color="#9CA3AF" />
                  <Text className="text-gray-500 dark:text-gray-400 text-xs mt-1">Add Photo</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Tips */}
        <View className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-3xl p-5 mb-6">
          <View className="flex-row items-center mb-3">
            <Text className="text-3xl mr-2">📷</Text>
            <Text className="text-blue-900 dark:text-blue-100 font-bold text-lg">Photo Tips</Text>
          </View>
          <Text className="text-blue-800 dark:text-blue-200 text-sm mb-2">✨ Use clear, recent photos</Text>
          <Text className="text-blue-800 dark:text-blue-200 text-sm mb-2">😊 Show your face clearly</Text>
          <Text className="text-blue-800 dark:text-blue-200 text-sm mb-2">🎨 Include variety (close-up, full body, activity)</Text>
          <Text className="text-blue-800 dark:text-blue-200 text-sm">👥 Avoid group photos as your first photo</Text>
        </View>

        {/* Privacy Option - Photo Blur */}
        <View className="bg-purple-50 dark:bg-purple-900/30 border-2 border-purple-200 dark:border-purple-700 rounded-3xl p-5 mb-8">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 mr-4">
              <View className="flex-row items-center mb-2">
                <Text className="text-2xl mr-2">🔒</Text>
                <Text className="text-purple-900 dark:text-purple-100 font-bold text-lg">{t('onboarding.photos.privacyMode')}</Text>
              </View>
              <Text className="text-purple-800 dark:text-purple-200 text-sm">
                {t('onboarding.photos.privacyModeDesc')}
              </Text>
            </View>
            <Switch
              value={photoBlurEnabled}
              onValueChange={(value) => {
                console.log('🔒 Photo blur toggled:', value ? 'ON' : 'OFF');
                setPhotoBlurEnabled(value);
              }}
              trackColor={{ false: '#D1D5DB', true: '#A08AB7' }}
              thumbColor={photoBlurEnabled ? '#ffffff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Buttons */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 py-4 rounded-full border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            onPress={() => goToPreviousOnboardingStep('/(onboarding)/photos')}
            disabled={uploading}
          >
            <Text className="text-gray-700 dark:text-gray-300 text-center font-bold text-lg">Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-4 rounded-full ${
              uploading || photos.length < 4
                ? 'bg-gray-400 dark:bg-gray-600'
                : 'bg-lavender-500'
            }`}
            style={{
              borderRadius: 9999,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 16,
            }}
            onPress={handleContinue}
            disabled={uploading || photos.length < 4}
          >
            <Text className="text-white text-center font-bold text-lg">
              {uploading ? `Uploading... ${uploadProgress}%` : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Photo Counter */}
        <Text className="text-center text-gray-500 dark:text-gray-400 text-sm mt-4">
          {photos.length} of 6 photos {photos.length < 4 && '(minimum 4)'}
        </Text>
      </View>
    </ScrollView>
  );
}
