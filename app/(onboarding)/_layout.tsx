import { Stack } from 'expo-router';
import { TouchableOpacity, Alert, Platform } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { supabase } from '@/lib/supabase';

function LogoutButton({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        marginLeft: 8,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: 20,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
      }}
    >
      <MaterialCommunityIcons name="logout" size={20} color="#A08AB7" />
    </TouchableOpacity>
  );
}

export default function OnboardingLayout() {
  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out? You\'ll need to start over.',
      [
        { text: 'Cancel', style: 'cancel' },
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

  // On Android, headerTransparent doesn't work well with touch events
  // So we use a non-transparent header but style it to look transparent
  const isAndroid = Platform.OS === 'android';

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerTransparent: !isAndroid,
        headerStyle: isAndroid ? {
          backgroundColor: 'transparent',
        } : undefined,
        headerShadowVisible: false,
        headerTitle: '',
        headerBackVisible: false,
        headerLeft: () => <LogoutButton onPress={handleSignOut} />,
        gestureEnabled: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: 'transparent' },
      }}
    />
  );
}
