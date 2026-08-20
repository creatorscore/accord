import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/lib/useColorScheme';
import { toUserMessage } from '@/lib/error-messages';

export default function ResetPassword() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { updatePassword } = useAuth();
  const { isDarkColorScheme } = useColorScheme();

  // Dynamic theme colors
  const themeColors = {
    background: isDarkColorScheme ? '#0F0F1A' : '#FFFFFF',
    text: isDarkColorScheme ? '#F5F5F7' : '#1F2937',
    mutedText: isDarkColorScheme ? '#9CA3AF' : '#71717A',
    inputBg: isDarkColorScheme ? '#1C1C2E' : '#FFFFFF',
    inputBorder: isDarkColorScheme ? '#2C2C3E' : '#E4E4E7',
    iconContainerBg: isDarkColorScheme ? '#2C2C3E' : '#F5F2F7',
  };

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert(t('auth.resetPassword.errorTitle'), t('auth.resetPassword.fillAllFields'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(t('auth.resetPassword.errorTitle'), t('auth.resetPassword.passwordsMismatch'));
      return;
    }

    if (password.length < 8) {
      Alert.alert(t('auth.resetPassword.errorTitle'), t('auth.resetPassword.passwordTooShort'));
      return;
    }

    setLoading(true);
    try {
      await updatePassword(password);
      Alert.alert(
        t('auth.resetPassword.successTitle'),
        t('auth.resetPassword.resetSuccess'),
        [
          {
            text: 'OK',
            onPress: () => router.replace('/(tabs)/discover'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(t('auth.resetPassword.errorTitle'), toUserMessage(error, t('auth.resetPassword.resetFailed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { paddingTop: insets.top, backgroundColor: themeColors.background }]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header Icon */}
        <View style={styles.iconWrapper}>
          <View style={[styles.iconContainer, { backgroundColor: themeColors.iconContainerBg }]}>
            <Ionicons name="lock-closed-outline" size={32} color="#A08AB7" />
          </View>
        </View>

        {/* Header */}
        <Text style={[styles.title, { color: themeColors.text }]}>{t('auth.resetPassword.title')}</Text>
        <Text style={[styles.subtitle, { color: themeColors.mutedText }]}>{t('auth.resetPassword.subtitle')}</Text>

        {/* Form */}
        <View style={styles.form}>
          {/* New Password Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: themeColors.text }]}>{t('auth.resetPassword.newPasswordLabel')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder, color: themeColors.text }]}
              placeholder={t('auth.resetPassword.newPasswordPlaceholder')}
              placeholderTextColor="#A1A1AA"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoFocus
            />
            <Text style={[styles.hint, { color: themeColors.mutedText }]}>{t('auth.resetPassword.passwordHint')}</Text>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: themeColors.text }]}>{t('auth.resetPassword.confirmPasswordLabel')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder, color: themeColors.text }]}
              placeholder={t('auth.resetPassword.confirmPasswordPlaceholder')}
              placeholderTextColor="#A1A1AA"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? t('auth.resetPassword.resetting') : t('auth.resetPassword.resetButton')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 48,
    flexGrow: 1,
  },
  iconWrapper: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#F5F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#1F2937',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    fontFamily: 'Inter',
    color: '#71717A',
    marginBottom: 32,
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
    color: '#1F2937',
    fontSize: 16,
    fontFamily: 'Inter',
  },
  hint: {
    fontSize: 14,
    fontFamily: 'Inter',
    color: '#71717A',
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: '#A08AB7',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    shadowColor: '#A08AB7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    fontSize: 17,
  },
});
