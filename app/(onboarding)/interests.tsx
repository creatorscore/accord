import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { goToPreviousOnboardingStep, goToNextOnboardingStep } from '@/lib/onboarding-navigation';
import { getGlobalStep } from '@/lib/onboarding-steps';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import OnboardingLayout from '@/components/onboarding/OnboardingLayout';
import { HOBBY_OPTIONS, getHobbyIcon, isPredefinedHobby, normalizeHobbies, DEFAULT_HOBBY_ICON } from '@/lib/hobby-options';

export default function Interests() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useTranslation();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [subStep, setSubStep] = useState(0);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [hobbies, setHobbies] = useState<string[]>([]);
  const [customHobby, setCustomHobby] = useState('');
  const [favoriteMovies, setFavoriteMovies] = useState('');
  const [favoriteMusic, setFavoriteMusic] = useState('');
  const [favoriteBooks, setFavoriteBooks] = useState('');
  const [favoriteTvShows, setFavoriteTvShows] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, hobbies, interests')
        .eq('user_id', user?.id)
        .single();

      if (error) throw error;
      setProfileId(data.id);

      if (data.hobbies && data.hobbies.length > 0) {
        setHobbies(normalizeHobbies(data.hobbies));
      }

      if (data.interests) {
        if (data.interests.movies?.length > 0) setFavoriteMovies(data.interests.movies.join(', '));
        if (data.interests.music?.length > 0) setFavoriteMusic(data.interests.music.join(', '));
        if (data.interests.books?.length > 0) setFavoriteBooks(data.interests.books.join(', '));
        if (data.interests.tv_shows?.length > 0) setFavoriteTvShows(data.interests.tv_shows.join(', '));
      }
    } catch (error: any) {
      Alert.alert(t('common.error'), t('onboarding.interests.loadError'));
    }
  };

  const toggleHobby = (hobby: string) => {
    if (hobbies.includes(hobby)) {
      setHobbies(hobbies.filter((h) => h !== hobby));
    } else {
      if (hobbies.length >= 10) {
        Alert.alert(t('onboarding.interests.maxHobbies'), t('onboarding.interests.maxHobbiesMsg'));
        return;
      }
      setHobbies([...hobbies, hobby]);
    }
  };

  const addCustomHobby = () => {
    const trimmedHobby = customHobby.trim();
    if (!trimmedHobby) return;

    if (hobbies.length >= 10) {
      Alert.alert(t('onboarding.interests.maxHobbies'), t('onboarding.interests.maxHobbiesMsg'));
      return;
    }

    const hobbyExists = hobbies.some(h =>
      h.toLowerCase().replace(/[^\w\s]/g, '') === trimmedHobby.toLowerCase()
    );

    if (hobbyExists) {
      Alert.alert(t('onboarding.interests.duplicateHobby'), t('onboarding.interests.duplicateHobbyMsg'));
      return;
    }

    setHobbies([...hobbies, trimmedHobby]);
    setCustomHobby('');
  };

  const handleSaveAndContinue = async () => {
    if (hobbies.length === 0) {
      Alert.alert(t('common.required'), t('onboarding.interests.selectOneHobby'));
      return;
    }

    if (!profileId) {
      Alert.alert(t('common.error'), t('onboarding.common.profileNotFound'));
      return;
    }

    try {
      setLoading(true);

      const movies = favoriteMovies.split(',').map(s => s.trim()).filter(Boolean);
      const music = favoriteMusic.split(',').map(s => s.trim()).filter(Boolean);
      const books = favoriteBooks.split(',').map(s => s.trim()).filter(Boolean);
      const tvShows = favoriteTvShows.split(',').map(s => s.trim()).filter(Boolean);

      const { error } = await supabase
        .from('profiles')
        .update({
          hobbies,
          interests: { movies, music, books, tv_shows: tvShows },
          onboarding_step: 5,
        })
        .eq('id', profileId);

      if (error) throw error;

      router.push('/(onboarding)/prompts');
    } catch (error: any) {
      Alert.alert(t('common.error'), error.message || t('onboarding.interests.saveError'));
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (subStep === 0) {
      goToPreviousOnboardingStep('/(onboarding)/interests');
    } else {
      setSubStep(subStep - 1);
    }
  };

  const handleContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (subStep === 0) {
      if (hobbies.length === 0) {
        Alert.alert(t('common.required'), t('onboarding.interests.selectOneHobby'));
        return;
      }
      setSubStep(1);
    } else {
      handleSaveAndContinue();
    }
  };

  const handleSkip = () => {
    handleSaveAndContinue();
  };

  const renderContent = () => {
    if (subStep === 0) {
      return (
        <View>
          <Text style={[styles.counter, { color: isDark ? '#A08AB7' : '#8B72A8' }]}>
            {t('onboarding.interests.selectedCount', { count: hobbies.length })}
          </Text>

          {/* Predefined hobby pills */}
          <View style={styles.pillContainer}>
            {HOBBY_OPTIONS.map((option) => {
              const selected = hobbies.includes(option.value);
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.pill,
                    selected
                      ? styles.pillSelected
                      : { borderColor: isDark ? '#3C3C4E' : '#E5E7EB' },
                  ]}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    toggleHobby(option.value);
                  }}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name={option.icon as any}
                    size={18}
                    color={selected ? '#FFFFFF' : isDark ? '#9CA3AF' : '#6B7280'}
                  />
                  <Text
                    style={[
                      styles.pillText,
                      selected
                        ? styles.pillTextSelected
                        : { color: isDark ? '#D1D5DB' : '#374151' },
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Custom hobbies not in predefined list */}
          {hobbies.filter(h => !isPredefinedHobby(h)).length > 0 && (
            <View style={styles.customChips}>
              {hobbies.filter(h => !isPredefinedHobby(h)).map((hobby) => (
                <TouchableOpacity
                  key={hobby}
                  style={styles.customChip}
                  onPress={() => toggleHobby(hobby)}
                >
                  <MaterialCommunityIcons name={DEFAULT_HOBBY_ICON as any} size={16} color="#FFFFFF" />
                  <Text style={styles.customChipText}>{hobby}</Text>
                  <MaterialCommunityIcons name="close" size={14} color="#FFFFFF" />
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Add Custom Hobby */}
          <View style={styles.customInput}>
            <TextInput
              style={[styles.customInputField, {
                backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA',
                color: isDark ? '#F5F5F7' : '#1A1A2E',
              }]}
              placeholder={t('onboarding.interests.addHobbyPlaceholder')}
              placeholderTextColor="#9CA3AF"
              value={customHobby}
              onChangeText={setCustomHobby}
              returnKeyType="done"
              onSubmitEditing={addCustomHobby}
              maxLength={30}
            />
            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: customHobby.trim() ? '#A08AB7' : isDark ? '#2C2C3E' : '#D1D5DB' }]}
              onPress={addCustomHobby}
              disabled={!customHobby.trim()}
            >
              <MaterialCommunityIcons name="plus" size={22} color="white" />
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // Sub-step 1: Favorites
    return (
      <View>
        {/* Movies */}
        <View style={styles.favoriteSection}>
          <Text style={[styles.favoriteLabel, { color: isDark ? '#F5F5F7' : '#1F2937' }]}>{t('onboarding.interests.movies')}</Text>
          <TextInput
            style={[styles.favoriteInput, {
              backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA',
              color: isDark ? '#F5F5F7' : '#1A1A2E',
            }]}
            placeholder={t('onboarding.interests.moviesPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={favoriteMovies}
            onChangeText={setFavoriteMovies}
          />
          <Text style={[styles.helperText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>{t('onboarding.interests.separateWithCommas')}</Text>
        </View>

        {/* Music */}
        <View style={styles.favoriteSection}>
          <Text style={[styles.favoriteLabel, { color: isDark ? '#F5F5F7' : '#1F2937' }]}>{t('onboarding.interests.musicArtists')}</Text>
          <TextInput
            style={[styles.favoriteInput, {
              backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA',
              color: isDark ? '#F5F5F7' : '#1A1A2E',
            }]}
            placeholder={t('onboarding.interests.musicPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={favoriteMusic}
            onChangeText={setFavoriteMusic}
          />
          <Text style={[styles.helperText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>{t('onboarding.interests.separateWithCommas')}</Text>
        </View>

        {/* Books */}
        <View style={styles.favoriteSection}>
          <Text style={[styles.favoriteLabel, { color: isDark ? '#F5F5F7' : '#1F2937' }]}>{t('onboarding.interests.books')}</Text>
          <TextInput
            style={[styles.favoriteInput, {
              backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA',
              color: isDark ? '#F5F5F7' : '#1A1A2E',
            }]}
            placeholder={t('onboarding.interests.booksPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={favoriteBooks}
            onChangeText={setFavoriteBooks}
          />
          <Text style={[styles.helperText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>{t('onboarding.interests.separateWithCommas')}</Text>
        </View>

        {/* TV Shows */}
        <View style={styles.favoriteSection}>
          <Text style={[styles.favoriteLabel, { color: isDark ? '#F5F5F7' : '#1F2937' }]}>{t('onboarding.interests.tvShows')}</Text>
          <TextInput
            style={[styles.favoriteInput, {
              backgroundColor: isDark ? '#1C1C2E' : '#F8F7FA',
              color: isDark ? '#F5F5F7' : '#1A1A2E',
            }]}
            placeholder={t('onboarding.interests.tvShowsPlaceholder')}
            placeholderTextColor="#9CA3AF"
            value={favoriteTvShows}
            onChangeText={setFavoriteTvShows}
          />
          <Text style={[styles.helperText, { color: isDark ? '#6B7280' : '#9CA3AF' }]}>{t('onboarding.interests.separateWithCommas')}</Text>
        </View>
      </View>
    );
  };

  return (
    <OnboardingLayout
      currentStep={getGlobalStep('interests', subStep)}
      title={subStep === 0 ? t('onboarding.interests.title') : t('onboarding.interests.favoritesTitle')}
      subtitle={subStep === 0 ? t('onboarding.interests.subtitle') : t('onboarding.interests.favoritesSubtitle')}
      onBack={handleBack}
      onContinue={handleContinue}
      onSkip={() => goToNextOnboardingStep('/(onboarding)/interests')}
      continueDisabled={loading || (subStep === 0 && hobbies.length === 0)}
      continueLabel={loading ? t('common.saving') : t('common.continue')}
    >
      {renderContent()}
    </OnboardingLayout>
  );
}

const styles = StyleSheet.create({
  counter: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
  },
  pillContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 100,
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  pillSelected: {
    backgroundColor: '#A08AB7',
    borderColor: '#A08AB7',
  },
  pillText: {
    fontSize: 14,
    fontWeight: '500',
  },
  pillTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  customChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  customChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#A08AB7',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 100,
  },
  customChipText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  customInput: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  customInputField: {
    flex: 1,
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 15,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteSection: {
    marginBottom: 24,
  },
  favoriteLabel: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  favoriteInput: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
  },
  helperText: {
    fontSize: 12,
    marginTop: 4,
  },
});
