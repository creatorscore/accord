import { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Platform, ScrollView, KeyboardAvoidingView, StyleSheet, Keyboard } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithGoogle, signInWithApple, isAppleAuthAvailable } from '@/lib/auth-providers';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { trackUserAction, identifyUser } from '@/lib/analytics';
import { getDeviceFingerprint } from '@/lib/device-fingerprint';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function SignIn() {
  const translationHook = useTranslation();
  const t = translationHook?.t || ((key: string) => key); // Fallback if i18n not ready
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const { signIn, signOut } = useAuth();

  // Ref to prevent multiple simultaneous sign-in attempts (synchronous check for slow devices)
  const isSigningIn = useRef(false);

  useEffect(() => {
    checkAppleAuth();
  }, []);

  const checkAppleAuth = async () => {
    const available = await isAppleAuthAvailable();
    setAppleAuthAvailable(available);
  };

  // Check if user is banned and sign them out if so
  const checkBanAndProceed = async (userEmail: string): Promise<boolean> => {
    try {
      const deviceId = await getDeviceFingerprint();

      const { data: banCheck } = await supabase.rpc('is_banned', {
        check_email: userEmail.toLowerCase(),
        check_device_id: deviceId,
      });

      if (banCheck === true) {
        // Sign out the banned user
        await signOut();
        // Navigate to banned screen with user info
        router.replace({
          pathname: '/(auth)/banned',
          params: { email: userEmail.toLowerCase() }
        });
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error checking ban status:', error);
      // If we can't check, allow them to proceed (fail open, but index.tsx will also check)
      return true;
    }
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('auth.signIn.errorMissingFields'));
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);

      // Check if user is banned before proceeding
      const canProceed = await checkBanAndProceed(email);
      if (!canProceed) {
        setLoading(false);
        return;
      }

      // Track successful sign-in
      trackUserAction.signIn('email');
      // Dismiss keyboard before navigation to prevent UIKeyboardTaskQueue hangs
      Keyboard.dismiss();
      // Let index.tsx handle navigation based on profile status
      await new Promise(resolve => setTimeout(resolve, 300));
      router.replace('/');
    } catch (error: any) {
      console.error('Sign-in error:', error);

      // Parse error message - handle JSON errors and extract user-friendly message
      let errorMessage = 'Failed to sign in';
      try {
        if (error.message) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error.error_description) {
          errorMessage = error.error_description;
        }
      } catch (parseError) {
        console.error('Error parsing error message:', parseError);
      }

      // Handle rate limiting errors
      if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests') || error.status === 429) {
        Alert.alert(
          'Too Many Attempts',
          'You\'ve made too many sign-in attempts. Please wait a few minutes and try again.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Check if the error is because of invalid credentials
      if (errorMessage.includes('Invalid login credentials')) {
        // Check if this email exists and which provider they used
        try {
          const { data: emailCheck } = await supabase.rpc('check_email_provider', {
            check_email: email.toLowerCase().trim()
          });

          if (emailCheck && emailCheck.length > 0 && emailCheck[0].email_exists) {
            const provider = emailCheck[0].auth_provider;

            // If they signed up with email, credentials are just wrong
            if (provider === 'email') {
              Alert.alert(
                'Incorrect Password',
                'The password you entered is incorrect. Please try again or use "Forgot password?" to reset it.',
                [
                  { text: 'OK', style: 'cancel' },
                  { text: 'Reset Password', onPress: () => router.push('/(auth)/forgot-password') }
                ]
              );
              return;
            }

            // If they signed up with Google
            if (provider === 'google') {
              Alert.alert(
                'Use Google Sign-In',
                'This email is registered with Google. Please tap "Continue with Google" below to sign in.',
                [{ text: 'Got It' }]
              );
              return;
            }

            // If they signed up with Apple
            if (provider === 'apple') {
              Alert.alert(
                'Use Apple Sign-In',
                'This email is registered with Apple. Please tap "Continue with Apple" below to sign in.',
                [{ text: 'Got It' }]
              );
              return;
            }
          } else {
            // Email doesn't exist - they need to sign up
            Alert.alert(
              'Account Not Found',
              'No account exists with this email. Would you like to create one?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Up', onPress: () => router.push('/(auth)/sign-up') }
              ]
            );
            return;
          }
        } catch (checkError) {
        }

        // Fallback generic message
        Alert.alert(
          'Invalid Credentials',
          'The email or password you entered is incorrect. If you signed up with Google or Apple, please use those buttons to sign in.',
          [{ text: 'Got It' }]
        );
        return;
      }

      // Handle email not confirmed — show OTP verification screen
      if (errorMessage.includes('Email not confirmed')) {
        // Resend the verification code automatically
        try {
          await supabase.auth.resend({
            type: 'signup',
            email: email.toLowerCase().trim(),
          });
        } catch (_) {
          // Best-effort resend — user can manually resend from the verification screen
        }
        setVerificationEmail(email.toLowerCase().trim());
        setOtpCode('');
        setShowVerification(true);
        return;
      }

      Alert.alert(t('common.error'), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    // Synchronous check to prevent ANR from multiple rapid taps on slow devices
    if (isSigningIn.current) {
      return;
    }
    isSigningIn.current = true;
    setLoading(true);
    try {
      const result = await signInWithGoogle();

      // Let the root index.tsx handle navigation based on profile status
      if (result) {
        // Check if user is banned before proceeding
        const userEmail = 'user' in result ? result.user?.email : undefined;
        if (userEmail) {
          const canProceed = await checkBanAndProceed(userEmail);
          if (!canProceed) {
            setLoading(false);
            return;
          }
        }

        // Track successful Google sign-in
        trackUserAction.signIn('google');
        // Dismiss keyboard before navigation to prevent UIKeyboardTaskQueue hangs
        Keyboard.dismiss();
        // Wait for auth state to update, then let index.tsx redirect
        await new Promise(resolve => setTimeout(resolve, 300));
        router.replace('/');
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      if (error.message !== 'User cancelled') {
        // Parse error message
        let errorMessage = 'Failed to sign in with Google';
        try {
          if (error.message) errorMessage = error.message;
          else if (error.error_description) errorMessage = error.error_description;
        } catch (parseError) {
          console.error('Error parsing Google error:', parseError);
        }

        // Handle rate limiting
        if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests') || error.status === 429) {
          Alert.alert(
            'Too Many Attempts',
            'Please wait a few minutes before trying to sign in again.',
            [{ text: 'OK' }]
          );
          return;
        }

        Alert.alert(t('common.error'), errorMessage);
      }
    } finally {
      isSigningIn.current = false;
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    // Synchronous check to prevent ANR from multiple rapid taps on slow devices
    if (isSigningIn.current) {
      return;
    }
    isSigningIn.current = true;
    setLoading(true);
    try {
      const result = await signInWithApple();
      if (result) {
        // Check if user is banned before proceeding
        const userEmail = result.user?.email;
        if (userEmail) {
          const canProceed = await checkBanAndProceed(userEmail);
          if (!canProceed) {
            setLoading(false);
            return;
          }
        }

        // Track successful Apple sign-in
        trackUserAction.signIn('apple');
        // Dismiss keyboard before navigation to prevent UIKeyboardTaskQueue hangs
        Keyboard.dismiss();
        // Let index.tsx handle navigation based on profile status
        await new Promise(resolve => setTimeout(resolve, 300));
        router.replace('/');
      }
    } catch (error: any) {
      console.error('Apple sign-in error:', error);
      // Parse error message
      let errorMessage = 'Failed to sign in with Apple';
      try {
        if (error.message) errorMessage = error.message;
        else if (error.error_description) errorMessage = error.error_description;
      } catch (parseError) {
        console.error('Error parsing Apple error:', parseError);
      }

      // Handle rate limiting
      if (errorMessage.includes('rate limit') || errorMessage.includes('too many requests') || error.status === 429) {
        Alert.alert(
          'Too Many Attempts',
          'Please wait a few minutes before trying to sign in again.',
          [{ text: 'OK' }]
        );
        return;
      }

      Alert.alert(t('common.error'), errorMessage);
    } finally {
      isSigningIn.current = false;
      setLoading(false);
    }
  };

  // Handle OTP verification for unconfirmed emails
  const handleVerifyOtp = async () => {
    if (otpCode.length !== 6) {
      Alert.alert(t('common.error'), 'Please enter the 6-digit code');
      return;
    }

    setVerifyingOtp(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: verificationEmail,
        token: otpCode,
        type: 'signup',
      });

      if (error) throw error;

      if (data.session) {
        Alert.alert(
          t('common.success'),
          'Email verified successfully!',
          [{
            text: 'OK',
            onPress: () => {
              Keyboard.dismiss();
              router.replace('/');
            }
          }]
        );
      }
    } catch (error: any) {
      Alert.alert(
        t('common.error'),
        error.message || 'Invalid or expired code. Please try again.'
      );
    } finally {
      setVerifyingOtp(false);
    }
  };

  // Email verification screen for unconfirmed accounts
  if (showVerification) {
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
          <Text style={styles.verificationTitle}>Verify Your Email</Text>
          <Text style={styles.verificationMessage}>We sent a 6-digit verification code to</Text>
          <Text style={styles.verificationEmail}>{verificationEmail}</Text>

          <View style={styles.otpContainer}>
            <Text style={styles.otpLabel}>Enter verification code</Text>
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
              {verifyingOtp ? 'Verifying...' : 'Verify Email'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.verificationInstructions}>
            Check your email inbox (and spam folder) for the verification code. It may take a few minutes to arrive.
          </Text>

          <TouchableOpacity
            onPress={() => {
              setShowVerification(false);
              setOtpCode('');
            }}
            style={styles.secondaryLink}
          >
            <Text style={styles.linkText}>Back to Sign In</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.tertiaryLink}
            onPress={async () => {
              try {
                setLoading(true);
                await supabase.auth.resend({
                  type: 'signup',
                  email: verificationEmail,
                });
                Alert.alert(t('common.success'), 'Verification code resent!');
              } catch (error) {
                Alert.alert(t('common.error'), 'Failed to resend code. Please try again.');
              } finally {
                setLoading(false);
              }
            }}
            disabled={loading}
          >
            <Text style={styles.tertiaryLinkText}>
              {loading ? 'Sending...' : 'Resend verification code'}
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
        <Text style={styles.title}>{t('auth.signIn.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.signIn.subtitle')}</Text>

        {/* Form */}
        <View style={styles.form}>
          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>{t('auth.signIn.email')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.signIn.emailPlaceholder')}
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
            <Text style={styles.label}>{t('auth.signIn.password')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.signIn.passwordPlaceholder')}
              placeholderTextColor="#A1A1AA"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleSignIn}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? t('auth.signIn.signingIn') : t('auth.signIn.signInButton')}
            </Text>
          </TouchableOpacity>

          {/* Forgot Password Link */}
          <TouchableOpacity
            style={styles.forgotPassword}
            onPress={() => {
              Keyboard.dismiss();
              router.push('/(auth)/forgot-password');
            }}
          >
            <Text style={styles.linkText}>{t('auth.signIn.forgotPassword')}</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>{t('auth.signIn.orContinueWith')}</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Social Sign-In Buttons */}
          <View style={styles.socialButtons}>
            {/* Google Button */}
            <TouchableOpacity
              style={styles.socialButton}
              onPress={handleGoogleSignIn}
              disabled={loading}
            >
              <Ionicons name="logo-google" size={20} color="#4285F4" />
              <Text style={styles.socialButtonText}>{t('auth.signIn.continueWithGoogle')}</Text>
            </TouchableOpacity>

            {/* Apple Button */}
            {appleAuthAvailable && (
              <TouchableOpacity
                style={styles.appleButton}
                onPress={handleAppleSignIn}
                disabled={loading}
              >
                <Ionicons name="logo-apple" size={20} color="#FFFFFF" />
                <Text style={styles.appleButtonText}>{t('auth.signIn.continueWithApple')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Sign Up Link */}
          <View style={styles.signUpContainer}>
            <Text style={styles.signUpText}>{t('auth.signIn.noAccount')}</Text>
            <TouchableOpacity onPress={() => {
              Keyboard.dismiss();
              router.push('/(auth)/sign-up');
            }}>
              <Text style={styles.signUpLink}>{t('auth.signIn.signUpLink')}</Text>
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
  forgotPassword: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    color: '#A08AB7',
    fontFamily: 'Inter-Medium',
    fontSize: 16,
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
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    paddingBottom: 16,
  },
  signUpText: {
    color: '#71717A',
    fontFamily: 'Inter',
    fontSize: 16,
  },
  signUpLink: {
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
