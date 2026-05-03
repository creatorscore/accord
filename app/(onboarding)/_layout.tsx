import { Stack } from 'expo-router';
import { Platform } from 'react-native';

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="welcome-info" />
      <Stack.Screen name="onboarding" />
    </Stack>
  );
}
