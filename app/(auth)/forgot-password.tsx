import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Keyboard } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/lib/useColorScheme';
import { toUserMessage } from '@/lib/error-messages';

/**
 * Password reset via one-time-code (OTP), not a magic link.
 *
 * Magic links don't work reliably in email apps that render links in an
 * in-app webview (Gmail iOS/Android) because those webviews can't hand off
 * custom URL schemes to the native app. OTP avoids deep-linking entirely —
 * user types the 6-digit code, session established in-app, set new password.
 */
export default function ForgotPassword() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { isDarkColorScheme } = useColorScheme();

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

  const sendCode = async (trimmedEmail: string) => {
    // signInWithOtp always sends a 6-digit code (uses the "Magic Link" email
    // template, which includes {{ .Token }}). shouldCreateUser=false prevents
    // accidentally creating an account for a mistyped email.
    const { error } = await supabase.auth.signInWithOtp({
      email: trimmedEmail,
      options: { shouldCreateUser: false },
    });
    if (error) throw error;
  };

  const handleRequestCode = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      Alert.alert(t('auth.forgotPassword.errorTitle'), t('auth.forgotPassword.enterEmail'));
      return;
    }
    setLoading(true);
    try {
      await sendCode(trimmed);
      setCodeSent(true);
      setResendCooldown(60);
    } catch (error: any) {
      console.error('Password reset OTP error:', error);
      Alert.alert(
        t('auth.forgotPassword.errorTitle'),
        toUserMessage(error, t('auth.forgotPassword.sendFailed'))
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    setLoading(true);
    try {
      await sendCode(email.trim().toLowerCase());
      setResendCooldown(60);
      Alert.alert(
        t('auth.forgotPassword.successTitle'),
        t('auth.forgotPassword.resentSuccess')
      );
    } catch (error: any) {
      Alert.alert(
        t('auth.forgotPassword.errorTitle'),
        toUserMessage(error, t('auth.forgotPassword.resendFailed'))
      );
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (otpCode.length !== 6) {
      Alert.alert(
        t('auth.forgotPassword.errorTitle'),
        t('auth.forgotPassword.enterSixDigitCode', { defaultValue: 'Enter the 6-digit code from your email.' })
      );
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otpCode,
        type: 'email',
      });
      if (error) throw error;
      if (!data.session) {
        throw new Error(t('auth.forgotPassword.sessionFailed', { defaultValue: "Couldn't start your session. Try again." }));
      }
      // Session established. Navigate to reset-password to set new password.
      Keyboard.dismiss();
      router.replace('/(auth)/reset-password');
    } catch (error: any) {
      Alert.alert(
        t('auth.forgotPassword.errorTitle'),
        toUserMessage(error, t('auth.forgotPassword.invalidOrExpiredCode', { defaultValue: 'That code is invalid or expired. Try again or resend.' }))
      );
    } finally {
      setVerifying(false);
    }
  };

  // ─────────────────────────────────────────────────────────
  // Step 2: Enter 6-digit code from email
  // ─────────────────────────────────────────────────────────
  if (codeSent) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, backgroundColor: themeColors.background }]}
      >
        <ScrollView contentContainerStyle={styles.successContainer} keyboardShouldPersistTaps="handled">
          <TouchableOpacity
            onPress={() => { setCodeSent(false); setOtpCode(''); }}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={24} color="#A08AB7" />
            <Text style={styles.backButtonText}>{t('auth.forgotPassword.back')}</Text>
          </TouchableOpacity>

          <View style={[styles.iconContainer, { backgroundColor: themeColors.iconContainerBg }]}>
            <Ionicons name="mail-outline" size={40} color="#A08AB7" />
          </View>
          <Text style={[styles.successTitle, { color: themeColors.text }]}>
            {t('auth.forgotPassword.checkYourEmail')}
          </Text>
          <Text style={[styles.successMessage, { color: themeColors.mutedText }]}>
            {t('auth.forgotPassword.codeSentMessage', { defaultValue: 'We sent a 6-digit code to' })}
          </Text>
          <Text style={styles.emailText}>{email.trim().toLowerCase()}</Text>

          <View style={styles.otpContainer}>
            <TextInput
              style={[styles.otpInput, { backgroundColor: themeColors.inputBg, color: themeColors.text, borderColor: themeColors.inputBorder }]}
              placeholder="000000"
              placeholderTextColor="#A1A1AA"
              value={otpCode}
              onChangeText={(text) => setOtpCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              textAlign="center"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, (verifying || otpCode.length !== 6) && styles.buttonDisabled]}
            onPress={handleVerifyCode}
            disabled={verifying || otpCode.length !== 6}
          >
            <Text style={styles.primaryButtonText}>
              {verifying
                ? t('auth.forgotPassword.verifying', { defaultValue: 'Verifying…' })
                : t('auth.forgotPassword.verifyCode', { defaultValue: 'Verify code' })}
            </Text>
          </TouchableOpacity>

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
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // ─────────────────────────────────────────────────────────
  // Step 1: Enter email
  // ─────────────────────────────────────────────────────────
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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#A08AB7" />
          <Text style={styles.backButtonText}>{t('auth.forgotPassword.back')}</Text>
        </TouchableOpacity>

        <Text style={[styles.title, { color: themeColors.text }]}>{t('auth.forgotPassword.title')}</Text>
        <Text style={[styles.subtitle, { color: themeColors.mutedText }]}>
          {t('auth.forgotPassword.subtitleCode', { defaultValue: "Enter your email and we'll send you a 6-digit code to reset your password." })}
        </Text>

        <View style={styles.form}>
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

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleRequestCode}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading
                ? t('auth.forgotPassword.sending')
                : t('auth.forgotPassword.sendCode', { defaultValue: 'Send code' })}
            </Text>
          </TouchableOpacity>

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
    marginTop: 12,
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
  // OTP / success screen styles
  successContainer: {
    flexGrow: 1,
    alignItems: 'center',
    paddingTop: 16,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    marginTop: 24,
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
  otpContainer: {
    width: '100%',
    marginBottom: 16,
  },
  otpInput: {
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 12,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    color: '#1F2937',
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    letterSpacing: 8,
  },
});
