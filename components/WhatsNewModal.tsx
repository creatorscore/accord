import { useEffect, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { getReleaseNotes, ReleaseNote, ReleaseFeature } from '@/lib/release-notes';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const STORAGE_KEY = 'whats_new_seen_version';

// Get current app version from app.json
const CURRENT_VERSION = Constants.expoConfig?.version || '1.0.0';

export default function WhatsNewModal() {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [releaseNote, setReleaseNote] = useState<ReleaseNote | null>(null);

  useEffect(() => {
    checkIfShouldShow();
  }, []);

  const checkIfShouldShow = async () => {
    try {
      // Get the last version the user has seen "What's New" for
      const seenVersion = await AsyncStorage.getItem(STORAGE_KEY);

      // If they haven't seen this version's notes yet, and we have notes for it
      if (seenVersion !== CURRENT_VERSION) {
        const notes = getReleaseNotes(CURRENT_VERSION);
        if (notes) {
          setReleaseNote(notes);
          setVisible(true);
        } else {
          // No notes for this version, mark as seen to prevent future checks
          await AsyncStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
        }
      }
    } catch (error) {
      console.error('Error checking What\'s New status:', error);
    }
  };

  const handleDismiss = async () => {
    try {
      // Mark this version as seen
      await AsyncStorage.setItem(STORAGE_KEY, CURRENT_VERSION);
      setVisible(false);
    } catch (error) {
      console.error('Error saving What\'s New status:', error);
      setVisible(false);
    }
  };

  if (!visible || !releaseNote) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleDismiss}
    >
      <View style={styles.overlay}>
        <Animated.View
          entering={FadeInUp.duration(400).springify()}
          style={styles.container}
        >
          {/* Header with gradient */}
          <LinearGradient
            colors={['#9B87CE', '#B8A9DD']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.header}
          >
            {/* Sparkle decorations */}
            <View style={styles.sparkleContainer}>
              <MaterialCommunityIcons name="star-four-points" size={16} color="rgba(255,255,255,0.4)" style={styles.sparkle1} />
              <MaterialCommunityIcons name="star-four-points" size={12} color="rgba(255,255,255,0.3)" style={styles.sparkle2} />
              <MaterialCommunityIcons name="star-four-points" size={20} color="rgba(255,255,255,0.5)" style={styles.sparkle3} />
            </View>

            <View style={styles.iconContainer}>
              <MaterialCommunityIcons name="gift-outline" size={40} color="#FFF" />
            </View>

            <Text style={styles.title}>{t('whatsNew.title')}</Text>
            <Text style={styles.version}>
              {t('whatsNew.version', { version: releaseNote.version })}
            </Text>
          </LinearGradient>

          {/* Headline */}
          <View style={styles.headlineContainer}>
            <Text style={styles.headline}>{t(releaseNote.headlineKey)}</Text>
          </View>

          {/* Features list */}
          <ScrollView
            style={styles.featuresScroll}
            contentContainerStyle={styles.featuresContent}
            showsVerticalScrollIndicator={false}
          >
            {releaseNote.features.map((feature, index) => (
              <Animated.View
                key={index}
                entering={FadeInDown.delay(100 * (index + 1)).duration(400)}
              >
                <FeatureItem feature={feature} t={t} />
              </Animated.View>
            ))}
          </ScrollView>

          {/* Continue button */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.continueButton}
              onPress={handleDismiss}
              activeOpacity={0.8}
            >
              <Text style={styles.continueButtonText}>{t('whatsNew.continue')}</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color="#FFF" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

interface FeatureItemProps {
  feature: ReleaseFeature;
  t: (key: string) => string;
}

function FeatureItem({ feature, t }: FeatureItemProps) {
  return (
    <View style={styles.featureItem}>
      <View style={styles.featureIconContainer}>
        <LinearGradient
          colors={['#F3E8FF', '#E9D5FF']}
          style={styles.featureIconBg}
        >
          <MaterialCommunityIcons
            name={feature.icon as any}
            size={24}
            color="#9B87CE"
          />
        </LinearGradient>
      </View>
      <View style={styles.featureContent}>
        <View style={styles.featureTitleRow}>
          <Text style={styles.featureTitle}>{t(feature.titleKey)}</Text>
          {feature.isNew && (
            <View style={styles.newBadge}>
              <Text style={styles.newBadgeText}>{t('whatsNew.new')}</Text>
            </View>
          )}
          {feature.isPremium && (
            <View style={styles.premiumBadge}>
              <MaterialCommunityIcons name="crown" size={10} color="#B8860B" />
              <Text style={styles.premiumBadgeText}>{t('common.premium')}</Text>
            </View>
          )}
        </View>
        <Text style={styles.featureDescription}>
          {t(feature.descriptionKey)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#FFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 380,
    maxHeight: SCREEN_HEIGHT * 0.8,
    overflow: 'hidden',
  },
  header: {
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  sparkleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  sparkle1: {
    position: 'absolute',
    top: 20,
    left: 30,
  },
  sparkle2: {
    position: 'absolute',
    top: 40,
    right: 40,
  },
  sparkle3: {
    position: 'absolute',
    bottom: 30,
    right: 60,
  },
  iconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 4,
  },
  version: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  headlineContainer: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headline: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 22,
  },
  featuresScroll: {
    maxHeight: SCREEN_HEIGHT * 0.35,
  },
  featuresContent: {
    padding: 16,
    paddingTop: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
  },
  featureIconContainer: {
    marginRight: 12,
  },
  featureIconBg: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureContent: {
    flex: 1,
  },
  featureTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: 4,
    gap: 6,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  featureDescription: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 18,
  },
  newBadge: {
    backgroundColor: '#10B981',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  newBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFF',
    textTransform: 'uppercase',
  },
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 2,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#B8860B',
  },
  footer: {
    padding: 20,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#9B87CE',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 24,
    gap: 8,
  },
  continueButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
});
