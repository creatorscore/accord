import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  useColorScheme,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { clampProfileField } from '@/lib/geolocation';

// GPS-only location capture. Manual city autocomplete was removed
// 2026-05-28 because users were typing in fake cities to game the
// distance search (a user physically in country A could pick "New York"
// from the autocomplete and appear in NYC searches). Forcing GPS makes
// the stored lat/lng authoritative; AuthContext's foreground location
// refresh keeps it honest over time as well.
//
// If the user denies location permission or location services are off,
// they cannot proceed past this step. The fallback CTA opens the OS
// settings so they can grant permission and try again.

export default function LocationStep() {
  const locationCity = useOnboardingStore((s) => s.locationCity);
  const locationState = useOnboardingStore((s) => s.locationState);
  const latitude = useOnboardingStore((s) => s.latitude);
  const longitude = useOnboardingStore((s) => s.longitude);
  const setFields = useOnboardingStore((s) => s.setFields);
  const isDark = useColorScheme() === 'dark';
  const [loading, setLoading] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const busyRef = useRef(false);

  const hasLocation = latitude != null && longitude != null;
  const selectedValue = [locationCity, locationState].filter(Boolean).join(', ');

  const openSystemSettings = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:').catch(() => Linking.openSettings().catch(() => {}));
    } else {
      Linking.openSettings().catch(() => {});
    }
  };

  const handleGetLocation = async () => {
    const t0 = Date.now();
    console.log('[LocationStep] GPS pressed, busyRef:', busyRef.current, 'loading:', loading);
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setPermissionDenied(false);
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      console.log('[LocationStep] hasServicesEnabled:', enabled, '+', Date.now() - t0, 'ms');
      if (!enabled) {
        Alert.alert(
          'Location services off',
          'Turn on Location Services in your device settings to continue.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: openSystemSettings },
          ],
        );
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('[LocationStep] permission status:', status, '+', Date.now() - t0, 'ms');
      if (status !== 'granted') {
        setPermissionDenied(true);
        Alert.alert(
          'Location permission needed',
          "Accord uses your real location to find matches within 500 miles. Tap 'Open Settings' to grant location access.",
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: openSystemSettings },
          ],
        );
        return;
      }

      // Try the OS's last-known fix first — returns instantly when available
      // (typically <50ms). Avoids the multi-second cold GPS lock that
      // getCurrentPositionAsync triggers, especially on Android emulators
      // and devices that haven't requested a fix recently.
      let loc = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 }).catch(() => null);
      console.log('[LocationStep] last-known fix:', loc ? 'hit' : 'miss', '+', Date.now() - t0, 'ms');

      if (!loc) {
        // No cached fix — request a live one with Balanced accuracy and a
        // 10s timeout. Lowest can stall indefinitely on poor signal; Balanced
        // is faster and accurate enough for city/state matching.
        const livePromise = Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000));
        loc = await Promise.race([livePromise, timeoutPromise]).catch(() => null);
        console.log('[LocationStep] live fix:', loc ? 'got' : 'timeout/error', '+', Date.now() - t0, 'ms');
      }

      if (!loc) {
        Alert.alert(
          'Location unavailable',
          "We couldn't get your location. Make sure you have signal or Wi-Fi and try again.",
          [{ text: 'OK' }],
        );
        return;
      }

      const geoPromise = Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      const geoTimeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
      const geoResults = await Promise.race([geoPromise, geoTimeout]).catch(() => null);
      console.log('[LocationStep] reverse geocode:', geoResults ? 'got' : 'timeout/error', '+', Date.now() - t0, 'ms');
      const geo = Array.isArray(geoResults) ? geoResults[0] : null;

      // Clamp to the profiles column widths before these reach the store —
      // the checkpoint save writes them verbatim, and an over-long localized
      // region name (varchar(50)) hard-blocked users at this step with a raw
      // Postgres 22001 toast and no way forward (Sentry REACT-8N).
      const city = clampProfileField('location_city', geo?.city || geo?.district) || '';
      const state = clampProfileField('location_state', geo?.region) || '';
      setFields({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        locationCity: city,
        locationState: state,
        locationCountry: clampProfileField('location_country', geo?.isoCountryCode) || 'US',
      });
    } catch (error: any) {
      console.log('[LocationStep] GPS error:', error?.message, '+', Date.now() - t0, 'ms');
      Alert.alert(
        'Location unavailable',
        "We couldn't detect your location. Make sure location services are on and try again.",
        [{ text: 'OK' }],
      );
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Why-we-need-this explainer — sets expectation that this is
          enforced and not a soft prompt. */}
      <View style={[styles.explainerCard, {
        backgroundColor: isDark ? 'rgba(160, 138, 183, 0.08)' : '#F5F2F7',
        borderColor: isDark ? 'rgba(160, 138, 183, 0.2)' : '#E8E3F0',
      }]}>
        <MaterialCommunityIcons name="shield-lock-outline" size={18} color="#A08AB7" style={{ marginTop: 2 }} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.explainerText, { color: isDark ? '#D4C4E8' : '#5B4575' }]}>
            We use your real location to find matches within 500 miles. Premium members can also search globally and add preferred cities.
          </Text>
        </View>
      </View>

      {/* GPS button */}
      <Button
        mode="contained-tonal"
        onPress={handleGetLocation}
        loading={loading}
        disabled={loading}
        icon={loading ? undefined : 'crosshairs-gps'}
        buttonColor={isDark ? '#2C2C3E' : '#F5F2F7'}
        textColor={isDark ? '#D4C4E8' : '#8B72A8'}
        contentStyle={styles.buttonContent}
        labelStyle={styles.buttonLabel}
        style={styles.gpsButton}
      >
        {loading ? 'Finding location...' : hasLocation ? 'Update my location' : 'Use my current location'}
      </Button>

      {/* Selected location confirmation */}
      {hasLocation && (
        <View style={[styles.selectedCard, { backgroundColor: isDark ? '#1A2A1A' : '#F0F9F0' }]}>
          <MaterialCommunityIcons name="map-marker-check" size={20} color="#4CAF50" />
          <Text style={[styles.selectedText, { color: isDark ? '#81C784' : '#2E7D32' }]}>
            {selectedValue || `${latitude?.toFixed(3)}, ${longitude?.toFixed(3)}`}
          </Text>
        </View>
      )}

      {/* Permission denied fallback */}
      {permissionDenied && !hasLocation && (
        <View style={[styles.permissionCard, {
          backgroundColor: isDark ? '#2D1A1A' : '#FDF0F0',
          borderColor: isDark ? 'rgba(217, 83, 79, 0.3)' : '#F5C6C6',
        }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <MaterialCommunityIcons name="lock-alert-outline" size={18} color="#D9534F" />
            <Text style={[styles.permissionTitle, { color: isDark ? '#F5A5A5' : '#A03030' }]}>
              Location access needed
            </Text>
          </View>
          <Text style={[styles.permissionBody, { color: isDark ? '#F5A5A5' : '#A03030' }]}>
            Accord can't continue without location access. Open your device settings, grant location to Accord, then return and tap the button above.
          </Text>
          <TouchableOpacity onPress={openSystemSettings} style={{ alignSelf: 'flex-start', marginTop: 8 }}>
            <Text style={{ color: '#A08AB7', fontWeight: '700', fontSize: 14 }}>Open device settings</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
  },
  explainerCard: {
    flexDirection: 'row',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 18,
  },
  explainerText: {
    fontSize: 13,
    lineHeight: 18,
  },
  gpsButton: {
    borderRadius: 16,
  },
  buttonContent: {
    paddingVertical: 10,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  selectedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
  },
  selectedText: {
    fontSize: 15,
    fontWeight: '600',
  },
  permissionCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  permissionTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  permissionBody: {
    fontSize: 13,
    lineHeight: 18,
  },
});
