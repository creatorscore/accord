import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function Welcome() {
  return (
    <View className="flex-1 bg-primary-500 px-6 justify-center">
      <StatusBar style="light" />

      <View className="items-center mb-12">
        <Text className="text-white text-5xl font-bold mb-4">Accord</Text>
        <Text className="text-white/90 text-xl text-center">
          Find Your Perfect Match for a Lavender Marriage
        </Text>
      </View>

      <View className="space-y-4">
        <TouchableOpacity
          className="bg-white rounded-full py-4 px-8 items-center"
          onPress={() => router.push('/(auth)/sign-up')}
        >
          <Text className="text-primary-600 font-semibold text-lg">
            Get Started
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="border-2 border-white rounded-full py-4 px-8 items-center"
          onPress={() => router.push('/(auth)/sign-in')}
        >
          <Text className="text-white font-semibold text-lg">
            Sign In
          </Text>
        </TouchableOpacity>
      </View>

      <Text className="text-white/70 text-center text-sm mt-8">
        Safe, Verified, and Discreet Connections
      </Text>
    </View>
  );
}
