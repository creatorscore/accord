import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

export default function PhotoVerificationCard() {
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
      Alert.alert('Already Verified', 'Your photos are already verified!');
      return;
    }

    // Check attempts
    if (attempts >= 5) {
      Alert.alert(
        'Too Many Attempts',
        'You have exceeded the maximum number of verification attempts (5). Please contact support at hello@joinaccord.app.'
      );
      return;
    }

    try {
      // Request camera permissions
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          'Camera Permission Required',
          'Please allow camera access to take a verification selfie.'
        );
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
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
      // TEMPORARY: Show actual error for debugging
      Alert.alert('Selfie Error', `Stage: Camera/Image\n\nError: ${error?.message || error?.toString() || 'Unknown error'}`);
    }
  };

  const verifySelfie = async (imageUri: string) => {
    setVerifying(true);
    try {
      // Resize and compress image to reduce payload size
      // AWS Rekognition works well with 800x800 images
      console.log('📷 Resizing image for verification...');
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
      console.log('📤 Calling photo-verification-start edge function...');
      console.log('📷 Base64 length:', base64.length, '(~' + Math.round(base64.length / 1024) + ' KB)');

      const { data, error } = await supabase.functions.invoke('photo-verification-start', {
        body: { selfie_base64: base64 },
      });

      console.log('📥 Edge function response:', { data, error });

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
          'Photos Verified! ✓',
          `Your photos have been verified!\n\nMatch confidence: ${data.similarity}%\n\nYour profile now shows a verified badge.`,
          [{ text: 'Awesome!' }]
        );
      } else {
        Alert.alert(
          'Verification Unsuccessful',
          `${data.message}\n\nTo improve your chances:\n\n• Take your selfie in bright, natural daylight\n• Make sure your primary profile photo is recent\n• Face the camera directly\n• Remove sunglasses, hats, or masks\n• Avoid shadows on your face`,
          [
            { text: 'Try Again', onPress: takeSelfie },
            { text: 'Cancel', style: 'cancel' }
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
          'No Profile Photos',
          'Please upload profile photos before verifying.',
          [{ text: 'OK' }]
        );
      } else if (errorMessage?.includes('Already verified')) {
        Alert.alert('Already Verified', 'Your photos are already verified!');
        await loadProfile();
      } else if (errorMessage?.includes('Too many attempts')) {
        Alert.alert(
          'Too Many Attempts',
          'You have exceeded the maximum number of verification attempts. Please contact support.'
        );
      } else if (errorMessage?.includes('Profile not found')) {
        Alert.alert('Error', 'Profile not found. Please try again.');
      } else {
        // TEMPORARY: Show actual error in production for debugging
        // TODO: Revert this after fixing photo verification
        const debugInfo = error?.debug ? `\n\nDebug: ${JSON.stringify(error.debug)}` : '';
        const displayMessage = `Error: ${errorMessage}${errorDetails ? `\n\nDetails: ${errorDetails}` : ''}${debugInfo}`;
        Alert.alert('Verification Error', displayMessage);
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
          <Text className="text-green-600 font-semibold ml-1">Verified</Text>
        </View>
      );
    }

    if (isPending) {
      return (
        <View className="flex-row items-center bg-amber-100 px-3 py-1 rounded-full">
          <MaterialCommunityIcons name="clock-outline" size={16} color="#f59e0b" />
          <Text className="text-amber-600 font-semibold ml-1">Processing...</Text>
        </View>
      );
    }

    if (isFailed) {
      return (
        <View className="flex-row items-center bg-red-100 px-3 py-1 rounded-full">
          <MaterialCommunityIcons name="alert-circle" size={16} color="#ef4444" />
          <Text className="text-red-600 font-semibold ml-1">Failed</Text>
        </View>
      );
    }

    return (
      <View className="flex-row items-center bg-gray-100 px-3 py-1 rounded-full">
        <MaterialCommunityIcons name="shield-alert-outline" size={16} color="#6b7280" />
        <Text className="text-gray-600 font-semibold ml-1">Not Verified</Text>
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
            <Text className="text-xl font-bold text-charcoal ml-2">Photo Verification</Text>
          </View>
          {renderStatusBadge()}
        </View>
      </View>

      {/* Description */}
      <Text className="text-gray-600 mb-4 leading-5">
        {isVerified
          ? 'Your photos are verified! This shows other users that your profile pictures accurately represent you.'
          : 'Verify your photos by taking a selfie. We\'ll compare it to your profile photos using face recognition.'}
      </Text>

      {/* Important notice for non-verified users */}
      {!isVerified && (
        <View className="bg-amber-50 rounded-lg p-4 mb-4 border border-amber-200">
          <View className="flex-row items-center mb-2">
            <MaterialCommunityIcons name="lightbulb-outline" size={20} color="#d97706" />
            <Text className="text-amber-800 font-bold ml-2">Before You Start</Text>
          </View>
          <Text className="text-amber-700 text-sm leading-5">
            Make sure your <Text className="font-bold">primary profile photo</Text> (first photo) is a recent, clear photo of your face. The selfie you take will be compared against your profile photos.
          </Text>
        </View>
      )}

      {/* Attempts counter */}
      {attempts > 0 && !isVerified && (
        <View className="bg-gray-50 rounded-lg p-3 mb-4">
          <Text className="text-gray-600 text-sm">
            Attempts used: {attempts} / 5
          </Text>
        </View>
      )}

      {/* Failed state message */}
      {isFailed && (
        <View className="bg-red-50 rounded-lg p-4 mb-4 border border-red-200">
          <Text className="text-red-800 font-medium mb-1">Verification Unsuccessful</Text>
          <Text className="text-red-700 text-sm leading-5">
            The selfie didn't match your profile photos well enough. For best results, take your selfie in bright natural daylight and make sure your primary profile photo is a recent, clear photo of your face.
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
              <Text className="text-white font-bold text-base ml-2">Verifying...</Text>
            </View>
          ) : (
            <View className="flex-row items-center">
              <MaterialCommunityIcons name="camera" size={20} color="#fff" />
              <Text className="text-white font-bold text-base ml-2">
                {isFailed ? 'Try Again' : 'Take Verification Selfie'}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      )}

      {/* Benefits or tips */}
      {!isVerified ? (
        <View className="mt-4 space-y-2">
          <Text className="text-gray-700 text-sm font-bold mb-3">For best results:</Text>
          {[
            { icon: 'white-balance-sunny', text: 'Take your selfie in bright, natural daylight', highlight: true },
            { icon: 'face-recognition', text: 'Face the camera directly with a neutral expression' },
            { icon: 'image-check', text: 'Ensure your primary profile photo is recent and shows your face clearly' },
            { icon: 'glasses', text: 'Remove sunglasses, hats, and face coverings' },
            { icon: 'lightbulb-on', text: 'Avoid harsh shadows or backlit environments' },
            { icon: 'account-check', text: 'Your selfie must match the person in your profile photos' },
          ].map((tip, index) => (
            <View key={index} className={`flex-row items-start ${tip.highlight ? 'bg-lavender-50 p-2 rounded-lg -mx-2' : ''}`}>
              <MaterialCommunityIcons
                name={tip.icon as any}
                size={18}
                color={tip.highlight ? '#8B5CF6' : '#A08AB7'}
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
            <Text className="text-green-800 font-bold ml-2">Photos Verified!</Text>
          </View>
          <Text className="text-green-700 text-sm">
            Your verified badge is now showing on your profile. This helps build trust with potential matches.
          </Text>
        </View>
      )}

      {/* Free feature badge */}
      <View className="mt-4 flex-row items-center justify-center">
        <MaterialCommunityIcons name="check-decagram" size={16} color="#10b981" />
        <Text className="text-gray-500 text-xs ml-1">Free for all users</Text>
      </View>
    </View>
  );
}
