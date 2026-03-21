import { View, Text, StyleSheet, useColorScheme } from 'react-native';
import Slider from '@react-native-community/slider';
import { useOnboardingStore } from '@/stores/onboardingStore';

export default function MatchingPrefsStep() {
  const { ageMin, ageMax, maxDistanceMiles } = useOnboardingStore();
  const setField = useOnboardingStore((s) => s.setField);
  const isDark = useColorScheme() === 'dark';
  const textColor = isDark ? '#F5F5F7' : '#1F2937';
  const mutedColor = isDark ? '#9CA3AF' : '#6B7280';

  return (
    <View style={styles.container}>
      {/* Age Range */}
      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: textColor }]}>Age Range</Text>
          <Text style={[styles.valueText, { color: mutedColor }]}>{ageMin} – {ageMax}</Text>
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
          />
        </View>
      </View>

      {/* Distance */}
      <View style={styles.section}>
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: textColor }]}>Maximum Distance</Text>
          <Text style={[styles.valueText, { color: mutedColor }]}>
            {maxDistanceMiles >= 500 ? 'Anywhere' : `${maxDistanceMiles} mi`}
          </Text>
        </View>
        <Slider
          style={styles.slider}
          minimumValue={5}
          maximumValue={500}
          step={5}
          value={maxDistanceMiles}
          onValueChange={(v) => setField('maxDistanceMiles', Math.round(v))}
          minimumTrackTintColor="#A08AB7"
          maximumTrackTintColor={isDark ? '#374151' : '#E5E7EB'}
          thumbTintColor="#A08AB7"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', gap: 32 },
  section: { gap: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  label: { fontSize: 17, fontWeight: '700' },
  valueText: { fontSize: 15, fontWeight: '600' },
  sliderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sliderLabel: { fontSize: 13, fontWeight: '500', width: 30 },
  slider: { flex: 1, height: 40 },
});
