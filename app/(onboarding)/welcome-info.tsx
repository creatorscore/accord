import { useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function WelcomeInfo() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const [deleting, setDeleting] = useState(false);

  const handleProceed = async () => {
    // Clear any saved onboarding draft so basic-info starts at step 1 (name)
    try { await AsyncStorage.removeItem('onboarding_draft_basic-info'); } catch {}
    router.push('/(onboarding)/basic-info');
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await supabase.functions.invoke('delete-account', {
                body: { reason: 'not_target_audience', feedback: 'Opted out at welcome screen' },
              });
              await signOut();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete account. Contact hello@joinaccord.app');
              setDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0B', paddingTop: insets.top, paddingBottom: insets.bottom, paddingHorizontal: 24, justifyContent: 'space-between' }}>

      {/* Top Section */}
      <View style={{ alignItems: 'center', marginTop: 32 }}>
        <View style={{
          width: 64, height: 64, borderRadius: 32,
          backgroundColor: 'rgba(160, 138, 183, 0.15)',
          alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>
          <MaterialCommunityIcons name="heart-multiple" size={32} color="#A08AB7" />
        </View>

        <Text style={{ fontSize: 26, fontWeight: '800', color: '#FFFFFF', textAlign: 'center' }}>
          Welcome to Accord
        </Text>
        <Text style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginTop: 4 }}>
          A safe space for lavender marriages
        </Text>
      </View>

      {/* Middle Section */}
      <View style={{ gap: 16 }}>
        {/* What is it */}
        <View style={{
          backgroundColor: 'rgba(160, 138, 183, 0.1)', borderRadius: 16, padding: 18,
          borderWidth: 1, borderColor: 'rgba(160, 138, 183, 0.2)',
        }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginBottom: 8 }}>
            What is a Lavender Marriage?
          </Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 21 }}>
            A marriage of convenience between LGBTQ+ individuals, providing legal, social, and financial benefits while allowing both partners to live authentically.
          </Text>
        </View>

        {/* Warning */}
        <View style={{
          backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: 16, padding: 18,
          borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.15)',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="#EF4444" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#EF4444', marginLeft: 8 }}>
              Important
            </Text>
          </View>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', lineHeight: 21 }}>
            This is <Text style={{ fontWeight: '700', color: '#FFFFFF' }}>not a traditional dating app</Text>. It is for LGBTQ+ individuals seeking lavender marriages. If you are a heterosexual man looking for a conventional relationship, this app is not for you and your account will be restricted.
          </Text>
        </View>

        {/* Privacy */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
          <MaterialCommunityIcons name="shield-lock" size={18} color="rgba(160,138,183,0.6)" />
          <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginLeft: 8 }}>
            End-to-end encrypted. Your identity is never shared.
          </Text>
        </View>
      </View>

      {/* Bottom Buttons */}
      <View style={{ gap: 12, marginBottom: 16 }}>
        <TouchableOpacity
          onPress={handleProceed}
          style={{
            backgroundColor: '#A08AB7', borderRadius: 16, paddingVertical: 18, alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF' }}>
            I Understand, Continue
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleDeleteAccount}
          disabled={deleting}
          style={{
            borderRadius: 16, paddingVertical: 14, alignItems: 'center',
            borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)',
          }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: deleting ? 'rgba(239,68,68,0.5)' : '#EF4444' }}>
            {deleting ? 'Deleting...' : "This isn't for me — Delete Account"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
