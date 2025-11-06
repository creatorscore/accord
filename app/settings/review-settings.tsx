import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';

interface ReviewSettings {
  reviews_enabled: boolean;
  auto_disabled_by_location: boolean;
  disabled_reason: string | null;
  show_aggregate_publicly: boolean;
  show_detailed_after_match: boolean;
  minimum_reviews_threshold: number;
  allow_new_reviews: boolean;
}

export default function ReviewSettingsScreen() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [settings, setSettings] = useState<ReviewSettings>({
    reviews_enabled: true,
    auto_disabled_by_location: false,
    disabled_reason: null,
    show_aggregate_publicly: true,
    show_detailed_after_match: true,
    minimum_reviews_threshold: 5,
    allow_new_reviews: true,
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (!profile) return;

      setProfileId(profile.id);

      // Get review settings
      const { data: settingsData, error } = await supabase
        .from('profile_review_settings')
        .select('*')
        .eq('profile_id', profile.id)
        .single();

      if (error) {
        console.error('Error fetching settings:', error);
        return;
      }

      if (settingsData) {
        setSettings(settingsData);
      }
    } catch (error) {
      console.error('Error in fetchSettings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof ReviewSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (!profileId) {
        throw new Error('Profile ID not found');
      }

      // Update settings
      const { error } = await supabase
        .from('profile_review_settings')
        .update(settings)
        .eq('profile_id', profileId);

      if (error) {
        throw error;
      }

      // Also update profile show_reviews field for quick access
      await supabase
        .from('profiles')
        .update({ show_reviews: settings.reviews_enabled })
        .eq('id', profileId);

      Alert.alert(t('common.success'), t('reviews.settingsSaved'));
    } catch (error: any) {
      console.error('Error saving settings:', error);
      Alert.alert(t('common.error'), error.message || t('reviews.saveError'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#9B87CE" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={28} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('reviews.reviewSettings')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Auto-disabled Warning */}
        {settings.auto_disabled_by_location && (
          <MotiView
            from={{ opacity: 0, translateY: -10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'spring' }}
            style={styles.warningBanner}
          >
            <MaterialCommunityIcons name="shield-alert" size={24} color="#DC2626" />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>{t('reviews.autoDisabledTitle')}</Text>
              <Text style={styles.warningText}>
                {settings.disabled_reason || t('reviews.autoDisabledDesc')}
              </Text>
            </View>
          </MotiView>
        )}

        {/* Master Toggle */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('reviews.visibility')}</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons name="eye" size={20} color="#9B87CE" />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>{t('reviews.enableReviews')}</Text>
                  <Text style={styles.settingDescription}>
                    {t('reviews.enableReviewsDesc')}
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.reviews_enabled}
                onValueChange={() => handleToggle('reviews_enabled')}
                trackColor={{ false: '#D1D5DB', true: '#C4B5FD' }}
                thumbColor={settings.reviews_enabled ? '#9B87CE' : '#F3F4F6'}
                disabled={settings.auto_disabled_by_location}
              />
            </View>
          </View>
        </View>

        {/* Public Visibility */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('reviews.publicVisibility')}</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons name="earth" size={20} color="#3B82F6" />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>
                    {t('reviews.showAggregatePublicly')}
                  </Text>
                  <Text style={styles.settingDescription}>
                    {t('reviews.showAggregatePubliclyDesc')}
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.show_aggregate_publicly}
                onValueChange={() => handleToggle('show_aggregate_publicly')}
                trackColor={{ false: '#D1D5DB', true: '#BFDBFE' }}
                thumbColor={settings.show_aggregate_publicly ? '#3B82F6' : '#F3F4F6'}
                disabled={!settings.reviews_enabled}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons name="lock-open" size={20} color="#10B981" />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>
                    {t('reviews.showDetailedAfterMatch')}
                  </Text>
                  <Text style={styles.settingDescription}>
                    {t('reviews.showDetailedAfterMatchDesc')}
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.show_detailed_after_match}
                onValueChange={() => handleToggle('show_detailed_after_match')}
                trackColor={{ false: '#D1D5DB', true: '#A7F3D0' }}
                thumbColor={settings.show_detailed_after_match ? '#10B981' : '#F3F4F6'}
                disabled={!settings.reviews_enabled}
              />
            </View>
          </View>
        </View>

        {/* Privacy Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('reviews.privacy')}</Text>

          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={styles.iconContainer}>
                  <MaterialCommunityIcons name="account-lock" size={20} color="#F59E0B" />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={styles.settingLabel}>
                    {t('reviews.allowNewReviews')}
                  </Text>
                  <Text style={styles.settingDescription}>
                    {t('reviews.allowNewReviewsDesc')}
                  </Text>
                </View>
              </View>
              <Switch
                value={settings.allow_new_reviews}
                onValueChange={() => handleToggle('allow_new_reviews')}
                trackColor={{ false: '#D1D5DB', true: '#FCD34D' }}
                thumbColor={settings.allow_new_reviews ? '#F59E0B' : '#F3F4F6'}
                disabled={!settings.reviews_enabled}
              />
            </View>
          </View>
        </View>

        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <MaterialCommunityIcons name="information-outline" size={20} color="#6B7280" />
          <Text style={styles.infoText}>{t('reviews.settingsInfo')}</Text>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <LinearGradient colors={['#9B87CE', '#9B87CE']} style={styles.saveGradient}>
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <MaterialCommunityIcons name="content-save" size={20} color="#FFF" />
                <Text style={styles.saveButtonText}>{t('common.save')}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  content: {
    flex: 1,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#FEE2E2',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
  },
  warningContent: {
    flex: 1,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#991B1B',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 13,
    color: '#991B1B',
    lineHeight: 18,
  },
  section: {
    marginTop: 24,
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
  settingCard: {
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    borderRadius: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    marginRight: 16,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F9FAFB',
    padding: 16,
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  saveButton: {
    marginHorizontal: 20,
    marginTop: 24,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#9B87CE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
