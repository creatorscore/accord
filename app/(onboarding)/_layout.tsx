import { Stack } from 'expo-router';
import { TouchableOpacity, Alert, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function OnboardingLayout() {
  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You\'ll need to start over.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              router.replace('/(auth)/welcome');
            } catch (error) {
              console.error('Sign out error:', error);
            }
          },
        },
      ]
    );
  };

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: true,
        headerTitle: '',
        headerLeft: () => (
          <TouchableOpacity
            onPress={handleSignOut}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={{
              padding: 8,
              backgroundColor: 'rgba(255, 255, 255, 0.9)',
              borderRadius: 20,
              marginLeft: 8,
              elevation: Platform.OS === 'android' ? 5 : 0,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.25,
              shadowRadius: 3.84,
              zIndex: 1000,
            }}
          >
            <MaterialCommunityIcons name="logout" size={20} color="#9B87CE" />
          </TouchableOpacity>
        ),
        gestureEnabled: false, // Prevent back swipe
        animation: 'slide_from_right',
      }}
    />
  );
}
