import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  useColorScheme,
  Alert,
  Keyboard,
} from 'react-native';
import { Button } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { supabase } from '@/lib/supabase';
import citiesData from '@/assets/data/cities';

type CityTuple = readonly [string, string, string];

interface City {
  name: string;
  country: string;
  admin1: string;
}

function formatCity(city: City): string {
  if (city.country === 'US' || city.country === 'CA') {
    return `${city.name}, ${city.admin1}`;
  }
  return `${city.name}, ${city.country}`;
}

function searchCities(text: string): City[] {
  if (text.length < 2) return [];
  const lower = text.toLowerCase();
  const startsWith: City[] = [];
  const contains: City[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < citiesData.length; i++) {
    if (startsWith.length >= 20 && contains.length >= 5) break;
    const t = citiesData[i] as CityTuple;
    const nameLower = t[0].toLowerCase();
    const regionLower = t[2].toLowerCase();
    const fullLower = `${nameLower}, ${regionLower}`;
    const key = `${t[0]}|${t[2]}|${t[1]}`;
    if (seen.has(key)) continue;

    if (nameLower.startsWith(lower) || fullLower.startsWith(lower)) {
      if (startsWith.length < 20) {
        seen.add(key);
        startsWith.push({ name: t[0], country: t[1], admin1: t[2] });
      }
    } else if (contains.length < 5 && (nameLower.includes(lower) || regionLower.includes(lower))) {
      seen.add(key);
      contains.push({ name: t[0], country: t[1], admin1: t[2] });
    }
  }
  return [...startsWith, ...contains].slice(0, 12);
}

async function geocodeCity(city: City): Promise<{ lat: number; lng: number } | null> {
  const formatted = formatCity(city);
  try {
    const results = await Location.geocodeAsync(formatted);
    const first = results?.[0];
    if (first && typeof first.latitude === 'number' && typeof first.longitude === 'number') {
      return { lat: first.latitude, lng: first.longitude };
    }
  } catch {
    // device geocoder unavailable — fall through to server fallback
  }
  try {
    const { data, error } = await supabase.functions.invoke('geocode-city', {
      body: { city: city.name, state: city.admin1, country: city.country },
    });
    if (!error && data && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
      return { lat: data.latitude, lng: data.longitude };
    }
  } catch {
    // server geocoding also failed
  }
  return null;
}

type GeocodingState = 'idle' | 'pending' | 'done' | 'failed';

export default function LocationStep() {
  const locationCity = useOnboardingStore((s) => s.locationCity);
  const locationState = useOnboardingStore((s) => s.locationState);
  const latitude = useOnboardingStore((s) => s.latitude);
  const longitude = useOnboardingStore((s) => s.longitude);
  const setFields = useOnboardingStore((s) => s.setFields);
  const isDark = useColorScheme() === 'dark';
  const [loading, setLoading] = useState(false);
  const busyRef = useRef(false);

  // The selected display value (only set when GPS or dropdown selection happens)
  const selectedValue = [locationCity, locationState].filter(Boolean).join(', ');

  // Search query (independent of store — only commits on selection)
  const [query, setQuery] = useState(selectedValue);
  const [results, setResults] = useState<City[]>([]);
  const [showResults, setShowResults] = useState(false);
  // Geocoding state — gates Continue via parent's isStepValid (which reads
  // store.latitude/longitude). If a returning user already has coords in
  // store, treat as 'done'; otherwise idle until a selection triggers it.
  const [geocodingState, setGeocodingState] = useState<GeocodingState>(
    latitude != null && longitude != null ? 'done' : 'idle'
  );
  const [lastSelectedCity, setLastSelectedCity] = useState<City | null>(null);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<NodeJS.Timeout>(null);

  const doSearch = useCallback((text: string) => {
    const matched = searchCities(text);
    setResults(matched);
    setShowResults(matched.length > 0);
  }, []);

  const handleChangeText = (text: string) => {
    setQuery(text);
    // Don't update store — only update on selection
    if (text.length === 0) {
      // Clear location if input cleared (including lat/lng — they're now stale)
      setFields({ locationCity: '', locationState: '', latitude: null, longitude: null });
      setGeocodingState('idle');
      setLastSelectedCity(null);
      setShowResults(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(text), 150);
  };

  const runGeocode = useCallback(async (city: City) => {
    setGeocodingState('pending');
    // Clear any stale coords from a previous selection so isStepValid stays
    // false until the new geocode lands. This is what gates the Continue
    // button — without this, a user who picks city A then quickly changes
    // to city B could advance with A's coords still in the store.
    setFields({ latitude: null, longitude: null });
    const coords = await geocodeCity(city);
    if (coords) {
      setFields({ latitude: coords.lat, longitude: coords.lng });
      setGeocodingState('done');
    } else {
      setGeocodingState('failed');
    }
  }, [setFields]);

  const handleSelectCity = async (city: City) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setQuery(formatCity(city));
    setShowResults(false);
    Keyboard.dismiss();
    setLastSelectedCity(city);
    setFields({
      locationCity: city.name,
      locationState: city.admin1,
      locationCountry: city.country,
    });
    await runGeocode(city);
  };

  const handleRetryGeocode = async () => {
    if (!lastSelectedCity) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await runGeocode(lastSelectedCity);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    setFields({ locationCity: '', locationState: '', latitude: null, longitude: null });
    setGeocodingState('idle');
    setLastSelectedCity(null);
    inputRef.current?.focus();
  };

  const handleGetLocation = async () => {
    const t0 = Date.now();
    console.log('[LocationStep] GPS pressed, busyRef:', busyRef.current, 'loading:', loading);
    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    try {
      const enabled = await Location.hasServicesEnabledAsync();
      console.log('[LocationStep] hasServicesEnabled:', enabled, '+', Date.now() - t0, 'ms');
      if (!enabled) {
        Alert.alert(
          'Location services off',
          'Turn on location services in your device settings, or search for your city below.',
        );
        return;
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log('[LocationStep] permission status:', status, '+', Date.now() - t0, 'ms');
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'You can search for your city below instead.');
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
          "We couldn't get your location quickly. Please search for your city below.",
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

      const city = geo?.city || geo?.district || '';
      const state = geo?.region || '';
      setFields({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        locationCity: city,
        locationState: state,
        locationCountry: geo?.isoCountryCode || 'US',
      });
      setQuery([city, state].filter(Boolean).join(', '));
      setShowResults(false);
      // GPS path always yields coords directly — mark done so isStepValid passes
      setGeocodingState('done');
      setLastSelectedCity(null);
    } catch (error: any) {
      console.log('[LocationStep] GPS error:', error?.message, '+', Date.now() - t0, 'ms');
      Alert.alert(
        'Location unavailable',
        "We couldn't detect your location automatically. Please search for your city below.",
      );
    } finally {
      busyRef.current = false;
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
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
        {loading ? 'Finding location...' : selectedValue ? 'Update location' : 'Use my current location'}
      </Button>

      {/* Divider */}
      <View style={styles.dividerRow}>
        <View style={[styles.dividerLine, { backgroundColor: isDark ? '#374151' : '#E4E4E7' }]} />
        <Text style={[styles.dividerText, { color: isDark ? '#6B7280' : '#A1A1AA' }]}>or search for your city</Text>
        <View style={[styles.dividerLine, { backgroundColor: isDark ? '#374151' : '#E4E4E7' }]} />
      </View>

      {/* Search input with inline autocomplete */}
      <View style={styles.searchContainer}>
        <View style={[styles.inputRow, {
          borderColor: showResults ? '#A08AB7' : (isDark ? '#374151' : '#E4E4E7'),
          backgroundColor: isDark ? '#1A1A2D' : '#FAFAFA',
          borderBottomLeftRadius: showResults ? 0 : 14,
          borderBottomRightRadius: showResults ? 0 : 14,
        }]}>
          <MaterialCommunityIcons
            name="magnify"
            size={22}
            color={isDark ? '#6B7280' : '#9CA3AF'}
          />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: isDark ? '#F5F5F7' : '#1F2937' }]}
            placeholder="Search for your city..."
            placeholderTextColor={isDark ? '#6B7280' : '#A1A1AA'}
            value={query}
            onChangeText={handleChangeText}
            onFocus={() => { if (query.length >= 2) doSearch(query); }}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={100}
            returnKeyType="done"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <MaterialCommunityIcons
                name="close-circle"
                size={20}
                color={isDark ? '#6B7280' : '#9CA3AF'}
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Dropdown attached directly to input */}
        {showResults && (
          <View style={[styles.dropdown, {
            backgroundColor: isDark ? '#1A1A2D' : '#FFFFFF',
            borderColor: showResults ? '#A08AB7' : (isDark ? '#2C2C3E' : '#E8E3F0'),
          }]}>
            <ScrollView
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
              style={styles.resultsList}
            >
              {results.map((item, i) => (
                <TouchableOpacity
                  key={`${item.name}-${item.admin1}-${item.country}-${i}`}
                  style={[styles.resultItem, {
                    borderBottomColor: isDark ? '#2C2C3E' : '#F3F4F6',
                  }]}
                  onPress={() => handleSelectCity(item)}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="map-marker"
                    size={18}
                    color="#A08AB7"
                  />
                  <Text style={[styles.cityName, { color: isDark ? '#F5F5F7' : '#1F2937' }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.regionName, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                    {item.country === 'US' || item.country === 'CA' ? item.admin1 : item.country}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Selected location confirmation */}
      {selectedValue && !showResults && geocodingState === 'done' && (
        <View style={[styles.selectedCard, { backgroundColor: isDark ? '#1A2A1A' : '#F0F9F0' }]}>
          <MaterialCommunityIcons name="map-marker-check" size={20} color="#4CAF50" />
          <Text style={[styles.selectedText, { color: isDark ? '#81C784' : '#2E7D32' }]}>
            {selectedValue}
          </Text>
        </View>
      )}

      {selectedValue && !showResults && geocodingState === 'pending' && (
        <View style={[styles.selectedCard, { backgroundColor: isDark ? '#1A1A2D' : '#F5F2F7' }]}>
          <MaterialCommunityIcons name="map-marker" size={20} color="#A08AB7" />
          <Text style={[styles.selectedText, { color: isDark ? '#D4C4E8' : '#8B72A8' }]}>
            Pinning {selectedValue} on the map…
          </Text>
        </View>
      )}

      {selectedValue && !showResults && geocodingState === 'failed' && (
        <View style={[styles.selectedCard, { backgroundColor: isDark ? '#2D1A1A' : '#FDF0F0', flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MaterialCommunityIcons name="map-marker-alert" size={20} color="#D9534F" />
            <Text style={[styles.selectedText, { color: isDark ? '#F5A5A5' : '#A03030', flex: 1 }]}>
              We couldn't pin this city. Try another spelling, a nearby city, or use GPS.
            </Text>
          </View>
          <TouchableOpacity onPress={handleRetryGeocode} style={{ paddingVertical: 6, alignSelf: 'flex-start' }}>
            <Text style={{ color: '#A08AB7', fontWeight: '600', fontSize: 14 }}>Retry</Text>
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
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: '500',
  },
  searchContainer: {
    zIndex: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
    paddingVertical: 16,
  },
  clearButton: {
    padding: 4,
  },
  dropdown: {
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
    overflow: 'hidden',
  },
  resultsList: {
    maxHeight: 260,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '600',
  },
  regionName: {
    fontSize: 14,
    fontWeight: '500',
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
});
