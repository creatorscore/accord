import { View, Text, TouchableOpacity, ScrollView, Switch, StyleSheet, useColorScheme } from 'react-native';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { getHeightOptions } from '@/lib/onboarding-config';
import * as Haptics from 'expo-haptics';

export default function HeightStep() {
  const { heightInches, heightUnit, fieldVisibility } = useOnboardingStore();
  const setField = useOnboardingStore((s) => s.setField);
  const setVisibility = useOnboardingStore((s) => s.setVisibility);
  const isDark = useColorScheme() === 'dark';
  const options = getHeightOptions(heightUnit);
  const visible = fieldVisibility.height !== false;

  return (
    <View style={styles.container}>
      {/* Unit toggle */}
      <View style={styles.unitRow}>
        {(['imperial', 'metric'] as const).map((unit) => (
          <TouchableOpacity
            key={unit}
            style={[styles.unitTab, heightUnit === unit && styles.unitTabActive]}
            onPress={() => {
              Haptics.selectionAsync();
              setField('heightUnit', unit);
              setField('heightInches', null);
            }}
          >
            <Text style={[styles.unitTabText, heightUnit === unit && styles.unitTabTextActive]}>
              {unit === 'imperial' ? 'ft/in' : 'cm'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Height picker scroll */}
      <ScrollView
        style={styles.pickerScroll}
        contentContainerStyle={styles.pickerContent}
        showsVerticalScrollIndicator={false}
      >
        {options.map((opt) => {
          const isSelected = heightInches === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.option,
                {
                  backgroundColor: isSelected ? '#A08AB7' : (isDark ? '#1F2937' : '#F9FAFB'),
                  borderColor: isSelected ? '#A08AB7' : (isDark ? '#374151' : '#E5E7EB'),
                },
              ]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setField('heightInches', opt.value);
              }}
            >
              <Text style={[styles.optionText, { color: isSelected ? '#FFFFFF' : (isDark ? '#D1D5DB' : '#374151') }]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Visibility toggle */}
      <View style={[styles.visibilityRow, { borderTopColor: isDark ? '#374151' : '#F3F4F6' }]}>
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
  container: { flex: 1 },
  unitRow: { flexDirection: 'row', gap: 8, justifyContent: 'center', marginBottom: 16 },
  unitTab: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 50, backgroundColor: '#F3F4F6' },
  unitTabActive: { backgroundColor: '#A08AB7' },
  unitTabText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  unitTabTextActive: { color: '#FFFFFF' },
  pickerScroll: { flex: 1, maxHeight: 280 },
  pickerContent: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', paddingHorizontal: 4 },
  option: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, minWidth: 70, alignItems: 'center' },
  optionText: { fontSize: 15, fontWeight: '600' },
  visibilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  visibilityLabel: { fontSize: 15, fontWeight: '500' },
});
