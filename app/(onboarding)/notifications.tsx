import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Alert, StyleSheet, useColorScheme } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { supabase } from '@/lib/supabase';
import { goToPreviousOnboardingStep } from '@/lib/onboarding-navigation';
import { getGlobalStep } from '@/lib/onboarding-steps';
import { registerForPushNotifications, ensurePushTokenSaved } from '@/lib/notifications';
import { openAppSettings } from '@/lib/open-settings';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { usePreviewModeStore } from '@/stores/previewModeStore';

export default function Notifications() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuth();
  const { pushToken: contextPushToken, notificationsEnabled: contextNotificationsEnabled } = useNotifications();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const exitPreviewMode = usePreviewModeStore((s) => s.exitPreviewMode);

  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationToken, setNotificationToken] = useState<string | null>(null);

  useEffect(() => {
    if (contextPushToken) {
      setNotificationToken(contextPushToken);
      setNotificationsEnabled(true);
    }
  }, [contextPushToken]);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      if (data) setProfileId(data.id);
    } catch (error: any) {
      console.error('Error loading profile:', error);
    }
  };

  const handleEnableNotifications = async () => {
    try {
      const token = await registerForPushNotifications();
      if (token) {
        setNotificationToken(token);
        setNotificationsEnabled(true);
        Alert.alert(t('onboarding.notifications.enabled'), t('onboarding.notifications.enabledMsg'));
      } else {
        Alert.alert(t('onboarding.notifications.notAvailable'), t('onboarding.notifications.notAvailableMsg'));
      }
    } catch (error: any) {
      console.error('Error enabling notifications:', error);
      Alert.alert(
        t('onboarding.notifications.permissionDenied'),
        t('onboarding.notifications.permissionDeniedMsg'),
        [
          { text: t('common.notNow'), style: 'cancel' },
          { text: t('common.openSettings'), onPress: () => openAppSettings() },
        ]
      );
    }
  };

  const handleFinish = async () => {
    if (!profileId) {
      Alert.alert(t('common.error'), t('onboarding.common.profileNotFound'));
      return;
    }

    try {
      setLoading(true);

      const { data: photos, error: photosError } = await supabase
        .from('photos')
        .select('id')
        .eq('profile_id', profileId);

      if (photosError) throw photosError;

      if (!photos || photos.length < 2) {
        Alert.alert(
          t('onboarding.notifications.photosRequired'),
          t('onboarding.notifications.photosRequiredMsg'),
          [{ text: t('common.ok'), onPress: () => router.push('/(onboarding)/photos') }]
        );
        setLoading(false);
        return;
      }

      // Final validation gate — ensure all critical fields are populated
      const { data: profileData } = await supabase
        .from('profiles')
        .select('gender, sexual_orientation, latitude, longitude, display_name, age')
        .eq('id', profileId)
        .single();

      const { data: prefsData } = await supabase
        .from('preferences')
        .select('gender_preference, primary_reasons')
        .eq('profile_id', profileId)
        .single();

      const missing: string[] = [];
      if (!profileData?.gender || profileData.gender.length === 0) missing.push('gender');
      if (!profileData?.sexual_orientation || profileData.sexual_orientation.length === 0) missing.push('sexual orientation');
      if (profileData?.latitude == null || profileData?.longitude == null) missing.push('location');
      if (!profileData?.display_name) missing.push('name');
      if (!profileData?.age) missing.push('age');
      if (!prefsData?.gender_preference || prefsData.gender_preference.length === 0) missing.push('gender preference');

      if (missing.length > 0) {
        Alert.alert(
          t('common.error'),
          `Please complete your profile before continuing. Missing: ${missing.join(', ')}`,
          [{ text: t('common.ok'), onPress: () => router.push('/(onboarding)/basic-info') }]
        );
        setLoading(false);
        return;
      }

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          profile_complete: true,
          onboarding_step: 9,
        })
        .eq('id', profileId);

      if (profileError) throw profileError;

      if (user?.id) {
        try {
          let tokenToSave = notificationToken || contextPushToken;
          if (!tokenToSave) {
            tokenToSave = await registerForPushNotifications();
          }
          if (tokenToSave) {
            const saved = await ensurePushTokenSaved(user.id, tokenToSave);
            if (!saved) {
              console.warn('Push token save returned false - will retry via NotificationContext');
            }
          }
        } catch (pushError) {
          console.warn('Push notification save failed:', pushError);
        }
      }

      exitPreviewMode();
      router.replace('/(tabs)/discover');
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('onboarding.notifications.completeError'));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    goToPreviousOnboardingStep('/(onboarding)/notifications');
  };

  const isEnabled = notificationsEnabled || contextNotificationsEnabled;

  return (
    <OnboardingLayout
      currentStep={getGlobalStep('notifications', 0)}
      title={t('onboarding.notifications.title')}
      subtitle={t('onboarding.notifications.subtitle')}
      onBack={handleBack}
      onContinue={handleFinish}
      continueDisabled={loading}
      continueLabel={loading ? t('onboarding.notifications.finishing') : t('onboarding.notifications.startMatching')}
    >
      <View>
        <View style={[styles.notificationCard, {
          backgroundColor: isEnabled
            ? (isDark ? 'rgba(160,138,183,0.15)' : '#F5F3FF')
            : (isDark ? '#1C1C2E' : '#F8F7FA'),
        }]}>
          <View style={styles.notificationHeader}>
            <Text style={[styles.notificationTitle, { color: isDark ? '#F5F5F7' : '#1F2937' }]}>
              {t('onboarding.notifications.neverMissMatch')}
            </Text>
            {isEnabled && (
              <View style={styles.enabledBadge}>
                <Text style={styles.enabledBadgeText}>{t('onboarding.notifications.enabledBadge')}</Text>
              </View>
            )}
          </View>
          <Text style={[styles.notificationDesc, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            {t('onboarding.notifications.alertsDesc')}
          </Text>

          {!isEnabled ? (
            <TouchableOpacity style={styles.enableButton} onPress={handleEnableNotifications}>
              <Text style={styles.enableButtonText}>{t('onboarding.notifications.enableButton')}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.enabledRow}>
              <MaterialCommunityIcons name="check-circle" size={20} color="#A08AB7" />
              <Text style={[styles.enabledText, { color: isDark ? '#D4C4E8' : '#A08AB7' }]}>{t('onboarding.notifications.allSet')}</Text>
            </View>
          )}
        </View>

        <View style={[styles.successCard, { backgroundColor: isDark ? 'rgba(22,101,52,0.2)' : '#F0FDF4' }]}>
          <Text style={[styles.successTitle, { color: isDark ? '#86EFAC' : '#166534' }]}>{t('onboarding.notifications.almostThere')}</Text>
          <Text style={[styles.successDesc, { color: isDark ? '#BBF7D0' : '#15803D' }]}>
            {t('onboarding.notifications.almostThereDesc')}
          </Text>
        </View>
      </View>
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  notificationCard: {
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  notificationTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  enabledBadge: {
    backgroundColor: '#A08AB7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
  },
  enabledBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  notificationDesc: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  enableButton: {
    backgroundColor: '#A08AB7',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  enableButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  enabledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  enabledText: {
    fontSize: 15,
    fontWeight: '600',
  },
  successCard: {
    borderRadius: 16,
    padding: 20,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  successDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
});
