import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const { sendPasswordResetEmail } = useAuth();

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(email);
      setEmailSent(true);
      setResendCooldown(60); // 60 second cooldown
    } catch (error: any) {
      console.error('Password reset error:', error);
      Alert.alert('Error', error.message || error?.error_description || 'Failed to send reset email');
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
      Alert.alert('Success', 'Password reset email sent again!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to resend email');
    } finally {
      setLoading(false);
    }
  };

  if (emailSent) {
    return (
      <View className="flex-1 bg-white px-6 pt-16">
        <TouchableOpacity onPress={() => router.back()} className="mb-8">
          <Text className="text-primary-500 text-lg">← Back</Text>
        </TouchableOpacity>

        <View className="items-center justify-center flex-1 -mt-20">
          <Text className="text-6xl mb-6">📧</Text>
          <Text className="text-2xl font-bold text-gray-900 mb-4 text-center">
            Check Your Email
          </Text>
          <Text className="text-gray-600 text-center mb-8 px-4">
            We've sent a password reset link to{'\n'}
            <Text className="font-semibold">{email}</Text>
          </Text>
          <Text className="text-gray-500 text-sm text-center px-8 mb-8">
            Click the link in the email to reset your password. The link will expire in 1 hour.
          </Text>

          <TouchableOpacity
            className={`border-2 border-primary-500 rounded-full py-3 px-8 mb-4 ${
              resendCooldown > 0 || loading ? 'opacity-50' : ''
            }`}
            onPress={handleResend}
            disabled={resendCooldown > 0 || loading}
          >
            <Text className="text-primary-500 font-semibold">
              {resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : loading
                  ? 'Sending...'
                  : 'Resend Email'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-primary-500 rounded-full py-3 px-8"
            onPress={() => router.push('/(auth)/sign-in')}
          >
            <Text className="text-white font-semibold">Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white px-6 pt-16">
      <TouchableOpacity onPress={() => router.back()} className="mb-8">
        <Text className="text-primary-500 text-lg">← Back</Text>
      </TouchableOpacity>

      <Text className="text-3xl font-bold text-gray-900 mb-2">
        Forgot Password?
      </Text>
      <Text className="text-gray-600 mb-8">
        Enter your email and we'll send you a link to reset your password
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
            autoFocus
          />
        </View>

        <TouchableOpacity
          className={`bg-primary-500 rounded-full py-4 items-center mt-4 ${
            loading ? 'opacity-50' : ''
          }`}
          onPress={handleResetPassword}
          disabled={loading}
        >
          <Text className="text-white font-semibold text-lg">
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Text>
        </TouchableOpacity>

        <View className="flex-row justify-center items-center mt-6">
          <Text className="text-gray-600">Remember your password? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')}>
            <Text className="text-primary-500 font-semibold">Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}
