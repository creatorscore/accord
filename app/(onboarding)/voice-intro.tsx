import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { Waveform, type IWaveformRef, PlayerState, RecorderState } from '@/components/shared/ConditionalWaveform';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { goToPreviousOnboardingStep } from '@/lib/onboarding-navigation';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';

// Suggested prompts for voice intro
const VOICE_PROMPTS = [
  "A story I love to tell...",
  "My hot take is...",
  "The way to my heart is...",
  "I'm looking for someone who...",
  "Something that always makes me laugh...",
  "My perfect Sunday looks like...",
  "I get way too excited about...",
  "The best trip I ever took...",
];

export default function VoiceIntro() {
  const router = useRouter();
  const { user } = useAuth();
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const liveWaveformRef = useRef<IWaveformRef>(null);
  const staticWaveformRef = useRef<IWaveformRef>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    loadProfile();
    setupAudio();

    return () => {
      // Cleanup
      liveWaveformRef.current?.stopRecord();
      staticWaveformRef.current?.stopPlayer();
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
      // Request permissions
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Microphone access is needed to record your voice intro');
        return;
      }

      setIsRecording(true);
      setRecordingDuration(0);

      // Start the waveform recorder
      const path = await liveWaveformRef.current?.startRecord({
        encoder: 0, // AAC
        sampleRate: 44100,
        bitRate: 128000,
        fileNameFormat: `voice_intro_${Date.now()}.m4a`,
        useLegacy: false,
      });

      // Update duration every second with max 30 seconds
      timerIntervalRef.current = setInterval(() => {
        setRecordingDuration((prev) => {
          if (prev >= 30) {
            stopRecording();
            return 30;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (error: any) {
      Alert.alert('Recording Failed', error.message || 'Failed to start recording');
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      // Clear the timer interval
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }

      setIsRecording(false);
      const path = await liveWaveformRef.current?.stopRecord();
      if (path) {
        setRecordingUri(path);
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to stop recording');
    }
  };

  const handleRecorderStateChange = (state: RecorderState) => {
    if (state === RecorderState.stopped) {
      setIsRecording(false);
    }
  };

  const handlePlayerStateChange = (state: PlayerState) => {
    setIsPlaying(state === PlayerState.playing);
  };

  const togglePlayback = async () => {
    if (!recordingUri) return;

    try {
      if (isPlaying) {
        await staticWaveformRef.current?.pausePlayer();
      } else {
        await staticWaveformRef.current?.startPlayer();
      }
    } catch (err) {
      console.error('Error toggling playback:', err);
    }
  };

  const deleteRecording = () => {
    setRecordingUri(null);
    setRecordingDuration(0);
    setIsPlaying(false);
    staticWaveformRef.current?.stopPlayer();
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

        // Get the final prompt (custom or selected)
        const finalPrompt = showCustomInput ? customPrompt.trim() : selectedPrompt;

        // Update profile with voice intro URL and prompt
        const { error: dbError } = await supabase
          .from('profiles')
          .update({
            voice_intro_url: publicUrl,
            voice_intro_duration: recordingDuration,
            voice_intro_prompt: finalPrompt || null,
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
            <Text className="text-sm text-lavender-500 font-bold">86%</Text>
          </View>
          <View className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <View
              className="h-3 bg-lavender-500 rounded-full"
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

        {/* Prompt Selection */}
        <View className="mb-6">
          <Text className="text-lg font-bold text-gray-900 mb-3">
            Choose a prompt to answer:
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {VOICE_PROMPTS.map((prompt) => (
              <TouchableOpacity
                key={prompt}
                onPress={() => {
                  setSelectedPrompt(prompt);
                  setShowCustomInput(false);
                }}
                className={`px-4 py-2 rounded-full border-2 ${
                  selectedPrompt === prompt && !showCustomInput
                    ? 'bg-lavender-500 border-lavender-500'
                    : 'bg-white border-gray-200'
                }`}
              >
                <Text
                  className={`text-sm ${
                    selectedPrompt === prompt && !showCustomInput
                      ? 'text-white font-semibold'
                      : 'text-gray-700'
                  }`}
                >
                  {prompt}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              onPress={() => {
                setShowCustomInput(true);
                setSelectedPrompt('');
              }}
              className={`px-4 py-2 rounded-full border-2 ${
                showCustomInput
                  ? 'bg-lavender-500 border-lavender-500'
                  : 'bg-white border-gray-200'
              }`}
            >
              <Text
                className={`text-sm ${
                  showCustomInput ? 'text-white font-semibold' : 'text-gray-700'
                }`}
              >
                ✨ Write my own
              </Text>
            </TouchableOpacity>
          </View>

          {/* Custom Prompt Input */}
          {showCustomInput && (
            <View className="mt-4">
              <TextInput
                className="bg-white border-2 border-gray-200 rounded-xl px-4 py-3 text-gray-900"
                placeholder="Type your own prompt..."
                placeholderTextColor="#9CA3AF"
                value={customPrompt}
                onChangeText={setCustomPrompt}
                maxLength={100}
              />
              <Text className="text-gray-500 text-xs mt-1 text-right">
                {customPrompt.length}/100
              </Text>
            </View>
          )}
        </View>

        {/* Recording Interface */}
        <View className="bg-white rounded-3xl p-8 border border-gray-200 mb-8">
          {!recordingUri ? (
            <View className="items-center">
              {/* Selected Prompt Display */}
              {(selectedPrompt || customPrompt) && (
                <Text className="text-lg font-semibold text-gray-900 mb-6 text-center">
                  "{showCustomInput ? customPrompt : selectedPrompt}"
                </Text>
              )}

              {/* Live Recording Waveform (hidden when not recording) */}
              {isRecording && (
                <View style={styles.liveWaveformContainer}>
                  <Waveform
                    ref={liveWaveformRef}
                    mode="live"
                    candleSpace={2}
                    candleWidth={4}
                    waveColor="#A08AB7"
                    onRecorderStateChange={handleRecorderStateChange}
                    containerStyle={styles.liveWaveform}
                  />
                </View>
              )}

              {/* Recording Button */}
              <TouchableOpacity
                className={`w-32 h-32 rounded-full items-center justify-center ${
                  isRecording
                    ? 'bg-red-500'
                    : 'bg-lavender-500'
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
            <View className="items-center w-full">
              {/* Prompt Display */}
              <Text style={styles.promptText}>
                {showCustomInput ? customPrompt : selectedPrompt || 'Your voice intro'}
              </Text>

              {/* Audio Player with Real Waveform */}
              <View style={styles.playerContainer}>
                {/* Play/Pause Button */}
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={togglePlayback}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={isPlaying ? "pause" : "play"}
                    size={20}
                    color="white"
                  />
                </TouchableOpacity>

                {/* Static Waveform for Playback */}
                <View style={styles.waveformContainer}>
                  <Waveform
                    ref={staticWaveformRef}
                    mode="static"
                    path={recordingUri}
                    candleSpace={2}
                    candleWidth={3}
                    waveColor="#EBE6F2"
                    scrubColor="#A08AB7"
                    onPlayerStateChange={handlePlayerStateChange}
                    containerStyle={styles.waveform}
                  />
                </View>

                {/* Duration */}
                <Text style={styles.duration}>
                  {formatTime(recordingDuration)}
                </Text>
              </View>

              {/* Delete Button */}
              <TouchableOpacity
                className="flex-row items-center gap-2 mt-4 py-3 px-6 rounded-full bg-red-50 border border-red-200"
                onPress={deleteRecording}
              >
                <MaterialCommunityIcons name="delete" size={20} color="#EF4444" />
                <Text className="text-red-500 font-semibold">Delete & Re-record</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Tips */}
        <View className="bg-pink-50 border-2 border-pink-200 rounded-3xl p-5 mb-8">
          <View className="flex-row items-center mb-3">
            <MaterialCommunityIcons name="lightbulb-on" size={24} color="#CDC2E5" />
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
                : 'bg-lavender-500'
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

const styles = StyleSheet.create({
  promptText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  liveWaveformContainer: {
    width: '100%',
    height: 60,
    marginBottom: 20,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    overflow: 'hidden',
  },
  liveWaveform: {
    height: 60,
  },
  playerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 8,
    paddingRight: 16,
    width: '100%',
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#A08AB7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformContainer: {
    flex: 1,
    height: 32,
    justifyContent: 'center',
  },
  waveform: {
    height: 32,
  },
  duration: {
    fontSize: 13,
    fontWeight: '500',
    color: '#71717A',
    minWidth: 36,
  },
});
