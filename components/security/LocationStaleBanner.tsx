import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Platform, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
// When the user dismisses the banner, snooze it for this long instead of
// re-nagging on every app launch. It re-appears after the snooze only if the
// location is still stale (i.e. they never re-granted / refreshed GPS).
const SNOOZE_DAYS = 7;
const SNOOZE_KEY = 'location_stale_banner_snoozed_until';

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
        .select('last_active_at, last_gps_at, created_at')
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

      // Staleness gate. A NULL last_gps_at must NOT be treated as infinitely
      // stale: a brand-new user who just granted GPS at signup hasn't had a
      // last_gps_at recorded yet (the field is populated by the foreground
      // location refresh, which may not have run/landed yet), and nagging them
      // to "verify your location" seconds after onboarding is nonsense. Cap the
      // effective GPS age at the account age — a reading can't be staler than
      // the account is old — so we only flag genuinely-stale profiles (legacy
      // users older than the threshold who never recorded a fresh GPS read).
      const createdMs = profile.created_at ? new Date(profile.created_at).getTime() : now;
      const accountAgeDays = (now - createdMs) / (1000 * 60 * 60 * 24);
      const lastGpsMs = profile.last_gps_at ? new Date(profile.last_gps_at).getTime() : 0;
      const gpsAgeDays = lastGpsMs === 0
        ? accountAgeDays
        : (now - lastGpsMs) / (1000 * 60 * 60 * 24);
      if (gpsAgeDays < STALE_THRESHOLD_DAYS) return;

      // Respect a prior dismissal — don't re-nag on every launch. The banner
      // returns after the snooze window only if location is still stale.
      const snoozedUntil = await AsyncStorage.getItem(SNOOZE_KEY).catch(() => null);
      if (cancelled) return;
      if (snoozedUntil && Date.now() < Number(snoozedUntil)) return;

      setShouldShow(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  if (!shouldShow) return null;

  const openLocationSettings = () => {
    // iOS app-settings: deep-links straight to Accord's permission page.
    // Android only exposes Linking.openSettings which lands on the app
    // info screen — close enough; the user taps Permissions → Location.
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:').catch(() => Linking.openSettings().catch(() => {}));
    } else {
      Linking.openSettings().catch(() => {});
    }
  };

  // Tapping the banner used to dump the user straight into the OS settings app
  // with no explanation of what to change — they'd land on a screen where
  // location often already looked "on" and not know what we needed. Show a
  // short, platform-specific instruction first, then take them to Settings.
  const handlePress = () => {
    Alert.alert(
      t('subscription.locationStaleTitle', 'Verify your location'),
      Platform.OS === 'ios'
        ? t(
            'subscription.locationStaleHowToIOS',
            'Open Settings › Location and set Accord to "While Using the App", with Precise Location turned on. Then come back and reopen Accord.'
          )
        : t(
            'subscription.locationStaleHowToAndroid',
            'Open Settings › Permissions › Location and allow location access for Accord. Then come back and reopen Accord.'
          ),
      [
        { text: t('common.cancel', 'Cancel'), style: 'cancel' },
        { text: t('subscription.openSettings', 'Open Settings'), onPress: openLocationSettings },
      ]
    );
  };

  const handleDismiss = async () => {
    setShouldShow(false);
    try {
      await AsyncStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_DAYS * 24 * 60 * 60 * 1000));
    } catch {
      // Best-effort; worst case the banner reappears next launch (still stale).
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
          colors={['#A08AB7', '#B8A9DD']}
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

            {/* Dismiss — nested touchable captures the press, so tapping the X
                snoozes the banner without also firing the row's open-settings
                handler. */}
            <TouchableOpacity
              onPress={handleDismiss}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.dismiss', 'Dismiss')}
              style={{ padding: 2, marginTop: 2 }}
            >
              <MaterialCommunityIcons
                name="close"
                size={20}
                color="rgba(255, 255, 255, 0.9)"
              />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </MotiView>
  );
}
