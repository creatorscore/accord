import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { PaperProvider } from 'react-native-paper';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/contexts/AuthContext';
import { SubscriptionProvider } from '@/contexts/SubscriptionContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import '../global.css';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <AuthProvider>
          <SubscriptionProvider>
            <ProtectedRoute>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="(onboarding)" />
              </Stack>
            </ProtectedRoute>
            <StatusBar style="auto" />
          </SubscriptionProvider>
        </AuthProvider>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
