import { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, TextInput, useColorScheme, Animated as RNAnimated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { Waveform, type IWaveformRef, PlayerState, RecorderState } from '@/components/shared/ConditionalWaveform';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { goToPreviousOnboardingStep, goToNextOnboardingStep } from '@/lib/onboarding-navigation';
import { getGlobalStep } from '@/lib/onboarding-steps';
import { openAppSettings } from '@/lib/open-settings';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';

// Simple waveform visualization with playback progress
const BAR_COUNT = 32;
function AudioWaveformBars({ progress, playing, isDark }: { progress: number; playing: boolean; isDark: boolean }) {
  const bars = useMemo(() => {
    const result = [];
    for (let i = 0; i < BAR_COUNT; i++) {
      const h = 0.2 + Math.abs(Math.sin(i * 0.4) * 0.5 + Math.cos(i * 0.7) * 0.3);
      result.push(Math.min(1, h));
    }
    return result;
  }, []);

  const progressIndex = Math.floor(progress * BAR_COUNT);

  return (
    <View style={wfStyles.container}>
      {bars.map((h, i) => (
        <View
          key={i}
          style={[
            wfStyles.bar,
            {
              height: 28 * h,
              backgroundColor: i < progressIndex ? '#A08AB7' : (isDark ? '#3A3A4D' : '#EBE6F2'),
            },
          ]}
        />
      ))}
    </View>
  );
}

const wfStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
    gap: 2,
    flex: 1,
  },
  bar: {
    flex: 1,
    borderRadius: 2,
    minWidth: 2,
  },
});

const VOICE_PROMPT_KEYS = [
  'prompt1', 'prompt2', 'prompt3', 'prompt4',
  'prompt5', 'prompt6', 'prompt7', 'prompt8',
] as const;

interface VoiceIntroProps {
  embedded?: boolean;
  onContinue?: () => void;
  onBack?: () => void;
}

export default function VoiceIntro({ embedded, onContinue: parentContinue, onBack: parentBack }: VoiceIntroProps = {}) {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const insets = useSafeAreaInsets();

  const VOICE_PROMPTS = VOICE_PROMPT_KEYS.map(key => t(`onboarding.voiceIntro.${key}`));

  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const liveWaveformRef = useRef<IWaveformRef>(null);
  // staticWaveformRef removed — playback uses expo-av now
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isNewRecording, setIsNewRecording] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    loadProfile();
    setupAudio();
    return () => {
      liveWaveformRef.current?.stopRecord();
      soundRef.current?.unloadAsync();
    };
  }, []);

  const setupAudio = async () => {
    try {
      // Start in playback mode so loading an existing recording plays through
      // the loudspeaker. We switch to recording mode inside startRecording.
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
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
        .select('id, voice_intro_url, voice_intro_prompt, voice_intro_duration')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setProfileId(data.id);
        if (data.voice_intro_url) {
          // DB stores the storage path (e.g. "profileId/voice-intro.m4a").
          // The native waveform player needs a LOCAL file path — download it.
          try {
            const { data: urlData } = supabase.storage
              .from('voice-intros')
              .getPublicUrl(data.voice_intro_url);
            if (urlData?.publicUrl) {
              const localPath = `${FileSystem.cacheDirectory}voice-intro-${data.id}.m4a`;
              const { uri } = await FileSystem.downloadAsync(urlData.publicUrl, localPath);
              setRecordingUri(uri);
            }
          } catch (dlErr) {
            console.warn('Failed to download voice intro for playback:', dlErr);
          }
          if (data.voice_intro_duration) setRecordingDuration(data.voice_intro_duration);
        }
        if (data.voice_intro_prompt) {
          if (VOICE_PROMPTS.includes(data.voice_intro_prompt)) {
            setSelectedPrompt(data.voice_intro_prompt);
          } else {
            setCustomPrompt(data.voice_intro_prompt);
            setShowCustomInput(true);
          }
        }
      }
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const startRecording = async () => {
    try {
      const { status, canAskAgain } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert(
            t('onboarding.voiceIntro.micPermissionTitle'),
            t('onboarding.voiceIntro.micPermissionMessage'),
            [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('common.openSettings'), onPress: () => openAppSettings() },
            ]
          );
        } else {
          showToast({ type: 'error', title: t('toast.permissionDenied'), message: t('toast.micPermissionRequired') });
        }
        return;
      }

      // Switch to recording mode (routes mic in, disables playback-only output)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      setIsRecording(true);
      setRecordingDuration(0);

      await liveWaveformRef.current?.startRecord({
        encoder: 0,
        sampleRate: 44100,
        bitRate: 128000,
        fileNameFormat: `voice_intro_${Date.now()}.m4a`,
        useLegacy: false,
      });

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
      showToast({ type: 'error', title: t('common.error'), message: error.message || t('toast.recordingFailed') });
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    try {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      // Stop the native recorder BEFORE setting isRecording=false, because
      // the Waveform component is conditionally rendered on isRecording —
      // flipping state first unmounts it and nulls the ref.
      const path = await liveWaveformRef.current?.stopRecord();
      setIsRecording(false);
      if (path) {
        setRecordingUri(path);
        setIsNewRecording(true);
        setPlayerReady(false);
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
    } catch (error: any) {
      console.error('stopRecording error:', error);
      setIsRecording(false);
      showToast({ type: 'error', title: t('common.error'), message: error?.message || t('toast.stopRecordingFailed') });
    }
  };

  const handleRecorderStateChange = (_state: RecorderState) => {
    // No-op: we manage isRecording explicitly in startRecording/stopRecording.
    // The Waveform component fires this callback during its own render lifecycle
    // (including with `stopped` on initial mount), which would incorrectly flip
    // our UI back to the mic icon while the recording is actually in progress.
  };

  const handlePlayerStateChange = (_state: PlayerState) => {
    // No-op: we manage playback via expo-av Sound, not the waveform's player.
  };

  const handleWaveformLoadState = (loading: boolean) => {
    if (!loading) setPlayerReady(true);
  };

  // Use expo-av for reliable playback instead of native waveform player
  const soundRef = useRef<Audio.Sound | null>(null);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const togglePlayback = async () => {
    if (!recordingUri) return;
    try {
      if (isPlaying) {
        await soundRef.current?.pauseAsync();
        setIsPlaying(false);
      } else {
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
          soundRef.current = null;
        }
        const uri = recordingUri.startsWith('file://') || recordingUri.startsWith('/')
          ? (recordingUri.startsWith('file://') ? recordingUri : `file://${recordingUri}`)
          : recordingUri;
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true, progressUpdateIntervalMillis: 100 },
          (status) => {
            if (!status.isLoaded) return;
            if (status.durationMillis && status.positionMillis) {
              setPlaybackProgress(status.positionMillis / status.durationMillis);
            }
            if (status.didJustFinish) {
              setIsPlaying(false);
              setPlaybackProgress(0);
              soundRef.current?.unloadAsync();
              soundRef.current = null;
            }
          }
        );
        soundRef.current = sound;
        setIsPlaying(true);
        setPlaybackProgress(0);
      }
    } catch (err) {
      console.error('Error toggling playback:', err);
      setIsPlaying(false);
    }
  };

  useEffect(() => {
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  const deleteRecording = () => {
    soundRef.current?.unloadAsync();
    soundRef.current = null;
    setRecordingUri(null);
    setRecordingDuration(0);
    setIsPlaying(false);
    setIsNewRecording(false);
    setPlayerReady(false);
  };

  const handleContinue = async () => {
    if (!profileId) {
      showToast({ type: 'error', title: t('common.error'), message: t('toast.profileNotFound') });
      return;
    }

    try {
      setLoading(true);

      if (recordingUri && isNewRecording) {
        const fileExt = 'm4a';
        const fileName = `${profileId}/voice-intro.${fileExt}`;

        // Normalize the path — native waveform module may return a bare path
        // without file:// prefix, which expo-file-system requires on Android.
        const normalizedUri = recordingUri.startsWith('file://') ? recordingUri : `file://${recordingUri}`;

        const base64 = await FileSystem.readAsStringAsync(normalizedUri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const { error: uploadError } = await supabase.storage
          .from('voice-intros')
          .upload(fileName, decode(base64), {
            contentType: 'audio/m4a',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const finalPrompt = showCustomInput ? customPrompt.trim() : selectedPrompt;

        const updateData: Record<string, any> = {
          voice_intro_url: fileName,
          voice_intro_duration: recordingDuration,
          voice_intro_prompt: finalPrompt || null,
        };
        if (!embedded) updateData.onboarding_step = 7;

        const { error: dbError } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', profileId);

        if (dbError) throw dbError;
      } else if (recordingUri && !isNewRecording) {
        const finalPrompt = showCustomInput ? customPrompt.trim() : selectedPrompt;
        const updateData: Record<string, any> = {
          voice_intro_prompt: finalPrompt || null,
        };
        if (!embedded) updateData.onboarding_step = 7;

        await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', profileId);
      } else if (!embedded) {
        await supabase
          .from('profiles')
          .update({ onboarding_step: 7 })
          .eq('id', profileId);
      }

      if (embedded && parentContinue) {
        parentContinue();
      } else {
        router.push('/(onboarding)/onboarding');
      }
    } catch (error: any) {
      console.error('Voice intro save error:', error, 'recordingUri:', recordingUri);
      showToast({ type: 'error', title: t('common.error'), message: error.message || t('toast.voiceUploadFailed') });
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <>
      {/* Prompt Selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: isDark ? '#F5F5F7' : '#1F2937' }]}>
          {t('onboarding.voiceIntro.choosePrompt')}
        </Text>
        <View>
          {VOICE_PROMPTS.map((prompt, i) => {
            const selected = selectedPrompt === prompt && !showCustomInput;
            return (
              <TouchableOpacity
                key={prompt}
                onPress={() => { setSelectedPrompt(prompt); setShowCustomInput(false); }}
                style={[styles.optionRow, i < VOICE_PROMPTS.length && { marginBottom: 4 }]}
                activeOpacity={0.7}
              >
                <Text style={[styles.optionRowText, { color: selected ? '#A08AB7' : isDark ? '#D1D5DB' : '#374151' }]}>
                  {prompt}
                </Text>
                {selected && (
                  <MaterialCommunityIcons name="check" size={22} color="#A08AB7" />
                )}
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => { setShowCustomInput(true); setSelectedPrompt(''); }}
            style={[styles.optionRow, { marginBottom: 4 }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.optionRowText, { color: showCustomInput ? '#A08AB7' : isDark ? '#D1D5DB' : '#374151' }]}>
              {t('onboarding.voiceIntro.writeMyOwn')}
            </Text>
            {showCustomInput && (
              <MaterialCommunityIcons name="check" size={22} color="#A08AB7" />
            )}
          </TouchableOpacity>
        </View>

        {showCustomInput && (
          <View style={styles.customPromptContainer}>
            <TextInput
              style={[styles.customInput, {
                backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA',
                color: isDark ? '#F5F5F7' : '#1A1A2E',
              }]}
              placeholder={t('onboarding.voiceIntro.customPlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={customPrompt}
              onChangeText={setCustomPrompt}
              maxLength={100}
            />
            <Text style={[styles.charCount, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>
              {customPrompt.length}/100
            </Text>
          </View>
        )}
      </View>

      {/* Recording Interface */}
      <View style={[styles.recordingCard, { backgroundColor: isDark ? '#1C1C2E' : '#FFFFFF' }]}>
        {!recordingUri ? (
          <View style={styles.recordingContent}>
            {(selectedPrompt || customPrompt) && (
              <Text style={[styles.selectedPromptText, { color: isDark ? '#F5F5F7' : '#1F2937' }]}>
                "{showCustomInput ? customPrompt : selectedPrompt}"
              </Text>
            )}

            <View style={[
              styles.liveWaveformContainer,
              { backgroundColor: isDark ? '#0F0F1A' : '#F5F5F5' },
              !isRecording && { height: 0, overflow: 'hidden', marginBottom: 0 },
            ]}>
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

            <TouchableOpacity
              style={[styles.recordButton, { backgroundColor: isRecording ? '#EF4444' : '#A08AB7' }]}
              onPress={isRecording ? stopRecording : startRecording}
              disabled={loading}
              accessibilityRole="button"
              accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording voice intro'}
              accessibilityState={{ disabled: loading }}
            >
              <MaterialCommunityIcons name={isRecording ? 'stop' : 'microphone'} size={60} color="white" />
            </TouchableOpacity>

            <Text style={[styles.timerText, { color: isDark ? '#F5F5F7' : '#1F2937' }]}>
              {recordingDuration}s / 30s
            </Text>

            <Text style={[styles.recordingHint, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
              {isRecording ? t('onboarding.voiceIntro.recordingHint') : t('onboarding.voiceIntro.tapToRecord')}
            </Text>
          </View>
        ) : (
          <View style={styles.playbackContent}>
            <Text style={[styles.promptText, { color: isDark ? '#F5F5F7' : '#1F2937' }]}>
              {showCustomInput ? customPrompt : selectedPrompt || t('onboarding.voiceIntro.yourVoiceIntro')}
            </Text>

            <View style={[styles.playerContainer, { backgroundColor: isDark ? '#0F0F1A' : '#F5F5F5' }]}>
              <TouchableOpacity
                style={styles.playButton}
                onPress={togglePlayback}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={isPlaying ? 'Pause playback' : 'Play voice recording'}
              >
                <MaterialCommunityIcons name={isPlaying ? "pause" : "play"} size={20} color="white" />
              </TouchableOpacity>

              <View style={styles.waveformContainer}>
                <AudioWaveformBars progress={playbackProgress} playing={isPlaying} isDark={isDark} />
              </View>

              <Text style={[styles.duration, { color: isDark ? '#9CA3AF' : '#71717A' }]}>
                {formatTime(recordingDuration)}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.deleteButton, { backgroundColor: isDark ? 'rgba(127,29,29,0.3)' : '#FEF2F2' }]}
              onPress={deleteRecording}
            >
              <MaterialCommunityIcons name="delete" size={20} color="#EF4444" />
              <Text style={[styles.deleteButtonText, { color: isDark ? '#FCA5A5' : '#EF4444' }]}>{t('onboarding.voiceIntro.deleteRerecord')}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Tips */}
      <View style={[styles.tipsCard, { backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA' }]}>
        <View style={styles.tipsHeader}>
          <MaterialCommunityIcons name="lightbulb-on" size={22} color="#A08AB7" />
          <Text style={[styles.tipsTitle, { color: isDark ? '#E5E7EB' : '#1F2937' }]}>{t('onboarding.voiceIntro.tipsTitle')}</Text>
        </View>
        <Text style={[styles.tipItem, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>{t('onboarding.voiceIntro.tip1')}</Text>
        <Text style={[styles.tipItem, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>{t('onboarding.voiceIntro.tip2')}</Text>
        <Text style={[styles.tipItem, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>{t('onboarding.voiceIntro.tip3')}</Text>
        <Text style={[styles.tipItem, { color: isDark ? '#D1D5DB' : '#4B5563' }]}>{t('onboarding.voiceIntro.tip4')}</Text>
      </View>
    </>
  );

  if (embedded) {
    const continueDisabled = loading || isRecording;
    const activePrompt = showCustomInput ? customPrompt : selectedPrompt;

    return (
      <View style={{ flex: 1 }}>
        {/* Embedded title */}
        <Text style={styles.embeddedTitle}>{t('onboarding.voiceIntro.title')}</Text>
        <Text style={styles.embeddedSubtitle}>{t('onboarding.voiceIntro.subtitle')}</Text>

        {/* Compact prompt chips */}
        <View style={styles.compactChipRow}>
          {VOICE_PROMPTS.map((prompt) => {
            const selected = selectedPrompt === prompt && !showCustomInput;
            return (
              <TouchableOpacity
                key={prompt}
                onPress={() => { setSelectedPrompt(prompt); setShowCustomInput(false); }}
                style={[
                  styles.compactChip,
                  { backgroundColor: selected ? '#A08AB7' : (isDark ? '#1C1C2E' : '#F5F3F8') },
                ]}
                activeOpacity={0.7}
              >
                <Text style={[styles.compactChipText, { color: selected ? '#FFFFFF' : (isDark ? '#D4C4E8' : '#6B5B8A') }]} numberOfLines={1}>
                  {prompt}
                </Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => { setShowCustomInput(true); setSelectedPrompt(''); }}
            style={[
              styles.compactChip,
              { backgroundColor: showCustomInput ? '#A08AB7' : (isDark ? '#1C1C2E' : '#F5F3F8') },
            ]}
            activeOpacity={0.7}
          >
            <Text style={[styles.compactChipText, { color: showCustomInput ? '#FFFFFF' : (isDark ? '#D4C4E8' : '#6B5B8A') }]}>
              ✎ {t('onboarding.voiceIntro.writeMyOwn')}
            </Text>
          </TouchableOpacity>
        </View>

        {showCustomInput && (
          <TextInput
            style={[styles.compactCustomInput, {
              backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA',
              color: isDark ? '#F5F5F7' : '#1A1A2E',
            }]}
            placeholder={t('onboarding.voiceIntro.customPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={customPrompt}
            onChangeText={setCustomPrompt}
            maxLength={100}
          />
        )}

        {/* Compact recording area — fills remaining space */}
        <View style={styles.compactRecordArea}>
          {!recordingUri ? (
            <>
              <View style={[
                styles.compactLiveWaveform,
                { backgroundColor: isDark ? '#0F0F1A' : '#F5F3F8' },
                !isRecording && { height: 0, overflow: 'hidden', marginBottom: 0 },
              ]}>
                <Waveform
                  ref={liveWaveformRef}
                  mode="live"
                  candleSpace={2}
                  candleWidth={4}
                  waveColor="#A08AB7"
                  onRecorderStateChange={handleRecorderStateChange}
                  containerStyle={{ height: 48 }}
                />
              </View>
              <TouchableOpacity
                style={[
                  styles.compactRecordButton,
                  { backgroundColor: isRecording ? '#EF4444' : '#A08AB7' },
                  loading && styles.embeddedButtonDisabled,
                ]}
                onPress={isRecording ? stopRecording : startRecording}
                disabled={loading}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={isRecording ? 'Stop recording' : 'Start recording voice intro'}
              >
                <MaterialCommunityIcons name={isRecording ? 'stop' : 'microphone'} size={44} color="white" />
              </TouchableOpacity>
              <Text style={[styles.compactTimer, { color: isDark ? '#F5F5F7' : '#1F2937' }]}>
                {recordingDuration}s / 30s
              </Text>
              <Text style={[styles.compactHint, { color: isDark ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1}>
                {isRecording
                  ? t('onboarding.voiceIntro.recordingHint')
                  : activePrompt
                    ? t('onboarding.voiceIntro.tapToRecord')
                    : t('onboarding.voiceIntro.choosePrompt')}
              </Text>
            </>
          ) : (
            <>
              <View style={[styles.compactPlayerContainer, { backgroundColor: isDark ? '#0F0F1A' : '#F5F3F8' }]}>
                <TouchableOpacity
                  style={styles.playButton}
                  onPress={togglePlayback}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={isPlaying ? 'Pause playback' : 'Play voice recording'}
                >
                  <MaterialCommunityIcons name={isPlaying ? 'pause' : 'play'} size={20} color="white" />
                </TouchableOpacity>
                <View style={styles.waveformContainer}>
                  <AudioWaveformBars progress={playbackProgress} playing={isPlaying} isDark={isDark} />
                </View>
                <Text style={[styles.duration, { color: isDark ? '#9CA3AF' : '#71717A' }]}>
                  {formatTime(recordingDuration)}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.deleteButton, { backgroundColor: isDark ? 'rgba(127,29,29,0.3)' : '#FEF2F2' }]}
                onPress={deleteRecording}
              >
                <MaterialCommunityIcons name="delete" size={18} color="#EF4444" />
                <Text style={[styles.deleteButtonText, { color: isDark ? '#FCA5A5' : '#EF4444' }]}>
                  {t('onboarding.voiceIntro.deleteRerecord')}
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Bottom bar matching OnboardingLayout */}
        <View style={[styles.embeddedBottomBar, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <TouchableOpacity style={styles.embeddedBackCircle} onPress={parentBack} activeOpacity={0.8}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#6B7280" />
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
      currentStep={getGlobalStep('voice-intro', 0)}
      title={t('onboarding.voiceIntro.title')}
      subtitle={t('onboarding.voiceIntro.subtitle')}
      onBack={() => goToPreviousOnboardingStep('/(onboarding)/voice-intro')}
      onContinue={handleContinue}
      onSkip={() => goToNextOnboardingStep('/(onboarding)/voice-intro')}
      continueDisabled={loading || isRecording}
      continueLabel={loading ? t('common.saving') : recordingUri ? t('common.continue') : t('common.skipForNow')}
    >
      {content}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 12,
  },
  optionRow: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionRowText: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    marginRight: 12,
  },
  customPromptContainer: {
    marginTop: 16,
  },
  customInput: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  recordingCard: {
    borderRadius: 24,
    padding: 32,
    marginBottom: 24,
  },
  recordingContent: {
    alignItems: 'center',
  },
  selectedPromptText: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 24,
    textAlign: 'center',
  },
  liveWaveformContainer: {
    width: '100%',
    height: 60,
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  liveWaveform: {
    height: 60,
  },
  recordButton: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerText: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 24,
  },
  recordingHint: {
    marginTop: 16,
    textAlign: 'center',
    fontSize: 15,
  },
  playbackContent: {
    alignItems: 'center',
    width: '100%',
  },
  promptText: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  playerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
    minWidth: 36,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 100,
  },
  deleteButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  tipsCard: {
    borderRadius: 20,
    padding: 20,
  },
  tipsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  tipsTitle: {
    fontWeight: '700',
    fontSize: 17,
  },
  tipItem: {
    fontSize: 14,
    marginBottom: 6,
    lineHeight: 20,
    paddingLeft: 4,
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

  // ── Compact (embedded) voice-intro styles ──
  compactChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  compactChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    maxWidth: '100%',
  },
  compactChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  compactCustomInput: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  compactRecordArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  compactLiveWaveform: {
    width: '100%',
    height: 48,
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 8,
  },
  compactRecordButton: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactTimer: {
    fontSize: 20,
    fontWeight: '700',
  },
  compactHint: {
    fontSize: 13,
    textAlign: 'center',
  },
  compactPlayerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 8,
    paddingRight: 16,
    width: '100%',
  },
});
