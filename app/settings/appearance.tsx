import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme, type ColorSchemePreference } from '@/lib/useColorScheme';

interface ThemeOption {
  id: ColorSchemePreference;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  labelKey: string;
  descriptionKey: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'system',
    icon: 'theme-light-dark',
    labelKey: 'appearanceSettings.system',
    descriptionKey: 'appearanceSettings.systemDescription',
  },
  {
    id: 'light',
    icon: 'white-balance-sunny',
    labelKey: 'appearanceSettings.light',
    descriptionKey: 'appearanceSettings.lightDescription',
  },
  {
    id: 'dark',
    icon: 'moon-waning-crescent',
    labelKey: 'appearanceSettings.dark',
    descriptionKey: 'appearanceSettings.darkDescription',
  },
];

export default function AppearanceSettings() {
  const { t } = useTranslation();
  const { preference, setColorSchemePreference, colors, isDarkColorScheme } = useColorScheme();
  const [selectedTheme, setSelectedTheme] = useState<ColorSchemePreference>(preference);

  const handleThemeChange = async (themeId: ColorSchemePreference) => {
    setSelectedTheme(themeId);
    await setColorSchemePreference(themeId);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.foreground }]}>{t('settings.appearance')}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Info Banner */}
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', delay: 100 }}
          style={styles.infoBanner}
        >
          <LinearGradient
            colors={isDarkColorScheme ? ['#1E1B4B', '#312E81'] : ['#EEF2FF', '#E0E7FF']}
            style={styles.infoBannerGradient}
          >
            <MaterialCommunityIcons name="palette-outline" size={24} color={isDarkColorScheme ? '#A5B4FC' : '#4F46E5'} />
            <View style={styles.infoBannerContent}>
              <Text style={[styles.infoBannerTitle, { color: isDarkColorScheme ? '#C7D2FE' : '#3730A3' }]}>
                {t('appearanceSettings.customizeAppearance')}
              </Text>
              <Text style={[styles.infoBannerText, { color: isDarkColorScheme ? '#A5B4FC' : '#4338CA' }]}>
                {t('appearanceSettings.customizeAppearanceMessage')}
              </Text>
            </View>
          </LinearGradient>
        </MotiView>

        {/* Theme Options */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>{t('appearanceSettings.theme')}</Text>

          {THEME_OPTIONS.map((option, index) => (
            <MotiView
              key={option.id}
              from={{ opacity: 0, translateY: 10 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'timing', duration: 300, delay: index * 80 }}
            >
              <TouchableOpacity
                style={[
                  styles.themeCard,
                  { backgroundColor: colors.card, borderColor: selectedTheme === option.id ? '#A08AB7' : 'transparent' },
                  selectedTheme === option.id && styles.themeCardSelected,
                ]}
                onPress={() => handleThemeChange(option.id)}
              >
                <View style={[
                  styles.iconContainer,
                  { backgroundColor: selectedTheme === option.id ? '#F3E8FF' : (isDarkColorScheme ? '#27272A' : '#F3F4F6') }
                ]}>
                  <MaterialCommunityIcons
                    name={option.icon}
                    size={28}
                    color={selectedTheme === option.id ? '#A08AB7' : colors.mutedForeground}
                  />
                </View>

                <View style={styles.themeContent}>
                  <Text style={[styles.themeName, { color: colors.foreground }]}>{t(option.labelKey)}</Text>
                  <Text style={[styles.themeDescription, { color: colors.mutedForeground }]}>{t(option.descriptionKey)}</Text>
                </View>

                {selectedTheme === option.id ? (
                  <MaterialCommunityIcons name="check-circle" size={24} color="#A08AB7" />
                ) : (
                  <MaterialCommunityIcons name="circle-outline" size={24} color={colors.border} />
                )}
              </TouchableOpacity>
            </MotiView>
          ))}
        </View>

        {/* Accessibility Note */}
        <View style={[styles.accessibilityNote, { backgroundColor: isDarkColorScheme ? '#1C1917' : '#FEF3C7' }]}>
          <MaterialCommunityIcons name="information-outline" size={20} color={isDarkColorScheme ? '#FCD34D' : '#D97706'} />
          <Text style={[styles.accessibilityText, { color: isDarkColorScheme ? '#FDE68A' : '#92400E' }]}>
            {t('appearanceSettings.accessibilityNote')}
          </Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
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
  },
  headerSpacer: {
    width: 40,
  },
  content: {
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
    marginBottom: 4,
  },
  infoBannerText: {
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginLeft: 24,
    marginBottom: 12,
  },
  themeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    borderWidth: 2,
  },
  themeCardSelected: {
    borderColor: '#A08AB7',
  },
  iconContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  themeContent: {
    flex: 1,
  },
  themeName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  themeDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  accessibilityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    marginHorizontal: 20,
    borderRadius: 12,
    marginTop: 8,
  },
  accessibilityText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
