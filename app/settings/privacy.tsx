import { useState, useEffect, useRef, useCallback } from 'react';
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
  TextInput,
  Keyboard,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import { updateUserLocation } from '@/lib/geolocation';
import { openAppSettings } from '@/lib/open-settings';
import { searchCities, CityResult } from '@/lib/city-search';
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
  const [cityQuery, setCityQuery] = useState('');
  const [cityResults, setCityResults] = useState<CityResult[]>([]);
  const [showCitySearch, setShowCitySearch] = useState(false);
  const [savingCity, setSavingCity] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        .select('photo_blur_enabled, incognito_mode, hide_last_active, hide_distance, location_city, location_state, latitude, longitude')
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

        // Show existing location
        if (data.location_city || data.location_state) {
          const parts = [data.location_city, data.location_state].filter(Boolean);
          setCurrentLocation(parts.join(', '));
        } else if (data.latitude && data.longitude) {
          setCurrentLocation(`${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`);
        }
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
      setShowPaywall(true);
      return;
    }

    const previousValue = settings[key];

    // Optimistically update UI
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaving(true);

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({ [key]: value })
        .eq('user_id', user?.id)
        .select('photo_blur_enabled, incognito_mode, hide_last_active, hide_distance')
        .single();

      if (error) {
        console.error('❌ Database error:', error);
        throw error;
      }

      // Verify the write actually took effect
      if (data && (data as Record<string, boolean>)[key] !== value) {
        throw new Error('Setting was not saved correctly');
      }

    } catch (error: any) {
      console.error('❌ Error updating privacy setting:', error);
      // Revert on error
      setSettings(prev => ({ ...prev, [key]: previousValue }));
      if (error?.code === 'P0001' && error?.message?.includes('Premium')) {
        setShowPaywall(true);
      } else {
        Alert.alert('Error', 'Failed to update privacy setting. Please try again.');
      }
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
              onPress: () => openAppSettings()
            }
          ]
        );
        return;
      }

      // Update profile in database (include city/state if available)
      const updateData: any = {
        latitude: location.latitude,
        longitude: location.longitude,
      };
      if (location.city) updateData.location_city = location.city;
      if (location.state) updateData.location_state = location.state;

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('user_id', user?.id);

      if (error) throw error;

      // Update display with city/state or coordinates
      if (location.city || location.state) {
        const parts = [location.city, location.state].filter(Boolean);
        setCurrentLocation(parts.join(', '));
      } else {
        setCurrentLocation(`${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`);
      }

      Alert.alert(
        'Success',
        location.city
          ? `Location updated to ${location.city}${location.state ? ', ' + location.state : ''}`
          : `Your location has been updated!`
      );
    } catch (error: any) {
      console.error('Error updating location:', error);
      Alert.alert('Error', 'Failed to update location. Please try again.');
    } finally {
      setUpdatingLocation(false);
    }
  };

  const handleCitySearch = useCallback((query: string) => {
    setCityQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (query.length < 2) {
      setCityResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      const results = searchCities(query, 8);
      setCityResults(results);
    }, 150);
  }, []);

  const handleSelectCity = async (city: CityResult) => {
    Keyboard.dismiss();
    setSavingCity(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          location_city: city.city,
          location_state: city.state,
          location_country: city.countryCode,
          latitude: city.latitude,
          longitude: city.longitude,
        })
        .eq('user_id', user?.id);

      if (error) throw error;

      setCurrentLocation(city.displayName);
      setCityQuery('');
      setCityResults([]);
      setShowCitySearch(false);

      Alert.alert('Success', `Location updated to ${city.displayName}`);
    } catch (error: any) {
      console.error('Error setting city location:', error);
      Alert.alert('Error', 'Failed to update location. Please try again.');
    } finally {
      setSavingCity(false);
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
          onValueChange={(v) => { Haptics.selectionAsync(); onValueChange(v); }}
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
          title="Hide Exact Distance"
          description="Show city/country only, hide precise distance from others"
          value={settings.hide_distance}
          onValueChange={(value) => updateSetting('hide_distance', value)}
        />

        {/* Privacy Info when distance is hidden */}
        {settings.hide_distance && (
          <View style={styles.warningCard}>
            <MaterialCommunityIcons name="information" size={20} color="#F97316" />
            <Text style={styles.warningText}>
              Others will see your city/country but not your exact distance. You can still filter matches by distance.
            </Text>
          </View>
        )}
      </View>

      {/* Location Settings - always show */}
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
                Use GPS or search for your city to set your location
              </Text>
              {currentLocation && (
                <Text style={styles.currentLocationText}>
                  Current: {currentLocation}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.locationButtonsRow}>
            <TouchableOpacity
              style={[
                styles.updateLocationButton,
                { flex: 1 },
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
                  <Text style={styles.updateLocationButtonText}>Use GPS</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.searchCityButton,
                showCitySearch && styles.searchCityButtonActive,
              ]}
              onPress={() => {
                setShowCitySearch(!showCitySearch);
                if (showCitySearch) {
                  setCityQuery('');
                  setCityResults([]);
                }
              }}
            >
              <MaterialCommunityIcons
                name="magnify"
                size={18}
                color={showCitySearch ? '#fff' : '#A08AB7'}
              />
              <Text style={[
                styles.searchCityButtonText,
                showCitySearch && { color: '#fff' },
              ]}>
                Search City
              </Text>
            </TouchableOpacity>
          </View>

          {showCitySearch && (
            <View style={styles.citySearchContainer}>
              <TextInput
                style={styles.citySearchInput}
                placeholder="Search city or country..."
                placeholderTextColor="#9CA3AF"
                value={cityQuery}
                onChangeText={handleCitySearch}
                autoFocus
              />
              {savingCity && (
                <ActivityIndicator size="small" color="#A08AB7" style={{ marginTop: 8 }} />
              )}
              {cityResults.length > 0 && (
                <View style={styles.cityResultsList}>
                  {cityResults.map((result, index) => (
                    <TouchableOpacity
                      key={`${result.city}-${result.state}-${result.countryCode}-${index}`}
                      style={[
                        styles.cityResultItem,
                        index < cityResults.length - 1 && styles.cityResultBorder,
                      ]}
                      onPress={() => handleSelectCity(result)}
                    >
                      <MaterialCommunityIcons name="map-marker-outline" size={18} color="#A08AB7" />
                      <Text style={styles.cityResultText} numberOfLines={1}>
                        {result.displayName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {cityQuery.length >= 2 && cityResults.length === 0 && !savingCity && (
                <Text style={styles.noResultsText}>No cities found</Text>
              )}
            </View>
          )}
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
          onPress={() => Linking.openURL('https://joinaccord.app/privacy').catch(() => {})}
        >
          <MaterialCommunityIcons name="shield-lock-outline" size={20} color="#A08AB7" />
          <Text style={styles.learnMoreText}>Privacy Policy</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color="#D1D5DB" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.learnMoreButton}
          onPress={() => Linking.openURL('https://joinaccord.app/terms').catch(() => {})}
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
  locationButtonsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  searchCityButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3E8FF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  searchCityButtonActive: {
    backgroundColor: '#A08AB7',
  },
  searchCityButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#A08AB7',
  },
  citySearchContainer: {
    marginTop: 12,
  },
  citySearchInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    color: '#111827',
  },
  cityResultsList: {
    marginTop: 8,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
  },
  cityResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  cityResultBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  cityResultText: {
    flex: 1,
    fontSize: 15,
    color: '#374151',
  },
  noResultsText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 12,
  },
  warningCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF7ED',
    borderWidth: 1,
    borderColor: '#FDBA74',
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 20,
    marginTop: 8,
    gap: 12,
    alignItems: 'flex-start',
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: '#9A3412',
    lineHeight: 18,
  },
});
