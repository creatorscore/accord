import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/lib/useColorScheme';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { sendPasswordResetEmail } = useAuth();
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

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert(t('auth.forgotPassword.errorTitle'), t('auth.forgotPassword.enterEmail'));
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(email);
      setEmailSent(true);
      setResendCooldown(60); // 60 second cooldown
    } catch (error: any) {
      console.error('Password reset error:', error);
      Alert.alert(t('auth.forgotPassword.errorTitle'), error.message || error?.error_description || t('auth.forgotPassword.sendFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;

    setLoading(true);
    try {
      await sendPasswordResetEmail(email);
      setResendCooldown(60); // Reset cooldown
      Alert.alert(t('auth.forgotPassword.successTitle'), t('auth.forgotPassword.resentSuccess'));
    } catch (error: any) {
      Alert.alert(t('auth.forgotPassword.errorTitle'), error.message || t('auth.forgotPassword.resendFailed'));
    } finally {
      setLoading(false);
    }
  };

  // Email Sent Success Screen
  if (emailSent) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, backgroundColor: themeColors.background }]}>
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#A08AB7" />
          <Text style={styles.backButtonText}>{t('auth.forgotPassword.back')}</Text>
        </TouchableOpacity>

        <View style={styles.successContainer}>
          <View style={[styles.iconContainer, { backgroundColor: themeColors.iconContainerBg }]}>
            <Ionicons name="mail-outline" size={40} color="#A08AB7" />
          </View>
          <Text style={[styles.successTitle, { color: themeColors.text }]}>{t('auth.forgotPassword.checkYourEmail')}</Text>
          <Text style={[styles.successMessage, { color: themeColors.mutedText }]}>{t('auth.forgotPassword.sentResetLink')}</Text>
          <Text style={styles.emailText}>{email}</Text>
          <Text style={[styles.successInstructions, { color: themeColors.mutedText }]}>
            {t('auth.forgotPassword.linkExpiry')}
          </Text>

          <TouchableOpacity
            style={[styles.outlineButton, (resendCooldown > 0 || loading) && styles.buttonDisabled]}
            onPress={handleResend}
            disabled={resendCooldown > 0 || loading}
          >
            <Text style={styles.outlineButtonText}>
              {resendCooldown > 0
                ? t('auth.forgotPassword.resendIn', { seconds: resendCooldown })
                : loading
                  ? t('auth.forgotPassword.sending')
                  : t('auth.forgotPassword.resendEmail')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(auth)/sign-in')}
          >
            <Text style={styles.primaryButtonText}>{t('auth.forgotPassword.backToSignIn')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

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
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#A08AB7" />
          <Text style={styles.backButtonText}>{t('auth.forgotPassword.back')}</Text>
        </TouchableOpacity>

        {/* Header */}
        <Text style={[styles.title, { color: themeColors.text }]}>{t('auth.forgotPassword.title')}</Text>
        <Text style={[styles.subtitle, { color: themeColors.mutedText }]}>
          {t('auth.forgotPassword.subtitle')}
        </Text>

        {/* Form */}
        <View style={styles.form}>
          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: themeColors.text }]}>{t('auth.forgotPassword.emailLabel')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.inputBg, borderColor: themeColors.inputBorder, color: themeColors.text }]}
              placeholder={t('auth.forgotPassword.emailPlaceholder')}
              placeholderTextColor="#A1A1AA"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? t('auth.forgotPassword.sending') : t('auth.forgotPassword.sendResetLink')}
            </Text>
          </TouchableOpacity>

          {/* Sign In Link */}
          <View style={styles.signInContainer}>
            <Text style={[styles.signInText, { color: themeColors.mutedText }]}>{t('auth.forgotPassword.rememberPassword')}</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')}>
              <Text style={styles.signInLink}>{t('auth.forgotPassword.signIn')}</Text>
            </TouchableOpacity>
          </View>
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
    paddingTop: 16,
    flexGrow: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 32,
  },
  backButtonText: {
    color: '#A08AB7',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    marginLeft: 4,
  },
  title: {
    fontSize: 32,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 17,
    fontFamily: 'Inter',
    color: '#71717A',
    marginBottom: 32,
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
  primaryButton: {
    backgroundColor: '#A08AB7',
    borderRadius: 50,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
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
  outlineButton: {
    borderWidth: 2,
    borderColor: '#A08AB7',
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: 'center',
    marginBottom: 16,
  },
  outlineButtonText: {
    color: '#A08AB7',
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  signInText: {
    color: '#71717A',
    fontFamily: 'Inter',
    fontSize: 16,
  },
  signInLink: {
    color: '#A08AB7',
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  // Success screen styles
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -80,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 17,
    fontFamily: 'Inter',
    color: '#71717A',
    textAlign: 'center',
    marginBottom: 8,
  },
  emailText: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#A08AB7',
    marginBottom: 24,
  },
  successInstructions: {
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#71717A',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 32,
    lineHeight: 24,
  },
});
