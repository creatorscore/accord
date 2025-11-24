import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Keyboard,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatDistanceSlider, DistanceUnit } from '@/lib/distance-utils';

interface MatchingPreferences {
  gender_preference: string[];
  wants_children: boolean | null;
  relationship_type: string;
  age_min: number;
  age_max: number;
  max_distance_miles: number;
  distance_unit: DistanceUnit;
  willing_to_relocate: boolean;
  search_globally: boolean;
  preferred_cities: string[];
  lifestyle_preferences?: {
    smoking?: string;
    drinking?: string;
    pets?: string;
  };
}

const GENDERS = [
  'Man',
  'Woman',
  'Non-binary',
  'Trans Man',
  'Trans Woman',
  'Genderfluid',
  'Genderqueer',
  'Agender',
  'Bigender',
  'Two-Spirit',
  'Intersex',
  'Demigender',
  'Neutrois',
  'Questioning',
  'Prefer not to say',
  'Other',
];
const RELATIONSHIP_TYPES = [
  { value: 'platonic', label: 'Platonic' },
  { value: 'romantic', label: 'Romantic' },
  { value: 'open', label: 'Open' },
];
const CHILDREN_OPTIONS = [
  { value: true, label: 'Yes', icon: 'human-male-child' },
  { value: false, label: 'No', icon: 'cancel' },
  { value: null, label: 'Maybe', icon: 'help-circle-outline' },
];
const SMOKING_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'socially', label: 'Socially' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'trying_to_quit', label: 'Trying to Quit' },
];
const DRINKING_OPTIONS = [
  { value: 'never', label: 'Never' },
  { value: 'socially', label: 'Socially' },
  { value: 'regularly', label: 'Regularly' },
  { value: 'prefer_not_to_say', label: 'Prefer Not to Say' },
];
const PETS_OPTIONS = [
  { value: 'love_them', label: 'Love Them' },
  { value: 'like_them', label: 'Like Them' },
  { value: 'indifferent', label: 'Indifferent' },
  { value: 'allergic', label: 'Allergic' },
  { value: 'dont_like', label: "Don't Like" },
];

// Major cities worldwide for autocomplete
const MAJOR_CITIES = [
  // United States
  'New York, NY', 'Los Angeles, CA', 'Chicago, IL', 'Houston, TX', 'Phoenix, AZ',
  'Philadelphia, PA', 'San Antonio, TX', 'San Diego, CA', 'Dallas, TX', 'San Jose, CA',
  'Austin, TX', 'Jacksonville, FL', 'Fort Worth, TX', 'Columbus, OH', 'San Francisco, CA',
  'Charlotte, NC', 'Indianapolis, IN', 'Seattle, WA', 'Denver, CO', 'Boston, MA',
  'Portland, OR', 'Las Vegas, NV', 'Miami, FL', 'Atlanta, GA', 'Washington, DC',
  'Nashville, TN', 'Baltimore, MD', 'Minneapolis, MN', 'Detroit, MI', 'Orlando, FL',
  'Raleigh, NC', 'Salt Lake City, UT', 'Pittsburgh, PA', 'Cincinnati, OH', 'Kansas City, MO',

  // Canada
  'Toronto, Canada', 'Montreal, Canada', 'Vancouver, Canada', 'Calgary, Canada', 'Ottawa, Canada',

  // United Kingdom
  'London, UK', 'Manchester, UK', 'Birmingham, UK', 'Edinburgh, UK', 'Glasgow, UK',

  // Europe
  'Paris, France', 'Berlin, Germany', 'Munich, Germany', 'Madrid, Spain', 'Barcelona, Spain',
  'Rome, Italy', 'Milan, Italy', 'Amsterdam, Netherlands', 'Brussels, Belgium', 'Vienna, Austria',
  'Zurich, Switzerland', 'Copenhagen, Denmark', 'Stockholm, Sweden', 'Oslo, Norway', 'Helsinki, Finland',
  'Dublin, Ireland', 'Lisbon, Portugal', 'Prague, Czech Republic', 'Warsaw, Poland', 'Athens, Greece',

  // Asia - East Asia
  'Tokyo, Japan', 'Osaka, Japan', 'Kyoto, Japan', 'Seoul, South Korea', 'Busan, South Korea',
  'Beijing, China', 'Shanghai, China', 'Guangzhou, China', 'Shenzhen, China', 'Hong Kong',
  'Taipei, Taiwan', 'Singapore',

  // Asia - South Asia
  'Mumbai, India', 'Delhi, India', 'Bangalore, India', 'Hyderabad, India', 'Chennai, India',
  'Kolkata, India', 'Pune, India', 'Ahmedabad, India', 'Karachi, Pakistan', 'Lahore, Pakistan',
  'Dhaka, Bangladesh', 'Colombo, Sri Lanka', 'Kathmandu, Nepal',

  // Asia - Southeast Asia
  'Bangkok, Thailand', 'Manila, Philippines', 'Jakarta, Indonesia', 'Kuala Lumpur, Malaysia',
  'Ho Chi Minh City, Vietnam', 'Hanoi, Vietnam', 'Yangon, Myanmar', 'Phnom Penh, Cambodia',

  // Middle East
  'Dubai, UAE', 'Abu Dhabi, UAE', 'Riyadh, Saudi Arabia', 'Doha, Qatar', 'Tel Aviv, Israel',
  'Istanbul, Turkey', 'Ankara, Turkey', 'Beirut, Lebanon', 'Amman, Jordan', 'Kuwait City, Kuwait',

  // Australia & New Zealand
  'Sydney, Australia', 'Melbourne, Australia', 'Brisbane, Australia', 'Perth, Australia',
  'Auckland, New Zealand', 'Wellington, New Zealand',

  // Latin America
  'Mexico City, Mexico', 'Guadalajara, Mexico', 'Monterrey, Mexico', 'Bogotá, Colombia',
  'Medellín, Colombia', 'Buenos Aires, Argentina', 'São Paulo, Brazil', 'Rio de Janeiro, Brazil',
  'Lima, Peru', 'Santiago, Chile', 'Caracas, Venezuela', 'Quito, Ecuador',

  // Africa
  'Cairo, Egypt', 'Lagos, Nigeria', 'Johannesburg, South Africa', 'Cape Town, South Africa',
  'Nairobi, Kenya', 'Accra, Ghana', 'Casablanca, Morocco', 'Addis Ababa, Ethiopia',
].sort();

export default function MatchingPreferences() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [newCity, setNewCity] = useState('');
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<MatchingPreferences>({
    gender_preference: [],
    wants_children: null,
    relationship_type: 'platonic',
    age_min: 22,
    age_max: 50,
    max_distance_miles: 100,
    distance_unit: 'miles',
    willing_to_relocate: false,
    search_globally: false,
    preferred_cities: [],
    lifestyle_preferences: {},
  });

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      // First get the profile_id
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;
      if (!profileData) throw new Error('Profile not found');

      setProfileId(profileData.id);

      // Then get preferences using profile_id
      const { data, error } = await supabase
        .from('preferences')
        .select('*')
        .eq('profile_id', profileData.id)
        .maybeSingle();

      // PGRST116 means no rows found - that's OK, we'll use defaults
      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setPreferences({
          gender_preference: data.gender_preference || [],
          wants_children: data.wants_children,
          relationship_type: data.relationship_type || 'platonic',
          age_min: data.age_min || 22,
          age_max: data.age_max || 50,
          max_distance_miles: data.max_distance_miles || 100,
          distance_unit: data.distance_unit || 'miles',
          willing_to_relocate: data.willing_to_relocate || false,
          search_globally: data.search_globally || false,
          preferred_cities: data.preferred_cities || [],
          lifestyle_preferences: data.lifestyle_preferences || {},
        });
      }
      // If no data, keep the default preferences already set in state
    } catch (error: any) {
      console.error('Error loading matching preferences:', error);
      Alert.alert('Error', 'Failed to load matching preferences');
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!profileId) {
      Alert.alert('Error', 'Profile not found');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('preferences')
        .update(preferences)
        .eq('profile_id', profileId);

      if (error) throw error;

      Alert.alert(
        'Success',
        'Your matching preferences have been updated! Your discover feed will refresh.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('Error saving matching preferences:', error);
      Alert.alert('Error', 'Failed to save preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const toggleGender = (gender: string) => {
    setPreferences((prev) => {
      const updated = prev.gender_preference.includes(gender)
        ? prev.gender_preference.filter((g) => g !== gender)
        : [...prev.gender_preference, gender];
      return { ...prev, gender_preference: updated };
    });
  };

  const handleCitySearch = (text: string) => {
    setNewCity(text);

    if (text.trim().length >= 2) {
      // Filter cities that match the search text
      const filtered = MAJOR_CITIES.filter(city =>
        city.toLowerCase().includes(text.toLowerCase())
      ).slice(0, 8); // Show top 8 matches

      setCitySuggestions(filtered);
      setShowCitySuggestions(filtered.length > 0);
    } else {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
    }
  };

  const selectCity = (city: string) => {
    if (!preferences.preferred_cities.includes(city)) {
      setPreferences((prev) => ({
        ...prev,
        preferred_cities: [...prev.preferred_cities, city],
      }));
    }
    setNewCity('');
    setCitySuggestions([]);
    setShowCitySuggestions(false);
  };

  const addCity = () => {
    if (newCity.trim() && !preferences.preferred_cities.includes(newCity.trim())) {
      Keyboard.dismiss(); // Dismiss keyboard when city is added
      setPreferences((prev) => ({
        ...prev,
        preferred_cities: [...prev.preferred_cities, newCity.trim()],
      }));
      setNewCity('');
      setShowCitySuggestions(false);
    }
  };

  const removeCity = (city: string) => {
    setPreferences((prev) => ({
      ...prev,
      preferred_cities: prev.preferred_cities.filter((c) => c !== city),
    }));
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="chevron-left" size={28} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Matching Preferences</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#9B87CE" />
          <Text style={styles.loadingText}>Loading preferences...</Text>
        </View>
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
        <Text style={styles.headerTitle}>Matching Preferences</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', delay: 100 }}
          style={styles.infoBanner}
        >
          <LinearGradient
            colors={['#F3E8FF', '#E9D5FF']}
            style={styles.infoBannerGradient}
          >
            <MaterialCommunityIcons name="heart-multiple" size={24} color="#9B87CE" />
            <View style={styles.infoBannerContent}>
              <Text style={styles.infoBannerTitle}>Core Dealbreakers</Text>
              <Text style={styles.infoBannerText}>
                These preferences automatically filter your matches to find the most compatible partners.
              </Text>
            </View>
          </LinearGradient>
        </MotiView>

        {/* Gender Preference */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Seeking</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="gender-male-female" size={24} color="#9B87CE" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Gender Preference</Text>
                <Text style={styles.cardDescription}>Who you're interested in matching with</Text>
              </View>
            </View>
            <View style={styles.chipContainer}>
              {GENDERS.map((gender) => (
                <TouchableOpacity
                  key={gender}
                  style={[
                    styles.chip,
                    preferences.gender_preference.includes(gender) && styles.chipSelected,
                  ]}
                  onPress={() => toggleGender(gender)}
                >
                  <Text
                    style={[
                      styles.chipText,
                      preferences.gender_preference.includes(gender) && styles.chipTextSelected,
                    ]}
                  >
                    {gender}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Children Preference */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Children</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="human-male-child" size={24} color="#9B87CE" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Do you want children?</Text>
                <Text style={styles.cardDescription}>Filter out incompatible matches</Text>
              </View>
            </View>
            <View style={styles.optionButtonsContainer}>
              {CHILDREN_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={String(option.value)}
                  style={[
                    styles.optionButton,
                    preferences.wants_children === option.value && styles.optionButtonSelected,
                  ]}
                  onPress={() =>
                    setPreferences((prev) => ({ ...prev, wants_children: option.value }))
                  }
                >
                  <MaterialCommunityIcons
                    name={option.icon as any}
                    size={24}
                    color={
                      preferences.wants_children === option.value ? '#9B87CE' : '#6B7280'
                    }
                  />
                  <Text
                    style={[
                      styles.optionButtonText,
                      preferences.wants_children === option.value &&
                        styles.optionButtonTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Relationship Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Relationship Type</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="heart-outline" size={24} color="#9B87CE" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>What type of relationship?</Text>
                <Text style={styles.cardDescription}>Your preferred arrangement</Text>
              </View>
            </View>
            <View style={styles.optionButtonsContainer}>
              {RELATIONSHIP_TYPES.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.optionButton,
                    preferences.relationship_type === option.value && styles.optionButtonSelected,
                  ]}
                  onPress={() =>
                    setPreferences((prev) => ({ ...prev, relationship_type: option.value }))
                  }
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      preferences.relationship_type === option.value &&
                        styles.optionButtonTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Age Range */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Age Range</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="calendar-range" size={24} color="#9B87CE" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>
                  {preferences.age_min} - {preferences.age_max} years old
                </Text>
                <Text style={styles.cardDescription}>Show matches in this age range</Text>
              </View>
            </View>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>Minimum Age: {preferences.age_min}</Text>
              <Slider
                style={styles.slider}
                minimumValue={18}
                maximumValue={80}
                step={1}
                value={preferences.age_min}
                onValueChange={(value) =>
                  setPreferences((prev) => ({ ...prev, age_min: value }))
                }
                minimumTrackTintColor="#9B87CE"
                maximumTrackTintColor="#E5E7EB"
              />
              <Text style={styles.sliderLabel}>Maximum Age: {preferences.age_max}</Text>
              <Slider
                style={styles.slider}
                minimumValue={18}
                maximumValue={80}
                step={1}
                value={preferences.age_max}
                onValueChange={(value) =>
                  setPreferences((prev) => ({ ...prev, age_max: value }))
                }
                minimumTrackTintColor="#9B87CE"
                maximumTrackTintColor="#E5E7EB"
              />
            </View>
          </View>
        </View>

        {/* Distance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Distance</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="map-marker-distance" size={24} color="#9B87CE" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>
                  Within {formatDistanceSlider(preferences.max_distance_miles, preferences.distance_unit)}
                </Text>
                <Text style={styles.cardDescription}>Maximum distance for matches</Text>
              </View>
            </View>

            {/* Distance Unit Toggle */}
            <View style={styles.unitToggleContainer}>
              <TouchableOpacity
                style={[
                  styles.unitToggleButton,
                  preferences.distance_unit === 'miles' && styles.unitToggleButtonSelected,
                ]}
                onPress={() => setPreferences((prev) => ({ ...prev, distance_unit: 'miles' }))}
              >
                <Text
                  style={[
                    styles.unitToggleText,
                    preferences.distance_unit === 'miles' && styles.unitToggleTextSelected,
                  ]}
                >
                  Miles
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.unitToggleButton,
                  preferences.distance_unit === 'km' && styles.unitToggleButtonSelected,
                ]}
                onPress={() => setPreferences((prev) => ({ ...prev, distance_unit: 'km' }))}
              >
                <Text
                  style={[
                    styles.unitToggleText,
                    preferences.distance_unit === 'km' && styles.unitToggleTextSelected,
                  ]}
                >
                  Kilometers
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={10}
                maximumValue={500}
                step={10}
                value={preferences.max_distance_miles}
                onValueChange={(value) =>
                  setPreferences((prev) => ({ ...prev, max_distance_miles: value }))
                }
                minimumTrackTintColor="#9B87CE"
                maximumTrackTintColor="#E5E7EB"
              />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchContent}>
                <Text style={styles.switchTitle}>Willing to relocate</Text>
                <Text style={styles.switchDescription}>
                  Consider matches outside your max distance
                </Text>
              </View>
              <Switch
                value={preferences.willing_to_relocate}
                onValueChange={(value) =>
                  setPreferences((prev) => ({ ...prev, willing_to_relocate: value }))
                }
                trackColor={{ false: '#D1D5DB', true: '#A78BFA' }}
                thumbColor={preferences.willing_to_relocate ? '#9B87CE' : '#F3F4F6'}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchContent}>
                <MaterialCommunityIcons name="earth" size={20} color="#9B87CE" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchTitle}>Search globally</Text>
                  <Text style={styles.switchDescription}>
                    Match with people anywhere in the world
                  </Text>
                </View>
              </View>
              <Switch
                value={preferences.search_globally}
                onValueChange={(value) =>
                  setPreferences((prev) => ({ ...prev, search_globally: value }))
                }
                trackColor={{ false: '#D1D5DB', true: '#A78BFA' }}
                thumbColor={preferences.search_globally ? '#9B87CE' : '#F3F4F6'}
              />
            </View>
          </View>
        </View>

        {/* Preferred Cities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location Preferences</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="city-variant" size={24} color="#9B87CE" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Preferred Cities</Text>
                <Text style={styles.cardDescription}>
                  Add cities you're interested in (e.g., studying abroad but want to return home)
                </Text>
              </View>
            </View>

            {/* City Input with Autocomplete */}
            <View>
              <View style={styles.cityInputContainer}>
                <TextInput
                  style={styles.cityInput}
                  placeholder="Search cities (e.g., Tokyo, Mumbai, NYC)"
                  value={newCity}
                  onChangeText={handleCitySearch}
                  onSubmitEditing={addCity}
                  returnKeyType="done"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.addCityButton, !newCity.trim() && styles.addCityButtonDisabled]}
                  onPress={addCity}
                  disabled={!newCity.trim()}
                >
                  <MaterialCommunityIcons name="plus" size={20} color={newCity.trim() ? '#fff' : '#9CA3AF'} />
                </TouchableOpacity>
              </View>

              {/* Autocomplete Suggestions */}
              {showCitySuggestions && citySuggestions.length > 0 && (
                <View style={styles.suggestionsContainer}>
                  {citySuggestions.map((city, index) => (
                    <TouchableOpacity
                      key={city}
                      style={[
                        styles.suggestionItem,
                        index === citySuggestions.length - 1 && styles.suggestionItemLast
                      ]}
                      onPress={() => selectCity(city)}
                    >
                      <MaterialCommunityIcons name="map-marker" size={18} color="#9B87CE" />
                      <Text style={styles.suggestionText}>{city}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* City Chips */}
            {preferences.preferred_cities.length > 0 && (
              <View style={styles.cityChipsContainer}>
                {preferences.preferred_cities.map((city) => (
                  <View key={city} style={styles.cityChip}>
                    <MaterialCommunityIcons name="map-marker" size={16} color="#9B87CE" />
                    <Text style={styles.cityChipText}>{city}</Text>
                    <TouchableOpacity onPress={() => removeCity(city)} style={styles.removeCityButton}>
                      <MaterialCommunityIcons name="close-circle" size={18} color="#6B7280" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {preferences.preferred_cities.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialCommunityIcons name="map-marker-outline" size={32} color="#D1D5DB" />
                <Text style={styles.emptyStateText}>
                  No preferred cities yet. Add cities where you'd like to find matches!
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Lifestyle Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lifestyle Preferences</Text>

          {/* Smoking */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="smoking" size={24} color="#9B87CE" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Smoking</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {SMOKING_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: preferences.lifestyle_preferences?.smoking === option.value ? '#9B87CE' : '#D1D5DB',
                    backgroundColor: preferences.lifestyle_preferences?.smoking === option.value ? '#F3E8FF' : '#fff',
                  }}
                  onPress={() =>
                    setPreferences({
                      ...preferences,
                      lifestyle_preferences: {
                        ...preferences.lifestyle_preferences,
                        smoking: option.value,
                      },
                    })
                  }
                >
                  <Text
                    style={{
                      color: preferences.lifestyle_preferences?.smoking === option.value ? '#9B87CE' : '#6B7280',
                      fontWeight: preferences.lifestyle_preferences?.smoking === option.value ? '600' : '400',
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Drinking */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="glass-cocktail" size={24} color="#9B87CE" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Drinking</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {DRINKING_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: preferences.lifestyle_preferences?.drinking === option.value ? '#9B87CE' : '#D1D5DB',
                    backgroundColor: preferences.lifestyle_preferences?.drinking === option.value ? '#F3E8FF' : '#fff',
                  }}
                  onPress={() =>
                    setPreferences({
                      ...preferences,
                      lifestyle_preferences: {
                        ...preferences.lifestyle_preferences,
                        drinking: option.value,
                      },
                    })
                  }
                >
                  <Text
                    style={{
                      color: preferences.lifestyle_preferences?.drinking === option.value ? '#9B87CE' : '#6B7280',
                      fontWeight: preferences.lifestyle_preferences?.drinking === option.value ? '600' : '400',
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Pets */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="paw" size={24} color="#9B87CE" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>Pets</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {PETS_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: preferences.lifestyle_preferences?.pets === option.value ? '#9B87CE' : '#D1D5DB',
                    backgroundColor: preferences.lifestyle_preferences?.pets === option.value ? '#F3E8FF' : '#fff',
                  }}
                  onPress={() =>
                    setPreferences({
                      ...preferences,
                      lifestyle_preferences: {
                        ...preferences.lifestyle_preferences,
                        pets: option.value,
                      },
                    })
                  }
                >
                  <Text
                    style={{
                      color: preferences.lifestyle_preferences?.pets === option.value ? '#9B87CE' : '#6B7280',
                      fontWeight: preferences.lifestyle_preferences?.pets === option.value ? '600' : '400',
                    }}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View style={{ height: 160 }} />
      </ScrollView>

      {/* Save Button */}
      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 20) + 10 }]}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={savePreferences}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="check" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save Preferences</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
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
  scrollView: {
    flex: 1,
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
    color: '#6B21A8',
    marginBottom: 4,
  },
  infoBannerText: {
    fontSize: 14,
    color: '#6B21A8',
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
  card: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  chipSelected: {
    backgroundColor: '#9B87CE',
    borderColor: '#9B87CE',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  chipTextSelected: {
    color: 'white',
  },
  optionButtonsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  optionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  optionButtonSelected: {
    backgroundColor: '#F3E8FF',
    borderColor: '#9B87CE',
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  optionButtonTextSelected: {
    color: '#9B87CE',
  },
  sliderContainer: {
    gap: 8,
  },
  sliderLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  switchContent: {
    flex: 1,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  switchDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9B87CE',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  cityInputContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  cityInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  addCityButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#9B87CE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCityButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  suggestionsContainer: {
    marginTop: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  suggestionItemLast: {
    borderBottomWidth: 0,
  },
  suggestionText: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  cityChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  cityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    borderRadius: 20,
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 8,
    gap: 6,
  },
  cityChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B21A8',
  },
  removeCityButton: {
    padding: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  unitToggleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  unitToggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  unitToggleButtonSelected: {
    backgroundColor: '#9B87CE',
    borderColor: '#9B87CE',
  },
  unitToggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  unitToggleTextSelected: {
    color: '#fff',
  },
});
