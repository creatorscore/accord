import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Linking,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import { updateUserLocation } from '@/lib/geolocation';
import PremiumPaywall from '@/components/premium/PremiumPaywall';
import PhotoVerificationCard from '@/components/security/PhotoVerificationCard';

interface PrivacySettings {
  photo_blur_enabled: boolean;
  incognito_mode: boolean;
  hide_last_active: boolean;
  hide_distance: boolean;
}

export default function PrivacySettings() {
  const { user } = useAuth();
  const { isPremium, isPlatinum } = useSubscription();
  const { scrollTo } = useLocalSearchParams<{ scrollTo?: string }>();
  const scrollViewRef = useRef<ScrollView>(null);
  const [verificationSectionY, setVerificationSectionY] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [settings, setSettings] = useState<PrivacySettings>({
    photo_blur_enabled: false,
    incognito_mode: false,
    hide_last_active: false,
    hide_distance: false,
  });
  const [currentLocation, setCurrentLocation] = useState<string>('');

  useEffect(() => {
    loadSettings();
  }, []);

  // Scroll to verification section if requested via URL param
  useEffect(() => {
    if (scrollTo === 'verification' && verificationSectionY > 0 && !loading) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: verificationSectionY - 20, animated: true });
      }, 300);
    }
  }, [scrollTo, verificationSectionY, loading]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('photo_blur_enabled, incognito_mode, hide_last_active, hide_distance')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;

      if (data) {
        setSettings({
          photo_blur_enabled: data.photo_blur_enabled || false,
          incognito_mode: data.incognito_mode || false,
          hide_last_active: data.hide_last_active || false,
          hide_distance: data.hide_distance || false,
        });
      }
    } catch (error: any) {
      console.error('Error loading privacy settings:', error);
      Alert.alert('Error', 'Failed to load privacy settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof PrivacySettings, value: boolean) => {
    // CRITICAL: Gate incognito mode for premium/platinum users only
    if (key === 'incognito_mode' && value === true && !isPremium && !isPlatinum) {
      console.log('🚫 Incognito mode requires premium subscription');
      setShowPaywall(true);
      return;
    }

    console.log(`🔧 Updating ${key} to ${value} for user ${user?.id}`);
    const previousValue = settings[key];

    // Optimistically update UI
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaving(true);

    try {
      console.log(`📤 Sending update to database...`);
      const { data, error } = await supabase
        .from('profiles')
        .update({ [key]: value })
        .eq('user_id', user?.id)
        .select();

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      console.log('✅ Setting updated successfully:', data);
    } catch (error: any) {
      console.error('❌ Error updating privacy setting:', error);
      // Revert on error
      setSettings(prev => ({ ...prev, [key]: previousValue }));
      Alert.alert('Error', 'Failed to update privacy setting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateLocation = async () => {
    setUpdatingLocation(true);
    try {
      const location = await updateUserLocation();
      if (!location) {
        Alert.alert(
          'Permission Denied',
          'Location permission is required to update your location. You can enable it in your device settings.'
        );
        return;
      }

      // Check if location accuracy is too low (approximate location enabled)
      if (location.error === 'approximate_location') {
        Alert.alert(
          'Precise Location Required',
          `Location accuracy is too low (${Math.round(location.accuracy || 0)} meters). Please enable "Precise Location" for Accord in your iPhone Settings:\n\n1. Open Settings\n2. Scroll to Accord\n3. Tap Location\n4. Enable "Precise Location"\n\nThis ensures accurate distance calculations for matching.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Linking.openURL('app-settings:')
            }
          ]
        );
        return;
      }

      // Update profile in database
      const { error } = await supabase
        .from('profiles')
        .update({
          latitude: location.latitude,
          longitude: location.longitude,
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      // Update display with accuracy info
      setCurrentLocation(
        `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)} (±${Math.round(location.accuracy || 0)}m)`
      );

      Alert.alert(
        'Success',
        `Your location has been updated!\n\nAccuracy: ±${Math.round(location.accuracy || 0)} meters`
      );
    } catch (error: any) {
      console.error('Error updating location:', error);
      Alert.alert('Error', 'Failed to update location. Please try again.');
    } finally {
      setUpdatingLocation(false);
    }
  };

  const SettingRow = ({
    icon,
    title,
    description,
    value,
    onValueChange,
    premium,
    requiresPremium,
  }: {
    icon: string;
    title: string;
    description: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
    premium?: boolean;
    requiresPremium?: boolean;
  }) => {
    const isLocked = requiresPremium && !isPremium && !isPlatinum;

    return (
      <MotiView
        from={{ opacity: 0, translateY: 10 }}
        animate={{ opacity: 1, translateY: 0 }}
        transition={{ type: 'timing', duration: 300 }}
        style={styles.settingRow}
      >
        <View style={styles.settingIcon}>
          <MaterialCommunityIcons name={icon as any} size={24} color="#A08AB7" />
        </View>
        <View style={styles.settingContent}>
          <View style={styles.settingHeader}>
            <Text style={styles.settingTitle}>{title}</Text>
            {premium && (
              <View style={styles.premiumBadge}>
                <MaterialCommunityIcons name="crown" size={12} color="#FFD700" />
              </View>
            )}
          </View>
          <Text style={styles.settingDescription}>
            {description}
            {isLocked && ' Requires Premium.'}
          </Text>
        </View>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#D1D5DB', true: '#CDC2E5' }}
          thumbColor={value ? '#A08AB7' : '#F3F4F6'}
          disabled={saving || isLocked}
        />
      </MotiView>
    );
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Privacy Settings</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A08AB7" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView ref={scrollViewRef} style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Info Banner */}
      <MotiView
        from={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', delay: 100 }}
        style={styles.infoBanner}
      >
        <LinearGradient
          colors={['#EFF6FF', '#DBEAFE']}
          style={styles.infoBannerGradient}
        >
          <MaterialCommunityIcons name="shield-lock-outline" size={24} color="#3B82F6" />
          <View style={styles.infoBannerContent}>
            <Text style={styles.infoBannerTitle}>Your Privacy Matters</Text>
            <Text style={styles.infoBannerText}>
              Control how others see you on Accord. Changes take effect immediately.
            </Text>
          </View>
        </LinearGradient>
      </MotiView>

      {/* Profile Visibility */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Profile Visibility</Text>

        <SettingRow
          icon="image-off-outline"
          title="Photo Blur"
          description="Blur your photos until you match with someone"
          value={settings.photo_blur_enabled}
          onValueChange={(value) => updateSetting('photo_blur_enabled', value)}
        />

        <SettingRow
          icon="incognito"
          title="Incognito Mode"
          description="Hide your profile from discovery. Only matched users can see you."
          value={settings.incognito_mode}
          onValueChange={(value) => updateSetting('incognito_mode', value)}
          premium
          requiresPremium
        />
      </View>

      {/* Photo Verification */}
      <View
        style={styles.section}
        onLayout={(event) => setVerificationSectionY(event.nativeEvent.layout.y)}
      >
        <Text style={styles.sectionTitle}>Verification</Text>
        <View style={{ paddingHorizontal: 20 }}>
          <PhotoVerificationCard />
        </View>
      </View>

      {/* Activity Privacy */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity Privacy</Text>

        <SettingRow
          icon="clock-outline"
          title="Hide Last Active"
          description="Don't show when you were last active on Accord"
          value={settings.hide_last_active}
          onValueChange={(value) => updateSetting('hide_last_active', value)}
        />

        <SettingRow
          icon="map-marker-off-outline"
          title="Hide Distance"
          description='Show "nearby" instead of exact distance'
          value={settings.hide_distance}
          onValueChange={(value) => updateSetting('hide_distance', value)}
        />
      </View>

      {/* Location Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>

        <MotiView
          from={{ opacity: 0, translateY: 10 }}
          animate={{ opacity: 1, translateY: 0 }}
          transition={{ type: 'timing', duration: 300 }}
          style={styles.locationCard}
        >
          <View style={styles.locationHeader}>
            <View style={styles.settingIcon}>
              <MaterialCommunityIcons name="map-marker" size={24} color="#A08AB7" />
            </View>
            <View style={styles.locationContent}>
              <Text style={styles.settingTitle}>Update Location</Text>
              <Text style={styles.settingDescription}>
                Refresh your GPS coordinates to show accurate distance to matches
              </Text>
              {currentLocation && (
                <Text style={styles.currentLocationText}>
                  Current: {currentLocation}
                </Text>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.updateLocationButton,
              updatingLocation && styles.updateLocationButtonDisabled,
            ]}
            onPress={handleUpdateLocation}
            disabled={updatingLocation}
          >
            {updatingLocation ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name="crosshairs-gps"
                  size={18}
                  color="#fff"
                />
                <Text style={styles.updateLocationButtonText}>Update Now</Text>
              </>
            )}
          </TouchableOpacity>
        </MotiView>
      </View>

      {/* Privacy Tips */}
      <View style={styles.tipsSection}>
        <Text style={styles.tipsTitle}>Privacy Tips</Text>

        {[
          {
            icon: 'shield-check',
            text: 'All messages are end-to-end encrypted by default',
          },
          {
            icon: 'eye-off',
            text: 'Blocked users cannot see your profile or message you',
          },
          {
            icon: 'lock',
            text: 'Your real name and contact info are never shared',
          },
          {
            icon: 'delete',
            text: 'You can delete your account and data at any time',
          },
        ].map((tip, i) => (
          <View key={i} style={styles.tipRow}>
            <MaterialCommunityIcons name={tip.icon as any} size={20} color="#10B981" />
            <Text style={styles.tipText}>{tip.text}</Text>
          </View>
        ))}
      </View>

      {/* Legal Links */}
      <View style={styles.legalSection}>
        <TouchableOpacity
          style={styles.learnMoreButton}
          onPress={() => Linking.openURL('https://joinaccord.app/privacy')}
        >
          <MaterialCommunityIcons name="shield-lock-outline" size={20} color="#A08AB7" />
          <Text style={styles.learnMoreText}>Privacy Policy</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#D1D5DB" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.learnMoreButton}
          onPress={() => Linking.openURL('https://joinaccord.app/terms')}
        >
          <MaterialCommunityIcons name="file-document-outline" size={20} color="#A08AB7" />
          <Text style={styles.learnMoreText}>Terms of Service</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#D1D5DB" />
        </TouchableOpacity>
      </View>

      <View style={{ height: 40 }} />

      {/* Premium Paywall Modal */}
      {showPaywall && (
        <PremiumPaywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          feature="incognito"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSpacer: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 100,
  },
  loadingText: {
    fontSize: 16,
    color: '#6B7280',
  },
  infoBanner: {
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  infoBannerGradient: {
    flexDirection: 'row',
    padding: 20,
    gap: 16,
  },
  infoBannerContent: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E40AF',
    marginBottom: 4,
  },
  infoBannerText: {
    fontSize: 14,
    color: '#1E40AF',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 24,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  settingContent: {
    flex: 1,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  premiumBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  tipsSection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  tipsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  legalSection: {
    marginBottom: 8,
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    borderRadius: 16,
    gap: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  learnMoreText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#A08AB7',
  },
  locationCard: {
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  locationContent: {
    flex: 1,
  },
  currentLocationText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginTop: 8,
    fontFamily: 'monospace',
  },
  updateLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#A08AB7',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  updateLocationButtonDisabled: {
    backgroundColor: '#CDC2E5',
    opacity: 0.6,
  },
  updateLocationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
