import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, useColorScheme } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { trackEvent } from '@/lib/analytics';

export default function WelcomeInfo() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [deleting, setDeleting] = useState(false);

  // Instrument the step-0 ghost cohort: 5k+ users sign up but never type a name.
  // Need to know whether they bounce on this screen or never reach it.
  useEffect(() => { trackEvent('welcome_info_viewed'); }, []);

  const handleProceed = async () => {
    trackEvent('welcome_info_proceed_tapped');
    // Clear any saved onboarding draft so basic-info starts at step 1 (name).
    // BOTH keys must be cleared:
    //   - 'onboarding_draft_basic-info' — legacy basic-info screen
    //   - 'accord-onboarding-draft' — zustand persist for the unified flow
    // 2026-05-28 real-device test showed that without the zustand key
    // clear, a user could sign out and sign up again and inherit the
    // previous account's lat/lng + city — bypassing the GPS-only
    // LocationStep entirely because store.latitude was already non-null
    // from the prior session. That's the exact location-faking vector
    // the autocomplete removal was meant to close.
    try { await AsyncStorage.removeItem('onboarding_draft_basic-info'); } catch {}
    try { await AsyncStorage.removeItem('accord-onboarding-draft'); } catch {}
    router.push('/(onboarding)/onboarding');
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
            trackEvent('welcome_info_delete_tapped');
            setDeleting(true);
            try {
              const { error } = await supabase.functions.invoke('delete-account', {
                body: { reason: 'not_target_audience', feedback: 'Opted out at welcome screen' },
              });
              if (error) {
                // The previous behavior signed the user out even on error,
                // which created ghost rows: row still present in DB, but the
                // user is signed out and can't retry (would have to sign up
                // again with the same email and hit the existing-account
                // branch). Keep the session alive so the user can retry.
                setDeleting(false);
                Alert.alert(
                  "Couldn't delete account",
                  error.message || 'Please check your connection and try again.',
                  [{ text: 'OK' }]
                );
                return;
              }
              await signOut();
            } catch (e: any) {
              setDeleting(false);
              Alert.alert(
                "Couldn't delete account",
                e?.message || 'Please check your connection and try again.',
                [{ text: 'OK' }]
              );
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{
      flex: 1,
      backgroundColor: isDark ? '#0A0A0B' : '#FFFFFF',
      paddingTop: insets.top,
      paddingBottom: insets.bottom,
      paddingHorizontal: 24,
      justifyContent: 'space-between',
    }}>

      {/* Top Section */}
      <View style={{ alignItems: 'center', marginTop: 32 }}>
        <View style={{
          width: 64, height: 64, borderRadius: 32,
          backgroundColor: isDark ? 'rgba(160, 138, 183, 0.15)' : '#F5F2F7',
          alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>
          <MaterialCommunityIcons name="heart-multiple" size={32} color="#A08AB7" />
        </View>

        <Text
          style={{ fontSize: 26, fontWeight: '800', color: isDark ? '#FFFFFF' : '#1A1A2E', textAlign: 'center' }}
          accessibilityRole="header"
        >
          Welcome to Accord
        </Text>
        <Text style={{ fontSize: 15, color: isDark ? 'rgba(255,255,255,0.5)' : '#71717A', textAlign: 'center', marginTop: 4 }}>
          A safe space for lavender marriages
        </Text>
      </View>

      {/* Middle Section */}
      <View style={{ gap: 16 }}>
        {/* What is it */}
        <View style={{
          backgroundColor: isDark ? 'rgba(160, 138, 183, 0.1)' : '#F8F7FA',
          borderRadius: 16, padding: 18,
          borderWidth: 1, borderColor: isDark ? 'rgba(160, 138, 183, 0.2)' : '#E8E3F0',
        }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: isDark ? '#FFFFFF' : '#1F2937', marginBottom: 8 }}>
            What is a Lavender Marriage?
          </Text>
          <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.8)' : '#4B5563', lineHeight: 21 }}>
            A marriage of convenience between LGBTQ+ individuals, providing legal, social, and financial benefits while allowing both partners to live authentically.
          </Text>
        </View>

        {/* Warning */}
        <View style={{
          backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2',
          borderRadius: 16, padding: 18,
          borderWidth: 1, borderColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FECACA',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="#EF4444" />
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#EF4444', marginLeft: 8 }}>
              Important
            </Text>
          </View>
          <Text style={{ fontSize: 14, color: isDark ? 'rgba(255,255,255,0.8)' : '#4B5563', lineHeight: 21 }}>
            This is <Text style={{ fontWeight: '700', color: isDark ? '#FFFFFF' : '#1F2937' }}>not a traditional dating app</Text>. It is for LGBTQ+ individuals seeking lavender marriages. If you are a heterosexual man looking for a conventional relationship, this app is not for you and your account will be restricted.
          </Text>
        </View>

        {/* Privacy */}
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
          <MaterialCommunityIcons name="shield-lock" size={18} color={isDark ? 'rgba(160,138,183,0.6)' : '#C4B5D9'} />
          <Text style={{ fontSize: 12, color: isDark ? 'rgba(255,255,255,0.4)' : '#9CA3AF', marginLeft: 8 }}>
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
          accessibilityRole="button"
          accessibilityLabel="I understand, continue to onboarding"
        >
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#FFFFFF' }}>
            I Understand, Continue
          </Text>
        </TouchableOpacity>

        {/* Prominent Delete is intentional: this screen is the audience
            filter. Users who realize Accord isn't a fit should have an
            obvious opt-out so their account is cleanly deleted rather
            than left as a ghost row. */}
        <TouchableOpacity
          onPress={handleDeleteAccount}
          disabled={deleting}
          style={{
            borderRadius: 16, paddingVertical: 14, alignItems: 'center',
            borderWidth: 1, borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FECACA',
          }}
          accessibilityRole="button"
          accessibilityLabel={deleting ? 'Deleting account' : "This isn't for me, delete account"}
          accessibilityState={{ disabled: deleting }}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: deleting ? 'rgba(239,68,68,0.5)' : '#EF4444' }}>
            {deleting ? 'Deleting...' : "This isn't for me — Delete Account"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
