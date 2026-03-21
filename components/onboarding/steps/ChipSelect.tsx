import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, Switch } from 'react-native';
import * as Haptics from 'expo-haptics';

interface ChipSelectProps {
  /** Available options */
  options: readonly (string | { value: string; label: string })[];
  /** Currently selected values */
  selected: string[];
  /** Called when selection changes */
  onSelect: (selected: string[]) => void;
  /** Allow multiple selections (default true) */
  multi?: boolean;
  /** Show visibility toggle */
  showVisibility?: boolean;
  /** Visibility state */
  visible?: boolean;
  /** Called when visibility changes */
  onVisibilityChange?: (visible: boolean) => void;
}

export default function ChipSelect({
  options,
  selected,
  onSelect,
  multi = true,
  showVisibility,
  visible = true,
  onVisibilityChange,
}: ChipSelectProps) {
  const isDark = useColorScheme() === 'dark';

  const handlePress = (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (multi) {
      if (selected.includes(value)) {
        onSelect(selected.filter((v) => v !== value));
      } else {
        onSelect([...selected, value]);
      }
    } else {
      onSelect(selected[0] === value ? [] : [value]);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.chipGrid}>
        {options.map((opt) => {
          const value = typeof opt === 'string' ? opt : opt.value;
          const label = typeof opt === 'string' ? opt : opt.label;
          const isSelected = selected.includes(value);

          return (
            <TouchableOpacity
              key={value}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? '#A08AB7' : (isDark ? '#1F2937' : '#F3F4F6'),
                  borderColor: isSelected ? '#A08AB7' : (isDark ? '#374151' : '#E5E7EB'),
                },
              ]}
              onPress={() => handlePress(value)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? '#FFFFFF' : (isDark ? '#D1D5DB' : '#374151') },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {showVisibility && (
        <View style={[styles.visibilityRow, { borderTopColor: isDark ? '#374151' : '#F3F4F6' }]}>
          <Text style={[styles.visibilityLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            Show on profile
          </Text>
          <Switch
            value={visible}
            onValueChange={(v) => {
              Haptics.selectionAsync();
              onVisibilityChange?.(v);
            }}
            trackColor={{ false: '#D1D5DB', true: '#CDC2E5' }}
            thumbColor={visible ? '#A08AB7' : '#F3F4F6'}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center', paddingHorizontal: 4 },
  chip: { paddingHorizontal: 18, paddingVertical: 12, borderRadius: 50, borderWidth: 1.5 },
  chipText: { fontSize: 15, fontWeight: '600' },
  visibilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, paddingTop: 16, borderTopWidth: 1 },
  visibilityLabel: { fontSize: 15, fontWeight: '500' },
});
