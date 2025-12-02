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
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

export interface FilterOptions {
  ageMin: number;
  ageMax: number;
  maxDistance: number;
  religion: string[];
  politicalViews: string[];
  housingPreference: string[];
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

const RELIGIONS = ['Christian', 'Catholic', 'Muslim', 'Jewish', 'Hindu', 'Buddhist', 'Atheist', 'Agnostic', 'Spiritual', 'Other'];
const POLITICAL_VIEWS = ['Liberal', 'Progressive', 'Moderate', 'Conservative', 'Libertarian', 'Other'];
const HOUSING_PREFERENCES = ['Separate Homes', 'Separate Spaces', 'Roommates', 'Shared Bedroom', 'Flexible'];
const FINANCIAL_ARRANGEMENTS = ['Separate', 'Shared Expenses', 'Joint', 'Prenup Required', 'Flexible'];

export default function FilterModal({
  visible,
  onClose,
  onApply,
  currentFilters,
  isPremium,
  onUpgrade,
}: FilterModalProps) {
  const { t } = useTranslation();
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
      religion: [],
      politicalViews: [],
      housingPreference: [],
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
          <Text style={styles.headerTitle}>{t('filters.title')}</Text>
          <TouchableOpacity onPress={handleReset}>
            <Text style={styles.resetButton}>{t('filters.reset')}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Age Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('filters.ageRange')}</Text>
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
                minimumTrackTintColor="#A08AB7"
                maximumTrackTintColor="#E5E7EB"
              />
              <Slider
                style={styles.slider}
                minimumValue={18}
                maximumValue={80}
                step={1}
                value={filters.ageMax}
                onValueChange={(value) => setFilters({ ...filters, ageMax: value })}
                minimumTrackTintColor="#A08AB7"
                maximumTrackTintColor="#E5E7EB"
              />
            </View>
          </View>

          {/* Distance */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t('filters.maxDistance')}</Text>
            <Text style={styles.rangeText}>{t('filters.miles', { count: filters.maxDistance })}</Text>
            <Slider
              style={styles.slider}
              minimumValue={5}
              maximumValue={500}
              step={5}
              value={filters.maxDistance}
              onValueChange={(value) => setFilters({ ...filters, maxDistance: value })}
              minimumTrackTintColor="#A08AB7"
              maximumTrackTintColor="#E5E7EB"
            />
          </View>

          {/* Compatibility Note */}
          <View style={styles.infoBox}>
            <MaterialCommunityIcons name="information" size={20} color="#A08AB7" />
            <Text style={styles.infoText}>
              {t('filters.dealbreakersInfo')}
            </Text>
          </View>

          {/* Edit Preferences Button */}
          <TouchableOpacity
            style={styles.editPreferencesButton}
            onPress={() => {
              onClose();
              router.push('/settings/matching-preferences');
            }}
          >
            <View style={styles.editPreferencesContent}>
              <View style={styles.editPreferencesIcon}>
                <MaterialCommunityIcons name="heart-cog" size={24} color="#A08AB7" />
              </View>
              <View style={styles.editPreferencesText}>
                <Text style={styles.editPreferencesTitle}>{t('filters.editPreferences')}</Text>
                <Text style={styles.editPreferencesDescription}>
                  {t('filters.editPreferencesDesc')}
                </Text>
              </View>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={24} color="#A08AB7" />
          </TouchableOpacity>

          {/* Premium Filters */}
          {!isPremium && (
            <TouchableOpacity style={styles.premiumBanner} onPress={onUpgrade}>
              <View style={styles.premiumBannerContent}>
                <MaterialCommunityIcons name="crown" size={24} color="#FFD700" />
                <Text style={styles.premiumBannerText}>
                  {t('filters.upgradePremium')}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#A08AB7" />
            </TouchableOpacity>
          )}

          {/* Religion */}
          <View style={[styles.section, !isPremium && styles.disabledSection]}>
            <Text style={styles.sectionTitle}>{t('filters.religion')}</Text>
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
            <Text style={styles.sectionTitle}>{t('filters.politicalViews')}</Text>
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

          {/* Housing Preference */}
          <View style={[styles.section, !isPremium && styles.disabledSection]}>
            <Text style={styles.sectionTitle}>{t('filters.housingPreference')}</Text>
            <View style={styles.chipContainer}>
              {HOUSING_PREFERENCES.map((housing) => (
                <TouchableOpacity
                  key={housing}
                  disabled={!isPremium}
                  style={[
                    styles.chip,
                    filters.housingPreference.includes(housing) && styles.chipSelected,
                    !isPremium && styles.chipDisabled,
                  ]}
                  onPress={() =>
                    setFilters({
                      ...filters,
                      housingPreference: toggleArrayFilter(filters.housingPreference, housing),
                    })
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.housingPreference.includes(housing) && styles.chipTextSelected,
                    ]}
                  >
                    {housing}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Financial Arrangement */}
          <View style={[styles.section, !isPremium && styles.disabledSection]}>
            <Text style={styles.sectionTitle}>{t('filters.financialArrangement')}</Text>
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
            <Text style={styles.applyButtonText}>{t('filters.applyFilters')}</Text>
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
    color: '#A08AB7',
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
    backgroundColor: '#A08AB7',
    borderColor: '#A08AB7',
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
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    backgroundColor: '#F3E8FF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#6B21A8',
    lineHeight: 20,
  },
  editPreferencesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 2,
    borderColor: '#A08AB7',
  },
  editPreferencesContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  editPreferencesIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editPreferencesText: {
    flex: 1,
  },
  editPreferencesTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#A08AB7',
    marginBottom: 2,
  },
  editPreferencesDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
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
    backgroundColor: '#A08AB7',
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
