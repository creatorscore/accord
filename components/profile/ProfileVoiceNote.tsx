import React, { useRef, useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

interface ProfileVoiceNoteProps {
  voiceUrl?: string | null;
  duration?: number;
  prompt?: string;
  profileName?: string;
}

export default function ProfileVoiceNote({
  voiceUrl,
  duration = 0,
  prompt,
  profileName = "User"
}: ProfileVoiceNoteProps) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Generate Instagram-style waveform bars based on voiceUrl
  const waveformBars = useMemo(() => {
    const seed = voiceUrl ? voiceUrl.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 12345;
    const bars = [];
    const numBars = 45; // More bars for smoother look

    // Create wave-like pattern with natural audio characteristics
    for (let i = 0; i < numBars; i++) {
      // Multiple sine waves for organic look
      const wave1 = Math.sin((seed * 0.01) + (i * 0.3)) * 0.3;
      const wave2 = Math.sin((seed * 0.02) + (i * 0.15)) * 0.2;
      const wave3 = Math.sin((seed * 0.005) + (i * 0.5)) * 0.15;

      // Add some randomness seeded by position
      const rand = Math.abs(Math.sin(seed + i * 7.3)) * 0.2;

      // Combine waves with base height
      const base = 0.35;
      const height = Math.max(0.15, Math.min(1, base + wave1 + wave2 + wave3 + rand));
      bars.push(height);
    }
    return bars;
  }, [voiceUrl]);

  // Load audio when voiceUrl changes
  useEffect(() => {
    const loadAudio = async () => {
      if (!voiceUrl) return;

      try {
        setIsLoading(true);
        setError(null);

        // Unload previous sound if exists
        if (soundRef.current) {
          await soundRef.current.unloadAsync();
        }

        // Set audio mode
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
        });

        // Load the sound
        const { sound } = await Audio.Sound.createAsync(
          { uri: voiceUrl },
          { shouldPlay: false },
          onPlaybackStatusUpdate
        );

        soundRef.current = sound;
        setIsLoaded(true);
      } catch (err) {
        console.error('Error loading audio:', err);
        setError('Failed to load audio');
      } finally {
        setIsLoading(false);
      }
    };

    loadAudio();

    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync();
      }
    };
  }, [voiceUrl]);

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      if (status.isPlaying) {
        const currentProgress = status.positionMillis / (status.durationMillis || 1);
        setProgress(currentProgress);
      }
      setIsPlaying(status.isPlaying);

      // Reset when finished
      if (status.didJustFinish) {
        setProgress(0);
        setIsPlaying(false);
      }
    }
  };

  const togglePlayback = async () => {
    if (!soundRef.current || !isLoaded) return;

    try {
      if (isPlaying) {
        await soundRef.current.pauseAsync();
      } else {
        // If at end, seek to beginning
        const status = await soundRef.current.getStatusAsync();
        if (status.isLoaded && status.positionMillis >= (status.durationMillis || 0) - 100) {
          await soundRef.current.setPositionAsync(0);
        }
        await soundRef.current.playAsync();
      }
    } catch (err) {
      console.error('Error toggling playback:', err);
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (!voiceUrl) {
    return null;
  }

  const displayPrompt = prompt || `${profileName}'s voice intro`;
  const progressBarCount = Math.floor(progress * waveformBars.length);

  // Show loading state
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.promptText}>{displayPrompt}</Text>
        <View style={styles.playerContainer}>
          <View style={[styles.playButton, { backgroundColor: '#D1D5DB' }]}>
            <MaterialCommunityIcons name="loading" size={20} color="white" />
          </View>
          <View style={styles.waveformContainer}>
            <Text style={styles.loadingText}>Loading audio...</Text>
          </View>
        </View>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.promptText}>{displayPrompt}</Text>
        <View style={styles.playerContainer}>
          <View style={[styles.playButton, { backgroundColor: '#D1D5DB' }]}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="white" />
          </View>
          <View style={styles.waveformContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.promptText}>{displayPrompt}</Text>

      <View style={styles.playerContainer}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={togglePlayback}
          activeOpacity={0.7}
          disabled={!isLoaded}
        >
          <MaterialCommunityIcons
            name={isPlaying ? "pause" : "play"}
            size={20}
            color="white"
          />
        </TouchableOpacity>

        <View style={styles.waveformContainer}>
          <View style={styles.waveform}>
            {waveformBars.map((barHeight, index) => {
              const isPlayedBar = index < progressBarCount;
              return (
                <View
                  key={index}
                  style={[
                    styles.bar,
                    {
                      height: 28 * barHeight,
                      backgroundColor: isPlayedBar ? '#4D3A6B' : '#A08AB7',
                    },
                  ]}
                />
              );
            })}
          </View>
        </View>

        <Text style={styles.duration}>
          {formatTime(duration)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  promptText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 10,
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
    overflow: 'hidden',
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 28,
    flex: 1,
  },
  bar: {
    width: 2.5,
    borderRadius: 2,
  },
  duration: {
    fontSize: 13,
    fontWeight: '500',
    color: '#71717A',
    minWidth: 36,
  },
  loadingText: {
    fontSize: 13,
    color: '#9CA3AF',
  },
  errorText: {
    fontSize: 13,
    color: '#EF4444',
  },
});
