import { View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';

export default function Discover() {
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/welcome');
  };

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-3xl font-bold text-gray-900 mb-4">
        Discover
      </Text>
      <Text className="text-gray-600 mb-8 text-center">
        Swipe interface coming soon!
      </Text>
      <Text className="text-gray-500 mb-8">
        Logged in as: {user?.email}
      </Text>
      <TouchableOpacity
        className="bg-primary-600 rounded-full py-3 px-8"
        onPress={handleSignOut}
      >
        <Text className="text-white font-semibold">Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
