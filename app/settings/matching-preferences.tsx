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
import { useTranslation } from 'react-i18next';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { formatDistanceSlider, DistanceUnit } from '@/lib/distance-utils';
import { GENDER_PREF_OPTIONS, expandGenderPreference, collapseGenderPreference } from '@/lib/gender-preferences';
import * as Haptics from 'expo-haptics';
import PremiumPaywall from '@/components/premium/PremiumPaywall';

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

const RELATIONSHIP_TYPE_VALUES = ['platonic', 'romantic', 'open'] as const;
const CHILDREN_OPTION_VALUES = [
  { value: true, icon: 'human-male-child' },
  { value: false, icon: 'cancel' },
  { value: null, icon: 'help-circle-outline' },
] as const;
const SMOKING_OPTION_VALUES = ['never', 'socially', 'regularly', 'trying_to_quit'] as const;
const DRINKING_OPTION_VALUES = ['never', 'socially', 'regularly', 'prefer_not_to_say'] as const;
const PETS_OPTION_VALUES = ['love_them', 'like_them', 'indifferent', 'allergic', 'dont_like'] as const;

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
  const { t } = useTranslation();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const RELATIONSHIP_TYPES: Record<string, string> = {
    platonic: t('settings.matchingPreferences.platonic'),
    romantic: t('settings.matchingPreferences.romantic'),
    open: t('settings.matchingPreferences.open'),
  };
  const CHILDREN_LABELS: Record<string, string> = {
    true: t('settings.matchingPreferences.childrenYes'),
    false: t('settings.matchingPreferences.childrenNo'),
    null: t('settings.matchingPreferences.childrenMaybe'),
  };
  const SMOKING_LABELS: Record<string, string> = {
    never: t('settings.matchingPreferences.smokingNever'),
    socially: t('settings.matchingPreferences.smokingSocially'),
    regularly: t('settings.matchingPreferences.smokingRegularly'),
    trying_to_quit: t('settings.matchingPreferences.smokingTryingToQuit'),
  };
  const DRINKING_LABELS: Record<string, string> = {
    never: t('settings.matchingPreferences.drinkingNever'),
    socially: t('settings.matchingPreferences.drinkingSocially'),
    regularly: t('settings.matchingPreferences.drinkingRegularly'),
    prefer_not_to_say: t('settings.matchingPreferences.drinkingPreferNotToSay'),
  };
  const PETS_LABELS: Record<string, string> = {
    love_them: t('settings.matchingPreferences.petsLove'),
    like_them: t('settings.matchingPreferences.petsLike'),
    indifferent: t('settings.matchingPreferences.petsIndifferent'),
    allergic: t('settings.matchingPreferences.petsAllergic'),
    dont_like: t('settings.matchingPreferences.petsDontLike'),
  };

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [newCity, setNewCity] = useState('');
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [preferences, setPreferences] = useState<MatchingPreferences>({
    gender_preference: [],
    wants_children: null,
    relationship_type: 'platonic',
    age_min: 18,
    age_max: 65,
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
      // First get the profile_id and premium status
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, is_premium, is_platinum')
        .eq('user_id', user?.id)
        .single();

      if (profileError) throw profileError;
      if (!profileData) throw new Error('Profile not found');

      setProfileId(profileData.id);
      setIsPremium(profileData.is_premium || profileData.is_platinum || false);

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
          gender_preference: collapseGenderPreference(data.gender_preference || []),
          wants_children: data.wants_children,
          relationship_type: data.relationship_type || 'platonic',
          age_min: data.age_min || 18,
          age_max: data.age_max || 65,
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
      Alert.alert(t('common.error'), t('settings.matchingPreferences.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const savePreferences = async () => {
    if (!profileId) {
      Alert.alert(t('common.error'), t('settings.matchingPreferences.profileNotFound'));
      return;
    }

    if (preferences.gender_preference.length === 0) {
      Alert.alert(t('common.required'), t('onboarding.matchingPreferences.selectGenderPreference'));
      return;
    }

    setSaving(true);
    try {
      // Force search_globally off for non-premium users
      const basePrefs = isPremium ? preferences : { ...preferences, search_globally: false };
      // Expand simplified gender prefs (Men/Women/Non-binary/Everyone) back to full identity values for DB
      const prefsToSave = {
        ...basePrefs,
        gender_preference: expandGenderPreference(basePrefs.gender_preference),
      };

      // Use .update() instead of .upsert() to only modify fields managed by this page.
      // .upsert() would reset unincluded fields (primary_reasons, financial_arrangement,
      // housing_preference, children_arrangement, dealbreakers, must_haves, discovery_filters)
      // to their defaults, destroying data set during onboarding or edit-profile.
      const { error } = await supabase
        .from('preferences')
        .update({
          ...prefsToSave,
          updated_at: new Date().toISOString(),
        })
        .eq('profile_id', profileId);

      if (error) throw error;

      Alert.alert(
        t('common.success'),
        t('settings.matchingPreferences.saveSuccess'),
        [
          {
            text: t('common.ok'),
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error: any) {
      console.error('❌ Error saving matching preferences:', error);
      Alert.alert(t('common.error'), t('settings.matchingPreferences.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const toggleGender = (gender: string) => {
    setPreferences((prev) => {
      if (gender === 'Everyone') {
        // Everyone is mutually exclusive — toggle it alone
        const isSelected = prev.gender_preference.includes('Everyone');
        return { ...prev, gender_preference: isSelected ? [] : ['Everyone'] };
      }
      // Selecting a specific option clears "Everyone"
      const withoutEveryone = prev.gender_preference.filter((g) => g !== 'Everyone');
      const updated = withoutEveryone.includes(gender)
        ? withoutEveryone.filter((g) => g !== gender)
        : [...withoutEveryone, gender];
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
    if (preferences.preferred_cities.length >= 2) {
      Alert.alert(t('settings.matchingPreferences.limitReached'), t('settings.matchingPreferences.cityLimit'));
      setNewCity('');
      setCitySuggestions([]);
      setShowCitySuggestions(false);
      return;
    }
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
    if (preferences.preferred_cities.length >= 2) {
      Alert.alert(t('settings.matchingPreferences.limitReached'), t('settings.matchingPreferences.cityLimit'));
      return;
    }
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
          <Text style={styles.headerTitle}>{t('settings.matchingPreferences.title')}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A08AB7" />
          <Text style={styles.loadingText}>{t('settings.matchingPreferences.loading')}</Text>
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
        <Text style={styles.headerTitle}>{t('settings.matchingPreferences.title')}</Text>
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
            <MaterialCommunityIcons name="heart-multiple" size={24} color="#A08AB7" />
            <View style={styles.infoBannerContent}>
              <Text style={styles.infoBannerTitle}>{t('settings.matchingPreferences.coreDealbreakers')}</Text>
              <Text style={styles.infoBannerText}>
                {t('settings.matchingPreferences.coreDealbreakerDesc')}
              </Text>
            </View>
          </LinearGradient>
        </MotiView>

        {/* Gender Preference */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.matchingPreferences.seeking')}</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="gender-male-female" size={24} color="#A08AB7" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>{t('settings.matchingPreferences.genderPreference')}</Text>
                <Text style={styles.cardDescription}>{t('settings.matchingPreferences.genderPreferenceDesc')}</Text>
              </View>
            </View>
            <View style={styles.chipContainer}>
              {GENDER_PREF_OPTIONS.map((gender) => (
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
          <Text style={styles.sectionTitle}>{t('settings.matchingPreferences.children')}</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="human-male-child" size={24} color="#A08AB7" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>{t('settings.matchingPreferences.wantChildren')}</Text>
                <Text style={styles.cardDescription}>{t('settings.matchingPreferences.childrenDesc')}</Text>
              </View>
            </View>
            <View style={styles.optionButtonsContainer}>
              {CHILDREN_OPTION_VALUES.map((option) => (
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
                      preferences.wants_children === option.value ? '#A08AB7' : '#6B7280'
                    }
                  />
                  <Text
                    style={[
                      styles.optionButtonText,
                      preferences.wants_children === option.value &&
                        styles.optionButtonTextSelected,
                    ]}
                  >
                    {CHILDREN_LABELS[String(option.value)]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Relationship Type */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.matchingPreferences.relationshipType')}</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="heart-outline" size={24} color="#A08AB7" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>{t('settings.matchingPreferences.whatRelationship')}</Text>
                <Text style={styles.cardDescription}>{t('settings.matchingPreferences.preferredArrangement')}</Text>
              </View>
            </View>
            <View style={styles.optionButtonsContainer}>
              {RELATIONSHIP_TYPE_VALUES.map((value) => (
                <TouchableOpacity
                  key={value}
                  style={[
                    styles.optionButton,
                    preferences.relationship_type === value && styles.optionButtonSelected,
                  ]}
                  onPress={() =>
                    setPreferences((prev) => ({ ...prev, relationship_type: value }))
                  }
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      preferences.relationship_type === value &&
                        styles.optionButtonTextSelected,
                    ]}
                  >
                    {RELATIONSHIP_TYPES[value]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Age Range */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.matchingPreferences.ageRange')}</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="calendar-range" size={24} color="#A08AB7" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>
                  {t('settings.matchingPreferences.yearsOld', { min: preferences.age_min, max: preferences.age_max })}
                </Text>
                <Text style={styles.cardDescription}>{t('settings.matchingPreferences.ageRangeDesc')}</Text>
              </View>
            </View>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderLabel}>{t('settings.matchingPreferences.minAge', { age: preferences.age_min })}</Text>
              <Slider
                style={styles.slider}
                minimumValue={18}
                maximumValue={80}
                step={1}
                value={preferences.age_min}
                onValueChange={(value) =>
                  setPreferences((prev) => ({ ...prev, age_min: value }))
                }
                minimumTrackTintColor="#A08AB7"
                maximumTrackTintColor="#E5E7EB"
              />
              <Text style={styles.sliderLabel}>{t('settings.matchingPreferences.maxAge', { age: preferences.age_max })}</Text>
              <Slider
                style={styles.slider}
                minimumValue={18}
                maximumValue={80}
                step={1}
                value={preferences.age_max}
                onValueChange={(value) =>
                  setPreferences((prev) => ({ ...prev, age_max: value }))
                }
                minimumTrackTintColor="#A08AB7"
                maximumTrackTintColor="#E5E7EB"
              />
            </View>
          </View>
        </View>

        {/* Distance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.matchingPreferences.distance')}</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="map-marker-distance" size={24} color="#A08AB7" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>
                  Within {formatDistanceSlider(preferences.max_distance_miles, preferences.distance_unit)}
                </Text>
                <Text style={styles.cardDescription}>{t('settings.matchingPreferences.maxDistanceDesc')}</Text>
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
                  {t('settings.matchingPreferences.miles')}
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
                  {t('settings.matchingPreferences.kilometers')}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={10}
                maximumValue={1000}
                step={10}
                value={preferences.max_distance_miles}
                onValueChange={(value) =>
                  setPreferences((prev) => ({ ...prev, max_distance_miles: value }))
                }
                minimumTrackTintColor="#A08AB7"
                maximumTrackTintColor="#E5E7EB"
              />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchContent}>
                <Text style={styles.switchTitle}>{t('settings.matchingPreferences.willingToRelocate')}</Text>
                <Text style={styles.switchDescription}>
                  {t('settings.matchingPreferences.relocateDesc')}
                </Text>
              </View>
              <Switch
                value={preferences.willing_to_relocate}
                onValueChange={(value) => {
                  Haptics.selectionAsync();
                  setPreferences((prev) => ({ ...prev, willing_to_relocate: value }));
                }}
                trackColor={{ false: '#D1D5DB', true: '#CDC2E5' }}
                thumbColor={preferences.willing_to_relocate ? '#A08AB7' : '#F3F4F6'}
              />
            </View>

            <View style={styles.switchRow}>
              <View style={styles.switchContent}>
                <MaterialCommunityIcons name="earth" size={20} color="#A08AB7" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={styles.switchTitle}>{t('settings.matchingPreferences.searchGlobally')}</Text>
                    {!isPremium && (
                      <View style={{ backgroundColor: '#A08AB7', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 }}>
                        <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{t('common.premium').toUpperCase()}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.switchDescription}>
                    {t('settings.matchingPreferences.searchGloballyDesc')}
                  </Text>
                </View>
              </View>
              {isPremium ? (
                <Switch
                  value={preferences.search_globally}
                  onValueChange={(value) => {
                    Haptics.selectionAsync();
                    setPreferences((prev) => ({ ...prev, search_globally: value }));
                  }}
                  trackColor={{ false: '#D1D5DB', true: '#CDC2E5' }}
                  thumbColor={preferences.search_globally ? '#A08AB7' : '#F3F4F6'}
                />
              ) : (
                <TouchableOpacity onPress={() => setShowPaywall(true)}>
                  <MaterialCommunityIcons name="lock" size={24} color="#A08AB7" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Preferred Cities - Now free for all users */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.matchingPreferences.locationPreferences')}</Text>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="city-variant" size={24} color="#A08AB7" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>{t('settings.matchingPreferences.preferredCities')}</Text>
                <Text style={styles.cardDescription}>
                  {t('settings.matchingPreferences.preferredCitiesDesc')}
                </Text>
              </View>
            </View>

            {/* City Input with Autocomplete */}
            <View>
              <View style={styles.cityInputContainer}>
                <TextInput
                  style={styles.cityInput}
                  placeholder={t('settings.matchingPreferences.searchCitiesPlaceholder')}
                  value={newCity}
                  onChangeText={handleCitySearch}
                  onSubmitEditing={addCity}
                  returnKeyType="done"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.addCityButton, (!newCity.trim() || preferences.preferred_cities.length >= 2) && styles.addCityButtonDisabled]}
                  onPress={addCity}
                  disabled={!newCity.trim() || preferences.preferred_cities.length >= 2}
                >
                  <MaterialCommunityIcons name="plus" size={20} color={newCity.trim() && preferences.preferred_cities.length < 2 ? '#fff' : '#9CA3AF'} />
                </TouchableOpacity>
              </View>
              <Text style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                {t('settings.matchingPreferences.citiesAdded', { count: preferences.preferred_cities.length })}
              </Text>

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
                      <MaterialCommunityIcons name="map-marker" size={18} color="#A08AB7" />
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
                    <MaterialCommunityIcons name="map-marker" size={16} color="#A08AB7" />
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
                  {t('settings.matchingPreferences.noCitiesEmpty')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Lifestyle Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.matchingPreferences.lifestylePreferences')}</Text>

          {/* Smoking */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="smoking" size={24} color="#A08AB7" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>{t('settings.matchingPreferences.smoking')}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {SMOKING_OPTION_VALUES.map((value) => (
                <TouchableOpacity
                  key={value}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: preferences.lifestyle_preferences?.smoking === value ? '#A08AB7' : '#D1D5DB',
                    backgroundColor: preferences.lifestyle_preferences?.smoking === value ? '#F3E8FF' : '#fff',
                  }}
                  onPress={() =>
                    setPreferences({
                      ...preferences,
                      lifestyle_preferences: {
                        ...preferences.lifestyle_preferences,
                        smoking: value,
                      },
                    })
                  }
                >
                  <Text
                    style={{
                      color: preferences.lifestyle_preferences?.smoking === value ? '#A08AB7' : '#6B7280',
                      fontWeight: preferences.lifestyle_preferences?.smoking === value ? '600' : '400',
                    }}
                  >
                    {SMOKING_LABELS[value]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Drinking */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="glass-cocktail" size={24} color="#A08AB7" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>{t('settings.matchingPreferences.drinking')}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {DRINKING_OPTION_VALUES.map((value) => (
                <TouchableOpacity
                  key={value}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: preferences.lifestyle_preferences?.drinking === value ? '#A08AB7' : '#D1D5DB',
                    backgroundColor: preferences.lifestyle_preferences?.drinking === value ? '#F3E8FF' : '#fff',
                  }}
                  onPress={() =>
                    setPreferences({
                      ...preferences,
                      lifestyle_preferences: {
                        ...preferences.lifestyle_preferences,
                        drinking: value,
                      },
                    })
                  }
                >
                  <Text
                    style={{
                      color: preferences.lifestyle_preferences?.drinking === value ? '#A08AB7' : '#6B7280',
                      fontWeight: preferences.lifestyle_preferences?.drinking === value ? '600' : '400',
                    }}
                  >
                    {DRINKING_LABELS[value]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Pets */}
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons name="paw" size={24} color="#A08AB7" />
              </View>
              <View style={styles.cardHeaderText}>
                <Text style={styles.cardTitle}>{t('settings.matchingPreferences.pets')}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {PETS_OPTION_VALUES.map((value) => (
                <TouchableOpacity
                  key={value}
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 10,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: preferences.lifestyle_preferences?.pets === value ? '#A08AB7' : '#D1D5DB',
                    backgroundColor: preferences.lifestyle_preferences?.pets === value ? '#F3E8FF' : '#fff',
                  }}
                  onPress={() =>
                    setPreferences({
                      ...preferences,
                      lifestyle_preferences: {
                        ...preferences.lifestyle_preferences,
                        pets: value,
                      },
                    })
                  }
                >
                  <Text
                    style={{
                      color: preferences.lifestyle_preferences?.pets === value ? '#A08AB7' : '#6B7280',
                      fontWeight: preferences.lifestyle_preferences?.pets === value ? '600' : '400',
                    }}
                  >
                    {PETS_LABELS[value]}
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
              <Text style={styles.saveButtonText}>{t('settings.matchingPreferences.save')}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Premium Paywall Modal */}
      {showPaywall && (
        <PremiumPaywall
          visible={showPaywall}
          onClose={() => setShowPaywall(false)}
          feature="search_globally"
        />
      )}
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
    color: '#A08AB7',
    marginBottom: 4,
  },
  infoBannerText: {
    fontSize: 14,
    color: '#A08AB7',
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
    backgroundColor: '#A08AB7',
    borderColor: '#A08AB7',
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
    borderColor: '#A08AB7',
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  optionButtonTextSelected: {
    color: '#A08AB7',
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
    backgroundColor: '#A08AB7',
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
    backgroundColor: '#A08AB7',
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
    color: '#A08AB7',
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
    backgroundColor: '#A08AB7',
    borderColor: '#A08AB7',
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
