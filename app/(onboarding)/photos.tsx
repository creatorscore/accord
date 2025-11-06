import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Image, ScrollView, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';
import { optimizeImage, uriToArrayBuffer, validateImage } from '@/lib/image-optimization';

interface Photo {
  uri: string;
  id?: string;
}

export default function Photos() {
  const router = useRouter();
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);
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
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setProfileId(data.id);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load profile');
    }
  };

  const pickImage = useCallback(async () => {
    if (photos.length >= 6) {
      Alert.alert('Maximum Photos', 'You can upload up to 6 photos');
      return;
    }

    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'We need permission to access your photos');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [3, 4],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const selectedUri = result.assets[0].uri;

        // Validate image before processing
        const validation = await validateImage(selectedUri);
        if (!validation.isValid) {
          Alert.alert('Invalid Image', validation.error || 'Please select a different photo');
          return;
        }

        // Optimize image with better compression and memory management
        const { optimized } = await optimizeImage(selectedUri, {
          generateThumbnail: true, // Generate thumbnail for faster loading
        });

        console.log(`Optimized image: ${(optimized.size! / 1024).toFixed(0)}KB (${optimized.width}x${optimized.height})`);

        // Update state if component is still mounted
        if (isMounted.current) {
          setPhotos(prev => [...prev, { uri: optimized.uri }]);
        }
      }
    } catch (error: any) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to select photo. Please try again.');
    }
  }, [photos.length]);

  const removePhoto = (index: number) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

  const handleContinue = async () => {
    if (photos.length < 2) {
      Alert.alert('More Photos Needed', 'Please add at least 2 photos to continue');
      return;
    }

    if (!profileId) {
      Alert.alert('Error', 'Profile not found. Please go back and complete Step 1.');
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // Upload each photo to Supabase Storage
      for (let i = 0; i < photos.length; i++) {
        const photo = photos[i];
        const timestamp = Date.now();
        const fileExt = 'jpg';
        const fileName = `${profileId}/${timestamp}_${i}.${fileExt}`;

        try {
          // Convert URI to ArrayBuffer using optimized utility
          const arrayBuffer = await uriToArrayBuffer(photo.uri);

          // Upload to Supabase Storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('profile-photos')
            .upload(fileName, arrayBuffer, {
              contentType: 'image/jpeg',
              upsert: false,
            });

          if (uploadError) {
            console.error(`Upload error for photo ${i}:`, uploadError);
            throw new Error(`Failed to upload photo ${i + 1}: ${uploadError.message}`);
          }

          // Get public URL for the photo
          const { data: { publicUrl } } = supabase.storage
            .from('profile-photos')
            .getPublicUrl(fileName);

          // Save to photos table
          const { error: dbError } = await supabase
            .from('photos')
            .insert({
              profile_id: profileId,
              storage_path: fileName,
              url: publicUrl,
              display_order: i,
              is_primary: i === 0,
            });

          if (dbError) {
            console.error(`Database error for photo ${i}:`, dbError);
            throw new Error(`Failed to save photo ${i + 1} to database: ${dbError.message}`);
          }

          // Update progress
          setUploadProgress(Math.round(((i + 1) / photos.length) * 100));
        } catch (photoError: any) {
          console.error(`Error processing photo ${i}:`, photoError);
          throw photoError;
        }
      }

      // Update onboarding step
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ onboarding_step: 2 })
        .eq('id', profileId);

      if (updateError) {
        console.error('Error updating onboarding step:', updateError);
      }

      // Navigate to next step immediately
      router.push('/(onboarding)/about');
    } catch (error: any) {
      console.error('Upload failed:', error);
      if (isMounted.current) {
        Alert.alert('Upload Failed', error.message || 'Failed to upload photos. Please try again.');
        setUploading(false);
        setUploadProgress(0);
      }
    }
  };

  return (
    <ScrollView className="flex-1 bg-purple-50">
      <View className="px-6 pt-16 pb-8">
        {/* Progress */}
        <View className="mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-gray-600 font-medium">Step 2 of 8</Text>
            <Text className="text-sm text-primary-500 font-bold">25%</Text>
          </View>
          <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-3 bg-primary-500 rounded-full"
              style={{ width: '25%' }}
            />
          </View>
        </View>

        {/* Header */}
        <View className="mb-8">
          <Text className="text-4xl font-bold text-gray-900 mb-3">
            Show yourself 📸
          </Text>
          <Text className="text-gray-600 text-lg">
            Upload 2-6 photos. Your first photo will be your profile picture.
          </Text>
        </View>

        {/* Photo Grid */}
        <View className="flex-row flex-wrap gap-3 mb-8">
          {photos.map((photo, index) => (
            <View key={index} className="relative">
              <Image
                source={{ uri: photo.uri }}
                className="w-28 h-36 rounded-2xl bg-gray-200"
              />
              <TouchableOpacity
                className="absolute top-2 right-2 bg-black/50 rounded-full p-1"
                onPress={() => removePhoto(index)}
              >
                <MaterialCommunityIcons name="close" size={16} color="white" />
              </TouchableOpacity>
              {index === 0 && (
                <View className="absolute bottom-2 left-2 bg-primary-500 px-2 py-1 rounded">
                  <Text className="text-white text-xs font-semibold">Primary</Text>
                </View>
              )}
            </View>
          ))}

          {/* Add Photo Button */}
          {photos.length < 6 && (
            <TouchableOpacity
              className="w-28 h-36 rounded-2xl border-2 border-dashed border-gray-300 items-center justify-center bg-gray-50"
              onPress={pickImage}
            >
              <MaterialCommunityIcons name="plus" size={32} color="#9CA3AF" />
              <Text className="text-gray-500 text-xs mt-1">Add Photo</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Tips */}
        <View className="bg-blue-50 border-2 border-blue-200 rounded-3xl p-5 mb-8">
          <View className="flex-row items-center mb-3">
            <Text className="text-3xl mr-2">📷</Text>
            <Text className="text-blue-900 font-bold text-lg">Photo Tips</Text>
          </View>
          <Text className="text-blue-800 text-sm mb-2">✨ Use clear, recent photos</Text>
          <Text className="text-blue-800 text-sm mb-2">😊 Show your face clearly</Text>
          <Text className="text-blue-800 text-sm mb-2">🎨 Include variety (close-up, full body, activity)</Text>
          <Text className="text-blue-800 text-sm">👥 Avoid group photos as your first photo</Text>
        </View>

        {/* Buttons */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 py-4 rounded-full border-2 border-gray-300 bg-white"
            onPress={() => router.back()}
            disabled={uploading}
          >
            <Text className="text-gray-700 text-center font-bold text-lg">Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-4 rounded-full ${
              uploading || photos.length < 2
                ? 'bg-gray-400'
                : 'bg-primary-500'
            }`}
            onPress={handleContinue}
            disabled={uploading || photos.length < 2}
          >
            <Text className="text-white text-center font-bold text-lg">
              {uploading ? `Uploading... ${uploadProgress}%` : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Photo Counter */}
        <Text className="text-center text-gray-500 text-sm mt-4">
          {photos.length} of 6 photos {photos.length < 2 && '(minimum 2)'}
        </Text>
      </View>
    </ScrollView>
  );
}
