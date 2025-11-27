import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';

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
      Alert.alert('Error', 'Failed to take selfie. Please try again.');
    }
  };

  const verifySelfie = async (imageUri: string) => {
    setVerifying(true);
    try {
      // Read image as base64
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Call Edge Function
      const { data, error } = await supabase.functions.invoke('photo-verification-start', {
        body: { selfie_base64: base64 },
      });

      if (error) throw error;

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
          `${data.message}\n\nPlease ensure:\n• Good lighting\n• Clear view of your face\n• Same person as profile photos\n• No sunglasses or masks`,
          [
            { text: 'Try Again', onPress: takeSelfie },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }

    } catch (error: any) {
      console.error('Error verifying selfie:', error);

      // Handle specific errors
      if (error.message?.includes('No photos to compare')) {
        Alert.alert(
          'No Profile Photos',
          'Please upload profile photos before verifying.',
          [{ text: 'OK' }]
        );
      } else if (error.message?.includes('Already verified')) {
        Alert.alert('Already Verified', 'Your photos are already verified!');
        await loadProfile();
      } else if (error.message?.includes('Too many attempts')) {
        Alert.alert(
          'Too Many Attempts',
          'You have exceeded the maximum number of verification attempts. Please contact support.'
        );
      } else {
        Alert.alert('Error', 'Failed to verify photos. Please try again later.');
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
        <ActivityIndicator size="small" color="#9B87CE" />
      </View>
    );
  }

  return (
    <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      {/* Header */}
      <View className="flex-row items-start justify-between mb-4">
        <View className="flex-1">
          <View className="flex-row items-center mb-2">
            <MaterialCommunityIcons name="camera-account" size={24} color="#9B87CE" />
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
          <Text className="text-red-700 text-sm">
            The selfie didn't match your profile photos well enough. Try again with better lighting and a clear face shot.
          </Text>
        </View>
      )}

      {/* Call to action button */}
      {!isVerified && (
        <TouchableOpacity
          onPress={takeSelfie}
          disabled={verifying}
          className={`rounded-full py-4 items-center ${
            verifying ? 'bg-gray-300' : 'bg-primary-500'
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
          <Text className="text-gray-500 text-sm font-semibold mb-2">Tips for best results:</Text>
          {[
            'Face the camera directly',
            'Ensure good lighting (natural light works best)',
            'Remove sunglasses, hats, and masks',
            'Match the same person in your profile photos'
          ].map((tip, index) => (
            <View key={index} className="flex-row items-start">
              <MaterialCommunityIcons
                name="check"
                size={16}
                color="#9B87CE"
                style={{ marginTop: 2, marginRight: 8 }}
              />
              <Text className="text-gray-600 text-sm flex-1">{tip}</Text>
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
