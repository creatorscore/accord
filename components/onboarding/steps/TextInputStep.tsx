import { View, TextInput, Switch, Text, StyleSheet, useColorScheme } from 'react-native';
import * as Haptics from 'expo-haptics';

interface TextInputStepProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  /** Show visibility toggle */
  showVisibility?: boolean;
  visible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  maxLength?: number;
}

export default function TextInputStep({
  value,
  onChangeText,
  placeholder,
  showVisibility,
  visible = true,
  onVisibilityChange,
  autoCapitalize = 'words',
  maxLength = 100,
}: TextInputStepProps) {
  const isDark = useColorScheme() === 'dark';

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, {
          color: isDark ? '#F5F5F7' : '#1F2937',
          borderColor: isDark ? '#374151' : '#E4E4E7',
          backgroundColor: isDark ? '#1A1A2D' : '#FAFAFA',
        }]}
        placeholder={placeholder}
        placeholderTextColor={isDark ? '#6B7280' : '#A1A1AA'}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        maxLength={maxLength}
        returnKeyType="done"
        autoFocus
        accessibilityLabel={placeholder}
      />

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

const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    fontSize: 18,
    fontWeight: '500',
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  visibilityLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
});
