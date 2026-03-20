import { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, TextInput, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { Waveform, type IWaveformRef, PlayerState, RecorderState } from '@/components/shared/ConditionalWaveform';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { goToPreviousOnboardingStep, skipToDiscovery } from '@/lib/onboarding-navigation';
import { getGlobalStep } from '@/lib/onboarding-steps';
import { openAppSettings } from '@/lib/open-settings';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';

const VOICE_PROMPT_KEYS = [
  'prompt1', 'prompt2', 'prompt3', 'prompt4',
  'prompt5', 'prompt6', 'prompt7', 'prompt8',
] as const;

export default function VoiceIntro() {
  const router = useRouter();
  const { user } = useAuth();
  const { showToast } = useToast();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const VOICE_PROMPTS = VOICE_PROMPT_KEYS.map(key => t(`onboarding.voiceIntro.${key}`));

  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const liveWaveformRef = useRef<IWaveformRef>(null);
  const staticWaveformRef = useRef<IWaveformRef>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [isNewRecording, setIsNewRecording] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
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
        .select('id, voice_intro_url, voice_intro_prompt, voice_intro_duration')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setProfileId(data.id);
        if (data.voice_intro_url) {
          setRecordingUri(data.voice_intro_url);
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
      setIsRecording(false);
      const path = await liveWaveformRef.current?.stopRecord();
      if (path) {
        setRecordingUri(path);
        setIsNewRecording(true);
      }
    } catch (error: any) {
      showToast({ type: 'error', title: t('common.error'), message: t('toast.stopRecordingFailed') });
    }
  };

  const handleRecorderStateChange = (state: RecorderState) => {
    if (state === RecorderState.stopped) setIsRecording(false);
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
    setIsNewRecording(false);
    staticWaveformRef.current?.stopPlayer();
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

        const base64 = await FileSystem.readAsStringAsync(recordingUri, {
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

        const { error: dbError } = await supabase
          .from('profiles')
          .update({
            voice_intro_url: fileName,
            voice_intro_duration: recordingDuration,
            voice_intro_prompt: finalPrompt || null,
            onboarding_step: 7,
          })
          .eq('id', profileId);

        if (dbError) throw dbError;
      } else if (recordingUri && !isNewRecording) {
        const finalPrompt = showCustomInput ? customPrompt.trim() : selectedPrompt;
        await supabase
          .from('profiles')
          .update({
            voice_intro_prompt: finalPrompt || null,
            onboarding_step: 7,
          })
          .eq('id', profileId);
      } else {
        await supabase
          .from('profiles')
          .update({ onboarding_step: 7 })
          .eq('id', profileId);
      }

      router.push('/(onboarding)/marriage-preferences');
    } catch (error: any) {
      showToast({ type: 'error', title: t('common.error'), message: error.message || t('toast.voiceUploadFailed') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <OnboardingLayout
      currentStep={getGlobalStep('voice-intro', 0)}
      title={t('onboarding.voiceIntro.title')}
      subtitle={t('onboarding.voiceIntro.subtitle')}
      onBack={() => goToPreviousOnboardingStep('/(onboarding)/voice-intro')}
      onContinue={handleContinue}
      onSkip={skipToDiscovery}
      continueDisabled={loading || isRecording}
      continueLabel={loading ? t('common.saving') : recordingUri ? t('common.continue') : t('common.skipForNow')}
      currentRoute="/(onboarding)/voice-intro"
    >
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

            {isRecording && (
              <View style={[styles.liveWaveformContainer, { backgroundColor: isDark ? '#0F0F1A' : '#F5F5F5' }]}>
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

            <TouchableOpacity
              style={[styles.recordButton, { backgroundColor: isRecording ? '#EF4444' : '#A08AB7' }]}
              onPress={isRecording ? stopRecording : startRecording}
              disabled={loading}
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
              <TouchableOpacity style={styles.playButton} onPress={togglePlayback} activeOpacity={0.7}>
                <MaterialCommunityIcons name={isPlaying ? "pause" : "play"} size={20} color="white" />
              </TouchableOpacity>

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
});
