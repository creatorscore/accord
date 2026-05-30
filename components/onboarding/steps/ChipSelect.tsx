import { memo } from 'react';
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

function ChipSelect({
  options,
  selected,
  onSelect,
  multi = true,
  showVisibility,
  visible = true,
  onVisibilityChange,
}: ChipSelectProps) {
  const isDark = useColorScheme() === 'dark';
  const isCompact = options.length > 6;

  const handlePress = (value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (multi) {
      if (selected.includes(value)) {
        onSelect(selected.filter((v) => v !== value));
      } else {
        onSelect([...selected, value]);
      }
    } else {
      // Single-select: never deselect on re-tap. Previously this returned []
      // when the user tapped their already-selected chip, which cleared a
      // required field and disabled Continue — users stuck at pronouns /
      // gender / sexuality / relationship / children / financial / housing
      // couldn't advance once they tapped twice. Radio semantics: tapping a
      // chip always results in exactly that chip selected.
      onSelect([value]);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.chipGrid, isCompact && styles.chipGridCompact]}>
        {options.map((opt) => {
          const value = typeof opt === 'string' ? opt : opt.value;
          const label = typeof opt === 'string' ? opt : opt.label;
          const isSelected = selected.includes(value);

          return (
            <TouchableOpacity
              key={value}
              style={[
                styles.chip,
                isCompact && styles.chipCompact,
                {
                  backgroundColor: isSelected ? '#A08AB7' : (isDark ? '#1A1A2D' : '#F5F3F8'),
                  borderColor: isSelected ? '#A08AB7' : (isDark ? '#2C2C3E' : '#E8E3F0'),
                },
              ]}
              onPress={() => handlePress(value)}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={label}
              accessibilityState={{ selected: isSelected }}
              accessibilityHint={multi ? `Double tap to ${isSelected ? 'deselect' : 'select'}` : `Double tap to ${isSelected ? 'deselect' : 'choose'}`}
            >
              <Text
                style={[
                  styles.chipText,
                  isCompact && styles.chipTextCompact,
                  { color: isSelected ? '#FFFFFF' : (isDark ? '#D1D5DB' : '#4B5563') },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {showVisibility && (
        <View style={[styles.visibilityRow, { borderTopColor: isDark ? '#2C2C3E' : '#F0EDF4' }]}>
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

export default memo(ChipSelect);

const styles = StyleSheet.create({
  container: {
    // Top-aligned — no vertical centering; content flows from title naturally
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chipGridCompact: {
    gap: 6,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 50,
    borderWidth: 1.5,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipCompact: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  chipTextCompact: {
    fontSize: 13,
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  visibilityLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
});
