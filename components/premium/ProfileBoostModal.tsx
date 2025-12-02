import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MotiView } from 'moti';
import { supabase } from '@/lib/supabase';

interface ProfileBoostModalProps {
  visible: boolean;
  onClose: () => void;
  profileId: string;
  isPlatinum: boolean;
  onUpgrade: () => void;
}

export default function ProfileBoostModal({
  visible,
  onClose,
  profileId,
  isPlatinum,
  onUpgrade,
}: ProfileBoostModalProps) {
  const [loading, setLoading] = useState(false);
  const [hasActiveBoost, setHasActiveBoost] = useState(false);
  const [boostExpiresAt, setBoostExpiresAt] = useState<Date | null>(null);
  const [lastBoostAt, setLastBoostAt] = useState<Date | null>(null);
  const [canBoostAgain, setCanBoostAgain] = useState(true);

  useEffect(() => {
    if (visible && profileId) {
      checkBoostStatus();
    }
  }, [visible, profileId]);

  const checkBoostStatus = async () => {
    try {
      // Check for active boosts
      const { data: activeBoosts } = await supabase
        .from('boosts')
        .select('expires_at')
        .eq('profile_id', profileId)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: false })
        .limit(1);

      if (activeBoosts && activeBoosts.length > 0) {
        setHasActiveBoost(true);
        setBoostExpiresAt(new Date(activeBoosts[0].expires_at));
      } else {
        setHasActiveBoost(false);
        setBoostExpiresAt(null);
      }

      // Check last boost time (Platinum: weekly limit)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('last_boost_at')
        .eq('id', profileId)
        .single();

      if (profileData?.last_boost_at) {
        const lastBoost = new Date(profileData.last_boost_at);
        setLastBoostAt(lastBoost);

        // Check if 7 days have passed (weekly limit for Platinum)
        const daysSinceLastBoost = Math.floor(
          (new Date().getTime() - lastBoost.getTime()) / (1000 * 60 * 60 * 24)
        );
        setCanBoostAgain(daysSinceLastBoost >= 7);
      } else {
        setLastBoostAt(null);
        setCanBoostAgain(true);
      }
    } catch (error) {
      console.error('Error checking boost status:', error);
    }
  };

  const handleActivateBoost = async () => {
    // Check if user is Platinum
    if (!isPlatinum) {
      Alert.alert(
        '👑 Upgrade to Platinum',
        'Profile Boost is a Platinum-exclusive feature! Upgrade to get a weekly 30-minute visibility boost.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: onUpgrade },
        ]
      );
      return;
    }

    // Check if already boosted
    if (hasActiveBoost) {
      Alert.alert('Already Boosted', 'You already have an active boost running!');
      return;
    }

    // Check weekly limit
    if (!canBoostAgain && lastBoostAt) {
      const nextBoostDate = new Date(lastBoostAt.getTime() + 7 * 24 * 60 * 60 * 1000);
      Alert.alert(
        'Weekly Limit Reached',
        `You can activate your next boost on ${nextBoostDate.toLocaleDateString()}.`,
        [{ text: 'OK' }]
      );
      return;
    }

    try {
      setLoading(true);

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now

      // Create boost record
      const { error: boostError } = await supabase.from('boosts').insert({
        profile_id: profileId,
        boost_type: 'standard',
        duration_minutes: 30,
        started_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        is_active: true,
      });

      if (boostError) throw boostError;

      // Update profile boost tracking
      const { data: profileData } = await supabase
        .from('profiles')
        .select('boost_count')
        .eq('id', profileId)
        .single();

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          last_boost_at: now.toISOString(),
          boost_count: (profileData?.boost_count || 0) + 1,
        })
        .eq('id', profileId);

      if (updateError) throw updateError;

      // Update UI state
      setHasActiveBoost(true);
      setBoostExpiresAt(expiresAt);
      setLastBoostAt(now);
      setCanBoostAgain(false);

      Alert.alert(
        '🚀 Boost Activated!',
        'Your profile will be shown to more people for the next 30 minutes!',
        [{ text: 'Great!', onPress: onClose }]
      );
    } catch (error: any) {
      console.error('Error activating boost:', error);
      Alert.alert('Error', 'Failed to activate boost. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getTimeRemaining = () => {
    if (!boostExpiresAt) return '';
    const now = new Date();
    const diff = boostExpiresAt.getTime() - now.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" transparent>
      <BlurView intensity={40} tint="dark" style={styles.container}>
        <View style={styles.modalContent}>
          <LinearGradient colors={['#FFD700', '#FFA500']} style={styles.header}>
            {/* Close Button */}
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color="#1F2937" />
            </TouchableOpacity>

            {/* Header Content */}
            <MotiView
              from={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: 'timing', duration: 500 }}
              style={styles.headerContent}
            >
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="rocket" size={60} color="white" />
              </View>
              <Text style={styles.title}>Profile Boost</Text>
              <Text style={styles.subtitle}>Get 10x more visibility for 30 minutes</Text>
            </MotiView>
          </LinearGradient>

          <View style={styles.content}>
            {/* Features */}
            <View style={styles.featuresContainer}>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="eye" size={24} color="#A08AB7" />
                <Text style={styles.featureText}>10x more profile views</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="chart-line" size={24} color="#A08AB7" />
                <Text style={styles.featureText}>Appear at the top of discovery</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="clock-outline" size={24} color="#A08AB7" />
                <Text style={styles.featureText}>Lasts for 30 minutes</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="calendar-week" size={24} color="#A08AB7" />
                <Text style={styles.featureText}>Available once per week</Text>
              </View>
            </View>

            {/* Status */}
            {hasActiveBoost && (
              <View style={styles.activeBoostContainer}>
                <MaterialCommunityIcons name="check-circle" size={24} color="#10B981" />
                <Text style={styles.activeBoostText}>
                  Boost Active - {getTimeRemaining()} remaining
                </Text>
              </View>
            )}

            {!canBoostAgain && !hasActiveBoost && lastBoostAt && (
              <View style={styles.cooldownContainer}>
                <MaterialCommunityIcons name="clock-alert" size={24} color="#F59E0B" />
                <Text style={styles.cooldownText}>
                  Next boost available on{' '}
                  {new Date(lastBoostAt.getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                </Text>
              </View>
            )}

            {!isPlatinum && (
              <View style={styles.upgradePrompt}>
                <MaterialCommunityIcons name="crown" size={24} color="#FFD700" />
                <Text style={styles.upgradeText}>
                  Upgrade to Platinum to unlock Profile Boost
                </Text>
              </View>
            )}

            {/* Action Button */}
            <TouchableOpacity
              style={[
                styles.actionButton,
                (hasActiveBoost || (!canBoostAgain && isPlatinum)) && styles.actionButtonDisabled,
              ]}
              onPress={isPlatinum ? handleActivateBoost : onUpgrade}
              disabled={loading || (hasActiveBoost || (!canBoostAgain && isPlatinum))}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="white" />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={isPlatinum ? 'rocket-launch' : 'crown'}
                    size={24}
                    color="white"
                  />
                  <Text style={styles.actionButtonText}>
                    {isPlatinum
                      ? hasActiveBoost
                        ? 'Boost Active'
                        : !canBoostAgain
                        ? 'Boost Used This Week'
                        : 'Activate Boost'
                      : 'Upgrade to Platinum'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    maxHeight: '85%',
  },
  header: {
    paddingTop: 40,
    paddingBottom: 32,
    paddingHorizontal: 24,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContent: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
  },
  content: {
    padding: 24,
  },
  featuresContainer: {
    gap: 16,
    marginBottom: 24,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  activeBoostContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#D1FAE5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  activeBoostText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#065F46',
    flex: 1,
  },
  cooldownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  cooldownText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#92400E',
    flex: 1,
  },
  upgradePrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  upgradeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  actionButton: {
    backgroundColor: '#A08AB7',
    paddingVertical: 18,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  actionButtonDisabled: {
    backgroundColor: '#D1D5DB',
  },
  actionButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
});
