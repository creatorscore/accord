import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await signIn(email, password);
      router.replace('/(tabs)/discover');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign in');
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
        Welcome Back
      </Text>
      <Text className="text-gray-600 mb-8">
        Sign in to continue to Accord
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
          className={`bg-primary-600 rounded-full py-4 items-center mt-4 ${
            loading ? 'opacity-50' : ''
          }`}
          onPress={handleSignIn}
          disabled={loading}
        >
          <Text className="text-white font-semibold text-lg">
            {loading ? 'Signing In...' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity className="items-center mt-4">
          <Text className="text-primary-600">Forgot password?</Text>
        </TouchableOpacity>

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
