import { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface FilterOptions {
  // Free filters
  ageMin: number;
  ageMax: number;
  maxDistance: number;
  activeToday: boolean;
  showBlurredPhotos: boolean;

  // Premium filters (existing)
  religion: string[];
  politicalViews: string[];
  housingPreference: string[];
  financialArrangement: string[];

  // Premium filters (new - Identity & Background)
  genderPreference: string[];
  ethnicity: string[];
  sexualOrientation: string[];

  // Premium filters (new - Physical & Personality)
  heightMin: number;
  heightMax: number;
  zodiacSign: string[];
  personalityType: string[];
  loveLanguage: string[];

  // Premium filters (new - Lifestyle)
  languagesSpoken: string[];
  smoking: string[];
  drinking: string[];
  pets: string[];

  // Premium filters (new - Marriage Intentions)
  primaryReason: string[];
  relationshipType: string[];
  wantsChildren: string | null;
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterOptions) => void;
  currentFilters: FilterOptions;
  isPremium: boolean;
  onUpgrade: () => void;
}

// Option arrays - matching onboarding values
const GENDERS = ['Man', 'Woman', 'Non-binary', 'Trans Man', 'Trans Woman', 'Genderqueer', 'Agender', 'Other'];
const ETHNICITIES = ['Asian', 'Black/African', 'Hispanic/Latinx', 'Indigenous/Native', 'Middle Eastern/North African', 'Pacific Islander', 'South Asian', 'White/Caucasian', 'Multiracial', 'Other'];
const SEXUAL_ORIENTATIONS = ['Straight', 'Lesbian', 'Gay', 'Bisexual', 'Queer', 'Asexual', 'Pansexual', 'Other'];
const ZODIAC_SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const PERSONALITY_TYPES = ['INTJ', 'INTP', 'ENTJ', 'ENTP', 'INFJ', 'INFP', 'ENFJ', 'ENFP', 'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ', 'ISTP', 'ISFP', 'ESTP', 'ESFP'];
const LOVE_LANGUAGES = ['Words of Affirmation', 'Quality Time', 'Receiving Gifts', 'Acts of Service', 'Physical Touch'];
const LANGUAGES = ['English', 'Spanish', 'French', 'Mandarin', 'Cantonese', 'Japanese', 'Korean', 'Vietnamese', 'Tagalog', 'Hindi', 'Arabic', 'Portuguese', 'German', 'Italian', 'Russian', 'Other'];
const RELIGIONS = ['Christian', 'Catholic', 'Muslim', 'Jewish', 'Hindu', 'Buddhist', 'Atheist', 'Agnostic', 'Spiritual', 'Other'];
const POLITICAL_VIEWS = ['Liberal', 'Progressive', 'Moderate', 'Conservative', 'Libertarian', 'Other'];
const SMOKING_OPTIONS = ['Never', 'Socially', 'Regularly'];
const DRINKING_OPTIONS = ['Never', 'Socially', 'Regularly'];
const PET_OPTIONS = ['Dogs', 'Cats', 'Both', 'Other Pets', 'No Pets', 'Allergic'];
const HOUSING_PREFERENCES = ['Separate Homes', 'Separate Spaces', 'Roommates', 'Shared Bedroom', 'Flexible'];
const FINANCIAL_ARRANGEMENTS = ['Separate', 'Shared Expenses', 'Joint', 'Prenup Required', 'Flexible'];
const PRIMARY_REASONS = ['Financial Benefits', 'Immigration', 'Family Pressure', 'Legal Benefits', 'Companionship', 'Safety', 'Other'];
const RELATIONSHIP_TYPES = ['Platonic', 'Romantic', 'Open'];
const WANTS_CHILDREN_OPTIONS = ['Yes', 'No', 'Maybe'];

// Height conversion helpers
const inchesToFeetDisplay = (inches: number): string => {
  const feet = Math.floor(inches / 12);
  const remainingInches = inches % 12;
  return `${feet}'${remainingInches}"`;
};

export default function FilterModal({
  visible,
  onClose,
  onApply,
  currentFilters,
  isPremium,
  onUpgrade,
}: FilterModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState<FilterOptions>(currentFilters);
  const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
    identity: false,
    physical: false,
    lifestyle: false,
    marriage: false,
  });

  useEffect(() => {
    setFilters(currentFilters);
  }, [currentFilters, visible]);

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleReset = () => {
    const defaultFilters: FilterOptions = {
      // Free filters
      ageMin: 22,
      ageMax: 50,
      maxDistance: 100,
      activeToday: false,
      showBlurredPhotos: true,
      // Premium filters
      religion: [],
      politicalViews: [],
      housingPreference: [],
      financialArrangement: [],
      genderPreference: [],
      ethnicity: [],
      sexualOrientation: [],
      heightMin: 48, // 4'0"
      heightMax: 84, // 7'0"
      zodiacSign: [],
      personalityType: [],
      loveLanguage: [],
      languagesSpoken: [],
      smoking: [],
      drinking: [],
      pets: [],
      primaryReason: [],
      relationshipType: [],
      wantsChildren: null,
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

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getSelectedCount = (arrays: string[][]): number => {
    return arrays.reduce((sum, arr) => sum + arr.length, 0);
  };

  const renderCollapsibleSection = (
    key: string,
    title: string,
    icon: string,
    selectedCount: number,
    children: React.ReactNode
  ) => {
    const isExpanded = expandedSections[key];

    return (
      <View style={[styles.collapsibleSection, !isPremium && styles.disabledSection]}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => isPremium && toggleSection(key)}
          disabled={!isPremium}
        >
          <View style={styles.sectionHeaderLeft}>
            <MaterialCommunityIcons name={icon as any} size={22} color={isPremium ? '#A08AB7' : '#9CA3AF'} />
            <Text style={[styles.sectionHeaderTitle, !isPremium && styles.disabledText]}>{title}</Text>
          </View>
          <View style={styles.sectionHeaderRight}>
            {selectedCount > 0 && (
              <View style={styles.selectedBadge}>
                <Text style={styles.selectedBadgeText}>{selectedCount}</Text>
              </View>
            )}
            <MaterialCommunityIcons
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={24}
              color={isPremium ? '#6B7280' : '#9CA3AF'}
            />
          </View>
        </TouchableOpacity>
        {isExpanded && isPremium && (
          <View style={styles.sectionContent}>
            {children}
          </View>
        )}
      </View>
    );
  };

  const renderChips = (
    options: string[],
    selectedValues: string[],
    filterKey: keyof FilterOptions,
    disabled: boolean = false
  ) => (
    <View style={styles.chipContainer}>
      {options.map((option) => (
        <TouchableOpacity
          key={option}
          disabled={disabled}
          style={[
            styles.chip,
            selectedValues.includes(option) && styles.chipSelected,
            disabled && styles.chipDisabled,
          ]}
          onPress={() =>
            setFilters({
              ...filters,
              [filterKey]: toggleArrayFilter(selectedValues, option),
            })
          }
        >
          <Text
            style={[
              styles.chipText,
              selectedValues.includes(option) && styles.chipTextSelected,
            ]}
          >
            {option}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderSubsection = (title: string, children: React.ReactNode) => (
    <View style={styles.subsection}>
      <Text style={styles.subsectionTitle}>{title}</Text>
      {children}
    </View>
  );

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
          {/* FREE FILTERS SECTION */}
          <View style={styles.freeSectionHeader}>
            <Text style={styles.freeSectionTitle}>Basic Filters</Text>
          </View>

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
                onValueChange={(value) => setFilters({ ...filters, ageMin: Math.min(value, filters.ageMax - 1) })}
                minimumTrackTintColor="#A08AB7"
                maximumTrackTintColor="#E5E7EB"
              />
              <Slider
                style={styles.slider}
                minimumValue={18}
                maximumValue={80}
                step={1}
                value={filters.ageMax}
                onValueChange={(value) => setFilters({ ...filters, ageMax: Math.max(value, filters.ageMin + 1) })}
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

          {/* Active Today Toggle */}
          <View style={styles.toggleSection}>
            <View style={styles.toggleContent}>
              <MaterialCommunityIcons name="clock-outline" size={22} color="#A08AB7" />
              <View style={styles.toggleTextContainer}>
                <Text style={styles.toggleTitle}>Active Today</Text>
                <Text style={styles.toggleDescription}>Only show users active in the last 24 hours</Text>
              </View>
            </View>
            <Switch
              value={filters.activeToday}
              onValueChange={(value) => setFilters({ ...filters, activeToday: value })}
              trackColor={{ false: '#E5E7EB', true: '#A08AB7' }}
              thumbColor="white"
            />
          </View>

          {/* Show Blurred Photos Toggle */}
          <View style={styles.toggleSection}>
            <View style={styles.toggleContent}>
              <MaterialCommunityIcons name="blur" size={22} color="#A08AB7" />
              <View style={styles.toggleTextContainer}>
                <Text style={styles.toggleTitle}>Show Blurred Photos</Text>
                <Text style={styles.toggleDescription}>Include profiles with photo blur enabled</Text>
              </View>
            </View>
            <Switch
              value={filters.showBlurredPhotos}
              onValueChange={(value) => setFilters({ ...filters, showBlurredPhotos: value })}
              trackColor={{ false: '#E5E7EB', true: '#A08AB7' }}
              thumbColor="white"
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

          {/* PREMIUM FILTERS SECTION */}
          <View style={styles.premiumSectionHeader}>
            <MaterialCommunityIcons name="crown" size={20} color="#FFD700" />
            <Text style={styles.premiumSectionTitle}>Advanced Filters</Text>
          </View>

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

          {/* Identity & Background Section */}
          {renderCollapsibleSection(
            'identity',
            'Identity & Background',
            'account-outline',
            getSelectedCount([filters.genderPreference, filters.ethnicity, filters.sexualOrientation]),
            <>
              {renderSubsection('Gender', renderChips(GENDERS, filters.genderPreference, 'genderPreference'))}
              {renderSubsection('Ethnicity', renderChips(ETHNICITIES, filters.ethnicity, 'ethnicity'))}
              {renderSubsection('Sexual Orientation', renderChips(SEXUAL_ORIENTATIONS, filters.sexualOrientation, 'sexualOrientation'))}
            </>
          )}

          {/* Physical & Personality Section */}
          {renderCollapsibleSection(
            'physical',
            'Physical & Personality',
            'account-heart-outline',
            getSelectedCount([filters.zodiacSign, filters.personalityType, filters.loveLanguage]) +
              (filters.heightMin !== 48 || filters.heightMax !== 84 ? 1 : 0),
            <>
              {renderSubsection('Height Range', (
                <>
                  <View style={styles.rangeValues}>
                    <Text style={styles.rangeText}>{inchesToFeetDisplay(filters.heightMin)}</Text>
                    <Text style={styles.rangeText}>{inchesToFeetDisplay(filters.heightMax)}</Text>
                  </View>
                  <View style={styles.sliderContainer}>
                    <Slider
                      style={styles.slider}
                      minimumValue={48}
                      maximumValue={84}
                      step={1}
                      value={filters.heightMin}
                      onValueChange={(value) => setFilters({ ...filters, heightMin: Math.min(value, filters.heightMax - 1) })}
                      minimumTrackTintColor="#A08AB7"
                      maximumTrackTintColor="#E5E7EB"
                    />
                    <Slider
                      style={styles.slider}
                      minimumValue={48}
                      maximumValue={84}
                      step={1}
                      value={filters.heightMax}
                      onValueChange={(value) => setFilters({ ...filters, heightMax: Math.max(value, filters.heightMin + 1) })}
                      minimumTrackTintColor="#A08AB7"
                      maximumTrackTintColor="#E5E7EB"
                    />
                  </View>
                </>
              ))}
              {renderSubsection('Zodiac Sign', renderChips(ZODIAC_SIGNS, filters.zodiacSign, 'zodiacSign'))}
              {renderSubsection('MBTI Personality Type', renderChips(PERSONALITY_TYPES, filters.personalityType, 'personalityType'))}
              {renderSubsection('Love Language', renderChips(LOVE_LANGUAGES, filters.loveLanguage, 'loveLanguage'))}
            </>
          )}

          {/* Lifestyle Section */}
          {renderCollapsibleSection(
            'lifestyle',
            'Lifestyle',
            'heart-pulse',
            getSelectedCount([filters.religion, filters.politicalViews, filters.languagesSpoken, filters.smoking, filters.drinking, filters.pets]),
            <>
              {renderSubsection('Religion', renderChips(RELIGIONS, filters.religion, 'religion'))}
              {renderSubsection('Political Views', renderChips(POLITICAL_VIEWS, filters.politicalViews, 'politicalViews'))}
              {renderSubsection('Languages Spoken', renderChips(LANGUAGES, filters.languagesSpoken, 'languagesSpoken'))}
              {renderSubsection('Smoking', renderChips(SMOKING_OPTIONS, filters.smoking, 'smoking'))}
              {renderSubsection('Drinking', renderChips(DRINKING_OPTIONS, filters.drinking, 'drinking'))}
              {renderSubsection('Pets', renderChips(PET_OPTIONS, filters.pets, 'pets'))}
            </>
          )}

          {/* Marriage Intentions Section */}
          {renderCollapsibleSection(
            'marriage',
            'Marriage Intentions',
            'ring',
            getSelectedCount([filters.housingPreference, filters.financialArrangement, filters.primaryReason, filters.relationshipType]) +
              (filters.wantsChildren ? 1 : 0),
            <>
              {renderSubsection('Primary Reason', renderChips(PRIMARY_REASONS, filters.primaryReason, 'primaryReason'))}
              {renderSubsection('Relationship Type', renderChips(RELATIONSHIP_TYPES, filters.relationshipType, 'relationshipType'))}
              {renderSubsection('Wants Children', (
                <View style={styles.chipContainer}>
                  {WANTS_CHILDREN_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.chip,
                        filters.wantsChildren === option.toLowerCase() && styles.chipSelected,
                      ]}
                      onPress={() =>
                        setFilters({
                          ...filters,
                          wantsChildren: filters.wantsChildren === option.toLowerCase() ? null : option.toLowerCase(),
                        })
                      }
                    >
                      <Text
                        style={[
                          styles.chipText,
                          filters.wantsChildren === option.toLowerCase() && styles.chipTextSelected,
                        ]}
                      >
                        {option}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
              {renderSubsection('Housing Preference', renderChips(HOUSING_PREFERENCES, filters.housingPreference, 'housingPreference'))}
              {renderSubsection('Financial Arrangement', renderChips(FINANCIAL_ARRANGEMENTS, filters.financialArrangement, 'financialArrangement'))}
            </>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Apply Button */}
        <View style={[styles.footer, { paddingBottom: Math.max(20, insets.bottom) }]}>
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
  freeSectionHeader: {
    marginBottom: 16,
  },
  freeSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  premiumSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 16,
  },
  premiumSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 24,
  },
  disabledSection: {
    opacity: 0.6,
  },
  disabledText: {
    color: '#9CA3AF',
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
  toggleSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  toggleDescription: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  collapsibleSection: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectedBadge: {
    backgroundColor: '#A08AB7',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  selectedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: 'white',
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  subsection: {
    marginTop: 16,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  chipSelected: {
    backgroundColor: '#A08AB7',
    borderColor: '#A08AB7',
  },
  chipDisabled: {
    backgroundColor: '#F3F4F6',
    opacity: 0.5,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4B5563',
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
    marginBottom: 20,
    marginTop: 8,
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
    marginBottom: 16,
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
