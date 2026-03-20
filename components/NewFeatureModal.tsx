import { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, Dimensions } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSubscription } from '@/contexts/SubscriptionContext';

const { width } = Dimensions.get('window');
const STORAGE_KEY = 'new_feature_seen_who_viewed_me';

interface NewFeatureModalProps {
  onUpgrade: () => void;
}

export default function NewFeatureModal({ onUpgrade }: NewFeatureModalProps) {
  const [visible, setVisible] = useState(false);
  const { isPremium, isPlatinum } = useSubscription();

  useEffect(() => {
    checkIfShouldShow();
  }, []);

  const checkIfShouldShow = async () => {
    try {
      const seen = await AsyncStorage.getItem(STORAGE_KEY);
      if (!seen) {
        // Small delay so it doesn't compete with app loading
        setTimeout(() => setVisible(true), 2000);
      }
    } catch {}
  };

  const handleDismiss = async () => {
    setVisible(false);
    try { await AsyncStorage.setItem(STORAGE_KEY, 'true'); } catch {}
  };

  const handleUpgrade = async () => {
    setVisible(false);
    try { await AsyncStorage.setItem(STORAGE_KEY, 'true'); } catch {}
    onUpgrade();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
        <View style={{ width: width - 48, borderRadius: 24, overflow: 'hidden', backgroundColor: '#FFFFFF' }}>

          {/* Header gradient */}
          <LinearGradient
            colors={['#F59E0B', '#D97706']}
            style={{ paddingVertical: 32, alignItems: 'center' }}
          >
            <View style={{
              width: 72, height: 72, borderRadius: 36,
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignItems: 'center', justifyContent: 'center', marginBottom: 12,
            }}>
              <MaterialCommunityIcons name="eye" size={40} color="white" />
            </View>
            <Text style={{ fontSize: 24, fontWeight: '800', color: 'white' }}>
              New Feature!
            </Text>
          </LinearGradient>

          {/* Content */}
          <View style={{ padding: 24 }}>
            <Text style={{ fontSize: 20, fontWeight: '700', color: '#111827', textAlign: 'center', marginBottom: 8 }}>
              See Who Viewed You
            </Text>
            <Text style={{ fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              Now you can see exactly who's been checking out your profile. Know who's interested before you even swipe!
            </Text>

            {/* Feature highlights */}
            <View style={{ gap: 12, marginBottom: 24 }}>
              {[
                { icon: 'account-eye', text: 'See everyone who viewed your profile' },
                { icon: 'clock-outline', text: 'Know when they visited' },
                { icon: 'heart-outline', text: 'Discover potential matches before they swipe' },
              ].map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialCommunityIcons name={item.icon as any} size={20} color="#D97706" />
                  </View>
                  <Text style={{ fontSize: 14, color: '#374151', flex: 1 }}>{item.text}</Text>
                </View>
              ))}
            </View>

            {/* CTA */}
            {isPremium || isPlatinum ? (
              <TouchableOpacity
                onPress={handleDismiss}
                style={{
                  backgroundColor: '#A08AB7', borderRadius: 16, paddingVertical: 16, alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 17, fontWeight: '700', color: 'white' }}>Check It Out</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity
                  onPress={handleUpgrade}
                  style={{
                    backgroundColor: '#F59E0B', borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginBottom: 12,
                  }}
                >
                  <Text style={{ fontSize: 17, fontWeight: '700', color: 'white' }}>Upgrade to Premium</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleDismiss} style={{ paddingVertical: 8, alignItems: 'center' }}>
                  <Text style={{ fontSize: 14, color: '#9CA3AF' }}>Maybe Later</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
