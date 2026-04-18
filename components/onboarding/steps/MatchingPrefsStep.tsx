import { useCallback } from 'react';
import { View, Text, Switch, StyleSheet, useColorScheme } from 'react-native';
import Slider from '@react-native-community/slider';
import { useOnboardingStore } from '@/stores/onboardingStore';
import {
  DISTANCE_MIN,
  DISTANCE_MAX,
  distanceToSlider,
  sliderToDistance,
  formatDistanceRangeLabel,
} from '@/lib/distance-utils';

export default function MatchingPrefsStep() {
  const { ageMin, ageMax, maxDistanceMiles, willingToRelocate } = useOnboardingStore();
  const setField = useOnboardingStore((s) => s.setField);
  const isDark = useColorScheme() === 'dark';
  const textColor = isDark ? '#F5F5F7' : '#1F2937';
  const mutedColor = isDark ? '#9CA3AF' : '#6B7280';
  const cardBg = isDark ? '#1A1A2D' : '#F9F8FB';
  const cardBorder = isDark ? '#2C2C3E' : '#F0EDF4';

  const distanceSliderValue = distanceToSlider(maxDistanceMiles);

  const handleDistanceChange = useCallback((v: number) => {
    const miles = sliderToDistance(v);
    setField('maxDistanceMiles', miles);
  }, [setField]);

  const distanceLabel = formatDistanceRangeLabel(maxDistanceMiles);

  return (
    <View style={styles.container}>
      {/* Age Range */}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: textColor }]}>Age Range</Text>
          <Text style={[styles.valueChip, { color: '#A08AB7', backgroundColor: isDark ? '#2C2C3E' : '#F0EDF4' }]}>
            {ageMin} – {ageMax}
          </Text>
        </View>
        <View style={styles.sliderRow}>
          <Text style={[styles.sliderLabel, { color: mutedColor }]}>Min</Text>
          <Slider
            style={styles.slider}
            minimumValue={18}
            maximumValue={65}
            step={1}
            value={ageMin}
            onValueChange={(v) => {
              const val = Math.round(v);
              if (val < ageMax) setField('ageMin', val);
            }}
            minimumTrackTintColor="#A08AB7"
            maximumTrackTintColor={isDark ? '#374151' : '#E5E7EB'}
            thumbTintColor="#A08AB7"
            accessibilityLabel={`Minimum age: ${ageMin}`}
            accessibilityValue={{ min: 18, max: 65, now: ageMin }}
          />
        </View>
        <View style={styles.sliderRow}>
          <Text style={[styles.sliderLabel, { color: mutedColor }]}>Max</Text>
          <Slider
            style={styles.slider}
            minimumValue={18}
            maximumValue={65}
            step={1}
            value={ageMax}
            onValueChange={(v) => {
              const val = Math.round(v);
              if (val > ageMin) setField('ageMax', val);
            }}
            minimumTrackTintColor="#A08AB7"
            maximumTrackTintColor={isDark ? '#374151' : '#E5E7EB'}
            thumbTintColor="#A08AB7"
            accessibilityLabel={`Maximum age: ${ageMax}`}
            accessibilityValue={{ min: 18, max: 65, now: ageMax }}
          />
        </View>
      </View>

      {/* Distance — non-linear scale */}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: textColor }]}>Maximum Distance</Text>
          <Text style={[styles.valueChip, { color: '#A08AB7', backgroundColor: isDark ? '#2C2C3E' : '#F0EDF4' }]}>
            {distanceLabel}
          </Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={1}
          step={0.005}
          value={distanceSliderValue}
          onValueChange={handleDistanceChange}
          minimumTrackTintColor="#A08AB7"
          maximumTrackTintColor={isDark ? '#374151' : '#E5E7EB'}
          thumbTintColor="#A08AB7"
          accessibilityLabel={`Maximum distance: ${distanceLabel}`}
          accessibilityValue={{ min: DISTANCE_MIN, max: DISTANCE_MAX, now: maxDistanceMiles }}
        />
        <View style={styles.distanceMarkers}>
          <Text style={[styles.markerText, { color: mutedColor }]}>5 mi</Text>
          <Text style={[styles.markerText, { color: mutedColor }]}>25</Text>
          <Text style={[styles.markerText, { color: mutedColor }]}>100</Text>
          <Text style={[styles.markerText, { color: mutedColor }]}>500+</Text>
        </View>
      </View>

      {/* Willing to Relocate */}
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: textColor }]}>Willing to relocate?</Text>
          <Switch
            value={willingToRelocate}
            onValueChange={(v) => setField('willingToRelocate', v)}
            trackColor={{ false: isDark ? '#374151' : '#E5E7EB', true: '#A08AB7' }}
            thumbColor="#FFFFFF"
          />
        </View>
        <Text style={[styles.hint, { color: mutedColor }]}>
          Let others know you're open to moving for the right match.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    gap: 12,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 17,
    fontWeight: '700',
  },
  valueChip: {
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sliderLabel: {
    fontSize: 13,
    fontWeight: '500',
    width: 30,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
  distanceMarkers: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: -4,
  },
  markerText: {
    fontSize: 11,
    fontWeight: '500',
  },
});
