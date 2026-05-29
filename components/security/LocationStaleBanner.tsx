import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Linking } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// LocationStaleBanner — shown when the profile is active but GPS hasn't
// been read recently, signal that the user revoked location permission
// after onboarding. AuthContext.refreshLocation runs on foreground but
// silently bails when permission is denied; without a banner there's
// no in-app feedback that anything is amiss, and the user keeps
// appearing in matches at their original (possibly stale or faked)
// location.
//
// Threshold: active in last 7 days AND last GPS read either NULL or
// older than 30 days. The 7-day active gate prevents pestering dormant
// users; the 30-day GPS gate matches a sensible "we expected a fresh
// reading by now" cadence (vs. e.g. 7 days which would catch users
// just opening the app on a flight without GPS lock).
//
// Tap → open system settings so the user can re-grant location. The
// banner re-evaluates on next mount; once GPS reads succeed
// (AuthContext writes last_gps_at), the staleness window closes and
// the banner disappears on its own.

const ACTIVE_WINDOW_DAYS = 7;
const STALE_THRESHOLD_DAYS = 30;

export default function LocationStaleBanner() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) return;

    (async () => {
      const { data: profile } = await supabase
        .from('profiles')
        .select('last_active_at, last_gps_at')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled || !profile) return;

      const now = Date.now();
      // Active gate — don't poke dormant users; if they come back the
      // refresh will run anyway and either succeed (closing the gate)
      // or fail with denied permission (re-firing the banner).
      const lastActiveMs = profile.last_active_at ? new Date(profile.last_active_at).getTime() : 0;
      const inactiveDays = (now - lastActiveMs) / (1000 * 60 * 60 * 24);
      if (inactiveDays > ACTIVE_WINDOW_DAYS) return;

      // Staleness gate. NULL counts as stale (legacy profiles or users
      // who only ever set location via the now-removed autocomplete).
      const lastGpsMs = profile.last_gps_at ? new Date(profile.last_gps_at).getTime() : 0;
      const gpsAgeDays = lastGpsMs === 0
        ? Infinity
        : (now - lastGpsMs) / (1000 * 60 * 60 * 24);
      if (gpsAgeDays < STALE_THRESHOLD_DAYS) return;

      setShouldShow(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!shouldShow) return null;

  const handlePress = () => {
    // iOS app-settings: deep-links straight to Accord's permission page.
    // Android only exposes Linking.openSettings which lands on the app
    // info screen — close enough; the user taps Permissions → Location.
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:').catch(() => Linking.openSettings().catch(() => {}));
    } else {
      Linking.openSettings().catch(() => {});
    }
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: -20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'spring', delay: 300 }}
      style={{ marginHorizontal: 16, marginVertical: 8 }}
    >
      <TouchableOpacity onPress={handlePress} activeOpacity={0.8}>
        <LinearGradient
          colors={['#3B82F6', '#2563EB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ borderRadius: 16, padding: 16 }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MaterialCommunityIcons name="map-marker-question-outline" size={22} color="white" />
            </View>

            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                {t('subscription.locationStaleTitle', 'Verify your location')}
              </Text>
              <Text
                style={{
                  color: 'rgba(255, 255, 255, 0.9)',
                  fontSize: 13,
                  lineHeight: 18,
                  marginTop: 4,
                }}
              >
                {t(
                  'subscription.locationStaleBody',
                  "We haven't seen a location update in a while. Grant location access to keep your matches accurate."
                )}
              </Text>

              <View
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.25)',
                  borderRadius: 8,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  marginTop: 10,
                  alignSelf: 'flex-start',
                }}
              >
                <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 14 }}>
                  {t('subscription.openSettings', 'Open Settings')}
                </Text>
              </View>
            </View>

            <MaterialCommunityIcons
              name="chevron-right"
              size={24}
              color="rgba(255, 255, 255, 0.8)"
              style={{ marginTop: 8 }}
            />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </MotiView>
  );
}
