import { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { GENDER_PREF_OPTIONS } from '@/lib/gender-preferences';

interface Props {
  visible: boolean;
  onConfirm: (uiSelections: string[]) => Promise<void>;
}

/**
 * One-time modal shown to users whose gender_preference was wiped to []
 * by a now-fixed bug in expandGenderPreference (audit 2026-05-05 found 2,473
 * affected users — most active). Blocks the discover feed until the user
 * explicitly picks who they want to see, including the option to pick
 * "Everyone" if that's their actual intent.
 *
 * The modal is intentionally not dismissable — gender preference is a hard
 * filter and we'd rather pause discovery than show wrong-gender profiles.
 */
export default function ConfirmGenderPreferenceModal({ visible, onConfirm }: Props) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const togglePref = (pref: string) => {
    Haptics.selectionAsync();
    if (pref === 'Everyone') {
      setSelected(['Everyone']);
    } else {
      setSelected((prev) => {
        const withoutEveryone = prev.filter((p) => p !== 'Everyone');
        if (withoutEveryone.includes(pref)) {
          return withoutEveryone.filter((p) => p !== pref);
        }
        return [...withoutEveryone, pref];
      });
    }
  };

  const handleConfirm = async () => {
    if (selected.length === 0 || saving) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSaving(true);
    try {
      await onConfirm(selected);
    } finally {
      setSaving(false);
    }
  };

  const canContinue = selected.length > 0 && !saving;

  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent onRequestClose={() => {}}>
      <View style={[styles.backdrop, { paddingBottom: insets.bottom + 16, paddingTop: insets.top + 24 }]}>
        <View style={[styles.sheet, { backgroundColor: isDark ? '#1A1A2D' : '#FFFFFF' }]}>
          <Text style={[styles.title, { color: isDark ? '#F5F5F7' : '#1F2937' }]}>
            {t('discover.confirmGender.title', { defaultValue: 'Who would you like to see?' })}
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            {t('discover.confirmGender.subtitle', {
              defaultValue: 'A bug may have cleared your earlier choice. Please confirm so we only show you profiles you actually want to match with.',
            })}
          </Text>

          <View style={styles.chipsRow}>
            {GENDER_PREF_OPTIONS.map((opt) => {
              const isSelected = selected.includes(opt);
              return (
                <TouchableOpacity
                  key={opt}
                  onPress={() => togglePref(opt)}
                  activeOpacity={0.8}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? '#A08AB7' : isDark ? '#2C2C3E' : '#F3F0F7',
                      borderColor: isSelected ? '#A08AB7' : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.chipText, { color: isSelected ? '#FFFFFF' : isDark ? '#D4C4E8' : '#5F4F73' }]}>
                    {t(`onboarding.options.genderPrefs.${opt}`, { defaultValue: opt })}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <TouchableOpacity
            onPress={handleConfirm}
            disabled={!canContinue}
            activeOpacity={0.8}
            style={[styles.confirmButton, { backgroundColor: canContinue ? '#A08AB7' : isDark ? '#2C2C3E' : '#E2D8EC' }]}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={[styles.confirmText, { color: canContinue ? '#FFFFFF' : isDark ? '#6B7280' : '#9CA3AF' }]}>
                {t('common.continue', { defaultValue: 'Continue' })}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  sheet: {
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 24,
    textAlign: 'center',
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 28,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1.5,
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmButton: {
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
