import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface ChipOption {
  label: string;
  value: string;
}

interface OnboardingChipsProps {
  /** Array of options to display */
  options: ChipOption[];
  /** Currently selected value(s) — string for single-select, string[] for multi-select */
  value: string | string[];
  /** Called with updated value on selection change */
  onChange: (value: any) => void;
  /** Allow multiple selections */
  multiSelect?: boolean;
  /** Max number of selections in multi-select mode */
  maxSelect?: number;
}

export default function OnboardingChips({
  options,
  value,
  onChange,
  multiSelect = false,
  maxSelect,
}: OnboardingChipsProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const isSelected = (optionValue: string) => {
    if (multiSelect && Array.isArray(value)) {
      return value.includes(optionValue);
    }
    return value === optionValue;
  };

  const handlePress = (optionValue: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (multiSelect) {
      const currentArr = Array.isArray(value) ? value : [];
      if (currentArr.includes(optionValue)) {
        onChange(currentArr.filter((v: string) => v !== optionValue));
      } else if (!maxSelect || currentArr.length < maxSelect) {
        onChange([...currentArr, optionValue]);
      }
    } else {
      // Single-select: toggle off if already selected, otherwise select
      onChange(value === optionValue ? '' : optionValue);
    }
  };

  return (
    <View style={styles.container}>
      {options.map((option, i) => {
        const selected = isSelected(option.value);
        return (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.row,
              i < options.length - 1 && { marginBottom: 4 },
            ]}
            onPress={() => handlePress(option.value)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.rowText,
                { color: selected ? '#A08AB7' : isDark ? '#E5E7EB' : '#374151' },
              ]}
            >
              {option.label}
            </Text>
            {selected && (
              <MaterialCommunityIcons name="check" size={22} color="#A08AB7" />
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
  },
  row: {
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
