import { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, StyleSheet, TextInput } from 'react-native';
import { router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

// Common countries list with ISO codes
const COUNTRIES = [
  { code: 'AF', name: 'Afghanistan' },
  { code: 'AL', name: 'Albania' },
  { code: 'DZ', name: 'Algeria' },
  { code: 'AR', name: 'Argentina' },
  { code: 'AU', name: 'Australia' },
  { code: 'AT', name: 'Austria' },
  { code: 'BD', name: 'Bangladesh' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BR', name: 'Brazil' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'CA', name: 'Canada' },
  { code: 'CL', name: 'Chile' },
  { code: 'CN', name: 'China' },
  { code: 'CO', name: 'Colombia' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EG', name: 'Egypt' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'HK', name: 'Hong Kong' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IN', name: 'India' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'IR', name: 'Iran' },
  { code: 'IQ', name: 'Iraq' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IL', name: 'Israel' },
  { code: 'IT', name: 'Italy' },
  { code: 'JP', name: 'Japan' },
  { code: 'JO', name: 'Jordan' },
  { code: 'KE', name: 'Kenya' },
  { code: 'KR', name: 'South Korea' },
  { code: 'KW', name: 'Kuwait' },
  { code: 'LB', name: 'Lebanon' },
  { code: 'MY', name: 'Malaysia' },
  { code: 'MX', name: 'Mexico' },
  { code: 'MA', name: 'Morocco' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NZ', name: 'New Zealand' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'NO', name: 'Norway' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'PE', name: 'Peru' },
  { code: 'PH', name: 'Philippines' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'QA', name: 'Qatar' },
  { code: 'RO', name: 'Romania' },
  { code: 'RU', name: 'Russia' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'CH', name: 'Switzerland' },
  { code: 'TW', name: 'Taiwan' },
  { code: 'TH', name: 'Thailand' },
  { code: 'TR', name: 'Turkey' },
  { code: 'UA', name: 'Ukraine' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'US', name: 'United States' },
  { code: 'VN', name: 'Vietnam' },
];

interface BlockedCountry {
  id: string;
  country_code: string;
  country_name: string;
}

export default function CountryBlocking() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blockedCountries, setBlockedCountries] = useState<BlockedCountry[]>([]);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load current profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (profileData) {
        setCurrentProfileId(profileData.id);

        // Load blocked countries
        const { data: blocksData } = await supabase
          .from('country_blocks')
          .select('id, country_code, country_name')
          .eq('profile_id', profileData.id);

        setBlockedCountries(blocksData || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addCountryBlock = async (country: { code: string; name: string }) => {
    if (!currentProfileId) return;

    // Check if already blocked
    if (blockedCountries.some(b => b.country_code === country.code)) {
      Alert.alert('Already Blocked', `${country.name} is already in your blocked list.`);
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('country_blocks')
        .insert({
          profile_id: currentProfileId,
          country_code: country.code,
          country_name: country.name,
        })
        .select()
        .single();

      if (error) throw error;

      setBlockedCountries([...blockedCountries, data]);
      setShowCountryPicker(false);
      setSearchQuery('');

      Alert.alert(
        'Country Blocked',
        `Your profile will no longer be shown to users in ${country.name}.`
      );
    } catch (error: any) {
      console.error('Error blocking country:', error);
      Alert.alert('Error', 'Failed to block country. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const removeCountryBlock = async (block: BlockedCountry) => {
    Alert.alert(
      'Remove Block',
      `Are you sure you want to allow users in ${block.country_name} to see your profile again?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              const { error } = await supabase
                .from('country_blocks')
                .delete()
                .eq('id', block.id);

              if (error) throw error;

              setBlockedCountries(blockedCountries.filter(b => b.id !== block.id));
            } catch (error: any) {
              console.error('Error removing block:', error);
              Alert.alert('Error', 'Failed to remove block. Please try again.');
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const filteredCountries = COUNTRIES.filter(country =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    !blockedCountries.some(b => b.country_code === country.code)
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient colors={['#9B87CE', '#B8A9DD']} style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Country Blocking</Text>
          <View style={{ width: 24 }} />
        </LinearGradient>

        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9B87CE" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#9B87CE', '#B8A9DD']} style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="white" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Country Blocking</Text>
        <View style={{ width: 24 }} />
      </LinearGradient>

      <ScrollView style={styles.content}>
        {/* Safety Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoIconContainer}>
            <MaterialCommunityIcons name="earth-off" size={32} color="#9B87CE" />
          </View>
          <Text style={styles.infoTitle}>Stay Safe Globally</Text>
          <Text style={styles.infoText}>
            Hide your profile from users in specific countries. This is especially important if you need to stay hidden from people in your home country for safety reasons.
          </Text>
        </View>

        {/* Blocked Countries List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Blocked Countries ({blockedCountries.length})
          </Text>

          {blockedCountries.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialCommunityIcons name="shield-check-outline" size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateText}>
                No countries blocked yet.{'\n'}Your profile is visible worldwide.
              </Text>
            </View>
          ) : (
            blockedCountries.map(block => (
              <View key={block.id} style={styles.countryItem}>
                <View style={styles.countryInfo}>
                  <Text style={styles.countryFlag}>
                    {getFlagEmoji(block.country_code)}
                  </Text>
                  <Text style={styles.countryName}>{block.country_name}</Text>
                </View>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeCountryBlock(block)}
                  disabled={saving}
                >
                  <MaterialCommunityIcons name="close-circle" size={24} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))
          )}

          {/* Add Country Button */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowCountryPicker(true)}
            disabled={saving}
          >
            <MaterialCommunityIcons name="plus" size={20} color="white" />
            <Text style={styles.addButtonText}>Block a Country</Text>
          </TouchableOpacity>
        </View>

        {/* How It Works */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How It Works</Text>
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxText}>
              <Text style={{ fontWeight: '700' }}>1. Choose countries</Text> you want to hide from{'\n\n'}
              <Text style={{ fontWeight: '700' }}>2. Users in those countries</Text> won't see your profile in discovery{'\n\n'}
              <Text style={{ fontWeight: '700' }}>3. You can still see</Text> profiles from those countries{'\n\n'}
              <Text style={{ fontWeight: '700' }}>4. Remove blocks</Text> anytime to become visible again
            </Text>
          </View>
        </View>

        {/* Privacy Notice */}
        <View style={styles.privacyNotice}>
          <MaterialCommunityIcons name="shield-lock" size={20} color="#10B981" />
          <Text style={styles.privacyText}>
            Your blocked countries list is private. No one can see which countries you've blocked.
          </Text>
        </View>
      </ScrollView>

      {/* Country Picker Modal */}
      {showCountryPicker && (
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select a Country</Text>
              <TouchableOpacity onPress={() => {
                setShowCountryPicker(false);
                setSearchQuery('');
              }}>
                <MaterialCommunityIcons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <MaterialCommunityIcons name="magnify" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search countries..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
            </View>

            <ScrollView style={styles.countryList}>
              {filteredCountries.map(country => (
                <TouchableOpacity
                  key={country.code}
                  style={styles.countryPickerItem}
                  onPress={() => addCountryBlock(country)}
                  disabled={saving}
                >
                  <Text style={styles.countryFlag}>{getFlagEmoji(country.code)}</Text>
                  <Text style={styles.countryPickerName}>{country.name}</Text>
                </TouchableOpacity>
              ))}
              {filteredCountries.length === 0 && (
                <Text style={styles.noResults}>No countries found</Text>
              )}
            </ScrollView>
          </View>
        </View>
      )}
    </View>
  );
}

// Helper function to get flag emoji from country code
function getFlagEmoji(countryCode: string): string {
  const codePoints = countryCode
    .toUpperCase()
    .split('')
    .map(char => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
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
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  infoCard: {
    backgroundColor: '#FEF3C7',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  infoIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#92400E',
    marginBottom: 8,
    textAlign: 'center',
  },
  infoText: {
    fontSize: 14,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: 'white',
    borderRadius: 16,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  countryInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  countryFlag: {
    fontSize: 24,
  },
  countryName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  removeButton: {
    padding: 4,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#9B87CE',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
  infoBox: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
  },
  infoBoxText: {
    fontSize: 14,
    color: '#4B5563',
    lineHeight: 22,
  },
  privacyNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#ECFDF5',
    padding: 16,
    borderRadius: 12,
    marginBottom: 40,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: '#065F46',
    lineHeight: 18,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: 16,
    padding: 12,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  countryList: {
    maxHeight: 400,
  },
  countryPickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  countryPickerName: {
    fontSize: 16,
    color: '#111827',
  },
  noResults: {
    textAlign: 'center',
    padding: 20,
    color: '#6B7280',
  },
});
