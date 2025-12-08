import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Alert,
  StatusBar,
  Linking,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { supabase } from '@/lib/supabase';
import { useColorScheme } from '@/lib/useColorScheme';
import PremiumPaywall from '@/components/premium/PremiumPaywall';
import ProfilePhotoCarousel from '@/components/profile/ProfilePhotoCarousel';
import ProfileStoryCard from '@/components/profile/ProfileStoryCard';
import ProfileInteractiveSection from '@/components/profile/ProfileInteractiveSection';
import ProfileQuickFacts from '@/components/profile/ProfileQuickFacts';
import ProfileVoiceNote from '@/components/profile/ProfileVoiceNote';
import ImmersiveProfileCard from '@/components/matching/ImmersiveProfileCard';

// Helper function to format arrays or strings (handles PostgreSQL array strings)
const formatArrayOrString = (value?: string | string[]): string => {
  if (!value) return '';

  // Handle actual arrays
  if (Array.isArray(value)) {
    return value.join(', ');
  }

  // Handle PostgreSQL array format strings like "{value1,value2}"
  if (typeof value === 'string') {
    // Check if it's a PostgreSQL array string
    if (value.startsWith('{') && value.endsWith('}')) {
      const items = value.slice(1, -1).split(',');
      return items.join(', ');
    }
    // Check if it's a JSON array string like '["value1","value2"]'
    if (value.startsWith('[') && value.endsWith(']')) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) {
          return parsed.join(', ');
        }
      } catch (e) {
        // Not valid JSON, just return as-is
      }
    }
  }

  return value;
};

interface ProfileData {
  id: string;
  display_name: string;
  birth_date?: string;
  age: number;
  bio?: string;
  occupation?: string;
  education?: string;
  location_city?: string;
  location_state?: string;
  gender?: string;
  pronouns?: string;
  ethnicity?: string;
  sexual_orientation?: string;
  height_inches?: number;
  height_unit?: string;
  zodiac_sign?: string;
  personality_type?: string;
  is_verified: boolean;
  photos?: Array<{ url: string; is_primary?: boolean; display_order?: number; caption?: string }>;
  prompt_answers?: Array<{ prompt: string; answer: string }>;
  interests?: string[];
  hobbies?: string[];
  love_language?: string;
  languages_spoken?: string[];
  religion?: string;
  political_views?: string;
  voice_intro_url?: string;
  voice_intro_duration?: number;
}

export default function Profile() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const { isPremium, isPlatinum, subscriptionTier, isLoading: subscriptionLoading } = useSubscription();
  const { colors, isDarkColorScheme } = useColorScheme();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [preferences, setPreferences] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  // Reload profile when user changes (handles OAuth sign-in timing)
  useEffect(() => {
    if (user?.id && !profile) {
      loadProfile();
    }
  }, [user]);

  // Reload profile when screen comes into focus (fixes photo caching issue)
  useFocusEffect(
    useCallback(() => {
      if (user?.id) {
        loadProfile();
      }
    }, [user?.id])
  );

  const loadProfile = async () => {
    try {
      // Safety check: ensure user is loaded before querying
      if (!user?.id) {
        console.log('User not loaded yet, retrying...');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select(`
          id,
          display_name,
          birth_date,
          age,
          bio,
          occupation,
          education,
          location_city,
          location_state,
          gender,
          pronouns,
          ethnicity,
          sexual_orientation,
          height_inches,
          height_unit,
          zodiac_sign,
          personality_type,
          is_verified,
          photo_verified,
          is_admin,
          prompt_answers,
          interests,
          hobbies,
          love_language,
          languages_spoken,
          religion,
          political_views,
          voice_intro_url,
          voice_intro_duration,
          photos (
            url,
            is_primary,
            display_order
          )
        `)
        .eq('user_id', user.id)
        .single();

      if (error) {
        // If profile doesn't exist (PGRST116 = no rows), redirect to onboarding
        if (error.code === 'PGRST116') {
          console.log('No profile found, redirecting to onboarding');
          router.replace('/(onboarding)/basic-info');
          return;
        }
        throw error;
      }

      // Sort photos by display order
      const sortedPhotos = data.photos?.sort((a: any, b: any) =>
        (a.display_order || 0) - (b.display_order || 0)
      );

      setProfile({
        ...data,
        photos: sortedPhotos,
      });

      // Set admin status
      setIsAdmin(data.is_admin || false);
    } catch (error: any) {
      console.error('Error loading profile:', error);
      Alert.alert(
        t('profile.errorLoadingProfileTitle'),
        t('profile.errorLoadingProfileMessage'),
        [
          {
            text: t('profile.signOut'),
            style: 'destructive',
            onPress: async () => {
              try {
                await signOut();
                router.replace('/(auth)/welcome');
              } catch (err) {
                console.error('Sign out error:', err);
              }
            }
          },
          { text: t('profile.retry'), onPress: loadProfile }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      t('profile.signOutDialog.title'),
      t('profile.signOutDialog.message'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.signOutDialog.confirm'),
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/(auth)/welcome');
            } catch (error) {
              Alert.alert(t('common.error'), t('profile.signOutDialog.error'));
            }
          },
        },
      ]
    );
  };

  const handlePreviewProfile = async () => {
    if (!profile) return;

    try {
      // Load preferences for preview
      const { data: prefsData } = await supabase
        .from('preferences')
        .select('*')
        .eq('profile_id', profile.id)
        .single();

      setPreferences(prefsData);
      setShowPreview(true);
    } catch (error) {
      console.error('Error loading preferences for preview:', error);
      // Show preview anyway, just without preferences
      setShowPreview(true);
    }
  };

  if (loading || subscriptionLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>{t('profile.loadingProfile')}</Text>
        </View>
      </View>
    );
  }

  // Prepare quick facts for display
  const quickFacts = [];
  if (profile?.occupation) {
    quickFacts.push({
      emoji: '💼',
      label: t('profile.work'),
      value: profile.occupation,
    });
  }
  if (profile?.location_city) {
    quickFacts.push({
      emoji: '📍',
      label: t('profile.location'),
      value: profile.location_city,
    });
  }
  if (profile?.education) {
    quickFacts.push({
      emoji: '🎓',
      label: t('profile.education'),
      value: profile.education,
    });
  }
  if (profile?.is_verified) {
    quickFacts.push({
      emoji: '✅',
      label: t('profile.status'),
      value: t('profile.verified'),
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={isDarkColorScheme ? "light-content" : "dark-content"} />

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Enhanced Photo Carousel */}
        {profile?.photos && profile.photos.length > 0 ? (
          <ProfilePhotoCarousel
            profileId={profile.id}
            photos={profile.photos}
            name={profile.display_name}
            age={profile.age}
            isVerified={profile.is_verified}
          />
        ) : (
          <View style={styles.placeholderHeader}>
            <LinearGradient
              colors={['#A08AB7', '#CDC2E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.placeholderGradient}
            >
              <View style={styles.placeholderPhotoContainer}>
                <MaterialCommunityIcons name="camera-plus" size={40} color="white" />
                <Text style={styles.placeholderText}>{t('profile.addPhotos')}</Text>
              </View>
              <Text style={styles.placeholderName}>
                {profile?.display_name}, {profile?.age}
              </Text>
            </LinearGradient>
          </View>
        )}

        {/* Quick Facts */}
        {quickFacts.length > 0 && (
          <View style={{ position: 'relative', zIndex: 100, overflow: 'visible' }}>
            <ProfileQuickFacts facts={quickFacts} />
          </View>
        )}

        {/* Voice Introduction */}
        {profile?.voice_intro_url && (
          <View style={{ paddingHorizontal: 20, marginTop: 12, marginBottom: 16, position: 'relative', zIndex: 100 }}>
            <ProfileVoiceNote
              voiceUrl={profile.voice_intro_url}
              duration={profile.voice_intro_duration}
              profileName="Your"
            />
          </View>
        )}

        {/* Profile Content */}
        <View style={styles.content}>
          {/* Bio Story Card */}
          {profile?.bio && (
            <ProfileStoryCard
              title={t('profile.aboutMe')}
              icon="book-open-variant"
              content={profile.bio}
              gradient={['#A08AB7', '#CDC2E5']}
              delay={100}
            />
          )}

          {/* Prompt Answers */}
          {profile?.prompt_answers && profile.prompt_answers.length > 0 && (
            <View>
              {profile.prompt_answers.map((pa, index) => (
                <ProfileStoryCard
                  key={index}
                  title={pa.prompt}
                  icon="comment-quote"
                  content={pa.answer}
                  gradient={
                    index % 3 === 0 ? ['#10B981', '#34D399'] :
                    index % 3 === 1 ? ['#F59E0B', '#FBBF24'] :
                    ['#3B82F6', '#60A5FA']
                  }
                  delay={200 + index * 100}
                />
              ))}
            </View>
          )}

          {/* Interests Section - interests is a JSONB object {movies: [], music: [], books: [], tv_shows: []} */}
          {profile?.interests && typeof profile.interests === 'object' && Object.keys(profile.interests).length > 0 && (
            <View style={{ marginBottom: 16 }}>
              <Text style={{
                fontSize: 20,
                fontWeight: 'bold',
                color: colors.foreground,
                marginBottom: 12,
              }}>{t('profile.myInterests')}</Text>
              <View style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: 8,
              }}>
                {Object.entries(profile.interests).flatMap(([category, items]) =>
                  Array.isArray(items) && items.length > 0 ? items : []
                ).map((interest, index) => (
                  <MotiView
                    key={index}
                    from={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', delay: index * 50 }}
                    style={{
                      backgroundColor: isDarkColorScheme
                        ? (index % 3 === 0 ? 'rgba(160, 138, 183, 0.2)' :
                           index % 3 === 1 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(59, 130, 246, 0.2)')
                        : (index % 3 === 0 ? '#F5F2F7' :
                           index % 3 === 1 ? '#FEF3C7' : '#DBEAFE'),
                      paddingHorizontal: 16,
                      paddingVertical: 8,
                      borderRadius: 20,
                    }}
                  >
                    <Text style={{
                      color: index % 3 === 0 ? '#A08AB7' :
                             index % 3 === 1 ? '#F59E0B' : '#3B82F6',
                      fontWeight: '600',
                      fontSize: 14,
                    }}>{interest}</Text>
                  </MotiView>
                ))}
              </View>
            </View>
          )}

          {/* About Section */}
          {(profile?.occupation || profile?.education || profile?.location_city || profile?.gender || profile?.sexual_orientation) && (
            <ProfileInteractiveSection
              title={t('profile.aboutMe')}
              expandable={false}
              items={[
                ...(profile.occupation ? [{
                  icon: 'briefcase',
                  label: t('profile.career'),
                  value: profile.occupation,
                }] : []),
                ...(profile.education ? [{
                  icon: 'school',
                  label: t('profile.education'),
                  value: profile.education,
                }] : []),
                ...(profile.location_city ? [{
                  icon: 'map-marker',
                  label: t('profile.location'),
                  value: `${profile.location_city}${profile.location_state ? `, ${profile.location_state}` : ''}`,
                }] : []),
                ...(profile.gender ? [{
                  icon: 'gender-transgender',
                  label: t('profile.gender'),
                  value: formatArrayOrString(profile.gender),
                }] : []),
                ...(profile.sexual_orientation ? [{
                  icon: 'heart',
                  label: t('profile.orientation'),
                  value: formatArrayOrString(profile.sexual_orientation),
                }] : []),
              ]}
            />
          )}

          {/* Edit Profile Button */}
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => router.push('/settings/edit-profile')}
          >
            <LinearGradient
              colors={['#A08AB7', '#CDC2E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.editProfileGradient}
            >
              <MaterialCommunityIcons name="pencil" size={20} color="white" />
              <Text style={styles.editProfileText}>{t('profile.editYourProfile')}</Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Preview Profile Button */}
          <TouchableOpacity
            style={[styles.previewProfileButton, { backgroundColor: colors.card }]}
            onPress={handlePreviewProfile}
          >
            <MaterialCommunityIcons name="eye-outline" size={20} color="#A08AB7" />
            <Text style={styles.previewProfileText}>{t('profile.previewProfile')}</Text>
          </TouchableOpacity>

          {/* Premium Status */}
          {isPremium ? (
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', delay: 200 }}
          style={styles.premiumCard}
        >
          <LinearGradient
            colors={isPlatinum ? ['#FFD700', '#FFA500'] : ['#A08AB7', '#CDC2E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.premiumGradient}
          >
            <View style={styles.premiumHeader}>
              <View style={styles.premiumTitleRow}>
                <MaterialCommunityIcons
                  name={isPlatinum ? 'crown' : 'star'}
                  size={24}
                  color="white"
                />
                <Text style={styles.premiumTitle}>
                  {isPlatinum ? t('profile.platinumMember') : t('profile.premiumMember')}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push('/settings/subscription')}
              >
                <MaterialCommunityIcons name="cog" size={20} color="white" />
              </TouchableOpacity>
            </View>

            <Text style={styles.premiumSubtitle}>
              {isPlatinum
                ? t('profile.enjoyingPlatinumFeatures')
                : t('profile.enjoyingPremiumFeatures')}
            </Text>

            {/* Premium Benefits */}
            <View style={styles.premiumBenefits}>
              {[
                t('profile.unlimitedSwipes'),
                t('profile.seeWhoLikesYou'),
                isPlatinum ? t('profile.weeklyProfileBoost') : t('profile.superLikesPerWeek'),
                isPlatinum ? t('profile.prioritySupport') : t('profile.voiceMessages'),
              ].map((benefit, i) => (
                <View key={i} style={styles.benefitRow}>
                  <MaterialCommunityIcons name="check-circle" size={16} color="white" />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>

            {/* TODO: Re-enable when Platinum launches */}
            {/* {!isPlatinum && (
              <TouchableOpacity
                style={styles.upgradeToPlatinum}
                onPress={() => setShowPaywall(true)}
              >
                <MaterialCommunityIcons name="crown" size={16} color="#9B87CE" />
                <Text style={styles.upgradeToPlatinumText}>{t('profile.upgradeToPlatinum')}</Text>
              </TouchableOpacity>
            )} */}
          </LinearGradient>
        </MotiView>
      ) : (
        <MotiView
          from={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', delay: 200 }}
          style={styles.upgradeCard}
        >
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={() => setShowPaywall(true)}
          >
            <LinearGradient
              colors={['#A08AB7', '#CDC2E5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.upgradeGradient}
            >
              <View style={styles.upgradeIconContainer}>
                <MaterialCommunityIcons name="crown" size={40} color="white" />
              </View>

              <Text style={styles.upgradeTitle}>{t('profile.upgradeToPremium')}</Text>
              <Text style={styles.upgradeSubtitle}>
                {t('profile.upgradeToPremiumSubtitle')}
              </Text>

              <View style={styles.upgradeFeatures}>
                {[
                  t('profile.unlimitedSwipes'),
                  t('profile.seeWhoLikesYou'),
                  t('profile.advancedFilters'),
                  t('profile.readReceiptsAndVoice'),
                ].map((feature, i) => (
                  <View key={i} style={styles.upgradeFeatureRow}>
                    <MaterialCommunityIcons name="check" size={18} color="white" />
                    <Text style={styles.upgradeFeatureText}>{feature}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.upgradeCTA}>
                <Text style={styles.upgradeCTAText}>{t('profile.unlockPremiumFeatures')}</Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#9B87CE" />
              </View>
            </LinearGradient>
          </TouchableOpacity>
          </MotiView>
          )}

          {/* Menu Items */}
          <View style={styles.menuSection}>
        <Text style={[styles.menuSectionTitle, { color: colors.mutedForeground }]}>{t('profile.account')}</Text>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.card }]}
          onPress={() => router.push('/settings/privacy')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="cog-outline" size={24} color={colors.mutedForeground} />
            <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.settingsPrivacy')}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.card }]}
          onPress={() => router.push('/settings/notifications')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="bell-outline" size={24} color={colors.mutedForeground} />
            <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.notifications')}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.card }]}
          onPress={() => router.push('/settings/screenshot-alerts')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="shield-alert" size={24} color="#EF4444" />
            <Text style={[styles.menuItemText, { color: '#EF4444', fontWeight: '600' }]}>{t('profile.screenshotAlerts')}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#EF4444" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.card }]}
          onPress={() => router.push('/settings/matching-preferences')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="heart-cog" size={24} color="#A08AB7" />
            <Text style={[styles.menuItemText, { color: '#A08AB7', fontWeight: '600' }]}>{t('profile.matchingPreferences')}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#A08AB7" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.card }]}
          onPress={() => router.push('/settings/language')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="translate" size={24} color={colors.mutedForeground} />
            <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.language')}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.card }]}
          onPress={() => router.push('/settings/appearance')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="theme-light-dark" size={24} color={colors.mutedForeground} />
            <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.appearance')}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.card }]}
          onPress={() => router.push('/reviews/my-reviews')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="star-outline" size={24} color={colors.mutedForeground} />
            <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.myReviews')}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.card }]}
          onPress={() => router.push('/settings/review-settings')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="star-settings-outline" size={24} color={colors.mutedForeground} />
            <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.reviewSettings')}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.card }]}
          onPress={() => router.push('/settings/privacy')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="shield-check-outline" size={24} color={colors.mutedForeground} />
            <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.photoVerification')}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.card }]}
          onPress={() => router.push('/settings/subscription')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons
              name={isPremium ? "credit-card-outline" : "crown-outline"}
              size={24}
              color={isPremium ? colors.mutedForeground : "#A08AB7"}
            />
            <Text style={[styles.menuItemText, { color: isPremium ? colors.foreground : '#A08AB7' }, !isPremium && { fontWeight: '600' }]}>
              {isPremium ? t('profile.manageSubscription') : t('profile.upgradeToPremium')}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={isPremium ? colors.border : "#A08AB7"} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.card }]}
          onPress={() => router.push('/settings/safety-center')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="shield-check-outline" size={24} color={colors.mutedForeground} />
            <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.safetyCenter')}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.card }]}
          onPress={() => router.push('/settings/blocked-users')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="cancel" size={24} color={colors.mutedForeground} />
            <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.blockedUsers')}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.card }]}
          onPress={() => router.push('/settings/contact-blocking')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="phone-off" size={24} color={colors.mutedForeground} />
            <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.blockContacts')}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.card }]}
          onPress={() => router.push('/settings/country-blocking')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="earth-off" size={24} color={colors.mutedForeground} />
            <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.blockCountries')}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
        </TouchableOpacity>

        {/* Admin Panel - Only visible to admins */}
        {isAdmin && (
          <>
            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: '#FEF3C7', borderLeftWidth: 4, borderLeftColor: '#F59E0B' }]}
              onPress={() => router.push('/admin/reports')}
            >
              <View style={styles.menuItemLeft}>
                <MaterialCommunityIcons name="shield-alert" size={24} color="#F59E0B" />
                <View>
                  <Text style={[styles.menuItemText, { color: '#92400E', fontWeight: '700' }]}>{t('profile.adminPanel')}</Text>
                  <Text style={{ fontSize: 12, color: '#92400E', marginTop: 2 }}>{t('profile.viewReports')}</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#F59E0B" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: '#DBEAFE', borderLeftWidth: 4, borderLeftColor: '#3B82F6' }]}
              onPress={() => router.push('/admin/cost-monitoring')}
            >
              <View style={styles.menuItemLeft}>
                <MaterialCommunityIcons name="chart-line" size={24} color="#3B82F6" />
                <View>
                  <Text style={[styles.menuItemText, { color: '#1E40AF', fontWeight: '700' }]}>{t('profile.costMonitoring')}</Text>
                  <Text style={{ fontSize: 12, color: '#1E40AF', marginTop: 2 }}>{t('profile.databaseSize')}</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#3B82F6" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: '#FEE2E2', borderLeftWidth: 4, borderLeftColor: '#EF4444' }]}
              onPress={() => router.push('/admin/screenshot-monitor')}
            >
              <View style={styles.menuItemLeft}>
                <MaterialCommunityIcons name="camera-off" size={24} color="#EF4444" />
                <View>
                  <Text style={[styles.menuItemText, { color: '#991B1B', fontWeight: '700' }]}>{t('profile.screenshotMonitor')}</Text>
                  <Text style={{ fontSize: 12, color: '#991B1B', marginTop: 2 }}>{t('profile.banScreenshotUsers')}</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#EF4444" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.menuItem, { backgroundColor: '#F5F2F7', borderLeftWidth: 4, borderLeftColor: '#A08AB7' }]}
              onPress={() => router.push('/admin/push-notifications')}
            >
              <View style={styles.menuItemLeft}>
                <MaterialCommunityIcons name="bell-ring" size={24} color="#A08AB7" />
                <View>
                  <Text style={[styles.menuItemText, { color: '#6B21A8', fontWeight: '700' }]}>{t('profile.pushNotifications')}</Text>
                  <Text style={{ fontSize: 12, color: '#6B21A8', marginTop: 2 }}>{t('profile.sendMessagesToUsers')}</Text>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={24} color="#A08AB7" />
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.card }]}
          onPress={() => {
            Linking.openURL('mailto:hello@joinaccord.app?subject=Support Request&body=Hi Accord Team,\n\n');
          }}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="help-circle-outline" size={24} color={colors.mutedForeground} />
            <Text style={[styles.menuItemText, { color: colors.foreground }]}>{t('profile.helpSupport')}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color={colors.border} />
        </TouchableOpacity>
          </View>

          {/* Danger Zone */}
          <View style={styles.menuSection}>
        <Text style={[styles.menuSectionTitle, { color: colors.mutedForeground }]}>{t('profile.dangerZone')}</Text>

        <TouchableOpacity
          style={[styles.menuItem, { backgroundColor: colors.card, borderColor: '#FEE2E2', borderWidth: 1 }]}
          onPress={() => router.push('/settings/delete-account')}
        >
          <View style={styles.menuItemLeft}>
            <MaterialCommunityIcons name="delete-forever" size={24} color="#EF4444" />
            <Text style={[styles.menuItemText, { color: '#EF4444' }]}>{t('profile.deleteAccount')}</Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={24} color="#EF4444" />
        </TouchableOpacity>
          </View>

          {/* Sign Out */}
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
          >
            <MaterialCommunityIcons name="logout" size={20} color="#EF4444" />
            <Text style={styles.signOutText}>{t('profile.signOut')}</Text>
          </TouchableOpacity>

          {/* App Info */}
          <Text style={[styles.appVersion, { color: colors.mutedForeground }]}>{t('profile.appVersion')}</Text>

          {/* Spacing */}
          <View style={{ height: 40 }} />
        </View>
      </ScrollView>

      {/* Settings Button Overlay */}
      <TouchableOpacity
        style={styles.settingsButtonOverlay}
        onPress={() => router.push('/settings/privacy')}
      >
        <View style={styles.settingsButtonBackground}>
          <MaterialCommunityIcons name="cog-outline" size={24} color="white" />
        </View>
      </TouchableOpacity>

      {/* Premium Paywall */}
      <PremiumPaywall
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        variant={isPremium ? 'platinum' : 'premium'}
      />

      {/* Profile Preview Modal */}
      <Modal
        visible={showPreview}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setShowPreview(false)}
      >
        {profile && (
          <ImmersiveProfileCard
            profile={{
              ...profile,
              compatibility_score: undefined, // Don't show compatibility for own profile
              distance: undefined,
            } as any}
            preferences={preferences}
            onClose={() => setShowPreview(false)}
            visible={showPreview}
            isMatched={true} // Hide swipe actions for self-preview
            heightUnit={(profile?.height_unit as 'imperial' | 'metric') || 'imperial'}
            onSendMessage={undefined} // No message button for self-preview
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 20,
  },
  placeholderHeader: {
    height: 520,
  },
  placeholderGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  placeholderPhotoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  placeholderText: {
    color: 'white',
    fontSize: 14,
    marginTop: 8,
  },
  placeholderName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  settingsButtonOverlay: {
    position: 'absolute',
    top: 50,
    right: 20,
  },
  settingsButtonBackground: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editProfileButton: {
    marginVertical: 20,
    borderRadius: 16,
    overflow: 'hidden',
  },
  editProfileGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  editProfileText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  previewProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#A08AB7',
    backgroundColor: 'white',
    marginBottom: 20,
  },
  previewProfileText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#A08AB7',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    fontFamily: 'Inter',
    color: '#71717A',
  },
  premiumCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  premiumGradient: {
    padding: 24,
  },
  premiumHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  premiumTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  premiumTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  premiumSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    marginBottom: 20,
  },
  premiumBenefits: {
    gap: 10,
    marginBottom: 16,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  benefitText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '500',
  },
  upgradeToPlatinum: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'white',
    paddingVertical: 14,
    borderRadius: 16,
    marginTop: 8,
  },
  upgradeToPlatinumText: {
    fontSize: 15,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#A08AB7',
  },
  upgradeCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  upgradeGradient: {
    padding: 28,
    alignItems: 'center',
  },
  upgradeIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  upgradeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
    textAlign: 'center',
  },
  upgradeSubtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.95)',
    textAlign: 'center',
    marginBottom: 24,
  },
  upgradeFeatures: {
    alignSelf: 'stretch',
    gap: 12,
    marginBottom: 24,
  },
  upgradeFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upgradeFeatureText: {
    fontSize: 15,
    color: 'white',
    fontWeight: '500',
  },
  upgradeCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'white',
    paddingVertical: 16,
    borderRadius: 16,
    alignSelf: 'stretch',
  },
  upgradeCTAText: {
    fontSize: 16,
    fontFamily: 'PlusJakartaSans-Bold',
    color: '#A08AB7',
  },
  menuSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  menuSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginLeft: 4,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
    marginBottom: 16,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  appVersion: {
    fontSize: 13,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});
