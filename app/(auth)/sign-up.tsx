import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithGoogle, signInWithApple, isAppleAuthAvailable } from '@/lib/auth-providers';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { getDeviceFingerprint } from '@/lib/device-fingerprint';
import { trackUserAction, identifyUser } from '@/lib/analytics';

export default function SignUp() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const { signUp, signIn } = useAuth();

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
        setTimeout(() => {
          router.replace('/(onboarding)/language');
        }, 500);
      } else if (result.user) {
        // User created but no session - try to sign in
        console.log('User created, attempting sign in...');
        try {
          await signIn(email, password);
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
      setLoading(false);
    }
  };

  const handleAppleSignUp = async () => {
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
        setTimeout(() => {
          router.replace('/');
        }, 500);
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || 'Failed to sign up with Apple');
    } finally {
      setLoading(false);
    }
  };

  if (showVerificationMessage) {
    return (
      <View className="flex-1 bg-cream px-6 pt-16 justify-center">
        <View className="items-center">
          <Text className="text-6xl mb-6">📧</Text>
          <Text className="text-3xl font-bold text-charcoal mb-4 text-center">
            {t('auth.signUp.verificationTitle')}
          </Text>
          <Text className="text-gray-600 text-lg text-center mb-2">
            {t('auth.signUp.verificationMessage')}
          </Text>
          <Text className="text-primary-500 font-semibold text-lg mb-6">
            {userEmail}
          </Text>
          <Text className="text-gray-600 text-center mb-8 px-4">
            {t('auth.signUp.verificationInstructions')}
          </Text>

          <TouchableOpacity
            className="bg-primary-500 rounded-full py-4 px-8 mb-4"
            onPress={() => router.replace('/(auth)/sign-in')}
          >
            <Text className="text-white font-bold text-lg">
              {t('auth.signUp.goToSignIn')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowVerificationMessage(false)}
          >
            <Text className="text-primary-500 font-semibold">
              {t('auth.signUp.useDifferentEmail')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="mt-4"
            onPress={async () => {
              try {
                await supabase.auth.resend({
                  type: 'signup',
                  email: userEmail,
                });
                Alert.alert(t('common.success'), t('auth.signUp.verificationEmailResent'));
              } catch (error) {
                Alert.alert(t('common.error'), t('auth.signUp.resendError'));
              }
            }}
          >
            <Text className="text-gray-500 underline">
              {t('auth.signUp.resendVerificationEmail')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-cream px-6 pt-16">
      <TouchableOpacity onPress={() => router.back()} className="mb-8">
        <Text className="text-primary-500 text-lg font-semibold">{t('auth.signUp.backButton')}</Text>
      </TouchableOpacity>

      <Text className="text-4xl font-bold text-charcoal mb-2">
        {t('auth.signUp.title')}
      </Text>
      <Text className="text-gray-600 text-lg mb-8">
        {t('auth.signUp.subtitle')}
      </Text>

      <View className="space-y-4">
        <View>
          <Text className="text-gray-700 mb-2 font-medium">{t('auth.signUp.email')}</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 bg-white text-gray-900"
            placeholder={t('auth.signUp.emailPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View>
          <Text className="text-gray-700 mb-2 font-medium">{t('auth.signUp.password')}</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 bg-white text-gray-900"
            placeholder={t('auth.signUp.passwordPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Text className="text-gray-500 text-sm mt-1">
            {t('auth.signUp.passwordHint')}
          </Text>
        </View>

        <View>
          <Text className="text-gray-700 mb-2 font-medium">
            {t('auth.signUp.confirmPassword')}
          </Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 bg-white text-gray-900"
            placeholder={t('auth.signUp.passwordPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          className={`bg-primary-500 rounded-full py-4 items-center mt-4 shadow-lg ${
            loading ? 'opacity-50' : ''
          }`}
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text className="text-white font-bold text-lg">
            {loading ? t('auth.signUp.creatingAccount') : t('auth.signUp.createAccountButton')}
          </Text>
        </TouchableOpacity>

        <Text className="text-gray-500 text-xs text-center mt-4">
          {t('auth.signUp.termsAgree')}
          <Text className="text-primary-500">{t('auth.signUp.termsOfService')}</Text>
          {t('auth.signUp.and')}
          <Text className="text-primary-500">{t('auth.signUp.privacyPolicy')}</Text>
        </Text>

        {/* Divider */}
        <View className="flex-row items-center my-6">
          <View className="flex-1 h-px bg-gray-300" />
          <Text className="mx-4 text-gray-500">{t('auth.signUp.orSignUpWith')}</Text>
          <View className="flex-1 h-px bg-gray-300" />
        </View>

        {/* Social Sign-Up Buttons */}
        <View className="space-y-3">
          <TouchableOpacity
            className="border border-gray-300 rounded-full py-3 px-4 flex-row items-center justify-center"
            onPress={handleGoogleSignUp}
            disabled={loading}
          >
            <Text className="text-gray-700 font-semibold ml-2">
              {t('auth.signUp.continueWithGoogle')}
            </Text>
          </TouchableOpacity>

          {appleAuthAvailable && (
            <TouchableOpacity
              className="bg-black rounded-full py-3 px-4 flex-row items-center justify-center"
              onPress={handleAppleSignUp}
              disabled={loading}
            >
              <Text className="text-white font-semibold ml-2">
                {t('auth.signUp.continueWithApple')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="flex-row justify-center items-center mt-6">
          <Text className="text-gray-600">{t('auth.signUp.haveAccount')}</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')}>
            <Text className="text-primary-500 font-semibold">{t('auth.signUp.signInLink')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
