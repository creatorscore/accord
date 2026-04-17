import { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  StyleSheet,
  useColorScheme,
  Keyboard,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import citiesData from '@/assets/data/cities';

// Data format: [name, country, admin1]
type CityTuple = readonly [string, string, string];

interface City {
  name: string;
  country: string;
  admin1: string;
}

interface CityAutocompleteStepProps {
  value: string;
  onSelect: (city: string) => void;
  placeholder?: string;
  showVisibility?: boolean;
  visible?: boolean;
  onVisibilityChange?: (visible: boolean) => void;
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

export default function CityAutocompleteStep({
  value,
  onSelect,
  placeholder = 'e.g. Los Angeles, CA',
  showVisibility,
  visible = true,
  onVisibilityChange,
}: CityAutocompleteStepProps) {
  const isDark = useColorScheme() === 'dark';
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<City[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Sync query when value prop changes externally (e.g. GPS location set)
  // Only sync if user isn't actively typing (input not focused)
  const isFocusedRef = useRef(false);
  useEffect(() => {
    if (!isFocusedRef.current && value !== query) {
      setQuery(value);
      setShowResults(false);
    }
  }, [value]);
  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<NodeJS.Timeout>(null);

  const doSearch = useCallback((text: string) => {
    const matched = searchCities(text);
    setResults(matched);
    setShowResults(matched.length > 0);
  }, []);

  const handleChangeText = useCallback((text: string) => {
    setQuery(text);
    onSelect(text);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(text), 150);
  }, [doSearch, onSelect]);

  const handleSelectCity = useCallback((city: City) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const formatted = formatCity(city);
    setQuery(formatted);
    onSelect(formatted);
    setShowResults(false);
    Keyboard.dismiss();
  }, [onSelect]);

  const handleClear = useCallback(() => {
    setQuery('');
    onSelect('');
    setResults([]);
    setShowResults(false);
    inputRef.current?.focus();
  }, [onSelect]);

  return (
    <View style={styles.container}>
      {/* Input */}
      <View style={[styles.inputRow, {
        borderColor: showResults ? '#A08AB7' : (isDark ? '#374151' : '#E4E4E7'),
        backgroundColor: isDark ? '#1A1A2D' : '#FAFAFA',
      }]}>
        <MaterialCommunityIcons
          name="magnify"
          size={22}
          color={isDark ? '#6B7280' : '#9CA3AF'}
          style={styles.searchIcon}
        />
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: isDark ? '#F5F5F7' : '#1F2937' }]}
          placeholder={placeholder}
          placeholderTextColor={isDark ? '#6B7280' : '#A1A1AA'}
          value={query}
          onChangeText={handleChangeText}
          onFocus={() => { isFocusedRef.current = true; if (query.length >= 2) doSearch(query); }}
          onBlur={() => { isFocusedRef.current = false; }}
          autoCapitalize="words"
          autoCorrect={false}
          maxLength={100}
          returnKeyType="done"
          accessibilityLabel="Search for your hometown"
        />
        {query.length > 0 && (
          <TouchableOpacity
            onPress={handleClear}
            style={styles.clearButton}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <MaterialCommunityIcons
              name="close-circle"
              size={20}
              color={isDark ? '#6B7280' : '#9CA3AF'}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Results dropdown */}
      {showResults && (
        <View style={[styles.dropdown, {
          backgroundColor: isDark ? '#1A1A2D' : '#FFFFFF',
          borderColor: isDark ? '#2C2C3E' : '#E8E3F0',
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
                  style={styles.resultIcon}
                />
                <View style={styles.resultText}>
                  <Text style={[styles.cityName, { color: isDark ? '#F5F5F7' : '#1F2937' }]}>
                    {item.name}
                  </Text>
                  <Text style={[styles.regionName, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
                    {item.country === 'US' || item.country === 'CA'
                      ? item.admin1
                      : item.country}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Visibility toggle */}
      {showVisibility && (
        <View style={[styles.visibilityRow, { borderTopColor: isDark ? '#2C2C3E' : '#F0EDF4' }]}>
          <Text style={[styles.visibilityLabel, { color: isDark ? '#9CA3AF' : '#6B7280' }]}>
            Show on profile
          </Text>
          <Switch
            value={visible}
            onValueChange={(v) => {
              Haptics.selectionAsync();
              onVisibilityChange?.(v);
            }}
            trackColor={{ false: '#D1D5DB', true: '#CDC2E5' }}
            thumbColor={visible ? '#A08AB7' : '#F3F4F6'}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 24,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    paddingVertical: 18,
  },
  clearButton: {
    padding: 4,
    marginLeft: 4,
  },
  dropdown: {
    marginTop: 8,
    borderWidth: 1.5,
    borderRadius: 16,
    overflow: 'hidden',
  },
  resultsList: {
    maxHeight: 260,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  resultIcon: {
    marginRight: 12,
  },
  resultText: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    flex: 1,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '600',
  },
  regionName: {
    fontSize: 14,
    fontWeight: '500',
  },
  visibilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 28,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  visibilityLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
});
