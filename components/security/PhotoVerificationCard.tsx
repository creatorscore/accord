import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

export default function PhotoVerificationCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    loadProfile();
  }, [user]);

  const loadProfile = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('photo_verified, photo_verification_status, photo_verification_attempts')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const isVerified = profile?.photo_verified || false;
  const status = profile?.photo_verification_status || 'unverified';
  const isPending = status === 'pending';
  const isFailed = status === 'failed';
  const attempts = profile?.photo_verification_attempts || 0;

  const takeSelfie = async () => {
    // Check if already verified
    if (isVerified) {
      Alert.alert(t('verification.alreadyVerified'), t('verification.alreadyVerifiedMessage'));
      return;
    }

    // Check attempts
    if (attempts >= 5) {
      Alert.alert(
        t('verification.tooManyAttempts'),
        t('verification.tooManyAttemptsMessage')
      );
      return;
    }

    try {
      // Request camera permissions
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          t('verification.cameraPermission'),
          t('verification.cameraPermissionMessage')
        );
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        // Disable cropping on Android — native canhub/cropper crashes on low-end devices
        allowsEditing: Platform.OS === 'ios',
        aspect: [1, 1],
        quality: 0.8,
        base64: false, // We'll read the file directly
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return; // User cancelled
      }

      const imageUri = result.assets[0].uri;

      // Start verification
      await verifySelfie(imageUri);

    } catch (error: any) {
      console.error('Error taking selfie:', error);
      Alert.alert(t('verification.selfieError'), t('verification.selfieErrorMessage'));
    }
  };

  const verifySelfie = async (imageUri: string) => {
    setVerifying(true);
    try {
      // Resize and compress image to reduce payload size
      // AWS Rekognition works well with 800x800 images
      const manipulated = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 800, height: 800 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Read resized image as base64
      const base64 = await FileSystem.readAsStringAsync(manipulated.uri, {
        encoding: 'base64',
      });

      // Call Edge Function
      const { data, error } = await supabase.functions.invoke('photo-verification-start', {
        body: { selfie_base64: base64 },
      });

      if (error) {
        // Attach any additional data from the response to the error
        const enhancedError = new Error(error.message || 'Edge function error');
        (enhancedError as any).details = data?.details || data?.error || '';
        (enhancedError as any).originalError = error;
        throw enhancedError;
      }

      // Check if data contains an error (edge function returned error in response body)
      if (data?.error && !data?.success) {
        const dataError = new Error(data.error);
        (dataError as any).details = data.details || data.message || '';
        throw dataError;
      }

      // Refresh profile to get updated status
      await loadProfile();

      // Show result
      if (data.verified) {
        Alert.alert(
          t('verification.success'),
          t('verification.successMessage', { similarity: data.similarity }),
          [{ text: t('verification.awesome') }]
        );
      } else {
        Alert.alert(
          t('verification.unsuccessful'),
          t('verification.unsuccessfulMessage', { message: data.message }),
          [
            { text: t('verification.tryAgain'), onPress: takeSelfie },
            { text: t('common.cancel'), style: 'cancel' }
          ]
        );
      }

    } catch (error: any) {
      console.error('Error verifying selfie:', error);

      // Extract the actual error message from different error formats
      const errorMessage = error?.message || error?.error || error?.toString() || 'Unknown error';
      const errorDetails = error?.details || '';

      console.error('Error details:', { errorMessage, errorDetails, fullError: JSON.stringify(error) });

      // Handle specific errors
      if (errorMessage?.includes('No photos to compare')) {
        Alert.alert(
          t('verification.noPhotos'),
          t('verification.noPhotosMessage'),
          [{ text: t('common.ok') }]
        );
      } else if (errorMessage?.includes('Already verified')) {
        Alert.alert(t('verification.alreadyVerified'), t('verification.alreadyVerifiedMessage'));
        await loadProfile();
      } else if (errorMessage?.includes('Too many attempts')) {
        Alert.alert(
          t('verification.tooManyAttempts'),
          t('verification.tooManyAttemptsMessageShort')
        );
      } else if (errorMessage?.includes('Profile not found')) {
        Alert.alert(t('verification.error'), t('verification.profileNotFound'));
      } else {
        Alert.alert(t('verification.error'), t('verification.errorMessage'));
      }
    } finally {
      setVerifying(false);
    }
  };

  const renderStatusBadge = () => {
    if (isVerified) {
      return (
        <View className="flex-row items-center bg-green-100 px-3 py-1 rounded-full">
          <MaterialCommunityIcons name="check-circle" size={16} color="#22c55e" />
          <Text className="text-green-600 font-semibold ml-1">{t('verification.statusVerified')}</Text>
        </View>
      );
    }

    if (isPending) {
      return (
        <View className="flex-row items-center bg-amber-100 px-3 py-1 rounded-full">
          <MaterialCommunityIcons name="clock-outline" size={16} color="#f59e0b" />
          <Text className="text-amber-600 font-semibold ml-1">{t('verification.statusProcessing')}</Text>
        </View>
      );
    }

    if (isFailed) {
      return (
        <View className="flex-row items-center bg-red-100 px-3 py-1 rounded-full">
          <MaterialCommunityIcons name="alert-circle" size={16} color="#ef4444" />
          <Text className="text-red-600 font-semibold ml-1">{t('verification.statusFailed')}</Text>
        </View>
      );
    }

    return (
      <View className="flex-row items-center bg-gray-100 px-3 py-1 rounded-full">
        <MaterialCommunityIcons name="shield-alert-outline" size={16} color="#6b7280" />
        <Text className="text-gray-600 font-semibold ml-1">{t('verification.statusNotVerified')}</Text>
      </View>
    );
  };

  if (!profile) {
    return (
      <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <ActivityIndicator size="small" color="#A08AB7" />
      </View>
    );
  }

  return (
    <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <View className="flex-row items-start justify-between mb-4">
        <View className="flex-1">
          <View className="flex-row items-center mb-2">
            <MaterialCommunityIcons name="camera-account" size={24} color="#A08AB7" />
            <Text className="text-xl font-bold text-charcoal ml-2">{t('verification.title')}</Text>
          </View>
          {renderStatusBadge()}
        </View>
      </View>

      {/* Description */}
      <Text className="text-gray-600 mb-4 leading-5">
        {isVerified
          ? t('verification.verifiedDescription')
          : t('verification.unverifiedDescription')}
      </Text>

      {/* Important notice for non-verified users */}
      {!isVerified && (
        <View className="bg-amber-50 rounded-lg p-4 mb-4 border border-amber-200">
          <View className="flex-row items-center mb-2">
            <MaterialCommunityIcons name="lightbulb-outline" size={20} color="#d97706" />
            <Text className="text-amber-800 font-bold ml-2">{t('verification.beforeYouStart')}</Text>
          </View>
          <Text className="text-amber-700 text-sm leading-5">
            {t('verification.beforeYouStartDescription')}
          </Text>
        </View>
      )}

      {/* Attempts counter */}
      {attempts > 0 && !isVerified && (
        <View className="bg-gray-50 rounded-lg p-3 mb-4">
          <Text className="text-gray-600 text-sm">
            {t('verification.attemptsUsed', { count: attempts })}
          </Text>
        </View>
      )}

      {/* Failed state message */}
      {isFailed && (
        <View className="bg-red-50 rounded-lg p-4 mb-4 border border-red-200">
          <Text className="text-red-800 font-medium mb-1">{t('verification.unsuccessfulBanner')}</Text>
          <Text className="text-red-700 text-sm leading-5">
            {t('verification.unsuccessfulBannerMessage')}
          </Text>
        </View>
      )}

      {/* Call to action button */}
      {!isVerified && (
        <TouchableOpacity
          onPress={takeSelfie}
          disabled={verifying}
          className={`rounded-full py-4 items-center ${
            verifying ? 'bg-gray-300' : 'bg-lavender-500'
          }`}
        >
          {verifying ? (
            <View className="flex-row items-center">
              <ActivityIndicator color="#fff" size="small" />
              <Text className="text-white font-bold text-base ml-2">{t('verification.verifying')}</Text>
            </View>
          ) : (
            <View className="flex-row items-center">
              <MaterialCommunityIcons name="camera" size={20} color="#fff" />
              <Text className="text-white font-bold text-base ml-2">
                {isFailed ? t('verification.tryAgain') : t('verification.takeVerificationSelfie')}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Benefits or tips */}
      {!isVerified ? (
        <View className="mt-4 space-y-2">
          <Text className="text-gray-700 text-sm font-bold mb-3">{t('verification.forBestResults')}</Text>
          {[
            { icon: 'white-balance-sunny', text: t('verification.tips.daylight'), highlight: true },
            { icon: 'face-recognition', text: t('verification.tips.faceCamera') },
            { icon: 'image-check', text: t('verification.tips.recentPhoto') },
            { icon: 'glasses', text: t('verification.tips.removeCoverings') },
            { icon: 'lightbulb-on', text: t('verification.tips.avoidShadows') },
            { icon: 'account-check', text: t('verification.tips.mustMatch') },
          ].map((tip, index) => (
            <View key={index} className={`flex-row items-start ${tip.highlight ? 'bg-lavender-50 p-2 rounded-lg -mx-2' : ''}`}>
              <MaterialCommunityIcons
                name={tip.icon as any}
                size={18}
                color={tip.highlight ? '#A08AB7' : '#A08AB7'}
                style={{ marginTop: 1, marginRight: 10 }}
              />
              <Text className={`text-sm flex-1 ${tip.highlight ? 'text-lavender-700 font-medium' : 'text-gray-600'}`}>{tip.text}</Text>
            </View>
          ))}
        </View>
      ) : (
        <View className="mt-4 bg-green-50 rounded-lg p-4 border border-green-200">
          <View className="flex-row items-center mb-2">
            <MaterialCommunityIcons name="shield-check" size={24} color="#22c55e" />
            <Text className="text-green-800 font-bold ml-2">{t('verification.photosVerified')}</Text>
          </View>
          <Text className="text-green-700 text-sm">
            {t('verification.verifiedBadgeMessage')}
          </Text>
        </View>
      )}

      {/* Free feature badge */}
      <View className="mt-4 flex-row items-center justify-center">
        <MaterialCommunityIcons name="check-decagram" size={16} color="#10b981" />
        <Text className="text-gray-500 text-xs ml-1">{t('verification.freeForAll')}</Text>
      </View>
    </View>
  );
}
