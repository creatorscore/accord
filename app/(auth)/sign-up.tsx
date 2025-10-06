import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleAuth, signInWithApple, isAppleAuthAvailable } from '@/lib/auth-providers';

export default function SignUp() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleAuthAvailable, setAppleAuthAvailable] = useState(false);
  const { signUp } = useAuth();
  const { signInWithGoogle } = useGoogleAuth();

  useEffect(() => {
    checkAppleAuth();
  }, []);

  const checkAppleAuth = async () => {
    const available = await isAppleAuthAvailable();
    setAppleAuthAvailable(available);
  };

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);
    try {
      await signUp(email, password);
      router.replace('/(onboarding)/basic-info');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign up');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace('/(onboarding)/basic-info');
    } catch (error: any) {
      if (error.message !== 'User cancelled') {
        Alert.alert('Error', error.message || 'Failed to sign up with Google');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignUp = async () => {
    setLoading(true);
    try {
      const result = await signInWithApple();
      if (result) {
        router.replace('/(onboarding)/basic-info');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign up with Apple');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-white px-6 pt-16">
      <TouchableOpacity onPress={() => router.back()} className="mb-8">
        <Text className="text-primary-600 text-lg">← Back</Text>
      </TouchableOpacity>

      <Text className="text-3xl font-bold text-gray-900 mb-2">
        Create Account
      </Text>
      <Text className="text-gray-600 mb-8">
        Join Accord and find your perfect match
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
          <Text className="text-gray-500 text-sm mt-1">
            At least 8 characters
          </Text>
        </View>

        <View>
          <Text className="text-gray-700 mb-2 font-medium">
            Confirm Password
          </Text>
          <TextInput
            className="border border-gray-300 rounded-lg px-4 py-3"
            placeholder="••••••••"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
          />
        </View>

        <TouchableOpacity
          className={`bg-primary-600 rounded-full py-4 items-center mt-4 ${
            loading ? 'opacity-50' : ''
          }`}
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text className="text-white font-semibold text-lg">
            {loading ? 'Creating Account...' : 'Create Account'}
          </Text>
        </TouchableOpacity>

        <Text className="text-gray-500 text-xs text-center mt-4">
          By creating an account, you agree to our Terms of Service and Privacy
          Policy
        </Text>

        {/* Divider */}
        <View className="flex-row items-center my-6">
          <View className="flex-1 h-px bg-gray-300" />
          <Text className="mx-4 text-gray-500">or sign up with</Text>
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
              Continue with Google
            </Text>
          </TouchableOpacity>

          {appleAuthAvailable && (
            <TouchableOpacity
              className="bg-black rounded-full py-3 px-4 flex-row items-center justify-center"
              onPress={handleAppleSignUp}
              disabled={loading}
            >
              <Text className="text-white font-semibold ml-2">
                Continue with Apple
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="flex-row justify-center items-center mt-6">
          <Text className="text-gray-600">Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')}>
            <Text className="text-primary-600 font-semibold">Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
