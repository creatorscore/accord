/**
 * Conditional Waveform Component
 *
 * Tries to load @simform_solutions/react-native-audio-waveform (the real native module).
 * Falls back to a visual-only SimulatedWaveform if the native module fails to load
 * (e.g. running in Expo Go, or on a platform where the module isn't linked).
 */

import React, { useRef, useState, useEffect, useMemo, forwardRef, useImperativeHandle } from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';

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
  onChangeWaveformLoadState,
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

  // Signal ready on mount (simulated waveform is always instantly ready)
  useEffect(() => {
    if (mode === 'static') onChangeWaveformLoadState?.(false);
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

// Try to load the real native waveform module. Falls back to the simulated
// visual-only component if the native module isn't linked (e.g. Expo Go).
let RealWaveform: any = SimulatedWaveform;
let RealPlayerState: any = { playing: 'playing', paused: 'paused', stopped: 'stopped' };
let RealRecorderState: any = { recording: 'recording', paused: 'paused', stopped: 'stopped' };

try {
  const waveformModule = require('@simform_solutions/react-native-audio-waveform');
  if (waveformModule?.Waveform) {
    RealWaveform = waveformModule.Waveform;
    RealPlayerState = waveformModule.PlayerState;
    RealRecorderState = waveformModule.RecorderState;
  }
} catch (error) {
  console.warn('Failed to load native audio waveform, using simulated:', error);
}

export const Waveform = RealWaveform;
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
