import { useState } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet, useColorScheme } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { calculateZodiac, calculateAge } from '@/lib/onboarding-config';

export default function DOBStep() {
  const birthDate = useOnboardingStore((s) => s.birthDate);
  const setFields = useOnboardingStore((s) => s.setFields);
  const isDark = useColorScheme() === 'dark';
  const [showPicker, setShowPicker] = useState(Platform.OS === 'ios');

  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() - 18);
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 100);

  const handleChange = (_: any, date?: Date) => {
    if (Platform.OS === 'android') setShowPicker(false);
    if (date) {
      const age = calculateAge(date);
      if (age >= 18) {
        setFields({ birthDate: date, age, zodiacSign: calculateZodiac(date) });
      }
    }
  };

  const displayDate = birthDate
    ? birthDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    : 'Select your birth date';

  return (
    <View style={styles.container}>
      {Platform.OS === 'android' && (
        <TouchableOpacity
          style={[styles.dateButton, { backgroundColor: isDark ? '#1F2937' : '#F9FAFB', borderColor: isDark ? '#374151' : '#E4E4E7' }]}
          onPress={() => setShowPicker(true)}
        >
          <Text style={[styles.dateText, { color: birthDate ? (isDark ? '#F5F5F7' : '#1F2937') : (isDark ? '#6B7280' : '#A1A1AA') }]}>
            {displayDate}
          </Text>
        </TouchableOpacity>
      )}
      {showPicker && (
        <DateTimePicker
          value={birthDate || maxDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={maxDate}
          minimumDate={minDate}
          onChange={handleChange}
          themeVariant={isDark ? 'dark' : 'light'}
        />
      )}
      {birthDate && (
        <View style={styles.infoRow}>
          <Text style={[styles.infoText, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            Age: {calculateAge(birthDate)} · {calculateZodiac(birthDate)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  dateButton: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 24, paddingVertical: 18, width: '100%', alignItems: 'center' },
  dateText: { fontSize: 18, fontWeight: '600' },
  infoRow: { marginTop: 16, alignItems: 'center' },
  infoText: { fontSize: 16, fontWeight: '500' },
});
