import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';

interface ProfileVoiceNoteProps {
  voiceUrl?: string | null;
  duration?: number;
  profileName?: string;
}

export default function ProfileVoiceNote({
  voiceUrl,
  duration = 0,
  profileName = "User"
}: ProfileVoiceNoteProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [playbackDuration, setPlaybackDuration] = useState(duration * 1000);

  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  const playVoiceNote = async () => {
    if (!voiceUrl) {
      return;
    }

    try {
      setIsLoading(true);

      if (sound && isPlaying) {
        // Pause if already playing
        await sound.pauseAsync();
        setIsPlaying(false);
      } else if (sound && !isPlaying) {
        // Resume if paused
        await sound.playAsync();
        setIsPlaying(true);
      } else {
        // Load and play new sound
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });

        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: voiceUrl },
          { shouldPlay: true },
          (status) => {
            if (status.isLoaded) {
              setPlaybackPosition(status.positionMillis || 0);
              setPlaybackDuration(status.durationMillis || duration * 1000);

              if (status.didJustFinish) {
                setIsPlaying(false);
                setPlaybackPosition(0);
              }
            }
          }
        );

        setSound(newSound);
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error playing voice note:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (milliseconds: number) => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const progress = playbackDuration > 0 ? (playbackPosition / playbackDuration) * 100 : 0;

  if (!voiceUrl) {
    return null;
  }

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 500 }}
      style={styles.container}
    >
      <LinearGradient
        colors={['#9B87CE', '#B8A9DD']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradient}
      >
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="microphone" size={24} color="white" />
          </View>
          <View style={styles.textContainer}>
            <Text style={styles.title}>Voice Introduction</Text>
            <Text style={styles.subtitle}>Hear {profileName}'s voice</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.playButton}
          onPress={playVoiceNote}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <View style={styles.playButtonInner}>
              <MaterialCommunityIcons
                name={isPlaying ? "pause" : "play"}
                size={32}
                color="white"
              />
            </View>
          )}
        </TouchableOpacity>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <MotiView
              animate={{ width: `${progress}%` }}
              transition={{ type: 'timing', duration: 100 }}
              style={styles.progressFill}
            />
          </View>
          <Text style={styles.duration}>
            {isPlaying ? formatTime(playbackPosition) : formatTime(playbackDuration)}
          </Text>
        </View>

        {/* Waveform Visualization (decorative) */}
        <View style={styles.waveform}>
          {[...Array(20)].map((_, i) => (
            <MotiView
              key={i}
              animate={{
                height: isPlaying ? Math.random() * 20 + 10 : 15,
              }}
              transition={{
                type: 'timing',
                duration: 200,
                loop: isPlaying,
              }}
              style={[
                styles.waveLine,
                { height: 15 }
              ]}
            />
          ))}
        </View>
      </LinearGradient>
    </MotiView>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    zIndex: 10,
  },
  gradient: {
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 20,
  },
  playButtonInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: 'white',
    borderRadius: 2,
  },
  duration: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    minWidth: 35,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 30,
    opacity: 0.6,
  },
  waveLine: {
    width: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 2,
  },
});