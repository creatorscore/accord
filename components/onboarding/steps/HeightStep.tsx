import { View, Text, TouchableOpacity, Switch, StyleSheet, useColorScheme } from 'react-native';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { getHeightOptions } from '@/lib/onboarding-config';
import ScrollPicker from '@/components/onboarding/ScrollPicker';
import * as Haptics from 'expo-haptics';

export default function HeightStep() {
  const { heightInches, heightUnit, fieldVisibility } = useOnboardingStore();
  const setField = useOnboardingStore((s) => s.setField);
  const setVisibility = useOnboardingStore((s) => s.setVisibility);
  const isDark = useColorScheme() === 'dark';
  const options = getHeightOptions(heightUnit);
  const visible = fieldVisibility.height !== false;

  // Default to a mid-range value if nothing selected
  const defaultValue = heightUnit === 'imperial' ? 67 : 170; // 5'7" or 170cm

  return (
    <View style={styles.container}>
      {/* Unit toggle */}
      <View style={styles.unitRow}>
        {(['imperial', 'metric'] as const).map((unit) => (
          <TouchableOpacity
            key={unit}
            style={[
              styles.unitTab,
              {
                backgroundColor: heightUnit === unit
                  ? '#A08AB7'
                  : (isDark ? '#1A1A2D' : '#F5F3F8'),
                borderColor: heightUnit === unit
                  ? '#A08AB7'
                  : (isDark ? '#2C2C3E' : '#E8E3F0'),
              },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              setField('heightUnit', unit);
              setField('heightInches', null);
            }}
            accessibilityRole="button"
            accessibilityLabel={unit === 'imperial' ? 'Feet and inches' : 'Centimeters'}
            accessibilityState={{ selected: heightUnit === unit }}
          >
            <Text style={[
              styles.unitTabText,
              { color: heightUnit === unit ? '#FFFFFF' : (isDark ? '#D1D5DB' : '#6B7280') },
            ]}>
              {unit === 'imperial' ? 'ft / in' : 'cm'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Scroll wheel picker */}
      <View style={styles.pickerContainer}>
        <ScrollPicker
          items={options}
          selectedValue={heightInches ?? defaultValue}
          onValueChange={(value) => setField('heightInches', value)}
        />
      </View>

      {/* Selected value display */}
      {heightInches !== null && (
        <Text
          style={[styles.selectedLabel, { color: isDark ? '#A08AB7' : '#8B72A8' }]}
          accessibilityLiveRegion="polite"
        >
          {options.find(o => o.value === heightInches)?.label}
        </Text>
      )}

      {/* Visibility toggle */}
      <View style={[styles.visibilityRow, { borderTopColor: isDark ? '#2C2C3E' : '#F0EDF4' }]}>
        <Text style={[styles.visibilityLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>Show on profile</Text>
        <Switch
          value={visible}
          onValueChange={(v) => { Haptics.selectionAsync(); setVisibility('height', v); }}
          trackColor={{ false: '#D1D5DB', true: '#CDC2E5' }}
          thumbColor={visible ? '#A08AB7' : '#F3F4F6'}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  unitRow: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    marginBottom: 28,
  },
  unitTab: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 50,
    borderWidth: 1.5,
    minHeight: 48,
    justifyContent: 'center',
  },
  unitTabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  pickerContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedLabel: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 20,
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
  },
  visibilityLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
});
