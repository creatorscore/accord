import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Check if profile is complete
        // For now, redirect to tabs
        router.replace('/(tabs)/discover');
      } else {
        router.replace('/(auth)/welcome');
      }
    }
  }, [user, loading]);

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <ActivityIndicator size="large" color="#8B5CF6" />
    </View>
  );
}
