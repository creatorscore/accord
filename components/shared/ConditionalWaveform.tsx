/**
 * Conditional Waveform Component
 *
 * Uses simulated waveform in development/simulator (avoids native module errors)
 * Uses real @simform_solutions/react-native-audio-waveform in production builds
 *
 * NOTE: Audio playback in development mode is visual-only (simulated).
 * expo-av has compatibility issues with the new React Native architecture.
 * Test real audio playback in TestFlight/production builds.
 */

import React, { useRef, useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

// Determine if we're in a production build
// __DEV__ is false in production builds (TestFlight, App Store, Play Store)
// This is more reliable than checking appOwnership which can be null in EAS builds
const isProduction = !__DEV__;

// Types for the waveform component
export type PlayerState = 'playing' | 'paused' | 'stopped';
export type RecorderState = 'recording' | 'paused' | 'stopped';

export interface IWaveformRef {
  startPlayer: () => Promise<void>;
  pausePlayer: () => Promise<void>;
  stopPlayer: () => Promise<void>;
  startRecord: (options?: any) => Promise<string | undefined>;
  stopRecord: () => Promise<string | undefined>;
  pauseRecord: () => Promise<void>;
  resumeRecord: () => Promise<void>;
}

interface WaveformProps {
  mode: 'static' | 'live';
  path?: string;
  candleSpace?: number;
  candleWidth?: number;
  candleHeightScale?: number;
  waveColor?: string;
  scrubColor?: string;
  containerStyle?: ViewStyle;
  onPlayerStateChange?: (state: any) => void;
  onRecorderStateChange?: (state: any) => void;
  onError?: (error: Error) => void;
  onChangeWaveformLoadState?: (loading: boolean) => void;
  onCurrentProgressChange?: (currentProgress: number, songDuration: number) => void;
}

// Simulated waveform for development (visual only - no audio in dev mode)
const SimulatedWaveform = forwardRef<IWaveformRef, WaveformProps>(({
  mode,
  path,
  candleSpace = 2,
  candleWidth = 3,
  waveColor = '#E8DEF0',
  scrubColor = '#A08AB7',
  containerStyle,
  onPlayerStateChange,
  onRecorderStateChange,
}, ref) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Generate fake waveform bars
  const waveformBars = useMemo(() => {
    const seed = path ? path.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) : 12345;
    const bars = [];
    for (let i = 0; i < 40; i++) {
      const noise = Math.sin(seed + i * 0.5) * 0.3 + Math.sin(seed + i * 0.2) * 0.2;
      const base = 0.3 + Math.abs(Math.sin((seed + i) * 0.15)) * 0.5;
      const height = Math.max(0.15, Math.min(1, base + noise));
      bars.push(height);
    }
    return bars;
  }, [path]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Expose methods via ref (visual simulation only in dev mode)
  useImperativeHandle(ref, () => ({
    startPlayer: async () => {
      setIsPlaying(true);
      setProgress(0);
      onPlayerStateChange?.('playing');
      console.log('⚠️ Dev mode: Audio playback is simulated (visual only). Test in TestFlight for real audio.');

      // Simulate playback progress
      intervalRef.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 1) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setIsPlaying(false);
            onPlayerStateChange?.('stopped');
            return 0;
          }
          return prev + 0.02;
        });
      }, 100);
    },
    pausePlayer: async () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsPlaying(false);
      onPlayerStateChange?.('paused');
    },
    stopPlayer: async () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setIsPlaying(false);
      setProgress(0);
      onPlayerStateChange?.('stopped');
    },
    startRecord: async (options?: any) => {
      setIsRecording(true);
      onRecorderStateChange?.('recording');
      return `/tmp/simulated_recording_${Date.now()}.m4a`;
    },
    stopRecord: async () => {
      setIsRecording(false);
      onRecorderStateChange?.('stopped');
      return `/tmp/simulated_recording_${Date.now()}.m4a`;
    },
    pauseRecord: async () => {
      onRecorderStateChange?.('paused');
    },
    resumeRecord: async () => {
      onRecorderStateChange?.('recording');
    },
  }));

  const progressBarCount = Math.floor(progress * waveformBars.length);

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.waveform}>
        {waveformBars.map((barHeight, index) => {
          const isPlayedBar = mode === 'static' && index < progressBarCount;
          const isLiveBar = mode === 'live' && isRecording;

          // For live mode, animate bars randomly
          const liveHeight = isLiveBar
            ? barHeight * (0.5 + Math.random() * 0.5)
            : barHeight;

          return (
            <View
              key={index}
              style={[
                styles.bar,
                {
                  height: 24 * (mode === 'live' ? liveHeight : barHeight),
                  width: candleWidth,
                  marginHorizontal: candleSpace / 2,
                  backgroundColor: isPlayedBar ? scrubColor : waveColor,
                },
              ]}
            />
          );
        })}
      </View>
      {!isProduction && (
        <View style={styles.devBadge}>
          {/* Small indicator that this is simulated - hidden in production */}
        </View>
      )}
    </View>
  );
});

SimulatedWaveform.displayName = 'SimulatedWaveform';

// Conditionally load the real waveform in production
let RealWaveform: any = SimulatedWaveform;
let RealPlayerState: any = { playing: 'playing', paused: 'paused', stopped: 'stopped' };
let RealRecorderState: any = { recording: 'recording', paused: 'paused', stopped: 'stopped' };

if (isProduction) {
  try {
    const waveformModule = require('@simform_solutions/react-native-audio-waveform');
    RealWaveform = waveformModule.Waveform;
    RealPlayerState = waveformModule.PlayerState;
    RealRecorderState = waveformModule.RecorderState;
    console.log('✅ Using real audio waveform in production');
  } catch (error) {
    console.warn('Failed to load audio waveform, using simulated:', error);
  }
} else {
  console.log('⚠️ Using simulated waveform in development mode');
}

// Export the appropriate component based on environment
export const Waveform = isProduction ? RealWaveform : SimulatedWaveform;
export { RealPlayerState as PlayerState, RealRecorderState as RecorderState };

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  waveform: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
  },
  bar: {
    borderRadius: 1.5,
  },
  devBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
  },
});
