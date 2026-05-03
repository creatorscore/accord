import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { supabase } from '@/lib/supabase';
import { useProfileData } from '@/contexts/ProfileDataContext';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const GENDER_OPTIONS = ['Man', 'Woman', 'Non-binary'] as const;

export default function GenderConfirmationModal() {
  const { profileId } = useProfileData();
  const [visible, setVisible] = useState(false);
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profileId) checkIfNeeded();
  }, [profileId]);

  const checkIfNeeded = async () => {
    if (!profileId) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('gender_needs_confirmation, gender')
        .eq('id', profileId)
        .single();

      if (data?.gender_needs_confirmation) {
        const currentGender = Array.isArray(data.gender) ? data.gender[0] : data.gender;
        setSelectedGender(currentGender || 'Non-binary');
        setVisible(true);
      }
    } catch (err) {
      console.error('Error checking gender confirmation:', err);
    }
  };

  const handleConfirm = async () => {
    if (!profileId || !selectedGender || saving) return;
    setSaving(true);
    try {
      await supabase
        .from('profiles')
        .update({
          gender: [selectedGender],
          gender_needs_confirmation: false,
        })
        .eq('id', profileId);
      setVisible(false);
    } catch (err) {
      console.error('Error confirming gender:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleDismiss = async () => {
    if (!profileId) return;
    try {
      await supabase
        .from('profiles')
        .update({ gender_needs_confirmation: false })
        .eq('id', profileId);
    } catch (err) {
      console.error('Error dismissing gender confirmation:', err);
    }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleDismiss}>
      <View style={styles.overlay}>
        <Animated.View entering={FadeInUp.duration(400).springify()} style={styles.container}>
          <LinearGradient
            colors={['#A08AB7', '#B8A9DD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="account-edit-outline" size={40} color="#FFF" />
            </View>
            <Text style={styles.title}>Confirm Your Identity</Text>
            <Text style={styles.subtitle}>
              We've simplified gender options. Please confirm how you'd like to appear.
            </Text>
          </LinearGradient>

          <View style={styles.body}>
            <Text style={styles.label}>I identify as:</Text>
            <View style={styles.chipContainer}>
              {GENDER_OPTIONS.map((g) => (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, selectedGender === g && styles.chipSelected]}
                  onPress={() => setSelectedGender(g)}
                >
                  <Text style={[styles.chipText, selectedGender === g && styles.chipTextSelected]}>
                    {g}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.confirmButton, saving && { opacity: 0.6 }]}
              onPress={handleConfirm}
              disabled={saving}
              activeOpacity={0.8}
            >
              <Text style={styles.confirmButtonText}>
                {saving ? 'Saving...' : 'Confirm'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 380,
    overflow: 'hidden',
  },
  header: {
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    lineHeight: 20,
  },
  body: {
    padding: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 16,
  },
  chipContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  chip: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  chipSelected: {
    backgroundColor: '#A08AB7',
    borderColor: '#A08AB7',
  },
  chipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
  },
  chipTextSelected: {
    color: '#FFF',
  },
  footer: {
    padding: 20,
    paddingTop: 0,
  },
  confirmButton: {
    backgroundColor: '#A08AB7',
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
