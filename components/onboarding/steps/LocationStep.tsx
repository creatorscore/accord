import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, useColorScheme, Alert, ActivityIndicator } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useOnboardingStore } from '@/stores/onboardingStore';

export default function LocationStep() {
  const { locationCity, locationState } = useOnboardingStore();
  const setFields = useOnboardingStore((s) => s.setFields);
  const isDark = useColorScheme() === 'dark';
  const [loading, setLoading] = useState(false);

  const handleGetLocation = async () => {
    setLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location Required', 'Please enable location access to find people near you.');
        setLoading(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const [geo] = await Location.reverseGeocodeAsync({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });

      setFields({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        locationCity: geo?.city || '',
        locationState: geo?.region || '',
        locationCountry: geo?.isoCountryCode || 'US',
      });
    } catch (error: any) {
      Alert.alert('Error', 'Could not get your location. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const hasLocation = !!(locationCity || locationState);

  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, { backgroundColor: isDark ? '#2C2C3E' : '#F5F2F7' }]}>
        <MaterialCommunityIcons name="map-marker-outline" size={48} color="#A08AB7" />
      </View>

      {hasLocation ? (
        <View style={styles.locationDisplay}>
          <Text style={[styles.locationText, { color: isDark ? '#F5F5F7' : '#1F2937' }]}>
            {[locationCity, locationState].filter(Boolean).join(', ')}
          </Text>
          <TouchableOpacity onPress={handleGetLocation} style={styles.changeLink}>
            <Text style={styles.changeLinkText}>Update location</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={handleGetLocation}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#FFFFFF" />
          )}
          <Text style={styles.buttonText}>
            {loading ? 'Finding location...' : 'Use my current location'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 8 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#A08AB7', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 50 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  locationDisplay: { alignItems: 'center', gap: 8 },
  locationText: { fontSize: 22, fontWeight: '700' },
  changeLink: { paddingVertical: 4 },
  changeLinkText: { color: '#A08AB7', fontSize: 15, fontWeight: '600' },
});
