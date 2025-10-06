import { View, Text } from 'react-native';

export default function Matches() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-gray-900">Matches</Text>
      <Text className="text-gray-600 mt-2">Your matches will appear here</Text>
    </View>
  );
}
