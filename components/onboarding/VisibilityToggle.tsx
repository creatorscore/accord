import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface VisibilityToggleProps {
  visible: boolean;
  onToggle: (value: boolean) => void;
}

export default function VisibilityToggle({ visible, onToggle }: VisibilityToggleProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggle(!visible); }}
      activeOpacity={0.7}
    >
      <View style={[styles.checkbox, visible && styles.checkboxChecked]}>
        {visible && <MaterialCommunityIcons name="check" size={14} color="white" />}
      </View>
      <Text style={[styles.label, { color: isDark ? '#8E8E93' : '#9CA3AF' }]}>
        Visible on profile
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#D5CDE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#A08AB7',
    borderColor: '#A08AB7',
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
});
