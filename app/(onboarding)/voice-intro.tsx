import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { goToPreviousOnboardingStep } from '@/lib/onboarding-navigation';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

export default function VoiceIntro() {
  const router = useRouter();
  const { user } = useAuth();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadProfile();
    setupAudio();

    return () => {
      if (sound) {
        sound.unloadAsync();
      }
      if (recording) {
        recording.stopAndUnloadAsync();
      }
    };
  }, []);

  const setupAudio = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
    } catch (error) {
      console.error('Error setting up audio:', error);
    }
  };

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

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone access is needed to record your voice intro');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      setRecordingDuration(0);

      // Update duration every second
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 30) {
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);

      newRecording.setOnRecordingStatusUpdate((status) => {
        if (status.durationMillis >= 30000) {
          stopRecording();
        }
      });
    } catch (error: any) {
      Alert.alert('Recording Failed', error.message || 'Failed to start recording');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recording) return;

      // Clear the timer interval
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      setIsRecording(false);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordingUri(uri);
      setRecording(null);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const playRecording = async () => {
    try {
      if (!recordingUri) return;

      if (sound) {
        await sound.unloadAsync();
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: recordingUri },
        { shouldPlay: true }
      );

      setSound(newSound);
      setIsPlaying(true);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (error: any) {
      Alert.alert('Playback Failed', error.message || 'Failed to play recording');
    }
  };

  const stopPlayback = async () => {
    if (sound) {
      await sound.stopAsync();
      setIsPlaying(false);
    }
  };

  const deleteRecording = () => {
    setRecordingUri(null);
    setRecordingDuration(0);
    if (sound) {
      sound.unloadAsync();
      setSound(null);
    }
  };

  const handleContinue = async () => {
    if (!profileId) {
      Alert.alert('Error', 'Profile not found. Please start over.');
      return;
    }

    try {
      setLoading(true);

      // If there's a recording, upload it
      if (recordingUri) {
        const fileExt = 'm4a';
        const fileName = `${profileId}/voice-intro.${fileExt}`;

        // Read file as base64 using legacy API
        const base64 = await FileSystem.readAsStringAsync(recordingUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        // Upload to Supabase Storage
        const { error: uploadError } = await supabase.storage
          .from('voice-intros')
          .upload(fileName, decode(base64), {
            contentType: 'audio/m4a',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('voice-intros')
          .getPublicUrl(fileName);

        // Update profile with voice intro URL
        const { error: dbError } = await supabase
          .from('profiles')
          .update({
            voice_intro_url: publicUrl,
            voice_intro_duration: recordingDuration,
            onboarding_step: 6,
          })
          .eq('id', profileId);

        if (dbError) throw dbError;
      } else {
        // Skip voice intro
        await supabase
          .from('profiles')
          .update({ onboarding_step: 6 })
          .eq('id', profileId);
      }

      router.push('/(onboarding)/marriage-preferences');
    } catch (error: any) {
      Alert.alert('Upload Failed', error.message || 'Failed to save voice intro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-pink-50">
      <View className="px-6 pt-16 pb-8">
        {/* Progress */}
        <View className="mb-8">
          <View className="flex-row justify-between mb-2">
            <Text className="text-sm text-gray-600 font-medium">Step 6 of 7</Text>
            <Text className="text-sm text-primary-500 font-bold">86%</Text>
          </View>
          <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-3 bg-primary-500 rounded-full"
              style={{ width: '86%' }}
            />
          </View>
        </View>

        {/* Header */}
        <View className="mb-8 items-center">
          <Text className="text-5xl mb-4">🎙️</Text>
          <Text className="text-4xl font-bold text-gray-900 mb-3 text-center">
            Add your voice
          </Text>
          <Text className="text-gray-600 text-lg text-center">
            Record a 30-second introduction to stand out
          </Text>
        </View>

        {/* Recording Interface */}
        <View className="bg-white rounded-3xl p-8 shadow-lg border-2 border-pink-200 mb-8">
          {!recordingUri ? (
            <View className="items-center">
              {/* Recording Button */}
              <TouchableOpacity
                className={`w-32 h-32 rounded-full items-center justify-center ${
                  isRecording
                    ? 'bg-red-500'
                    : 'bg-primary-500'
                }`}
                onPress={isRecording ? stopRecording : startRecording}
                disabled={loading}
              >
                <MaterialCommunityIcons
                  name={isRecording ? 'stop' : 'microphone'}
                  size={60}
                  color="white"
                />
              </TouchableOpacity>

              {/* Timer */}
              <Text className="text-3xl font-bold text-gray-900 mt-6">
                {recordingDuration}s / 30s
              </Text>

              <Text className="text-gray-600 mt-4 text-center">
                {isRecording
                  ? 'Recording... Tap to stop'
                  : 'Tap the microphone to start recording'}
              </Text>
            </View>
          ) : (
            <View className="items-center">
              {/* Playback Controls */}
              <View className="flex-row items-center gap-4 mb-6">
                <TouchableOpacity
                  className="w-20 h-20 rounded-full bg-primary-500 items-center justify-center"
                  onPress={isPlaying ? stopPlayback : playRecording}
                >
                  <MaterialCommunityIcons
                    name={isPlaying ? 'pause' : 'play'}
                    size={40}
                    color="white"
                  />
                </TouchableOpacity>

                <TouchableOpacity
                  className="w-20 h-20 rounded-full bg-red-500 items-center justify-center"
                  onPress={deleteRecording}
                >
                  <MaterialCommunityIcons name="delete" size={40} color="white" />
                </TouchableOpacity>
              </View>

              <Text className="text-2xl font-bold text-gray-900 mb-2">
                {recordingDuration}s recorded
              </Text>
              <Text className="text-gray-600 text-center">
                Tap play to listen or delete to re-record
              </Text>
            </View>
          )}
        </View>

        {/* Tips */}
        <View className="bg-pink-50 border-2 border-pink-200 rounded-3xl p-5 mb-8">
          <View className="flex-row items-center mb-3">
            <MaterialCommunityIcons name="lightbulb-on" size={24} color="#B8A9DD" />
            <Text className="text-pink-900 font-bold text-lg ml-2">Recording Tips</Text>
          </View>
          <Text className="text-pink-800 text-sm mb-2">
            🎤 Find a quiet space with minimal background noise
          </Text>
          <Text className="text-pink-800 text-sm mb-2">
            💬 Introduce yourself, share what you're looking for
          </Text>
          <Text className="text-pink-800 text-sm mb-2">
            ✨ Be authentic - your voice shows personality!
          </Text>
          <Text className="text-pink-800 text-sm">
            🌈 Profiles with voice intros get 3x more matches
          </Text>
        </View>

        {/* Buttons */}
        <View className="flex-row gap-3">
          <TouchableOpacity
            className="flex-1 py-4 rounded-full border-2 border-gray-300 bg-white"
            onPress={() => goToPreviousOnboardingStep('/(onboarding)/voice-intro')}
            disabled={loading || isRecording}
          >
            <Text className="text-gray-700 text-center font-bold text-lg">Back</Text>
          </TouchableOpacity>

          <TouchableOpacity
            className={`flex-1 py-4 rounded-full ${
              loading || isRecording
                ? 'bg-gray-400'
                : 'bg-primary-500'
            }`}
            onPress={handleContinue}
            disabled={loading || isRecording}
          >
            <Text className="text-white text-center font-bold text-lg">
              {loading ? 'Saving...' : recordingUri ? 'Continue' : 'Skip for now'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}
