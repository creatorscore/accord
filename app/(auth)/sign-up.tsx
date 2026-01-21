import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Platform, ScrollView, KeyboardAvoidingView, StyleSheet, Keyboard } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithGoogle, signInWithApple, isAppleAuthAvailable } from '@/lib/auth-providers';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { getDeviceFingerprint } from '@/lib/device-fingerprint';
import { trackUserAction, identifyUser } from '@/lib/analytics';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SignUp() {
  const translationHook = useTranslation();
  const t = translationHook?.t || ((key: string) => key); // Fallback if i18n not ready
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const { signUp, signIn } = useAuth();

  // Ref to prevent multiple simultaneous sign-in attempts (synchronous check for slow devices)
  const isSigningIn = useRef(false);

  useEffect(() => {
    checkAppleAuth();
  }, []);

  const checkAppleAuth = async () => {
    const available = await isAppleAuthAvailable();
    setAppleAuthAvailable(available);
  };

  const handleSignUp = async () => {
    console.log('Sign up button clicked');
    console.log('Email:', email, 'Password length:', password.length);

    if (!email || !password || !confirmPassword) {
      if (Platform.OS === 'web') {
        alert(t('auth.signUp.errorMissingFields'));
      } else {
        Alert.alert(t('common.error'), t('auth.signUp.errorMissingFields'));
      }
      return;
    }

    if (password !== confirmPassword) {
      if (Platform.OS === 'web') {
        alert(t('auth.signUp.errorPasswordMismatch'));
      } else {
        Alert.alert(t('common.error'), t('auth.signUp.errorPasswordMismatch'));
      }
      return;
    }

    if (password.length < 8) {
      if (Platform.OS === 'web') {
        alert(t('auth.signUp.errorPasswordTooShort'));
      } else {
        Alert.alert(t('common.error'), t('auth.signUp.errorPasswordTooShort'));
      }
      return;
    }

    setLoading(true);
    try {
      // Check if email already exists and get the provider
      const { data: emailCheck } = await supabase.rpc('check_email_provider', {
        check_email: email.toLowerCase(),
      });

      if (emailCheck && emailCheck.length > 0 && emailCheck[0].email_exists) {
        const provider = emailCheck[0].auth_provider;
        let errorMessage = t('auth.signUp.errorAccountExistsMessage');

        if (provider === 'google') {
          errorMessage = t('auth.signUp.errorAccountExistsGoogle');
        } else if (provider === 'apple') {
          errorMessage = t('auth.signUp.errorAccountExistsApple');
        } else if (provider === 'email') {
          errorMessage = t('auth.signUp.errorAccountExistsEmail');
        }

        Alert.alert(
          t('auth.signUp.errorAccountExists'),
          errorMessage,
          [
            { text: t('auth.signIn.gotIt'), style: 'cancel' },
            {
              text: t('auth.signUp.signInLink'),
              onPress: () => router.push('/(auth)/sign-in')
            }
          ]
        );
        setLoading(false);
        return;
      }

      // Check if user is banned before allowing signup
      const deviceId = await getDeviceFingerprint();

      const { data: banCheck } = await supabase.rpc('is_banned', {
        check_email: email.toLowerCase(),
        check_device_id: deviceId,
      });

      if (banCheck === true) {
        Alert.alert(
          'Account Restricted',
          'This account has been restricted from using Accord. If you believe this is an error, please contact support at hello@joinaccord.app.',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      console.log('Calling signUp with:', email);
      const result = await signUp(email, password);
      console.log('Sign up result:', result);

      // Check if email confirmation is required
      if (result.user && !result.session) {
        // Email verification required - show success message
        console.log('Email confirmation required for:', email);
        // Track sign-up (even though not yet verified)
        trackUserAction.signUp('email');
        identifyUser(result.user.id, { email: email.toLowerCase() });
        setUserEmail(email);
        setShowVerificationMessage(true);
      } else if (result.session) {
        // Direct sign in successful (email confirmation disabled)
        console.log('Direct sign in successful');
        // Track successful sign-up
        trackUserAction.signUp('email');
        identifyUser(result.user!.id, { email: email.toLowerCase() });
        Keyboard.dismiss();
        setTimeout(() => {
          router.replace('/(onboarding)/language');
        }, 500);
      } else if (result.user) {
        // User created but no session - try to sign in
        console.log('User created, attempting sign in...');
        try {
          await signIn(email, password);
          Keyboard.dismiss();
          router.replace('/(onboarding)/language');
        } catch (signInError) {
          // Email confirmation is likely required
          setUserEmail(email);
          setShowVerificationMessage(true);
        }
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      const errorMessage = error.message || 'Failed to sign up';

      // Check if user already exists (signed up with OAuth)
      if (errorMessage.includes('User already registered') || errorMessage.includes('already been registered')) {
        if (Platform.OS === 'web') {
          alert(t('auth.signUp.errorAccountExistsMessage'));
        } else {
          Alert.alert(
            t('auth.signUp.errorAccountExists'),
            t('auth.signUp.errorAccountExistsMessage'),
            [{ text: t('auth.signIn.gotIt') }]
          );
        }
        return;
      }

      if (Platform.OS === 'web') {
        alert(errorMessage);
      } else {
        Alert.alert(t('common.error'), errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    // Synchronous check to prevent ANR from multiple rapid taps on slow devices
    if (isSigningIn.current) {
      console.log('Sign-in already in progress, ignoring tap');
      return;
    }
    isSigningIn.current = true;
    setLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result) {
        // Track successful Google sign-up
        trackUserAction.signUp('google');
        if ('user' in result && result.user) {
          identifyUser(result.user.id, { email: result.user.email });
        }
        // Let the root layout handle navigation based on profile/onboarding status
        // Don't force navigate to onboarding - the app will route correctly
        Keyboard.dismiss();
        setTimeout(() => {
          router.replace('/');
        }, 500);
      } else {
        Alert.alert(t('common.error'), 'Google sign-in was cancelled or failed');
      }
    } catch (error: any) {
      if (error.message !== 'User cancelled') {
        Alert.alert(t('common.error'), error.message || 'Failed to sign up with Google');
      }
      console.error('Google sign-up error:', error);
    } finally {
      isSigningIn.current = false;
      setLoading(false);
    }
  };

  const handleAppleSignUp = async () => {
    // Synchronous check to prevent ANR from multiple rapid taps on slow devices
    if (isSigningIn.current) {
      console.log('Sign-in already in progress, ignoring tap');
      return;
    }
    isSigningIn.current = true;
    setLoading(true);
    try {
      const result = await signInWithApple();
      if (result) {
        // Track successful Apple sign-up
        trackUserAction.signUp('apple');
        if ('user' in result && result.user) {
          identifyUser(result.user.id, { email: result.user.email });
        }
        // Let the root layout handle navigation based on profile/onboarding status
        Keyboard.dismiss();
        setTimeout(() => {
          router.replace('/');
        }, 500);
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || 'Failed to sign up with Apple');
    } finally {
      isSigningIn.current = false;
      setLoading(false);
    }
  };

  // Handle OTP verification
  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      Alert.alert(t('common.error'), t('auth.signUp.otpInvalidLength', 'Please enter the 6-digit code'));
      return;
    }

    setVerifyingOtp(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: userEmail,
        token: otpCode,
        type: 'signup',
      });

      if (error) throw error;

      if (data.session) {
        // Verification successful - user is now logged in
        Alert.alert(
          t('common.success'),
          t('auth.signUp.verificationSuccess', 'Email verified successfully!'),
          [
            {
              text: 'OK',
              onPress: () => {
                Keyboard.dismiss();
                router.replace('/(onboarding)/language');
              }
            }
          ]
        );
      }
    } catch (error: any) {
      console.error('OTP verification error:', error);
      Alert.alert(
        t('common.error'),
        error.message || t('auth.signUp.otpVerificationFailed', 'Invalid or expired code. Please try again.')
      );
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Email Verification Screen with OTP Input
  if (showVerificationMessage) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}
      >
        <ScrollView
          contentContainerStyle={styles.verificationContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconContainer}>
            <Ionicons name="mail-outline" size={40} color="#A08AB7" />
          </View>
          <Text style={styles.verificationTitle}>{t('auth.signUp.verificationTitle')}</Text>
          <Text style={styles.verificationMessage}>{t('auth.signUp.verificationMessageOtp', 'We sent a 6-digit verification code to')}</Text>
          <Text style={styles.verificationEmail}>{userEmail}</Text>

          {/* OTP Input */}
          <View style={styles.otpContainer}>
            <Text style={styles.otpLabel}>{t('auth.signUp.enterCode', 'Enter verification code')}</Text>
            <TextInput
              style={styles.otpInput}
              placeholder="000000"
              placeholderTextColor="#A1A1AA"
              value={otpCode}
              onChangeText={(text) => setOtpCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              textAlign="center"
            />
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, (verifyingOtp || otpCode.length !== 6) && styles.buttonDisabled]}
            onPress={handleVerifyOtp}
            disabled={verifyingOtp || otpCode.length !== 6}
          >
            <Text style={styles.primaryButtonText}>
              {verifyingOtp ? t('auth.signUp.verifying', 'Verifying...') : t('auth.signUp.verifyEmail', 'Verify Email')}
            </Text>
          </TouchableOpacity>

          <Text style={styles.verificationInstructions}>
            {t('auth.signUp.otpInstructions', "Check your email inbox (and spam folder) for the verification code. It may take a few minutes to arrive.")}
          </Text>

          <TouchableOpacity
            onPress={() => {
              setShowVerificationMessage(false);
              setOtpCode('');
            }}
            style={styles.secondaryLink}
          >
            <Text style={styles.linkText}>{t('auth.signUp.useDifferentEmail')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tertiaryLink}
            onPress={async () => {
              try {
                setLoading(true);
                await supabase.auth.resend({
                  type: 'signup',
                  email: userEmail,
                });
                Alert.alert(t('common.success'), t('auth.signUp.verificationEmailResent'));
              } catch (error) {
                Alert.alert(t('common.error'), t('auth.signUp.resendError'));
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            <Text style={styles.tertiaryLinkText}>
              {loading ? t('auth.signUp.sendingCode', 'Sending...') : t('auth.signUp.resendCode', 'Resend verification code')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Back Button */}
        <TouchableOpacity
          onPress={() => {
            Keyboard.dismiss();
            router.back();
          }}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color="#A08AB7" />
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>

        {/* Header */}
        <Text style={styles.title}>{t('auth.signUp.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.signUp.subtitle')}</Text>

        {/* Form */}
        <View style={styles.form}>
          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('auth.signUp.email')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.signUp.emailPlaceholder')}
              placeholderTextColor="#A1A1AA"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('auth.signUp.password')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.signUp.passwordPlaceholder')}
              placeholderTextColor="#A1A1AA"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <Text style={styles.hint}>{t('auth.signUp.passwordHint')}</Text>
          </View>

          {/* Confirm Password Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('auth.signUp.confirmPassword')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.signUp.passwordPlaceholder')}
              placeholderTextColor="#A1A1AA"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
            />
          </View>

          {/* Sign Up Button */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleSignUp}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? t('auth.signUp.creatingAccount') : t('auth.signUp.createAccountButton')}
            </Text>
          </TouchableOpacity>

          {/* Terms */}
          <Text style={styles.terms}>
            {t('auth.signUp.termsAgree')}
            <Text style={styles.termsLink}>{t('auth.signUp.termsOfService')}</Text>
            {t('auth.signUp.and')}
            <Text style={styles.termsLink}>{t('auth.signUp.privacyPolicy')}</Text>
          </Text>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.signUp.orSignUpWith')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Sign-Up Buttons */}
          <View style={styles.socialButtons}>
            {/* Google Button */}
            <TouchableOpacity
              style={styles.socialButton}
              onPress={handleGoogleSignUp}
              disabled={loading}
            >
              <Ionicons name="logo-google" size={20} color="#4285F4" />
              <Text style={styles.socialButtonText}>{t('auth.signUp.continueWithGoogle')}</Text>
            </TouchableOpacity>

            {/* Apple Button */}
            {appleAuthAvailable && (
              <TouchableOpacity
                style={styles.appleButton}
                onPress={handleAppleSignUp}
                disabled={loading}
              >
                <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                <Text style={styles.appleButtonText}>{t('auth.signUp.continueWithApple')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Sign In Link */}
          <View style={styles.signInContainer}>
            <Text style={styles.signInText}>{t('auth.signUp.haveAccount')}</Text>
            <TouchableOpacity onPress={() => {
              Keyboard.dismiss();
              router.push('/(auth)/sign-in');
            }}>
              <Text style={styles.signInLink}>{t('auth.signUp.signInLink')}</Text>
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
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
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
  terms: {
    fontSize: 14,
    fontFamily: 'Inter',
    color: '#71717A',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
  termsLink: {
    color: '#A08AB7',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E4E4E7',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#71717A',
    fontFamily: 'Inter',
    fontSize: 14,
  },
  socialButtons: {
    gap: 12,
  },
  socialButton: {
    borderWidth: 1,
    borderColor: '#E4E4E7',
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  socialButtonText: {
    color: '#1F2937',
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    marginLeft: 8,
  },
  appleButton: {
    backgroundColor: '#1F2937',
    borderRadius: 50,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appleButtonText: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
    marginLeft: 8,
  },
  signInContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    paddingBottom: 16,
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
  // Verification screen styles
  verificationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
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
  verificationTitle: {
    fontSize: 28,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#1F2937',
    marginBottom: 16,
    textAlign: 'center',
  },
  verificationMessage: {
    fontSize: 17,
    fontFamily: 'Inter',
    color: '#71717A',
    textAlign: 'center',
    marginBottom: 8,
  },
  verificationEmail: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#A08AB7',
    marginBottom: 24,
  },
  verificationInstructions: {
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#71717A',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 16,
    lineHeight: 24,
  },
  secondaryLink: {
    paddingVertical: 8,
    marginTop: 8,
  },
  linkText: {
    color: '#A08AB7',
    fontFamily: 'Inter-SemiBold',
    fontSize: 16,
  },
  tertiaryLink: {
    paddingVertical: 8,
    marginTop: 16,
  },
  tertiaryLinkText: {
    color: '#71717A',
    fontFamily: 'Inter',
    fontSize: 16,
    textDecorationLine: 'underline',
  },
  // OTP Input styles
  otpContainer: {
    width: '100%',
    marginTop: 24,
    marginBottom: 16,
  },
  otpLabel: {
    fontSize: 16,
    fontFamily: 'Inter-Medium',
    color: '#1F2937',
    marginBottom: 12,
    textAlign: 'center',
  },
  otpInput: {
    borderWidth: 2,
    borderColor: '#A08AB7',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFFFFF',
    color: '#1F2937',
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    letterSpacing: 8,
  },
});
