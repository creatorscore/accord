import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';

export interface FilterOptions {
  ageMin: number;
  ageMax: number;
  maxDistance: number;
  genderPreference: string[];
  relationshipType: string[];
  wantsChildren: boolean | null;
  religion: string[];
  politicalViews: string[];
  financialArrangement: string[];
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterOptions) => void;
  currentFilters: FilterOptions;
  isPremium: boolean;
  onUpgrade: () => void;
}

const GENDERS = ['Man', 'Woman', 'Non-binary'];
const RELATIONSHIP_TYPES = ['Platonic', 'Romantic', 'Open'];
const RELIGIONS = ['Christian', 'Catholic', 'Muslim', 'Jewish', 'Hindu', 'Buddhist', 'Atheist', 'Agnostic', 'Spiritual', 'Other'];
const POLITICAL_VIEWS = ['Liberal', 'Progressive', 'Moderate', 'Conservative', 'Libertarian', 'Other'];
const FINANCIAL_ARRANGEMENTS = ['Separate', 'Shared Expenses', 'Joint', 'Prenup Required', 'Flexible'];

export default function FilterModal({
  visible,
  onClose,
  onApply,
  currentFilters,
  isPremium,
  onUpgrade,
}: FilterModalProps) {
  const [filters, setFilters] = useState<FilterOptions>(currentFilters);

  useEffect(() => {
    setFilters(currentFilters);
  }, [currentFilters, visible]);

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleReset = () => {
    const defaultFilters: FilterOptions = {
      ageMin: 22,
      ageMax: 50,
      maxDistance: 100,
      genderPreference: [],
      relationshipType: [],
      wantsChildren: null,
      religion: [],
      politicalViews: [],
      financialArrangement: [],
    };
    setFilters(defaultFilters);
  };

  const toggleArrayFilter = (array: string[], value: string) => {
    if (array.includes(value)) {
      return array.filter(item => item !== value);
    } else {
      return [...array, value];
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose}>
            <MaterialCommunityIcons name="close" size={24} color="#1F2937" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Filters</Text>
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.resetButton}>Reset</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Age Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Age Range</Text>
            <View style={styles.rangeValues}>
              <Text style={styles.rangeText}>{filters.ageMin}</Text>
              <Text style={styles.rangeText}>{filters.ageMax}</Text>
            </View>
            <View style={styles.sliderContainer}>
              <Slider
                style={styles.slider}
                minimumValue={18}
                maximumValue={80}
                step={1}
                value={filters.ageMin}
                onValueChange={(value) => setFilters({ ...filters, ageMin: value })}
                minimumTrackTintColor="#8B5CF6"
                maximumTrackTintColor="#E5E7EB"
              />
              <Slider
                style={styles.slider}
                minimumValue={18}
                maximumValue={80}
                step={1}
                value={filters.ageMax}
                onValueChange={(value) => setFilters({ ...filters, ageMax: value })}
                minimumTrackTintColor="#8B5CF6"
                maximumTrackTintColor="#E5E7EB"
              />
            </View>
          </View>

          {/* Distance */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Maximum Distance</Text>
            <Text style={styles.rangeText}>{filters.maxDistance} miles</Text>
            <Slider
              style={styles.slider}
              minimumValue={5}
              maximumValue={500}
              step={5}
              value={filters.maxDistance}
              onValueChange={(value) => setFilters({ ...filters, maxDistance: value })}
              minimumTrackTintColor="#8B5CF6"
              maximumTrackTintColor="#E5E7EB"
            />
          </View>

          {/* Premium Filters */}
          {!isPremium && (
            <TouchableOpacity style={styles.premiumBanner} onPress={onUpgrade}>
              <View style={styles.premiumBannerContent}>
                <MaterialCommunityIcons name="crown" size={24} color="#FFD700" />
                <Text style={styles.premiumBannerText}>
                  Upgrade to Premium for Advanced Filters
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#8B5CF6" />
            </TouchableOpacity>
          )}

          {/* Gender Preference */}
          <View style={[styles.section, !isPremium && styles.disabledSection]}>
            <Text style={styles.sectionTitle}>Gender Preference</Text>
            <View style={styles.chipContainer}>
              {GENDERS.map((gender) => (
                <TouchableOpacity
                  key={gender}
                  disabled={!isPremium}
                  style={[
                    styles.chip,
                    filters.genderPreference.includes(gender) && styles.chipSelected,
                    !isPremium && styles.chipDisabled,
                  ]}
                  onPress={() =>
                    setFilters({
                      ...filters,
                      genderPreference: toggleArrayFilter(filters.genderPreference, gender),
                    })
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.genderPreference.includes(gender) && styles.chipTextSelected,
                    ]}
                  >
                    {gender}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Relationship Type */}
          <View style={[styles.section, !isPremium && styles.disabledSection]}>
            <Text style={styles.sectionTitle}>Relationship Type</Text>
            <View style={styles.chipContainer}>
              {RELATIONSHIP_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  disabled={!isPremium}
                  style={[
                    styles.chip,
                    filters.relationshipType.includes(type) && styles.chipSelected,
                    !isPremium && styles.chipDisabled,
                  ]}
                  onPress={() =>
                    setFilters({
                      ...filters,
                      relationshipType: toggleArrayFilter(filters.relationshipType, type),
                    })
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.relationshipType.includes(type) && styles.chipTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Wants Children */}
          <View style={[styles.section, !isPremium && styles.disabledSection]}>
            <Text style={styles.sectionTitle}>Wants Children</Text>
            <View style={styles.chipContainer}>
              {[
                { label: 'Yes', value: true },
                { label: 'No', value: false },
                { label: 'Any', value: null },
              ].map((option) => (
                <TouchableOpacity
                  key={option.label}
                  disabled={!isPremium}
                  style={[
                    styles.chip,
                    filters.wantsChildren === option.value && styles.chipSelected,
                    !isPremium && styles.chipDisabled,
                  ]}
                  onPress={() => setFilters({ ...filters, wantsChildren: option.value })}
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.wantsChildren === option.value && styles.chipTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Religion */}
          <View style={[styles.section, !isPremium && styles.disabledSection]}>
            <Text style={styles.sectionTitle}>Religion</Text>
            <View style={styles.chipContainer}>
              {RELIGIONS.map((religion) => (
                <TouchableOpacity
                  key={religion}
                  disabled={!isPremium}
                  style={[
                    styles.chip,
                    filters.religion.includes(religion) && styles.chipSelected,
                    !isPremium && styles.chipDisabled,
                  ]}
                  onPress={() =>
                    setFilters({
                      ...filters,
                      religion: toggleArrayFilter(filters.religion, religion),
                    })
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.religion.includes(religion) && styles.chipTextSelected,
                    ]}
                  >
                    {religion}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Political Views */}
          <View style={[styles.section, !isPremium && styles.disabledSection]}>
            <Text style={styles.sectionTitle}>Political Views</Text>
            <View style={styles.chipContainer}>
              {POLITICAL_VIEWS.map((view) => (
                <TouchableOpacity
                  key={view}
                  disabled={!isPremium}
                  style={[
                    styles.chip,
                    filters.politicalViews.includes(view) && styles.chipSelected,
                    !isPremium && styles.chipDisabled,
                  ]}
                  onPress={() =>
                    setFilters({
                      ...filters,
                      politicalViews: toggleArrayFilter(filters.politicalViews, view),
                    })
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.politicalViews.includes(view) && styles.chipTextSelected,
                    ]}
                  >
                    {view}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Financial Arrangement */}
          <View style={[styles.section, !isPremium && styles.disabledSection]}>
            <Text style={styles.sectionTitle}>Financial Arrangement</Text>
            <View style={styles.chipContainer}>
              {FINANCIAL_ARRANGEMENTS.map((arrangement) => (
                <TouchableOpacity
                  key={arrangement}
                  disabled={!isPremium}
                  style={[
                    styles.chip,
                    filters.financialArrangement.includes(arrangement) && styles.chipSelected,
                    !isPremium && styles.chipDisabled,
                  ]}
                  onPress={() =>
                    setFilters({
                      ...filters,
                      financialArrangement: toggleArrayFilter(
                        filters.financialArrangement,
                        arrangement
                      ),
                    })
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.financialArrangement.includes(arrangement) && styles.chipTextSelected,
                    ]}
                  >
                    {arrangement}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Apply Button */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1F2937',
  },
  resetButton: {
    fontSize: 16,
    color: '#8B5CF6',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 32,
  },
  disabledSection: {
    opacity: 0.5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  rangeValues: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  rangeText: {
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  sliderContainer: {
    gap: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  chipSelected: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  chipDisabled: {
    backgroundColor: '#F3F4F6',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7280',
  },
  chipTextSelected: {
    color: 'white',
  },
  premiumBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  premiumBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  premiumBannerText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#92400E',
    flex: 1,
  },
  footer: {
    padding: 20,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  applyButton: {
    backgroundColor: '#8B5CF6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'white',
  },
});
