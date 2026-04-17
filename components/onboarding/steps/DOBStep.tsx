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
          style={[styles.dateButton, {
            backgroundColor: isDark ? '#1A1A2D' : '#FAFAFA',
            borderColor: isDark ? '#374151' : '#E4E4E7',
          }]}
          onPress={() => setShowPicker(true)}
          accessibilityRole="button"
          accessibilityLabel={birthDate ? `Birth date: ${displayDate}. Tap to change` : 'Select your birth date'}
        >
          <Text style={[styles.dateText, {
            color: birthDate ? (isDark ? '#F5F5F7' : '#1F2937') : (isDark ? '#6B7280' : '#A1A1AA'),
          }]}>
            {displayDate}
          </Text>
        </TouchableOpacity>
      )}
      {showPicker && (
        <View style={styles.pickerWrapper}>
          <DateTimePicker
            value={birthDate || maxDate}
            mode="date"
            display="spinner"
            maximumDate={maxDate}
            minimumDate={minDate}
            onChange={handleChange}
            themeVariant={isDark ? 'dark' : 'light'}
          />
        </View>
      )}
      {birthDate && (
        <View style={[styles.infoRow, { backgroundColor: isDark ? '#1A1A2D' : '#F5F2F7' }]}>
          <Text style={[styles.infoText, { color: isDark ? '#D4C4E8' : '#8B72A8' }]}>
            {calculateAge(birthDate)} years old  ·  {calculateZodiac(birthDate)}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    alignItems: 'center',
  },
  dateButton: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
    width: '100%',
    alignItems: 'center',
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
  },
  pickerWrapper: {
    alignSelf: 'stretch',
  },
  infoRow: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  infoText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
