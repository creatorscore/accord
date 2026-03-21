import { View, TextInput, StyleSheet, useColorScheme } from 'react-native';
import { useOnboardingStore } from '@/stores/onboardingStore';

export default function NameStep() {
  const displayName = useOnboardingStore((s) => s.displayName);
  const setField = useOnboardingStore((s) => s.setField);
  const isDark = useColorScheme() === 'dark';

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, { color: isDark ? '#F5F5F7' : '#1F2937', borderColor: isDark ? '#374151' : '#E4E4E7', backgroundColor: isDark ? '#1F2937' : '#FFFFFF' }]}
        placeholder="Your first name"
        placeholderTextColor={isDark ? '#6B7280' : '#A1A1AA'}
        value={displayName}
        onChangeText={(v) => setField('displayName', v.trim())}
        autoFocus
        maxLength={30}
        autoCapitalize="words"
        returnKeyType="done"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', paddingHorizontal: 8 },
  input: { borderWidth: 1.5, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 18, fontSize: 22, fontWeight: '600', textAlign: 'center' },
});
