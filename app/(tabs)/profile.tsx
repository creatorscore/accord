import { View, Text } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';

export default function Profile() {
  const { user } = useAuth();

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-2xl font-bold text-gray-900 mb-4">Profile</Text>
      <Text className="text-gray-600">{user?.email}</Text>
      <Text className="text-gray-500 mt-4">Profile editing coming soon</Text>
    </View>
  );
}
