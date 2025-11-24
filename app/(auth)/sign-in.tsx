import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithGoogle, signInWithApple, isAppleAuthAvailable } from '@/lib/auth-providers';
import { supabase } from '@/lib/supabase';
import { useTranslation } from 'react-i18next';
import { trackUserAction, identifyUser } from '@/lib/analytics';
import { getDeviceFingerprint } from '@/lib/device-fingerprint';

export default function SignIn() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const { signIn, signOut } = useAuth();

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
        Alert.alert(
          'Account Restricted',
          'This account has been restricted from using Accord. If you believe this is an error, please contact support at hello@joinaccord.app.',
          [{ text: 'OK' }]
        );
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
      // Let index.tsx handle navigation based on profile status
      await new Promise(resolve => setTimeout(resolve, 300));
      router.replace('/');
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to sign in';

      // Check if the error is because of invalid credentials
      if (errorMessage.includes('Invalid login credentials')) {
        // Check if this email exists and which provider they used
        try {
          const { data: userData } = await supabase.rpc('get_user_auth_providers', {
            user_email: email.toLowerCase().trim()
          });

          if (userData && userData.length > 0) {
            const providers = userData.map((p: any) => p.provider);

            // If they have email provider, credentials are just wrong
            if (providers.includes('email')) {
              Alert.alert(
                'Incorrect Password',
                'The password you entered is incorrect. Please try again or reset your password.',
                [{ text: 'OK' }]
              );
              return;
            }

            // If they only have Google
            if (providers.includes('google') && !providers.includes('apple')) {
              Alert.alert(
                'Use Google Sign-In',
                'This email is registered with Google Sign-In. Please use the "Continue with Google" button to sign in.',
                [{ text: 'Got It' }]
              );
              return;
            }

            // If they only have Apple
            if (providers.includes('apple') && !providers.includes('google')) {
              Alert.alert(
                'Use Apple Sign-In',
                'This email is registered with Apple Sign-In. Please use the "Continue with Apple" button to sign in.',
                [{ text: 'Got It' }]
              );
              return;
            }

            // If they have both Google and Apple
            if (providers.includes('google') && providers.includes('apple')) {
              Alert.alert(
                'Use Social Sign-In',
                'This email is registered with Google or Apple Sign-In. Please use one of those buttons to sign in.',
                [{ text: 'Got It' }]
              );
              return;
            }
          }
        } catch (checkError) {
          console.log('Could not check providers:', checkError);
        }

        // Fallback generic message
        Alert.alert(
          'Invalid Credentials',
          'The email or password you entered is incorrect. If you signed up with Google or Apple, please use those buttons to sign in.',
          [{ text: 'Got It' }]
        );
        return;
      }

      // Handle email not confirmed
      if (errorMessage.includes('Email not confirmed')) {
        Alert.alert(
          t('auth.signIn.errorEmailNotConfirmed'),
          t('auth.signIn.errorEmailNotConfirmedMessage'),
          [{ text: 'OK' }]
        );
        return;
      }

      Alert.alert(t('common.error'), errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await signInWithGoogle();

      // Let the root index.tsx handle navigation based on profile status
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

        // Track successful Google sign-in
        trackUserAction.signIn('google');
        // Wait for auth state to update, then let index.tsx redirect
        await new Promise(resolve => setTimeout(resolve, 300));
        router.replace('/');
      }
    } catch (error: any) {
      if (error.message !== 'User cancelled') {
        Alert.alert(t('common.error'), error.message || 'Failed to sign in with Google');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
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
        // Let index.tsx handle navigation based on profile status
        await new Promise(resolve => setTimeout(resolve, 300));
        router.replace('/');
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || 'Failed to sign in with Apple');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-cream px-6 pt-16">
      <TouchableOpacity onPress={() => router.back()} className="mb-8">
        <Text className="text-primary-500 text-lg font-semibold">{t('auth.signIn.backButton')}</Text>
      </TouchableOpacity>

      <Text className="text-4xl font-bold text-charcoal mb-2">
        {t('auth.signIn.title')}
      </Text>
      <Text className="text-gray-600 text-lg mb-8">
        {t('auth.signIn.subtitle')}
      </Text>

      <View className="space-y-4">
        <View>
          <Text className="text-gray-700 mb-2 font-medium">{t('auth.signIn.email')}</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 bg-white text-gray-900"
            placeholder={t('auth.signIn.emailPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View>
          <Text className="text-gray-700 mb-2 font-medium">{t('auth.signIn.password')}</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3 bg-white text-gray-900"
            placeholder={t('auth.signIn.passwordPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          className={`bg-primary-500 rounded-full py-4 items-center mt-4 shadow-lg ${
            loading ? 'opacity-50' : ''
          }`}
          onPress={handleSignIn}
          disabled={loading}
        >
          <Text className="text-white font-bold text-lg">
            {loading ? t('auth.signIn.signingIn') : t('auth.signIn.signInButton')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="items-center mt-4"
          onPress={() => router.push('/(auth)/forgot-password')}
        >
          <Text className="text-primary-500">{t('auth.signIn.forgotPassword')}</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View className="flex-row items-center my-6">
          <View className="flex-1 h-px bg-gray-300" />
          <Text className="mx-4 text-gray-500">{t('auth.signIn.orContinueWith')}</Text>
          <View className="flex-1 h-px bg-gray-300" />
        </View>

        {/* Social Sign-In Buttons */}
        <View className="space-y-3">
          <TouchableOpacity
            className="border border-gray-300 rounded-full py-3 px-4 flex-row items-center justify-center"
            onPress={handleGoogleSignIn}
            disabled={loading}
          >
            <Text className="text-gray-700 font-semibold ml-2">
              {t('auth.signIn.continueWithGoogle')}
            </Text>
          </TouchableOpacity>

          {appleAuthAvailable && (
            <TouchableOpacity
              className="bg-black rounded-full py-3 px-4 flex-row items-center justify-center"
              onPress={handleAppleSignIn}
              disabled={loading}
            >
              <Text className="text-white font-semibold ml-2">
                {t('auth.signIn.continueWithApple')}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="flex-row justify-center items-center mt-6">
          <Text className="text-gray-600">{t('auth.signIn.noAccount')}</Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
            <Text className="text-primary-500 font-semibold">{t('auth.signIn.signUpLink')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
