import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, Platform } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { signInWithGoogle, signInWithApple, isAppleAuthAvailable } from '@/lib/auth-providers';
import { supabase } from '@/lib/supabase';

export default function SignUp() {
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
        alert('Please fill in all fields');
      } else {
        Alert.alert('Error', 'Please fill in all fields');
      }
      return;
    }

    if (password !== confirmPassword) {
      if (Platform.OS === 'web') {
        alert('Passwords do not match');
      } else {
        Alert.alert('Error', 'Passwords do not match');
      }
      return;
    }

    if (password.length < 8) {
      if (Platform.OS === 'web') {
        alert('Password must be at least 8 characters');
      } else {
        Alert.alert('Error', 'Password must be at least 8 characters');
      }
      return;
    }

    setLoading(true);
    try {
      console.log('Calling signUp with:', email);
      const result = await signUp(email, password);
      console.log('Sign up result:', result);

      // Check if email confirmation is required
      if (result.user && !result.session) {
        // Email verification required - show success message
        console.log('Email confirmation required for:', email);
        setUserEmail(email);
        setShowVerificationMessage(true);
      } else if (result.session) {
        // Direct sign in successful (email confirmation disabled)
        console.log('Direct sign in successful');
        setTimeout(() => {
          router.replace('/(onboarding)/basic-info');
        }, 500);
      } else if (result.user) {
        // User created but no session - try to sign in
        console.log('User created, attempting sign in...');
        try {
          await signIn(email, password);
          router.replace('/(onboarding)/basic-info');
        } catch (signInError) {
          // Email confirmation is likely required
          setUserEmail(email);
          setShowVerificationMessage(true);
        }
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      if (Platform.OS === 'web') {
        alert(error.message || 'Failed to sign up');
      } else {
        Alert.alert('Error', error.message || 'Failed to sign up');
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
        // Wait for auth state to update
        setTimeout(() => {
          router.replace('/(onboarding)/basic-info');
        }, 500);
      } else {
        Alert.alert('Error', 'Google sign-in was cancelled or failed');
      }
    } catch (error: any) {
      if (error.message !== 'User cancelled') {
        Alert.alert('Error', error.message || 'Failed to sign up with Google');
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
        router.replace('/(onboarding)/basic-info');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to sign up with Apple');
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
            Check Your Email!
          </Text>
          <Text className="text-gray-600 text-lg text-center mb-2">
            We've sent a confirmation email to:
          </Text>
          <Text className="text-primary-600 font-semibold text-lg mb-6">
            {userEmail}
          </Text>
          <Text className="text-gray-600 text-center mb-8 px-4">
            Please click the link in the email to verify your account and continue setting up your profile.
          </Text>

          <TouchableOpacity
            className="bg-primary-600 rounded-full py-4 px-8 mb-4"
            onPress={() => router.replace('/(auth)/sign-in')}
          >
            <Text className="text-white font-bold text-lg">
              Go to Sign In
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowVerificationMessage(false)}
          >
            <Text className="text-primary-600 font-semibold">
              Use Different Email
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
                Alert.alert('Success', 'Verification email resent!');
              } catch (error) {
                Alert.alert('Error', 'Could not resend email. Please try again.');
              }
            }}
          >
            <Text className="text-gray-500 underline">
              Resend verification email
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-cream px-6 pt-16">
      <TouchableOpacity onPress={() => router.back()} className="mb-8">
        <Text className="text-primary-600 text-lg font-semibold">← Back</Text>
      </TouchableOpacity>

      <Text className="text-4xl font-bold text-charcoal mb-2">
        Let's do this! ✨
      </Text>
      <Text className="text-gray-600 text-lg mb-8">
        Your perfect arrangement awaits
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
          className={`bg-primary-600 rounded-full py-4 items-center mt-4 shadow-lg ${
            loading ? 'opacity-50' : ''
          }`}
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text className="text-white font-bold text-lg">
            {loading ? 'Creating Account...' : 'Create Account'}
          </Text>
        </TouchableOpacity>

        <Text className="text-gray-500 text-xs text-center mt-4">
          By creating an account, you agree to our{' '}
          <Text className="text-primary-600">Terms of Service</Text> and{' '}
          <Text className="text-primary-600">Privacy Policy</Text>
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
