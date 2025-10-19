import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithGoogle, signInWithApple, isAppleAuthAvailable } from '@/lib/auth-providers';

export default function SignIn() {
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
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      // Let index.tsx handle navigation based on profile status
      await new Promise(resolve => setTimeout(resolve, 300));
      router.replace('/');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign in');
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
        Alert.alert('Error', error.message || 'Failed to sign in with Google');
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
      Alert.alert('Error', error.message || 'Failed to sign in with Apple');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-cream px-6 pt-16">
      <TouchableOpacity onPress={() => router.back()} className="mb-8">
        <Text className="text-primary-600 text-lg font-semibold">← Back</Text>
      </TouchableOpacity>

      <Text className="text-4xl font-bold text-charcoal mb-2">
        Hey there! 💜
      </Text>
      <Text className="text-gray-600 text-lg mb-8">
        Let's find your perfect arrangement
      </Text>

      <View className="space-y-4">
        <View>
          <Text className="text-gray-700 mb-2 font-medium">Email</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3"
            placeholder="your@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View>
          <Text className="text-gray-700 mb-2 font-medium">Password</Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3"
            placeholder="••••••••"
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
            {loading ? 'Signing In...' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="items-center mt-4"
          onPress={() => router.push('/(auth)/forgot-password')}
        >
          <Text className="text-primary-600">Forgot password?</Text>
        </TouchableOpacity>

        {/* Divider */}
        <View className="flex-row items-center my-6">
          <View className="flex-1 h-px bg-gray-300" />
          <Text className="mx-4 text-gray-500">or continue with</Text>
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
              Continue with Google
            </Text>
          </TouchableOpacity>

          {appleAuthAvailable && (
            <TouchableOpacity
              className="bg-black rounded-full py-3 px-4 flex-row items-center justify-center"
              onPress={handleAppleSignIn}
              disabled={loading}
            >
              <Text className="text-white font-semibold ml-2">
                Continue with Apple
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="flex-row justify-center items-center mt-6">
          <Text className="text-gray-600">Don't have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
            <Text className="text-primary-600 font-semibold">Sign Up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
