import { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

export default function GoogleAuthCallback() {
  const params = useLocalSearchParams();

  useEffect(() => {
    // The OAuth flow is already handled by auth-providers.ts
    // This route just needs to exist to prevent the "unmatched route" error
    // After the session is set, redirect to root which will handle navigation

    console.log('Google auth callback params:', params);

    // Small delay to ensure auth state is updated
    const timer = setTimeout(() => {
      router.replace('/');
    }, 500);

    return () => clearTimeout(timer);
  }, [params]);

  return (
    <View className="flex-1 bg-cream items-center justify-center">
      <ActivityIndicator size="large" color="#9B87CE" />
      <Text className="text-gray-600 mt-4 text-lg">Completing sign in...</Text>
    </View>
  );
}
