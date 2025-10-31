import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithGoogle, signInWithApple, isAppleAuthAvailable } from '@/lib/auth-providers';
import { useTranslation } from 'react-i18next';

export default function SignIn() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const { signIn } = useAuth();

  useEffect(() => {
    checkAppleAuth();
  }, []);

  const checkAppleAuth = async () => {
    const available = await isAppleAuthAvailable();
    setAppleAuthAvailable(available);
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert(t('common.error'), t('auth.signIn.errorMissingFields'));
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      // Let index.tsx handle navigation based on profile status
      await new Promise(resolve => setTimeout(resolve, 300));
      router.replace('/');
    } catch (error: any) {
      const errorMessage = error.message || 'Failed to sign in';

      // Check if the error is because they used OAuth instead
      // Supabase returns "Invalid login credentials" when trying to sign in with password for an OAuth account
      if (errorMessage.includes('Invalid login credentials')) {
        Alert.alert(
          t('auth.signIn.errorInvalidCredentials'),
          t('auth.signIn.errorInvalidCredentialsMessage'),
          [{ text: t('auth.signIn.gotIt') }]
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
        <Text className="text-primary-600 text-lg font-semibold">{t('auth.signIn.backButton')}</Text>
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
            className="border border-gray-300 rounded-lg px-4 py-3"
            placeholder={t('auth.signIn.emailPlaceholder')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View>
          <Text className="text-gray-700 mb-2 font-medium">{t('auth.signIn.password')}</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3"
            placeholder={t('auth.signIn.passwordPlaceholder')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          className={`bg-primary-600 rounded-full py-4 items-center mt-4 shadow-lg ${
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
          <Text className="text-primary-600">{t('auth.signIn.forgotPassword')}</Text>
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
            <Text className="text-primary-600 font-semibold">{t('auth.signIn.signUpLink')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
