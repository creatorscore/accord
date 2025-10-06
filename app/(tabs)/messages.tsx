import { View, Text } from 'react-native';

export default function Messages() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-gray-900">Messages</Text>
      <Text className="text-gray-600 mt-2">Your conversations will appear here</Text>
    </View>
  );
}
